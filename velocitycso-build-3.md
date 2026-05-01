# VelocityCSO — Build 3.0
## Simulation Intelligence Layer + PDF Redesign

**Version:** 3.0
**Date:** 1 May 2026
**Target agent:** Claude 4.6 (Amazon Q / VS Code)
**Prerequisite:** Builds 1.0 and 2.0 fully deployed and verified
**Repo:** https://github.com/teachme-ai/VelocityCSO.git
**Runtime:** Node 20, TypeScript ES2022/NodeNext, Express, Firestore, PDFKit, Python sidecar (port 8001)

---

## Build 3.0 Goals

**Goal 1 — Simulation Intelligence Layer**
Add three compute-based simulations that extend the existing Monte Carlo service.
No new infrastructure. No new LLM calls for computation. Python sidecar already handles charting.
Each simulation uses math + the existing dimension scores and financial signals as inputs.
The LLM's role is interpretation only — receiving computed numbers and framing them as strategic insight.

**Goal 2 — PDF Redesign**
The current PDF is structurally sound but visually dense and difficult to navigate.
Specific problems identified from the n8n audit (VelocityCSO-Audit-nWOFyFAh.pdf):
- Page 1: Company name shows "The Venture" not the actual org name (regression from Fix I)
- Page 3: Diagnostic matrix is dimension names + numbers only — no visual score bars, no category grouping with whitespace
- Page 6: Dimension scores repeated verbatim from Page 3 — redundant and wastes a page
- Page 8: "Blue Ocean Strategy Canvas: Strategy canvas chart unavailable." — chart render failure showing user-facing error text
- Page 9: Wardley map renders but labels are truncated mid-word
- Page 10: Monte Carlo still shows "3800%" — Fix H from atomic commit appears not deployed in this build
- Pages 11-25: Stress tests are wall-to-wall text with no visual hierarchy — impossible to scan
- Page 26: Empty page — Sources Appendix renders as blank
- Throughout: "CONFIDENTIAL STRATEGY AUDIT / THE VENTURE" header on every page wastes ~40px vertical space per page
- Throughout: "%¼" and "!\"" unicode glyph artefacts persist in stress test tables
- Missing: Strategic Choice section absent from PDF (exists in web report only)
- Missing: Porter's Five Forces, Ansoff, VRIO full analysis absent from PDF body (only in TOC)

**Goal 3 — Pending verification runs**
S3 Halcyon and S4 Anthropic have not yet been run.
These must be run and assessed after Build 3.0 ships.

---

# PART 1 — SIMULATION INTELLIGENCE LAYER

## Overview of the three simulations

All three extend `src/services/monteCarloService.ts` and the Python sidecar (`main.py`).
All three are called after the finance_analyst completes in Phase C.
All three receive inputs from `memory.financialSignals` (extracted by the finance specialist).
The LLM interprets computed results — it does not generate them.

---

## SIM 3.1 — Runway Simulation

**What it is:** Month-by-month cash balance simulation over 36 months.
Produces P10/P50/P90 runway (months to zero cash) and probability of reaching key milestones.

**Why it matters:** Every VC-backed founder and board member asks "how much runway do we have?" 
The Monte Carlo service already has the triangular distribution infrastructure. This is an extension.

**Files to modify:**
- `src/services/monteCarloService.ts` — add `runRunwaySimulation()` function
- `src/types.ts` — add `RunwayResult` interface to `AuditMemory`
- `src/coordinator.ts` — call after finance_analyst completes, store in memory
- `main.py` (Python sidecar) — add runway chart renderer
- `src/services/pdfService.ts` — render runway chart + P10/P50/P90 table

**Implementation:**

```typescript
// src/services/monteCarloService.ts

export interface RunwayInput {
    current_arr_monthly: number;      // monthly ARR / 12
    monthly_burn: number;             // total monthly spend
    current_cash: number;             // cash in bank
    // Distributions as (low, base, high) tuples
    growth_rate_dist: [number, number, number];   // monthly MRR growth rate
    churn_rate_dist: [number, number, number];    // monthly churn rate
    burn_reduction_possible: number;  // % burn reducible in crisis (0.0–0.5)
}

export interface RunwayResult {
    p10_months: number;       // pessimistic runway
    p50_months: number;       // base case runway
    p90_months: number;       // optimistic runway
    probability_18m: number;  // P(runway > 18 months)
    probability_24m: number;  // P(runway > 24 months)
    probability_36m: number;  // P(runway > 36 months)
    zero_cash_distribution: number[];  // histogram data for chart
    monthly_trajectories: {           // 3 sample paths for chart
        p10: number[];
        p50: number[];
        p90: number[];
    };
}

export function runRunwaySimulation(
    input: RunwayInput,
    iterations: number = 10000
): RunwayResult {
    const runwayMonths: number[] = [];
    const p10Path: number[] = new Array(37).fill(0);
    const p50Path: number[] = new Array(37).fill(0);
    const p90Path: number[] = new Array(37).fill(0);

    for (let i = 0; i < iterations; i++) {
        let balance = input.current_cash;
        let monthlyRevenue = input.current_arr_monthly;
        const g = triangular(...input.growth_rate_dist);
        const c = triangular(...input.churn_rate_dist);
        let month = 0;

        while (balance > 0 && month < 36) {
            const newRevenue = monthlyRevenue * g;
            const churnLoss = monthlyRevenue * c;
            monthlyRevenue = Math.max(0, monthlyRevenue + newRevenue - churnLoss);
            balance = balance - input.monthly_burn + monthlyRevenue;
            month++;
        }
        runwayMonths.push(month);
    }

    runwayMonths.sort((a, b) => a - b);
    return {
        p10_months: runwayMonths[Math.floor(iterations * 0.1)],
        p50_months: runwayMonths[Math.floor(iterations * 0.5)],
        p90_months: runwayMonths[Math.floor(iterations * 0.9)],
        probability_18m: runwayMonths.filter(r => r >= 18).length / iterations,
        probability_24m: runwayMonths.filter(r => r >= 24).length / iterations,
        probability_36m: runwayMonths.filter(r => r >= 36).length / iterations,
        zero_cash_distribution: buildHistogram(runwayMonths, 36),
        monthly_trajectories: buildPercentilePaths(/* ... */),
    };
}
```

