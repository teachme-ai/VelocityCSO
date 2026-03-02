# VelocityCSO: Complete Strategic Improvement Roadmap

> Research compiled: March 2026  
> Based on: competitive landscape analysis, strategy framework research, and deep codebase audit

---

## Market Opportunity

You sit in a **massive white space**:

| Tier | Who | Cost | Problem |
|------|-----|------|---------|
| McKinsey/BCG/Bain AI | Inaccessible — locked inside engagements | $500K–$5M | Can't buy it |
| AlphaSense / Palantir | Enterprise platforms | $50K–$500K/yr | Too expensive, 6-month setup |
| Crayon / Klue | Competitive intel only | $12K–$47K/yr | Narrow scope |
| SWOT generators | Venngage, MyMap.AI | Free | Shallow, generic |
| **VelocityCSO** | **Comprehensive AI strategy audit** | **$100–$1K/mo** | **← This gap** |

The competitor analysis market alone is projected at **$6.4B by 2025 (21.8% CAGR)**. No one owns the "McKinsey-in-a-box for SMBs and mid-market" position.

---

## Phase 1: Fix the Foundation (Critical — Do First)

These are credibility and reliability problems. Until fixed, everything else is built on sand.

### 1.1 Give the Discovery Agent Real Web Search

The Discovery Agent **fabricates** a "24-month market scan" from stale training data. It has no internet access. This is a credibility risk — if a user fact-checks one of its "findings" and it's wrong, trust collapses.

**Fix:** Enable Google Search Grounding on the Discovery Agent. Gemini 2.0+ supports `google_search_retrieval` as a native tool in the ADK. One config change.

```typescript
// In discovery.ts — add to LlmAgent config:
tools: [{ googleSearch: {} }]
```

### 1.2 Wire the Critic Agent

The `strategicCritic` is declared, prompted, registered as a sub-agent — and **never executed**. The heartbeat says "Critic: Verifying cross-functional alignment..." which is a lie.

**Fix:** After specialists run in parallel, pass all 5 outputs to the critic, get its contradiction flags, and re-run flagged specialists. This is the core quality assurance loop.

### 1.3 Add Scoring Rubrics to All Specialists

Without calibration anchors, "Pricing Power: 80" is arbitrary. The model has no reference for what a 70 vs a 30 means.

**Fix:** Add explicit rubrics to every dimension in `specialists.ts`. Example:

```
Pricing Power scoring:
90–100: Veblen pricing dynamics, luxury or IP-protected premium
70–89:  Clear premium justified by outcome differentiation, low price sensitivity
50–69:  Some pricing power, moderate competition on price
30–49:  Significant price pressure, competitors set ceiling
0–29:   Price taker, commodity market, no pricing differentiation
```

### 1.4 Add Authentication

Zero auth means any anonymous user can spam Gemini API calls at your cost. Report tokens are the last 8 characters of a Firestore document ID — trivially guessable.

**Fix:** Firebase Auth (Google SSO + email/password). Middleware on all `/analyze` routes. Proper share tokens with expiry.

### 1.5 Break the Circular Dependency

`index.ts` ↔ `coordinator.ts` ↔ `interrogator.ts` all import `emitHeartbeat` from `index.ts`. This is fragile and untestable.

**Fix:** Extract `emitHeartbeat` to `src/services/sseService.ts`. Clean imports everywhere.

### 1.6 Remove Dead Code

| Dead Code | Location | Action |
|-----------|----------|--------|
| `extractDimensions()` | `src/index.ts` | Delete — never called |
| `getPreviousAuditAge()` | `src/services/sessionService.ts` | Delete — never called |
| `App.css` | `frontend/src/App.css` | Delete — not imported |
| `ReportPage.tsx` | `frontend/src/components/ReportPage.tsx` | Delete — not rendered |
| `HeartbeatTerminal.tsx` | `frontend/src/components/HeartbeatTerminal.tsx` | Delete or merge into `AgentHeartbeat` |
| `AgentStatus.tsx` | `frontend/src/components/AgentStatus.tsx` | Delete component, keep `StatusEvent` type |

---

## Phase 2: Intelligence Upgrades (High Impact)

### 2.1 Expand from 15 to 20 Dimensions

Add these 5 missing dimensions with dedicated scoring:

