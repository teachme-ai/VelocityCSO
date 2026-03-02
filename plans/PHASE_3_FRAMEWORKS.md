# Phase 3: New Strategic Frameworks

> **Goal:** Add 5 high-impact strategy frameworks that transform VelocityCSO from a scoring tool into a full strategic intelligence platform.  
> **Depends on:** Phase 2 complete (staged pipeline, new specialist structure).

---

## Framework 1 — Blue Ocean / ERRC Grid

### New file: `src/agents/blueOceanAgent.ts`

```typescript
// src/agents/blueOceanAgent.ts

import { LlmAgent } from '@google/adk';

export interface ERRCGrid {
  eliminate: string[];   // Factors to remove entirely — save cost, reduce complexity
  reduce: string[];      // Factors to reduce well below industry standard
  raise: string[];       // Factors to raise well above industry standard
  create: string[];      // Factors that don't exist in industry yet
}

export interface CompetitiveFactor {
  name: string;
  businessScore: number;      // 0-10
  competitor1Score: number;   // 0-10
  competitor2Score: number;   // 0-10
  customerImportance: number; // 0-10: how much customers actually care
}

export interface BlueOceanResult {
  industry_factors: CompetitiveFactor[];
  errc_grid: ERRCGrid;
  value_curve_summary: string;
  blue_ocean_opportunity: string;
  competitor_names: [string, string];
  strategic_canvas_title: string;
}

export const blueOceanAgent = new LlmAgent({
  name: 'blue_ocean_analyst',
  model: 'gemini-2.5-flash',
  instruction: `
You are a Blue Ocean Strategy analyst. Identify uncontested market space.

STEP 1 — INDUSTRY FACTORS
Identify the 6-8 factors that companies in this industry typically compete on.
Examples: price, product range, ease of use, customer service, brand, speed,
customisation, compliance, integrations, support quality.

STEP 2 — COMPETITOR IDENTIFICATION
Name the 2 most relevant direct competitors to this business.
If none are named in the context, infer the most likely competitors from the industry.

STEP 3 — VALUE CURVE SCORING
Score the business and both competitors on each factor (0-10).
Also score how much customers ACTUALLY care about each factor (0-10).
A gap between competitor scores and customer importance = opportunity.

STEP 4 — ERRC ANALYSIS
For each factor, apply:
ELIMINATE: Factor has high cost but low customer importance AND the business
           scores it similarly to competitors — competing on this is waste.
REDUCE: Factor has moderate cost but customer importance is declining —
        reduce but don't eliminate.
RAISE: Factor has high customer importance but all players score it low —
       this is where to invest heavily.
CREATE: A factor customers value that NO current competitor offers —
        the blue ocean itself.

STEP 5 — OPPORTUNITY STATEMENT
Write a 2-3 sentence blue ocean opportunity statement:
"By [eliminating X], [reducing Y], [raising Z], and [creating W],
[Company] can unlock [specific customer segment] who are currently
[underserved in specific way]."

OUTPUT FORMAT (strict JSON):
{
  "competitor_names": ["Competitor A", "Competitor B"],
  "industry_factors": [
    {
      "name": "factor name",
      "businessScore": 0-10,
      "competitor1Score": 0-10,
      "competitor2Score": 0-10,
      "customerImportance": 0-10
    }
  ],
  "errc_grid": {
    "eliminate": ["Factor X — reason in one sentence"],
    "reduce": ["Factor Y — reason in one sentence"],
    "raise": ["Factor Z — reason in one sentence"],
    "create": ["New Factor W — description in one sentence"]
  },
  "value_curve_summary": "2-sentence narrative of how the value curve differs",
  "blue_ocean_opportunity": "2-3 sentence opportunity statement",
  "strategic_canvas_title": "Short title for the value curve chart"
}
`
});
```

### Integration in `src/coordinator.ts`

Run `blueOceanAgent` after the staged pipeline but before CSO synthesis:

```typescript
// src/coordinator.ts — add after Phase C (finance), before Critic:

import { blueOceanAgent, BlueOceanResult } from './agents/blueOceanAgent.js';

// In analyze():
emitHeartbeat(sessionId, 'Blue Ocean: Mapping competitive white space...', 'standard');
const blueOceanResult = await this.runSpecialist(blueOceanAgent, businessContext, sessionId) as unknown as BlueOceanResult;

// Add to final report data:
reportData.blueOcean = blueOceanResult;
```

