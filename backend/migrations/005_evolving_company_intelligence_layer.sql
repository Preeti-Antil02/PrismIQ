-- ============================================================================
-- Migration 005: Evolving Company Intelligence Layer (RLS-enforced)
-- Foundation: Continuously evolving competitor profiles + Historical change ledger
-- ============================================================================

-- 1. Company Profiles Table (Per-Tenant / Shared Evolving State)
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    summary TEXT,
    products JSONB NOT NULL DEFAULT '[]'::jsonb,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    pricing_model JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_market TEXT,
    customers JSONB NOT NULL DEFAULT '[]'::jsonb,
    funding JSONB NOT NULL DEFAULT '{}'::jsonb,
    hiring JSONB NOT NULL DEFAULT '{}'::jsonb,
    partnerships JSONB NOT NULL DEFAULT '[]'::jsonb,
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    strategic_narrative TEXT,
    confidence VARCHAR(20) NOT NULL DEFAULT 'High',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_profile_tenant UNIQUE (tenant_id, company_name)
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_tenant ON company_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_company ON company_profiles(company_name);

-- 2. Company Changes Ledger Table (What changed? When? Evidence? How significant?)
CREATE TABLE IF NOT EXISTS company_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    dimension VARCHAR(50) NOT NULL, -- 'pricing', 'products', 'features', 'hiring', 'partnerships', 'target_market'
    what_changed TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    when_detected TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evidence_url TEXT,
    evidence_title TEXT,
    evidence_excerpt TEXT,
    significance VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
    strategic_implication TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_changes_tenant ON company_changes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_changes_company ON company_changes(company_name);
CREATE INDEX IF NOT EXISTS idx_company_changes_dimension ON company_changes(dimension);
CREATE INDEX IF NOT EXISTS idx_company_changes_when ON company_changes(when_detected DESC);
CREATE INDEX IF NOT EXISTS idx_company_changes_significance ON company_changes(significance);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON company_profiles;
CREATE POLICY tenant_isolation_all ON company_profiles FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON company_changes;
CREATE POLICY tenant_isolation_all ON company_changes FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));
