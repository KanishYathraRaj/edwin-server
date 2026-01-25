import 'dotenv/config';
import express from 'express';
import cors from "cors"
import { db } from './db';
import { agent } from './agents/agent';
import clientRouter from './routes/client.routes';

const app = express();
app.use(cors());
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

app.post("/ask", async (req, res) => {
  try {
    const { prompt, id } = req.body;

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

app.use('/client', clientRouter);

app.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});
