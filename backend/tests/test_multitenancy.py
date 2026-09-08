import os
import sys
from pathlib import Path
from unittest.mock import patch
import pytest

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import storage, workflow, analysis_agent, synthesis_agent, report_agent, delivery_agent, event_consolidator


def test_get_all_tracked_companies_fallback(monkeypatch):
    """Verify get_all_tracked_companies returns deduplicated union."""
    comps = storage.get_all_tracked_companies()
    assert isinstance(comps, list)
    assert len(comps) == len(set(comps))  # Strictly deduplicated


def test_get_active_tenants_fallback():
    """Verify get_active_tenants returns valid tenant contexts."""
    tenants = storage.get_active_tenants()
    assert isinstance(tenants, list)
    assert len(tenants) >= 1
    t0 = tenants[0]
    assert "tenant_id" in t0
    assert "target_company" in t0
    assert "competitors" in t0
    assert "tracked_companies" in t0


def test_option_a_fact_confidence_preservation():
    """Verify that Analysis Agent preserves fact_confidence from consolidated event and does not overwrite it."""
    test_events = [
        {
            "event_id": "evt_test_high_fact",
            "company": "Vercel",
            "title": "Vercel Releases AI SDK v4.0",
            "url": "https://github.com/vercel/ai/releases/tag/v4.0.0",
            "raw_excerpt": "Official v4.0 release with tool calling support.",
            "fact_confidence": "High",
            "corroboration_count": 2,
            "contributing_sources": ["github", "news"],
        },
        {
            "event_id": "evt_test_med_fact",
            "company": "Netlify",
            "title": "Tech Blog Discusses Netlify",
            "url": "https://news.example.com/netlify-review",
            "raw_excerpt": "Third-party article evaluating modern web hosting.",
            "fact_confidence": "Medium",
            "corroboration_count": 1,
            "contributing_sources": ["news"],
        },
    ]

    mock_llm_response = {
        "why_it_matters": "Strategic expansion into generative AI tooling for modern web apps.",
        "fact_confidence": "Low",  # LLM tries to return Low, but Option A ignores it!
        "inference_confidence": "Medium",
        "confidence": "Medium",
    }

    with patch("src.analysis_agent._call_groq", return_value=mock_llm_response):
        findings = analysis_agent.run(test_events, target_company="Vercel", competitors=["Netlify"])
        
        assert len(findings) == 2
        # Event 1: fact_confidence must remain "High" from consolidated_events
        assert findings[0]["fact_confidence"] == "High"
        assert findings[0]["inference_confidence"] == "Medium"

        # Event 2: fact_confidence must remain "Medium" from consolidated_events
        assert findings[1]["fact_confidence"] == "Medium"
        assert findings[1]["inference_confidence"] == "Medium"


def test_per_tenant_event_filtering_and_custom_framing():
    """
    Verify Phase 2 correctly filters shared events and generates distinct tenant briefs:
    - Tenant 1 tracks: Vercel (target), Netlify (competitor)
    - Tenant 2 tracks: Stripe (target), Netlify (competitor)
    - Shared events: [Vercel event, Netlify event, Stripe event]
    - Tenant 1 sees Vercel & Netlify (NOT Stripe)
    - Tenant 2 sees Stripe & Netlify (NOT Vercel)
    """
    shared_events = [
        {
            "event_id": "evt_vercel_1",
            "company": "Vercel",
            "title": "Vercel Announces v0 Enterprise",
            "url": "https://vercel.com/blog/v0",
            "raw_excerpt": "Enterprise generative UI platform.",
            "fact_confidence": "High",
            "corroboration_count": 1,
            "contributing_sources": ["news"],
        },
        {
            "event_id": "evt_netlify_1",
            "company": "Netlify",
            "title": "Netlify Introduces New Pricing Tier",
            "url": "https://netlify.com/pricing",
            "raw_excerpt": "Updated compute pricing for high volume.",
            "fact_confidence": "High",
            "corroboration_count": 1,
            "contributing_sources": ["pricing"],
        },
        {
            "event_id": "evt_stripe_1",
            "company": "Stripe",
            "title": "Stripe Agentic Commerce Toolkit",
            "url": "https://stripe.com/news/agentic",
            "raw_excerpt": "AI payment agent integration tools.",
            "fact_confidence": "High",
            "corroboration_count": 1,
            "contributing_sources": ["news"],
        },
    ]

    mock_tenants = [
        {
            "tenant_id": "tenant_1_uuid",
            "target_company": "Vercel",
            "competitors": ["Netlify"],
            "tracked_companies": ["Vercel", "Netlify"],
            "slack_webhook_url": "https://hooks.slack.com/services/test/t1",
            "delivery_cadence": "daily",
            "is_delivery_enabled": True,
        },
        {
            "tenant_id": "tenant_2_uuid",
            "target_company": "Stripe",
            "competitors": ["Netlify"],
            "tracked_companies": ["Stripe", "Netlify"],
            "slack_webhook_url": None,  # No delivery config
            "delivery_cadence": "daily",
            "is_delivery_enabled": True,
        },
    ]

    mock_llm_response = {
        "why_it_matters": "Direct competitive implication.",
        "inference_confidence": "High",
        "confidence": "High",
    }

    state = {
        "consolidated_events": shared_events,
        "tenants": mock_tenants,
        "supervisor_decisions": {},
        "source_health": {},
    }

    with patch("src.analysis_agent._call_groq", return_value=mock_llm_response), \
         patch("requests.post") as mock_post:
        
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": True}
        mock_post.return_value.text = "ok"

        s1 = workflow.analysis_node(state)
        state.update(s1)
        s2 = workflow.synthesis_node(state)
        state.update(s2)
        s3 = workflow.report_node(state)
        state.update(s3)
        s4 = workflow.delivery_node(state)
        state.update(s4)

        tenant_results = state["tenant_results"]
        assert "tenant_1_uuid" in tenant_results
        assert "tenant_2_uuid" in tenant_results

        # Tenant 1 Verification:
        t1 = tenant_results["tenant_1_uuid"]
        t1_comps = [f["company"] for f in t1["findings"]]
        assert "Vercel" in t1_comps
        assert "Netlify" in t1_comps
        assert "Stripe" not in t1_comps  # Tenant 1 does not track Stripe

        # Tenant 2 Verification:
        t2 = tenant_results["tenant_2_uuid"]
        t2_comps = [f["company"] for f in t2["findings"]]
        assert "Stripe" in t2_comps
        assert "Netlify" in t2_comps
        assert "Vercel" not in t2_comps  # Tenant 2 does not track Vercel

        # Delivery graceful skip for Tenant 2:
        assert t2["delivery_status"]["status"] == "skipped"
        assert "SLACK_WEBHOOK_URL not configured" in t2["delivery_status"]["reason"]
