-- Migration 004: Add primary_domain and industry_category to tenant_tracked_companies and discovery_candidates
ALTER TABLE tenant_tracked_companies 
ADD COLUMN IF NOT EXISTS primary_domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS industry_category VARCHAR(255);

ALTER TABLE discovery_candidates 
ADD COLUMN IF NOT EXISTS domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS category VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ttc_domain ON tenant_tracked_companies(primary_domain);
