import { Router } from "express"
import { upsertRecords, deleteRecords } from "../rag/pineconeRAG";
import { db } from "../lib/firebase";
import multer from "multer";
import { doc, setDoc, arrayUnion } from "firebase/firestore";

const router = Router();
// Use memory storage so we get req.file.buffer which pineconeRAG.ts expects
const upload = multer({ storage: multer.memoryStorage() });

// Upload syllabus
router.post('/upload_syllabus', upload.single('data'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided" });
        }

        const fileBuffer = req.file.buffer;
        let filter;
        try {
            filter = req.body.filter ? JSON.parse(req.body.filter) : {
                source: 'syllabus',
                filename: req.file.originalname
            };
        } catch (e) {
            filter = {
                source: 'syllabus',
                filename: req.file.originalname,
                customFilter: req.body.filter
            };
        }

        await upsertRecords(fileBuffer, filter);

        // Update Firestore with the syllabus information
        if (filter.userId && filter.courseId) {
            try {
                const courseRef = doc(db, "users", filter.userId, "courses", filter.courseId);

                await setDoc(courseRef, {
                    syllabus: {
                        name: filter.filename,
                        uploadedAt: new Date().toISOString()
                    }
                }, { merge: true });
                console.log(`Updated Firestore course ${filter.courseId} with syllabus info`);
            } catch (fsError) {
                console.error("Failed to update Firestore with syllabus metadata:", fsError);
                // We don't fail the whole request if just the DB update fails, but we log it
            }
        }

        res.status(200).json({
            success: true,
            message: "Syllabus uploaded successfully"
        });

    } catch (error: any) {
        console.error('Error uploading syllabus:', error);
        res.status(500).json({ error: "Failed to upload syllabus", details: error.message });
    }
});

// Upload reference materials
router.post('/upload_reference', upload.array('references', 10), async (req, res) => {
    try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ error: "No files provided" });
        }

        let baseFilter;
        try {
            baseFilter = req.body.filter ? JSON.parse(req.body.filter) : { source: 'reference' };
        } catch (e) {
            baseFilter = { source: 'reference', customFilter: req.body.filter };
        }

        for (const file of req.files) {
            const fileFilter = { ...baseFilter, filename: file.originalname };
            await upsertRecords(file.buffer, fileFilter);
        }

        // Update Firestore with the syllabus information
        if (baseFilter.userId && baseFilter.courseId) {
            try {
                const courseRef = doc(db, "users", baseFilter.userId, "courses", baseFilter.courseId);

                await setDoc(courseRef, {
                    references: arrayUnion(
                        ...req.files.map((file: any) => ({
                            name: file.originalname,
                            uploadedAt: new Date().toISOString()
                        }))
                    )
                }, { merge: true });
                console.log(`Updated Firestore course ${baseFilter.courseId} with reference info`);
            } catch (fsError) {
                console.error("Failed to update Firestore with reference metadata:", fsError);
                // We don't fail the whole request if just the DB update fails, but we log it
            }
        }

        res.status(200).json({
            success: true,
            message: `${req.files.length} reference(s) uploaded successfully`
        });

    } catch (error: any) {
        console.error('Error uploading references:', error);
        res.status(500).json({ error: "Failed to upload references", details: error.message });
    }
});

// Remove syllabus
router.delete('/remove_syllabus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteRecords([id]);
        res.status(200).json({ success: true, message: "Record deleted successfully" });
    }
    catch (error: any) {
        console.error('Error deleting records:', error);
        res.status(500).json({ error: "Failed to delete record", details: error.message });
    }
});

// Remove reference
router.delete('/remove_reference/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteRecords([id]);
        res.status(200).json({ success: true, message: "Record deleted successfully" });
    }
    catch (error: any) {
        console.error('Error deleting records:', error);
        res.status(500).json({ error: "Failed to delete record", details: error.message });
    }
});

export default router;