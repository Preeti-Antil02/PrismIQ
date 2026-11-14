-- ============================================================================
-- Migration 008: Signal Correlation Engine & Strategic Implication Pipeline (Point 4)
-- "Raw Signals -> Canonical Events -> Patterns -> Insights -> Actions"
-- ============================================================================

CREATE TABLE IF NOT EXISTS signal_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    pattern_name VARCHAR(255) NOT NULL,
    correlation_category VARCHAR(100) NOT NULL DEFAULT 'ai_investment',
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 92.00,
    strategic_implication TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'Insights',
    signals_cluster JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_signal_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_signal_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE signal_correlations ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policy
CREATE POLICY tenant_isolation_all ON signal_correlations
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid()))
    WITH CHECK (tenant_id = (SELECT auth.uid()));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_signal_correlations_tenant_company 
    ON signal_correlations (tenant_id, company_name);

CREATE INDEX IF NOT EXISTS idx_signal_correlations_created 
    ON signal_correlations (created_at DESC);