**Finance specialist signal extraction:**
The finance_analyst already extracts financial signals into `memory.financialSignals`.
Add these fields to the extraction prompt in `src/specialists.ts`:

```
Additionally extract these financial signals if present in the business context:
- current_arr_monthly: number (ARR / 12, or MRR if stated)
- monthly_burn: number (monthly operating spend)
- current_cash: number (cash on hand / runway implied)
- growth_rate_monthly_low/base/high: number (monthly growth rate range)
- churn_rate_monthly_low/base/high: number (monthly churn range)

If not explicitly stated, derive reasonable estimates from context and mark as estimated: true.
```

**Python sidecar chart — add to `main.py`:**

```python
@app.post("/charts/runway")
async def render_runway_chart(data: RunwayChartData):
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    
    # Left: Histogram of runway months
    axes[0].hist(data.zero_cash_distribution, bins=36, color='#6366f1', alpha=0.8)
    axes[0].axvline(data.p10_months, color='#ef4444', linestyle='--', label=f'P10: {data.p10_months}m')
    axes[0].axvline(data.p50_months, color='#f59e0b', linestyle='--', label=f'P50: {data.p50_months}m')
    axes[0].axvline(data.p90_months, color='#22c55e', linestyle='--', label=f'P90: {data.p90_months}m')
    axes[0].set_title('Runway Distribution (10,000 simulations)')
    axes[0].legend()
    
    # Right: Monthly cash balance trajectories
    months = list(range(37))
    axes[1].plot(months, data.monthly_trajectories.p10, color='#ef4444', label='P10 (pessimistic)')
    axes[1].plot(months, data.monthly_trajectories.p50, color='#f59e0b', label='P50 (base case)')
    axes[1].plot(months, data.monthly_trajectories.p90, color='#22c55e', label='P90 (optimistic)')
    axes[1].axhline(0, color='white', linestyle='-', alpha=0.3)
    axes[1].set_title('Cash Balance Trajectories')
    axes[1].legend()
    
    return encode_figure(fig)
```

**LLM interpretation — add to synthesis prompt context:**
After RunwayResult is computed, pass it to the synthesis as:

```
RUNWAY SIMULATION RESULTS (10,000 iterations):
P10 (pessimistic): ${p10_months} months to zero cash
P50 (base case): ${p50_months} months to zero cash  
P90 (optimistic): ${p90_months} months to zero cash
Probability of 18-month runway: ${(probability_18m * 100).toFixed(0)}%
Probability of 24-month runway: ${(probability_24m * 100).toFixed(0)}%

Interpret these results in 2-3 sentences. Flag if P10 < 12 months as a critical risk.
Do not fabricate financial figures beyond what is computed above.
```

**PDF placement:** Replace current Monte Carlo page (page 10 in current structure) with a combined simulation page:
- Section heading: "Financial Simulations"
- Sub-section 1: Runway Distribution (chart + P10/P50/P90 table + LLM interpretation)
- Sub-section 2: LTV:CAC Distribution (existing Monte Carlo output, now correctly rendered)

**Acceptance criteria:**
- [ ] `runRunwaySimulation()` exists in `monteCarloService.ts`
- [ ] Result stored in `memory.runwayResult`
- [ ] P10/P50/P90 runway visible in PDF
- [ ] Chart renders via Python sidecar
- [ ] If financial data is insufficient, section shows "Insufficient financial data for runway simulation" not a broken chart
- [ ] Two audits with different financial profiles produce different runway distributions

---

## SIM 3.2 — Strategic Fork Probability Model

**What it is:** Bayesian probability for each strategic fork the user identified.
Each fork gets a success probability derived from dimension scores applied to base rates from strategy research.
The output answers "which fork has the highest probability of success for THIS specific company?"

**Why it matters:** The most common question after every strategy audit is "but which one should we actually do?"
Current system describes all forks; this one computes a probability-weighted recommendation.

**Files to modify:**
- New file: `src/services/forkProbabilityService.ts`
- `src/types.ts` — add `ForkProbability` and `ForkAnalysis` interfaces
- `src/coordinator.ts` — call after synthesis completes, feed result to roadmap
- `src/services/pdfService.ts` — render fork probability table in Strategic Choice section

**Implementation:**

