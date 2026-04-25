import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin';

export interface AuthenticatedRequest extends Request {
    uid: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: missing or malformed token' });
        return;
    }

    const token = authHeader.slice(7);
    try {
        const decoded = await adminAuth.verifyIdToken(token);
        (req as AuthenticatedRequest).uid = decoded.uid;
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized: invalid token' });
    }
}
