# VelocityCSO — Final Build Sheet
## Code-Grounded Defect Register & Implementation Plan

**Purpose:** This document is the execution spec for fixing VelocityCSO's strategy audit engine. Every defect is traced to a file path and line number. Every fix has acceptance criteria. Ordered by ROI — do them in sequence.

**Target agent:** Claude 4.6 coding agent (Amazon Q / VS Code)
**Runtime:** Node 20 (node:20-bookworm-slim), TypeScript ES2022/NodeNext, Express, Firestore, PDFKit, Python sidecar for charts
**Key files:** `src/coordinator.ts`, `src/specialists.ts`, `src/services/pdfService.ts`, `src/services/monteCarloService.ts`, `src/agents/interrogator.ts`, `frontend/src/components/dashboard/KpiRow.tsx`, `frontend/src/components/HeroSection.tsx`

---

# PHASE 1 — TRUST REPAIR (Week 1-2)

These fixes address defects that actively damage credibility with every audit generated. Ship these before any new customer touches the product.

---

## FIX 1.1 — Preserve root metadata in robustParse
**Defects resolved:** D10 (Analysis Confidence 0%), D8 (Sources Appendix data loss), D12 (confidence calibration)
**Severity:** P0
**Effort:** Small (1-2 hours)

**File:** `src/coordinator.ts` lines 138-152

**Current behaviour:**
```typescript
// robustParse extracts only nested dimensions, discarding root metadata
parsed.dimensions = normalized;    // score-only dict
parsed.richDimensions = rich;      // score + justification + action
// confidence_score, data_sources, missing_signals at root level are LOST
```

**Required change:**
After the dimension normalisation block, explicitly preserve root metadata:

```typescript
// After dimension normalisation, preserve specialist metadata
parsed.specialistMeta = {
    confidence_score: parsed.confidence_score ?? null,
    data_sources: parsed.data_sources ?? [],
    missing_signals: parsed.missing_signals ?? [],
    agent_name: parsed.agent_name ?? null
};
```

Then in the state aggregation step (where `Object.assign` merges specialist outputs), collect specialist metadata into an array:

```typescript
const specialistMetadata: SpecialistMeta[] = [];
// After each specialist completes:
specialistMetadata.push({
    agent: 'market_analyst',
    confidence_score: marketResult.specialistMeta?.confidence_score,
    data_sources: marketResult.specialistMeta?.data_sources,
    missing_signals: marketResult.specialistMeta?.missing_signals
});
```

Save `specialistMetadata` to `memory.specialistMetadata` alongside `memory.dimensionScores` and `memory.richDimensions`.

**Acceptance criteria:**
- [ ] `memory.specialistMetadata` is populated for every audit
- [ ] Each specialist's `confidence_score` is accessible downstream
- [ ] Frontend `KpiRow.tsx` can read real confidence values (fix in 1.2)
- [ ] `data_sources` arrays are preserved for Sources Appendix (fix in Phase 3)

**Test:** Run an audit. Check Firestore document for the report — `specialistMetadata` array should contain 5-7 entries with non-null confidence scores.

---

## FIX 1.2 — Fix Analysis Confidence calculation
**Defects resolved:** D10 (Analysis Confidence 0%)
**Severity:** P0
**Effort:** Small (30 minutes)
**Depends on:** Fix 1.1

**File:** `frontend/src/components/dashboard/KpiRow.tsx` lines 22-25

**Current behaviour:**
```typescript
const richDims = Object.values(richDimensions || {});
const confidence = richDims.length > 0
    ? Math.round(richDims.reduce((a, b) => a + (b.confidence_score || 0), 0) / richDims.length)
    : 85;
```
Reads `confidence_score` from inside each dimension object. It's not there. Always returns 0.

**Required change:**
Read from the new `specialistMetadata` array instead:

```typescript
const metaEntries = specialistMetadata || [];
const validConfidences = metaEntries
    .map(m => m.confidence_score)
    .filter(c => c !== null && c !== undefined && c > 0);

const confidence = validConfidences.length > 0
    ? Math.round(validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length)
    : 0; // Genuinely 0 if no specialist reported confidence
```

**Acceptance criteria:**
- [ ] Analysis Confidence shows a non-zero percentage for any audit where specialists report confidence
- [ ] If all specialists report null confidence, show "Insufficient data" rather than "0%"

