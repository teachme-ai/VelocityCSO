# Stage & Sector Intake — Context-Aware Analysis

> **Goal:** Add a stage and sector selector to the audit intake form. Use these signals to weight specialist prompts, calibrate benchmark comparisons, and suppress irrelevant dimensions — making the analysis genuinely CSO-grade for both early-stage startups and established firms.
> **Depends on:** Phase 4 (benchmarks.json), LIVE_AUDIT_CRITIQUE (null dimensions)
> **Estimated AG effort:** ~2 hours

---

## Why This Matters

Without stage/sector context, every business gets identical specialist prompts and the same 20-dimension weights. A pre-seed founder scores 0/100 on Capital Efficiency and Customer Concentration Risk because those dimensions have no data yet — not because the business is bad. An established firm's Unit Economics are compared against startup benchmarks. Neither output is CSO-grade.

A single pair of inputs — **stage** and **sector** — unlocks:
1. Stage-aware dimension suppression (unscored → `null`, not `0`)
2. Sector-matched benchmark injection into specialist prompts
3. Prompt calibration per specialist ("focus on product-market fit" for pre-seed vs "focus on operational leverage" for growth-stage)
4. Accurate KPI strip: "55/100 · 16 of 20 dimensions applicable to pre-seed"

---

## Task 1 — Frontend: Stage & Sector Selector

### New fields in `HeroSection.tsx` state

```tsx
// Add to HeroSection useState block:
const [stage, setStage] = useState<string>('');
const [sector, setSector] = useState<string>('');
```

### UI — two dropdowns above the textarea

```tsx
// Add above the main context textarea in the audit input form:
<div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>
      Business Stage
    </label>
    <select
      value={stage}
      onChange={e => setStage(e.target.value)}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        color: stage ? '#fff' : '#6b7280',
        fontSize: 13,
      }}
    >
      <option value="">Stage (optional)</option>
      <option value="pre-seed">Pre-seed — idea / MVP</option>
      <option value="seed">Seed — early traction</option>
      <option value="series-a">Series A — product-market fit</option>
      <option value="growth">Growth — scaling</option>
      <option value="established">Established — mature business</option>
    </select>
  </div>

  <div style={{ flex: 1 }}>
    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>
      Sector
    </label>
    <select
      value={sector}
      onChange={e => setSector(e.target.value)}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        color: sector ? '#fff' : '#6b7280',
        fontSize: 13,
      }}
    >
      <option value="">Sector (optional)</option>
      <option value="saas">SaaS / Software</option>
      <option value="fintech">Fintech</option>
      <option value="healthtech">Healthtech</option>
      <option value="marketplace">Marketplace</option>
      <option value="ecommerce">E-commerce</option>
      <option value="edtech">Edtech</option>
      <option value="logistics">Logistics / Supply Chain</option>
      <option value="enterprise">Enterprise / B2B</option>
      <option value="other">Other</option>
    </select>
  </div>
</div>
```

### Pass stage + sector in the audit request body

```tsx
// In handleAudit() and handleClarify(), include in the POST body:
body: JSON.stringify({ context, sessionId, stage, sector })
```

---

## Task 2 — Backend: Receive and Inject into Context

### `src/index.ts` — destructure from request body

```typescript
// In both /analyze and /analyze/clarify handlers:
const { context, sessionId, stage, sector } = req.body as {
  context: string;
  sessionId: string;
  stage?: string;
  sector?: string;
};
```

### Build a `businessProfile` string injected at the top of the context

```typescript
// src/index.ts — before passing context to coordinator:
function buildBusinessProfile(stage?: string, sector?: string): string {
  if (!stage && !sector) return '';
  const parts: string[] = ['BUSINESS PROFILE (provided by user):'];
  if (stage) parts.push(`- Stage: ${stage}`);
  if (sector) parts.push(`- Sector: ${sector}`);
  parts.push('Use this to calibrate scoring expectations and benchmark comparisons.');
  return parts.join('\n');
}

const profile = buildBusinessProfile(stage, sector);
const enrichedContext = profile ? `${profile}\n\n${context}` : context;

// Pass enrichedContext (not context) to cso.analyze()
```

