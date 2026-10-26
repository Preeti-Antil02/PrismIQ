-- ============================================================================
-- Migration: 005_scheduled_tenants.sql
-- Description: Tenant scheduling isolation table. Restricts scheduled runner
--              execution strictly to verified, opted-in production tenants.
-- DO NOT EXECUTE AUTOMATICALLY. Stored as draft SQL migration only.
-- ============================================================================

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

-- Note: All permissions and policies for the prismiq_readonly role are provisioned
-- exclusively in migration 007_readonly_role_and_rls.sql to maintain strict dependency order.
-- Note: FORCE ROW LEVEL SECURITY is explicitly omitted to avoid locking out standard service connections.

-- ----------------------------------------------------------------------------
-- [OWNER TO CONFIRM]: Seed verified owner tenant for autonomous scheduled runs
-- ----------------------------------------------------------------------------
-- INSERT INTO public.scheduled_tenants (tenant_id, is_scheduled)
-- VALUES ('c8f13b91-46ef-4682-9975-f85764d8a12e', true)
-- ON CONFLICT (tenant_id) DO UPDATE SET is_scheduled = EXCLUDED.is_scheduled, updated_at = now();

-- ----------------------------------------------------------------------------
-- ROLLBACK SCRIPT:
-- DROP TABLE IF EXISTS public.scheduled_tenants CASCADE;
-- ----------------------------------------------------------------------------
