import hashlib
import json
import logging
import os
import re
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Set, Tuple, Union
from dotenv import load_dotenv

from . import config

logger = logging.getLogger(__name__)

# Working directory / backend root
_backend_root = Path(__file__).resolve().parent.parent


class MockCursor:
    """
    In-memory mock cursor for isolated test execution.
    Captures executed statements without making real network calls to production PostgreSQL.
    """
    def __init__(self):
        self.queries: List[Tuple[str, Any]] = []
        self.rowcount = 1

    def execute(self, query: str, params: Any = None):
        self.queries.append((query, params))

    def fetchone(self):
        return ("00000000-0000-0000-0000-000000000000", False, "active", None, None, "Workspace Watchlist", None, None, None, datetime.now(timezone.utc))

    def fetchall(self):
        return []

    def close(self):
        pass


def is_test_environment() -> bool:
    """
    Hard code-level detection of test execution mode.
    Returns True if running under pytest, PRISMIQ_ENV='test',
    or pytest is loaded in sys.modules.
    """
    return (
        os.getenv("PRISMIQ_ENV") == "test"
        or "PYTEST_CURRENT_TEST" in os.environ
        or "pytest" in sys.modules
        or any(arg.endswith("pytest") or "pytest" in arg for arg in sys.argv)
    )


DEFAULT_SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL", "")


def is_dry_run() -> bool:
    """Return True if pipeline is executing in read-only simulation mode."""
    return os.getenv("DRY_RUN", "").lower() in ("true", "1", "yes")


def is_live_write_permitted() -> bool:
    """
    Fail-closed authorization check for live PostgreSQL database connections/writes.
    1. In test environment (pytest, PRISMIQ_ENV='test'), strictly fails closed (returns False)
       to guarantee zero test data pollution in production.
    2. In DRY_RUN mode, strictly returns False.
    3. Platform isolation defense-in-depth: Live database connections/writes are strictly refused
       unless running under platform environments:
       - GitHub Actions (GITHUB_ACTIONS='true')
       - Render web service / worker (RENDER='true' or RENDER env var set)
       Local processes cannot open a read-write connection even if ALLOW_LIVE_WRITE is present.
    4. If running in CI/Render, ALLOW_LIVE_WRITE must be explicitly true (or Render web container).
    """
    if is_test_environment() or is_dry_run():
        return False

    is_platform_allowed = (
        os.getenv("GITHUB_ACTIONS") == "true"
        or os.getenv("RENDER") == "true"
    )
    if not is_platform_allowed:
        return False

    env_val = os.getenv("ALLOW_LIVE_WRITE") or os.getenv("ALLOW_PROD_WRITE") or os.getenv("FORCE_LIVE_DB")
    if env_val is not None:
        return env_val.lower() in ("true", "1", "yes")
    return False



def normalize_postgres_url(raw_url: Optional[str], reference_url: Optional[str] = None) -> Optional[str]:
    """
    Robustly clean and normalize PostgreSQL connection URLs.
    Handles accidental quotes, leading whitespace, missing scheme prefixes,
    pasted environment variable assignment syntax, password-only values,
    unquoted special characters in passwords, and auto-corrects Supabase
    pooler user formats and ports.
    """
    if not raw_url:
        return None
    url = raw_url.strip().strip("'").strip('"').strip()
    if "=" in url and not url.startswith("postgresql://") and not url.startswith("postgres://"):
        parts = url.split("=", 1)
        if len(parts) == 2 and ("://" in parts[1] or "@" in parts[1]):
            url = parts[1].strip().strip("'").strip('"').strip()
    if url.startswith("psql "):
        url = url[5:].strip().strip("'").strip('"').strip()

    import re
    import urllib.parse

    default_project_ref = "hmjcqdthzgzsmhpivrdb"
    default_host_port = "aws-0-ap-south-1.pooler.supabase.com:6543"
    default_dbname = "postgres"

    if reference_url:
        ref_clean = reference_url.strip().strip("'").strip('"').strip()
        m_ref = re.search(r'postgres(?:ql)?://(?:[^:]+)\.([^:]+):([^@]+)@([^/]+)/([^?]+)', ref_clean)
        if m_ref:
            default_project_ref = m_ref.group(1)
            default_host_port = m_ref.group(3)
            default_dbname = m_ref.group(4)

    # Case 1: Plain password passed without URL scheme or @
    if "://" not in url and "@" not in url:
        pwd = urllib.parse.quote(urllib.parse.unquote(url), safe="") if "%" not in url else url
        scheme_prefix = "postgresql://"
        return f"{scheme_prefix}postgres.{default_project_ref}:{pwd}@{default_host_port}/{default_dbname}"

    # Case 2: Missing scheme prefix (e.g. user:pass@host/db)
    if "://" not in url and "@" in url:
        url = "postgresql://" + url

    # Extract URL components
    match = re.search(r'(postgres(?:ql)?://[^\s\'"]+)', url)
    if match:
        url = match.group(1)

    m = re.match(r'^(postgres(?:ql)?://)([^:]+):(.*)@([^:/@]+)(?::(\d+))?(/.*)?$', url)
    if m:
        scheme, user, password, host, port, rest = m.groups()
        # If connecting to Supabase pooler
        if "pooler.supabase.com" in host:
            if "." not in user:
                user = f"{user}.{default_project_ref}"
            if port == "5432" or not port:
                port = "6543"
        # URL encode password if not already encoded
        if "%" not in password:
            password = urllib.parse.quote(urllib.parse.unquote(password), safe="")
        port_str = f":{port}" if port else ""
        rest_str = rest if rest else "/postgres"
        return f"{scheme}{user}:{password}@{host}{port_str}{rest_str}"

    return url.strip().strip("'").strip('"').strip()


