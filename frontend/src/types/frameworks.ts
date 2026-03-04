// frontend/src/types/frameworks.ts

export interface ERRCGrid {
    eliminate: string[];
    reduce: string[];
    raise: string[];
    create: string[];
}

export interface CompetitiveFactor {
    name: string;
    businessScore: number;
    competitor1Score: number;
    competitor2Score: number;
    customerImportance: number;
}

export interface BlueOceanResult {
    industry_factors: CompetitiveFactor[];
    errc_grid: ERRCGrid;
    value_curve_summary: string;
    blue_ocean_opportunity: string;
    competitor_names: [string, string];
    strategic_canvas_title: string;
}

export interface UEMetric {
    value: string | number | null;
    benchmark: string;
    status: 'GREEN' | 'AMBER' | 'RED';
    note: string;
}

export interface UnitEconomicsData {
    assumptions: string[];
    metrics: Record<string, UEMetric>;
    sensitivity: {
        base_ltv_cac: number;
        arpu_down_20pct: number;
        churn_up_50pct: number;
        cac_up_30pct: number;
    };
}

export interface ForceData {
    score: number;
    primary_driver: string;
}

export interface FiveForcesData {
    scores: Record<string, ForceData>;
    structural_attractiveness_score: number;
    interaction_effect_warning: string | null;
}

export interface MonteCarloDistribution {
    metric: string;
    p10: number;
    p50: number;
    p90: number;
    probability_of_failure: number;
}

export interface WardleyCapability {
    id: string;
    name: string;
    evolution: number;
    value_chain_position: number;
    is_differentiator: boolean;
    will_commoditize_in_18m: boolean;
    build_buy_partner: 'build' | 'buy' | 'partner' | 'outsource';
    dependency_ids: string[];
}

export interface WardleyResult {
    capabilities: WardleyCapability[];
    strategic_warnings: string[];
    build_buy_decisions: Array<{
        capability: string;
        recommendation: 'build' | 'buy' | 'partner' | 'outsource';
        rationale: string;
    }>;
    core_differentiators: string[];
}
