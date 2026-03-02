# VelocityCSO — Implementation Plans Index

> Generated: March 2026  
> For use with Antigravity (AG) AI development assistant.

---

## Overview

Six phases, ordered by priority. Each phase is self-contained with step-by-step
tasks, exact file paths, code snippets, and acceptance criteria.

**Read `STRATEGY_ROADMAP.md` in the root first** for the full strategic context.

---

## Phase Files

| Implementation | Tests | Goal | Key Output |
|---------------|-------|------|------------|
| [PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md) | [PHASE_1_TESTS.md](./PHASE_1_TESTS.md) | Eliminate credibility, security, and circular dependency issues | Auth, web search, critic agent, dead code removal |
| [PHASE_2_INTELLIGENCE.md](./PHASE_2_INTELLIGENCE.md) | [PHASE_2_TESTS.md](./PHASE_2_TESTS.md) | Better AI output quality through staged pipeline and rubrics | 20 dimensions, CoT scaffolding, staged pipeline |
| [PHASE_3_FRAMEWORKS.md](./PHASE_3_FRAMEWORKS.md) | [PHASE_3_TESTS.md](./PHASE_3_TESTS.md) | Add 5 high-impact strategy frameworks | Blue Ocean, Unit Economics, Porter's, Monte Carlo, Wardley |
| [PHASE_4_DATA_ENRICHMENT.md](./PHASE_4_DATA_ENRICHMENT.md) | [PHASE_4_TESTS.md](./PHASE_4_TESTS.md) | Multi-source context ingestion and real market data | URL scraping, PDF upload, NewsAPI, Crunchbase |
| [PHASE_5_PRODUCT_FEATURES.md](./PHASE_5_PRODUCT_FEATURES.md) | [PHASE_5_TESTS.md](./PHASE_5_TESTS.md) | Monitoring, collaboration, and enterprise exports | Audit history, action roadmap, share links, PDF quality |
| [PHASE_6_ARCHITECTURE.md](./PHASE_6_ARCHITECTURE.md) | [PHASE_6_TESTS.md](./PHASE_6_TESTS.md) | Scale, test coverage, and frontend maintainability | Redis SSE, multi-tenant, test suite, component decomposition |

> **Testing master doc:** [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) — install this first (vitest config, mock setup, CI pipeline, conventions).

---

## Execution Order

```
TESTING_STRATEGY.md (setup vitest, mocks, CI — do this first)
    │
Phase 1 (Foundation)  ──►  Phase 1 Tests
  └─► Phase 2 (Intelligence)  ──►  Phase 2 Tests
        └─► Phase 3 (Frameworks)  ──►  Phase 3 Tests
              └─► Phase 4 (Data)  ──►  Phase 4 Tests
                    └─► Phase 5 (Product)  ──►  Phase 5 Tests
                          └─► Phase 6 (Architecture)  ──►  Phase 6 Tests
                                └─► Full coverage check (npm run test:coverage)
```

**Rule:** For each phase — implement first, then run its companion test file.
Phases 1–3 are prerequisites for all subsequent work.
Phases 4 and 5 can be run in parallel after Phase 3.
Phase 6 can begin in parallel with Phase 4/5 (architecture work is independent).

---

## New Files to Create (all phases)

### Backend (`src/`)
```
src/middleware/auth.ts                    Phase 1
src/services/sseService.ts               Phase 1
src/services/monteCarloService.ts        Phase 3
src/services/scraperService.ts           Phase 4
src/services/documentParser.ts           Phase 4
src/services/marketDataService.ts        Phase 4
src/services/emailService.ts             Phase 5
src/agents/blueOceanAgent.ts             Phase 3
src/agents/wardleyAgent.ts               Phase 3
src/data/benchmarks.ts                   Phase 4
scripts/migrateDiscoverySessions.ts      Phase 6
src/coordinator.test.ts                  Phase 6
src/services/monteCarloService.test.ts   Phase 6
src/agents/interrogator.test.ts          Phase 6
```

### Frontend (`frontend/src/`)
```
frontend/src/firebase.ts                          Phase 1
frontend/src/hooks/useAuditSession.ts             Phase 6
frontend/src/utils/sse.ts                         Phase 6
frontend/src/types/frameworks.ts                  Phase 3
frontend/src/components/BlueOceanCanvas.tsx       Phase 3
frontend/src/components/UnitEconomicsDashboard.tsx Phase 3
frontend/src/components/FiveForces.tsx            Phase 3
frontend/src/components/MonteCarloChart.tsx       Phase 3
frontend/src/components/WardleyMap.tsx            Phase 3
frontend/src/components/AuditHistory.tsx          Phase 5
frontend/src/components/ActionRoadmap.tsx         Phase 5
frontend/src/components/audit/AuditInputForm.tsx  Phase 6
frontend/src/components/audit/ClarificationDialog.tsx Phase 6
frontend/src/components/audit/ProcessingView.tsx  Phase 6
frontend/src/components/audit/ReportDashboard.tsx Phase 6
```

