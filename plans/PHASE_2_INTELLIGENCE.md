# Phase 2: Intelligence Upgrades

> **Goal:** Make the AI pipeline produce materially better, more coherent, more calibrated output.  
> **Depends on:** Phase 1 complete (especially Task 1.2 Critic Agent and Task 1.3 Rubrics).

---

## Task 2.1 — Expand from 15 to 20 Dimensions

### What to change
**Files:** `src/specialists.ts`, `src/coordinator.ts`, `frontend/src/components/DiagnosticScorecard.tsx`, `frontend/src/components/StrategyRadar.tsx`

### Step-by-step

**Step 1:** Define the 5 new dimensions and assign them to specialists in `src/specialists.ts`.

```typescript
// src/specialists.ts

// marketAnalyst — add TEAM_FOUNDER_STRENGTH to its 3 existing dimensions:
// New instruction addition for marketAnalyst:
`
TEAM_FOUNDER_STRENGTH (0-100):
  Evaluate the leadership team based on signals in the business context:
  - Domain expertise depth (years in this specific industry)
  - Prior founder / operator experience
  - Evidence of team completeness (technical + commercial + domain)
  - Advisory or investor signals (credible backers = validation)
  - Named key hires that de-risk execution

  90-100: Serial founder with domain expertise + complete team + tier-1 backers
  70-89:  Strong founder background, mostly complete team, some credibility signals
  50-69:  Partial team, founder is strong in one dimension but gaps exist
  30-49:  Solo founder, no team signals, or team clearly mismatched to challenge
  0-29:   No team information, or clear team-market mismatch
`

// innovationAnalyst — add NETWORK_EFFECTS_STRENGTH and DATA_ASSET_QUALITY:
`
NETWORK_EFFECTS_STRENGTH (0-100):
  Classify the type of network effect if present:
  - Direct (same-side): users benefit from more users of same type (messaging, social)
  - Indirect (cross-side): users benefit from more users of opposite type (marketplace)
  - Data: product improves as data accumulates (AI/ML features)
  - Tech Performance: infrastructure improves as usage grows (CDN, caching)

  90-100: Strong network effect with evidence of critical mass crossed; each new user
          measurably improves experience for existing users
  70-89:  Network effect present and accumulating; not yet at critical mass
  50-69:  Early-stage or weak network effect; product works without the network
  30-49:  Network effect claimed but not evident in business model
  0-29:   No network effect present or applicable

DATA_ASSET_QUALITY (0-100):
  Evaluate the proprietary data moat:
  - Uniqueness: can this data be obtained elsewhere?
  - Accumulation: does data compound over time with usage?
  - Monetization: is the data directly improving the product or generating revenue?

  90-100: Unique, proprietary, compounding dataset with clear competitive advantage
  70-89:  Valuable proprietary data, some uniqueness, accumulating
  50-69:  Some proprietary data, partially differentiated
  30-49:  Generic data, easily replicated, minimal moat value
  0-29:   No proprietary data or data strategy
`

// operationsAnalyst — add REGULATORY_COMPLIANCE_READINESS:
`
REGULATORY_COMPLIANCE_READINESS (0-100):
  Assess compliance posture relative to the business's industry:
  - Fintech: PCI-DSS, FCA/SEC/MAS licensing, AML/KYC, GDPR
  - Healthtech: HIPAA, FDA clearance, CE marking, clinical validation
  - Edtech: COPPA, FERPA, accessibility standards
  - General: GDPR, CCPA, SOC 2, ISO 27001

  90-100: Fully compliant, certified, proactive regulatory engagement
  70-89:  Compliant with key regulations, certification in progress
  50-69:  Partially compliant, known gaps being addressed
  30-49:  Compliance gaps that could materially impact operations
  0-29:   Significant regulatory exposure with no clear mitigation plan
`

// financeAnalyst — add CUSTOMER_CONCENTRATION_RISK:
`
CUSTOMER_CONCENTRATION_RISK (0-100):
  Note: Higher score = LOWER risk (better diversification)
  
  90-100: Top customer < 5% of revenue; 100+ customers; minimal single-customer dependency
  70-89:  Top customer < 15% of revenue; healthy spread across 20+ customers
  50-69:  Top customer 15-30% of revenue; some concentration but manageable
  30-49:  Top customer 30-50% of revenue; losing them would be material
  0-29:   Top customer(s) > 50% of revenue; existential concentration risk
