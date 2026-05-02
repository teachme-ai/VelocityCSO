export interface AttackVector {
    name: string;
    accelerationFactor: number; // 0-1: how much this compresses the replication clock
    probability: number;        // P(this vector fires) in next 24 months
    triggerMonth: number | null;
}

export interface InterventionPoint {
    month: number;
    action: string;
    urgency: 'now' | 'soon' | 'monitor';
}

export interface MoatDecayInput {
    moatName: string;
    inimitabilityScore: number;      // VRIO Inimitable score (0-100)
    competitiveRivalryScore: number; // Porter's Competitive Rivalry score
    replicationMonthsEstimate: number;
    attackVectors: AttackVector[];
}

export interface MoatDecayResult {
    baseline_months_to_parity: number;
    accelerated_months_to_parity: number;
    strength_at_12m: number;
    strength_at_24m: number;
    strength_at_36m: number;
    decay_curve_baseline: number[];
    decay_curve_accelerated: number[];
    intervention_points: InterventionPoint[];
}

// Estimate replication time from inimitability score and competitive rivalry
function estimateReplicationTime(inimitability: number, rivalry: number): number {
    // High inimitability + low rivalry = long replication time
    // Scale: 6 months (score 0) to 48 months (score 100)
    const base = 6 + (inimitability / 100) * 42;
    // High rivalry compresses the clock by up to 30%
    const rivalryPenalty = (rivalry / 100) * 0.3;
    return Math.round(base * (1 - rivalryPenalty));
}

// Fixed decay curve — linear from startStrength to parityThreshold (50),
// then exponential from 50 toward residualFloor (30).
// Eliminates the discontinuity bug where post-parity formula restarted from startStrength.
function computeDecayCurve(startStrength: number, replicationMonths: number, horizon: number): number[] {
    const curve: number[] = [];
    const parityThreshold = 50;
    const residualFloor = 30;

    for (let m = 0; m <= horizon; m++) {
        if (m >= replicationMonths) {
            // After parity: exponential decay from 50 toward 30
            const postParityDecay = Math.max(
                residualFloor,
                parityThreshold * Math.exp(-0.1 * (m - replicationMonths))
            );
            curve.push(Math.round(postParityDecay));
        } else {
            // Before parity: linear decay from startStrength down to 50
            const strength = startStrength - ((startStrength - parityThreshold) * (m / replicationMonths));
            curve.push(Math.round(strength));
        }
    }
    return curve;
}

function computeInterventionPoints(
    baseline: number[],
    accelerated: number[],
    replicationMonths: number
): InterventionPoint[] {
    const points: InterventionPoint[] = [];

    // Flag when baseline drops below 65 (moat weakening)
    const warnMonth = baseline.findIndex(s => s < 65);
    if (warnMonth > 0 && warnMonth < 36) {
        points.push({
            month: warnMonth,
            action: 'Begin moat reinforcement — invest in next-generation capability or regulatory re-certification',
            urgency: warnMonth <= 6 ? 'now' : warnMonth <= 18 ? 'soon' : 'monitor',
        });
    }

    // Flag when accelerated curve diverges from baseline by more than 10 points
    for (let m = 1; m <= 36; m++) {
        if ((baseline[m] ?? 0) - (accelerated[m] ?? 0) > 10 && points.every(p => p.month !== m)) {
            points.push({
                month: m,
                action: 'Attack vector materialising — activate defensive response plan',
                urgency: m <= 6 ? 'now' : 'soon',
            });
            break; // one divergence warning is enough
        }
    }

    return points;
}

export function computeMoatDecay(input: MoatDecayInput): MoatDecayResult {
    const replicationMonths = input.replicationMonthsEstimate > 0
        ? input.replicationMonthsEstimate
        : estimateReplicationTime(input.inimitabilityScore, input.competitiveRivalryScore);

    // Log inputs so we can verify the model is receiving sensible values
    const inputSource = input.replicationMonthsEstimate > 0 ? 'clarifier_stated' : 'estimated_from_scores';
    // Use console for service-level logging (no logger import needed in pure math service)
    console.log(`[SIM 3.3] computeMoatDecay | moat=${input.moatName} | inimitability=${input.inimitabilityScore} | rivalry=${input.competitiveRivalryScore} | replication_months=${replicationMonths} (${inputSource}) | attack_vectors=${input.attackVectors.length}`);
    const baselineCurve = computeDecayCurve(input.inimitabilityScore, replicationMonths, 36);

    // Accelerated scenario: top attack vector compresses the replication clock
    const topVector = [...input.attackVectors]
        .sort((a, b) => b.accelerationFactor - a.accelerationFactor)[0];

    const acceleratedMonths = topVector
        ? Math.max(6, Math.round(replicationMonths * (1 - topVector.accelerationFactor * topVector.probability)))
        : replicationMonths;

    const acceleratedCurve = computeDecayCurve(input.inimitabilityScore, acceleratedMonths, 36);

    return {
        baseline_months_to_parity:     replicationMonths,
        accelerated_months_to_parity:  acceleratedMonths,
        strength_at_12m:               baselineCurve[12],
        strength_at_24m:               baselineCurve[24],
        strength_at_36m:               baselineCurve[36],
        decay_curve_baseline:          baselineCurve,
        decay_curve_accelerated:       acceleratedCurve,
        intervention_points:           computeInterventionPoints(baselineCurve, acceleratedCurve, replicationMonths),
    };
}

// Extract replication time from clarifier answer text.
// Looks for explicit replication/copy/replicate language with a month figure.
// Falls back to 0 (triggers score-based estimation) if no match found.
// Deliberately avoids matching years (4-digit numbers) to prevent grabbing
// founding years like "founded 2018" as a replication estimate.
export function extractReplicationMonths(text: string): number {
    if (!text || text.length < 5) return 0;

    // Pattern 1: explicit replication language + number + months
    // e.g. "24-30 months", "replicate in 18 months", "2 years to replicate"
    const replicationMatch = text.match(
        /(?:replicate|copy|imitate|replication|replicat|rebuild|re-build|build.{0,20}from scratch)[^.]{0,60}?(\d{1,3})\s*(?:month|mo\b)/i
    );
    if (replicationMatch) {
        const months = parseInt(replicationMatch[1], 10);
        if (!isNaN(months) && months > 0 && months <= 120) return months;
    }

    // Pattern 2: "X months" or "X-Y months" near competitive/moat language
    const monthsMatch = text.match(
        /(?:competitor|well.funded|new entrant|rival)[^.]{0,120}?(\d{1,3})(?:\s*[-–]\s*\d{1,3})?\s*month/i
    );
    if (monthsMatch) {
        const months = parseInt(monthsMatch[1], 10);
        if (!isNaN(months) && months > 0 && months <= 120) return months;
    }

    // Pattern 3: "X years" near replication language (convert to months)
    const yearsMatch = text.match(
        /(?:replicate|copy|imitate|replication|competitor)[^.]{0,60}?(\d{1})\s*(?:year|yr)/i
    );
    if (yearsMatch) {
        const years = parseInt(yearsMatch[1], 10);
        if (!isNaN(years) && years > 0 && years <= 10) return years * 12;
    }

    return 0; // triggers score-based estimation in computeMoatDecay
}
