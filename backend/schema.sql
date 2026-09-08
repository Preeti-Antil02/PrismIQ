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

-- ============================================================================
-- 16. Row Level Security (RLS) Policies
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

-- B. Shared Global Tables (Read-Only to authenticated; Writes restricted to service_role / postgres)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE noise_suppression_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidated_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_grading_records ENABLE ROW LEVEL SECURITY;

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