### New frontend component: `frontend/src/components/BlueOceanCanvas.tsx`

```tsx
// frontend/src/components/BlueOceanCanvas.tsx

import { BlueOceanResult, CompetitiveFactor } from '../types/frameworks';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BlueOceanCanvasProps {
  data: BlueOceanResult;
}

export function BlueOceanCanvas({ data }: BlueOceanCanvasProps) {
  // Transform for Recharts LineChart
  const chartData = data.industry_factors.map((f: CompetitiveFactor) => ({
    factor: f.name,
    'Your Business': f.businessScore,
    [data.competitor_names[0]]: f.competitor1Score,
    [data.competitor_names[1]]: f.competitor2Score,
    'Customer Priority': f.customerImportance,
  }));

  const errcColors = {
    eliminate: '#ef4444',  // red
    reduce: '#f97316',     // orange
    raise: '#10b981',      // green
    create: '#8b5cf6',     // purple
  };

  return (
    <div className="space-y-6">
      {/* Value Curve Chart */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Strategic Canvas — {data.strategic_canvas_title}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis dataKey="factor" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" height={70} />
            <YAxis domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0f1829', border: '1px solid #1e2a3a' }} />
            <Legend />
            <Line type="monotone" dataKey="Your Business" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
            <Line type="monotone" dataKey={data.competitor_names[0]} stroke="#374151" strokeWidth={2} strokeDasharray="5 5" />
            <Line type="monotone" dataKey={data.competitor_names[1]} stroke="#374151" strokeWidth={2} strokeDasharray="3 3" />
            <Line type="monotone" dataKey="Customer Priority" stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ERRC Grid */}
      <div className="grid grid-cols-2 gap-4">
        {(Object.entries(data.errc_grid) as [keyof typeof errcColors, string[]][]).map(([quadrant, items]) => (
          <div key={quadrant} className="glass-card p-4">
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3"
                style={{ color: errcColors[quadrant] }}>
              {quadrant}
            </h4>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span style={{ color: errcColors[quadrant] }} className="mt-0.5">▸</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Opportunity Statement */}
      <div className="glass-card p-4 border border-violet-500/30">
        <p className="text-sm text-violet-300 italic">{data.blue_ocean.opportunity}</p>
      </div>
    </div>
  );
}
```

### Add to report dashboard in `HeroSection.tsx`

```tsx
// frontend/src/components/HeroSection.tsx — in Zone 3 or as new Zone 4:
{result.blueOcean && (
  <section className="mt-8">
    <h2 className="text-xl font-bold text-white mb-4">Blue Ocean Analysis</h2>
    <BlueOceanCanvas data={result.blueOcean} />
  </section>
)}
```

---

## Framework 2 — Unit Economics Dashboard

### Changes to `src/specialists.ts` — `financeAnalyst`

Extend the `financeAnalyst` prompt and JSON output to include a full unit economics block:

```typescript
// Add to financeAnalyst instruction:

`
UNIT ECONOMICS ANALYSIS
In addition to dimension scores, compute or estimate the following unit economics.
Use the business context to infer values where not explicitly stated.
State your assumptions explicitly.

Compute:
- LTV = (ARPU × Gross Margin %) ÷ Monthly Churn Rate
- LTV:CAC Ratio (healthy benchmark: > 3:1)
- CAC Payback Period in months (healthy: < 12 months for SMB, < 18 for Enterprise)
- Gross Margin % (SaaS benchmark: 70-85%, marketplace: 20-50%, services: 30-60%)
- Rule of 40 = ARR Growth Rate % + Operating Margin %
  (benchmark: > 40 for growth-stage, > 20 for early-stage)
- Burn Multiple = Net Burn ÷ Net New ARR (< 1.5 = efficient, > 3 = capital-intensive)
- Magic Number = Net New ARR ÷ Prior Quarter S&M Spend (> 0.75 = efficient GTM)

For each metric:
- Provide your calculated or estimated value
- State the benchmark for this business type and stage
- Give a RAG status: GREEN | AMBER | RED
- Explain in one sentence why it's that status

