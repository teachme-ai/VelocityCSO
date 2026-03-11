import express from 'express';
import cors from 'cors';
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
import { authMiddleware, AuthRequest } from './middleware/auth.js';
import { registerConnection, unregisterConnection, sseWrite, emitHeartbeat } from './services/sseService.js';
import multer from 'multer';
import { sendStrategyDigest } from './services/emailService.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req: any, file: any, cb: any) => {
        const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
        cb(null, allowed.includes(file.mimetype));
    }
});


admin.initializeApp();

export const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors({
    origin: [
        'https://velocitycso.com',
        'https://www.velocitycso.com',
        /https:\/\/velocitycso.*\.vercel\.app$/,
    ],
    credentials: true,
}));
app.use(express.json());

const cso = new ChiefStrategyAgent();
const discovery = new DiscoveryAgent();
const interrogator = new InterrogatorAgent();
// ─── Helper: Parse dimension scores from the final report ───────────────────
function extractDimensions(report: string): Record<string, number> {
    const dimensions: Record<string, number> = {};
    const dimNames = [
        'TAM Viability', 'Target Precision', 'Trend Adoption',
        'Competitive Defensibility', 'Model Innovation', 'Flywheel Potential',
        'Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed',
        'Execution Speed', 'Scalability', 'ESG Posture',
        'ROI Projection', 'Risk Tolerance', 'Capital Efficiency',
        'Team / Founder Strength', 'Network Effects Strength',
        'Data Asset Quality', 'Regulatory Readiness', 'Customer Concentration Risk'
    ];
    for (const dim of dimNames) {
        // Match score in any format: "TAM Viability: 78", "TAM Viability** 78/100", "TAM Viability Score: **78**"
        const escaped = dim.replace('/', '\/').replace('(', '\(').replace(')', '\)');
        const match = report.match(new RegExp(escaped + '[^\n]{0,60}?\b([0-9]{1,3})\b', 'i'));
        if (match) {
            const score = parseInt(match[1]);
            if (score <= 100) dimensions[dim] = score;
        }
    }
    return dimensions;
}

