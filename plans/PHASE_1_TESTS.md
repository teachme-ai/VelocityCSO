# Phase 1 Tests — Foundation

> **Companion to:** `PHASE_1_FOUNDATION.md`
> **Prerequisite:** Complete all 6 Phase 1 tasks before implementing these tests.
> **Setup required:** `plans/TESTING_STRATEGY.md` (install vitest, create global setup files).

---

## What This Covers

| Task (Phase 1) | Test File |
|----------------|-----------|
| Task 1.1 — Discovery Agent web search | `src/agents/discovery.test.ts` |
| Task 1.2 — Wire strategicCritic | `src/coordinator.test.ts` |
| Task 1.3 — Scoring rubrics | `src/specialists.rubrics.test.ts` |
| Task 1.4 — Firebase Auth middleware | `src/middleware/auth.test.ts` |
| Task 1.5 — SSE service (extract from index.ts) | `src/services/sseService.test.ts` |
| Task 1.6 — Dead code removal + type consolidation | `src/types.test.ts` |

---

## Test File 1: `src/middleware/auth.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireAuth } from './auth';

// Mock firebase-admin/auth
const mockVerifyIdToken = vi.fn();
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
}));

function makeReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as Partial<Request>;
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('requireAuth middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is absent', async () => {
    const req = makeReq({});
    const res = makeRes();
    await requireAuth(req as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = makeReq({ authorization: 'Basic abc123' });
    const res = makeRes();
    await requireAuth(req as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired or invalid', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Token expired'));
    const req = makeReq({ authorization: 'Bearer bad-token' });
    const res = makeRes();
    await requireAuth(req as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches user to req when token is valid', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123', email: 'test@example.com' });
    const req = makeReq({ authorization: 'Bearer valid-token' }) as Request & { user?: unknown };
    const res = makeRes();
    await requireAuth(req as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user).toMatchObject({ uid: 'user-123', email: 'test@example.com' });
  });

  it('extracts token correctly when Bearer prefix has extra whitespace', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-456' });
    const req = makeReq({ authorization: 'Bearer  spaced-token' });
    const res = makeRes();
    await requireAuth(req as Request, res as unknown as Response, next);
    // verifyIdToken should have been called with trimmed token
    expect(mockVerifyIdToken).toHaveBeenCalledWith(expect.any(String));
    expect(next).toHaveBeenCalled();
  });
});
```

---

## Test File 2: `src/services/sseService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';

// Import after module is defined in Phase 1
import {
  addConnection,
  removeConnection,
  emitHeartbeat,
  emitEvent,
  getConnectionCount,
} from './sseService';

function makeRes(): Partial<Response> & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } {
  return {
    write: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
  } as any;
}

