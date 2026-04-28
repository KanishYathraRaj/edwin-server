import { adminDb } from '../../lib/firebase-admin';
import { searchRecords } from '../../rag/pineconeRAG';

export async function buildPrompt(message: string, userId: string, courseId: string): Promise<string> {
    const courseSnap = await adminDb.doc(`users/${userId}/courses/${courseId}`).get();
    const course = courseSnap.data();

    const courseMaterial = await searchRecords(message, { courseId, userId });
    const context = courseMaterial.result.hits
        .map((hit: any) => hit.fields.chunk_text)
        .join('\n');

    return `You are Edwin, a helpful Teacher Assistant.
You are helping a teacher with their course: "${course?.title}".
Answer the teacher's question based on the provided course material.
If the answer is not in the course material, say so clearly.
Respond in clear, well-formatted markdown.

Course Material:
${context}

Teacher's Question:
${message}`;
}
