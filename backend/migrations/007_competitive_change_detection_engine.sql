-- ============================================================================
-- Migration 007: Competitive Change Detection Engine (Point 3)
-- "Here are the 5 changes that actually matter"
-- ============================================================================

CREATE TABLE IF NOT EXISTS detected_high_impact_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    headline VARCHAR(500) NOT NULL,
    significance_tier VARCHAR(50) NOT NULL DEFAULT 'HIGH IMPACT',
    confidence NUMERIC(5,2) NOT NULL DEFAULT 90.00,
    potential_impact VARCHAR(50) NOT NULL DEFAULT 'High',
    window_days INTEGER NOT NULL DEFAULT 14,
    strategic_interpretation TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    corroborating_signals_count INTEGER NOT NULL DEFAULT 3,
    signals_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE detected_high_impact_changes ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policy
CREATE POLICY tenant_isolation_all ON detected_high_impact_changes
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid()))
    WITH CHECK (tenant_id = (SELECT auth.uid()));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_high_impact_changes_tenant_company 
    ON detected_high_impact_changes (tenant_id, company_name);

CREATE INDEX IF NOT EXISTS idx_high_impact_changes_detected_at 
    ON detected_high_impact_changes (detected_at DESC);
