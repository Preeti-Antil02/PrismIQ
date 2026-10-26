import pytest
import json
from pathlib import Path
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import storage

client = TestClient(app)

@pytest.fixture(autouse=True)
def preserve_signal_correlations():
    data_dir = storage._get_data_dir()
    corr_file = data_dir / "signal_correlations.json"
    backup = None
    if corr_file.exists():
        with open(corr_file, "r", encoding="utf-8") as f:
            backup = f.read()
    yield
    if backup is not None:
        with open(corr_file, "w", encoding="utf-8") as f:
            f.write(backup)

def test_get_signal_correlations_authenticated():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/signals/correlations", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "correlations" in data
    assert data["count"] >= 4

    # Verify Vercel AI Investment Pattern
    vercel = next((c for c in data["correlations"] if c["company_name"] == "Vercel"), None)
    assert vercel is not None
    assert "AI Runtime" in vercel["pattern_name"]
    assert vercel["correlation_category"] == "ai_investment"
    assert vercel["confidence"] >= 90.0
    assert len(vercel["signals_cluster"]) >= 4

def test_get_signal_correlations_filter_by_company():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/signals/correlations?company=Netlify", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all(c["company_name"].lower() == "netlify" for c in data["correlations"])
    assert data["count"] >= 1
    netlify = data["correlations"][0]
    assert "Enterprise Security" in netlify["pattern_name"]

def test_get_signal_correlations_filter_by_category():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/signals/correlations?category=cloud_infrastructure", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all(c["correlation_category"] == "cloud_infrastructure" for c in data["correlations"])
    assert data["count"] >= 2

def test_get_company_signal_correlations_direct():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/signals/correlations/Amazon", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Amazon"
    assert len(data["correlations"]) >= 1
    amz = data["correlations"][0]
    assert "Nuclear" in amz["pattern_name"] or "Power" in amz["pattern_name"]

def test_signal_correlation_nodes_integrity():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/signals/correlations?company=Vercel", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    corr = res.json()["correlations"][0]
    signals = corr["signals_cluster"]
    assert len(signals) == 4

    types = [s["signal_type"] for s in signals]
    assert any("Hiring" in t for t in types)
    assert any("Product" in t for t in types)
    assert any("GitHub" in t for t in types)
    assert any("Conference" in t or "Announcement" in t for t in types)

    assert "Likely acceleration of AI product development" in corr["strategic_implication"]
    assert "Evaluate whether your product roadmap has a competitive gap" in corr["recommended_action"]

def test_create_signal_correlation_endpoint():
    token = _create_jwt_token("55555555-6666-7777-8888-999999999999", "lead_analyst@corp.com")
    payload = {
        "company_name": "Supabase",
        "pattern_name": "Unified Data & AI Embedding Layer",
        "correlation_category": "ai_investment",
        "confidence": 92.8,
        "strategic_implication": "Supabase is consolidating developer vectors with pgvector and automated edge index caching.",
        "recommended_action": "Evaluate native vector database performance and pricing against standard relational extensions.",
        "pipeline_stage": "Actions",
        "signals_cluster": [
            {
                "signal_type": "Hiring",
                "title": "pgvector Core Contributors Hired",
                "source": "Greenhouse",
                "url": "https://supabase.com/careers",
                "excerpt": "Hiring senior database engineers for pgvector indexing acceleration.",
                "detected_at": "2026-10-10T10:00:00Z",
                "weight": 0.5
            },
            {
                "signal_type": "Product Page",
                "title": "Supabase Vector GA Launched",
                "source": "supabase.com/vector",
                "url": "https://supabase.com/vector",
                "excerpt": "Serverless vector toolkit integrated with edge functions and row level security.",
                "detected_at": "2026-10-15T12:00:00Z",
                "weight": 0.5
            }
        ]
    }
    res = client.post("/signals/correlations", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["correlation"]["company_name"] == "Supabase"
    assert "Unified Data & AI" in body["correlation"]["pattern_name"]

def test_signal_correlation_security_unauthenticated():
    # Fails closed with 401 without Authorization header
    res = client.get("/signals/correlations")
    assert res.status_code == 401
    assert "Missing Authorization" in res.json().get("detail", "")

    res_co = client.get("/signals/correlations/Vercel")
    assert res_co.status_code == 401
    assert "Missing Authorization" in res_co.json().get("detail", "")

    res_post = client.post("/signals/correlations", json={"company_name": "Intruder"})
    assert res_post.status_code == 401
