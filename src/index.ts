import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';
import { ChiefStrategyAgent } from './coordinator.js';
import { DiscoveryAgent } from './agents/discovery.js';
import { InterrogatorAgent } from './agents/interrogator.js';
import { saveSession, getSession, deleteSession, incrementTurn, releaseLock } from './services/sessionService.js';
import { log, createTraceLogger, logAuditCost, estimateCost } from './services/logger.js';
import { saveAuditMemory, loadAuditMemory } from './services/memory.js';
import { generatePDF } from './services/pdfService.js';
import { SCENARIOS, ScenarioId } from './scenarios.js';
import type { StrategySession } from './services/sessionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

admin.initializeApp();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const cso = new ChiefStrategyAgent();
const discovery = new DiscoveryAgent();
const interrogator = new InterrogatorAgent();

// ─── Helper: SSE Sender ──────────────────────────────────────────────────────
function sseWrite(res: express.Response, data: object) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Helper: Parse dimension scores from the final report ───────────────────
function extractDimensions(report: string): Record<string, number> {
    const dimensions: Record<string, number> = {};
    const dimNames = [
        'TAM Viability', 'Target Precision', 'Trend Adoption',
        'Competitive Defensibility', 'Model Innovation', 'Flywheel Potential',
        'Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed',
        'Execution Speed', 'Scalability', 'ESG Posture',
        'ROI Projection', 'Risk Tolerance', 'Capital Efficiency'
    ];
    for (const dim of dimNames) {
        const match = report.match(new RegExp(`${dim}[^0-9]*([0-9]{1,3})`, 'i'));
        if (match) dimensions[dim] = Math.min(100, parseInt(match[1]));
    }
    return dimensions;
}

// ─── GET /report/:id ─────────────────────────────────────────────────────────
app.get('/report/:id', async (req, res) => {
    const { id } = req.params;
    const token = req.query.token as string | undefined;
    const memory = await loadAuditMemory(id);
    if (!memory) return res.status(404).json({ error: 'Report not found or expired.' });
    // Simple access key: token must match last 8 chars of reportId
    if (token !== id.slice(-8)) return res.status(403).json({ error: 'Invalid access token.' });
    res.json({
        id,
        report: memory.report,
        dimensions: memory.dimensionScores,
        grounded_context: memory.groundedContext,
        business_context: memory.businessContext,
        created_at: memory.createdAt,
    });
});

