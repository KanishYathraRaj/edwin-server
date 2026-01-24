import { Router } from "express";
import { db } from "../db";

const router = Router();

router.get('/chats', async (req, res) => {
    try {
        const { user_id } = req.query;
        let query = 'SELECT * FROM agent_runs';
        const params: any[] = [];

        if (user_id) {
            query += ' WHERE user_id = $1';
            params.push(user_id);
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Database Query Error:', error);
        res.status(500).json({ error: 'Database connection failed', details: error });
    }
});

router.get('/chat/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT * FROM agent_runs WHERE id = $1`,
            [id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Database Query Error:', error);
        res.status(500).json({ error: 'Database connection failed', details: error });
    }
});

router.post('/chat', async (req, res) => {
    try {
        const { title, user_id } = req.body;
        const result = await db.query(
            'INSERT INTO agent_runs (title, user_id) VALUES ($1, $2) RETURNING *',
            [title, user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Database Insert Error:', error);
        res.status(500).json({ error: 'Failed to create agent run', details: error });
    }
});

router.post('/chat/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const result = await db.query(
            `UPDATE agent_runs SET message = $2 WHERE id = $1 RETURNING *`,
            [id, message]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Database Update Error:', error);
        res.status(500).json({ error: 'Database connection failed', details: error });
    }
});

router.delete('/chat/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `DELETE FROM agent_runs WHERE id = $1 RETURNING *`,
            [id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Database Delete Error:', error);
        res.status(500).json({ error: 'Database connection failed', details: error });
    }
});

router.patch('/chat/:id/canvas', async (req, res) => {
    try {
        const { id } = req.params;
        const { canvas } = req.body;

        if (!canvas) {
            return res.status(400).json({ error: "Canvas content is required" });
        }

        const result = await db.query(
            `UPDATE agent_runs 
             SET state = jsonb_set(
                 COALESCE(state, '{}'::jsonb), 
                 '{canvas}', 
                 $1::jsonb
             )
             WHERE id = $2
             RETURNING *`,
            [JSON.stringify(canvas), id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Database Update Error:', error);
        res.status(500).json({ error: 'Failed to update canvas', details: error });
    }
});

export default router;