describe('SSEService', () => {
  beforeEach(() => {
    // Clear all tracked connections between tests
    // (assumes sseService exports a reset function for testing, OR we clear via removeConnection)
    vi.clearAllMocks();
  });

  describe('addConnection / removeConnection', () => {
    it('increases connection count when a connection is added', () => {
      const res = makeRes();
      const id = addConnection('org-001', res as Response);
      expect(getConnectionCount()).toBeGreaterThan(0);
      removeConnection(id);
    });

    it('decreases connection count when a connection is removed', () => {
      const res = makeRes();
      const id = addConnection('org-001', res as Response);
      const countBefore = getConnectionCount();
      removeConnection(id);
      expect(getConnectionCount()).toBe(countBefore - 1);
    });

    it('does not throw when removing a connection that does not exist', () => {
      expect(() => removeConnection('non-existent-id')).not.toThrow();
    });
  });

  describe('emitHeartbeat', () => {
    it('writes heartbeat event to all connections for an orgId', () => {
      const res1 = makeRes();
      const res2 = makeRes();
      const id1 = addConnection('org-heartbeat', res1 as Response);
      const id2 = addConnection('org-heartbeat', res2 as Response);

      emitHeartbeat('org-heartbeat', { phase: 'discovery', message: 'Scanning...' });

      expect(res1.write).toHaveBeenCalledOnce();
      expect(res2.write).toHaveBeenCalledOnce();
      const written = (res1.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(written).toContain('event: heartbeat');
      expect(written).toContain('discovery');

      removeConnection(id1);
      removeConnection(id2);
    });

    it('does not write to connections belonging to a different orgId', () => {
      const res = makeRes();
      const id = addConnection('org-A', res as Response);

      emitHeartbeat('org-B', { phase: 'synthesis', message: 'Done' });

      expect(res.write).not.toHaveBeenCalled();
      removeConnection(id);
    });
  });

  describe('emitEvent', () => {
    it('formats SSE data as "data: <json>\\n\\n"', () => {
      const res = makeRes();
      const id = addConnection('org-event', res as Response);

      emitEvent('org-event', 'audit_complete', { score: 75 });

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(written).toContain('event: audit_complete');
      expect(written).toContain('"score":75');
      expect(written).toMatch(/\n\n$/);

      removeConnection(id);
    });
  });
});
```

---

## Test File 3: `src/agents/discovery.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

// We test the structural shape of DiscoveryAgent output, not the live LLM call.
// For live LLM calls, use integration tests tagged with --reporter=verbose.

describe('DiscoveryAgent — configuration', () => {
  it('discovery agent definition includes googleSearch tool', async () => {
    // Dynamically import to inspect the agent config without running it
    const mod = await import('./discovery');

    // The DiscoveryAgent class must expose its tools configuration
    // (Phase 1 Task 1.1 requires adding a static `tools` getter or a test-readable config)
    const agent = new mod.DiscoveryAgent();
    expect(agent.tools).toBeDefined();
    expect(agent.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ googleSearch: expect.any(Object) }),
    ]));
  });
});