| New Dimension | Why It Matters | Which Specialist |
|--------------|----------------|-----------------|
| **Team / Founder Strength** | #1 thing investors evaluate; domain expertise, track record | `marketAnalyst` |
| **Network Effects Strength** | Strongest defensibility class — distinct from Flywheel | `innovationAnalyst` |
| **Regulatory / Compliance Readiness** | Critical for fintech, healthtech, edtech | `operationsAnalyst` |
| **Customer Concentration Risk** | 3 clients = 80% revenue is a fatal risk profile | `financeAnalyst` |
| **Data Asset Quality** | Increasingly the most defensible competitive moat | `innovationAnalyst` |

### 2.2 Staged Specialist Pipeline

**Current flow:** All 5 specialists run blindly in parallel from the same raw text. No specialist knows what another found.

**Proposed flow:**

```
Phase 1: marketAnalyst + innovationAnalyst
         → Produces competitive landscape + network effects analysis

Phase 2: commercialAnalyst + operationsAnalyst
         → Consumes Phase 1 findings before scoring

Phase 3: financeAnalyst
         → Consumes Phase 1 + 2 findings before scoring

Phase 4: Critic Agent
         → Reviews all 5 outputs, flags contradictions and low-confidence scores

Phase 5: Re-run flagged specialists with critic feedback injected

Phase 6: CSO synthesizes from verified specialist outputs
```

This produces dramatically higher quality because later specialists build on earlier findings rather than all working from the same raw context.

### 2.3 Add Chain-of-Thought Scaffolding to Specialist Prompts

Replace vague "analyze focusing on..." instructions with step-by-step reasoning templates:

```
STEP 1: Extract every quantitative signal from the context
        (revenue, growth %, headcount, funding, customer count)

STEP 2: Identify what is MISSING that would change your score by >10 points

STEP 3: Write a 2-sentence justification for each dimension BEFORE
        assigning the number

STEP 4: For any score below 50, name the SINGLE highest-impact action
        to improve it

STEP 5: Challenge your own assumption — what single fact, if wrong,
        would collapse your entire analysis?
```

### 2.4 Fix the `idBreakdown` in the Interrogator

Currently `specificity`, `completeness`, and `moat` in `InterrogatorResult` are all set to the same value as `idScore`. The breakdown provides zero granularity.

**Fix:** Score each sub-dimension independently using the existing keyword regex sets (`LOCATION_KEYWORDS`, `COMPETITOR_KEYWORDS`, `MOAT_KEYWORDS`).

---

## Phase 3: New Strategic Frameworks (Transformative Features)

These are the features that move VelocityCSO from "GPT wrapper" to "strategic intelligence platform." Listed in priority order.

---

### Framework 1: Blue Ocean / ERRC Grid ⭐ Highest Priority

**What it reveals that generic AI misses:**  
Every business wants to know *what to do differently*. The ERRC grid is the most directly actionable strategic output possible — it tells you what to stop doing (freeing resources) and what to start doing (creating new demand). Generic AI says "differentiate"; Blue Ocean shows exactly *which* features to eliminate and *which* to create.

**How to implement:**  
New `blueOceanAnalyst` specialist. The prompt should:
1. Identify the 6–8 standard factors of competition in the industry
2. Score the business and 2 named competitors on each factor (0–10)
3. Apply the ERRC lens to classify each factor
4. Output the 4-quadrant ERRC grid + value curve as structured JSON

**Output format:**
- A 4-quadrant table (Eliminate / Reduce / Raise / Create) with 2–4 bullets per quadrant
- A value curve line chart: business vs. 2 competitors across 6–8 competitive factors

**Architecture:** New `blueOceanAnalyst` in `specialists.ts`. Output maps to `DimensionGallery.tsx` card format.  
**Effort:** 2–3 days (mostly prompt engineering, minimal UI changes)

---

### Framework 2: Unit Economics Deep Dive ⭐⭐ Second Priority

**What it reveals that generic AI misses:**  
The current `financeAnalyst` scores "CAC/LTV Ratio" as a single number but never decomposes it, shows sensitivities, or provides benchmarks. Unit economics are the *language of capital allocation* — every growth-stage business shares the output with investors and board members who evaluate through this lens first.

