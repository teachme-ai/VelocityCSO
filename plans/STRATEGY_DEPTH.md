# Strategy Depth — Ansoff, VRIO, Scenario Planning

> **Goal:** Fill the three highest-value gaps in VelocityCSO's strategic framework coverage. All changes are prompt-only — no new agents, no new frontend components, no new endpoints. Pure intelligence upgrade to `src/specialists.ts` and the CSO synthesis prompt in `src/coordinator.ts`.
> **Can run in parallel with Phase 5** — no shared files with Phase 5 tasks.
> **Depends on:** Phase 3 (specialists established), STAGE_SECTOR_INTAKE (stage context available in prompts)
> **Estimated AG effort:** ~1.5 hours

---

## Why These Three

| Gap | Why It Matters | Where It Goes |
|-----|---------------|---------------|
| **Ansoff Matrix** | The universal "where do we grow?" tool. Market penetration vs. development vs. product development vs. diversification. Without it, the report can't answer the most fundamental board question. | `innovationAnalyst` prompt |
| **VRIO Framework** | Validates whether a claimed competitive advantage is actually sustainable. Supplements the Competitive Defensibility score with a structured 4-question test (Valuable, Rare, Inimitable, Organised). | `innovationAnalyst` prompt + `operationsAnalyst` prompt |
| **Scenario Planning** | Makes the synthesis forward-looking with 3 named futures (Base / Optimistic / Pessimistic) driven by the top 2 macro uncertainties. The Monte Carlo handles financial uncertainty; this handles strategic uncertainty. | CSO synthesis prompt in `coordinator.ts` |

---

## Task 1 — Ansoff Matrix in `innovationAnalyst`

### What to add to `src/specialists.ts` — `innovationAnalyst` instruction

Add this block after the Porter's Five Forces section, before `${COT_SCAFFOLD}`:

```typescript
// ADD to innovationAnalyst instruction, after Porter's Five Forces:

`ANSOFF MATRIX ANALYSIS
Assess which of the 4 growth vectors is the primary strategic opportunity for this business.
Score each vector's attractiveness (0-100). Higher = more viable given current position and context.

1. MARKET PENETRATION (existing product × existing market)
   Can they capture more share from current customers/segments without changing the product?
   Consider: pricing, distribution, marketing intensity, competitor displacement.

2. MARKET DEVELOPMENT (existing product × new market)
   Can they take what works today into a new geography, segment, or channel?
   Consider: international expansion, adjacent verticals, new distribution channels.

3. PRODUCT DEVELOPMENT (new product × existing market)
   Can they deepen wallet share with existing customers by adding adjacent offerings?
   Consider: upsell potential, platform expansion, API/ecosystem plays, AI-native features.

4. DIVERSIFICATION (new product × new market)
   Should they enter an entirely new space? Only viable if existing moat transfers.
   Consider: capability adjacency, M&A, strategic partnerships, platform pivots.

Identify the PRIMARY vector (highest-scoring) and explain the killer move for executing it.

OUTPUT in JSON:
"ansoffMatrix": {
  "market_penetration": { "score": 0-100, "rationale": "...", "killer_move": "..." },
  "market_development": { "score": 0-100, "rationale": "...", "killer_move": "..." },
  "product_development": { "score": 0-100, "rationale": "...", "killer_move": "..." },
  "diversification": { "score": 0-100, "rationale": "...", "killer_move": "..." },
  "primary_vector": "market_penetration | market_development | product_development | diversification",
  "strategic_verdict": "2-sentence summary of the dominant growth path and why"
}`
```

### Update the JSON output schema for `innovationAnalyst`

The existing `jsonInstruction` already allows extra fields. Just add `ansoffMatrix` alongside `portersFiveForces` in the instruction's output spec.

---

## Task 2 — VRIO Framework in `innovationAnalyst` and `operationsAnalyst`

### What to add to `innovationAnalyst` instruction

Add after Ansoff Matrix, before `${COT_SCAFFOLD}`:

