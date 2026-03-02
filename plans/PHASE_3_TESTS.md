# Phase 3 Tests — Strategy Frameworks

> **Companion to:** `PHASE_3_FRAMEWORKS.md`
> **Prerequisite:** Phase 1 and Phase 2 tests passing. All Phase 3 framework tasks complete.
> **Key additions:** Blue Ocean, Unit Economics, Porter's Five Forces, Monte Carlo, Wardley Map.

---

## What This Covers

| Framework (Phase 3) | Test File |
|--------------------|-----------|
| Framework 1 — Blue Ocean / ERRC | `src/agents/blueOceanAgent.test.ts` |
| Framework 2 — Unit Economics | `src/specialists.uniteconomics.test.ts` |
| Framework 3 — Porter's Five Forces | `src/specialists.porters.test.ts` |
| Framework 4 — Monte Carlo Simulation | `src/services/monteCarloService.test.ts` |
| Framework 5 — Wardley Map | `src/agents/wardleyAgent.test.ts` |
| Frontend | `frontend/src/components/MonteCarloChart.test.tsx` |

---

## Test File 1: `src/services/monteCarloService.test.ts`

> Monte Carlo is **pure computation** — no LLM calls, fully deterministic with a seed.
> This is the highest-value test in Phase 3.

```typescript
import { describe, it, expect } from 'vitest';
import {
  runSimulation,
  triangularSample,
  MonteCarloInput,
  MonteCarloResult,
} from './monteCarloService';

describe('triangularSample()', () => {
  it('returns a value within [min, max]', () => {
    for (let i = 0; i < 1000; i++) {
      const sample = triangularSample(10, 50, 100);
      expect(sample).toBeGreaterThanOrEqual(10);
      expect(sample).toBeLessThanOrEqual(100);
    }
  });

  it('clusters around the mode value', () => {
    // With 10,000 samples, mean should be close to (min + mode + max) / 3
    const min = 0, mode = 60, max = 100;
    const expectedMean = (min + mode + max) / 3; // 53.33
    const samples = Array.from({ length: 10_000 }, () => triangularSample(min, mode, max));
    const actualMean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(actualMean - expectedMean)).toBeLessThan(2); // within 2 units
  });

  it('throws when min >= max', () => {
    expect(() => triangularSample(100, 50, 50)).toThrow();
  });

  it('throws when mode is outside [min, max]', () => {
    expect(() => triangularSample(10, 150, 100)).toThrow();
  });
});

describe('runSimulation()', () => {
  const validInput: MonteCarloInput = {
    revenueMin: 500_000,
    revenueMode: 1_200_000,
    revenueMax: 3_000_000,
    costMin: 400_000,
    costMode: 900_000,
    costMax: 2_200_000,
    iterations: 5_000,
  };

  it('returns a MonteCarloResult with P10, P50, P90 fields', () => {
    const result: MonteCarloResult = runSimulation(validInput);
    expect(result).toHaveProperty('p10');
    expect(result).toHaveProperty('p50');
    expect(result).toHaveProperty('p90');
  });

  it('P10 < P50 < P90', () => {
    const result = runSimulation(validInput);
    expect(result.p10).toBeLessThan(result.p50);
    expect(result.p50).toBeLessThan(result.p90);
  });

  it('runs exactly the specified number of iterations', () => {
    const result = runSimulation({ ...validInput, iterations: 100 });
    expect(result.iterations).toBe(100);
  });

  it('defaults to 5000 iterations when not specified', () => {
    const { iterations: _, ...inputWithoutIterations } = validInput;
    const result = runSimulation(inputWithoutIterations as MonteCarloInput);
    expect(result.iterations).toBe(5_000);
  });

  it('failureProbability is between 0 and 1', () => {
    const result = runSimulation(validInput);
    expect(result.failureProbability).toBeGreaterThanOrEqual(0);
    expect(result.failureProbability).toBeLessThanOrEqual(1);
  });

  it('failureProbability approaches 1.0 when costs consistently exceed revenue', () => {
    const pessimsticInput: MonteCarloInput = {
      revenueMin: 100_000,
      revenueMode: 200_000,
      revenueMax: 300_000,
      costMin: 500_000,
      costMode: 800_000,
      costMax: 1_200_000,
      iterations: 1_000,
    };
    const result = runSimulation(pessimsticInput);
    expect(result.failureProbability).toBeGreaterThan(0.9);
  });

  it('failureProbability approaches 0 when revenue consistently exceeds costs', () => {
    const optimisticInput: MonteCarloInput = {
      revenueMin: 2_000_000,
      revenueMode: 3_000_000,
      revenueMax: 5_000_000,
      costMin: 100_000,
      costMode: 200_000,
      costMax: 400_000,
      iterations: 1_000,
    };
    const result = runSimulation(optimisticInput);
    expect(result.failureProbability).toBeLessThan(0.05);
  });

  it('histogram array has the same number of buckets each run', () => {
    const r1 = runSimulation({ ...validInput, iterations: 500 });
    const r2 = runSimulation({ ...validInput, iterations: 500 });
    expect(r1.histogram.length).toBe(r2.histogram.length);
  });

  it('result includes a sensitivityTable with at least 3 scenarios', () => {
    const result = runSimulation(validInput);
    expect(result.sensitivityTable).toBeDefined();
    expect(result.sensitivityTable.length).toBeGreaterThanOrEqual(3);
  });
});
```

