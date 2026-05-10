import { Router } from 'express';
import { z } from 'zod';
import { askStream } from '../workflows/agent-chat/llm/llm';
import { adminDb, FieldValue } from '../lib/firebase-admin';
import { buildPrompt } from '../workflows/agent-chat/prompt';
import { planLesson } from '../workflows/lesson-planner/planner';
import { prepareContentStream } from '../workflows/content-prep/content-prep';
import { generateQuestions, QBConfig } from '../workflows/question-bank/question-bank';
import { generateQuiz, QuizConfig } from '../workflows/quiz-gen/quiz-gen';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

function sanitizeError(err: unknown, fallback: string): string {
    if (process.env.NODE_ENV !== 'production') {
        return err instanceof Error ? err.message : fallback;
    }
    return fallback;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const agentChatSchema = z.object({
    message: z.string().min(1, 'Message is required').max(4000),
    courseId: z.string().min(1, 'courseId is required'),
});

const courseActionSchema = z.object({
    courseId: z.string().min(1, 'courseId is required'),
});

const contentPrepSchema = z.object({
    courseId: z.string().min(1, 'courseId is required'),
    topics: z.array(z.string()).min(1, 'At least one topic is required'),
    description: z.string().max(1000).optional().default(''),
});

const questionBankSchema = z.object({
    courseId: z.string().min(1, 'courseId is required'),
    type: z.enum(['mcq', 'tf', 'short', 'mixed']).default('mixed'),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    count: z.number().int().min(1).max(20).default(10),
    topics: z.array(z.string()).optional(),
    instruction: z.string().max(500).optional(),
});

const quizGenSchema = z.object({
    courseId: z.string().min(1, 'courseId is required'),
    type: z.enum(['mcq', 'tf', 'short', 'mixed']).default('mixed'),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    count: z.number().int().min(1).max(30).default(10),
    topics: z.array(z.string()).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/agent-chat', requireAuth, validate(agentChatSchema), async (req, res) => {
    const { message, courseId } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('data: {"type":"start"}\n\n');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    let fullResponse = '';
    try {
        const prompt = await buildPrompt(message, userId, courseId);
        for await (const chunk of askStream(prompt)) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            if (controller.signal.aborted) break;
        }

        // Persist chat after streaming completes
        const courseRef = adminDb.doc(`users/${userId}/courses/${courseId}`);
        await courseRef.update({
            history: FieldValue.arrayUnion(
                { role: 'user', content: message, timestamp: new Date().toISOString() },
                { role: 'system', content: fullResponse, timestamp: new Date().toISOString() }
            ),
        }).catch(err => console.error('History save failed:', err));

        res.write('data: {"type":"done"}\n\n');
    } catch (error: any) {
        console.error('agent-chat error:', error.message);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI generation failed' })}\n\n`);
    } finally {
        clearTimeout(timeoutId);
        res.end();
    }
});

router.post('/plan-lesson', requireAuth, validate(courseActionSchema), async (req, res) => {
    const { courseId } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    try {
        const syllabus = await planLesson(userId, courseId);
        const courseRef = adminDb.doc(`users/${userId}/courses/${courseId}`);
        await courseRef.set({ lessonPlan: syllabus }, { merge: true });
        res.json({ success: true, syllabus });
    } catch (error: any) {
        console.error('plan-lesson error:', error.message);
        res.status(500).json({ error: sanitizeError(error, 'Lesson planning failed') });
    }
});

router.post('/content-prep', requireAuth, validate(contentPrepSchema), async (req, res) => {
    const { courseId, topics, description } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('data: {"type":"start"}\n\n');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
        for await (const chunk of prepareContentStream(userId, courseId, topics, description)) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            if (controller.signal.aborted) break;
        }
        res.write('data: {"type":"done"}\n\n');
    } catch (error: any) {
        console.error('content-prep error:', error.message);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Content generation failed' })}\n\n`);
    } finally {
        clearTimeout(timeoutId);
        res.end();
    }
});

router.get('/question-bank', requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).uid;
    const courseId = String(req.query.courseId || '');
    if (!courseId) { res.status(400).json({ error: 'courseId is required' }); return; }

    try {
        const snapshot = await adminDb
            .collection(`users/${userId}/courses/${courseId}/questionBank`)
            .get();
        const questions = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        res.json({ success: true, questions });
    } catch (error: any) {
        console.error('get-question-bank error:', error.message);
        res.status(500).json({ error: 'Failed to load question bank' });
    }
});

router.post('/generate-questions', requireAuth, validate(questionBankSchema), async (req, res) => {
    const { courseId, type, difficulty, count, topics, instruction } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    try {
        const config: QBConfig = { type, difficulty, count, topics, instruction };
        const generated = await generateQuestions(userId, courseId, config);

        const bankRef = adminDb.collection(`users/${userId}/courses/${courseId}/questionBank`);
        const batch = adminDb.batch();
        const now = new Date().toISOString();
        const saved: any[] = [];

        for (const q of generated) {
            const docRef = bankRef.doc();
            batch.set(docRef, { ...q, createdAt: now });
            saved.push({ id: docRef.id, ...q, createdAt: now });
        }
        await batch.commit();

        res.json({ success: true, questions: saved });
    } catch (error: any) {
        console.error('generate-questions error:', error.message);
        res.status(500).json({ error: sanitizeError(error, 'Question bank generation failed') });
    }
});

router.delete('/question-bank/:questionId', requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).uid;
    const { questionId } = req.params;
    const courseId = String(req.query.courseId || '');
    if (!courseId) { res.status(400).json({ error: 'courseId is required' }); return; }

    try {
        await adminDb
            .doc(`users/${userId}/courses/${courseId}/questionBank/${questionId}`)
            .delete();
        res.json({ success: true });
    } catch (error: any) {
        console.error('delete-question error:', error.message);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});

router.delete('/question-bank', requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).uid;
    const courseId = String(req.query.courseId || '');
    if (!courseId) { res.status(400).json({ error: 'courseId is required' }); return; }

    try {
        const snapshot = await adminDb
            .collection(`users/${userId}/courses/${courseId}/questionBank`)
            .get();
        const batch = adminDb.batch();
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        res.json({ success: true });
    } catch (error: any) {
        console.error('clear-question-bank error:', error.message);
        res.status(500).json({ error: 'Failed to clear question bank' });
    }
});

router.post('/generate-quiz', requireAuth, validate(quizGenSchema), async (req, res) => {
    const { courseId, type, difficulty, count, topics } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    try {
        const config: QuizConfig = { type, difficulty, count, topics };
        const quiz = await generateQuiz(userId, courseId, config);
        res.json({ success: true, quiz });
    } catch (error: any) {
        console.error('generate-quiz error:', error.message);
        res.status(500).json({ error: sanitizeError(error, 'Quiz generation failed') });
    }
});

// Global route error wrapper
router.use((err: Error, _req: any, res: any, _next: any) => {
    console.error('Route error:', err.message);
    res.status(500).json({ error: 'Request failed' });
});

export default router;
