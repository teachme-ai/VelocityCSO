# VelocityCSO — Current Status
**Last updated:** 2026-06-01
**Last commit:** `c97015c`
**Branch:** main
**Deployment:** Cloud Run — `business-strategy-api`, region `us-central1`

---

## Recent Commits (newest first)

### `c97015c` — fix(S3-A+S3-F): moat regression + materiality risk selection
**Why:** S3 Halcyon Run 3 showed Team/Founder Strength (95) winning the moat card instead of EMIR certification. ESG Posture (40) and Network Effects (20) kept winning the Most Material Risk card instead of strategically relevant risks.
**What changed:**
- `src/dimensionRegistry.ts` — Team/Founder, Target Precision, Execution Speed, CAC/LTV, Market Entry Speed marked `moatEligible: false`
- `src/coordinator.ts` — moat prompt now has explicit NEVER list of 10 operational dimensions; valid moat types enumerated
- `frontend/src/components/dashboard/KpiRow.tsx` — `STRATEGIC_RISK_PRIORITY` set added; LOW_MATERIALITY expanded; risk card now picks from priority dims first

---

### `3e3f7a4` — feat: capture and persist all audit inputs + clarifier Q&A in PDF
**Why:** Audit inputs (sector, scale, URL, document) were being lost or bolted onto the context string. Clarifier Q&A questions and answers were never stored — only the merged context blob survived to the PDF.
**What changed:**
- `frontend/src/components/HeroSection.tsx` — sends sector, org_scale, url_source, document_filename as discrete fields; no longer appends `[SECTOR:]` tags to context
- `src/services/sessionService.ts` — `ClarifierTurn` interface added; `StrategySession` has `clarifierExchange[]`, `sector`, `orgScale`, `urlSource`, `documentFilename`; `incrementTurn()` accepts new turn
- `src/services/memory.ts` — `AuditMemory` has `clarifierExchange`, `sector`, `orgScale`, `urlSource`, `documentFilename`; `loadAuditMemory` restores all fields
- `src/index.ts` — receives all new fields; saves to Firestore; sector/scale injected into `taggedContext` for specialists; both saveSession calls updated
- `src/services/pdfService.ts` — Sources Appendix now has 7 sections: Audit Inputs, Original Brief, Strategic Dialogue (Q&A), Data Sources, Missing Signals, Confidence Limitations, Discovery Intelligence

---

### `9552f85` — fix: normPorter/normAnsoff/normVrio schema detection
**Why:** Porter, Ansoff, VRIO frameworks were not rendering in the Strategic Frameworks tab. The schema normalisers were incorrectly detecting old vs new compact schema.
**What changed:**
- `frontend/src/components/HeroSection.tsx` — `normPorter` checks `raw.scores && typeof raw.scores === 'object'`; `normAnsoff` checks `raw.market_penetration?.score`; `normVrio` checks `raw.valuable?.score`

---

### `b01693a` — feat: Strategic Choice as dedicated card, Stress Simulator own tab
**Why:** Strategic Choice section was buried in prose and getting truncated by the 4096 token limit. Stress Test panel was lost at the bottom of the synthesis tab.
**What changed:**
- `src/coordinator.ts` — Strategic Choice moved to position 2 in synthesis prompt (before Scenario Analysis)
- `frontend/src/components/HeroSection.tsx` — `extractStrategicChoice()` parses 6-field block; renders as styled grid card; `sanitizeReport` strips it from prose
- `frontend/src/components/dashboard/ReportTabs.tsx` — new `stress` tab added; StressTestPanel moved there

---

### `6309ee9` — fix: 2s backoff before agent retry
**Why:** Finance analyst hit rate limit during critic-triggered retry (S3 Halcyon), causing fallback scores (all 50) for multiple dimensions.
**What changed:**
- `src/coordinator.ts` — `await new Promise(r => setTimeout(r, 2000))` before retry in failed agent loop

---

### `b1c8b4c` — fix: Build 3.0 Week 1 PDF fixes
**Why:** Multiple PDF rendering issues identified from live audit PDFs.
**What changed:**
- `src/services/pdfService.ts` — Fix 3.A org name (no more "The Venture"); Fix 3.D remove redundant dimension scores page; Fix 3.H unicode glyphs (v, -); Fix 3.I Sources Appendix always renders 4 sections; Fix 3.J page overflow guard tightened to 20px
- `charts-service/charts/wardley.py` — Fix 3.G label truncation: `textwrap.wrap(18)` instead of `name[:22]`

---

## Active Bugs / Known Issues

| ID | Description | Severity | Status |
|---|---|---|---|
| S3-G | ROI Projection scores 28 for Rule of 40 = 60 company | P1 | Open — post-processing floor needed |
| S3-C | Strategic Choice card not verified across runs (HTML saved on wrong tab) | P1 | Open — needs Synthesis tab save |
| S3-I | VRIO verdict "Sustained Competitive Advantage" without Snowflake/EU AI Act threat qualification | P2 | Open |