`
```

**Step 2:** Update the JSON output schema for affected specialists to include the new dimensions.

```typescript
// Each specialist's jsonInstruction section should list the dimensions it scores.
// marketAnalyst now scores: TAM_VIABILITY, TARGET_PRECISION, TREND_ADOPTION, TEAM_FOUNDER_STRENGTH
// innovationAnalyst now scores: COMPETITIVE_DEFENSIBILITY, MODEL_INNOVATION, FLYWHEEL_POTENTIAL, NETWORK_EFFECTS_STRENGTH, DATA_ASSET_QUALITY
// operationsAnalyst now scores: EXECUTION_SPEED, SCALABILITY, ESG_POSTURE, REGULATORY_COMPLIANCE_READINESS
// financeAnalyst now scores: ROI_PROJECTION, RISK_TOLERANCE, CAPITAL_EFFICIENCY, CUSTOMER_CONCENTRATION_RISK
```

**Step 3:** Update `CATEGORIES` in `frontend/src/components/DiagnosticScorecard.tsx`.

```typescript
// frontend/src/components/DiagnosticScorecard.tsx

const CATEGORIES = {
  'Market Intelligence': [
    'TAM Viability',
    'Target Precision',
    'Trend Adoption',
    'Team / Founder Strength',    // NEW
  ],
  'Strategic Position': [
    'Competitive Defensibility',
    'Model Innovation',
    'Flywheel Potential',
    'Network Effects Strength',   // NEW
    'Data Asset Quality',         // NEW
  ],
  'Commercial Engine': [
    'Pricing Power',
    'CAC / LTV Ratio',
    'Market Entry Speed',
  ],
  'Operational Health': [
    'Execution Speed',
    'Scalability',
    'ESG Posture',
    'Regulatory Readiness',       // NEW
  ],
  'Financial Structure': [
    'ROI Projection',
    'Risk Tolerance',
    'Capital Efficiency',
    'Customer Concentration Risk', // NEW
  ],
};
```

**Step 4:** Update `StrategyRadar.tsx` to handle 20 dimensions.

```typescript
// frontend/src/components/StrategyRadar.tsx
// The radar chart should still show the 15 CORE dimensions for visual clarity.
// The 5 new dimensions appear in the DiagnosticScorecard only (not the radar).
// OR: show 20 with abbreviated labels — designer decision.

// Update the dimension label array to include new dimensions with abbreviated names:
const RADAR_DIMENSIONS = [
  'TAM', 'Target', 'Trend', 'Team',
  'Defensibility', 'Innovation', 'Flywheel', 'Network', 'Data',
  'Pricing', 'CAC/LTV', 'Entry Speed',
  'Execution', 'Scale', 'ESG', 'Compliance',
  'ROI', 'Risk', 'Capital', 'Concentration'
];
```

**Step 5:** Update `coordinator.ts` `robustParse()` fallback defaults to include the 5 new dimension keys.

```typescript
// src/coordinator.ts — update the default dimensions object in robustParse fallback
const DEFAULT_DIMENSIONS = {
  // Existing 15...
  team_founder_strength: 50,
  network_effects_strength: 50,
  data_asset_quality: 50,
  regulatory_compliance_readiness: 50,
  customer_concentration_risk: 50,
};
```

### Acceptance criteria
- [ ] 5 new dimensions defined with rubrics in specialist prompts
- [ ] `DiagnosticScorecard.tsx` displays all 20 dimensions in 5 categories
- [ ] `StrategyRadar.tsx` updated to include new dimensions
- [ ] `coordinator.ts` fallback defaults cover all 20 dimensions
- [ ] PDF scorecard updated to show all 20 dimensions

---

## Task 2.2 — Staged Specialist Pipeline

### What to change
**File:** `src/coordinator.ts`

### Current behaviour
All 5 specialists run in parallel from the same raw context. No specialist knows what another found.

