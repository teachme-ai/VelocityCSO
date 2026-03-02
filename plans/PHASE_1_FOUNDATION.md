# Phase 1: Fix the Foundation

> **Goal:** Eliminate credibility risks, security holes, dead code, and circular dependencies before any new features are built.  
> **Prerequisite for all other phases.**

---

## Task 1.1 — Give the Discovery Agent Real Web Search

### What to change
**File:** `src/agents/discovery.ts`

The `DiscoveryAgent` currently has no tools registered. It asks the LLM to recall "publicly known signals from the last 24 months" — this is hallucination. Enable Google Search Grounding so it retrieves live web results.

### Step-by-step

**Step 1:** Add `googleSearch` tool to the LlmAgent definition.

```typescript
// src/agents/discovery.ts
// Change the LlmAgent instantiation inside DiscoveryAgent.discover():

const discoveryLlm = new LlmAgent({
  name: 'discovery_agent',
  model: 'gemini-2.0-flash',
  instruction: buildDiscoveryInstruction(),
  tools: [{ googleSearch: {} }],  // ← ADD THIS
});
```

**Step 2:** Update the discovery instruction to explicitly use search results.

```typescript
function buildDiscoveryInstruction(): string {
  return `
You are a market intelligence analyst. Use Google Search to find REAL, CURRENT information.

SEARCH STRATEGY:
1. Search for "[company/product name] news 2025 2026"
2. Search for "[industry] market size 2025 funding"
3. Search for "[top competitor names] recent announcements"
4. Search for "[industry] regulatory changes 2025"

For each search, cite the source URL and publication date.

OUTPUT FORMAT (strict JSON):
{
  "findings": [
    {
      "signal": "string — what was found",
      "source": "URL or publication name",
      "date": "YYYY-MM or 'unknown'",
      "relevance": "high | medium | low"
    }
  ],
  "gaps": ["string — what could not be found via search"],
  "isComplete": boolean,
  "summary": "2-3 sentence synthesis of the most important findings",
  "pestle": {
    "political": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "economic": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "social": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "technological": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "legal": { "signal": "string", "impact": 0-10, "likelihood": 0-10 },
    "environmental": { "signal": "string", "impact": 0-10, "likelihood": 0-10 }
  }
}
`;
}
```

**Step 3:** Update `DiscoveryResult` interface to include `pestle` and `findings` with sources.

```typescript
// src/agents/discovery.ts
export interface DiscoveryResult {
  findings: Array<{
    signal: string;
    source: string;
    date: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
  gaps: string[];
  isComplete: boolean;
  summary: string;
  pestle?: {
    political: PestleItem;
    economic: PestleItem;
    social: PestleItem;
    technological: PestleItem;
    legal: PestleItem;
    environmental: PestleItem;
  };
}

interface PestleItem {
  signal: string;
  impact: number;   // 0-10
  likelihood: number; // 0-10
}
```

**Step 4:** Remove the dishonest "24-month scan" framing from all user-facing messages in `src/index.ts`. Search for `"24-month"` and `"discovery"` in the heartbeat messages and update them to be accurate.

### Acceptance criteria
- [ ] Discovery agent uses `googleSearch` tool
- [ ] Findings include `source` URLs
- [ ] PESTLE block is present in `DiscoveryResult`
- [ ] No hallucinated "24-month scan" language in heartbeats

---

## Task 1.2 — Wire the Critic Agent

### What to change
**Files:** `src/coordinator.ts`, `src/critic.ts`

The `strategicCritic` agent is defined but never called. The coordinator must invoke it after all 5 specialists complete and before CSO synthesis.

### Step-by-step

**Step 1:** Strengthen the critic prompt in `src/critic.ts`.

```typescript
// src/critic.ts — replace the entire instruction string

export const strategicCritic = new LlmAgent({
  name: 'strategic_critic',
  model: 'gemini-2.5-pro',
  instruction: `
You are the Strategic Critic. Your job is to find errors, contradictions, and
unsubstantiated claims in specialist analysis BEFORE the CSO synthesizes them.

REVIEW EACH SPECIALIST OUTPUT FOR:
1. CONTRADICTIONS — e.g., market_analyst says "TAM is $50B" but innovation_analyst
   says "niche market, limited addressable customers"
