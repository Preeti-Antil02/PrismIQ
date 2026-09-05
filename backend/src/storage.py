import hashlib
import json
import logging
import os
import re
import sys
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
    if os.getenv("FORCE_LIVE_DB") == "1":
        return False
    return (
        os.getenv("PRISMIQ_ENV") == "test"
        or "PYTEST_CURRENT_TEST" in os.environ
        or "pytest" in sys.modules
        or any("test" in arg.lower() for arg in sys.argv if arg.endswith(".py") or "pytest" in arg)
    )


def is_live_write_permitted() -> bool:
    """
    Fail-closed authorization check for live PostgreSQL database connections/writes.
    Requires explicit opt-in via ALLOW_LIVE_WRITE=true, ALLOW_PROD_WRITE=true, or FORCE_LIVE_DB=1.
    Any ad hoc CLI invocation, unconfigured script, or manual run without explicit opt-in
    fails CLOSED by default to prevent production data pollution.
    """
    if is_test_environment() and not (os.getenv("FORCE_LIVE_DB") == "1"):
        return False
    return (
        os.getenv("ALLOW_LIVE_WRITE", "").lower() in ("true", "1", "yes")
        or os.getenv("ALLOW_PROD_WRITE", "").lower() in ("true", "1", "yes")
        or os.getenv("FORCE_LIVE_DB") == "1"
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
            # Ensure competitor records exist
            companies = set(s.get("company", "").strip() for s in signals if s.get("company"))
            comp_sql = """
                INSERT INTO competitors (name, is_target, is_mock)
                VALUES (%s, FALSE, FALSE)
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
                    published_at, published_timestamp, url, source_urls, raw_excerpt, is_mock
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                ON CONFLICT (event_id) DO UPDATE
                SET title = EXCLUDED.title,
                    event_summary = EXCLUDED.event_summary,
                    corroboration_count = EXCLUDED.corroboration_count,
                    contributing_sources = EXCLUDED.contributing_sources,
                    source_urls = EXCLUDED.source_urls,
                    raw_excerpt = EXCLUDED.raw_excerpt;
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

                ev_params.append((
                    eid, comp, title, summary, corr, contrib,
                    first_det, latest_det, pub_at, pub_ts, url, source_urls, excerpt
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


def save_findings(findings: List[Dict[str, Any]]) -> None:
    """
    Dual-write analyzed findings:
    Primary write: PostgreSQL `findings` table (is_mock = FALSE).
    """
    if not findings:
        return
    with get_db_cursor() as cur:
        f_sql = """
            INSERT INTO findings (event_id, company_name, why_it_matters, confidence, decision_score, tier, is_mock, fact_confidence, inference_confidence)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s, %s)
            ON CONFLICT (event_id) DO UPDATE
            SET why_it_matters = EXCLUDED.why_it_matters,
                confidence = EXCLUDED.confidence,
                decision_score = EXCLUDED.decision_score,
                tier = EXCLUDED.tier,
                fact_confidence = COALESCE(EXCLUDED.fact_confidence, findings.fact_confidence),
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
            fact_conf = f.get("fact_confidence")
            infer_conf = f.get("inference_confidence")
            f_params.append((eid, comp, why, conf, score, tier, fact_conf, infer_conf))

        _execute_batch(cur, f_sql, f_params, page_size=200)
        logger.info(f"Dual-write: persisted {len(f_params)} findings to PostgreSQL.")


