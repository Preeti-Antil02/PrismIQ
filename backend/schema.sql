-- ============================================================================
-- PrismIQ Supabase / PostgreSQL Multi-Tenant Schema
-- Supports pgvector for semantic search & embeddings
-- Integrates with Supabase Auth (auth.users)
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Companies Registry Table (Repurposed from competitors; Global Canonical Registry)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'confirmed', 'candidate', 'historical'
    is_mock BOOLEAN DEFAULT FALSE, -- Distinguishes test/mock fixtures from real production targets
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_is_mock ON companies(is_mock);

-- 3. Tenant Tracked Companies Table (Per-Tenant Target vs Competitor Mapping)
CREATE TABLE IF NOT EXISTS tenant_tracked_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    is_target BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'archived'
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_tracked_company UNIQUE (tenant_id, company_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_tracked_tenant ON tenant_tracked_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_tracked_company ON tenant_tracked_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_tenant_tracked_is_target ON tenant_tracked_companies(is_target);

-- 4. Tenant Delivery Configs Table (Per-Tenant Slack/Notification Routing)
CREATE TABLE IF NOT EXISTS tenant_delivery_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slack_webhook_url TEXT,
    slack_channel VARCHAR(100),
    delivery_cadence VARCHAR(50) NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'realtime'
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_configs_tenant ON tenant_delivery_configs(tenant_id);

-- 5. Raw Signals Table (Shared / Global Ingestion Layer)
CREATE TABLE IF NOT EXISTS raw_signals (
    id VARCHAR(64) PRIMARY KEY, -- Deterministic hash: sig_{sha256(company::source::url::title::published_at)[:16]}
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    source VARCHAR(50) NOT NULL, -- 'news', 'github', 'jobs', 'pricing'
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at VARCHAR(100), -- Preserves original string format
    published_timestamp TIMESTAMPTZ, -- Structured timestamp parse for time-series queries
    raw_excerpt TEXT NOT NULL,
    is_mock BOOLEAN DEFAULT FALSE, -- True for mock/test fixture signals
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_signals_company ON raw_signals(company_name);
CREATE INDEX IF NOT EXISTS idx_raw_signals_source ON raw_signals(source);
CREATE INDEX IF NOT EXISTS idx_raw_signals_pub_ts ON raw_signals(published_timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_signals_is_mock ON raw_signals(is_mock);

-- 6. Noise Suppression Decisions Table (Shared / Global Filtering Layer)
CREATE TABLE IF NOT EXISTS noise_suppression_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id VARCHAR(64) UNIQUE NOT NULL REFERENCES raw_signals(id) ON DELETE CASCADE,
    is_noise BOOLEAN NOT NULL,
    noise_category VARCHAR(100), -- 'bot_and_dependency_bumps', 'ci_and_doc_formatting', 'isolated_github_social_noise', 'placeholder_job_postings'
    noise_reason TEXT NOT NULL,
    decided_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_noise_decisions_is_noise ON noise_suppression_decisions(is_noise);
CREATE INDEX IF NOT EXISTS idx_noise_decisions_category ON noise_suppression_decisions(noise_category);

-- 7. Consolidated Events Table (Shared Global Facts with Single Canonical fact_confidence)
CREATE TABLE IF NOT EXISTS consolidated_events (
    event_id VARCHAR(64) PRIMARY KEY, -- Deterministic hash of first-detected root signal: evt_{root_sig_id}
    legacy_event_id VARCHAR(64), -- Original event_id string from flat files
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    title TEXT NOT NULL,
    event_summary TEXT NOT NULL,
    corroboration_count INT NOT NULL DEFAULT 1,
    contributing_sources JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ['news', 'github']
    first_detected_at VARCHAR(100),
    latest_detected_at VARCHAR(100),
    published_at VARCHAR(100),
    published_timestamp TIMESTAMPTZ,
    url TEXT NOT NULL,
    source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_excerpt TEXT NOT NULL,
    fact_confidence VARCHAR(20), -- 'High', 'Medium', 'Low' (Single canonical ground truth)
    is_mock BOOLEAN DEFAULT FALSE, -- True for mock/test fixture events
    embedding vector(1536), -- Future pgvector semantic embedding column
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_company ON consolidated_events(company_name);
CREATE INDEX IF NOT EXISTS idx_events_corroboration ON consolidated_events(corroboration_count);
CREATE INDEX IF NOT EXISTS idx_events_pub_ts ON consolidated_events(published_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_fact_conf ON consolidated_events(fact_confidence);
CREATE INDEX IF NOT EXISTS idx_events_is_mock ON consolidated_events(is_mock);
CREATE INDEX IF NOT EXISTS idx_events_sources_gin ON consolidated_events USING gin(contributing_sources);

-- 8. Event Signals Join Table (Shared M:N Mapping)
CREATE TABLE IF NOT EXISTS event_signals (
    event_id VARCHAR(64) NOT NULL REFERENCES consolidated_events(event_id) ON DELETE CASCADE,
    signal_id VARCHAR(64) NOT NULL REFERENCES raw_signals(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_event_signals_signal ON event_signals(signal_id);

-- 9. Findings & Analysis Table (Per-Tenant Strategic Deductions & Narrative)
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id VARCHAR(64) NOT NULL REFERENCES consolidated_events(event_id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    why_it_matters TEXT NOT NULL,
    confidence VARCHAR(20) NOT NULL, -- 'High', 'Medium', 'Low' (Blended/Legacy)
    inference_confidence VARCHAR(20), -- 'High', 'Medium', 'Low' (Speculative interpretation confidence)
    decision_score NUMERIC(5, 2),
    tier VARCHAR(50), -- 'must_know', 'should_know', 'nice_to_know'
    is_mock BOOLEAN DEFAULT FALSE, -- True for mock/test fixture findings
    embedding vector(1536), -- Future pgvector semantic embedding column
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_findings_tenant_event UNIQUE (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_findings_tenant ON findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_findings_company ON findings(company_name);
CREATE INDEX IF NOT EXISTS idx_findings_confidence ON findings(confidence);
CREATE INDEX IF NOT EXISTS idx_findings_tier ON findings(tier);
CREATE INDEX IF NOT EXISTS idx_findings_is_mock ON findings(is_mock);

-- 10. Briefs Table (Per-Tenant Markdown Intelligence Briefs)
CREATE TABLE IF NOT EXISTS briefs (
    id VARCHAR(100) NOT NULL, -- e.g. 'data_latest', 'published_latest', '20260823_094931'
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    source_path VARCHAR(255), -- Physical file location
    content_hash VARCHAR(64), -- SHA-256 hash of markdown content
    title TEXT NOT NULL,
    headline_preview TEXT,
    content TEXT NOT NULL, -- Full markdown brief content
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_briefs_tenant ON briefs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_briefs_pub ON briefs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefs_hash ON briefs(content_hash);

-- 11. Discovery Proposals Table (Per-Tenant Discovery Runs)
CREATE TABLE IF NOT EXISTS discovery_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_company VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    generated_at TIMESTAMPTZ,
    filename VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_discovery_proposal UNIQUE (tenant_id, target_company, filename)
);

CREATE INDEX IF NOT EXISTS idx_proposals_tenant ON discovery_proposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposals_target ON discovery_proposals(target_company);

-- 12. Discovery Candidates Table (Per-Tenant Candidate Recommendations)
CREATE TABLE IF NOT EXISTS discovery_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES discovery_proposals(id) ON DELETE SET NULL,
    target_company VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    name VARCHAR(255) NOT NULL,
    rationale TEXT NOT NULL,
    confidence VARCHAR(20) NOT NULL, -- 'High', 'Medium', 'Low'
    source TEXT NOT NULL,
    source_age VARCHAR(50) NOT NULL, -- 'recent', 'dated', 'undated'
    source_date VARCHAR(50),
    freshness_note TEXT,
    status VARCHAR(50) DEFAULT 'proposed', -- 'proposed', 'confirmed', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_discovery_candidate UNIQUE (tenant_id, target_company, name, source)
);

CREATE INDEX IF NOT EXISTS idx_candidates_tenant ON discovery_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidates_target ON discovery_candidates(target_company);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON discovery_candidates(name);

-- 13. Discovery Sources Table (Per-Tenant Public Context Fetch History)
CREATE TABLE IF NOT EXISTS discovery_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_company VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    source_type VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at VARCHAR(100),
    source_age VARCHAR(50),
    text TEXT NOT NULL,
    source_file VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_discovery_source UNIQUE (tenant_id, target_company, url, title)
);

CREATE INDEX IF NOT EXISTS idx_disc_sources_tenant ON discovery_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disc_sources_target ON discovery_sources(target_company);

-- 14. Pricing Snapshots Table (Shared Global Pricing History)
CREATE TABLE IF NOT EXISTS pricing_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    url TEXT NOT NULL,
    timestamp VARCHAR(100),
    fetched_at VARCHAR(100),
    plans JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_file VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_pricing_snapshot UNIQUE (company_name, timestamp, source_file)
);

CREATE INDEX IF NOT EXISTS idx_pricing_company ON pricing_snapshots(company_name);

-- 15. Eval & Grading Records Table (Shared Global LLM Evaluation Benchmark)
CREATE TABLE IF NOT EXISTS eval_grading_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task VARCHAR(100) NOT NULL, -- 'discovery_candidate', 'event_consolidation', 'analysis_groundedness', 'synthesis_pattern', 'noise_suppression'
    target_company VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    candidate_name VARCHAR(255) NOT NULL,
    rationale TEXT NOT NULL,
    confidence VARCHAR(20) NOT NULL,
    source TEXT NOT NULL,
    grade VARCHAR(50) NOT NULL, -- 'Grounded', 'Plausible', 'Hallucinated', 'Correct', 'Wrong'
    grade_rationale TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_eval_grading UNIQUE (target_company, candidate_name, task, grade, source)
);

CREATE INDEX IF NOT EXISTS idx_eval_target ON eval_grading_records(target_company);
CREATE INDEX IF NOT EXISTS idx_eval_task ON eval_grading_records(task);
CREATE INDEX IF NOT EXISTS idx_eval_grade ON eval_grading_records(grade);

-- 16. Tenant Research Topics Table (Per-Tenant Topic Areas for Field Research Radar)
CREATE TABLE IF NOT EXISTS tenant_research_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_label VARCHAR(255) NOT NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    source VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual', 'suggested' (manual entry only in Stage 1)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_topic UNIQUE (tenant_id, topic_label)
);

CREATE INDEX IF NOT EXISTS idx_tenant_topics_tenant ON tenant_research_topics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_topics_label ON tenant_research_topics(topic_label);
CREATE INDEX IF NOT EXISTS idx_tenant_topics_active ON tenant_research_topics(is_active);

-- 17. Research Items Table (Shared / Global Domain Research Layer)
CREATE TABLE IF NOT EXISTS research_items (
    id VARCHAR(64) PRIMARY KEY, -- Deterministic hash: res_{sha256(canonical_url)[:16]}
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    canonical_url TEXT UNIQUE NOT NULL,
    published_at VARCHAR(100),
    published_timestamp TIMESTAMPTZ,
    raw_excerpt TEXT NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'arxiv', 'industry_blog'
    authors JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    research_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_mock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_items_canonical ON research_items(canonical_url);
CREATE INDEX IF NOT EXISTS idx_research_items_source ON research_items(source);
CREATE INDEX IF NOT EXISTS idx_research_items_pub_ts ON research_items(published_timestamp);
CREATE INDEX IF NOT EXISTS idx_research_items_topics_gin ON research_items USING gin(matched_topics);

-- 18. Research Radar Evaluations Table (Per-Tenant Historical Radar & Competitor Connection History)
CREATE TABLE IF NOT EXISTS research_radar_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES tenant_research_topics(id) ON DELETE CASCADE,
    topic_label VARCHAR(255) NOT NULL,
    cycle_id VARCHAR(100) NOT NULL, -- e.g. run id or brief id
    research_item_count INT NOT NULL DEFAULT 0,
    research_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    competitor_connections JSONB NOT NULL DEFAULT '{}'::jsonb,
    why_it_matters TEXT NOT NULL,
    verified_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    state_change_detected BOOLEAN DEFAULT FALSE,
    previous_status JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_evals_tenant ON research_radar_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_radar_evals_topic ON research_radar_evaluations(topic_label);
CREATE INDEX IF NOT EXISTS idx_radar_evals_cycle ON research_radar_evaluations(cycle_id);
CREATE INDEX IF NOT EXISTS idx_radar_evals_created ON research_radar_evaluations(created_at DESC);

-- ============================================================================
-- 19. Row Level Security (RLS) Policies
-- Enforces database-level multi-tenant isolation for authenticated clients
-- ============================================================================

-- A. Per-Tenant Tables (Full tenant_id = auth.uid() isolation for authenticated role)
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_tracked_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_delivery_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_research_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_radar_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON findings;
CREATE POLICY tenant_isolation_all ON findings FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON briefs;
CREATE POLICY tenant_isolation_all ON briefs FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON discovery_proposals;
CREATE POLICY tenant_isolation_all ON discovery_proposals FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON discovery_candidates;
CREATE POLICY tenant_isolation_all ON discovery_candidates FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON discovery_sources;
CREATE POLICY tenant_isolation_all ON discovery_sources FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON tenant_tracked_companies;
CREATE POLICY tenant_isolation_all ON tenant_tracked_companies FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON tenant_delivery_configs;
CREATE POLICY tenant_isolation_all ON tenant_delivery_configs FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON tenant_research_topics;
CREATE POLICY tenant_isolation_all ON tenant_research_topics FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON research_radar_evaluations;
CREATE POLICY tenant_isolation_all ON research_radar_evaluations FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

-- B. Shared Global Tables (Read-Only to authenticated; Writes restricted to service_role / postgres)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE noise_suppression_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidated_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_grading_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_read_all ON companies;
CREATE POLICY shared_read_all ON companies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read_all ON raw_signals;
CREATE POLICY shared_read_all ON raw_signals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read_all ON noise_suppression_decisions;
CREATE POLICY shared_read_all ON noise_suppression_decisions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read_all ON consolidated_events;
CREATE POLICY shared_read_all ON consolidated_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read_all ON event_signals;
CREATE POLICY shared_read_all ON event_signals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read_all ON pricing_snapshots;
CREATE POLICY shared_read_all ON pricing_snapshots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read_all ON eval_grading_records;
CREATE POLICY shared_read_all ON eval_grading_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shared_read_all ON research_items;
-- 19. Pipeline Run Progress Table (Real-time monitoring state and honest telemetry)
CREATE TABLE IF NOT EXISTS pipeline_run_progress (
    run_id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'timed_out'
    current_phase VARCHAR(100) NOT NULL DEFAULT 'initializing', -- 'initializing', 'fetching_signals', 'analyzing', 'synthesizing', 'generating_report', 'completed', 'failed', 'timed_out'
    progress_message TEXT NOT NULL DEFAULT 'Continuous monitoring active',
    total_companies INT NOT NULL DEFAULT 0,
    completed_companies INT NOT NULL DEFAULT 0,
    completed_company_names JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_company VARCHAR(255),
    total_sources INT NOT NULL DEFAULT 0,
    completed_sources INT NOT NULL DEFAULT 0,
    source_health JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_errors JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_visible_data_at TIMESTAMPTZ,
    time_to_first_data_seconds NUMERIC(8, 2),
    is_first_run BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_duration_seconds NUMERIC(8, 2)
);

CREATE INDEX IF NOT EXISTS idx_run_progress_tenant ON pipeline_run_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_run_progress_status ON pipeline_run_progress(status);
CREATE INDEX IF NOT EXISTS idx_run_progress_started ON pipeline_run_progress(started_at DESC);

-- RLS Policy for pipeline_run_progress
ALTER TABLE pipeline_run_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON pipeline_run_progress;
CREATE POLICY tenant_isolation_all ON pipeline_run_progress FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid()) OR tenant_id IS NULL)
    WITH CHECK (tenant_id = (SELECT auth.uid()) OR tenant_id IS NULL);




-- ============================================================================
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


-- ============================================================================
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


-- ============================================================================
-- Migration 007: Competitive Change Detection Engine (Point 3)
-- Section 3: The 5 Changes That Actually Matter
-- ============================================================================

CREATE TABLE IF NOT EXISTS detected_high_impact_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    headline VARCHAR(500) NOT NULL,
    event_category VARCHAR(100) NOT NULL DEFAULT 'Enterprise Strategy',
    event_description TEXT NOT NULL DEFAULT '',
    significance_tier VARCHAR(50) NOT NULL DEFAULT 'HIGH IMPACT',
    impact_score NUMERIC(5, 2) NOT NULL DEFAULT 75.00,
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 90.00,
    potential_impact VARCHAR(50) NOT NULL DEFAULT 'High',
    window_days INTEGER NOT NULL DEFAULT 14,
    strategic_interpretation TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    affected_business_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'corroborated',
    is_demo_data BOOLEAN NOT NULL DEFAULT FALSE,
    corroborating_signals_count INTEGER NOT NULL DEFAULT 3,
    signals_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE detected_high_impact_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON detected_high_impact_changes;
CREATE POLICY tenant_isolation_all ON detected_high_impact_changes FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_high_impact_changes_tenant_company 
    ON detected_high_impact_changes (tenant_id, company_name);

CREATE INDEX IF NOT EXISTS idx_high_impact_changes_detected_at 
    ON detected_high_impact_changes (detected_at DESC);


-- ============================================================================
-- Migration 008: Signal Correlation Engine & Strategic Implication Pipeline (Point 4)
-- Section 4: Raw Signals -> Canonical Events -> Patterns -> Insights -> Actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS signal_correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE signal_correlations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON signal_correlations;
CREATE POLICY tenant_isolation_all ON signal_correlations FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_signal_correlations_tenant_company 
    ON signal_correlations (tenant_id, company_name);

CREATE INDEX IF NOT EXISTS idx_signal_correlations_created 
    ON signal_correlations (created_at DESC);


-- ============================================================================
-- Migration 009: "Why Should I Care?" Decision Support System (Point 5)
-- Section 5: Decision Support - What happened, Why it matters, Who is affected, What to do, Urgency, Evidence
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_support_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    target_company VARCHAR(255) DEFAULT 'Our Company',
    event_id VARCHAR(255),
    impact_category VARCHAR(100) DEFAULT 'Product Capability Threat',
    what_happened TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    who_is_affected TEXT[] NOT NULL DEFAULT '{}',
    what_should_we_do TEXT NOT NULL,
    urgency VARCHAR(50) NOT NULL DEFAULT 'High',
    time_horizon VARCHAR(50) DEFAULT 'Immediate (<7d)',
    deadline_at TIMESTAMPTZ,
    response_deadline_label VARCHAR(150) DEFAULT 'No fixed response deadline established',
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 89.00,
    confidence_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    department_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_progress JSONB NOT NULL DEFAULT '{"total": 0, "accepted": 0, "in_progress": 0, "completed": 0, "dismissed": 0, "percent_complete": 0}'::jsonb,
    insufficient_evidence BOOLEAN DEFAULT FALSE,
    corroboration_sources_count INTEGER NOT NULL DEFAULT 3,
    evidence_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE decision_support_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON decision_support_items;
CREATE POLICY tenant_isolation_all ON decision_support_items FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_decision_support_tenant_company 
    ON decision_support_items (tenant_id, company_name);

CREATE INDEX IF NOT EXISTS idx_decision_support_urgency_created 
    ON decision_support_items (urgency, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_support_impact_category
    ON decision_support_items (impact_category);

CREATE INDEX IF NOT EXISTS idx_decision_support_deadline
    ON decision_support_items (deadline_at ASC NULLS LAST);

-- Dedicated action execution audit log table
CREATE TABLE IF NOT EXISTS decision_support_action_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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


-- ============================================================================
-- 20. Evidence-Linked Competitive Battlecards & Battlecard Drift Detection (Batch 1)
-- ============================================================================
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


-- ============================================================================
-- Migration 014: Customer Voice, Win/Loss, Sales Calls, Deal Intel & Next Best Action
-- Part of PrismIQ Batch 2
-- ============================================================================

-- 1. Raw Documents Table
CREATE TABLE IF NOT EXISTS raw_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    file_format VARCHAR(20) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    raw_content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'processed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_tenant_hash UNIQUE (tenant_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_raw_docs_tenant ON raw_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_raw_docs_source ON raw_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_raw_docs_created ON raw_documents(created_at DESC);

-- 2. Customer Feedback Records Table
CREATE TABLE IF NOT EXISTS customer_feedback_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES raw_documents(id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    feedback_channel VARCHAR(50) NOT NULL DEFAULT 'customer_review',
    category VARCHAR(50) NOT NULL,
    sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral',
    raw_quote TEXT NOT NULL,
    aspect VARCHAR(100),
    customer_segment VARCHAR(100) DEFAULT 'general',
    publication_date VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_tenant_company ON customer_feedback_records(tenant_id, company_name);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON customer_feedback_records(category);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON customer_feedback_records(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_channel ON customer_feedback_records(feedback_channel);

-- 3. Customer Feedback Themes Table
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
    is_competitive_opportunity BOOLEAN NOT NULL DEFAULT FALSE,
    confidence VARCHAR(20) NOT NULL DEFAULT 'Medium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_themes_tenant_comp ON customer_feedback_themes(tenant_id, company_name);
CREATE INDEX IF NOT EXISTS idx_feedback_themes_category ON customer_feedback_themes(category);
CREATE INDEX IF NOT EXISTS idx_feedback_themes_opportunity ON customer_feedback_themes(is_competitive_opportunity);

-- 4. Next Best Action Engine Table
CREATE TABLE IF NOT EXISTS next_best_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    what_happened TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    urgency VARCHAR(20) NOT NULL DEFAULT 'Medium',
    confidence VARCHAR(20) NOT NULL DEFAULT 'Medium',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    related_competitor VARCHAR(255) REFERENCES companies(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nba_tenant_team ON next_best_actions(tenant_id, team);
CREATE INDEX IF NOT EXISTS idx_nba_status ON next_best_actions(status);
CREATE INDEX IF NOT EXISTS idx_nba_urgency ON next_best_actions(urgency);
CREATE INDEX IF NOT EXISTS idx_nba_competitor ON next_best_actions(related_competitor);

-- 5. Action Status Audits Table
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

-- RLS Policies
ALTER TABLE raw_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback_themes ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS tenant_isolation_all ON next_best_actions;
CREATE POLICY tenant_isolation_all ON next_best_actions FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON action_status_audits;
CREATE POLICY tenant_isolation_all ON action_status_audits FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

-- ============================================================================
-- Migration 016: Batch 4 — Market Intelligence
-- ============================================================================

-- 1. Competitive Relationship Graph Edges
CREATE TABLE IF NOT EXISTS competitive_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id VARCHAR(255) NOT NULL,
    subject_type VARCHAR(50) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    predicate VARCHAR(50) NOT NULL,
    object_id VARCHAR(255) NOT NULL,
    object_type VARCHAR(50) NOT NULL,
    object_name VARCHAR(255) NOT NULL,
    relationship_source VARCHAR(255) NOT NULL DEFAULT 'verified_fact',
    source_reference TEXT,
    is_inferred BOOLEAN NOT NULL DEFAULT FALSE,
    inference_reason TEXT,
    confidence VARCHAR(20) NOT NULL DEFAULT 'High',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_rel_tenant ON competitive_relationships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_rel_subject ON competitive_relationships(tenant_id, subject_id, subject_type);
CREATE INDEX IF NOT EXISTS idx_comp_rel_object ON competitive_relationships(tenant_id, object_id, object_type);
CREATE INDEX IF NOT EXISTS idx_comp_rel_predicate ON competitive_relationships(tenant_id, predicate);

-- 2. Relationship Mutation History
CREATE TABLE IF NOT EXISTS relationship_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255) NOT NULL DEFAULT 'system',
    prior_state JSONB,
    new_state JSONB NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rel_hist_tenant ON relationship_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rel_hist_rel_id ON relationship_history(relationship_id);

-- 3. Competitor Threat Scores
CREATE TABLE IF NOT EXISTS competitor_threat_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    competitor_name VARCHAR(255) NOT NULL,
    overall_threat_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    threat_level VARCHAR(50) NOT NULL DEFAULT 'Medium',
    factor_contributions JSONB NOT NULL DEFAULT '{}'::jsonb,
    configured_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_coverage_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    has_missing_data BOOLEAN NOT NULL DEFAULT FALSE,
    unassessed_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    calculation_formula TEXT NOT NULL,
    score_representation VARCHAR(50) NOT NULL DEFAULT 'threat_intensity_index',
    is_probability BOOLEAN NOT NULL DEFAULT FALSE,
    disclaimer TEXT NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_competitor_threat UNIQUE (tenant_id, competitor_name)
);

CREATE INDEX IF NOT EXISTS idx_threat_scores_tenant ON competitor_threat_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threat_scores_comp ON competitor_threat_scores(tenant_id, competitor_name);

-- 4. Emerging Competitor Candidates
CREATE TABLE IF NOT EXISTS emerging_competitor_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100) NOT NULL DEFAULT 'Technology',
    similarity_reason TEXT,
    discovery_explanation TEXT NOT NULL,
    discovery_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    supporting_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
    relevance_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    corroboration_count INT NOT NULL DEFAULT 1,
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255),
    review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_emerging_cands_tenant ON emerging_competitor_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emerging_cands_status ON emerging_competitor_candidates(tenant_id, review_status);

-- 5. Analyst Feedback
CREATE TABLE IF NOT EXISTS analyst_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_entity_type VARCHAR(50) NOT NULL,
    target_entity_id VARCHAR(255) NOT NULL,
    feedback_type VARCHAR(50) NOT NULL,
    analyst_id VARCHAR(255) NOT NULL DEFAULT 'analyst',
    notes TEXT,
    suggested_interpretation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyst_feedback_tenant ON analyst_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analyst_feedback_target ON analyst_feedback(target_entity_type, target_entity_id);

-- RLS Policies for Batch 4 Tables
ALTER TABLE competitive_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_threat_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE emerging_competitor_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON competitive_relationships;
CREATE POLICY tenant_isolation_all ON competitive_relationships FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON relationship_history;
CREATE POLICY tenant_isolation_all ON relationship_history FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON competitor_threat_scores;
CREATE POLICY tenant_isolation_all ON competitor_threat_scores FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON emerging_competitor_candidates;
CREATE POLICY tenant_isolation_all ON emerging_competitor_candidates FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tenant_isolation_all ON analyst_feedback;
CREATE POLICY tenant_isolation_all ON analyst_feedback FOR ALL TO authenticated
    USING (tenant_id = (SELECT auth.uid())) WITH CHECK (tenant_id = (SELECT auth.uid()));