```typescript
// src/services/forkProbabilityService.ts

// Base success rates from strategy research (McKinsey, BCG, HBR meta-analyses)
// These are industry-average priors, updated by company-specific scores
const ANSOFF_BASE_RATES: Record<string, number> = {
    'market_penetration': 0.72,
    'market_development': 0.45,
    'product_development': 0.38,
    'diversification': 0.18,
    'platform_pivot': 0.23,
    'saas_to_services': 0.31,
    'acquisition_exit': 0.52,
};

export interface ForkInput {
    forkName: string;
    forkDescription: string;
    ansoffCell: keyof typeof ANSOFF_BASE_RATES;
    requiredDimensions: string[];  // Which dimensions most affect this fork's success
}

export interface ForkProbability {
    forkName: string;
    baseProbability: number;
    adjustedProbability: number;
    keyConstraints: string[];      // Which dimensions are pulling probability down
    keyEnablers: string[];         // Which dimensions are pulling probability up
    confidenceInEstimate: number;  // How much data we had to work with
}

export function computeForkProbabilities(
    forks: ForkInput[],
    dimensionScores: Record<string, number>,
    scale: string
): ForkProbability[] {
    return forks.map(fork => {
        const base = ANSOFF_BASE_RATES[fork.ansoffCell] ?? 0.35;

        // Execution multiplier: can the company actually execute this fork?
        const executionScore = dimensionScores['Execution Speed'] ?? 50;
        const capitalScore = dimensionScores['Capital Efficiency'] ?? 50;
        const teamScore = dimensionScores['Team / Founder Strength'] ?? 50;

        // Market multiplier: does the market support this fork?
        const tamScore = dimensionScores['TAM Viability'] ?? 50;
        const trendScore = dimensionScores['Trend Adoption'] ?? 50;

        // Defensibility multiplier: can they hold the position if they get there?
        const defensibilityScore = dimensionScores['Competitive Defensibility'] ?? 50;

        // Normalise each score to a multiplier around 1.0
        // Score of 50 = 1.0 (neutral), 100 = 1.5 (strong), 0 = 0.5 (weak)
        const normalize = (s: number) => 0.5 + (s / 100);

        const executionMultiplier = normalize((executionScore + capitalScore + teamScore) / 3);
        const marketMultiplier = normalize((tamScore + trendScore) / 2);
        const defensibilityMultiplier = normalize(defensibilityScore);

        const adjusted = Math.min(0.92, Math.max(0.05,
            base * executionMultiplier * marketMultiplier * defensibilityMultiplier
        ));

        // Identify constraints (dimensions < 45 that are required for this fork)
        const keyConstraints = fork.requiredDimensions
            .filter(dim => (dimensionScores[dim] ?? 50) < 45)
            .map(dim => `${dim}: ${dimensionScores[dim]}/100`);

        // Identify enablers (dimensions > 70 that are required for this fork)
        const keyEnablers = fork.requiredDimensions
            .filter(dim => (dimensionScores[dim] ?? 50) > 70)
            .map(dim => `${dim}: ${dimensionScores[dim]}/100`);

        return {
            forkName: fork.forkName,
            baseProbability: Math.round(base * 100),
            adjustedProbability: Math.round(adjusted * 100),
            keyConstraints,
            keyEnablers,
            confidenceInEstimate: computeDataConfidence(fork.requiredDimensions, dimensionScores),
        };
    });
}
```

