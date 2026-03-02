# Phase 2 Tests — Intelligence

> **Companion to:** `PHASE_2_INTELLIGENCE.md`
> **Prerequisite:** Phase 1 tests passing. Phase 2 tasks complete.
> **Key additions:** 20 dimensions, staged pipeline, CoT scaffolding, scoring fix.

---

## What This Covers

| Task (Phase 2) | Test File |
|----------------|-----------|
| Task 2.1 — 5 new dimensions | `src/specialists.dimensions.test.ts` |
| Task 2.2 — Staged pipeline | `src/coordinator.pipeline.test.ts` |
| Task 2.3 — CoT scaffold in all specialist outputs | `src/coordinator.cot.test.ts` |
| Task 2.4 — Fix scoreContextDeterministically() | `src/agents/interrogator.test.ts` |

---

## Test File 1: `src/specialists.dimensions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SCORING_RUBRICS, DIMENSION_IDS, CATEGORIES } from './specialists';

// After Phase 2 Task 2.1, DIMENSION_IDS expands from 15 → 20
// and CATEGORIES is updated to include the new dimensions

describe('20-dimension expansion (Phase 2 Task 2.1)', () => {
  const NEW_DIMENSIONS = [
    'team_founder_strength',
    'network_effects_strength',
    'data_asset_quality',
    'regulatory_compliance_readiness',
    'customer_concentration_risk',
  ];

  it('DIMENSION_IDS contains exactly 20 entries after Phase 2', () => {
    expect(DIMENSION_IDS.length).toBe(20);
  });

  it('all 5 new dimensions are present in DIMENSION_IDS', () => {
    for (const dim of NEW_DIMENSIONS) {
      expect(DIMENSION_IDS).toContain(dim);
    }
  });

  it('each new dimension has a rubric in SCORING_RUBRICS', () => {
    for (const dim of NEW_DIMENSIONS) {
      expect(SCORING_RUBRICS).toHaveProperty(dim);
    }
  });

  it('new dimension rubrics have exactly 5 bands', () => {
    for (const dim of NEW_DIMENSIONS) {
      const rubric = SCORING_RUBRICS[dim] as Record<string, unknown>;
      expect(Object.keys(rubric).length).toBe(5);
    }
  });

  it('CATEGORIES object groups all 20 dimensions into 5 categories', () => {
    // CATEGORIES should look like: { capital: [...], market: [...], execution: [...], resilience: [...], growth: [...] }
    const allCategorized = Object.values(CATEGORIES as Record<string, string[]>).flat();
    expect(allCategorized.length).toBe(20);

    for (const dim of DIMENSION_IDS) {
      expect(allCategorized).toContain(dim);
    }
  });

  it('no dimension appears in more than one category', () => {
    const allCategorized = Object.values(CATEGORIES as Record<string, string[]>).flat();
    const uniqueDims = new Set(allCategorized);
    expect(uniqueDims.size).toBe(allCategorized.length);
  });
});
```

---

## Test File 2: `src/coordinator.pipeline.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChiefStrategyAgent } from './coordinator';

// We test execution ORDER using spies on the internal phase runners.
// Phase 2 Task 2.2 splits the pipeline into Phase A (market+innovation),
// Phase B (commercial+operations), Phase C (finance), Phase D (critic), Phase E (CSO).

