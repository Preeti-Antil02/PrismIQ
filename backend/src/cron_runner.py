"""
Autonomous Scheduled Pipeline Runner for PrismIQ.

Intended for invocation by Render Cron Job (e.g. weekly cadence '0 0 * * 0').
Enforces:
1. Concurrency safety: Acquires PostgreSQL distributed advisory lock. If an existing run
   is in progress, cleanly logs overlap skip notice and exits 0 without corrupting state.
2. Failure visibility: If a fatal unhandled error occurs, logs structured traceback and exits 1
   to trigger Render job failure notifications.
3. Execution mode tracking: Sets PIPELINE_TRIGGER_MODE='scheduled' so downstream reports
   clearly differentiate autonomous scheduled runs from manual invocations.
"""

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure UTF-8 stdout on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

# Step 1: Resolve run_mode BEFORE importing storage or config
import json
from src.run_mode import resolve_run_mode

def _is_test_env() -> bool:
    return (
        os.getenv("PRISMIQ_ENV") == "test"
        or "PYTEST_CURRENT_TEST" in os.environ
        or "pytest" in sys.modules
        or any(arg.endswith("pytest") or "pytest" in arg for arg in sys.argv)
    )

event_name = os.getenv("GITHUB_EVENT_NAME", "schedule")
inputs = {
    "scope": os.getenv("INPUT_SCOPE"),
    "dry_run": os.getenv("INPUT_DRY_RUN"),
}
if _is_test_env() and not os.getenv("SUPABASE_DB_URL") and not os.getenv("SUPABASE_READONLY_DB_URL"):
    mode = {
        "trigger_mode": "test",
        "scope": "owner",
        "allow_live_write": False,
        "dry_run": False,
        "db_url": "",
    }
else:
    mode = resolve_run_mode(event_name, inputs=inputs)
    os.environ["PIPELINE_TRIGGER_MODE"] = mode["trigger_mode"]
    os.environ["PIPELINE_SCOPE"] = mode["scope"]
    os.environ["ALLOW_LIVE_WRITE"] = "true" if mode["allow_live_write"] else "false"
    os.environ["DRY_RUN"] = "true" if mode["dry_run"] else "false"
    if mode["dry_run"]:
        os.environ["SUPABASE_READONLY_DB_URL"] = mode["db_url"]
        # Guarantee SUPABASE_DB_URL is stripped in dry-run so code never accesses write URL
        os.environ.pop("SUPABASE_DB_URL", None)
    else:
        os.environ["SUPABASE_DB_URL"] = mode["db_url"]

# Step 2: Import modules dependent on environment
from src import config
from src.lock_manager import ConcurrencyLockError, pipeline_concurrency_lock

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [cron_runner] %(message)s",
)
logger = logging.getLogger("cron_runner")


def run_scheduled_pipeline() -> int:
    """
    Execute autonomous scheduled run with concurrency protection and error alerting.
    Returns:
        0 on success.
        2 on lock overlap skip (fails visibly with annotation).
        1 on unhandled fatal crash.
    """
    start_time = datetime.now(timezone.utc)
    logger.info(
        f"Starting pipeline run (Trigger: {os.environ.get('PIPELINE_TRIGGER_MODE')}, Scope: {os.environ.get('PIPELINE_SCOPE')}, "
        f"DryRun: {os.environ.get('DRY_RUN')}, LiveWrites: {os.environ.get('ALLOW_LIVE_WRITE')}, "
        f"Cadence: {config.SCHEDULE_CADENCE_NAME}, Target: {config.TARGET_COMPANY})..."
    )

    try:
        with pipeline_concurrency_lock():
            from src import main
            brief_content = main.run_pipeline()
            duration_s = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(
                f"Autonomous scheduled pipeline run completed successfully in {duration_s:.1f}s. "
                f"Generated brief length: {len(brief_content)} chars."
            )

            # Emit structured execution summary JSON to logs and $GITHUB_STEP_SUMMARY
            summary_dict = main.get_pipeline_summary_metrics()
            summary_str = json.dumps(summary_dict, indent=2)
            logger.info(f"[STRUCTURED METRICS SUMMARY]:\n{summary_str}")

            step_summary_file = os.getenv("GITHUB_STEP_SUMMARY")
            if step_summary_file:
                try:
                    with open(step_summary_file, "a", encoding="utf-8") as f:
                        f.write(f"\n### Pipeline Execution Summary\n```json\n{summary_str}\n```\n")
                except Exception as ef:
                    logger.warning(f"Failed writing to GITHUB_STEP_SUMMARY: {ef}")

            return 0

    except ConcurrencyLockError as cle:
        logger.warning(f"[OVERLAP NOTICE] {cle}")
        # Visible annotation in GitHub Actions (actions has no neutral status)
        print(f"::error title=Concurrency Lock Skip::{cle}", file=sys.stderr)
        # Exit non-zero (code 2) so overlap is visible, not falsely green
        return 2

    except Exception as e:
        logger.critical(
            f"[FATAL PIPELINE CRASH] Unhandled error during scheduled run: {e}",
            exc_info=True,
        )
        return 1


if __name__ == "__main__":
    exit_code = run_scheduled_pipeline()
    sys.exit(exit_code)
