"""
End-to-End REST API integration tests for PrismIQ Batch 2:
- Document Ingestion (/api/ingest/direct-text, /api/ingest/documents)
- Customer Voice Intelligence (/api/customer-voice/ingest, feedback, themes, competitive-comparison)
- Win/Loss Intelligence (/api/win-loss/deals, analytics with sample-size safeguards)
- Sales Call Intelligence (/api/sales-calls/upload, /api/sales-calls/{id})
- Deal Intelligence Dossiers (/api/deals/intelligence, /api/deals/dossiers)
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
        "source_type": "sales_call_transcript",
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


def test_api_win_loss_analytics_and_sample_size_safeguard():
    tenant_id = str(uuid.uuid4())
    headers = _get_auth_headers(tenant_id)

    # Post 2 deals (n=2 < 3)
    deals_n2 = [
        {
            "deal_name": "Deal 1",
            "primary_competitor": "CompetitorA",
            "outcome": "won",
            "deal_value": 50000,
            "decision_factors": ["Better pricing", "Superior support"],
        },
        {
            "deal_name": "Deal 2",
            "primary_competitor": "CompetitorA",
            "outcome": "lost",
            "deal_value": 75000,
            "decision_factors": ["Missing feature X"],
        },
    ]

    for d in deals_n2:
        res = client.post("/api/win-loss/deals", json=d, headers=headers)
        assert res.status_code == 201

    # Check analytics: sample size must be flagged as insufficient (n < 3)
    res_analytics = client.get("/api/win-loss/analytics?competitor_name=CompetitorA", headers=headers)
    assert res_analytics.status_code == 200
    analytics = res_analytics.json()["analytics"]
    assert analytics["sample_size"] == 2
    assert analytics["has_sufficient_data"] is False
    assert "insufficient" in analytics["sample_size_warning"].lower()

    # Add 2 more deals to reach n=4 >= 3
    more_deals = [
        {
            "deal_name": "Deal 3",
            "primary_competitor": "CompetitorA",
            "outcome": "won",
            "deal_value": 100000,
            "decision_factors": ["Better pricing"],
        },
        {
            "deal_name": "Deal 4",
            "primary_competitor": "CompetitorA",
            "outcome": "won",
            "deal_value": 85000,
            "decision_factors": ["Superior support"],
        },
    ]
    for d in more_deals:
        client.post("/api/win-loss/deals", json=d, headers=headers)

    # Check analytics now: n=4, sufficient data
    res_analytics4 = client.get("/api/win-loss/analytics?competitor_name=CompetitorA", headers=headers)
    assert res_analytics4.status_code == 200
    analytics4 = res_analytics4.json()["analytics"]
    assert analytics4["sample_size"] == 4
    assert analytics4["has_sufficient_data"] is True
    assert analytics4["won_deals"] == 3
    assert analytics4["lost_deals"] == 1
    assert analytics4["win_rate_percent"] == 75.0


def test_api_sales_call_transcript_flow():
    tenant_id = str(uuid.uuid4())
    headers = _get_auth_headers(tenant_id)

    payload = {
        "call_title": "Enterprise Evaluation Call",
        "transcript_text": """
Rep (01:00): Welcome everyone. What are your key priorities?
Prospect (01:30): We are currently evaluating CompetitorA as well.
Prospect (02:15): One major concern is your pricing seems 20% higher than CompetitorA.
Prospect (03:00): If you can include premium SLA, we are ready to sign.
""",
        "known_competitors": ["CompetitorA"],
    }

    res = client.post("/api/sales-calls/upload", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    call_id = data["call"]["id"]
    assert data["items_count"] >= 3

    # Fetch call detail
    res_call = client.get(f"/api/sales-calls/{call_id}", headers=headers)
    assert res_call.status_code == 200
    detail = res_call.json()
    assert detail["call"]["id"] == call_id
    assert len(detail["intelligence_items"]) >= 3


def test_api_deal_intelligence_dossier():
    tenant_id = str(uuid.uuid4())
    headers = _get_auth_headers(tenant_id)

    payload = {
        "deal_name": "Acme Global Q4 Expansion",
        "competitors_involved": ["CompetitorA"],
        "customer_segment": "enterprise",
        "deal_notes": "Client evaluating CompetitorA renewal discount. Worried about our deployment timeframe.",
        "deal_value": 250000.0,
    }

    res = client.post("/api/deals/intelligence", json=payload, headers=headers)
    assert res.status_code == 201
    dossier = res.json()["dossier"]
    assert dossier["deal_name"] == "Acme Global Q4 Expansion"
    assert "CompetitorA" in dossier["competitors_involved"]
    assert dossier["threat_level"] in ("Medium", "High", "Critical")

    # List dossiers
    res_list = client.get("/api/deals/dossiers", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()["dossiers"]) == 1


def test_api_next_best_actions_lifecycle():
    tenant_id = str(uuid.uuid4())
    headers = _get_auth_headers(tenant_id)

    # Setup underlying data: feedback + lost deal
    batch2_storage.save_feedback_records([
        {
            "company_name": "CompetitorA",
            "category": "product_complaint",
            "aspect": "User Interface & UX",
            "raw_quote": "The dashboard is cluttered and unintuitive.",
        }
    ], tenant_id)

    batch2_storage.save_win_loss_deal({
        "deal_name": "Lost Deal Alpha",
        "primary_competitor": "CompetitorA",
        "outcome": "lost",
        "deal_value": 60000,
        "notes": "Lost due to competitor price slash",
    }, tenant_id)

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

    res_no_auth_3 = client.get("/api/win-loss/analytics")
    assert res_no_auth_3.status_code == 401

    res_no_auth_4 = client.get("/api/deals/dossiers")
    assert res_no_auth_4.status_code == 401

    res_no_auth_5 = client.get("/api/next-best-actions")
    assert res_no_auth_5.status_code == 401


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
