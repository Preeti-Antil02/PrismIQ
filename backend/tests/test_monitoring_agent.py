import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import monitoring_agent, config


def test_monitoring_agent_normalization_schema():
    fake_news = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Launches AI SDK 3.0",
            "url": "https://example.com/news/1",
            "published_at": "2026-08-20T10:00:00Z",
            "raw_excerpt": "Vercel announces major updates to its AI tooling.",
        }
    ]
    fake_github = [
        {
            "source": "github",
            "company": "Netlify",
            "title": "GitHub Release in netlify/build: v2.0.0",
            "url": "https://github.com/netlify/build",
            "published_at": "2026-08-21T12:00:00Z",
            "raw_excerpt": "Release v2.0.0 including major speedups.",
        }
    ]

    with patch("src.monitoring_agent._fetch_news_from_currents", return_value=fake_news) as mock_news, \
         patch("src.monitoring_agent._fetch_github_events", return_value=fake_github) as mock_github, \
         patch("src.monitoring_agent._fetch_jobs", return_value=[]), \
         patch("src.pricing_extractor.fetch_pricing_signals", return_value=[]):

        signals = monitoring_agent.run(["Vercel"])

        required_keys = {"source", "company", "title", "url", "published_at", "raw_excerpt"}
        for s in signals:
            assert required_keys.issubset(s.keys()), f"Missing keys in signal: {s}"
            assert s["source"] in {"news", "github", "jobs", "pricing"}
            assert isinstance(s["company"], str)
            assert isinstance(s["title"], str)
            assert isinstance(s["url"], str)
            assert isinstance(s["published_at"], str)
            assert isinstance(s["raw_excerpt"], str)


def test_monitoring_agent_queries_both_sources_for_all_companies():
    with patch("src.monitoring_agent._fetch_news_from_currents", return_value=[]) as mock_news, \
         patch("src.monitoring_agent._fetch_github_events", return_value=[]) as mock_github, \
         patch("src.monitoring_agent._fetch_jobs", return_value=[]) as mock_jobs, \
         patch("src.pricing_extractor.fetch_pricing_signals", return_value=[]) as mock_pricing:

        signals = monitoring_agent.run()

        expected_companies = [config.TARGET_COMPANY] + config.COMPETITORS
        
        # Verify news was called for every company
        news_calls = [call.args[0] for call in mock_news.call_args_list]
        for company in expected_companies:
            assert company in news_calls

        # Verify github was called for every company
        github_calls = [call.args[0] for call in mock_github.call_args_list]
        for company in expected_companies:
            assert company in github_calls

        # Verify jobs was called for every company
        jobs_calls = [call.args[0] for call in mock_jobs.call_args_list]
        for company in expected_companies:
            assert company in jobs_calls

        # Verify pricing was called
        assert mock_pricing.called


def test_monitoring_agent_empty_results_no_fabrication():
    # If sources return empty lists, the agent must NOT fabricate placeholder signals
    with patch("src.monitoring_agent._fetch_news_from_currents", return_value=[]), \
         patch("src.monitoring_agent._fetch_github_events", return_value=[]), \
         patch("src.monitoring_agent._fetch_jobs", return_value=[]), \
         patch("src.pricing_extractor.fetch_pricing_signals", return_value=[]):

        signals = monitoring_agent.run(["Vercel", "Netlify"])
        assert signals == []
        assert len(signals) == 0


def test_fetch_news_from_currents_parsing():
    from datetime import datetime, timezone
    recent_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S +0000")
    fake_response = {
        "status": "ok",
        "news": [
            {
                "title": "Next.js Conf Announced",
                "description": "Details about Next.js Conf 2026.",
                "url": "https://currents.api/article1",
                "published": recent_ts
            }
        ]
    }
    with patch.dict("os.environ", {"CURRENTS_API_KEY": "test-key"}), \
         patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = fake_response
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        results = monitoring_agent._fetch_news_from_currents("Vercel")
        assert len(results) == 1
        assert results[0]["title"] == "Next.js Conf Announced"
        assert results[0]["source"] == "news"
        assert results[0]["company"] == "Vercel"
        assert results[0]["url"] == "https://currents.api/article1"