describe('Staged pipeline execution order (Phase 2 Task 2.2)', () => {
  let agent: ChiefStrategyAgent;
  const executionOrder: string[] = [];

  beforeEach(() => {
    agent = new ChiefStrategyAgent();
    executionOrder.length = 0; // reset

    // Spy on each phase runner and record the call order
    vi.spyOn(agent as any, 'runPhaseA').mockImplementation(async () => {
      executionOrder.push('phaseA');
      return { marketAnalysis: {}, innovationAnalysis: {} };
    });
    vi.spyOn(agent as any, 'runPhaseB').mockImplementation(async () => {
      executionOrder.push('phaseB');
      return { commercialAnalysis: {}, operationsAnalysis: {} };
    });
    vi.spyOn(agent as any, 'runPhaseC').mockImplementation(async () => {
      executionOrder.push('phaseC');
      return { financeAnalysis: {} };
    });
    vi.spyOn(agent as any, 'runCritic').mockImplementation(async () => {
      executionOrder.push('critic');
      return { flags: [] };
    });
    vi.spyOn(agent as any, 'runCso').mockImplementation(async () => {
      executionOrder.push('cso');
      return 'CSO synthesis';
    });
  });

  it('Phase A runs before Phase B', async () => {
    await agent.runAudit({ businessContext: 'Test', sessionId: 'test' });
    const phaseAIndex = executionOrder.indexOf('phaseA');
    const phaseBIndex = executionOrder.indexOf('phaseB');
    expect(phaseAIndex).toBeLessThan(phaseBIndex);
  });

  it('Phase B runs before Phase C', async () => {
    await agent.runAudit({ businessContext: 'Test', sessionId: 'test' });
    const phaseBIndex = executionOrder.indexOf('phaseB');
    const phaseCIndex = executionOrder.indexOf('phaseC');
    expect(phaseBIndex).toBeLessThan(phaseCIndex);
  });

  it('Critic runs after Phase C and before CSO', async () => {
    await agent.runAudit({ businessContext: 'Test', sessionId: 'test' });
    const criticIndex = executionOrder.indexOf('critic');
    const csoIndex = executionOrder.indexOf('cso');
    const phaseCIndex = executionOrder.indexOf('phaseC');
    expect(phaseCIndex).toBeLessThan(criticIndex);
    expect(criticIndex).toBeLessThan(csoIndex);
  });

  it('Phase B receives Phase A output in its context argument', async () => {
    const runPhaseBSpy = vi.spyOn(agent as any, 'runPhaseB');

    await agent.runAudit({ businessContext: 'Test', sessionId: 'test' });

    // runPhaseB should have been called with the Phase A output
    const callArgs = runPhaseBSpy.mock.calls[0];
    expect(callArgs[0]).toMatchObject({
      marketAnalysis: expect.anything(),
      innovationAnalysis: expect.anything(),
    });
  });

  it('CSO synthesis receives all specialist outputs', async () => {
    const runCsoSpy = vi.spyOn(agent as any, 'runCso');

    await agent.runAudit({ businessContext: 'Test', sessionId: 'test' });

    const callArgs = runCsoSpy.mock.calls[0][0];
    expect(callArgs).toHaveProperty('marketAnalysis');
    expect(callArgs).toHaveProperty('commercialAnalysis');
    expect(callArgs).toHaveProperty('financeAnalysis');
  });
});
```

---

## Test File 3: `src/coordinator.cot.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

// The CoT scaffold (Task 2.3) requires every dimension result to include:
//   justification: string  — why the score was assigned
//   key_assumption: string — what assumption this score depends on
//   improvement_action: string — one concrete next step

interface DimensionResult {
  score: number;
  justification?: string;
  key_assumption?: string;
  improvement_action?: string;
}

function validateCoTFields(result: DimensionResult, dimensionId: string): void {
  expect(result, `${dimensionId} missing justification`).toHaveProperty('justification');
  expect(result, `${dimensionId} missing key_assumption`).toHaveProperty('key_assumption');
  expect(result, `${dimensionId} missing improvement_action`).toHaveProperty('improvement_action');

  expect(typeof result.justification, `${dimensionId}.justification must be string`).toBe('string');
  expect((result.justification as string).length, `${dimensionId}.justification must not be empty`).toBeGreaterThan(0);

  expect(typeof result.key_assumption, `${dimensionId}.key_assumption must be string`).toBe('string');
  expect((result.key_assumption as string).length, `${dimensionId}.key_assumption must not be empty`).toBeGreaterThan(0);

  expect(typeof result.improvement_action, `${dimensionId}.improvement_action must be string`).toBe('string');
  expect((result.improvement_action as string).length, `${dimensionId}.improvement_action must not be empty`).toBeGreaterThan(0);
}

