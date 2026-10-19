import sys
import time
from pathlib import Path
import jwt
import pytest
from fastapi.testclient import TestClient

backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src.api import app

client = TestClient(app)

OWNER_TENANT_ID = "c8f13b91-46ef-4682-9975-f85764d8a12e"
OTHER_TENANT_ID = "e4b2a7d1-1234-4567-89ab-cdef01234567"

def make_test_jwt(tenant_id: str = OWNER_TENANT_ID, exp_delta: int = 3600, secret: str = "test_secret") -> str:
    payload = {
        "sub": tenant_id,
        "aud": "authenticated",
        "role": "authenticated",
        "email": f"{tenant_id[:8]}@prismiq.ai",
        "exp": int(time.time()) + exp_delta,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")

@pytest.fixture
def auth_headers():
    token = make_test_jwt(OWNER_TENANT_ID)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def other_tenant_headers():
    token = make_test_jwt(OTHER_TENANT_ID)
    return {"Authorization": f"Bearer {token}"}


def test_get_trends_unauthenticated_returns_401():
    resp = client.get("/trends")
    assert resp.status_code == 401
    assert "Missing Authorization header" in resp.json()["detail"]


def test_get_trends_returns_paginated_list_with_momentum(auth_headers):
    resp = client.get("/trends?limit=10", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "trends" in data
    assert "total_count" in data
    assert "has_more" in data
    assert isinstance(data["trends"], list)
    assert len(data["trends"]) <= 10

    if data["trends"]:
        t = data["trends"][0]
        assert "cluster_id" in t
        assert "cluster_type" in t
        assert "momentum" in t
        assert "label" in t["momentum"]
        assert "vector" in t["momentum"]
        assert isinstance(t["momentum"]["vector"], list)
        assert len(t["momentum"]["vector"]) == 3
        assert "companies_involved" in t
        assert "relevance_score" in t


def test_get_trends_filter_by_company(auth_headers):
    resp = client.get("/trends?company=Cloudflare", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["trends"], list)
    for t in data["trends"]:
        assert any("cloudflare" in c.lower() for c in t["companies_involved"])


def test_get_trends_filter_by_trend_type(auth_headers):
    resp = client.get("/trends?trend_type=cross_company_trend", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["trends"], list)
    for t in data["trends"]:
        assert t["cluster_type"] == "cross_company_trend"


def test_get_trends_pagination_cursor(auth_headers):
    resp1 = client.get("/trends?limit=2", headers=auth_headers)
    assert resp1.status_code == 200
    data1 = resp1.json()
    if data1.get("has_more") and data1.get("next_cursor"):
        cursor = data1["next_cursor"]
        resp2 = client.get(f"/trends?limit=2&cursor={cursor}", headers=auth_headers)
        assert resp2.status_code == 200
        data2 = resp2.json()
        ids1 = [t["cluster_id"] for t in data1["trends"]]
        ids2 = [t["cluster_id"] for t in data2["trends"]]
        # Cursor should return subsequent items with no overlap
        assert not set(ids1).intersection(set(ids2))


def test_get_trend_detail_success_with_timeline_and_absences(auth_headers):
    # Get a valid cluster_id first
    resp = client.get("/trends?limit=1", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    if data["trends"]:
        cid = data["trends"][0]["cluster_id"]
        detail_resp = client.get(f"/trends/{cid}", headers=auth_headers)
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["cluster_id"] == cid
        assert "timeline" in detail
        assert isinstance(detail["timeline"], list)
        assert "audited_absences" in detail
        assert isinstance(detail["audited_absences"], list)
        assert "momentum" in detail
        assert "companies_involved" in detail

        if detail["timeline"]:
            node = detail["timeline"][0]
            assert "event_id" in node
            assert "company" in node
            assert "source_url" in node
            assert "signal_type" in node
            assert "node_class" in node


def test_get_trend_detail_nonexistent_returns_404(auth_headers):
    resp = client.get("/trends/cluster_nonexistent_99999", headers=auth_headers)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()