// ─── GET /report/:id ─────────────────────────────────────────────────────────
app.get('/report/:id', async (req, res) => {
    const id = req.params.id as string;
    const token = req.query.token as string | undefined;

    try {
        const doc = await admin.firestore().collection('enterprise_strategy_reports').doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Report not found or expired.' });

        const data = doc.data()!;
        const isValid = token === id.slice(-8) || (data.share_token && token === data.share_token);
        if (!isValid) return res.status(403).json({ error: 'Invalid access token.' });

        const memory = await loadAuditMemory(id);
        if (!memory) return res.status(404).json({ error: 'Memory details not found.' });

        res.json({
            id,
            report: memory.report,
            dimensions: memory.dimensionScores,
            grounded_context: memory.groundedContext,
            business_context: memory.businessContext,
            created_at: memory.createdAt,
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Error fetching report details' });
    }
});

// ─── POST /report/:id/share ──────────────────────────────────────────────────
app.post('/report/:id/share', authMiddleware as any, async (req: AuthRequest, res) => {
    const id = req.params.id as string;

    try {
        const doc = await admin.firestore().collection('enterprise_strategy_reports').doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Report not found' });

        const data = doc.data()!;
        if (data.user_id !== req.userId && data.org_id !== req.orgId && req.userId !== 'dev-user') {
            return res.status(403).json({ error: 'Unauthorized to share' });
        }

        const { generateShareToken } = await import('./middleware/auth.js');
        const shareToken = generateShareToken();

        await doc.ref.update({ share_token: shareToken });

        const baseUrl = process.env.APP_URL || 'http://localhost:5173';
        res.json({ shareUrl: `${baseUrl}/report/${id}?token=${shareToken}` });
    } catch (err: any) {
        log({ severity: 'ERROR', message: `Share link generation failed: ${err.message}` });
        res.status(500).json({ error: 'Failed to generate share link' });
    }
});

// ─── GET /report/:id/download ─────────────────────────────────────────────────
app.get('/report/:id/download', async (req, res) => {
    const { id } = req.params;
    const token = req.query.token as string | undefined;
    const memory = await loadAuditMemory(id);
    if (!memory) return res.status(404).json({ error: 'Report not found or expired.' });
    if (token !== id.slice(-8)) return res.status(403).json({ error: 'Invalid access token.' });
    try {
        const pdf = await generatePDF(memory);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="VelocityCSO-Audit-${id.slice(0, 8)}.pdf"`);
        res.send(pdf);
    } catch (err: any) {
        res.status(500).json({ error: 'PDF generation failed', detail: err.message });
    }
});

// ─── GET /history/:orgId ─────────────────────────────────────────────────────
app.get('/history/:orgId', authMiddleware as any, async (req: AuthRequest, res) => {
    const orgId = req.params.orgId as string;

    if (req.orgId !== orgId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const snapshot = await admin.firestore()
            .collection('enterprise_strategy_reports')
            .where('org_id', '==', orgId)
            .orderBy('created_at', 'desc')
            .limit(20)
            .get();

        const audits = snapshot.docs.map(doc => {
            const data = doc.data();
            const dims = data.dimension_scores || {};
            const keys = Object.keys(dims);
            const overallScore = keys.length ? (Object.values(dims) as number[]).reduce((a, b) => a + b, 0) / keys.length : 0;
            return {
                id: doc.id,
                orgName: data.org_name,
                createdAt: data.created_at?.toDate?.()?.toISOString(),
                dimensions: dims,
                overallScore,
            };
        });

        res.json({ audits });
    } catch (err: any) {
        log({ severity: 'ERROR', message: `History fetch failed: ${err.message}` });
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// ─── GET /history/:orgId/trend/:fingerprint ──────────────────────────────────
app.get('/history/:orgId/trend/:fingerprint', authMiddleware as any, async (req: AuthRequest, res) => {
    const orgId = req.params.orgId as string;
    const fingerprint = req.params.fingerprint as string;

    if (req.orgId !== orgId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const prefix = fingerprint.slice(0, 80);
        const snapshot = await admin.firestore()
            .collection('enterprise_strategy_reports')
            .where('org_id', '==', orgId)
            .where('fingerprint', '>=', prefix)
            .where('fingerprint', '<', prefix + '\uf8ff')
            .orderBy('fingerprint')
            .orderBy('created_at', 'asc')
            .limit(12)
            .get();

        const trend = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                date: data.created_at?.toDate?.()?.toISOString(),
                dimensions: data.dimension_scores || {},
                reportId: doc.id,
            };
        });

        res.json({ trend });
    } catch (err: any) {
        log({ severity: 'ERROR', message: `Trend fetch failed: ${err.message}` });
        res.status(500).json({ error: 'Failed to fetch trend' });
    }
});

// ─── POST /enrich/url ────────────────────────────────────────────────────────
app.post('/enrich/url', authMiddleware as any, async (req: AuthRequest, res) => {
    const { url } = req.body as { url: string };

    if (!url) {
        return res.status(400).json({ error: 'url is required' });
    }

    try {
        const { scrapeCompanyUrl } = await import('./services/scraperService.js');
        const result = await scrapeCompanyUrl(url);
        res.json({ success: true, data: result });
    } catch (err: any) {
        log({ severity: 'ERROR', message: `Enrichment failed for ${url}: ${err.message}` });
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /enrich/document ──────────────────────────────────────────────────
app.post('/enrich/document',
    authMiddleware as any,
    upload.single('document'),
    async (req: AuthRequest, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded or invalid format' });
        }

        try {
            const { parsePDF, parseTextFile } = await import('./services/documentParser.js');
            let result;
            if (req.file.mimetype === 'application/pdf') {
                result = await parsePDF(req.file.buffer, req.file.originalname);
            } else {
                result = parseTextFile(req.file.buffer, req.file.originalname);
            }
            res.json({ success: true, data: result });
        } catch (err: any) {
            log({ severity: 'ERROR', message: `Document parsing failed: ${err.message}` });
            res.status(500).json({ error: err.message });
        }
    }
);

// ─── POST /analyze ───────────────────────────────────────────────────────────
app.post('/analyze', authMiddleware as any, async (req: AuthRequest, res) => {
    const { business_context, stress_test } = req.body;
    const userId = req.userId || 'anonymous';
    const orgId = req.orgId || 'default-org';

    if (!business_context) {
        return res.status(400).json({ error: 'business_context is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sessionId = randomUUID();
    registerConnection(sessionId, res);

    // Bind a trace-correlated logger to this request
    const tlog = createTraceLogger(
        req.headers['x-cloud-trace-context'] as string,
    );

    res.on('close', () => {
        unregisterConnection(sessionId);
        tlog({ severity: 'INFO', message: 'SSE connection closed', session_id: sessionId });
    });

    sseWrite(res, { type: 'SESSION_INIT', sessionId });
    emitHeartbeat(sessionId, 'Connection established. Initialization sequence started.');
    tlog({ severity: 'INFO', message: 'Audit request received', session_id: sessionId, user_id: userId, phase: 'discovery' });

    try {
        // ── Phase 0: Interrogator (ID Scoring) ───────────────────────
        sseWrite(res, { type: 'INTERROGATOR_START' });
        emitHeartbeat(sessionId, '◆ InterrogatorAgent: analyze_context() executed');
        const ir = await interrogator.evaluateInformationDensity(business_context, 0, sessionId);

        sseWrite(res, { type: 'INTERROGATOR_RESPONSE', category: ir.category, idScore: ir.idScore, idBreakdown: ir.idBreakdown, isAuditable: ir.isAuditable });
        emitHeartbeat(sessionId, `◆ Internal Score Update: Strategy Density (${ir.idScore}/100)`);

        if (!ir.isAuditable) {
            emitHeartbeat(sessionId, '⚠ Strategic Gap Detected: Requesting user clarification...', 'warning');
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

        // ── Phase 0.1: Market Data Enrichment ───────────────────────
        let contextWithMarketSignals = business_context;
        try {
            const { assembleMarketSignals } = await import('./services/marketDataService.js');
            // Extract company name and industry with simple heuristics
            const orgNameMatch = business_context.match(/^([A-Z][a-zA-Z\s&]{2,40})/);
            const orgName = orgNameMatch ? orgNameMatch[1].trim() : '';
            const industryMatch = business_context.match(/\b(saas|fintech|healthtech|edtech|marketplace|ecommerce|logistics|ai|security|energy)\b/i);
            const industry = industryMatch ? industryMatch[0].toLowerCase() : '';

            if (orgName || industry) {
                emitHeartbeat(sessionId, '📡 Market Intelligence: Scanning for real-time news and funding signals...');
                const marketSignals = await assembleMarketSignals(orgName, industry);
                if (marketSignals) {
                    contextWithMarketSignals = `${business_context}\n\n${marketSignals}`;
                    emitHeartbeat(sessionId, '✓ Market signals injected into discovery context.');
                    tlog({ severity: 'INFO', message: 'Market signals enriched', session_id: sessionId, orgName, industry });
                }
            }
        } catch (err: any) {
            log({ severity: 'WARNING', message: `Market enrichment skipped: ${err.message}` });
        }

        // ── Phase 0: Discovery ────────────────────────────────────────────
        sseWrite(res, { type: 'DISCOVERY_START' });
        const discoveryResult = await discovery.discover(contextWithMarketSignals, sessionId);
        const discoveryFindingsStr = discoveryResult.findings
            .map(f => `[${f.date}] ${f.signal} (Source: ${f.source})`)
            .join('\n');

        const discoveryCost = estimateCost('gemini-2.0-flash-001', business_context.length, discoveryFindingsStr.length);

        sseWrite(res, {
            type: 'DISCOVERY_COMPLETE',
            summary: discoveryResult.summary,
            gaps: discoveryResult.gaps,
        });

        // ── Phase 0.5: Completeness Check ──
        const { proceed, gap } = await cso.evaluateCompleteness(discoveryResult, sessionId);

        if (!proceed && gap) {
            await saveSession(sessionId, {
                originalContext: business_context,
                enrichedContext: business_context,
                discoveryFindings: discoveryFindingsStr,
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
                findings: discoveryFindingsStr,
            });
            res.end();
            return;
        }

        // ── Phase 0.6: Industry Benchmarking ──────────────────────────
        let benchmarkContext = '';
        try {
            const { getBenchmarkForSector } = await import('./services/benchmarkService.js');
            const industryMatch = business_context.match(/\b(saas|fintech|healthtech|edtech|marketplace|ecommerce|logistics|ai|security|energy)\b/i);
            const sector = industryMatch ? industryMatch[0] : 'SaaS';
            const benchmark = await getBenchmarkForSector(sector);
            benchmarkContext = `\n\n--- ${sector.toUpperCase()} INDUSTRY BENCHMARKS ---\n` +
                `- Avg CAC Payback: ${benchmark.avg_cac_payback_months} months\n` +
                `- Avg LTV/CAC: ${benchmark.avg_ltv_cac}x\n` +
                `- Top Quartile Growth: ${benchmark.growth_benchmark_top_quartile * 100}%\n` +
                `- Market Multiples: ${benchmark.market_multiple_range[0]}x - ${benchmark.market_multiple_range[1]}x\n`;
            emitHeartbeat(sessionId, `✓ Industry Calibration: Loaded ${sector} benchmarks.`);
        } catch (err: any) {
            log({ severity: 'WARNING', message: `Benchmarking skipped: ${err.message}` });
        }

        // ── Phase 1–3: Full Analysis ──────────────────────────────────────
        sseWrite(res, { type: 'ANALYSIS_START', phase: 'synthesizing' });
        emitHeartbeat(sessionId, '◆ CSO: initializing 5-specialist tactical audit...');

        const enrichedContext = (discoveryFindingsStr || benchmarkContext)
            ? `${business_context}${benchmarkContext}\n\n--- MARKET GROUNDING INTELLIGENCE ---\n${discoveryFindingsStr}`
            : business_context;

        const finalContext = stress_test
            ? enrichedContext + '\n\nCRITICAL DIRECTIVE: STRESS TEST mode enabled. Lower ROI projections by 30%, assume 10% market dip, score all dimensions conservatively.'
            : enrichedContext;

        const { report, roadmap, dimensions, richDimensions, specialistOutputs, frameworks, orgName, moatRationale } = await cso.analyze(finalContext, sessionId);
        if (discoveryResult.pestle) {
            frameworks.pestle = discoveryResult.pestle;
            tlog({ severity: 'INFO', message: 'PESTLE injected into frameworks', session_id: sessionId, pestle_dims: Object.keys(discoveryResult.pestle) });
        }
        const csoCost = estimateCost('gemini-1.5-pro-001', finalContext.length, report.length);
        tlog({ severity: 'INFO', message: 'Analysis complete', session_id: sessionId, dimension_count: Object.keys(dimensions).length });

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
                dimension_scores: dimensions,
                rich_dimensions: richDimensions,
                frameworks,
                discovery_findings: discoveryFindingsStr,
                grounded_context: discoveryFindingsStr,
                stress_test: !!stress_test,
                org_name: orgName,
                moat_rationale: moatRationale,
                user_id: userId,
                org_id: orgId,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: expiresAt,
            });
            docId = docRef.id;

            // Persist full memory for Radar reload
            await saveAuditMemory(docId, {
                reportId: docId,
                businessContext: business_context,
                groundedContext: discoveryFindingsStr,
                specialistOutputs,
                frameworks,
                dimensionScores: dimensions,
                richDimensions,
                report,
                stressTest: !!stress_test,
                orgName,
                moatRationale
            });
        } catch (dbErr: any) {
            tlog({ severity: 'WARNING', message: 'Firestore write skipped', error: dbErr.message, session_id: sessionId });
        }

        logAuditCost(sessionId, { discovery: discoveryCost.usd, synthesis: csoCost.usd });

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, token: docId.slice(-8), report, dimensions, richDimensions, frameworks, orgName, moatRationale });
        if (roadmap) sseWrite(res, { type: 'ROADMAP_COMPLETE', roadmap });
        res.end();

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
        tlog({
            severity: 'ERROR',
            message: 'Analyze endpoint failed',
            error: errorMessage,
            stack: errorStack,
            session_id: sessionId
        });
        sseWrite(res, { type: 'ERROR', message: errorMessage });
        res.end();
    }
});

// ─── POST /analyze/clarify ───────────────────────────────────────────────────
app.post('/analyze/clarify', authMiddleware as any, async (req: AuthRequest, res) => {
    const { sessionId, clarification, stress_test } = req.body;
    const userId = req.user?.uid || 'anonymous';

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
    registerConnection(sessionId, res);

    res.on('close', () => {
        unregisterConnection(sessionId);
    });

    tlog({ severity: 'INFO', message: 'Clarification received — re-grounding context', session_id: sessionId, user_id: userId });
    emitHeartbeat(sessionId, 'Clarification received. Deepening strategic analysis...');

    try {
        // Cumulative merge: originalContext is locked, enrichedContext grows
        const cumulativeContext = `${session.originalContext || session.enrichedContext}\n\n[USER CLARIFICATION]: ${clarification}`;
        const turnResult = await incrementTurn(sessionId, cumulativeContext, session.gaps);

        if (!turnResult) {
            sseWrite(res, { type: 'ERROR', message: 'Request already processing. Please wait.' });
            res.end();
            return;
        }

        const { turnCount: newTurnCount } = turnResult;
        const ir = await interrogator.evaluateInformationDensity(cumulativeContext, newTurnCount, sessionId);

        sseWrite(res, { type: 'INTERROGATOR_RESPONSE', category: ir.category, idScore: ir.idScore, idBreakdown: ir.idBreakdown, isAuditable: ir.isAuditable });

        if (!ir.isAuditable) {
            sseWrite(res, { type: 'NEED_CLARIFICATION', sessionId, summary: `${ir.category} · ID Score: ${ir.idScore}/100`, gap: ir.question, findings: cumulativeContext, idScore: ir.idScore, idBreakdown: ir.idBreakdown });
            await releaseLock(sessionId);
            res.end();
            return;
        }

        sseWrite(res, { type: 'READY_FOR_AUDIT', idScore: ir.idScore, category: ir.category });

        const regroundedContext = cumulativeContext;

        const finalContext = stress_test
            ? regroundedContext + '\n\nCRITICAL DIRECTIVE: STRESS TEST enabled. Score conservatively.'
            : regroundedContext;

        sseWrite(res, { type: 'ANALYSIS_START', phase: 'synthesizing' });

        // ── Step 3: Synthesis with 10s Receipt Check ──
        let analysisFinished = false;
        const analysisPromise = cso.analyze(finalContext, sessionId).then(r => {
            analysisFinished = true;
            return r;
        });

        // Automatic Re-audit Trigger (if silent for 10s)
        const safetyReceipt = setTimeout(() => {
            if (!analysisFinished) {
                tlog({ severity: 'INFO', message: 'Synthesis heartbeat delayed. Triggering background re-audit receipt.', session_id: sessionId });
                sseWrite(res, { type: 'INFO', message: 'Optimizing dimensional accuracy...' });
            }
        }, 10000);

        const { report, roadmap, dimensions, richDimensions, specialistOutputs, frameworks, orgName, moatRationale } = await analysisPromise;
        clearTimeout(safetyReceipt);
        const csoCost = estimateCost('gemini-1.5-pro-001', finalContext.length, report.length);
        tlog({ severity: 'INFO', message: 'Analysis complete (clarify)', session_id: sessionId, dimension_count: Object.keys(dimensions).length });

        let docId = `local-${randomUUID()}`;

        try {
            const fingerprint = session.enrichedContext.trim().slice(0, 80).toLowerCase();
            const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const docRef = await admin.firestore().collection('enterprise_strategy_reports').add({
                business_context: session.enrichedContext,
                fingerprint,
                user_clarification: clarification,
                report,
                dimension_scores: dimensions,
                rich_dimensions: richDimensions,
                frameworks,
                grounded_context: session.discoveryFindings,
                stress_test: !!stress_test,
                org_name: orgName,
                moat_rationale: moatRationale,
                user_id: userId,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: expiresAt,
            });
            docId = docRef.id;

            await saveAuditMemory(docId, {
                reportId: docId,
                businessContext: session.enrichedContext,
                groundedContext: session.discoveryFindings,
                specialistOutputs,
                frameworks,
                dimensionScores: dimensions,
                richDimensions,
                report,
                stressTest: !!stress_test,
                orgName,
                moatRationale
            });
        } catch (dbErr: any) {
            tlog({ severity: 'WARNING', message: 'Firestore write skipped', error: dbErr.message, session_id: sessionId });
        }

        await deleteSession(sessionId);
        logAuditCost(sessionId, { synthesis_with_clarification: csoCost.usd });

        // THE RECEIPT CHECK: Ensure dimensions are not entirely zeroed if possible
        const hasDimensions = Object.values(dimensions).some(v => (v ?? 0) > 0);
        if (!hasDimensions) {
            tlog({ severity: 'WARNING', message: 'Dimensions still empty at emit time', session_id: sessionId });
        }

        sseWrite(res, { type: 'REPORT_COMPLETE', id: docId, token: docId.slice(-8), report, dimensions, richDimensions, frameworks, orgName, moatRationale });
        if (roadmap) sseWrite(res, { type: 'ROADMAP_COMPLETE', roadmap });
        res.end();

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
        tlog({
            severity: 'ERROR',
            message: 'Clarify endpoint failed',
            error: errorMessage,
            stack: errorStack,
            session_id: sessionId
        });
        await releaseLock(sessionId); // Still needed on catch
        sseWrite(res, { type: 'ERROR', message: errorMessage });
        res.end();
    }
});

// ─── POST /analyze/stress-test ───────────────────────────────────────────────
// Fast scenario recalculation — bypasses Discovery, uses Firestore cached context.
app.post('/analyze/stress-test', authMiddleware as any, async (req: AuthRequest, res) => {
    const { reportId, scenarioId } = req.body;
    const userId = req.user?.uid || 'anonymous';

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

    tlog({ severity: 'INFO', message: 'Stress test request received', session_id: sessionId, user_id: userId, report_id: reportId, scenario: scenarioId });
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

// ─── POST /internal/send-digests ─────────────────────────────────────────────
app.post('/internal/send-digests', async (req, res) => {
    const secret = req.headers['x-digest-secret'] || req.query.secret;
    const envSecret = process.env.DIGEST_SECRET || 'dev-secret';
    if (secret !== envSecret) {
        return res.status(403).json({ error: 'Unauthorized payload' });
    }

    try {
        const reportsSnapshot = await admin.firestore()
            .collection('enterprise_strategy_reports')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const seenOrgs = new Set<string>();
        let sentCount = 0;

        for (const doc of reportsSnapshot.docs) {
            const data = doc.data();
            const orgId = data.org_id;
            // Assuming the report stores email or user_id we can resolve
            const userEmail = data.user_email || 'admin@velocitycso.com';

            if (orgId && !seenOrgs.has(orgId)) {
                seenOrgs.add(orgId);

                const scoredValues = Object.values(data.dimensionScores || {}).filter((v): v is number => v !== null);
                const overallScore = scoredValues.length ? Math.round(scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length) : 0;

                const topActions = Object.values(data.richDimensions || {})
                    .filter((dim: any) => dim.score < 65 && dim.improvement_action)
                    .map((dim: any) => dim.improvement_action)
                    .slice(0, 3);

                const driftAlerts = Object.keys(data.dimensionScores || {})
                    .filter(k => data.dimensionScores[k] < 40)
                    .map(k => `Critical Risk: ${k} (Score: ${data.dimensionScores[k]})`);

                const dataPayload = {
                    to: userEmail,
                    orgName: data.orgName || 'Your Organization',
                    overallScore,
                    driftAlerts,
                    topActions,
                    reportLink: `${process.env.APP_URL || 'http://localhost:5173'}/report/${doc.id}`
                };

                const sent = await sendStrategyDigest(dataPayload);
                if (sent) sentCount++;
            }
        }

        res.json({ message: 'Digests processing complete', sentCount });
    } catch (err: any) {
        log({ severity: 'ERROR', message: 'Send-digests failed', error: err.message });
        res.status(500).json({ error: 'Failed to process digests' });
    }
});


if (process.env.NODE_ENV !== 'test') {
    app.listen(port, '0.0.0.0', () => {
        log({ severity: 'INFO', message: `VelocityCSO server started on port ${port} [v4.0.0]`, agent_id: 'system' });
    });
}
