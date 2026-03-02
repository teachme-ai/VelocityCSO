import { Response } from 'express';
import { randomUUID } from 'crypto';

const activeConnections = new Map<string, Response>();

/**
 * Registers a new SSE connection for a session.
 */
export function registerConnection(sessionId: string, res: Response) {
    activeConnections.set(sessionId, res);
}

/**
 * Removes a session connection.
 */
export function unregisterConnection(sessionId: string) {
    activeConnections.delete(sessionId);
}

/**
 * Helper to write SSE data.
 */
export function sseWrite(res: Response, data: any) {
    if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

/**
 * Emits a heartbeat log to the client side.
 * Resolves circular dependencies by living in a standalone service.
 */
export function emitHeartbeat(
    sessionId: string,
    message: string,
    type: 'standard' | 'warning' | 'debug' | 'error' = 'standard'
) {
    const res = activeConnections.get(sessionId);
    if (res) {
        sseWrite(res, {
            type: 'HEARTBEAT_LOG',
            log: {
                id: randomUUID(),
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                message,
                type
            }
        });
    }
}
