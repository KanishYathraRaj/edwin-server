import { ask as askGemini } from "./gemini";
import { ask as askOllama } from "./ollama";
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
