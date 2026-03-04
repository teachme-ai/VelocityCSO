# Live Audit Critique — VelocityCSO v4.0
> Business Input: "a platform for geriatric healthcare"
> Analysed by: Claude Code
> Date: 2026-03-04

---

## Executive Summary of Issues Found

The live audit revealed **5 backend bugs**, **3 data quality problems**, and **4 UX gaps**. Most critically: the overall score of 33/100 is **misleading** (caused by a zero-score data bug, not genuine poor performance), the org name extraction regex has a **known systematic failure mode**, and the moat rationale returned **fallback text** — meaning the moat agent silently failed.

---

## Backend Bugs

### BUG 1 — Org Name Extraction: Systematic Regex Failure
**File:** `src/coordinator.ts` line 508
**Severity:** High — affects every business description that starts with a lowercase article or preposition.

**Root cause:**
```typescript
const nameMatch = businessContext.match(/^([A-Z][a-zA-Z\s&]{2,40})/);
const orgName = nameMatch ? nameMatch[1].trim() : 'The Venture';
```
The regex requires the input to START with a capital letter. Any input that begins with `"a platform..."`, `"an AI-powered..."`, `"we help..."` etc. will always return `"The Venture"`.

**Observed output:** `org_name: "The Venture"` — shown in the moat rationale header ("The Venture's moat is…") and in the Firestore session record.

**Fix options (in order of preference):**

**Option A — NLP noun-phrase heuristic (zero-cost, immediate):**
```typescript
// Try to extract: "XYZ [is/for/that/—]" or "[a/an] XYZ platform"
function extractOrgName(context: string): string {
    // Pattern 1: Named entity — "VelocityCSO is a..." or "Medically Inc builds..."
    const namedEntity = context.match(/^([A-Z][a-zA-Z0-9\s&\-\.]{2,40}?)\s+(?:is|are|was|builds|provides|offers|helps)/);
    if (namedEntity) return namedEntity[1].trim();

    // Pattern 2: "a platform for X" → derive from the service noun
    const serviceNoun = context.match(/\b(?:platform|app|service|tool|system|marketplace|network)\s+for\s+([a-z\s]+?)(?:\.|,|that|which|$)/i);
    if (serviceNoun) return toTitleCase(serviceNoun[1].trim()) + ' Platform';

    // Pattern 3: "we help X" → derive from the domain
    const weHelp = context.match(/we help\s+([a-z\s]+?)(?:\s+to|\s+with|\.|,|$)/i);
    if (weHelp) return toTitleCase(weHelp[1].trim());

    return 'The Venture';
}
```

**Option B — LLM extraction (slightly slower, highest accuracy):**
Run a one-shot gemini-2.0-flash call before org name is set:
```
INPUT: "${businessContext.slice(0, 300)}"
Extract ONLY the company or product name. If none, return "The Venture". Return ONLY the name, no explanation.
```
Cache per session_id to avoid redundant calls.

---

### BUG 2 — Moat Rationale: Silent Empty Return
**File:** `src/coordinator.ts` lines 531–534
**Severity:** High — moat rationale is a prominent UI element; fallback text is generic and destroys credibility.

**Root cause:**
The moat agent `gemini-2.0-flash` called with the moat prompt returned an empty string. The code concatenates empty parts and `moatRationale` stays as `''`. The frontend then displays its own hardcoded fallback:
```tsx
{result.moatRationale || 'Top-tier competitive moat identified through asymmetric multi-agentic analysis.'}
```

**Why it returned empty:** The moat prompt template uses XML-style tags (`<role>`, `<task>`, `<context>`, `<constraint>`). Gemini 2.0 Flash sometimes treats these as instruction noise and returns nothing. More likely: the model returned the 2 sentences, but the stream events were only collected where `ev.author === 'moat_analyst'` — and if ADK emits the final turn under a different author, it's silently dropped.

