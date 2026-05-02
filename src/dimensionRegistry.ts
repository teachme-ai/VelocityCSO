/**
 * Dimension Registry — single source of truth for all 20 strategic dimensions.
 * Defines polarity, moat eligibility, and category for every dimension.
 * FIX 1.3: Prevents risk-absence dimensions from being selected as moat.
 */

export interface DimensionMeta {
    key: string;
    displayName: string;
    category: 'market' | 'strategy' | 'commercial' | 'operations' | 'finance';
    isRiskDimension: boolean;   // TRUE = high score means ABSENCE of risk, not presence of strength
    moatEligible: boolean;      // FALSE = never select as primary moat
    nullSignalScore: number;    // Score below which = insufficient data, not genuine weakness
}

export const DIMENSION_REGISTRY: DimensionMeta[] = [
    { key: 'TAM Viability',               displayName: 'TAM Viability',               category: 'market',      isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'Target Precision',            displayName: 'Target Precision',            category: 'market',      isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Trend Adoption',              displayName: 'Trend Adoption',              category: 'market',      isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'Team / Founder Strength',     displayName: 'Team / Founder Strength',     category: 'market',      isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Competitive Defensibility',   displayName: 'Competitive Defensibility',   category: 'strategy',    isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'Model Innovation',            displayName: 'Model Innovation',            category: 'strategy',    isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'Flywheel Potential',          displayName: 'Flywheel Potential',          category: 'strategy',    isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'Network Effects Strength',    displayName: 'Network Effects Strength',    category: 'strategy',    isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'Data Asset Quality',          displayName: 'Data Asset Quality',          category: 'strategy',    isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'Pricing Power',               displayName: 'Pricing Power',               category: 'commercial',  isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'CAC/LTV Ratio',               displayName: 'CAC/LTV Ratio',               category: 'commercial',  isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Market Entry Speed',          displayName: 'Market Entry Speed',          category: 'commercial',  isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Execution Speed',             displayName: 'Execution Speed',             category: 'operations',  isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Scalability',                 displayName: 'Scalability',                 category: 'operations',  isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'ESG Posture',                 displayName: 'ESG Posture',                 category: 'operations',  isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Regulatory Readiness',        displayName: 'Regulatory Readiness',        category: 'operations',  isRiskDimension: false, moatEligible: true,  nullSignalScore: 20 },
    { key: 'ROI Projection',              displayName: 'ROI Projection',              category: 'finance',     isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Risk Tolerance',              displayName: 'Risk Tolerance',              category: 'finance',     isRiskDimension: true,  moatEligible: false, nullSignalScore: 20 },
    { key: 'Capital Efficiency',          displayName: 'Capital Efficiency',          category: 'finance',     isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Customer Concentration Risk', displayName: 'Customer Concentration Risk', category: 'finance',     isRiskDimension: true,  moatEligible: false, nullSignalScore: 20 },
];

/**
 * Returns moat-eligible dimensions sorted by score descending.
 * FIX 1.4: Replaces blind .reduce() moat selection.
 */
export function getMoatEligibleDimensions(scores: Record<string, number | null>): [string, number][] {
    return DIMENSION_REGISTRY
        .filter(d => d.moatEligible && scores[d.key] !== null && scores[d.key] !== undefined)
        .map(d => [d.key, scores[d.key] as number] as [string, number])
        .sort((a, b) => b[1] - a[1]);
}