### Infrastructure
```
firestore.rules          Phase 6
vitest.config.ts         Phase 6
.env.example             Phase 4 (document all env vars)
```

---

## Files to Modify (all phases)

| File | Phases | Key Changes |
|------|--------|-------------|
| `src/index.ts` | 1,4,5 | Auth middleware, new endpoints, remove dead code |
| `src/coordinator.ts` | 1,2,3 | Critic wiring, staged pipeline, Blue Ocean + Wardley integration |
| `src/specialists.ts` | 2,3 | Scoring rubrics, CoT scaffold, new dimensions, new output schemas |
| `src/agents/discovery.ts` | 1,2 | Google Search Grounding, PESTLE output |
| `src/agents/interrogator.ts` | 1,2 | Fix `idBreakdown`, update import to sseService |
| `src/critic.ts` | 1 | Strengthen critic prompt |
| `src/scenarios.ts` | 3 | Add Monte Carlo interfaces |
| `src/services/pdfService.ts` | 5 | Fix Unicode, add ToC, radar chart, cache, REGULATORY |
| `src/services/sessionService.ts` | 1,6 | Remove dead code, consolidate collections |
| `src/services/logger.ts` | 1 | Add gemini-2.0-flash-exp to pricing table |
| `package.json` | 4,6 | Add multer, ioredis, vitest, canvas |
| `frontend/src/components/HeroSection.tsx` | 1,3,5,6 | Auth headers, new framework cards, reduced to orchestrator |
| `frontend/src/components/DiagnosticScorecard.tsx` | 2 | 20 dimensions in 5 categories |
| `frontend/src/components/StrategyRadar.tsx` | 2 | Handle 20 dimensions |
| `frontend/src/components/StressTestPanel.tsx` | 1,3 | Remove duplicate StressResult type, use shared readSSE |
| `frontend/src/types/stress.ts` | 1 | Add StatusEvent, consolidate types |
| `frontend/tailwind.config.js` | — | No changes needed |
| `frontend/vite.config.ts` | — | No changes needed |

---

## Environment Variables (`.env.example`)

```bash
# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GCLOUD_PROJECT=velocitycso

# Firebase
FIREBASE_PROJECT_ID=velocitycso

# Frontend (VITE_ prefix exposes to browser)
VITE_API_URL=http://localhost:8080
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=velocitycso.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=velocitycso

# External APIs (all optional — system degrades gracefully if absent)
NEWS_API_KEY=              # newsapi.org
CRUNCHBASE_API_KEY=        # crunchbase.com basic API
JINA_API_KEY=              # jina.ai reader (for URL scraping)
SENDGRID_API_KEY=          # sendgrid.com (for digest emails)
REDIS_URL=redis://localhost:6379  # ioredis (for SSE scaling)

# App
APP_URL=https://velocitycso.com
```

---

## Quick-Start for AG

### Implementation

When starting each phase, provide AG with:

1. **This index file** — for file paths and context
2. **The specific phase file** — for detailed tasks
3. **The relevant source files** — AG should read them before changing

**Suggested AG prompt (implementation):**

```
I'm implementing Phase [N] of the VelocityCSO improvement plan.
Context: [paste INDEX.md]
Phase plan: [paste PHASE_N_*.md]
Current source files: [paste relevant src files]

Please implement Task [N.X] as described.
Start by reading the files to be modified, then make the changes.
```

### Tests (run after each phase)

After completing a phase's implementation tasks, provide AG with:

1. **TESTING_STRATEGY.md** — for stack setup and mock conventions
2. **The PHASE_N_TESTS.md** — for the specific test files
3. **The source files being tested** — AG should read them to align imports

**Suggested AG prompt (tests):**

```
I've completed Phase [N] of VelocityCSO.
Now implement the test suite from PHASE_[N]_TESTS.md.

Testing strategy: [paste TESTING_STRATEGY.md]
Test plan: [paste PHASE_[N]_TESTS.md]
Source files to test: [paste relevant src files]

Read each source file, adapt imports to match actual exports,
implement the tests, run npm test, and fix any failures.
Target: ≥ 80% line coverage on all new files.
```
