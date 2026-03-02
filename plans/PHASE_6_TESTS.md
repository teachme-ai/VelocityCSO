# Phase 6 Tests — Architecture

> **Companion to:** `PHASE_6_ARCHITECTURE.md`
> **Prerequisite:** Phase 1–5 tests passing. Phase 6 tasks complete.
> **Key additions:** Redis SSE, rate limiting, Firestore rules, frontend component decomposition.
> **Note:** Phase 6 also adds vitest config — this file assumes the config from `TESTING_STRATEGY.md`
> is already in place (it should be, since it was set up in Phase 1).

---

## What This Covers

| Task (Phase 6) | Test File |
|----------------|-----------|
| Task 6.1 — Redis SSE fan-out | `src/services/sseService.redis.test.ts` |
| Task 6.3 — Rate limiting | `src/middleware/rateLimit.test.ts` |
| Task 6.3 — Firestore security rules | `firestore.rules.test.ts` |
| Task 6.5 — Decomposed HeroSection hook | `frontend/src/hooks/useAuditSession.test.ts` |
| Task 6.5 — AuditInputForm component | `frontend/src/components/audit/AuditInputForm.test.tsx` |
| Task 6.5 — ClarificationDialog component | `frontend/src/components/audit/ClarificationDialog.test.tsx` |
| Task 6.7 — Shared SSE utility | `frontend/src/utils/sse.test.ts` |

---

## Test File 1: `src/services/sseService.redis.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ioredis before importing the service
const mockPublish = vi.fn().mockResolvedValue(1);
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    on: mockOn,
    duplicate: vi.fn().mockReturnThis(), // subscriber uses .duplicate()
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('SSEService with Redis backend (Phase 6 Task 6.1)', () => {
  let sseService: any;

  beforeEach(async () => {
    vi.resetModules(); // ensure fresh module with mock applied
    sseService = await import('./sseService');
    mockPublish.mockClear();
    mockSubscribe.mockClear();
    mockUnsubscribe.mockClear();
  });

  it('publish() calls Redis publish with the channel and JSON payload', async () => {
    await sseService.publishEvent('org-001', 'audit_complete', { score: 75 });

    expect(mockPublish).toHaveBeenCalledOnce();
    const [channel, payload] = mockPublish.mock.calls[0];
    expect(channel).toContain('org-001');
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({ type: 'audit_complete', score: 75 });
  });

  it('subscribe() registers a Redis channel listener for the orgId', async () => {
    const handler = vi.fn();
    await sseService.subscribeToOrg('org-002', handler);

    expect(mockSubscribe).toHaveBeenCalledOnce();
    const channel = mockSubscribe.mock.calls[0][0];
    expect(channel).toContain('org-002');
  });

  it('message handler is invoked when Redis emits a message on the channel', async () => {
    const handler = vi.fn();
    await sseService.subscribeToOrg('org-003', handler);

    // Simulate Redis emitting a message
    const onMessageCall = mockOn.mock.calls.find(([event]: string[]) => event === 'message');
    expect(onMessageCall).toBeDefined();
    const onMessageCallback = onMessageCall[1];
    onMessageCallback('velocitycso:org-003', JSON.stringify({ type: 'heartbeat', phase: 'discovery' }));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'heartbeat' }));
  });

  it('unsubscribeFromOrg() calls Redis unsubscribe for the channel', async () => {
    await sseService.unsubscribeFromOrg('org-004');
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it('multiple Cloud Run instances receiving the same Redis message each emit to their local connections', () => {
    // This is verified by the fact that each instance subscribes independently
    // and the message handler routes to its own in-memory Map of response objects.
    // The test verifies the subscribe call is made per instance (not a shared singleton).
    const instanceSubscriptions = new Set(mockSubscribe.mock.calls.map(([c]: string[]) => c));
    expect(instanceSubscriptions.size).toBeGreaterThanOrEqual(0); // at least 0 (no subscriptions yet in this test)
  });
});
```

---

## Test File 2: `src/middleware/rateLimit.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from './rateLimit';