**Fork extraction from Strategic Choice section:**
After Fix 2.2 runs and produces a `## Strategic Choice` section, extract the fork options from it.
If the user explicitly named forks in their brief (like Halcyon's a/b/c), use those.
Add a new coordinator step:

```typescript
// In coordinator.ts, after synthesis:
const forks = extractForksFromStrategicChoice(memory.strategicChoice);
if (forks.length >= 2) {
    const forkProbabilities = computeForkProbabilities(
        forks,
        memory.dimensionScores,
        memory.scale
    );
    memory.forkProbabilities = forkProbabilities;
    log({ message: `[SIM 3.2] Fork probabilities computed for ${forks.length} options` });
}
```

**PDF output — add to Strategic Choice section:**

```
Strategic Choice Analysis

Recommended posture: [from Fix 2.2 output]

Fork Probability Analysis (Bayesian estimate based on your dimension scores):

Fork A — Fortify & IPO         ████████████░░░░░░░  42%  ← Recommended
Fork B — Strategic Sale        ████████████████░░░  54%
Fork C — Platform Pivot        ██████░░░░░░░░░░░░░  18%

Key constraint on Fork A: Execution Speed (40/100), Capital Efficiency (30/100)
Key enabler for Fork B: Competitive Defensibility (75/100), Team Strength (80/100)
Note: Probabilities reflect success likelihood given current dimension scores, not market timing.
```

**LLM interpretation of fork probabilities:**
Pass computed probabilities to the Strategic Choice section synthesis prompt:

```
FORK PROBABILITY ANALYSIS (computed, not estimated):
${forkProbabilities.map(f => `${f.forkName}: ${f.adjustedProbability}% (base rate: ${f.baseProbability}%)`).join('\n')}

These probabilities are derived from your dimension scores. 
In your Strategic Choice section:
1. Reference these probabilities when naming the recommended fork
2. Explain the 1-2 key constraints dragging down the recommended fork's probability
3. Do not override the probabilities with your own assessment
4. If probabilities are close (within 10%), acknowledge the genuine uncertainty
```

**Acceptance criteria:**
- [ ] `computeForkProbabilities()` exists in `forkProbabilityService.ts`
- [ ] Fork probabilities visible in PDF Strategic Choice section
- [ ] Probabilities differ between audits with different dimension profiles
- [ ] If user only mentions one strategic direction (no explicit forks), section is gracefully absent
- [ ] Halcyon audit: Fork A/B/C produce meaningfully different probabilities (not all ~33%)

---

## SIM 3.3 — Moat Decay Curve

**What it is:** A forward-looking decay model showing how moat strength changes over 36 months.
Uses VRIO Inimitable score + competitor signals to project when competitive parity is likely.
Renders as a chart: moat strength over time, with branching lines for key scenarios.

**Why it matters:** VRIO gives a static verdict. "Sustained Competitive Advantage" tells a board nothing about when that stops being true. This shows the timeline.

**This is a white space — no competitor strategy tool shows this.**

**Files to modify:**
- New file: `src/services/moatDecayService.ts`
- `src/types.ts` — add `MoatDecayResult`
- `src/coordinator.ts` — call after VRIO analysis completes
- `main.py` — add moat decay chart renderer
- `src/services/pdfService.ts` — render decay curve in VRIO section

**Implementation:**

```typescript
// src/services/moatDecayService.ts

export interface MoatDecayInput {
    moatName: string;
    inimitabilityScore: number;         // VRIO Inimitable score (0-100)
    competitiveRivalryScore: number;    // Porter's Competitive Rivalry score
    replicationMonthsEstimate: number;  // Extracted from clarifier Q2 if available
    attackVectors: AttackVector[];      // Specific threats mentioned by user
}

export interface AttackVector {
    name: string;                    // e.g., "Snowflake CTRM product"
    accelerationFactor: number;      // How much this compresses the replication clock (0-1)
    probability: number;             // P(this vector fires) in next 24 months
    triggerMonth: number | null;     // Known timeline if stated (e.g., "H2 2026" = month 8)
}

export interface MoatDecayResult {
    baseline_months_to_parity: number;
    accelerated_months_to_parity: number;  // If top attack vector fires
    strength_at_12m: number;
    strength_at_24m: number;
    strength_at_36m: number;
    decay_curve_baseline: number[];         // strength[0..36] base case
    decay_curve_accelerated: number[];      // strength[0..36] if attack vector fires
    intervention_points: InterventionPoint[]; // When to act to reinforce the moat
}

export interface InterventionPoint {
    month: number;
    action: string;
    urgency: 'now' | 'soon' | 'monitor';
}

export function computeMoatDecay(input: MoatDecayInput): MoatDecayResult {
    const baseStrength = input.inimitabilityScore;
    const replicationMonths = input.replicationMonthsEstimate > 0
        ? input.replicationMonthsEstimate
        : estimateReplicationTime(input.inimitabilityScore, input.competitiveRivalryScore);

    // Base decay: linear from current strength to 0 at replication_months
    // After parity, moat strength asymptotes toward 30 (some residual advantage from first-mover)
    const baselineCurve = computeDecayCurve(baseStrength, replicationMonths, 36);

    // Accelerated decay: top attack vector compresses the timeline
    const topVector = input.attackVectors.sort((a, b) => b.accelerationFactor - a.accelerationFactor)[0];
    const acceleratedReplicationMonths = topVector
        ? Math.max(6, replicationMonths * (1 - topVector.accelerationFactor * topVector.probability))
        : replicationMonths;

    const acceleratedCurve = computeDecayCurve(baseStrength, acceleratedReplicationMonths, 36);

    return {
        baseline_months_to_parity: replicationMonths,
        accelerated_months_to_parity: acceleratedReplicationMonths,
        strength_at_12m: baselineCurve[12],
        strength_at_24m: baselineCurve[24],
        strength_at_36m: baselineCurve[36],
        decay_curve_baseline: baselineCurve,
        decay_curve_accelerated: acceleratedCurve,
        intervention_points: computeInterventionPoints(baselineCurve, acceleratedCurve, replicationMonths),
    };
}

function computeDecayCurve(startStrength: number, replicationMonths: number, horizon: number): number[] {
    const curve: number[] = [];
    for (let m = 0; m <= horizon; m++) {
        if (m >= replicationMonths) {
            // After parity: asymptote toward 30 (first-mover residual)
            const postParityDecay = Math.max(30, startStrength * Math.exp(-0.1 * (m - replicationMonths)));
            curve.push(Math.round(postParityDecay));
        } else {
            // Before parity: linear decay
            const strength = startStrength - (startStrength * (m / replicationMonths));
            curve.push(Math.round(strength));
        }
    }
    return curve;
}
```

**Replication time extraction from clarifier Q2:**
The clarifier Q2 answer often contains explicit replication timelines like "24-30 months" or "14-month regulatory approval cycle."
Add an LLM micro-call to extract this:

```typescript
async function extractReplicationTime(clarifierQ2Answer: string): Promise<number> {
    if (!clarifierQ2Answer || clarifierQ2Answer.length < 10) return 0;
    
    const prompt = `From this text, extract the estimated time (in months) for a well-funded competitor to replicate the described moat. 
    Return ONLY a number (the midpoint if a range is given). If no time estimate is present, return 0.
    
    Text: "${clarifierQ2Answer.slice(0, 500)}"`;
    
    const result = await callGemini('gemini-2.5-flash', '', prompt);
    const months = parseInt(result.trim());
    return isNaN(months) ? 0 : months;
}
```

**Python sidecar chart — add to `main.py`:**

```python
@app.post("/charts/moat_decay")
async def render_moat_decay(data: MoatDecayData):
    fig, ax = plt.subplots(figsize=(10, 5))
    months = list(range(37))
    
    ax.plot(months, data.baseline_curve, color='#6366f1', linewidth=2, label='Base case')
    ax.plot(months, data.accelerated_curve, color='#ef4444', linewidth=2, 
            linestyle='--', label=f'If {data.top_threat} executes')
    
    # Mark intervention points
    for pt in data.intervention_points:
        color = '#ef4444' if pt.urgency == 'now' else '#f59e0b'
        ax.axvline(pt.month, color=color, alpha=0.5, linestyle=':')
        ax.text(pt.month + 0.5, data.baseline_curve[pt.month], pt.action, 
                fontsize=7, color=color, rotation=45)
    
    ax.axhline(50, color='white', alpha=0.2, linestyle='--')  # Parity threshold line
    ax.set_xlabel('Months from today')
    ax.set_ylabel('Moat Strength (0-100)')
    ax.set_title(f'{data.moat_name} — Competitive Parity Clock')
    ax.legend()
    ax.set_ylim(0, 105)
    
    return encode_figure(fig)
```

**PDF placement:** Replace the static VRIO verdict with:
- VRIO table (as before)
- New subsection: "Moat Durability Projection"
- Chart: decay curve showing baseline vs accelerated scenario
- Table: Moat Strength at 12m / 24m / 36m
- LLM interpretation: 2-3 sentences on when to take defensive action

**Acceptance criteria:**
- [ ] `computeMoatDecay()` exists in `moatDecayService.ts`
- [ ] Replication time extracted from clarifier Q2 when available
- [ ] Decay chart renders via Python sidecar and appears in PDF
- [ ] Halcyon audit: EMIR moat shows 28-30 month baseline, shorter accelerated line
- [ ] Coffee shop audit: Section absent (no established moat to decay)
- [ ] Chart has clear labelling — no truncated axis titles

---

# PART 2 — PDF REDESIGN

## Current PDF structure vs target structure

**Current (26 pages, n8n audit):**
```
P1   Cover (company name wrong — "The Venture")
P2   Table of Contents
P3   Diagnostic Matrix (dimension list with numbers only)
P4-5 Executive Synthesis (dense prose, 2 pages)
P6   Dimension scores repeated (redundant — same as P3)
P7   Strategic Recommendations (HIGH-PRIORITY / MAINTAIN & EXTEND)
P8   Blue Ocean (chart unavailable error + ERRC grid text)
P9   Wardley Map (labels truncated)
P10  Monte Carlo (3800% bug — atomic commit H not deployed in this build)
P11-25 Stress Tests (5 scenarios × ~3 pages each, wall-to-wall text)
P26  Sources Appendix (blank page)
```

**Target (aim for 24-28 clean pages):**
```
P1   Executive Decision Page (new — clear strategic choice + top 3 risks)
P2   Table of Contents (accurate — no phantom sections)
P3   Strategic Diagnostic Matrix (with score bars, category dividers, colour bands)
P4-5 Executive Synthesis (with Strategic Choice section at end of P5)
P6   Strategic Recommendations (HIGH-PRIORITY / MAINTAIN & EXTEND)
P7   Porter's Five Forces (full analysis — currently missing from PDF body)
P8   Ansoff Growth Matrix (full analysis — currently missing from PDF body)
P9   VRIO + Moat Durability Projection (SIM 3.3)
P10  Blue Ocean Strategy Canvas + ERRC Grid (fix chart render failure)
P11  Wardley Strategic Map (fix label truncation)
P12  Financial Simulations (SIM 3.1 Runway + SIM 3.2 Fork Probabilities + Monte Carlo fixed)
P13-22 Stress Tests (5 scenarios × 2 pages each — tighter layout with visual hierarchy)
P23-24 Sources Appendix (populated — user facts / specialist sources / missing signals)
```

---

## PDF FIX 3.A — Fix cover page company name

**File:** `src/services/pdfService.ts`

**Problem:** Cover page shows "The Venture" for all audits. Fix I from atomic commit should have resolved this but the n8n audit PDF still shows "The Venture". Fix I appears to have fixed the subtitle area but not the main title on page 1.

**Find and fix both occurrences:**
```typescript
// Search for any hardcoded 'The Venture' string in pdfService.ts
// The cover page renders org_name — ensure it reads from memory.orgName not a fallback string
// Also ensure the PDF header (top of every page) uses memory.orgName
```

**Acceptance criteria:**
- [ ] Cover page shows actual company name for all 4 verification scenarios
- [ ] Every page header shows actual company name not "THE VENTURE"

---

## PDF FIX 3.B — Redesign cover page (Executive Decision Page)

**File:** `src/services/pdfService.ts`
**Section:** `renderCoverPage()` function

**Current cover:** Confidence Index + 2-sentence moat rationale. Minimal.

**New cover — Executive Decision Page:**

```
[Company Name]                              [Strategic Density: XX/100]
Strategy Intelligence Report · [Date]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED STRATEGIC POSTURE
[One clear sentence from Strategic Choice section]

PRIMARY MOVE                    REJECTED MOVE
[primary action]                [what not to do]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOP 3 STRATEGIC RISKS           CORE MOAT
1. [Most material risk]         [Moat name] · [Score]/100
2. [Second risk]                [Moat confidence]
3. [Third risk]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DECISION CONFIDENCE
Evidence [XX%]  ·  Analytical [XX%]  ·  Decision [XX%]

[2-sentence moat rationale]
```

**Implementation notes:**
- Read `memory.strategicChoice` for the posture, primary move, and rejected move
- Read `memory.materialRisks[0..2]` for top 3 risks
- Read `memory.topMoat` for moat name and score
- Read `memory.confidenceTriad` for the three confidence values
- If `memory.strategicChoice` is null (pre-Build 2.0 audit), fall back to current cover layout

---

## PDF FIX 3.C — Redesign Diagnostic Matrix (Page 3)

**File:** `src/services/pdfService.ts`
**Section:** `renderDiagnosticMatrix()` function

**Current:** Plain text list of dimension names + numbers. No visual hierarchy.

**Target:** Score bars, colour coding, category sections with visual dividers.

```typescript
function renderDiagnosticMatrix(doc: PDFKit.PDFDocument, memory: AuditMemory) {
    const CATEGORIES = {
        'MARKET': ['TAM Viability', 'Target Precision', 'Trend Adoption', 'Team / Founder Strength'],
        'STRATEGY': ['Competitive Defensibility', 'Model Innovation', 'Flywheel Potential', 
                     'Network Effects Strength', 'Data Asset Quality'],
        'COMMERCIAL': ['Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed'],
        'OPERATIONS': ['Execution Speed', 'Scalability', 'ESG Posture', 'Regulatory Readiness'],
        'FINANCE': ['ROI Projection', 'Risk Tolerance', 'Capital Efficiency', 'Customer Concentration Risk'],
    };

    const scores = memory.dimensionScores;
    const BAR_MAX_WIDTH = 200;
    const ROW_HEIGHT = 22;

    for (const [category, dimensions] of Object.entries(CATEGORIES)) {
        // Category header with horizontal rule
        doc.fontSize(10).fillColor('#888888').text(category, { continued: false });
        doc.moveTo(doc.x, doc.y).lineTo(doc.x + 460, doc.y).stroke('#333333');
        doc.moveDown(0.3);

        for (const dim of dimensions) {
            const score = scores[dim] ?? 0;
            const barWidth = (score / 100) * BAR_MAX_WIDTH;
            
            // Colour based on score band
            const barColor = score >= 70 ? '#22c55e'   // green
                           : score >= 45 ? '#f59e0b'   // amber
                           : '#ef4444';                // red

            const y = doc.y;
            
            // Dimension name
            doc.fontSize(9).fillColor('#ffffff').text(dim, doc.page.margins.left, y, { width: 200 });
            
            // Score bar background
            doc.rect(doc.page.margins.left + 210, y + 2, BAR_MAX_WIDTH, 12)
               .fill('#1e1e2e');
            
            // Score bar fill
            doc.rect(doc.page.margins.left + 210, y + 2, barWidth, 12)
               .fill(barColor);
            
            // Score number
            doc.fontSize(9).fillColor('#ffffff')
               .text(`${score}`, doc.page.margins.left + 420, y, { width: 40, align: 'right' });
            
            doc.y += ROW_HEIGHT;
        }
        doc.moveDown(0.5);
    }
}
```

**Acceptance criteria:**
- [ ] Score bars visible for all 20 dimensions
- [ ] Colour coding: green (70-100), amber (45-69), red (0-44)
- [ ] Category headers with visual dividers
- [ ] Fits on one page (all 20 dimensions)
- [ ] No repeated dimension scores page later in the document

---

## PDF FIX 3.D — Remove redundant dimension scores page

**File:** `src/services/pdfService.ts`

**Problem:** Current PDF repeats all 20 dimension scores as a plain text list (Page 6 in n8n audit) after the Executive Synthesis section. This is a duplicate of Page 3. It wastes a full page and confuses readers.

**Fix:** Find where `memory.dimensionScores` is rendered as a standalone text block in the synthesis section and remove it. The scores are already on Page 3 with visual bars. They do not need to be repeated as a text dump.

```typescript
// Search for this pattern in pdfService.ts and remove it:
// "Dimension Scores" header followed by a list of "DimName: XX/100" entries
// This is being generated by the synthesis LLM including scores in its markdown
// Either strip the ## Dimension Scores section from the synthesis output before rendering
// OR add a post-processing step that removes it
```

---

## PDF FIX 3.E — Add Porter's Five Forces full section

**File:** `src/services/pdfService.ts`

**Problem:** Porter's Five Forces appears in the Table of Contents but is not rendered in the PDF body. The analysis IS being generated (it's in `memory.frameworks.porter`) but never rendered. Only the Blue Ocean and Wardley pages appear.