**Metrics to decompose:**
- LTV = (ARPU × Gross Margin %) / Churn Rate
- LTV:CAC ratio with benchmark (>3:1 = healthy, <1:1 = fatal)
- CAC Payback Period (months)
- Gross Margin benchmark vs. industry
- Rule of 40 (Growth Rate + Profit Margin ≥ 40%) — stage-adjusted
- Magic Number (net new ARR / prior quarter S&M spend — SaaS efficiency)
- Burn Multiple (net burn / net new ARR — capital efficiency)

**Output format:**
- A "Unit Economics RAG Dashboard" — each metric with calculated value, healthy benchmark, Red/Amber/Green status
- A sensitivity table: how LTV:CAC changes with ±20% variation in ARPU, churn, and CAC

**Architecture:** Extend `financeAnalyst`. New card in `DiagnosticScorecard.tsx`.  
**Effort:** 2–3 days

---

### Framework 3: Porter's Five Forces (Quantified) ⭐⭐ Third Priority

**What it reveals that generic AI misses:**  
The `innovationAnalyst` already mentions Porter's Five Forces in prose, but produces narrative rather than structured scores. The critical insight is the **interaction effect**: high Buyer Power + high Threat of Substitutes = structural collapse — a nonlinear insight prose analysis misses entirely.

**How to implement:**  
Extend `innovationAnalyst` to score all five forces on a 0–100 intensity scale:
- Competitive Rivalry
- Threat of New Entrants
- Threat of Substitutes
- Buyer Power
- Supplier Power

Compute a "Structural Attractiveness Score" as the inverse-weighted mean. Add interaction effect logic: when 2+ forces exceed 70, flag structural vulnerability.

**Output format:**
- A 5-axis radar chart (overlays naturally on existing `StrategyRadar.tsx`)
- A 3-column table: Force | Intensity Score | Primary Driver

**Architecture:** Extend `innovationAnalyst`. Radar chart slots into `StrategyRadar.tsx`.  
**Effort:** 1–2 days

---

### Framework 4: Monte Carlo Probabilistic Stress Testing ⭐⭐ Fourth Priority

**What it reveals that generic AI misses:**  
The existing stress test says "your CAC/LTV drops from 72 to 38 in a recession" — deterministic and binary. Monte Carlo says "there is a 35% probability your LTV:CAC falls below 2:1 in the next 18 months based on variance in your CAC and churn assumptions." The latter is what boards and investors actually want.

**How to implement:**  
For each key metric (CAC, LTV, Churn, Growth Rate, Gross Margin), LLMs generate plausible parameter distributions using triangular distribution logic:
1. Estimate Low / Base / High values from business description
2. Apply triangular distribution formula to compute P10/P50/P90
3. Compose compound outcome distributions for Revenue and Profitability
4. Identify which input variance contributes most to outcome variance

**Output format:**
- Distribution charts (bell curve/histogram) for ARR at 12, 24, 36 months
- P10 / P50 / P90 outputs for 3–5 key metrics
- "Key Risk Drivers" table ranking which assumptions drive the most variance

**Architecture:** Builds on existing `StressTestPanel.tsx` and `triggerStressTest()`. Extends rather than replaces.  
**Effort:** 3–4 days

---

### Framework 5: Wardley Mapping ⭐ Highest Differentiation

**What it reveals that generic AI misses:**  
Wardley Maps are the only framework that answers "what should we build vs. buy vs. partner?" They map every capability on the Genesis → Custom → Product → Commodity evolution axis, and predict which current competitive advantages will be commoditized. No other framework in the current suite — or in any competing product — addresses this.

**How to implement:**  
Extend `operationsAnalyst` with a two-pass approach:
1. Extract the capability list from the business description
2. Score each capability on the Genesis–Custom–Product–Commodity axis
3. Map dependency relationships between capabilities
4. Add movement arrows: where each capability will be in 18 months
5. Flag capabilities that are about to be commoditized (danger zones)

**Output format:**
- A 2-axis scatter plot (X: Evolution stage 0–100, Y: Value chain position from user-facing to infrastructure)
- Each node = a named capability, with movement arrows
- A "Build vs. Buy vs. Partner" recommendation table per capability

