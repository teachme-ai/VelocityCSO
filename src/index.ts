import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';
import { ChiefStrategyAgent } from './coordinator.js';
import { DiscoveryAgent } from './agents/discovery.js';
import { saveSession, getSession, deleteSession } from './services/sessionService.js';
import { log, logAuditCost, estimateCost } from './services/logger.js';
import type { StrategySession } from './services/sessionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
admin.initializeApp();

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
app.post('/analyze', async (req, res) => {
    const { business_context, stress_test } = req.body;

    if (!business_context) {
        return res.status(400).json({ error: 'business_context is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sessionId = randomUUID();
    sseWrite(res, { type: 'SESSION_INIT', sessionId });

    log({ severity: 'INFO', message: 'Audit request received', session_id: sessionId, phase: 'discovery' });

    try {
        // ── Phase 0: Discovery ────────────────────────────────────────────
        sseWrite(res, { type: 'DISCOVERY_START' });
        const discoveryResult = await discovery.discover(business_context, sessionId);

        const discoveryCost = estimateCost('gemini-2.0-flash', business_context.length, discoveryResult.findings.length);
        sseWrite(res, {
            type: 'DISCOVERY_COMPLETE',
            summary: discoveryResult.summary,
            gaps: discoveryResult.gaps,
        });

        // ── Phase 0.5: Completeness Check ─────────────────────────────────
        const { proceed, gap } = await cso.evaluateCompleteness(discoveryResult, sessionId);

        if (!proceed && gap) {
            // Persist to Firestore for cross-instance retrieval
            await saveSession(sessionId, {
                enrichedContext: business_context,
                discoveryFindings: discoveryResult.findings,
                gaps: discoveryResult.gaps,
            });

            log({ severity: 'WARNING', message: 'Clarification required — session saved to Firestore', session_id: sessionId });

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
        sseWrite(res, { type: 'ANALYSIS_START', phase: 'synthesizing' });

        const enrichedContext = discoveryResult.findings
            ? `${business_context}\n\n--- DISCOVERY INTELLIGENCE (24-Month Lookback) ---\n${discoveryResult.findings}`
            : business_context;

        const finalContext = stress_test
            ? enrichedContext + '\n\nCRITICAL DIRECTIVE: STRESS TEST mode enabled. Lower ROI projections by 30%, assume 10% market dip, score all dimensions conservatively.'
            : enrichedContext;

        const report = await cso.analyze(finalContext, sessionId);
        const csoCost = estimateCost('gemini-2.5-pro', finalContext.length, report.length);

        // Save report to Firestore
        let docId = 'local-dev-id';
        try {
            const fingerprint = business_context.trim().slice(0, 80).toLowerCase();
            const docRef = await admin.firestore().collection('enterprise_strategy_reports').add({
                business_context,
                fingerprint,
                report,
                discovery_findings: discoveryResult.findings,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            docId = docRef.id;
        } catch (dbErr: any) {
            log({ severity: 'WARNING', message: 'Firestore write skipped', error: dbErr.message, session_id: sessionId });
        }

        logAuditCost(sessionId, {
            discovery: discoveryCost.usd,
            synthesis: csoCost.usd,
        });

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, report });
        res.end();

    } catch (error: any) {
        log({ severity: 'ERROR', message: 'Analyze endpoint failed', error: error.message, session_id: sessionId });
        sseWrite(res, { type: 'ERROR', message: error.message });
        res.end();
    }
});

// ─── POST /analyze/clarify ───────────────────────────────────────────────────
app.post('/analyze/clarify', async (req, res) => {
    const { sessionId, clarification, stress_test } = req.body;

    if (!sessionId || !clarification) {
        return res.status(400).json({ error: 'sessionId and clarification are required' });
    }

    // Load from Firestore (works across Cloud Run instances/restarts)
    const session: StrategySession | null = await getSession(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session expired or not found. Please start a new audit.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    log({ severity: 'INFO', message: 'Clarification received — re-grounding context', session_id: sessionId });

    try {
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
        const report = await cso.analyze(finalContext, sessionId);
        const csoCost = estimateCost('gemini-2.5-pro', finalContext.length, report.length);

        let docId = 'local-dev-id';
        try {
            const fingerprint = session.enrichedContext.trim().slice(0, 80).toLowerCase();
            const docRef = await admin.firestore().collection('enterprise_strategy_reports').add({
                business_context: session.enrichedContext,
                fingerprint,
                user_clarification: clarification,
                report,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            docId = docRef.id;
        } catch (dbErr: any) {
            log({ severity: 'WARNING', message: 'Firestore write skipped', error: dbErr.message, session_id: sessionId });
        }

        await deleteSession(sessionId);

        logAuditCost(sessionId, { synthesis_with_clarification: csoCost.usd });

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, report });
        res.end();

    } catch (error: any) {
        log({ severity: 'ERROR', message: 'Clarify endpoint failed', error: error.message, session_id: sessionId });
        sseWrite(res, { type: 'ERROR', message: error.message });
        res.end();
    }
});

// ─── Catch-all SPA route ─────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, '0.0.0.0', () => {
    log({ severity: 'INFO', message: `VelocityCSO server started on port ${port}`, agent_id: 'system' });
});
