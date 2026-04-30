/**
 * Structured Cloud Logging for VelocityCSO.
 *
 * Cloud Run ingests console.log JSON into Cloud Logging automatically.
 * GCP parses the `severity` field natively.
 *
 * View logs:
 *   GCP Console → Logging → Log Explorer
 *   Filter: resource.type="cloud_run_revision" AND jsonPayload.system="velocity_cso"
 *
 * Trace waterfall (all logs for one request):
 *   Filter: logging.googleapis.com/trace="projects/velocitycso/traces/<traceId>"
 */

type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

interface LogEntry {
    severity: Severity;
    message: string;
    system: 'velocity_cso';
    agent_id?: string;
    phase?: string;
    session_id?: string;
    'logging.googleapis.com/trace'?: string;
    'logging.googleapis.com/spanId'?: string;
    token_estimate?: number;
    cost_usd?: number;
    agent_input?: unknown;
    agent_output?: unknown;
    latency_ms?: number;
    tokens_in?: number;
    tokens_out?: number;
    [key: string]: unknown;
}

export function log(entry: Omit<LogEntry, 'system'>): void {
    console.log(JSON.stringify({ system: 'velocity_cso' as const, ...entry }));
}

// ─── Trace-bound logger ───────────────────────────────────────────────────────
export function createTraceLogger(traceHeader?: string, projectId?: string) {
    const project = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
    let traceField: string | undefined;
    let spanField: string | undefined;

    if (traceHeader) {
        const [tracePart, spanPart] = traceHeader.split(';')[0].split('/');
        if (tracePart && project) traceField = `projects/${project}/traces/${tracePart}`;
        if (spanPart) spanField = spanPart;
    }

    return (entry: Omit<LogEntry, 'system'>) => log({
        ...entry,
        'logging.googleapis.com/trace': traceField,
        'logging.googleapis.com/spanId': spanField,
    });
}

// ─── Gemini Pricing (Feb 2026) ────────────────────────────────────────────────
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
    'gemini-2.5-pro':   { inputPer1M: 1.25,  outputPer1M: 5.00 },
    'gemini-2.5-flash': { inputPer1M: 0.10,  outputPer1M: 0.40 },
    'gemini-1.5-pro':   { inputPer1M: 1.25,  outputPer1M: 10.00 },
    'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
};

export function computeCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): { usd: number; label: string } {
    const pricing = MODEL_PRICING[model] ?? { inputPer1M: 1.25, outputPer1M: 10.00 };
    const usd =
        (inputTokens / 1_000_000) * pricing.inputPer1M +
        (outputTokens / 1_000_000) * pricing.outputPer1M;
    return {
        usd: Math.round(usd * 100_000) / 100_000,
        label: `$${usd.toFixed(5)}`,
    };
}

/** Legacy helper — estimates tokens from char count (4 chars ≈ 1 token). */
export function estimateCost(
    model: string,
    inputChars: number,
    outputChars: number
): { inputTokens: number; outputTokens: number; usd: number; label: string } {
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    const { usd, label } = computeCost(model, inputTokens, outputTokens);
    return { inputTokens, outputTokens, usd, label };
}

// ─── Session-scoped cost accumulator ─────────────────────────────────────────
/**
 * Tracks every LLM call made during a single audit session.
 * Call trackLlmCall() after each callGemini(). Call finalise() at the end.
 *
 * Usage:
 *   const cost = createCostTracker(sessionId);
 *   cost.track('market_analyst', 'gemini-2.5-flash', inputTokens, outputTokens);
 *   ...
 *   cost.finalise();  // logs full breakdown to Cloud Logging
 */
export interface CostTracker {
    track(agent: string, model: string, inputTokens: number, outputTokens: number): void;
    finalise(): void;
    totalUsd(): number;
}