def save_brief(
    content: str,
    filepath: Optional[Union[str, Path]] = None,
    title: Optional[str] = None,
    headline_preview: Optional[str] = None,
    published_at: Optional[datetime] = None,
) -> Path:
    """
    Dual-write markdown intelligence brief:
    1. Primary write: PostgreSQL `briefs` table with id='data_latest', source_path='data/brief.md', content_hash.
    2. Secondary write: Flat markdown files (brief_YYYYMMDD_HHMMSS.md and brief.md).
    """
    c_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
    pub_dt = published_at or datetime.now(timezone.utc)
    b_title = title or "PrismIQ Competitive Intelligence Brief"
    
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
            INSERT INTO briefs (id, filename, source_path, content_hash, title, headline_preview, content, published_at)
            VALUES ('data_latest', 'data/brief.md', 'data/brief.md', %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE
            SET filename = EXCLUDED.filename,
                source_path = EXCLUDED.source_path,
                content_hash = EXCLUDED.content_hash,
                title = EXCLUDED.title,
                headline_preview = EXCLUDED.headline_preview,
                content = EXCLUDED.content,
                published_at = EXCLUDED.published_at;
        """
        cur.execute(b_sql, (c_hash, b_title, headline_preview, content, pub_dt))
        logger.info(f"Dual-write: persisted data_latest brief (hash: {c_hash[:16]}...) to PostgreSQL.")

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
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Dual-write candidate competitor discovery proposals:
    1. Primary write: PostgreSQL `discovery_proposals` and `discovery_candidates` tables.
    2. Secondary write: Flat JSON file (discovery_proposal_{clean_company}.json).
    """
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    rel_filename = f"data/discovery_proposal_{clean_name}.json"
    now_dt = datetime.now(timezone.utc)

    # 1. Primary PostgreSQL Write
    if candidates:
        with get_db_cursor() as cur:
            # Ensure target competitor exists
            cur.execute(
                "INSERT INTO competitors (name, is_target) VALUES (%s, TRUE) ON CONFLICT (name) DO NOTHING;",
                (target_company,)
            )

            # Insert proposal record
            prop_sql = """
                INSERT INTO discovery_proposals (target_company, generated_at, filename)
                VALUES (%s, %s, %s)
                ON CONFLICT (target_company, filename) DO UPDATE
                SET generated_at = EXCLUDED.generated_at
                RETURNING id;
            """
            cur.execute(prop_sql, (target_company, now_dt, rel_filename))
            prop_id_row = cur.fetchone()
            prop_id = prop_id_row[0] if prop_id_row else "00000000-0000-0000-0000-000000000000"

            # Insert candidates
            dc_sql = """
                INSERT INTO discovery_candidates (
                    proposal_id, target_company, name, rationale, confidence,
                    source, source_age, source_date, freshness_note, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (target_company, name, source) DO UPDATE
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
                # Ensure candidate competitor exists
                cur.execute(
                    "INSERT INTO competitors (name, is_target, status) VALUES (%s, FALSE, 'candidate') ON CONFLICT (name) DO NOTHING;",
                    (cname,)
                )
                dc_params.append((
                    prop_id, target_company, cname, c.get("rationale", ""),
                    c.get("confidence", "Low"), c.get("source", ""),
                    c.get("source_age", "undated"),
                    str(c.get("source_date")) if c.get("source_date") else None,
                    c.get("freshness_note"), c.get("status", "proposed")
                ))
            _execute_batch(cur, dc_sql, dc_params, page_size=50)
            logger.info(f"Dual-write: persisted discovery proposal and {len(dc_params)} candidates to PostgreSQL.")

    # 2. Secondary Flat File Write
    target_file = Path(filepath) if filepath else (data_dir / f"discovery_proposal_{clean_name}.json")
    target_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
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
    1. Primary write: PostgreSQL `competitors` table.
    2. Secondary write: Flat JSON file (confirmed_competitors_{clean_company}.json).
    """
    # 1. Primary PostgreSQL Write
    if confirmed_competitors:
        with get_db_cursor() as cur:
            comp_sql = """
                INSERT INTO competitors (name, is_target, status)
                VALUES (%s, FALSE, 'confirmed')
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
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Dual-write raw retrieved discovery context sources:
    1. Primary write: PostgreSQL `discovery_sources` table.
    2. Secondary write: Flat JSON files.
    """
    data_dir = _get_data_dir()
    clean_name = _sanitize_filename(target_company)
    rel_filename = f"data/discovery_sources_{clean_name}.json"
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Primary PostgreSQL Write
    if sources:
        with get_db_cursor() as cur:
            ds_sql = """
                INSERT INTO discovery_sources (target_company, source_type, title, url, published_at, source_age, text, source_file)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (target_company, url, title) DO UPDATE
                SET source_type = EXCLUDED.source_type,
                    published_at = EXCLUDED.published_at,
                    source_age = EXCLUDED.source_age,
                    text = EXCLUDED.text,
                    source_file = EXCLUDED.source_file;
            """
            ds_params = [
                (
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
            logger.info(f"Dual-write: persisted {len(sources)} discovery_sources to PostgreSQL.")

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


def get_prior_research_activity(exclude_signal_ids: Optional[Set[str]] = None) -> Optional[Dict[str, Any]]:
    """
    Query PostgreSQL (or fallback flat file store) for the most recent prior research activity.
    Used by Report Agent to evaluate change detection across cycles.
    
    Returns:
        Dict with keys {"title", "company", "published_at", "url"} or None if no prior research activity.
    """
    if not is_test_environment():
        try:
            with get_db_cursor() as cur:
                if exclude_signal_ids:
                    placeholders = ", ".join(["%s"] * len(exclude_signal_ids))
                    sql = f"""
                        SELECT title, company_name, published_at, url, created_at
                        FROM raw_signals
                        WHERE source = 'research' AND id NOT IN ({placeholders})
                        ORDER BY published_timestamp DESC NULLS LAST, created_at DESC
                        LIMIT 1;
                    """
                    cur.execute(sql, tuple(exclude_signal_ids))
                else:
                    sql = """
                        SELECT title, company_name, published_at, url, created_at
                        FROM raw_signals
                        WHERE source = 'research'
                        ORDER BY published_timestamp DESC NULLS LAST, created_at DESC
                        LIMIT 1;
                    """
                    cur.execute(sql)
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
                        return {
                            "title": s.get("title", ""),
                            "company": s.get("company", ""),
                            "published_at": s.get("published_at") or "recent cycle",
                            "url": s.get("url", ""),
                        }
        except Exception:
            continue
    return None
