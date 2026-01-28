import { Router } from "express"
import { askStream } from "../workflows/agent-chat/llm/llm"
import { db } from "../lib/firebase"
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

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

        let fullResponse = "";

        // Stream the response
        for await (const chunk of askStream(message)) {
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

export default router;