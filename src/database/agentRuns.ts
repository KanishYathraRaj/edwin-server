import { db } from '../db';

// ==================== CRUD OPERATIONS FOR AGENT_RUNS TABLE ====================

// ==================== CREATE ====================
export async function createAgentRun(data: {
    state?: object;
    canvas?: object;
    memory?: object;
    user_id: number;
}) {
    const result = await db.query(
        `INSERT INTO agent_runs (state, canvas, memory, user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
        [
            JSON.stringify(data.state || {}),
            JSON.stringify(data.canvas || {}),
            JSON.stringify(data.memory || {}),
            data.user_id
        ]
    );
    return result.rows[0];
}

// ==================== READ ====================

// Get a single agent run by ID
export async function getAgentRunById(id: number) {
    const result = await db.query(
        'SELECT * FROM agent_runs WHERE id = $1',
        [id]
    );
    return result.rows[0];
}

// Get all agent runs for a user
export async function getAgentRunsByUserId(user_id: number) {
    const result = await db.query(
        'SELECT * FROM agent_runs WHERE user_id = $1 ORDER BY created_at DESC',
        [user_id]
    );
    return result.rows;
}

// Get all agent runs (with pagination)
export async function getAllAgentRuns(limit = 10, offset = 0) {
    const result = await db.query(
        'SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
    return result.rows;
}

// ==================== UPDATE ====================

// Update specific fields
export async function updateAgentRun(id: number, data: {
    state?: object;
    canvas?: object;
    memory?: object;
}) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.state !== undefined) {
        updates.push(`state = $${paramIndex++}`);
        values.push(JSON.stringify(data.state));
    }
    if (data.canvas !== undefined) {
        updates.push(`canvas = $${paramIndex++}`);
        values.push(JSON.stringify(data.canvas));
    }
    if (data.memory !== undefined) {
        updates.push(`memory = $${paramIndex++}`);
        values.push(JSON.stringify(data.memory));
    }

    if (updates.length === 0) {
        throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
        `UPDATE agent_runs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );

    return result.rows[0];
}

// Update just the state (partial JSONB merge)
export async function updateAgentRunState(id: number, stateUpdates: object) {
    const result = await db.query(
        `UPDATE agent_runs 
     SET state = state || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
        [JSON.stringify(stateUpdates), id]
    );
    return result.rows[0];
}

// ==================== DELETE ====================

// Delete by ID
export async function deleteAgentRun(id: number) {
    const result = await db.query(
        'DELETE FROM agent_runs WHERE id = $1 RETURNING *',
        [id]
    );
    return result.rows[0];
}

// Delete all runs for a user
export async function deleteAgentRunsByUserId(user_id: number) {
    const result = await db.query(
        'DELETE FROM agent_runs WHERE user_id = $1 RETURNING *',
        [user_id]
    );
    return result.rows;
}

// ==================== ADVANCED JSONB QUERIES ====================

// Query by JSONB field (e.g., find runs by status)
export async function getAgentRunsByStatus(status: string) {
    const result = await db.query(
        `SELECT * FROM agent_runs 
     WHERE state->>'status' = $1`,
        [status]
    );
    return result.rows;
}

// Search within nested JSONB (check if key exists in memory)
export async function getAgentRunsWithMemoryKey(key: string) {
    const result = await db.query(
        `SELECT * FROM agent_runs 
     WHERE memory ? $1`,
        [key]
    );
    return result.rows;
}

// Update nested JSONB path
export async function updateNestedState(id: number, path: string, value: any) {
    const result = await db.query(
        `UPDATE agent_runs 
     SET state = jsonb_set(state, $1, $2::jsonb),
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
        [`{${path}}`, JSON.stringify(value), id]
    );
    return result.rows[0];
}
