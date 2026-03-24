import { Pinecone } from '@pinecone-database/pinecone';
import { getRecordsFromText, getTextFromBuffer } from './utils';

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "pcsk_4a5ndy_LmBiVNMD3cWA2tGYHz2YyBLkpWKLuyfYSvqGh9fT2eEMboGbP3Z4fNWegA5dyP7"
});

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'edwin-knowledge-base';
const NAMESPACE = process.env.PINECONE_NAMESPACE || '__default__';

const index = setupIndex(INDEX_NAME, NAMESPACE);

async function setupIndex(indexName: string, namespace: string) {
    const existingIndexes = await pc.listIndexes();
    const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);
    if (!indexExists) {
        await pc.createIndexForModel({
            name: indexName,
            cloud: 'aws',
            region: 'us-east-1',
            embed: {
                model: 'llama-text-embed-v2',
                fieldMap: { text: 'chunk_text' }
            },
            waitUntilReady: true
        });
        console.log(`Index ${indexName} created successfully!`);
    } else {
        console.log(`Index ${indexName} already exists`);
    }
    return pc.index(indexName).namespace(namespace);
}

async function upsertRecords(data: any, filter?: any) {
    try {

        if (Buffer.isBuffer(data)) {
            console.log("Data is a Buffer");
            await upsertRecordsForFile(data, filter);

        } else if (typeof data === "string") {
            console.log("Data is text");
            await upsertRecordsForText(data, filter);

        } else {
            throw new Error("Unsupported data type");
        }

    } catch (error) {
        console.error("Error upserting records:", error);
        throw error;
    }
}

async function upsertRecordsForFile(buffer: Buffer, filter?: any) {
    try {
        const idx = await index;
        const text = await getTextFromBuffer(buffer);
        console.log("Text from the Buffer", text);
        const records = await getRecordsFromText(text, filter);

        // Pinecone has a limit of 96 records per batch when using integrated inference
        const BATCH_SIZE = 90;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            await idx.upsertRecords({ records: batch });
            console.log(`Upserted batch of ${batch.length} records`);
        }
    }
    catch (error) {
        console.error('Error upserting records for file:', error);
        throw error;
    }
}

async function upsertRecordsForText(text: string, filter?: any) {
    try {
        const idx = await index;
        const records = await getRecordsFromText(text, filter);

        const BATCH_SIZE = 90;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            await idx.upsertRecords({ records: batch });
            console.log(`Upserted batch of ${batch.length} records`);
        }
    }
    catch (error) {
        console.error('Error upserting records for text:', error);
        throw error;
    }
}

async function searchRecords(query: string, filter?: any) {
    try {
        const idx = await index;
        const results = await idx.searchRecords({
            query: {
                topK: 10,
                inputs: { text: query },
                filter: filter
            },
            rerank: {
                model: 'bge-reranker-v2-m3',
                topN: 10,
                rankFields: ['text'],
            },
        });
        return results;
    }
    catch (error) {
        console.error('Error searching records:', error);
        throw error;
    }
}

async function deleteRecords(ids: string[]) {
    try {
        const idx = await index;
        await idx.deleteMany(ids);
        console.log(`Deleted ${ids.length} records successfully!`);
    }
    catch (error) {
        console.error('Error deleting records:', error);
        throw error;
    }
}

export { upsertRecords, searchRecords, deleteRecords }





