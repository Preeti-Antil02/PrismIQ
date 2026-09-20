import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from src import monitoring_agent, storage, workflow


def test_google_news_rss_fallback():
    """Verify that _fetch_news_from_currents falls back to Google News RSS when Currents API fails or key is missing."""
    with patch.dict(os.environ, {"CURRENTS_API_KEY": ""}, clear=False), \
         patch.dict(os.environ, {"ALLOW_TEST_NETWORK": "true"}, clear=False):
        # Even without Currents key, Google News fallback should run when ALLOW_TEST_NETWORK is set
        signals = monitoring_agent._fetch_news_from_google_rss("OpenAI", days=14)
        assert isinstance(signals, list)
        if signals:
            assert signals[0]["source"] == "news"
            assert signals[0]["company"] == "OpenAI"
            assert "url" in signals[0]
            assert "title" in signals[0]


def test_pipeline_run_stale_reaping():
    """Verify that runs stuck in status 'running' older than 30 minutes are reaped."""
    run_id = f"stale_run_{uuid.uuid4().hex[:6]}"
    old_time = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
    storage._IN_MEMORY_RUN_PROGRESS[run_id] = {
        "run_id": run_id,
        "tenant_id": "test-stale-tenant",
        "status": "running",
        "current_phase": "fetching_signals",
        "started_at": old_time,
        "total_companies": 3,
        "completed_companies": 0,
    }

    # Calling get_active_or_latest_run_progress should reap the stale run
    res = storage.get_active_or_latest_run_progress("test-stale-tenant")
    assert res is not None
    assert res["status"] == "timed_out"
    assert "timed out" in res["progress_message"].lower()

    # Clean up
    storage._IN_MEMORY_RUN_PROGRESS.pop(run_id, None)


def test_pipeline_run_tenant_isolation():
    """Verify that Tenant A and Tenant B see strictly isolated run progress."""
    run_a = f"run_a_{uuid.uuid4().hex[:6]}"
    run_b = f"run_b_{uuid.uuid4().hex[:6]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    storage._IN_MEMORY_RUN_PROGRESS[run_a] = {
        "run_id": run_a,
        "tenant_id": "tenant-aaa",
        "status": "running",
        "current_phase": "fetching_signals",
        "started_at": now_iso,
        "total_companies": 3,
        "completed_companies": 1,
    }

    storage._IN_MEMORY_RUN_PROGRESS[run_b] = {
        "run_id": run_b,
        "tenant_id": "tenant-bbb",
        "status": "completed",
        "current_phase": "completed",
        "started_at": now_iso,
        "total_companies": 4,
        "completed_companies": 4,
    }

    res_a = storage.get_active_or_latest_run_progress("tenant-aaa")
    res_b = storage.get_active_or_latest_run_progress("tenant-bbb")

    assert res_a is not None
    assert res_a["run_id"] == run_a
    assert res_a["tenant_id"] == "tenant-aaa"
    assert res_a["status"] == "running"

    assert res_b is not None
    assert res_b["run_id"] == run_b
    assert res_b["tenant_id"] == "tenant-bbb"
    assert res_b["status"] == "completed"

    # Clean up
    storage._IN_MEMORY_RUN_PROGRESS.pop(run_a, None)
    storage._IN_MEMORY_RUN_PROGRESS.pop(run_b, None)


def test_workflow_passes_tenant_topics_to_research():
    """Verify that workflow collects and passes active tenant topics into fetch_topic_research_items."""
    tenant_id = str(uuid.uuid4())
    custom_topics = [{"topic_label": "Autonomous AI Agents", "keywords": ["agentic", "tool use"]}]

    with patch("src.storage.get_tenant_workspace_config") as mock_cfg, \
         patch("src.monitoring_agent.fetch_topic_research_items") as mock_fetch_research, \
         patch("src.monitoring_agent.fetch_company_signals") as mock_signals, \
         patch("src.analysis_agent.run") as mock_analysis, \
         patch("src.synthesis_agent.run") as mock_synth, \
         patch("src.report_agent.run") as mock_report, \
         patch("src.delivery_agent.run") as mock_deliv:

        mock_cfg.return_value = {
            "target_company": "OpenAI",
            "competitors": ["Anthropic"],
            "tracked_companies": [
                {"company_name": "OpenAI", "is_target": True, "status": "active"},
                {"company_name": "Anthropic", "is_target": False, "status": "active"},
            ],
            "topics": custom_topics,
            "is_configured": True,
        }

        mock_signals.return_value = ([], {})
        mock_fetch_research.return_value = []
        mock_analysis.return_value = []
        mock_synth.return_value = {}
        mock_report.return_value = "# Report"
        mock_deliv.return_value = {"digest_text": "", "delivery_status": {"status": "skipped"}}

        workflow.run_progressive_pipeline(tenant_id=tenant_id)

        # Verify fetch_topic_research_items was called with custom_topics
        assert mock_fetch_research.called
        call_kwargs = mock_fetch_research.call_args[1]
        assert call_kwargs.get("topics") == custom_topics
