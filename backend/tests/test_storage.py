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
