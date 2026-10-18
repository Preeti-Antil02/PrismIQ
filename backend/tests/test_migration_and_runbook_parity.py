"""
Test migration safety and parity between SQL migration files and docs/OWNER_RUNBOOK.md.
"""
import re
from pathlib import Path
import pytest
from scripts.security_check import check_migration_safety

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_migration_safety_check_passes():
    """Verify check_migration_safety detects no live destructive SQL statements."""
    issues = check_migration_safety()
    assert len(issues) == 0, f"Destructive migration statements found: {issues}"


def test_runbook_g1b_sql_matches_migration_007():
    """Verify inline G1b SQL in OWNER_RUNBOOK.md matches migration 007 core statements."""
    runbook_text = (REPO_ROOT / "docs" / "OWNER_RUNBOOK.md").read_text(encoding="utf-8")
    mig_007_text = (REPO_ROOT / "backend" / "migrations" / "007_readonly_role_and_rls.sql").read_text(encoding="utf-8")

    # Key security statements from 007 that must be identical in the runbook:
    core_statements = [
        "CREATE ROLE prismiq_readonly WITH LOGIN;",
        "ALTER ROLE prismiq_readonly SET default_transaction_read_only = on;",
        "GRANT CONNECT ON DATABASE postgres TO prismiq_readonly;",
        "GRANT USAGE ON SCHEMA public TO prismiq_readonly;",
        "GRANT SELECT ON TABLE public.%I TO prismiq_readonly;",
        "DROP POLICY IF EXISTS readonly_select_policy ON public.%I;",
        "CREATE POLICY readonly_select_policy ON public.%I FOR SELECT TO prismiq_readonly USING (true);",
        "GRANT SELECT (tenant_id, slack_channel, delivery_cadence, is_enabled, created_at, updated_at) ON public.tenant_delivery_configs TO prismiq_readonly;",
        "REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM prismiq_readonly;",
        "REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM prismiq_readonly;",
    ]

    for stmt in core_statements:
        assert stmt in mig_007_text, f"Statement missing from 007_readonly_role_and_rls.sql: {stmt}"
        assert stmt in runbook_text, f"Statement missing from docs/OWNER_RUNBOOK.md G1b: {stmt}"


def test_runbook_g1c_sql_matches_migration_005_and_006():
    """Verify inline G1c SQL in OWNER_RUNBOOK.md matches migrations 005 and 006."""
    runbook_text = (REPO_ROOT / "docs" / "OWNER_RUNBOOK.md").read_text(encoding="utf-8")
    mig_005_text = (REPO_ROOT / "backend" / "migrations" / "005_scheduled_tenants.sql").read_text(encoding="utf-8")
    mig_006_text = (REPO_ROOT / "backend" / "migrations" / "006_findings_analysis_model.sql").read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS public.scheduled_tenants (" in mig_005_text
    assert "CREATE TABLE IF NOT EXISTS public.scheduled_tenants (" in runbook_text

    assert "ADD COLUMN IF NOT EXISTS analysis_model text," in mig_006_text
    assert "ADD COLUMN IF NOT EXISTS analysis_model text," in runbook_text

    assert "CREATE INDEX IF NOT EXISTS idx_findings_tenant_analysis_provenance" in mig_006_text
    assert "CREATE INDEX IF NOT EXISTS idx_findings_tenant_analysis_provenance" in runbook_text