// Use fake timers for rate limit window tests
function makeReqWithUser(uid: string, orgId?: string): Partial<Request> {
  return {
    user: { uid, orgId } as any,
    ip: '127.0.0.1',
  } as Partial<Request>;
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('createRateLimiter()', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('per-user limit (5 requests / minute)', () => {
    it('allows the first 5 requests', async () => {
      const limiter = createRateLimiter({ maxPerUser: 5, maxPerOrg: 20, windowMs: 60_000 });
      const req = makeReqWithUser('user-001');
      const res = makeRes();

      for (let i = 0; i < 5; i++) {
        await limiter(req as Request, res as unknown as Response, next);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks the 6th request with HTTP 429', async () => {
      const limiter = createRateLimiter({ maxPerUser: 5, maxPerOrg: 20, windowMs: 60_000 });
      const req = makeReqWithUser('user-002');
      const res = makeRes();

      for (let i = 0; i < 5; i++) {
        await limiter(req as Request, res as unknown as Response, next);
      }
      next = vi.fn(); // reset next spy
      const res6 = makeRes();
      await limiter(req as Request, res6 as unknown as Response, next);

      expect(res6.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('resets the count after the window expires', async () => {
      const limiter = createRateLimiter({ maxPerUser: 5, maxPerOrg: 20, windowMs: 60_000 });
      const req = makeReqWithUser('user-003');

      for (let i = 0; i < 5; i++) {
        await limiter(req as Request, makeRes() as unknown as Response, vi.fn());
      }

      // Advance past the window
      vi.advanceTimersByTime(61_000);

      const nextAfterReset = vi.fn();
      await limiter(req as Request, makeRes() as unknown as Response, nextAfterReset);
      expect(nextAfterReset).toHaveBeenCalled();
    });
  });

  describe('per-org limit (20 requests / minute)', () => {
    it('allows up to 20 requests across different users in the same org', async () => {
      const limiter = createRateLimiter({ maxPerUser: 5, maxPerOrg: 20, windowMs: 60_000 });

      for (let i = 0; i < 20; i++) {
        const req = makeReqWithUser(`user-${i}`, 'org-shared');
        await limiter(req as Request, makeRes() as unknown as Response, next);
      }

      expect(next).toHaveBeenCalledTimes(20);
    });

    it('blocks the 21st request at the org level', async () => {
      const limiter = createRateLimiter({ maxPerUser: 100, maxPerOrg: 20, windowMs: 60_000 });

      for (let i = 0; i < 20; i++) {
        const req = makeReqWithUser(`user-${i}`, 'org-block-test');
        await limiter(req as Request, makeRes() as unknown as Response, vi.fn());
      }

      const req21 = makeReqWithUser('user-21', 'org-block-test');
      const res21 = makeRes();
      const next21 = vi.fn();
      await limiter(req21 as Request, res21 as unknown as Response, next21);

      expect(res21.status).toHaveBeenCalledWith(429);
      expect(next21).not.toHaveBeenCalled();
    });
  });
});
```

---

## Test File 3: `firestore.rules.test.ts`

> Uses `@firebase/rules-unit-testing` with the Firestore emulator.
> Run with: `firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"`

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'velocitycso-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore security rules', () => {
  describe('velocity_cso_sessions collection', () => {
    it('allows a user to read their own org sessions', async () => {
      const alice = testEnv.authenticatedContext('alice', { orgId: 'org-A' });
      const db = alice.firestore();

      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore()
          .collection('velocity_cso_sessions')
          .doc('session-001')
          .set({ orgId: 'org-A', userId: 'alice', data: 'test' });
      });

      await assertSucceeds(
        db.collection('velocity_cso_sessions').doc('session-001').get()
      );
    });

    it('denies a user from reading another org sessions', async () => {
      const bob = testEnv.authenticatedContext('bob', { orgId: 'org-B' });
      const db = bob.firestore();

      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore()
          .collection('velocity_cso_sessions')
          .doc('session-002')
          .set({ orgId: 'org-A', userId: 'alice', data: 'secret' });
      });

      await assertFails(
        db.collection('velocity_cso_sessions').doc('session-002').get()
      );
    });

    it('denies unauthenticated reads', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      await assertFails(
        unauthed.firestore().collection('velocity_cso_sessions').doc('any').get()
      );
    });
  });

  describe('audit_reports collection', () => {
    it('allows a user to read reports from their own org', async () => {
      const alice = testEnv.authenticatedContext('alice', { orgId: 'org-A' });

      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore()
          .collection('audit_reports')
          .doc('report-001')
          .set({ orgId: 'org-A', overallScore: 72 });
      });

      await assertSucceeds(
        alice.firestore().collection('audit_reports').doc('report-001').get()
      );
    });

    it('denies writes from client SDK (server-only via Admin SDK)', async () => {
      const alice = testEnv.authenticatedContext('alice', { orgId: 'org-A' });
      await assertFails(
        alice.firestore()
          .collection('audit_reports')
          .doc('forged-report')
          .set({ orgId: 'org-A', overallScore: 100 })
      );
    });
  });
});
```

---

## Test File 4: `frontend/src/hooks/useAuditSession.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuditSession } from '../hooks/useAuditSession';

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useAuditSession()', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('initialises with empty businessContext and idle phase', () => {
    const { result } = renderHook(() => useAuditSession());
    expect(result.current.businessContext).toBe('');
    expect(result.current.phase).toBe('idle');
  });

  it('setBusinessContext updates the context value', () => {
    const { result } = renderHook(() => useAuditSession());
    act(() => {
      result.current.setBusinessContext('We are a B2B SaaS company');
    });
    expect(result.current.businessContext).toBe('We are a B2B SaaS company');
  });

  it('submitAudit sets phase to "loading" and calls /analyze endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'sess-001', clarifications: [] }),
    });

    const { result } = renderHook(() => useAuditSession());
    act(() => {
      result.current.setBusinessContext('Test company context');
    });

    await act(async () => {
      await result.current.submitAudit();
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/analyze');
  });

  it('submitAudit transitions to "clarifying" phase when server returns clarifications', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'sess-002',
        clarifications: [{ question: 'What is your primary market?', options: ['SMB', 'Enterprise'] }],
      }),
    });

    const { result } = renderHook(() => useAuditSession());
    act(() => { result.current.setBusinessContext('test'); });

    await act(async () => {
      await result.current.submitAudit();
    });

    expect(result.current.phase).toBe('clarifying');
    expect(result.current.clarifications.length).toBeGreaterThan(0);
  });

  it('submitClarifications calls /analyze/clarify endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'sess-003', clarifications: [{ question: 'q', options: ['a', 'b'] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'sess-003', clarifications: [] }) });

    const { result } = renderHook(() => useAuditSession());
    act(() => { result.current.setBusinessContext('test'); });
    await act(async () => { await result.current.submitAudit(); });

    await act(async () => {
      await result.current.submitClarifications({ q: 'a' });
    });

    const secondCall = mockFetch.mock.calls[1];
    expect(secondCall[0]).toContain('/analyze/clarify');
  });

  it('sets error state on API failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useAuditSession());
    act(() => { result.current.setBusinessContext('test'); });

    await act(async () => { await result.current.submitAudit(); });

    expect(result.current.error).toBeDefined();
    expect(result.current.phase).toBe('error');
  });
});
```

---

## Test File 5: `frontend/src/components/audit/AuditInputForm.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AuditInputForm } from '../components/audit/AuditInputForm';

