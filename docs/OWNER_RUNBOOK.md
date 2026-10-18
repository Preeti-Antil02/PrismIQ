# PrismIQ Pipeline Stabilization — Owner Runbook

**Target Branch**: `fix/scheduler-reliability`  
**Public Repository**: `Preeti-Antil02/PrismIQ`  
**Security Classification**: PUBLIC REPO SAFE (No secrets, no raw database URLs, no webhook tokens).

---

## Overview & Execution Protocol
This runbook guides the repository owner through the gates (G1 -> G1b -> G1c -> G2 -> G3 -> G4) required to stabilize the nightly intelligence pipeline, secure production credentials, provision the isolated read-only role, and verify scheduler execution.

Execution Order:
1. Gate G1: Rotate production database password & auxiliary secrets; terminate pooled sessions.
2. Gate G1b: Execute Migration 005 (`scheduled_tenants` table) so it exists prior to read-only role provisioning.
3. Gate G1c: Provision `prismiq_readonly` role in Supabase (Migration 007); verify using local read-only diagnostic script.
4. Gate G1d: Execute Migration 006 (provenance columns & safe historical backfill count).
5. Pre-Push Checklist: Verify no scratch files or credentials exist in git tree.
6. Gate G2: Push branch `fix/scheduler-reliability` and dispatch dry-run simulation **FROM THE BRANCH**.
7. Gate G3: Dispatch live owner run **FROM THE BRANCH** (repairs owner brief and validates live delivery).
8. Merge: Merge PR `fix/scheduler-reliability` into `main` only after G2 and G3 pass.
9. Gate G4: Monitor 3 consecutive nightly scheduled runs (`0 0 * * *`).

---

## GATE G1: Production Credential Rotation & Session Termination

### Context
Commit `cfbb1ba` (23 Sep 2026) inadvertently committed a live Supabase connection URL to the public git repository. Password rotation is mandatory and non-negotiable.

> [!CAUTION]
> **CRITICAL SECURITY WARNING**: NEVER paste connection strings or passwords into chat, issues, PRs, or git commits. All production credentials must be set directly in Supabase, Render, and GitHub Secrets out-of-band. Antigravity and git must never receive production passwords.

### Step-by-Step Instructions
1. **Supabase Dashboard**: Log in to Supabase -> Select Project -> Navigate to **Project Settings** -> **Database**.
2. Under **Database Password**, click **Reset database password**. Generate and save a new secure high-entropy password.
3. Copy the updated connection strings:
   - **Transaction Pooler (Port 6543)**: `postgresql://postgres.[project_ref]:****@aws-0-[region].pooler.supabase.com:6543/postgres`
4. **Update Render Deployment**:
   - Go to Render Dashboard -> Web Service (`prismiq-api`) -> **Environment**.
   - Update `SUPABASE_DB_URL` with the new transaction pooler connection string.
   - Verify that `ALLOW_LIVE_WRITE` is present and set to `"true"`.
   - Trigger a manual deploy to confirm Render API connects cleanly.
5. **Update GitHub Actions Secrets**:
   - Go to GitHub -> Repository Settings -> **Secrets and variables** -> **Actions**.
   - Update secret `SUPABASE_DB_URL` with the new transaction pooler connection string.
6. **Local Developer Files Sanitization**:
   - In local `backend/.env`: ensure `SUPABASE_DB_URL` is **COMPLETELY DELETED**.
   - Rule R1 is enforced by CI security check: local files must never contain production write credentials.
