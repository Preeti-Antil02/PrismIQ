import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import event_consolidator


def test_consolidate_empty_signals():
    assert event_consolidator.run([]) == []


def test_single_signal_preserved_as_standalone_event():
    sig = {
        "company": "Vercel",
        "source": "news",
        "title": "Vercel Introduces Fluid Compute",
        "url": "https://vercel.com/blog/fluid-compute",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "Fluid Compute reduces cold starts.",
    }
    events = event_consolidator.run([sig])
    assert len(events) == 1
    event = events[0]
    assert event["company"] == "Vercel"
    assert event["corroboration_count"] == 1
    assert event["contributing_sources"] == ["news"]
    assert event["url"] == "https://vercel.com/blog/fluid-compute"
    assert len(event["raw_signals"]) == 1
    assert event["raw_signals"][0] == sig


def test_cross_source_version_release_merge():
    sig_gh = {
        "company": "Cloudflare Workers",
        "source": "github",
        "title": "GitHub Release in cloudflare/workerd: v1.20260815.0",
        "url": "https://github.com/cloudflare/workerd/releases/tag/v1.20260815.0",
        "published_at": "2026-08-15T09:00:00Z",
        "raw_excerpt": "Added dynamic modules support in workerd runtime.",
    }
    sig_news = {
        "company": "Cloudflare Workers",
        "source": "news",
        "title": "Workerd v1.20260815.0 Released with Dynamic Modules",
        "url": "https://example.com/workerd-v1-20260815-release",
        "published_at": "2026-08-15T12:30:00Z",
        "raw_excerpt": "Cloudflare has published workerd v1.20260815.0 for edge developer runtime.",
    }
    events = event_consolidator.run([sig_gh, sig_news])
    assert len(events) == 1
    event = events[0]
    assert event["corroboration_count"] == 2
    assert set(event["contributing_sources"]) == {"github", "news"}
    assert len(event["raw_signals"]) == 2
    assert len(event["source_urls"]) == 2
    assert "v1.20260815.0" in event["title"]


def test_cve_vulnerability_merge():
    sig_news_1 = {
        "company": "Cloudflare Workers",
        "source": "news",
        "title": "Vulnerability CVE-2026-9999 Disclosed in Edge Runtime",
        "url": "https://thehackernews.com/cve-2026-9999",
        "published_at": "2026-08-19T18:00:00Z",
        "raw_excerpt": "Security flaw CVE-2026-9999 allows memory leak.",
    }
    sig_news_2 = {
        "company": "Cloudflare Workers",
        "source": "news",
        "title": "Cloudflare Patches Remote Exploit CVE-2026-9999",
        "url": "https://vulners.com/cve-2026-9999",
        "published_at": "2026-08-19T18:30:00Z",
        "raw_excerpt": "Advisory for CVE-2026-9999 in Cloudflare Workers.",
    }
    events = event_consolidator.run([sig_news_1, sig_news_2])
    assert len(events) == 1
    assert events[0]["corroboration_count"] == 2


def test_distinct_named_initiative_merge():
    sig1 = {
        "company": "Vercel",
        "source": "news",
        "title": "Is Agentic by Vercel — AI Agent Readiness Score",
        "url": "https://is-agentic.com",
        "published_at": "2026-08-22T05:32:38Z",
        "raw_excerpt": "Score how ready a website is for AI agents.",
    }
    sig2 = {
        "company": "Vercel",
        "source": "news",
        "title": "Vercel Shipped is-agentic.com. Here Is How the Scoreboard Works",
        "url": "https://dev.to/promptway/vercel-shipped-is-agenticcom",
        "published_at": "2026-08-21T21:41:49Z",
        "raw_excerpt": "Vercel shipped a public score for whether agents can read your site.",
    }
    events = event_consolidator.run([sig1, sig2])
    assert len(events) == 1
    assert events[0]["corroboration_count"] == 2


def test_negative_different_companies_never_merge():
    sig1 = {
        "company": "Vercel",
        "source": "news",
        "title": "Vercel launches agent benchmark v1.0",
        "url": "https://example.com/v1",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "Benchmark v1.0",
    }
    sig2 = {
        "company": "Netlify",
        "source": "news",
        "title": "Netlify launches agent benchmark v1.0",
        "url": "https://example.com/n1",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "Benchmark v1.0",
    }
    events = event_consolidator.run([sig1, sig2])
    assert len(events) == 2


