# VelocityCSO — Current Status

**Last updated:** 2026-05-02
**Last commit:** `0e9c216`
**Branch:** main
**Deployment:** GitHub Actions → Cloud Run (`velocitycso`, `business-strategy-api`, `us-central1`)

---

## Recent Commits

### `d2c1122` — chore: remove all test-case labels and hardcoded scenario references
**Why:** Build-sheet assertion IDs (S3-G, FIX 1.x, FIX 2.x), scenario-specific examples (EMIR, CA-network), and test-run comments were embedded in production code and log messages.
**What changed:**
- `src/coordinator.ts` — `[S3-G]` → `[ROI_FLOOR]`; all `[FIX x.x]` log labels → semantic labels (`[METADATA]`, `[MOAT_SELECTION]`, `[POSTURE_EXTRACT]`, `[COHERENCE]`, `[CONFIDENCE]`); moat prompt examples replaced with generic ones; "not just Halcyon" comment removed
- `src/dimensionRegistry.ts` — FIX 1.3/1.4 removed from JSDoc
- `src/agents/interrogator.ts` — `[FIX 2.3]` → `[INTERROGATOR]` in all log messages
- `src/services/monteCarloService.ts` — FIX 1.7 labels removed
- `src/index.ts` — FIX 3.3 comment removed
- `frontend/src/components/ExecutiveSummaryCard.tsx` — inline registry comments removed; `NON_MOAT_DIMS` expanded to match full registry
- `frontend/src/components/dashboard/KpiRow.tsx` — FIX 2.4/1.2+3.2 comments removed; `LOW_MATERIALITY` and `STRATEGIC_RISK_PRIORITY` aligned to registry

**Why:** Gemini 2.5 Pro was falling back to Flash on first transient error; sim data was computed but never sent to frontend; Strategic Choice card was being stripped before extraction could read it.
**What changed:**
- `src/services/geminiClient.ts` — Pro calls retry 3x with 2s/5s/10s exponential backoff before throwing; Flash fallback only fires after all retries exhausted
- `src/index.ts` — `forkProbabilities`, `moatDecayResult`, `runwayResult` added to both `REPORT_COMPLETE` SSE events (were saved to Firestore but never sent to frontend)
- `frontend/src/components/HeroSection.tsx` — `ReportData` type extended with sim fields; both `REPORT_COMPLETE` handlers read sim data; `sanitizeReport` no longer strips Strategic Choice block; Stress tab renders SIM 3.1/3.2/3.3 panels above StressTestPanel

### `efe11ba` — ci: paths-ignore for doc-only commits
**Why:** Doc-only commits were triggering full Cloud Run deploys unnecessarily.
**What changed:**
- `.github/workflows/deploy.yml` — `paths-ignore` added for `currentstatus.md`, `.amazonq/**`, `plans/**`, `**.md`, `.claude/**`

### `c97015c` — fix: S3-A moat regression + S3-F materiality risk
**Why:** Operational dimensions (Team/Founder, Target Precision, etc.) were being selected as moats; ESG Posture was appearing as Key Risk instead of strategic risks.
**What changed:**
- `src/dimensionRegistry.ts` — Team/Founder, Target Precision, Execution Speed, CAC/LTV, Market Entry Speed marked `moatEligible: false`
- `src/coordinator.ts` — Moat prompt has explicit NEVER list of 10 operational dimensions
- `frontend/src/components/dashboard/KpiRow.tsx` — `STRATEGIC_RISK_PRIORITY` set added; `LOW_MATERIALITY` expanded

### `3e3f7a4` — feat: all audit inputs captured + Strategic Dialogue appendix
**Why:** Sector, org_scale, url_source, document_filename were not being persisted; clarifier Q&A was not appearing in PDF appendix.
**What changed:**
- `frontend/src/components/HeroSection.tsx` — sends all discrete fields
- `src/index.ts` — saves all fields to Firestore and AuditMemory
- `src/services/sessionService.ts` — `ClarifierTurn` interface; every Q&A pair stored
- `src/services/pdfService.ts` — Sources Appendix has 7 sections including Strategic Dialogue

### `9552f85` — fix: Porter/Ansoff/VRIO schema normalisation
**Why:** All three frameworks were rendering blank in Strategic Frameworks tab.
**What changed:**
- `frontend/src/components/HeroSection.tsx` — `normPorter`/`normAnsoff`/`normVrio` fixed for new compact schema

### `b01693a` — feat: Strategic Choice card + Stress Simulator tab
**Why:** Strategic Choice was buried in prose; simulations had no dedicated UI home.
**What changed:**
- `src/coordinator.ts` — Strategic Choice moved to position 2 in synthesis prompt
- `frontend/src/components/HeroSection.tsx` — `extractStrategicChoice()` renders as styled grid card; Stress Simulator moved to its own tab