**Fix:**
1. Add `isFinalResponse(ev)` to the moat stream collection (it's already imported, just not used here):
```typescript
for await (const ev of moatStream) {
    if (ev.author === 'moat_analyst' || isFinalResponse(ev)) {  // ADD isFinalResponse
        moatRationale += (ev.content?.parts || []).map((p: any) => p.text).join('');
    }
}
```
2. Add a non-empty guard before returning, with a retry:
```typescript
if (!moatRationale.trim()) {
    log({ severity: 'WARNING', message: 'Moat agent returned empty — using dimension-derived fallback', session_id: sessionId });
    moatRationale = `${orgName}'s primary competitive advantage is its ${topDimension[0]} (${topDimension[1]}/100), which positions it defensibly against well-funded incumbents. Sustained investment in this dimension represents the highest-leverage strategic priority.`;
}
```
This at least produces a context-aware fallback rather than a generic string.

---

### BUG 3 — Zero-Score Dimensions: Missing Data vs Poor Performance
**File:** `src/coordinator.ts` lines 313–321
**Severity:** High — directly causes misleading overall score.

**Root cause:**
`finalDimensions` is initialized with all 20 dimensions set to `0`. Specialists only write to dimensions within their domain. If a specialist's JSON output omits a dimension (e.g. `Team / Founder Strength` when no team info was provided), that dimension stays at 0. The frontend then averages all 20, including unscored zeros.

**Observed impact:** For the geriatric healthcare input:
- `Team / Founder Strength: 0/100` — dragged the overall from ~55 to ~33
- Several Finance dimensions also likely 0 due to insufficient financial context
- **33/100 displayed to user is not the actual business quality** — it's an artifact of missing data

**Fix — Use `null` for unscored dimensions:**
```typescript
const finalDimensions: Record<string, number | null> = {
    'TAM Viability': null, 'Target Precision': null, 'Trend Adoption': null,
    'Competitive Defensibility': null, 'Model Innovation': null, 'Flywheel Potential': null,
    'Pricing Power': null, 'CAC/LTV Ratio': null, 'Market Entry Speed': null,
    'Execution Speed': null, 'Scalability': null, 'ESG Posture': null,
    'ROI Projection': null, 'Risk Tolerance': null, 'Capital Efficiency': null,
    'Team / Founder Strength': null, 'Network Effects Strength': null,
    'Data Asset Quality': null, 'Regulatory Readiness': null, 'Customer Concentration Risk': null
};
```

Then compute the average ONLY over non-null dimensions:
```typescript
// Frontend: in KpiRow or wherever avg is computed
const scoredDimensions = Object.values(dimensions).filter(v => v !== null && v !== undefined);
const avgScore = Math.round(scoredDimensions.reduce((a, b) => a + b, 0) / scoredDimensions.length);
const unscoredCount = Object.values(dimensions).filter(v => v === null).length;
```

Display: `55/100 (18 of 20 dimensions scored)` — transparent and accurate.

In `DiagnosticScorecard`, unscored dimensions should show a grey `N/A` bar, not a 0/100 red bar.

---

### BUG 4 — Stale Heartbeat Messages (15-dimension)
**File:** `src/coordinator.ts` lines 444, 470
**Severity:** Low — cosmetic, but undermines trust in live phase indicator.

```typescript
// Line 444:
emitHeartbeat(sessionId, '◆ CSO: Initializing strategic synthesis of 15-dimension matrix...');

