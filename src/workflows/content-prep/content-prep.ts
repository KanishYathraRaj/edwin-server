import { askStream } from "../agent-chat/llm/llm";
import { searchRecords } from "../../rag/pineconeRAG";

export async function* prepareContentStream(
    userId: string,
    courseId: string,
    topics: string[],
    description: string
): AsyncGenerator<string> {
    const filter = { userId, courseId };

    let courseContext = "";
    try {
        const records = await searchRecords(
            `Educational content about: ${topics.join(", ")}`,
            filter
        );
        if (records?.result?.hits) {
            courseContext = records.result.hits
                .map((hit: any) => hit.fields?.chunk_text || "")
                .join("\n")
                .slice(0, 4000);
        }
    } catch (e) {
        console.error("Pinecone search error:", e);
    }

    const topicsStr = topics.join(", ");
    const instrStr = description ? `\nAdditional focus: ${description}` : "";
    const contextStr = courseContext
        ? `\n\nCourse material reference:\n${courseContext}`
        : "";

    const prompt = `You are an expert educator creating comprehensive teaching content.

Topic(s): ${topicsStr}${instrStr}${contextStr}

Write thorough, well-structured educational content in clean Markdown. Use this exact structure:

# [Clear topic title]

## Overview
[2–3 sentence introduction]

## Detailed Explanation
[Multiple paragraphs. Use **bold** for key terms.]

## Key Points
- [Key point 1]
- [Key point 2]
- [Key point 3]
- [Key point 4]
- [Key point 5]

## Practical Examples
1. **[Example title]**: [Description and explanation]
2. **[Example title]**: [Description and explanation]
3. **[Example title]**: [Description and explanation]

## Review Questions
1. [Question that tests understanding]
2. [Question that requires application]
3. [Question that encourages analysis]
4. [Question that connects to broader concepts]

Be thorough, accurate, and pedagogically sound.`;

    yield* askStream(prompt);
}
