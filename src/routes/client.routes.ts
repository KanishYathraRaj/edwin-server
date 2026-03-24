import { Router } from "express"
import { askStream } from "../workflows/agent-chat/llm/llm"
import { db } from "../lib/firebase"
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { buildPrompt } from "../workflows/agent-chat/prompt";
import { planLesson } from "../workflows/lesson-planner/planner";
import { prepareContent } from "../workflows/content-prep/content-prep";
import { generateQuestionBank } from "../workflows/question-bank/question-bank";

const router = Router();

router.post('/agent-chat', async (req, res) => {
    try {
        const { message, userId, courseId } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send initial connection message
        res.write('data: {"type":"start"}\n\n');

        let prompt = await buildPrompt(message, userId, courseId);
        console.log(prompt);

        let fullResponse = "";

        // Stream the response
        for await (const chunk of askStream(prompt)) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }

        // After streaming is done, save to history if IDs are provided
        if (userId && courseId && db) {
            try {
                const courseRef = doc(db, "users", userId, "courses", courseId);

                await updateDoc(courseRef, {
                    history: arrayUnion(
                        {
                            role: "user",
                            content: message,
                            timestamp: new Date().toISOString()
                        },
                        {
                            role: "system",
                            content: fullResponse,
                            timestamp: new Date().toISOString()
                        }
                    )
                });
                console.log(`Saved chat history for user ${userId}, course ${courseId}`);
            } catch (dbError) {
                console.error("Error saving chat history:", dbError);
                // We don't fail the request here since the response was already streamed
            }
        }

        // Send completion message
        res.write('data: {"type":"done"}\n\n');

        res.end();
    } catch (error) {
        console.error("Error in agent-chat route:", error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`);
        res.end();
    }
});

router.post('/plan-lesson', async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: "Request body missing" });
        }
        const { userId, courseId } = req.body;
        if (!userId || !courseId) {
            return res.status(400).json({ error: "User ID and Course ID are required" });
        }
        const syllabus = await planLesson(userId, courseId);

        const courseRef = doc(db, "users", userId, "courses", courseId);
        await setDoc(courseRef, {
            lessonPlan: syllabus
        }, { merge: true });
        res.status(200).json({ success: true, syllabus });
    } catch (error: any) {
        console.error("Error in plan-lesson route:", error);
        res.status(500).json({ error: "Failed to plan lesson", details: error.message });
    }
});

router.post('/content-prep', async (req, res) => {
    try {
        const { userId, courseId, topics, description } = req.body;

        if (!userId || !courseId || !topics) {
            return res.status(400).json({ error: "User ID, Course ID, and topics are required" });
        }

        console.log(`Content Prep requested for user ${userId}, course ${courseId}`);
        console.log("Topics:", topics);
        console.log("Description:", description);

        // Generate actual content using the workflow
        const generatedContent = await prepareContent(userId, courseId, topics, description);

        // Save the prepared material to Firestore
        if (db) {
            const courseRef = doc(db, "users", userId, "courses", courseId);
            const material = {
                id: "mat-" + Date.now(),
                topics: topics,
                description: description,
                content: generatedContent,
                timestamp: new Date().toISOString()
            };

            await updateDoc(courseRef, {
                preparedContent: arrayUnion(material)
            });
        }

        res.status(200).json({
            success: true,
            message: "Content generated and saved successfully",
            content: generatedContent
        });
    } catch (error: any) {
        console.error("Error in content-prep route:", error);
        res.status(500).json({ error: "Failed to start content preparation", details: error.message });
    }
});

router.post('/generate-questions', async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: "Request body missing" });
        }
        const { userId, courseId, instruction } = req.body;
        if (!userId || !courseId) {
            return res.status(400).json({ error: "User ID and Course ID are required" });
        }
        console.log("Question Bank requested for user ", userId, "course ", courseId);
        console.log("Instruction: ", instruction);
        const questionBank = await generateQuestionBank(instruction, userId, courseId);
        console.log("Question Bank: ", questionBank);

        const courseRef = doc(db, "users", userId, "courses", courseId);
        await setDoc(courseRef, {
            questionBank: questionBank
        }, { merge: true });
        res.status(200).json({ success: true, questionBank });
    } catch (error: any) {
        console.error("Error in question-bank route:", error);
        res.status(500).json({ error: "Failed to generate question bank", details: error.message });
    }
});

export default router;