// Line 470:
emitHeartbeat(sessionId, '◆ CSO: merging 15-dimension matrix...');
```

**Fix:** Change both to `20-dimension matrix`.

---

### BUG 5 — Monte Carlo / Unit Economics: Silent Null, No Placeholder
**File:** `src/coordinator.ts` lines 390–406
**Severity:** Medium — framework sections disappear without explanation.

**Root cause:**
`monteCarloResult = null` when `financeResult.monteCarloInputs` is falsy (missing financial data in input).
`unitEconomics: financeResult.unitEconomics` — `undefined` when finance specialist didn't return it.

The frontend conditionally renders these frameworks:
```tsx
{frameworks.monteCarlo && <MonteCarloChart ... />}
{frameworks.unitEconomics && <UnitEconomicsDashboard ... />}
```
When the data is absent, these sections simply don't appear — no indication to the user that they were attempted or why they're missing.

**Fix options:**
1. Backend: Return a `{ _unavailable: true, reason: 'Insufficient financial context provided' }` marker object instead of `null`. Frontend can detect `_unavailable` and render a placeholder card.
2. Frontend only: Show a locked/greyed placeholder card when the data is null:
```tsx
{frameworks.monteCarlo ? (
    <MonteCarloChart data={frameworks.monteCarlo} />
) : (
    <div style={{ /* placeholder card */ }}>
        <span>Monte Carlo Simulation</span>
        <p style={{ fontSize: 12, color: '#6b7280' }}>Requires revenue, CAC, and churn data to model</p>
    </div>
)}
```

---

## UX Issues

### UX 1 — Score Label: No Context for Low Score
The `33/100` overall score has no accompanying explanation. A first-time user will assume this reflects poor business quality. There is no caveat that it partially reflects missing input data.

**Fix:** Add a subtitle under the score KPI:
- If unscored dimensions exist: `"33/100 · 18 of 20 dimensions scored"`
- If all scored but genuinely low: `"33/100 · All dimensions scored"`

---

### UX 2 — No Tab Navigation (Already Documented)
Strategic Frameworks are only accessible after heavy scrolling. Documented in `REPORT_UI_CHANGES.md` — Step 6.

---

### UX 3 — "CSO v2.5" Badge Mismatch
The report shows `"Asymmetric Advantage Analysis · CSO v2.5"`. The backend is v4.0. This is a string constant somewhere in `HeroSection.tsx` or `ExecutiveSummaryCard.tsx`.

**Fix:** Update to `"CSO v4.0 · 20-Dimension Strategic Audit"`.

---

### UX 4 — Radar: 20 Axes Too Dense for 360px Container
With `outerRadius="42%"` the labels are still tight at 20 axes. The abbreviation map (`TAM`, `Def`, `LTV` etc.) helps, but on mobile the chart is unreadable.

**Fix options:**
1. On mobile (`< 640px`): hide the radar chart and show only the `DiagnosticScorecard` table.
2. Or: Use `outerRadius="38%"` and increase the chart container to `min-height: 360px`, center-align within a `max-width: 500px` container.

---

## Summary Table

| # | Area | Issue | Severity | Fix Location |
|---|------|--------|----------|-------------|
| 1 | Backend | Org name regex fails for lowercase input | High | `coordinator.ts:508` |
| 2 | Backend | Moat agent returns empty — shows generic fallback | High | `coordinator.ts:531` |
| 3 | Backend | Zero-score dimensions inflate low scores | High | `coordinator.ts:313` + frontend average logic |
| 4 | Backend | Stale "15-dimension" heartbeat messages | Low | `coordinator.ts:444, 470` |
| 5 | Backend | Monte Carlo/Unit Economics null = invisible, no placeholder | Medium | `coordinator.ts:390` + HeroSection |
| 6 | UX | No score context (N of 20 dimensions scored) | Medium | KpiRow component (new) |
| 7 | UX | No tab navigation | High | `REPORT_UI_CHANGES.md` Step 6 |
| 8 | UX | "CSO v2.5" version string stale | Low | HeroSection or ExecutiveSummaryCard |
| 9 | UX | Radar 20 axes too dense on mobile | Medium | StrategyRadar + responsive CSS |

---

## Implementation Order for AG

### Priority 1 — Data Correctness (Do First)
1. `coordinator.ts:508` — Replace org name regex with `extractOrgName()` heuristic function
2. `coordinator.ts:531` — Add `isFinalResponse(ev)` to moat stream + non-empty guard with context-aware fallback
3. `coordinator.ts:313` — Initialize `finalDimensions` with `null` values; update `Object.assign` to skip `null` (let specialists write their own scores, others stay null)

### Priority 2 — Cosmetic Backend
4. `coordinator.ts:444, 470` — Change "15-dimension" to "20-dimension" in both heartbeats

### Priority 3 — UX
5. KpiRow: Show `avgScore (N of 20 scored)` subtitle when unscored dimensions exist
6. DiagnosticScorecard: Render unscored dimensions as grey `N/A` bars, not red 0/100
7. Frameworks section: Add placeholder cards for null Monte Carlo / Unit Economics
8. Update "CSO v2.5" badge string to "CSO v4.0"
9. Radar responsive: hide on mobile or increase min-height + max-width

---

## AG Context Block

```
TASK: Fix live audit bugs identified in VelocityCSO v4.0.

Critical files:
- src/coordinator.ts — backend orchestration (org name, moat, dimensions)
- frontend/src/components/HeroSection.tsx — report display
- frontend/src/components/DiagnosticScorecard.tsx — dimension rows
- frontend/src/components/dashboard/KpiRow.tsx — score strip (to be created)

Bug fixes to implement IN ORDER:

1. [coordinator.ts:508] Replace org name regex:
   OLD: const nameMatch = businessContext.match(/^([A-Z][a-zA-Z\s&]{2,40})/);
   NEW: Use extractOrgName() heuristic (see patterns in LIVE_AUDIT_CRITIQUE.md)

2. [coordinator.ts:531] Moat stream fix:
   Add isFinalResponse(ev) to the moat stream collection loop.
   Add empty guard: if (!moatRationale.trim()) { generate context-aware fallback from topDimension }

3. [coordinator.ts:313-321] Null-initialized dimensions:
   Change all 0 → null in finalDimensions initialization.
   Update robustParse() to skip null during Object.assign.
   In frontend KpiRow: compute avg only over non-null dimensions. Display "55/100 · 18 of 20 scored".

4. [coordinator.ts:444, 470] Update "15-dimension" → "20-dimension" in both heartbeat strings.

5. [DiagnosticScorecard] Render null dimensions as grey "N/A" row, not red 0/100 bar.

6. [HeroSection or wherever "CSO v2.5" appears] Update to "CSO v4.0".

7. [HeroSection frameworks section] Add placeholder cards for null monteCarlo and unitEconomics.
```