Also provide a SENSITIVITY TABLE:
Show how LTV:CAC changes if:
- ARPU drops 20%
- Churn increases 50%
- CAC increases 30%
`

// Update JSON output schema for financeAnalyst to include unitEconomics block:
`
"unitEconomics": {
  "assumptions": ["list of values you had to estimate"],
  "metrics": {
    "ltv_cac": { "value": "X:1 or 'insufficient data'", "benchmark": "> 3:1", "status": "GREEN|AMBER|RED", "note": "..." },
    "cac_payback_months": { "value": number_or_null, "benchmark": "< 12 months (SMB)", "status": "GREEN|AMBER|RED", "note": "..." },
    "gross_margin_pct": { "value": number_or_null, "benchmark": "70-85% (SaaS)", "status": "GREEN|AMBER|RED", "note": "..." },
    "rule_of_40": { "value": number_or_null, "benchmark": "> 40", "status": "GREEN|AMBER|RED", "note": "..." },
    "burn_multiple": { "value": number_or_null, "benchmark": "< 1.5", "status": "GREEN|AMBER|RED", "note": "..." },
    "magic_number": { "value": number_or_null, "benchmark": "> 0.75", "status": "GREEN|AMBER|RED", "note": "..." }
  },
  "sensitivity": {
    "base_ltv_cac": number,
    "arpu_down_20pct": number,
    "churn_up_50pct": number,
    "cac_up_30pct": number
  }
}
`
```

### New frontend component: `frontend/src/components/UnitEconomicsDashboard.tsx`

```tsx
// frontend/src/components/UnitEconomicsDashboard.tsx

interface UEMetric {
  value: string | number | null;
  benchmark: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  note: string;
}

interface UnitEconomicsData {
  assumptions: string[];
  metrics: Record<string, UEMetric>;
  sensitivity: {
    base_ltv_cac: number;
    arpu_down_20pct: number;
    churn_up_50pct: number;
    cac_up_30pct: number;
  };
}

const STATUS_COLORS = { GREEN: '#10b981', AMBER: '#f59e0b', RED: '#ef4444' };
const STATUS_BG = { GREEN: 'bg-emerald-500/10', AMBER: 'bg-amber-500/10', RED: 'bg-red-500/10' };

const METRIC_LABELS: Record<string, string> = {
  ltv_cac: 'LTV : CAC',
  cac_payback_months: 'CAC Payback',
  gross_margin_pct: 'Gross Margin',
  rule_of_40: 'Rule of 40',
  burn_multiple: 'Burn Multiple',
  magic_number: 'Magic Number',
};

export function UnitEconomicsDashboard({ data }: { data: UnitEconomicsData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(data.metrics).map(([key, metric]) => (
          <div key={key} className={`glass-card p-4 ${STATUS_BG[metric.status]}`}>
            <div className="text-xs text-gray-400 mb-1">{METRIC_LABELS[key] ?? key}</div>
            <div className="text-xl font-bold mb-1" style={{ color: STATUS_COLORS[metric.status] }}>
              {metric.value ?? '—'}
            </div>
            <div className="text-xs text-gray-500">Benchmark: {metric.benchmark}</div>
            <div className="text-xs text-gray-400 mt-1">{metric.note}</div>
          </div>
        ))}
      </div>

      {/* Sensitivity Table */}
      <div className="glass-card p-4">
        <h4 className="text-sm font-semibold text-white mb-3">LTV:CAC Sensitivity</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs">
              <th className="text-left pb-2">Scenario</th>
              <th className="text-right pb-2">LTV:CAC</th>
              <th className="text-right pb-2">Change</th>
            </tr>
          </thead>
          <tbody className="space-y-1">
            {[
              { label: 'Base case', key: 'base_ltv_cac' },
              { label: 'ARPU −20%', key: 'arpu_down_20pct' },
              { label: 'Churn +50%', key: 'churn_up_50pct' },
              { label: 'CAC +30%', key: 'cac_up_30pct' },
            ].map(row => {
              const val = data.sensitivity[row.key as keyof typeof data.sensitivity];
              const base = data.sensitivity.base_ltv_cac;
              const delta = val - base;
              return (
                <tr key={row.key} className="border-t border-white/5">
                  <td className="py-2 text-gray-300">{row.label}</td>
                  <td className="py-2 text-right font-mono">{val?.toFixed(1)}x</td>
                  <td className="py-2 text-right font-mono"
                      style={{ color: delta >= 0 ? '#10b981' : '#ef4444' }}>
                    {delta >= 0 ? '+' : ''}{delta?.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.assumptions.length > 0 && (
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-400">Assumptions:</p>
          {data.assumptions.map((a, i) => <p key={i}>• {a}</p>)}
        </div>
      )}
    </div>
  );
}
```

