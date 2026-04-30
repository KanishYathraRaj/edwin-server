import { searchRecords } from "../../rag/pineconeRAG";
import { ask, extractJSONFromLLM } from "../agent-chat/llm/llm";

async function planLesson(userId: string, courseId: string) {
    const filter = { userId, courseId, source: 'syllabus' };
    const content = await searchRecords("Get all content for syllabus planning", filter);

    const hits = content?.result?.hits ?? [];
    const contextText = hits
        .map((hit: any) => hit.fields?.chunk_text || '')
        .filter(Boolean)
        .join('\n');

    if (!contextText) {
        throw new Error('No syllabus content found. Please upload a syllabus in Resources first.');
    }

    const prompt = `You are a syllabus planning agent. Your task is to plan a structured syllabus for a course based on the provided content. List all topics one by one properly.

Content:
${contextText}

Return ONLY valid JSON — no extra text or markdown:
{
    "syllabus": [
        {
            "unit": "Unit Name",
            "topics": [
                "Topic 1",
                "Topic 2",
                "Topic 3"
            ]
        }
    ]
}`;

    const response = await ask(prompt);
    return extractJSONFromLLM(response);
}

export { planLesson };
