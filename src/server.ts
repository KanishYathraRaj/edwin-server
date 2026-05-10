import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import clientRouter from './routes/client.routes';
import resourceRouter from './routes/resource.routes';
import { adminDb } from './lib/firebase-admin';

// Validate required environment variables at startup
const required = [
    'GOOGLE_API_KEY',
    'PINECONE_API_KEY',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
    'LLM',
];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

const app = express();

// Security: restrict CORS to configured origin
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Simple in-memory rate limiter: 60 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Evict stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(ip);
    }
}, 5 * 60_000).unref();

app.use((req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
        return next();
    }

    entry.count++;
    if (entry.count > 60) {
        res.status(429).json({ error: 'Too many requests — please slow down' });
        return;
    }
    next();
});

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        const uid = (req as any).uid ?? '-';
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms uid=${uid}`);
    });
    next();
});

app.get('/health', async (_req, res) => {
    const checks: Record<string, 'ok' | 'error'> = {};
    try {
        await adminDb.collection('__health__').limit(1).get();
        checks.firestore = 'ok';
    } catch { checks.firestore = 'error'; }
    checks.llm = ['gemini', 'ollama'].includes(process.env.LLM ?? '') ? 'ok' : 'error';
    const allOk = Object.values(checks).every(v => v === 'ok');
    res.status(allOk ? 200 : 503).json({ ok: allOk, checks, timestamp: new Date().toISOString() });
});

app.use('/', clientRouter);
app.use('/resource', resourceRouter);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
if (isNaN(PORT)) { console.error('Invalid PORT'); process.exit(1); }

let server: ReturnType<typeof app.listen>;

async function startServer() {
    server = app.listen(PORT, () => {
        console.log(`Edwin server running on port ${PORT}`);
        console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use`);
        } else {
            console.error('Server failed to start:', error.message);
        }
        process.exit(1);
    });

    const shutdown = (signal: string) => {
        console.log(`${signal} — shutting down gracefully`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
}

startServer();