**Test:** Run an audit. Web report header should show a confidence percentage between 25-95% for a typical business input.

---

## FIX 1.3 — Add dimension polarity and materiality metadata
**Defects resolved:** D1 (polarity inversion), D9 (Customer Concentration Risk as moat)
**Severity:** P0
**Effort:** Medium (2-3 hours)

**File:** New file `src/dimensionRegistry.ts` + modifications to `src/coordinator.ts`

**Create a dimension registry:**

```typescript
// src/dimensionRegistry.ts

export interface DimensionMeta {
    key: string;
    displayName: string;
    category: 'market' | 'strategy' | 'commercial' | 'operations' | 'finance';
    scoringDirection: 'higher_is_better'; // All dimensions are normalised this way per specialist rubrics
    isRiskDimension: boolean; // TRUE for dimensions where a high score means ABSENCE of risk, not PRESENCE of strength
    moatEligible: boolean; // FALSE for risk-absence dimensions — they should never be selected as "core moat"
    nullSignalScore: number; // Score threshold below which the dimension is treated as "insufficient data" rather than "weak"
}

export const DIMENSION_REGISTRY: DimensionMeta[] = [
    { key: 'TAM Viability', displayName: 'TAM Viability', category: 'market', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Target Precision', displayName: 'Target Precision', category: 'market', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Trend Adoption', displayName: 'Trend Adoption', category: 'market', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Team / Founder Strength', displayName: 'Team / Founder Strength', category: 'market', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Competitive Defensibility', displayName: 'Competitive Defensibility', category: 'strategy', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Model Innovation', displayName: 'Model Innovation', category: 'strategy', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Flywheel Potential', displayName: 'Flywheel Potential', category: 'strategy', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Network Effects Strength', displayName: 'Network Effects Strength', category: 'strategy', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Data Asset Quality', displayName: 'Data Asset Quality', category: 'strategy', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Pricing Power', displayName: 'Pricing Power', category: 'commercial', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'CAC/LTV Ratio', displayName: 'CAC/LTV Ratio', category: 'commercial', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Market Entry Speed', displayName: 'Market Entry Speed', category: 'commercial', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Execution Speed', displayName: 'Execution Speed', category: 'operations', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'Scalability', displayName: 'Scalability', category: 'operations', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'ESG Posture', displayName: 'ESG Posture', category: 'operations', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Regulatory Readiness', displayName: 'Regulatory Readiness', category: 'operations', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: true, nullSignalScore: 20 },
    { key: 'ROI Projection', displayName: 'ROI Projection', category: 'finance', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Risk Tolerance', displayName: 'Risk Tolerance', category: 'finance', scoringDirection: 'higher_is_better', isRiskDimension: true, moatEligible: false, nullSignalScore: 20 },
    { key: 'Capital Efficiency', displayName: 'Capital Efficiency', category: 'finance', scoringDirection: 'higher_is_better', isRiskDimension: false, moatEligible: false, nullSignalScore: 20 },
    { key: 'Customer Concentration Risk', displayName: 'Customer Concentration Risk', category: 'finance', scoringDirection: 'higher_is_better', isRiskDimension: true, moatEligible: false, nullSignalScore: 20 },
];

export function getMoatEligibleDimensions(scores: Record<string, number>): [string, number][] {
    return DIMENSION_REGISTRY
        .filter(d => d.moatEligible && scores[d.key] !== null && scores[d.key] !== undefined)
        .map(d => [d.key, scores[d.key]] as [string, number])
        .sort((a, b) => b[1] - a[1]);
}
```

**Acceptance criteria:**
- [ ] `DIMENSION_REGISTRY` exists with all 20 dimensions, each tagged with `isRiskDimension` and `moatEligible`
- [ ] `Customer Concentration Risk` and `Risk Tolerance` are marked `moatEligible: false`
- [ ] ESG Posture, Scalability, ROI Projection, Capital Efficiency are marked `moatEligible: false`
- [ ] The registry is importable by `coordinator.ts`, `pdfService.ts`, and frontend components

---

## FIX 1.4 — Replace blind .reduce() moat selection with materiality-aware logic
**Defects resolved:** D1 (polarity inversion), D5 (synthesis hallucination), H14 (generic moat regression)
**Severity:** P0
**Effort:** Small (1 hour)
**Depends on:** Fix 1.3

