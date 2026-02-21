/**
 * Structured Cloud Logging for VelocityCSO Agent Transitions.
 *
 * Cloud Run automatically ingests console.log JSON into Cloud Logging.
 * No third-party SDK needed — GCP parses the `severity` field natively.
 *
 * View logs at: GCP Console → Logging → Log Explorer
 * Filter: resource.type="cloud_run_revision" AND jsonPayload.system="velocity_cso"
 */

type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

interface LogEntry {
    severity: Severity;
    message: string;
    system: 'velocity_cso';
    agent_id?: string;
    phase?: string;
    session_id?: string;
    /** GCP Cloud Trace fields — auto-assembled into waterfall in Trace Explorer */
    'logging.googleapis.com/trace'?: string;
    'logging.googleapis.com/spanId'?: string;
    /** Estimated token count for this agent call */
    token_estimate?: number;
    /** Estimated USD cost for this agent call */
    cost_usd?: number;
    /** Any extra structured fields */
    [key: string]: unknown;
}

export function log(entry: Omit<LogEntry, 'system'>): void {
    const payload: LogEntry = { system: 'velocity_cso', ...entry };
    console.log(JSON.stringify(payload));
}

/**
 * Creates a request-scoped logger bound to a Cloud Trace context.
 * Pass the X-Cloud-Trace-Context header value from Express to correlate
 * all agent logs for a single request into one trace waterfall.
 *
 * Header format: "<traceId>/<spanId>;o=1"
 * GCP project: set via GOOGLE_CLOUD_PROJECT env var (auto-set on Cloud Run).
 */
export function createTraceLogger(traceHeader?: string, projectId?: string) {
    const project = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
    let traceField: string | undefined;
    let spanField: string | undefined;

    if (traceHeader) {
        const [tracePart, spanPart] = traceHeader.split(';')[0].split('/');
        if (tracePart && project) {
            traceField = `projects/${project}/traces/${tracePart}`;
        }
        if (spanPart) spanField = spanPart;
    }

    return (entry: Omit<LogEntry, 'system'>) => log({
        ...entry,
        'logging.googleapis.com/trace': traceField,
        'logging.googleapis.com/spanId': spanField,
    });
}

// ─── Gemini Pricing (as of Feb 2026) ────────────────────────────────────────
// https://ai.google.dev/pricing
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
    'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.00 },
    'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
};

/**
 * Estimates Gemini API cost for a single agent call.
 * Token counts are approximate (4 chars ≈ 1 token).
 */
export function estimateCost(
    model: string,
    inputChars: number,
    outputChars: number
): { inputTokens: number; outputTokens: number; usd: number; label: string } {
    const pricing = MODEL_PRICING[model] ?? { inputPer1M: 1.25, outputPer1M: 10.00 };
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    const usd =
        (inputTokens / 1_000_000) * pricing.inputPer1M +
        (outputTokens / 1_000_000) * pricing.outputPer1M;

    return {
        inputTokens,
        outputTokens,
        usd: Math.round(usd * 100_000) / 100_000, // 5 decimal places
        label: `$${usd.toFixed(5)}`,
    };
}

/**
 * Logs cost summary for a full 15-dimension audit.
 * Call at the end of each /analyze request.
 */
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
