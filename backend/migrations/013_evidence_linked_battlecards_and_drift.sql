-- ============================================================================
-- Migration 013: Evidence-Linked Competitive Battlecards & Battlecard Drift Detection
-- Part of PrismIQ Batch 1
--
-- Adds:
-- 1. intelligence_claims: Structured reusable competitor claims with Fact->Impact->Act
-- 2. claim_evidence: Claim-to-evidence relationships (supports/contradicts/contextualizes)
-- 3. battlecards: Audience-specific competitor battlecards (sales/product/marketing/executive)
-- 4. battlecard_blocks: Structured sections linked to reusable claims
-- 5. battlecard_revisions: Immutable published version history
-- 6. claim_drift_alerts: Detection of new evidence, contradictions, and staleness
-- 7. claim_review_actions: Complete audit trail of analyst approvals, edits, dismissals
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. Intelligence Claims Table
-- Reusable atomic competitor intelligence claims with Fact -> Impact -> Act
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intelligence_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    claim_type VARCHAR(100) NOT NULL, -- 'positioning', 'product_icp', 'where_they_win', 'where_we_win', 'strengths_weaknesses', 'objections_responses', 'discovery_questions', 'pricing_comparison', 'proof_points', 'recent_changes'
    subject VARCHAR(255) NOT NULL,
    statement TEXT NOT NULL,
    fact_impact_act JSONB NOT NULL DEFAULT '{"fact": "", "impact": "", "act": ""}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'verified', 'disputed', 'outdated', 'archived'
    confidence VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
    verification_status VARCHAR(50) NOT NULL DEFAULT 'verified', -- 'verified', 'unverified', 'unknown'
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_tenant_company ON intelligence_claims(tenant_id, company_name);
CREATE INDEX IF NOT EXISTS idx_claims_claim_type ON intelligence_claims(claim_type);
CREATE INDEX IF NOT EXISTS idx_claims_status ON intelligence_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_verification ON intelligence_claims(verification_status);
CREATE INDEX IF NOT EXISTS idx_claims_verified_at ON intelligence_claims(last_verified_at DESC);

