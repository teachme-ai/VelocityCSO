import { MonteCarloInput, MonteCarloResult } from '../scenarios.js';

// Triangular distribution sample
function triangular(low: number, base: number, high: number): number {
    const u = Math.random();
    const fc = (base - low) / (high - low);
    if (u < fc) return low + Math.sqrt(u * (high - low) * (base - low));
    return high - Math.sqrt((1 - u) * (high - low) * (high - base));
}

function variance(samples: number[]): number {
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
}

function percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor((p / 100) * sorted.length)] ?? 0;
}

// ── SIM 3.1: Runway Simulation ────────────────────────────────────────────────

export interface RunwayInput {
    current_arr_monthly: number;                        // MRR at audit time
    monthly_burn: number;                               // total monthly spend
    current_cash: number;                               // cash on hand
    growth_rate_dist: [number, number, number];         // monthly MRR growth (low/base/high)
    churn_rate_dist:  [number, number, number];         // monthly churn rate (low/base/high)
}

export interface RunwayResult {
    p10_months: number;
    p50_months: number;
    p90_months: number;
    probability_18m: number;
    probability_24m: number;
    probability_36m: number;
    zero_cash_distribution: number[];   // histogram: count per month bucket [0..36]
    monthly_trajectories: {
        p10: number[];
        p50: number[];
        p90: number[];
    };
    estimated: boolean;                 // true if inputs were derived, not stated
}

function buildHistogram(months: number[], buckets: number): number[] {
    const hist = new Array(buckets + 1).fill(0);
    for (const m of months) hist[Math.min(m, buckets)]++;
    return hist;
}

function buildPercentilePaths(
    allPaths: number[][],
    p10idx: number,
    p50idx: number,
    p90idx: number
): { p10: number[]; p50: number[]; p90: number[] } {
    // Sort paths by final balance at month 36 to pick representative trajectories
    const sorted = [...allPaths].sort((a, b) => (a[36] ?? 0) - (b[36] ?? 0));
    return {
        p10: sorted[p10idx] ?? new Array(37).fill(0),
        p50: sorted[p50idx] ?? new Array(37).fill(0),
        p90: sorted[p90idx] ?? new Array(37).fill(0),
    };
}

export function runRunwaySimulation(
    input: RunwayInput,
    iterations = 10000
): RunwayResult {
    // Guard: if inputs are all zero, return a graceful empty result
    if (input.current_cash <= 0 && input.monthly_burn <= 0) {
        return {
            p10_months: 0, p50_months: 0, p90_months: 0,
            probability_18m: 0, probability_24m: 0, probability_36m: 0,
            zero_cash_distribution: new Array(37).fill(0),
            monthly_trajectories: { p10: new Array(37).fill(0), p50: new Array(37).fill(0), p90: new Array(37).fill(0) },
            estimated: true,
        };
    }

    const runwayMonths: number[] = [];
    const samplePaths: number[][] = [];
    const HORIZON = 36;

    // Sample a subset of paths for trajectory rendering (memory-efficient)
    const TRACK_PATHS = 200;

    for (let i = 0; i < iterations; i++) {
        const g = triangular(...input.growth_rate_dist);
        const c = triangular(...input.churn_rate_dist);

        let balance = input.current_cash;
        let mrr = input.current_arr_monthly;
        let month = 0;
        const path: number[] = i < TRACK_PATHS ? [balance] : [];

        while (balance > 0 && month < HORIZON) {
            mrr = Math.max(0, mrr * (1 + g) * (1 - c));
            balance = balance - input.monthly_burn + mrr;
            month++;
            if (i < TRACK_PATHS) path.push(balance);
        }

        // Pad path to full horizon
        if (i < TRACK_PATHS) {
            while (path.length <= HORIZON) path.push(Math.min(0, path[path.length - 1] ?? 0));
            samplePaths.push(path);
        }

        runwayMonths.push(month);
    }

    runwayMonths.sort((a, b) => a - b);
    const p10idx = Math.floor(iterations * 0.1);
    const p50idx = Math.floor(iterations * 0.5);
    const p90idx = Math.floor(iterations * 0.9);

    const p10 = runwayMonths[p10idx] ?? 0;
    const p50 = runwayMonths[p50idx] ?? 0;
    const p90 = runwayMonths[p90idx] ?? HORIZON;

    // Degenerate result detection — log if all iterations hit zero immediately
    if (p50 === 0) {
        console.warn(`[SIM 3.1] Degenerate result: P50=0 months. Inputs may be invalid. current_cash=${input.current_cash} monthly_burn=${input.monthly_burn} current_arr_monthly=${input.current_arr_monthly}`);
    }

    const trackP10 = Math.floor(TRACK_PATHS * 0.1);
    const trackP50 = Math.floor(TRACK_PATHS * 0.5);
    const trackP90 = Math.floor(TRACK_PATHS * 0.9);

    return {
        p10_months:       p10,
        p50_months:       p50,
        p90_months:       p90,
        probability_18m:  runwayMonths.filter(r => r >= 18).length / iterations,
        probability_24m:  runwayMonths.filter(r => r >= 24).length / iterations,
        probability_36m:  runwayMonths.filter(r => r >= 36).length / iterations,
        zero_cash_distribution: buildHistogram(runwayMonths, HORIZON),
        monthly_trajectories:   buildPercentilePaths(samplePaths, trackP10, trackP50, trackP90),
        estimated: true,
    };
}


