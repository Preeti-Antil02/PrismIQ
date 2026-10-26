-- ============================================================================
-- Migration: 008_trend_evolution_schema.sql
-- Description: Core Schema for Trend Evolution Timeline (Phase F).
--              - Tables: company_aliases, global_entity_exclusions, trend_clusters,
--                trend_cluster_members, trend_cluster_lineage, tenant_trend_views,
--                tenant_trend_snapshots, company_ingestion_ledger, trend_build_runs.
--              - Additive embedding_384 vector columns on consolidated_events & research_items.
--              - Strict Row Level Security (RLS) on all tables; anon access revoked.
--              - Multi-tenant tenant_id isolation via auth.jwt() claims.
--              - Commented manual rollback block included at end.
-- ============================================================================

-- Ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Company Aliases & Groupings Table
CREATE TABLE IF NOT EXISTS public.company_aliases (
    alias_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias_name TEXT NOT NULL UNIQUE,
    canonical_company TEXT NOT NULL,
    corporate_group TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_aliases_alias ON public.company_aliases (alias_name);
CREATE INDEX IF NOT EXISTS idx_company_aliases_canonical ON public.company_aliases (canonical_company);

-- 2. Global Entity Exclusions (Homonyms & Noise Table)
CREATE TABLE IF NOT EXISTS public.global_entity_exclusions (
    exclusion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_pattern TEXT NOT NULL UNIQUE,
    exclusion_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Trend Clusters Table (Global, Neutral, Multi-week Aggregates)
CREATE TABLE IF NOT EXISTS public.trend_clusters (
    cluster_id TEXT PRIMARY KEY,
    global_topic_label TEXT NOT NULL,
    cluster_type TEXT NOT NULL CHECK (cluster_type IN ('cross_company_trend', 'single_company_storyline', 'emerging', 'single_event')),
    momentum_vector INT[] NOT NULL DEFAULT '{0, 0, 0}',
    momentum_label TEXT NOT NULL CHECK (momentum_label IN ('building', 'steady', 'fading', 'too_early_to_call', 'low_coverage')),
    momentum_rule_id TEXT NOT NULL,
    first_date DATE,
    last_date DATE,
    distinct_story_count INT NOT NULL DEFAULT 0,
    raw_signal_count INT NOT NULL DEFAULT 0,
    centroid_embedding vector(384),
    centroid_radius FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_type ON public.trend_clusters (cluster_type);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_momentum ON public.trend_clusters (momentum_label);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_dates ON public.trend_clusters (last_date DESC);

-- 4. Trend Cluster Members Table (Individual Provenance Nodes)
CREATE TABLE IF NOT EXISTS public.trend_cluster_members (
    member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id TEXT NOT NULL REFERENCES public.trend_clusters(cluster_id) ON DELETE CASCADE,
    event_id VARCHAR(64) REFERENCES public.consolidated_events(event_id) ON DELETE SET NULL,
    research_id VARCHAR(64) REFERENCES public.research_items(id) ON DELETE SET NULL,
    story_key TEXT NOT NULL,
    canonical_company TEXT NOT NULL,
    corporate_group TEXT NOT NULL,
    title TEXT NOT NULL,
    source_url TEXT NOT NULL,
    resolved_publisher TEXT NOT NULL,
    node_class TEXT NOT NULL CHECK (node_class IN ('third_party', 'first_party')),
    signal_type TEXT NOT NULL CHECK (signal_type IN ('news', 'github', 'research', 'pricing', 'jobs', 'blog')),
    source_date DATE NOT NULL,
    source_timestamp TIMESTAMPTZ,
    date_source TEXT NOT NULL,
    date_precision TEXT NOT NULL CHECK (date_precision IN ('second', 'day', 'unknown')),
    is_sequence_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    fact_confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trend_members_cluster ON public.trend_cluster_members (cluster_id);
CREATE INDEX IF NOT EXISTS idx_trend_members_company ON public.trend_cluster_members (canonical_company);
CREATE INDEX IF NOT EXISTS idx_trend_members_date ON public.trend_cluster_members (source_date);
CREATE INDEX IF NOT EXISTS idx_trend_members_event ON public.trend_cluster_members (event_id);
CREATE INDEX IF NOT EXISTS idx_trend_members_research ON public.trend_cluster_members (research_id);

-- 5. Trend Cluster Lineage Table (Centroid Saga Merges Tracking)
CREATE TABLE IF NOT EXISTS public.trend_cluster_lineage (
    lineage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_cluster_id TEXT NOT NULL,
    child_cluster_id TEXT NOT NULL,
    merge_reason TEXT NOT NULL,
    similarity_distance FLOAT,
    merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trend_lineage_parent ON public.trend_cluster_lineage (parent_cluster_id);
CREATE INDEX IF NOT EXISTS idx_trend_lineage_child ON public.trend_cluster_lineage (child_cluster_id);

-- 6. Tenant Trend Views Table (Tenant-Scoped Competitive Visibility)
CREATE TABLE IF NOT EXISTS public.tenant_trend_views (
    view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    cluster_id TEXT NOT NULL REFERENCES public.trend_clusters(cluster_id) ON DELETE CASCADE,
    is_cross_competitor BOOLEAN NOT NULL DEFAULT FALSE,
    tenant_momentum_label TEXT NOT NULL,
    tracked_companies_present TEXT[] NOT NULL DEFAULT '{}',
    audited_absences TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cluster_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_trend_views_tenant ON public.tenant_trend_views (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_trend_views_cluster ON public.tenant_trend_views (cluster_id);

-- 7. Tenant Trend Snapshots Table (Daily Timeline State Caching)
CREATE TABLE IF NOT EXISTS public.tenant_trend_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    as_of_date DATE NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, as_of_date)
);
CREATE INDEX IF NOT EXISTS idx_tenant_trend_snapshots_tenant ON public.tenant_trend_snapshots (tenant_id);

-- 8. Company Ingestion Ledger Table (Coverage & Absence Auditing)
CREATE TABLE IF NOT EXISTS public.company_ingestion_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    as_of_date DATE NOT NULL,
    news_count INT NOT NULL DEFAULT 0,
    github_count INT NOT NULL DEFAULT 0,
    research_count INT NOT NULL DEFAULT 0,
    jobs_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_name, as_of_date)
);
CREATE INDEX IF NOT EXISTS idx_ingestion_ledger_comp_date ON public.company_ingestion_ledger (company_name, as_of_date);

-- 9. Trend Build Runs Table (Execution, Token & Embedding Telemetry)
CREATE TABLE IF NOT EXISTS public.trend_build_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    stories_ingested INT DEFAULT 0,
    clusters_created INT DEFAULT 0,
    clusters_merged INT DEFAULT 0,
    embedding_duration_seconds FLOAT DEFAULT 0.0,
    llm_calls_count INT DEFAULT 0,
    llm_tokens_used INT DEFAULT 0,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Additive Vector Columns on Consolidated Events and Research Items
ALTER TABLE public.consolidated_events ADD COLUMN IF NOT EXISTS embedding_384 vector(384);
ALTER TABLE public.research_items ADD COLUMN IF NOT EXISTS embedding_384 vector(384);

-- ----------------------------------------------------------------------------
-- 11. Row Level Security (RLS) Configuration
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_entity_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_cluster_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_trend_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_trend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_ingestion_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_build_runs ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke public and anonymous access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Tenant-scoped policies for tenant_trend_views
DROP POLICY IF EXISTS tenant_trend_views_isolation ON public.tenant_trend_views;
CREATE POLICY tenant_trend_views_isolation ON public.tenant_trend_views
    FOR SELECT TO authenticated
    USING (tenant_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::uuid);

-- Tenant-scoped policies for tenant_trend_snapshots
DROP POLICY IF EXISTS tenant_trend_snapshots_isolation ON public.tenant_trend_snapshots;
CREATE POLICY tenant_trend_snapshots_isolation ON public.tenant_trend_snapshots
    FOR SELECT TO authenticated
    USING (tenant_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::uuid);

-- Authenticated access to trend_clusters ONLY through valid tenant_trend_views
DROP POLICY IF EXISTS trend_clusters_tenant_read ON public.trend_clusters;
CREATE POLICY trend_clusters_tenant_read ON public.trend_clusters
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_trend_views v
            WHERE v.cluster_id = public.trend_clusters.cluster_id
              AND v.tenant_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::uuid
        )
    );

-- Authenticated access to trend_cluster_members ONLY for tracked companies in tenant's view
DROP POLICY IF EXISTS trend_cluster_members_tenant_read ON public.trend_cluster_members;
CREATE POLICY trend_cluster_members_tenant_read ON public.trend_cluster_members
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_trend_views v
            WHERE v.cluster_id = public.trend_cluster_members.cluster_id
              AND v.tenant_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::uuid
              AND public.trend_cluster_members.canonical_company = ANY(v.tracked_companies_present)
        )
    );

