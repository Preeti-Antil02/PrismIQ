"""
Stage 2 Regression Tests: Multi-Company Pipeline, Overview, Briefs, Events, Signals, and Trends.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from src import analysis_agent, report_agent, storage
from src.api import app
from src.overview_service import get_intelligence_detail, get_overview_intelligence
from src.trends import service as trends_service


def _auth_headers(tenant_id: str, email: str = "tester@prismiq.dev") -> dict:
    token = jwt.encode(
        {
            "sub": tenant_id,
            "email": email,
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        },
        "stage2-test-secret-key-at-least-32-bytes!",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}


@pytest.fixture
def client():
    return TestClient(app)


def test_trends_mock_cursor_and_dynamic_synthesis(client, tmp_path, monkeypatch):
    """
    Regression: MockCursor returns ('00000000-...',) on fetchone(); /api/trends must
    fall through cleanly to local clusters OR dynamically synthesize clusters from
    the tenant's own events when trends_clusters.json has zero overlap.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    # 1. Existing demo tenant (Meesho) has 0 overlap in static trends_clusters.json -> must synthesize from Meesho events
    meesho_tid = "8553449a-c998-4727-be01-9aeb724038cb"
    res = client.get(f"/api/trends?limit=20&tenant_id={meesho_tid}", headers=_auth_headers(meesho_tid))
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["total_count"], int)
    assert data["total_count"] > 0
    assert len(data["trends"]) > 0
    first_cluster_id = data["trends"][0]["cluster_id"]

    # Trend detail must resolve for dynamically synthesized cluster
    detail_res = client.get(f"/api/trends/{first_cluster_id}?tenant_id={meesho_tid}", headers=_auth_headers(meesho_tid))
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["cluster_id"] == first_cluster_id
    assert len(detail["timeline"]) > 0

    # 2. Brand-new custom tenant with its own swept events
    custom_tid = "11111111-2222-4333-8444-555555555555"
    now_iso = datetime.now(timezone.utc).isoformat()
    (tmp_path / f"tracked_companies_{custom_tid}.json").write_text(
        json.dumps([
            {"company_name": "Linear", "is_target": True, "status": "active"},
            {"company_name": "Jira", "is_target": False, "status": "active"},
            {"company_name": "Asana", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"events_{custom_tid}.json").write_text(
        json.dumps([
            {
                "event_id": "evt_lin_1",
                "company_name": "Jira",
                "title": "Jira launches AI sprint planning pricing tier",
                "event_summary": "Atlassian adds AI sprint pricing.",
                "corroboration_count": 2,
                "contributing_sources": ["news", "pricing"],
                "published_at": now_iso,
                "url": "https://example.com/jira-ai",
                "fact_confidence": "High",
            },
            {
                "event_id": "evt_lin_2",
                "company_name": "Asana",
                "title": "Asana introduces enterprise workflow pricing bundle",
                "event_summary": "Asana updates commercial pricing.",
                "corroboration_count": 2,
                "contributing_sources": ["news"],
                "published_at": now_iso,
                "url": "https://example.com/asana-pricing",
                "fact_confidence": "High",
            },
        ]),
        encoding="utf-8",
    )
    c_res = client.get(f"/api/trends?limit=20&tenant_id={custom_tid}", headers=_auth_headers(custom_tid))
    assert c_res.status_code == 200
    c_data = c_res.json()
    assert c_data["total_count"] >= 1
    involved = {comp for t in c_data["trends"] for comp in t["companies_involved"]}
    assert involved <= {"Linear", "Jira", "Asana"}


def test_overview_time_range_filtering_and_domain_agnostic_copy(tmp_path, monkeypatch):
    """
    Verify Overview properly parses 30d / 90d / 6m ranges, checks Batch 2 actions,
    and never outputs Meesho e-commerce copy for unrelated companies.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    custom_tid = "22222222-3333-4444-8555-666666666666"
    now = datetime.now(timezone.utc)
    recent_iso = (now - timedelta(days=5)).isoformat()
    old_iso = (now - timedelta(days=60)).isoformat()

    (tmp_path / f"tracked_companies_{custom_tid}.json").write_text(
        json.dumps([
            {"company_name": "Figma", "is_target": True, "status": "active"},
            {"company_name": "Framer", "is_target": False, "status": "active"},
            {"company_name": "Sketch", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"events_{custom_tid}.json").write_text(
        json.dumps([
            {
                "event_id": "evt_fig_recent",
                "company_name": "Framer",
                "title": "Framer launches design-to-code AI site builder",
                "event_summary": "Framer expands web publishing.",
                "corroboration_count": 3,
                "contributing_sources": ["news"],
                "published_at": recent_iso,
                "url": "https://framer.com/news",
                "fact_confidence": "High",
            },
            {
                "event_id": "evt_fig_old",
                "company_name": "Framer",
                "title": "Framer adds enterprise CMS localization",
                "event_summary": "Older Framer update.",
                "corroboration_count": 2,
                "contributing_sources": ["news"],
                "published_at": old_iso,
                "url": "https://framer.com/cms",
                "fact_confidence": "Medium",
            },
        ]),
        encoding="utf-8",
    )

    ov30 = get_overview_intelligence("Figma", time_range="30d", tenant_id=custom_tid)
    ov90 = get_overview_intelligence("Figma", time_range="90d", tenant_id=custom_tid)
    assert ov30["competitive_landscape"]["time_range"] == "Last 30 Days"
    assert ov90["competitive_landscape"]["time_range"] == "Last 90 Days"
    assert ov30["metrics"]["verified_events"]["value"] == 1
    assert ov90["metrics"]["verified_events"]["value"] == 2

    # Ensure zero e-commerce Meesho copy leaks into Pass 4 surveillance fallback for Sketch
    serialized = json.dumps(ov30).lower()
    assert "value retail" not in serialized
    assert "fulfillment efficiency" not in serialized

    # Verify Intelligence Detail resolves real event URL and title for custom tenant
    detail = get_intelligence_detail("evt_fig_recent", target_company="Figma", tenant_id=custom_tid)
    assert detail["competitor_name"] == "Framer"
    assert "design-to-code" in detail["what_happened"]["headline"].lower()
    assert any(s["url"] == "https://framer.com/news" for s in detail["verification_and_confidence"]["sources"])


def test_events_and_signals_include_all_ecosystem_companies(client):
    """
    When target_company is provided WITHOUT a single-company filter, /api/events and /api/signals
    must return events/signals across ALL tracked companies (target + competitors), not only target_company.
    """
    vercel_tid = "c8f13b91-46ef-4682-9975-f85764d8a12e"
    hdr = _auth_headers(vercel_tid, "vercel@prismiq.dev")

    ev_res = client.get(f"/api/events?limit=200&tenant_id={vercel_tid}&target_company=Vercel", headers=hdr)
    assert ev_res.status_code == 200
    ev_data = ev_res.json()
    assert ev_data["count"] > 34  # Previously dropped Cloudflare/Netlify down to 34
    companies_seen = {e["company_name"] for e in ev_data["events"]}
    assert "Cloudflare" in companies_seen or len(companies_seen) >= 1

    sig_res = client.get(f"/api/signals?limit=200&tenant_id={vercel_tid}&target_company=Vercel", headers=hdr)
    assert sig_res.status_code == 200
    assert sig_res.json()["count"] > 34


def test_flat_file_persistence_fallback_when_db_unavailable(tmp_path, monkeypatch):
    """
    When live DB write is blocked/unavailable (non-dry-run local dev), save_signals,
    save_events, save_findings, and save_brief must still write tenant-scoped flat files.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setattr(storage, "is_dry_run", lambda: False)

    def _raise_guard(*args, **kwargs):
        raise PermissionError("CRITICAL SECURITY GUARD: Simulated local dev without DB write creds")

    monkeypatch.setattr(storage, "get_db_cursor", _raise_guard)
    tid = "33333333-4444-4555-8666-777777777777"

    sig_path = storage.save_signals(
        [{"company": "Stripe", "source": "news", "title": "Stripe launches Tax v2", "url": "https://stripe.com/tax", "published_at": "2026-11-20T00:00:00Z"}],
        tenant_id=tid,
    )
    assert sig_path.exists()

    ev_path = storage.save_events(
        [{"event_id": "evt_stripe_1", "company": "Stripe", "title": "Stripe launches Tax v2", "event_summary": "Tax v2", "corroboration_count": 1, "contributing_sources": ["news"], "published_at": "2026-11-20T00:00:00Z", "url": "https://stripe.com/tax", "fact_confidence": "High"}],
        tenant_id=tid,
    )
    assert ev_path.exists()

    storage.save_findings(
        [{"event_id": "evt_stripe_1", "company": "Stripe", "why_it_matters": "Expands automated VAT.", "confidence": "High", "tier": "must_know", "decision_score": 4.0}],
        tenant_id=tid,
    )
    assert (tmp_path / f"findings_{tid}.json").exists()
    enriched_events = json.loads((tmp_path / f"events_{tid}.json").read_text(encoding="utf-8"))
    assert enriched_events[0]["why_it_matters"] == "Expands automated VAT."
    assert enriched_events[0]["tier"] == "must_know"

    brief_path = storage.save_brief("# PrismIQ Competitive Intelligence Brief\n\nStripe update.", tenant_id=tid)
    assert brief_path.exists()
    assert (tmp_path / f"brief_{tid}.md").exists()


def test_sequences_and_correlations_never_leak_meesho_to_custom_tenant(tmp_path, monkeypatch):
    """
    Custom/unconfigured tenants must return [] for sequences & signal correlations,
    never inheriting Meesho (8553449a-...) or all-zeroes baseline records.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    custom_tid = "44444444-5555-4666-8777-888888888888"
    assert storage.get_competitive_sequences(tenant_id=custom_tid) == []
    assert storage.get_signal_correlations(tenant_id=custom_tid) == []


def test_brief_sanitizes_rate_limits_and_auto_synthesizes_per_tenant(client, tmp_path, monkeypatch):
    """
    Verify report_agent never emits 'Analysis unavailable due to rate limits' and
    /briefs/latest auto-synthesizes an isolated brief from tenant events without cross-tenant contamination.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    custom_tid = "55555555-6666-4777-8888-999999999999"
    (tmp_path / f"tracked_companies_{custom_tid}.json").write_text(
        json.dumps([
            {"company_name": "Supabase", "is_target": True, "status": "active"},
            {"company_name": "PlanetScale", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"events_{custom_tid}.json").write_text(
        json.dumps([
            {
                "event_id": "evt_sup_1",
                "company_name": "PlanetScale",
                "title": "PlanetScale launches Vitess serverless Postgres pricing",
                "event_summary": "New serverless tier for Postgres.",
                "why_it_matters": "Analysis unavailable due to rate limits.",
                "corroboration_count": 3,
                "contributing_sources": ["news", "pricing"],
                "published_at": datetime.now(timezone.utc).isoformat(),
                "url": "https://planetscale.com/blog/postgres",
                "fact_confidence": "High",
            }
        ]),
        encoding="utf-8",
    )

    res = client.get(f"/briefs/latest?tenant_id={custom_tid}", headers=_auth_headers(custom_tid))
    assert res.status_code == 200
    content = res.json()["content"]
    assert "PlanetScale" in content
    assert "rate limit" not in content.lower()
    assert "analysis unavailable" not in content.lower()
    assert "meesho" not in content.lower()


def test_vercel_and_openai_next_best_actions_never_leak_meesho_or_azure():
    """
    Vercel (c8f13b91-...) must get Vercel/Cloudflare/Netlify actions (never Meesho RTO/NDR copy)
    and OpenAI (6a4703ac-...) must get OpenAI/Anthropic/DeepMind actions (never Azure/AWS Microsoft copy).
    """
    from src import batch2_storage
    from src.batch2_seed_data import seed_batch2_intelligence

    vercel_tid = "c8f13b91-46ef-4682-9975-f85764d8a12e"
    openai_tid = "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f"
    try:
        batch2_storage.clear_tenant_cache(vercel_tid)
        batch2_storage.clear_tenant_cache(openai_tid)

        seed_batch2_intelligence(vercel_tid, "Vercel")
        vercel_actions = batch2_storage.list_next_best_actions(vercel_tid, limit=10)
        assert len(vercel_actions) >= 4
        v_blob = json.dumps(vercel_actions).lower()
        assert "rto" not in v_blob and "non-delivery report" not in v_blob and "meesho" not in v_blob
        assert "cloudflare" in v_blob or "edge" in v_blob

        seed_batch2_intelligence(openai_tid, "OpenAI")
        openai_actions = batch2_storage.list_next_best_actions(openai_tid, limit=10)
        assert len(openai_actions) >= 4
        o_blob = json.dumps(openai_actions).lower()
        assert "azure" not in o_blob and "expressroute" not in o_blob and "aws bedrock" not in o_blob
        assert "anthropic" in o_blob or "coding agent" in o_blob
    finally:
        batch2_storage.clear_tenant_cache(vercel_tid)
        batch2_storage.clear_tenant_cache(openai_tid)


def test_custom_tenant_correlations_empty_pre_sweep_and_grounded_post_sweep(tmp_path, monkeypatch):
    """
    A newly onboarded workspace (Linear + ClickUp) with zero real swept signals/events
    must return [] from get_signal_correlations (no synthetic 'Senior Staff Platform Architect' pre-sweep).
    Once real swept events/signals exist, correlations synthesize exclusively from those real records.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    custom_tid = "66666666-7777-4888-8999-aaaaaaaaaaaa"
    (tmp_path / f"tracked_companies_{custom_tid}.json").write_text(
        json.dumps([
            {"company_name": "Linear", "is_target": True, "status": "active"},
            {"company_name": "ClickUp", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    # Pre-sweep in live mode: even if a synthetic file existed on disk, zero swept signals -> must return []
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)
    (tmp_path / f"signal_correlations_{custom_tid}.json").write_text(
        json.dumps([{"id": "corr_fake", "company_name": "ClickUp", "pattern_name": "ClickUp: Senior Staff Platform Architect Recruited", "signals_cluster": []}]),
        encoding="utf-8",
    )
    assert storage.get_signal_correlations(tenant_id=custom_tid) == []

    # Post-sweep: real ClickUp events land
    now_iso = datetime.now(timezone.utc).isoformat()
    (tmp_path / f"events_{custom_tid}.json").write_text(
        json.dumps([
            {
                "event_id": "evt_clk_1",
                "company_name": "ClickUp",
                "title": "ClickUp Brain 2.0 Autonomous Project Agents",
                "event_summary": "ClickUp launched autonomous workflow agents.",
                "contributing_sources": ["news"],
                "published_at": now_iso,
                "url": "https://clickup.com/blog/brain-agents",
                "fact_confidence": "High",
            },
            {
                "event_id": "evt_clk_2",
                "company_name": "ClickUp",
                "title": "ClickUp Enterprise Pricing Tier Update",
                "event_summary": "Updated enterprise seat packaging.",
                "contributing_sources": ["pricing"],
                "published_at": now_iso,
                "url": "https://clickup.com/pricing",
                "fact_confidence": "High",
            },
        ]),
        encoding="utf-8",
    )
    corrs = storage.get_signal_correlations(tenant_id=custom_tid)
    assert len(corrs) == 1
    assert corrs[0]["company_name"] == "ClickUp"
    titles = [s["title"] for s in corrs[0]["signals_cluster"]]
    assert "ClickUp Brain 2.0 Autonomous Project Agents" in titles
    assert all("Senior Staff Platform Architect Recruited" not in t for t in titles)


def test_meesho_correlations_filter_out_rogue_cross_tenant_companies(tmp_path, monkeypatch):
    """Even if a stale disk file has Yoodli/EveoAI items, Meesho only returns its tracked companies."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    meesho_tid = "8553449a-c998-4727-be01-9aeb724038cb"
    (tmp_path / f"tracked_companies_{meesho_tid}.json").write_text(
        json.dumps([
            {"company_name": "Meesho", "is_target": True, "status": "active"},
            {"company_name": "Flipkart", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"signal_correlations_{meesho_tid}.json").write_text(
        json.dumps([
            {"id": "corr_yoodli", "company_name": "Yoodli", "pattern_name": "Yoodli EveoAI Leak", "correlation_category": "AI Product Launch", "signals_cluster": []},
            {"id": "corr_flipkart", "company_name": "Flipkart", "pattern_name": "Flipkart Minutes Rollout", "correlation_category": "Product Pivot", "signals_cluster": []},
        ]),
        encoding="utf-8",
    )
    corrs = storage.get_signal_correlations(tenant_id=meesho_tid)
    assert [c["company_name"] for c in corrs] == ["Flipkart"]


def test_latest_brief_refreshes_when_events_file_is_newer(client, tmp_path, monkeypatch):
    """If post-sweep events land after cached brief_{tid}.md, /briefs/latest refreshes automatically."""
    import time

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    tid = "77777777-8888-4999-8aaa-bbbbbbbbbbbb"
    (tmp_path / f"tracked_companies_{tid}.json").write_text(
        json.dumps([
            {"company_name": "Linear", "is_target": True, "status": "active"},
            {"company_name": "ClickUp", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    brief_path = tmp_path / f"brief_{tid}.md"
    brief_path.write_text("# Old Snapshot\n\n" + ("Initial Linear only snapshot. " * 30), encoding="utf-8")
    old_mtime = time.time() - 60.0
    os.utime(brief_path, (old_mtime, old_mtime))

    events_path = tmp_path / f"events_{tid}.json"
    events_path.write_text(
        json.dumps([
            {
                "event_id": "evt_cu_fresh",
                "company_name": "ClickUp",
                "title": "ClickUp launches SyncUp native video huddles",
                "event_summary": "ClickUp expanded collaboration stack.",
                "contributing_sources": ["news"],
                "published_at": datetime.now(timezone.utc).isoformat(),
                "url": "https://clickup.com/syncup",
                "fact_confidence": "High",
            }
        ]),
        encoding="utf-8",
    )

    res = client.get(f"/briefs/latest?tenant_id={tid}", headers=_auth_headers(tid))
    assert res.status_code == 200
    assert "ClickUp" in res.json()["content"]


def test_onboarding_confirm_persists_five_competitors_cleanly(client, tmp_path, monkeypatch):
    """Confirming 5 competitors via POST /api/workspace/confirm persists all tracked entries."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    tid = "88888888-9999-4aaa-8bbb-cccccccccccc"
    comps = ["Atlassian Jira", "ClickUp", "Asana", "Monday.com", "Shortcut"]
    res = client.post(
        "/api/workspace/confirm",
        json={"target_company": "Linear", "confirmed_competitors": comps},
        headers=_auth_headers(tid),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "confirmed"
    assert len(data["tracked_companies"]) == 6


def test_overview_endpoint_resolves_x_tenant_id_header_and_custom_company(client, tmp_path, monkeypatch):
    """GET /api/overview must honor X-Tenant-ID header and target_company alias without falling back to Flipkart."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    tid = "99999999-aaaa-4bbb-8ccc-dddddddddddd"
    (tmp_path / f"tracked_companies_{tid}.json").write_text(
        json.dumps([
            {"company_name": "openai", "is_target": True, "status": "active"},
            {"company_name": "Anthropic", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"events_{tid}.json").write_text(
        json.dumps([
            {
                "event_id": "evt_ant_header_test",
                "company_name": "Anthropic",
                "title": "Anthropic launches enterprise prompt caching",
                "event_summary": "Reduced costs by 90%.",
                "contributing_sources": ["news"],
                "published_at": datetime.now(timezone.utc).isoformat(),
                "url": "https://anthropic.com/news",
                "fact_confidence": "High",
                "tier": "must_know",
            }
        ]),
        encoding="utf-8",
    )
    res = client.get(
        "/api/overview?target_company=openai&range=6m",
        headers={"X-Tenant-ID": tid},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["target_company"] == "openai"
    assert data["metrics"]["verified_events"]["value"] == 1
    assert data["metrics"]["high_priority_developments"]["value"] == 1
    assert len(data["next_best_actions"]) >= 1
