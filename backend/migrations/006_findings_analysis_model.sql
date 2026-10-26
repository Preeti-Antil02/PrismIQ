-- ============================================================================
-- Migration: 006_findings_analysis_model.sql
-- Description: Adds provenance columns to findings table:
--              - analysis_model: Exact LLM identifier used (e.g. openai/gpt-oss-120b)
--              - is_fallback: Boolean flag preserving historical fallback markings
--              - analysis_source: 'llm' vs 'deterministic_hiring' vs 'synthetic_fallback'
-- DO NOT EXECUTE AUTOMATICALLY. Stored as draft SQL migration only.
-- ============================================================================

-- Add additive columns without forcing 'llm' default onto historical rows
ALTER TABLE public.findings 
    ADD COLUMN IF NOT EXISTS analysis_model text,
    ADD COLUMN IF NOT EXISTS is_fallback boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS analysis_source text;

-- Create index on tenant_id, created_at, and analysis_source for fast scans
CREATE INDEX IF NOT EXISTS idx_findings_tenant_analysis_provenance 
    ON public.findings (tenant_id, created_at DESC, analysis_source);

-- ----------------------------------------------------------------------------
-- DRAFT BACKFILL (DO NOT EXECUTE WITHOUT OWNER APPROVAL):
-- Derived directly from fallback templates defined in backend/src/analysis_agent.py
-- (Line 553 for deterministic hiring, Lines 215-235 for 8 synthetic fallback patterns).
-- ----------------------------------------------------------------------------
-- 1. Identify and label historical deterministic hiring findings (analysis_agent.py:553):
-- UPDATE public.findings
-- SET analysis_source = 'deterministic_hiring',
--     is_fallback = false
-- WHERE why_it_matters LIKE 'Routine operational hiring for %'
--   AND analysis_source IS NULL;

-- 2. Identify and label historical synthetic template fallbacks (analysis_agent.py:215-235):
-- UPDATE public.findings
-- SET analysis_source = 'synthetic_fallback',
--     is_fallback = true
-- WHERE (
--        why_it_matters LIKE 'The source documents that % has engaged in strategic M&A activity%'
--     OR why_it_matters LIKE 'The source documents that % secured significant financing%'
--     OR why_it_matters LIKE 'The source verifies regulatory and legal proceedings involving%'
--     OR why_it_matters LIKE 'The source confirms that % achieved industry analyst recognition in the Gartner Market Overview%'
--     OR why_it_matters LIKE 'The source announces product advancements from%'
--     OR why_it_matters LIKE 'The source confirms executive leadership additions at%'
--     OR why_it_matters LIKE 'The source documents that % This reflects active commercial positioning and operational momentum for %'
--     OR why_it_matters LIKE 'The source documents that % announced updates regarding %, representing ongoing product and operational activity in the sector.'
-- )
-- AND analysis_source IS NULL;

-- 3. Label remaining historical findings as genuine LLM analyses:
-- UPDATE public.findings
-- SET analysis_source = 'llm',
--     is_fallback = false
-- WHERE analysis_source IS NULL;

-- ----------------------------------------------------------------------------
-- ROLLBACK SCRIPT:
-- DROP INDEX IF EXISTS public.idx_findings_tenant_analysis_provenance;
-- ALTER TABLE public.findings 
--     DROP COLUMN IF EXISTS analysis_model,
--     DROP COLUMN IF EXISTS is_fallback,
--     DROP COLUMN IF EXISTS analysis_source;
-- ----------------------------------------------------------------------------
