export async function getTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
        // pdf-parse default export is the parse function
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text as string;
    } catch (error: any) {
        console.error('Error parsing PDF:', error.message);
        throw error;
    }
}

export function chunkText(text: string, chunkSize = 1000, chunkOverlap = 200): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
        let endIndex = currentIndex + chunkSize;

        if (endIndex < text.length) {
            const lastSpace = text.lastIndexOf(' ', endIndex);
            if (lastSpace > currentIndex + chunkSize / 2) {
                endIndex = lastSpace;
            }
        }

        const chunk = text.slice(currentIndex, endIndex).trim();
        if (chunk.length > 0) chunks.push(chunk);

        const progress = endIndex - chunkOverlap;
        currentIndex = progress > currentIndex ? progress : currentIndex + 1;
    }

    return chunks;
}

export function getRecordsFromText(text: string, filter?: Record<string, unknown>) {
    const chunks = chunkText(text);
    return chunks.map((chunk, index) => ({
        id: `${filter?.id ?? Date.now()}-${index}`,
        text: chunk,
        ...filter,
    }));
}
