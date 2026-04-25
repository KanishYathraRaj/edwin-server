import { Pinecone } from '@pinecone-database/pinecone';
import { getRecordsFromText, getTextFromBuffer } from './utils';

if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY environment variable is required');
}

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

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
        console.log(`Index ${indexName} created successfully`);
    } else {
        console.log(`Index ${indexName} already exists`);
    }
    return pc.index(indexName).namespace(namespace);
}

export async function upsertRecords(data: Buffer | string, filter?: Record<string, unknown>) {
    if (Buffer.isBuffer(data)) {
        await upsertRecordsForFile(data, filter);
    } else if (typeof data === 'string') {
        await upsertRecordsForText(data, filter);
    } else {
        throw new Error('Unsupported data type: must be Buffer or string');
    }
}

async function upsertRecordsForFile(buffer: Buffer, filter?: Record<string, unknown>) {
    const idx = await index;
    const text = await getTextFromBuffer(buffer);
    const records = await getRecordsFromText(text, filter);

    const BATCH_SIZE = 90;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await idx.upsertRecords({ records: batch });
        console.log(`Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);
    }
}

async function upsertRecordsForText(text: string, filter?: Record<string, unknown>) {
    const idx = await index;
    const records = await getRecordsFromText(text, filter);

    const BATCH_SIZE = 90;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await idx.upsertRecords({ records: batch });
        console.log(`Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);
    }
}

export async function searchRecords(query: string, filter?: Record<string, unknown>) {
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

export async function deleteRecords(ids: string[]) {
    const idx = await index;
    await idx.deleteMany(ids);
    console.log(`Deleted ${ids.length} records`);
}