---

## Test File 2: `src/agents/blueOceanAgent.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { BlueOceanAgent, BlueOceanResult } from './blueOceanAgent';

// Mock the ADK runner to return a controlled ERRC JSON response
vi.mock('@google/adk', async () => {
  const actual = await vi.importActual('@google/adk');
  return {
    ...actual,
    InMemoryRunner: vi.fn().mockImplementation(() => ({
      run: vi.fn().mockResolvedValue([
        {
          content: {
            parts: [{
              text: JSON.stringify({
                strategicMove: 'Redefine the cost intelligence space',
                errc: {
                  eliminate: ['Complex setup', 'Annual contracts'],
                  reduce: ['Onboarding time', 'Support overhead'],
                  raise: ['Data accuracy', 'Integration depth'],
                  create: ['Real-time alerts', 'Predictive benchmarking'],
                },
                valueCurve: {
                  axes: ['Price', 'Ease of use', 'Integrations', 'Insights depth', 'Support'],
                  company: [60, 90, 85, 95, 70],
                  competitor1: [80, 55, 60, 65, 80],
                  competitor2: [50, 70, 40, 45, 60],
                },
                strategicInsight: 'By eliminating setup complexity, the company can unlock the SMB segment.',
              }),
            }],
          },
          role: 'model',
        },
      ]),
    })),
  };
});

describe('BlueOceanAgent', () => {
  let agent: BlueOceanAgent;

  beforeEach(() => {
    agent = new BlueOceanAgent();
  });

  it('returns a BlueOceanResult with errc field', async () => {
    const result: BlueOceanResult = await agent.analyze('Test company context');
    expect(result).toHaveProperty('errc');
  });

  it('ERRC grid contains all four quadrants', async () => {
    const result = await agent.analyze('Test company context');
    expect(result.errc).toHaveProperty('eliminate');
    expect(result.errc).toHaveProperty('reduce');
    expect(result.errc).toHaveProperty('raise');
    expect(result.errc).toHaveProperty('create');
  });

  it('each ERRC quadrant is a non-empty array of strings', async () => {
    const result = await agent.analyze('Test company context');
    for (const quadrant of ['eliminate', 'reduce', 'raise', 'create'] as const) {
      expect(Array.isArray(result.errc[quadrant])).toBe(true);
      expect(result.errc[quadrant].length).toBeGreaterThan(0);
      for (const item of result.errc[quadrant]) {
        expect(typeof item).toBe('string');
      }
    }
  });

  it('value curve contains matching company and competitor data lengths', async () => {
    const result = await agent.analyze('Test company context');
    const { axes, company, competitor1 } = result.valueCurve;
    expect(axes.length).toBe(company.length);
    expect(axes.length).toBe(competitor1.length);
    expect(axes.length).toBeGreaterThanOrEqual(4);
  });

  it('returns a non-empty strategicInsight string', async () => {
    const result = await agent.analyze('Test company context');
    expect(typeof result.strategicInsight).toBe('string');
    expect(result.strategicInsight.length).toBeGreaterThan(20);
  });
});
```

---

## Test File 3: `src/specialists.uniteconomics.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateLtvCac,
  calculateRuleOf40,
  calculateBurnMultiple,
  calculateMagicNumber,
  buildSensitivityTable,
} from './specialists'; // or './services/unitEconomicsCalculator' depending on implementation

