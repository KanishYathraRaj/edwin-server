import 'dotenv/config';
import express from 'express';
import { db } from './db';
import { agent } from './agents/agent';

const app = express();
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/test-db', async (_, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database Query Error:', error);
    res.status(500).json({ error: 'Database connection failed', details: error });
  }
});

app.use(express.json()); // ✅ REQUIRED

app.post("/ask", async (req, res) => {
  try {
    const { prompt } = req.body;
    const id = 1;

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Invalid request",
        message: "prompt must be a non-empty string"
      });
    }

    const answer = await agent(prompt, id);

    res.status(200).json(answer);

  } catch (err: any) {
    console.error("Agent Error:", err);

    res.status(500).json({
      error: "Agent failed",
      message: err?.message ?? "Unknown error"
    });
  }
});

app.get('/agent/:id', async (req, res) => {
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

app.post('/agent', async (req, res) => {
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

app.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});
