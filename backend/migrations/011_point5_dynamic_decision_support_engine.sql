-- ============================================================================
-- Migration 011: Point 5 Dynamic Competitive Impact & Counter-Action Intelligence Engine
-- Transforms static decision support templates into dynamic, company-specific
-- impact detection, multi-source evidence grounding, interactive persistent
-- counter-action management, and authentic response deadline tracking.
-- ============================================================================

-- 1. Enrich decision_support_items with dynamic impact, routing, checklist and deadline fields
ALTER TABLE decision_support_items
    ADD COLUMN IF NOT EXISTS impact_category VARCHAR(100) DEFAULT 'Product Capability Threat',
    ADD COLUMN IF NOT EXISTS target_company VARCHAR(255) DEFAULT 'Our Company',
    ADD COLUMN IF NOT EXISTS time_horizon VARCHAR(50) DEFAULT 'Immediate (<7d)',
    ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS response_deadline_label VARCHAR(150) DEFAULT 'No fixed response deadline established',
    ADD COLUMN IF NOT EXISTS action_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS confidence_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS department_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS execution_progress JSONB NOT NULL DEFAULT '{"total": 0, "accepted": 0, "in_progress": 0, "completed": 0, "dismissed": 0, "percent_complete": 0}'::jsonb,
    ADD COLUMN IF NOT EXISTS insufficient_evidence BOOLEAN DEFAULT FALSE;

-- 2. Performance indexes for impact category, target company, and deadlines
CREATE INDEX IF NOT EXISTS idx_decision_support_impact_category
    ON decision_support_items (impact_category);

CREATE INDEX IF NOT EXISTS idx_decision_support_target_company
    ON decision_support_items (tenant_id, target_company);

CREATE INDEX IF NOT EXISTS idx_decision_support_deadline
    ON decision_support_items (deadline_at ASC NULLS LAST);

-- 3. Dedicated action execution audit log table
CREATE TABLE IF NOT EXISTS decision_support_action_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    decision_item_id VARCHAR(255) NOT NULL,
    action_id VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    previous_status VARCHAR(50) DEFAULT 'Pending',
    new_status VARCHAR(50) NOT NULL,
    notes TEXT,
    updated_by VARCHAR(255) DEFAULT 'analyst',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE decision_support_action_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_history_all ON decision_support_action_history;
CREATE POLICY tenant_isolation_history_all ON decision_support_action_history FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ds_action_history_tenant_item
    ON decision_support_action_history (tenant_id, decision_item_id, action_id);

CREATE INDEX IF NOT EXISTS idx_ds_action_history_created
    ON decision_support_action_history (created_at DESC);