**Fix:** Add `renderPorterSection()` function and call it before Blue Ocean:

```typescript
function renderPorterSection(doc: PDFKit.PDFDocument, memory: AuditMemory) {
    if (!memory.frameworks?.porter) return;
    
    doc.addPage();
    doc.fontSize(16).fillColor('#ffffff').text("Porter's Five Forces Analysis");
    doc.fontSize(10).fillColor('#888888').text('Competitive intensity assessment across five structural forces.');
    doc.moveDown();

    const forces = [
        { key: 'threat_of_new_entrants', label: 'Threat of New Entrants' },
        { key: 'bargaining_power_of_buyers', label: 'Bargaining Power of Buyers' },
        { key: 'bargaining_power_of_suppliers', label: 'Bargaining Power of Suppliers' },
        { key: 'threat_of_substitutes', label: 'Threat of Substitutes' },
        { key: 'competitive_rivalry', label: 'Competitive Rivalry' },
    ];

    for (const force of forces) {
        const data = memory.frameworks.porter[force.key];
        if (!data) continue;
        
        const intensity = data.score >= 70 ? 'HIGH' : data.score >= 45 ? 'MODERATE' : 'LOW';
        const color = data.score >= 70 ? '#ef4444' : data.score >= 45 ? '#f59e0b' : '#22c55e';
        
        doc.fontSize(11).fillColor(color).text(`${force.label}  ${intensity} (${data.score}/100)`);
        doc.fontSize(9).fillColor('#cccccc').text(data.finding || data.analysis || '', { width: 460 });
        doc.moveDown(0.5);
    }

    // Interaction note
    if (memory.frameworks.porter.interaction_note) {
        doc.fontSize(9).fillColor('#888888').text(
            `Interaction note: ${memory.frameworks.porter.interaction_note}`, { width: 460 }
        );
    }

    doc.moveDown();
    doc.fontSize(11).fillColor('#ffffff').text(
        `Overall Industry Pressure: ${memory.frameworks.porter.overall_score}/100`
    );
}
```