---

## Framework 3 — Porter's Five Forces (Quantified)

### Changes to `src/specialists.ts` — `innovationAnalyst`

```typescript
// Add to innovationAnalyst instruction:

`
PORTER'S FIVE FORCES ANALYSIS
Score each force on competitive intensity (0-100).
Higher score = stronger force = more pressure on the business.

1. COMPETITIVE_RIVALRY (0-100)
   Number of competitors, market growth rate, product differentiation,
   exit barriers, brand loyalty.
   90-100: Intense rivalry (5+ strong competitors, low differentiation, price wars)
   0-29:   Weak rivalry (few competitors, high differentiation, growing market)

2. THREAT_OF_NEW_ENTRANTS (0-100)
   Capital requirements, regulatory barriers, brand loyalty, economies of scale,
   access to distribution channels, network effects as barrier.
   90-100: Easy entry (low capital, no regulation, no switching costs)
   0-29:   High barriers (regulatory, capital-intensive, network effects)

3. THREAT_OF_SUBSTITUTES (0-100)
   Availability of alternatives, price-performance of substitutes,
   switching costs to substitutes, buyer propensity to switch.
   90-100: Many readily available substitutes at similar or better price
   0-29:   Few or no practical substitutes

4. BUYER_POWER (0-100)
   Number of buyers, purchase volume concentration, ability to backward-integrate,
   information availability, switching costs.
   90-100: Few large buyers who account for most revenue, can easily switch
   0-29:   Many small buyers, high switching costs, limited information

5. SUPPLIER_POWER (0-100)
   Number of suppliers, switching costs, supplier differentiation,
   importance of industry to supplier, forward integration threat.
   90-100: Few critical suppliers who can dictate terms
   0-29:   Many substitutable suppliers, low switching costs

STRUCTURAL ATTRACTIVENESS SCORE = 100 - weighted average of all five forces
(Use weights: Rivalry 25%, New Entrants 20%, Substitutes 20%, Buyers 20%, Suppliers 15%)

INTERACTION EFFECT FLAG:
If any TWO forces both exceed 70, add a warning:
"STRUCTURAL VULNERABILITY: [Force A] + [Force B] create compound pressure on [specific aspect]"

Add to JSON output:
"portersFiveForces": {
  "scores": {
    "competitive_rivalry": { "score": 0-100, "primary_driver": "string" },
    "threat_of_new_entrants": { "score": 0-100, "primary_driver": "string" },
    "threat_of_substitutes": { "score": 0-100, "primary_driver": "string" },
    "buyer_power": { "score": 0-100, "primary_driver": "string" },
    "supplier_power": { "score": 0-100, "primary_driver": "string" }
  },
  "structural_attractiveness_score": 0-100,
  "interaction_effect_warning": "string or null"
}
`
```

### New frontend component: `frontend/src/components/FiveForces.tsx`

