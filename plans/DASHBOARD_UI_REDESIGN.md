# VelocityCSO — Professional Dashboard Redesign

> **Based on:** Direct source code analysis of all frontend components.
> **Purpose:** Transform the current report from a scrolling narrative into a command-center dashboard.
> **For AG:** This is a standalone UI overhaul. Implement after Phase 1 Foundation is complete.

---

## Current State — Honest Assessment

### What Works Well
- Dark space theme (`#0a0a0f`) with violet/emerald accents is distinctive and premium-looking
- Framer Motion animations are smooth and purposeful
- The processing/clarification flow is genuinely novel and well-designed
- `ExecutiveSummaryCard` has a solid base structure
- Radar chart concept is right for 15 dimensions

### Critical Problems

| Problem | Impact |
|---------|--------|
| **No overall score KPI** — the radar shows an avg score buried as a label | Users can't instantly understand performance |
| **DiagnosticScorecard is hidden** — only appears when a stress test runs | The core 15-dimension matrix is invisible on load |
| **Report is one long scroll** — no navigation structure | Users lose orientation in a long markdown wall |
| **Radar chart is tiny** — `outerRadius="30%"` with 8px font labels | Dimension labels are unreadable |
| **No category summary** — 15 dimensions with no grouping visible at top level | No quick pattern recognition |
| **Markdown synthesis has no visual treatment** — raw text in one block | Looks like a document, not a product |
| **No risk flags/callouts** — critical weak dimensions not surfaced visually | Risk buried in the scroll |
| **Zero empty state in Zone 1** — radar and summary card appear immediately but look sparse without data | Jarring on slower connections |
| **Report header is minimal** — just a title + PDF button | No branding, no context |
| **No tab/section navigation** — 3 zones in one page, no way to jump | Professional tools have nav |

---

## Proposed Dashboard Layout

### Full Layout Structure (when report is shown)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOP BAR                                                                     │
│  ◉ VelocityCSO  │  Acme Corp                  │  [↓ PDF]  [Share]  [✕]     │
├─────────────────────────────────────────────────────────────────────────────┤
│  KPI ROW (4 cards)                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ STRATEGY     │ │ TOP STRENGTH │ │ KEY RISK     │ │ CONFIDENCE   │       │
│  │ HEALTH       │ │              │ │              │ │              │       │
│  │   72 / 100   │ │ Model Innov. │ │ CAC/LTV      │ │   HIGH       │       │
│  │  ████░░ 72%  │ │    88 ↑      │ │    34 ↓      │ │   ID: 91     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAB NAV                                                                     │
│  [ Overview ]  [ Dimension Matrix ]  [ Risk Analysis ]  [ Synthesis ]       │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAB: OVERVIEW                                                               │
│                                                                              │
│  ┌───────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │ RADAR CHART (larger)          │  │ EXECUTIVE SUMMARY                 │  │
│  │                               │  │                                   │  │
│  │     ·  Market  ·             │  │ "Acme Corp demonstrates..."       │  │
│  │    / ·  Ops  · \            │  │                                   │  │
│  │   |  [FILLED]   |           │  │  Market     ████████ 74           │  │
│  │    \ ·  Fin  · /            │  │  Strategy   ██████░░ 62           │  │
│  │     ·  Strat ·              │  │  Commercial ███████░ 71           │  │
│  │                               │  │  Operations ████████ 79           │  │
│  │   avg: 72/100                 │  │  Finance    █████░░░ 55           │  │
│  └───────────────────────────────┘  │                                   │  │
│                                      │  Core Moats ───────────────────   │  │
│                                      │  ① Model Innovation  88          │  │
│                                      │  ② Flywheel Potential  82        │  │
│                                      │  ③ Execution Speed  79           │  │
│                                      └───────────────────────────────────┘  │
│                                                                              │
│  CATEGORY SCORE STRIP                                                       │
│  Market 74  │  Strategy 62  │  Commercial 71  │  Operations 79  │  Fin 55  │
│  ──────────────────────────────────────────────────────────────────────────│
│  STRATEGIC ACTIONS PREVIEW (top 3 recommendations)                          │
│  ▶ Deepen CAC efficiency — target LTV:CAC > 3.0 before Series A            │
│  ▶ Accelerate Flywheel via network effect monetisation                      │
│  ▶ Commission formal TAM segmentation (bottom-up)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAB: DIMENSION MATRIX                                                       │
│                                                                              │
│  Full 15-row DiagnosticScorecard (always visible, richer design)            │
│  + sortable by score, filterable by category                                │
│  + each row is expandable to show justification + improvement action        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAB: RISK ANALYSIS                                                          │
│                                                                              │
│  Current stress chamber (moved here from Zone 2)                            │
│  + Stress comparison radar overlay                                           │
│  + Risk propagation matrix                                                   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  TAB: SYNTHESIS                                                              │
│                                                                              │
│  Structured executive report (styled sections, not a markdown wall)         │
│  + Section anchors                                                           │
│  + Asymmetric plays highlighted as callout cards                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Tokens (no changes to existing colors)

