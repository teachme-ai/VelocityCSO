import { log } from './logger.js';

// Base success rates derived from strategy research meta-analyses
// (McKinsey, BCG, HBR) — industry-average priors updated by company scores
const ANSOFF_BASE_RATES: Record<string, number> = {
    market_penetration:  0.72,
    market_development:  0.45,
    product_development: 0.38,
    diversification:     0.18,
    platform_pivot:      0.23,
    saas_to_services:    0.31,
    acquisition_exit:    0.52,
};

export interface ForkInput {
    forkName: string;
    forkDescription: string;
    ansoffCell: string;
    requiredDimensions: string[];
}

export interface ForkProbability {
    forkName: string;
    baseProbability: number;
    adjustedProbability: number;
    keyConstraints: string[];
    keyEnablers: string[];
    confidenceInEstimate: number;
}

// Normalise a 0-100 score to a Bayes factor multiplier centred on 1.0
// Score 50 = 1.0 (neutral evidence), 100 = 1.5 (strong positive), 0 = 0.5 (strong negative)
function normalize(score: number): number {
    return 0.5 + (Math.max(0, Math.min(100, score)) / 100);
}

function computeDataConfidence(requiredDims: string[], scores: Record<string, number>): number {
    const available = requiredDims.filter(d => scores[d] !== undefined && scores[d] !== null).length;
    return Math.round((available / Math.max(requiredDims.length, 1)) * 100);
}

export function computeForkProbabilities(
    forks: ForkInput[],
    dimensionScores: Record<string, number>,
    sessionId?: string
): ForkProbability[] {
    return forks.map(fork => {
        const base = ANSOFF_BASE_RATES[fork.ansoffCell] ?? 0.35;

        // Execution multiplier: can the company actually execute this fork?
        const executionScore    = dimensionScores['Execution Speed']       ?? 50;
        const capitalScore      = dimensionScores['Capital Efficiency']    ?? 50;
        const teamScore         = dimensionScores['Team / Founder Strength'] ?? 50;

        // Market multiplier: does the market support this fork?
        const tamScore          = dimensionScores['TAM Viability']         ?? 50;
        const trendScore        = dimensionScores['Trend Adoption']        ?? 50;

        // Defensibility multiplier: can they hold the position if they get there?
        const defensibilityScore = dimensionScores['Competitive Defensibility'] ?? 50;

        const executionMultiplier    = normalize((executionScore + capitalScore + teamScore) / 3);
        const marketMultiplier       = normalize((tamScore + trendScore) / 2);
        const defensibilityMultiplier = normalize(defensibilityScore);
        const combinedEvidence       = executionMultiplier * marketMultiplier * defensibilityMultiplier;

        // Bayesian odds update — avoids raw probability multiplication blowing past 100%
        const baseOdds     = base / (1 - base);
        const adjustedOdds = baseOdds * combinedEvidence;
        let adjusted       = adjustedOdds / (1 + adjustedOdds);
        adjusted           = Math.min(0.95, Math.max(0.05, adjusted));

        // Structured telemetry for calibration across all audit runs
        log({
            severity: 'INFO',
            message: `[SIM 3.2] Fork: ${fork.forkName}`,
            session_id: sessionId,
            base_pct:            `${(base * 100).toFixed(1)}%`,
            base_odds:           baseOdds.toFixed(2),
            evidence:            `x${combinedEvidence.toFixed(2)}`,
            exec_multiplier:     executionMultiplier.toFixed(2),
            market_multiplier:   marketMultiplier.toFixed(2),
            defense_multiplier:  defensibilityMultiplier.toFixed(2),
            adjusted_odds:       adjustedOdds.toFixed(2),
            final_pct:           `${(adjusted * 100).toFixed(1)}%`,
        });

        const keyConstraints = fork.requiredDimensions
            .filter(dim => (dimensionScores[dim] ?? 50) < 45)
            .map(dim => `${dim}: ${dimensionScores[dim]}/100`);

        const keyEnablers = fork.requiredDimensions
            .filter(dim => (dimensionScores[dim] ?? 50) > 70)
            .map(dim => `${dim}: ${dimensionScores[dim]}/100`);

        return {
            forkName:              fork.forkName,
            baseProbability:       Math.round(base * 100),
            adjustedProbability:   Math.round(adjusted * 100),
            keyConstraints,
            keyEnablers,
            confidenceInEstimate:  computeDataConfidence(fork.requiredDimensions, dimensionScores),
        };
    });
}

// Extract named forks from the Strategic Choice section of the synthesis report
export function extractForksFromReport(report: string): ForkInput[] {
    const forks: ForkInput[] = [];

    // Match explicit fork labels like (a) Fortify and IPO, (b) Strategic Sale, (c) Platform Pivot
    const forkPattern = /\(([a-c])\)\s+([^\n\(]{10,120})/gi;
    let match;
    while ((match = forkPattern.exec(report)) !== null) {
        const label = match[1].toLowerCase();
        const description = match[2].trim();

        // Map fork description to Ansoff cell heuristically
        let ansoffCell = 'market_penetration';
        const desc = description.toLowerCase();
        if (desc.includes('pivot') || desc.includes('platform') || desc.includes('api')) {
            ansoffCell = 'platform_pivot';
        } else if (desc.includes('acqui') || desc.includes('sale') || desc.includes('exit')) {
            ansoffCell = 'acquisition_exit';
        } else if (desc.includes('ipo') || desc.includes('fortif') || desc.includes('defend')) {
            ansoffCell = 'market_penetration';
        } else if (desc.includes('expand') || desc.includes('market dev') || desc.includes('geography')) {
            ansoffCell = 'market_development';
        } else if (desc.includes('product') || desc.includes('innovat') || desc.includes('moderniz')) {
            ansoffCell = 'product_development';
        }

        forks.push({
            forkName: `Fork (${label.toUpperCase()}) — ${description.slice(0, 60)}`,
            forkDescription: description,
            ansoffCell,
            requiredDimensions: [
                'Competitive Defensibility', 'Execution Speed', 'Capital Efficiency',
                'TAM Viability', 'Trend Adoption', 'Team / Founder Strength',
            ],
        });
    }

    return forks;
}
