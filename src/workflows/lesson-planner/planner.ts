import { searchRecords } from "../../rag/pineconeRAG";
import { ask, extractJSONFromLLM } from "../agent-chat/llm/llm";

async function planLesson(userId: string, courseId: string) {
    let filter = {
        userId: userId,
        courseId: courseId,
        source: 'syllabus'
    }

    let query = "Get all the content for syllabus planning";

    const content = await searchRecords(query, filter);

    let prompt = `
    You are a syllabus planning agent. Your task is to plan a syllabus for a course based on the provided content.
    list all the topics one by one properly.
    
    Content: ${content.result.hits.map((hit: any) => hit.fields.chunk_text).join('\n')}
    

    Your Response Strictly in JSON format with the following structure:
    {
        "syllabus": [
            {
                "unit": "Unit Name",
                "topics": [
                    "Topic 1",
                    "Topic 2",
                    "Topic 3",
                    "......"
                ]
            }
        ]
    }
    `
    const response = await ask(prompt);
    const json_response = extractJSONFromLLM(response);
    return json_response;
}

export { planLesson };