---

## Build Status

### Build 1.0 — Phase 1 (Trust Repair)
| Fix | Description | Status |
|---|---|---|
| 1.1 | Preserve specialist metadata in robustParse | ✅ Done |
| 1.2 | Fix Analysis Confidence (was 0%) | ✅ Done |
| 1.3 | Dimension registry with moatEligible flags | ✅ Done |
| 1.4 | Moat selection uses getMoatEligibleDimensions() | ✅ Done |
| 1.5 | Verdict prompt rewrite (evaluate not justify) | ✅ Done |
| 1.6 | Post-synthesis coherence check | ✅ Done |
| 1.7 | Monte Carlo variance computed dynamically | ✅ Done |
| 1.8 | "15-dimension" copy fix | ✅ Done |

### Build 1.0 — Phase 2 (Decision Engine)
| Fix | Description | Status |
|---|---|---|
| 2.1 | Roadmap runs after synthesis (posture-aligned) | ✅ Done |
| 2.2 | Strategic Choice section in synthesis | ✅ Done |
| 2.3 | Adaptive LLM-generated clarifier questions | ✅ Done |
| 2.4 | Materiality-based risk selection on dashboard | ✅ Done (`c97015c`) |

### Build 1.0 — Phase 3 (Evidence & Confidence)
| Fix | Description | Status |
|---|---|---|
| 3.1 | Sources Appendix in PDF | ✅ Done |
| 3.2 | Confidence triad (evidence/analytical/decision) | ✅ Done |
| 3.3 | Stress test scenario gating by venture type | ✅ Done |

### Build 1.0 — Phase 4 (Quick Wins)
| Fix | Description | Status |
|---|---|---|
| 4.1 | Suppress x-powered-by header | ✅ Done |
| 4.2 | Custom API domain api.velocitycso.com | ❌ Pending |
| 4.3 | OG meta tags | ✅ Done |
| 4.4 | robots.txt / sitemap.xml | ❌ Pending |
| 4.5 | Auth middleware | ❌ Deferred (product decision) |

### Build 3.0 — Week 1 PDF Fixes
| Fix | Description | Status |
|---|---|---|
| 3.A | Cover page org name | ✅ Done |
| 3.B | Cover page Executive Decision layout | ❌ Pending |
| 3.C | Diagnostic Matrix score bars | ❌ Pending |
| 3.D | Remove redundant dimension scores page | ✅ Done |
| 3.E | Porter / Ansoff / VRIO in PDF body | ✅ Done |
| 3.F | Blue Ocean chart graceful fallback | ✅ Done |
| 3.G | Wardley label truncation | ✅ Done |
| 3.H | Stress test unicode glyphs | ✅ Done |
| 3.I | Sources Appendix always renders | ✅ Done |
| 3.J | Page overflow text corruption guard | ✅ Done |

### Build 3.0 — Simulations
| Sim | Description | Status |
|---|---|---|
| SIM 3.1 | Runway simulation | ❌ Pending |
| SIM 3.2 | Fork probability model | ❌ Pending |
| SIM 3.3 | Moat decay curve | ❌ Pending |

### Other Pending
| Item | Status |
|---|---|
| S3-G ROI Projection floor fix | ❌ Pending |
| Promptfoo test harness | ❌ Pending |
| S4 Anthropic verification run | ❌ Not yet run |

---

## Verification Scenarios

| Scenario | Last Run | Passing | Failing |
|---|---|---|---|
| S1 Coffee Shop | Early builds | 9/10 | S1-E (stress test gating) |
| S2 UdyamFlow | Early builds | 7/9 | S2-A partial, S2-C |
| S3 Halcyon | Run 3 (`Be1A9eWH`) | S3-A✅ S3-B✅ S3-D✅ S3-F✅ | S3-C(unverified) S3-G(ROI 28) S3-I(VRIO unqualified) |
| S4 Anthropic | Never run | — | — |

---

## Architecture Notes
- **Deployment:** GitHub Actions → Cloud Run. Timeout 3600s.
- **LLM:** Gemini 2.5 Pro (synthesis/roadmap), Gemini 2.5 Flash (specialists, critic, moat)
- **Cost per audit:** ~$0.020–0.035, 12 LLM calls, 19K–42K tokens
- **innovation_frameworks schema:** New compact schema (`porter.forces`, `ansoff.vectors`, `vrio.scores`). Frontend normalisers handle both old and new.
- **Moat-eligible dimensions (9):** Competitive Defensibility, Model Innovation, Flywheel Potential, Network Effects Strength, Data Asset Quality, Pricing Power, Regulatory Readiness, Trend Adoption, TAM Viability
