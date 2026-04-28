import { ask, extractJSONFromLLM } from "../agent-chat/llm/llm";
import { adminDb } from "../../lib/firebase-admin";
import { searchRecords } from "../../rag/pineconeRAG";

async function buildPrompt(message: string, userId: string, courseId: string): Promise<string> {
    const courseSnap = await adminDb.doc(`users/${userId}/courses/${courseId}`).get();
    const course = courseSnap.data();

    const records = await searchRecords(message, { courseId, userId });
    const context = records.result.hits
        .map((hit: any) => hit.fields?.chunk_text || '')
        .join('\n')
        .slice(0, 3000);

    return `You are an expert educator creating a question bank for the course "${course?.title}".

Teacher's instruction: ${message}

${context ? `Course material:\n${context}\n\n` : ''}Return ONLY valid JSON — no extra text or markdown:
{
    "questions": [
        "Question 1?",
        "Question 2?",
        "Question 3?"
    ]
}`;
}

export async function generateQuestionBank(instruction: string, userId: string, courseId: string) {
    const prompt = await buildPrompt(instruction, userId, courseId);
    const response = await ask(prompt);
    return extractJSONFromLLM(response);
}
