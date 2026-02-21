// Shared type definitions for stress-test simulation

export interface MitigationCard {
    dimension: string;
    stressedScore: number;
    riskDelta: number;
    mitigationSteps: string[];
    csoCrisisPlay: string;
}

export interface StressResult {
    scenarioId: string;
    scenarioLabel: string;
    originalScores: Record<string, number>;
    stressedScores: Record<string, number>;
    riskDeltas: Record<string, number>;
    mitigationCards: MitigationCard[];
}