**File:** `src/coordinator.ts` line 666

**Current behaviour:**
```typescript
const topDimension = Object.entries(finalDimensions)
    .filter(([_, v]) => v !== null)
    .reduce((a, b) => (b[1] as number) > (a[1] as number) ? b : a, ['N/A', 0]);
```
Picks the single highest-scoring dimension regardless of moat eligibility.

**Required change:**
```typescript
import { getMoatEligibleDimensions } from './dimensionRegistry';

const moatCandidates = getMoatEligibleDimensions(finalDimensions);
const topDimension = moatCandidates.length > 0
    ? moatCandidates[0]  // Highest-scoring moat-eligible dimension
    : ['N/A', 0];

// Also capture top 3 for richer verdict prompt
const topThreeMoats = moatCandidates.slice(0, 3);
```

**Acceptance criteria:**
- [ ] `Customer Concentration Risk` can never be selected as the primary moat
- [ ] `Risk Tolerance`, `ESG Posture`, `ROI Projection`, `Capital Efficiency`, `Scalability` can never be selected as primary moat
- [ ] Top 3 moat candidates are available for the verdict prompt (Fix 1.5)

**Test:** Run the coffee shop audit (thin input). The moat should NOT be "Customer Concentration Risk." It should be whatever moat-eligible dimension scored highest (likely Trend Adoption or Market Entry Speed).

---

## FIX 1.5 — Rewrite Executive Verdict prompt from "justify" to "evaluate"
**Defects resolved:** D5 (hallucination), H14 (generic moat regression), D3.5 (synthesis degradation discipline)
**Severity:** P0
**Effort:** Medium (1-2 hours)
**Depends on:** Fix 1.4

**File:** `src/coordinator.ts` lines 669-674

**Current prompt:**
```
System: "Write a concise 2-sentence Moat Rationale. Use professional, aggressive, insightful tone. Frame as a Tier-1 Consulting strategic verdict."
User: "Identify why "${topDimension[0]}" is the primary moat for ${orgName}."
```
This instructs the LLM to justify a predetermined conclusion.

**Required change:**
```
System: "You are a rigorous strategy analyst. Evaluate the provided moat candidates and write a 2-3 sentence strategic verdict. Be honest about moat strength — if no dimension represents a genuine defensible moat, say so. Use professional tone. Do not fabricate evidence or capabilities not present in the business context."

User: "Evaluate these moat candidates for ${orgName}:
${topThreeMoats.map(([dim, score]) => `- ${dim}: ${score}/100`).join('\n')}

Business context (first 800 chars):
${businessContext.slice(0, 800)}

Rules:
1. A moat must represent an ACTIVE competitive advantage, not merely the absence of a weakness.
2. If the business is pre-revenue or pre-launch, acknowledge that moats are aspirational, not established.
3. Do not claim 'sustained competitive advantage' unless evidence of 2+ year inimitability is present in the context.
4. Reference specific evidence from the business context, not generic strategy language.

Write 2-3 sentences identifying the strongest genuine moat, or stating that the business has not yet established a defensible moat."
```

**Acceptance criteria:**
- [ ] Verdict prompt receives top 3 moat candidates, not just top 1
- [ ] Prompt instructs evaluation, not justification
- [ ] Prompt includes thin-input degradation rule (pre-revenue acknowledgment)
- [ ] Prompt prohibits fabrication of evidence not in context
- [ ] Coffee shop audit produces a verdict acknowledging no established moat
- [ ] Halcyon audit produces a verdict referencing EMIR certification or risk engine (from clarifier input)

**Test:** Run both coffee shop and Halcyon scenarios. Coffee shop verdict should be cautious/honest. Halcyon verdict should reference specific moat evidence from the input.

---

## FIX 1.6 — Add post-synthesis coherence check
**Defects resolved:** D2 (cross-section contradiction)
**Severity:** P0
**Effort:** Medium (3-4 hours)

**File:** `src/coordinator.ts` — add new method after synthesis completes, before PDF generation

**Current flow:**
```
Specialists → Critic (intermediates only) → Parallel synthesis + roadmap → PDF
```

**Required flow:**
```
Specialists → Critic (intermediates) → Parallel synthesis + roadmap → POST-SYNTHESIS COHERENCE CHECK → PDF
```