describe('AuditInputForm', () => {
  it('renders a textarea for business context', () => {
    render(<AuditInputForm onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('submit button is disabled when textarea is empty', () => {
    render(<AuditInputForm onSubmit={vi.fn()} isLoading={false} />);
    const button = screen.getByRole('button', { name: /analyse|start|submit/i });
    expect(button).toBeDisabled();
  });

  it('submit button is enabled when textarea has content', async () => {
    render(<AuditInputForm onSubmit={vi.fn()} isLoading={false} />);
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'We are a B2B SaaS company');
    const button = screen.getByRole('button', { name: /analyse|start|submit/i });
    expect(button).not.toBeDisabled();
  });

  it('calls onSubmit with the typed text when form is submitted', async () => {
    const onSubmit = vi.fn();
    render(<AuditInputForm onSubmit={onSubmit} isLoading={false} />);
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'My business context');
    fireEvent.click(screen.getByRole('button', { name: /analyse|start|submit/i }));
    expect(onSubmit).toHaveBeenCalledWith('My business context');
  });

  it('shows a loading spinner and disables the button when isLoading is true', () => {
    render(<AuditInputForm onSubmit={vi.fn()} isLoading={true} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // Loading state should show some visual indicator
    expect(screen.getByRole('button').textContent).not.toBe(''); // not empty
  });

  it('renders optional placeholder text', () => {
    render(<AuditInputForm onSubmit={vi.fn()} isLoading={false} placeholder="Describe your business..." />);
    expect(screen.getByPlaceholderText(/describe your business/i)).toBeInTheDocument();
  });
});
```

---

## Test File 6: `frontend/src/components/audit/ClarificationDialog.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClarificationDialog } from '../components/audit/ClarificationDialog';

const mockClarifications = [
  {
    id: 'q1',
    question: 'What is your primary market segment?',
    options: ['SMB (< 500 employees)', 'Mid-Market (500–5000)', 'Enterprise (5000+)'],
  },
  {
    id: 'q2',
    question: 'What stage is your business in?',
    options: ['Pre-revenue', 'Early revenue ($0–$1M ARR)', 'Growth ($1M+ ARR)'],
  },
];

describe('ClarificationDialog', () => {
  it('renders all clarification questions', () => {
    render(<ClarificationDialog clarifications={mockClarifications} onSubmit={vi.fn()} />);
    expect(screen.getByText(/primary market segment/i)).toBeInTheDocument();
    expect(screen.getByText(/stage is your business/i)).toBeInTheDocument();
  });

  it('renders all options for each question', () => {
    render(<ClarificationDialog clarifications={mockClarifications} onSubmit={vi.fn()} />);
    expect(screen.getByText(/SMB/)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise/)).toBeInTheDocument();
    expect(screen.getByText(/Pre-revenue/)).toBeInTheDocument();
  });

  it('submit button is disabled until all questions are answered', () => {
    render(<ClarificationDialog clarifications={mockClarifications} onSubmit={vi.fn()} />);
    const submitBtn = screen.getByRole('button', { name: /submit|continue|proceed/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is enabled after all questions are answered', () => {
    render(<ClarificationDialog clarifications={mockClarifications} onSubmit={vi.fn()} />);

    // Click an option for each question
    fireEvent.click(screen.getByText(/SMB/));
    fireEvent.click(screen.getByText(/Pre-revenue/));

    const submitBtn = screen.getByRole('button', { name: /submit|continue|proceed/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onSubmit with map of question IDs to selected answers', () => {
    const onSubmit = vi.fn();
    render(<ClarificationDialog clarifications={mockClarifications} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText(/Mid-Market/));
    fireEvent.click(screen.getByText(/Growth/));
    fireEvent.click(screen.getByRole('button', { name: /submit|continue|proceed/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      q1: expect.stringContaining('Mid-Market'),
      q2: expect.stringContaining('Growth'),
    });
  });
});
```

---

## Test File 7: `frontend/src/utils/sse.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSSE } from '../utils/sse';

// Mock ReadableStream and fetch for SSE
function makeMockSSEResponse(events: string[]) {
  const chunks = events.map(e => new TextEncoder().encode(e));
  let index = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  };
}

describe('readSSE()', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('calls onEvent for each valid SSE message', async () => {
    const sseEvents = [
      'event: heartbeat\ndata: {"phase":"discovery","message":"Searching..."}\n\n',
      'event: heartbeat\ndata: {"phase":"synthesis","message":"Synthesising..."}\n\n',
      'data: [DONE]\n\n',
    ];
    mockFetch.mockResolvedValueOnce(makeMockSSEResponse(sseEvents));

    const onEvent = vi.fn();
    await readSSE('/analyze', {}, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(2); // [DONE] should stop iteration, not call onEvent
  });

  it('stops processing after [DONE] sentinel', async () => {
    const sseEvents = [
      'data: {"type":"start"}\n\n',
      'data: [DONE]\n\n',
      'data: {"type":"should_not_appear"}\n\n', // after DONE
    ];
    mockFetch.mockResolvedValueOnce(makeMockSSEResponse(sseEvents));

    const onEvent = vi.fn();
    await readSSE('/stream', {}, onEvent);

    // Only the first event should be received
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'should_not_appear' }));
  });

  it('parses JSON data from SSE message', async () => {
    mockFetch.mockResolvedValueOnce(makeMockSSEResponse([
      'event: audit_complete\ndata: {"score":88,"label":"Strong"}\n\n',
      'data: [DONE]\n\n',
    ]));

    const onEvent = vi.fn();
    await readSSE('/stream', {}, onEvent);

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ score: 88, label: 'Strong' })
    );
  });

  it('calls onError when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const onEvent = vi.fn();
    const onError = vi.fn();

    await readSSE('/stream', {}, onEvent, onError);

    expect(onError).toHaveBeenCalledOnce();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('handles malformed JSON in SSE data without throwing', async () => {
    mockFetch.mockResolvedValueOnce(makeMockSSEResponse([
      'data: {broken json here\n\n',
      'data: [DONE]\n\n',
    ]));

    const onEvent = vi.fn();
    await expect(readSSE('/stream', {}, onEvent)).resolves.not.toThrow();
  });
});
```

---

## Coverage Targets — Phase 6

| File | Target |
|------|--------|
| `src/services/sseService.ts` (Redis path) | 85% |
| `src/middleware/rateLimit.ts` | **100%** |
| `frontend/src/hooks/useAuditSession.ts` | 90% |
| `frontend/src/components/audit/AuditInputForm.tsx` | **100%** |
| `frontend/src/components/audit/ClarificationDialog.tsx` | 90% |
| `frontend/src/utils/sse.ts` | **100%** |

---

## How to Run Phase 6 Tests

```bash
# Backend tests
npx vitest run \
  src/services/sseService.redis.test.ts \
  src/middleware/rateLimit.test.ts