### Pass stage + sector to coordinator

```typescript
// coordinator.ts — update analyze() signature:
async analyze(
  businessContext: string,
  sessionId: string,
  stage?: string,
  sector?: string
): Promise<{ ... }>
```

---

## Task 3 — Coordinator: Stage-Aware Dimension Suppression

### Dimensions irrelevant by stage

```typescript
// src/coordinator.ts — add constant:
const STAGE_SUPPRESSED_DIMENSIONS: Record<string, string[]> = {
  'pre-seed': [
    'CAC/LTV Ratio',          // no customer data yet
    'Customer Concentration Risk', // no customers yet
    'Capital Efficiency',      // no revenue to measure against
    'ROI Projection',          // too early for credible ROI
  ],
  'seed': [
    'Customer Concentration Risk', // likely 1-2 customers, not meaningful
    'Capital Efficiency',      // still burning, not measurable
  ],
  'series-a': [],              // all 20 dimensions applicable
  'growth': [],
  'established': [],
};

// After finalDimensions is built, null-out suppressed dimensions:
if (stage && STAGE_SUPPRESSED_DIMENSIONS[stage]) {
  for (const dim of STAGE_SUPPRESSED_DIMENSIONS[stage]) {
    finalDimensions[dim] = null;
  }
}
```

---

## Task 4 — Coordinator: Stage-Calibrated Specialist Prompts

### Build a calibration prefix per stage

```typescript
// src/coordinator.ts — add helper:
function buildStageCalibration(stage?: string, sector?: string): string {
  if (!stage) return '';

  const calibrations: Record<string, string> = {
    'pre-seed': `
STAGE CALIBRATION — PRE-SEED:
This business has no revenue or customers yet. Score market opportunity and team strength heavily.
Do NOT penalise missing financial metrics — mark them as N/A.
Focus on: TAM Viability, Target Precision, Trend Adoption, Team/Founder Strength, Competitive Defensibility.
    `.trim(),

    'seed': `
STAGE CALIBRATION — SEED:
This business has early traction but limited financial data. Score product-market fit signals heavily.
Financial dimensions with no data should be scored conservatively (30-45), not zero.
Focus on: Flywheel Potential, Network Effects, Pricing Power, Market Entry Speed.
    `.trim(),

    'series-a': `
STAGE CALIBRATION — SERIES A:
This business has product-market fit and is scaling. All 20 dimensions are applicable.
Benchmark unit economics against Series A norms. Penalise weak retention and high CAC payback.
    `.trim(),

    'growth': `
STAGE CALIBRATION — GROWTH STAGE:
This business is scaling aggressively. Operational efficiency and capital efficiency are critical.
Weight: Scalability, Execution Speed, CAC/LTV, Capital Efficiency, Customer Concentration Risk.
    `.trim(),

    'established': `
STAGE CALIBRATION — ESTABLISHED FIRM:
This is a mature business. Innovation and strategic renewal are as important as operational health.
Weight: Competitive Defensibility, Model Innovation, ESG Posture, Regulatory Readiness.
Benchmark against industry P50 for established players, not startups.
    `.trim(),
  };

  const sectorNote = sector
    ? `\nSECTOR: ${sector.toUpperCase()} — apply ${sector} industry benchmarks where applicable.`
    : '';

  return (calibrations[stage] || '') + sectorNote;
}
```

### Inject calibration into each specialist's context

```typescript
// src/coordinator.ts — in runSpecialist(), prepend calibration:
const calibration = buildStageCalibration(stage, sector);
const specialistContext = calibration
  ? `${calibration}\n\n${businessContext}`
  : businessContext;

// Pass specialistContext to the specialist runner instead of businessContext
```

---

## Task 5 — Coordinator: Benchmark Injection from benchmarkService

