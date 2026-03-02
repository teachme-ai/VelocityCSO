# Phase 6: Architecture for Scale

> **Goal:** Harden the infrastructure for multi-instance deployment, multi-tenant data isolation, test coverage, and frontend maintainability.  
> **Depends on:** Phase 1 (Auth, sseService), all earlier phases complete.

---

## Task 6.1 — Redis Pub/Sub for SSE Horizontal Scaling

### Problem
The current `activeConnections` Map in `sseService.ts` lives in-memory on a single process. If Cloud Run scales to 2+ instances, a user connected to Instance A will never receive heartbeats emitted by agents running on Instance B.

### Install dependencies

```bash
npm install ioredis @types/ioredis
```

### Rewrite `src/services/sseService.ts`

```typescript
// src/services/sseService.ts — full replacement

import { Response } from 'express';
import Redis from 'ioredis';

export type HeartbeatType = 'standard' | 'warning' | 'debug' | 'error';

// Two Redis connections: one publishes, one subscribes
// (ioredis requires separate connections for pub/sub)
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const publisher = new Redis(redisUrl);
const subscriber = new Redis(redisUrl);

// Local connections on THIS instance only
const localConnections = new Map<string, Response>();

// Subscribe to all heartbeat channels on startup
subscriber.psubscribe('heartbeat:*', (err) => {
  if (err) console.error('Redis subscribe error:', err);
});

// Fan out to local connections when a message arrives
subscriber.on('pmessage', (_pattern, channel, message) => {
  const sessionId = channel.replace('heartbeat:', '');
  const res = localConnections.get(sessionId);
  if (!res) return; // connection is on a different instance — ignore

  try {
    res.write(`data: ${message}\n\n`);
  } catch {
    localConnections.delete(sessionId);
  }
});

export function registerConnection(sessionId: string, res: Response): void {
  localConnections.set(sessionId, res);
}

export function removeConnection(sessionId: string): void {
  localConnections.delete(sessionId);
}

export async function emitHeartbeat(
  sessionId: string,
  message: string,
  type: HeartbeatType = 'standard'
): Promise<void> {
  const payload = JSON.stringify({
    type: 'HEARTBEAT',
    timestamp: new Date().toISOString(),
    message,
    logType: type,
  });

  // Publish to Redis — all instances receive it, only the one with the connection writes it
  await publisher.publish(`heartbeat:${sessionId}`, payload);
}

export async function emitEvent(sessionId: string, payload: object): Promise<void> {
  const data = JSON.stringify(payload);
  await publisher.publish(`heartbeat:${sessionId}`, data);
}
```

### Environment variable

```bash
# .env — add:
REDIS_URL=redis://localhost:6379

# For Google Cloud (use Memorystore):
# REDIS_URL=redis://10.x.x.x:6379
```

### Cloud Run deployment note

```yaml
# cloud-run-service.yaml — add Redis connectivity:
# Use Cloud Memorystore (Redis) with VPC connector
# Add REDIS_URL as a secret in Secret Manager
```

---

## Task 6.2 — Cache PDF Stress-Test Results

### Problem
Every PDF download triggers 4–5 LLM calls (`runStressScenario()` × scenarios). This costs money and takes 10–30 seconds per download. Stress results should be computed once and cached.

### Changes to `src/services/pdfService.ts`

```typescript
// src/services/pdfService.ts — modify generatePDF()

export async function generatePDF(memory: AuditMemory): Promise<Buffer> {
  // 1. Check if stress results are already cached in Firestore
  const reportRef = admin.firestore()
    .collection('enterprise_strategy_reports')
    .doc(memory.reportId);

  const doc = await reportRef.get();
  const cached = doc.data()?.stressResultsCache as Record<string, StressResult> | undefined;

  let stressMap: Record<string, StressResult>;

  if (cached && Object.keys(cached).length === 5) {
    // Use cached results — no LLM calls needed
    stressMap = cached;
  } else {
    // Run stress scenarios and cache the results
    const scenarioIds: ScenarioId[] = ['RECESSION', 'PRICE_WAR', 'SCALE_UP', 'TALENT', 'REGULATORY'];
    const stressResults = await Promise.all(
      scenarioIds.map(id => runStressScenario(id, memory.businessContext, memory.dimensions))
    );

    stressMap = Object.fromEntries(
      scenarioIds.map((id, i) => [id, stressResults[i]])
    );

    // Cache in Firestore for future PDF downloads
    await reportRef.update({ stressResultsCache: stressMap });
  }

  return _buildPDF(new PDFDocument({ autoFirstPage: false }), memory, stressMap);
}
```

