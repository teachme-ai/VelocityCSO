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

export function runMonteCarlo(input: MonteCarloInput, iterations = 5000): {
    ltv_cac_distribution: MonteCarloResult;
    arr_12m_distribution: MonteCarloResult;
    arr_24m_distribution: MonteCarloResult;
    // FIX 1.7: dynamically computed variance contributions (sum ≈ 100)
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

    // FIX 1.7: compute real variance contributions
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
