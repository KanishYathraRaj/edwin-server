import { ask as askGemini, askStream as askGeminiStream } from "./gemini";
import { ask as askOllama, askStream as askOllamaStream } from "./ollama";
import { z } from "zod";

console.log('LLM Config:', process.env.LLM);

export async function ask(prompt: string) {
    let model = process.env.LLM;

    if (model === "ollama") {
        const answer = await askOllama(prompt);
        return answer;
    }
    else if (model === "gemini") {
        const answer = await askGemini(prompt);
        return answer;
    }
    else {
        throw new Error("LLM not found");
    }
}

export async function* askStream(prompt: string): AsyncGenerator<string> {
    let model = process.env.LLM;

    if (model === "ollama") {
        yield* askOllamaStream(prompt);
    }
    else if (model === "gemini") {
        yield* askGeminiStream(prompt);
    }
    else {
        throw new Error("LLM not found");
    }
}

export const askLlmTool = {
    name: "ask_llm",
    schema: {
        prompt: z.string()
    },
    handler: async ({ prompt }: { prompt: string }) => {
        const res = await ask(prompt);
        return {
            content: [{
                type: "text",
                text: res
            }]
        };
    }
};

export function extractJSONFromLLM(response: string): any {
    if (!response) throw new Error("Empty LLM response");

    // Remove markdown code blocks
    response = response.replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    // Try direct parse first
    try {
        return JSON.parse(response);
    } catch { }

    // Extract JSON substring
    const firstBrace = response.indexOf("{");
    const lastBrace = response.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonString = response.slice(firstBrace, lastBrace + 1);

        try {
            return JSON.parse(jsonString);
        } catch { }
    }

    // Attempt minor repairs
    try {
        const repaired = response
            .replace(/(\w+):/g, '"$1":') // add quotes to keys
            .replace(/'/g, '"'); // convert single quotes

        return JSON.parse(repaired);
    } catch { }

    throw new Error("Failed to extract JSON from LLM response");
}