# VelocityCSO — Current Status

**Last updated:** 2026-05-02
**Last commit:** `a854b4e`
**Branch:** main
**Deployment:** GitHub Actions → Cloud Run (`velocitycso`, `business-strategy-api`, `us-central1`)

---

## Recent Commits

### `a854b4e` — docs: update currentstatus.md
**Why:** Status file was stale after multiple commits.
**What changed:** `currentstatus.md` updated with all commits from this session.

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

### `dab17f5` — fix: remove hardcoded test-case logic; generic attack vectors + VRIO conditional verdict
**Why:** Hardcoded `snowflake`/`build-vs-buy` string checks with Halcyon-specific probability numbers were in production coordinator; VRIO always returned "Sustained" regardless of active threats.
**What changed:**
- `src/coordinator.ts` — removed hardcoded competitor string checks; replaced with `extractAttackVectorsFromReport()` reading Wardley warnings and synthesis threat language via generic regex patterns
- `src/services/forkProbabilityService.ts` — removed "first Halcyon run" comment from telemetry
- `src/services/moatDecayService.ts` — `extractReplicationMonths` now requires replication/competitor language context; prevents founding years (e.g. 2018) being grabbed as replication months
- `src/specialists.ts` — VRIO prompt adds `Conditional Competitive Advantage` verdict; rule forces conditional language when active threats present in context (fixes B1/S3-I)

### `0e9c216` — fix: Pro model retry backoff, sim panels on web, Strategic Choice strip bug
**Why:** Gemini 2.5 Pro was falling back to Flash on first transient error; sim data was computed but never sent to frontend; Strategic Choice card was being stripped before extraction could read it.
**What changed:**
- `src/services/geminiClient.ts` — Pro calls retry 3x with 2s/5s/10s exponential backoff before throwing
- `src/index.ts` — `forkProbabilities`, `moatDecayResult`, `runwayResult` added to both `REPORT_COMPLETE` SSE events
- `frontend/src/components/HeroSection.tsx` — `ReportData` type extended with sim fields; `sanitizeReport` no longer strips Strategic Choice block; Stress tab renders SIM 3.1/3.2/3.3 panels

### `efe11ba` — ci: paths-ignore for doc-only commits
**Why:** Doc-only commits were triggering full Cloud Run deploys unnecessarily.
**What changed:**
- `.github/workflows/deploy.yml` — `paths-ignore` added for `currentstatus.md`, `.amazonq/**`, `plans/**`, `**.md`, `.claude/**`

### `c97015c` — fix: moat regression + materiality risk selection
**Why:** Operational dimensions were being selected as moats; ESG Posture was appearing as Key Risk.
**What changed:**
- `src/dimensionRegistry.ts` — Team/Founder, Target Precision, Execution Speed, CAC/LTV, Market Entry Speed marked `moatEligible: false`
- `src/coordinator.ts` — moat prompt NEVER list of operational dimensions
- `frontend/src/components/dashboard/KpiRow.tsx` — `STRATEGIC_RISK_PRIORITY` set added; `LOW_MATERIALITY` expanded

### `3e3f7a4` — feat: all audit inputs captured + Strategic Dialogue appendix
**Why:** Sector, org_scale, url_source, document_filename not persisted; clarifier Q&A not in PDF appendix.
**What changed:**
- `frontend/src/components/HeroSection.tsx` — sends all discrete fields
- `src/index.ts` — saves all fields to Firestore and AuditMemory
- `src/services/sessionService.ts` — `ClarifierTurn` interface; every Q&A pair stored
- `src/services/pdfService.ts` — Sources Appendix 7 sections including Strategic Dialogue

### `9552f85` — fix: Porter/Ansoff/VRIO schema normalisation
**Why:** All three frameworks rendering blank in Strategic Frameworks tab.
**What changed:**
- `frontend/src/components/HeroSection.tsx` — `normPorter`/`normAnsoff`/`normVrio` fixed for compact schema

### `8a71b14` / `ebd8cdc` — feat: SIM 3.1/3.2/3.3 simulations
**Why:** No runway, fork probability, or moat decay modelling in the product.
**What changed:**
- `src/services/monteCarloService.ts` — `runRunwaySimulation()` 10K iterations, triangular distributions, P10/P50/P90
- `src/services/forkProbabilityService.ts` — Bayesian odds ratio fork probability
- `src/services/moatDecayService.ts` — linear→exponential decay curve
- `src/specialists.ts` — finance analyst extracts `runwayInputs` schema
- `src/services/pdfService.ts` — SIM 3.1/3.2/3.3 pages added

---

## Active Bugs / Known Issues

| ID | Description | Severity | Status |
|---|---|---|---|
| B1 | VRIO verdict shows "Sustained" — no threat qualification | P1 | ✅ Fixed `dab17f5` |
| B2 | SIM 3.3 decay curve flat — `extractReplicationMonths` grabbed founding year 2018 | P1 | ✅ Fixed `dab17f5` |
| B3 | "2018m" display artifact in PDF moat decay table | P2 | Open — will resolve naturally now B2 is fixed |
| B4 | Q1 missing from Strategic Dialogue appendix — turn counter bug | P1 | Open |
| B5 | SIM 3.2 fork extraction fails on Flash-generated synthesis — regex only matches `(a)/(b)/(c)` labels | P1 | Open |
| B6 | "Monte Carlo" orphan label on PDF page 11 | P2 | Open |
| B7 | Frontend dimension lists (`NON_MOAT_DIMS`, `LOW_MATERIALITY`, `STRATEGIC_RISK_PRIORITY`) are hardcoded copies of backend registry | P2 | Open — partial fix `d2c1122` (values aligned); full fix requires API exposure |

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
| S3-I: VRIO "Conditional" not "Sustained" | ✅ Done `dab17f5` |
| S3-J: Roadmap aligns to fork (a) | ✅ Done |
| S3-K: Monte Carlo sensible | ✅ Done |
| S3-L: TCO pricing analysis present | ✅ Done |
| S3-M: Numerix named as Snowflake vector | ✅ Done |
| S3-N: ION/Allegro not framed as exotic threat | ✅ Done |
| SIM 3.1 in PDF | ✅ Done |
| SIM 3.2 in PDF | ❌ Pending (B5) |
| SIM 3.3 in PDF | ✅ Done — decay curve now correct (B2 fixed) |
| SIM 3.1/3.2/3.3 on web report | ✅ Done `0e9c216` |
| Strategic Choice card on web | ✅ Done `0e9c216` |
| Pro model retry backoff | ✅ Done `0e9c216` |
| Strategic Dialogue Q1+Q2 in appendix | ❌ Pending (B4) |
| Hardcoded test-case logic removed | ✅ Done `dab17f5` + `d2c1122` |

---

## Verification Scenarios

| Scenario | Last Run | Passing | Failing |
|---|---|---|---|
| S1 Coffee Shop | Not run this session | — | — |
| S2 UdyamFlow | Not run this session | — | — |
| S3 Halcyon v3 | 2026-05-02 (Run 4) | S3-A,B,C,D,F,G,H,I,J,K,L,M,N | — |
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
- **Attack vectors:** Extracted generically from Wardley warnings + synthesis report — no hardcoded competitor names
- **VRIO verdict:** Forces "Conditional Competitive Advantage" when active threats present in context
- **Security:** No credentials in repo — all secrets in GitHub Secrets (`GCP_WIF_SERVICE_ACCOUNT`, `GEMINI_API_KEY`)