7. **Terminate Existing PostgreSQL Sessions**:
   - After updating secrets in Render and GitHub Actions, terminate active sessions opened with the old password (the Supabase connection pooler will immediately reconnect using the new password):
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE usename = 'postgres' AND pid <> pg_backend_pid();
   ```
8. **Audit for Unknown Clients**:
   - Pooled connections in `pg_stat_activity` display the internal Supabase pooler's address rather than the client's IP. To check for unauthorized connections, inspect **Supabase Dashboard** -> **Logs** -> **Database Logs** and **Auth Logs**.
9. **Rotate Auxiliary Secrets**:
   - In addition to `SUPABASE_DB_URL`, verify and rotate auxiliary tokens if exposure is suspected:
     * `GROQ_API_KEY` (Groq console)
     * `CURRENTS_API_KEY` (Currents dashboard)
     * `GITHUB_TOKEN` / `GH_PAT_TOKEN` (GitHub developer settings)
     * `LANGCHAIN_API_KEY` (LangSmith console)
     * `SLACK_WEBHOOK_URL` (Slack app incoming webhooks)

### Verification Query (Run in Supabase SQL Editor)
```sql
-- Verify no stale queries are blocked
SELECT pid, usename, client_addr, backend_start, state, query
FROM pg_stat_activity
WHERE usename = 'postgres' AND pid <> pg_backend_pid();
```

### Paste This Back for Gate G1:
- [ ] Confirmation that Supabase database password has been reset.
- [ ] Confirmation that `SUPABASE_DB_URL` is updated in Render (and redeployed) and GitHub Secrets.
- [ ] Confirmation that `SUPABASE_DB_URL` is deleted from local files.
- [ ] Confirmation that session termination SQL was executed.
- [ ] Result of the verification query showing active clean connections.

---

## GATE G1b: Execute Migration 005 (Scheduled Tenants Whitelist)

### Context
Migration 005 establishes the `scheduled_tenants` table. It ensures the autonomous nightly scheduler processes strictly verified, opted-in production tenants rather than all 26 self-serve onboarding test tenants, preventing the 45-minute timeout.
Executing 005 first ensures `scheduled_tenants` is created before the `prismiq_readonly` dynamic permission loop in Migration 007 runs.

### Step-by-Step Instructions
1. Open Supabase Dashboard -> **SQL Editor**.
2. Run migration `005_scheduled_tenants.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.scheduled_tenants (
    tenant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_scheduled boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.scheduled_tenants ENABLE ROW LEVEL SECURITY;

-- Revoke all permissions from client roles (anon, authenticated)
REVOKE ALL ON public.scheduled_tenants FROM anon, authenticated;

-- Seed verified Owner tenant (c8f13b91-46ef-4682-9975-f85764d8a12e) after owner confirmation:
INSERT INTO public.scheduled_tenants (tenant_id, is_scheduled)
VALUES ('c8f13b91-46ef-4682-9975-f85764d8a12e', true)
ON CONFLICT (tenant_id) DO UPDATE SET is_scheduled = EXCLUDED.is_scheduled, updated_at = now();
```

### Verification Query
```sql
SELECT tenant_id, is_scheduled, created_at FROM public.scheduled_tenants;
```

### Rollback (if G1b fails)
```sql
DROP TABLE IF EXISTS public.scheduled_tenants CASCADE;
```

### Paste This Back for Gate G1b:
- [ ] Output of `SELECT tenant_id, is_scheduled FROM public.scheduled_tenants;`.

---

## GATE G1c: Provision Isolated Read-Only Role (Migration 007)

### Context
All local development, dry-run pipelines, and diagnostics must connect strictly through a dedicated `prismiq_readonly` role that has zero mutation privileges, cannot view Slack webhook URLs, and cannot mutate tables.
Because Migration 005 was executed in Gate G1b, Migration 007's dynamic loop will automatically discover `public.scheduled_tenants` and grant SELECT on it to `prismiq_readonly`.

### Step-by-Step Instructions
1. Open Supabase Dashboard -> **SQL Editor**.
2. Run migration `007_readonly_role_and_rls.sql` in a single transaction:
```sql
BEGIN;

-- 1. Create Role (without hardcoded password)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'prismiq_readonly') THEN
        CREATE ROLE prismiq_readonly WITH LOGIN;
    END IF;
END $$;

ALTER ROLE prismiq_readonly SET default_transaction_read_only = on;

-- 2. Schema and Database Access
GRANT CONNECT ON DATABASE postgres TO prismiq_readonly;
GRANT USAGE ON SCHEMA public TO prismiq_readonly;

-- 3. Dynamic Grants & Idempotent RLS Policies Generated from pg_class
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT c.relname, c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname != 'tenant_delivery_configs'
    LOOP
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO prismiq_readonly;', rec.relname);
        IF rec.relrowsecurity THEN
            EXECUTE format('DROP POLICY IF EXISTS readonly_select_policy ON public.%I;', rec.relname);
            EXECUTE format('CREATE POLICY readonly_select_policy ON public.%I FOR SELECT TO prismiq_readonly USING (true);', rec.relname);
        END IF;
    END LOOP;

    -- Column-level grant on tenant_delivery_configs (excluding slack_webhook_url)
    EXECUTE 'GRANT SELECT (tenant_id, slack_channel, delivery_cadence, is_enabled, created_at, updated_at) ON public.tenant_delivery_configs TO prismiq_readonly;';

    EXECUTE 'DROP POLICY IF EXISTS readonly_select_policy ON public.tenant_delivery_configs;';
    EXECUTE 'CREATE POLICY readonly_select_policy ON public.tenant_delivery_configs FOR SELECT TO prismiq_readonly USING (true);';
