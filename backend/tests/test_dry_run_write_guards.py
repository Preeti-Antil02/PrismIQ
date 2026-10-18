"""
Unit tests verifying dry-run write guards and read-failure surfacing.
Enforces:
1. Full pipeline execution in DRY_RUN makes ZERO calls to any storage write function.
2. Direct invocation of all 26 write functions in DRY_RUN performs zero database mutations.
3. Failed reads in DRY_RUN surface (raise exceptions) rather than silently falling back.
"""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import storage, workflow


ALL_STORAGE_WRITE_FUNCTIONS = [
    "save_signals",
    "save_noise_decisions",
    "save_events",
    "save_findings",
    "save_brief",
    "ensure_tenant_user_exists",
    "save_discovery_proposal",
    "save_confirmed_competitors",
    "save_tenant_discovery_proposal",
    "save_tenant_confirmed_companies",
    "untrack_tenant_company",
    "track_tenant_company",
    "save_discovery_sources",
    "save_pricing_snapshot",
    "save_tenant_delivery_config",
    "save_tenant_research_topic",
    "delete_tenant_research_topic",
    "update_tenant_research_topic_status",
    "save_research_items",
    "save_radar_evaluations",
    "ensure_pipeline_run_tables",
    "create_pipeline_run",
    "update_pipeline_progress",
    "record_first_visible_data",
    "complete_pipeline_run",
]


def test_full_pipeline_dry_run_zero_write_calls(monkeypatch):
    """
    Run the full pipeline in DRY_RUN mode with spies on every write function in storage.py.
    Asserts ZERO calls across all storage write functions.
    """
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.setenv("PIPELINE_SCOPE", "owner")
    monkeypatch.setenv("ALLOW_LIVE_WRITE", "false")

    spies = {}
    for fn_name in ALL_STORAGE_WRITE_FUNCTIONS:
        mock = MagicMock(name=fn_name)
        monkeypatch.setattr(storage, fn_name, mock)
        spies[fn_name] = mock

    # Mock signal collector and LLM calls so pipeline runs fast and offline
    sample_signals = [
        {
            "event_id": "test_evt_1",
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Releases Microfrontends Tooling",
            "url": "https://vercel.com/blog/mfe",
            "published_at": "2026-08-20T10:00:00Z",
            "raw_excerpt": "New microfrontends architecture for large engineering teams.",
        }
    ]

    with patch("src.monitoring_agent.run", return_value=(sample_signals, {"news": {"status": "ok", "count": 1}})), \
         patch("src.monitoring_agent.fetch_company_signals", return_value=(sample_signals, {"news": {"status": "ok", "count": 1}})), \
         patch("src.monitoring_agent.fetch_topic_research_items", return_value=[]), \
         patch("src.analysis_agent.run", return_value=[{"why_it_matters": "Strategic implication.", "confidence": "High", "fact_confidence": "High", "inference_confidence": "High"}]), \
         patch("src.storage.get_active_tenants", return_value=[{
             "tenant_id": "c8f13b91-46ef-4682-9975-f85764d8a12e",
             "target_company": "Vercel",
             "competitors": ["Netlify"],
             "tracked_companies": ["Vercel", "Netlify"],
             "slack_webhook_url": "https://hooks.slack.com/services/T00/B00/X00",
             "delivery_cadence": "daily",
             "is_delivery_enabled": True,
         }]), \
         patch("src.storage.get_all_tracked_companies", return_value=["Vercel", "Netlify"]), \
         patch("src.delivery_agent.run", return_value={"digest_text": "Sample digest", "delivery_status": {"status": "dry_run_simulated"}}):

        result = workflow.run_progressive_pipeline(
            companies=["Vercel", "Netlify"],
            sources=["news"],
            tenant_id="c8f13b91-46ef-4682-9975-f85764d8a12e",
            is_first_run=False,
        )

        assert result is not None
        assert "report_content" in result or "tenant_results" in result

    # Assert ZERO calls to every write function
    called_functions = {fn_name: spy.call_count for fn_name, spy in spies.items() if spy.call_count > 0}
    assert not called_functions, f"Expected 0 calls in DRY_RUN, but following write functions were called: {called_functions}"


