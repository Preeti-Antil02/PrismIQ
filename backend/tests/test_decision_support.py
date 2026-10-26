import pytest
import json
from pathlib import Path
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import storage

client = TestClient(app)

@pytest.fixture(autouse=True)
def preserve_decision_support():
    data_dir = storage._get_data_dir()
    ds_file = data_dir / "decision_support.json"
    backup = None
    if ds_file.exists():
        with open(ds_file, "r", encoding="utf-8") as f:
            backup = f.read()
    yield
    if backup is not None:
        with open(ds_file, "w", encoding="utf-8") as f:
            f.write(backup)

def test_get_decision_support_authenticated():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["count"] >= 5

    # Verify 6 core dimensions on Vercel item
    vercel = next((d for d in data["items"] if d["company_name"] == "Vercel"), None)
    assert vercel is not None
    # 1. What happened?
    assert "AI-powered workflow automation" in vercel["what_happened"]
    # 2. Why does it matter?
    assert "Directly overlaps" in vercel["why_it_matters"]
    # 3. Who is affected?
    assert "Product" in vercel["who_is_affected"]
    assert "Sales" in vercel["who_is_affected"]
    # 4. What should we do?
    assert "counter" in vercel["what_should_we_do"].lower() or "battlecards" in vercel["what_should_we_do"].lower() or "roadmap" in vercel["what_should_we_do"].lower()
    # 5. Urgency & calibrated confidence
    assert vercel["urgency"] == "High"
    assert vercel["confidence"] >= 90.0
    # 6. Evidence (3+ independent sources)
    assert len(vercel["evidence_sources"]) >= 4
    for src in vercel["evidence_sources"]:
        assert "source" in src
        assert "title" in src
        assert "url" in src
        assert "http" in src["url"]

def test_get_decision_support_filter_by_company():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support?company=Netlify", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all(d["company_name"].lower() == "netlify" for d in data["items"])
    assert data["count"] >= 1
    item = data["items"][0]
    assert "enterprise" in item["what_happened"].lower() or "billing" in item["what_happened"].lower()

def test_get_decision_support_filter_by_department():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support?department=Sales", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 2
    for item in data["items"]:
        assert any(dept.lower() == "sales" for dept in item["who_is_affected"])

def test_get_decision_support_filter_by_urgency():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support?urgency=High", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 3
    for item in data["items"]:
        assert item["urgency"].lower() == "high"

def test_get_company_decision_support_direct():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support/Amazon", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Amazon"
    assert len(data["items"]) >= 1
    amz = data["items"][0]
    assert "nuclear" in amz["what_happened"].lower() or "datacenter" in amz["what_happened"].lower() or "power" in amz["what_happened"].lower()

def test_create_decision_support_endpoint():
    token = _create_jwt_token("77777777-8888-9999-aaaa-bbbbbbbbbbbb", "exec_vp@prismiq.dev")
    payload = {
        "company_name": "Cloudflare",
        "event_id": "ev_cf_workers_ai_vector",
        "what_happened": "Cloudflare launched Zero-Latency Vectorize indexing alongside Workers AI multi-region inference.",
        "why_it_matters": "Provides sub-10ms similarity search directly inside edge request workers, disrupting standalone vector databases.",
        "who_is_affected": ["Product", "Engineering", "Sales"],
        "what_should_we_do": "Publish latency benchmarks demonstrating our sub-5ms caching tier and reinforce SOC2 enterprise compliance.",
        "urgency": "High",
        "confidence": 93.5,
        "corroboration_sources_count": 3,
        "evidence_sources": [
            {
                "source": "blog.cloudflare.com",
                "title": "Vectorize: High-Performance Vector Database at the Edge",
                "url": "https://blog.cloudflare.com/vectorize-vector-database",
                "excerpt": "Global distributed vector index accessible directly from Cloudflare Workers.",
                "detected_at": "2026-10-18T14:00:00Z"
            },
            {
                "source": "cloudflare.com/changelog",
                "title": "Workers AI General Availability & SLA Upgrade",
                "url": "https://developers.cloudflare.com/changelog",
                "excerpt": "Serverless GPUs in over 150 global data center locations.",
                "detected_at": "2026-10-19T09:30:00Z"
            },
            {
                "source": "LinkedIn Talent Insights",
                "title": "Cloudflare Edge AI Team Expansion",
                "url": "https://www.linkedin.com/company/cloudflare/jobs",
                "excerpt": "Hiring 15 Distributed Systems Engineers for Edge Compute.",
                "detected_at": "2026-10-15T11:00:00Z"
            }
        ]
    }
    res = client.post("/decision-support", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["decision_support_item"]["company_name"] == "Cloudflare"

def test_decision_support_security_unauthenticated():
    # Fail-closed with 401 without Authorization header
    res = client.get("/decision-support")
    assert res.status_code == 401
    assert "Missing Authorization" in res.json().get("detail", "")

    res_co = client.get("/decision-support/Vercel")
    assert res_co.status_code == 401
    assert "Missing Authorization" in res_co.json().get("detail", "")

    res_post = client.post("/decision-support", json={"company_name": "Intruder"})
    assert res_post.status_code == 401
