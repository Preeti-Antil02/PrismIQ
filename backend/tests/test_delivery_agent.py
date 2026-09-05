import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import delivery_agent, report_agent


@pytest.fixture
def sample_findings():
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    return [
        # Must-Know item (CVE / security risk)
        {
            "company": "Cloudflare Pages/Workers",
            "title": "A revisit of remote Spectre attacks on Cloudflare Workers",
            "url": "https://blog.cloudflare.com/spectre-research-workers-revisit",
            "confidence": "High",
            "fact_confidence": "High",
            "inference_confidence": "Medium",
            "why_it_matters": "Microarchitectural side-channel attacks evaluated on V8 isolates.",
            "source": "research",
            "source_subtype": "research",
            "published_at": "2026-09-04 10:00:00 +0000",
            "research_details": {"type": "technical_writeup"},
        },
        # Should-Know item (Product feature)
        {
            "company": "Vercel",
            "title": "Next.js 15.2.0 released with Turbopack improvements",
            "url": "https://vercel.com/blog/next-15-2",
            "confidence": "Medium",
            "fact_confidence": "Medium",
            "inference_confidence": "Medium",
            "why_it_matters": "Improves local dev compilation speed by 40%.",
            "source": "news",
            "published_at": "2026-09-04 12:00:00 +0000",
        },
        # Nice-to-Know item (Routine job posting)
        {
            "company": "Netlify",
            "title": "Job Posting: Senior Frontend Engineer",
            "url": "https://jobs.ashbyhq.com/netlify/123",
            "confidence": "Low",
            "why_it_matters": "Routine hiring in frontend engineering.",
            "source": "jobs",
            "published_at": "2026-09-04 08:00:00 +0000",
        },
    ]


def test_slack_digest_top_3_decisions_included(sample_findings):
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    digest = delivery_agent.build_slack_digest(sample_findings, reference_time=ref_dt)

    assert "📊 *PrismIQ Daily Intelligence Digest* | 2026-09-05" in digest
    assert "*Top 3 Decisions This Informs:*" in digest
    assert "Cloudflare" in digest
    assert "<https://blog.cloudflare.com/spectre-research-workers-revisit|A revisit of remote Spectre attacks on Cloudflare Workers>" in digest


def test_slack_digest_must_know_only_included(sample_findings):
    """Verify that Must-Know findings are included, while Should-Know and Nice-to-Know are excluded from the digest."""
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    digest = delivery_agent.build_slack_digest(sample_findings, reference_time=ref_dt)

    assert "*Must-Know Findings:*" in digest
    # Must-Know item MUST appear
    assert "A revisit of remote Spectre attacks" in digest
    assert "Microarchitectural side-channel attacks" in digest

    # Should-Know & Nice-to-Know items must NOT appear under Must-Know findings
    must_know_section = digest.split("*Must-Know Findings:*")[1].split("*Research Activity")[0]
    assert "Next.js 15.2.0 released" not in must_know_section
    assert "Job Posting: Senior Frontend Engineer" not in must_know_section


def test_slack_digest_zero_must_know_plain_line():
    """Verify that when 0 Must-Know findings exist, it outputs 'No Must-Know activity today' plainly."""
    routine_findings = [
        {
            "company": "Vercel",
            "title": "Minor changelog update",
            "url": "https://vercel.com/changelog/update",
            "confidence": "Low",
            "why_it_matters": "Minor UI fix.",
            "source": "news",
            "published_at": "2026-09-04",
        }
    ]
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    digest = delivery_agent.build_slack_digest(routine_findings, reference_time=ref_dt)

    assert "*Must-Know Findings:*" in digest
    assert "No Must-Know activity today" in digest


def test_slack_digest_disclosures_condensed():
    """Verify condensed execution disclosures for mode, source alert, and supervisor skip."""
    source_health = {
        "jobs": {
            "status": "failed",
            "error": "HTTP 503 Service Unavailable",
            "attempts": 2,
        },
        "github": {
            "status": "recovered",
            "attempts": 2,
        },
    }
    supervisor_decisions = {
        "pricing": {
            "action": "skip",
            "reason": "snapshots are fresh (< 24.0h old)",
        }
    }
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    digest = delivery_agent.build_slack_digest(
        [],
        supervisor_decisions=supervisor_decisions,
        source_health=source_health,
        trigger_mode="scheduled",
        cadence_name="daily",
        reference_time=ref_dt,
    )

    assert "⏱️ *Execution Mode:* Autonomous Scheduled Run (daily)" in digest
    assert "⚠️ *Source Alert:* `jobs` unavailable (HTTP 503 Service Unavailable after 2 attempts)" in digest
    assert "🔄 *Source Recovery:* `github` recovered on attempt 2" in digest
    assert "ℹ️ *Supervisor Note:* `pricing` skipped — snapshots are fresh (< 24.0h old)" in digest