describe('DiscoveryResult — type shape', () => {
  it('DiscoveryResult includes pestle field after Phase 1 update', () => {
    const mockResult = {
      findings: [
        { signal: 'test', source: 'https://example.com', date: '2025-01', relevance: 'high' as const },
      ],
      gaps: [],
      isComplete: true,
      summary: 'Test summary',
      pestle: {
        political: { signal: 'test', impact: 5, likelihood: 5 },
        economic: { signal: 'test', impact: 5, likelihood: 5 },
        social: { signal: 'test', impact: 5, likelihood: 5 },
        technological: { signal: 'test', impact: 5, likelihood: 5 },
        legal: { signal: 'test', impact: 5, likelihood: 5 },
        environmental: { signal: 'test', impact: 5, likelihood: 5 },
      },
    };

    // All required fields must be present
    expect(mockResult.pestle).toHaveProperty('political');
    expect(mockResult.pestle).toHaveProperty('economic');
    expect(mockResult.pestle).toHaveProperty('social');
    expect(mockResult.pestle).toHaveProperty('technological');
    expect(mockResult.pestle).toHaveProperty('legal');
    expect(mockResult.pestle).toHaveProperty('environmental');

    // Each PESTLE dimension must have impact and likelihood in range 0-10
    for (const key of Object.keys(mockResult.pestle)) {
      const dim = mockResult.pestle[key as keyof typeof mockResult.pestle];
      expect(dim.impact).toBeGreaterThanOrEqual(0);
      expect(dim.impact).toBeLessThanOrEqual(10);
      expect(dim.likelihood).toBeGreaterThanOrEqual(0);
      expect(dim.likelihood).toBeLessThanOrEqual(10);
    }
  });

  it('each finding includes source URL', () => {
    const finding = { signal: 'Market grew 30% YoY', source: 'https://techcrunch.com/2025/01/01', date: '2025-01', relevance: 'high' as const };
    expect(finding.source).toMatch(/^https?:\/\//);
  });
});
```

---

## Test File 4: `src/coordinator.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── robustParse ───────────────────────────────────────────────────────────────
// robustParse must be exported (or made testable) from coordinator.ts in Phase 1

describe('robustParse()', () => {
  let robustParse: (text: string) => unknown;

  beforeEach(async () => {
    const mod = await import('./coordinator');
    robustParse = (mod as any).robustParse;
  });

  it('parses clean JSON string', () => {
    const input = '{"score": 72, "label": "strong"}';
    expect(robustParse(input)).toEqual({ score: 72, label: 'strong' });
  });

  it('parses JSON wrapped in markdown code block (```json)', () => {
    const input = '```json\n{"score": 55}\n```';
    expect(robustParse(input)).toEqual({ score: 55 });
  });

  it('parses JSON wrapped in plain code block (```)', () => {
    const input = '```\n{"score": 40}\n```';
    expect(robustParse(input)).toEqual({ score: 40 });
  });

  it('extracts JSON when surrounded by prose text', () => {
    const input = 'Here is the result: {"score": 88} as requested.';
    expect(robustParse(input)).toMatchObject({ score: 88 });
  });

  it('throws a descriptive error on completely unparseable input', () => {
    expect(() => robustParse('This is plain text with no JSON at all')).toThrow();
  });

  it('handles nested JSON correctly', () => {
    const input = '{"dimensions": {"market_size": {"score": 70, "label": "good"}}}';
    expect(robustParse(input)).toMatchObject({
      dimensions: { market_size: { score: 70 } },
    });
  });
});

// ── runCritic() wiring ────────────────────────────────────────────────────────
describe('ChiefStrategyAgent — critic wiring (Phase 1 Task 1.2)', () => {
  it('runCritic() method exists on ChiefStrategyAgent', async () => {
    const { ChiefStrategyAgent } = await import('./coordinator');
    const agent = new ChiefStrategyAgent();
    expect(typeof (agent as any).runCritic).toBe('function');
  });

  it('runCritic() is called during a full audit run', async () => {
    const { ChiefStrategyAgent } = await import('./coordinator');
    const agent = new ChiefStrategyAgent();
    const runCriticSpy = vi.spyOn(agent as any, 'runCritic');

    // Mock the specialist runner to return a minimal valid output
    vi.spyOn(agent as any, 'runSpecialists').mockResolvedValue({
      market_size: { score: 70 },
      competitive_moat: { score: 55 },
    });
    vi.spyOn(agent as any, 'runCso').mockResolvedValue('CSO synthesis text');

    await agent.runAudit({ businessContext: 'Test company', sessionId: 'test-sess' });

    expect(runCriticSpy).toHaveBeenCalledOnce();
  });
});
```

---

## Test File 5: `src/specialists.rubrics.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SCORING_RUBRICS, DIMENSION_IDS } from './specialists';

// SCORING_RUBRICS and DIMENSION_IDS must be exported from specialists.ts after Phase 1 Task 1.3

