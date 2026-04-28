import { Router } from 'express';
import { upsertRecords, deleteRecords } from '../rag/pineconeRAG';
import multer from 'multer';
import { adminDb, FieldValue } from '../lib/firebase-admin';
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

    // Ensure the authenticated user matches the filter userId
    filter.userId = userId;

    await upsertRecords(req.file.buffer, filter);

    if (filter.courseId) {
        const courseRef = adminDb.doc(`users/${userId}/courses/${filter.courseId}`);
        await courseRef.set({
            syllabus: { name: req.file.originalname, uploadedAt: new Date().toISOString() },
        }, { merge: true }).catch(e => console.error('Firestore syllabus update failed:', e));
    }

    res.json({ success: true, message: 'Syllabus uploaded successfully' });
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
});

router.delete('/remove_syllabus/:id', requireAuth, async (req, res) => {
    await deleteRecords([String(req.params.id)]);
    res.json({ success: true });
});

router.delete('/remove_reference/:id', requireAuth, async (req, res) => {
    await deleteRecords([String(req.params.id)]);
    res.json({ success: true });
});

export default router;
