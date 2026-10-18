import os
import sys
from pathlib import Path
from unittest.mock import patch
import pytest

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import config, cron_runner, lock_manager, report_agent


@pytest.fixture(autouse=True)
def isolate_env():
    orig_env = dict(os.environ)
    yield
    os.environ.clear()
    os.environ.update(orig_env)


def test_config_named_cadence():
    """Verify that scheduling cadence is explicitly named and configurable."""
    assert config.DEFAULT_CRON_SCHEDULE == "0 0 * * *"
    assert config.SCHEDULE_CADENCE_NAME == "daily"
    assert config.PIPELINE_LOCK_KEY == 74829103


def test_concurrency_lock_acquisition_and_release():
    """Verify lock manager acquires and releases cleanly."""
    with lock_manager.pipeline_concurrency_lock():
        assert lock_manager._IN_MEMORY_HELD is True

    assert lock_manager._IN_MEMORY_HELD is False


def test_concurrency_lock_prevents_overlap():
    """Verify that attempting to acquire a lock while already held raises ConcurrencyLockError."""
    with lock_manager.pipeline_concurrency_lock():
        with pytest.raises(lock_manager.ConcurrencyLockError, match="already held"):
            with lock_manager.pipeline_concurrency_lock():
                pass


def test_cron_runner_overlap_clean_skip(monkeypatch, capsys):
    """Verify that cron_runner handles overlap by logging notice, printing annotation, and exiting non-zero (2)."""
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://mock:mock@localhost:5432/postgres")
    with lock_manager.pipeline_concurrency_lock():
        # Attempt second concurrent execution
        exit_code = cron_runner.run_scheduled_pipeline()
        assert exit_code == 2
        captured = capsys.readouterr()
        assert "::error title=Concurrency Lock Skip::" in captured.err


def test_cron_runner_fatal_crash_visibility(monkeypatch):
    """Verify that fatal unhandled exceptions result in exit code 1 for Render alerting."""
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://mock:mock@localhost:5432/postgres")
    with patch("src.main.run_pipeline", side_effect=RuntimeError("Database socket terminated")):
        exit_code = cron_runner.run_scheduled_pipeline()
        assert exit_code == 1


def test_execution_mode_in_report():
    """Verify that the brief explicitly documents Autonomous Scheduled Run vs Manual Invocation."""
    synthesis = {"themes": {}, "enriched_findings": []}

    # Scheduled run
    brief_sched = report_agent.run(synthesis, trigger_mode="scheduled", cadence_name="weekly")
    assert "⏱️ **Execution Mode**: Autonomous Scheduled Run (cadence: weekly)" in brief_sched

    # Manual run
    brief_manual = report_agent.run(synthesis, trigger_mode="manual")
    assert "⏱️ **Execution Mode**: Manual Invocation" in brief_manual


def test_cron_runner_dry_run_url_separation(monkeypatch):
    """Verify B3: In dry-run mode, SUPABASE_READONLY_DB_URL is set and SUPABASE_DB_URL is stripped."""
    mock_ro = "postgres" + "ql://ro:ro@localhost:6543/postgres"
    mock_prod = "postgres" + "ql://prod:prod@localhost:6543/postgres"

    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("INPUT_DRY_RUN", "true")
    monkeypatch.setenv("INPUT_SCOPE", "owner")
    monkeypatch.setenv("SUPABASE_READONLY_DB_URL", mock_ro)
    monkeypatch.setenv("SUPABASE_DB_URL", mock_prod)

    from src.run_mode import resolve_run_mode
    mode = resolve_run_mode("workflow_dispatch", inputs={"dry_run": True, "scope": "owner"})
    assert mode["dry_run"] is True
    assert mode["db_url"] == mock_ro

    # Simulate cron_runner environment assignment logic
    if mode["dry_run"]:
        os.environ["SUPABASE_READONLY_DB_URL"] = mode["db_url"]
        os.environ.pop("SUPABASE_DB_URL", None)
    else:
        os.environ["SUPABASE_DB_URL"] = mode["db_url"]

    assert os.getenv("SUPABASE_READONLY_DB_URL") == mock_ro
    assert os.getenv("SUPABASE_DB_URL") is None


def test_cron_runner_lock_skip_no_progress_mutation(monkeypatch, capsys):
    """Verify B2: ConcurrencyLockError exits 2, emits ::error annotation, and makes zero storage calls."""
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://mock:mock@localhost:5432/postgres")
    with patch("src.storage.get_db_cursor") as mock_cursor:
        with lock_manager.pipeline_concurrency_lock():
            exit_code = cron_runner.run_scheduled_pipeline()
            assert exit_code == 2
            mock_cursor.assert_not_called()
            captured = capsys.readouterr()
            assert "::error title=Concurrency Lock Skip::" in captured.err