**Implementation:**
Add a `runCoherenceCheck` method:

```typescript
async runCoherenceCheck(synthesisOutput: {
    executiveVerdict: string,
    executiveSynthesis: string,
    roadmap: string,
    ansoffVerdict: string,
    vrioVerdict: string,
    finalDimensions: Record<string, number>,
    topMoat: [string, number]
}): Promise<CoherenceResult> {
    const prompt = `You are a strategy report quality auditor. Check this report for internal contradictions.

EXECUTIVE VERDICT: ${synthesisOutput.executiveVerdict}
EXECUTIVE SYNTHESIS (first 2000 chars): ${synthesisOutput.executiveSynthesis.slice(0, 2000)}
ANSOFF VERDICT: ${synthesisOutput.ansoffVerdict}
VRIO VERDICT: ${synthesisOutput.vrioVerdict}
ROADMAP (first 1500 chars): ${synthesisOutput.roadmap.slice(0, 1500)}
TOP MOAT CLAIMED: ${synthesisOutput.topMoat[0]} (${synthesisOutput.topMoat[1]}/100)
DIMENSION SCORES: ${JSON.stringify(synthesisOutput.finalDimensions)}

Check for:
1. Does the Executive Verdict's moat claim align with the VRIO analysis?
2. Does the Ansoff verdict's recommended growth vector align with the Executive Synthesis's recommendation?
3. Does the roadmap's priority actions support the recommended strategic posture?
4. Are any dimension scores mentioned in the narrative that differ from the canonical scores above?
5. Are there mutually exclusive recommendations across sections?

Return JSON:
{
    "coherent": true/false,
    "contradictions": [{"sections": ["A", "B"], "issue": "...", "severity": "critical|warning"}],
    "score_mismatches": [{"dimension": "...", "canonical": N, "narrative_stated": N}]
}`;

    const result = await callGemini('gemini-2.5-flash', coherenceSystemPrompt, prompt);
    return robustParse(result);
}
```

If `coherent === false` with critical contradictions, either:
- Re-run the contradicting section with explicit instruction to align, OR
- Add a visible "Note: This report contains unresolved analytical tensions" disclaimer

**Acceptance criteria:**
- [ ] Coherence check runs after all synthesis sections complete, before PDF generation
- [ ] Contradictions between Synthesis and Ansoff are detected
- [ ] Score mismatches between narrative prose and canonical `finalDimensions` are detected
- [ ] Critical contradictions trigger re-synthesis or visible disclaimer

