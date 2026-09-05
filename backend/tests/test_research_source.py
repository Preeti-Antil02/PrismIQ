from unittest.mock import patch, MagicMock
from src import monitoring_agent

MOCK_ARXIV_XML_RESPONSE = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2608.12345v1</id>
    <published>2026-08-25T12:00:00Z</published>
    <title>Post-Quantum Origin Authentication in Edge Architectures</title>
    <summary>We benchmark ML-DSA and post-quantum key exchange in edge proxies.</summary>
    <author>
      <name>Alice Researcher</name>
      <arxiv:affiliation>Cloudflare Research</arxiv:affiliation>
    </author>
    <author>
      <name>Bob Cryptographer</name>
      <arxiv:affiliation>MIT</arxiv:affiliation>
    </author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2608.99999v1</id>
    <published>2026-08-20T12:00:00Z</published>
    <title>Third-Party Study of CDN Traffic</title>
    <summary>We analyzed Cloudflare DNS response times from outside.</summary>
    <author>
      <name>External Researcher</name>
      <arxiv:affiliation>Independent University</arxiv:affiliation>
    </author>
  </entry>
</feed>
"""

MOCK_BLOG_RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cloudflare Blog</title>
    <item>
      <title>How we saved 100 terabytes of memory by optimizing 1.1.1.1's DNS cache</title>
      <link>https://blog.cloudflare.com/dns-cache-memory-optimization-1111/</link>
      <pubDate>Mon, 25 Aug 2026 10:00:00 +0000</pubDate>
      <description>&lt;p&gt;Five Rust-level memory optimizations to DNS cache layout cut memory by 56%.&lt;/p&gt;</description>
    </item>
    <item>
      <title>Say it once: Introducing Bot Preference Sync</title>
      <link>https://blog.cloudflare.com/bot-preference-sync/</link>
      <pubDate>Mon, 25 Aug 2026 09:00:00 +0000</pubDate>
      <description>&lt;p&gt;Toggle robots.txt in dashboard settings.&lt;/p&gt;</description>
    </item>
  </channel>
</rss>
"""


def test_fetch_arxiv_papers_parsing_and_affiliation_filter():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = MOCK_ARXIV_XML_RESPONSE

    with patch("requests.get", return_value=mock_resp):
        signals = monitoring_agent._fetch_arxiv_papers("Cloudflare Pages/Workers", days=30)
        
        # Only the entry with verified affiliation 'Cloudflare Research' must be kept
        assert len(signals) == 1
        sig = signals[0]
        assert "Post-Quantum Origin Authentication" in sig["title"]
        assert sig["source"] == "research"
        assert sig["source_subtype"] == "research"
        assert "Alice Researcher" in sig["raw_excerpt"]


def test_fetch_blog_feed_parsing_and_research_filtering():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = MOCK_BLOG_RSS_XML

    with patch("requests.get", return_value=mock_resp):
        signals = monitoring_agent._fetch_blog_feed(
            "Cloudflare Pages/Workers",
            "https://blog.cloudflare.com/rss/",
            days=14,
        )
        
        # Only the Rust memory optimization write-up is classified as research
        assert len(signals) == 1
        sig = signals[0]
        assert "How we saved 100 terabytes" in sig["title"]
        assert sig["source"] == "research"
        assert sig["source_subtype"] == "research"


def test_research_deduplication_against_seen_news_urls():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = MOCK_BLOG_RSS_XML

    seen_urls = {"https://blog.cloudflare.com/dns-cache-memory-optimization-1111/"}

    with patch("requests.get", return_value=mock_resp):
        signals = monitoring_agent._fetch_blog_feed(
            "Cloudflare Pages/Workers",
            "https://blog.cloudflare.com/rss/",
            days=14,
            seen_urls=seen_urls,
        )
        # Since the URL was already seen in News, it must be deduplicated
        assert len(signals) == 0


def test_unsupported_company_coverage_disclosure():
    # Company with no arXiv presence and no blog feed configured
    signals = monitoring_agent._fetch_research_signals("UnsupportedCompany", days=14)
    assert len(signals) == 0