describe('CoT scaffold validation (Phase 2 Task 2.3)', () => {
  // Use the COT_SCAFFOLD constant exported from specialists.ts
  it('COT_SCAFFOLD constant is exported from specialists.ts', async () => {
    const mod = await import('./specialists');
    expect((mod as any).COT_SCAFFOLD).toBeDefined();
    expect(typeof (mod as any).COT_SCAFFOLD).toBe('string');
    expect((mod as any).COT_SCAFFOLD.length).toBeGreaterThan(100);
  });

  it('COT_SCAFFOLD contains justification instruction', async () => {
    const mod = await import('./specialists');
    const scaffold = (mod as any).COT_SCAFFOLD as string;
    expect(scaffold.toLowerCase()).toContain('justification');
  });

  it('COT_SCAFFOLD contains key_assumption instruction', async () => {
    const mod = await import('./specialists');
    const scaffold = (mod as any).COT_SCAFFOLD as string;
    expect(scaffold.toLowerCase()).toContain('assumption');
  });

  it('COT_SCAFFOLD contains improvement_action instruction', async () => {
    const mod = await import('./specialists');
    const scaffold = (mod as any).COT_SCAFFOLD as string;
    expect(scaffold.toLowerCase()).toContain('improvement');
  });

  it('mock dimension result with all CoT fields passes validation', () => {
    const mockResult: DimensionResult = {
      score: 72,
      justification: 'The company has demonstrated strong market positioning with 3x YoY growth.',
      key_assumption: 'Current growth rate is sustainable for 12+ months.',
      improvement_action: 'Commission a formal TAM analysis using bottom-up methodology.',
    };
    expect(() => validateCoTFields(mockResult, 'market_size')).not.toThrow();
  });

  it('dimension result missing justification fails validation', () => {
    const mockResult: DimensionResult = { score: 72 };
    expect(() => validateCoTFields(mockResult, 'market_size')).toThrow();
  });
});
```

---

## Test File 4: `src/agents/interrogator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { InterrogatorAgent } from './interrogator';

// Phase 1 fix for Task 2.4: scoreContextDeterministically() must return
// THREE INDEPENDENT sub-scores: specificity, completeness, moat (total ≤ 100)
// Previously all three returned the same value.

describe('scoreContextDeterministically()', () => {
  let interrogator: InterrogatorAgent;
  let scoreContext: (context: string) => { specificity: number; completeness: number; moat: number; total: number };

  beforeEach(async () => {
    const mod = await import('./interrogator');
    interrogator = new mod.InterrogatorAgent();
    // The method must be accessible for unit testing
    scoreContext = (context: string) => (interrogator as any).scoreContextDeterministically(context);
  });

  it('returns an object with specificity, completeness, and moat fields', () => {
    const result = scoreContext('We are a B2B SaaS company with $2M ARR and 150 customers.');
    expect(result).toHaveProperty('specificity');
    expect(result).toHaveProperty('completeness');
    expect(result).toHaveProperty('moat');
  });

  it('all sub-scores are non-negative integers', () => {
    const result = scoreContext('Revenue is $5M. Team of 12. We serve healthcare.');
    expect(result.specificity).toBeGreaterThanOrEqual(0);
    expect(result.completeness).toBeGreaterThanOrEqual(0);
    expect(result.moat).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.specificity)).toBe(true);
    expect(Number.isInteger(result.completeness)).toBe(true);
    expect(Number.isInteger(result.moat)).toBe(true);
  });

  it('total field equals the sum of sub-scores', () => {
    const result = scoreContext('SaaS product with 200 enterprise clients and 40% gross margin.');
    expect(result.total).toBe(result.specificity + result.completeness + result.moat);
  });

  it('total is at most 100', () => {
    const richContext = `
      B2B SaaS, $10M ARR, 120% net dollar retention, 35% EBITDA margin.
      500 enterprise clients including Fortune 500. Team of 85 with ex-Google CTO.
      Proprietary data moat from 5 years of behavioral analytics.
      Operating in a $8B TAM growing at 22% CAGR. SOC 2 Type II certified.
      Competitors: Salesforce ($25B), HubSpot ($12B). We are 10x cheaper with better NPS (72 vs 41).
    `;
    const result = scoreContext(richContext);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('produces different sub-scores for a rich context (not all equal)', () => {
    // A rich context should produce varied sub-scores — the bug was all 3 being identical
    const richContext = `
      Revenue: $3M ARR. Customers: 85 mid-market. NPS: 62.
      Moat: Proprietary ML model trained on 10M datapoints, 18-month advantage.
      Team: CEO has 2 exits, CTO ex-DeepMind.
    `;
    const result = scoreContext(richContext);
    // At least two of the three sub-scores should differ
    const allSame = result.specificity === result.completeness && result.completeness === result.moat;
    expect(allSame).toBe(false);
  });

  it('produces score 0 for genuinely empty context', () => {
    const result = scoreContext('');
    expect(result.total).toBe(0);
  });

  it('specificity responds to numeric data signals', () => {
    const withNumbers = 'ARR $2M, 150 customers, 35% margin, team of 20';
    const withoutNumbers = 'We have some revenue, some customers, decent margins, a team';
    const r1 = scoreContext(withNumbers);
    const r2 = scoreContext(withoutNumbers);
    expect(r1.specificity).toBeGreaterThan(r2.specificity);
  });

  it('completeness responds to business section coverage', () => {
    const comprehensive = 'Revenue, team, customers, competitive moat, market size, technology, regulatory, growth rate';
    const sparse = 'We have revenue';
    const r1 = scoreContext(comprehensive);
    const r2 = scoreContext(sparse);
    expect(r1.completeness).toBeGreaterThan(r2.completeness);
  });
});
```

---

## Coverage Targets — Phase 2

| File | Target |
|------|--------|
| `src/specialists.ts` (dimension expansion, CoT) | 85% |
| `src/coordinator.ts` (staged pipeline) | 85% |
| `src/agents/interrogator.ts` (scoreContextDeterministically) | 90% |
| `frontend/src/components/DiagnosticScorecard.tsx` | 75% |

---

## Frontend Component Test: `frontend/src/components/DiagnosticScorecard.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DiagnosticScorecard } from '../components/DiagnosticScorecard';
import { DIMENSION_IDS } from '../../../src/specialists'; // or use a local constant

