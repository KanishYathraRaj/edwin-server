import { adminDb } from '../../lib/firebase-admin';
import { searchRecords } from '../../rag/pineconeRAG';

export async function buildPrompt(message: string, userId: string, courseId: string): Promise<string> {
    const courseSnap = await adminDb.doc(`users/${userId}/courses/${courseId}`).get();
    if (!courseSnap.exists) throw new Error('Course not found');
    const course = courseSnap.data()!;

    const courseMaterial = await searchRecords(message, { courseId, userId });
    const context = courseMaterial.result.hits
        .map((hit: any) => hit.fields.chunk_text)
        .join('\n');

    // Include last 8 messages (4 exchanges) for conversation context
    const history: any[] = course.history || [];
    const recentHistory = history.slice(-8);
    const historySection = recentHistory.length > 0
        ? `\nRecent conversation:\n${recentHistory
            .map((m: any) => `${m.role === 'user' ? 'Teacher' : 'Edwin'}: ${String(m.content).slice(0, 400)}`)
            .join('\n\n')}\n`
        : '';

    return `You are Edwin, a helpful AI Teacher Assistant.
You are helping a teacher with their course: "${course.title}".
Answer the teacher's question based on the provided course material and conversation history.
If the answer is not in the course material, say so clearly.
Respond in clear, well-formatted markdown.
${historySection}
Course Material:
${context}

Teacher's Question:
${message}`;
}
