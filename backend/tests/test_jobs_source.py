import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import monitoring_agent, event_consolidator, report_agent, analysis_agent


def test_fetch_greenhouse_jobs_parsing_and_filtering():
    now_iso = datetime.now(timezone.utc).isoformat()
    old_iso = (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()

    fake_greenhouse_response = {
        "jobs": [
            {
                "id": 101,
                "title": "Staff AI Engineer",
                "first_published": now_iso,
                "updated_at": now_iso,
                "absolute_url": "https://job-boards.greenhouse.io/vercel/jobs/101",
                "location": {"name": "San Francisco, CA"},
                "departments": [{"name": "AI Platform"}],
            },
            {
                "id": 102,
                "title": "Legacy Sales Rep with Stale first_published but recent updated_at",
                "first_published": old_iso,
                "updated_at": now_iso,
                "absolute_url": "https://job-boards.greenhouse.io/vercel/jobs/102",
                "location": {"name": "Remote"},
                "departments": [{"name": "Sales"}],
            },
            {
                "id": 103,
                "title": "Ancient Sales Rep without first_published",
                "updated_at": old_iso,
                "absolute_url": "https://job-boards.greenhouse.io/vercel/jobs/103",
                "location": {"name": "Remote"},
                "departments": [{"name": "Sales"}],
            },
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_greenhouse_response

    with patch("requests.get", return_value=mock_resp):
        signals = monitoring_agent._fetch_greenhouse_jobs("vercel", "Vercel", days=7)

    # Only the recent job (within 7 days) should be returned
    assert len(signals) == 1
    sig = signals[0]
    assert sig["source"] == "jobs"
    assert sig["company"] == "Vercel"
    assert "Staff AI Engineer" in sig["title"]
    assert "AI Platform" in sig["title"]
    assert sig["url"] == "https://job-boards.greenhouse.io/vercel/jobs/101"
    assert sig["published_at"] == now_iso
    assert "San Francisco, CA" in sig["raw_excerpt"]


def test_fetch_lever_jobs_parsing_and_filtering():
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    old_ms = int((datetime.now(timezone.utc) - timedelta(days=25)).timestamp() * 1000)

    fake_lever_response = [
        {
            "id": "lever_1",
            "text": "Infrastructure Security Lead",
            "createdAt": now_ms,
            "hostedUrl": "https://jobs.lever.co/kinsta/lever_1",
            "categories": {
                "team": "Security",
                "location": "London, UK",
            },
        },
        {
            "id": "lever_2",
            "text": "Old Job",
            "createdAt": old_ms,
            "hostedUrl": "https://jobs.lever.co/kinsta/lever_2",
            "categories": {
                "team": "Marketing",
                "location": "Remote",
            },
        },
    ]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_lever_response

    with patch("requests.get", return_value=mock_resp):
        signals = monitoring_agent._fetch_lever_jobs("kinsta", "Kinsta", days=7)

    assert len(signals) == 1
    sig = signals[0]
    assert sig["source"] == "jobs"
    assert sig["company"] == "Kinsta"
    assert "Infrastructure Security Lead" in sig["title"]
    assert "Security" in sig["title"]
    assert sig["url"] == "https://jobs.lever.co/kinsta/lever_1"


def test_fetch_ashby_jobs_parsing_and_filtering():
    now_iso = datetime.now(timezone.utc).isoformat()
    old_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    fake_ashby_response = {
        "jobs": [
            {
                "id": "ashby_1",
                "title": "Edge Runtime Engineer",
                "publishedAt": now_iso,
                "jobUrl": "https://jobs.ashbyhq.com/supabase/ashby_1",
                "department": "Platform Core",
                "location": "Remote - Global",
            },
            {
                "id": "ashby_2",
                "title": "Ancient Posting",
                "publishedAt": old_iso,
                "jobUrl": "https://jobs.ashbyhq.com/supabase/ashby_2",
                "department": "Admin",
                "location": "Office",
            },
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_ashby_response

    with patch("requests.get", return_value=mock_resp):
        signals = monitoring_agent._fetch_ashby_jobs("supabase", "Supabase", days=7)

    assert len(signals) == 1
    sig = signals[0]
    assert sig["source"] == "jobs"
    assert sig["company"] == "Supabase"
    assert "Edge Runtime Engineer" in sig["title"]
    assert "Platform Core" in sig["title"]


def test_unsupported_company_returns_empty_without_scraping():
    # An unknown company not on Greenhouse/Ashby/Lever
    mock_resp = MagicMock()
    mock_resp.status_code = 404

    with patch("requests.get", return_value=mock_resp):
        signals = monitoring_agent._fetch_jobs("BespokeCareersCompanyXYZ", days=7)

    assert signals == []


def test_cross_source_event_consolidation_jobs_and_news():
    """Verify that a job posting and news release on the same initiative cleanly merge."""
    job_sig = {
        "source": "jobs",
        "company": "Vercel",
        "title": "Job Posting: Lead Systems Engineer (is-agentic.com)",
        "url": "https://job-boards.greenhouse.io/vercel/jobs/999",
        "published_at": "2026-08-22T10:00:00Z",
        "raw_excerpt": "Building is-agentic.com scoring engine.",
    }
    news_sig = {
        "source": "news",
        "company": "Vercel",
        "title": "Vercel Shipped is-agentic.com. Here Is How the Scoreboard Works",
        "url": "https://dev.to/promptway/vercel-shipped-is-agenticcom",
        "published_at": "2026-08-21T21:41:49Z",
        "raw_excerpt": "Vercel shipped a public score for whether agents can read your site.",
    }

    events = event_consolidator.run([job_sig, news_sig])
    assert len(events) == 1
    evt = events[0]
    assert evt["corroboration_count"] == 2
    assert set(evt["contributing_sources"]) == {"jobs", "news"}
    assert len(evt["raw_signals"]) == 2


def test_report_agent_routine_vs_leadership_job_tiering():
    routine_job_finding = {
        "source": "jobs",
        "company": "Vercel",
        "title": "Job Posting: Account Executive (Sales)",
        "url": "https://job-boards.greenhouse.io/vercel/jobs/1",
        "why_it_matters": "Routine commercial hiring for account executive.",
        "confidence": "Low",
    }
    assert report_agent._assign_finding_tier(routine_job_finding) == "nice_to_know"

    leadership_job_finding = {
        "source": "jobs",
        "company": "Vercel",
        "title": "Job Posting: VP of AI Infrastructure (Engineering)",
        "url": "https://job-boards.greenhouse.io/vercel/jobs/2",
        "why_it_matters": "Executive hiring indicates strategic expansion into custom AI hardware and infrastructure.",
        "confidence": "High",
    }
    # VP role qualifies for higher tier
    tier = report_agent._assign_finding_tier(leadership_job_finding)
    assert tier in ["must_know", "should_know"]


def test_analysis_agent_prompt_contains_hiring_calibration():
    sys_prompt, _ = analysis_agent._build_prompts({"company": "Vercel", "title": "Job Posting: Account Executive"})
    assert "JOB POSTINGS & HIRING SIGNALS CALIBRATION" in sys_prompt
    assert "routine job posting" in sys_prompt.lower()
    assert "flag a strategic pattern" in sys_prompt.lower()