### `8a71b14` — feat: SIM 3.2 fork probability + SIM 3.3 moat decay + S3-G ROI floor
**Why:** No probabilistic fork analysis; no moat decay modelling; ROI Projection was scoring low despite strong unit economics.
**What changed:**
- `src/services/forkProbabilityService.ts` — NEW. Bayesian odds ratio math
- `src/services/moatDecayService.ts` — NEW. Fixed linear→exponential decay curve
- `src/coordinator.ts` — S3-G ROI floor guard; all three sims called after synthesis

### `ebd8cdc` — feat: SIM 3.1 runway simulation
**Why:** No financial runway modelling in the product.
**What changed:**
- `src/services/monteCarloService.ts` — `runRunwaySimulation()` with 10K iterations, triangular distributions, P10/P50/P90
- `src/specialists.ts` — finance analyst extracts `runwayInputs` schema
- `src/services/pdfService.ts` — runway page added

---

## Active Bugs / Known Issues

| ID | Description | Severity | Status |
|---|---|---|---|
| B1 | VRIO verdict shows "Sustained Competitive Advantage" — no threat qualification for Snowflake/EU AI Act | P1 | Open |
| B2 | SIM 3.3 decay curve flat for high-strength moats — parity at 2018 months (should be ~24-30m for Halcyon) | P1 | Open |
| B3 | "2018m" display bug in PDF moat decay table — missing space before unit | P2 | Open |
| B4 | Q1 missing from Strategic Dialogue appendix — turn counter stores Q1 as turn 3, not captured in clarifierExchange | P1 | Open |
| B5 | SIM 3.2 fork extraction fails on Flash-generated synthesis — `extractForksFromReport` regex only matches `(a)/(b)/(c)` labels | P1 | Open |
| B6 | "Monte Carlo" orphan label on PDF page 11 — section header emitted without adjacent chart | P2 | Open |

---

## Build Status

| Item | Status |
|---|---|
| S3-A: EMIR/exotic engine as moat | ✅ Done |
| S3-B: $72M ARR stated correctly | ✅ Done |
| S3-C: Strategic Choice card present | ✅ Done |
| S3-D: Ansoff vs Synthesis coherence | ✅ Done |
| S3-F: Key Risk is Geneva/EU AI Act/Snowflake | ✅ Done |
| S3-G: ROI Projection ≥ 65 | ✅ Done |
| S3-H: Zero score drift | ✅ Done |
| S3-I: VRIO "Conditional" not "Sustained" | ❌ Pending (B1) |
| S3-J: Roadmap aligns to fork (a) | ✅ Done |
| S3-K: Monte Carlo sensible | ✅ Done |
| S3-L: TCO pricing analysis present | ✅ Done |
| S3-M: Numerix named as Snowflake vector | ✅ Done |
| S3-N: ION/Allegro not framed as exotic threat | ✅ Done |
| SIM 3.1 in PDF | ✅ Done |
| SIM 3.2 in PDF | ❌ Pending (B5) |
| SIM 3.3 in PDF | ✅ Done (decay curve flat — B2) |
| SIM 3.1/3.2/3.3 on web report | ✅ Done (this commit) |
| Strategic Choice card on web | ✅ Done (this commit) |
| Pro model retry backoff | ✅ Done (this commit) |
| Strategic Dialogue Q1+Q2 in appendix | ❌ Pending (B4) |

---

## Verification Scenarios

| Scenario | Last Run | Passing | Failing |
|---|---|---|---|
| S1 Coffee Shop | Not run this session | — | — |
| S2 UdyamFlow | Not run this session | — | — |
| S3 Halcyon v3 | 2026-05-02 (Run 4) | S3-A,B,C,D,F,G,H,J,K,L,M,N | S3-I |
| S4 Anthropic | Not run this session | — | — |

---

## Architecture Notes

- **Repo:** `teachme-ai/VelocityCSO`
- **Backend:** Node.js/TypeScript, Cloud Run, Firestore
- **Frontend:** React/Vite, Vercel
- **LLM routing:** Gemini 2.5 Pro (synthesis), Gemini 2.5 Flash (specialists), gemini-2.0-flash-001 (discovery/wardley/blue ocean)
- **Pro retry policy:** 3 attempts, 2s/5s/10s backoff, retryable on 429/500/503/504
- **Simulations:** SIM 3.1 (runway, 10K iterations), SIM 3.2 (fork probability, Bayesian odds), SIM 3.3 (moat decay, linear→exponential)
- **Moat-eligible dimensions (9):** Competitive Defensibility, Model Innovation, Flywheel Potential, Network Effects Strength, Data Asset Quality, Pricing Power, Regulatory Readiness, Trend Adoption, TAM Viability
- **Security:** No credentials in repo — all secrets in GitHub Secrets (`GCP_WIF_SERVICE_ACCOUNT`, `GEMINI_API_KEY`)
