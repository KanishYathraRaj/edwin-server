import { GoogleGenAI } from '@google/genai';

if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function ask(question: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: question,
    });
    return response.text ?? '';
}

export async function* askStream(question: string): AsyncGenerator<string> {
    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: question,
    });

    for await (const chunk of stream) {
        if (chunk.text) {
            yield chunk.text;
        }
    }
}
