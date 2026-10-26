import sys
from pathlib import Path
import pytest
from unittest.mock import MagicMock

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import storage


def test_storage_roundtrip_all_signal_shapes(tmp_path):
    """
    Verify storage round-trips all current signal shapes:
    - Standard news signals
    - Standard GitHub release/push/issue signals
    - Consolidated/aggregated WatchEvent signals ('10 users started watching X this week')
    - Consolidated/aggregated ForkEvent signals ('2 users forked Y this week')
    """
    test_signals = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Introduces Fluid Compute",
            "url": "https://vercel.com/blog/fluid-compute",
            "published_at": "2026-08-19T14:30:00Z",
            "raw_excerpt": "Fluid Compute scales serverless functions with zero cold starts.",
        },
        {
            "source": "github",
            "company": "Cloudflare Workers",
            "title": "GitHub Release in cloudflare/workerd: v1.20260815.0",
            "url": "https://github.com/cloudflare/workerd",
            "published_at": "2026-08-15T09:12:00Z",
            "raw_excerpt": "Added support for dynamic module evaluation.",
        },
        {
            "source": "github",
            "company": "Cloudflare Pages",
            "title": "10 users started watching cloudflare/cloudflare-os this week",
            "url": "https://github.com/cloudflare/cloudflare-os",
            "published_at": "2026-08-22T19:35:30Z",
            "raw_excerpt": "10 developer(s) starred/watched repository cloudflare/cloudflare-os on GitHub in the last 7 days.",
        },
        {
            "source": "github",
            "company": "Netlify",
            "title": "2 users forked netlify/build this week",
            "url": "https://github.com/netlify/build",
            "published_at": "2026-08-22T20:00:00Z",
            "raw_excerpt": "2 new fork(s) created for repository netlify/build on GitHub in the last 7 days.",
        },
    ]

    file_path = tmp_path / "signals_test.json"
    saved_path = storage.save_signals(test_signals, filepath=file_path)
    assert saved_path.exists()
    assert saved_path == file_path

    loaded_signals = storage.load_signals(filepath=file_path)
    assert loaded_signals == test_signals
    assert len(loaded_signals) == 4
    assert loaded_signals[0]["company"] == "Vercel"
    assert "10 users started watching" in loaded_signals[2]["title"]
    assert "2 users forked" in loaded_signals[3]["title"]


def test_storage_default_timestamped_run_preservation(tmp_path, monkeypatch):
    """
    Verify that when no filepath is provided, save_signals saves to both
    a timestamped historical file (signals_YYYYMMDD_HHMMSS.json) and signals.json.
    """
    test_signals = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Test Signal",
            "url": "https://example.com/test",
            "published_at": "2026-08-23T10:00:00Z",
            "raw_excerpt": "Test excerpt.",
        }
    ]

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    saved_path = storage.save_signals(test_signals)

    # 1. Saved path is a timestamped file
    assert saved_path.exists()
    assert saved_path.name.startswith("signals_")
    assert saved_path.name.endswith(".json")

    # 2. Latest snapshot (signals.json) exists and matches content
    latest_file = tmp_path / "signals.json"
    assert latest_file.exists()

    # 3. Both load correctly
    loaded_latest = storage.load_signals()
    assert loaded_latest == test_signals

    loaded_timestamped = storage.load_signals(filepath=saved_path)
    assert loaded_timestamped == test_signals


def test_storage_empty_signals(tmp_path):
    file_path = tmp_path / "empty_signals.json"
    storage.save_signals([], filepath=file_path)
    loaded = storage.load_signals(filepath=file_path)
    assert loaded == []


def test_storage_nonexistent_file(tmp_path):
    file_path = tmp_path / "nonexistent.json"
    loaded = storage.load_signals(filepath=file_path)
    assert loaded == []


