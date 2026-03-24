import fs from 'fs'

export async function getTextFromBuffer(buffer: Buffer) {
    try {
        const { PDFParse } = await import('pdf-parse') as any;
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        return data.text;
    }
    catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
}

export async function chunkText(text: string, chunkSize: number = 1000, chunkOverlap: number = 200) {
    try {
        const chunks: string[] = [];
        let currentIndex = 0;

        while (currentIndex < text.length) {
            let endIndex = currentIndex + chunkSize;

            // If we're not at the very end of the text, try to find a natural breaking point
            if (endIndex < text.length) {
                // Look for the last space before endIndex to avoid cutting words in half
                const lastSpace = text.lastIndexOf(' ', endIndex);
                if (lastSpace > currentIndex + (chunkSize / 2)) {
                    endIndex = lastSpace;
                }
            }

            const chunk = text.slice(currentIndex, endIndex).trim();
            if (chunk.length > 0) {
                chunks.push(chunk);
            }

            // Move forward by chunk size minus overlap to create the overlapping window
            currentIndex = endIndex - chunkOverlap;

            // Prevent infinite loop if overlap is somehow incorrectly larger than progress
            if (endIndex <= currentIndex + chunkOverlap && endIndex - chunkOverlap <= currentIndex) {
                currentIndex += 1;
            }
        }

        return chunks;
    }
    catch (error) {
        console.error('Error chunking text:', error);
        throw error;
    }
}

export async function getRecordsFromText(text: string, filter?: any) {
    try {
        const chunks = await chunkText(text);
        const records: any = chunks.map((chunk: string, index: number) => {
            return {
                id: (filter?.id || Date.now().toString()) + `-${index}`,
                text: chunk,
                ...filter
            }
        });
        return records;
    }
    catch (error) {
        console.error('Error getting records from text:', error);
        throw error;
    }
}