### Target behaviour
```
Phase A: marketAnalyst + innovationAnalyst (parallel) → produce competitive landscape
Phase B: commercialAnalyst + operationsAnalyst (parallel) → consume Phase A findings
Phase C: financeAnalyst → consumes Phase A + B findings
Phase D: Critic reviews all 5 → flags and re-runs if needed
Phase E: CSO synthesizes
```

### Step-by-step

**Step 1:** Extract the single-specialist runner into a private method.

```typescript
// src/coordinator.ts — add this private method

private async runSpecialist(
  specialist: LlmAgent,
  context: string,
  sessionId: string
): Promise<SpecialistResult> {
  const runner = new InMemoryRunner({ agent: specialist, appName: specialist.name });
  const session = await runner.sessionService.createSession({
    appName: specialist.name,
    userId: sessionId
  });

  let raw = '';
  for await (const event of runner.runAsync({
    userId: sessionId,
    sessionId: session.id,
    newMessage: { role: 'user', parts: [{ text: context }] }
  })) {
    if (isFinalResponse(event)) raw += event.content?.parts?.[0]?.text ?? '';
  }

  return this.robustParse<SpecialistResult>(specialist.name, raw, DEFAULT_SPECIALIST_RESULT);
}
```

**Step 2:** Replace the monolithic `Promise.all` with the staged pipeline in `analyze()`.

```typescript
// src/coordinator.ts — inside analyze()

// ── PHASE A: Market + Innovation (independent, run parallel) ──────────────────
emitHeartbeat(sessionId, 'Phase A: Market & Innovation analysis...', 'standard');
const [marketResult, innovationResult] = await Promise.all([
  this.runSpecialist(marketAnalyst, businessContext, sessionId),
  this.runSpecialist(innovationAnalyst, businessContext, sessionId),
]);

// Compose Phase A findings summary to inject into Phase B
const phaseAFindings = `
PHASE A FINDINGS (use these to calibrate your analysis):

MARKET INTELLIGENCE:
${marketResult.analysis_markdown}
Key scores: ${JSON.stringify(marketResult.dimensions)}

INNOVATION & COMPETITIVE LANDSCAPE:
${innovationResult.analysis_markdown}
Key scores: ${JSON.stringify(innovationResult.dimensions)}
`;

// ── PHASE B: Commercial + Operations (consume Phase A) ───────────────────────
emitHeartbeat(sessionId, 'Phase B: Commercial & Operations analysis...', 'standard');
const phaseAContext = `${businessContext}\n\n${phaseAFindings}`;

const [commercialResult, operationsResult] = await Promise.all([
  this.runSpecialist(commercialAnalyst, phaseAContext, sessionId),
  this.runSpecialist(operationsAnalyst, phaseAContext, sessionId),
]);

// Compose Phase A + B findings for Phase C
const phaseBFindings = `
${phaseAFindings}

COMMERCIAL ENGINE:
${commercialResult.analysis_markdown}
Key scores: ${JSON.stringify(commercialResult.dimensions)}

OPERATIONAL HEALTH:
${operationsResult.analysis_markdown}
Key scores: ${JSON.stringify(operationsResult.dimensions)}
`;

// ── PHASE C: Finance (consumes Phase A + B) ───────────────────────────────────
emitHeartbeat(sessionId, 'Phase C: Financial structure analysis...', 'standard');
const fullContext = `${businessContext}\n\n${phaseBFindings}`;
const financeResult = await this.runSpecialist(financeAnalyst, fullContext, sessionId);

// Collect all specialist outputs
const specialistOutputs = {
  market_analyst: marketResult,
  innovation_analyst: innovationResult,
  commercial_analyst: commercialResult,
  operations_analyst: operationsResult,
  finance_analyst: financeResult,
};

// ── PHASE D: Critic review ────────────────────────────────────────────────────
// (Already implemented in Task 1.2)
const criticResult = await this.runCritic(specialistOutputs, sessionId);
// ... re-run flagged specialists ...

// ── PHASE E: CSO synthesis ────────────────────────────────────────────────────
// ... existing synthesis logic ...
```

### Acceptance criteria
- [ ] Phase A specialists cannot see Phase B/C specialist outputs
- [ ] Phase B context includes Phase A findings verbatim
- [ ] Phase C context includes Phase A + B findings verbatim
- [ ] Heartbeat messages reflect each phase transition
- [ ] Total analysis time measured and logged