END $$;

-- 4. Revoke mutation privileges
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM prismiq_readonly;

-- 5. Revoke auth schema access (safely wrapped)
DO $$
BEGIN
    REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM prismiq_readonly;
    REVOKE USAGE ON SCHEMA auth FROM prismiq_readonly;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: Auth schema revoke encountered non-fatal error: %', SQLERRM;
END $$;

COMMIT;
```

3. **Set the Read-Only Role Password**:
   - Option A (Dashboard UI): Set the password for `prismiq_readonly` in **Database** -> **Roles**.
   - Option B (SQL Editor):
     ```sql
     ALTER ROLE prismiq_readonly WITH PASSWORD 'SET_YOUR_READONLY_PASSWORD_HERE';
     ```
   > [!IMPORTANT]
   > **DELETE THIS SNIPPET**: If using Option B, immediately clear/delete the snippet from the SQL Editor to prevent the password from persisting in Supabase query history.

4. **Construct `SUPABASE_READONLY_DB_URL`**:
   - For pooler: `postgresql://prismiq_readonly.[project_ref]:[READONLY_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
   - Add `SUPABASE_READONLY_DB_URL` to GitHub Actions Secrets.

5. **Local Environment Setup**:
   Create a gitignored `backend/.env.readonly` file using a text editor (e.g. VS Code, Notepad) rather than typing the password into a PowerShell terminal command (which persists in command history):
   ```ini
   # backend/.env.readonly (gitignored - do not commit)
   SUPABASE_READONLY_DB_URL=postgresql://prismiq_readonly.[project_ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   (Verify that `backend/.env.readonly` is listed in `.gitignore` to guarantee it cannot be committed.)

6. **Run the Role Verification Script Locally**:
   ```powershell
   python backend/scripts/test_readonly_role.py
   ```

### Expected Output of Verification Script
```
Connecting to database target as prismiq_readonly: ...
Connected as current_user='prismiq_readonly', session_user='prismiq_readonly'

[PASS] SELECT on RLS tables succeeded and returned data > 0 (briefs: ..., tracked_companies: ...)
[PASS] SELECT on permitted columns of tenant_delivery_configs succeeded (returned ... rows > 0)
[PASS] slack_webhook_url correctly blocked with 'permission denied': ...
[PASS] INSERT correctly blocked with 'permission denied': ...
[PASS] UPDATE correctly blocked with 'permission denied': ...
[PASS] DELETE correctly blocked with 'permission denied': ...
[PASS] DDL CREATE TABLE correctly blocked with 'permission denied': ...
[PASS] auth.users access correctly blocked: ...

======================================================================
READ-ONLY ROLE VERIFICATION PASSED: All 8 security checks verified!
======================================================================
```

### Rollback (if G1c fails)
```sql
DROP OWNED BY prismiq_readonly;   -- removes its grants and policies
DROP ROLE IF EXISTS prismiq_readonly;
```

### Paste This Back for Gate G1c:
- [ ] Full raw output of `python backend/scripts/test_readonly_role.py`.
- [ ] Confirmation that `SUPABASE_READONLY_DB_URL` is configured in GitHub secrets.

---

## GATE G1d: Execute Migration 006 (Findings Provenance & Safe Backfill)

### Context
Migration 006 adds additive provenance columns (`analysis_model`, `is_fallback`, `analysis_source`) to `findings` and provides safe, count-first labeling of historical fallback template rows.

### Step-by-Step Instructions
1. Open Supabase Dashboard -> **SQL Editor**.
2. **Execute Migration 006 Structure**:
```sql
ALTER TABLE public.findings 
    ADD COLUMN IF NOT EXISTS analysis_model text,
    ADD COLUMN IF NOT EXISTS is_fallback boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS analysis_source text;

CREATE INDEX IF NOT EXISTS idx_findings_tenant_analysis_provenance 
    ON public.findings (tenant_id, created_at DESC, analysis_source);
