"""
End-to-end API integration tests for Evidence-Linked Competitive Battlecards & Drift Detection:
- GET /api/competitors/{id}/battlecard (with 14 frontend component schemas)
- POST /api/competitors/{id}/battlecards/generate
- PATCH /api/battlecards/{id}/blocks/{key}
- POST /api/battlecards/{id}/publish
- GET /api/competitors/{id}/claim-drift
- POST /api/claim-drift/{id}/review
- GET /api/battlecards/{id}/versions
- GET /api/claim-drift (Global drift review workspace)
- Security: 401 on missing auth, tenant-level isolation
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import battlecard_storage, storage

client = TestClient(app)


def test_get_competitor_battlecard_and_frontend_components():
    tenant_id = str(uuid.uuid4())
    token = _create_jwt_token(tenant_id, "analyst@prismiq.dev")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/competitors/Vercel/battlecard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "battlecard" in data
    assert "frontend_components" in data

    card = data["battlecard"]
    assert card["company_name"] == "Vercel"
    assert card["audience"] == "sales"
    assert len(card["blocks"]) == 10

    # Verify all 14 future frontend component schemas are present
    fc = data["frontend_components"]
    expected_components = [
        "BattlecardHeader",
        "SalesView",
        "IntelligenceView",
        "CompetitorSnapshot",
        "PositioningCard",
        "CompetitiveStrengths",
        "ObjectionPlaybook",
        "DiscoveryQuestions",
        "PricingSnapshot",
        "RecentChanges",
        "EvidenceDrawer",
        "FreshnessPanel",
        "DriftReviewPanel",
        "VersionHistory",
    ]
    for comp in expected_components:
        assert comp in fc, f"Missing frontend component schema: {comp}"

    # Verify structure of specific key frontend schemas
    header = fc["BattlecardHeader"]
    assert header["competitor_name"] == "Vercel"
    assert "freshness_score" in header

    sales_view = fc["SalesView"]
    assert "where_we_win" in sales_view
    assert "objection_playbook" in sales_view
    assert "discovery_questions" in sales_view
    assert "pricing_snapshot" in sales_view

    drawer = fc["EvidenceDrawer"]
    assert "evidence_by_claim" in drawer


def test_generate_competitor_battlecard_endpoint():
    tenant_id = str(uuid.uuid4())
    token = _create_jwt_token(tenant_id, "analyst@prismiq.dev")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "audience": "product",
        "segment": "enterprise",
        "force_refresh": True,
    }
    res = client.post("/api/competitors/Netlify/battlecards/generate", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert data["battlecard"]["audience"] == "product"
    assert data["battlecard"]["segment"] == "enterprise"


def test_update_battlecard_block_endpoint():
    tenant_id = str(uuid.uuid4())
    token = _create_jwt_token(tenant_id, "analyst@prismiq.dev")
    headers = {"Authorization": f"Bearer {token}"}

    # First get or generate battlecard
    res = client.get("/api/competitors/Vercel/battlecard", headers=headers)
    card_id = res.json()["battlecard"]["id"]

    # Patch where_they_win block
    patch_payload = {
        "block_title": "Where Vercel Wins (Updated)",
        "content": {"items": [{"statement": "Unmatched Next.js developer velocity."}]},
    }
    patch_res = client.patch(f"/api/battlecards/{card_id}/blocks/where_they_win", json=patch_payload, headers=headers)
    assert patch_res.status_code == 200
    patch_data = patch_res.json()
    assert patch_data["status"] == "success"
    assert patch_data["block"]["block_title"] == "Where Vercel Wins (Updated)"
    assert patch_data["block"]["content"]["items"][0]["statement"] == "Unmatched Next.js developer velocity."


def test_publish_battlecard_and_version_history():
    tenant_id = str(uuid.uuid4())
    token = _create_jwt_token(tenant_id, "analyst@prismiq.dev")
    headers = {"Authorization": f"Bearer {token}"}

    # Generate battlecard
    res = client.get("/api/competitors/Vercel/battlecard", headers=headers)
    card_id = res.json()["battlecard"]["id"]

    # Publish
    pub_payload = {
        "published_by": "lead_strategist",
        "change_summary": "Q4 competitive sign-off",
    }
    pub_res = client.post(f"/api/battlecards/{card_id}/publish", json=pub_payload, headers=headers)
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["status"] == "success"
    assert pub_data["battlecard"]["status"] == "published"
    assert pub_data["revision"]["version"] == 1
    assert pub_data["revision"]["published_by"] == "lead_strategist"

    # Query versions endpoint
    ver_res = client.get(f"/api/battlecards/{card_id}/versions", headers=headers)
    assert ver_res.status_code == 200
    ver_data = ver_res.json()
    assert ver_data["total_versions"] == 1
    assert ver_data["versions"][0]["version"] == 1
    assert ver_data["versions"][0]["change_summary"] == "Q4 competitive sign-off"


def test_claim_drift_review_endpoint():
    tenant_id = str(uuid.uuid4())
    token = _create_jwt_token(tenant_id, "analyst@prismiq.dev")
    headers = {"Authorization": f"Bearer {token}"}

    # Create a claim and drift alert directly in storage
    cid = str(uuid.uuid4())
    claim = {
        "id": cid,
        "company_name": "Vercel",
        "claim_type": "product_capability",
        "subject": "Container Support",
        "statement": "Lacks native background long-running container workers.",
        "status": "active",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    aid = str(uuid.uuid4())
    alert = {
        "id": aid,
        "claim_id": cid,
        "company_name": "Vercel",
        "drift_type": "contradicted",
        "new_evidence_excerpt": "Vercel announces long-running background tasks.",
        "new_evidence_url": "https://vercel.com/blog/background-tasks",
        "suggested_update": {
            "statement": "Vercel now supports background tasks up to 15 minutes.",
            "fact_impact_act": {
                "fact": "Vercel released Background Tasks.",
                "impact": "Expands serverless execution boundary.",
                "act": "Differentiate on dedicated persistent container runtimes.",
            },
        },
        "review_status": "pending",
    }
    battlecard_storage.save_claim_drift_alert(alert, tenant_id)

    # 1. Competitor claim drift endpoint
    drift_res = client.get("/api/competitors/Vercel/claim-drift", headers=headers)
    assert drift_res.status_code == 200
    drift_data = drift_res.json()
    assert len(drift_data["alerts"]) >= 1
    assert any(a["id"] == aid for a in drift_data["alerts"])

    # 2. Global drift review endpoint
    global_res = client.get("/api/claim-drift?company_name=Vercel", headers=headers)
    assert global_res.status_code == 200
    global_data = global_res.json()
    assert len(global_data["alerts"]) >= 1

    # 3. Submit review decision: edit_and_accept
    review_payload = {
        "action": "edit_and_accept",
        "reviewer": "analyst_carter",
        "notes": "Verified duration limits in documentation.",
        "edited_claim": {
            "statement": "Vercel supports Background Tasks capped at 15 minutes (not true persistent containers).",
            "fact_impact_act": {
                "fact": "Background tasks supported up to 15 minutes max.",
                "impact": "Cannot replace continuous daemon workloads.",
                "act": "Highlight persistent daemons, WebSockets, and stateful processing.",
            },
        },
    }
    review_res = client.post(f"/api/claim-drift/{aid}/review", json=review_payload, headers=headers)
    assert review_res.status_code == 200
    review_data = review_res.json()
    assert review_data["status"] == "success"
    assert review_data["alert"]["review_status"] == "edited"
    assert review_data["review_action"]["action"] == "edit_and_accept"

    # Verify claim in storage now has analyst's edited text
    updated_clm = battlecard_storage.get_claim(cid, tenant_id)
    assert "capped at 15 minutes" in updated_clm["statement"]


def test_api_security_unauthorized():
    # Requests without Authorization header must fail closed with 401
    res = client.get("/api/competitors/Vercel/battlecard")
    assert res.status_code == 401

    res = client.get("/api/claim-drift")
    assert res.status_code == 401


def test_api_tenant_isolation():
    tenant_1 = str(uuid.uuid4())
    tenant_2 = str(uuid.uuid4())

    token_1 = _create_jwt_token(tenant_1, "user1@tenant1.com")
    token_2 = _create_jwt_token(tenant_2, "user2@tenant2.com")

    # Tenant 1 generates battlecard
    res_1 = client.get("/api/competitors/Vercel/battlecard", headers={"Authorization": f"Bearer {token_1}"})
    card_id_1 = res_1.json()["battlecard"]["id"]

    # Tenant 2 attempts to patch Tenant 1's battlecard block -> must 404 (not found for Tenant 2)
    patch_res = client.patch(
        f"/api/battlecards/{card_id_1}/blocks/where_they_win",
        json={"content": {"items": []}},
        headers={"Authorization": f"Bearer {token_2}"},
    )
    assert patch_res.status_code == 404
