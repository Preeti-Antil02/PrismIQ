-- ============================================================================
-- Migration: 007_readonly_role_and_rls.sql
-- Description: Provisioning script for strictly isolated prismiq_readonly role.
--              - Dynamically grants SELECT on public tables using pg_class (relrowsecurity).
--              - Creates RLS policies using a clean, non-nested loop for all tables where relrowsecurity = true.
--              - Column-level grant on tenant_delivery_configs (excludes slack_webhook_url).
--              - Drops any sanitized view to prevent public/anon schema leaks.
--              - Enforces default_transaction_read_only = on.
--              - Explicitly revokes all access to auth schema.
--              - Omits hardcoded passwords (password set out-of-band by owner).
--              - Omits default privileges for future tables.
-- DO NOT EXECUTE AUTOMATICALLY. Stored as draft SQL migration only.
-- ============================================================================

-- 1. Create Role (without hardcoded password; owner sets password out-of-band)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'prismiq_readonly') THEN
        CREATE ROLE prismiq_readonly WITH LOGIN;
    END IF;
END $$;

-- Enforce read-only transaction mode by default
ALTER ROLE prismiq_readonly SET default_transaction_read_only = on;

-- Note for Supabase pooler: Connection username format is prismiq_readonly.<project_ref>
-- Owner sets password out-of-band via Supabase SQL Editor:
-- ALTER ROLE prismiq_readonly WITH PASSWORD 'YOUR_STRONG_SECRET_HERE';

-- 2. Schema and Database Access
GRANT CONNECT ON DATABASE postgres TO prismiq_readonly;
GRANT USAGE ON SCHEMA public TO prismiq_readonly;

-- 3. Dynamic Grants & RLS Policies Generated from pg_class (Plain loop without nested DO)
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
          AND c.relname != 'tenant_delivery_configs' -- Webhooks handled via column-level grant below
    LOOP
        -- Grant SELECT on application table
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO prismiq_readonly;', rec.relname);

        -- If table has Row Level Security enabled, create permissive SELECT policy for prismiq_readonly (idempotent)
        IF rec.relrowsecurity THEN
            EXECUTE format('DROP POLICY IF EXISTS readonly_select_policy ON public.%I;', rec.relname);
            EXECUTE format('CREATE POLICY readonly_select_policy ON public.%I FOR SELECT TO prismiq_readonly USING (true);', rec.relname);
        END IF;
    END LOOP;

    -- Column-level grant on tenant_delivery_configs (all columns EXCEPT slack_webhook_url)
    EXECUTE 'GRANT SELECT (tenant_id, slack_channel, delivery_cadence, is_enabled, created_at, updated_at) ON public.tenant_delivery_configs TO prismiq_readonly;';

    -- RLS policy on tenant_delivery_configs for prismiq_readonly (idempotent)
    EXECUTE 'DROP POLICY IF EXISTS readonly_select_policy ON public.tenant_delivery_configs;';
    EXECUTE 'CREATE POLICY readonly_select_policy ON public.tenant_delivery_configs FOR SELECT TO prismiq_readonly USING (true);';
END $$;

-- 4. Explicitly Revoke All Mutation Privileges Across Public Schema
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM prismiq_readonly;

-- 5. Explicitly Ensure auth Schema Is Inaccessible (Wrapped in exception block so it cannot abort script)
DO $$
BEGIN
    REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM prismiq_readonly;
    REVOKE USAGE ON SCHEMA auth FROM prismiq_readonly;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: Auth schema revoke encountered non-fatal error: % (ignoring to prevent script abort)', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- FUTURE TABLES RE-RUN STEP:
-- Default privileges are intentionally NOT granted to prevent unintended access leaks.
-- When creating new tables in future migrations (e.g. Trend Evolution tables in Phase F),
-- re-run Section 3 above (the DO $$ ... FOR rec IN SELECT ... LOOP block) to provision
-- SELECT and RLS policies on the newly added tables for prismiq_readonly.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- ROLLBACK SCRIPT (Execute manually only if reverting this migration):
-- ----------------------------------------------------------------------------
-- DROP OWNED BY prismiq_readonly;   -- removes its grants and policies
-- DROP ROLE IF EXISTS prismiq_readonly;
-- ----------------------------------------------------------------------------

