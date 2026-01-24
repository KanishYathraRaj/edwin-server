import { db } from '../db'

export async function updateState(id: number, state: object) {
    db.query(
        `UPDATE agent_runs SET state = $1 WHERE id = $2`,
        [JSON.stringify(state), id]
    );
}

export async function updateHistory(id: number, userPrompt: string, aiResponse: object) {
    try {
        // First, get the current memory to check if history exists
        const result = await db.query(
            `SELECT memory FROM agent_runs WHERE id = $1`,
            [id]
        );

        const currentMemory = result.rows[0]?.memory || {};
        const currentHistory = currentMemory.history || [];

        // Create new history entry
        const newHistoryEntry = {
            timestamp: new Date().toISOString(),
            userPrompt,
            aiResponse
        };

        // Append to history array
        const updatedHistory = [...currentHistory, newHistoryEntry];

        // Update the memory with the new history
        await db.query(
            `UPDATE agent_runs 
             SET memory = jsonb_set(
                 COALESCE(memory, '{}'::jsonb),
                 '{history}',
                 $1::jsonb
             )
             WHERE id = $2`,
            [JSON.stringify(updatedHistory), id]
        );

        console.log('History updated successfully for agent run:', id);
    } catch (error) {
        console.error('Error updating history:', error);
        throw error;
    }
}

export async function readMemory(id: number) {
    const result = await db.query(
        `SELECT memory FROM agent_runs WHERE id = $1`,
        [id]
    );
    return result.rows[0]?.memory || {};
}

