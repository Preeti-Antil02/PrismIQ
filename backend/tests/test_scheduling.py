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


def test_config_named_cadence():
    """Verify that scheduling cadence is explicitly named and configurable."""
    assert config.DEFAULT_CRON_SCHEDULE == "0 0 * * 0"
    assert config.SCHEDULE_CADENCE_NAME == "weekly"
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


def test_cron_runner_overlap_clean_skip():
    """Verify that cron_runner handles overlap by logging notice and exiting 0 without crashing."""
    with lock_manager.pipeline_concurrency_lock():
        # Attempt second concurrent execution
        exit_code = cron_runner.run_scheduled_pipeline()
        assert exit_code == 0


def test_cron_runner_fatal_crash_visibility():
    """Verify that fatal unhandled exceptions result in exit code 1 for Render alerting."""
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
