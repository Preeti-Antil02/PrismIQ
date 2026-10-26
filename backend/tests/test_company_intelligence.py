import pytest
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import storage

client = TestClient(app)

def test_company_profile_endpoint():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/companies/Vercel/profile", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Vercel"
    assert "products" in data
    assert "pricing_model" in data
    assert "recent_changes" in data
    assert data["total_changes_count"] >= 4

def test_company_changes_endpoint_and_filters():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/companies/Netlify/changes", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Netlify"
    assert len(data["changes"]) >= 3

    # Check dimension filter
    res_pricing = client.get("/companies/Netlify/changes?dimension=pricing", headers={"Authorization": f"Bearer {token}"})
    assert res_pricing.status_code == 200
    pricing_data = res_pricing.json()
    assert all(c["dimension"] == "pricing" for c in pricing_data["changes"])
    assert any("acquisition-focused" in c["what_changed"] for c in pricing_data["changes"])

def test_company_intelligence_security_unauthorized():
    # Fails closed without Authorization header
    res = client.get("/companies/Vercel/profile")
    assert res.status_code == 401
    assert "Missing Authorization" in res.json().get("detail", "")

    res_ch = client.get("/companies/Vercel/changes")
    assert res_ch.status_code == 401
