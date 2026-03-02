# VelocityCSO — Testing Strategy

> This document defines the testing stack, conventions, configuration, and coverage targets for
> the entire VelocityCSO test suite. Each phase has a companion `PHASE_N_TESTS.md` file that
> implements these conventions for the components built in that phase.
>
> **Implement this file first before starting any phase test file.**

---

## Test Pyramid

```
        ┌───────────────┐
        │  E2E (10%)    │  Playwright — full browser flow, Phase 5+
        ├───────────────┤
        │ Integration   │  Supertest HTTP endpoints, Firestore emulator
        │    (30%)      │
        ├───────────────┤
        │  Unit (60%)   │  Vitest — pure functions, agents, services, hooks
        └───────────────┘
```

Target: **≥ 80% line coverage** on all new files. Legacy files: ≥ 60%.

---

## Stack

| Layer | Tool | Version |
|-------|------|---------|
| Test runner (backend) | `vitest` | ^2.x |
| Test runner (frontend) | `vitest` + `@testing-library/react` | ^2.x / ^16.x |
| HTTP integration | `supertest` | ^7.x |
| DOM environment | `@testing-library/user-event` | ^14.x |
| Mocking | `vi.mock()` built into vitest | — |
| Coverage | `@vitest/coverage-v8` | ^2.x |
| Firestore emulator | `@firebase/rules-unit-testing` | ^3.x |
| E2E (Phase 5+) | `playwright` | ^1.x |

---

## Directory Structure

```
/
├── src/
│   ├── __tests__/                  # Backend unit tests
│   │   ├── setup.ts                # Global mock setup
│   │   └── factories/              # Mock data factories
│   │       ├── auditFactory.ts
│   │       └── sessionFactory.ts
│   ├── middleware/
│   │   └── auth.test.ts            # Co-located with source
│   ├── services/
│   │   ├── sseService.test.ts
│   │   ├── monteCarloService.test.ts
│   │   ├── scraperService.test.ts
│   │   ├── documentParser.test.ts
│   │   ├── marketDataService.test.ts
│   │   └── pdfService.test.ts
│   ├── agents/
│   │   ├── discovery.test.ts
│   │   ├── blueOceanAgent.test.ts
│   │   └── wardleyAgent.test.ts
│   ├── coordinator.test.ts
│   └── data/
│       └── benchmarks.test.ts
├── frontend/
│   └── src/
│       ├── __tests__/
│       │   └── setup.ts            # jsdom setup, RTL config
│       ├── components/
│       │   ├── DiagnosticScorecard.test.tsx
│       │   ├── MonteCarloChart.test.tsx
│       │   └── audit/
│       │       ├── AuditInputForm.test.tsx
│       │       └── ClarificationDialog.test.tsx
│       ├── hooks/
│       │   └── useAuditSession.test.ts
│       └── utils/
│           └── sse.test.ts
├── vitest.config.ts                # Backend config
├── frontend/vitest.config.ts       # Frontend config
└── firestore.test.rules            # Firestore rules test
```

---

## Backend `vitest.config.ts`

**File:** `vitest.config.ts` (project root)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.test.ts',
        'src/index.ts',           // entry point — covered by integration tests
        'scripts/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

---

## Frontend `vitest.config.ts`

**File:** `frontend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
      },
    },
  },
});
```

---

## Global Mock Setup

**File:** `src/__tests__/setup.ts`

```typescript
import { vi, beforeEach } from 'vitest';

// ── Firestore mock ────────────────────────────────────────────────────────────
vi.mock('../services/memory', () => ({
  saveAuditReport: vi.fn().mockResolvedValue(undefined),
  getAuditReport: vi.fn().mockResolvedValue(null),
  listAuditReports: vi.fn().mockResolvedValue([]),
}));

// ── Firebase Admin mock ───────────────────────────────────────────────────────
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-uid', email: 'test@example.com' }),
  })),
}));

// ── Google ADK runner mock ────────────────────────────────────────────────────
// Individual tests override this with specific return values
vi.mock('@google/adk', () => ({
  LlmAgent: vi.fn().mockImplementation((config: any) => ({ ...config, _isAgent: true })),
  InMemoryRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue([]),
  })),
  isFinalResponse: vi.fn().mockReturnValue(true),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
```

**File:** `frontend/src/__tests__/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock EventSource (SSE) globally
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = MockEventSource.OPEN;
  close = vi.fn();
  constructor(public url: string) {}
}
(global as any).EventSource = MockEventSource;
```

---

## Mock Data Factories

**File:** `src/__tests__/factories/auditFactory.ts`

```typescript
import type { AuditReport } from '../../types';  // adjust to actual type path

export function makeAuditReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    id: 'audit-test-001',
    orgId: 'org-test-001',
    businessContext: 'Test SaaS company selling B2B analytics',
    createdAt: new Date().toISOString(),
    dimensions: {
      market_size: { score: 72, justification: 'Addressable market ~$2B', key_assumption: 'TAM is growing', improvement_action: 'Segment more precisely' },
      competitive_moat: { score: 55, justification: 'Moderate moat', key_assumption: 'Network effects hold', improvement_action: 'Deepen integrations' },
    },
    overallScore: 63,
    csoSynthesis: 'The business demonstrates moderate strategic health...',
    ...overrides,
  };
}

export function makeSessionContext(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'sess-test-001',
    orgId: 'org-test-001',
    businessContext: 'Test company context',
    clarifications: [],
    ...overrides,
  };
}
```

---

## Package.json Test Scripts

Add these to the **root** `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --reporter=verbose src/**/*.integration.test.ts"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

Add these to `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^25.0.0"
  }
}
```

---

## GitHub Actions CI

**File:** `.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./frontend/coverage/lcov.info
          flags: frontend
```

---

## Naming Conventions

| Rule | Example |
|------|---------|
| Test files co-located with source | `auth.ts` → `auth.test.ts` in same folder |
| `describe` = module/class name | `describe('requireAuth middleware', ...)` |
| `it` = one behaviour in plain English | `it('returns 401 when no Authorization header is present')` |
| Mocks defined at describe level | `const mockSaveReport = vi.fn()` inside `describe` |
| Integration tests use `.integration.test.ts` suffix | `history.integration.test.ts` |
| Factory functions for test data | `makeAuditReport({ overallScore: 90 })` |

---

## Phase → Test File Map

| Phase | Companion Test File |
|-------|---------------------|
| Phase 1 — Foundation | `plans/PHASE_1_TESTS.md` |
| Phase 2 — Intelligence | `plans/PHASE_2_TESTS.md` |
| Phase 3 — Frameworks | `plans/PHASE_3_TESTS.md` |
| Phase 4 — Data Enrichment | `plans/PHASE_4_TESTS.md` |
| Phase 5 — Product Features | `plans/PHASE_5_TESTS.md` |
| Phase 6 — Architecture | `plans/PHASE_6_TESTS.md` |

**Rule:** Complete the phase implementation tasks first, then implement the companion test file.
Each test file is self-contained and references the exact source file paths from its phase plan.

---

## AG Prompt Template (Testing)

```
I'm adding tests for Phase [N] of VelocityCSO.
Testing stack: vitest, supertest, @testing-library/react (see plans/TESTING_STRATEGY.md).
Phase implementation: [paste PHASE_N_*.md]
Test plan: [paste PHASE_N_TESTS.md]

Please implement the test files listed in PHASE_N_TESTS.md.
Start by reading the source files being tested, then write the tests.
Use the mock factories in src/__tests__/factories/ where needed.
Run `npm test` at the end and fix any failures.
```