```typescript
// Keep existing color system — these are the confirmed tokens in use
export const TOKENS = {
  // Backgrounds
  bg: {
    base: '#0a0a0f',
    card: 'rgba(24,24,27,0.5)',       // zinc-900/50
    cardHover: 'rgba(24,24,27,0.7)',
    glass: 'rgba(255,255,255,0.03)',
  },
  // Borders
  border: {
    default: 'rgba(63,63,70,0.5)',    // zinc-800/50
    subtle: 'rgba(255,255,255,0.06)',
    active: 'rgba(168,85,247,0.4)',   // violet-500/40
  },
  // Scores → color
  score: {
    high: '#16a34a',    // green-600   ≥ 70
    mid: '#2563eb',     // blue-600    40-69
    low: '#dc2626',     // red-600     < 40
    highBg: 'rgba(22,163,74,0.1)',
    midBg: 'rgba(37,99,235,0.1)',
    lowBg: 'rgba(220,38,38,0.1)',
  },
  // Accent
  accent: {
    violet: '#a855f7',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
  },
};

export function scoreColor(score: number): string {
  if (score >= 70) return TOKENS.score.high;
  if (score >= 40) return TOKENS.score.mid;
  return TOKENS.score.low;
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 65) return 'Developing';
  if (score >= 50) return 'Moderate';
  if (score >= 35) return 'Weak';
  return 'Critical';
}
```

---

## New Components to Create

### 1. `frontend/src/components/dashboard/KpiRow.tsx`

Four stat cards shown immediately above the tabs.

