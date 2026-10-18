# PrismIQ Trend Evolution Timeline — Progress & Memory Ledger

**Tracking Branch**: `feat/trend-evolution` (diverged from `main` at `d27af7b`)  
**Repository**: `Preeti-Antil02/PrismIQ` (Public)  
**Security Classification**: PUBLIC SAFE (No secrets, no raw database URLs, no tenant PII, no unmasked tokens)

---

## 1. Milestone Status Table

| Milestone | Description | Status | Evidence Pointer / SHA256 |
| :--- | :--- | :--- | :--- |
| **T0** | Preflight & State Verification | **IN PROGRESS** | Blocked on local read-only connection file saving |
| **T1** | Pure Core Logic (Rules, Momentum, Dates) | NOT STARTED | Pending T0 completion |
| **T2** | Clustering Prototype & Owner Grading | NOT STARTED | Pending T1 completion |
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

## 4. Open Owner Inquiries

1. **Local Read-Only Credentials**:
   - Owner has `backend/.env.readonly` open in editor. Please save `SUPABASE_READONLY_DB_URL` into this file so T0 read-only database recon queries can execute.
2. **Prior Run Data**:
   - Requesting run IDs, durations, and Step Summary JSON for the recent workflow runs (G2 dry run, G3 live run).
3. **Tenant Rollout Scope**:
   - Confirming whether initial trend visualization should be scoped strictly to scheduled tenants (`scheduled_tenants` allow-list).
4. **Slack Delivery Receipts**:
   - Confirming receipt of intelligence digest in the owner Slack channel.