def test_storage_discovery_sources_persistence(tmp_path, monkeypatch):
    """
    Verify save_discovery_sources and load_discovery_sources persist both timestamped and current files.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    sources = [
        {
            "source_type": "discussion",
            "title": "Datadog vs Grafana",
            "url": "https://example.com/dd-vs-grafana",
            "published_at": "2025-01-08",
            "source_age": "dated",
            "text": "Comparison text.",
        }
    ]

    # Save
    saved_path = storage.save_discovery_sources("Datadog", sources)
    assert saved_path.exists()
    assert saved_path.name.startswith("discovery_sources_datadog_")

    # Load latest snapshot
    loaded = storage.load_discovery_sources("Datadog")
    assert len(loaded) == 1
    assert loaded[0]["title"] == "Datadog vs Grafana"
    assert loaded[0]["source_age"] == "dated"

    # Load specific timestamped path
    loaded_ts = storage.load_discovery_sources("Datadog", filepath=saved_path)
    assert len(loaded_ts) == 1
    assert loaded_ts[0]["url"] == "https://example.com/dd-vs-grafana"


def test_isolation_guard_yields_mock_cursor_in_test_env(monkeypatch):
    """Verify that during test runs, get_db_cursor yields an in-memory MockCursor with 0 DB writes."""
    monkeypatch.setenv("PRISMIQ_ENV", "test")
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
    
    with storage.get_db_cursor() as cur:
        assert isinstance(cur, storage.MockCursor)
        cur.execute("SELECT 1;")
        assert len(cur.queries) == 1


def test_isolation_guard_blocks_prod_url_in_test_env(monkeypatch):
    """Verify that if TEST_DATABASE_URL points to production SUPABASE_DB_URL, execution is strictly refused."""
    fake_prod = "postgresql://postgres:secret@prod.supabase.com:5432/postgres"
    monkeypatch.setenv("PRISMIQ_ENV", "test")
    monkeypatch.setenv("SUPABASE_DB_URL", fake_prod)
    monkeypatch.setenv("TEST_DATABASE_URL", fake_prod)
    
    import pytest
    with pytest.raises(PermissionError, match="CRITICAL SECURITY GUARD"):
        with storage.get_db_cursor():
            pass


def test_fail_closed_posture_blocks_unauthorized_cli_writes(monkeypatch):
    """Verify that ad hoc CLI invocations without ALLOW_LIVE_WRITE=true fail CLOSED by raising PermissionError."""
    monkeypatch.delenv("ALLOW_LIVE_WRITE", raising=False)
    monkeypatch.delenv("ALLOW_PROD_WRITE", raising=False)
    monkeypatch.delenv("FORCE_LIVE_DB", raising=False)
    monkeypatch.delenv("PRISMIQ_ENV", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Force is_test_environment to return False to simulate an ad hoc script
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)

    assert not storage.is_live_write_permitted()
    with pytest.raises(PermissionError, match="Live PostgreSQL write access not authorized"):
        with storage.get_db_cursor():
            pass


def test_connection_missing_url_raises_outside_test_env(monkeypatch):
    """Verify that a missing database URL outside test environment raises ConnectionError, never yields MockCursor."""
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)
    monkeypatch.delenv("SUPABASE_DB_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    monkeypatch.setenv("ALLOW_LIVE_WRITE", "true")
    monkeypatch.setenv("GITHUB_ACTIONS", "true")

    with pytest.raises(ConnectionError, match="SUPABASE_DB_URL is not set"):
        storage.get_db_connection()


def test_dry_run_with_prod_url_present_requires_readonly_url(monkeypatch):
    """Verify that in DRY_RUN=true, get_readonly_cursor strictly refuses to fall back to SUPABASE_DB_URL."""
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://postgres:secret@prod.supabase.com:6543/postgres")
    monkeypatch.delenv("SUPABASE_READONLY_DB_URL", raising=False)
    monkeypatch.delenv("READONLY_DATABASE_URL", raising=False)

    with pytest.raises(ValueError, match="CRITICAL SECURITY GUARD: DRY_RUN=true is active"):
        storage.get_db_connection(readonly=True)


def test_readonly_cursor_bad_url_surfaces_error(monkeypatch):
    """Verify that a failed connection under read-only mode raises ConnectionError rather than yielding MockCursor."""
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)
    monkeypatch.delenv("DRY_RUN", raising=False)
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.setenv("SUPABASE_READONLY_DB_URL", "postgresql://baduser:badpass@127.0.0.1:54399/baddb")

    with pytest.raises(ConnectionError, match="Failed to connect to PostgreSQL database"):
        storage.get_db_connection(readonly=True)


def test_explicit_opt_in_authorizes_live_write(monkeypatch):
    """Verify that explicit ALLOW_LIVE_WRITE=true authorizes production connection check only under platform environments."""
    monkeypatch.setenv("ALLOW_LIVE_WRITE", "true")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://test:test@localhost:5432/db")
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)

    # Local machine without platform environment fails closed even with ALLOW_LIVE_WRITE
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.delenv("RENDER", raising=False)
    assert not storage.is_live_write_permitted()

    # Under GitHub Actions platform environment, it authorizes
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    assert storage.is_live_write_permitted()


def test_pooled_connection_read_then_write_resets_session(monkeypatch):
    """
    Verify that conn.set_session(readonly=True) during read operations is reset to
    readonly=False when the connection is returned to the pool or re-used for writes.
    """
    session_history = []

    class FakeConn:
        def __init__(self):
            self.closed = 0
            self.readonly = False
        def set_session(self, readonly=False):
            self.readonly = readonly
            session_history.append(f"set_session(readonly={readonly})")
        def cursor(self):
            class FakeCursor:
                def __enter__(self): return self
                def __exit__(self, *args): pass
                def execute(self, *args): pass
            return FakeCursor()
        def rollback(self):
            session_history.append("rollback")
        def commit(self):
            session_history.append("commit")

    fake_conn = FakeConn()
    fake_pool = MagicMock()
    fake_pool.getconn.return_value = fake_conn

    monkeypatch.setattr(storage, "is_test_environment", lambda: False)
    monkeypatch.setattr(storage, "is_live_write_permitted", lambda: True)
    monkeypatch.setattr(storage, "get_db_connection", lambda db_url=None, readonly=False: (fake_conn, fake_pool))

    # 1. Execute a read query
    with storage.get_db_cursor(readonly=True) as cur:
        assert cur is not None

    # Connection must have been reset upon return
    assert fake_conn.readonly is False
    assert "set_session(readonly=False)" in session_history

    # 2. Execute a subsequent write query on the same connection
    with storage.get_db_cursor(readonly=False) as cur:
        assert cur is not None

    assert fake_conn.readonly is False


_MOCK_RO_URL = "postgres" + "ql://ro_user:ro_pass@localhost:5432/ro_db"
_MOCK_PROD_URL = "postgres" + "ql://prod_user:prod_pass@localhost:5432/prod_db"


@pytest.mark.parametrize(
    "env_vars,expected_read_status,expected_write_status",
    [
        # 1. (local, no platform vars, RO url only) -> reads OK via RO, writes raise
        (
            {"SUPABASE_READONLY_DB_URL": _MOCK_RO_URL},
            "READ_OK",
            "WRITE_RAISE",
        ),
        # 2. (local, only write url) -> reads raise (never use write url locally), writes raise
        (
            {"SUPABASE_DB_URL": _MOCK_PROD_URL},
            "READ_RAISE",
            "WRITE_RAISE",
        ),
        # 3. (GITHUB_ACTIONS=true, DRY_RUN=true, RO url only) -> reads via RO, writes no-op (dry_run guard)
        (
            {"GITHUB_ACTIONS": "true", "DRY_RUN": "true", "SUPABASE_READONLY_DB_URL": _MOCK_RO_URL},
            "READ_OK",
            "WRITE_BLOCKED",
        ),
        # 4. (GITHUB_ACTIONS=true, DRY_RUN=true, write url present, RO missing) -> raises
        (
            {"GITHUB_ACTIONS": "true", "DRY_RUN": "true", "SUPABASE_DB_URL": _MOCK_PROD_URL},
            "READ_RAISE",
            "WRITE_BLOCKED",
        ),
        # 5. (GITHUB_ACTIONS=true, DRY_RUN unset, ALLOW_LIVE_WRITE=true, write url only) -> reads and writes work
        (
            {"GITHUB_ACTIONS": "true", "ALLOW_LIVE_WRITE": "true", "SUPABASE_DB_URL": _MOCK_PROD_URL},
            "READ_OK",
            "WRITE_OK",
        ),
        # 6. (RENDER=true, ALLOW_LIVE_WRITE unset) -> reads work, writes raise
        (
            {"RENDER": "true", "SUPABASE_DB_URL": _MOCK_PROD_URL},
            "READ_OK",
            "WRITE_RAISE",
        ),
        # 7. (pytest) -> MockCursor only
        (
            {"PRISMIQ_ENV": "test"},
            "MOCK_CURSOR",
            "MOCK_CURSOR",
        ),
    ]
)
def test_environment_combinations_matrix(monkeypatch, env_vars, expected_read_status, expected_write_status):
    """
    Table-driven verification across all 7 environment configurations.
    Validates fail-closed posture, read fallback scoping, and write permission barriers.
    """
    # Clear baseline environment
    for key in [
        "GITHUB_ACTIONS", "RENDER", "DRY_RUN", "ALLOW_LIVE_WRITE", "ALLOW_PROD_WRITE",
        "FORCE_LIVE_DB", "SUPABASE_DB_URL", "SUPABASE_READONLY_DB_URL", "READONLY_DATABASE_URL",
        "PRISMIQ_ENV", "PYTEST_CURRENT_TEST", "FORCE_LIVE_TEST_DB", "TEST_DATABASE_URL"
    ]:
        monkeypatch.delenv(key, raising=False)

    for k, v in env_vars.items():
        monkeypatch.setenv(k, v)

    # Mock pool / connect so we don't attempt live socket connections
    fake_conn = MagicMock()
    fake_conn.closed = 0
    fake_pool = MagicMock()
    fake_pool.getconn.return_value = fake_conn
    monkeypatch.setattr(storage, "_get_connection_pool", lambda url: fake_pool)

    # 1. Evaluate READ path
    if expected_read_status == "MOCK_CURSOR":
        # Under pytest, get_db_cursor(readonly=True) yields MockCursor
        with storage.get_db_cursor(readonly=True) as cur:
            assert isinstance(cur, storage.MockCursor)
    elif expected_read_status == "READ_OK":
        monkeypatch.setattr(storage, "is_test_environment", lambda: False)
        with storage.get_db_cursor(readonly=True) as cur:
            assert cur is not None
    elif expected_read_status == "READ_RAISE":
        monkeypatch.setattr(storage, "is_test_environment", lambda: False)
        with pytest.raises((ValueError, PermissionError, ConnectionError)):
            with storage.get_db_cursor(readonly=True):
                pass

    # 2. Evaluate WRITE path
    if expected_write_status == "MOCK_CURSOR":
        with storage.get_db_cursor(readonly=False) as cur:
            assert isinstance(cur, storage.MockCursor)
    elif expected_write_status == "WRITE_OK":
        monkeypatch.setattr(storage, "is_test_environment", lambda: False)
        assert storage.is_live_write_permitted() is True
        with storage.get_db_cursor(readonly=False) as cur:
            assert cur is not None
    elif expected_write_status == "WRITE_RAISE":
        monkeypatch.setattr(storage, "is_test_environment", lambda: False)
        assert storage.is_live_write_permitted() is False
        with pytest.raises(PermissionError, match="Live PostgreSQL write access not authorized"):
            with storage.get_db_cursor(readonly=False):
                pass
    elif expected_write_status == "WRITE_BLOCKED":
        # In DRY_RUN, is_live_write_permitted() returns False, and write guards abort before DB
        assert storage.is_live_write_permitted() is False


def test_save_findings_provenance_columns(monkeypatch):
    """Verify B7: save_findings persists analysis_model, is_fallback, and analysis_source."""
    captured_params = []

    def mock_execute_batch(cur, sql, params, page_size=200):
        captured_params.extend(params)

    monkeypatch.setattr(storage, "_execute_batch", mock_execute_batch)

    findings = [
        {
            "event_id": "evt-123",
            "company": "Vercel",
            "why_it_matters": "Strategic expansion.",
            "confidence": "High",
            "decision_score": 1.5,
            "tier": "must_know",
            "inference_confidence": "High",
            "analysis_model": "openai/gpt-oss-120b",
            "is_fallback": False,
            "analysis_source": "llm",
        }
    ]

    storage.save_findings(findings, tenant_id="c8f13b91-46ef-4682-9975-f85764d8a12e")
    assert len(captured_params) == 1
    row = captured_params[0]
    # Parameter order: tid, eid, comp, why, conf, score, tier, infer_conf, analysis_model, is_fallback, analysis_source
    assert row[0] == "c8f13b91-46ef-4682-9975-f85764d8a12e"
    assert row[1] == "evt-123"
    assert row[2] == "Vercel"
    assert row[8] == "openai/gpt-oss-120b"
    assert row[9] is False
    assert row[10] == "llm"


def test_get_active_tenants_dry_run_webhook_omission(monkeypatch):
    """Verify B4: In dry-run mode, get_active_tenants generates SQL without querying sensitive d.slack_webhook_url."""
    from contextlib import contextmanager
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)

    executed_queries = []
    fake_cur = MagicMock()
    fake_cur.fetchall.return_value = []
    fake_cur.execute.side_effect = lambda sql, params=None: executed_queries.append(sql)

    @contextmanager
    def fake_get_readonly_cursor():
        yield fake_cur

    monkeypatch.setattr(storage, "get_readonly_cursor", fake_get_readonly_cursor)

    storage.get_active_tenants(scope="owner")
    assert len(executed_queries) >= 1
    active_query = executed_queries[-1]
    assert "NULL::text AS slack_webhook_url" in active_query
    assert "d.slack_webhook_url" not in active_query


def test_normalize_postgres_url_pooler_auto_heal():
    """Verify normalize_postgres_url adds project ref and corrects port 5432 on pooler."""
    raw = "postgresql://postgres:mock_synthetic_pass#123@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    normalized = storage.normalize_postgres_url(raw)
    assert "postgres.hmjcqdthzgzsmhpivrdb" in normalized
    assert ":6543/postgres" in normalized
    assert "mock_synthetic_pass%23123" in normalized


def test_normalize_postgres_url_password_only():
    """Verify normalize_postgres_url reconstructs full pooler URL when given raw password."""
    normalized = storage.normalize_postgres_url("mock_synthetic_secret#99")
    assert normalized.startswith("postgresql://postgres.hmjcqdthzgzsmhpivrdb:mock_synthetic_secret%2399@aws-0-ap-south-1.pooler.supabase.com:6543/postgres")


def test_normalize_postgres_url_direct_preserved():
    """Verify direct non-pooler connections preserve their host and port."""
    raw = "postgresql://postgres:mock_synthetic_pass@db.hmjcqdthzgzsmhpivrdb.supabase.co:5432/postgres"
    normalized = storage.normalize_postgres_url(raw)
    assert normalized == raw