def test_negative_same_company_different_features_not_merged():
    sig1 = {
        "company": "Vercel",
        "source": "news",
        "title": "Deployment Storage keeps your deployments rollback-ready - Vercel",
        "url": "https://vercel.com/changelog/deployment-storage",
        "published_at": "2026-08-21T14:50:40Z",
        "raw_excerpt": "Deployment Storage billing announced.",
    }
    sig2 = {
        "company": "Vercel",
        "source": "news",
        "title": "Connect v0 apps to Slack, Google, and 100+ other services - Vercel",
        "url": "https://vercel.com/changelog/connect-v0-apps",
        "published_at": "2026-08-21T00:00:00Z",
        "raw_excerpt": "v0 integrations with third-party tools.",
    }
    events = event_consolidator.run([sig1, sig2])
    assert len(events) == 2
    for e in events:
        assert e["corroboration_count"] == 1


def test_negative_generic_keywords_do_not_trigger_merge():
    sig1 = {
        "company": "Vercel",
        "source": "news",
        "title": "AI updates and performance improvements for serverless functions",
        "url": "https://example.com/post1",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "General AI improvements.",
    }
    sig2 = {
        "company": "Vercel",
        "source": "news",
        "title": "New cloud platform dashboard with fast developer workflows",
        "url": "https://example.com/post2",
        "published_at": "2026-08-20T11:00:00Z",
        "raw_excerpt": "General dashboard speed.",
    }
    events = event_consolidator.run([sig1, sig2])
    assert len(events) == 2


def test_100_percent_signal_preservation_invariant():
    signals = [
        {"company": "Vercel", "source": "news", "title": "S1", "url": "https://e.com/1", "published_at": "2026-08-20", "raw_excerpt": "E1"},
        {"company": "Vercel", "source": "news", "title": "S2", "url": "https://e.com/2", "published_at": "2026-08-20", "raw_excerpt": "E2"},
        {"company": "Netlify", "source": "github", "title": "S3", "url": "https://e.com/3", "published_at": "2026-08-20", "raw_excerpt": "E3"},
        {"company": "Cloudflare Workers", "source": "news", "title": "S4", "url": "https://e.com/4", "published_at": "2026-08-20", "raw_excerpt": "E4"},
    ]
    events = event_consolidator.run(signals)
    total_signals_in_events = sum(len(e["raw_signals"]) for e in events)
    assert total_signals_in_events == len(signals) == 4


def test_root_signal_event_id_anchoring():
    """Verify that event_id is strictly anchored to the earliest-detected signal in the cluster."""
    sig_early = {
        "company": "Vercel",
        "source": "news",
        "title": "Vercel Shipped is-agentic.com. Here Is How the Scoreboard Works",
        "url": "https://dev.to/promptway/vercel-shipped-is-agenticcom",
        "published_at": "2026-08-21T21:41:49Z",
        "raw_excerpt": "Scoreboard works",
    }
    sig_late = {
        "company": "Vercel",
        "source": "news",
        "title": "Is Agentic by Vercel — AI Agent Readiness Score",
        "url": "https://is-agentic.com",
        "published_at": "2026-08-22T05:32:38Z",
        "raw_excerpt": "Readiness score",
    }
    # Test order independence: whether early comes first or second, event_id must be identical
    events_1 = event_consolidator.run([sig_early, sig_late])
    events_2 = event_consolidator.run([sig_late, sig_early])
    
    assert len(events_1) == 1
    assert len(events_2) == 1
    assert events_1[0]["event_id"] == events_2[0]["event_id"]
    
    # Root signal ID should be from sig_early
    expected_root_sig = event_consolidator._generate_signal_id(
        "Vercel", "news", "https://dev.to/promptway/vercel-shipped-is-agenticcom",
        "Vercel Shipped is-agentic.com. Here Is How the Scoreboard Works", "2026-08-21T21:41:49Z"
    )
    assert events_1[0]["event_id"] == "evt_" + expected_root_sig.replace("sig_", "")


def test_14_real_multi_signal_merge_decisions():
    """
    Re-validate the Stage 2 Part 7.2 benchmark:
    Running consolidation on real dataset (180 signals) must yield exactly 14 multi-signal events,
    0 false merges, 0 missed merges, and 100% signal preservation (118 events).
    """
    import json
    fixture_path = backend_path / "published_briefs/signals_20260823_094931.json"
    if not fixture_path.exists():
        fixture_path = backend_path / "data/signals_20260823_094931.json"
    
    assert fixture_path.exists(), f"Benchmark fixture {fixture_path} not found"
    with open(fixture_path, "r", encoding="utf-8") as f:
        signals = json.load(f)
    
    assert len(signals) == 180
    events = event_consolidator.run(signals)
    
    assert len(events) == 118
    multi_events = [e for e in events if e.get("corroboration_count", 1) > 1]
    assert len(multi_events) == 14
    
    # Invariant: 100% signal preservation
    total_preserved = sum(len(e["raw_signals"]) for e in events)
    assert total_preserved == 180
