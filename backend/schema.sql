-- ============================================================================
-- PrismIQ Supabase / PostgreSQL Schema
-- Supports pgvector for semantic search & embeddings
-- Preserves 100% of flat-file JSON and Markdown structures
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Competitors Table
CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    is_target BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'confirmed', 'candidate', 'historical'
    is_mock BOOLEAN DEFAULT FALSE, -- Distinguishes test/mock fixtures from real production targets
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitors_name ON competitors(name);
CREATE INDEX IF NOT EXISTS idx_competitors_is_target ON competitors(is_target);
CREATE INDEX IF NOT EXISTS idx_competitors_is_mock ON competitors(is_mock);

-- 3. Raw Signals Table
CREATE TABLE IF NOT EXISTS raw_signals (
    id VARCHAR(64) PRIMARY KEY, -- Deterministic hash: sig_{sha256(company::source::url::title::published_at)[:16]}
    company_name VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
    source VARCHAR(50) NOT NULL, -- 'news', 'github', 'jobs', 'pricing'
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at VARCHAR(100), -- Preserves original string format (e.g. '2026-08-22 05:32:38 +0000')
    published_timestamp TIMESTAMPTZ, -- Structured timestamp parse for time-series queries
    raw_excerpt TEXT NOT NULL,
    is_mock BOOLEAN DEFAULT FALSE, -- True for mock/test fixture signals
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_signals_company ON raw_signals(company_name);
CREATE INDEX IF NOT EXISTS idx_raw_signals_source ON raw_signals(source);
CREATE INDEX IF NOT EXISTS idx_raw_signals_pub_ts ON raw_signals(published_timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_signals_is_mock ON raw_signals(is_mock);

-- 4. Noise Suppression Decisions Table
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

-- 5. Consolidated Events Table (with pgvector embedding)
CREATE TABLE IF NOT EXISTS consolidated_events (
    event_id VARCHAR(64) PRIMARY KEY, -- Deterministic hash of first-detected root signal: evt_{root_sig_id}
    legacy_event_id VARCHAR(64), -- Original event_id string from flat files
    company_name VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
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
    is_mock BOOLEAN DEFAULT FALSE, -- True for mock/test fixture events
    embedding vector(1536), -- Future pgvector semantic embedding column (OpenAI/Gemini/Ollama)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_company ON consolidated_events(company_name);
CREATE INDEX IF NOT EXISTS idx_events_corroboration ON consolidated_events(corroboration_count);
CREATE INDEX IF NOT EXISTS idx_events_pub_ts ON consolidated_events(published_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_is_mock ON consolidated_events(is_mock);
CREATE INDEX IF NOT EXISTS idx_events_sources_gin ON consolidated_events USING gin(contributing_sources);

-- 6. Event Signals Join Table (Models M:N relationships between Consolidated Events and Raw Signals)
CREATE TABLE IF NOT EXISTS event_signals (
    event_id VARCHAR(64) NOT NULL REFERENCES consolidated_events(event_id) ON DELETE CASCADE,
    signal_id VARCHAR(64) NOT NULL REFERENCES raw_signals(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_event_signals_signal ON event_signals(signal_id);

-- 7. Findings & Analysis Table (with pgvector embedding)
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(64) UNIQUE NOT NULL REFERENCES consolidated_events(event_id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
    why_it_matters TEXT NOT NULL,
    confidence VARCHAR(20) NOT NULL, -- 'High', 'Medium', 'Low'
    decision_score NUMERIC(5, 2),
    tier VARCHAR(50), -- 'must_know', 'should_know', 'nice_to_know'
    is_mock BOOLEAN DEFAULT FALSE, -- True for mock/test fixture findings
    embedding vector(1536), -- Future pgvector semantic embedding column
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_company ON findings(company_name);
CREATE INDEX IF NOT EXISTS idx_findings_confidence ON findings(confidence);
CREATE INDEX IF NOT EXISTS idx_findings_tier ON findings(tier);
CREATE INDEX IF NOT EXISTS idx_findings_is_mock ON findings(is_mock);

-- 8. Briefs Table (Markdown Reports)
CREATE TABLE IF NOT EXISTS briefs (
    id VARCHAR(100) PRIMARY KEY, -- e.g. 'data_latest', 'published_latest', '20260823_094931', '20260823_095555'
    filename VARCHAR(255) NOT NULL,
    source_path VARCHAR(255), -- Physical file location (e.g. 'data/brief.md' vs 'published_briefs/brief.md')
    content_hash VARCHAR(64), -- SHA-256 hash of markdown content
    title TEXT NOT NULL,
    headline_preview TEXT,
    content TEXT NOT NULL, -- Full markdown brief content
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefs_pub ON briefs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefs_hash ON briefs(content_hash);

-- 9. Discovery Proposals Table
CREATE TABLE IF NOT EXISTS discovery_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_company VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
    generated_at TIMESTAMPTZ,
    filename VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_discovery_proposal UNIQUE(target_company, filename)
);

CREATE INDEX IF NOT EXISTS idx_proposals_target ON discovery_proposals(target_company);

-- 10. Discovery Candidates Table
CREATE TABLE IF NOT EXISTS discovery_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES discovery_proposals(id) ON DELETE SET NULL,
    target_company VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
    name VARCHAR(255) NOT NULL,
    rationale TEXT NOT NULL,
    confidence VARCHAR(20) NOT NULL, -- 'High', 'Medium', 'Low'
    source TEXT NOT NULL,
    source_age VARCHAR(50) NOT NULL, -- 'recent', 'dated', 'undated'
    source_date VARCHAR(50),
    freshness_note TEXT,
    status VARCHAR(50) DEFAULT 'proposed', -- 'proposed', 'confirmed', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_discovery_candidate UNIQUE(target_company, name, source)
);

CREATE INDEX IF NOT EXISTS idx_candidates_target ON discovery_candidates(target_company);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON discovery_candidates(name);
CREATE INDEX IF NOT EXISTS idx_candidates_confidence ON discovery_candidates(confidence);

-- 11. Discovery Sources Table
CREATE TABLE IF NOT EXISTS discovery_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_company VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
    source_type VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at VARCHAR(100),
    source_age VARCHAR(50),
    text TEXT NOT NULL,
    source_file VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_discovery_source UNIQUE(target_company, url, title)
);

CREATE INDEX IF NOT EXISTS idx_disc_sources_target ON discovery_sources(target_company);

-- 12. Pricing Snapshots Table
CREATE TABLE IF NOT EXISTS pricing_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
    url TEXT NOT NULL,
    timestamp VARCHAR(100),
    fetched_at VARCHAR(100),
    plans JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_file VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_pricing_snapshot UNIQUE(company_name, timestamp, source_file)
);

CREATE INDEX IF NOT EXISTS idx_pricing_company ON pricing_snapshots(company_name);

-- 13. Eval & Grading Records Table (Grounded/Plausible/Hallucinated history)
CREATE TABLE IF NOT EXISTS eval_grading_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task VARCHAR(100) NOT NULL, -- 'discovery_candidate', 'event_consolidation', 'analysis_groundedness', 'synthesis_pattern', 'noise_suppression'
    target_company VARCHAR(255) NOT NULL REFERENCES competitors(name) ON UPDATE CASCADE,
    candidate_name VARCHAR(255) NOT NULL,
    rationale TEXT NOT NULL,
    confidence VARCHAR(20) NOT NULL,
    source TEXT NOT NULL,
    grade VARCHAR(50) NOT NULL, -- 'Grounded', 'Plausible', 'Hallucinated', 'Correct', 'Wrong', etc.
    grade_rationale TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_eval_grading UNIQUE(target_company, candidate_name, task, grade, source)
);

CREATE INDEX IF NOT EXISTS idx_eval_target ON eval_grading_records(target_company);
CREATE INDEX IF NOT EXISTS idx_eval_task ON eval_grading_records(task);
CREATE INDEX IF NOT EXISTS idx_eval_grade ON eval_grading_records(grade);
