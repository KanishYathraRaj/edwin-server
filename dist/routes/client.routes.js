"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const llm_1 = require("../workflows/agent-chat/llm/llm");
const firebase_1 = require("../lib/firebase");
const firestore_1 = require("firebase/firestore");
const router = (0, express_1.Router)();
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
        for await (const chunk of (0, llm_1.askStream)(message)) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
        // After streaming is done, save to history if IDs are provided
        if (userId && courseId && firebase_1.db) {
            try {
                const courseRef = (0, firestore_1.doc)(firebase_1.db, "users", userId, "courses", courseId);
                await (0, firestore_1.updateDoc)(courseRef, {
                    history: (0, firestore_1.arrayUnion)({
                        role: "user",
                        content: message,
                        timestamp: new Date().toISOString()
                    }, {
                        role: "system",
                        content: fullResponse,
                        timestamp: new Date().toISOString()
                    })
                });
                console.log(`Saved chat history for user ${userId}, course ${courseId}`);
            }
            catch (dbError) {
                console.error("Error saving chat history:", dbError);
                // We don't fail the request here since the response was already streamed
            }
        }
        // Send completion message
        res.write('data: {"type":"done"}\n\n');
        res.end();
    }
    catch (error) {
        console.error("Error in agent-chat route:", error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`);
        res.end();
    }
});
exports.default = router;