**Architecture:** Requires a new SVG/D3 chart component — does not fit existing `StrategyRadar.tsx`. New `WardleyMap.tsx` component needed.  
**Effort:** 5–7 days (including new chart component)

---

### Additional Frameworks (Backlog)

| Framework | What It Adds | Effort | Architecture Impact |
|-----------|-------------|--------|---------------------|
| **Jobs-to-be-Done (JTBD)** | Reveals the real competitive set and underserved outcomes | 2 days | Extend `marketAnalyst` |
| **Ansoff Matrix** | Explicit growth strategy with risk-return tradeoffs per quadrant | 1 day | Extend `commercialAnalyst` |
| **Business Model Canvas** | Full 9-block system view with "Coherence Score" | 2 days | CSO synthesis step; new `BusinessModelCanvas.tsx` |
| **Dynamic Capabilities (Teece)** | Sense / Seize / Reconfigure — adaptability under disruption | 2 days | Extend `operationsAnalyst` |
| **Ecosystem Strategy Map** | Keystone vs. niche player — which behaviors create more value | 2 days | Extend `innovationAnalyst` |
| **Game Theory / Payoff Matrix** | Whether a pricing war is rational or irrational for this market | 2 days | Extend `commercialAnalyst` |
| **Cohort Retention Curves** | Reveals leaky bucket points; implied acquisition rate to maintain growth | 2 days | Extend `marketAnalyst` |
| **Scenario Planning 2x2** | 4 named futures with probability weights + no-regret moves | 3 days | New `scenarioAgent`; extend `StressTestPanel.tsx` |
| **PESTLE (Structured, Scored)** | 6-factor macro analysis scored by Impact × Likelihood | 1 day | Extend `discoveryAgent` |
| **BCG Growth-Share Matrix** | Portfolio resource allocation logic (for multi-product businesses) | 2 days | Extend `financeAnalyst` |
| **Real Options Analysis** | Values the optionality of staged strategic investments | 3 days | Extend `financeAnalyst` |
| **Digital Transformation Maturity** | Gap between current capability and what the strategy requires | 2 days | Extend `operationsAnalyst` |

---

## Phase 4: Data Enrichment (Makes Intelligence Real)

### 4.1 Multi-Modal Input

Beyond freeform text, accept:

| Input Type | What It Provides | Implementation |
|-----------|-----------------|----------------|
| **Website URL** | Product/pricing/team pages, job listings | Puppeteer or Playwright scraper |
| **PDF upload** | Pitch decks, investor memos, one-pagers | `pdf-parse` npm package |
| **XLSX upload** | Financial models, unit economics | `xlsx` npm package |
| **LinkedIn company URL** | Employee count, growth rate, recent hires | LinkedIn API or scraper |
| **Crunchbase URL** | Funding history, investors, valuation | Crunchbase API |

### 4.2 Real-Time Market Data Integration

| API / Source | What It Adds | Priority |
|-------------|-------------|----------|
| **Google Search Grounding** | Real web results (not stale training data) — replaces fabricated discovery | P0 |
| **NewsAPI.org** | Recent headlines about company and named competitors | P1 |
| **Alpha Vantage / Yahoo Finance** | Stock data, sector performance, market cap benchmarks | P1 |
| **Crunchbase API** | Private company funding rounds, competitor financials | P1 |
| **SimilarWeb / SEMrush API** | Website traffic, SEO competitive positioning | P2 |
| **OpenView SaaS Benchmarks** | Calibrated LTV:CAC, Rule of 40, NRR benchmarks by stage | P2 |
| **G2 / Capterra reviews** | Product sentiment, NPS proxy, feature gap analysis | P2 |

### 4.3 Honest Discovery Agent (Until Real Web Search Is Live)

Remove the "24-month scan" language. Frame it honestly:

> "Analysis is based on the model's training knowledge and the context you provided. Enable web search for real-time market intelligence."

Do not present fabricated market signals as grounded intelligence.

---

## Phase 5: Product Features (Retention & Enterprise Value)

### 5.1 Ongoing Monitoring — Biggest Retention Driver

The system is entirely one-shot. To create stickiness:

- **Scheduled re-audits** — Cloud Scheduler cron jobs, weekly/monthly auto-re-run for subscribed companies using latest web data
- **Dimension drift detection** — "Your Competitive Defensibility dropped 12 points since your last audit on Jan 15"
- **Competitive alerts** — "Competitor X raised $100M. Here's how this affects your Strategic Defensibility score"
- **Historical trend dashboard** — Time-series view of all dimensions across audit history (data is already in Firestore, just needs querying by fingerprint ordered by `created_at`)

### 5.2 Strategy Workspace

- **Persistent company profiles** — Uploaded docs, notes, audit history, team roster
- **90-Day Action Roadmap** — Convert report recommendations into tasks with owners, deadlines, and KPIs
- **Action item tracker** — Status tracking: Not Started / In Progress / Complete
- **Integration hooks** — Push action items to Jira/Linear, push reports to Slack/email, pull data from Salesforce/HubSpot

### 5.3 Collaboration Features

Currently absent from the entire codebase:

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Multi-user report access** | Owner / Editor / Viewer roles — not 8-char token auth | Firebase Auth + Firestore rules |
| **Dimension-level commenting** | Team annotates specific scores and recommendations | Firestore subcollection `reports/{id}/comments` |
| **@mention notifications** | Tag teammates on specific findings | Firebase Cloud Messaging |
| **Board presentation export** | Google Slides / PPTX generation | Google Slides API or `pptxgenjs` |
| **Embeddable radar widget** | Live radar chart embedded in Notion, Confluence, Slack | `<iframe>` endpoint or Web Component |
| **Version history** | Track changes across re-audits and clarifications | Firestore versioned documents |

### 5.4 Benchmark Community

Anonymous, aggregated benchmarks across all audits in the system:

> "Companies in your category (B2B SaaS, Series A, $1M–$5M ARR) average 62 on Scalability. You score 45 — bottom quartile."

This creates a game-like dynamic where users want to improve scores and return for re-audits. Benchmarks are computed from anonymized Firestore data grouped by industry + stage + size signals.

### 5.5 Enterprise-Grade Report Output

**Current PDF problems:**
- Helvetica only — no custom typography
- No charts in PDF — radar and scorecard exist only in web UI
- No table of contents
- `sanitizeText()` strips all non-ASCII — destroys international business names
- REGULATORY scenario missing from PDF (only 4 of 5 scenarios rendered)

**Fix:**
- Embed professional fonts (e.g., Inter + Space Grotesk via base64)
- Render radar chart as SVG inline in PDFKit
- Add table of contents with page numbers
- Fix `sanitizeText()` to preserve Unicode
- Add REGULATORY scenario to PDF
- Surface `data_sources[]` from specialist outputs as an appendix (attribution)

---

## Phase 6: Architecture for Scale

### 6.1 Fix SSE Scaling

Replace in-memory `activeConnections` Map with **Redis pub/sub** for SSE fan-out across multiple Cloud Run instances. Currently one scale-out event drops all live SSE connections.

```typescript
// Current (breaks at >1 instance):
const activeConnections = new Map<string, Response>();

// Fix: Redis pub/sub
// Publisher (coordinator/interrogator): redis.publish(sessionId, JSON.stringify(data))
// Subscriber (SSE endpoint): redis.subscribe(sessionId, (msg) => res.write(msg))
```

### 6.2 Cache PDF Stress Test Results

PDF generation currently triggers 4 LLM calls (one per scenario) on every download. This is expensive and slow (10–30 seconds per PDF).

**Fix:** Run all 5 stress scenarios at report generation time, store results in Firestore. PDF download becomes a pure retrieval operation.

### 6.3 Multi-Tenant Architecture

| Concern | Current State | Fix |
|---------|--------------|-----|
| **Data isolation** | Single shared Firestore, no tenant separation | Add `orgId` + `userId` to every document |
| **Security rules** | None — `index.ts` checks a guessable 8-char token | Firestore security rules enforce org-level isolation |
| **Rate limiting** | None — anonymous users can burn API credits | Per-user and per-org rate limits via middleware |
| **API access** | Web UI only | API key management for enterprise integrations |
| **Session data fragmentation** | `discovery_sessions` vs `velocity_cso_sessions` — two disconnected collections | Consolidate into one session collection |

### 6.4 Deduplication of Frontend Code

