import { GoogleGenAI } from "@google/genai";

console.log('GOOGLE_API_KEY Config:', {
  url: process.env.GOOGLE_API_KEY ? 'Defined' : 'Undefined',
});

const ai = new GoogleGenAI({});

export async function ask(question: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: question,
  });
  return response.text;
}   