import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthRequest extends Request {
    user?: admin.auth.DecodedIdToken;
    userId?: string;
    orgId?: string;
}

export function generateShareToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

/**
 * Firebase Authentication Middleware
 * Validates the Bearer token in the Authorization header.
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (process.env.NODE_ENV === 'development') {
        req.user = { uid: 'dev-user', email: 'dev@example.com' } as any;
        req.userId = 'dev-user';
        req.orgId = 'dev-org';
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        req.userId = decodedToken.uid;
        req.orgId = decodedToken.org || 'default-org';
        next();
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
};