```typescript
// frontend/src/components/dashboard/KpiRow.tsx
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Shield, Activity } from 'lucide-react';
import { scoreColor, scoreLabel } from '../tokens';

interface KpiRowProps {
  dimensions: Record<string, number>;
  confidenceScore?: number;
}

function getOverallScore(dims: Record<string, number>): number {
  const vals = Object.values(dims);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function KpiRow({ dimensions, confidenceScore }: KpiRowProps) {
  const entries = Object.entries(dimensions);
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const overall = getOverallScore(dimensions);
  const topStrength = sorted[0];
  const keyRisk = sorted[sorted.length - 1];
  const confidenceLabel = (confidenceScore ?? 0) >= 80 ? 'High' : (confidenceScore ?? 0) >= 60 ? 'Medium' : 'Low';
  const confidenceColor = (confidenceScore ?? 0) >= 80 ? '#10b981' : (confidenceScore ?? 0) >= 60 ? '#f59e0b' : '#f43f5e';

  const cards = [
    {
      label: 'Strategy Health',
      value: `${overall}`,
      sub: scoreLabel(overall),
      icon: <Activity className="w-4 h-4" />,
      color: scoreColor(overall),
      bar: overall,
    },
    {
      label: 'Top Strength',
      value: topStrength?.[1] ?? 0,
      sub: topStrength?.[0] ?? '—',
      icon: <TrendingUp className="w-4 h-4" />,
      color: '#10b981',
      trend: 'up',
    },
    {
      label: 'Key Risk',
      value: keyRisk?.[1] ?? 0,
      sub: keyRisk?.[0] ?? '—',
      icon: <TrendingDown className="w-4 h-4" />,
      color: '#f43f5e',
      trend: 'down',
    },
    {
      label: 'Confidence',
      value: confidenceLabel,
      sub: `ID Score: ${confidenceScore ?? '—'}`,
      icon: <Shield className="w-4 h-4" />,
      color: confidenceColor,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-7xl mx-auto w-full">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 flex flex-col gap-2 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">{card.label}</span>
            <span style={{ color: card.color }}>{card.icon}</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold font-mono" style={{ color: card.color }}>
              {card.value}
            </span>
            {typeof card.value === 'number' && (
              <span className="text-xs text-zinc-500 pb-0.5">/100</span>
            )}
          </div>
          {card.bar !== undefined && (
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${card.bar}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.07 + 0.2 }}
                className="h-full rounded-full"
                style={{ backgroundColor: card.color }}
              />
            </div>
          )}
          <span className="text-[11px] text-zinc-500 truncate">{card.sub}</span>
        </motion.div>
      ))}
    </div>
  );
}
```

---

### 2. `frontend/src/components/dashboard/CategorySummary.tsx`

Horizontal strip showing average score per category.

```typescript
// frontend/src/components/dashboard/CategorySummary.tsx
import { motion } from 'framer-motion';
import { scoreColor } from '../tokens';

// Must match DiagnosticScorecard CATEGORIES
const CATEGORIES: Record<string, string[]> = {
  Market:     ['TAM Viability', 'Target Precision', 'Trend Adoption'],
  Strategy:   ['Competitive Defensibility', 'Model Innovation', 'Flywheel Potential'],
  Commercial: ['Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed'],
  Operations: ['Execution Speed', 'Scalability', 'ESG Posture'],
  Finance:    ['ROI Projection', 'Risk Tolerance', 'Capital Efficiency'],
};

interface CategorySummaryProps {
  dimensions: Record<string, number>;
}

export function CategorySummary({ dimensions }: CategorySummaryProps) {
  const catScores = Object.entries(CATEGORIES).map(([cat, dims]) => {
    const scores = dims.map(d => dimensions[d] ?? 0);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { cat, avg, color: scoreColor(avg) };
  });

  return (
    <div className="flex items-stretch gap-0 rounded-xl overflow-hidden border border-zinc-800/50 max-w-7xl mx-auto w-full">
      {catScores.map(({ cat, avg, color }, i) => (
        <motion.div
          key={cat}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 + 0.3 }}
          className="flex-1 flex flex-col items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors cursor-default border-r border-zinc-800/40 last:border-r-0 group"
        >
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 group-hover:text-zinc-400 transition-colors">{cat}</span>
          <span className="text-xl font-bold font-mono my-1" style={{ color }}>{avg}</span>
          {/* mini bar */}
          <div className="w-full h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${avg}%` }}
              transition={{ duration: 0.8, delay: i * 0.05 + 0.5 }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

---

### 3. `frontend/src/components/dashboard/ReportTabs.tsx`

Tab navigation component for the report.

```typescript
// frontend/src/components/dashboard/ReportTabs.tsx
import { motion } from 'framer-motion';

export type ReportTab = 'overview' | 'dimensions' | 'risk' | 'synthesis';

interface ReportTabsProps {
  active: ReportTab;
  onChange: (tab: ReportTab) => void;
  hasStressResult?: boolean;
}

const TABS: { id: ReportTab; label: string; badge?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'dimensions', label: 'Dimension Matrix' },
  { id: 'risk', label: 'Risk Analysis' },
  { id: 'synthesis', label: 'Executive Synthesis' },
];

export function ReportTabs({ active, onChange, hasStressResult }: ReportTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-zinc-800/50 max-w-7xl mx-auto w-full px-0">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
            active === tab.id
              ? 'text-white'
              : 'text-zinc-600 hover:text-zinc-300'
          }`}
        >
          {tab.label}
          {tab.id === 'risk' && hasStressResult && (
            <span className="ml-1.5 inline-flex items-center justify-center w-2 h-2 rounded-full bg-rose-500" />
          )}
          {active === tab.id && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
            />
          )}
        </button>
      ))}
    </div>
  );
}
```

---

### 4. `frontend/src/components/dashboard/RichDimensionMatrix.tsx`

Enhanced version of `DiagnosticScorecard` — always visible, expandable rows.

```typescript
// frontend/src/components/dashboard/RichDimensionMatrix.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp } from 'lucide-react';
import { scoreColor, scoreLabel } from '../tokens';

