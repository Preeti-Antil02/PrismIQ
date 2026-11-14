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


def test_meesho_tenant_four_distinct_channels_and_no_placeholders():
    """Verify Point 1: 4 distinct channels and bespoke signals for Meesho competitors."""
    token = _create_jwt_token("8553449a-c998-4727-be01-9aeb724038cb", "analyst@meesho.dev")
    res = client.get("/signals/correlations?tenant_id=8553449a-c998-4727-be01-9aeb724038cb", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    correlations = data["correlations"]
    assert len(correlations) >= 4

    comp_names = {c["company_name"] for c in correlations}
    assert "Flipkart" in comp_names
    assert "Amazon India" in comp_names
    assert "Shopsy" in comp_names
    assert "Ajio" in comp_names

    required_channels = {"github", "careers", "news", "pricing"}

    for corr in correlations:
        # Check no synthetic placeholder titles or descriptions
        assert "Cross-Channel Strategic Acceleration" not in corr["pattern_name"]
        assert "siphoning early-adopter velocity away" not in corr["strategic_implication"]
        assert len(corr["pattern_name"]) > 10
        assert len(corr["strategic_implication"]) > 20
        assert len(corr["recommended_action"]) > 20
        assert corr["pipeline_stage"] == "Actions"
        assert corr["confidence"] >= 90.0

        cluster = corr["signals_cluster"]
        assert len(cluster) == 4

        channels_present = {s.get("channel") for s in cluster}
        assert required_channels.issubset(channels_present), f"Missing channels for {corr['company_name']}: {channels_present}"

        # Verify authentic URLs and excerpts
        for sig in cluster:
            assert sig["url"].startswith("http")
            assert len(sig["excerpt"]) >= 15
            assert sig["weight"] == 0.25
            assert sig["confidence"] >= 90.0


def test_signal_correlation_channel_filtering():
    """Verify Point 4: Channel filtering support (GitHub, Careers, News, Pricing)."""
    token = _create_jwt_token("8553449a-c998-4727-be01-9aeb724038cb", "analyst@meesho.dev")

    for ch in ["github", "careers", "news", "pricing"]:
        res = client.get(
            f"/signals/correlations?channel={ch}&tenant_id=8553449a-c998-4727-be01-9aeb724038cb",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["channel_filter"] == ch
        assert len(data["correlations"]) >= 4
        # Every returned cluster has at least one signal in the channel
        for c in data["correlations"]:
            assert any(s.get("channel") == ch for s in c["signals_cluster"])


def test_signal_correlation_tenant_isolation_and_uuid_validation():
    """Verify Point 4: Strict tenant isolation and UUID validation."""
    token = _create_jwt_token("8553449a-c998-4727-be01-9aeb724038cb", "analyst@meesho.dev")

    # 1. Invalid UUID in query param should return 400
    res_bad = client.get(
        "/signals/correlations?tenant_id=invalid-not-a-uuid",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_bad.status_code == 400
    assert "Invalid tenant ID format" in res_bad.json()["detail"]

    # 2. Invalid UUID in header should return 400
    res_bad_header = client.get(
        "/signals/correlations",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": "hacker-uuid-format"}
    )
    assert res_bad_header.status_code == 400
    assert "Invalid tenant ID format" in res_bad_header.json()["detail"]

    # 3. Valid X-Tenant-ID header is honored
    res_header = client.get(
        "/signals/correlations",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": "8553449a-c998-4727-be01-9aeb724038cb"
        }
    )
    assert res_header.status_code == 200
    assert res_header.json()["tenant_id"] == "8553449a-c998-4727-be01-9aeb724038cb"
