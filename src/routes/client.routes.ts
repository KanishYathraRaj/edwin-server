import { Router } from 'express';
import { z } from 'zod';
import { askStream } from '../workflows/agent-chat/llm/llm';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { buildPrompt } from '../workflows/agent-chat/prompt';
import { planLesson } from '../workflows/lesson-planner/planner';
import { prepareContent } from '../workflows/content-prep/content-prep';
import { generateQuestionBank } from '../workflows/question-bank/question-bank';
import { generateQuiz, QuizConfig } from '../workflows/quiz-gen/quiz-gen';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

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
    instruction: z.string().min(1, 'Instruction is required').max(1000),
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

    let fullResponse = '';
    try {
        const prompt = await buildPrompt(message, userId, courseId);
        for await (const chunk of askStream(prompt)) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }

        // Persist chat after streaming completes
        if (db) {
            const courseRef = doc(db, 'users', userId, 'courses', courseId);
            await updateDoc(courseRef, {
                history: arrayUnion(
                    { role: 'user', content: message, timestamp: new Date().toISOString() },
                    { role: 'system', content: fullResponse, timestamp: new Date().toISOString() }
                ),
            }).catch(err => console.error('History save failed:', err));
        }

        res.write('data: {"type":"done"}\n\n');
    } catch (error: any) {
        console.error('agent-chat error:', error.message);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI generation failed' })}\n\n`);
    } finally {
        res.end();
    }
});

router.post('/plan-lesson', requireAuth, validate(courseActionSchema), async (req, res) => {
    const { courseId } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    const syllabus = await planLesson(userId, courseId);
    const courseRef = doc(db, 'users', userId, 'courses', courseId);
    await setDoc(courseRef, { lessonPlan: syllabus }, { merge: true });
    res.json({ success: true, syllabus });
});

router.post('/content-prep', requireAuth, validate(contentPrepSchema), async (req, res) => {
    const { courseId, topics, description } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    const generatedContent = await prepareContent(userId, courseId, topics, description);

    if (db) {
        const courseRef = doc(db, 'users', userId, 'courses', courseId);
        const material = {
            id: `mat-${Date.now()}`,
            topics,
            description,
            content: generatedContent,
            timestamp: new Date().toISOString(),
        };
        await updateDoc(courseRef, { preparedContent: arrayUnion(material) });
    }

    res.json({ success: true, content: generatedContent });
});

router.post('/generate-questions', requireAuth, validate(questionBankSchema), async (req, res) => {
    const { courseId, instruction } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    const questionBank = await generateQuestionBank(instruction, userId, courseId);
    const courseRef = doc(db, 'users', userId, 'courses', courseId);
    await setDoc(courseRef, { questionBank }, { merge: true });
    res.json({ success: true, questionBank });
});

router.post('/generate-quiz', requireAuth, validate(quizGenSchema), async (req, res) => {
    const { courseId, type, difficulty, count, topics } = req.body;
    const userId = (req as AuthenticatedRequest).uid;

    const config: QuizConfig = { type, difficulty, count, topics };
    const quiz = await generateQuiz(userId, courseId, config);
    res.json({ success: true, quiz });
});

// Global route error wrapper
router.use((err: Error, _req: any, res: any, _next: any) => {
    console.error('Route error:', err.message);
    res.status(500).json({ error: 'Request failed', details: err.message });
});

export default router;