def test_slack_digest_research_state_1_active(sample_findings):
    """State 1: Research findings present in current cycle -> render research bullets."""
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    digest = delivery_agent.build_slack_digest(sample_findings, reference_time=ref_dt)

    assert "*Research Activity (Papers & Technical Write-ups):*" in digest
    assert "• *Cloudflare Pages/Workers* — <https://blog.cloudflare.com/spectre-research-workers-revisit|A revisit of remote Spectre attacks on Cloudflare Workers> (Technical Deep-Dive)" in digest


def test_slack_digest_research_state_2_transition_note():
    """State 2: 0 research findings in current cycle, but prior research finding exists -> render transition note."""
    no_research_findings = [
        {
            "company": "Vercel",
            "title": "Product Launch",
            "url": "https://vercel.com/blog/v0",
            "confidence": "Medium",
            "why_it_matters": "New v0 features.",
            "source": "news",
            "published_at": "2026-09-04",
        }
    ]
    prior_research = {
        "title": "BGP Role model: tracking adoption of RFC 9234",
        "published_at": "2026-08-30",
        "company": "Cloudflare",
    }
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    digest = delivery_agent.build_slack_digest(
        no_research_findings,
        prior_research_activity=prior_research,
        reference_time=ref_dt,
    )

    assert "*Research Activity:*" in digest
    assert "No new research activity today (last research finding from Cloudflare: \"BGP Role model: tracking adoption of RFC 9234\" on 2026-08-30)" in digest


def test_slack_digest_research_state_3_suppressed():
    """State 3: 0 research findings in current cycle, and prior research is None -> suppress completely."""
    no_research_findings = [
        {
            "company": "Vercel",
            "title": "Product Launch",
            "url": "https://vercel.com/blog/v0",
            "confidence": "Medium",
            "why_it_matters": "New v0 features.",
            "source": "news",
            "published_at": "2026-09-04",
        }
    ]
    ref_dt = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    digest = delivery_agent.build_slack_digest(
        no_research_findings,
        prior_research_activity=None,
        reference_time=ref_dt,
    )

    assert "*Research Activity*" not in digest


def test_post_slack_digest_skipped_when_no_url():
    """Verify graceful skip when SLACK_WEBHOOK_URL is not set."""
    with patch("src.config.SLACK_WEBHOOK_URL", ""):
        res = delivery_agent.post_slack_digest("Sample Digest", webhook_url="")
        assert res["status"] == "skipped"
        assert res["reason"] == "SLACK_WEBHOOK_URL not configured"


def test_post_slack_digest_successful_post():
    """Verify direct HTTP POST to Slack webhook endpoint."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = "ok"

    with patch("requests.post", return_value=mock_resp) as mock_post:
        res = delivery_agent.post_slack_digest("Test Digest", webhook_url="https://hooks.slack.com/services/T00/B00/X00")
        assert res["status"] == "delivered"
        assert res["attempts"] == 1
        assert res["status_code"] == 200

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs["json"] == {"text": "Test Digest"}
        assert call_kwargs["headers"]["Content-Type"] == "application/json"


def test_post_slack_digest_retry_and_recovery():
    """Verify Decision Point 1 retry pattern: fails attempt 1, retries, recovers attempt 2."""
    call_count = 0

    def _mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        resp = MagicMock()
        if call_count == 1:
            resp.status_code = 500
            resp.text = "Internal Server Error"
        else:
            resp.status_code = 200
            resp.text = "ok"
        return resp

    with patch("requests.post", side_effect=_mock_post), patch("time.sleep", return_value=None):
        res = delivery_agent.post_slack_digest(
            "Test Digest",
            webhook_url="https://hooks.slack.com/services/T00/B00/X00",
            max_retries=1,
            backoff=0.01,
        )
        assert res["status"] == "delivered"
        assert res["attempts"] == 2
        assert call_count == 2


def test_post_slack_digest_failure_isolation_no_crash():
    """Verify persistent HTTP / network failure does not crash pipeline and records failure metadata."""
    def _mock_post(*args, **kwargs):
        raise ConnectionError("DNS resolution failure for hooks.slack.com")

    with patch("requests.post", side_effect=_mock_post), patch("time.sleep", return_value=None):
        res = delivery_agent.post_slack_digest(
            "Test Digest",
            webhook_url="https://hooks.slack.com/services/invalid",
            max_retries=1,
            backoff=0.01,
        )
        assert res["status"] == "failed"
        assert res["attempts"] == 2
        assert "DNS resolution failure" in res["error"]
        assert "brief persisted to postgres" in res["fallback"]
