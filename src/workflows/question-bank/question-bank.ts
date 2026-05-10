import { ask, extractJSONFromLLM } from '../agent-chat/llm/llm';
import { adminDb } from '../../lib/firebase-admin';
import { searchRecords } from '../../rag/pineconeRAG';

export type QBType = 'mcq' | 'tf' | 'short' | 'mixed';
export type QBDifficulty = 'easy' | 'medium' | 'hard';

export interface QBConfig {
    type: QBType;
    difficulty: QBDifficulty;
    count: number;
    topics?: string[];
    instruction?: string;
}

export interface GeneratedQuestion {
    type: 'mcq' | 'tf' | 'short';
    question: string;
    options?: string[];
    answer: string | boolean;
    explanation?: string;
    topic?: string;
    difficulty: QBDifficulty;
}

const typeGuide: Record<QBType, string> = {
    mcq: 'Generate ONLY multiple choice questions. Each must have exactly 4 options labeled "A. ...", "B. ...", "C. ...", "D. ...". Store the answer as the letter only (e.g. "A").',
    tf: 'Generate ONLY true/false questions. The answer field must be a JSON boolean: true or false.',
    short: 'Generate ONLY short answer questions with a concise model answer string.',
    mixed: 'Generate a mix: roughly half MCQ, one quarter true/false, one quarter short answer.',
};

export async function generateQuestions(userId: string, courseId: string, config: QBConfig): Promise<GeneratedQuestion[]> {
    const courseSnap = await adminDb.doc(`users/${userId}/courses/${courseId}`).get();
    if (!courseSnap.exists) throw new Error('Course not found');
    const course = courseSnap.data()!;

    const searchQuery = config.topics?.length
        ? config.topics.join(', ')
        : config.instruction || 'course overview and key concepts';

    const records = await searchRecords(searchQuery, { courseId, userId });
    const context = records.result.hits
        .map((h: any) => h.fields?.chunk_text || '')
        .join('\n')
        .slice(0, 4000);

    const prompt = `You are an expert educator building a question bank for the course "${course?.title || 'this course'}".

Instructions: ${typeGuide[config.type]}
Difficulty: ${config.difficulty}
Number of questions: ${config.count}
${config.topics?.length ? `Focus on these topics: ${config.topics.join(', ')}` : ''}
${config.instruction ? `Additional instruction: ${config.instruction}` : ''}

${context ? `Course Material:\n${context}\n` : ''}
Return ONLY valid JSON — no markdown, no extra text:
{
    "questions": [
        {
            "type": "mcq",
            "question": "Question text?",
            "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
            "answer": "A",
            "explanation": "Why A is correct.",
            "topic": "Topic name",
            "difficulty": "${config.difficulty}"
        },
        {
            "type": "tf",
            "question": "Statement to evaluate.",
            "answer": true,
            "explanation": "Why this is true.",
            "topic": "Topic name",
            "difficulty": "${config.difficulty}"
        },
        {
            "type": "short",
            "question": "Open-ended question?",
            "answer": "Concise model answer.",
            "topic": "Topic name",
            "difficulty": "${config.difficulty}"
        }
    ]
}`;

    const response = await ask(prompt);
    const parsed = extractJSONFromLLM(response);

    if (!Array.isArray(parsed.questions)) {
        throw new Error('LLM did not return a questions array');
    }

    return parsed.questions as GeneratedQuestion[];
}
