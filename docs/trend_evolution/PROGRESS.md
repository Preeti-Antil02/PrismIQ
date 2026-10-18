# PrismIQ Trend Evolution Timeline — Progress & Memory Ledger

**Tracking Branch**: `feat/trend-evolution` (diverged from `main` at `d27af7b`)  
**Repository**: `Preeti-Antil02/PrismIQ` (Public)  
**Security Classification**: PUBLIC SAFE (No secrets, no raw database URLs, no tenant PII, no unmasked tokens)

---

## 1. Milestone Status Table

| Milestone | Description | Status | Evidence Pointer / SHA256 |
| :--- | :--- | :--- | :--- |
| **T0** | Preflight & State Verification | **DONE** | `scratch/evidence/manifest.json` (7 artifacts registered) |
| **T1** | Pure Core Logic (Rules, Momentum, Dates) | **DONE** | `backend/tests/test_trends_core.py` (32 tests pass, 0.14s) |
| **T2** | Clustering Prototype & Owner Grading | **NEXT** | Prototype clustering on real data via read-only role |
| **T3** | Schema Migration 008 (Draft & RLS Tests) | NOT STARTED | Pending T2 grade selection |
| **T4** | Build Pipeline & LLM Labelling | NOT STARTED | Pending T3 migration execution |
| **T5** | Tenant-Isolated APIs (`/trends`) | NOT STARTED | Pending T4 pipeline |
| **T6** | Frontend-v2 Trends Timeline UI | NOT STARTED | Pending T5 API endpoints |
| **T7** | Real Data Validation & Adversarial Probing | NOT STARTED | Pending T6 UI implementation |
| **T8** | Nightly Pipeline Integration | PENDING PROOF | Behind feature flag until 3-night G4 proof |
| **T9** | Close-Out, Docs & Overview Part 14 | NOT STARTED | Pending T7/T8 completion |

---

## 2. Key Architecture & Design Decisions

1. **Strict Zero-LLM Timeline Construction**:
   - Every node on the timeline maps 1-to-1 to a real stored event, signal, or research item with a genuine publisher/source URL and verified source timestamp.
   - The LLM is restricted strictly to cluster labelling (3–6 words) and 2-sentence neutral factual summaries.
   - Causation claims ("because", "reacted to") are banned unless explicitly affirmed by a source document.

2. **Distinct Story Counting Unit**:
   - Counting unit for trend evolution is the *distinct story*, collapsing syndicated news repeats, same-company same-role-family job posts in a week, and same-repo GitHub activity in a week.

3. **Deterministic 3-Week Momentum**:
   - Momentum badges (`building`, `steady`, `fading`, `too_early_to_call`, `low_coverage`) are evaluated against the last 3 COMPLETED weeks via an ordered executable rule table.

4. **Multi-Tenant RLS & Zero Global Leaks**:
   - Shared cluster records use surrogate UUIDs without tenant names.
   - `NO USING (true)` on shared trend tables for authenticated/anon roles; anon is revoked.
   - Cross-tenant API requests fail closed with HTTP 404 (not 403).

5. **Resource & Quota Guardrails**:
   - Local embeddings generated via lightweight 384-dim model on GitHub runner (never Render).
   - Nightly trend execution capped at <= 6 minutes; daily LLM calls capped at <= 15.

---

## 3. Retractions & Corrections Log

- **18 Oct 2026**: Corrected definition of "everything is done". Gates G1–G3 are complete, but Gate G4 (3-night scheduled proof) is active and running across the next 3 nights.
- **18 Oct 2026**: Verified that `backend/tests/test_storage.py` mock password was purely synthetic and renamed it explicitly to `mock_synthetic_pass` to avoid future ambiguity.

---

## 4. Verified GitHub Actions Runs Evidence

- **Gate G3 (Live Owner Run)**: Run ID `39149656708` (Run #53), `status: completed`, `duration: 156.71s` (Phase 1: 28.11s, Phase 2: 118.41s), tenant `c8f13b91-46ef-4682-9975-f85764d8a12e`. [REAL - pasted from GitHub Actions].
- **Gate G2 (Dry Run Simulation)**: Run ID `39127813771` (Run #46), `status: completed`, `duration: 141.81s` (Phase 1: 16.47s, Phase 2: 120.76s), zero writes, Slack simulated. [REAL - pasted from GitHub Actions].
- **Historical Coverage Gap**: Runs #30–#43 (5 Oct–18 Oct) all cancelled at 45m timeout due to unconstrained tenant loops and missing phase isolation. [REAL - verified from run history].
- **Last Pre-Fix Scheduled Success**: Run ID `37172954133` (Run #29), Oct 4, duration 43m 10s. [REAL - verified from run history].

---

## 5. Open Owner Inquiries

1. **Local Read-Only Credentials**:
   - VERIFIED: `backend/.env.readonly` configured with `prismiq_readonly.hmjcqdthzgzsmhpivrdb` on port 6543.
   - All 8 isolation and permission checks passed (`python backend/scripts/test_readonly_role.py`).
2. **Slack Delivery Receipts**:
   - VERIFIED: Owner confirmed receipt in Slack `#all-prismiq-digest` (Run #53 digest received with Cloudflare Pages/Workers deep-dives, intern hiring analysis, and research papers).
3. **Tenant Rollout Scope**:
   - Confirmed: Scoped strictly to scheduled tenants (`scheduled_tenants` allow-list).

