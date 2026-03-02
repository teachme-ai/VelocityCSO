import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { registerConnection, unregisterConnection, emitHeartbeat, sseWrite } from './sseService.js';

describe('SSE Service', () => {
    let res: Partial<Response>;

    beforeEach(() => {
        res = {
            write: vi.fn(),
            writableEnded: false,
        };
        vi.clearAllMocks();
    });

    it('sseWrite should write data to response if not ended', () => {
        const data = { type: 'TEST', message: 'hello' };
        sseWrite(res as Response, data);
        expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
    });

    it('sseWrite should not write if response ended', () => {
        vi.spyOn(res, 'writableEnded', 'get').mockReturnValue(true);
        sseWrite(res as Response, { foo: 'bar' });
        expect(res.write).not.toHaveBeenCalled();
    });

    it('emitHeartbeat sends message to registered connection', () => {
        const sessionId = 'session-123';
        registerConnection(sessionId, res as Response);

        emitHeartbeat(sessionId, 'Heartbeat check');

        expect(res.write).toHaveBeenCalled();
        const output = (res.write as any).mock.calls[0][0];
        expect(output).toContain('HEARTBEAT_LOG');
        expect(output).toContain('Heartbeat check');

        unregisterConnection(sessionId);
    });

    it('emitHeartbeat does nothing for unregistered session', () => {
        emitHeartbeat('unknown-session', 'Should not send');
        expect(res.write).not.toHaveBeenCalled();
    });
});
