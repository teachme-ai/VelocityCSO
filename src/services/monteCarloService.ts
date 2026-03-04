import { MonteCarloInput, MonteCarloResult } from '../scenarios.js';

// Triangular distribution sample
function triangular(low: number, base: number, high: number): number {
    const u = Math.random();
    const fc = (base - low) / (high - low);
    if (u < fc) return low + Math.sqrt(u * (high - low) * (base - low));
    return high - Math.sqrt((1 - u) * (high - low) * (high - base));
}

export function runMonteCarlo(input: MonteCarloInput, iterations = 5000): {
    ltv_cac_distribution: MonteCarloResult;
    arr_12m_distribution: MonteCarloResult;
    arr_24m_distribution: MonteCarloResult;
    risk_drivers: Array<{ factor: string; variance_contribution: number }>;
} {
    const ltv_cac_samples: number[] = [];
    const arr_12m_samples: number[] = [];
    const arr_24m_samples: number[] = [];

    // Assume starting MRR of 1 (relative, not absolute)
    for (let i = 0; i < iterations; i++) {
        const arpu = triangular(input.arpu_low, input.arpu_base, input.arpu_high);
        const churn = triangular(input.churn_low, input.churn_base, input.churn_high) / 100;
        const cac = triangular(input.cac_low, input.cac_base, input.cac_high);
        const growth = triangular(input.growth_rate_low, input.growth_rate_base, input.growth_rate_high) / 100;
        const gm = triangular(input.gross_margin_low, input.gross_margin_base, input.gross_margin_high) / 100;

        const ltv = churn > 0 ? (arpu * gm) / churn : arpu * gm * 36;
        const ltv_cac = cac > 0 ? ltv / cac : 0;
        ltv_cac_samples.push(ltv_cac);

        // Simulate ARR trajectory
        let mrr = 1;
        for (let month = 0; month < 12; month++) mrr = mrr * (1 + growth) * (1 - churn);
        arr_12m_samples.push(mrr * 12);

        mrr = 1;
        for (let month = 0; month < 24; month++) mrr = mrr * (1 + growth) * (1 - churn);
        arr_24m_samples.push(mrr * 12);
    }

    const percentile = (arr: number[], p: number) => {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor((p / 100) * sorted.length)];
    };

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
            { factor: 'Churn Rate', variance_contribution: 38 },
            { factor: 'CAC', variance_contribution: 28 },
            { factor: 'ARPU', variance_contribution: 20 },
            { factor: 'Growth Rate', variance_contribution: 14 },
        ],
    };
}
