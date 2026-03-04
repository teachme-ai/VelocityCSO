# Report UI Changes — v4.0 Analysis & Implementation Plan

> Source: Live source code analysis of velocitycso.com (React SPA, analysed via source code).
> Status: Backend is v4.0 (20 dimensions, 5 frameworks). Frontend partially updated.
> Author: Claude Code
> Date: 2026-03-04

---

## Fixes Already Applied (Do NOT re-apply)

| File | What changed |
|------|-------------|
| `frontend/src/components/StrategyRadar.tsx` | `outerRadius="30%"` → `"42%"`, label `fontSize: '8px'` → `'9px'` |
| `frontend/src/components/HeroSection.tsx` | Phase label `'Running 15-dimension diagnostic...'` → `'Running 20-dimension diagnostic...'` |
| `src/index.ts` | Both `REPORT_COMPLETE` SSE emissions now include `richDimensions` (was missing, causing Executive Actions section to always be empty) |

---

## Remaining Issues to Fix

### 1. DiagnosticScorecard — Always Hidden Until Stress Test
**Location:** `frontend/src/components/HeroSection.tsx` lines 651–681
**Problem:** The 20-dimension scorecard only renders when `stressResult !== null`. First-time users never see the full dimension breakdown.
**Fix:** Always render `DiagnosticScorecard` with the baseline dimensions. Move it into Zone 1 or add it as a default-visible panel in Zone 2.

```tsx
// CURRENT (broken): only shows when stress test ran
{stressResult ? (
    <DiagnosticScorecard dimensions={stressResult.stressedScores} ... />
) : (
    <EmptyPlaceholder /> // 400px of wasted space
)}

// DESIRED: always visible, enriched when stress test runs
<DiagnosticScorecard
    dimensions={stressResult ? stressResult.stressedScores : (result.dimensions || {})}
    originalDimensions={stressResult ? result.dimensions : undefined}
    richDimensions={result.richDimensions}
    onAreaClick={(dim) => console.log('Dimension:', dim)}
/>
```

---

### 2. No Overall Score KPI Strip (Above-the-Fold Priority)
**Location:** `frontend/src/components/HeroSection.tsx` — Zone 1 section
**Problem:** There is no prominent "Strategy Health" score. The average score exists inside the radar chart center (32px text, buried in a chart), invisible at first glance.
**Fix:** Add a 4-card KPI row immediately below the top bar, above Zone 1.

**New component:** `frontend/src/components/dashboard/KpiRow.tsx`

```tsx
// Props derived from result data
const overallScore = Math.round(
    Object.values(dimensions).reduce((a, b) => a + b, 0) / Object.values(dimensions).length
);
const topStrength = Object.entries(dimensions).sort((a, b) => b[1] - a[1])[0];
const keyRisk = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0];
const confidence = Object.values(richDimensions || {})
    .map((d: any) => d.confidence_score || 0)
    .reduce((a, b) => a + b, 0) / Math.max(Object.keys(richDimensions || {}).length, 1);
```

**KPI Row layout (4 cards, full width, above radar+summary grid):**
```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Strategy Health  │  Top Strength    │   Key Risk       │   Confidence     │
│   [score]/100   │  [dim name]      │  [dim name]      │    [%]           │
│ ●●●●●○○○○○      │  [score]/100     │  [score]/100     │  Specialist avg  │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

Score color: `#16a34a` ≥70, `#2563eb` 40-69, `#dc2626` <40.

---

### 3. No Tab Navigation — Single Flat Scroll
**Location:** `frontend/src/components/HeroSection.tsx` — the full report body
**Problem:** All zones stack vertically. Strategic Frameworks (Blue Ocean, Wardley, Monte Carlo etc.) are visible only after scrolling past two panels. The Dimension Matrix is hidden entirely.
**Fix:** Add 4-tab navigation below the top bar.

**Tab structure:**
```
[ Overview ] [ Dimension Matrix ] [ Strategic Frameworks ] [ Executive Synthesis ]
```

- **Overview**: KPI Row + Radar + ExecutiveSummaryCard + Risk Dashboard (always-visible DiagnosticScorecard)
- **Dimension Matrix**: Full expandable `DiagnosticScorecard` with richDimensions detail rows
- **Strategic Frameworks**: BlueOceanCanvas, FiveForces, WardleyMap, UnitEconomicsDashboard, MonteCarloChart
- **Executive Synthesis**: ReactMarkdown report

**New component:** `frontend/src/components/dashboard/ReportTabs.tsx`