### Pre-warm cache at report generation time

```typescript
// src/index.ts — after saving the report, trigger stress computation in background:

// Don't await — fire and forget to pre-warm the cache
import('./services/pdfService.js').then(({ prewarmStressCache }) => {
  prewarmStressCache(reportId, businessContext, dimensions).catch(console.error);
});

// In pdfService.ts — add:
export async function prewarmStressCache(
  reportId: string,
  businessContext: string,
  dimensions: Record<string, number>
): Promise<void> {
  const scenarioIds: ScenarioId[] = ['RECESSION', 'PRICE_WAR', 'SCALE_UP', 'TALENT', 'REGULATORY'];
  const results = await Promise.all(
    scenarioIds.map(id => runStressScenario(id, businessContext, dimensions))
  );

  const stressMap = Object.fromEntries(scenarioIds.map((id, i) => [id, results[i]]));
  await admin.firestore()
    .collection('enterprise_strategy_reports').doc(reportId)
    .update({ stressResultsCache: stressMap });
}
```

---

## Task 6.3 — Multi-Tenant Data Isolation

### Firestore security rules

Create or update `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Reports: owner or same org can read; only owner can write
    match /enterprise_strategy_reports/{reportId} {
      allow read: if request.auth != null &&
        (resource.data.userId == request.auth.uid ||
         resource.data.orgId == request.auth.token.orgId);
      allow create: if request.auth != null &&
        request.resource.data.userId == request.auth.uid;
      allow update: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow delete: if false; // never delete via client

      // Specialist outputs subcollection
      match /specialist_outputs/{specialistId} {
        allow read: if request.auth != null &&
          get(/databases/$(database)/documents/enterprise_strategy_reports/$(reportId))
            .data.orgId == request.auth.token.orgId;
        allow write: if false; // server-side only
      }
    }

    // Sessions: owner only
    match /velocity_cso_sessions/{sessionId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    // User preferences
    match /user_preferences/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Add `orgId` + `userId` to all Firestore writes

```typescript
// src/index.ts — audit every admin.firestore().collection().add() or .set() call
// Ensure ALL documents include userId and orgId from the authenticated request

// Pattern to search for and update:
// Before: { ...reportData }
// After:  { ...reportData, userId: req.userId, orgId: req.orgId }
```

### Rate limiting middleware

```typescript
// src/middleware/rateLimit.ts

const WINDOW_MS = 60 * 1000;       // 1 minute
const MAX_REQUESTS_PER_USER = 5;   // max 5 audits per minute per user
const MAX_REQUESTS_PER_ORG = 20;   // max 20 per minute per org

const userCounts = new Map<string, { count: number; resetAt: number }>();
const orgCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitAudit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const now = Date.now();
  const userId = req.userId!;
  const orgId = req.orgId!;

  // Check user limit
  const userBucket = userCounts.get(userId);
  if (userBucket && userBucket.resetAt > now) {
    if (userBucket.count >= MAX_REQUESTS_PER_USER) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait before running another audit.' });
      return;
    }
    userBucket.count++;
  } else {
    userCounts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
  }

  // Check org limit
  const orgBucket = orgCounts.get(orgId);
  if (orgBucket && orgBucket.resetAt > now) {
    if (orgBucket.count >= MAX_REQUESTS_PER_ORG) {
      res.status(429).json({ error: 'Organisation rate limit exceeded.' });
      return;
    }
    orgBucket.count++;
  } else {
    orgCounts.set(orgId, { count: 1, resetAt: now + WINDOW_MS });
  }

  next();
}
```

Apply to audit endpoint:

```typescript
// src/index.ts:
import { rateLimitAudit } from './middleware/rateLimit.js';

app.post('/analyze', requireAuth, rateLimitAudit, async (req, res) => {
  // ...
});
```

---

## Task 6.4 — Consolidate Session Collections

### Problem
Sessions are stored in two separate Firestore collections:
- `velocity_cso_sessions` (main sessions in `sessionService.ts`)
- `discovery_sessions` (asked questions in `interrogator.ts`)

These are never cross-referenced and create cleanup gaps.

### Fix

```typescript
// src/agents/interrogator.ts — change collection reference:

