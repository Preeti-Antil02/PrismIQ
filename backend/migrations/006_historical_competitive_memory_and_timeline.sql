-- ============================================================================
-- Migration 006: Historical Competitive Memory & Timeline Sequence Detection
-- Section 2: Multi-month sequence detection (Hiring -> SOC2 -> Pricing -> Case Study -> Expansion)
-- ============================================================================

-- 1. Competitive Sequences & Pattern Detection Table
CREATE TABLE IF NOT EXISTS competitive_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    pattern_name VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(100) NOT NULL, -- 'enterprise_expansion', 'ai_pivot', 'pricing_shift', 'ecosystem_lockin', 'infrastructure_scaling'
    time_horizon VARCHAR(100) NOT NULL, -- e.g. '6 months (Jan 2026 - Jun 2026)'
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 91.0,
    potential_impact VARCHAR(20) NOT NULL DEFAULT 'High', -- 'High', 'Medium', 'Low'
    strategic_interpretation TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    sequence_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_sequences_tenant ON competitive_sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_sequences_company ON competitive_sequences(company_name);
CREATE INDEX IF NOT EXISTS idx_comp_sequences_type ON competitive_sequences(pattern_type);
CREATE INDEX IF NOT EXISTS idx_comp_sequences_created ON competitive_sequences(created_at DESC);

-- 2. Row Level Security (RLS) Policy
ALTER TABLE competitive_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON competitive_sequences;
CREATE POLICY tenant_isolation_all ON competitive_sequences FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));