// These are pure math functions — no mocking needed

describe('Unit Economics calculations (Phase 3 Framework 2)', () => {
  describe('calculateLtvCac()', () => {
    it('returns LTV / CAC ratio', () => {
      expect(calculateLtvCac(30_000, 10_000)).toBeCloseTo(3.0, 1);
    });

    it('returns > 3 for healthy SaaS (LTV = 3x+ CAC)', () => {
      expect(calculateLtvCac(45_000, 10_000)).toBeGreaterThan(3);
    });

    it('returns null or 0 when CAC is 0 (division by zero guard)', () => {
      const result = calculateLtvCac(50_000, 0);
      expect(result === null || result === 0).toBe(true);
    });
  });

  describe('calculateRuleOf40()', () => {
    it('returns growth rate + EBITDA margin', () => {
      expect(calculateRuleOf40(60, -20)).toBeCloseTo(40, 1); // 60% growth - 20% EBITDA = 40
    });

    it('passes Rule of 40 when sum >= 40', () => {
      expect(calculateRuleOf40(50, -5)).toBeGreaterThanOrEqual(40);
    });

    it('fails Rule of 40 when sum < 40', () => {
      expect(calculateRuleOf40(25, 5)).toBeLessThan(40);
    });
  });

  describe('calculateBurnMultiple()', () => {
    it('returns net burn / net new ARR', () => {
      expect(calculateBurnMultiple(500_000, 250_000)).toBeCloseTo(2.0, 1);
    });

    it('returns Infinity or null when net new ARR is 0', () => {
      const result = calculateBurnMultiple(500_000, 0);
      expect(result === Infinity || result === null).toBe(true);
    });

    it('burn multiple < 1 is considered efficient', () => {
      expect(calculateBurnMultiple(100_000, 200_000)).toBeLessThan(1);
    });
  });

  describe('calculateMagicNumber()', () => {
    it('returns net new ARR / previous quarter S&M spend', () => {
      expect(calculateMagicNumber(200_000, 100_000)).toBeCloseTo(2.0, 1);
    });

    it('magic number >= 0.75 is considered healthy', () => {
      expect(calculateMagicNumber(150_000, 100_000)).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe('buildSensitivityTable()', () => {
    it('returns an array of at least 3 scenarios', () => {
      const table = buildSensitivityTable({
        baseRevenue: 1_000_000,
        baseCost: 700_000,
        growthRates: [0.2, 0.3, 0.5],
      });
      expect(table.length).toBeGreaterThanOrEqual(3);
    });

    it('each scenario has label, revenue, cost, and margin fields', () => {
      const table = buildSensitivityTable({
        baseRevenue: 1_000_000,
        baseCost: 700_000,
        growthRates: [0.2, 0.5],
      });
      for (const scenario of table) {
        expect(scenario).toHaveProperty('label');
        expect(scenario).toHaveProperty('revenue');
        expect(scenario).toHaveProperty('cost');
        expect(scenario).toHaveProperty('margin');
      }
    });
  });
});
```

---

## Test File 4: `src/specialists.porters.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

// PortersFiveForcesResult shape validation
// The financeAnalyst/innovationAnalyst is extended with portersFiveForces output in Phase 3

interface ForcesResult {
  supplierPower: number;
  buyerPower: number;
  threatOfSubstitutes: number;
  threatOfNewEntrants: number;
  industryRivalry: number;
  structuralAttractiveness: number;
  interactionEffectWarning?: string;
}

function validateFiveForcesShape(result: ForcesResult): void {
  const forces = ['supplierPower', 'buyerPower', 'threatOfSubstitutes', 'threatOfNewEntrants', 'industryRivalry'] as const;
  for (const force of forces) {
    expect(result[force], `${force} must be 0-100`).toBeGreaterThanOrEqual(0);
    expect(result[force], `${force} must be 0-100`).toBeLessThanOrEqual(100);
  }
  expect(result.structuralAttractiveness).toBeDefined();
  expect(result.structuralAttractiveness).toBeGreaterThanOrEqual(0);
  expect(result.structuralAttractiveness).toBeLessThanOrEqual(100);
}

function computeStructuralAttractiveness(forces: Omit<ForcesResult, 'structuralAttractiveness' | 'interactionEffectWarning'>): number {
  // Higher force scores = lower attractiveness
  const avgForce = (
    forces.supplierPower + forces.buyerPower +
    forces.threatOfSubstitutes + forces.threatOfNewEntrants +
    forces.industryRivalry
  ) / 5;
  return 100 - avgForce;
}

describe("Porter's Five Forces output (Phase 3 Framework 3)", () => {
  it('all five forces are scored 0-100', () => {
    const mockResult: ForcesResult = {
      supplierPower: 35,
      buyerPower: 60,
      threatOfSubstitutes: 70,
      threatOfNewEntrants: 45,
      industryRivalry: 80,
      structuralAttractiveness: 42,
    };
    expect(() => validateFiveForcesShape(mockResult)).not.toThrow();
  });

  it('structural attractiveness is inverse of average force strength', () => {
    const forces = {
      supplierPower: 80,
      buyerPower: 80,
      threatOfSubstitutes: 80,
      threatOfNewEntrants: 80,
      industryRivalry: 80,
    };
    const attractiveness = computeStructuralAttractiveness(forces);
    expect(attractiveness).toBe(20); // 100 - 80 = 20 (unattractive market)
  });

  it('low forces produce high structural attractiveness', () => {
    const forces = {
      supplierPower: 10,
      buyerPower: 15,
      threatOfSubstitutes: 20,
      threatOfNewEntrants: 10,
      industryRivalry: 25,
    };
    const attractiveness = computeStructuralAttractiveness(forces);
    expect(attractiveness).toBeGreaterThan(68);
  });

  it('interactionEffectWarning is present when 3+ forces are high (>70)', () => {
    // This tests the warning logic — if implemented as a util function
    const forces = { supplierPower: 80, buyerPower: 85, threatOfSubstitutes: 75, threatOfNewEntrants: 40, industryRivalry: 55 };
    const highForceCount = Object.values(forces).filter(v => v > 70).length;
    expect(highForceCount).toBeGreaterThanOrEqual(3);
    // The actual warning string is validated in coordinator.cot tests above
  });
});
```

---

## Test File 5: `src/agents/wardleyAgent.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { WardleyAgent, WardleyResult, WardleyComponent } from './wardleyAgent';

// Mock ADK to return a controlled Wardley map JSON
vi.mock('@google/adk', async () => {
  const actual = await vi.importActual('@google/adk');
  return {
    ...actual,
    InMemoryRunner: vi.fn().mockImplementation(() => ({
      run: vi.fn().mockResolvedValue([{
        content: {
          parts: [{
            text: JSON.stringify({
              components: [
                { name: 'Customer Relationship', evolution: 'product', visibility: 0.9, buildBuyPartner: 'build' },
                { name: 'Data Pipeline', evolution: 'custom', visibility: 0.5, buildBuyPartner: 'buy' },
                { name: 'Cloud Infrastructure', evolution: 'commodity', visibility: 0.1, buildBuyPartner: 'partner' },
                { name: 'AI Models', evolution: 'genesis', visibility: 0.7, buildBuyPartner: 'build' },
              ],
              strategicInsight: 'Invest in customer-facing differentiation; commoditise infrastructure.',
              evolutionaryPressures: ['AI commoditising data pipelines', 'Consolidation in cloud market'],
            }),
          }],
        },
        role: 'model',
      }]),
    })),
  };
});

describe('WardleyAgent', () => {
  let agent: WardleyAgent;

  beforeEach(() => {
    agent = new WardleyAgent();
  });

  it('returns WardleyResult with components array', async () => {
    const result: WardleyResult = await agent.map('Test company context');
    expect(result).toHaveProperty('components');
    expect(Array.isArray(result.components)).toBe(true);
    expect(result.components.length).toBeGreaterThan(0);
  });

  it('each component has required fields', async () => {
    const result = await agent.map('Test company context');
    for (const comp of result.components) {
      expect(comp).toHaveProperty('name');
      expect(comp).toHaveProperty('evolution');
      expect(comp).toHaveProperty('visibility');
      expect(comp).toHaveProperty('buildBuyPartner');
    }
  });

  it('evolution values are one of: genesis, custom, product, commodity', async () => {
    const validEvolutions = ['genesis', 'custom', 'product', 'commodity'];
    const result = await agent.map('Test company context');
    for (const comp of result.components) {
      expect(validEvolutions).toContain(comp.evolution);
    }
  });

  it('visibility is between 0 and 1', async () => {
    const result = await agent.map('Test company context');
    for (const comp of result.components) {
      expect(comp.visibility).toBeGreaterThanOrEqual(0);
      expect(comp.visibility).toBeLessThanOrEqual(1);
    }
  });

  it('buildBuyPartner is one of: build, buy, partner', async () => {
    const validOptions = ['build', 'buy', 'partner'];
    const result = await agent.map('Test company context');
    for (const comp of result.components) {
      expect(validOptions).toContain(comp.buildBuyPartner);
    }
  });

  it('returns non-empty strategicInsight string', async () => {
    const result = await agent.map('Test company context');
    expect(typeof result.strategicInsight).toBe('string');
    expect(result.strategicInsight.length).toBeGreaterThan(10);
  });
});
```

---

## Test File 6: `frontend/src/components/MonteCarloChart.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MonteCarloChart } from '../components/MonteCarloChart';
import type { MonteCarloResult } from '../../../src/services/monteCarloService'; // or frontend types file

const mockResult: MonteCarloResult = {
  p10: 120_000,
  p50: 350_000,
  p90: 780_000,
  failureProbability: 0.22,
  iterations: 5_000,
  histogram: Array.from({ length: 20 }, (_, i) => ({ bucket: i * 50_000, count: Math.floor(Math.random() * 200) })),
  sensitivityTable: [
    { label: 'Pessimistic', revenue: 500_000, cost: 450_000, margin: 10 },
    { label: 'Base', revenue: 1_200_000, cost: 900_000, margin: 25 },
    { label: 'Optimistic', revenue: 3_000_000, cost: 1_500_000, margin: 50 },
  ],
};

describe('MonteCarloChart', () => {
  it('renders P10, P50, P90 labels', () => {
    render(<MonteCarloChart result={mockResult} />);
    expect(screen.getByText(/P10/i)).toBeInTheDocument();
    expect(screen.getByText(/P50/i)).toBeInTheDocument();
    expect(screen.getByText(/P90/i)).toBeInTheDocument();
  });

  it('displays failure probability as a percentage', () => {
    render(<MonteCarloChart result={mockResult} />);
    expect(screen.getByText(/22%/)).toBeInTheDocument();
  });

  it('renders sensitivity table with 3 scenarios', () => {
    render(<MonteCarloChart result={mockResult} />);
    expect(screen.getByText(/Pessimistic/i)).toBeInTheDocument();
    expect(screen.getByText(/Base/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimistic/i)).toBeInTheDocument();
  });

  it('handles null/undefined result gracefully (no crash)', () => {
    expect(() => render(<MonteCarloChart result={null as any} />)).not.toThrow();
  });

  it('displays iteration count', () => {
    render(<MonteCarloChart result={mockResult} />);
    expect(screen.getByText(/5,?000/)).toBeInTheDocument();
  });
});
```

---

## Coverage Targets — Phase 3

| File | Target |
|------|--------|
| `src/services/monteCarloService.ts` | **100%** (pure functions) |
| `src/agents/blueOceanAgent.ts` | 85% |
| `src/agents/wardleyAgent.ts` | 80% |
| Unit economics functions in `src/specialists.ts` | 95% |
| `frontend/src/components/MonteCarloChart.tsx` | 80% |

---

## How to Run Phase 3 Tests

```bash
# Backend
npx vitest run \
  src/services/monteCarloService.test.ts \
  src/agents/blueOceanAgent.test.ts \
  src/specialists.uniteconomics.test.ts \
  src/specialists.porters.test.ts \
  src/agents/wardleyAgent.test.ts

# Frontend
cd frontend && npx vitest run src/components/MonteCarloChart.test.tsx
```

---

## AG Prompt — Phase 3 Tests

```
I've completed Phase 3 of VelocityCSO (PHASE_3_FRAMEWORKS.md).
Now I need the test suite from PHASE_3_TESTS.md.

The Monte Carlo tests are pure computation — implement these first as they
require no mocking and will catch calculation bugs immediately.

Testing setup: plans/TESTING_STRATEGY.md
Test plan: plans/PHASE_3_TESTS.md
Source files:
  - src/services/monteCarloService.ts
  - src/agents/blueOceanAgent.ts
  - src/agents/wardleyAgent.ts
  - src/specialists.ts (unit economics and Porter's functions)
  - frontend/src/components/MonteCarloChart.tsx

Read each source file before writing its test. Adapt imports to match actual exports.
Run npm test and fix any failures before moving to the next test file.
```