// Before:
const askedRef = admin.firestore()
  .collection('discovery_sessions')
  .doc(sessionId)
  .collection('asked_questions');

// After:
const askedRef = admin.firestore()
  .collection('velocity_cso_sessions')  // same collection as session
  .doc(sessionId)
  .collection('asked_questions');
```

### Migration script for existing data (run once)

```typescript
// scripts/migrateDiscoverySessions.ts

import admin from 'firebase-admin';
admin.initializeApp();

async function migrate() {
  const oldDocs = await admin.firestore().collection('discovery_sessions').listDocuments();

  for (const docRef of oldDocs) {
    const askedQuestions = await docRef.collection('asked_questions').get();

    for (const qDoc of askedQuestions.docs) {
      await admin.firestore()
        .collection('velocity_cso_sessions')
        .doc(docRef.id)
        .collection('asked_questions')
        .doc(qDoc.id)
        .set(qDoc.data());
    }

    // Delete old document
    await docRef.delete();
  }

  console.log(`Migrated ${oldDocs.length} sessions`);
}

migrate().catch(console.error);
```

---

## Task 6.5 — Decompose `HeroSection.tsx`

### Target structure

```
frontend/src/
  hooks/
    useAuditSession.ts       ← SSE streaming, phase state, all API calls
  components/
    audit/
      AuditInputForm.tsx     ← idle phase
      ClarificationDialog.tsx ← clarifying phase
      ProcessingView.tsx     ← discovery/evaluating/analyzing phases
      ReportDashboard.tsx    ← done phase (assembles all report sections)
    HeroSection.tsx          ← thin orchestrator (renders correct component by phase)
```

### `useAuditSession.ts` hook

```typescript
// frontend/src/hooks/useAuditSession.ts

import { useState, useCallback } from 'react';
import { StatusEvent } from '../types/stress';
import { HeartbeatLog } from '../types/stress';

export type Phase =
  | 'idle' | 'discovery' | 'evaluating'
  | 'clarifying' | 'analyzing' | 'done' | 'error';

interface AuditSessionState {
  phase: Phase;
  phaseLabel: string;
  result: ReportData | null;
  clarification: ClarificationState | null;
  error: string;
  sseEvents: StatusEvent[];
  heartbeatLogs: HeartbeatLog[];
  stressResult: StressResult | null;
  currentReportId: string | null;
  currentReportToken: string | null;
}

export function useAuditSession(apiBase: string) {
  const [state, setState] = useState<AuditSessionState>({
    phase: 'idle',
    phaseLabel: '',
    result: null,
    clarification: null,
    error: '',
    sseEvents: [],
    heartbeatLogs: [],
    stressResult: null,
    currentReportId: null,
    currentReportToken: null,
  });

  const setPhase = useCallback((phase: Phase, label = '') =>
    setState(s => ({ ...s, phase, phaseLabel: label })), []);

  const addHeartbeat = useCallback((log: HeartbeatLog) =>
    setState(s => ({ ...s, heartbeatLogs: [...s.heartbeatLogs.slice(-199), log] })), []);

  const addEvent = useCallback((event: StatusEvent) =>
    setState(s => ({ ...s, sseEvents: [...s.sseEvents, event] })), []);

  // Submit initial audit
  const submitAudit = useCallback(async (context: string, stressTest: boolean) => {
    setPhase('discovery', 'Scanning market signals...');

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ business_context: context, stress_test: stressTest }),
      });

      for await (const event of readSSE(response)) {
        handleSseEvent(event, setState, setPhase, addHeartbeat, addEvent);
      }
    } catch (err: any) {
      setState(s => ({ ...s, phase: 'error', error: err.message }));
    }
  }, [apiBase]);

  // Submit clarification
  const submitClarification = useCallback(async (sessionId: string, text: string, stressTest: boolean) => {
    setPhase('evaluating', 'Processing clarification...');

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/analyze/clarify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, clarification: text, stress_test: stressTest }),
      });

      for await (const event of readSSE(response)) {
        handleSseEvent(event, setState, setPhase, addHeartbeat, addEvent);
      }
    } catch (err: any) {
      setState(s => ({ ...s, phase: 'error', error: err.message }));
    }
  }, [apiBase]);

  const setStressResult = useCallback((result: StressResult) =>
    setState(s => ({ ...s, stressResult: result })), []);

  const reset = useCallback(() =>
    setState({
      phase: 'idle', phaseLabel: '', result: null, clarification: null,
      error: '', sseEvents: [], heartbeatLogs: [], stressResult: null,
      currentReportId: null, currentReportToken: null,
    }), []);

  return { ...state, submitAudit, submitClarification, setStressResult, reset };
}
```

### `HeroSection.tsx` after decomposition

```tsx
// frontend/src/components/HeroSection.tsx — reduced from 720 to ~80 lines

