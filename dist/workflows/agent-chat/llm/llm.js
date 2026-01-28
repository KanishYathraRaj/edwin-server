"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askLlmTool = void 0;
exports.ask = ask;
exports.askStream = askStream;
const gemini_1 = require("./gemini");
const ollama_1 = require("./ollama");
const zod_1 = require("zod");
console.log('LLM Config:', process.env.LLM);
async function ask(prompt) {
    let model = process.env.LLM;
    if (model === "ollama") {
        const answer = await (0, ollama_1.ask)(prompt);
        return answer;
    }
    else if (model === "gemini") {
        const answer = await (0, gemini_1.ask)(prompt);
        return answer;
    }
    else {
        throw new Error("LLM not found");
    }
}
async function* askStream(prompt) {
    let model = process.env.LLM;
    if (model === "ollama") {
        yield* (0, ollama_1.askStream)(prompt);
    }
    else if (model === "gemini") {
        yield* (0, gemini_1.askStream)(prompt);
    }
    else {
        throw new Error("LLM not found");
    }
}
exports.askLlmTool = {
    name: "ask_llm",
    schema: {
        prompt: zod_1.z.string()
    },
    handler: async ({ prompt }) => {
        const res = await ask(prompt);
        return {
            content: [{
                    type: "text",
                    text: res
                }]
        };
    }
};