2. UNSUBSTANTIATED HIGH SCORES — any score above 75 with no concrete evidence
3. UNSUBSTANTIATED LOW SCORES — any score below 35 with no reasoning
4. CONFIDENCE MISMATCHES — confidence_score below 0.5 but dimension score above 60
5. GENERIC ADVICE — recommendations that could apply to any business

OUTPUT FORMAT (strict JSON):
{
  "flags": [
    {
      "specialist": "market_analyst | innovation_analyst | commercial_analyst | operations_analyst | finance_analyst",
      "dimension": "dimension_name",
      "issue": "CONTRADICTION | UNSUBSTANTIATED_HIGH | UNSUBSTANTIATED_LOW | CONFIDENCE_MISMATCH | GENERIC",
      "description": "specific explanation of the problem",
      "suggested_recheck": "what the specialist should look for when re-evaluating"
    }
  ],
  "overall_coherence_score": 0-100,
  "approved_specialists": ["list of specialist names with no flags"],
  "requires_rerun": ["list of specialist names that must rerun"]
}

If no issues found, return: { "flags": [], "overall_coherence_score": 95, "approved_specialists": [...all 5...], "requires_rerun": [] }
`
});
```

**Step 2:** Add a `runCritic()` method to `ChiefStrategyAgent` in `src/coordinator.ts`.

```typescript
// src/coordinator.ts — add this method to ChiefStrategyAgent

private async runCritic(
  specialistOutputs: Record<string, SpecialistResult>,
  sessionId: string
): Promise<CriticResult> {
  emitHeartbeat(sessionId, 'Critic: Auditing specialist outputs for contradictions...', 'standard');

  const criticInput = JSON.stringify(specialistOutputs, null, 2);
  const runner = new InMemoryRunner({ agent: strategicCritic, appName: 'critic' });
  const session = await runner.sessionService.createSession({ appName: 'critic', userId: sessionId });

  let raw = '';
  for await (const event of runner.runAsync({
    userId: sessionId,
    sessionId: session.id,
    newMessage: { role: 'user', parts: [{ text: `Review these specialist outputs:\n${criticInput}` }] }
  })) {
    if (isFinalResponse(event)) raw += event.content?.parts?.[0]?.text ?? '';
  }

  return this.robustParse<CriticResult>('strategic_critic', raw, {
    flags: [],
    overall_coherence_score: 80,
    approved_specialists: Object.keys(specialistOutputs),
    requires_rerun: []
  });
}
```

**Step 3:** Add `CriticResult` interface.

```typescript
// src/coordinator.ts — add interface

interface CriticResult {
  flags: Array<{
    specialist: string;
    dimension: string;
    issue: string;
    description: string;
    suggested_recheck: string;
  }>;
  overall_coherence_score: number;
  approved_specialists: string[];
  requires_rerun: string[];
}
```

**Step 4:** In `analyze()`, call the critic after all specialists complete, and re-run flagged specialists once.

```typescript
// src/coordinator.ts — inside analyze(), after Promise.all(specialistPromises):

// 1. Run critic
const criticResult = await this.runCritic(specialistOutputs, sessionId);
emitHeartbeat(sessionId, `Critic: Coherence score ${criticResult.overall_coherence_score}/100`, 'standard');

// 2. Re-run flagged specialists (max 1 retry per specialist)
if (criticResult.requires_rerun.length > 0) {
  emitHeartbeat(sessionId, `Critic flagged ${criticResult.requires_rerun.length} specialists for recheck`, 'warning');

  const rerunPromises = criticResult.requires_rerun.map(async (specialistName) => {
    const specialist = specialists.find(s => s.name === specialistName);
    if (!specialist) return;

    // Inject critic feedback into context
    const criticFeedback = criticResult.flags
      .filter(f => f.specialist === specialistName)
      .map(f => `RECHECK ${f.dimension}: ${f.suggested_recheck}`)
      .join('\n');

    const enrichedContext = `${businessContext}\n\nCRITIC FEEDBACK (address these issues):\n${criticFeedback}`;
    const result = await this.runSpecialist(specialist, enrichedContext, sessionId);
    specialistOutputs[specialistName] = result;
  });

  await Promise.all(rerunPromises);
  emitHeartbeat(sessionId, 'Critic: Re-evaluation complete', 'standard');
}
```