import { useState } from 'react';
import { useAuditSession } from '../hooks/useAuditSession';
import { AuditInputForm } from './audit/AuditInputForm';
import { ClarificationDialog } from './audit/ClarificationDialog';
import { ProcessingView } from './audit/ProcessingView';
import { ReportDashboard } from './audit/ReportDashboard';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function HeroSection() {
  const session = useAuditSession(API_BASE);
  const [context, setContext] = useState('');
  const [stressTest, setStressTest] = useState(false);
  const [clarificationInput, setClarificationInput] = useState('');

  return (
    <section id="audit" className="min-h-screen relative flex flex-col items-center justify-center py-20 px-4">
      <StarField />

      {session.phase === 'idle' && (
        <AuditInputForm
          context={context}
          onContextChange={setContext}
          stressTest={stressTest}
          onStressTestChange={setStressTest}
          onSubmit={() => session.submitAudit(context, stressTest)}
          error={session.error}
          apiBase={API_BASE}
        />
      )}

      {session.phase === 'clarifying' && session.clarification && (
        <ClarificationDialog
          clarification={session.clarification}
          input={clarificationInput}
          onInputChange={setClarificationInput}
          onSubmit={() => {
            session.submitClarification(
              session.clarification!.sessionId,
              clarificationInput,
              stressTest
            );
            setClarificationInput('');
          }}
        />
      )}

      {['discovery', 'evaluating', 'analyzing'].includes(session.phase) && (
        <ProcessingView
          phase={session.phase as any}
          phaseLabel={session.phaseLabel}
          heartbeatLogs={session.heartbeatLogs}
        />
      )}

      {session.phase === 'done' && session.result && (
        <ReportDashboard
          result={session.result}
          stressResult={session.stressResult}
          reportId={session.currentReportId}
          reportToken={session.currentReportToken}
          onStressResult={session.setStressResult}
          onClose={session.reset}
          apiBase={API_BASE}
        />
      )}
    </section>
  );
}
```

---

## Task 6.6 — Add Test Suite

### Install dependencies

```bash
# Backend tests:
npm install --save-dev vitest @vitest/coverage-v8

# Frontend tests:
cd frontend && npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

### `vitest.config.ts` (backend)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { reporter: ['text', 'lcov'] },
  },
});
```

### Critical tests to write first

**1. `src/coordinator.test.ts` — robustParse()**

```typescript
// src/coordinator.test.ts
import { describe, it, expect } from 'vitest';
import { ChiefStrategyAgent } from './coordinator.js';

describe('robustParse', () => {
  const agent = new ChiefStrategyAgent();

  it('extracts JSON from raw LLM output with surrounding text', () => {
    const raw = 'Sure! Here is the analysis:\n```json\n{"dimensions":{"tam_viability":{"score":75}}}\n```';
    const result = agent['robustParse']('test', raw, { dimensions: {} });
    expect(result.dimensions.tam_viability.score).toBe(75);
  });

  it('returns default when JSON is malformed', () => {
    const raw = 'Sorry, I cannot analyse this.';
    const result = agent['robustParse']('test', raw, { dimensions: { tam_viability: { score: 50 } } });
    expect(result.dimensions.tam_viability.score).toBe(50);
  });

  it('handles flat dimension format (legacy)', () => {
    const raw = '{"dimensions":{"tam_viability":75}}';
    const result = agent['robustParse']('test', raw, { dimensions: {} });
    expect(result.dimensions.tam_viability).toBe(75);
  });
});
```

**2. `src/services/monteCarloService.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from './monteCarloService.js';

