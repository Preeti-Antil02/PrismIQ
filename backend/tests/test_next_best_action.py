"""
Unit and integration tests for PrismIQ Next Best Action Engine (/api/next-best-actions & /api/actions).
Verifies multi-persona recommendation generation (Sales, Product, Marketing, Leadership, Engineering),
deduplication, audit logging, tenant isolation, and status lifecycles.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import batch2_storage
from src import battlecard_storage
from src.next_best_action_engine import NextBestActionEngine

client = TestClient(app)

TENANT_ID = "22222222-3333-4444-5555-666666666666"
TENANT_B = "33333333-4444-5555-6666-777777777777"


def _get_auth_headers(tenant_id: str, email: str = "lead@prismiq.dev") -> dict:
    token = _create_jwt_token(tenant_id, email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()
    yield
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


def test_generate_actions_for_all_teams():
    # Setup Customer Voice feedback across complaints, pricing, and switching reasons
    feedback_rows = [
        {"company_name": "CompetitorZ", "category": "pricing_complaint", "aspect": "Pricing & Billing", "raw_quote": "Competitor pricing jumped 40% upon renewal."},
        {"company_name": "CompetitorZ", "category": "pricing_complaint", "aspect": "Pricing & Billing", "raw_quote": "Renewal fee hike is completely unreasonable."},
        {"company_name": "CompetitorZ", "category": "pricing_complaint", "aspect": "Pricing & Billing", "raw_quote": "Hidden charges in their enterprise tier."},
        {"company_name": "CompetitorZ", "category": "product_complaint", "aspect": "Integrations & API", "raw_quote": "Missing Salesforce and HubSpot native sync and SAML SSO."},
        {"company_name": "CompetitorZ", "category": "reason_for_switching", "aspect": "Onboarding", "raw_quote": "Prospect switched citing slow onboarding and lack of HubSpot integration."},
    ]
    batch2_storage.save_feedback_records(feedback_rows, TENANT_ID)

    # Ingest themes
    batch2_storage.save_feedback_themes([
        {
            "company_name": "CompetitorZ",
            "theme_title": "Pricing & Billing - Pricing Complaint",
            "category": "pricing_complaint",
            "occurrence_count": 3,
            "sample_size": 3,
            "representative_quotes": [{"quote": "Renewal fee hike is completely unreasonable."}],
            "is_competitive_opportunity": True,
            "confidence": "High",
        },
        {
            "company_name": "CompetitorZ",
            "theme_title": "Integrations & API - Product Complaint",
            "category": "product_complaint",
            "occurrence_count": 2,
            "sample_size": 2,
            "representative_quotes": [{"quote": "Missing Salesforce native sync."}],
            "is_competitive_opportunity": False,
            "confidence": "Medium",
        },
    ], TENANT_ID)

    engine = NextBestActionEngine(TENANT_ID)
    actions = engine.generate_actions(competitor_name="CompetitorZ", include_engineering=True)

    assert len(actions) >= 4

    teams = {a["affected_team"] for a in actions}
    # Must generate actions across teams
    assert "sales" in teams
    assert "product" in teams
    assert "marketing" in teams
    assert "leadership" in teams
    assert "engineering" in teams

    # Verify required fields on every single action
    for a in actions:
        assert a["what_happened"]
        assert a["why_it_matters"]
        assert a["affected_team"] in ("sales", "product", "marketing", "leadership", "engineering")
        assert a["recommended_action"]
        assert a["urgency"] in ("Critical", "High", "Medium", "Low")
        assert a["confidence"] in ("High", "Medium", "Low")
        assert isinstance(a["supporting_evidence"], (list, dict))
        assert a["related_competitor"] == "CompetitorZ"
        assert a["review_status"] == "pending"


def test_action_status_transitions_and_audit_trail():
    engine = NextBestActionEngine(TENANT_ID)

    # Create an initial action
    actions = batch2_storage.save_next_best_actions([
        {
            "what_happened": "Competitor increased pricing by 35%",
            "why_it_matters": "Immediate window to convert churn-risk accounts",
            "affected_team": "sales",
            "recommended_action": "Deploy TCO comparison objection script",
            "urgency": "High",
            "confidence": "High",
            "supporting_evidence": [{"source": "G2 Reviews", "n": 5}],
            "related_competitor": "CompetitorZ",
        }
    ], TENANT_ID)

    action_id = actions[0]["id"]
    assert actions[0]["review_status"] == "pending"

    # 1. Accept action
    updated = engine.update_action_status(
        action_id=action_id,
        new_status="accepted",
        changed_by="rep@prism-iq.com",
        reason="Assigned to mid-market SDR team for outreach campaign",
    )
    assert updated["review_status"] == "accepted"

    # 2. Complete action
    updated2 = engine.update_action_status(
        action_id=action_id,
        new_status="completed",
        changed_by="sdr-lead@prism-iq.com",
        reason="Campaign delivered to 45 target accounts",
    )
    assert updated2["review_status"] == "completed"

    # 3. Verify audit history
    audits = batch2_storage.list_action_audits(action_id=action_id, tenant_id=TENANT_ID)
    assert len(audits) == 2

    # Audit 1: pending -> accepted
    assert audits[0]["old_status"] == "pending"
    assert audits[0]["new_status"] == "accepted"
    assert audits[0]["changed_by"] == "rep@prism-iq.com"

    # Audit 2: accepted -> completed
    assert audits[1]["old_status"] == "accepted"
    assert audits[1]["new_status"] == "completed"
    assert audits[1]["changed_by"] == "sdr-lead@prism-iq.com"


def test_dismiss_and_irrelevant_transitions():
    engine = NextBestActionEngine(TENANT_ID)

    actions = batch2_storage.save_next_best_actions([
        {
            "what_happened": "Competitor discontinued legacy product",
            "why_it_matters": "Customers looking for replacements",
            "affected_team": "marketing",
            "recommended_action": "Launch targeted landing page",
            "urgency": "Medium",
            "confidence": "Medium",
            "supporting_evidence": [],
            "related_competitor": "CompetitorZ",
        }
    ], TENANT_ID)

    action_id = actions[0]["id"]

    # Dismiss
    dismissed = engine.update_action_status(
        action_id=action_id,
        new_status="dismissed",
        changed_by="pm@prism-iq.com",
        reason="Not relevant to our target tier",
    )
    assert dismissed["review_status"] == "dismissed"

    # Mark as irrelevant
    irrelevant = engine.update_action_status(
        action_id=action_id,
        new_status="irrelevant",
        changed_by="lead@prism-iq.com",
        reason="Customer base is outside our ICP",
    )
    assert irrelevant["review_status"] == "irrelevant"

    # Invalid status should raise ValueError
    with pytest.raises(ValueError):
        engine.update_action_status(action_id=action_id, new_status="invalid_status")


def test_api_actions_v3_generate_deduplicate_and_lifecycle():
    headers_a = _get_auth_headers(TENANT_ID)
    headers_b = _get_auth_headers(TENANT_B)

    batch2_storage.save_feedback_records([
        {
            "company_name": "CompetitorZ",
            "category": "product_complaint",
            "aspect": "Security & Auth",
            "raw_quote": "We require SAML SSO and SOC2 Type II compliance before procurement approval.",
        }
    ], TENANT_ID)

    # 1. Generate via /api/actions/generate
    res_gen = client.post("/api/actions/generate?competitor_name=CompetitorZ", headers=headers_a)
    assert res_gen.status_code == 201
    actions = res_gen.json()["actions"]
    assert len(actions) >= 1

    # Duplicate generation should not duplicate existing pending actions
    res_gen2 = client.post("/api/actions/generate?competitor_name=CompetitorZ", headers=headers_a)
    assert res_gen2.status_code == 201
    res_all = client.get("/api/actions?related_competitor=CompetitorZ", headers=headers_a)
    assert res_all.status_code == 200
    assert len(res_all.json()["actions"]) == len(actions)

    # 2. Transition In Progress -> Completed sets completed_at and writes history
    action_id = actions[0]["id"]
    res_prog = client.patch(
        f"/api/actions/{action_id}/status",
        json={"status": "In Progress", "owner": "engineer_dave", "due_date": "2026-12-01", "notes": "Assigned sprint ticket"},
        headers=headers_a,
    )
    assert res_prog.status_code == 200
    assert res_prog.json()["action"]["status"] == "In Progress"
    assert res_prog.json()["action"]["owner"] == "engineer_dave"

    res_comp = client.patch(
        f"/api/actions/{action_id}/status",
        json={"status": "Completed", "notes": "Verified in production"},
        headers=headers_a,
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["action"]["status"] == "Completed"
    assert res_comp.json()["action"].get("completed_at") is not None

    res_hist = client.get(f"/api/actions/{action_id}/history", headers=headers_a)
    assert res_hist.status_code == 200
    assert len(res_hist.json()["audits"]) >= 2

    # 3. Tenant isolation and invalid status validation
    assert client.get(f"/api/actions/{action_id}", headers=headers_b).status_code == 404
    assert client.patch(
        f"/api/actions/{action_id}/status",
        json={"status": "invalid_status_xyz"},
        headers=headers_a,
    ).status_code == 400
    assert client.get(f"/api/actions/{uuid.uuid4()}", headers=headers_a).status_code == 404