def test_storage_write_functions_return_immediately_in_dry_run(monkeypatch):
    """
    Directly call each write function with DRY_RUN=true and verify no database connection is opened.
    """
    monkeypatch.setenv("DRY_RUN", "true")
    assert storage.is_dry_run() is True

    # None of these should raise or attempt live DB connection
    assert storage.save_signals([]) is not None
    storage.save_noise_decisions([])
    assert storage.save_events([]) is not None
    assert storage.save_findings([], tenant_id="c8f13b91-46ef-4682-9975-f85764d8a12e") is None
    assert storage.save_brief("report") is not None
    storage.ensure_tenant_user_exists(None, "c8f13b91-46ef-4682-9975-f85764d8a12e")
    assert storage.save_discovery_proposal("Vercel", []) is not None
    assert storage.save_confirmed_competitors("Vercel", ["Netlify"]) is not None
    assert storage.save_tenant_discovery_proposal("c8f13b91-46ef-4682-9975-f85764d8a12e", "Vercel", []) is not None
    assert storage.save_tenant_confirmed_companies("c8f13b91-46ef-4682-9975-f85764d8a12e", "Vercel", []) == []
    assert storage.untrack_tenant_company("c8f13b91-46ef-4682-9975-f85764d8a12e", "Vercel") is False
    assert storage.track_tenant_company("c8f13b91-46ef-4682-9975-f85764d8a12e", "Vercel") == {}
    assert storage.save_discovery_sources("Vercel", []) is not None
    assert storage.save_pricing_snapshot("Vercel", [], "https://vercel.com/pricing") is not None
    assert storage.save_tenant_delivery_config("c8f13b91-46ef-4682-9975-f85764d8a12e", "https://hooks.slack.com/xxx") is not None
    assert storage.save_tenant_research_topic("c8f13b91-46ef-4682-9975-f85764d8a12e", "AI", ["llm"]) is not None
    assert storage.delete_tenant_research_topic("c8f13b91-46ef-4682-9975-f85764d8a12e", "AI") is False
    assert storage.update_tenant_research_topic_status("c8f13b91-46ef-4682-9975-f85764d8a12e", "AI", True) is False
    assert storage.save_research_items([{"url": "https://arxiv.org/abs/1234"}]) == 0
    storage.save_radar_evaluations([{"id": "ev1"}], tenant_id="c8f13b91-46ef-4682-9975-f85764d8a12e")
    storage.ensure_pipeline_run_tables()
    assert storage.create_pipeline_run("c8f13b91-46ef-4682-9975-f85764d8a12e").startswith("dry_run_")
    storage.update_pipeline_progress("run_123", phase="fetching")
    assert storage.record_first_visible_data("run_123") is None
    storage.complete_pipeline_run("run_123")


def test_failed_reads_surface_in_dry_run(monkeypatch):
    """
    Verify that in DRY_RUN mode, failed database reads surface (raise)
    rather than silently falling back to empty lists or default configs.
    """
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.setenv("FORCE_LIVE_TEST_DB", "1")

    # 1. get_all_tracked_companies
    with patch("src.storage.get_readonly_cursor", side_effect=RuntimeError("Simulated DB Read Failure")):
        with pytest.raises(RuntimeError, match="Simulated DB Read Failure"):
            storage.get_all_tracked_companies()

    # 2. get_pending_tenant_events
    with patch("src.storage.get_readonly_cursor", side_effect=RuntimeError("Simulated DB Read Failure")):
        with pytest.raises(RuntimeError, match="Simulated DB Read Failure"):
            storage.get_pending_tenant_events("c8f13b91-46ef-4682-9975-f85764d8a12e")

    # 3. get_tenant_research_topics
    with patch("src.storage.get_tenant_db_cursor", side_effect=RuntimeError("Simulated DB Read Failure")):
        with pytest.raises(RuntimeError, match="Simulated DB Read Failure"):
            storage.get_tenant_research_topics("c8f13b91-46ef-4682-9975-f85764d8a12e")

    # 4. get_research_items_for_topics
    with patch("src.storage.get_readonly_cursor", side_effect=RuntimeError("Simulated DB Read Failure")):
        with pytest.raises(RuntimeError, match="Simulated DB Read Failure"):
            storage.get_research_items_for_topics(["AI", "Next.js"])

    # 5. get_entity_anchor
    with patch("src.storage.get_readonly_cursor", side_effect=RuntimeError("Simulated DB Read Failure")):
        with pytest.raises(RuntimeError, match="Simulated DB Read Failure"):
            storage.get_entity_anchor("Vercel")
