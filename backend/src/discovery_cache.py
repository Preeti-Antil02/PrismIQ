"""
Persistent Deterministic Query-Result Cache for PrismIQ Discovery Agent.

Provides deterministic, time-boxed caching of multi-source retrieval queries
and candidate discovery context to eliminate run-to-run instability caused by
unauthenticated HTML search variance.
"""

import hashlib
import json
import logging
import os
import re
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Default cache TTL: 24 hours (86,400 seconds)
DEFAULT_CACHE_TTL_SECONDS = int(os.getenv("DISCOVERY_CACHE_TTL_SECONDS", "86400"))


def _get_cache_db_path() -> Path:
    """Return path to persistent SQLite discovery cache file."""
    backend_root = Path(__file__).resolve().parent.parent
    cache_dir = backend_root / "data" / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "discovery_retrieval_cache.db"


def _init_db(db_path: Path) -> None:
    """Initialize database schema if not already present."""
    with sqlite3.connect(db_path, timeout=10.0) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS query_cache (
                cache_key TEXT PRIMARY KEY,
                company_clean TEXT NOT NULL,
                query_text TEXT NOT NULL,
                provider TEXT NOT NULL,
                results_json TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_company ON query_cache(company_clean);")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS context_cache (
                company_clean TEXT PRIMARY KEY,
                sources_json TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS discovery_run_cache (
                company_clean TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL
            );
        """)
        conn.commit()


def _make_key(company_clean: str, query_text: str, provider: str = "default") -> str:
    """Compute deterministic SHA-256 cache key from company, query, and provider."""
    raw = f"{company_clean.strip().lower()}::{provider.strip().lower()}::{query_text.strip().lower()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_cached_query_results(
    company: str,
    query: str,
    provider: str = "default",
) -> Optional[List[Dict[str, Any]]]:
    """
    Retrieve cached query results if present and unexpired.
    Returns None if cache miss or expired.
    """
    db_path = _get_cache_db_path()
    _init_db(db_path)
    c_clean = company.strip().lower()
    key = _make_key(c_clean, query, provider)
    now = time.time()

    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            row = conn.execute(
                "SELECT results_json, expires_at FROM query_cache WHERE cache_key = ?",
                (key,),
            ).fetchone()
            if row:
                results_json, expires_at = row
                if expires_at > now:
                    logger.debug(f"Discovery cache HIT for query '{query}' ({company})")
                    return json.loads(results_json)
                else:
                    logger.debug(f"Discovery cache EXPIRED for query '{query}' ({company})")
    except Exception as e:
        logger.warning(f"Error reading query cache for '{company}': {e}")

    return None


def set_cached_query_results(
    company: str,
    query: str,
    results: List[Dict[str, Any]],
    provider: str = "default",
    ttl_seconds: Optional[int] = None,
) -> None:
    """Store query results in persistent SQLite cache with specified TTL."""
    if not results:
        return

    db_path = _get_cache_db_path()
    _init_db(db_path)
    c_clean = company.strip().lower()
    key = _make_key(c_clean, query, provider)
    now = time.time()
    ttl = ttl_seconds if ttl_seconds is not None else DEFAULT_CACHE_TTL_SECONDS
    expires_at = now + ttl

    try:
        payload = json.dumps(results, ensure_ascii=False)
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            conn.execute(
                """
                INSERT INTO query_cache (cache_key, company_clean, query_text, provider, results_json, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    results_json = EXCLUDED.results_json,
                    created_at = EXCLUDED.created_at,
                    expires_at = EXCLUDED.expires_at;
                """,
                (key, c_clean, query, provider, payload, now, expires_at),
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"Error writing query cache for '{company}': {e}")


def get_cached_company_context(company: str) -> Optional[List[Dict[str, Any]]]:
    """Retrieve full cached context sources for a company if unexpired."""
    db_path = _get_cache_db_path()
    _init_db(db_path)
    c_clean = company.strip().lower()
    now = time.time()

    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            row = conn.execute(
                "SELECT sources_json, expires_at FROM context_cache WHERE company_clean = ?",
                (c_clean,),
            ).fetchone()
            if row:
                sources_json, expires_at = row
                if expires_at > now:
                    logger.debug(f"Discovery company context HIT for '{company}'")
                    return json.loads(sources_json)
    except Exception as e:
        logger.warning(f"Error reading context cache for '{company}': {e}")

    return None


def set_cached_company_context(
    company: str,
    sources: List[Dict[str, Any]],
    ttl_seconds: Optional[int] = None,
) -> None:
    """Store full grounded context sources for a company with TTL."""
    if not sources:
        return

    db_path = _get_cache_db_path()
    _init_db(db_path)
    c_clean = company.strip().lower()
    now = time.time()
    ttl = ttl_seconds if ttl_seconds is not None else DEFAULT_CACHE_TTL_SECONDS
    expires_at = now + ttl

    try:
        payload = json.dumps(sources, ensure_ascii=False)
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            conn.execute(
                """
                INSERT INTO context_cache (company_clean, sources_json, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(company_clean) DO UPDATE SET
                    sources_json = EXCLUDED.sources_json,
                    created_at = EXCLUDED.created_at,
                    expires_at = EXCLUDED.expires_at;
                """,
                (c_clean, payload, now, expires_at),
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"Error writing context cache for '{company}': {e}")


def get_cached_discovery_run(company: str) -> Optional[Dict[str, Any]]:
    """Retrieve full cached discovery result payload for a company if unexpired."""
    db_path = _get_cache_db_path()
    _init_db(db_path)
    c_clean = company.strip().lower()
    now = time.time()

    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            row = conn.execute(
                "SELECT payload_json, expires_at FROM discovery_run_cache WHERE company_clean = ?",
                (c_clean,),
            ).fetchone()
            if row:
                payload_json, expires_at = row
                if expires_at > now:
                    data = json.loads(payload_json)
                    # Invariant: Never serve stale low-confidence or empty runs from cache
                    if data.get("is_low_confidence_profile", False) or not data.get("candidates"):
                        logger.info(f"Invalidating stale low-confidence/empty cached discovery run for '{company}'")
                        return None
                    logger.info(f"Discovery candidate run cache HIT for '{company}' ({len(data.get('candidates', []))} candidates)")
                    return data
    except Exception as e:
        logger.warning(f"Error reading discovery run cache for '{company}': {e}")

    return None


def set_cached_discovery_run(
    company: str,
    payload: Dict[str, Any],
    ttl_seconds: Optional[int] = None,
) -> None:
    """Store full discovery result payload for a company with TTL. Invariant: only cache confident, non-empty proposals."""
    if not payload:
        return

    # Invariant: NEVER cache low-confidence or empty candidate runs for 24 hours
    if payload.get("is_low_confidence_profile", False) or not payload.get("candidates"):
        logger.info(f"Skipping 24h discovery run cache for '{company}': low-confidence or empty candidate run.")
        return

    db_path = _get_cache_db_path()
    _init_db(db_path)
    c_clean = company.strip().lower()
    now = time.time()
    ttl = ttl_seconds if ttl_seconds is not None else DEFAULT_CACHE_TTL_SECONDS
    expires_at = now + ttl

    try:
        data_str = json.dumps(payload, ensure_ascii=False)
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            conn.execute(
                """
                INSERT INTO discovery_run_cache (company_clean, payload_json, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(company_clean) DO UPDATE SET
                    payload_json = EXCLUDED.payload_json,
                    created_at = EXCLUDED.created_at,
                    expires_at = EXCLUDED.expires_at;
                """,
                (c_clean, data_str, now, expires_at),
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"Error writing discovery run cache for '{company}': {e}")


def clear_cache_for_company(company: str) -> None:
    """
    Clear all cached queries, context, and runs for a company and all related slug/domain variants.
    Guarantees no stale or homonym cache artifacts remain when re-running discovery.
    """
    db_path = _get_cache_db_path()
    _init_db(db_path)
    c_clean = company.strip().lower()
    if not c_clean:
        return

    # Generate all brand and domain variants to purge
    keys_to_clear = {c_clean}
    slug = re.sub(r'[^a-z0-9]+', '', c_clean)
    if slug:
        keys_to_clear.add(slug)
    # Strip common TLDs if user entered domain or URL
    base_domain = re.sub(r'\.(in|com|ai|io|co|net|org|tech|app)$', '', c_clean)
    if base_domain:
        keys_to_clear.add(base_domain)
        keys_to_clear.add(re.sub(r'[^a-z0-9]+', '', base_domain))
    # Strip brand suffixes (ai, tech, labs, hq)
    base_slug = re.sub(r'(ai|tech|labs|hq|software|app)$', '', slug)
    if len(base_slug) >= 3:
        keys_to_clear.add(base_slug)

    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            for k in keys_to_clear:
                conn.execute("DELETE FROM query_cache WHERE company_clean = ?", (k,))
                conn.execute("DELETE FROM context_cache WHERE company_clean = ?", (k,))
                conn.execute("DELETE FROM discovery_run_cache WHERE company_clean = ?", (k,))
            conn.commit()
        logger.info(f"Cleared discovery cache for '{company}' (keys purged: {keys_to_clear})")
    except Exception as e:
        logger.warning(f"Error clearing cache for '{company}': {e}")