const CATEGORIES: Record<string, string[]> = {
  Market:     ['TAM Viability', 'Target Precision', 'Trend Adoption'],
  Strategy:   ['Competitive Defensibility', 'Model Innovation', 'Flywheel Potential'],
  Commercial: ['Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed'],
  Operations: ['Execution Speed', 'Scalability', 'ESG Posture'],
  Finance:    ['ROI Projection', 'Risk Tolerance', 'Capital Efficiency'],
};

interface DimData {
  score: number;
  justification?: string;
  improvement_action?: string;
}

interface RichDimensionMatrixProps {
  dimensions: Record<string, number | DimData>;
  originalDimensions?: Record<string, number>;
}

function getScore(val: number | DimData): number {
  return typeof val === 'number' ? val : val.score;
}

export function RichDimensionMatrix({ dimensions, originalDimensions }: RichDimensionMatrixProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'category' | 'score' | 'drop'>('category');

  const isStressMode = !!originalDimensions;

  // Flatten all dims with their scores for sorting
  const allDims = Object.entries(CATEGORIES).flatMap(([cat, dims]) =>
    dims.map(dim => ({
      dim,
      cat,
      score: getScore(dimensions[dim] ?? 0),
      baseline: originalDimensions?.[dim] ?? getScore(dimensions[dim] ?? 0),
      drop: (originalDimensions?.[dim] ?? getScore(dimensions[dim] ?? 0)) - getScore(dimensions[dim] ?? 0),
      detail: typeof dimensions[dim] === 'object' ? dimensions[dim] as DimData : null,
    }))
  );

  const sorted = [...allDims].sort((a, b) => {
    if (sortBy === 'score') return b.score - a.score;
    if (sortBy === 'drop') return b.drop - a.drop;
    return 0; // category order preserved
  });

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Sort controls */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Sort:</span>
        {(['category', 'score', 'drop'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors ${
              sortBy === s ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            {s === 'drop' ? 'Stress Drop' : s}
          </button>
        ))}
      </div>

      {/* Dim rows grouped by category (if sort = category) or flat */}
      {sortBy === 'category'
        ? Object.entries(CATEGORIES).map(([cat, dims]) => (
          <div key={cat} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">{cat}</span>
              <div className="flex-1 h-px bg-zinc-800/50" />
            </div>
            {dims.map(dim => (
              <DimRow
                key={dim}
                dim={dim}
                score={getScore(dimensions[dim] ?? 0)}
                baseline={originalDimensions?.[dim]}
                detail={typeof dimensions[dim] === 'object' ? dimensions[dim] as DimData : null}
                isExpanded={expanded === dim}
                onExpand={() => setExpanded(expanded === dim ? null : dim)}
                isStressMode={isStressMode}
              />
            ))}
          </div>
        ))
        : sorted.map(({ dim, score, baseline, detail }) => (
          <DimRow
            key={dim}
            dim={dim}
            score={score}
            baseline={baseline}
            detail={detail}
            isExpanded={expanded === dim}
            onExpand={() => setExpanded(expanded === dim ? null : dim)}
            isStressMode={isStressMode}
          />
        ))
      }
    </div>
  );
}