```typescript
`VRIO FRAMEWORK ANALYSIS
For the business's PRIMARY claimed competitive advantage, evaluate it against all 4 VRIO criteria.
The advantage to evaluate = whatever scores highest in Competitive Defensibility context.

V — VALUABLE: Does this resource/capability allow the business to exploit opportunities or neutralise threats?
   Score 0-100. 0 = table stakes, 100 = eliminates an existential threat or unlocks transformational opportunity.

R — RARE: How many competitors currently possess this resource/capability?
   Score 0-100. 0 = commodity (everyone has it), 100 = unique (only this firm).

I — INIMITABLE: How costly/difficult is it for competitors to imitate or substitute?
   Score 0-100. 0 = can be copied in 3 months, 100 = structurally impossible (patent wall, network lock-in, decade of data).
   Consider: path dependency, causal ambiguity, social complexity.

O — ORGANISED: Is the business actually set up to capture the value from this resource?
   Score 0-100. 0 = capability exists but no process/team to exploit it, 100 = fully operationalised with dedicated team and KPIs.

VRIO VERDICT:
- All 4 high (>70): Sustained Competitive Advantage
- V+R+I high, O low: Temporary Advantage (not yet operationalised)
- V+R high, I+O low: Competitive Parity at risk
- Only V high: No advantage (valuable but not differentiated)

OUTPUT in JSON:
"vrioAnalysis": {
  "resource_evaluated": "name of the primary capability being evaluated",
  "valuable": { "score": 0-100, "evidence": "..." },
  "rare": { "score": 0-100, "evidence": "..." },
  "inimitable": { "score": 0-100, "evidence": "..." },
  "organised": { "score": 0-100, "evidence": "..." },
  "verdict": "Sustained Competitive Advantage | Temporary Advantage | Competitive Parity | No Advantage",
  "verdict_rationale": "2-sentence explanation"
}`
```

---

## Task 3 — Scenario Planning in CSO Synthesis (`coordinator.ts`)

### What to add to the `synthesisPrompt` in `src/coordinator.ts`

Add this section at the end of the `synthesisPrompt` string, before `YOUR TASK:`:

```typescript
// ADD to synthesisPrompt in coordinator.ts:

`SCENARIO PLANNING — MANDATORY SECTION
Based on the specialist analyses, identify the 2 highest-impact macro uncertainties facing this business.
Then define 3 named scenarios and assess the strategy's resilience under each.

MACRO UNCERTAINTIES: Pick 2 from the context (e.g. regulatory change, competitive entry, market contraction, technology shift, macro recession, demand acceleration).

SCENARIO 1 — BASE CASE (most likely, ~60% probability)
- Name: [descriptive label]
- Conditions: [what the world looks like]
- Strategy performance: GREEN | AMBER | RED
- Key risk in this scenario:
- Recommended pivot if this materialises:

SCENARIO 2 — OPTIMISTIC CASE (~25% probability)
- Name: [descriptive label]
- Conditions: [tailwinds, favourable dynamics]
- Strategy performance: GREEN | AMBER | RED
- How to accelerate advantage in this scenario:

SCENARIO 3 — STRESS CASE (~15% probability)
- Name: [descriptive label]
- Conditions: [headwinds, adverse dynamics]
- Strategy performance: GREEN | AMBER | RED
- Survival move: minimum viable strategic action to remain viable

RESILIENCE SCORE: 0-100 (how well does the strategy hold across all 3 scenarios?)

Include this as a dedicated "## Scenario Analysis" section in the markdown report.`
```

---

## Task 4 — Frontend: Surface Ansoff and VRIO in Frameworks Tab

The `frameworks` object in the SSE payload needs to include `ansoffMatrix` and `vrioAnalysis`. These come from `innovationAnalyst`'s output.

### `src/coordinator.ts` — extract from innovationResult

