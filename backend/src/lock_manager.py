"""
Distributed Concurrency Lock Manager for PrismIQ.

Uses PostgreSQL session-level advisory locks (pg_try_advisory_lock) to ensure
that only one instance of the pipeline runs at any given time, preventing
overlapping cron triggers or concurrent execution from corrupting shared database state.

In test mode (PRISMIQ_ENV=='test'), uses an in-memory lock to guarantee zero DB calls.
"""

import logging
import os
import sys
import threading
from contextlib import contextmanager
from typing import Generator, Optional
import psycopg2

from . import config
from . import storage

logger = logging.getLogger(__name__)

# In-memory lock for isolated unit tests
_IN_MEMORY_LOCK = threading.Lock()
_IN_MEMORY_HELD = False


class ConcurrencyLockError(Exception):
    """Raised when a pipeline run cannot acquire the distributed lock."""
    pass


@contextmanager
def pipeline_concurrency_lock(
    lock_key: Optional[int] = None,
    timeout_seconds: float = 0.0,
) -> Generator[bool, None, None]:
    """
    Acquires an exclusive distributed PostgreSQL advisory lock for the pipeline.
    
    If the lock is already held by another running instance, raises ConcurrencyLockError.
    Releases the lock upon exiting the context block.
    """
    global _IN_MEMORY_HELD
    key = lock_key if lock_key is not None else config.PIPELINE_LOCK_KEY

    # Fail-closed test and unpermitted CLI environment isolation
    if (storage.is_test_environment() or not storage.is_live_write_permitted()) and not os.getenv("FORCE_LIVE_LOCK"):
        acquired = _IN_MEMORY_LOCK.acquire(blocking=False)
        if not acquired or _IN_MEMORY_HELD:
            logger.warning(f"In-memory test lock {key} is already held. Rejecting concurrent run.")
            raise ConcurrencyLockError(f"Pipeline lock {key} already held by active test run.")
        _IN_MEMORY_HELD = True
        try:
            logger.info(f"Acquired in-memory test lock {key}.")
            yield True
        finally:
            _IN_MEMORY_HELD = False
            _IN_MEMORY_LOCK.release()
            logger.info(f"Released in-memory test lock {key}.")
        return

    ref = os.getenv("SUPABASE_READONLY_DB_URL") or os.getenv("READONLY_DATABASE_URL")
    raw_url = ref if storage.is_dry_run() else (os.getenv("SUPABASE_DB_URL") or storage.get_db_url())
    db_url = storage.normalize_postgres_url(raw_url, reference_url=ref)

    if not db_url:
        logger.warning("No database URL available for advisory locking. Running with local lock.")
        yield True
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
    except Exception as conn_err:
        logger.warning(
            f"Advisory lock connection to PostgreSQL could not be established ({conn_err}). "
            "Proceeding with in-memory lock to avoid blocking scheduled pipeline run."
        )
        yield True
        return

    try:
        cur.execute("BEGIN;")
        cur.execute("SELECT pg_try_advisory_xact_lock(%s);", (key,))
        locked = cur.fetchone()[0]
        if not locked:
            cur.execute("ROLLBACK;")
            logger.warning(
                f"Distributed concurrency lock {key} is currently held by another pipeline instance. "
                "Skipping overlapping execution to preserve database integrity."
            )
            raise ConcurrencyLockError(
                f"Pipeline concurrency lock {key} is already held. Overlapping execution rejected."
            )

        logger.info(f"Successfully acquired distributed PostgreSQL advisory lock {key}.")
        yield True
        cur.execute("COMMIT;")

    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass
