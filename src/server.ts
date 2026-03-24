import 'dotenv/config';
import express from 'express';
import cors from "cors"
import clientRouter from './routes/client.routes';
import resourceRouter from './routes/resource.routes';
import './lib/firebase';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.use('/', clientRouter);
app.use('/resource', resourceRouter);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port or kill the process using this port.`);
      } else {
        console.error('Server failed to start:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

startServer();