interface DimRowProps {
  dim: string;
  score: number;
  baseline?: number;
  detail: { justification?: string; improvement_action?: string } | null;
  isExpanded: boolean;
  onExpand: () => void;
  isStressMode: boolean;
}

function DimRow({ dim, score, baseline, detail, isExpanded, onExpand, isStressMode }: DimRowProps) {
  const color = scoreColor(score);
  const drop = baseline !== undefined ? baseline - score : 0;
  const isDropped = isStressMode && drop > 15;
  const hasDetail = !!(detail?.justification || detail?.improvement_action);

  return (
    <div className="mb-2">
      <div
        className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200 ${
          isDropped
            ? 'bg-rose-500/5 border border-rose-500/15'
            : 'hover:bg-white/[0.02] border border-transparent'
        } ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={hasDetail ? onExpand : undefined}
      >
        {/* Status indicator */}
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

        {/* Dim name */}
        <span className={`text-xs flex-shrink-0 w-44 truncate ${isDropped ? 'text-amber-400 font-semibold' : 'text-zinc-400'}`}>
          {isDropped && <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />}
          {dim}
        </span>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden relative">
          {/* Baseline (stress mode) */}
          {isStressMode && baseline !== undefined && (
            <div
              className="absolute top-0 left-0 h-full rounded-full opacity-25"
              style={{ width: `${baseline}%`, backgroundColor: color }}
            />
          )}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>

        {/* Score */}
        <span className="text-xs font-mono w-7 text-right flex-shrink-0 font-bold" style={{ color }}>
          {score}
        </span>

        {/* Score label */}
        <span className="text-[10px] w-16 text-right flex-shrink-0 text-zinc-600 hidden md:block">
          {scoreLabel(score)}
        </span>

        {/* Stress drop */}
        {isStressMode && drop > 0 && (
          <span className="text-[10px] text-rose-400 w-10 text-right flex-shrink-0 font-mono">
            ↓{drop}
          </span>
        )}

        {/* Expand chevron */}
        {hasDetail && (
          <span className="text-zinc-700 flex-shrink-0">
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        )}
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {isExpanded && detail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 px-4 py-3 bg-zinc-900/60 rounded-lg border border-zinc-800/50 space-y-2">
              {detail.justification && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Rationale</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{detail.justification}</p>
                </div>
              )}
              {detail.improvement_action && (
                <div className="border-t border-zinc-800/50 pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-violet-600 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Action
                  </p>
                  <p className="text-xs text-violet-300/80 leading-relaxed">{detail.improvement_action}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

### 5. `frontend/src/components/dashboard/StrategicActions.tsx`

Surfaces the top 3 recommendations from the synthesis text as visual cards.

```typescript
// frontend/src/components/dashboard/StrategicActions.tsx
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface StrategicActionsProps {
  synthesisMarkdown: string;
  onViewFull: () => void;
}

// Extract bullet points or numbered items from the synthesis text
function extractTopActions(markdown: string): string[] {
  const lines = markdown.split('\n');
  const bullets = lines
    .filter(l => l.match(/^[-*•]\s+/) || l.match(/^\d+\.\s+/))
    .map(l => l.replace(/^[-*•\d.]+\s+/, '').trim())
    .filter(l => l.length > 20)
    .slice(0, 3);
  return bullets;
}

export function StrategicActions({ synthesisMarkdown, onViewFull }: StrategicActionsProps) {
  const actions = extractTopActions(synthesisMarkdown);
  if (!actions.length) return null;

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Top Strategic Actions</span>
        <button onClick={onViewFull} className="text-[10px] text-violet-500 hover:text-violet-300 flex items-center gap-1 transition-colors">
          View Full Synthesis <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 + 0.4 }}
            className="flex items-start gap-3 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/40 hover:border-violet-500/20 transition-colors group"
          >
            <span className="text-[10px] font-bold text-violet-600 mt-0.5 font-mono w-4 flex-shrink-0">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="text-xs text-zinc-400 group-hover:text-zinc-300 leading-relaxed transition-colors">
              {action}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```

---

## Modified Components

### `frontend/src/components/StrategyRadar.tsx` — Fix Size

The current `outerRadius="30%"` is far too small. Labels are unreadable.

```typescript
// Change in StrategyRadar.tsx:

// BEFORE:
<RadarChart cx="50%" cy="50%" outerRadius="30%" data={radarData}>

// AFTER:
<RadarChart cx="50%" cy="50%" outerRadius="42%" data={radarData}>

// Also fix label size — BEFORE:
tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: '8px', fontFamily: 'Inter, sans-serif' }}

// AFTER:
tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: 'Inter, sans-serif' }}
```

---

### `frontend/src/components/HeroSection.tsx` — Wire the New Dashboard

Replace the three hardcoded "zones" in the report body with the tabbed layout.

**In the report `<motion.div>` body, replace the `<div className="flex-1 overflow-y-auto ...">` with:**

```typescript
// ── State additions (add to the existing useState block) ──────────────────
const [activeTab, setActiveTab] = useState<ReportTab>('overview');

// ── Import additions ──────────────────────────────────────────────────────
import { KpiRow } from './dashboard/KpiRow';
import { CategorySummary } from './dashboard/CategorySummary';
import { ReportTabs, type ReportTab } from './dashboard/ReportTabs';
import { RichDimensionMatrix } from './dashboard/RichDimensionMatrix';
import { StrategicActions } from './dashboard/StrategicActions';

// ── Replace the report body ───────────────────────────────────────────────

{/* Report Body */}
<div className="flex-1 overflow-y-auto">

  {/* KPI Row */}
  <div className="px-4 md:px-8 pt-6 pb-4 space-y-3">
    <KpiRow
      dimensions={result.dimensions || {}}
      confidenceScore={result.confidence_score}
    />
  </div>

  {/* Tabs */}
  <div className="px-4 md:px-8">
    <ReportTabs
      active={activeTab}
      onChange={setActiveTab}
      hasStressResult={!!stressResult}
    />
  </div>

  {/* Tab Content */}
  <div className="px-4 md:px-8 py-8 space-y-8">

    {/* OVERVIEW TAB */}
    {activeTab === 'overview' && (
      <div className="space-y-8">
        {/* Radar + Executive Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-stretch max-w-7xl mx-auto w-full">
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-xl flex flex-col min-h-[360px]">
            <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Strategic Position Matrix</h3>
            <div className="flex-1">
              <StrategyRadar
                dimensions={stressResult ? stressResult.stressedScores : (result.dimensions || {})}
                originalDimensions={stressResult ? result.dimensions : undefined}
              />
            </div>
          </div>
          <ExecutiveSummaryCard
            orgName={result.orgName || 'Strategic Audit'}
            moatRationale={result.moatRationale || ''}
            dimensions={result.dimensions || {}}
          />
        </div>

        {/* Category Summary Strip */}
        <CategorySummary dimensions={result.dimensions || {}} />

        {/* Top Actions Preview */}
        <StrategicActions
          synthesisMarkdown={result.analysis_markdown || ''}
          onViewFull={() => setActiveTab('synthesis')}
        />
      </div>
    )}

    {/* DIMENSION MATRIX TAB */}
    {activeTab === 'dimensions' && (
      <RichDimensionMatrix
        dimensions={result.dimensions || {}}
        originalDimensions={stressResult?.originalScores}
      />
    )}

    {/* RISK ANALYSIS TAB */}
    {activeTab === 'risk' && (
      <div className="space-y-8 max-w-7xl mx-auto w-full">
        {/* Existing stress chamber content moved here */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-500" /> Stress Chamber
            </h3>
            {currentReportId && (
              <StressTestPanel
                reportId={currentReportId}
                onStressResult={(r) => { setStressResult(r); }}
                apiBase={import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/analyze', '') : ''}
              />
            )}
          </div>
          {stressResult && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">{stressResult.scenarioLabel}</h3>
              <DiagnosticScorecard
                dimensions={stressResult.stressedScores}
                originalDimensions={stressResult.originalScores}
                onAreaClick={() => {}}
              />
            </div>
          )}
        </div>
      </div>
    )}

    {/* SYNTHESIS TAB */}
    {activeTab === 'synthesis' && (
      <div className="max-w-5xl mx-auto w-full pb-20">
        {/* existing ReactMarkdown section unchanged */}
        <div className="report-content text-sm text-gray-300 leading-relaxed">
          <ReactMarkdown components={{ /* existing components */ }}>
            {sanitizeReport(result.analysis_markdown || '')}
          </ReactMarkdown>
        </div>
      </div>
    )}
  </div>
</div>
```

---

## Summary of All File Changes

| File | Type | Changes |
|------|------|---------|
| `frontend/src/components/dashboard/KpiRow.tsx` | **NEW** | 4-card KPI strip |
| `frontend/src/components/dashboard/CategorySummary.tsx` | **NEW** | 5-column category averages |
| `frontend/src/components/dashboard/ReportTabs.tsx` | **NEW** | Tab nav (Overview/Matrix/Risk/Synthesis) |
| `frontend/src/components/dashboard/RichDimensionMatrix.tsx` | **NEW** | Always-visible dimension scorecard with expand |
| `frontend/src/components/dashboard/StrategicActions.tsx` | **NEW** | Top 3 action extraction from synthesis |
| `frontend/src/components/tokens.ts` | **NEW** | Shared color tokens + scoreColor/scoreLabel |
| `frontend/src/components/StrategyRadar.tsx` | MODIFY | `outerRadius: 30% → 42%`, label fontSize: `8px → 9px` |
| `frontend/src/components/HeroSection.tsx` | MODIFY | Add `activeTab` state, wire 4 tabs, remove 3 hardcoded zones, add KpiRow |

**Zero changes to:** backend, Tailwind config, App.tsx, other existing components.

---

## Before / After Comparison

| Metric | Before | After |
|--------|--------|-------|
| Overall score visibility | Hidden (tiny text in radar center) | **Bold KPI card, always first** |
| DiagnosticScorecard visibility | Only in stress test mode | **Always in Dimension Matrix tab** |
| Navigation | None (one long scroll) | **4 tabs with animated underline** |
| Radar size | 30% outer radius, 8px labels | **42% radius, 9px labels** |
| Category breakdown | None | **5-column strip with mini-bars** |
| Strategic actions | Buried in markdown | **Top 3 surfaced as cards** |
| Dimension detail | Score only | **Expandable rows with justification + action** |
| Risk section | Mixed into main scroll | **Isolated in Risk Analysis tab** |

---

## AG Prompt — Dashboard Redesign

```
I need to implement a professional dashboard redesign for VelocityCSO.
This is a UI-only change — no backend changes required.

Design spec: plans/DASHBOARD_UI_REDESIGN.md
Current component: frontend/src/components/HeroSection.tsx

Please implement in this order:
1. Create frontend/src/components/tokens.ts (shared color utilities)
2. Create all 5 new components in frontend/src/components/dashboard/
3. Modify StrategyRadar.tsx (2-line change: outerRadius + fontSize)
4. Modify HeroSection.tsx to use tabs and new components

IMPORTANT:
- Do NOT change the landing page (idle/processing/clarification phases)
- Only modify the report section (inside the `result && (` AnimatePresence block)
- Keep all existing Framer Motion animations
- Keep the exact same dark color scheme (#0a0a0f, zinc-900, violet accents)
- Run `cd frontend && npm run dev` to verify no build errors

Read HeroSection.tsx fully before making changes. The report body starts at line 534.
```
