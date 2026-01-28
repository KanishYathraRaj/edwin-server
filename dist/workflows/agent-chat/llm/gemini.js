"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ask = ask;
exports.askStream = askStream;
const genai_1 = require("@google/genai");
console.log('GOOGLE_API_KEY Config:', {
    url: process.env.GOOGLE_API_KEY ? 'Defined' : 'Undefined',
});
const ai = new genai_1.GoogleGenAI({});
async function ask(question) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: question,
        });
        return response.text;
    }
    catch (error) {
        console.error('Gemini Error:', error);
        throw error;
    }
}
async function* askStream(question) {
    try {
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: question,
        });
        for await (const chunk of stream) {
            if (chunk.text) {
                yield chunk.text;
            }
        }
    }
    catch (error) {
        console.error('Gemini Stream Error:', error);
        throw error;
    }
}