def test_fetch_github_events_parsing():
    from datetime import datetime, timezone
    recent_iso = datetime.now(timezone.utc).isoformat()
    fake_events = [
        {
            "id": "12345",
            "type": "ReleaseEvent",
            "created_at": recent_iso,
            "repo": {"name": "vercel/next.js"},
            "payload": {
                "release": {
                    "tag_name": "v15.2.0",
                    "name": "Next.js 15.2.0",
                    "body": "Fixed hydration bug."
                }
            }
        }
    ]
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = fake_events
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        results = monitoring_agent._fetch_github_events("Vercel")
        assert len(results) == 1
        assert results[0]["source"] == "github"
        assert results[0]["company"] == "Vercel"
        assert "Next.js 15.2.0" in results[0]["title"]
        assert results[0]["url"] == "https://github.com/vercel/next.js"


def test_consolidate_signals_exact_duplicates():
    raw_signals = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Same Article",
            "url": "https://example.com/same",
            "published_at": "2026-08-20T10:00:00Z",
            "raw_excerpt": "Excerpt 1",
        },
        {
            "source": "news",
            "company": "Vercel",
            "title": "Same Article",
            "url": "https://example.com/same",
            "published_at": "2026-08-20T10:00:00Z",
            "raw_excerpt": "Excerpt 1",
        },
        {
            "source": "news",
            "company": "Vercel",
            "title": "Distinct Article",
            "url": "https://example.com/distinct",
            "published_at": "2026-08-20T11:00:00Z",
            "raw_excerpt": "Excerpt 2",
        },
    ]
    consolidated = monitoring_agent.consolidate_signals(raw_signals)
    assert len(consolidated) == 2
    urls = [s["url"] for s in consolidated]
    assert urls.count("https://example.com/same") == 1
    assert urls.count("https://example.com/distinct") == 1


def test_consolidate_signals_watchevent_and_forkevent_aggregation():
    raw_signals = [
        {
            "source": "github",
            "company": "Cloudflare Pages",
            "title": "GitHub WatchEvent started in cloudflare/cloudflare-os",
            "url": "https://github.com/cloudflare/cloudflare-os",
            "published_at": "2026-08-22T19:23:09Z",
            "raw_excerpt": "User A started watching",
        },
        {
            "source": "github",
            "company": "Cloudflare Pages",
            "title": "GitHub WatchEvent started in cloudflare/cloudflare-os",
            "url": "https://github.com/cloudflare/cloudflare-os",
            "published_at": "2026-08-22T19:35:30Z",
            "raw_excerpt": "User B started watching",
        },
        {
            "source": "github",
            "company": "Cloudflare Pages",
            "title": "GitHub ForkEvent forked in cloudflare/templates",
            "url": "https://github.com/cloudflare/templates",
            "published_at": "2026-08-22T19:18:06Z",
            "raw_excerpt": "User C forked repo",
        },
        {
            "source": "github",
            "company": "Cloudflare Pages",
            "title": "GitHub ForkEvent forked in cloudflare/templates",
            "url": "https://github.com/cloudflare/templates",
            "published_at": "2026-08-22T19:20:00Z",
            "raw_excerpt": "User D forked repo",
        },
    ]
    consolidated = monitoring_agent.consolidate_signals(raw_signals)
    assert len(consolidated) == 2

    watch_sig = next(s for s in consolidated if "cloudflare-os" in s["url"])
    assert "2 users started watching cloudflare/cloudflare-os this week" in watch_sig["title"]
    assert watch_sig["published_at"] == "2026-08-22T19:35:30Z"
    assert "2 developer(s)" in watch_sig["raw_excerpt"]

    fork_sig = next(s for s in consolidated if "templates" in s["url"])
    assert "2 users forked cloudflare/templates this week" in fork_sig["title"]
    assert fork_sig["published_at"] == "2026-08-22T19:20:00Z"
    assert "2 new fork(s)" in fork_sig["raw_excerpt"]