| Duplication | Files | Fix |
|------------|-------|-----|
| `readSSE()` generator | `HeroSection.tsx` + `StressTestPanel.tsx` | Extract to `src/utils/sse.ts` |
| `StressResult` type | `types/stress.ts` + `StressTestPanel.tsx` (local duplicate) | Use canonical type from `types/stress.ts` |
| Terminal log viewer | `AgentHeartbeat.tsx` + `HeartbeatTerminal.tsx` | Merge into `AgentHeartbeat.tsx` |

### 6.5 Decompose the God Component

`HeroSection.tsx` is 720 lines with 14 state variables handling input, SSE, phase management, clarification, and the full report dashboard.

**Target decomposition:**
```
useAuditSession()           ← custom hook: SSE streaming, phase state, API calls
AuditInputForm.tsx          ← idle phase: textarea, stress toggle, submit
ClarificationDialog.tsx     ← clarifying phase: lens progress, gap question, input
ProcessingView.tsx          ← discovery/evaluating/analyzing: AgentOrbs + AgentHeartbeat
ReportDashboard.tsx         ← done phase: Zone 1 + Zone 2 + Zone 3
HeroSection.tsx             ← orchestrator: renders the right component per phase
```

### 6.6 Add a Test Suite

```json
// Current package.json:
"test": "echo \"Error: no test specified\" && exit 1"
```

Minimum viable test coverage:
- Unit tests for `coordinator.ts` `robustParse()` — the most failure-prone logic
- Integration tests for all 5 API endpoints with mock Gemini responses
- Frontend component tests for `DiagnosticScorecard`, `StrategyRadar`, `StressTestPanel`

---

## Feature Prioritization Matrix

| Priority | Feature | Impact | Effort | Category |
|----------|---------|--------|--------|----------|
| **P0** | Real web search in Discovery Agent | Critical | Low | Foundation |
| **P0** | Wire the Critic Agent into execution | Critical | Low | Foundation |
| **P0** | Add scoring rubrics to all 15 dimensions | High | Low | Foundation |
| **P0** | Authentication + proper access control | Critical | Medium | Foundation |
| **P0** | Remove dead code (6 instances) | Medium | Low | Foundation |
| **P1** | Blue Ocean / ERRC Grid | Very High | Low | Frameworks |
| **P1** | Unit Economics Dashboard (LTV:CAC, Rule of 40, Burn Multiple) | Very High | Low | Frameworks |
| **P1** | Porter's Five Forces (quantified, scored) | High | Low | Frameworks |
| **P1** | Staged specialist pipeline | High | Medium | Intelligence |
| **P1** | Expand from 15 to 20 dimensions | High | Medium | Intelligence |
| **P1** | Fix PDF (charts, fonts, Unicode, ToC) | High | Medium | Output |
| **P2** | Monte Carlo probabilistic stress testing | High | Medium | Frameworks |
| **P2** | Historical audit tracking + dimension drift alerts | Very High | Medium | Retention |
| **P2** | URL / file upload input enrichment | High | Medium | Data |
| **P2** | Wardley Mapping | High | High | Frameworks |
| **P2** | Redis SSE for horizontal scaling | High | Medium | Architecture |
| **P2** | Jobs-to-be-Done analysis | High | Low | Frameworks |
| **P2** | Scenario Planning 2x2 | High | Medium | Frameworks |
| **P3** | Strategy Workspace + action tracker | Very High | High | Product |
| **P3** | Multi-user collaboration (comments, roles) | High | High | Enterprise |
| **P3** | Board presentation export (Slides/PPTX) | High | Medium | Enterprise |
| **P3** | Benchmark community (anonymized aggregates) | High | High | Retention |
| **P3** | Multi-tenant architecture (orgId isolation) | High | High | Scale |
| **P3** | Ansoff Matrix | Medium | Low | Frameworks |
| **P3** | Business Model Canvas extraction | Medium | Low | Frameworks |
| **P3** | Game Theory / Payoff Matrix | Medium | Medium | Frameworks |
| **P3** | Dynamic Capabilities (Teece) | Medium | Medium | Frameworks |
| **P3** | BCG Growth-Share Matrix | Medium | Low | Frameworks |
| **P3** | Real Options Analysis | Medium | Medium | Frameworks |
| **P3** | Digital Transformation Maturity Model | Medium | Low | Frameworks |
| **P3** | Cohort Retention Curves | Medium | Low | Frameworks |

