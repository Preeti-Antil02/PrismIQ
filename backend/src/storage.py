import hashlib
import json
import logging
import os
import re
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Set, Tuple, Union
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Ensure backend root is known and .env is loaded
_backend_root = Path(__file__).resolve().parent.parent
_env_path = _backend_root / ".env"
if _env_path.exists():
    load_dotenv(_env_path)


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
        return ("00000000-0000-0000-0000-000000000000",)

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


def is_live_write_permitted() -> bool:
    """
    Fail-closed authorization check for live PostgreSQL database connections/writes.
    Requires explicit, deliberate opt-in via ALLOW_LIVE_WRITE=true or ALLOW_PROD_WRITE=true.
    Any ad hoc CLI invocation, unconfigured script, or manual run without explicit opt-in
    fails CLOSED by default to prevent production data pollution.
    """
    if is_test_environment():
        return False
    return (
        os.getenv("ALLOW_LIVE_WRITE", "").lower() in ("true", "1", "yes")
        or os.getenv("ALLOW_PROD_WRITE", "").lower() in ("true", "1", "yes")
    )



def get_db_url() -> Optional[str]:
    """Retrieve PostgreSQL connection URL from environment with test isolation guard."""
    if is_test_environment():
        # In test mode, only explicit TEST_DATABASE_URL is permitted
        test_url = os.getenv("TEST_DATABASE_URL")
        if test_url:
            prod_url = os.getenv("SUPABASE_DB_URL")
            if prod_url and test_url == prod_url:
                raise PermissionError(
                    "CRITICAL SECURITY GUARD: TEST_DATABASE_URL points directly to production SUPABASE_DB_URL! "
                    "Test suite execution refused to prevent production data pollution."
                )
            return test_url
        return None

    return (
        os.getenv("SUPABASE_DB_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
    )


@contextmanager
def get_db_cursor() -> Generator[Any, None, None]:
    """
    Context manager yielding a PostgreSQL cursor within an ACID transaction.
    Commits on success, rolls back and raises on failure.
    
    FAIL-CLOSED PRODUCTION SECURITY SAFEGUARDS:
    1. Test mode (pytest or PRISMIQ_ENV='test'):
       - If TEST_DATABASE_URL is set and matches SUPABASE_DB_URL -> raises PermissionError.
       - If TEST_DATABASE_URL is set -> connects to test database.
       - Otherwise -> yields isolated in-memory MockCursor.
    2. Ad hoc / CLI / Non-test invocations without explicit authorization:
       - Fails CLOSED by default unless ALLOW_LIVE_WRITE=true (or FORCE_LIVE_DB=1).
       - Yields MockCursor to guarantee zero production database pollution.
    3. Production-authorized mode:
       - Connects directly to SUPABASE_DB_URL.
    """
    if is_test_environment():
        test_url = get_db_url()
        if not test_url:
            # Yield isolated in-memory mock cursor for unit/integration tests
            yield MockCursor()
            return
        db_url = test_url
    else:
        if not is_live_write_permitted():
            logger.info(
                "Live PostgreSQL access not authorized (ALLOW_LIVE_WRITE=true not set). "
                "Failing CLOSED to isolated MockCursor to prevent production data pollution."
            )
            yield MockCursor()
            return

        db_url = get_db_url()
        if not db_url:
            raise ConnectionError(
                "SUPABASE_DB_URL is not set. Primary PostgreSQL store cannot be accessed."
            )

    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"PostgreSQL transaction failed: {e}", exc_info=True)
        raise
    finally:
        conn.close()


@contextmanager
def get_tenant_db_cursor(tenant_id: str) -> Generator[Any, None, None]:
    """
    Context manager yielding a PostgreSQL cursor scoped to the authenticated tenant's RLS context.
    Executes:
        SET LOCAL "request.jwt.claim.sub" = %s;
        SET LOCAL ROLE authenticated;
    Guarantees PostgreSQL Row Level Security (RLS) enforcement at the query level.
    """
    if is_test_environment():
        test_url = get_db_url()
        if not test_url:
            yield MockCursor()
            return
        db_url = test_url
    else:
        db_url = get_db_url()
        if not db_url:
            if not is_live_write_permitted():
                yield MockCursor()
                return
            raise ConnectionError("SUPABASE_DB_URL is not set.")

    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SET LOCAL "request.jwt.claim.sub" = %s; SET LOCAL ROLE authenticated;',
                (str(tenant_id),)
            )
            yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"PostgreSQL tenant transaction failed (tenant {tenant_id}): {e}", exc_info=True)
        raise
    finally:
        conn.close()


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
    if signals:
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


