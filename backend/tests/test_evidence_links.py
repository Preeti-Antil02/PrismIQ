"""
Tests for Evidence Links, Canonical Competitor URLs, and Source Document Verification
Validates:
1. Canonical source resolution for key competitors (Netflix, Cloudflare Pages/Workers, AWS Amplify, Netlify, Vercel)
2. Rejection of invalid and placeholder synthetic URLs (e.g., /updates/1, awsamplify.com, cloudflarepages.com)
3. Safe fallback handling: missing or invalid URLs resolve to None or verified sources rather than broken links
4. Corroborating signals maintain distinct authentic source URLs
5. Storage and dynamic intelligence agent integration for evidence links
"""

import pytest
from src.competitor_sources import (
    is_valid_http_url,
    get_canonical_source_url,
    COMPETITOR_CANONICAL_SOURCES,
)
from src.storage import (
    _normalize_high_impact_change,
    _normalize_sequence_record,
    get_company_changes,
)


class TestEvidenceLinksValidation:
    """Test URL validity and format checking"""

    def test_http_https_url_validation(self):
        # Valid URLs
        assert is_valid_http_url("https://about.netflix.com/en/newsroom") is True
        assert is_valid_http_url("http://blog.cloudflare.com/post") is True
        assert is_valid_http_url("https://aws.amazon.com/amplify/") is True

        # Invalid URLs / Placeholders
        assert is_valid_http_url("https://netflix.com/updates/1") is False
        assert is_valid_http_url("https://awsamplify.com/updates/2") is False
        assert is_valid_http_url("https://cloudflarepages.com/updates") is False
        assert is_valid_http_url("example.com/test") is False
        assert is_valid_http_url("javascript:alert(1)") is False
        assert is_valid_http_url("ftp://example.com") is False
        assert is_valid_http_url("") is False
        assert is_valid_http_url(None) is False

    def test_canonical_source_netflix(self):
        """Test Netflix evidence links point to authentic Netflix domains"""
        news_url = get_canonical_source_url("Netflix", "newsroom")
        assert "about.netflix.com" in news_url
        assert is_valid_http_url(news_url) is True

        tech_url = get_canonical_source_url("Netflix", "tech_blog")
        assert "netflixtechblog.com" in tech_url
        assert is_valid_http_url(tech_url) is True

        jobs_url = get_canonical_source_url("Netflix", "careers")
        assert "jobs.netflix.com" in jobs_url
        assert is_valid_http_url(jobs_url) is True

        pricing_url = get_canonical_source_url("Netflix", "pricing")
        assert "help.netflix.com" in pricing_url
        assert is_valid_http_url(pricing_url) is True

    def test_canonical_source_cloudflare(self):
        """Test Cloudflare / Cloudflare Pages / Workers point to real Cloudflare domains"""
        cf_blog = get_canonical_source_url("Cloudflare", "blog")
        assert "blog.cloudflare.com" in cf_blog
        assert is_valid_http_url(cf_blog) is True

        pages_docs = get_canonical_source_url("Cloudflare Pages", "documentation")
        assert "developers.cloudflare.com/pages" in pages_docs
        assert is_valid_http_url(pages_docs) is True

        workers_docs = get_canonical_source_url("Cloudflare Workers", "documentation")
        assert "developers.cloudflare.com/workers" in workers_docs
        assert is_valid_http_url(workers_docs) is True

        plans = get_canonical_source_url("Cloudflare Pages", "pricing")
        assert "cloudflare.com/plans" in plans
        assert is_valid_http_url(plans) is True

    def test_canonical_source_aws_amplify(self):
        """Test AWS Amplify points to aws.amazon.com/amplify/ rather than awsamplify.com"""
        amplify_url = get_canonical_source_url("AWS Amplify", "official")
        assert "aws.amazon.com/amplify" in amplify_url
        assert "awsamplify.com" not in amplify_url
        assert is_valid_http_url(amplify_url) is True

        amplify_docs = get_canonical_source_url("AWS Amplify", "documentation")
        assert "docs.amplify.aws" in amplify_docs
        assert is_valid_http_url(amplify_docs) is True

        amplify_pricing = get_canonical_source_url("AWS Amplify", "pricing")
        assert "aws.amazon.com/amplify/pricing" in amplify_pricing
        assert is_valid_http_url(amplify_pricing) is True

    def test_corroborating_signals_have_distinct_urls(self):
        """Corroborating signal sources must be distinct and non-duplicated"""
        urls = [
            get_canonical_source_url("AWS Amplify", "newsroom", index=0),
            get_canonical_source_url("AWS Amplify", "documentation", index=1),
            get_canonical_source_url("AWS Amplify", "pricing", index=2),
            get_canonical_source_url("AWS Amplify", "github", index=3),
        ]
        assert len(urls) == len(set(urls)), "Signals must not share identical URLs"
        for u in urls:
            assert is_valid_http_url(u) is True


class TestStorageEvidenceNormalization:
    """Test that storage normalizers properly validate and sanitize evidence URLs"""

    def test_normalize_change_with_placeholder_url(self):
        raw = {
            "title": "Netflix Expands Ad Tier",
            "competitor_name": "Netflix",
            "source_url": "https://netflix.com/updates/1",  # Placeholder
            "evidence_sources": [
                {"name": "Blog", "url": "https://netflix.com/updates/1"},
                {"name": "Dead Domain", "url": "https://cloudflarepages.com/updates"},
            ],
        }
        normalized = _normalize_high_impact_change(raw, "Netflix")
        
        # Primary source_url must be converted to an authentic URL
        assert "updates/1" not in normalized["source_url"]
        assert is_valid_http_url(normalized["source_url"]) is True
        assert "netflix" in normalized["source_url"]

        # Evidence sources must have authentic URLs
        for src in normalized["evidence_sources"]:
            assert "updates/1" not in src["url"]
            assert "cloudflarepages.com" not in src["url"]
            assert is_valid_http_url(src["url"]) is True

    def test_normalize_sequence_record_with_amplify(self):
        raw_step = {
            "title": "AWS Amplify Gen 2 Release",
            "source_url": "https://awsamplify.com/updates",
            "signals": [
                {
                    "title": "SDK Release",
                    "url": "https://awsamplify.com/updates/3",
                    "sources": [{"title": "Docs", "url": "https://awsamplify.com/docs"}],
                }
            ],
        }
        normalized = _normalize_sequence_record(raw_step, "AWS Amplify")
        assert "awsamplify.com" not in normalized["source_url"]
        assert is_valid_http_url(normalized["source_url"]) is True
        assert ("aws.amazon.com/amplify" in normalized["source_url"] or "github.com/aws-amplify" in normalized["source_url"])
        for sig in normalized["signals"]:
            assert "awsamplify.com" not in sig["url"]
            assert is_valid_http_url(sig["url"]) is True
            for s in sig.get("sources", []):
                assert "awsamplify.com" not in s["url"]
                assert is_valid_http_url(s["url"]) is True