const BASE_INPUT = {
  arpu_low: 80, arpu_base: 100, arpu_high: 130,
  churn_low: 1, churn_base: 2, churn_high: 4,
  cac_low: 150, cac_base: 200, cac_high: 300,
  growth_rate_low: 5, growth_rate_base: 10, growth_rate_high: 20,
  gross_margin_low: 60, gross_margin_base: 70, gross_margin_high: 80,
};

describe('runMonteCarlo', () => {
  it('returns P10 < P50 < P90 for LTV:CAC', () => {
    const result = runMonteCarlo(BASE_INPUT, 1000);
    const d = result.ltv_cac_distribution;
    expect(d.p10).toBeLessThan(d.p50);
    expect(d.p50).toBeLessThan(d.p90);
  });

  it('failure probability is between 0 and 1', () => {
    const result = runMonteCarlo(BASE_INPUT, 500);
    expect(result.ltv_cac_distribution.probability_of_failure).toBeGreaterThanOrEqual(0);
    expect(result.ltv_cac_distribution.probability_of_failure).toBeLessThanOrEqual(1);
  });

  it('high churn input increases failure probability', () => {
    const highChurn = { ...BASE_INPUT, churn_low: 8, churn_base: 12, churn_high: 20 };
    const result = runMonteCarlo(highChurn, 1000);
    expect(result.ltv_cac_distribution.probability_of_failure).toBeGreaterThan(0.3);
  });
});
```

**3. `src/agents/interrogator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { scoreContextDeterministically } from './interrogator.js';

describe('scoreContextDeterministically', () => {
  it('returns max score for rich context', () => {
    const rich = 'Acme Corp is a London-based B2B SaaS competing with Salesforce and HubSpot. We have patent-protected IP and 200 enterprise customers generating £4M ARR.';
    const result = scoreContextDeterministically(rich);
    expect(result.total).toBeGreaterThan(70);
    expect(result.specificity).not.toBe(result.completeness); // independent scores
  });

  it('returns low score for sparse context', () => {
    const sparse = 'We sell software to businesses.';
    const result = scoreContextDeterministically(sparse);
    expect(result.total).toBeLessThan(40);
  });

  it('three sub-scores are independent', () => {
    const onlyLocation = 'Our company is based in New York.';
    const result = scoreContextDeterministically(onlyLocation);
    expect(result.specificity).toBeGreaterThan(0);
    expect(result.moat).toBe(0); // no moat keywords
  });
});
```

### Add test scripts to `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Task 6.7 — Extract Shared Frontend Utilities

### New file: `frontend/src/utils/sse.ts`

```typescript
// frontend/src/utils/sse.ts — extracted from HeroSection and StressTestPanel

export async function* readSSE(response: Response): AsyncGenerator<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}
```

Update both `HeroSection.tsx` (now in `useAuditSession.ts`) and `StressTestPanel.tsx` to import from `'../utils/sse'`.

---

## Phase 6 Completion Checklist

- [ ] `sseService.ts` uses Redis pub/sub (`ioredis`)
- [ ] Cloud Run can scale to multiple instances without SSE connection loss
- [ ] PDF stress-test results are cached in Firestore on first run
- [ ] Subsequent PDF downloads serve cached results (no LLM calls)
- [ ] Firestore security rules enforce org-level data isolation
- [ ] Rate limiting middleware applied to `/analyze` endpoint
- [ ] `velocity_cso_sessions` is the single session collection (no more `discovery_sessions`)
- [ ] Migration script written for existing `discovery_sessions` data
- [ ] `HeroSection.tsx` reduced to ~80 lines (thin orchestrator)
- [ ] `useAuditSession.ts` hook encapsulates all SSE + state logic
- [ ] `AuditInputForm.tsx`, `ClarificationDialog.tsx`, `ProcessingView.tsx`, `ReportDashboard.tsx` created
- [ ] `frontend/src/utils/sse.ts` created; `readSSE` defined in one place
- [ ] `vitest` configured for backend
- [ ] `vitest` + `@testing-library/react` configured for frontend
- [ ] `robustParse()` test covers 3 input scenarios
- [ ] `runMonteCarlo()` test covers 3 scenarios
- [ ] `scoreContextDeterministically()` test covers 3 scenarios
- [ ] `npm test` passes with zero failures
- [ ] `npm run build` passes (backend and frontend)
- [ ] `REDIS_URL` documented in `.env.example`