```typescript
// src/coordinator.ts — in Phase C (finance analyst) context:
import { getBenchmarkForSector } from './services/benchmarkService.js';

const sectorBenchmarks = sector
  ? await getBenchmarkForSector(sector)
  : null;

const benchmarkContext = sectorBenchmarks ? `
SECTOR BENCHMARKS (${sector}):
- CAC Payback P50: ${sectorBenchmarks.avg_cac_payback_months} months
- LTV:CAC P50: ${sectorBenchmarks.avg_ltv_cac}:1
- Annual Churn P50: ${(sectorBenchmarks.avg_churn_rate * 100).toFixed(0)}%
- Top-quartile growth: ${(sectorBenchmarks.growth_benchmark_top_quartile * 100).toFixed(0)}% YoY
- Market multiple range: ${sectorBenchmarks.market_multiple_range[0]}x–${sectorBenchmarks.market_multiple_range[1]}x
Use these to calibrate unit economics scores and ROI projections.
` : '';

const phaseCContext = `${businessContext}\n\nPHASE A+B SUMMARY:\n${summarizedPhaseB}\n\n${benchmarkContext}`;
```

---

## Task 6 — Frontend: Surface Stage/Sector in Report

### KPI Row — show stage badge

```tsx
// In KpiRow.tsx, add a stage/sector badge if available:
{result.stage && (
  <span style={{
    fontSize: 10,
    background: 'rgba(168,85,247,0.15)',
    border: '1px solid rgba(168,85,247,0.3)',
    color: '#a855f7',
    borderRadius: 4,
    padding: '2px 6px',
    textTransform: 'capitalize',
  }}>
    {result.stage} · {result.sector || 'General'}
  </span>
)}
```

### DiagnosticScorecard — show "N/A" for suppressed dimensions

```tsx
// Already handled by null dimension rendering from LIVE_AUDIT_CRITIQUE.
// Add a tooltip: "Not applicable at {stage} stage"
```

### Score subtitle

```tsx
// In KpiRow, update the score subtitle:
const applicable = Object.values(dimensions).filter(v => v !== null).length;
const subtitle = stage
  ? `${applicable} of 20 dimensions scored · ${stage} stage`
  : `${applicable} of 20 dimensions scored`;
```

---

## Completion Checklist

- [ ] Frontend: stage + sector dropdowns render above the textarea
- [ ] Frontend: stage + sector sent in POST body to `/analyze`
- [ ] Backend: `buildBusinessProfile()` prepends profile to context
- [ ] Backend: stage + sector passed through to `coordinator.analyze()`
- [ ] Coordinator: `buildStageCalibration()` injected into all specialist prompts
- [ ] Coordinator: `STAGE_SUPPRESSED_DIMENSIONS` null-out inapplicable dimensions
- [ ] Coordinator: `getBenchmarkForSector()` injected into Phase C context
- [ ] Frontend: KPI row shows stage + sector badge
- [ ] Frontend: scorecard subtitle shows "N applicable of 20 dimensions"
- [ ] System works correctly when stage/sector are both empty (optional fields)

---

## AG Context Block

```
TASK: Add stage/sector intake selectors to VelocityCSO for context-aware analysis.

Files to read first:
- frontend/src/components/HeroSection.tsx (audit input form)
- src/coordinator.ts (analyze() method + runSpecialist())
- src/index.ts (/analyze handler)
- src/services/benchmarkService.ts (getBenchmarkForSector)

Implement in order:
1. [HeroSection.tsx] Add stage + sector <select> dropdowns above textarea. Add useState. Pass in POST body.
2. [index.ts] Destructure stage/sector from req.body. Build businessProfile string. Prepend to context.
3. [coordinator.ts] Update analyze() signature to accept stage/sector. Add buildStageCalibration(). Inject into runSpecialist() context. Add STAGE_SUPPRESSED_DIMENSIONS. Null-out suppressed dims after pipeline. Wire getBenchmarkForSector() into Phase C.
4. [HeroSection / KpiRow] Show stage badge and "N of 20 applicable" subtitle.

stage values: 'pre-seed' | 'seed' | 'series-a' | 'growth' | 'established'
sector values: 'saas' | 'fintech' | 'healthtech' | 'marketplace' | 'ecommerce' | 'edtech' | 'logistics' | 'enterprise' | 'other'
Both are optional — system must work correctly when neither is provided.
```
