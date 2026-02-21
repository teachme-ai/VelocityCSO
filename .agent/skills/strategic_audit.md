---
description: How to perform a 15-dimension strategic audit with Firestore pre-check and 24-month staleness rule
---

# Strategic Audit Skill

## Purpose
This skill governs the full protocol for a VelocityCSO 15-dimension strategic audit.
It instructs agents on when to use cached data vs. trigger a fresh discovery sweep.

## Pre-Audit: Firestore Staleness Check

Before running a new audit, always check if a previous audit exists for this business.

1. Use `firestore_query_collection` on the `enterprise_strategy_reports` collection.
2. Match on the `fingerprint` field (first 80 characters of the business context, lowercased).
3. Retrieve the `created_at` timestamp of the most recent matching document.

**Decision Rule:**
- If a previous audit exists and is **less than 24 months old** → surface the cached report to the user and ask if they want a fresh audit.
- If the previous audit is **older than 24 months** → trigger a fresh `DiscoveryAgent` sweep (the 24-month lookback rule).
- If **no previous audit exists** → proceed directly with Discovery.

## Phase 0: Discovery Sweep

- Agent: `discovery_agent` (gemini-2.0-flash)
- Mission: 24-month lookback on public signals (revenue, pivots, leadership, competitive moves)
- Output: Structured JSON with `findings`, `gaps[]`, `is_complete`
- Constraint: If `is_complete` is false → pause the autonomous flow and trigger Conversational Clarification

## Phase 1–3: 15-Dimension Analysis

Only runs after Phase 0 is complete (either `is_complete: true` or user clarification received).

- Agents: 5 domain specialists (gemini-2.5-flash)
- Critic: `strategic_critic` (gemini-2.5-pro) — runs after all 5 specialists
- CSO: `chief_strategy_agent` (gemini-2.5-pro) — final synthesis

## Output Requirements

Every audit must produce:
1. A Markdown report with Executive Summary
2. 15 dimension scores (0–100) in structured JSON
3. A `confidence_score` (0–100) — if below 70, include Strategic Blindspots section
4. The report and `fingerprint` must be saved to `enterprise_strategy_reports` in Firestore

## Logging Protocol

Every agent transition must emit a structured log entry via `src/services/logger.ts`:
- `severity`: INFO (normal) / WARNING (gap/fallback) / ERROR (failure)
- `agent_id`: name of the agent
- `phase`: 'discovery' | 'evaluation' | 'specialist' | 'critic' | 'synthesis'
- `cost_usd`: estimated cost for this call