**Same pattern for `renderAnsoffSection()` and `renderVRIOSection()`** — both have generated content in memory but are not rendered to PDF.

---

## PDF FIX 3.F — Fix Blue Ocean chart render failure

**File:** `src/services/pdfService.ts`

**Problem:** Current PDF shows "Strategy canvas chart unavailable." This is a user-facing error message being rendered directly. The Blue Ocean chart likely fails because the Python sidecar doesn't receive the data in the expected format, or the chart request times out.

**Fix:**
```typescript
async function renderBlueOceanSection(doc: PDFKit.PDFDocument, memory: AuditMemory) {
    doc.addPage();
    doc.fontSize(16).fillColor('#ffffff').text('Blue Ocean Strategy Canvas');
    
    try {
        const chartBuffer = await callPythonSidecar('/charts/blue_ocean', memory.frameworks?.blue_ocean);
        if (chartBuffer && chartBuffer.length > 1000) {
            doc.image(chartBuffer, { width: 460 });
        } else {
            // Graceful fallback — don't show error text to user
            // Render the ERRC grid as a structured table instead
            renderERRCGrid(doc, memory.frameworks?.blue_ocean?.errc);
        }
    } catch (err) {
        // Silent fallback — never show "unavailable" to user
        log({ severity: 'WARN', message: 'Blue Ocean chart failed, rendering ERRC text', error: err });
        renderERRCGrid(doc, memory.frameworks?.blue_ocean?.errc);
    }
}
```