-- Grant SELECT on the 9 new tables to prismiq_readonly if role exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'prismiq_readonly') THEN
        GRANT SELECT ON public.company_aliases TO prismiq_readonly;
        GRANT SELECT ON public.global_entity_exclusions TO prismiq_readonly;
        GRANT SELECT ON public.trend_clusters TO prismiq_readonly;
        GRANT SELECT ON public.trend_cluster_members TO prismiq_readonly;
        GRANT SELECT ON public.trend_cluster_lineage TO prismiq_readonly;
        GRANT SELECT ON public.tenant_trend_views TO prismiq_readonly;
        GRANT SELECT ON public.tenant_trend_snapshots TO prismiq_readonly;
        GRANT SELECT ON public.company_ingestion_ledger TO prismiq_readonly;
        GRANT SELECT ON public.trend_build_runs TO prismiq_readonly;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ROLLBACK SCRIPT (Execute manually only if reverting this migration):
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.trend_cluster_members CASCADE;
-- DROP TABLE IF EXISTS public.tenant_trend_views CASCADE;
-- DROP TABLE IF EXISTS public.tenant_trend_snapshots CASCADE;
-- DROP TABLE IF EXISTS public.trend_cluster_lineage CASCADE;
-- DROP TABLE IF EXISTS public.trend_clusters CASCADE;
-- DROP TABLE IF EXISTS public.company_ingestion_ledger CASCADE;
-- DROP TABLE IF EXISTS public.trend_build_runs CASCADE;
-- DROP TABLE IF EXISTS public.company_aliases CASCADE;
-- DROP TABLE IF EXISTS public.global_entity_exclusions CASCADE;
-- ALTER TABLE public.consolidated_events DROP COLUMN IF EXISTS embedding_384;
-- ALTER TABLE public.research_items DROP COLUMN IF EXISTS embedding_384;
-- ----------------------------------------------------------------------------