-- -----------------------------------------------------------------------
-- 2. Claim Evidence Table
-- M:N association linking claims to events, signals, URLs, and excerpts
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claim_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES intelligence_claims(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id VARCHAR(64) REFERENCES consolidated_events(event_id) ON DELETE SET NULL,
    signal_id VARCHAR(64) REFERENCES raw_signals(id) ON DELETE SET NULL,
    source_url TEXT NOT NULL,
    source_title TEXT,
    excerpt TEXT NOT NULL,
    publication_date VARCHAR(100),
    relationship VARCHAR(50) NOT NULL DEFAULT 'supports', -- 'supports', 'contradicts', 'contextualizes'
    source_quality VARCHAR(50) NOT NULL DEFAULT 'primary', -- 'primary', 'secondary', 'unverified'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim ON claim_evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_tenant ON claim_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_event ON claim_evidence(event_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_relationship ON claim_evidence(relationship);

-- -----------------------------------------------------------------------
-- 3. Battlecards Table
-- Competitor battlecard records scoped by tenant, audience, and segment
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS battlecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    audience VARCHAR(50) NOT NULL DEFAULT 'sales', -- 'sales', 'product', 'marketing', 'executive'
    segment VARCHAR(100) NOT NULL DEFAULT 'general', -- 'general', 'enterprise', 'mid-market', 'smb'
    owner_id VARCHAR(255) DEFAULT 'analyst',
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived'
    current_version INTEGER NOT NULL DEFAULT 1,
    published_version INTEGER,
    published_at TIMESTAMPTZ,
    freshness_score NUMERIC(5, 2) DEFAULT 100.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_battlecard_tenant_comp_aud_seg UNIQUE (tenant_id, company_name, audience, segment)
);

CREATE INDEX IF NOT EXISTS idx_battlecards_tenant_company ON battlecards(tenant_id, company_name);
CREATE INDEX IF NOT EXISTS idx_battlecards_status ON battlecards(status);
CREATE INDEX IF NOT EXISTS idx_battlecards_audience ON battlecards(audience);

-- -----------------------------------------------------------------------
-- 4. Battlecard Blocks Table
-- Structured sections of a battlecard linked to reusable claims
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS battlecard_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battlecard_id UUID NOT NULL REFERENCES battlecards(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    block_key VARCHAR(100) NOT NULL, -- 'snapshot_positioning', 'product_icp', 'where_they_win', 'where_we_win', 'strengths_weaknesses', 'objections_responses', 'discovery_questions', 'pricing_comparison', 'proof_points', 'recent_changes'
    block_title VARCHAR(255) NOT NULL,
    block_order INTEGER NOT NULL DEFAULT 0,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    claim_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_battlecard_block UNIQUE (battlecard_id, block_key)
);

CREATE INDEX IF NOT EXISTS idx_battlecard_blocks_card ON battlecard_blocks(battlecard_id);
CREATE INDEX IF NOT EXISTS idx_battlecard_blocks_tenant ON battlecard_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_battlecard_blocks_key ON battlecard_blocks(block_key);

-- -----------------------------------------------------------------------
-- 5. Battlecard Revisions Table
-- Immutable frozen published version history
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS battlecard_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battlecard_id UUID NOT NULL REFERENCES battlecards(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL, -- Full frozen serialized tree of battlecard, blocks, claims, and evidence
    change_summary TEXT,
    published_by VARCHAR(255) NOT NULL DEFAULT 'analyst',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_battlecard_revision UNIQUE (battlecard_id, version)
);

CREATE INDEX IF NOT EXISTS idx_battlecard_revisions_card_ver ON battlecard_revisions(battlecard_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_battlecard_revisions_tenant ON battlecard_revisions(tenant_id);

-- -----------------------------------------------------------------------
-- 6. Claim Drift Alerts Table
-- Drift detection when incoming findings/events impact existing claims
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claim_drift_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES intelligence_claims(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    drift_type VARCHAR(50) NOT NULL, -- 'stable', 'new_evidence', 'contradicted', 'stale'
    trigger_event_id VARCHAR(64) REFERENCES consolidated_events(event_id) ON DELETE SET NULL,
    new_evidence_excerpt TEXT,
    new_evidence_url TEXT,
    suggested_update JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'edited', 'dismissed', 'marked_incorrect'
    review_decision_notes TEXT,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    deduplication_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_drift_alert_dedup UNIQUE (tenant_id, deduplication_key)
);

CREATE INDEX IF NOT EXISTS idx_drift_alerts_tenant_comp ON claim_drift_alerts(tenant_id, company_name);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_claim ON claim_drift_alerts(claim_id);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_status ON claim_drift_alerts(review_status);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_type ON claim_drift_alerts(drift_type);

-- -----------------------------------------------------------------------
-- 7. Claim Review Actions Table
-- Audit history of human reviews, decisions, edits, and approvals
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claim_review_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drift_alert_id UUID NOT NULL REFERENCES claim_drift_alerts(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES intelligence_claims(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'accept', 'edit_and_accept', 'dismiss', 'mark_incorrect'
    prior_claim_state JSONB NOT NULL,
    updated_claim_state JSONB,
    notes TEXT,
    reviewer VARCHAR(255) NOT NULL DEFAULT 'analyst',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_reviews_tenant ON claim_review_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claim_reviews_alert ON claim_review_actions(drift_alert_id);
CREATE INDEX IF NOT EXISTS idx_claim_reviews_claim ON claim_review_actions(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_reviews_created ON claim_review_actions(created_at DESC);

-- ============================================================================
-- 8. Row Level Security (RLS) Policies
-- Enforce tenant-level data isolation on all 7 tables
-- ============================================================================
ALTER TABLE intelligence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE battlecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE battlecard_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE battlecard_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_review_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON intelligence_claims;
CREATE POLICY tenant_isolation_all ON intelligence_claims FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON claim_evidence;
CREATE POLICY tenant_isolation_all ON claim_evidence FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON battlecards;
CREATE POLICY tenant_isolation_all ON battlecards FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON battlecard_blocks;
CREATE POLICY tenant_isolation_all ON battlecard_blocks FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON battlecard_revisions;
CREATE POLICY tenant_isolation_all ON battlecard_revisions FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON claim_drift_alerts;
CREATE POLICY tenant_isolation_all ON claim_drift_alerts FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON claim_review_actions;
CREATE POLICY tenant_isolation_all ON claim_review_actions FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));
