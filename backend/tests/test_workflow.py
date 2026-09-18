import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import patch
import pytest

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import workflow, monitoring_agent, pricing_extractor, report_agent, storage


def test_langgraph_workflow_graph_compilation():
    """Verify that the LangGraph StateGraph compiles successfully with all 8 nodes."""
    app = workflow.create_pipeline_graph()
    assert app is not None
    assert "delivery" in app.nodes


def test_workflow_delivery_node_execution():
    """Verify that delivery_node executes and produces delivery_status without error."""
    state = {
        "synthesis": {"themes": {}, "enriched_findings": []},
        "supervisor_decisions": {},
        "source_health": {},
        "trigger_mode": "manual",
        "slack_webhook_url": "",
    }
    result = workflow.delivery_node(state)
    assert "slack_digest" in result
    assert "delivery_status" in result
    assert result["delivery_status"]["status"] == "skipped"


def test_decision_point_1_source_retry_and_recovery():
    """
    Verify Decision Point 1:
    A source fails on attempt 1, retries with backoff, and recovers on attempt 2.
    """
    call_count = 0
    def _mock_transient_fetch():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise ConnectionError("Transient network timeout on attempt 1")
        return [{"company": "Vercel", "source": "news", "title": "Recovered Signal", "url": "https://e.com/rec", "published_at": "2026-08-28"}]

    signals, health = monitoring_agent.fetch_source_with_retry("news", _mock_transient_fetch, max_retries=1, backoff=0.01)
    
    assert len(signals) == 1
    assert health["status"] == "recovered"
    assert health["attempts"] == 2
    assert health["signals_count"] == 1


def test_decision_point_1_source_fallback_and_disclosure(tmp_path, monkeypatch):
    """
    Verify Decision Point 1:
    A source fails persistently on both attempts 1 and 2.
    Pipeline engages fallback, continues with other sources, and Report Agent discloses the failure in the brief.
    """
    def _mock_failing_fetch():
        raise TimeoutError("GitHub API rate limit exceeded (HTTP 403)")

    signals, health = monitoring_agent.fetch_source_with_retry("github", _mock_failing_fetch, max_retries=1, backoff=0.01)

    assert signals == []
    assert health["status"] == "failed"
    assert health["attempts"] == 2
    assert "GitHub API rate limit exceeded" in health["error"]

    # Test that report_agent discloses the failure
    source_health = {"github": health}
    brief = report_agent.run({"themes": {}, "enriched_findings": []}, source_health=source_health)

    assert "## Pipeline Execution & Data Coverage" in brief
    assert "github" in brief
    assert "GitHub API rate limit exceeded" in brief
    assert "Pipeline continued with remaining healthy sources" in brief


def test_decision_point_2_supervisor_pricing_freshness_skip(tmp_path, monkeypatch):
    """
    Verify Decision Point 2:
    When pricing snapshots for all companies are < 24.0h old,
    Supervisor decides to skip pricing scrape and discloses the reason in the brief.
    """
    # Create fresh pricing snapshots for Vercel, Netlify, Cloudflare
    fresh_time = (datetime.now(timezone.utc) - timedelta(hours=2.5)).isoformat()
    for comp in ["Vercel", "Netlify", "Cloudflare Pages/Workers"]:
        slug = pricing_extractor._get_company_slug(comp)
        snap_file = tmp_path / f"pricing_latest_{slug}.json"
        snap_data = {
            "company": comp,
            "url": "https://example.com",
            "fetched_at": fresh_time,
            "plans": [{"name": "Pro", "monthly_price": "$20"}],
        }
        import json
        with open(snap_file, "w", encoding="utf-8") as f:
            json.dump(snap_data, f)

    is_fresh, reason, ages = pricing_extractor.check_pricing_freshness(
        ["Vercel", "Netlify", "Cloudflare Pages/Workers"],
        threshold_hours=24.0,
        data_dir=tmp_path,
    )
    assert is_fresh is True
    assert "fresh" in reason.lower()
    assert all(age < 24.0 for age in ages.values())

    # Verify supervisor node sets action='skip'
    state = {
        "companies": ["Vercel", "Netlify", "Cloudflare Pages/Workers"],
        "configured_sources": ["news", "github", "jobs", "pricing"],
    }
    monkeypatch.setattr(pricing_extractor, "DATA_DIR", tmp_path)
    result = workflow.supervisor_node(state)
    assert result["supervisor_decisions"]["pricing"]["action"] == "skip"
    assert "threshold: 24.0h" in result["supervisor_decisions"]["pricing"]["reason"]

    # Verify Report Agent surfaces the supervisor skip note
    brief = report_agent.run(
        {"themes": {}, "enriched_findings": []},
        supervisor_decisions=result["supervisor_decisions"],
    )
    assert "## Pipeline Execution & Data Coverage" in brief
    assert "pricing" in brief
    assert "skipped this cycle" in brief