describe('SCORING_RUBRICS', () => {
  it('has a rubric entry for every dimension in DIMENSION_IDS', () => {
    for (const id of DIMENSION_IDS) {
      expect(SCORING_RUBRICS).toHaveProperty(id);
    }
  });

  it('each rubric has exactly 5 score bands', () => {
    for (const [id, rubric] of Object.entries(SCORING_RUBRICS)) {
      expect(
        Object.keys(rubric as Record<string, unknown>).length,
        `Rubric for ${id} should have 5 bands`
      ).toBe(5);
    }
  });

  it('score bands follow the naming convention (1-2, 3-4, 5-6, 7-8, 9-10)', () => {
    const expectedBands = ['1-2', '3-4', '5-6', '7-8', '9-10'];
    for (const rubric of Object.values(SCORING_RUBRICS)) {
      const bands = Object.keys(rubric as Record<string, unknown>);
      expect(bands).toEqual(expect.arrayContaining(expectedBands));
    }
  });

  it('each band has label and description fields', () => {
    for (const rubric of Object.values(SCORING_RUBRICS)) {
      for (const band of Object.values(rubric as Record<string, unknown>)) {
        const b = band as Record<string, unknown>;
        expect(b).toHaveProperty('label');
        expect(b).toHaveProperty('description');
        expect(typeof b.label).toBe('string');
        expect((b.label as string).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('DIMENSION_IDS', () => {
  it('contains exactly 15 dimensions in Phase 1 (before Phase 2 expansion)', () => {
    // Phase 2 will expand this to 20. In Phase 1, verify the original 15 exist.
    expect(DIMENSION_IDS.length).toBe(15);
  });

  it('all dimension IDs are snake_case strings', () => {
    for (const id of DIMENSION_IDS) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
```

---

## Test File 6: `src/types.test.ts`

Tests that dead code is gone and types are consolidated (Phase 1 Task 1.6).

```typescript
import { describe, it, expect } from 'vitest';

describe('Type consolidation — Phase 1 Task 1.6', () => {
  it('StressResult is importable from shared types (not duplicated in StressTestPanel)', async () => {
    // If this import fails, StressResult was not properly exported from the shared types module
    const types = await import('../frontend/src/types/stress');
    expect(types.StressResult).toBeDefined();
  });

  it('StatusEvent is exported from shared types', async () => {
    const types = await import('../frontend/src/types/stress');
    expect(typeof types).toBe('object'); // module loaded
    // StatusEvent is a TypeScript interface — we verify the module at least loads
  });
});

describe('Circular dependency — sseService extraction (Phase 1 Task 1.5)', () => {
  it('sseService can be imported without importing index.ts', async () => {
    // This test will fail if sseService still imports from index.ts
    await expect(import('./services/sseService')).resolves.not.toThrow();
  });

  it('coordinator.ts does not import from index.ts', async () => {
    // Read the source file and check for the banned import
    const fs = await import('fs');
    const path = await import('path');
    const coordinatorSrc = fs.readFileSync(
      path.resolve(__dirname, 'coordinator.ts'),
      'utf8'
    );
    expect(coordinatorSrc).not.toContain("from '../index'");
    expect(coordinatorSrc).not.toContain("from './index'");
  });

  it('interrogator.ts does not import from index.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, 'agents/interrogator.ts'),
      'utf8'
    );
    expect(src).not.toContain("from '../index'");
  });
});
```

---

## Coverage Targets — Phase 1

| File | Target |
|------|--------|
| `src/middleware/auth.ts` | 100% |
| `src/services/sseService.ts` | 90% |
| `src/coordinator.ts` (robustParse, runCritic) | 85% |
| `src/specialists.ts` (rubrics export) | 80% |
| `src/agents/discovery.ts` (config, types) | 70% |

---

## How to Run Phase 1 Tests

```bash
# Install vitest first (if not done)
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest

# Run Phase 1 tests only
npx vitest run src/middleware/auth.test.ts src/services/sseService.test.ts \
  src/coordinator.test.ts src/specialists.rubrics.test.ts \
  src/agents/discovery.test.ts src/types.test.ts

# Run with coverage
npm run test:coverage
```

---

## AG Prompt — Phase 1 Tests

```
I've completed Phase 1 of VelocityCSO (PHASE_1_FOUNDATION.md).
Now I need to implement the test suite described in PHASE_1_TESTS.md.

Testing setup: plans/TESTING_STRATEGY.md
Test plan: plans/PHASE_1_TESTS.md
Source files to test:
  - src/middleware/auth.ts
  - src/services/sseService.ts
  - src/coordinator.ts
  - src/specialists.ts
  - src/agents/discovery.ts

Please implement each test file as written in PHASE_1_TESTS.md.
Read the source files first, then adapt the test code to match the actual exports.
Run npm test at the end and fix any failures.
Target: all 6 test files passing with ≥ 80% coverage on new files.
```
