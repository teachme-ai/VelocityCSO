import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';
import { ChiefStrategyAgent, sessionStore, StrategySession } from './coordinator.js';
import { DiscoveryAgent } from './agents/discovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const cso = new ChiefStrategyAgent();
const discovery = new DiscoveryAgent();

// ─── Helper: SSE Sender ──────────────────────────────────────────────────────
function sseWrite(res: express.Response, data: object) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── POST /analyze ───────────────────────────────────────────────────────────
// Now an SSE streaming endpoint. Runs Phase 0 (Discovery) first, then either
// proceeds to full analysis or pauses for user clarification.
app.post('/analyze', async (req, res) => {
    const { business_context, stress_test } = req.body;

    if (!business_context) {
        return res.status(400).json({ error: 'business_context is required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if present
    res.flushHeaders();

    const sessionId = randomUUID();
    sseWrite(res, { type: 'SESSION_INIT', sessionId });

    try {
        // ── Phase 0: Discovery ────────────────────────────────────────────
        sseWrite(res, { type: 'DISCOVERY_START' });
        const discoveryResult = await discovery.discover(business_context);
        sseWrite(res, {
            type: 'DISCOVERY_COMPLETE',
            summary: discoveryResult.summary,
            gaps: discoveryResult.gaps,
        });

        // ── Phase 0.5: Completeness Check ─────────────────────────────────
        const { proceed, gap } = await cso.evaluateCompleteness(discoveryResult);

        if (!proceed && gap) {
            // Store session context for later clarification
            sessionStore.set(sessionId, {
                enrichedContext: business_context,
                discoveryFindings: discoveryResult.findings,
                gaps: discoveryResult.gaps,
                createdAt: Date.now(),
            });

            sseWrite(res, {
                type: 'NEED_CLARIFICATION',
                sessionId,
                summary: discoveryResult.summary,
                gap,
                findings: discoveryResult.findings,
            });

            res.end();
            return;
        }

        // ── Phase 1–3: Full Analysis ──────────────────────────────────────
        sseWrite(res, { type: 'ANALYSIS_START', phase: 'market' });

        const enrichedContext = discoveryResult.findings
            ? `${business_context}\n\n--- DISCOVERY INTELLIGENCE (24-Month Lookback) ---\n${discoveryResult.findings}`
            : business_context;

        const finalContext = stress_test
            ? enrichedContext + '\n\nCRITICAL DIRECTIVE: STRESS TEST mode enabled. Lower ROI projections by 30%, assume 10% market dip, score all dimensions conservatively.'
            : enrichedContext;

        sseWrite(res, { type: 'ANALYSIS_START', phase: 'synthesizing' });
        const report = await cso.analyze(finalContext);

        // Save to Firestore
        let docId = 'local-dev-id';
        try {
            const docRef = await db.collection('enterprise_strategy_reports').add({
                business_context,
                report,
                discovery_findings: discoveryResult.findings,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            docId = docRef.id;
        } catch (dbErr: any) {
            console.warn('[Firestore] Skipped — likely no local credentials.', dbErr.message);
        }

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, report });
        res.end();

    } catch (error: any) {
        console.error('[/analyze] Error:', error);
        sseWrite(res, { type: 'ERROR', message: error.message });
        res.end();
    }
});

// ─── POST /analyze/clarify ───────────────────────────────────────────────────
// Resumes a paused session after the user provides their clarification.
app.post('/analyze/clarify', async (req, res) => {
    const { sessionId, clarification, stress_test } = req.body;

    if (!sessionId || !clarification) {
        return res.status(400).json({ error: 'sessionId and clarification are required' });
    }

    const session: StrategySession | undefined = sessionStore.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session expired or not found. Please start a new audit.' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
        // Re-ground: merge original context + discovery + user clarification
        const regroundedContext = `
${session.enrichedContext}

--- DISCOVERY INTELLIGENCE (24-Month Lookback) ---
${session.discoveryFindings}

--- USER CLARIFICATION (Gap Resolved) ---
${clarification}
        `.trim();

        const finalContext = stress_test
            ? regroundedContext + '\n\nCRITICAL DIRECTIVE: STRESS TEST mode enabled. Lower ROI projections by 30%, assume 10% market dip, score all dimensions conservatively.'
            : regroundedContext;

        sseWrite(res, { type: 'ANALYSIS_START', phase: 'synthesizing' });
        const report = await cso.analyze(finalContext);

        // Save to Firestore
        let docId = 'local-dev-id';
        try {
            const docRef = await db.collection('enterprise_strategy_reports').add({
                business_context: session.enrichedContext,
                user_clarification: clarification,
                report,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            docId = docRef.id;
        } catch (dbErr: any) {
            console.warn('[Firestore] Skipped.', dbErr.message);
        }

        // Clean up session
        sessionStore.delete(sessionId);

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, report });
        res.end();

    } catch (error: any) {
        console.error('[/analyze/clarify] Error:', error);
        sseWrite(res, { type: 'ERROR', message: error.message });
        res.end();
    }
});

// ─── Catch-all SPA route ─────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
