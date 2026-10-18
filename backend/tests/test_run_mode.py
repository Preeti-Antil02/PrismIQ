import pytest
from src.run_mode import resolve_run_mode


def test_resolve_run_mode_schedule():
    """Verify schedule event sets live writes ON, scope=scheduled, prod DB URL."""
    env = {"SUPABASE_DB_URL": "postgresql://postgres:prod@db.supabase.com:5432/postgres"}
    mode = resolve_run_mode("schedule", env=env)
    assert mode["trigger_mode"] == "scheduled"
    assert mode["scope"] == "scheduled"
    assert mode["dry_run"] is False
    assert mode["allow_live_write"] is True
    assert mode["db_url"] == env["SUPABASE_DB_URL"]


def test_resolve_run_mode_dispatch_live_owner():
    """Verify workflow_dispatch with dry_run=false, scope=owner sets live writes ON."""
    env = {"SUPABASE_DB_URL": "postgresql://postgres:prod@db.supabase.com:5432/postgres"}
    inputs = {"dry_run": False, "scope": "owner"}
    mode = resolve_run_mode("workflow_dispatch", inputs=inputs, env=env)
    assert mode["trigger_mode"] == "manual"
    assert mode["scope"] == "owner"
    assert mode["dry_run"] is False
    assert mode["allow_live_write"] is True
    assert mode["db_url"] == env["SUPABASE_DB_URL"]


def test_resolve_run_mode_dispatch_live_all():
    """Verify workflow_dispatch with scope=all automatically maps to scheduled to avoid timeouts."""
    env = {"SUPABASE_DB_URL": "postgresql://postgres:prod@db.supabase.com:5432/postgres"}
    inputs = {"dry_run": "false", "scope": "all"}
    mode = resolve_run_mode("workflow_dispatch", inputs=inputs, env=env)
    assert mode["trigger_mode"] == "manual"
    assert mode["scope"] == "scheduled"
    assert mode["dry_run"] is False
    assert mode["allow_live_write"] is True


def test_resolve_run_mode_dispatch_dry_run():
    """Verify workflow_dispatch with dry_run=true sets DRY_RUN=true, live writes OFF, read-only URL."""
    env = {
        "SUPABASE_DB_URL": "postgresql://postgres:prod@db.supabase.com:5432/postgres",
        "SUPABASE_READONLY_DB_URL": "postgresql://prismiq_readonly:ro@db.supabase.com:5432/postgres",
    }
    inputs = {"dry_run": True, "scope": "owner"}
    mode = resolve_run_mode("workflow_dispatch", inputs=inputs, env=env)
    assert mode["trigger_mode"] == "manual"
    assert mode["scope"] == "owner"
    assert mode["dry_run"] is True
    assert mode["allow_live_write"] is False
    assert mode["db_url"] == env["SUPABASE_READONLY_DB_URL"]
    assert mode["db_url"] != env["SUPABASE_DB_URL"]


def test_resolve_run_mode_dry_run_missing_ro_secret_fails():
    """Verify dry_run FAILS if SUPABASE_READONLY_DB_URL is missing or empty, never exporting prod URL."""
    env = {"SUPABASE_DB_URL": "postgresql://postgres:prod@db.supabase.com:5432/postgres"}
    inputs = {"dry_run": True, "scope": "owner"}
    with pytest.raises(ValueError, match="SUPABASE_READONLY_DB_URL is required"):
        resolve_run_mode("workflow_dispatch", inputs=inputs, env=env)


def test_resolve_run_mode_unknown_event_fails():
    """Verify unknown event name fails loudly."""
    with pytest.raises(ValueError, match="Unsupported pipeline execution event"):
        resolve_run_mode("push", inputs={})