### Acceptance criteria
- [ ] `strategicCritic` is called after all specialists complete
- [ ] Flagged specialists are re-run with critic feedback
- [ ] Heartbeat accurately reflects critic execution (not a static message)
- [ ] `overall_coherence_score` is included in the final report data

---

## Task 1.3 — Add Scoring Rubrics to All 15 Dimensions

### What to change
**File:** `src/specialists.ts`

Add a `SCORING_RUBRICS` constant and inject it into every specialist's instruction prompt.

### Step-by-step

**Step 1:** Create the rubrics constant at the top of `specialists.ts`.

```typescript
// src/specialists.ts — add before specialist definitions

const SCORING_RUBRICS = `
SCORING RUBRICS — apply these to every dimension you score:

TAM_VIABILITY:
  90-100: TAM >$50B with >15% CAGR, validated by multiple analyst reports
  70-89:  TAM $10-50B with 5-15% CAGR, partial validation
  50-69:  TAM $1-10B or poorly defined, moderate growth signals
  30-49:  TAM <$1B or unclear, weak/declining growth
  0-29:   No credible TAM definition, no market evidence

TARGET_PRECISION:
  90-100: ICP defined with firmographic + behavioural attributes, validated by paying customers
  70-89:  Clear ICP with demographic precision, some customer validation
  50-69:  Broad ICP with some specificity, limited validation
  30-49:  Vague ICP ("SMBs" or "enterprises" with no further definition)
  0-29:   No defined target customer

COMPETITIVE_DEFENSIBILITY:
  90-100: Multiple overlapping moats (IP + network effects + switching costs + data)
  70-89:  One strong moat with evidence (patented tech, proprietary dataset, locked-in customers)
  50-69:  Early-stage moat forming, advantage not yet proven durable
  30-49:  Feature-based differentiation easily replicated by competitors with resources
  0-29:   No defensibility, commodity positioning, price-only competition

PRICING_POWER:
  90-100: Veblen dynamics or IP-protected premium, customers pay premium without negotiation
  70-89:  Clear premium justified by measurable outcome differentiation
  50-69:  Some pricing power, moderate competitive price ceiling
  30-49:  Significant price pressure from competitors
  0-29:   Price taker, commodity market

CAC_LTV_RATIO:
  90-100: LTV:CAC > 5:1, payback < 6 months
  70-89:  LTV:CAC 3-5:1, payback 6-12 months
  50-69:  LTV:CAC 1.5-3:1, payback 12-18 months
  30-49:  LTV:CAC 0.8-1.5:1, payback > 18 months
  0-29:   LTV:CAC < 0.8:1 (acquiring customers at a loss with no path to profitability)

SCALABILITY:
  90-100: Near-zero marginal cost, fully automated delivery, proven at 100x current scale
  70-89:  Low marginal cost with automation, some manual steps that can be automated
  50-69:  Moderate marginal cost, partially manual, scalability path is clear but unproven
  30-49:  High marginal cost, significant manual work, scaling requires proportional headcount
  0-29:   Services-based or 1:1 model with no path to scale without massive cost increase

ROI_PROJECTION:
  90-100: Clear path to >50% gross margin within 18 months, supported by unit economics
  70-89:  Path to 30-50% gross margin, healthy trajectory
  50-69:  Path to 15-30% gross margin, some uncertainty
  30-49:  Path to profitability unclear or >36 months away
  0-29:   No credible path to profitability

[Apply equivalent logic to all other dimensions: TREND_ADOPTION, MODEL_INNOVATION,
FLYWHEEL_POTENTIAL, MARKET_ENTRY_SPEED, EXECUTION_SPEED, ESG_POSTURE,
RISK_TOLERANCE, CAPITAL_EFFICIENCY]
`;
```

**Step 2:** Inject `SCORING_RUBRICS` into every specialist instruction string.

```typescript
// src/specialists.ts — in each specialist's instruction, add:
// "${SCORING_RUBRICS}" before the JSON output format section
// Example for marketAnalyst:

export const marketAnalyst = new LlmAgent({
  name: 'market_analyst',
  model: 'gemini-2.5-flash',
  instruction: `
You are the Market Intelligence Specialist...

${SCORING_RUBRICS}