export function createCostTracker(sessionId: string): CostTracker {
    const calls: Array<{
        agent: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        usd: number;
    }> = [];

    return {
        track(agent, model, inputTokens, outputTokens) {
            const { usd } = computeCost(model, inputTokens, outputTokens);
            calls.push({ agent, model, inputTokens, outputTokens, usd });
            log({
                severity: 'DEBUG',
                message: `[COST] ${agent} (${model}) in:${inputTokens} out:${outputTokens} → $${usd.toFixed(5)}`,
                session_id: sessionId,
                agent_id: agent,
                model,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost_usd: usd,
            });
        },

        totalUsd() {
            return calls.reduce((sum, c) => sum + c.usd, 0);
        },

        finalise() {
            const totalUsd = calls.reduce((sum, c) => sum + c.usd, 0);
            const totalTokens = calls.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0);
            const byAgent: Record<string, { usd: number; tokens: number }> = {};
            for (const c of calls) {
                if (!byAgent[c.agent]) byAgent[c.agent] = { usd: 0, tokens: 0 };
                byAgent[c.agent].usd += c.usd;
                byAgent[c.agent].tokens += c.inputTokens + c.outputTokens;
            }

            log({
                severity: 'INFO',
                message: `[COST SUMMARY] Audit complete — total $${totalUsd.toFixed(5)} across ${calls.length} LLM calls (${totalTokens.toLocaleString()} tokens)`,
                session_id: sessionId,
                agent_id: 'cost_tracker',
                total_cost_usd: Math.round(totalUsd * 100_000) / 100_000,
                total_cost_label: `$${totalUsd.toFixed(5)}`,
                total_tokens: totalTokens,
                llm_call_count: calls.length,
                cost_by_agent: byAgent,
                call_log: calls,
            });
        },
    };
}

// ─── Phase timer ──────────────────────────────────────────────────────────────
/**
 * Logs phase start/end with duration. Use at each major pipeline stage.
 *
 * Usage:
 *   const phase = startPhase('phase_a_market', sessionId);
 *   // ... do work ...
 *   phase.end({ agents_run: 3 });
 */
export function startPhase(phaseName: string, sessionId: string) {
    const t0 = Date.now();
    log({
        severity: 'INFO',
        message: `[PHASE START] ${phaseName}`,
        session_id: sessionId,
        phase: phaseName,
    });

    return {
        end(extra?: Record<string, unknown>) {
            const ms = Date.now() - t0;
            log({
                severity: 'INFO',
                message: `[PHASE END] ${phaseName} — ${ms}ms`,
                session_id: sessionId,
                phase: phaseName,
                latency_ms: ms,
                ...extra,
            });
            return ms;
        },
    };
}

// ─── Input truncation guard ───────────────────────────────────────────────────
const MAX_CONTEXT_CHARS = 24_000; // ~6K tokens — safe for all specialist prompts

/**
 * Truncates business context to prevent runaway input costs.
 * Logs a warning if truncation occurs.
 */
export function guardContext(context: string, sessionId: string, caller: string): string {
    if (context.length <= MAX_CONTEXT_CHARS) return context;
    log({
        severity: 'WARNING',
        message: `[TOKEN GUARD] Context truncated for ${caller}: ${context.length} → ${MAX_CONTEXT_CHARS} chars`,
        session_id: sessionId,
        agent_id: caller,
        original_chars: context.length,
        truncated_chars: MAX_CONTEXT_CHARS,
        chars_dropped: context.length - MAX_CONTEXT_CHARS,
    });
    return context.slice(0, MAX_CONTEXT_CHARS) + '\n\n[CONTEXT TRUNCATED — original exceeded safe token limit]';
}

/** @deprecated Use logAuditCost via CostTracker.finalise() instead */
export function logAuditCost(sessionId: string, costBreakdown: Record<string, number>): void {
    const totalUsd = Object.values(costBreakdown).reduce((a, b) => a + b, 0);
    log({
        severity: 'INFO',
        message: 'Audit cost summary',
        agent_id: 'cost_tracker',
        session_id: sessionId,
        cost_breakdown_usd: costBreakdown,
        total_cost_usd: Math.round(totalUsd * 100_000) / 100_000,
        total_cost_label: `$${totalUsd.toFixed(5)}`,
    });
}
