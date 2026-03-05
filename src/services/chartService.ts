/**
 * chartService.ts
 * Node.js client for the Python charts sidecar running on localhost:8001.
 *
 * Responsibilities:
 *   - Build the chart request from AuditMemory framework data
 *   - POST to /charts with a 30s timeout
 *   - Log every outcome (ok / fallback / sidecar-unreachable)
 *   - Return typed ChartImages — empty strings signal "use text fallback"
 */

import { log } from './logger.js';
import type { AuditMemory } from './memory.js';

const SIDECAR_URL = process.env.CHARTS_SIDECAR_URL ?? 'http://localhost:8001';
const TIMEOUT_MS  = 30_000;

export interface ChartImages {
    porter?:            string;
    ansoff?:            string;
    vrio?:              string;
    blue_ocean_canvas?: string;
    blue_ocean_errc?:   string;
    wardley?:           string;
    monte_carlo?:       string;
    pestle?:            string;
    unit_economics?:    string;
}

interface SidecarResponse {
    session_id:  string;
    report_id:   string;
    images:      Record<string, string>;
    errors:      Record<string, string>;
    latency_ms:  number;
}

/**
 * Renders all available strategy charts for a completed audit.
 * Returns an empty ChartImages object if the sidecar is unreachable —
 * callers should fall back to text/table representation in the PDF.
 */
export async function renderCharts(
    memory: AuditMemory,
    sessionId: string,
    reportId: string,
): Promise<ChartImages> {
    const t0 = Date.now();

    // ── Build chart data payload from memory ──────────────────────────────────
    const charts: Record<string, unknown> = {};

    if (memory.frameworks?.porter)          charts['porter']            = memory.frameworks.porter;
    if (memory.frameworks?.ansoff)          charts['ansoff']            = memory.frameworks.ansoff;
    if (memory.frameworks?.vrio)            charts['vrio']              = memory.frameworks.vrio;
    if (memory.frameworks?.blue_ocean)      {
        charts['blue_ocean_canvas'] = memory.frameworks.blue_ocean;
        charts['blue_ocean_errc']   = memory.frameworks.blue_ocean;
    }
    if (memory.frameworks?.wardley)         charts['wardley']           = memory.frameworks.wardley;
    if (memory.frameworks?.monte_carlo)     charts['monte_carlo']       = memory.frameworks.monte_carlo;
    if (memory.frameworks?.pestle)          charts['pestle']            = memory.frameworks.pestle;
    if (memory.frameworks?.unit_economics)  charts['unit_economics']    = memory.frameworks.unit_economics;

    if (Object.keys(charts).length === 0) {
        log({
            severity:   'WARNING',
            message:    'chartService | no_chart_data | skipping sidecar call',
            agent_id:   'chart_service',
            session_id: sessionId,
        });
        return {};
    }

    log({
        severity:    'INFO',
        message:     'chartService | request_start',
        agent_id:    'chart_service',
        session_id:  sessionId,
        report_id:   reportId,
        chart_count: Object.keys(charts).length,
        charts:      Object.keys(charts),
    });

    // ── Call sidecar ──────────────────────────────────────────────────────────
    let sidecarResp: SidecarResponse;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const httpResp = await fetch(`${SIDECAR_URL}/charts`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ session_id: sessionId, report_id: reportId, charts }),
            signal:  controller.signal,
        });
        clearTimeout(timer);

        if (!httpResp.ok) {
            const body = await httpResp.text().catch(() => '');
            throw new Error(`HTTP ${httpResp.status}: ${body}`);
        }

        sidecarResp = await httpResp.json() as SidecarResponse;

    } catch (err: unknown) {
        const isAbort = (err as Error)?.name === 'AbortError';
        const msg     = isAbort ? 'timeout after 30s' : String(err);
        log({
            severity:    'ERROR',
            message:     `chartService | sidecar_unreachable | ${msg}`,
            agent_id:    'chart_service',
            session_id:  sessionId,
            report_id:   reportId,
            latency_ms:  Date.now() - t0,
            fallback:    'text_only_pdf',
        });
        return {};
    }

    // ── Log per-chart outcomes ────────────────────────────────────────────────
    for (const [chart, errMsg] of Object.entries(sidecarResp.errors ?? {})) {
        if (errMsg) {
            log({
                severity:   'WARNING',
                message:    `chartService | chart_failed | chart=${chart} | ${errMsg}`,
                agent_id:   'chart_service',
                session_id: sessionId,
                report_id:  reportId,
                chart,
                fallback:   'text_table',
            });
        }
    }

    const okCount   = Object.values(sidecarResp.images ?? {}).filter(v => v).length;
    const failCount = Object.values(sidecarResp.errors ?? {}).filter(v => v).length;

    log({
        severity:    'INFO',
        message:     'chartService | request_complete',
        agent_id:    'chart_service',
        session_id:  sessionId,
        report_id:   reportId,
        charts_ok:   okCount,
        charts_fail: failCount,
        sidecar_latency_ms: sidecarResp.latency_ms,
        total_latency_ms:   Date.now() - t0,
    });

    // ── Return typed result ───────────────────────────────────────────────────
    const imgs = sidecarResp.images ?? {};
    return {
        porter:            imgs['porter']            ?? '',
        ansoff:            imgs['ansoff']            ?? '',
        vrio:              imgs['vrio']              ?? '',
        blue_ocean_canvas: imgs['blue_ocean_canvas'] ?? '',
        blue_ocean_errc:   imgs['blue_ocean_errc']   ?? '',
        wardley:           imgs['wardley']           ?? '',
        monte_carlo:       imgs['monte_carlo']       ?? '',
        pestle:            imgs['pestle']            ?? '',
        unit_economics:    imgs['unit_economics']    ?? '',
    };
}

/**
 * Checks if the Python sidecar is reachable.
 * Called at startup — logs WARNING if down, does not throw.
 */
export async function checkSidecarHealth(sessionId = 'startup'): Promise<boolean> {
    try {
        const resp = await fetch(`${SIDECAR_URL}/health`, { signal: AbortSignal.timeout(5000) });
        const body = await resp.json() as { status: string; renderer_count: number };
        log({
            severity:        'INFO',
            message:         'chartService | sidecar_healthy',
            agent_id:        'chart_service',
            session_id:      sessionId,
            renderer_count:  body.renderer_count,
            status:          body.status,
        });
        return true;
    } catch {
        log({
            severity:   'WARNING',
            message:    'chartService | sidecar_not_reachable | PDF will use text fallbacks',
            agent_id:   'chart_service',
            session_id: sessionId,
        });
        return false;
    }
}
