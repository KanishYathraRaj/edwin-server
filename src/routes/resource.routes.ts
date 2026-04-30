import { Router } from 'express';
import { upsertRecords, deleteRecordsByFilter } from '../rag/pineconeRAG';
import { adminDb, FieldValue } from '../lib/firebase-admin';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT'));
        }
    },
});

function parseFilter(raw: string | undefined, fallback: Record<string, unknown>) {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

router.post('/upload_syllabus', requireAuth, upload.single('data'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
    }

    const userId = (req as AuthenticatedRequest).uid;
    const filter = parseFilter(req.body.filter, {
        source: 'syllabus',
        filename: req.file.originalname,
        userId,
    });
    filter.userId = userId;

    try {
        // Delete existing syllabus vectors before uploading new ones
        if (filter.courseId) {
            await deleteRecordsByFilter({ userId, courseId: String(filter.courseId), source: 'syllabus' })
                .catch(e => console.error('Failed to clear old syllabus vectors:', e));
        }

        await upsertRecords(req.file.buffer, filter);

        if (filter.courseId) {
            const courseRef = adminDb.doc(`users/${userId}/courses/${filter.courseId}`);
            await courseRef.set({
                syllabus: { name: req.file.originalname, uploadedAt: new Date().toISOString() },
            }, { merge: true }).catch(e => console.error('Firestore syllabus update failed:', e));
        }

        res.json({ success: true, message: 'Syllabus uploaded successfully' });
    } catch (error: any) {
        console.error('upload_syllabus error:', error.message);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

router.post('/upload_reference', requireAuth, upload.array('references', 10), async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
    }

    const userId = (req as AuthenticatedRequest).uid;
    const baseFilter = parseFilter(req.body.filter, { source: 'reference', userId });
    baseFilter.userId = userId;

    try {
        for (const file of files) {
            await upsertRecords(file.buffer, { ...baseFilter, filename: file.originalname });
        }

        if (baseFilter.courseId) {
            const courseRef = adminDb.doc(`users/${userId}/courses/${baseFilter.courseId}`);
            await courseRef.set({
                references: FieldValue.arrayUnion(
                    ...files.map(f => ({ name: f.originalname, uploadedAt: new Date().toISOString() }))
                ),
            }, { merge: true }).catch(e => console.error('Firestore reference update failed:', e));
        }

        res.json({ success: true, message: `${files.length} reference(s) uploaded` });
    } catch (error: any) {
        console.error('upload_reference error:', error.message);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

// Delete all syllabus vectors for a course (filter-based, ownership enforced via userId from token)
router.delete('/remove_syllabus', requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).uid;
    const courseId = String(req.query.courseId || '');

    if (!courseId) {
        res.status(400).json({ error: 'courseId query parameter is required' });
        return;
    }

    try {
        await deleteRecordsByFilter({ userId, courseId, source: 'syllabus' });
        const courseRef = adminDb.doc(`users/${userId}/courses/${courseId}`);
        await courseRef.update({ syllabus: FieldValue.delete() });
        res.json({ success: true });
    } catch (error: any) {
        console.error('remove_syllabus error:', error.message);
        res.status(500).json({ error: 'Failed to remove syllabus' });
    }
});

// Delete a specific reference by filename (ownership enforced via userId from token)
router.delete('/remove_reference', requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).uid;
    const courseId = String(req.query.courseId || '');
    const filename = String(req.query.filename || '');

    if (!courseId || !filename) {
        res.status(400).json({ error: 'courseId and filename query parameters are required' });
        return;
    }

    try {
        await deleteRecordsByFilter({ userId, courseId, source: 'reference', filename });

        // Remove from the Firestore references array
        const courseRef = adminDb.doc(`users/${userId}/courses/${courseId}`);
        const courseSnap = await courseRef.get();
        const refs: any[] = courseSnap.data()?.references ?? [];
        const updatedRefs = refs.filter((r: any) => r.name !== filename);
        await courseRef.update({ references: updatedRefs });

        res.json({ success: true });
    } catch (error: any) {
        console.error('remove_reference error:', error.message);
        res.status(500).json({ error: 'Failed to remove reference' });
    }
});

export default router;
