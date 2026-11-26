"""
End-to-End REST API integration tests for PrismIQ Batch 2:
- Document Ingestion (/api/ingest/direct-text, /api/ingest/documents)
- Customer Voice Intelligence (/api/customer-voice/ingest, feedback, themes, competitive-comparison)
- Next Best Action Engine (/api/next-best-actions/generate, list, patch status, audits)
- Tenant Isolation & 401 Unauthorized Rejection
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import batch2_storage, battlecard_storage

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()
    yield
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


def _get_auth_headers(tenant_id: str, email: str = "analyst@prismiq.dev") -> dict:
    token = _create_jwt_token(tenant_id, email)
    return {"Authorization": f"Bearer {token}"}


def test_api_ingest_direct_text_and_list_documents():
    tenant_id = str(uuid.uuid4())
    headers = _get_auth_headers(tenant_id)

    payload = {
        "title": "Q3 Enterprise Prospect Notes",
        "text": "Prospect currently evaluating CompetitorA. Highlighted urgent need for SOC2 compliance and native Slack notifications.",
        "source_type": "notes",
        "company_name": "CompetitorA",
    }

    res = client.post("/api/ingest/direct-text", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert data["document"]["title"] == "Q3 Enterprise Prospect Notes"
    assert data["document"]["file_format"] in ("direct_input", "text")

    # List documents
    res_list = client.get("/api/ingest/documents", headers=headers)
    assert res_list.status_code == 200
    docs = res_list.json()["documents"]
    assert len(docs) == 1
    assert docs[0]["id"] == data["document"]["id"]


def test_api_customer_voice_endpoints():
    tenant_id = str(uuid.uuid4())
    headers = _get_auth_headers(tenant_id)

    # 1. Ingest reviews
    payload = {
        "default_company": "CompetitorA",
        "records": [
            {
                "review": "Their customer support is completely unhelpful and takes 5 days to respond.",
                "company_name": "CompetitorA",
            },
            {
                "review": "Renewal pricing jumped 40% with zero warning.",
                "company_name": "CompetitorA",
            },
            {
                "review": "We love the intuitive dashboard and fast onboarding!",
                "company_name": "OurTargetCompany",
            },
        ],
    }

    res = client.post("/api/customer-voice/ingest", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert data["saved_records_count"] == 3

    # 2. Get feedback records
    res_feed = client.get("/api/customer-voice/feedback?company_name=CompetitorA", headers=headers)
    assert res_feed.status_code == 200
    feed_data = res_feed.json()
    assert feed_data["count"] == 2

    # 3. Get thematic clusters
    res_themes = client.get("/api/customer-voice/themes?company_name=CompetitorA", headers=headers)
    assert res_themes.status_code == 200
    themes = res_themes.json()["themes"]
    assert len(themes) >= 1

    # 4. Competitive opportunity comparison
    res_comp = client.get(
        "/api/customer-voice/competitive-comparison?target_company=OurTargetCompany&competitor_name=CompetitorA",
        headers=headers,
    )
    assert res_comp.status_code == 200
    comp_data = res_comp.json()
    assert comp_data["competitor_name"] == "CompetitorA"
    assert comp_data["target_company"] == "OurTargetCompany"


def test_api_next_best_actions_lifecycle():
    tenant_id = str(uuid.uuid4())
    headers = _get_auth_headers(tenant_id)

    # Setup underlying data: customer feedback + switching friction
    batch2_storage.save_feedback_records([
        {
            "company_name": "CompetitorA",
            "category": "product_complaint",
            "aspect": "User Interface & UX",
            "raw_quote": "The dashboard is cluttered and unintuitive.",
        },
        {
            "company_name": "CompetitorA",
            "category": "reason_for_switching",
            "aspect": "Pricing",
            "raw_quote": "Unexpected renewal fee increases drove teams to evaluate alternatives.",
        },
    ], tenant_id)

    # Generate actions
    res_gen = client.post("/api/next-best-actions/generate", json={"competitor_name": "CompetitorA"}, headers=headers)
    assert res_gen.status_code == 201
    gen_data = res_gen.json()
    assert gen_data["status"] == "success"
    actions = gen_data["actions"]
    assert len(actions) >= 1

    action_id = actions[0]["id"]
    assert actions[0]["review_status"] == "pending"

    # Patch status -> accepted
    res_accept = client.patch(
        f"/api/next-best-actions/{action_id}/status",
        json={"status": "accepted", "notes": "Approved for Q4 enablement sprint", "changed_by": "sales_vp@prismiq.dev"},
        headers=headers,
    )
    assert res_accept.status_code == 200
    assert res_accept.json()["action"]["review_status"] == "accepted"

    # Patch status -> completed
    res_complete = client.patch(
        f"/api/next-best-actions/{action_id}/status",
        json={"status": "completed", "notes": "Completed and shared with sales team", "changed_by": "sales_lead@prismiq.dev"},
        headers=headers,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["action"]["review_status"] == "completed"

    # Get audits
    res_audits = client.get(f"/api/next-best-actions/{action_id}/audits", headers=headers)
    assert res_audits.status_code == 200
    audits = res_audits.json()["audits"]
    assert len(audits) == 2
    assert audits[0]["new_status"] == "accepted"
    assert audits[1]["new_status"] == "completed"


def test_api_security_unauthorized_rejection():
    # Requests without Authorization header must be rejected with 401
    res_no_auth_1 = client.post("/api/ingest/direct-text", json={"text": "Hello world test sample transcript"})
    assert res_no_auth_1.status_code == 401

    res_no_auth_2 = client.get("/api/customer-voice/feedback")
    assert res_no_auth_2.status_code == 401

    res_no_auth_3 = client.get("/api/next-best-actions")
    assert res_no_auth_3.status_code == 401

    res_no_auth_4 = client.get("/api/actions")
    assert res_no_auth_4.status_code == 401


def test_api_tenant_isolation():
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())

    headers_a = _get_auth_headers(tenant_a)
    headers_b = _get_auth_headers(tenant_b)

    # Ingest document into Tenant A
    doc_payload = {
        "title": "Tenant A Secret Document",
        "text": "Proprietary conversation analysis transcript for Tenant A only.",
        "source_type": "notes",
    }
    res_a = client.post("/api/ingest/direct-text", json=doc_payload, headers=headers_a)
    assert res_a.status_code == 201
    doc_id = res_a.json()["document"]["id"]

    # Verify Tenant B cannot see Tenant A's documents
    res_b_docs = client.get("/api/ingest/documents", headers=headers_b)
    assert res_b_docs.status_code == 200
    tenant_b_docs = res_b_docs.json()["documents"]
    assert not any(d["id"] == doc_id for d in tenant_b_docs)