```typescript
// After Phase A runs, extract new framework outputs:
const frameworks = {
    blueOcean: blueOceanResult,
    fiveForces: innovationResult.portersFiveForces,
    ansoffMatrix: innovationResult.ansoffMatrix,      // ADD
    vrioAnalysis: innovationResult.vrioAnalysis,      // ADD
    unitEconomics: financeResult.unitEconomics,
    monteCarlo: monteCarloResult,
    wardley: wardleyResult
};
```

### New frontend components (lightweight — display only)

**`frontend/src/components/AnsoffMatrix.tsx`**
```tsx
// 2×2 grid, 4 cells colour-coded by score, primary vector highlighted
// Props: ansoffMatrix (from frameworks.ansoffMatrix)
// Render in Strategic Frameworks tab alongside BlueOceanCanvas
```

**`frontend/src/components/VrioCard.tsx`**
```tsx
// 4-row table: V / R / I / O with score bars and evidence
// Verdict badge at the top (colour-coded by verdict type)
// Props: vrioAnalysis (from frameworks.vrioAnalysis)
// Render in Strategic Frameworks tab
```

---

## Completion Checklist

- [ ] `innovationAnalyst` instruction includes Ansoff Matrix block with JSON output schema
- [ ] `innovationAnalyst` instruction includes VRIO block with JSON output schema
- [ ] CSO synthesis prompt includes Scenario Planning section
- [ ] `coordinator.ts` extracts `ansoffMatrix` and `vrioAnalysis` from `innovationResult` and includes in `frameworks`
- [ ] Both are included in `REPORT_COMPLETE` SSE payload (via `frameworks`)
- [ ] `AnsoffMatrix.tsx` component created and rendered in Strategic Frameworks tab
- [ ] `VrioCard.tsx` component created and rendered in Strategic Frameworks tab
- [ ] Scenario Analysis section appears in the synthesised markdown report
- [ ] System works correctly when `ansoffMatrix` or `vrioAnalysis` is null/absent (graceful degradation)

---

## AG Context Block

```
TASK: Add Ansoff Matrix, VRIO Framework, and Scenario Planning to VelocityCSO.
All changes are prompt-only except two lightweight new frontend components.

Files to read first:
- src/specialists.ts (innovationAnalyst instruction — add Ansoff + VRIO blocks)
- src/coordinator.ts (synthesisPrompt — add Scenario Planning; frameworks object — add ansoffMatrix + vrioAnalysis)
- frontend/src/components/HeroSection.tsx (Strategic Frameworks tab — add AnsoffMatrix + VrioCard)

Implement in order:
1. [specialists.ts] Add Ansoff Matrix analysis block to innovationAnalyst instruction.
   Output field: "ansoffMatrix" with 4 vector scores + primary_vector + strategic_verdict.

2. [specialists.ts] Add VRIO analysis block to innovationAnalyst instruction.
   Output field: "vrioAnalysis" with V/R/I/O scores + verdict + verdict_rationale.

3. [coordinator.ts / synthesisPrompt] Add Scenario Planning section at end of synthesis prompt.
   3 named scenarios (Base / Optimistic / Stress), resilience score, mandatory ## Scenario Analysis section.

4. [coordinator.ts / frameworks] Add ansoffMatrix and vrioAnalysis from innovationResult to frameworks object.
   Include in REPORT_COMPLETE SSE payload automatically (it's part of frameworks).

5. [NEW: AnsoffMatrix.tsx] 2×2 grid, cells colour-coded by score (green/blue/red), primary vector highlighted with violet border. Null-safe.

6. [NEW: VrioCard.tsx] 4-row table (V/R/I/O), score bar per row, verdict badge. Null-safe.

7. [HeroSection.tsx] Add <AnsoffMatrix> and <VrioCard> into the Strategic Frameworks tab, alongside existing FiveForces.

Score colours: green (#16a34a) ≥70, blue (#2563eb) 40-69, red (#dc2626) <40
Design system: bg #0a0a0f, cards zinc-900, accent violet #a855f7
```