```

4. **Backfill Step 1: Count Candidate Synthetic Fallback Rows**:
```sql
SELECT count(*) AS candidate_fallback_count
FROM public.findings
WHERE (
       why_it_matters LIKE 'The source documents that % has engaged in strategic M&A activity%'
    OR why_it_matters LIKE 'The source documents that % secured significant financing%'
    OR why_it_matters LIKE 'The source verifies regulatory and legal proceedings involving%'
    OR why_it_matters LIKE 'The source confirms that % achieved industry analyst recognition in the Gartner Market Overview%'
    OR why_it_matters LIKE 'The source announces product advancements from%'
    OR why_it_matters LIKE 'The source confirms executive leadership additions at%'
    OR why_it_matters LIKE 'The source documents that % This reflects active commercial positioning and operational momentum for %'
    OR why_it_matters LIKE 'The source documents that % announced updates regarding %, representing ongoing product and operational activity in the sector.'
)
AND analysis_source IS NULL;
```

5. **Backfill Step 2: Label Synthetic Fallback Rows**:
```sql
UPDATE public.findings
SET analysis_source = 'synthetic_fallback',
    is_fallback = true
WHERE (
       why_it_matters LIKE 'The source documents that % has engaged in strategic M&A activity%'
    OR why_it_matters LIKE 'The source documents that % secured significant financing%'
    OR why_it_matters LIKE 'The source verifies regulatory and legal proceedings involving%'
    OR why_it_matters LIKE 'The source confirms that % achieved industry analyst recognition in the Gartner Market Overview%'
    OR why_it_matters LIKE 'The source announces product advancements from%'
    OR why_it_matters LIKE 'The source confirms executive leadership additions at%'
    OR why_it_matters LIKE 'The source documents that % This reflects active commercial positioning and operational momentum for %'
    OR why_it_matters LIKE 'The source documents that % announced updates regarding %, representing ongoing product and operational activity in the sector.'
)
AND analysis_source IS NULL;
```

*Optional Step 2 Undo Query (if testing backfill):*
```sql
UPDATE public.findings 
SET analysis_source = NULL, is_fallback = false 
WHERE analysis_source = 'synthetic_fallback';
```

6. **Backfill Step 2b: Label Historical Deterministic Hiring Findings**:
```sql
UPDATE public.findings
SET analysis_source = 'deterministic_hiring',
    is_fallback = false
WHERE why_it_matters LIKE 'Routine operational hiring for %'
  AND analysis_source IS NULL;
```

7. **Backfill Step 3 (Optional): Label Remaining Historical Findings as LLM**:
```sql
-- Optional step: Run only if you choose to mark remaining historical rows as genuine LLM analyses
UPDATE public.findings
SET analysis_source = 'llm',
    is_fallback = false
WHERE analysis_source IS NULL;
```

### Verification SQL
```sql
-- 1. Verify scheduled_tenants exists and contains verified owner row
SELECT tenant_id, is_scheduled, created_at FROM public.scheduled_tenants;

-- 2. Verify findings provenance breakdown
SELECT analysis_source, is_fallback, count(*)
FROM public.findings
GROUP BY analysis_source, is_fallback;
```

### Rollback (if G1c fails)
```sql
DROP TABLE IF EXISTS public.scheduled_tenants CASCADE;
DROP INDEX IF EXISTS public.idx_findings_tenant_analysis_provenance;
ALTER TABLE public.findings 
    DROP COLUMN IF EXISTS analysis_model,
    DROP COLUMN IF EXISTS is_fallback,
    DROP COLUMN IF EXISTS analysis_source;
```

### Paste This Back for Gate G1c:
- [ ] Output of `SELECT tenant_id, is_scheduled FROM public.scheduled_tenants;`.
- [ ] Count of rows from Backfill Step 1.
- [ ] Output of `GROUP BY analysis_source, is_fallback` verification query.

---

## PRE-PUSH REPOSITORY AUDIT CHECKLIST

Before pushing `fix/scheduler-reliability` to GitHub, run the following verification checks:
```bash
# 1. Confirm zero scratch or evidence files are tracked in git
git ls-files scratch | head

# 2. Inspect git diff stat to ensure only authorized changes are staged
git diff --stat main...HEAD