```tsx
const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'matrix', label: 'Dimension Matrix' },
    { id: 'frameworks', label: 'Strategic Frameworks' },
    { id: 'synthesis', label: 'Executive Synthesis' },
] as const;

// Add to HeroSection state:
const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'frameworks' | 'synthesis'>('overview');
```

Animated underline: use Framer Motion `layoutId="tab-indicator"` on the active tab underline div.

---

### 4. Category Summary Strip — Missing
**Location:** `frontend/src/components/HeroSection.tsx` — after KPI row
**Problem:** No visual grouping of dimensions by category (Market, Strategy, Commercial, Operations, Finance). Category averages are not shown anywhere.
**Fix:** Add a 5-column strip between the KPI row and the radar+summary grid.

**New component:** `frontend/src/components/dashboard/CategorySummary.tsx`

```tsx
const CATEGORIES = {
    'Market':     ['TAM Viability', 'Target Precision', 'Trend Adoption', 'Team / Founder Strength'],
    'Strategy':   ['Competitive Defensibility', 'Model Innovation', 'Flywheel Potential', 'Network Effects Strength', 'Data Asset Quality'],
    'Commercial': ['Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed'],
    'Operations': ['Execution Speed', 'Scalability', 'ESG Posture', 'Regulatory Readiness'],
    'Finance':    ['ROI Projection', 'Risk Tolerance', 'Capital Efficiency', 'Customer Concentration Risk'],
};
// Category avg → score color → 5 columns, tappable to jump to that category in Dimension Matrix tab
```

---

### 5. RichDimensions Detail — Not Surfaced in UI
**Location:** `frontend/src/components/DiagnosticScorecard.tsx`
**Problem:** `richDimensions` contains `justification`, `improvement_action`, `key_assumption` fields from specialist CoT reasoning. These are passed via props but never rendered. The user never sees WHY a dimension got its score.
**Fix:** In `DiagnosticScorecard`, make each dimension row expandable. On click, reveal:
- `data.justification` — Why this score
- `data.improvement_action` — What to do about it
- `data.key_assumption` — Underlying assumption

```tsx
// In DiagnosticScorecard, for each dim row:
const rich = richDimensions?.[dim];
const [expanded, setExpanded] = useState(false);

// Expandable section:
{expanded && rich && (
    <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {rich.justification && <p style={{ fontSize: 11, color: '#9ca3af' }}>{rich.justification}</p>}
        {rich.improvement_action && (
            <p style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>▶ {rich.improvement_action}</p>
        )}
    </div>
)}
```

---

### 6. Executive Actions Section Always Empty
**Root cause:** Fixed in "Fixes Already Applied" section. Backend was omitting `richDimensions` from SSE.
**Verify:** After the fix, `result.richDimensions` will be populated, and `ExecutiveSummaryCard`'s "Critical Actions" section should render the 2 lowest-scoring dimension actions.
**No additional code change needed.**

---

