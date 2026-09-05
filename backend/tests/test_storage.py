import sys
from pathlib import Path

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
    """Verify that ad hoc CLI invocations without ALLOW_LIVE_WRITE=true fail CLOSED to MockCursor."""
    monkeypatch.delenv("ALLOW_LIVE_WRITE", raising=False)
    monkeypatch.delenv("ALLOW_PROD_WRITE", raising=False)
    monkeypatch.delenv("FORCE_LIVE_DB", raising=False)
    monkeypatch.delenv("PRISMIQ_ENV", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Force is_test_environment to return False to simulate an ad hoc script
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)

    assert not storage.is_live_write_permitted()
    with storage.get_db_cursor() as cur:
        assert isinstance(cur, storage.MockCursor)
        cur.execute("INSERT INTO findings VALUES ('fake');")
        assert len(cur.queries) == 1


def test_explicit_opt_in_authorizes_live_write(monkeypatch):
    """Verify that explicit ALLOW_LIVE_WRITE=true authorizes production connection check."""
    monkeypatch.setenv("ALLOW_LIVE_WRITE", "true")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://test:test@localhost:5432/db")
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)

    assert storage.is_live_write_permitted()