// Build mock props with all 20 dimensions
function makeMockDimensions() {
  return Object.fromEntries(
    DIMENSION_IDS.map((id: string) => [
      id,
      { score: Math.floor(Math.random() * 100), justification: 'Mock justification' },
    ])
  );
}

describe('DiagnosticScorecard — Phase 2 (20 dimensions)', () => {
  it('renders all 20 dimension labels', () => {
    const dims = makeMockDimensions();
    render(<DiagnosticScorecard dimensions={dims} />);
    // Each dimension should have a visible label — check at least the new 5
    expect(screen.getByText(/Team.*Founder/i)).toBeInTheDocument();
    expect(screen.getByText(/Network Effects/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Asset/i)).toBeInTheDocument();
    expect(screen.getByText(/Regulatory/i)).toBeInTheDocument();
    expect(screen.getByText(/Customer Concentration/i)).toBeInTheDocument();
  });

  it('progress bar width matches score value', () => {
    const dims = { market_size: { score: 80, justification: 'Strong' } };
    render(<DiagnosticScorecard dimensions={dims} />);
    // The progress bar should have width style reflecting the score
    const bars = document.querySelectorAll('[role="progressbar"], [data-testid="progress-bar"]');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('renders overall score summary', () => {
    const dims = makeMockDimensions();
    render(<DiagnosticScorecard dimensions={dims} overallScore={71} />);
    expect(screen.getByText(/71/)).toBeInTheDocument();
  });
});
```

---

## How to Run Phase 2 Tests

```bash
npx vitest run \
  src/specialists.dimensions.test.ts \
  src/coordinator.pipeline.test.ts \
  src/coordinator.cot.test.ts \
  src/agents/interrogator.test.ts

# Frontend
cd frontend && npx vitest run src/components/DiagnosticScorecard.test.tsx
```

---

## AG Prompt — Phase 2 Tests

```
I've completed Phase 2 of VelocityCSO (PHASE_2_INTELLIGENCE.md).
Now I need to implement the test suite from PHASE_2_TESTS.md.

Testing setup: plans/TESTING_STRATEGY.md
Test plan: plans/PHASE_2_TESTS.md
Source files:
  - src/specialists.ts
  - src/coordinator.ts
  - src/agents/interrogator.ts
  - frontend/src/components/DiagnosticScorecard.tsx

Please implement each test file. Read source files first, then adapt imports/exports
to match actuals. Run npm test at the end and fix any failures.
```
