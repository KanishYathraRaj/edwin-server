import { ask, extractJSONFromLLM } from '../agent-chat/llm/llm';
import { adminDb } from '../../lib/firebase-admin';
import { searchRecords } from '../../rag/pineconeRAG';

export type QuizType = 'mcq' | 'tf' | 'short' | 'mixed';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizConfig {
    type: QuizType;
    difficulty: QuizDifficulty;
    count: number;
    topics?: string[];
}

const typeGuide: Record<QuizType, string> = {
    mcq: 'Generate ONLY multiple choice questions. Each must have exactly 4 options labeled A, B, C, D with exactly one correct answer.',
    tf: 'Generate ONLY true/false questions. Each answer must be a boolean (true or false).',
    short: 'Generate ONLY short answer questions. Provide a concise model answer for each.',
    mixed: 'Generate a mix of question types: roughly half MCQ, a quarter true/false, and a quarter short answer.',
};

export async function generateQuiz(userId: string, courseId: string, config: QuizConfig) {
    const courseSnap = await adminDb.doc(`users/${userId}/courses/${courseId}`).get();
    const course = courseSnap.data();

    const searchQuery = config.topics?.length
        ? `Topics: ${config.topics.join(', ')}`
        : 'comprehensive course overview for quiz generation';

    const records = await searchRecords(searchQuery, { courseId, userId });
    const context = records.result.hits
        .map((h: any) => h.fields?.chunk_text || '')
        .join('\n')
        .slice(0, 3000);

    const prompt = `You are an educational assessment expert creating a quiz for "${course?.title || 'this course'}".

Settings:
- Difficulty: ${config.difficulty}
- Number of questions: ${config.count}
- Type: ${typeGuide[config.type]}

${context ? `Course Material:\n${context}` : ''}

Return ONLY valid JSON — no extra text, no markdown code blocks:
{
    "title": "Quiz: ${course?.title || 'Course Quiz'}",
    "difficulty": "${config.difficulty}",
    "questions": [
        {
            "type": "mcq",
            "question": "What is X?",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "answer": "A",
            "explanation": "Because..."
        },
        {
            "type": "tf",
            "question": "X is true.",
            "answer": true,
            "explanation": "Because..."
        },
        {
            "type": "short",
            "question": "Explain X.",
            "answer": "X is..."
        }
    ]
}`;

    const response = await ask(prompt);
    return extractJSONFromLLM(response);
}