---

## Agent Architecture Target State

```
User Input (text / URL / file upload)
    │
    ▼
[InterrogatorAgent]
  → Evaluates information density with real scoring rubrics
  → Deterministic fast-path (regex) + LLM slow-path
  → Max 3 clarification rounds (enforced)
    │
    ▼
[DiscoveryAgent] ← REAL web search via Google Search Grounding
  → 24-month public signal scan (grounded, not hallucinated)
  → PESTLE structured output (6-factor, scored by Impact × Likelihood)
  → Bottom-up TAM calculation
    │
    ▼
[Phase 1 Specialists — Parallel]
  marketAnalyst:      TAM Viability, Target Precision, Trend Adoption,
                      Team/Founder Strength, JTBD analysis
  innovationAnalyst:  Competitive Defensibility, Model Innovation,
                      Flywheel Potential, Network Effects Strength,
                      Data Asset Quality, Porter's Five Forces, Ecosystem Map
    │
    ▼
[Phase 2 Specialists — Parallel, consume Phase 1]
  commercialAnalyst:  Pricing Power, CAC/LTV Ratio, Market Entry Speed,
                      Unit Economics Dashboard, Ansoff Matrix, Game Theory
  operationsAnalyst:  Execution Speed, Scalability, ESG Posture,
                      Regulatory Readiness, Dynamic Capabilities, Wardley Map
    │
    ▼
[Phase 3 Specialist — consumes Phase 1 + 2]
  financeAnalyst:     ROI Projection, Risk Tolerance, Capital Efficiency,
                      Customer Concentration Risk, Monte Carlo simulation,
                      Real Options register, BCG Matrix
    │
    ▼
[blueOceanAnalyst] ← New dedicated specialist
  → ERRC Grid + Value Curve
    │
    ▼
[strategicCritic] ← FINALLY WIRED IN
  → Reviews all specialist outputs
  → Flags contradictions, low-confidence scores, logic gaps
  → Triggers re-runs for flagged dimensions
    │
    ▼
[ChiefStrategyAgent]
  → Synthesizes from verified, critic-approved specialist outputs
  → Extracts Business Model Canvas (9 blocks + Coherence Score)
  → Generates moat rationale
  → Produces 90-Day Strategic Roadmap with named actions and KPIs
    │
    ▼
[Firestore] — Persisted audit, cached stress results, audit history
[PDF] — Professional typography, embedded SVG charts, evidence appendix
[SSE] — Redis pub/sub for horizontal scaling
```

---

## The Single Highest-Leverage Change

Give the **Discovery Agent real web search** (Google Search Grounding — one config change) **and** wire the **Critic Agent** into the actual execution flow. Together these two changes transform VelocityCSO from a well-designed GPT wrapper into a **grounded intelligence platform with quality assurance** — the two things every competitor in the market fails at.

Everything else builds on that foundation.

---

## Competitive Positioning After Full Implementation

| Capability | AlphaSense ($50K+/yr) | Crayon ($20K/yr) | SWOT Generators (Free) | **VelocityCSO (Target)** |
|-----------|----------------------|-----------------|----------------------|--------------------------|
| Multi-agent AI analysis | ✅ | ❌ | ❌ | ✅ |
| Real-time web search | ✅ | ✅ | ❌ | ✅ |
| 20-dimension scoring | ❌ | ❌ | ❌ | ✅ |
| Blue Ocean / ERRC | ❌ | ❌ | ❌ | ✅ |
| Unit Economics Dashboard | Partial | ❌ | ❌ | ✅ |
| Monte Carlo stress testing | ❌ | ❌ | ❌ | ✅ |
| Wardley Mapping | ❌ | ❌ | ❌ | ✅ |
| Critic / QA loop | ❌ | ❌ | ❌ | ✅ |
| Ongoing monitoring + alerts | ✅ | ✅ | ❌ | ✅ |
| Collaboration + sharing | Partial | ✅ | ❌ | ✅ |
| Board-quality PDF | ✅ | Partial | ❌ | ✅ |
| Price | $50K–$500K/yr | $12K–$47K/yr | Free | **$100–$1K/mo** |
| Target market | Enterprise | Mid-market | Anyone | **SMB + Mid-market** |
