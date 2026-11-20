-- ============================================================================
-- Migration 014: Customer Voice, Win/Loss, Sales Calls, Deal Intel & Next Best Action
-- Part of PrismIQ Batch 2
--
-- Adds:
-- 1. raw_documents: Tracked uploaded documents (CSV, PDF, DOCX, TXT) with SHA-256 deduplication
-- 2. customer_feedback_records: Atomic classified customer statements (8 categories)
-- 3. customer_feedback_themes: Aggregated recurring customer themes and competitive gap opportunities
-- 4. win_loss_deals: Won/Lost deal records with competitors, deal sizes, and close dates
-- 5. win_loss_factors: Atomic winning/losing decision factors linked to deals
-- 6. sales_call_records: Ingested sales call conversation transcripts and metadata
-- 7. sales_call_intelligence: Atomic signals extracted from transcripts (9 categories)
-- 8. deal_intelligence_dossiers: Synthesized deal-specific intelligence reports
-- 9. next_best_actions: Actionable recommendations across Sales, Product, Marketing, Leadership
-- 10. action_status_audits: Complete audit history of user actions and reviews
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. Raw Documents Table
-- Ingested files and text inputs with content hashing for deduplication
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- 'customer_review', 'crm_win_loss', 'sales_call_transcript', 'support_ticket', 'interview', 'notes'
    file_format VARCHAR(20) NOT NULL, -- 'csv', 'pdf', 'docx', 'txt', 'direct_input'
    filename VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 of normalized text
    raw_content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'processed', -- 'pending', 'processed', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_tenant_hash UNIQUE (tenant_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_raw_docs_tenant ON raw_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_raw_docs_source ON raw_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_raw_docs_created ON raw_documents(created_at DESC);

-- -----------------------------------------------------------------------
-- 2. Customer Feedback Records Table
-- Atomic customer statements classified across 8 canonical categories
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_feedback_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES raw_documents(id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    feedback_channel VARCHAR(50) NOT NULL DEFAULT 'customer_review', -- 'g2', 'reddit', 'support_ticket', 'interview', 'sales_call', 'survey'
    category VARCHAR(50) NOT NULL, -- 'love', 'dislike', 'feature_request', 'product_complaint', 'pricing_complaint', 'onboarding_issue', 'reason_for_switching', 'reason_for_choosing_competitor'
    sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral', -- 'positive', 'negative', 'neutral'
    raw_quote TEXT NOT NULL,
    aspect VARCHAR(100), -- Specific feature or topic (e.g. 'SSO', 'API Rate Limits', 'Pricing Transparency')
    customer_segment VARCHAR(100) DEFAULT 'general',
    publication_date VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_tenant_company ON customer_feedback_records(tenant_id, company_name);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON customer_feedback_records(category);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON customer_feedback_records(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_channel ON customer_feedback_records(feedback_channel);

-- -----------------------------------------------------------------------
-- 3. Customer Feedback Themes Table
-- Synthesized recurring feedback clusters with empirical sample sizes
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_feedback_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    theme_title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    sample_size INTEGER NOT NULL DEFAULT 1,
    sentiment_breakdown JSONB NOT NULL DEFAULT '{"positive": 0, "negative": 0, "neutral": 0}'::jsonb,
    representative_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_competitive_opportunity BOOLEAN NOT NULL DEFAULT FALSE, -- True when competitor has high complaints where we are strong
    confidence VARCHAR(20) NOT NULL DEFAULT 'Medium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_themes_tenant_comp ON customer_feedback_themes(tenant_id, company_name);
CREATE INDEX IF NOT EXISTS idx_feedback_themes_category ON customer_feedback_themes(category);
CREATE INDEX IF NOT EXISTS idx_feedback_themes_opportunity ON customer_feedback_themes(is_competitive_opportunity);

-- -----------------------------------------------------------------------
-- 4. Win/Loss Deals Table
-- Verified won/lost deal records with competitor mapping and deal values
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS win_loss_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES raw_documents(id) ON DELETE SET NULL,
    deal_name VARCHAR(255) NOT NULL,
    outcome VARCHAR(50) NOT NULL, -- 'won', 'lost', 'churned', 'no_decision'
    deal_value NUMERIC(14, 2) DEFAULT 0.00,
    close_date VARCHAR(50),
    primary_competitor VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    competitors_involved TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    customer_segment VARCHAR(100) DEFAULT 'general',
    industry VARCHAR(100),
    buyer_objections TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_win_loss_tenant_comp ON win_loss_deals(tenant_id, primary_competitor);
CREATE INDEX IF NOT EXISTS idx_win_loss_outcome ON win_loss_deals(outcome);
CREATE INDEX IF NOT EXISTS idx_win_loss_close_date ON win_loss_deals(close_date DESC);

-- -----------------------------------------------------------------------
-- 5. Win/Loss Decision Factors Table
-- Empirical winning and losing reasons linked to specific deals
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS win_loss_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES win_loss_deals(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    factor_type VARCHAR(50) NOT NULL, -- 'winning_factor', 'loss_factor', 'pricing_objection', 'missing_feature', 'integration_gap', 'implementation_concern', 'brand_trust'
    factor_description TEXT NOT NULL,
    competitor_name VARCHAR(255) REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_win_loss_factors_deal ON win_loss_factors(deal_id);
CREATE INDEX IF NOT EXISTS idx_win_loss_factors_type ON win_loss_factors(factor_type);
CREATE INDEX IF NOT EXISTS idx_win_loss_factors_comp ON win_loss_factors(competitor_name);

-- -----------------------------------------------------------------------
-- 6. Sales Call Records Table
-- Conversation transcripts and call session metadata
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES raw_documents(id) ON DELETE SET NULL,
    call_title VARCHAR(255) NOT NULL,
    deal_id UUID REFERENCES win_loss_deals(id) ON DELETE SET NULL,
    call_date VARCHAR(50),
    participants JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ name, role, company }]
    transcript_text TEXT NOT NULL,
    competitors_mentioned TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_calls_tenant ON sales_call_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_calls_deal ON sales_call_records(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_calls_date ON sales_call_records(call_date DESC);

-- -----------------------------------------------------------------------
-- 7. Sales Call Extracted Intelligence Table
-- Atomic items extracted from sales conversations (9 categories)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_call_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES sales_call_records(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'competitor_mention', 'buyer_objection', 'pricing_discussion', 'feature_comparison', 'customer_requirement', 'buying_signal', 'competitor_advantage', 'product_gap', 'deal_risk'
    competitor_name VARCHAR(255) REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    verbatim_quote TEXT NOT NULL,
    speaker VARCHAR(100),
    timestamp_offset VARCHAR(50),
    analysis TEXT,
    linked_claim_id UUID REFERENCES intelligence_claims(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_intel_call ON sales_call_intelligence(call_id);
CREATE INDEX IF NOT EXISTS idx_call_intel_type ON sales_call_intelligence(item_type);
CREATE INDEX IF NOT EXISTS idx_call_intel_comp ON sales_call_intelligence(competitor_name);
CREATE INDEX IF NOT EXISTS idx_call_intel_claim ON sales_call_intelligence(linked_claim_id);

-- -----------------------------------------------------------------------
-- 8. Deal Intelligence Dossiers Table
-- Synthesized deal-specific competitive reports grounded in real data
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_intelligence_dossiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES win_loss_deals(id) ON DELETE SET NULL,
    deal_name VARCHAR(255) NOT NULL,
    competitors_involved TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    threat_level VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'Critical', 'High', 'Medium', 'Low'
    primary_objections JSONB NOT NULL DEFAULT '[]'::jsonb,
    product_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    competitive_advantages JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_sales_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    relevant_historical_wins_losses JSONB NOT NULL DEFAULT '[]'::jsonb, -- Verified historical deals only; empty array if none
    supporting_claim_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_dossiers_tenant ON deal_intelligence_dossiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_dossiers_deal ON deal_intelligence_dossiers(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_dossiers_threat ON deal_intelligence_dossiers(threat_level);

-- -----------------------------------------------------------------------
-- 9. Next Best Action Engine Table
-- Prescriptive multi-persona recommendations
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS next_best_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team VARCHAR(50) NOT NULL, -- 'Sales', 'Product', 'Marketing', 'Leadership'
    category VARCHAR(50) NOT NULL, -- 'positioning', 'objection_response', 'feature_gap', 'pricing_counter', 'messaging', 'market_risk'
    title VARCHAR(255) NOT NULL,
    what_happened TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    urgency VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'Critical', 'High', 'Medium', 'Low'
    confidence VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'dismissed', 'completed', 'irrelevant'
    related_competitor VARCHAR(255) REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    related_deal_id UUID REFERENCES win_loss_deals(id) ON DELETE SET NULL,
    supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ source, quote, claim_id, url }]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nba_tenant_team ON next_best_actions(tenant_id, team);
CREATE INDEX IF NOT EXISTS idx_nba_status ON next_best_actions(status);
CREATE INDEX IF NOT EXISTS idx_nba_urgency ON next_best_actions(urgency);
CREATE INDEX IF NOT EXISTS idx_nba_competitor ON next_best_actions(related_competitor);

-- -----------------------------------------------------------------------
-- 10. Action Status Audits Table
-- Audit trail of user approvals, dismissals, completions, and edits
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS action_status_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_id UUID NOT NULL REFERENCES next_best_actions(id) ON DELETE CASCADE,
    prior_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    user_id VARCHAR(255) NOT NULL DEFAULT 'analyst',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_audits_tenant ON action_status_audits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_action_audits_action ON action_status_audits(action_id);
CREATE INDEX IF NOT EXISTS idx_action_audits_created ON action_status_audits(created_at DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- Enforce tenant isolation across all 10 tables
-- ============================================================================
ALTER TABLE raw_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE win_loss_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE win_loss_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_call_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_intelligence_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE next_best_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_status_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON raw_documents;
CREATE POLICY tenant_isolation_all ON raw_documents FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON customer_feedback_records;
CREATE POLICY tenant_isolation_all ON customer_feedback_records FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON customer_feedback_themes;
CREATE POLICY tenant_isolation_all ON customer_feedback_themes FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON win_loss_deals;
CREATE POLICY tenant_isolation_all ON win_loss_deals FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON win_loss_factors;
CREATE POLICY tenant_isolation_all ON win_loss_factors FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON sales_call_records;
CREATE POLICY tenant_isolation_all ON sales_call_records FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON sales_call_intelligence;
CREATE POLICY tenant_isolation_all ON sales_call_intelligence FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON deal_intelligence_dossiers;
CREATE POLICY tenant_isolation_all ON deal_intelligence_dossiers FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON next_best_actions;
CREATE POLICY tenant_isolation_all ON next_best_actions FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON action_status_audits;
CREATE POLICY tenant_isolation_all ON action_status_audits FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));