# 3. Confirm .gitignore contains scratch/evidence/ and *.patch
git check-ignore scratch/evidence/sample.txt branch.patch
```
Ensure zero emails, raw connection strings, personal API keys, or tenant IDs appear in git tracking.

---

## GATE G2: Push Branch & Dispatch Dry-Run FROM THE BRANCH

### Context
Verify the full end-to-end GitHub Actions pipeline with `scope=owner` and `dry_run=true`.
Because `workflow_dispatch` is already present on `main`, you can test changes directly from the branch before merging!
**Merge to `main` ONLY after the dry-run passes.**

Note on API Quotas: The dry-run simulation invokes live Groq LLM and Currents News APIs to verify model cascade connectivity and real extraction; it uses live API quota while executing zero database mutations and zero Slack posts.

### Step-by-Step Instructions
1. Push branch `fix/scheduler-reliability` to origin (the branch contains zero secrets and passes all CI security checks):
   ```bash
   git push origin fix/scheduler-reliability
   ```
2. Go to GitHub -> **Actions** -> **Daily Pipeline**.
3. Click **Run workflow**:
   - In **Use workflow from**, select: **`fix/scheduler-reliability`**
   - `scope`: `owner`
   - `dry_run`: `true`
4. Wait for the workflow run to complete.

### Pass Criteria
- Workflow status: **SUCCESS** (Green).
- Duration: **< 35 minutes total** (Per-phase timing counters are emitted directly in the GitHub Step Summary).
- Zero database writes (all write functions bypassed).
- Slack delivery simulated (zero messages posted).
- Note: The first live owner run (Gate G3) may reach the 38-minute cutoff if processing a substantial accumulated backlog; this is designed and expected behavior.

### Paste This Back for Gate G2:
- [ ] Workflow Run ID.
- [ ] Run conclusion and duration.
- [ ] Content of the GitHub Step Summary JSON emitted at the end of the run.
- [ ] Pipeline log output showing `[DRY_RUN] Read-only simulation active; skipping DB writes and Slack delivery.`

---

## RENDER PRE-MERGE CHECKLIST & API IMPACT AUDIT

Before merging branch `fix/scheduler-reliability` into `main`, verify the following Render deployment configuration:

### 1. Environment Variable Audit (Names Only)
Verify in **Render Dashboard** -> **Environment**:
| Variable Name | Required Value / Source | Purpose |
| :--- | :--- | :--- |
| `SUPABASE_DB_URL` | Set out-of-band in Render Dashboard | Production write connection string (Transaction pooler) |
| `ALLOW_LIVE_WRITE` | Must be set to `"true"` | Authorizes API endpoints and workers to write to PostgreSQL |
| `RENDER` | Auto-set by Render runtime (`RENDER=true`) | Platform isolation check (verifies execution in Render container) |
| `OWNER_TENANT_ID` | `c8f13b91-46ef-4682-9975-f85764d8a12e` | Verified owner tenant identifier |

> [!WARNING]
> **OWNER_TENANT_ID DISCREPANCY AUDIT**:
> In `render.yaml`, `OWNER_TENANT_ID` was historically set to `8553449a-c998-4727-be01-9aeb724038cb`, whereas the nightly pipeline workflow uses verified owner `c8f13b91-46ef-4682-9975-f85764d8a12e`.
> In the Render API process, `OWNER_TENANT_ID` is accessed by:
> - `backend/src/api.py:428` (`auth_login` owner email login fallback)
> - `backend/src/storage.py:765, 812, 858, 934, 1606, 1689, 1960, 2781` (fallback tenant scope for briefs, findings, discovery sources, and radar evaluations)
> If Render retains `8553449a...`, owner login in the web UI will access a different tenant space than the nightly scheduler. Update `OWNER_TENANT_ID` to `c8f13b91-46ef-4682-9975-f85764d8a12e` in the Render Dashboard.

### 2. AST-Generated API Endpoints Write Guard Impact Table
Mechanically parsed from `backend/src/api.py` via `scratch/evidence/storage_write_inventory.py`:
| Method & Endpoint Path | Storage Write Functions Called | Target Tables Written | Post-Merge Behavior if `ALLOW_LIVE_WRITE` Missing |
| :--- | :--- | :--- | :--- |
| `POST /workspace/watchlist/add` | `track_tenant_company` | `tenant_tracked_companies`, `companies` | **BLOCKED** with `PermissionError` (fail closed) |
| `DELETE /workspace/watchlist/{company_name}` | `untrack_tenant_company` | `tenant_tracked_companies` | **BLOCKED** with `PermissionError` (fail closed) |
| `POST /api/onboarding/confirm` | `save_tenant_confirmed_companies` | `tenant_tracked_companies`, `companies`, `discovery_candidates` | **BLOCKED** with `PermissionError` (fail closed) |
| `POST /workspace/delivery` | `save_tenant_delivery_config` | `tenant_delivery_configs` | **BLOCKED** with `PermissionError` (fail closed) |
| `POST /research-radar/topics` | `save_tenant_research_topic` | `tenant_research_topics` | **BLOCKED** with `PermissionError` (fail closed) |
| `PATCH /research-radar/topics/{topic_id}` | `update_tenant_research_topic_status` | `tenant_research_topics` | **BLOCKED** with `PermissionError` (fail closed) |
| `DELETE /research-radar/topics/{topic_id}` | `delete_tenant_research_topic` | `tenant_research_topics` | **BLOCKED** with `PermissionError` (fail closed) |
| `POST /api/pipeline/trigger` | `get_active_or_latest_run_progress` | `pipeline_run_progress` (stale run reaping) | Read allowed; reaping skipped |
| `All GET Endpoints (/briefs, /findings, etc.)` | `None (Read-Only)` | `None` | **PERMITTED** (Read path separated; never blocked by write guard) |

### 3. Production Merge & Revert Plan
- **Merge Order**:
  1. Dispatch Gate G2 dry-run from branch `fix/scheduler-reliability`.
  2. Dispatch Gate G3 live owner run from branch `fix/scheduler-reliability`.
  3. Confirm Render checklist is verified.
  4. Merge PR `fix/scheduler-reliability` to `main`.
- **Revert Plan**: If Render deployment reports write errors after merge:
  1. Inspect Render logs for: `Live PostgreSQL write access not authorized`.
  2. If missing, immediately add `ALLOW_LIVE_WRITE="true"` in Render Environment and save.
  3. If unrecoverable, execute git revert:
     ```bash
     git checkout main
     git pull origin main
     git revert -m 1 <MERGE_COMMIT_SHA>
     git push origin main
     ```
     Render will auto-deploy the reverted clean commit.

---

## GATE G3: Dispatch Live Owner Run (Repairs Stub Brief)

### Context
Executes a live production run for the owner (`scope=owner`, `dry_run=false`) **FROM THE BRANCH**.
This processes the owner end-to-end, writes genuine LLM findings with model metadata, generates a full intelligence brief, repairs the local stub brief, and delivers the brief to Slack.

### Step-by-Step Instructions
1. Go to GitHub -> **Actions** -> **Daily Pipeline**.
2. Click **Run workflow**:
   - `Use workflow from`: **`fix/scheduler-reliability`**
   - `scope`: `owner`
   - `dry_run`: `false`
3. Wait for the run to complete.

### Verification SQL
```sql
-- Verify Owner brief has been updated with genuine content and new hash
SELECT id, tenant_id, published_at, length(content), content_hash, SUBSTRING(content FROM 1 FOR 300)
FROM public.briefs
WHERE tenant_id = 'c8f13b91-46ef-4682-9975-f85764d8a12e' AND id = 'data_latest';

