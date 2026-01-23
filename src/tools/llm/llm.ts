import { ask as askGemini } from "./gemini";
import { ask as askOllama } from "./ollama";

console.log('LLM Config:', process.env.LLM);

export async function ask(prompt: string) {

  if (process.env.LLM === "ollama") {
    const answer = await askOllama(prompt);
    return answer;
  }
  else if (process.env.LLM === "gemini") {
    const answer = await askGemini(prompt);
    return answer;
  }
  else {
    throw new Error("LLM not found");
  }
}