### 7. Zone 2 — 400px Empty State Before Stress Test
**Location:** `frontend/src/components/HeroSection.tsx` lines 671–681
**Problem:** When no stress test has been run, Zone 2's right panel is a large empty `"Waiting for Stress Signal"` placeholder taking up 400px of vertical space.
**Fix:** Replace with the always-visible `DiagnosticScorecard` (fix #1 above). The scorecard shows baseline scores at rest, and switches to stressed vs baseline comparison when `stressResult` is set.

---

### 8. Synthesis Section — Dimension Score Table Leaking
**Location:** `frontend/src/components/HeroSection.tsx` — `sanitizeReport()` function
**Problem:** `sanitizeReport()` strips JSON and dimension score tables from the markdown. However if the LLM outputs `## Dimension Scores` with a different heading level (e.g. `### Dimension Scores`), the regex misses it and raw score lines appear in the synthesis.
**Fix:** Make the regex more robust:

```tsx
function sanitizeReport(text: string): string {
    return text
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*?\}/g, '')
        .replace(/```markdown/g, '')
        .replace(/```/g, '')
        .replace(/#{1,4}\s*Dimension Scores[\s\S]*$/im, '')  // any heading level
        .replace(/Dimension Scores:?[\s\S]*$/im, '')
        .trim();
}
```

---

## Implementation Order for AG

Execute in this sequence to minimize conflicts:

### Step 1 — Scorecard Always Visible (30 min)
**File:** `frontend/src/components/HeroSection.tsx`
Replace the `stressResult ? <DiagnosticScorecard> : <EmptyPlaceholder>` block (lines ~651–681) with an always-visible `DiagnosticScorecard` that receives baseline scores by default and stressed scores when available.

### Step 2 — sanitizeReport Fix (5 min)
**File:** `frontend/src/components/HeroSection.tsx`
Update the `sanitizeReport()` regex as shown above.

### Step 3 — RichDimensions in DiagnosticScorecard (45 min)
**File:** `frontend/src/components/DiagnosticScorecard.tsx`
Add expandable rows to each dimension. Clicking a row reveals `justification`, `improvement_action`, `key_assumption` from `richDimensions`.

### Step 4 — KPI Row Component (45 min)
**File:** `frontend/src/components/dashboard/KpiRow.tsx` (create new)
4-card strip: Strategy Health / Top Strength / Key Risk / Confidence.
Wire into `HeroSection.tsx` above Zone 1 grid.

### Step 5 — Category Summary Strip (30 min)
**File:** `frontend/src/components/dashboard/CategorySummary.tsx` (create new)
5-column category average strip below KPI row.
Wire into `HeroSection.tsx`.

### Step 6 — Tab Navigation (60 min)
**File:** `frontend/src/components/dashboard/ReportTabs.tsx` (create new)
4-tab nav with Framer Motion animated underline.
Add `activeTab` state to `HeroSection.tsx`.
Conditionally render each zone based on `activeTab`.

---

## Context for AG Prompt

Copy-paste context for AG to implement all steps:

```
TASK: Improve VelocityCSO report UI. The backend SSE now sends:
  { type: 'REPORT_COMPLETE', id, token, report, dimensions, richDimensions, frameworks, orgName, moatRationale }

richDimensions shape: Record<string, { score: number, justification: string, improvement_action: string, key_assumption?: string }>
frameworks shape: { blueOcean, fiveForces, unitEconomics, monteCarlo, wardley }
CATEGORIES (already defined in DiagnosticScorecard.tsx):
  Market: TAM Viability, Target Precision, Trend Adoption, Team / Founder Strength
  Strategy: Competitive Defensibility, Model Innovation, Flywheel Potential, Network Effects Strength, Data Asset Quality
  Commercial: Pricing Power, CAC/LTV Ratio, Market Entry Speed
  Operations: Execution Speed, Scalability, ESG Posture, Regulatory Readiness
  Finance: ROI Projection, Risk Tolerance, Capital Efficiency, Customer Concentration Risk

Score colors: green (#16a34a) ≥70, blue (#2563eb) 40-69, red (#dc2626) <40
Design system: bg #0a0a0f, cards zinc-900, accent violet #a855f7, emerald #10b981, amber #f59e0b

Implement steps in order:
1. [HEROSECTION] Always show DiagnosticScorecard (pass baseline dims, not just stress dims)
2. [HEROSECTION] Fix sanitizeReport() regex for dimension score tables
3. [DIAGNOSTICSCORECARD] Make each dimension row expandable — show justification + improvement_action from richDimensions
4. [NEW: dashboard/KpiRow.tsx] 4-stat card strip (Strategy Health, Top Strength, Key Risk, Confidence)
5. [NEW: dashboard/CategorySummary.tsx] 5-column category averages strip
6. [NEW: dashboard/ReportTabs.tsx + HEROSECTION] 4-tab layout: Overview / Dimension Matrix / Strategic Frameworks / Executive Synthesis

Files to read first:
- frontend/src/components/HeroSection.tsx (791 lines)
- frontend/src/components/DiagnosticScorecard.tsx
- frontend/src/components/ExecutiveSummaryCard.tsx
- plans/REPORT_UI_CHANGES.md (this file)
```

---

## Before / After Summary

| Area | Before | After |
|------|--------|-------|
| Radar size | `outerRadius="30%"` — tiny | `outerRadius="42%"` — readable ✅ Fixed |
| Dimension count | "15-dimension" label | "20-dimension" ✅ Fixed |
| richDimensions in SSE | Missing — always empty | Included ✅ Fixed |
| Overall score | Buried inside radar center | KPI row — above the fold |
| Dimension matrix | Only in stress test results | Always visible, expandable rows |
| Category view | Not present | 5-column category summary strip |
| Frameworks tab | Deep scroll Zone 3 | Tab 3 — always accessible |
| Synthesis tab | Deep scroll Zone 4 | Tab 4 — always accessible |
| Empty state | 400px "Waiting for Stress Signal" | DiagnosticScorecard with baseline |
| Score detail | Score number only | Expandable: justification + action |