def test_decision_point_2_supervisor_pricing_stale_triggers_run(tmp_path, monkeypatch):
    """
    Verify Decision Point 2:
    When a pricing snapshot is > 24.0h old, Supervisor schedules a pricing scrape.
    """
    stale_time = (datetime.now(timezone.utc) - timedelta(hours=36.0)).isoformat()
    slug = pricing_extractor._get_company_slug("Vercel")
    snap_file = tmp_path / f"pricing_latest_{slug}.json"
    import json
    with open(snap_file, "w", encoding="utf-8") as f:
        json.dump({"company": "Vercel", "fetched_at": stale_time, "plans": []}, f)

    is_fresh, reason, ages = pricing_extractor.check_pricing_freshness(
        ["Vercel"],
        threshold_hours=24.0,
        data_dir=tmp_path,
    )
    assert is_fresh is False
    assert "refresh needed" in reason.lower()


def test_progressive_pipeline_per_company_persistence():
    """Verify progressive execution updates run state per company and marks completion."""
    fake_signals_comp1 = [{
        "source": "news",
        "company": "CompanyAlpha",
        "title": "Alpha Launches V2",
        "url": "https://alpha.example.com",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "Launch details",
    }]
    fake_signals_comp2 = [{
        "source": "github",
        "company": "CompanyBeta",
        "title": "Beta Releases SDK",
        "url": "https://beta.example.com",
        "published_at": "2026-08-21T10:00:00Z",
        "raw_excerpt": "SDK details",
    }]

    def _mock_fetch_comp(company, *args, **kwargs):
        if company == "CompanyAlpha":
            return fake_signals_comp1, {"news": {"status": "ok"}}
        return fake_signals_comp2, {"github": {"status": "ok"}}

    mock_analysis = {
        "why_it_matters": "Strategic expansion.",
        "confidence": "High",
        "fact_confidence": "High",
        "inference_confidence": "Medium",
    }

    with patch("src.monitoring_agent.fetch_company_signals", side_effect=_mock_fetch_comp), \
         patch("src.analysis_agent._call_groq", return_value=mock_analysis), \
         patch("src.synthesis_agent.run", return_value={"themes": {}, "enriched_findings": []}), \
         patch("src.report_agent.run", return_value="# Executive Brief\nAll clear"), \
         patch("src.delivery_agent.run", return_value={"digest_text": "digest", "delivery_status": {"status": "skipped"}}):

        res = workflow.run_progressive_pipeline(
            companies=["CompanyAlpha", "CompanyBeta"],
            is_first_run=True,
        )

        assert res is not None
        progress = storage.get_active_or_latest_run_progress()
        assert progress is not None
        assert progress["status"] == "completed"
        assert progress["completed_companies"] == 2
        assert "CompanyAlpha" in progress["completed_company_names"]
        assert "CompanyBeta" in progress["completed_company_names"]