export function runMonteCarlo(input: MonteCarloInput, iterations = 5000): {
    ltv_cac_distribution: MonteCarloResult;
    arr_12m_distribution: MonteCarloResult;
    arr_24m_distribution: MonteCarloResult;
    // Dynamically computed variance contributions (sum ≈ 100)
    risk_drivers: Array<{ factor: string; variance_contribution: number }>;
} {
    const ltv_cac_samples: number[] = [];
    const arr_12m_samples: number[] = [];
    const arr_24m_samples: number[] = [];

    // Per-factor isolated samples for variance decomposition
    const churn_isolated: number[] = [];
    const cac_isolated: number[] = [];
    const arpu_isolated: number[] = [];
    const growth_isolated: number[] = [];

    // Base values for isolation runs
    const baseArpu   = input.arpu_base;
    const baseChurn  = input.churn_base / 100;
    const baseCac    = input.cac_base;
    const baseGrowth = input.growth_rate_base / 100;
    const baseGm     = input.gross_margin_base / 100;

    for (let i = 0; i < iterations; i++) {
        const arpu   = triangular(input.arpu_low,         input.arpu_base,         input.arpu_high);
        const churn  = triangular(input.churn_low,        input.churn_base,        input.churn_high)  / 100;
        const cac    = triangular(input.cac_low,          input.cac_base,          input.cac_high);
        const growth = triangular(input.growth_rate_low,  input.growth_rate_base,  input.growth_rate_high) / 100;
        const gm     = triangular(input.gross_margin_low, input.gross_margin_base, input.gross_margin_high) / 100;

        const ltv     = churn > 0 ? (arpu * gm) / churn : arpu * gm * 36;
        const ltv_cac = cac > 0 ? ltv / cac : 0;
        ltv_cac_samples.push(ltv_cac);

        let mrr = 1;
        for (let m = 0; m < 12; m++) mrr = mrr * (1 + growth) * (1 - churn);
        arr_12m_samples.push(mrr * 12);

        mrr = 1;
        for (let m = 0; m < 24; m++) mrr = mrr * (1 + growth) * (1 - churn);
        arr_24m_samples.push(mrr * 12);

        // Isolation runs: vary one factor at a time, hold others at base
        const ltvBase = baseChurn > 0 ? (baseArpu * baseGm) / baseChurn : baseArpu * baseGm * 36;

        churn_isolated.push(baseChurn > 0 ? (baseArpu * baseGm) / churn / baseCac : 0);
        cac_isolated.push(cac > 0 ? ltvBase / cac : 0);
        arpu_isolated.push(baseChurn > 0 ? (arpu * baseGm) / baseChurn / baseCac : 0);
        growth_isolated.push((() => {
            let m2 = 1;
            for (let m = 0; m < 12; m++) m2 = m2 * (1 + growth) * (1 - baseChurn);
            return m2 * 12;
        })());
    }

    // Compute real variance contributions per factor
    const churnVar  = variance(churn_isolated);
    const cacVar    = variance(cac_isolated);
    const arpuVar   = variance(arpu_isolated);
    const growthVar = variance(growth_isolated);
    const totalVar  = churnVar + cacVar + arpuVar + growthVar || 1;

    const toContrib = (v: number) => Math.round((v / totalVar) * 100);
    // Ensure contributions sum to exactly 100
    const churnContrib  = toContrib(churnVar);
    const cacContrib    = toContrib(cacVar);
    const arpuContrib   = toContrib(arpuVar);
    const growthContrib = 100 - churnContrib - cacContrib - arpuContrib;

    return {
        ltv_cac_distribution: {
            metric: 'LTV:CAC Ratio',
            p10: percentile(ltv_cac_samples, 10),
            p50: percentile(ltv_cac_samples, 50),
            p90: percentile(ltv_cac_samples, 90),
            probability_of_failure: ltv_cac_samples.filter(v => v < 1).length / iterations,
        },
        arr_12m_distribution: {
            metric: 'ARR at 12 Months (relative)',
            p10: percentile(arr_12m_samples, 10),
            p50: percentile(arr_12m_samples, 50),
            p90: percentile(arr_12m_samples, 90),
            probability_of_failure: arr_12m_samples.filter(v => v < 0.5).length / iterations,
        },
        arr_24m_distribution: {
            metric: 'ARR at 24 Months (relative)',
            p10: percentile(arr_24m_samples, 10),
            p50: percentile(arr_24m_samples, 50),
            p90: percentile(arr_24m_samples, 90),
            probability_of_failure: arr_24m_samples.filter(v => v < 0.8).length / iterations,
        },
        risk_drivers: [
            { factor: 'Churn Rate',  variance_contribution: churnContrib },
            { factor: 'CAC',         variance_contribution: cacContrib },
            { factor: 'ARPU',        variance_contribution: arpuContrib },
            { factor: 'Growth Rate', variance_contribution: growthContrib },
        ],
    };
}
