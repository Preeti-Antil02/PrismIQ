-- ============================================================================
-- Migration 010: Point 3 Competitive Change Detection Engine Enhancements
-- Adds structured category, impact score, affected teams, related events,
-- verification status, and demonstration data flag.
-- ============================================================================

ALTER TABLE detected_high_impact_changes 
    ADD COLUMN IF NOT EXISTS event_category VARCHAR(100) DEFAULT 'Enterprise Strategy',
    ADD COLUMN IF NOT EXISTS event_description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS impact_score NUMERIC(5,2) DEFAULT 75.00,
    ADD COLUMN IF NOT EXISTS related_event_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS affected_business_teams JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'corroborated',
    ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN DEFAULT FALSE;

-- Performance indexes for category and impact score filtering
CREATE INDEX IF NOT EXISTS idx_high_impact_changes_category 
    ON detected_high_impact_changes (event_category);

CREATE INDEX IF NOT EXISTS idx_high_impact_changes_score 
    ON detected_high_impact_changes (impact_score DESC);
