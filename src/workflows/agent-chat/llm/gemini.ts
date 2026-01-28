import { GoogleGenAI } from "@google/genai";

console.log('GOOGLE_API_KEY Config:', {
  url: process.env.GOOGLE_API_KEY ? 'Defined' : 'Undefined',
});

const ai = new GoogleGenAI({});

export async function ask(question: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: question,
    });
    return response.text;
  } catch (error) {
    console.error('Gemini Error:', error);
    throw error;
  }
}

export async function* askStream(question: string): AsyncGenerator<string> {
  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: question,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error('Gemini Stream Error:', error);
    throw error;
  }
}