**Test:** Run an audit where the user provides three mutually exclusive strategic options (like Halcyon's three forks). The coherence check should flag if Synthesis recommends fork A while Ansoff recommends fork B.

---

## FIX 1.7 — Fix Monte Carlo display
**Defects resolved:** D4 (Monte Carlo display broken)
**Severity:** P0
**Effort:** Small-Medium (2-3 hours)

**File:** `src/services/monteCarloService.ts` lines ~40-78, `src/services/pdfService.ts` lines 794-885

**Current behaviour:**
- Real simulation runs (triangular distribution, 5K-10K iterations) ✓
- P10/P50/P90 computed correctly ✓
- `risk_drivers` variance contributions are HARDCODED ✗
- P10/P50/P90 values NOT rendered in PDF ✗
- Displayed "3800%" is likely 38 × 100 rendering bug ✗

**Required changes:**

**Part A — Fix variance computation in `monteCarloService.ts`:**
Replace hardcoded variance contributions with actual computed variance from samples:

```typescript
// Instead of:
{ factor: 'Churn Rate', variance_contribution: 38 }

// Compute actual variance contribution:
const churnVariance = variance(churn_samples);
const totalVariance = churnVariance + cacVariance + arpuVariance + growthVariance;
risk_drivers: [
    { factor: 'Churn Rate', variance_contribution: Math.round((churnVariance / totalVariance) * 100) },
    { factor: 'CAC', variance_contribution: Math.round((cacVariance / totalVariance) * 100) },
    // ...
]
```

**Part B — Surface P10/P50/P90 in PDF rendering in `pdfService.ts`:**
The simulation already computes these values. Add them to the Monte Carlo page:

```
LTV:CAC Ratio Distribution
P10 (pessimistic): X.Xx
P50 (base case): X.Xx  
P90 (optimistic): X.Xx

Key Risk Drivers (% of outcome variance):
Churn Rate: XX%
CAC: XX%
ARPU: XX%
Growth Rate: XX%
```

**Part C — Fix rendering multiplier:**
Find where `variance_contribution` value (e.g., 38) gets rendered as "3800%" and fix the formatting. Likely in `pdfService.ts` Monte Carlo section.

**Acceptance criteria:**
- [ ] Risk driver percentages are dynamically computed, not hardcoded
- [ ] Risk driver percentages sum to approximately 100%
- [ ] P10/P50/P90 values are visible in the PDF
- [ ] No value displays as "3800%" or similar inflated number
- [ ] Monte Carlo page includes the input assumptions used

**Test:** Run two audits with different financial profiles. Monte Carlo risk driver percentages should differ between them.

---

## FIX 1.8 — Fix "15-dimension" stale copy
**Defects resolved:** D9 (copy inconsistency)
**Severity:** P2 (quick win)
**Effort:** Tiny (5 minutes)

**File:** `frontend/src/components/HeroSection.tsx` line 450

**Current:**
```typescript
setPhaseLabel('Running 15-dimension diagnostic...');
```

**Change to:**
```typescript
setPhaseLabel('Running 20-dimension diagnostic...');
```

Also search for any other occurrences of "15-dimension", "15 dimension", "core 15" in the frontend and replace.

**Acceptance criteria:**
- [ ] No user-facing text mentions "15 dimensions"
- [ ] All references say "20 dimensions" or "20-dimension"

---

# PHASE 2 — STRATEGIC DECISION ENGINE (Week 2-4)

These fixes transform the product from a report generator into a decision system.

---

## FIX 2.1 — Make roadmap aware of synthesis output
**Defects resolved:** D2 (roadmap contradicts synthesis)
**Severity:** P0
**Effort:** Medium (2-3 hours)

**File:** `src/coordinator.ts` lines 603-623

**Current behaviour:** Roadmap runs in PARALLEL with Executive Synthesis. It never sees the recommended strategic posture.

**Required change:** Make roadmap run AFTER synthesis completes, receiving the synthesis output as context.

```typescript
// BEFORE (parallel):
const [reportResult, roadmapResult] = await Promise.all([
    this.runSynthesis(sharedContext),
    this.runRoadmap(sharedContext)
]);

// AFTER (sequential):
const reportResult = await this.runSynthesis(sharedContext);

// Extract recommended posture from synthesis
const strategicPosture = extractPosture(reportResult);

const roadmapResult = await this.runRoadmap({
    ...sharedContext,
    recommendedPosture: strategicPosture,
    synthesisExcerpt: reportResult.slice(0, 1500)
});
```

Update the roadmap prompt to include:

```
The Executive Synthesis has recommended the following strategic posture:
${recommendedPosture}

Your roadmap MUST align with this posture. Actions should:
1. Execute the recommended strategy
2. Mitigate the top identified risks
3. NOT contradict the recommended posture
4. Include at least one "Do Not Do" action
```

**Trade-off:** This adds ~15-30 seconds to total audit time (roadmap now waits for synthesis). Acceptable given the coherence improvement.

**Acceptance criteria:**
- [ ] Roadmap actions align with the synthesis recommendation
- [ ] Roadmap includes at least one explicit "Do Not Do" item
- [ ] No roadmap action contradicts the recommended strategic posture

---

## FIX 2.2 — Add mandatory Strategic Choice section
**Severity:** P1
**Effort:** Medium (3-4 hours)

**File:** `src/coordinator.ts` (synthesis prompt) + `src/services/pdfService.ts` (PDF rendering)

Add to the Executive Synthesis prompt:

```
After your analysis, you MUST include a section titled "## Strategic Choice" with this exact structure:

Recommended strategic posture: [one clear sentence]
Primary move: [the main action]
Secondary option: [fallback or hedge]
Controlled experiment: [one bounded test]
Rejected move: [what NOT to do, and why]
What would change this recommendation: [trigger conditions]
```

Add corresponding PDF section rendering in `pdfService.ts` after the Executive Synthesis section.

**Acceptance criteria:**
- [ ] Every audit includes a Strategic Choice section
- [ ] The section explicitly names a rejected move
- [ ] The section includes trigger conditions for changing the recommendation

---

## FIX 2.3 — Make clarifier questions input-adaptive
**Defects resolved:** D7 (fixed clarifier)
**Severity:** P1
**Effort:** Medium-Large (4-6 hours)

**File:** `src/agents/interrogator.ts`

**Current behaviour:**
```typescript
const FRAMEWORK_QUESTIONS: Record<number, string> = {
    0: "Who are your top 2–3 direct competitors...",
    1: "Is your primary growth focus...",
    2: "What is the single capability, asset, or relationship..."
};
```
3 hardcoded questions. Question 1 appears to be skipped (users see only Q0 and Q2).

**Required change:**

**Step 1:** Fix the turn counter so all 3 questions fire (if the skip is a bug) OR remove question 1 from the dictionary (if the skip is intentional).

**Step 2:** Replace hardcoded questions with LLM-generated questions based on input adequacy:

```typescript
async function generateClarifyingQuestions(
    userInput: string, 
    sector: string, 
    scale: string,
    turnCount: number
): Promise<string> {
    if (turnCount >= 3) return null; // Auditable

    const prompt = `Given this business description:
"${userInput.slice(0, 1000)}"

Sector: ${sector}
Scale: ${scale}

Identify the single most important missing piece of information that would improve the strategic audit quality. Ask ONE focused question to fill that gap.

Rules:
- Do NOT ask about competitors if the user already named them
- Do NOT ask about moats if the user already described defensibility
- Focus on the WEAKEST information area: financial metrics, competitive landscape, team, regulatory, or growth strategy
- Keep the question under 50 words`;

    return await callGemini('gemini-2.5-flash', systemPrompt, prompt);
}
```

**Acceptance criteria:**
- [ ] Clarifier questions adapt to the user's input
- [ ] If user already described competitors, the clarifier doesn't ask about competitors
- [ ] If financial data is missing, at least one question targets financials
- [ ] Users see 2-3 questions (not always exactly 2)

---

## FIX 2.4 — Add materiality-based risk selection for dashboard
**Severity:** P1
**Effort:** Small (1-2 hours)

**File:** `frontend/src/components/dashboard/KpiRow.tsx`

**Current behaviour:** "Key Risk" is selected as the dimension with the lowest score.

**Required change:** Import the dimension registry and select the most strategically material risk:

```typescript
// Instead of just min(scores):
// 1. Filter to dimensions where score < 50 (meaningful weakness)
// 2. Among those, prefer dimensions tagged isRiskDimension in the registry
// 3. Among remaining ties, prefer dimensions where the specialist flagged missing_signals
// 4. Display as "Most Material Risk" not "Key Risk"
```

**Acceptance criteria:**
- [ ] Dashboard card says "Most Material Risk" not "Key Risk"
- [ ] Risk selection considers materiality, not just lowest score
- [ ] ESG Posture at 15 is NOT shown as key risk for Halcyon (Geneva anchor loss or AI Act compliance should be)

---

# PHASE 3 — EVIDENCE, CONFIDENCE & SIMULATION (Week 4-6)

---

## FIX 3.1 — Build Sources Appendix
**Defects resolved:** D8 (Sources Appendix ghost)
**Severity:** P2
**Effort:** Medium (3-4 hours)
**Depends on:** Fix 1.1 (metadata preservation)

**File:** `src/services/pdfService.ts`

The specialist prompts already ask agents to extract `data_sources` and `missing_signals`. Fix 1.1 preserves these in `memory.specialistMetadata`. Now render them.

Add a new section in PDF generation:

```typescript
function renderSourcesAppendix(doc: PDFDocument, memory: AuditMemory) {
    doc.addPage();
    doc.fontSize(18).text('Evidence, Sources & Assumptions');
    
    // User-provided facts
    doc.fontSize(14).text('User-Provided Context');
    doc.fontSize(10).text(memory.businessContext?.slice(0, 500) || 'None provided');
    
    // Specialist data sources
    doc.fontSize(14).text('Data Sources by Specialist');
    for (const meta of memory.specialistMetadata || []) {
        doc.fontSize(12).text(meta.agent);
        for (const source of meta.data_sources || []) {
            doc.fontSize(10).text(`  - ${source}`);
        }
    }
    
    // Missing signals
    doc.fontSize(14).text('Missing Critical Signals');
    for (const meta of memory.specialistMetadata || []) {
        for (const signal of meta.missing_signals || []) {
            doc.fontSize(10).text(`  - [${meta.agent}] ${signal}`);
        }
    }
    
    // Confidence limitations
    doc.fontSize(14).text('Confidence Limitations');
    doc.fontSize(10).text('Scores are based on the information provided...');
}
```

Also: either remove "Sources Appendix" from the TOC if you want to defer this, or implement it. The TOC must not promise sections that don't exist.

**Acceptance criteria:**
- [ ] Sources Appendix appears in the PDF if data_sources are available
- [ ] TOC entry and actual section are consistent
- [ ] Missing signals from each specialist are listed

---

## FIX 3.2 — Implement confidence decay based on input adequacy
**Severity:** P1
**Effort:** Medium (3-4 hours)

**File:** `src/coordinator.ts` (post-specialist aggregation) + `frontend/src/components/dashboard/KpiRow.tsx`

After specialist metadata is collected, compute three confidence scores:

```typescript
function computeConfidence(specialistMetadata: SpecialistMeta[], finalDimensions: Record<string, number>): ConfidenceTriad {
    // Evidence Confidence: based on data completeness
    const totalMissingSignals = specialistMetadata
        .flatMap(m => m.missing_signals || []).length;
    const evidenceConfidence = Math.max(20, Math.min(95, 90 - (totalMissingSignals * 5)));
    
    // Analytical Confidence: based on specialist agreement
    const confidenceScores = specialistMetadata
        .map(m => m.confidence_score)
        .filter(c => c !== null && c > 0);
    const analyticalConfidence = confidenceScores.length > 0
        ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
        : 40;
    
    // Decision Confidence: min of the other two, capped by critical gaps
    const hasCriticalGap = totalMissingSignals > 5;
    const decisionConfidence = hasCriticalGap
        ? Math.min(55, Math.min(evidenceConfidence, analyticalConfidence))
        : Math.min(evidenceConfidence, analyticalConfidence);
    
    return { evidenceConfidence, analyticalConfidence, decisionConfidence };
}
```

Store in `memory.confidenceTriad`. Render in both web and PDF.

**Acceptance criteria:**
- [ ] Three distinct confidence values computed and stored
- [ ] Missing signals reduce Evidence Confidence (5 points per missing signal)
- [ ] Decision Confidence is capped at 55 if >5 critical signals are missing
- [ ] Frontend displays all three values with tooltips explaining each

---

## FIX 3.3 — Stress test scenario gating by venture type
**Defects resolved:** D6 (industry-agnostic stress tests), D13 (enterprise templates applied to cafe)
**Severity:** P1
**Effort:** Medium (3-4 hours)

**File:** Backend stress test route + stress test prompt

Create a scenario registry that maps to venture types:

```typescript
const STRESS_SCENARIOS: Record<string, StressScenario[]> = {
    'pre_revenue': [
        { name: 'Founder Departure', description: '...' },
        { name: 'Funding Drought', description: '...' },
        { name: 'Market Timing Miss', description: '...' },
    ],
    'growth': [
        { name: 'Economic Recession', description: '...' },
        { name: 'Competitor Price War', description: '...' },
        { name: 'Key Customer Loss', description: '...' },
        { name: 'Regulatory Crackdown', description: '...' },
    ],
    'scale_up': [
        { name: 'Economic Recession', description: '...' },
        { name: 'Competitor Price War', description: '...' },
        { name: 'Aggressive Scale-Up', description: '...' },
        { name: 'Global Talent Shortage', description: '...' },
        { name: 'Regulatory Crackdown', description: '...' },
    ],
    'enterprise': [
        // Same as scale_up but with more severe parameters
    ]
};
```

Select scenarios based on the user's scale selection from the form.

**Acceptance criteria:**
- [ ] A pre-revenue coffee shop does NOT get "Board demands 3x growth" or "Global Talent Shortage" scenarios
- [ ] Scenario descriptions reference the actual business context (e.g., "Key customer loss" for a business with disclosed concentration risk)

---

# PHASE 4 — QUICK WINS (Can be done in parallel with Phase 1)

These are independent, low-risk fixes that can ship immediately.

---

## FIX 4.1 — Suppress Express header
**File:** `src/index.ts`
```typescript
app.disable('x-powered-by');
```
**Effort:** 1 line, 30 seconds.

## FIX 4.2 — Front the API with a custom domain
Move from `business-strategy-api-845313668818.us-central1.run.app` to `api.velocitycso.com`.
**Effort:** Cloud Run domain mapping, 30 minutes.

## FIX 4.3 — Add OG meta tags for link previews
**File:** `index.html` (or add a server-rendered route for the homepage)
```html
<meta property="og:title" content="VelocityCSO - Strategy Intelligence" />
<meta property="og:description" content="AI-powered strategy audit. 20 dimensions. 7 frameworks. Board-ready." />
<meta property="og:image" content="https://velocitycso.com/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```
**Effort:** 15 minutes + design the OG image.

## FIX 4.4 — Add robots.txt and sitemap.xml
Currently all routes return the SPA shell. Add a static `robots.txt` and `sitemap.xml` served before the SPA catch-all.
**Effort:** 30 minutes.

## FIX 4.5 — Add requireAuth middleware to backend routes
The code references `requireAuth` but it's not actually protecting routes. Either implement it or remove the reference.
**Effort:** Depends on auth strategy decision. Flag for product decision.

---

# IMPLEMENTATION SEQUENCE

```
WEEK 1:
├── FIX 1.1 (robustParse metadata) — FOUNDATION, do first
├── FIX 1.2 (confidence display) — depends on 1.1
├── FIX 1.3 (dimension registry) — FOUNDATION, do second
├── FIX 1.4 (moat selection) — depends on 1.3
├── FIX 1.5 (verdict prompt rewrite) — depends on 1.4
├── FIX 1.8 (15-dimension copy) — independent, do anytime
└── FIX 4.1-4.4 (quick wins) — independent, do anytime

WEEK 2:
├── FIX 1.6 (post-synthesis coherence check) — depends on 1.5
├── FIX 1.7 (Monte Carlo display) — independent
├── FIX 2.1 (roadmap after synthesis) — depends on 1.6
└── FIX 2.4 (materiality-based risk) — depends on 1.3

WEEK 3-4:
├── FIX 2.2 (Strategic Choice section) — depends on 2.1
├── FIX 2.3 (adaptive clarifier) — independent
├── FIX 3.2 (confidence decay) — depends on 1.1
└── FIX 3.3 (stress test gating) — independent

WEEK 5-6:
├── FIX 3.1 (Sources Appendix) — depends on 1.1
└── FIX 2.2 refinement based on testing
```

---

# VERIFICATION PLAN

After all Phase 1 fixes ship, re-run these exact scenarios to verify:

| Scenario | What to verify |
|---|---|
| **Coffee shop** (thin input, pre-revenue) | Moat is NOT "Customer Concentration Risk". Verdict acknowledges no established moat. Confidence < 50%. Stress tests are pre-revenue appropriate. |
| **UdyamFlow** (mid-market fintech) | Moat references CA network specifically. Scores consistent across all sections. FLDG/ULI/DPDP referenced in regulatory section. Roadmap aligns with synthesis recommendation. |
| **Halcyon** (enterprise CTRM) | Moat references EMIR certification or risk engine. Customer Concentration Risk scored 50-70 (not as moat). Ansoff and Synthesis recommend same fork. Monte Carlo shows P10/P50/P90. Sources Appendix present. |
| **Anthropic** (known entity) | Confidence scores < 95% despite fame. Specialist confidence reflects actual missing signals. No "sustained competitive advantage" without evidence. |

---

# ARCHITECTURAL PRINCIPLE

Every fix in this document follows one rule:

> The renderer must not invent logic. It must only render the canonical strategy state.

The canonical strategy state is:
- `memory.dimensionScores` (locked at robustParse time)
- `memory.richDimensions` (locked at robustParse time)  
- `memory.specialistMetadata` (NEW — confidence, sources, gaps)
- `memory.confidenceTriad` (NEW — evidence, analytical, decision)
- `memory.strategicChoice` (NEW — recommended posture, rejected options)
- `DIMENSION_REGISTRY` (NEW — polarity, moat eligibility, categories)

No downstream agent, prompt, renderer, or frontend component should produce scores, confidence values, or strategic conclusions that don't derive from this state.
