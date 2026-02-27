import admin from 'firebase-admin';

export interface StrategySession {
    originalContext: string;
    enrichedContext: string;
    discoveryFindings: string;
    gaps: string[];
    turnCount: number;
    usedLenses: string[];
    createdAt: number;
    expiresAt: number;
}

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const COLLECTION = 'velocity_cso_sessions';
const REPORTS_COLLECTION = 'enterprise_strategy_reports';

function db() {
    return admin.firestore();
}

export async function saveSession(sessionId: string, data: Omit<StrategySession, 'createdAt' | 'expiresAt'>): Promise<void> {
    const now = Date.now();
    await db().collection(COLLECTION).doc(sessionId).set({
        ...data,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
    });
}

export async function incrementTurn(sessionId: string, enrichedContext: string, gaps: string[], lensUsed?: string): Promise<{ turnCount: number; usedLenses: string[] } | null> {
    const ref = db().collection(COLLECTION).doc(sessionId);

    return await db().runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (!doc.exists) return null;

        const data = doc.data();
        if (data?.processing === true) return null; // locked — discard duplicate

        const current = (data?.turnCount as number) || 0;
        const existingLenses: string[] = (data?.usedLenses as string[]) || [];
        const usedLenses = lensUsed && !existingLenses.includes(lensUsed)
            ? [...existingLenses, lensUsed]
            : existingLenses;

        const next = current + 1;
        t.update(ref, {
            turnCount: next,
            enrichedContext,
            gaps,
            processing: true,
            usedLenses,
            lastAccessed: Date.now()
        });

        return { turnCount: next, usedLenses };
    });
}

export async function releaseLock(sessionId: string): Promise<void> {
    try {
        await db().collection(COLLECTION).doc(sessionId).update({ processing: false });
    } catch { /* session may be deleted */ }
}

export async function getSession(sessionId: string): Promise<StrategySession | null> {
    const doc = await db().collection(COLLECTION).doc(sessionId).get();
    if (!doc.exists) return null;

    const data = doc.data() as StrategySession;
    if (Date.now() > data.expiresAt) {
        // Expired — clean up
        await db().collection(COLLECTION).doc(sessionId).delete();
        return null;
    }
    return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
    await db().collection(COLLECTION).doc(sessionId).delete();
}

/**
 * Checks if this business (by a simple keyword hash) was audited recently.
 * Returns the age of the last audit in days, or null if no audit found.
 */
export async function getPreviousAuditAge(businessContext: string): Promise<number | null> {
    // Use first 80 chars as a rough fingerprint — good enough for cache-hit detection
    const fingerprint = businessContext.trim().slice(0, 80).toLowerCase();

    const snapshot = await db()
        .collection(REPORTS_COLLECTION)
        .where('fingerprint', '>=', fingerprint.slice(0, 40))
        .orderBy('fingerprint')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0].data();
    const createdAt: admin.firestore.Timestamp = doc.created_at;
    if (!createdAt) return null;

    const ageMs = Date.now() - createdAt.toMillis();
    return Math.floor(ageMs / (1000 * 60 * 60 * 24)); // days
}
