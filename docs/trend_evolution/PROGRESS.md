# PrismIQ Trend Evolution Timeline — Progress & Memory Ledger

**Tracking Branch**: `preeti-prismiq-improvements` (synchronized in lockstep with `main`)  
**Repository**: `Preeti-Antil02/PrismIQ` (Public)  
**Security Classification**: PUBLIC SAFE (No secrets, no raw database URLs, no tenant PII, no unmasked tokens)

---

## 1. Master Milestone Status Table (Phase S0–S8)

| Milestone | Scope & Deliverables | Status | Verification Evidence / Details |
| :--- | :--- | :--- | :--- |
| **S0** | Provenance Audit & Invariant Guards | **DONE** | DB row tracing confirmed; `test_provenance_guard.py` 4/4 passing; zero synthetic members |
| **S1** | Automated Verification Framework & Clustering Engine | **DONE** | V1–V7 automated verifiers (`scripts/trend_verify/run_all.py`); 100% provenance, 0 hallucinated, 98.28% precision |
| **S2** | Schema Migration 008 & RLS Policies | **DONE** | Run #9 (`ID: 39358052225`, success); all 9 tables active; RLS enforced with zero public/anon grants |
| **S3** | Build Pipeline & Live Backfill | **DONE** | Run #3 (`ID: 39360586951`, success in 1579s); 1,782 clusters, 3,430 members, 88 tenant views written |
| **S4** | Tenant-Isolated APIs (`/trends`, `/trends/{id}`) | **DONE** | `backend/src/api.py` & `test_trends_api.py` (6/6 passing); unauthenticated 401, cross-tenant 404, cursor pagination |
| **S5** | Frontend-v2 Trends Timeline UI | **DONE** | Next.js 16 build passing (36 static/dynamic routes); horizontal swimlanes, hiring surge, first/third-party styling |
| **S6** | Production Validation & Invariants | **DONE** | `pg_stat_user_tables` confirms 1,782 clusters, 3,430 members, 88 views; 55/55 pytest passing |
| **S7** | Decoupled Nightly Workflow | **DONE** | `.github/workflows/trend-nightly.yml` (cron `30 1 * * *` UTC) with concurrency lock and 10m timeout |
| **S8** | Close-Out, Verification & Overview Part 14 | **DONE** | Comprehensive verification report, Part 14 STAR documentation, and final plain-language report delivered |

---

## 2. Key Architecture & Design Decisions

1. **Strict Zero-LLM Timeline Construction**:
   - Every node on the timeline maps 1-to-1 to a real stored event, signal, or research item with a genuine publisher/source URL and verified source timestamp.
   - The LLM is restricted strictly to cluster labelling (3–6 words) and 2-sentence neutral factual summaries.
   - Causation claims ("because", "reacted to") are banned unless explicitly affirmed by a source document.

2. **Distinct Story Counting Unit**:
   - Counting unit for trend evolution is the *distinct story*, collapsing syndicated news repeats, same-company same-role-family job posts in a week, and same-repo GitHub activity in a week.

3. **Deterministic 3-Week Momentum**:
   - Momentum badges (`building`, `steady`, `fading`, `too_early_to_call`, `low_coverage`) are evaluated against the last 3 COMPLETED weeks via an ordered executable rule table (`backend/src/trends/momentum.py`).

4. **Multi-Tenant RLS & Zero Global Leaks**:
   - Shared cluster records use surrogate UUIDs without tenant names.
   - `NO USING (true)` on shared trend tables for authenticated/anon roles; anon is revoked.
   - Cross-tenant API requests fail closed with HTTP 404 (not 403).

5. **Resource & Quota Guardrails**:
   - Local embeddings generated via lightweight 384-dim model on runner (`fastembed` `BAAI/bge-small-en-v1.5`, ONNX CPU).
   - Nightly trend execution capped at <= 10 minutes; daily LLM calls strictly capped and tracked.

6. **Two-Stage Clustering & Corporate Parent Aliasing**:
   - Stage 1: Collapses syndicated reprints, multi-outlet coverage, and multi-tagged company events (<0.10 embedding distance within 3 days) into unified distinct stories.
   - Stage 2: Clusters distinct stories across weeks into evolving trends with recursive 3% cluster cap enforcement (never truncating).
   - Corporate parent aliasing (`Flipkart`/`Myntra`/`Shopsy` -> `Flipkart Group`, `Google`/`Google Cloud` -> `Alphabet`) prevents corporate subsidiaries from falsely satisfying the cross-competitor evidence gate.

---

## 3. Automated Verification Framework Results (`scripts/trend_verify/`)

| Gate | Metric | Result | Target Gate | Status |
| :--- | :--- | :--- | :--- | :--- |
| **V1 Provenance** | Pass Rate / Hallucinated Count | **100.0%** / **0** | 100% pass, 0 hallucinated | **PASS** |
| **V2 Momentum** | Mismatched Vectors / Exact Match | **0 mismatches** | 0 mismatches allowed | **PASS** |
| **V3 Source Check** | Verifiable Rate / Failed Rate | **75.71%** / **0.0%** | >=60% verifiable, <=3% failed | **PASS** |
| **V4 Subject Check** | Precision Rate | **98.28%** | >= 98.0% | **PASS** |
| **V5 Coherence Judging** | Usable (G+P) / Over-Clustered (OC) | **92.0%** / **4.0%** | >= 80% usable, <= 15% OC | **PASS** |
| **V6 Calibration** | Binary Agr / Neg / Pos Controls | **100%** / **100%** / **100%** | >=85% agr, >=95% neg, >=90% pos | **PASS** |
| **V7 Invariants** | Max Cap Violations / Story Partitions | **0 violations** (cap=94) | 0 cap violations, 0 duplicates | **PASS** |

---

## 4. Verified GitHub Actions & Production Database Evidence

- **Batch A (Migration 008)**: Run ID `39358052225` (Run #9), `status: completed`, `conclusion: success`. All 9 Migration 008 tables active.
- **Batch B (Trend Backfill)**: Run ID `39360586951` (Run #3), `status: completed`, `conclusion: success` in 1579s.
  - Telemetry: 3,220 distinct stories processed, 1,782 clusters formed, 11 cross-company trends, 40 storylines, 13 owner clusters.
  - Production DB live records (`pg_stat_user_tables`):
    - `trend_clusters`: **1,782**
    - `trend_cluster_members`: **3,430**
    - `tenant_trend_views`: **88**
    - `trend_build_runs`: **1**
- **Batch C (Branch Sync)**: `preeti-prismiq-improvements` and `main` synced at commit `d86bedf`.
- **Pre-Flight Security Scan**: `backend/scripts/security_check.py` passed cleanly (0 hardcoded secrets, 0 unmasked DB strings, 47/47 isolation tests passed).
- **Offline Pytest Suite**: 55/55 tests passed in 1.57s.
- **Frontend-v2 Build**: Next.js 16.3.4 compiled and type-checked cleanly across all 36 static and dynamic routes.
