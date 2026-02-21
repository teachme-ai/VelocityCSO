/**
 * Stress-Test Scenario Registry
 * Each scenario injects a "Synthetic Crisis" into the specialist recalculation.
 */

export const SCENARIOS = {
    RECESSION: {
        id: 'RECESSION',
        label: 'Economic Recession',
        icon: 'TrendingDown',
        color: '#ef4444',
        prompt: `SYNTHETIC CRISIS — ECONOMIC RECESSION:
Assume a severe global economic recession is underway:
- Consumer discretionary spending has dropped 35%
- B2B deal cycles have extended from 3 months to 9+ months
- VC/PE funding has frozen; Series A/B rounds are 70% oversubscribed
- Cost of capital has risen; CAC is up 40% across all digital channels
- Churn rate has increased by 20-25% across SaaS benchmarks
Recalculate how this crisis impacts this specific business.`,
    },
    PRICE_WAR: {
        id: 'PRICE_WAR',
        label: 'Competitor Price War',
        icon: 'Sword',
        color: '#f97316',
        prompt: `SYNTHETIC CRISIS — COMPETITOR PRICE WAR:
A dominant competitor has triggered an aggressive price war:
- Main competitor has slashed prices by 50% with unlimited runway to sustain losses
- Industry-wide ASP (Average Selling Price) is compressing 30% per year
- Price-sensitive customer segments (typically 40-60% of TAM) are defecting
- Sales team is discounting aggressively to retain accounts, crushing gross margin
- New customer pipeline has stalled as prospects wait for stability
Recalculate the impact across all 15 strategic dimensions.`,
    },
    SCALE_UP: {
        id: 'SCALE_UP',
        label: 'Aggressive Scale-Up',
        icon: 'Rocket',
        color: '#8b5cf6',
        prompt: `SYNTHETIC CRISIS — AGGRESSIVE OPERATIONAL SCALE-UP:
A Series B/C investor has issued a "triple or die" growth mandate:
- Headcount must grow 3× in 90 days (recruiting at full-market salaries)
- Infrastructure costs scale non-linearly; burn rate triples before revenue catches up
- Leadership bandwidth is stretched: 6 key managers are managing 3 direct reports each
- Customer onboarding capacity is overwhelmed; time-to-value degrades by 60%
- Technical debt accumulates as shipping speed jumps before code quality stabilizes
Recalculate operational, financial, and execution dimensions under this stress.`,
    },
    TALENT: {
        id: 'TALENT',
        label: 'Global Talent Shortage',
        icon: 'Users',
        color: '#06b6d4',
        prompt: `SYNTHETIC CRISIS — GLOBAL TECHNICAL TALENT SHORTAGE:
A structural talent shortage in the core skill domain has materialized:
- Hiring cost for senior engineers/specialists has doubled (median comp up 80%)
- Time-to-hire has tripled; critical roles sit vacant for 4-6 months
- Competitor poaching is accelerating; 3 key team members have exited
- Offshore/remote talent quality is inconsistent; ramp time is 60% longer
- AI/automation cannot bridge the gap fast enough; R&D velocity drops 35%
Recalculate how this talent crisis degrades each of the 15 dimensions.`,
    },
} as const;

export type ScenarioId = keyof typeof SCENARIOS;

export interface StressResult {
    scenarioId: ScenarioId;
    scenarioLabel: string;
    originalScores: Record<string, number>;
    stressedScores: Record<string, number>;
    riskDeltas: Record<string, number>;
    mitigationCards: MitigationCard[];
}

export interface MitigationCard {
    dimension: string;
    stressedScore: number;
    riskDelta: number;
    mitigationSteps: string[];
    csoCrisisPlay: string;
}
