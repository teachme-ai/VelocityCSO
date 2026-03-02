import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from './auth.js';
import admin from 'firebase-admin';

describe('authMiddleware', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        req = {
            headers: {},
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
        vi.clearAllMocks();
    });

    it('returns 401 when Authorization header is missing', async () => {
        await authMiddleware(req as AuthRequest, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: No token provided' });
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization header does not start with Bearer ', async () => {
        req.headers!.authorization = 'Basic token123';
        await authMiddleware(req as AuthRequest, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when token verification fails', async () => {
        req.headers!.authorization = 'Bearer invalid-token';
        const verifySpy = vi.spyOn(admin.auth(), 'verifyIdToken').mockRejectedValue(new Error('Invalid token'));

        await authMiddleware(req as AuthRequest, res as Response, next);

        expect(verifySpy).toHaveBeenCalledWith('invalid-token');
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('attaches decoded token to req.user and calls next() on success', async () => {
        const decodedToken = { uid: 'user123', email: 'test@example.com' };
        req.headers!.authorization = 'Bearer valid-token';
        const verifySpy = vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue(decodedToken as any);

        await authMiddleware(req as AuthRequest, res as Response, next);

        expect(verifySpy).toHaveBeenCalledWith('valid-token');
        expect(req.user).toEqual(decodedToken);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