${jsonInstruction}
${asymmetricPlayRule}
`
});
```

### Acceptance criteria
- [ ] All 15 dimensions have explicit 5-band rubrics (0-29, 30-49, 50-69, 70-89, 90-100)
- [ ] Rubrics are injected into all 5 specialist prompts
- [ ] Rubrics reference concrete, measurable evidence (not subjective)

---

## Task 1.4 — Add Authentication

### What to change
**New files:** `src/middleware/auth.ts`  
**Modified files:** `src/index.ts`

### Step-by-step

**Step 1:** Install Firebase Auth types (already have `firebase-admin`).

```bash
# No new packages needed — firebase-admin includes auth
```

**Step 2:** Create `src/middleware/auth.ts`.

```typescript
// src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  orgId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.userId = decoded.uid;
    req.userEmail = decoded.email;
    // orgId stored as custom claim — set this when creating users
    req.orgId = (decoded as any).orgId ?? decoded.uid;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function generateShareToken(): string {
  // 32-char cryptographically random token (not last-8-chars of doc ID)
  return require('crypto').randomBytes(16).toString('hex');
}
```

**Step 3:** Apply auth middleware to protected routes in `src/index.ts`.

```typescript
// src/index.ts — add to protected routes

import { requireAuth, AuthenticatedRequest } from './middleware/auth.js';

// Public routes (no auth):
app.get('/sse/:sessionId', ...);       // SSE stream

// Protected routes:
app.post('/analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const orgId = req.orgId!;
  // ... rest of handler, pass userId/orgId to Firestore writes
});

app.post('/analyze/clarify', requireAuth, ...);
app.post('/analyze/stress-test', requireAuth, ...);
app.get('/report/:id', requireAuth, ...);
app.get('/report/:id/download', requireAuth, ...);
```

**Step 4:** Fix the report access token. Replace `id.slice(-8)` with `generateShareToken()`.

```typescript
// src/index.ts — in the report save section, replace:
// const token = id.slice(-8);
// with:
const { generateShareToken } = await import('./middleware/auth.js');
const shareToken = generateShareToken();

// Store token in Firestore document
await admin.firestore().collection('enterprise_strategy_reports').doc(id).update({
  shareToken,
  shareTokenExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

**Step 5:** Add `userId` and `orgId` to all Firestore writes for future tenant isolation.

```typescript
// When saving reports, sessions, etc., always include:
{
  userId: req.userId,
  orgId: req.orgId,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  // ... rest of data
}
```

**Step 6:** Update the frontend `HeroSection.tsx` to include auth token in API requests.

```typescript
// frontend/src/components/HeroSection.tsx

// Add a getAuthToken() helper that retrieves the Firebase Auth token:
async function getAuthHeaders(): Promise<HeadersInit> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Use in fetch calls:
const headers = await getAuthHeaders();
const response = await fetch(API_URL, {
  method: 'POST',
  headers,
  body: JSON.stringify({ business_context: context, stress_test: stressTest })
});
```

**Step 7:** Add Firebase Auth frontend SDK.

```bash
# In frontend/:
npm install firebase
```

Create `frontend/src/firebase.ts`:

```typescript
// frontend/src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  // Copy from Firebase console > Project Settings > Your apps
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}
```

### Acceptance criteria
- [ ] All `/analyze` endpoints require valid Firebase Auth token
- [ ] Report share tokens are 32-char random hex strings
- [ ] `userId` and `orgId` are stored on every Firestore document
- [ ] Frontend sends `Authorization: Bearer <token>` header
- [ ] Anonymous users get 401 response

---

## Task 1.5 — Break the Circular Dependency

### What to change
**New file:** `src/services/sseService.ts`  
**Modified files:** `src/index.ts`, `src/coordinator.ts`, `src/agents/interrogator.ts`

### Step-by-step

**Step 1:** Create `src/services/sseService.ts` — extract SSE logic out of `index.ts`.

```typescript
// src/services/sseService.ts

import { Response } from 'express';

export type HeartbeatType = 'standard' | 'warning' | 'debug' | 'error';

const activeConnections = new Map<string, Response>();

export function registerConnection(sessionId: string, res: Response): void {
  activeConnections.set(sessionId, res);
}

