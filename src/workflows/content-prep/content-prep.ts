import { ask } from "../agent-chat/llm/llm";
import { searchRecords } from "../../rag/pineconeRAG";

export async function prepareContent(userId: string, courseId: string, topics: string[], description: string) {

    let filter = {
        userId: userId,
        courseId: courseId
    }

    let query = `Get all the content related to these topics : ${topics.join(", ")}`
    const records = await searchRecords(query, filter);

    let courseContext = "";
    try {
        if (records && records.result && records.result.hits) {
            courseContext = records.result.hits.map((hit: any) => hit.fields?.chunk_text || "").join('\n');
        }
    } catch (e) {
        console.error("Error parsing Pinecone records:", e);
    }

    const topicsStr = topics.join(", ");
    const instrStr = description ? `Keep in mind: ${description}.` : "";
    const contextStr = courseContext ? `\n\nSome course material for context:\n${courseContext.slice(0, 2000)}` : "";

    // Ask a single prompt to save time, using text markers to parse the response
    const prompt = `Write a comprehensive educational content guide about: ${topicsStr}. ${instrStr}
${contextStr}

You MUST structure your response EXACTLY with the following four markers. Do not add markdown to the markers.

---EXPLANATION---
(Write the detailed educational explanation here. Write naturally, use paragraphs.)

---KEY_POINTS---
(List 5 important key points. Just write them line by line.)

---EXAMPLES---
(Give 3 practical real-world examples. Just write them line by line.)

---QUESTIONS---
(Write 4 review questions based on the content. Just write them line by line.)
`;

    console.log("Generating content for topics:", topicsStr);

    const rawResponse = await ask(prompt) || "";

    // Parse the sections using the text markers
    const parts = rawResponse.split(/---EXPLANATION---|---KEY_POINTS---|---EXAMPLES---|---QUESTIONS---/i);
    
    const explanationRaw = parts[1] || "";
    const keyPointsRaw = parts[2] || "";
    const examplesRaw = parts[3] || "";
    const questionsRaw = parts[4] || "";

    // Parse numbered/bullet list into array
    function parseList(text: string): string[] {
        return text
            .split('\n')
            .map(line => line.replace(/^[\s]*[\d]+[.)]\s*/, '').replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 5);
    }

    return {
        explanation: explanationRaw.trim(),
        key_points: parseList(keyPointsRaw),
        examples: parseList(examplesRaw),
        questions: parseList(questionsRaw),
    };
}