def test_research_source_retry_and_graceful_fallback():
    def _mock_failing_fetch():
        raise ConnectionError("arXiv API connection reset (HTTP 503)")

    signals, health = monitoring_agent.fetch_source_with_retry(
        "research",
        _mock_failing_fetch,
        max_retries=1,
        backoff=0.01,
    )
    assert len(signals) == 0
    assert health["status"] == "failed"
    assert health["attempts"] == 2
    assert "arXiv API connection reset" in health["error"]
    assert "continued pipeline without research" in health["fallback"]


def test_cross_feed_deduplication_cloudflare():
    """Verify that posts syndicated across multiple Cloudflare feeds yield exactly 1 raw signal."""
    feed_1_xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cloudflare Blog Main</title>
    <item>
      <title>A revisit of remote Spectre attacks on Cloudflare Workers</title>
      <link>https://blog.cloudflare.com/spectre-research-workers-revisit/</link>
      <pubDate>Mon, 25 Aug 2026 10:00:00 +0000</pubDate>
      <description>We evaluated microarchitectural side-channel attacks on isolated V8 workers.</description>
    </item>
    <item>
      <title>BGP Role model: tracking the adoption of RFC 9234</title>
      <link>https://blog.cloudflare.com/bgp-role-model-rfc-9234/</link>
      <pubDate>Mon, 25 Aug 2026 09:00:00 +0000</pubDate>
      <description>Analysis of Autonomous System Provider Authorization and BGP route leak prevention.</description>
    </item>
  </channel>
</rss>"""

    feed_2_xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cloudflare Blog Research Tag</title>
    <item>
      <title>A revisit of remote Spectre attacks on Cloudflare Workers</title>
      <link>https://blog.cloudflare.com/spectre-research-workers-revisit/</link>
      <pubDate>Mon, 25 Aug 2026 10:00:00 +0000</pubDate>
      <description>We evaluated microarchitectural side-channel attacks on isolated V8 workers.</description>
    </item>
    <item>
      <title>BGP Role model: tracking the adoption of RFC 9234</title>
      <link>https://blog.cloudflare.com/bgp-role-model-rfc-9234/</link>
      <pubDate>Mon, 25 Aug 2026 09:00:00 +0000</pubDate>
      <description>Analysis of Autonomous System Provider Authorization and BGP route leak prevention.</description>
    </item>
  </channel>
</rss>"""

    def mock_get(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        if "arxiv.org" in url:
            resp.text = """<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>"""
        elif "tag/research" in url:
            resp.text = feed_2_xml
        else:
            resp.text = feed_1_xml
        return resp

    with patch("requests.get", side_effect=mock_get):
        signals = monitoring_agent._fetch_research_signals("Cloudflare Pages/Workers", days=14)
        
        # Despite appearing in BOTH feeds, each post must appear EXACTLY ONCE
        assert len(signals) == 2
        titles = [s["title"] for s in signals]
        assert "A revisit of remote Spectre attacks on Cloudflare Workers" in titles
        assert "BGP Role model: tracking the adoption of RFC 9234" in titles
        spectre_count = sum(1 for t in titles if "Spectre" in t)
        bgp_count = sum(1 for t in titles if "BGP" in t)
        assert spectre_count == 1
        assert bgp_count == 1


def test_targeted_fallback_for_truncated_feed_summary():
    """Verify that posts with empty or truncated summary (<80 chars) trigger targeted fallback."""
    truncated_atom_xml = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Compute that takes any shape</title>
    <link href="https://vercel.com/blog/compute-that-takes-any-shape" />
    <published>2026-08-25T12:00:00Z</published>
    <summary>...</summary>
  </entry>
</feed>"""

    article_html = """<html>
    <head><meta name="description" content="Inside Fluid Compute: Hive control plane, VHS snapshot format, and Drives storage architecture." /></head>
    <body><main><p>We redesigned the serverless runtime with microVM snapshots and concurrent execution.</p></main></body>
    </html>"""

    def mock_get(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        if "vercel.com/atom" in url:
            resp.text = truncated_atom_xml
        elif "compute-that-takes-any-shape" in url:
            resp.text = article_html
        return resp

    with patch("requests.get", side_effect=mock_get):
        signals = monitoring_agent._fetch_blog_feed("Vercel", "https://vercel.com/atom", days=14)
        
        assert len(signals) == 1
        sig = signals[0]
        assert sig["title"] == "Compute that takes any shape"
        assert sig["source"] == "research"
        assert "Hive control plane" in sig["raw_excerpt"] or "microVM snapshots" in sig["raw_excerpt"]

