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
        0 on success or clean overlap skip.
        1 on unhandled fatal crash.
    """
    os.environ["PIPELINE_TRIGGER_MODE"] = "scheduled"
    start_time = datetime.now(timezone.utc)
    logger.info(
        f"Starting autonomous scheduled pipeline run (Cadence: {config.SCHEDULE_CADENCE_NAME}, "
        f"Schedule: '{config.DEFAULT_CRON_SCHEDULE}', Target: {config.TARGET_COMPANY})..."
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
            return 0

    except ConcurrencyLockError as cle:
        logger.warning(f"[OVERLAP NOTICE] {cle}")
        logger.warning("Overlapping cron trigger skipped cleanly. No database corruption occurred.")
        return 0

    except Exception as e:
        logger.critical(
            f"[FATAL PIPELINE CRASH] Unhandled error during scheduled run: {e}",
            exc_info=True,
        )
        return 1


if __name__ == "__main__":
    exit_code = run_scheduled_pipeline()
    sys.exit(exit_code)