---

## Task 2.3 — Chain-of-Thought Scaffolding in All Specialist Prompts

### What to change
**File:** `src/specialists.ts`

### Step-by-step

**Step 1:** Create a shared chain-of-thought preamble constant.

```typescript
// src/specialists.ts — add before specialist definitions

const COT_SCAFFOLD = `
REASONING PROTOCOL — follow these steps in order for every analysis:

STEP 1 — EVIDENCE EXTRACTION
  List every quantitative signal present in the business context:
  - Revenue figures, ARR, MRR, growth rates
  - Customer count, headcount, funding amount
  - Named competitors, market size references
  - Geographic presence, channels mentioned
  If a signal is absent, explicitly note it as MISSING.

STEP 2 — GAP IDENTIFICATION
  Identify the 2-3 pieces of information that, if known, would change
  your dimension scores by >10 points. Name them explicitly.

STEP 3 — PRE-SCORE JUSTIFICATION
  For each dimension you are scoring, write exactly ONE sentence of
  justification BEFORE you assign the number. The justification must
  reference specific evidence from Step 1.

STEP 4 — SCORE ASSIGNMENT
  Apply the scoring rubrics. Assign each dimension score.

STEP 5 — ADVERSARIAL CHECK
  Identify the single assumption underlying your highest-confidence score
  (above 75). State explicitly: "If [assumption] is wrong, this score
  would drop to [lower range]."

STEP 6 — ASYMMETRIC RECOMMENDATION
  For each dimension scoring below 50, name ONE specific action that
  would move it above 60 within 90 days. Be specific — no generic advice.
`;
```

**Step 2:** Inject `COT_SCAFFOLD` into each specialist's instruction, before the JSON output format.

```typescript
// Pattern for every specialist:
export const marketAnalyst = new LlmAgent({
  name: 'market_analyst',
  model: 'gemini-2.5-flash',
  instruction: `
You are the Market Intelligence Specialist. Your role is to evaluate
the market opportunity, customer targeting precision, and macro trend alignment.

${COT_SCAFFOLD}

${SCORING_RUBRICS}

${jsonInstruction}
${asymmetricPlayRule}
`
});
```

**Step 3:** Update the JSON output schema to include `justifications` per dimension.

```typescript
// src/specialists.ts — update jsonInstruction to require justifications:

const jsonInstruction = `
OUTPUT FORMAT (strict JSON, no markdown wrapper):
{
  "analysis_markdown": "Full analysis narrative following the 6-step reasoning protocol",
  "confidence_score": 0.0-1.0,
  "data_sources": ["evidence or signal used, with specificity"],
  "missing_signals": ["signals that would improve confidence if known"],
  "dimensions": {
    "dimension_name": {
      "score": 0-100,
      "justification": "one sentence referencing specific evidence",
      "key_assumption": "the assumption this score depends on",
      "improvement_action": "specific 90-day action if score < 50, else null"
    }
  }
}
`;
```

**Step 4:** Update `SpecialistResult` interface in `coordinator.ts` and `memory.ts` to match new schema.

```typescript
// src/coordinator.ts — update interface:
interface SpecialistResult {
  analysis_markdown: string;
  confidence_score: number;
  data_sources: string[];
  missing_signals: string[];
  dimensions: Record<string, {
    score: number;
    justification: string;
    key_assumption: string;
    improvement_action: string | null;
  }>;
}
```

**Step 5:** Update `robustParse()` to handle both old format (flat score) and new format (object with score).

```typescript
// src/coordinator.ts — in robustParse(), add dimension normalisation:

function normaliseDimensions(raw: any): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.dimensions ?? {})) {
    if (typeof value === 'number') {
      result[key] = value; // old flat format
    } else if (typeof value === 'object' && value !== null) {
      result[key] = (value as any).score ?? 50; // new object format
    }
  }
  return result;
}
```