**Rule:** Never render user-facing error text in a PDF. Always have a graceful fallback that renders the underlying data in text/table form if the chart fails.

---

## PDF FIX 3.G — Fix Wardley map label truncation

**File:** `main.py` (Python sidecar Wardley chart renderer)

**Problem:** Wardley map node labels are truncated mid-word ("Centralized Workflow O", "Sovereign Agentic Orch"). Labels are being cut because the text exceeds the allotted space.

**Fix:**
```python
# In the Wardley chart renderer in main.py
# Replace fixed-width label rendering with word-wrapped labels

def render_wardley_node(ax, node_name: str, x: float, y: float):
    # Wrap long labels at 20 characters
    import textwrap
    wrapped = '\n'.join(textwrap.wrap(node_name, width=20))
    ax.annotate(
        wrapped,
        (x, y),
        fontsize=7,
        ha='center',
        va='bottom',
        color='white',
        wrap=True,
        bbox=dict(boxstyle='round,pad=0.2', facecolor='#1e1e2e', alpha=0.8, edgecolor='none')
    )
```

---

## PDF FIX 3.H — Redesign stress test layout

**File:** `src/services/pdfService.ts`

**Problem:** Each stress test currently takes ~3 pages because every dimension gets a paragraph of text. At 5 scenarios × 3 pages = 15 pages for stress tests alone. The mitigation playbook repeats the same advice across scenarios.

**Target:** Each stress test fits on 2 pages maximum.

**Layout redesign:**

```
PAGE 1 of 2 per scenario:
[Scenario title + description]

SCENARIO PERFORMANCE (visual table — all 20 dimensions in 2 columns)
Dimension          Score  Delta    Dimension          Score  Delta
TAM Viability      60     -30      Pricing Power      10     -50
Target Precision   75     -15      CAC/LTV Ratio      25     -25
...

Impact Assessment: Score reduced to XX/100 (Delta: -XX pts)
[Critical/Warning/Stable badge]

PAGE 2 of 2 per scenario:
CRISIS MITIGATION PLAYBOOK (only top 5 most impacted dimensions)
[Dimension — Resilience Score]
[3 bullet points max]
[COMMANDER DIRECTIVE — one sentence]

[Repeat for next 4 of top 5 dimensions]
```

**Key changes:**
1. Render dimension table as a 2-column grid, not a single column — halves the height
2. Replace the unicode glyph artefacts (`%¼` and `!"`) with proper arrow characters and delta notation
3. Limit mitigation playbook to top 5 most impacted dimensions, not all 20
4. Commander Directives condensed to one sentence, not a paragraph

**Unicode fix specifically:**
```typescript
// Current — renders as %¼ and !" in PDFKit
const downArrow = '↓';  // Use Unicode directly
const delta = 'Δ';

// Render as: "↓ TAM Viability    60  Δ-30"
// Not as: "%¼ TAM Viability 60 !"30"
```

---

## PDF FIX 3.I — Fix Sources Appendix blank page

**File:** `src/services/pdfService.ts`

**Problem:** Sources Appendix page renders blank (page 26 in n8n audit). Fix 3.1 from Build 2.0 was marked complete but this PDF shows empty content.

**Diagnosis:** `memory.specialistMetadata` may not be populated for this audit (pre-Fix 1.1 data), OR the rendering code has a guard condition that skips rendering if arrays are empty.

**Fix:**
```typescript
function renderSourcesAppendix(doc: PDFKit.PDFDocument, memory: AuditMemory) {
    doc.addPage();
    doc.fontSize(18).fillColor('#ffffff').text('Evidence, Sources & Assumptions');
    doc.moveDown();

    // Section 1: User-provided context
    doc.fontSize(12).fillColor('#6366f1').text('1. User-Provided Context');
    doc.fontSize(9).fillColor('#cccccc').text(
        memory.businessContext?.slice(0, 600) || 'Original input not available in this report version.',
        { width: 460 }
    );
    doc.moveDown();

    // Section 2: Specialist data sources (always render something)
    doc.fontSize(12).fillColor('#6366f1').text('2. Data Sources Referenced by Analysts');
    const metadata = memory.specialistMetadata || [];
    if (metadata.length === 0) {
        doc.fontSize(9).fillColor('#888888').text(
            'Detailed source tracking available in reports generated after 1 May 2026.'
        );
    } else {
        for (const meta of metadata) {
            const sources = meta.data_sources || [];
            if (sources.length === 0) continue;
            doc.fontSize(10).fillColor('#ffffff').text(meta.agent?.replace(/_/g, ' ').toUpperCase() || 'ANALYST');
            sources.forEach(s => doc.fontSize(9).fillColor('#cccccc').text(`  · ${s}`));
            doc.moveDown(0.3);
        }
    }

    doc.moveDown();

    // Section 3: Missing signals (always render something)
    doc.fontSize(12).fillColor('#6366f1').text('3. Critical Signals Missing from This Analysis');
    const allMissing = metadata.flatMap(m => (m.missing_signals || []).map(s => `[${m.agent}] ${s}`));
    if (allMissing.length === 0) {
        doc.fontSize(9).fillColor('#888888').text('No critical signal gaps flagged by analysts.');
    } else {
        allMissing.forEach(s => doc.fontSize(9).fillColor('#cccccc').text(`  · ${s}`));
    }

    doc.moveDown();

    // Section 4: Confidence limitations
    doc.fontSize(12).fillColor('#6366f1').text('4. Confidence Limitations');
    const triad = memory.confidenceTriad;
    if (triad) {
        doc.fontSize(9).fillColor('#cccccc').text(
            `Evidence Confidence: ${triad.evidenceConfidence}% — reflects completeness of input data provided.\n` +
            `Analytical Confidence: ${triad.analyticalConfidence}% — reflects specialist agreement across frameworks.\n` +
            `Decision Confidence: ${triad.decisionConfidence}% — safe threshold for acting on this recommendation.`,
            { width: 460 }
        );
    }
}
```