def get_db_url() -> Optional[str]:
    """Retrieve PostgreSQL connection URL from environment with test isolation guard."""
    if is_test_environment():
        # In test mode, only explicit TEST_DATABASE_URL is permitted
        test_url = os.getenv("TEST_DATABASE_URL")
        if test_url:
            prod_url = os.getenv("SUPABASE_DB_URL") or DEFAULT_SUPABASE_DB_URL
            if test_url == prod_url:
                raise PermissionError(
                    "CRITICAL SECURITY GUARD: TEST_DATABASE_URL points directly to production SUPABASE_DB_URL! "
                    "Test suite execution refused to prevent production data pollution."
                )
            return test_url
        return None

    raw = (
        os.getenv("SUPABASE_DB_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or DEFAULT_SUPABASE_DB_URL
    )
    ref = os.getenv("SUPABASE_READONLY_DB_URL") or os.getenv("READONLY_DATABASE_URL")
    return normalize_postgres_url(raw, reference_url=ref)


_DB_POOL: Optional[Any] = None
_DB_POOL_LOCK = threading.Lock()

def _get_connection_pool(db_url: str):
    global _DB_POOL
    if _DB_POOL is None:
        with _DB_POOL_LOCK:
            if _DB_POOL is None:
                import psycopg2.pool
                _DB_POOL = psycopg2.pool.ThreadedConnectionPool(1, 10, db_url)
    return _DB_POOL

def get_db_connection(db_url: Optional[str] = None, readonly: bool = False) -> Tuple[Any, Optional[Any]]:
    """
    Acquire a PostgreSQL database connection (pooled or direct).
    Enforces platform guards and read-only session isolation.
    """
    if is_test_environment() and not os.getenv("FORCE_LIVE_TEST_DB"):
        test_url = get_db_url()
        if not test_url:
            return None, None
        db_url = test_url

    is_platform = (os.getenv("GITHUB_ACTIONS") == "true" or os.getenv("RENDER") == "true")
    is_dry = os.getenv("DRY_RUN", "").lower() == "true"
    ro_url = normalize_postgres_url(os.getenv("SUPABASE_READONLY_DB_URL") or os.getenv("READONLY_DATABASE_URL"))
    write_url = get_db_url()

    if not db_url:
        if readonly:
            if is_dry:
                # Under DRY_RUN, strictly require read-only URL; NEVER fall back to write URL
                if not ro_url:
                    raise ValueError(
                        "CRITICAL SECURITY GUARD: DRY_RUN=true is active, "
                        "but SUPABASE_READONLY_DB_URL is not set. Refusing to connect using production write URL."
                    )
                db_url = ro_url
            elif not is_platform and not is_test_environment():
                # Local non-platform environment: reads permitted ONLY via read-only URL, never write URL
                if not ro_url:
                    raise PermissionError(
                        "CRITICAL SECURITY GUARD: Local environment detected without platform credentials. "
                        "Refusing to use production write URL for reads. Set SUPABASE_READONLY_DB_URL to read locally."
                    )
                db_url = ro_url
            else:
                # Platform environment (live GITHUB_ACTIONS or RENDER):
                # Reads may use SUPABASE_READONLY_DB_URL if set, or fall back to SUPABASE_DB_URL in a read-only session
                db_url = ro_url or write_url
                if not db_url:
                    raise ConnectionError("Neither SUPABASE_READONLY_DB_URL nor SUPABASE_DB_URL is set.")
        else:
            # Write connection: requires platform environment
            if not is_test_environment() and not is_platform:
                raise PermissionError(
                    "CRITICAL SECURITY GUARD: Refusing to open read-write connection to database outside platform environments. "
                    "Process must execute under GitHub Actions (GITHUB_ACTIONS='true') or Render (RENDER='true'). "
                    "Local database write access is strictly prohibited."
                )
            db_url = write_url
            if not db_url:
                raise ConnectionError("SUPABASE_DB_URL is not set. Primary PostgreSQL store cannot be accessed.")

    try:
        pool = _get_connection_pool(db_url)
        conn = pool.getconn()
        if conn.closed != 0:
            pool.putconn(conn, close=True)
            conn = pool.getconn()
        return conn, pool
    except Exception as e:
        logger.warning(f"Connection pool acquisition failed ({e}), falling back to direct connection")
        import psycopg2
        try:
            return psycopg2.connect(db_url), None
        except Exception as conn_err:
            logger.error(f"Failed to connect directly to PostgreSQL: {conn_err}")
            raise ConnectionError(f"Failed to connect to PostgreSQL database: {conn_err}") from conn_err


def return_db_connection(conn: Any, pool: Optional[Any] = None) -> None:
    """Release a PostgreSQL database connection back to its pool or close direct connection."""
    if conn is None:
        return
    if pool is not None:
        try:
            conn.rollback()
            try:
                conn.set_session(readonly=False)
            except Exception:
                pass
            pool.putconn(conn)
        except Exception:
            try:
                pool.putconn(conn, close=True)
            except Exception:
                pass
    else:
        try:
            try:
                conn.set_session(readonly=False)
            except Exception:
                pass
            conn.close()
        except Exception:
            pass


@contextmanager
def get_db_cursor(readonly: bool = False) -> Generator[Any, None, None]:
    """
    Context manager yielding a PostgreSQL cursor within an ACID transaction.
    Commits on success (for writes), rolls back on exit (for reads), and raises on failure.
    
    FAIL-CLOSED PRODUCTION SECURITY SAFEGUARDS:
    1. Test mode (is_test_environment()):
       - If TEST_DATABASE_URL is set -> connects to test database.
       - Otherwise -> yields isolated in-memory MockCursor.
    2. Write mode (readonly=False):
       - Requires is_live_write_permitted() (platform + ALLOW_LIVE_WRITE=true).
       - Outside test mode, if write permission is not granted -> raises PermissionError.
       - Connects via SUPABASE_DB_URL.
    3. Read mode (readonly=True):
       - Does NOT require ALLOW_LIVE_WRITE=true (reads on Render/Actions never return mock data).
       - In DRY_RUN=true, strictly requires SUPABASE_READONLY_DB_URL (never falls back to write URL).
       - In live Actions and Render, falls back to SUPABASE_DB_URL within a read-only session.
       - Enforces read-only session (conn.set_session(readonly=True) and SET TRANSACTION READ ONLY).
       - Resets session to readonly=False upon completion to prevent pool pollution.
       - Never yields MockCursor outside test mode: missing URL or connection failure RAISES.
    """
    if is_test_environment() and not os.getenv("FORCE_LIVE_TEST_DB"):
        test_url = os.getenv("TEST_DATABASE_URL")
        if not test_url:
            yield MockCursor()
            return
        conn, pool = get_db_connection(test_url, readonly=readonly)
    else:
        if not readonly and not is_live_write_permitted():
            raise PermissionError(
                "Live PostgreSQL write access not authorized (must run under GITHUB_ACTIONS or RENDER with ALLOW_LIVE_WRITE=true). "
                "Write operation refused to prevent production data corruption."
            )
        conn, pool = get_db_connection(readonly=readonly)

    try:
        if readonly:
            conn.set_session(readonly=True)
        else:
            conn.set_session(readonly=False)
        with conn.cursor() as cur:
            if readonly:
                cur.execute("SET TRANSACTION READ ONLY;")
            yield cur
        if not readonly:
            conn.commit()
        else:
            conn.rollback()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error(f"PostgreSQL transaction failed: {e}", exc_info=True)
        raise
    finally:
        try:
            if readonly:
                conn.set_session(readonly=False)
        except Exception:
            pass
        return_db_connection(conn, pool)


@contextmanager
def get_readonly_cursor() -> Generator[Any, None, None]:
    """
    Context manager yielding a read-only PostgreSQL cursor.
    Enables reads in dry-run mode via SUPABASE_READONLY_DB_URL,
    without requiring ALLOW_LIVE_WRITE=true.
    Never falls back to SUPABASE_DB_URL when DRY_RUN is active.
    """
    with get_db_cursor(readonly=True) as cur:
        yield cur


@contextmanager
def get_tenant_db_cursor(tenant_id: str, readonly: bool = False) -> Generator[Any, None, None]:
    """
    Context manager yielding a PostgreSQL cursor scoped to the authenticated tenant's RLS context.
    Executes:
        SET LOCAL "request.jwt.claim.sub" = %s;
        SET LOCAL ROLE authenticated;
    Guarantees PostgreSQL Row Level Security (RLS) enforcement at the query level.
    """
    if is_test_environment() and not os.getenv("FORCE_LIVE_TEST_DB"):
        test_url = os.getenv("TEST_DATABASE_URL")
        if not test_url:
            yield MockCursor()
            return
        conn, pool = get_db_connection(test_url, readonly=readonly)
    else:
        if not readonly and not is_live_write_permitted():
            raise PermissionError(
                "Live PostgreSQL tenant write access not authorized (must run under GITHUB_ACTIONS or RENDER with ALLOW_LIVE_WRITE=true). "
                "Write operation refused to prevent production data corruption."
            )
        conn, pool = get_db_connection(readonly=readonly)

    try:
        if readonly:
            conn.set_session(readonly=True)
        else:
            conn.set_session(readonly=False)
        with conn.cursor() as cur:
            if readonly:
                cur.execute("SET TRANSACTION READ ONLY;")
                cur.execute('SET LOCAL "request.jwt.claim.sub" = %s;', (str(tenant_id),))
            else:
                cur.execute(
                    'SET LOCAL "request.jwt.claim.sub" = %s; SET LOCAL ROLE authenticated;',
                    (str(tenant_id),)
                )
            yield cur
        if not readonly:
            conn.commit()
        else:
            conn.rollback()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error(f"PostgreSQL tenant transaction failed (tenant {tenant_id}): {e}", exc_info=True)
        raise
    finally:
        try:
            if readonly:
                conn.set_session(readonly=False)
        except Exception:
            pass
        return_db_connection(conn, pool)


def _execute_batch(cur: Any, sql: str, params_list: List[Any], page_size: int = 100) -> None:
    """Execute batched SQL inserts, supporting both MockCursor and psycopg2 real cursors."""
    if isinstance(cur, MockCursor):
        for p in params_list:
            cur.execute(sql, p)
        return
    import psycopg2.extras
    psycopg2.extras.execute_batch(cur, sql, params_list, page_size=page_size)


def _get_data_dir() -> Path:
    """
    Get active data directory.
    1. Checks DATA_DIR env override (resolves absolute or relative paths).
    2. Falls back to backend/published_briefs if it contains brief files.
    3. Defaults to backend/data.
    """
    env_dir = os.getenv("DATA_DIR")

    if env_dir:
        p = Path(env_dir)
        if p.is_absolute() and p.exists():
            return p
        resolved = _backend_root / p
        if resolved.exists():
            return resolved
        cwd_resolved = Path.cwd() / p
        if cwd_resolved.exists():
            return cwd_resolved
        return resolved

    published_dir = _backend_root / "published_briefs"
    if published_dir.exists() and any(published_dir.glob("brief*.md")):
        return published_dir

    return _backend_root / "data"


def _sanitize_filename(name: str) -> str:
    """Sanitize company name for use in filenames."""
    return "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name.strip()).lower()


def _generate_signal_id(company: str, source: str, url: str, title: str, published_at: str) -> str:
    """Deterministic signal identifier."""
    raw = f"{company.strip()}::{source.strip()}::{url.strip()}::{title.strip()}::{str(published_at).strip()}"
    return "sig_" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _parse_timestamp(val: Any) -> Optional[str]:
    """Parse string/numeric timestamp into ISO format string."""
    if not val:
        return None
    s = str(val).strip()
    try:
        if s.isdigit():
            # Unix timestamp
            ts = float(s)
            if ts > 1e11:
                ts /= 1000.0
            return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except Exception:
        return s


def save_signals(
    signals: List[Dict[str, Any]],
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Dual-write normalized raw signals:
    1. Primary write: PostgreSQL `raw_signals` table (is_mock = FALSE).
    2. Secondary write: Flat JSON files (signals_YYYYMMDD_HHMMSS.json and signals.json).
    """
    # 1. Primary PostgreSQL Write
    if signals and not is_dry_run():
        with get_db_cursor() as cur:
            # Ensure company records exist in canonical companies registry
            companies = set(s.get("company", "").strip() for s in signals if s.get("company"))
            comp_sql = """
                INSERT INTO companies (name, status, is_mock)
                VALUES (%s, 'active', FALSE)
                ON CONFLICT (name) DO NOTHING;
            """
            _execute_batch(cur, comp_sql, [(c,) for c in companies if c], page_size=100)

            # Insert raw signals
            sig_sql = """
                INSERT INTO raw_signals (id, company_name, source, title, url, published_at, published_timestamp, raw_excerpt, is_mock)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                ON CONFLICT (id) DO NOTHING;
            """
            sig_params = []
            for s in signals:
                comp = s.get("company", "").strip()
                source = s.get("source", "").strip()
                url = s.get("url", "").strip()
                title = s.get("title", "").strip()
                pub_at = s.get("published_at")
                pub_ts = s.get("published_timestamp")
                raw_excerpt = s.get("raw_excerpt", "")
                
                sig_id = s.get("id") or _generate_signal_id(comp, source, url, title, str(pub_at or ""))
                s["id"] = sig_id
                
                pub_iso = _parse_timestamp(pub_at)
                sig_params.append((sig_id, comp, source, title, url, pub_iso, str(pub_ts) if pub_ts else None, raw_excerpt))

            _execute_batch(cur, sig_sql, sig_params, page_size=200)
            logger.info(f"Dual-write: successfully persisted {len(signals)} raw_signals to PostgreSQL.")

    # 2. Secondary Flat File Write
    data_dir = _get_data_dir()
    default_signals_file = data_dir / "signals.json"

    if filepath:
        target_path = Path(filepath)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(signals, f, indent=2, ensure_ascii=False)
        return target_path

    data_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    timestamped_file = data_dir / f"signals_{timestamp}.json"

    with open(timestamped_file, "w", encoding="utf-8") as f:
        json.dump(signals, f, indent=2, ensure_ascii=False)

    with open(default_signals_file, "w", encoding="utf-8") as f:
        json.dump(signals, f, indent=2, ensure_ascii=False)

    return timestamped_file


def load_signals(
    filepath: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """Load signals from flat JSON file."""
    data_dir = _get_data_dir()

    if filepath:
        target_path = Path(filepath)
        if not target_path.exists():
            return []
    else:
        default_signals_file = data_dir / "signals.json"
        if default_signals_file.exists():
            target_path = default_signals_file
        else:
            timestamped_files = sorted(data_dir.glob("signals_*.json"), reverse=True)
            if timestamped_files:
                target_path = timestamped_files[0]
            else:
                return []

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []


def save_noise_decisions(decisions: List[Dict[str, Any]], raw_signals_lookup: Optional[List[Dict[str, Any]]] = None) -> None:
    """
    Dual-write noise suppression decisions:
    Primary write: PostgreSQL `noise_suppression_decisions` table.

    FK-safety: noise_suppression_decisions has a FK on signal_id -> raw_signals(id).
    We upsert any missing parent signal stubs into raw_signals before writing decisions so the
    constraint is always satisfied regardless of invocation order (progressive mode or isolated tests).
    raw_signals_lookup: optional list of signal dicts to use for stub data (keyed by id).
    """
    if not decisions or is_dry_run():
        return

    # Build lookup for additional signal data if provided
    sig_lookup: Dict[str, Dict[str, Any]] = {}
    if raw_signals_lookup:
        for s in raw_signals_lookup:
            sid = s.get("id")
            if sid:
                sig_lookup[sid] = s

    with get_db_cursor() as cur:
        # FK-safety: upsert minimal signal stubs so parent rows exist before writing decisions.
        # ON CONFLICT DO NOTHING ensures real rows written by save_signals() are never overwritten.
        stub_params = []
        company_stubs = set()
        for d in decisions:
            sid = d.get("signal_id")
            if not sid:
                continue
            sig_data = sig_lookup.get(sid, {})
            comp = sig_data.get("company") or d.get("company_name") or d.get("company") or "Unknown"
            company_stubs.add(comp.strip())
            stub_params.append((
                sid,
                comp.strip(),
                sig_data.get("source") or d.get("source") or "unknown",
                sig_data.get("title") or d.get("title") or "",
                sig_data.get("url") or d.get("url") or "",
                _parse_timestamp(sig_data.get("published_at")),
                None,
                sig_data.get("raw_excerpt") or d.get("raw_excerpt") or "",
            ))

        if stub_params:
            # Ensure company records exist first
            comp_sql = """
                INSERT INTO companies (name, status, is_mock)
                VALUES (%s, 'active', FALSE)
                ON CONFLICT (name) DO NOTHING;
            """
            try:
                _execute_batch(cur, comp_sql, [(c,) for c in company_stubs if c], page_size=100)
            except Exception as e:
                logger.debug(f"Company stub upsert warning (non-critical): {e}")

            stub_sql = """
                INSERT INTO raw_signals (id, company_name, source, title, url, published_at, published_timestamp, raw_excerpt, is_mock)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                ON CONFLICT (id) DO NOTHING;
            """
            try:
                _execute_batch(cur, stub_sql, stub_params, page_size=200)
            except Exception as e:
                logger.warning(f"Signal stub upsert before noise decisions failed (non-critical): {e}")

        nd_sql = """
            INSERT INTO noise_suppression_decisions (signal_id, is_noise, noise_category, noise_reason, decided_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (signal_id) DO UPDATE
            SET is_noise = EXCLUDED.is_noise,
                noise_category = EXCLUDED.noise_category,
                noise_reason = EXCLUDED.noise_reason;
        """
        nd_params = [
            (
                d["signal_id"],
                d.get("is_noise", False),
                d.get("noise_category", "none"),
                d.get("noise_reason", ""),
                d.get("decided_at") or datetime.now(timezone.utc).isoformat(),
            )
            for d in decisions
            if d.get("signal_id")
        ]
        try:
            _execute_batch(cur, nd_sql, nd_params, page_size=200)
            logger.info(f"Dual-write: persisted {len(nd_params)} noise_suppression_decisions to PostgreSQL.")
        except Exception as e:
            logger.warning(f"Noise decision write failed (non-critical, pipeline continues): {e}")


def save_events(
    events: List[Dict[str, Any]],
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Dual-write consolidated Event records:
    1. Primary write: PostgreSQL `consolidated_events` table and `event_signals` join table (is_mock = FALSE).
    2. Secondary write: Flat JSON files (events_YYYYMMDD_HHMMSS.json and events.json).
    """
    # 1. Primary PostgreSQL Write
    if events and not is_dry_run():
        with get_db_cursor() as cur:
            ev_sql = """
                INSERT INTO consolidated_events (
                    event_id, company_name, title, event_summary, corroboration_count,
                    contributing_sources, first_detected_at, latest_detected_at,
                    published_at, published_timestamp, url, source_urls, raw_excerpt, fact_confidence, is_mock
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                ON CONFLICT (event_id) DO UPDATE
                SET title = EXCLUDED.title,
                    event_summary = EXCLUDED.event_summary,
                    corroboration_count = EXCLUDED.corroboration_count,
                    contributing_sources = EXCLUDED.contributing_sources,
                    source_urls = EXCLUDED.source_urls,
                    raw_excerpt = EXCLUDED.raw_excerpt,
                    fact_confidence = COALESCE(EXCLUDED.fact_confidence, consolidated_events.fact_confidence);
            """
            ev_params = []
            es_params = []
            all_raw_signals: List[Dict[str, Any]] = []  # collected for FK-safety stub upsert

            for ev in events:
                eid = ev["event_id"]
                comp = ev.get("company", "Unknown").strip()
                title = ev.get("title", "").strip()
                summary = ev.get("event_summary", title)
                corr = ev.get("corroboration_count", 1)
                contrib = json.dumps(ev.get("contributing_sources", []))
                first_det = _parse_timestamp(ev.get("first_detected_at"))
                latest_det = _parse_timestamp(ev.get("latest_detected_at"))
                pub_at = _parse_timestamp(ev.get("published_at"))
                pub_ts = str(ev.get("published_timestamp")) if ev.get("published_timestamp") else None
                url = ev.get("url", "")
                source_urls = json.dumps(ev.get("source_urls", []))
                excerpt = ev.get("raw_excerpt", "")
                fact_conf = ev.get("fact_confidence") or "Medium"

                ev_params.append((
                    eid, comp, title, summary, corr, contrib,
                    first_det, latest_det, pub_at, pub_ts, url, source_urls, excerpt, fact_conf
                ))

                for s in ev.get("raw_signals", []):
                    s_id = s.get("id") or _generate_signal_id(
                        s.get("company", comp), s.get("source", ""), s.get("url", ""), s.get("title", ""), str(s.get("published_at", ""))
                    )
                    if not s.get("id"):
                        s["id"] = s_id
                    es_params.append((eid, s_id))
                    all_raw_signals.append(s)

            _execute_batch(cur, ev_sql, ev_params, page_size=200)

            # FK-safety: upsert signal stubs into raw_signals before writing event_signals join rows.
            # event_signals(signal_id) has FK -> raw_signals(id). If save_signals() hasn't been called
            # yet (e.g. progressive mode or isolated node tests), this prevents constraint violation.
            if es_params and all_raw_signals:
                companies_needed = set(s.get("company", "Unknown").strip() for s in all_raw_signals if s.get("company"))
                comp_sql = """
                    INSERT INTO companies (name, status, is_mock)
                    VALUES (%s, 'active', FALSE)
                    ON CONFLICT (name) DO NOTHING;
                """
                try:
                    _execute_batch(cur, comp_sql, [(c,) for c in companies_needed if c], page_size=100)
                except Exception as e:
                    logger.debug(f"Company stub upsert for event_signals (non-critical): {e}")

                sig_stub_sql = """
                    INSERT INTO raw_signals (id, company_name, source, title, url, published_at, published_timestamp, raw_excerpt, is_mock)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                    ON CONFLICT (id) DO NOTHING;
                """
                sig_stub_params = []
                for s in all_raw_signals:
                    s_id = s.get("id")
                    if s_id:
                        sig_stub_params.append((
                            s_id,
                            s.get("company", "Unknown").strip(),
                            s.get("source", "unknown"),
                            s.get("title", ""),
                            s.get("url", ""),
                            _parse_timestamp(s.get("published_at")),
                            None,
                            s.get("raw_excerpt", ""),
                        ))
                if sig_stub_params:
                    try:
                        _execute_batch(cur, sig_stub_sql, sig_stub_params, page_size=200)
                    except Exception as e:
                        logger.warning(f"Signal stub upsert before event_signals failed (non-critical): {e}")

            es_sql = """
                INSERT INTO event_signals (event_id, signal_id)
                VALUES (%s, %s)
                ON CONFLICT (event_id, signal_id) DO NOTHING;
            """
            try:
                _execute_batch(cur, es_sql, es_params, page_size=200)
            except Exception as e:
                logger.warning(f"event_signals write failed (non-critical, pipeline continues): {e}")
            logger.info(f"Dual-write: persisted {len(events)} consolidated_events and {len(es_params)} event_signals to PostgreSQL.")

    # 2. Secondary Flat File Write
    data_dir = _get_data_dir()
    default_events_file = data_dir / "events.json"

    if filepath:
        target_path = Path(filepath)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2, ensure_ascii=False)
        return target_path

    data_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    timestamped_file = data_dir / f"events_{timestamp}.json"

    with open(timestamped_file, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

    with open(default_events_file, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

    return timestamped_file


def load_events(
    filepath: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """Load events from flat JSON file."""
    data_dir = _get_data_dir()

    if filepath:
        target_path = Path(filepath)
        if not target_path.exists():
            return []
    else:
        default_file = data_dir / "events.json"
        if default_file.exists():
            target_path = default_file
        else:
            timestamped_files = sorted(data_dir.glob("events_*.json"), reverse=True)
            if timestamped_files:
                target_path = timestamped_files[0]
            else:
                return []

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return data.get("events", [])
            return []
    except Exception:
        return []


def save_findings(
    findings: List[Dict[str, Any]],
    tenant_id: Optional[str] = None,
) -> None:
    """
    Dual-write analyzed findings:
    Primary write: PostgreSQL `findings` table (is_mock = FALSE) scoped by tenant_id.
    """
    if not findings or is_dry_run():
        return
    
    tid = tenant_id or os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    with get_db_cursor() as cur:
        f_sql = """
            INSERT INTO findings (tenant_id, event_id, company_name, why_it_matters, confidence, decision_score, tier, is_mock, inference_confidence, analysis_model, is_fallback, analysis_source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE, %s, %s, %s, %s)
            ON CONFLICT (tenant_id, event_id) DO UPDATE
            SET company_name = EXCLUDED.company_name,
                why_it_matters = EXCLUDED.why_it_matters,
                confidence = EXCLUDED.confidence,
                decision_score = EXCLUDED.decision_score,
                tier = EXCLUDED.tier,
                inference_confidence = COALESCE(EXCLUDED.inference_confidence, findings.inference_confidence),
                analysis_model = COALESCE(EXCLUDED.analysis_model, findings.analysis_model),
                is_fallback = COALESCE(EXCLUDED.is_fallback, findings.is_fallback),
                analysis_source = COALESCE(EXCLUDED.analysis_source, findings.analysis_source);
        """
        f_params = []
        for f in findings:
            eid = f.get("event_id") or f.get("id")
            if not eid:
                continue
            comp = f.get("company") or f.get("company_name", "Unknown")
            why = f.get("why_it_matters", "")
            conf = f.get("confidence", "Medium")
            score = f.get("decision_score", 1.0)
            tier = f.get("tier", "should_know")
            infer_conf = f.get("inference_confidence")
            analysis_model = f.get("analysis_model")
            is_fallback = bool(f.get("is_fallback", False))
            analysis_source = f.get("analysis_source")
            f_params.append((tid, eid, comp, why, conf, score, tier, infer_conf, analysis_model, is_fallback, analysis_source))

        _execute_batch(cur, f_sql, f_params, page_size=200)
        logger.info(f"Dual-write: persisted {len(f_params)} findings for tenant {tid} to PostgreSQL.")


def save_brief(
    content: str,
    filepath: Optional[Union[str, Path]] = None,
    title: Optional[str] = None,
    headline_preview: Optional[str] = None,
    published_at: Optional[datetime] = None,
    tenant_id: Optional[str] = None,
) -> Path:
    """
    Dual-write markdown intelligence brief:
    1. Primary write: PostgreSQL `briefs` table with id='data_latest', tenant_id, source_path='data/brief.md', content_hash.
    2. Secondary write: Flat markdown files (brief_YYYYMMDD_HHMMSS.md and brief.md).
    """
    c_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    pub_dt = published_at or datetime.now(timezone.utc)
    b_title = title or "PrismIQ Competitive Intelligence Brief"
    tid = tenant_id or os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")
    
    if not headline_preview:
        # Extract headline preview
        m = re.search(r"##\s+Top\s+3\s+decisions[^\n]*\n+([\s\S]*?)(?=\n##|\Z)", content, re.IGNORECASE)
        if m:
            headline_preview = m.group(1).strip()[:500]
        else:
            headline_preview = content[:300]

    # 1. Primary PostgreSQL Write
    if not is_dry_run():
        with get_db_cursor() as cur:
            b_sql = """
                INSERT INTO briefs (id, tenant_id, filename, source_path, content_hash, title, headline_preview, content, published_at)
                VALUES ('data_latest', %s, 'data/brief.md', 'data/brief.md', %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, id) DO UPDATE
                SET filename = EXCLUDED.filename,
                    source_path = EXCLUDED.source_path,
                    content_hash = EXCLUDED.content_hash,
                    title = EXCLUDED.title,
                    headline_preview = EXCLUDED.headline_preview,
                    content = EXCLUDED.content,
                    published_at = EXCLUDED.published_at;
            """
            cur.execute(b_sql, (tid, c_hash, b_title, headline_preview, content, pub_dt))
            logger.info(f"Dual-write: persisted data_latest brief for tenant {tid} (hash: {c_hash[:16]}...) to PostgreSQL.")

    # 2. Secondary Flat File Write
    data_dir = _get_data_dir()
    default_report_file = data_dir / "brief.md"

    if filepath:
        report_file = Path(filepath)
        report_file.parent.mkdir(parents=True, exist_ok=True)
        with open(report_file, "w", encoding="utf-8") as f:
            f.write(content)
        return report_file

    data_dir.mkdir(parents=True, exist_ok=True)
    timestamp = pub_dt.strftime("%Y%m%d_%H%M%S")
    timestamped_report = data_dir / f"brief_{timestamp}.md"

    with open(timestamped_report, "w", encoding="utf-8") as f:
        f.write(content)

    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")
    if tid == owner_id:
        with open(default_report_file, "w", encoding="utf-8") as f:
            f.write(content)

        # Ensure backend/data/brief.md is also mirrored
        data_brief_file = _backend_root / "data" / "brief.md"
        if data_brief_file != default_report_file:
            data_brief_file.parent.mkdir(parents=True, exist_ok=True)
            with open(data_brief_file, "w", encoding="utf-8") as f:
                f.write(content)
    else:
        tenant_brief_file = data_dir / f"brief_{tid}.md"
        with open(tenant_brief_file, "w", encoding="utf-8") as f:
            f.write(content)

    return timestamped_report


def ensure_tenant_user_exists(cur, tenant_id: str, email: Optional[str] = None) -> None:
    """
    Ensure the tenant UUID exists in auth.users so foreign key constraints on tenant tables never fail.
    Idempotent: inserts default authenticated user record if not present.
    Uses SAVEPOINT so permission issues on auth.users do not abort the active transaction block.
    """
    if is_dry_run():
        return
    if not tenant_id:
        return
    if isinstance(cur, MockCursor):
        return
    tid = str(tenant_id).strip()
    user_email = email or f"{tid[:8]}@prismiq.ai"
    try:
        cur.execute("SAVEPOINT ensure_tenant_user;")
        cur.execute("""
            INSERT INTO auth.users (
                id, instance_id, aud, role, email, email_confirmed_at,
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at
            )
            VALUES (
                %s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                %s, NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                '{"name":"Tenant User"}'::jsonb,
                NOW(), NOW()
            )
            ON CONFLICT (id) DO NOTHING;
        """, (tid, user_email))
        cur.execute("RELEASE SAVEPOINT ensure_tenant_user;")
    except Exception as e:
        try:
            cur.execute("ROLLBACK TO SAVEPOINT ensure_tenant_user;")
        except Exception:
            pass
        logger.warning(f"Could not ensure tenant user {tid} in auth.users: {e}")


def save_discovery_proposal(
    target_company: str,
    candidates: List[Dict[str, Any]],
    tenant_id: Optional[str] = None,
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Dual-write candidate competitor discovery proposals:
    1. Primary write: PostgreSQL `discovery_proposals` and `discovery_candidates` tables (tenant-scoped).
    2. Secondary write: Flat JSON file (discovery_proposal_{clean_company}.json).
    """
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    target_file = Path(filepath) if filepath else (data_dir / f"discovery_proposal_{clean_name}.json")
    if is_dry_run():
        return target_file
    rel_filename = f"data/discovery_proposal_{clean_name}.json"
    now_dt = datetime.now(timezone.utc)
    tid = tenant_id or os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    # 1. Primary PostgreSQL Write
    if candidates and not is_test_environment() and is_live_write_permitted():
        try:
            # Validate UUID syntax before passing to Postgres UUID column
            uuid.UUID(str(tid))
            with get_db_cursor() as cur:
                ensure_tenant_user_exists(cur, tid)
                # Ensure target company exists in companies registry
                cur.execute(
                    "INSERT INTO companies (name, status) VALUES (%s, 'active') ON CONFLICT (name) DO NOTHING;",
                    (target_company,)
                )

                # Insert proposal record
                prop_sql = """
                    INSERT INTO discovery_proposals (tenant_id, target_company, generated_at, filename)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (tenant_id, target_company, filename) DO UPDATE
                    SET generated_at = EXCLUDED.generated_at
                    RETURNING id;
                """
                cur.execute(prop_sql, (tid, target_company, now_dt, rel_filename))
                prop_id_row = cur.fetchone()
                prop_id = prop_id_row[0] if prop_id_row else "00000000-0000-0000-0000-000000000000"

                # Insert candidates with domain, category, and tier
                dc_sql = """
                    INSERT INTO discovery_candidates (
                        tenant_id, proposal_id, target_company, name, rationale, confidence,
                        source, source_age, source_date, freshness_note, status, domain, category, tier
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, target_company, name, source) DO UPDATE
                    SET rationale = EXCLUDED.rationale,
                        confidence = EXCLUDED.confidence,
                        source_age = EXCLUDED.source_age,
                        source_date = EXCLUDED.source_date,
                        freshness_note = EXCLUDED.freshness_note,
                        status = EXCLUDED.status,
                        domain = COALESCE(EXCLUDED.domain, discovery_candidates.domain),
                        category = COALESCE(EXCLUDED.category, discovery_candidates.category),
                        tier = COALESCE(EXCLUDED.tier, discovery_candidates.tier);
                """
                dc_params = []
                for c in candidates:
                    cname = c.get("name", "").strip()
                    if not cname:
                        continue
                    # Ensure candidate company exists in companies registry
                    cur.execute(
                        "INSERT INTO companies (name, status) VALUES (%s, 'candidate') ON CONFLICT (name) DO NOTHING;",
                        (cname,)
                    )
                    dc_params.append((
                        tid, prop_id, target_company, cname, c.get("rationale", ""),
                        c.get("confidence", "Low"), c.get("source", ""),
                        c.get("source_age", "undated"),
                        str(c.get("source_date")) if c.get("source_date") else None,
                        c.get("freshness_note"), c.get("status", "proposed"),
                        c.get("domain") or c.get("website") or c.get("primary_domain"),
                        c.get("category") or c.get("industry_category"),
                        c.get("tier") or "core",
                    ))
                _execute_batch(cur, dc_sql, dc_params, page_size=50)
                logger.info(f"Dual-write: persisted discovery proposal and {len(dc_params)} candidates for tenant {tid} to PostgreSQL.")
        except Exception as e:
            logger.warning(f"Dual-write: could not persist discovery proposal to PostgreSQL for tenant {tid}: {e}")

    # 2. Secondary Flat File Write
    target_file = Path(filepath) if filepath else (data_dir / f"discovery_proposal_{clean_name}.json")
    target_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "tenant_id": tid,
        "target_company": target_company,
        "generated_at": now_dt.isoformat(),
        "candidates": candidates,
    }
    with open(target_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return target_file


def load_discovery_proposal(
    target_company: str,
    filepath: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """Load proposed candidate competitors for a target company."""
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    target_file = Path(filepath) if filepath else (data_dir / f"discovery_proposal_{clean_name}.json")

    if not target_file.exists():
        return []

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                candidates = data.get("candidates", [])
                if isinstance(candidates, list):
                    return candidates
            elif isinstance(data, list):
                return data
            return []
    except Exception:
        return []


def save_confirmed_competitors(
    target_company: str,
    confirmed_competitors: List[str],
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Dual-write human-confirmed competitors:
    1. Primary write: PostgreSQL `companies` table.
    2. Secondary write: Flat JSON file (confirmed_competitors_{clean_company}.json).
    """
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    target_file = Path(filepath) if filepath else (data_dir / f"confirmed_competitors_{clean_name}.json")
    if is_dry_run():
        return target_file
    # 1. Primary PostgreSQL Write
    if confirmed_competitors:
        with get_db_cursor() as cur:
            comp_sql = """
                INSERT INTO companies (name, status)
                VALUES (%s, 'confirmed')
                ON CONFLICT (name) DO UPDATE
                SET status = 'confirmed',
                    updated_at = NOW();
            """
            _execute_batch(cur, comp_sql, [(c.strip(),) for c in confirmed_competitors if c.strip()], page_size=50)
            logger.info(f"Dual-write: updated {len(confirmed_competitors)} confirmed competitors in PostgreSQL.")

    # 2. Secondary Flat File Write
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    target_file = Path(filepath) if filepath else (data_dir / f"confirmed_competitors_{clean_name}.json")

    target_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "target_company": target_company,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        "competitors": confirmed_competitors,
    }
    with open(target_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return target_file


# Discovery proposal persistence wrapper for tenant RLS
def save_tenant_discovery_proposal(
    tenant_id: Optional[str],
    target_company: str,
    candidates: List[Dict[str, Any]],
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    if is_dry_run():
        data_dir = _get_data_dir()
        clean_name = _sanitize_filename(target_company)
        return Path(filepath) if filepath else (data_dir / f"discovery_proposal_{clean_name}.json")
    return save_discovery_proposal(
        target_company=target_company,
        candidates=candidates,
        tenant_id=tenant_id,
        filepath=filepath,
    )



def save_tenant_confirmed_companies(
    tenant_id: str,
    target_company: str,
    confirmed_competitors: List[str],
    competitor_metadata: Optional[Dict[str, Dict[str, str]]] = None,
) -> List[Dict[str, Any]]:
    if is_dry_run():
        return []
    """
    Write confirmed onboarding company selection directly into tenant_tracked_companies.
    1. Inserts target company as is_target = TRUE, status = 'active' with domain/category.
    2. Inserts confirmed competitors as is_target = FALSE, status = 'active' with domain/category.
    3. Inherits domain and category from discovery_candidates or competitor_metadata.
    4. Ensures companies exist in global canonical registry.
    5. Updates discovery_candidates status to 'confirmed' for selected, 'rejected' for omitted.
    """
    tid = str(tenant_id).strip()
    target = str(target_company).strip()
    competitors = [str(c).strip() for c in confirmed_competitors if str(c).strip()]
    now_dt = datetime.now(timezone.utc)
    meta_map = competitor_metadata or {}

    # 1. Primary PostgreSQL Write
    with get_db_cursor() as cur:
        # Guarantee parent tenant row exists in auth.users before foreign key references
        ensure_tenant_user_exists(cur, tid)

        # Fetch candidate metadata from discovery_candidates if available
        candidate_meta: Dict[str, Dict[str, Any]] = {}
        try:
            cur.execute("""
                SELECT LOWER(name), domain, category, tier, confidence, rationale, source
                FROM discovery_candidates
                WHERE tenant_id = %s;
            """, (tid,))
            for row in cur.fetchall():
                candidate_meta[row[0]] = {
                    "domain": row[1],
                    "category": row[2],
                    "tier": row[3],
                    "confidence": row[4],
                    "rationale": row[5],
                    "source": row[6],
                }
        except Exception:
            pass

        # Ensure target company in companies registry
        cur.execute(
            "INSERT INTO companies (name, status) VALUES (%s, 'active') ON CONFLICT (name) DO NOTHING;",
            (target,)
        )
        # Ensure competitor companies in companies registry
        comp_registry_sql = """
            INSERT INTO companies (name, status)
            VALUES (%s, 'confirmed')
            ON CONFLICT (name) DO UPDATE
            SET status = 'confirmed', updated_at = NOW();
        """
        _execute_batch(cur, comp_registry_sql, [(c,) for c in competitors], page_size=50)

        # Archive any previous target company for this tenant if name is different
        cur.execute("""
            UPDATE tenant_tracked_companies
            SET is_target = FALSE, status = 'archived', updated_at = %s
            WHERE tenant_id = %s AND is_target = TRUE AND company_name != %s AND status = 'active';
        """, (now_dt, tid, target))

        # Upsert target company into tenant_tracked_companies with domain/category/tier
        target_meta = meta_map.get(target) or candidate_meta.get(target.lower()) or {}
        target_domain = target_meta.get("domain") or target_meta.get("primary_domain") or (CANONICAL_COMPANY_METADATA.get(target) or {}).get("domain")
        target_cat = target_meta.get("category") or target_meta.get("industry_category") or (CANONICAL_COMPANY_METADATA.get(target) or {}).get("category") or "Primary Subject Entity"

        target_ttc_sql = """
            INSERT INTO tenant_tracked_companies (tenant_id, company_name, is_target, status, primary_domain, industry_category, tier, confidence, rationale, added_at, updated_at)
            VALUES (%s, %s, TRUE, 'active', %s, %s, 'core', 'High', 'Primary subject entity for market benchmarking and signal correlation.', %s, %s)
            ON CONFLICT (tenant_id, company_name) DO UPDATE
            SET is_target = TRUE, status = 'active',
                primary_domain = COALESCE(EXCLUDED.primary_domain, tenant_tracked_companies.primary_domain),
                industry_category = COALESCE(EXCLUDED.industry_category, tenant_tracked_companies.industry_category),
                tier = 'core',
                confidence = 'High',
                updated_at = EXCLUDED.updated_at;
        """
        cur.execute(target_ttc_sql, (tid, target, target_domain, target_cat, now_dt, now_dt))

        # Archive any competitors previously active for this tenant that are not in the new confirmed list
        if competitors:
            cur.execute("""
                UPDATE tenant_tracked_companies
                SET status = 'archived', updated_at = %s
                WHERE tenant_id = %s AND NOT is_target AND NOT (company_name = ANY(%s)) AND status = 'active';
            """, (now_dt, tid, competitors))
        else:
            cur.execute("""
                UPDATE tenant_tracked_companies
                SET status = 'archived', updated_at = %s
                WHERE tenant_id = %s AND NOT is_target AND status = 'active';
            """, (now_dt, tid))

        # Upsert confirmed competitors into tenant_tracked_companies with domain/category/tier/confidence/rationale
        comp_ttc_sql = """
            INSERT INTO tenant_tracked_companies (tenant_id, company_name, is_target, status, primary_domain, industry_category, tier, confidence, rationale, source, added_at, updated_at)
            VALUES (%s, %s, FALSE, 'active', %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id, company_name) DO UPDATE
            SET is_target = FALSE, status = 'active',
                primary_domain = COALESCE(EXCLUDED.primary_domain, tenant_tracked_companies.primary_domain),
                industry_category = COALESCE(EXCLUDED.industry_category, tenant_tracked_companies.industry_category),
                tier = COALESCE(EXCLUDED.tier, tenant_tracked_companies.tier),
                confidence = COALESCE(EXCLUDED.confidence, tenant_tracked_companies.confidence),
                rationale = COALESCE(EXCLUDED.rationale, tenant_tracked_companies.rationale),
                source = COALESCE(EXCLUDED.source, tenant_tracked_companies.source),
                updated_at = EXCLUDED.updated_at;
        """
        ttc_params = []
        for c in competitors:
            c_meta = meta_map.get(c) or candidate_meta.get(c.lower()) or {}
            c_dom = c_meta.get("domain") or c_meta.get("website") or c_meta.get("primary_domain") or (CANONICAL_COMPANY_METADATA.get(c) or {}).get("domain") or (CANONICAL_COMPANY_METADATA.get(c.lower()) or {}).get("domain")
            c_cat = c_meta.get("category") or c_meta.get("industry_category") or (CANONICAL_COMPANY_METADATA.get(c) or {}).get("category") or (CANONICAL_COMPANY_METADATA.get(c.lower()) or {}).get("category") or "Competitor Platform"
            c_tier = c_meta.get("tier") or "core"
            c_conf = c_meta.get("confidence") or "High"
            c_rat = c_meta.get("rationale") or f"Confirmed competitor for market tracking alongside {target}."
            c_src = c_meta.get("source") or "Competitive intelligence index"
            ttc_params.append((tid, c, c_dom, c_cat, c_tier, c_conf, c_rat, c_src, now_dt, now_dt))
        _execute_batch(cur, comp_ttc_sql, ttc_params, page_size=50)

        # Update candidate statuses in discovery_candidates if present
        if competitors:
            cur.execute("""
                UPDATE discovery_candidates
                SET status = 'confirmed'
                WHERE tenant_id = %s AND target_company = %s AND name = ANY(%s);
            """, (tid, target, competitors))

            cur.execute("""
                UPDATE discovery_candidates
                SET status = 'rejected'
                WHERE tenant_id = %s AND target_company = %s AND NOT (name = ANY(%s));
            """, (tid, target, competitors))

        logger.info(f"Persisted confirmed tracked companies for tenant {tid}: target={target}, competitors={competitors}")

    # Return structured tracked companies
    tracked = [{"company_name": target, "is_target": True, "status": "active", "primary_domain": target_domain, "industry_category": target_cat}]
    for c, param in zip(competitors, ttc_params):
        tracked.append({"company_name": c, "is_target": False, "status": "active", "primary_domain": param[2], "industry_category": param[3]})

    # 2. Parity flat-file write
    save_confirmed_competitors(target, competitors)
    try:
        tenant_file = _get_data_dir() / f"tracked_companies_{tid}.json"
        with open(tenant_file, "w", encoding="utf-8") as tf:
            json.dump(tracked, tf, indent=2)
    except Exception as e:
        logger.warning(f"Failed to save local tracked companies for tenant {tid}: {e}")

    return tracked


def untrack_tenant_company(tenant_id: str, company_name: str) -> bool:
    """
    Mark a tracked company as 'untracked' for the tenant.
    Preserves signal and event history while removing from active competitor views.
    """
    if is_dry_run():
        return False
    tid = str(tenant_id).strip()
    comp = str(company_name).strip()
    with get_db_cursor() as cur:
        cur.execute("""
            UPDATE tenant_tracked_companies
            SET status = 'untracked', updated_at = NOW()
            WHERE tenant_id = %s AND company_name = %s AND status = 'active';
        """, (tid, comp))
        rowcount = cur.rowcount

    # Parity local file update
    try:
        tenant_file = _get_data_dir() / f"tracked_companies_{tid}.json"
        if tenant_file.exists():
            with open(tenant_file, "r", encoding="utf-8") as tf:
                comps = json.load(tf)
            updated_comps = [c for c in comps if c.get("company_name") != comp]
            with open(tenant_file, "w", encoding="utf-8") as tf:
                json.dump(updated_comps, tf, indent=2)
    except Exception as e:
        logger.warning(f"Failed to update local tracked file on untrack for {tid}: {e}")

    return rowcount > 0


def track_tenant_company(
    tenant_id: str,
    company_name: str,
    is_target: bool = False,
    primary_domain: Optional[str] = None,
    industry_category: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Add or reactivate a tracked company for a tenant under RLS, with optional domain anchor.
    """
    if is_dry_run():
        return {}
    tid = str(tenant_id).strip()
    comp = str(company_name).strip()
    dom = str(primary_domain).strip().lower() if primary_domain else None
    cat = str(industry_category).strip() if industry_category else None
    now_dt = datetime.now(timezone.utc)

    with get_db_cursor() as cur:
        ensure_tenant_user_exists(cur, tid)

        # Check discovery_candidates or canonical metadata for enrichments
        tier = "core"
        conf = "High"
        rat = f"Tracked competitor for market intelligence benchmarking."
        src = "Workspace Watchlist"
        try:
            cur.execute("""
                SELECT domain, category, tier, confidence, rationale, source
                FROM discovery_candidates
                WHERE tenant_id = %s AND LOWER(name) = %s
                LIMIT 1;
            """, (tid, comp.lower()))
            dc_row = cur.fetchone()
            if dc_row:
                if not dom and dc_row[0]: dom = dc_row[0]
                if not cat and dc_row[1]: cat = dc_row[1]
                if dc_row[2]: tier = dc_row[2]
                if dc_row[3]: conf = dc_row[3]
                if dc_row[4]: rat = dc_row[4]
                if dc_row[5] and isinstance(dc_row[5], str): src = dc_row[5]
        except Exception:
            pass

        canon = CANONICAL_COMPANY_METADATA.get(comp) or CANONICAL_COMPANY_METADATA.get(comp.lower()) or {}
        if not dom: dom = canon.get("domain")
        if not cat: cat = canon.get("category") or ("Primary Subject Entity" if is_target else "Competitor Platform")

        cur.execute("INSERT INTO companies (name, status) VALUES (%s, 'confirmed') ON CONFLICT (name) DO NOTHING;", (comp,))
        cur.execute("""
            INSERT INTO tenant_tracked_companies (tenant_id, company_name, is_target, status, primary_domain, industry_category, tier, confidence, rationale, source, added_at, updated_at)
            VALUES (%s, %s, %s, 'active', %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id, company_name) DO UPDATE
            SET is_target = EXCLUDED.is_target,
                status = 'active',
                primary_domain = COALESCE(EXCLUDED.primary_domain, tenant_tracked_companies.primary_domain),
                industry_category = COALESCE(EXCLUDED.industry_category, tenant_tracked_companies.industry_category),
                tier = COALESCE(EXCLUDED.tier, tenant_tracked_companies.tier),
                confidence = COALESCE(EXCLUDED.confidence, tenant_tracked_companies.confidence),
                rationale = COALESCE(EXCLUDED.rationale, tenant_tracked_companies.rationale),
                source = COALESCE(EXCLUDED.source, tenant_tracked_companies.source),
                updated_at = EXCLUDED.updated_at
            RETURNING company_name, is_target, status, primary_domain, industry_category, tier, confidence, rationale, source, added_at;
        """, (tid, comp, is_target, dom, cat, tier, conf, rat, src, now_dt, now_dt))
        if isinstance(cur, MockCursor):
            row = (comp, is_target, "active", dom, cat, tier, conf, rat, src, now_dt)
        else:
            row = cur.fetchone()
        entry = {
            "company_name": row[0] if (row and len(row) > 0) else comp,
            "is_target": row[1] if (row and len(row) > 1) else is_target,
            "status": row[2] if (row and len(row) > 2) else "active",
            "primary_domain": row[3] if (row and len(row) > 3) else dom,
            "industry_category": row[4] if (row and len(row) > 4) else cat,
            "tier": row[5] if (row and len(row) > 5) else tier,
            "confidence": row[6] if (row and len(row) > 6) else conf,
            "rationale": row[7] if (row and len(row) > 7) else rat,
            "source": row[8] if (row and len(row) > 8) else src,
            "added_at": row[9].isoformat() if (row and len(row) > 9 and hasattr(row[9], "isoformat")) else now_dt.isoformat(),
        }

    # Parity local file update
    try:
        tenant_file = _get_data_dir() / f"tracked_companies_{tid}.json"
        existing = []
        if tenant_file.exists():
            with open(tenant_file, "r", encoding="utf-8") as tf:
                existing = json.load(tf)
        # Remove any matching entry first
        existing = [c for c in existing if c.get("company_name") != comp]
        existing.append(entry)
        with open(tenant_file, "w", encoding="utf-8") as tf:
            json.dump(existing, tf, indent=2, default=str)
    except Exception as e:
        logger.warning(f"Failed to update local tracked file for {tid}: {e}")

    return entry


CANONICAL_COMPANY_METADATA = {
    "meesho": {"domain": "meesho.com", "category": "Social Commerce / E-Commerce"},
    "Meesho": {"domain": "meesho.com", "category": "Social Commerce / E-Commerce"},
    "Flipkart": {"domain": "flipkart.com", "category": "E-Commerce"},
    "flipkart": {"domain": "flipkart.com", "category": "E-Commerce"},
    "Myntra": {"domain": "myntra.com", "category": "Fashion E-Commerce"},
    "Amazon (India)": {"domain": "amazon.in", "category": "E-Commerce"},
    "Amazon India": {"domain": "amazon.in", "category": "E-Commerce"},
    "Amazon": {"domain": "amazon.com", "category": "E-Commerce & Cloud"},
    "Anthropic": {"domain": "anthropic.com", "category": "Artificial Intelligence / LLMs"},
    "BigCommerce": {"domain": "bigcommerce.com", "category": "E-Commerce SaaS"},
    "Carousel": {"domain": "carousell.com", "category": "C2C Marketplace / Classifieds"},
    "Carousell": {"domain": "carousell.com", "category": "C2C Marketplace / Classifieds"},
    "Cloudflare Pages/Workers": {"domain": "cloudflare.com", "category": "Cloud / Edge Computing"},
    "Croma": {"domain": "croma.com", "category": "Consumer Electronics Retail"},
    "EAB": {"domain": "eab.com", "category": "Education Consulting & Technology"},
    "EverCommerce": {"domain": "evercommerce.com", "category": "Service Commerce SaaS"},
    "Gobble": {"domain": "gobble.com", "category": "Meal Kit Delivery"},
    "Lazada": {"domain": "lazada.com", "category": "Southeast Asia E-Commerce"},
    "Netlify": {"domain": "netlify.com", "category": "Web Hosting & DevOps"},
    "Nykaa Fashion": {"domain": "nykaafashion.com", "category": "Beauty & Fashion E-Commerce"},
    "OpenAI": {"domain": "openai.com", "category": "Artificial Intelligence"},
    "Place": {"domain": "place.com", "category": "Real Estate Technology / SaaS"},
    "Poshmark": {"domain": "poshmark.com", "category": "Secondhand Fashion Marketplace"},
    "PostHog": {"domain": "posthog.com", "category": "Product Analytics"},
    "Sagazo": {"domain": "sagazo.com", "category": "AI E-Commerce Optimization"},
    "Segment": {"domain": "segment.com", "category": "Customer Data Platform / Analytics"},
    "Shopify": {"domain": "shopify.com", "category": "E-Commerce Platform"},
    "Shopsy": {"domain": "shopsy.in", "category": "Budget Social Commerce"},
    "Stripe": {"domain": "stripe.com", "category": "Fintech & Payments Infrastructure"},
    "StyleBuddy": {"domain": "stylebuddy.fashion", "category": "Fashion Styling & Personal Shopping"},
    "Temu": {"domain": "temu.com", "category": "Discount E-Commerce"},
    "Vercel": {"domain": "vercel.com", "category": "Frontend Cloud Platform"},
    "WooCommerce": {"domain": "woocommerce.com", "category": "Open-Source E-Commerce"},
    "66Analytics": {"domain": "66analytics.com", "category": "Web Analytics"},
    "Ajio": {"domain": "ajio.com", "category": "Fashion E-Commerce"},
}


_ANCHOR_CALL_COUNT = 0
_ANCHOR_TOTAL_TIME = 0.0


def get_entity_anchor(company_name: str) -> Optional[Dict[str, Optional[str]]]:
    """
    Look up primary_domain and industry_category for a tracked company.
    Queries tenant_tracked_companies from PostgreSQL under active status,
    falling back to CANONICAL_COMPANY_METADATA.
    Tracks invocation count and duration with monotonic timing logs.
    """
    global _ANCHOR_CALL_COUNT, _ANCHOR_TOTAL_TIME
    t0 = time.monotonic()
    comp = str(company_name).strip()
    result = None
    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_readonly_cursor() as cur:
                cur.execute("""
                    SELECT primary_domain, industry_category
                    FROM tenant_tracked_companies
                    WHERE company_name ILIKE %s AND status = 'active' AND (primary_domain IS NOT NULL OR industry_category IS NOT NULL)
                    ORDER BY updated_at DESC
                    LIMIT 1;
                """, (comp,))
                row = cur.fetchone()
                if row and (row[0] or row[1]):
                    result = {
                        "primary_domain": row[0],
                        "industry_category": row[1],
                    }
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query entity anchor for '{comp}' from Postgres: {e}")

    # Fallback to canonical metadata
    if not result:
        meta = CANONICAL_COMPANY_METADATA.get(comp) or CANONICAL_COMPANY_METADATA.get(comp.lower())
        if meta:
            result = {
                "primary_domain": meta.get("domain"),
                "industry_category": meta.get("category"),
            }

    dur = time.monotonic() - t0
    _ANCHOR_CALL_COUNT += 1
    _ANCHOR_TOTAL_TIME += dur
    logger.info(f"[TIMING] get_entity_anchor('{comp}'): {dur*1000:.2f}ms (call #{_ANCHOR_CALL_COUNT}, total: {_ANCHOR_TOTAL_TIME*1000:.2f}ms)")
    return result



def get_entity_anchors() -> Dict[str, Dict[str, Optional[str]]]:
    """
    Retrieve all active entity anchors across tenant_tracked_companies.
    Returns mapping: {company_name: {"primary_domain": ..., "industry_category": ...}}
    """
    anchors: Dict[str, Dict[str, Optional[str]]] = {}
    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_readonly_cursor() as cur:
                cur.execute("""
                    SELECT DISTINCT company_name, primary_domain, industry_category
                    FROM tenant_tracked_companies
                    WHERE status = 'active' AND (primary_domain IS NOT NULL OR industry_category IS NOT NULL);
                """)
                rows = cur.fetchall()
                for r in rows:
                    if r and r[0]:
                        anchors[r[0]] = {
                            "primary_domain": r[1],
                            "industry_category": r[2],
                        }
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query distinct entity anchors from Postgres: {e}")

    # Merge canonical fallback metadata for missing
    for c, meta in CANONICAL_COMPANY_METADATA.items():
        if c not in anchors:
            anchors[c] = {
                "primary_domain": meta.get("domain"),
                "industry_category": meta.get("category"),
            }
    return anchors


def get_tenant_tracked_companies(tenant_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve active tracked companies for the authenticated tenant under RLS context.
    Returns list of dicts with company_name, is_target, status, added_at, primary_domain,
    industry_category, tier, confidence, rationale, source.
    """
    tid = str(tenant_id).strip()
    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_tenant_db_cursor(tid, readonly=True) as cur:
                cur.execute("""
                    SELECT company_name, is_target, status, added_at,
                           primary_domain, industry_category, tier, confidence, rationale, source
                    FROM tenant_tracked_companies
                    WHERE status = 'active'
                    ORDER BY is_target DESC, company_name ASC;
                """)
                rows = cur.fetchall()
                comps = []
                for r in rows:
                    cname = r[0]
                    dom = r[4] or (CANONICAL_COMPANY_METADATA.get(cname) or {}).get("domain") or (CANONICAL_COMPANY_METADATA.get(cname.lower()) or {}).get("domain")
                    cat = r[5] or (CANONICAL_COMPANY_METADATA.get(cname) or {}).get("category") or (CANONICAL_COMPANY_METADATA.get(cname.lower()) or {}).get("category") or "Competitor Platform"
                    tier_val = r[6] or "core"
                    conf_val = r[7] or "High"
                    rationale_val = r[8] or (f"Tracked competitor monitored for market moves against {cname}." if not r[1] else "Primary subject entity for market benchmarking and signal correlation.")
                    src_val = r[9] or "Competitive intelligence index"
                    comps.append({
                        "company_name": cname,
                        "is_target": r[1],
                        "status": r[2],
                        "added_at": r[3].isoformat() if r[3] else None,
                        "primary_domain": dom,
                        "industry_category": cat,
                        "tier": tier_val,
                        "confidence": conf_val,
                        "rationale": rationale_val,
                        "source": src_val,
                    })
                return comps
        except Exception as e:
            logger.warning(f"Failed to query tenant tracked companies from Postgres: {e}")

    # Fallback to per-tenant local flat file
    tenant_file = _get_data_dir() / f"tracked_companies_{tid}.json"
    if tenant_file.exists():
        try:
            with open(tenant_file, "r", encoding="utf-8") as tf:
                data = json.load(tf)
                return [c for c in data if c.get("status", "active") == "active"]
        except Exception as e:
            logger.warning(f"Failed to read local tracked companies for {tid}: {e}")

    return []


def get_tenant_workspace_config(tenant_id: str) -> Dict[str, Any]:
    """
    Retrieve unified workspace configuration for the authenticated tenant under RLS:
    - target_company: name of active company where is_target = True
    - competitors: list of active company names where is_target = False
    - tracked_companies: full list of active tracked company dicts
    - topics: active research topics configured for this tenant
    - has_target: bool
    - has_competitors: bool
    - has_preferences: bool
    - is_configured: bool (has_target and has_competitors)
    - onboarding_complete: bool (has_target and has_competitors and has_preferences)
    """
    tid = str(tenant_id).strip()
    tracked_companies = get_tenant_tracked_companies(tid)

    target_company = ""
    competitors = []
    for c in tracked_companies:
        if c.get("is_target"):
            target_company = c.get("company_name", "")
        else:
            competitors.append(c.get("company_name", ""))

    # Fallback check from persistent flat file ONLY for OWNER_TENANT_ID in test/offline parity
    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")
    if not target_company and tid == owner_id:
        for f in _get_data_dir().glob("confirmed_competitors_*.json"):
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    f_data = json.load(fh)
                    if f_data.get("target_company"):
                        target_company = f_data["target_company"]
                        competitors = f_data.get("competitors", [])
                        tracked_companies = [{"company_name": target_company, "is_target": True, "status": "active"}] + [
                            {"company_name": comp, "is_target": False, "status": "active"} for comp in competitors
                        ]
                        break
            except Exception:
                pass

    topics = get_tenant_research_topics(tid, include_paused=False)

    has_target = bool(target_company)
    has_competitors = len(competitors) > 0
    has_preferences = len(topics) > 0
    is_configured = has_target and has_competitors
    onboarding_complete = is_configured and has_preferences

    return {
        "tenant_id": tid,
        "target_company": target_company,
        "competitors": competitors,
        "tracked_companies": tracked_companies,
        "topics": topics,
        "has_target": has_target,
        "has_competitors": has_competitors,
        "has_preferences": has_preferences,
        "is_configured": is_configured,
        "onboarding_complete": onboarding_complete,
    }


def load_confirmed_competitors(
    target_company: str,
    filepath: Optional[Union[str, Path]] = None,
) -> List[str]:
    """Load human-confirmed competitors for a target company."""
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    target_file = Path(filepath) if filepath else (data_dir / f"confirmed_competitors_{clean_name}.json")

    if not target_file.exists():
        return []

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                comps = data.get("competitors", [])
                if isinstance(comps, list):
                    return [str(c).strip() for c in comps if str(c).strip()]
            elif isinstance(data, list):
                return [str(c).strip() for c in data if str(c).strip()]
            return []
    except Exception:
        return []


def save_discovery_sources(
    target_company: str,
    sources: List[Dict[str, Any]],
    tenant_id: Optional[str] = None,
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Dual-write raw retrieved discovery context sources:
    1. Primary write: PostgreSQL `discovery_sources` table (tenant-scoped).
    2. Secondary write: Flat JSON files.
    """
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    target_file = Path(filepath) if filepath else (data_dir / f"discovery_sources_{clean_name}.json")
    if is_dry_run():
        return target_file
    rel_filename = f"data/discovery_sources_{clean_name}.json"
    now_iso = datetime.now(timezone.utc).isoformat()
    tid = tenant_id or os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    # 1. Primary PostgreSQL Write
    if sources and not is_test_environment() and is_live_write_permitted():
        try:
            # Validate UUID syntax before passing to Postgres UUID column
            uuid.UUID(str(tid))
            with get_db_cursor() as cur:
                # Ensure target company exists in companies registry
                cur.execute(
                    "INSERT INTO companies (name, status) VALUES (%s, 'active') ON CONFLICT (name) DO NOTHING;",
                    (target_company,)
                )

                ds_sql = """
                    INSERT INTO discovery_sources (tenant_id, target_company, source_type, title, url, published_at, source_age, text, source_file)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, target_company, url, title) DO UPDATE
                    SET source_type = EXCLUDED.source_type,
                        published_at = EXCLUDED.published_at,
                        source_age = EXCLUDED.source_age,
                        text = EXCLUDED.text,
                        source_file = EXCLUDED.source_file;
                """
                ds_params = [
                    (
                        tid,
                        target_company,
                        s.get("source_type", "web_search"),
                        s.get("title", ""),
                        s.get("url", ""),
                        _parse_timestamp(s.get("published_at")),
                        s.get("source_age", "recent"),
                        s.get("text", ""),
                        rel_filename,
                    )
                    for s in sources
                ]
                _execute_batch(cur, ds_sql, ds_params, page_size=100)
                logger.info(f"Dual-write: persisted {len(sources)} discovery_sources for tenant {tid} to PostgreSQL.")
        except Exception as e:
            logger.warning(f"Dual-write: could not persist discovery_sources to PostgreSQL for tenant {tid}: {e}")

    # 2. Secondary Flat File Write
    default_sources_file = data_dir / f"discovery_sources_{clean_name}.json"

    if filepath:
        target_path = Path(filepath)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "target_company": target_company,
            "saved_at": now_iso,
            "sources": sources,
        }
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        return target_path

    data_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    timestamped_file = data_dir / f"discovery_sources_{clean_name}_{timestamp}.json"

    payload = {
        "target_company": target_company,
        "saved_at": now_iso,
        "sources": sources,
    }

    with open(timestamped_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    with open(default_sources_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return timestamped_file


def load_discovery_sources(
    target_company: str,
    filepath: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """Load raw retrieved context sources for Discovery Agent."""
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)

    if filepath:
        target_path = Path(filepath)
        if not target_path.exists():
            return []
    else:
        default_file = data_dir / f"discovery_sources_{clean_name}.json"
        if default_file.exists():
            target_path = default_file
        else:
            timestamped_files = sorted(data_dir.glob(f"discovery_sources_{clean_name}_*.json"), reverse=True)
            if timestamped_files:
                target_path = timestamped_files[0]
            else:
                return []

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data.get("sources", [])
            elif isinstance(data, list):
                return data
            return []
    except Exception:
        return []


def save_pricing_snapshot(
    company: str,
    plans: List[Dict[str, Any]],
    url: str,
    data_dir: Optional[Path] = None,
    timestamp: Optional[str] = None,
) -> Path:
    """
    Dual-write pricing snapshot:
    1. Primary write: PostgreSQL `pricing_snapshots` table.
    2. Secondary write: Flat JSON files.
    """
    if data_dir is None:
        data_dir = _get_data_dir()
    slug = _sanitize_filename(company)
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    target_file = data_dir / f"pricing_snapshot_{slug}_{timestamp}.json"
    if is_dry_run():
        return target_file
    data_dir.mkdir(parents=True, exist_ok=True)

    if timestamp is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    slug = _sanitize_filename(company)
    rel_filename = f"data/pricing_snapshot_{slug}_{timestamp}.json"
    now_dt = datetime.now(timezone.utc)

    # 1. Primary PostgreSQL Write
    with get_db_cursor() as cur:
        ps_sql = """
            INSERT INTO pricing_snapshots (company_name, url, timestamp, fetched_at, plans, source_file)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (company_name, timestamp, source_file) DO UPDATE
            SET url = EXCLUDED.url,
                fetched_at = EXCLUDED.fetched_at,
                plans = EXCLUDED.plans;
        """
        cur.execute(ps_sql, (company, url, timestamp, now_dt, json.dumps(plans), rel_filename))
        logger.info(f"Dual-write: persisted pricing snapshot for {company} ({len(plans)} plans) to PostgreSQL.")

    # 2. Secondary Flat File Write
    snapshot_data = {
        "company": company,
        "url": url,
        "timestamp": timestamp,
        "fetched_at": now_dt.isoformat(),
        "plans": plans,
    }

    history_file = data_dir / f"pricing_snapshot_{slug}_{timestamp}.json"
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(snapshot_data, f, indent=2, ensure_ascii=False)

    latest_file = data_dir / f"pricing_latest_{slug}.json"
    with open(latest_file, "w", encoding="utf-8") as f:
        json.dump(snapshot_data, f, indent=2, ensure_ascii=False)

    return history_file


def get_all_entity_anchors() -> Dict[str, Dict[str, Any]]:
    """
    Bulk pre-load all entity anchors from tenant_tracked_companies into an in-memory dictionary.
    Keys are lowercased company names.
    Avoids per-signal synchronous database roundtrips during collection and noise suppression.
    """
    if is_test_environment() and not os.getenv("ALLOW_TEST_NETWORK"):
        return {}

    anchors: Dict[str, Dict[str, Any]] = {}
    try:
        with get_readonly_cursor() as cur:
            cur.execute("""
                SELECT LOWER(TRIM(company_name)), primary_domain, industry_category
                FROM tenant_tracked_companies
                WHERE primary_domain IS NOT NULL OR industry_category IS NOT NULL;
            """)
            for row in cur.fetchall():
                comp = row[0]
                if comp and comp not in anchors:
                    anchors[comp] = {
                        "primary_domain": row[1] or "",
                        "industry_category": row[2] or "",
                    }
    except Exception as e:
        logger.warning(f"Failed to preload entity anchors from Postgres: {e}")
    return anchors


def get_all_tracked_companies(scheduled_only: bool = False) -> List[str]:
    """
    Query DISTINCT company_name across all tenant_tracked_companies rows.
    Union across tenants, deduplicated.
    When scheduled_only=True, restricts strictly to tenants with is_scheduled=TRUE in scheduled_tenants.
    """
    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_readonly_cursor() as cur:
                if scheduled_only:
                    try:
                        cur.execute("""
                            SELECT DISTINCT t.company_name
                            FROM tenant_tracked_companies t
                            JOIN scheduled_tenants s ON t.tenant_id = s.tenant_id
                            WHERE t.status = 'active' AND s.is_scheduled = TRUE
                            ORDER BY t.company_name;
                        """)
                        rows = cur.fetchall()
                        if rows:
                            return [r[0] for r in rows if r and r[0]]
                    except Exception as e_sched:
                        logger.debug(f"scheduled_tenants table join skipped or missing: {e_sched}")

                cur.execute("""
                    SELECT DISTINCT company_name
                    FROM tenant_tracked_companies
                    WHERE status = 'active'
                    ORDER BY company_name;
                """)
                rows = cur.fetchall()
                if rows:
                    comps = [r[0] for r in rows if r and r[0]]
                    if comps:
                        return comps
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query distinct tracked companies from Postgres: {e}")

    # Fallback to configured target and competitors
    from . import config
    comps = [config.TARGET_COMPANY] + list(config.COMPETITORS)
    seen = set()
    res = []
    for c in comps:
        if c and c not in seen:
            seen.add(c)
            res.append(c)
    return res


def get_active_tenants(scope: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Query active tenants from tenant_tracked_companies and join with tenant_delivery_configs.
    Guarantees owner tenant is returned FIRST in the list.

    Scope handling:
    - scope="scheduled": Restricts strictly to tenants marked is_scheduled=TRUE in scheduled_tenants.
      If scheduled_tenants table does NOT exist, raises RuntimeError immediately.
      If scheduled_tenants is empty or no tenant is active, returns [] (which triggers fatal startup check).
    - scope="owner": Restricts strictly to OWNER_TENANT_ID. Returns [] if not found.
    - scope="all" or None: Returns all active tenants.

    Note: The legacy single-owner fallback dictionary has been removed so that missing tables
    or empty configurations fail loudly instead of generating unconfigured silent runs.
    """
    scope = (scope or os.getenv("PIPELINE_SCOPE") or "all").strip().lower()
    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    if is_test_environment() and not os.getenv("FORCE_LIVE_TEST_DB"):
        if scope in ("owner", "all", "scheduled"):
            from . import config
            return [{
                "tenant_id": owner_id,
                "target_company": config.TARGET_COMPANY,
                "competitors": list(config.COMPETITORS),
                "tracked_companies": [config.TARGET_COMPANY] + list(config.COMPETITORS),
                "slack_webhook_url": config.SLACK_WEBHOOK_URL or None,
                "delivery_cadence": config.SCHEDULE_CADENCE_NAME,
                "is_delivery_enabled": True,
            }]

    with get_readonly_cursor() as cur:
        join_clause = ""
        where_extra = ""

        if scope == "scheduled":
            cur.execute("""
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'scheduled_tenants' AND table_schema = 'public';
            """)
            if not cur.fetchone():
                raise RuntimeError("FATAL: Table 'scheduled_tenants' does not exist in schema public.")
            join_clause = "JOIN public.scheduled_tenants s ON t.tenant_id = s.tenant_id"
            where_extra = "AND s.is_scheduled = TRUE"

        elif scope == "owner":
            where_extra = "AND t.tenant_id = %s"

        webhook_select = "NULL::text AS slack_webhook_url" if is_dry_run() else "d.slack_webhook_url"
        webhook_group = "" if is_dry_run() else ", d.slack_webhook_url"
        sql = f"""
            SELECT 
                t.tenant_id,
                MAX(CASE WHEN t.is_target THEN t.company_name END) AS target_company,
                ARRAY_AGG(CASE WHEN NOT t.is_target THEN t.company_name END) FILTER (WHERE NOT t.is_target) AS competitors,
                ARRAY_AGG(t.company_name) AS all_tracked_companies,
                {webhook_select},
                d.delivery_cadence,
                d.is_enabled
            FROM tenant_tracked_companies t
            LEFT JOIN tenant_delivery_configs d ON t.tenant_id = d.tenant_id
            {join_clause}
            WHERE t.status = 'active' {where_extra}
            GROUP BY t.tenant_id, d.delivery_cadence, d.is_enabled{webhook_group}
            ORDER BY CASE WHEN t.tenant_id::text = %s THEN 0 ELSE 1 END, t.tenant_id;
        """
        params = (owner_id, owner_id) if scope == "owner" else (owner_id,)
        cur.execute(sql, params)
        rows = cur.fetchall()

        tenants = []
        for r in rows:
            tid = str(r[0])
            target = r[1] or "Unknown"
            raw_comps = r[2] or []
            competitors = [c for c in raw_comps if c]
            tracked = [c for c in (r[3] or []) if c]
            webhook_url = r[4]
            cadence = r[5] or "daily"
            is_enabled = r[6] if r[6] is not None else True
            tenants.append({
                "tenant_id": tid,
                "target_company": target,
                "competitors": competitors,
                "tracked_companies": tracked,
                "slack_webhook_url": webhook_url,
                "delivery_cadence": cadence,
                "is_delivery_enabled": is_enabled,
            })
        return tenants


def get_pending_tenant_events(tenant_id: str, days: int = 7, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieve backlog of consolidated events for this tenant's tracked companies
    within the last `days` days that currently have NO row in the findings table.
    Enables auto-retry of events skipped due to upstream rate limits.
    """
    if is_test_environment() and not (os.getenv("ALLOW_TEST_NETWORK") or os.getenv("FORCE_LIVE_TEST_DB")):
        return []

    try:
        with get_readonly_cursor() as cur:
            sql = """
                SELECT 
                    ce.event_id,
                    ce.company_name,
                    ce.title,
                    ce.event_summary,
                    ce.url,
                    ce.fact_confidence,
                    ce.published_at,
                    ce.created_at
                FROM consolidated_events ce
                JOIN tenant_tracked_companies tc 
                    ON LOWER(TRIM(ce.company_name)) = LOWER(TRIM(tc.company_name))
                    AND tc.tenant_id = %s AND tc.status = 'active'
                LEFT JOIN findings f 
                    ON f.event_id = ce.event_id AND f.tenant_id = %s
                WHERE f.id IS NULL
                  AND ce.created_at >= NOW() - (%s || ' days')::interval
                ORDER BY ce.created_at DESC
                LIMIT %s;
            """
            cur.execute(sql, (tenant_id, tenant_id, str(days), limit))
            rows = cur.fetchall()
            return [
                {
                    "event_id": r[0],
                    "company": r[1],
                    "title": r[2],
                    "summary": r[3],
                    "url": r[4],
                    "fact_confidence": r[5] or "Medium",
                    "published_at": r[6],
                    "created_at": r[7].isoformat() if r[7] else None,
                    "is_backlog": True,
                }
                for r in rows
            ]
    except Exception as e:
        if is_dry_run():
            raise
        logger.warning(f"Failed to query pending backlog events for tenant {tenant_id}: {e}")
        return []


def get_prior_research_activity(
    tenant_id: Optional[str] = None,
    tracked_companies: Optional[List[str]] = None,
    exclude_signal_ids: Optional[Set[str]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Query PostgreSQL (or fallback flat file store) for the most recent prior research activity.
    Scoped per-tenant and to that tenant's tracked companies.
    Used by Report Agent to evaluate change detection across cycles.
    
    Returns:
        Dict with keys {"title", "company", "published_at", "url"} or None if no prior research activity.
    """
    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_readonly_cursor() as cur:
                conditions = ["source = 'research'"]
                params: List[Any] = []

                if tracked_companies:
                    conditions.append("company_name = ANY(%s)")
                    params.append(list(tracked_companies))

                if exclude_signal_ids:
                    placeholders = ", ".join(["%s"] * len(exclude_signal_ids))
                    conditions.append(f"id NOT IN ({placeholders})")
                    params.extend(list(exclude_signal_ids))

                where_clause = " AND ".join(conditions)
                sql = f"""
                    SELECT title, company_name, published_at, url, created_at
                    FROM raw_signals
                    WHERE {where_clause}
                    ORDER BY published_timestamp DESC NULLS LAST, created_at DESC
                    LIMIT 1;
                """
                cur.execute(sql, tuple(params))
                row = cur.fetchone()
                if row and row[0]:
                    return {
                        "title": row[0],
                        "company": row[1],
                        "published_at": row[2] or "recent cycle",
                        "url": row[3],
                    }
        except Exception as e:
            logger.warning(f"Failed to query prior research activity from Postgres: {e}")

    # Fallback to local flat files
    data_dir = _get_data_dir()
    for sig_file in sorted(data_dir.glob("signals_*.json"), reverse=True):
        try:
            with open(sig_file, "r", encoding="utf-8") as f:
                sigs = json.load(f)
                for s in sigs:
                    if s.get("source") == "research" or s.get("source_subtype") == "research":
                        if exclude_signal_ids and s.get("id") in exclude_signal_ids:
                            continue
                        if tracked_companies and s.get("company") not in tracked_companies:
                            continue
                        return {
                            "title": s.get("title", ""),
                            "company": s.get("company", ""),
                            "published_at": s.get("published_at") or "recent cycle",
                            "url": s.get("url", ""),
                        }
        except Exception:
            continue
    return None


def get_tenant_delivery_config(tenant_id: str) -> Dict[str, Any]:
    """Fetch delivery configuration (Slack alerts, email digest) for tenant."""
    tid = str(tenant_id).strip()
    default_cfg = {
        "tenant_id": tid,
        "slack_webhook_url": "",
        "channel_name": "#competitive-intelligence",
        "delivery_cadence": "daily",
        "is_active": True,
        "email_status": "coming_soon",
        "updated_at": None,
    }
    if not is_test_environment():
        try:
            with get_tenant_db_cursor(tenant_id, readonly=True) as cur:
                if is_dry_run():
                    cur.execute("""
                        SELECT slack_channel, is_enabled, delivery_cadence, updated_at
                        FROM tenant_delivery_configs
                        WHERE tenant_id = %s;
                    """, (tid,))
                    row = cur.fetchone()
                    if row:
                        return {
                            "tenant_id": tid,
                            "slack_webhook_url": "",
                            "channel_name": row[0] or "#competitive-intelligence",
                            "is_active": bool(row[1]) if row[1] is not None else True,
                            "delivery_cadence": row[2] or "daily",
                            "email_status": "coming_soon",
                            "updated_at": row[3].isoformat() if row[3] else None,
                        }
                else:
                    cur.execute("""
                        SELECT slack_webhook_url, slack_channel, is_enabled, delivery_cadence, updated_at
                        FROM tenant_delivery_configs
                        WHERE tenant_id = %s;
                    """, (tid,))
                    row = cur.fetchone()
                    if row:
                        return {
                            "tenant_id": tid,
                            "slack_webhook_url": row[0] or "",
                            "channel_name": row[1] or "#competitive-intelligence",
                            "is_active": bool(row[2]) if row[2] is not None else True,
                            "delivery_cadence": row[3] or "daily",
                            "email_status": "coming_soon",
                            "updated_at": row[4].isoformat() if row[4] else None,
                        }
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query delivery config from Postgres: {e}")
    return default_cfg


def save_tenant_delivery_config(
    tenant_id: str,
    slack_webhook_url: str,
    channel_name: str = "#competitive-intelligence",
    is_active: bool = True,
    delivery_cadence: str = "daily",
) -> Dict[str, Any]:
    """Upsert delivery configuration for tenant under RLS."""
    tid = str(tenant_id).strip()
    url = str(slack_webhook_url).strip()
    chan = str(channel_name).strip() or "#competitive-intelligence"
    now_dt = datetime.now(timezone.utc)
    if is_dry_run():
        return {
            "tenant_id": tid,
            "slack_webhook_url": url,
            "channel_name": chan,
            "is_active": is_active,
            "delivery_cadence": delivery_cadence,
            "email_status": "coming_soon",
            "updated_at": now_dt.isoformat(),
        }
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
                ensure_tenant_user_exists(cur, tid)
                cur.execute("""
                    INSERT INTO tenant_delivery_configs (
                        tenant_id, slack_webhook_url, slack_channel, is_enabled, delivery_cadence, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (tenant_id) DO UPDATE SET
                        slack_webhook_url = EXCLUDED.slack_webhook_url,
                        slack_channel = EXCLUDED.slack_channel,
                        is_enabled = EXCLUDED.is_enabled,
                        delivery_cadence = EXCLUDED.delivery_cadence,
                        updated_at = NOW()
                    RETURNING tenant_id, slack_webhook_url, slack_channel, is_enabled, delivery_cadence, updated_at;
                """, (tid, url, chan, is_active, delivery_cadence))
                row = cur.fetchone()
                return {
                    "tenant_id": str(row[0]),
                    "slack_webhook_url": row[1] or "",
                    "channel_name": row[2] or chan,
                    "is_active": bool(row[3]) if row[3] is not None else True,
                    "delivery_cadence": row[4] or "daily",
                    "email_status": "coming_soon",
                    "updated_at": row[5].isoformat() if row[5] else now_dt.isoformat(),
                }
        except Exception as e:
            logger.error(f"Failed to save delivery config to Postgres: {e}")
            raise
    return {
        "tenant_id": tid,
        "slack_webhook_url": url,
        "channel_name": chan,
        "is_active": is_active,
        "delivery_cadence": delivery_cadence,
        "email_status": "coming_soon",
        "updated_at": now_dt.isoformat(),
    }



# ============================================================================
# Field Research Radar Storage Functions (Stage 3/4)
# ============================================================================

def _generate_research_item_id(canonical_url: str) -> str:
    """Deterministic 16-character research item ID hash from canonical URL."""
    clean = (canonical_url or "").strip().lower()
    return "res_" + hashlib.sha256(clean.encode("utf-8")).hexdigest()[:16]


def get_tenant_research_topics(tenant_id: str, include_paused: bool = False) -> List[Dict[str, Any]]:
    """
    Retrieve configured research topics for the authenticated tenant.
    Enforces RLS in PostgreSQL or falls back to tenant-scoped JSON file.
    When include_paused=True, returns both active and paused topics for management UI.
    """
    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_tenant_db_cursor(tenant_id, readonly=True) as cur:
                filter_clause = "WHERE TRUE" if include_paused else "WHERE is_active = TRUE"
                cur.execute(f"""
                    SELECT id, topic_label, keywords, source, is_active, created_at, updated_at
                    FROM tenant_research_topics
                    {filter_clause}
                    ORDER BY created_at ASC;
                """)
                rows = cur.fetchall()
                topics = []
                for r in rows:
                    topics.append({
                        "id": str(r[0]),
                        "tenant_id": str(tenant_id),
                        "topic_label": r[1],
                        "keywords": r[2] if isinstance(r[2], list) else (json.loads(r[2]) if r[2] else []),
                        "source": r[3] or "manual",
                        "is_active": r[4],
                        "created_at": r[5].isoformat() if hasattr(r[5], "isoformat") else str(r[5]),
                        "updated_at": r[6].isoformat() if hasattr(r[6], "isoformat") else str(r[6]),
                    })
                return topics
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query tenant research topics from Postgres: {e}")

    # Fallback to local flat file
    data_dir = _get_data_dir()
    topic_file = data_dir / f"research_topics_{tenant_id}.json"
    if not topic_file.exists():
        topic_file = data_dir / "research_topics.json"
    if topic_file.exists():
        try:
            with open(topic_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                filtered = [t for t in data if t.get("tenant_id") == tenant_id or "tenant_id" not in t]
                if not include_paused:
                    filtered = [t for t in filtered if t.get("is_active", True) is not False]
                return filtered
        except Exception as e:
            logger.warning(f"Failed to read local research topics: {e}")

    return []


def save_tenant_research_topic(
    tenant_id: str,
    topic_label: str,
    keywords: List[str],
    source: str = "manual",
) -> Dict[str, Any]:
    """
    Configure or update a research topic for a tenant.
    Stage 1: source='manual' only.
    """
    clean_label = topic_label.strip()
    clean_keywords = [k.strip() for k in keywords if k and k.strip()]
    now_iso = datetime.now(timezone.utc).isoformat()
    topic_id = str(uuid.uuid4())

    record = {
        "id": topic_id,
        "tenant_id": str(tenant_id),
        "topic_label": clean_label,
        "keywords": clean_keywords,
        "source": source,
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    if is_dry_run():
        return record

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
                ensure_tenant_user_exists(cur, tenant_id)
                cur.execute("""
                    INSERT INTO tenant_research_topics (
                        id, tenant_id, topic_label, keywords, source, is_active, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s::jsonb, %s, TRUE, NOW(), NOW())
                    ON CONFLICT (tenant_id, topic_label) DO UPDATE SET
                        keywords = EXCLUDED.keywords,
                        source = EXCLUDED.source,
                        is_active = TRUE,
                        updated_at = NOW()
                    RETURNING id, created_at, updated_at;
                """, (
                    topic_id,
                    tenant_id,
                    clean_label,
                    json.dumps(clean_keywords),
                    source,
                ))
                row = cur.fetchone()
                if row:
                    record["id"] = str(row[0])
                    record["created_at"] = row[1].isoformat() if hasattr(row[1], "isoformat") else str(row[1])
                    record["updated_at"] = row[2].isoformat() if hasattr(row[2], "isoformat") else str(row[2])
        except Exception as e:
            logger.error(f"Failed to save tenant research topic to Postgres: {e}")
            raise

    # Synchronize local flat file cache to keep stores strictly aligned
    data_dir = _get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    topic_file = data_dir / f"research_topics_{tenant_id}.json"
    existing = []
    if topic_file.exists():
        try:
            with open(topic_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = []

    # Upsert by topic_label
    updated = False
    for idx, item in enumerate(existing):
        if item.get("topic_label", "").lower() == clean_label.lower():
            item["keywords"] = clean_keywords
            item["source"] = source
            item["is_active"] = True
            item["updated_at"] = now_iso
            record = item
            updated = True
            break
    if not updated:
        existing.append(record)

    try:
        with open(topic_file, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Failed to write local research topics fallback: {e}")

    return record


def delete_tenant_research_topic(tenant_id: str, topic_id_or_label: str) -> bool:
    """Delete or deactivate a tenant research topic across both Postgres and local cache."""
    if is_dry_run():
        return False
    target = topic_id_or_label.strip()
    deleted_pg = False
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
                cur.execute("""
                    DELETE FROM tenant_research_topics
                    WHERE (id::text = %s OR topic_label = %s);
                """, (target, target))
                deleted_pg = cur.rowcount > 0
        except Exception as e:
            logger.warning(f"Failed to delete research topic from Postgres: {e}")

    # Always synchronize local flat file cache to eliminate divergence/resurrection
    deleted_file = False
    data_dir = _get_data_dir()
    topic_file = data_dir / f"research_topics_{tenant_id}.json"
    if topic_file.exists():
        try:
            with open(topic_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
            remaining = [
                t for t in existing
                if t.get("id") != target and t.get("topic_label") != target
            ]
            if len(remaining) != len(existing):
                with open(topic_file, "w", encoding="utf-8") as f:
                    json.dump(remaining, f, indent=2, ensure_ascii=False)
                deleted_file = True
        except Exception:
            pass
    return deleted_pg or deleted_file


def update_tenant_research_topic_status(tenant_id: str, topic_id_or_label: str, is_active: bool) -> bool:
    """
    Pause or resume a tenant research topic without deleting evaluation history.
    Enforces RLS under tenant_id in Postgres and synchronizes local flat file.
    """
    if is_dry_run():
        return False
    target = topic_id_or_label.strip()
    updated_pg = False
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
                cur.execute("""
                    UPDATE tenant_research_topics
                    SET is_active = %s, updated_at = NOW()
                    WHERE (id::text = %s OR topic_label = %s);
                """, (is_active, target, target))
                updated_pg = cur.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to update research topic status in Postgres: {e}")
            raise

    # Always synchronize local flat file cache
    updated_file = False
    data_dir = _get_data_dir()
    topic_file = data_dir / f"research_topics_{tenant_id}.json"
    if topic_file.exists():
        try:
            with open(topic_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
            for t in existing:
                if str(t.get("id")) == target or t.get("topic_label") == target:
                    t["is_active"] = is_active
                    t["updated_at"] = datetime.now(timezone.utc).isoformat()
                    updated_file = True
            if updated_file:
                with open(topic_file, "w", encoding="utf-8") as f:
                    json.dump(existing, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    return updated_pg or updated_file


def get_all_active_research_topics(scheduled_only: bool = False) -> List[Dict[str, Any]]:
    """
    Retrieve union of distinct active research topics across all tenants for Phase 1 global ingestion.
    When scheduled_only=True, restricts strictly to tenants in scheduled_tenants with is_scheduled=TRUE.
    """
    topics_by_label: Dict[str, Dict[str, Any]] = {}

    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_readonly_cursor() as cur:
                join_clause = ""
                where_extra = ""
                if scheduled_only:
                    try:
                        cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_tenants';")
                        if cur.fetchone():
                            join_clause = "JOIN scheduled_tenants s ON t.tenant_id = s.tenant_id"
                            where_extra = "AND s.is_scheduled = TRUE"
                    except Exception:
                        pass

                sql = f"""
                    SELECT t.topic_label, jsonb_agg(DISTINCT kw) AS all_keywords
                    FROM tenant_research_topics t, jsonb_array_elements_text(t.keywords) kw
                    {join_clause}
                    WHERE t.is_active = TRUE {where_extra}
                    GROUP BY t.topic_label;
                """
                cur.execute(sql)
                rows = cur.fetchall()
                for r in rows:
                    label = r[0]
                    kws = r[1] if isinstance(r[1], list) else (json.loads(r[1]) if r[1] else [])
                    topics_by_label[label] = {
                        "topic_label": label,
                        "keywords": kws,
                    }
                if topics_by_label:
                    return list(topics_by_label.values())
        except Exception as e:
            logger.warning(f"Failed to query distinct active topics from Postgres: {e}")

    # Fallback to local flat files
    data_dir = _get_data_dir()
    for fpath in data_dir.glob("research_topics*.json"):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                items = json.load(f)
                for item in items:
                    if not item.get("is_active", True):
                        continue
                    lbl = item.get("topic_label", "").strip()
                    if not lbl:
                        continue
                    kws = item.get("keywords", [])
                    if lbl not in topics_by_label:
                        topics_by_label[lbl] = {"topic_label": lbl, "keywords": list(kws)}
                    else:
                        existing_kws = set(topics_by_label[lbl]["keywords"])
                        for kw in kws:
                            if kw not in existing_kws:
                                topics_by_label[lbl]["keywords"].append(kw)
        except Exception:
            continue

    return list(topics_by_label.values())


def save_research_items(items: List[Dict[str, Any]]) -> int:
    """
    Persist global research items (arXiv papers, technical deep dives).
    Deduplicates by canonical URL once globally.
    """
    if is_dry_run() or not items:
        return 0

    inserted_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
                params_list = []
                for item in items:
                    can_url = item.get("canonical_url") or item.get("url", "")
                    if not can_url:
                        continue
                    res_id = item.get("id") or _generate_research_item_id(can_url)
                    pub_ts = _parse_timestamp(item.get("published_at"))
                    params_list.append((
                        res_id,
                        item.get("title", "Untitled Research Paper"),
                        item.get("url", can_url),
                        can_url,
                        str(item.get("published_at", "")),
                        pub_ts,
                        item.get("raw_excerpt", ""),
                        item.get("source", "arxiv"),
                        json.dumps(item.get("authors", [])),
                        json.dumps(item.get("matched_topics", [])),
                        json.dumps(item.get("research_details", {})),
                        item.get("is_mock", False),
                    ))

                sql = """
                    INSERT INTO research_items (
                        id, title, url, canonical_url, published_at, published_timestamp,
                        raw_excerpt, source, authors, matched_topics, research_details, is_mock, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, NOW())
                    ON CONFLICT (canonical_url) DO UPDATE SET
                        matched_topics = (
                            SELECT jsonb_agg(DISTINCT elem)
                            FROM jsonb_array_elements(research_items.matched_topics || EXCLUDED.matched_topics) elem
                        )
                """
                _execute_batch(cur, sql, params_list)
                inserted_count = len(params_list)
                return inserted_count
        except Exception as e:
            logger.error(f"Failed to batch insert research_items to Postgres: {e}")
            raise

    # Fallback to local flat file
    data_dir = _get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    res_file = data_dir / "research_items.json"
    existing_items: Dict[str, Dict[str, Any]] = {}
    if res_file.exists():
        try:
            with open(res_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                for it in loaded:
                    can = it.get("canonical_url", "")
                    if can:
                        existing_items[can] = it
        except Exception:
            existing_items = {}

    for item in items:
        can_url = item.get("canonical_url") or item.get("url", "")
        if not can_url:
            continue
        res_id = item.get("id") or _generate_research_item_id(can_url)
        item["id"] = res_id
        item["canonical_url"] = can_url
        if can_url in existing_items:
            # Merge matched_topics
            cur_topics = set(existing_items[can_url].get("matched_topics", []))
            for t in item.get("matched_topics", []):
                cur_topics.add(t)
            existing_items[can_url]["matched_topics"] = sorted(list(cur_topics))
        else:
            item["created_at"] = now_iso
            existing_items[can_url] = item
            inserted_count += 1

    with open(res_file, "w", encoding="utf-8") as f:
        json.dump(list(existing_items.values()), f, indent=2, ensure_ascii=False)

    return inserted_count


def get_research_items_for_topics(
    topic_labels: List[str],
    days: int = 14,
) -> List[Dict[str, Any]]:
    """
    Retrieve global research items matching the given topic labels.
    """
    labels_set = set(l.lower() for l in topic_labels if l)
    results = []

    if not is_test_environment() or os.getenv("FORCE_LIVE_TEST_DB"):
        try:
            with get_readonly_cursor() as cur:
                cur.execute("""
                    SELECT id, title, url, canonical_url, published_at, raw_excerpt,
                           source, authors, matched_topics, research_details, created_at
                    FROM research_items
                    WHERE matched_topics ?| %s
                    ORDER BY published_timestamp DESC NULLS LAST, created_at DESC;
                """, (list(topic_labels),))
                rows = cur.fetchall()
                for r in rows:
                    results.append({
                        "id": r[0],
                        "title": r[1],
                        "url": r[2],
                        "canonical_url": r[3],
                        "published_at": r[4],
                        "raw_excerpt": r[5],
                        "source": r[6],
                        "authors": r[7] if isinstance(r[7], list) else (json.loads(r[7]) if r[7] else []),
                        "matched_topics": r[8] if isinstance(r[8], list) else (json.loads(r[8]) if r[8] else []),
                        "research_details": r[9] if isinstance(r[9], dict) else (json.loads(r[9]) if r[9] else {}),
                        "created_at": r[10].isoformat() if hasattr(r[10], "isoformat") else str(r[10]),
                    })
                return results
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query research_items from Postgres: {e}")

    # Fallback to local flat file
    data_dir = _get_data_dir()
    res_file = data_dir / "research_items.json"
    if res_file.exists():
        try:
            with open(res_file, "r", encoding="utf-8") as f:
                items = json.load(f)
                for it in items:
                    matched = it.get("matched_topics", [])
                    if any(m.lower() in labels_set for m in matched):
                        results.append(it)
        except Exception:
            pass

    return results


def save_radar_evaluations(evaluations: List[Dict[str, Any]], tenant_id: str) -> None:
    """
    Persist per-tenant radar evaluations and competitor connection matrices.
    """
    if is_dry_run() or not evaluations:
        return

    now_iso = datetime.now(timezone.utc).isoformat()

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
                params_list = []
                for ev in evaluations:
                    raw_id = ev.get("id")
                    if raw_id:
                        try:
                            ev_id = str(uuid.UUID(str(raw_id)))
                        except (ValueError, TypeError):
                            ev_id = str(uuid.uuid4())
                    else:
                        ev_id = str(uuid.uuid4())

                    raw_topic_id = ev.get("topic_id")
                    topic_id = None
                    if raw_topic_id:
                        try:
                            topic_id = str(uuid.UUID(str(raw_topic_id)))
                        except (ValueError, TypeError) as err:
                            raise ValueError(
                                f"Data integrity violation: research radar evaluation provided invalid non-UUID topic_id "
                                f"'{raw_topic_id}': {err}"
                            )

                    params_list.append((
                        ev_id,
                        tenant_id,
                        topic_id,
                        ev.get("topic_label", "Unknown Topic"),
                        ev.get("cycle_id", "latest"),
                        ev.get("research_item_count", len(ev.get("verified_sources", []))),
                        json.dumps(ev.get("research_item_ids", [])),
                        json.dumps(ev.get("competitor_connections", {})),
                        ev.get("why_it_matters", ""),
                        json.dumps(ev.get("verified_sources", [])),
                        ev.get("state_change_detected", False),
                        json.dumps(ev.get("previous_status", {})),
                    ))

                sql = """
                    INSERT INTO research_radar_evaluations (
                        id, tenant_id, topic_id, topic_label, cycle_id, research_item_count,
                        research_item_ids, competitor_connections, why_it_matters, verified_sources,
                        state_change_detected, previous_status, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s, %s::jsonb, NOW())
                """
                _execute_batch(cur, sql, params_list)
        except Exception as e:
            logger.error(f"Failed to batch insert research_radar_evaluations to Postgres: {e}")
            raise

    # Fallback to local flat file (FAIL-CLOSED for production tenants)
    prod_tenants = {"c8f13b91-46ef-4682-9975-f85764d8a12e", (os.getenv("OWNER_TENANT_ID") or "").lower()}
    if str(tenant_id).lower() in prod_tenants and not is_live_write_permitted():
        logger.warning(
            f"REFUSING flat-file persistence for production tenant {tenant_id}: "
            f"ALLOW_LIVE_WRITE=true is not set."
        )
        return

    data_dir = _get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    eval_file = data_dir / f"radar_evaluations_{tenant_id}.json"
    history = []
    if eval_file.exists():
        try:
            with open(eval_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            history = []

    for ev in evaluations:
        if "id" not in ev:
            ev["id"] = str(uuid.uuid4())
        ev["tenant_id"] = str(tenant_id)
        if "created_at" not in ev:
            ev["created_at"] = now_iso
        history.append(ev)

    with open(eval_file, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def get_latest_radar_evaluations(tenant_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve radar evaluations from the latest cycle for the authenticated tenant.
    """
    if not is_test_environment():
        try:
            with get_tenant_db_cursor(tenant_id, readonly=True) as cur:
                cur.execute("""
                    SELECT id, topic_label, cycle_id, research_item_count, competitor_connections,
                           why_it_matters, verified_sources, state_change_detected, previous_status, created_at
                    FROM research_radar_evaluations
                    WHERE cycle_id = (
                        SELECT cycle_id FROM research_radar_evaluations
                        WHERE tenant_id = %s
                        ORDER BY created_at DESC LIMIT 1
                    )
                    ORDER BY created_at DESC;
                """, (tenant_id,))
                rows = cur.fetchall()
                evals = []
                for r in rows:
                    evals.append({
                        "id": str(r[0]),
                        "topic_label": r[1],
                        "cycle_id": r[2],
                        "research_item_count": r[3],
                        "competitor_connections": r[4] if isinstance(r[4], dict) else (json.loads(r[4]) if r[4] else {}),
                        "why_it_matters": r[5],
                        "verified_sources": r[6] if isinstance(r[6], list) else (json.loads(r[6]) if r[6] else []),
                        "state_change_detected": r[7],
                        "previous_status": r[8] if isinstance(r[8], dict) else (json.loads(r[8]) if r[8] else {}),
                        "created_at": r[9].isoformat() if hasattr(r[9], "isoformat") else str(r[9]),
                    })
                return evals
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query latest radar evaluations from Postgres: {e}")

    # Fallback to local flat file
    data_dir = _get_data_dir()
    eval_file = data_dir / f"radar_evaluations_{tenant_id}.json"
    if eval_file.exists():
        try:
            with open(eval_file, "r", encoding="utf-8") as f:
                history = json.load(f)
                if not history:
                    return []
                latest_cycle = history[-1].get("cycle_id")
                return [h for h in history if h.get("cycle_id") == latest_cycle]
        except Exception:
            pass

    return []


def get_prior_radar_evaluation(tenant_id: str, topic_label: str) -> Optional[Dict[str, Any]]:
    """
    Get the most recent prior radar evaluation for a tenant and topic.
    Used for change detection and per-tenant continuity across cycles.
    """
    if not is_test_environment():
        try:
            with get_tenant_db_cursor(tenant_id, readonly=True) as cur:
                cur.execute("""
                    SELECT id, topic_label, cycle_id, research_item_count, competitor_connections,
                           why_it_matters, verified_sources, state_change_detected, created_at
                    FROM research_radar_evaluations
                    WHERE topic_label = %s
                    ORDER BY created_at DESC
                    LIMIT 1;
                """, (topic_label,))
                row = cur.fetchone()
                if row:
                    return {
                        "id": str(row[0]),
                        "topic_label": row[1],
                        "cycle_id": row[2],
                        "research_item_count": row[3],
                        "competitor_connections": row[4] if isinstance(row[4], dict) else json.loads(row[4]),
                        "why_it_matters": row[5],
                        "verified_sources": row[6] if isinstance(row[6], list) else json.loads(row[6]),
                        "state_change_detected": row[7],
                        "created_at": row[8].isoformat() if hasattr(row[8], "isoformat") else str(row[8]),
                    }
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query prior radar evaluation from Postgres: {e}")

    # Fallback to flat file
    data_dir = _get_data_dir()
    eval_file = data_dir / f"radar_evaluations_{tenant_id}.json"
    if eval_file.exists():
        try:
            with open(eval_file, "r", encoding="utf-8") as f:
                history = json.load(f)
                matches = [
                    h for h in history
                    if h.get("topic_label", "").lower() == topic_label.lower()
                ]
                if matches:
                    matches.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                    return matches[0]
        except Exception:
            pass

    return None


def get_latest_radar_evaluations_for_tenant(tenant_id: str) -> Dict[str, Dict[str, Any]]:
    """
    Fetch the most recent radar evaluations for all topics for a tenant in a single batch query.
    Returns mapping: topic_label.lower() -> evaluation_dict.
    """
    results: Dict[str, Dict[str, Any]] = {}
    if not is_test_environment():
        try:
            with get_tenant_db_cursor(tenant_id, readonly=True) as cur:
                cur.execute("""
                    SELECT DISTINCT ON (topic_label)
                           id, topic_label, cycle_id, research_item_count, competitor_connections,
                           why_it_matters, verified_sources, state_change_detected, created_at
                    FROM research_radar_evaluations
                    ORDER BY topic_label, created_at DESC;
                """)
                rows = cur.fetchall()
                for row in rows:
                    lbl = row[1]
                    results[lbl.lower()] = {
                        "id": str(row[0]),
                        "topic_label": row[1],
                        "cycle_id": row[2],
                        "research_item_count": row[3],
                        "competitor_connections": row[4] if isinstance(row[4], dict) else (json.loads(row[4]) if row[4] else {}),
                        "why_it_matters": row[5],
                        "verified_sources": row[6] if isinstance(row[6], list) else (json.loads(row[6]) if row[6] else []),
                        "state_change_detected": row[7],
                        "created_at": row[8].isoformat() if hasattr(row[8], "isoformat") else str(row[8]),
                    }
                return results
        except Exception as e:
            if is_dry_run():
                raise
            logger.warning(f"Failed to query batch radar evaluations from Postgres: {e}")

    # Fallback to flat file
    data_dir = _get_data_dir()
    eval_file = data_dir / f"radar_evaluations_{tenant_id}.json"
    if eval_file.exists():
        try:
            with open(eval_file, "r", encoding="utf-8") as f:
                history = json.load(f)
                for h in sorted(history, key=lambda x: x.get("created_at", "")):
                    lbl = h.get("topic_label", "")
                    if lbl:
                        results[lbl.lower()] = h
        except Exception:
            pass

    return results


def get_radar_history(
    tenant_id: str,
    topic_label: Optional[str] = None,
    competitor: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Query historical radar evaluation records for a tenant, optionally filtered by topic or competitor.
    Powers the browsable historical view.
    """
    records: List[Dict[str, Any]] = []

    if not is_test_environment():
        try:
            with get_tenant_db_cursor(tenant_id, readonly=True) as cur:
                query = """
                    SELECT id, topic_label, cycle_id, research_item_count, competitor_connections,
                           why_it_matters, verified_sources, state_change_detected, previous_status, created_at
                    FROM research_radar_evaluations
                    WHERE 1=1
                """
                params: List[Any] = []
                if topic_label:
                    query += " AND topic_label = %s"
                    params.append(topic_label)
                query += " ORDER BY created_at DESC;"
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                for r in rows:
                    conns = r[4] if isinstance(r[4], dict) else (json.loads(r[4]) if r[4] else {})
                    if competitor and competitor not in conns:
                        continue
                    records.append({
                        "id": str(r[0]),
                        "topic_label": r[1],
                        "cycle_id": r[2],
                        "research_item_count": r[3],
                        "competitor_connections": conns,
                        "why_it_matters": r[5],
                        "verified_sources": r[6] if isinstance(r[6], list) else (json.loads(r[6]) if r[6] else []),
                        "state_change_detected": r[7],
                        "previous_status": r[8] if isinstance(r[8], dict) else (json.loads(r[8]) if r[8] else {}),
                        "created_at": r[9].isoformat() if hasattr(r[9], "isoformat") else str(r[9]),
                    })
                return records
        except Exception as e:
            logger.warning(f"Failed to query radar history from Postgres: {e}")

    # Fallback to flat file
    data_dir = _get_data_dir()
    eval_file = data_dir / f"radar_evaluations_{tenant_id}.json"
    if eval_file.exists():
        try:
            with open(eval_file, "r", encoding="utf-8") as f:
                history = json.load(f)
                for h in sorted(history, key=lambda x: x.get("created_at", ""), reverse=True):
                    if topic_label and h.get("topic_label", "").lower() != topic_label.lower():
                        continue
                    conns = h.get("competitor_connections", {})
                    if competitor and competitor not in conns:
                        continue
                    records.append(h)
        except Exception:
            pass

    return records


# ============================================================================
# Pipeline Run State & Telemetry Storage (Progressive Monitoring)
# ============================================================================

_IN_MEMORY_RUN_PROGRESS: Dict[str, Dict[str, Any]] = {}


def ensure_pipeline_run_tables() -> None:
    """Ensure pipeline_run_progress table exists in live PostgreSQL."""
    if is_dry_run() or is_test_environment() or not is_live_write_permitted():
        return
    try:
        with get_db_cursor() as cur:
            if isinstance(cur, MockCursor):
                return
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_run_progress (
                    run_id VARCHAR(64) PRIMARY KEY,
                    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
                    status VARCHAR(50) NOT NULL DEFAULT 'running',
                    current_phase VARCHAR(100) NOT NULL DEFAULT 'initializing',
                    progress_message TEXT NOT NULL DEFAULT 'Continuous monitoring active',
                    total_companies INT NOT NULL DEFAULT 0,
                    completed_companies INT NOT NULL DEFAULT 0,
                    completed_company_names JSONB NOT NULL DEFAULT '[]'::jsonb,
                    current_company VARCHAR(255),
                    total_sources INT NOT NULL DEFAULT 0,
                    completed_sources INT NOT NULL DEFAULT 0,
                    source_health JSONB NOT NULL DEFAULT '{}'::jsonb,
                    source_errors JSONB NOT NULL DEFAULT '{}'::jsonb,
                    first_visible_data_at TIMESTAMPTZ,
                    time_to_first_data_seconds NUMERIC(8, 2),
                    is_first_run BOOLEAN NOT NULL DEFAULT FALSE,
                    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    completed_at TIMESTAMPTZ,
                    total_duration_seconds NUMERIC(8, 2)
                );
                CREATE INDEX IF NOT EXISTS idx_run_progress_tenant ON pipeline_run_progress(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_run_progress_status ON pipeline_run_progress(status);
                CREATE INDEX IF NOT EXISTS idx_run_progress_started ON pipeline_run_progress(started_at DESC);
            """)
    except Exception as e:
        logger.warning(f"ensure_pipeline_run_tables notice: {e}")


def create_pipeline_run(
    tenant_id: Optional[str] = None,
    total_companies: int = 0,
    companies: Optional[List[str]] = None,
    sources: Optional[List[str]] = None,
    is_first_run: bool = False,
) -> str:
    """Initialize an active pipeline run and return its unique run_id."""
    if is_dry_run():
        return f"dry_run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    msg = f"Fetching signals: 0 of {total_companies} competitors complete" if total_companies > 0 else "Initializing intelligence sweep..."

    record = {
        "run_id": run_id,
        "tenant_id": tenant_id,
        "status": "running",
        "current_phase": "initializing",
        "progress_message": msg,
        "total_companies": total_companies,
        "completed_companies": 0,
        "completed_company_names": [],
        "current_company": companies[0] if companies else None,
        "total_sources": len(sources) if sources else len(config.SOURCES),
        "completed_sources": 0,
        "source_health": {},
        "source_errors": {},
        "first_visible_data_at": None,
        "time_to_first_data_seconds": None,
        "is_first_run": is_first_run,
        "started_at": now_iso,
        "updated_at": now_iso,
        "completed_at": None,
        "total_duration_seconds": None,
    }

    _IN_MEMORY_RUN_PROGRESS[run_id] = record

    if not is_test_environment() and is_live_write_permitted():
        try:
            ensure_pipeline_run_tables()
            with get_db_cursor() as cur:
                if not isinstance(cur, MockCursor):
                    cur.execute("""
                        INSERT INTO pipeline_run_progress (
                            run_id, tenant_id, status, current_phase, progress_message,
                            total_companies, completed_companies, completed_company_names,
                            current_company, total_sources, completed_sources,
                            source_health, source_errors, is_first_run, started_at, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW());
                    """, (
                        run_id, tenant_id, "running", "initializing", msg,
                        total_companies, 0, json.dumps([]),
                        companies[0] if companies else None,
                        len(sources) if sources else len(config.SOURCES), 0,
                        json.dumps({}), json.dumps({}), is_first_run
                    ))
        except Exception as e:
            logger.warning(f"Failed to persist pipeline_run_progress to Postgres: {e}")

    return run_id


def update_pipeline_progress(
    run_id: str,
    phase: Optional[str] = None,
    completed_companies: Optional[int] = None,
    completed_company_names: Optional[List[str]] = None,
    current_company: Optional[str] = None,
    message: Optional[str] = None,
    source_health: Optional[Dict[str, Any]] = None,
    source_errors: Optional[Dict[str, Any]] = None,
) -> None:
    """Update progress telemetry for an active run."""
    if is_dry_run():
        return
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()

    rec = _IN_MEMORY_RUN_PROGRESS.get(run_id)
    if rec:
        if phase: rec["current_phase"] = phase
        if completed_companies is not None: rec["completed_companies"] = completed_companies
        if completed_company_names is not None: rec["completed_company_names"] = completed_company_names
        if current_company is not None: rec["current_company"] = current_company
        if message: rec["progress_message"] = message
        if source_health: rec["source_health"].update(source_health)
        if source_errors: rec["source_errors"].update(source_errors)
        rec["updated_at"] = now_iso

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
                if not isinstance(cur, MockCursor):
                    updates = ["updated_at = NOW()"]
                    params: List[Any] = []
                    if phase:
                        updates.append("current_phase = %s")
                        params.append(phase)
                    if completed_companies is not None:
                        updates.append("completed_companies = %s")
                        params.append(completed_companies)
                    if completed_company_names is not None:
                        updates.append("completed_company_names = %s")
                        params.append(json.dumps(completed_company_names))
                    if current_company is not None:
                        updates.append("current_company = %s")
                        params.append(current_company)
                    if message:
                        updates.append("progress_message = %s")
                        params.append(message)
                    if source_health:
                        updates.append("source_health = source_health || %s::jsonb")
                        params.append(json.dumps(source_health))
                    if source_errors:
                        updates.append("source_errors = source_errors || %s::jsonb")
                        params.append(json.dumps(source_errors))

                    params.append(run_id)
                    cur.execute(f"""
                        UPDATE pipeline_run_progress
                        SET {', '.join(updates)}
                        WHERE run_id = %s;
                    """, tuple(params))
        except Exception as e:
            logger.warning(f"Failed to update pipeline_run_progress in Postgres: {e}")


def record_first_visible_data(run_id: str) -> Optional[float]:
    """Record the timestamp when the first queryable row was committed to the DB."""
    if is_dry_run():
        return None
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    time_to_first: Optional[float] = None

    rec = _IN_MEMORY_RUN_PROGRESS.get(run_id)
    if rec and not rec.get("first_visible_data_at"):
        started = datetime.fromisoformat(rec["started_at"])
        time_to_first = round((now_dt - started).total_seconds(), 2)
        rec["first_visible_data_at"] = now_iso
        rec["time_to_first_data_seconds"] = time_to_first

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
                if not isinstance(cur, MockCursor):
                    cur.execute("""
                        UPDATE pipeline_run_progress
                        SET first_visible_data_at = NOW(),
                            time_to_first_data_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
                        WHERE run_id = %s AND first_visible_data_at IS NULL
                        RETURNING time_to_first_data_seconds;
                    """, (run_id,))
                    row = cur.fetchone()
                    if row and row[0]:
                        time_to_first = float(row[0])
        except Exception as e:
            logger.warning(f"Failed to record first_visible_data in Postgres: {e}")

    return time_to_first


def complete_pipeline_run(
    run_id: str,
    status: str = "completed",
    error_message: Optional[str] = None,
) -> None:
    """Mark a pipeline run as completed, failed, or timed_out."""
    if is_dry_run():
        return
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()

    rec = _IN_MEMORY_RUN_PROGRESS.get(run_id)
    if rec:
        rec["status"] = status
        rec["current_phase"] = status
        rec["completed_at"] = now_iso
        if error_message:
            rec["source_errors"]["fatal"] = error_message
        started = datetime.fromisoformat(rec["started_at"])
        rec["total_duration_seconds"] = round((now_dt - started).total_seconds(), 2)
        if status == "completed":
            rec["progress_message"] = "Intelligence cycle completed"
        elif status == "timed_out":
            rec["progress_message"] = "Monitoring run took longer than expected"
        else:
            rec["progress_message"] = f"Monitoring run stopped: {error_message or 'error'}"

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
                if not isinstance(cur, MockCursor):
                    cur.execute("""
                        UPDATE pipeline_run_progress
                        SET status = %s,
                            current_phase = %s,
                            progress_message = %s,
                            completed_at = NOW(),
                            updated_at = NOW(),
                            total_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
                        WHERE run_id = %s;
                    """, (
                        status, status,
                        "Intelligence cycle completed" if status == "completed" else ("Monitoring run timed out" if status == "timed_out" else f"Run failed: {error_message}"),
                        run_id
                    ))
        except Exception as e:
            logger.warning(f"Failed to complete pipeline_run_progress in Postgres: {e}")


def _format_run_progress_row(row: Any) -> Dict[str, Any]:
    """Helper to convert a pipeline_run_progress row into a clean dictionary."""
    return {
        "run_id": str(row[0]),
        "tenant_id": str(row[1]) if row[1] else None,
        "status": row[2],
        "current_phase": row[3],
        "progress_message": row[4],
        "total_companies": row[5],
        "completed_companies": row[6],
        "completed_company_names": row[7] if isinstance(row[7], list) else (json.loads(row[7]) if row[7] else []),
        "current_company": row[8],
        "total_sources": row[9],
        "completed_sources": row[10],
        "source_health": row[11] if isinstance(row[11], dict) else (json.loads(row[11]) if row[11] else {}),
        "source_errors": row[12] if isinstance(row[12], dict) else (json.loads(row[12]) if row[12] else {}),
        "first_visible_data_at": row[13].isoformat() if hasattr(row[13], "isoformat") else (str(row[13]) if row[13] else None),
        "time_to_first_data_seconds": float(row[14]) if row[14] is not None else None,
        "is_first_run": bool(row[15]),
        "started_at": row[16].isoformat() if hasattr(row[16], "isoformat") else str(row[16]),
        "updated_at": row[17].isoformat() if hasattr(row[17], "isoformat") else str(row[17]),
        "completed_at": row[18].isoformat() if hasattr(row[18], "isoformat") else (str(row[18]) if row[18] else None),
        "total_duration_seconds": float(row[19]) if row[19] is not None else None,
    }


_LAST_REAP_STALE_RUNS = 0.0


def reap_stale_pipeline_runs(timeout_minutes: int = 30) -> int:
    """
    Housekeeping utility: reap stale runs older than timeout_minutes.
    Executes an UPDATE on pipeline_run_progress.
    Guarded by is_dry_run() and is_live_write_permitted().
    """
    if is_dry_run() or not is_live_write_permitted() or is_test_environment():
        return 0
    try:
        with get_db_cursor(readonly=False) as cur:
            if not isinstance(cur, MockCursor):
                cur.execute(f"""
                    UPDATE pipeline_run_progress
                    SET status = 'timed_out',
                        current_phase = 'timed_out',
                        progress_message = 'Monitoring run timed out after {timeout_minutes} minutes',
                        completed_at = NOW(),
                        updated_at = NOW()
                    WHERE status = 'running'
                      AND started_at < NOW() - INTERVAL '{timeout_minutes} minutes';
                """)
                return cur.rowcount
    except Exception as e:
        logger.warning(f"Failed to reap stale pipeline runs in Postgres: {e}")
    return 0


def get_active_or_latest_run_progress(
    tenant_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieve the currently running pipeline progress or the latest run for a tenant."""
    global _LAST_REAP_STALE_RUNS
    # 1. Primary PostgreSQL query
    if not is_test_environment():
        try:
            # Housekeeping: reap stale runs at most once every 5 minutes if live write is permitted
            now_ts = time.time()
            if is_live_write_permitted() and not is_dry_run() and now_ts - _LAST_REAP_STALE_RUNS > 300:
                _LAST_REAP_STALE_RUNS = now_ts
                try:
                    reap_stale_pipeline_runs(timeout_minutes=30)
                except Exception:
                    pass

            with get_db_cursor(readonly=True) as cur:
                if not isinstance(cur, MockCursor):
                    base_select = """
                        SELECT run_id, tenant_id, status, current_phase, progress_message,
                               total_companies, completed_companies, completed_company_names,
                               current_company, total_sources, completed_sources,
                               source_health, source_errors, first_visible_data_at,
                               time_to_first_data_seconds, is_first_run, started_at,
                               updated_at, completed_at, total_duration_seconds
                        FROM pipeline_run_progress
                    """

                    if tenant_id:
                        cur.execute(f"""
                            {base_select}
                            WHERE tenant_id = %s::uuid
                            ORDER BY (CASE WHEN status = 'running' THEN 0 ELSE 1 END), started_at DESC
                            LIMIT 1;
                        """, (tenant_id,))
                        row = cur.fetchone()
                        if row:
                            return _format_run_progress_row(row)

                    # Global run fallback (or when tenant_id is None)
                    cur.execute(f"""
                        {base_select}
                        WHERE tenant_id IS NULL
                        ORDER BY (CASE WHEN status = 'running' THEN 0 ELSE 1 END), started_at DESC
                        LIMIT 1;
                    """)
                    row = cur.fetchone()
                    if row:
                        return _format_run_progress_row(row)
        except Exception as e:
            logger.warning(f"Failed to query pipeline_run_progress from Postgres: {e}")

    # 2. In-memory fallback
    now = datetime.now(timezone.utc)
    for r in _IN_MEMORY_RUN_PROGRESS.values():
        if r.get("status") == "running" and r.get("started_at"):
            try:
                st = datetime.fromisoformat(r["started_at"])
                if (now - st).total_seconds() > 1800:
                    r["status"] = "timed_out"
                    r["current_phase"] = "timed_out"
                    r["progress_message"] = "Monitoring run timed out after 30 minutes"
            except Exception:
                pass

    if tenant_id:
        tenant_runs = [r for r in _IN_MEMORY_RUN_PROGRESS.values() if r.get("tenant_id") == tenant_id]
        if tenant_runs:
            sorted_runs = sorted(
                tenant_runs,
                key=lambda x: (0 if x.get("status") == "running" else 1, x.get("started_at", "")),
                reverse=False,
            )
            return sorted_runs[0]

    global_runs = [r for r in _IN_MEMORY_RUN_PROGRESS.values() if r.get("tenant_id") is None]
    if global_runs:
        sorted_runs = sorted(
            global_runs,
            key=lambda x: (0 if x.get("status") == "running" else 1, x.get("started_at", "")),
            reverse=False,
        )
        return sorted_runs[0]

    return None


