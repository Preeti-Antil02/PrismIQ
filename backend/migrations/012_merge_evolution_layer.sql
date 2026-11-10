-- ============================================================================
-- Migration 012: Merge Evolution Layer (Points 1, 2 & 3 Unified)
-- Absorbs Point 3 (detected_high_impact_changes) fields into company_changes,
-- links change records to competitive_sequences arcs (Point 2),
-- and creates backward-compatible SQL views so existing API endpoints
-- continue to work without modification.
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. Extend company_changes to absorb Point 3 fields
-- -----------------------------------------------------------------------
ALTER TABLE company_changes
    ADD COLUMN IF NOT EXISTS impact_score                NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    ADD COLUMN IF NOT EXISTS significance_tier           VARCHAR(30)  NOT NULL DEFAULT 'MEDIUM IMPACT',
    ADD COLUMN IF NOT EXISTS window_days                 INTEGER      NOT NULL DEFAULT 14,
    ADD COLUMN IF NOT EXISTS corroborating_signals_count INTEGER      NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS signals_evidence            JSONB        NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS recommended_action          TEXT,
    ADD COLUMN IF NOT EXISTS event_category              VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sequence_arc_id             UUID
        REFERENCES competitive_sequences(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------
-- 2. Performance indexes for the new fields
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_company_changes_impact_score
    ON company_changes(impact_score DESC);

CREATE INDEX IF NOT EXISTS idx_company_changes_sig_tier
    ON company_changes(significance_tier);

CREATE INDEX IF NOT EXISTS idx_company_changes_seq_arc
    ON company_changes(sequence_arc_id)
    WHERE sequence_arc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_changes_event_cat
    ON company_changes(event_category);

-- -----------------------------------------------------------------------
-- 3. Migrate existing detected_high_impact_changes rows into company_changes
--    (idempotent – rows already migrated are skipped via the WHERE NOT EXISTS)
-- -----------------------------------------------------------------------
INSERT INTO company_changes (
    tenant_id,
    company_name,
    dimension,
    what_changed,
    significance,
    impact_score,
    significance_tier,
    window_days,
    corroborating_signals_count,
    signals_evidence,
    strategic_implication,
    recommended_action,
    event_category,
    when_detected,
    created_at
)
SELECT
    d.tenant_id,
    d.company_name,
    COALESCE(d.event_category, 'Product Pivot')        AS dimension,
    d.headline                                          AS what_changed,
    d.potential_impact                                  AS significance,
    COALESCE(d.impact_score, 80.0)                     AS impact_score,
    d.significance_tier,
    d.window_days,
    d.corroborating_signals_count,
    d.signals_evidence,
    d.strategic_interpretation                          AS strategic_implication,
    d.recommended_action,
    d.event_category,
    d.detected_at                                       AS when_detected,
    d.created_at
FROM detected_high_impact_changes d
WHERE NOT EXISTS (
    SELECT 1 FROM company_changes cc
    WHERE cc.tenant_id    = d.tenant_id
      AND cc.company_name = d.company_name
      AND cc.what_changed = d.headline
      AND ABS(EXTRACT(EPOCH FROM (cc.when_detected - d.detected_at))) < 60
);

-- -----------------------------------------------------------------------
-- 4. Backward-compatible VIEW: v_high_impact_changes
--    Point 3 callers can query this view instead of the old table.
-- -----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_high_impact_changes AS
SELECT
    id,
    tenant_id,
    company_name,
    dimension           AS event_category,
    what_changed        AS headline,
    significance        AS potential_impact,
    impact_score,
    significance_tier,
    window_days,
    corroborating_signals_count,
    signals_evidence,
    strategic_implication,
    recommended_action  AS recommended_action,
    evidence_url,
    when_detected       AS detected_at,
    created_at
FROM company_changes
WHERE impact_score >= 70.0
   OR significance_tier IN ('CRITICAL INFLECTION', 'HIGH IMPACT')
   OR significance = 'High'
ORDER BY when_detected DESC;

-- -----------------------------------------------------------------------
-- 5. Backward-compatible VIEW: v_sequence_change_steps
--    Links competitive_sequences arcs to their member company_changes rows.
-- -----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_sequence_change_steps AS
SELECT
    cs.id                    AS sequence_id,
    cs.company_name,
    cs.pattern_name,
    cs.pattern_type,
    cs.time_horizon,
    cs.confidence,
    cs.potential_impact,
    cs.strategic_interpretation,
    cs.recommended_action,
    cc.id                    AS change_id,
    cc.what_changed,
    cc.dimension,
    cc.when_detected,
    cc.evidence_url,
    cc.significance,
    cc.impact_score
FROM competitive_sequences cs
LEFT JOIN company_changes cc
    ON  cc.company_name    = cs.company_name
    AND cc.sequence_arc_id = cs.id;

-- -----------------------------------------------------------------------
-- NOTE: detected_high_impact_changes and competitive_sequences tables are
-- intentionally kept intact for backward compatibility. They are now
-- treated as legacy/cache mirrors of the unified company_changes ledger.
-- -----------------------------------------------------------------------