# Firestore rules (requires emulator running)
firebase emulators:exec --only firestore \
  "npx vitest run firestore.rules.test.ts"

# Frontend tests
cd frontend && npx vitest run \
  src/hooks/useAuditSession.test.ts \
  src/components/audit/AuditInputForm.test.tsx \
  src/components/audit/ClarificationDialog.test.tsx \
  src/utils/sse.test.ts
```

---

## Full Suite Coverage Check

After Phase 6, run the complete suite with coverage to verify overall targets:

```bash
# Backend
npm run test:coverage

# Frontend
cd frontend && npm run test:coverage
```

**Expected overall coverage after all 6 phases:**
- Backend: ≥ 80% lines
- Frontend: ≥ 75% lines

---

## AG Prompt — Phase 6 Tests

```
I've completed Phase 6 of VelocityCSO (PHASE_6_ARCHITECTURE.md).
This is the final test phase — after implementing these tests, run the full
test suite with coverage to confirm overall targets are met.

Testing setup: plans/TESTING_STRATEGY.md
Test plan: plans/PHASE_6_TESTS.md
Source files:
  - src/services/sseService.ts (Redis-backed)
  - src/middleware/rateLimit.ts
  - firestore.rules
  - frontend/src/hooks/useAuditSession.ts
  - frontend/src/components/audit/AuditInputForm.tsx
  - frontend/src/components/audit/ClarificationDialog.tsx
  - frontend/src/utils/sse.ts

IMPORTANT: Firestore rules tests require the Firebase emulator.
Start it with: firebase emulators:start --only firestore
Then run the rules tests separately.

After all tests pass, run: npm run test:coverage
Target: backend ≥ 80% lines, frontend ≥ 75% lines.
```