export function removeConnection(sessionId: string): void {
  activeConnections.delete(sessionId);
}

export function emitHeartbeat(
  sessionId: string,
  message: string,
  type: HeartbeatType = 'standard'
): void {
  const res = activeConnections.get(sessionId);
  if (!res) return;

  const data = {
    type: 'HEARTBEAT',
    timestamp: new Date().toISOString(),
    message,
    logType: type,
  };

  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    activeConnections.delete(sessionId);
  }
}

export function emitEvent(sessionId: string, payload: object): void {
  const res = activeConnections.get(sessionId);
  if (!res) return;
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    activeConnections.delete(sessionId);
  }
}
```

**Step 2:** Update `src/index.ts` — remove the local `emitHeartbeat` definition and `activeConnections` map, import from `sseService`.

```typescript
// src/index.ts — replace local definitions with:
import {
  registerConnection,
  removeConnection,
  emitHeartbeat,
  emitEvent
} from './services/sseService.js';
```

**Step 3:** Update `src/coordinator.ts` — change the import.

```typescript
// src/coordinator.ts — change:
// import { emitHeartbeat } from '../index.js';
// to:
import { emitHeartbeat } from './services/sseService.js';
```

**Step 4:** Update `src/agents/interrogator.ts` — change the import.

```typescript
// src/agents/interrogator.ts — change:
// import { emitHeartbeat } from '../index.js';
// to:
import { emitHeartbeat } from '../services/sseService.js';
```

### Acceptance criteria
- [ ] `src/services/sseService.ts` exists and exports `emitHeartbeat`, `registerConnection`, `removeConnection`, `emitEvent`
- [ ] `src/index.ts` has no local `emitHeartbeat` definition
- [ ] `src/coordinator.ts` imports from `sseService`, not `index`
- [ ] `src/agents/interrogator.ts` imports from `sseService`, not `index`
- [ ] `tsc` compiles with zero circular dependency warnings

---

## Task 1.6 — Remove Dead Code

### Files to delete
```bash
rm frontend/src/App.css
rm frontend/src/components/ReportPage.tsx
rm frontend/src/components/HeartbeatTerminal.tsx
rm frontend/src/components/AgentStatus.tsx
```

### Code to delete from existing files

**`src/index.ts`** — delete `extractDimensions()` function (never called).

**`src/services/sessionService.ts`** — delete `getPreviousAuditAge()` function (never called).

**`frontend/src/components/HeroSection.tsx`** — remove commented-out imports:
```typescript
// Delete these commented lines:
// import { Canvas } from '@react-three/fiber'
// import { Stars } from '@react-three/drei'
```

**`frontend/src/components/StressTestPanel.tsx`** — remove the local `StressResult` interface definition. Use the canonical one from `../types/stress.ts` instead.

**`frontend/src/types/stress.ts`** — move `StatusEvent` type here from `AgentStatus.tsx` before deleting that file:
```typescript
// frontend/src/types/stress.ts — add:
export type StatusEvent = {
  type: string;
  phase?: string;
  summary?: string;
  gap?: string;
  cost_usd?: number;
  [key: string]: unknown;
};
```

**`frontend/src/components/HeroSection.tsx`** — update `StatusEvent` import to come from `../types/stress`.

### Acceptance criteria
- [ ] 4 dead frontend files deleted
- [ ] `extractDimensions()` deleted from `index.ts`
- [ ] `getPreviousAuditAge()` deleted from `sessionService.ts`
- [ ] `StressResult` defined in one place only (`types/stress.ts`)
- [ ] `StatusEvent` defined in one place only (`types/stress.ts`)
- [ ] `tsc -b` in `frontend/` passes with zero errors

---

## Phase 1 Completion Checklist

- [ ] Task 1.1: Discovery Agent uses Google Search Grounding
- [ ] Task 1.2: Critic Agent is wired into `analyze()` flow
- [ ] Task 1.3: All 15 dimensions have scoring rubrics in prompts
- [ ] Task 1.4: Firebase Auth protects all API endpoints
- [ ] Task 1.5: `sseService.ts` breaks circular dependency
- [ ] Task 1.6: All dead code removed, types consolidated
- [ ] `npm run build` passes (backend)
- [ ] `npm run build` passes (frontend)
- [ ] No `tsc` type errors in any file
