-- ============================================================================
-- Migration 009: "Why Should I Care?" Decision Support System (Point 5)
-- Every development answers:
-- 1. What happened?
-- 2. Why does it matter?
-- 3. Who is affected? (Product + Sales + Marketing)
-- 4. What should we do?
-- 5. Urgency (High / Medium / Low) + Confidence
-- 6. Evidence (3+ independent sources)
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_support_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    event_id VARCHAR(255),
    what_happened TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    who_is_affected TEXT[] NOT NULL DEFAULT '{}',
    what_should_we_do TEXT NOT NULL,
    urgency VARCHAR(50) NOT NULL DEFAULT 'High',
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 89.00,
    corroboration_sources_count INTEGER NOT NULL DEFAULT 3,
    evidence_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE decision_support_items ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policy
CREATE POLICY tenant_isolation_all ON decision_support_items
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid()))
    WITH CHECK (tenant_id = (SELECT auth.uid()));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_decision_support_tenant_company 
    ON decision_support_items (tenant_id, company_name);

CREATE INDEX IF NOT EXISTS idx_decision_support_urgency_created 
    ON decision_support_items (urgency, created_at DESC);