def test_consolidate_signals_preserves_non_watch_fork_events():
    # Repetitive PR reviews or Issues should NOT be aggregated into one signal
    raw_signals = [
        {
            "source": "github",
            "company": "Netlify",
            "title": "GitHub PullRequestReviewEvent created in netlify/build",
            "url": "https://github.com/netlify/build",
            "published_at": "2026-08-22T04:00:16Z",
            "raw_excerpt": "Review 1",
        },
        {
            "source": "github",
            "company": "Netlify",
            "title": "GitHub PullRequestReviewEvent created in netlify/build",
            "url": "https://github.com/netlify/build",
            "published_at": "2026-08-22T04:00:20Z",
            "raw_excerpt": "Review 2",
        },
        {
            "source": "github",
            "company": "Vercel",
            "title": "GitHub Issue opened in vercel/ai: Security: tool-approval signing issue",
            "url": "https://github.com/vercel/ai/issues/1",
            "published_at": "2026-08-22T19:14:31Z",
            "raw_excerpt": "Security issue 1",
        },
        {
            "source": "github",
            "company": "Vercel",
            "title": "GitHub Issue opened in vercel/ai: Another issue",
            "url": "https://github.com/vercel/ai/issues/2",
            "published_at": "2026-08-22T19:15:00Z",
            "raw_excerpt": "Issue 2",
        },
    ]
    consolidated = monitoring_agent.consolidate_signals(raw_signals)
    # Exact duplicate URL+title (first two have identical title and url)
    # The first two have same (source, company, url, title) so exact dedup keeps 1
    # The two issues have different URLs/titles so both are kept
    assert len(consolidated) == 3


def test_cloudflare_attribution_workers_article_reattributed_from_pages():
    """
    An article fetched under 'Cloudflare Pages' query that mentions only 'Workers'
    in title/excerpt must be re-attributed to 'Cloudflare Workers'.
    """
    signal = {
        "source": "news",
        "company": "Cloudflare Pages",
        "title": "Cloudflare Announces Kitesurf, a Browser Engine for Agents",
        "url": "https://www.infoq.com/news/2026/08/cloudflare-kitesurf-browser/",
        "published_at": "2026-08-22 15:01:00 +0000",
        "raw_excerpt": "Kitesurf runs browser components in isolated WebAssembly/Rust environments on Cloudflare Workers.",
    }
    result = monitoring_agent._check_cloudflare_attribution(signal, "Cloudflare Pages")
    assert result is not None
    assert result["company"] == "Cloudflare Workers"
    # URL and other fields preserved
    assert result["url"] == signal["url"]
    assert result["title"] == signal["title"]


def test_cloudflare_attribution_pages_article_kept_under_pages():
    """
    An article that genuinely mentions 'Pages' in title/excerpt and was fetched
    under 'Cloudflare Pages' query must remain attributed to 'Cloudflare Pages'.
    """
    signal = {
        "source": "news",
        "company": "Cloudflare Pages",
        "title": "Cloudflare Pages Adds Incremental Builds",
        "url": "https://blog.cloudflare.com/pages-incremental-builds",
        "published_at": "2026-08-21 10:00:00 +0000",
        "raw_excerpt": "Cloudflare Pages now supports incremental builds for faster deployments.",
    }
    result = monitoring_agent._check_cloudflare_attribution(signal, "Cloudflare Pages")
    assert result is not None
    assert result["company"] == "Cloudflare Pages"


def test_cloudflare_attribution_generic_article_kept():
    """
    An article that mentions neither 'Pages' nor 'Workers' specifically
    (just 'Cloudflare' generically) should be kept under whichever company
    query fetched it.
    """
    signal = {
        "source": "news",
        "company": "Cloudflare Pages",
        "title": "Cloudflare Q2 Earnings Beat Expectations",
        "url": "https://finance.example.com/cloudflare-q2",
        "published_at": "2026-08-20 12:00:00 +0000",
        "raw_excerpt": "Cloudflare reported revenue growth exceeding analyst estimates.",
    }
    result = monitoring_agent._check_cloudflare_attribution(signal, "Cloudflare Pages")
    assert result is not None
    assert result["company"] == "Cloudflare Pages"


def test_cloudflare_attribution_non_cloudflare_company_passthrough():
    """
    Non-Cloudflare companies should pass through the attribution check unchanged.
    """
    signal = {
        "source": "news",
        "company": "Vercel",
        "title": "Vercel Releases v0 AI",
        "url": "https://vercel.com/blog/v0",
        "published_at": "2026-08-20 10:00:00 +0000",
        "raw_excerpt": "v0 generative UI.",
    }
    result = monitoring_agent._check_cloudflare_attribution(signal, "Vercel")
    assert result is not None
    assert result["company"] == "Vercel"