def save_noise_decisions(decisions: List[Dict[str, Any]]) -> None:
    """
    Dual-write noise suppression decisions:
    Primary write: PostgreSQL `noise_suppression_decisions` table.
    """
    if not decisions:
        return
    with get_db_cursor() as cur:
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
        _execute_batch(cur, nd_sql, nd_params, page_size=200)
        logger.info(f"Dual-write: persisted {len(nd_params)} noise_suppression_decisions to PostgreSQL.")


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
    if events:
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
                    es_params.append((eid, s_id))

            _execute_batch(cur, ev_sql, ev_params, page_size=200)

            es_sql = """
                INSERT INTO event_signals (event_id, signal_id)
                VALUES (%s, %s)
                ON CONFLICT (event_id, signal_id) DO NOTHING;
            """
            _execute_batch(cur, es_sql, es_params, page_size=200)
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
    if not findings:
        return
    
    tid = tenant_id or os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    with get_db_cursor() as cur:
        f_sql = """
            INSERT INTO findings (tenant_id, event_id, company_name, why_it_matters, confidence, decision_score, tier, is_mock, inference_confidence)
            VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE, %s)
            ON CONFLICT (tenant_id, event_id) DO UPDATE
            SET company_name = EXCLUDED.company_name,
                why_it_matters = EXCLUDED.why_it_matters,
                confidence = EXCLUDED.confidence,
                decision_score = EXCLUDED.decision_score,
                tier = EXCLUDED.tier,
                inference_confidence = COALESCE(EXCLUDED.inference_confidence, findings.inference_confidence);
        """
        f_params = []
        for f in findings:
            eid = f.get("event_id")
            if not eid:
                continue
            comp = f.get("company") or f.get("company_name", "Unknown")
            why = f.get("why_it_matters", "")
            conf = f.get("confidence", "Medium")
            score = f.get("decision_score", 1.0)
            tier = f.get("tier", "should_know")
            infer_conf = f.get("inference_confidence")
            f_params.append((tid, eid, comp, why, conf, score, tier, infer_conf))

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

    with open(default_report_file, "w", encoding="utf-8") as f:
        f.write(content)

    # Ensure backend/data/brief.md is also mirrored
    data_brief_file = _backend_root / "data" / "brief.md"
    if data_brief_file != default_report_file:
        data_brief_file.parent.mkdir(parents=True, exist_ok=True)
        with open(data_brief_file, "w", encoding="utf-8") as f:
            f.write(content)

    return timestamped_report


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
    rel_filename = f"data/discovery_proposal_{clean_name}.json"
    now_dt = datetime.now(timezone.utc)
    tid = tenant_id or os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    # 1. Primary PostgreSQL Write
    if candidates:
        with get_db_cursor() as cur:
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

            # Insert candidates
            dc_sql = """
                INSERT INTO discovery_candidates (
                    tenant_id, proposal_id, target_company, name, rationale, confidence,
                    source, source_age, source_date, freshness_note, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, target_company, name, source) DO UPDATE
                SET rationale = EXCLUDED.rationale,
                    confidence = EXCLUDED.confidence,
                    source_age = EXCLUDED.source_age,
                    source_date = EXCLUDED.source_date,
                    freshness_note = EXCLUDED.freshness_note,
                    status = EXCLUDED.status;
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
                    c.get("freshness_note"), c.get("status", "proposed")
                ))
            _execute_batch(cur, dc_sql, dc_params, page_size=50)
            logger.info(f"Dual-write: persisted discovery proposal and {len(dc_params)} candidates for tenant {tid} to PostgreSQL.")

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


def save_tenant_confirmed_companies(
    tenant_id: str,
    target_company: str,
    confirmed_competitors: List[str],
) -> List[Dict[str, Any]]:
    """
    Write confirmed onboarding company selection directly into tenant_tracked_companies.
    1. Inserts target company as is_target = TRUE, status = 'active'.
    2. Inserts confirmed competitors as is_target = FALSE, status = 'active'.
    3. Ensures companies exist in global canonical registry.
    4. Updates discovery_candidates status to 'confirmed' for selected, 'rejected' for omitted.
    """
    tid = str(tenant_id).strip()
    target = str(target_company).strip()
    competitors = [str(c).strip() for c in confirmed_competitors if str(c).strip()]
    now_dt = datetime.now(timezone.utc)

    # 1. Primary PostgreSQL Write
    with get_db_cursor() as cur:
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

        # Upsert target company into tenant_tracked_companies
        target_ttc_sql = """
            INSERT INTO tenant_tracked_companies (tenant_id, company_name, is_target, status, added_at, updated_at)
            VALUES (%s, %s, TRUE, 'active', %s, %s)
            ON CONFLICT (tenant_id, company_name) DO UPDATE
            SET is_target = TRUE, status = 'active', updated_at = EXCLUDED.updated_at;
        """
        cur.execute(target_ttc_sql, (tid, target, now_dt, now_dt))

        # Upsert confirmed competitors into tenant_tracked_companies
        comp_ttc_sql = """
            INSERT INTO tenant_tracked_companies (tenant_id, company_name, is_target, status, added_at, updated_at)
            VALUES (%s, %s, FALSE, 'active', %s, %s)
            ON CONFLICT (tenant_id, company_name) DO UPDATE
            SET is_target = FALSE, status = 'active', updated_at = EXCLUDED.updated_at;
        """
        ttc_params = [(tid, c, now_dt, now_dt) for c in competitors]
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

    # 2. Parity flat-file write
    save_confirmed_competitors(target, competitors)

    # Return structured tracked companies
    tracked = [{"company_name": target, "is_target": True, "status": "active"}]
    for c in competitors:
        tracked.append({"company_name": c, "is_target": False, "status": "active"})
    return tracked


def untrack_tenant_company(tenant_id: str, company_name: str) -> bool:
    """
    Mark a tracked company as 'untracked' for the tenant.
    Preserves signal and event history while removing from active competitor views.
    """
    tid = str(tenant_id).strip()
    comp = str(company_name).strip()
    with get_db_cursor() as cur:
        cur.execute("""
            UPDATE tenant_tracked_companies
            SET status = 'untracked', updated_at = NOW()
            WHERE tenant_id = %s AND company_name = %s AND status = 'active';
        """, (tid, comp))
        return cur.rowcount > 0


def track_tenant_company(tenant_id: str, company_name: str, is_target: bool = False) -> Dict[str, Any]:
    """
    Add or reactivate a tracked company for a tenant under RLS.
    """
    tid = str(tenant_id).strip()
    comp = str(company_name).strip()
    now_dt = datetime.now(timezone.utc)
    with get_db_cursor() as cur:
        cur.execute("INSERT INTO companies (name, status) VALUES (%s, 'confirmed') ON CONFLICT (name) DO NOTHING;", (comp,))
        cur.execute("""
            INSERT INTO tenant_tracked_companies (tenant_id, company_name, is_target, status, added_at, updated_at)
            VALUES (%s, %s, %s, 'active', %s, %s)
            ON CONFLICT (tenant_id, company_name) DO UPDATE
            SET status = 'active', updated_at = NOW()
            RETURNING company_name, is_target, status, added_at;
        """, (tid, comp, is_target, now_dt, now_dt))
        row = cur.fetchone()
        return {
            "company_name": row[0],
            "is_target": row[1],
            "status": row[2],
            "added_at": row[3].isoformat() if row[3] else now_dt.isoformat(),
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
    rel_filename = f"data/discovery_sources_{clean_name}.json"
    now_iso = datetime.now(timezone.utc).isoformat()
    tid = tenant_id or os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    # 1. Primary PostgreSQL Write
    if sources:
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


def get_all_tracked_companies() -> List[str]:
    """
    Query DISTINCT company_name across all tenant_tracked_companies rows.
    Union across every tenant, deduplicated.
    Replaces hardcoded TARGET_COMPANY / COMPETITORS as source of what gets monitored in Phase 1.
    """
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
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


def get_active_tenants() -> List[Dict[str, Any]]:
    """
    Query all active tenants from tenant_tracked_companies and join with tenant_delivery_configs.
    Returns structured list of tenant configuration contexts for Phase 2 processing.
    """
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
                sql = """
                    SELECT 
                        t.tenant_id,
                        MAX(CASE WHEN t.is_target THEN t.company_name END) AS target_company,
                        ARRAY_AGG(CASE WHEN NOT t.is_target THEN t.company_name END) FILTER (WHERE NOT t.is_target) AS competitors,
                        ARRAY_AGG(t.company_name) AS all_tracked_companies,
                        d.slack_webhook_url,
                        d.delivery_cadence,
                        d.is_enabled
                    FROM tenant_tracked_companies t
                    LEFT JOIN tenant_delivery_configs d ON t.tenant_id = d.tenant_id
                    WHERE t.status = 'active'
                    GROUP BY t.tenant_id, d.slack_webhook_url, d.delivery_cadence, d.is_enabled
                    ORDER BY t.tenant_id;
                """
                cur.execute(sql)
                rows = cur.fetchall()
                if rows:
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
        except Exception as e:
            logger.warning(f"Failed to query active tenants from Postgres: {e}")

    # Fallback to single owner tenant context
    from . import config
    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")
    return [{
        "tenant_id": owner_id,
        "target_company": config.TARGET_COMPANY,
        "competitors": list(config.COMPETITORS),
        "tracked_companies": [config.TARGET_COMPANY] + list(config.COMPETITORS),
        "slack_webhook_url": config.SLACK_WEBHOOK_URL or None,
        "delivery_cadence": config.SCHEDULE_CADENCE_NAME,
        "is_delivery_enabled": True,
    }]


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
    if not is_test_environment():
        try:
            with get_db_cursor() as cur:
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
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
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
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
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
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
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

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
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


def get_all_active_research_topics() -> List[Dict[str, Any]]:
    """
    Retrieve union of distinct active research topics across all tenants for Phase 1 global ingestion.
    """
    topics_by_label: Dict[str, Dict[str, Any]] = {}

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
                cur.execute("""
                    SELECT topic_label, jsonb_agg(DISTINCT kw) AS all_keywords
                    FROM tenant_research_topics, jsonb_array_elements_text(keywords) kw
                    WHERE is_active = TRUE
                    GROUP BY topic_label;
                """)
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
    if not items:
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

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_db_cursor() as cur:
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
    if not evaluations:
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
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
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
    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
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

    if not is_test_environment() and is_live_write_permitted():
        try:
            with get_tenant_db_cursor(tenant_id) as cur:
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