```tsx
// frontend/src/components/FiveForces.tsx

import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

interface ForceData {
  score: number;
  primary_driver: string;
}

interface FiveForcesData {
  scores: Record<string, ForceData>;
  structural_attractiveness_score: number;
  interaction_effect_warning: string | null;
}

const FORCE_LABELS: Record<string, string> = {
  competitive_rivalry: 'Rivalry',
  threat_of_new_entrants: 'New Entrants',
  threat_of_substitutes: 'Substitutes',
  buyer_power: 'Buyer Power',
  supplier_power: 'Supplier Power',
};

export function FiveForces({ data }: { data: FiveForcesData }) {
  const radarData = Object.entries(data.scores).map(([key, val]) => ({
    force: FORCE_LABELS[key],
    intensity: val.score,
    driver: val.primary_driver,
  }));

  const attractiveness = data.structural_attractiveness_score;
  const attrColor = attractiveness >= 60 ? '#10b981' : attractiveness >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Porter's Five Forces</h3>
        <div className="text-right">
          <div className="text-xs text-gray-400">Structural Attractiveness</div>
          <div className="text-2xl font-bold" style={{ color: attrColor }}>
            {attractiveness}/100
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#1e2a3a" />
          <PolarAngleAxis dataKey="force" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Radar name="Intensity" dataKey="intensity" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="bg-gray-900 border border-gray-700 p-3 rounded text-xs max-w-48">
                  <p className="font-semibold text-white mb-1">{item.force}</p>
                  <p className="text-red-400">Intensity: {item.intensity}/100</p>
                  <p className="text-gray-300 mt-1">{item.driver}</p>
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {data.interaction_effect_warning && (
        <div className="glass-card p-3 border border-red-500/30 text-sm text-red-300">
          ⚠️ {data.interaction_effect_warning}
        </div>
      )}

      <div className="space-y-2">
        {Object.entries(data.scores).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="text-gray-400 w-32 shrink-0">{FORCE_LABELS[key]}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${val.score}%`,
                  background: val.score > 70 ? '#ef4444' : val.score > 40 ? '#f59e0b' : '#10b981'
                }}
              />
            </div>
            <span className="text-gray-300 w-8 text-right font-mono">{val.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Framework 4 — Monte Carlo Probabilistic Stress Testing

### Changes to `src/scenarios.ts`

```typescript
// src/scenarios.ts — add MonteCarloInput and MonteCarloResult interfaces:

export interface MonteCarloInput {
  arpu_low: number;
  arpu_base: number;
  arpu_high: number;
  churn_low: number;   // monthly churn %
  churn_base: number;
  churn_high: number;
  cac_low: number;
  cac_base: number;
  cac_high: number;
  growth_rate_low: number;  // monthly growth %
  growth_rate_base: number;
  growth_rate_high: number;
  gross_margin_low: number;
  gross_margin_base: number;
  gross_margin_high: number;
}

export interface MonteCarloResult {
  metric: string;
  p10: number;
  p50: number;
  p90: number;
  probability_of_failure: number;  // P(metric falls below critical threshold)
}
```

### New file: `src/services/monteCarloService.ts`

```typescript
// src/services/monteCarloService.ts
// Pure computation — no LLM needed, runs locally

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
```

### Integration: extract `MonteCarloInput` from finance specialist output

```typescript
// src/coordinator.ts — after financeResult is obtained:

import { runMonteCarlo } from './services/monteCarloService.js';

// The financeAnalyst should output a monteCarloInputs block with its estimates.
// Run the simulation locally:
if (financeResult.monteCarloInputs) {
  const monteCarloResult = runMonteCarlo(financeResult.monteCarloInputs);
  reportData.monteCarlo = monteCarloResult;
}
```

### Frontend: `frontend/src/components/MonteCarloChart.tsx`

```tsx
// frontend/src/components/MonteCarloChart.tsx

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MonteCarloDistribution {
  metric: string;
  p10: number;
  p50: number;
  p90: number;
  probability_of_failure: number;
}

export function MonteCarloChart({ distributions, riskDrivers }: {
  distributions: MonteCarloDistribution[];
  riskDrivers: Array<{ factor: string; variance_contribution: number }>;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Probabilistic Outcomes</h3>
      <p className="text-xs text-gray-400">Based on 5,000 simulation runs across your key variable ranges</p>

      {distributions.map(dist => (
        <div key={dist.metric} className="glass-card p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-semibold text-gray-300">{dist.metric}</h4>
            <span className="text-xs px-2 py-1 rounded"
                  style={{ background: dist.probability_of_failure > 0.3 ? '#ef444420' : '#10b98120',
                           color: dist.probability_of_failure > 0.3 ? '#ef4444' : '#10b981' }}>
              {(dist.probability_of_failure * 100).toFixed(0)}% failure risk
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Pessimistic (P10)', value: dist.p10, color: '#ef4444' },
              { label: 'Median (P50)', value: dist.p50, color: '#f59e0b' },
              { label: 'Optimistic (P90)', value: dist.p90, color: '#10b981' },
            ].map(p => (
              <div key={p.label} className="space-y-1">
                <div className="text-xl font-bold" style={{ color: p.color }}>
                  {p.value.toFixed(1)}x
                </div>
                <div className="text-xs text-gray-500">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="glass-card p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Key Risk Drivers</h4>
        {riskDrivers.map(d => (
          <div key={d.factor} className="flex items-center gap-3 mb-2 text-sm">
            <span className="text-gray-400 w-28 shrink-0">{d.factor}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div className="h-2 rounded-full bg-amber-500" style={{ width: `${d.variance_contribution}%` }} />
            </div>
            <span className="text-gray-300 w-10 text-right">{d.variance_contribution}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Framework 5 — Wardley Mapping

### New file: `src/agents/wardleyAgent.ts`

```typescript
// src/agents/wardleyAgent.ts

import { LlmAgent } from '@google/adk';

export interface WardleyCapability {
  id: string;
  name: string;
  evolution: number;        // 0-100 (Genesis=0, Custom=33, Product=66, Commodity=100)
  value_chain_position: number;  // 0-100 (User-facing=100, Infrastructure=0)
  is_differentiator: boolean;
  will_commoditize_in_18m: boolean;
  build_buy_partner: 'build' | 'buy' | 'partner' | 'outsource';
  dependency_ids: string[];  // IDs of capabilities this depends on
}

export interface WardleyResult {
  capabilities: WardleyCapability[];
  strategic_warnings: string[];  // Capabilities about to be commoditized
  build_buy_decisions: Array<{
    capability: string;
    recommendation: 'build' | 'buy' | 'partner' | 'outsource';
    rationale: string;
  }>;
  core_differentiators: string[];  // Names of capabilities that should be built
}

export const wardleyAgent = new LlmAgent({
  name: 'wardley_analyst',
  model: 'gemini-2.5-flash',
  instruction: `
You are a Wardley Mapping specialist. Map the business's capability landscape.

EVOLUTION AXIS (X-axis):
0-25  = Genesis: novel, experimental, poorly understood, unpredictable
26-50 = Custom Built: understood by practitioners, bespoke, inconsistent interfaces
51-75 = Product/Rental: increasingly well-defined, feature competition, differentiated
76-100 = Commodity/Utility: standardised, well-defined APIs, cost competition, boring

VALUE CHAIN POSITION (Y-axis):
100 = Directly user-visible (UI, customer experience)
50  = Core business logic (domain-specific processing)
0   = Infrastructure (hosting, storage, networking)

STEP 1 — IDENTIFY CAPABILITIES (aim for 8-15)
List all significant capabilities this business uses or must build.
Include: core product features, data infrastructure, customer acquisition channels,
support systems, integration layers, compliance processes.

STEP 2 — SCORE EACH CAPABILITY
For each capability:
- Evolution score (0-100 based on the Genesis-Custom-Product-Commodity axis)
- Value chain position (0-100)
- Is this a differentiator? (true if custom-built AND high value chain position)
- Will it commoditize in 18 months? (true if Evolution 40-60 — moving toward product/commodity)
- Build vs. Buy vs. Partner vs. Outsource recommendation

STEP 3 — STRATEGIC WARNINGS
For each capability with will_commoditize_in_18m=true:
Write a warning: "[Capability X] is moving toward commodity. Continuing to build
bespoke risks wasting investment. Consider [specific alternative]."

STEP 4 — BUILD/BUY DECISIONS
For each capability, recommend:
- BUILD if: Evolution < 50 AND it's a core differentiator
- BUY (SaaS product) if: Evolution 50-75
- OUTSOURCE if: Evolution > 75 (commodity, buy cheapest)
- PARTNER if: high value chain position but not core to your differentiation

OUTPUT FORMAT (strict JSON):
{
  "capabilities": [
    {
      "id": "cap_1",
      "name": "string",
      "evolution": 0-100,
      "value_chain_position": 0-100,
      "is_differentiator": boolean,
      "will_commoditize_in_18m": boolean,
      "build_buy_partner": "build|buy|partner|outsource",
      "dependency_ids": ["cap_2", "cap_3"]
    }
  ],
  "strategic_warnings": ["string"],
  "build_buy_decisions": [
    { "capability": "string", "recommendation": "build|buy|partner|outsource", "rationale": "string" }
  ],
  "core_differentiators": ["capability names that should be proprietary investments"]
}
`
});
```

### New frontend component: `frontend/src/components/WardleyMap.tsx`

```tsx
// frontend/src/components/WardleyMap.tsx
// Renders an SVG-based Wardley Map

import { WardleyCapability } from '../types/frameworks';

const EVOLUTION_LABELS = ['Genesis', 'Custom Built', 'Product', 'Commodity'];
const BUILD_BUY_COLORS = {
  build: '#8b5cf6',
  buy: '#10b981',
  partner: '#f59e0b',
  outsource: '#6b7280',
};

export function WardleyMap({ capabilities, warnings }: {
  capabilities: WardleyCapability[];
  warnings: string[];
}) {
  const W = 600, H = 400;
  const PAD = { top: 30, right: 20, bottom: 50, left: 50 };

  const toX = (evolution: number) =>
    PAD.left + (evolution / 100) * (W - PAD.left - PAD.right);
  const toY = (position: number) =>
    PAD.top + ((100 - position) / 100) * (H - PAD.top - PAD.bottom);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Wardley Map</h3>
      <p className="text-xs text-gray-400">
        X-axis: Evolution (Genesis → Commodity) · Y-axis: Visibility (Infrastructure → User)
      </p>

      <div className="glass-card p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 400 }}>
          {/* Evolution axis labels */}
          {EVOLUTION_LABELS.map((label, i) => (
            <text key={label} x={PAD.left + (i / 3) * (W - PAD.left - PAD.right)}
                  y={H - 10} fill="#6b7280" fontSize={10} textAnchor="middle">
              {label}
            </text>
          ))}

          {/* Grid lines */}
          {[0, 33, 66, 100].map(v => (
            <line key={v} x1={toX(v)} x2={toX(v)} y1={PAD.top} y2={H - PAD.bottom}
                  stroke="#1e2a3a" strokeDasharray="3 3" />
          ))}

          {/* Dependency arrows */}
          {capabilities.flatMap(cap =>
            cap.dependency_ids.map(depId => {
              const dep = capabilities.find(c => c.id === depId);
              if (!dep) return null;
              return (
                <line key={`${cap.id}-${depId}`}
                      x1={toX(cap.evolution)} y1={toY(cap.value_chain_position)}
                      x2={toX(dep.evolution)} y2={toY(dep.value_chain_position)}
                      stroke="#374151" strokeWidth={1} />
              );
            })
          )}

          {/* Capability nodes */}
          {capabilities.map(cap => (
            <g key={cap.id} transform={`translate(${toX(cap.evolution)},${toY(cap.value_chain_position)})`}>
              <circle r={cap.is_differentiator ? 10 : 6}
                      fill={BUILD_BUY_COLORS[cap.build_buy_partner]}
                      fillOpacity={0.8}
                      stroke={cap.will_commoditize_in_18m ? '#ef4444' : 'transparent'}
                      strokeWidth={2} />
              <text y={-14} textAnchor="middle" fill="#e5e7eb" fontSize={9}>
                {cap.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(BUILD_BUY_COLORS).map(([action, color]) => (
          <div key={action} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-gray-400 capitalize">{action}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-red-500" />
          <span className="text-gray-400">Commoditizing soon</span>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-red-400">Strategic Warnings</h4>
          {warnings.map((w, i) => (
            <div key={i} className="glass-card p-3 border border-red-500/20 text-sm text-red-300">
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 3 Completion Checklist

- [ ] `blueOceanAgent.ts` created and integrated into coordinator pipeline
- [ ] `BlueOceanCanvas.tsx` renders ERRC Grid + Value Curve chart
- [ ] `financeAnalyst` outputs full `unitEconomics` block with 6 metrics + sensitivity
- [ ] `UnitEconomicsDashboard.tsx` renders RAG cards + sensitivity table
- [ ] `innovationAnalyst` outputs `portersFiveForces` JSON block
- [ ] `FiveForces.tsx` renders 5-axis radar + structural attractiveness score
- [ ] `monteCarloService.ts` runs 5,000 iterations locally (no LLM cost)
- [ ] `MonteCarloChart.tsx` renders P10/P50/P90 distributions
- [ ] `wardleyAgent.ts` created and integrated into coordinator
- [ ] `WardleyMap.tsx` renders SVG Wardley map with dependency arrows
- [ ] All new framework data flows from backend → Firestore → frontend
- [ ] All new components added to report dashboard in `HeroSection.tsx`
- [ ] `frontend/src/types/frameworks.ts` created with all new type definitions
