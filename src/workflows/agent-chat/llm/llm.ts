import { ask as askGemini, askStream as askGeminiStream } from "./gemini";
import { ask as askOllama, askStream as askOllamaStream } from "./ollama";
import { z } from "zod";

export async function ask(prompt: string) {
    const model = process.env.LLM;

    if (model === "ollama") {
        return askOllama(prompt);
    }
    if (model === "gemini") {
        return askGemini(prompt);
    }
    throw new Error(`Unknown LLM provider: "${model}". Set LLM=gemini or LLM=ollama.`);
}

export async function* askStream(prompt: string): AsyncGenerator<string> {
    const model = process.env.LLM;

    if (model === "ollama") {
        yield* askOllamaStream(prompt);
        return;
    }
    if (model === "gemini") {
        yield* askGeminiStream(prompt);
        return;
    }
    throw new Error(`Unknown LLM provider: "${model}". Set LLM=gemini or LLM=ollama.`);
}

export const askLlmTool = {
    name: "ask_llm",
    schema: { prompt: z.string() },
    handler: async ({ prompt }: { prompt: string }) => {
        const res = await ask(prompt);
        return { content: [{ type: "text", text: res }] };
    }
};

export function extractJSONFromLLM(response: string): any {
    if (!response) throw new Error("Empty LLM response");

    const cleaned = response
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

    // Try direct parse first
    try {
        return JSON.parse(cleaned);
    } catch { }

    // Extract the outermost JSON object or array
    const firstBrace  = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    const lastBrace   = cleaned.lastIndexOf("}");
    const lastBracket = cleaned.lastIndexOf("]");

    // Try object extraction
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } catch { }
    }

    // Try array extraction
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        try {
            return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
        } catch { }
    }

    throw new Error("Failed to extract valid JSON from LLM response");
}
