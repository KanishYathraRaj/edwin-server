"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractJSON = extractJSON;
function extractJSON(text) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No JSON found in LLM response");
    }
    const jsonString = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
}