// ─── GET /report/:id/download ─────────────────────────────────────────────────
app.get('/report/:id/download', async (req, res) => {
    const { id } = req.params;
    const token = req.query.token as string | undefined;
    const memory = await loadAuditMemory(id);
    if (!memory) return res.status(404).json({ error: 'Report not found or expired.' });
    if (token !== id.slice(-8)) return res.status(403).json({ error: 'Invalid access token.' });
    try {
        const pdf = generatePDF(memory);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="VelocityCSO-Audit-${id.slice(0, 8)}.pdf"`);
        res.send(pdf);
    } catch (err: any) {
        res.status(500).json({ error: 'PDF generation failed', detail: err.message });
    }
});

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
    // Bind a trace-correlated logger to this request
    const tlog = createTraceLogger(
        req.headers['x-cloud-trace-context'] as string,
    );

    sseWrite(res, { type: 'SESSION_INIT', sessionId });
    tlog({ severity: 'INFO', message: 'Audit request received', session_id: sessionId, phase: 'discovery' });

    try {
        // ── Phase 0: Interrogator (ID Scoring) ───────────────────────
        sseWrite(res, { type: 'INTERROGATOR_START' });
        const ir = await interrogator.evaluateInformationDensity(business_context, 0, sessionId);

        sseWrite(res, { type: 'INTERROGATOR_RESPONSE', category: ir.category, idScore: ir.idScore, idBreakdown: ir.idBreakdown, isAuditable: ir.isAuditable });

        if (!ir.isAuditable) {
            await saveSession(sessionId, {
                originalContext: business_context,
                enrichedContext: business_context,
                discoveryFindings: '',
                gaps: [ir.question],
                turnCount: 1,
                usedLenses: [],
            });
            sseWrite(res, { type: 'NEED_CLARIFICATION', sessionId, summary: `${ir.category} · ID Score: ${ir.idScore}/100`, gap: ir.question, findings: ir.strategyContext, idScore: ir.idScore, idBreakdown: ir.idBreakdown });
            res.end();
            return;
        }

        sseWrite(res, { type: 'READY_FOR_AUDIT', idScore: ir.idScore, category: ir.category });

        // ── Phase 0: Discovery ────────────────────────────────────────────
        sseWrite(res, { type: 'DISCOVERY_START' });
        const discoveryResult = await discovery.discover(business_context, sessionId);
        const discoveryCost = estimateCost('gemini-2.0-flash', business_context.length, discoveryResult.findings.length);

        sseWrite(res, {
            type: 'DISCOVERY_COMPLETE',
            summary: discoveryResult.summary,
            gaps: discoveryResult.gaps,
        });

        // ── Phase 0.5: Completeness Check — skip if interrogator already cleared ──
        if (!ir.isAuditable) {
            const { proceed, gap } = await cso.evaluateCompleteness(discoveryResult, sessionId);

            if (!proceed && gap) {
                await saveSession(sessionId, {
                    originalContext: business_context,
                    enrichedContext: business_context,
                    discoveryFindings: discoveryResult.findings,
                    gaps: discoveryResult.gaps,
                    turnCount: 0,
                    usedLenses: [],
                });
                tlog({ severity: 'WARNING', message: 'Clarification required — session saved', session_id: sessionId });
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
        }

        // ── Phase 1–3: Full Analysis ──────────────────────────────────────
        sseWrite(res, { type: 'ANALYSIS_START', phase: 'synthesizing' });

        const enrichedContext = discoveryResult.findings
            ? `${business_context}\n\n--- DISCOVERY INTELLIGENCE ---\n${discoveryResult.findings}`
            : business_context;

        const finalContext = stress_test
            ? enrichedContext + '\n\nCRITICAL DIRECTIVE: STRESS TEST mode enabled. Lower ROI projections by 30%, assume 10% market dip, score all dimensions conservatively.'
            : enrichedContext;

        const report = await cso.analyze(finalContext, sessionId);
        const csoCost = estimateCost('gemini-2.5-pro', finalContext.length, report.length);
        const dimensionScores = extractDimensions(report);

        // Save to Firestore with structured memory
        let docId = `local-${randomUUID()}`;
        try {
            const fingerprint = business_context.trim().slice(0, 80).toLowerCase();
            // NOTE: Enable Firestore TTL in GCP Console → Firestore → Indexes → TTL Policies
            // Field: expiresAt, Collection: enterprise_strategy_reports
            const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const docRef = await admin.firestore().collection('enterprise_strategy_reports').add({
                business_context,
                fingerprint,
                report,
                dimension_scores: dimensionScores,
                discovery_findings: discoveryResult.findings,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: expiresAt,
            });
            docId = docRef.id;

            // Persist full memory for Radar reload
            await saveAuditMemory(docId, {
                reportId: docId,
                businessContext: business_context,
                groundedContext: discoveryResult.findings,
                specialistOutputs: {},
                dimensionScores,
                report,
                stressTest: !!stress_test,
            });
        } catch (dbErr: any) {
            tlog({ severity: 'WARNING', message: 'Firestore write skipped', error: dbErr.message, session_id: sessionId });
        }

        logAuditCost(sessionId, { discovery: discoveryCost.usd, synthesis: csoCost.usd });

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, token: docId.slice(-8), report, dimensions: dimensionScores });
        res.end();

    } catch (error: any) {
        tlog({ severity: 'ERROR', message: 'Analyze endpoint failed', error: error.message, session_id: sessionId });
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

    const session: StrategySession | null = await getSession(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session expired or not found. Please start a new audit.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const tlog = createTraceLogger(req.headers['x-cloud-trace-context'] as string);
    tlog({ severity: 'INFO', message: 'Clarification received — re-grounding context', session_id: sessionId });

    try {
        // Cumulative merge: originalContext is locked, enrichedContext grows
        const cumulativeContext = `${session.originalContext || session.enrichedContext}\n\n[USER CLARIFICATION]: ${clarification}`;
        const turnResult = await incrementTurn(sessionId, cumulativeContext, session.gaps);

        if (!turnResult) {
            sseWrite(res, { type: 'ERROR', message: 'Request already processing. Please wait.' });
            res.end();
            return;
        }

        const { turnCount: newTurnCount, usedLenses } = turnResult;
        const ir = await interrogator.evaluateInformationDensity(cumulativeContext, newTurnCount, sessionId, usedLenses);

        const updatedLenses = ir.lensUsed && !usedLenses.includes(ir.lensUsed)
            ? [...usedLenses, ir.lensUsed]
            : usedLenses;

        // Persist the lens used so next turn rotates
        if (ir.lensUsed && !usedLenses.includes(ir.lensUsed)) {
            try {
                await admin.firestore().collection('velocity_cso_sessions').doc(sessionId).update({ usedLenses: updatedLenses });
            } catch { /* non-critical */ }
        }

        sseWrite(res, { type: 'INTERROGATOR_RESPONSE', category: ir.category, idScore: ir.idScore, idBreakdown: ir.idBreakdown, isAuditable: ir.isAuditable, usedLenses: updatedLenses });

        if (!ir.isAuditable) {
            await releaseLock(sessionId);
            sseWrite(res, { type: 'NEED_CLARIFICATION', sessionId, summary: `${ir.category} · ID Score: ${ir.idScore}/100`, gap: ir.question, findings: cumulativeContext, idScore: ir.idScore, idBreakdown: ir.idBreakdown, usedLenses: updatedLenses });
            res.end();
            return;
        }

        sseWrite(res, { type: 'READY_FOR_AUDIT', idScore: ir.idScore, category: ir.category });

        const regroundedContext = cumulativeContext;

        const finalContext = stress_test
            ? regroundedContext + '\n\nCRITICAL DIRECTIVE: STRESS TEST enabled. Score conservatively.'
            : regroundedContext;

        sseWrite(res, { type: 'ANALYSIS_START', phase: 'synthesizing' });
        const report = await cso.analyze(finalContext, sessionId);
        const csoCost = estimateCost('gemini-2.5-pro', finalContext.length, report.length);
        const dimensionScores = extractDimensions(report);

        let docId = `local-${randomUUID()}`;
        try {
            const fingerprint = session.enrichedContext.trim().slice(0, 80).toLowerCase();
            const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const docRef = await admin.firestore().collection('enterprise_strategy_reports').add({
                business_context: session.enrichedContext,
                fingerprint,
                user_clarification: clarification,
                report,
                dimension_scores: dimensionScores,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: expiresAt,
            });
            docId = docRef.id;

            await saveAuditMemory(docId, {
                reportId: docId,
                businessContext: session.enrichedContext,
                groundedContext: session.discoveryFindings,
                specialistOutputs: {},
                dimensionScores,
                report,
                stressTest: !!stress_test,
            });
        } catch (dbErr: any) {
            tlog({ severity: 'WARNING', message: 'Firestore write skipped', error: dbErr.message, session_id: sessionId });
        }

        await deleteSession(sessionId);
        logAuditCost(sessionId, { synthesis_with_clarification: csoCost.usd });

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, token: docId.slice(-8), report, dimensions: dimensionScores });
        res.end();

        } catch (error: any) {
        tlog({ severity: 'ERROR', message: 'Clarify endpoint failed', error: error.message, session_id: sessionId });
        await releaseLock(sessionId);
        sseWrite(res, { type: 'ERROR', message: error.message });
        res.end();
    }
});

// ─── POST /analyze/stress-test ───────────────────────────────────────────────
// Fast scenario recalculation — bypasses Discovery, uses Firestore cached context.
app.post('/analyze/stress-test', async (req, res) => {
    const { reportId, scenarioId } = req.body;

    if (!reportId || !scenarioId) {
        return res.status(400).json({ error: 'reportId and scenarioId are required' });
    }
    if (!SCENARIOS[scenarioId as ScenarioId]) {
        return res.status(400).json({ error: `Unknown scenarioId. Valid: ${Object.keys(SCENARIOS).join(', ')}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sessionId = randomUUID();
    const tlog = createTraceLogger(req.headers['x-cloud-trace-context'] as string);

    tlog({ severity: 'INFO', message: 'Stress test request received', session_id: sessionId, report_id: reportId, scenario: scenarioId });
    sseWrite(res, { type: 'STRESS_START', scenarioId, scenarioLabel: SCENARIOS[scenarioId as ScenarioId].label });

    try {
        const result = await cso.triggerStressTest(reportId, scenarioId as ScenarioId, sessionId);

        sseWrite(res, {
            type: 'STRESS_COMPLETE',
            scenarioId: result.scenarioId,
            scenarioLabel: result.scenarioLabel,
            originalScores: result.originalScores,
            stressedScores: result.stressedScores,
            riskDeltas: result.riskDeltas,
            mitigationCards: result.mitigationCards,
        });
        res.end();
    } catch (error: any) {
        tlog({ severity: 'ERROR', message: 'Stress test failed', error: error.message, session_id: sessionId });
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