### Acceptance criteria
- [ ] All 5 specialist prompts include the 6-step COT scaffold
- [ ] JSON output includes `justification` and `key_assumption` per dimension
- [ ] `missing_signals` array is populated in specialist output
- [ ] `improvement_action` is populated for dimensions scoring < 50
- [ ] `robustParse()` handles both old and new dimension formats

---

## Task 2.4 — Fix `idBreakdown` in the Interrogator

### What to change
**File:** `src/agents/interrogator.ts`

### Current problem
`idBreakdown` always returns `{ specificity: idScore, completeness: idScore, moat: idScore }` — three identical values. No granularity.

### Step-by-step

**Step 1:** Separate the scoring into three independent sub-scores in `scoreContextDeterministically()`.

```typescript
// src/agents/interrogator.ts — replace scoreContextDeterministically():

export function scoreContextDeterministically(context: string): {
  total: number;
  specificity: number;
  completeness: number;
  moat: number;
} {
  const lower = context.toLowerCase();

  // SPECIFICITY — geographic precision and named entities (max 35 points)
  let specificity = 0;
  if (LOCATION_KEYWORDS.test(lower)) specificity += 20;
  if (/\d+\s*(customers?|clients?|users?|revenue|arr|mrr)/i.test(context)) specificity += 10;
  if (/[A-Z][a-z]+ (Inc|Ltd|LLC|Corp|GmbH|SAS|BV)/.test(context)) specificity += 5;

  // COMPLETENESS — business model and commercial signals (max 35 points)
  let completeness = 0;
  if (/price|pricing|subscription|revenue|monetiz/i.test(context)) completeness += 15;
  if (/team|founder|employ|headcount|staff/i.test(context)) completeness += 10;
  if (/product|service|platform|software|hardware/i.test(context)) completeness += 10;

  // MOAT — competitive and defensibility signals (max 30 points)
  let moat = 0;
  if (COMPETITOR_KEYWORDS.test(lower)) moat += 15;
  if (MOAT_KEYWORDS.test(lower)) moat += 15;

  const total = Math.min(100, specificity + completeness + moat);

  return {
    total,
    specificity: Math.min(100, Math.round((specificity / 35) * 100)),
    completeness: Math.min(100, Math.round((completeness / 35) * 100)),
    moat: Math.min(100, Math.round((moat / 30) * 100)),
  };
}
```

**Step 2:** Update `InterrogatorResult` interface.

```typescript
// src/agents/interrogator.ts — update interface:
export interface InterrogatorResult {
  isAuditable: boolean;
  idScore: number;
  idBreakdown: {
    specificity: number;    // 0-100: geographic + named entity precision
    completeness: number;   // 0-100: business model + commercial completeness
    moat: number;           // 0-100: competitive + defensibility context
  };
  question?: string;
  lensUsed?: string;
  reasoning?: string;
}
```

**Step 3:** Update the frontend `HeroSection.tsx` to show granular breakdown in the clarification dialog.

```tsx
// frontend/src/components/HeroSection.tsx — in the clarification dialog section:
// Replace the single "ID Score" display with three progress bars:

{clarification?.idBreakdown && (
  <div className="space-y-2">
    <LensBar label="Specificity" value={clarification.idBreakdown.specificity} />
    <LensBar label="Business Completeness" value={clarification.idBreakdown.completeness} />
    <LensBar label="Competitive Context" value={clarification.idBreakdown.moat} />
  </div>
)}
```

### Acceptance criteria
- [ ] `specificity`, `completeness`, and `moat` are independently scored
- [ ] The three sub-scores use different signals (not the same `idScore` repeated)
- [ ] Frontend clarification dialog shows all three bars with different values
- [ ] Sum of weighted sub-scores produces the same `idScore` as before (no regression)

---

## Phase 2 Completion Checklist

- [ ] Task 2.1: 20 dimensions defined with rubrics, scorecard updated
- [ ] Task 2.2: Staged pipeline (Phase A → B → C → D → E) implemented
- [ ] Task 2.3: Chain-of-thought scaffold in all 5 specialist prompts
- [ ] Task 2.4: `idBreakdown` produces 3 independent sub-scores
- [ ] Full audit pipeline tested end-to-end with real business description
- [ ] Report now contains `justifications` and `improvement_actions` per dimension
- [ ] `npm run build` passes (backend and frontend)