---

## PDF FIX 3.J — Fix page overflow text corruption

**File:** `src/services/pdfService.ts`

**Problem:** "sGterenearmat eodn b tyo..." at page bottom — PDFKit concurrent write corruption.

**Fix:** Add a page-space guard before any long prose block:

```typescript
function safeText(doc: PDFKit.PDFDocument, text: string, options?: object) {
    const BOTTOM_MARGIN = 60;
    const pageBottom = doc.page.height - doc.page.margins.bottom - BOTTOM_MARGIN;
    
    // If remaining space < estimated text height, add new page first
    const estimatedHeight = Math.ceil(text.length / 80) * 14; // rough estimate
    if (doc.y + estimatedHeight > pageBottom) {
        doc.addPage();
    }
    
    doc.text(text, options);
}

// Replace all doc.text() calls for long prose blocks with safeText()
```

---

# PART 3 — IMPLEMENTATION SEQUENCE

```
WEEK 1 (Days 1-7):
├── PDF FIX 3.A  Cover page company name (30 min)
├── PDF FIX 3.D  Remove redundant scores page (30 min)
├── PDF FIX 3.H  Stress test unicode glyphs fix (1 hour)
├── PDF FIX 3.J  Page overflow text corruption (1 hour)
├── PDF FIX 3.I  Sources Appendix blank page fix (2 hours)
└── PDF FIX 3.G  Wardley label truncation in Python sidecar (1 hour)

WEEK 1 verification: Run S3 Halcyon and S4 Anthropic — PDF quality baseline check

WEEK 2 (Days 8-14):
├── PDF FIX 3.C  Diagnostic Matrix redesign with score bars (4 hours)
├── PDF FIX 3.E  Porter / Ansoff / VRIO PDF sections (3 hours)
├── PDF FIX 3.F  Blue Ocean chart failure graceful fallback (2 hours)
└── PDF FIX 3.B  Cover page Executive Decision layout (3 hours)

WEEK 2 verification: Full S1-S4 re-run — check all PDF layout assertions

WEEK 3 (Days 15-21):
├── SIM 3.1      Runway simulation — Python sidecar + coordinator + PDF (3 days)
└── SIM 3.2      Fork probability model — forkProbabilityService.ts + PDF (2 days)

WEEK 4 (Days 22-28):
└── SIM 3.3      Moat decay curve — moatDecayService.ts + Python chart + PDF (3 days)

WEEK 4 verification: S3 Halcyon specifically — check EMIR moat decay chart renders
```

---

# PART 4 — VERIFICATION ADDITIONS FOR BUILD 3.0

Add these assertions to the existing verification scenarios doc.

## S3 Halcyon — new Build 3.0 assertions

| # | Assertion | Pass criterion |
|---|---|---|
| S3-L | Runway chart present | P10/P50/P90 visible in PDF Financial Simulations section |
| S3-M | Fork probabilities | Fork A/B/C show meaningfully different percentages (not all ~33%) |
| S3-N | Moat decay chart | EMIR moat decay curve shows 24-30 month baseline, shorter accelerated line with Snowflake threat |
| S3-O | Porter section in PDF | Porter's Five Forces renders as a full section, not just in TOC |
| S3-P | Cover page | Shows "Halcyon Operations" not "The Venture" |
| S3-Q | Stress tests | Max 2 pages per scenario — no wall-to-wall text |

## All scenarios — new PDF quality assertions

| # | Assertion | Pass criterion |
|---|---|---|
| PDF-1 | Diagnostic matrix | Score bars visible, colour-coded, category dividers present |
| PDF-2 | No unicode artefacts | Zero instances of "%¼" or '!"' in the PDF |
| PDF-3 | No page overflow corruption | No interleaved characters at page bottoms |
| PDF-4 | No user-facing error text | "unavailable", "failed", "error" never appear as visible PDF content |
| PDF-5 | Sources Appendix populated | Has at least the confidence limitations section — never blank |
| PDF-6 | Company name correct | Cover page and every header show actual org name |
| PDF-7 | No redundant pages | Dimension scores appear exactly once — not repeated |

---

# PART 5 — OPEN ITEMS CARRIED FORWARD

These are known but not part of Build 3.0 scope:

| Item | Notes |
|---|---|
| Custom API domain `api.velocitycso.com` | Fix 4.2 from Build 1.0 — Cloud Run domain mapping |
| Auth middleware on backend routes | Fix 4.5 — product decision required on auth strategy |
| Admin interface for report management | Low priority — list/reload reports by ID |
| S3 Halcyon verification | Not yet run — first task after Build 3.0 PDF fixes ship |
| S4 Anthropic verification | Not yet run — same |

---

# ARCHITECTURAL RULE CARRIED FORWARD

> The renderer must not invent logic. It must only render the canonical strategy state.

Build 3.0 adds three new fields to that canonical state:

```typescript
// New additions to AuditMemory in src/types.ts
memory.runwayResult: RunwayResult | null;           // SIM 3.1
memory.forkProbabilities: ForkProbability[] | null; // SIM 3.2
memory.moatDecayResult: MoatDecayResult | null;     // SIM 3.3
```

All three are computed deterministically from existing canonical state.
No LLM generates these numbers. LLMs only interpret them.
This is the principle.