-- Verify findings written in this run have analysis_model populated and no fallback templates
SELECT id, company_name, analysis_model, is_fallback, analysis_source, created_at, why_it_matters
FROM public.findings
WHERE tenant_id = 'c8f13b91-46ef-4682-9975-f85764d8a12e'
ORDER BY created_at DESC
LIMIT 10;
```

### Paste This Back for Gate G3:
- [ ] Workflow Run ID and duration.
- [ ] Output of the Verification SQL above.
- [ ] Confirmation of Slack digest receipt in the owner channel.

---

## GATE G4: Enable Schedule & Collect 3-Night Proof

### Context
Nightly scheduled runs continue on the existing schedule (`0 0 * * *` UTC) in `.github/workflows/daily-pipeline.yml`.
Collect run evidence across 3 consecutive scheduled runs to achieve Phase E PASS.

### Step-by-Step Instructions
1. Maintain existing cron schedule in `.github/workflows/daily-pipeline.yml`:
```yaml
on:
  schedule:
    - cron: "0 0 * * *"
```
2. Monitor nightly runs for Night 1, Night 2, and Night 3.
3. For each night, record:
   - Run ID, start time, end time, duration (< 35 min required).
   - Phase 1 duration (< 15 min required).
   - Verification that owner brief and findings updated.
   - Slack delivery confirmation.

### Paste This Back for Gate G4:
- [ ] Run IDs, durations, and Step Summary JSON for the 3 consecutive nights.
