import sys
import time
from pathlib import Path
import jwt
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src.api import app

client = TestClient(app)

OWNER_TENANT_ID = "c8f13b91-46ef-4682-9975-f85764d8a12e"
TEST_TENANT_2_ID = "e4b2a7d1-1234-4567-89ab-cdef01234567"


def make_test_jwt(tenant_id: str = OWNER_TENANT_ID, exp_delta: int = 3600, secret: str = "test_secret") -> str:
    """Helper to generate well-formed test Supabase JWT tokens."""
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
def mock_data_dir(tmp_path, monkeypatch):
    """Fixture providing a temporary data directory with known test briefs."""
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(data_dir))

    # Older brief
    older_content = """# PrismIQ Competitive Intelligence Brief

## Top 3 decisions this informs

1. **Netlify** (Netlify Launches New Edge Functions): Speeds up cold starts for serverless compute.

## Findings by Company
### Netlify
#### Must-Know
- **[Netlify Launches New Edge Functions](https://example.com/netlify)**
  - **Why it matters**: Faster cold starts.
"""
    (data_dir / "brief_20260816_100000.md").write_text(older_content, encoding="utf-8")

    # Newer brief
    newer_content = """# PrismIQ Competitive Intelligence Brief

## Top 3 decisions this informs

1. **Cloudflare Workers** (Spectre Side-Channel Vulnerability Disclosed): Critical isolate security risk.
2. **Vercel** (Vercel Releases AI Scoreboard): Leading agentic web ecosystem.

## Findings by Company
### Cloudflare Workers
#### Must-Know
- **[Spectre Side-Channel Vulnerability Disclosed](https://example.com/cf)**
  - **Why it matters**: Critical security risk.
"""
    (data_dir / "brief_20260823_120000.md").write_text(newer_content, encoding="utf-8")

    # Latest brief pointer (matches newest content)
    (data_dir / "brief.md").write_text(newer_content, encoding="utf-8")

    return data_dir


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "PrismIQ" in data["service"]


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "PrismIQ" in data["service"]


# ============================================================================
# Adversarial Auth Tests
# ============================================================================

def test_missing_auth_header_rejected():
    """Unauthenticated requests to tenant-facing endpoints must return HTTP 401."""
    r1 = client.get("/briefs")
    assert r1.status_code == 401
    assert "missing" in r1.json()["detail"].lower()

    r2 = client.get("/briefs/latest")
    assert r2.status_code == 401

    r3 = client.get("/findings")
    assert r3.status_code == 401

    r4 = client.get("/tracked-companies")
    assert r4.status_code == 401

    r5 = client.post("/api/onboarding/discover", json={"target_company": "PostHog"})
    assert r5.status_code == 401


def test_malformed_auth_header_rejected():
    """Malformed Authorization headers must return HTTP 401."""
    r1 = client.get("/briefs", headers={"Authorization": "Basic 12345"})
    assert r1.status_code == 401
    assert "invalid authorization header format" in r1.json()["detail"].lower()

    r2 = client.get("/briefs", headers={"Authorization": "Bearer not-a-jwt"})
    assert r2.status_code == 401
    assert "invalid or tampered token" in r2.json()["detail"].lower()


def test_expired_jwt_rejected():
    """Expired JWT tokens must return HTTP 401."""
    expired_token = make_test_jwt(OWNER_TENANT_ID, exp_delta=-3600)
    resp = client.get("/briefs", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


def test_non_uuid_subject_rejected():
    """Tokens with non-UUID subjects must return HTTP 401."""
    bad_sub_token = jwt.encode(
        {"sub": "not-a-uuid", "exp": int(time.time()) + 3600},
        "test_secret",
        algorithm="HS256",
    )
    resp = client.get("/briefs", headers={"Authorization": f"Bearer {bad_sub_token}"})
    assert resp.status_code == 401
    assert "valid uuid" in resp.json()["detail"].lower()


# ============================================================================
# Authenticated Tenant Endpoint Tests
# ============================================================================

def test_list_briefs_sorting_and_preview(mock_data_dir, auth_headers):
    response = client.get("/briefs", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "briefs" in data
    briefs = data["briefs"]
    assert len(briefs) == 2

    # Verify sorted newest first
    assert briefs[0]["id"] == "20260823_120000"
    assert briefs[0]["date"] == "2026-08-23T12:00:00Z"
    assert briefs[0]["filename"] == "brief_20260823_120000.md"
    assert "Cloudflare Workers: Spectre Side-Channel Vulnerability Disclosed" in briefs[0]["preview"]

    assert briefs[1]["id"] == "20260816_100000"
    assert briefs[1]["date"] == "2026-08-16T10:00:00Z"
    assert briefs[1]["filename"] == "brief_20260816_100000.md"
    assert "Netlify: Netlify Launches New Edge Functions" in briefs[1]["preview"]


def test_get_latest_brief(mock_data_dir, auth_headers):
    response = client.get("/briefs/latest", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "latest"
    assert "Z" in data["date"]
    assert "Spectre Side-Channel Vulnerability Disclosed" in data["content"]
    assert "## Top 3 decisions this informs" in data["content"]


def test_get_historical_brief_by_id(mock_data_dir, auth_headers):
    response = client.get("/briefs/20260816_100000", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "20260816_100000"
    assert "Netlify Launches New Edge Functions" in data["content"]


def test_get_nonexistent_brief_404(mock_data_dir, auth_headers):
    response = client.get("/briefs/nonexistent_id", headers=auth_headers)
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_empty_data_directory_state(tmp_path, monkeypatch, auth_headers):
    empty_dir = tmp_path / "empty_data"
    empty_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(empty_dir))

    # GET /briefs should return empty list
    r_list = client.get("/briefs", headers=auth_headers)
    assert r_list.status_code == 200
    assert r_list.json() == {"briefs": []}

    # GET /briefs/latest should return 404
    r_latest = client.get("/briefs/latest", headers=auth_headers)
    assert r_latest.status_code == 404


def test_cors_restricted_origins():
    # Production Vercel origin
    res_vercel = client.options(
        "/briefs",
        headers={
            "Origin": "https://prism-iq-red.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_vercel.status_code == 200
    assert res_vercel.headers.get("access-control-allow-origin") == "https://prism-iq-red.vercel.app"

    # Localhost development origin
    res_local = client.options(
        "/briefs",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_local.status_code == 200
    assert res_local.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_onboarding_discover_and_confirm_endpoints(monkeypatch, auth_headers):
    # Mock discovery agent run to return sample candidates
    def mock_run(target, sources=None, tenant_id=None):
        return [
            {
                "name": "Mixpanel",
                "rationale": "Product analytics and user event tracking",
                "confidence": "High",
                "source": "https://mixpanel.com",
                "source_age": "recent",
                "source_date": "2026-08-01",
                "freshness_note": "Recent source (2026-08-01)",
            },
            {
                "name": "Amplitude",
                "rationale": "Digital analytics platform with behavioural tracking",
                "confidence": "High",
                "source": "https://amplitude.com",
                "source_age": "recent",
                "source_date": "2026-08-01",
                "freshness_note": "Recent source (2026-08-01)",
            },
        ]

    monkeypatch.setattr("src.discovery_agent.run", mock_run)

    # 1. Test POST /api/onboarding/discover
    disc_res = client.post(
        "/api/onboarding/discover",
        json={"target_company": "PostHog"},
        headers=auth_headers,
    )
    assert disc_res.status_code == 200
    disc_data = disc_res.json()
    assert disc_data["status"] == "proposed"
    assert disc_data["target_company"] == "PostHog"
    assert disc_data["candidates_count"] == 2
    assert len(disc_data["candidates"]) == 2
    assert disc_data["candidates"][0]["name"] == "Mixpanel"

    # 2. Test POST /api/onboarding/confirm
    conf_res = client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "PostHog",
            "confirmed_competitors": ["Mixpanel"],
        },
        headers=auth_headers,
    )
    assert conf_res.status_code == 200
    conf_data = conf_res.json()
    assert conf_data["status"] == "confirmed"
    assert conf_data["target_company"] == "PostHog"
    assert len(conf_data["tracked_companies"]) == 2
    assert conf_data["tracked_companies"][0]["company_name"] == "PostHog"
    assert conf_data["tracked_companies"][0]["is_target"] is True
    assert conf_data["tracked_companies"][1]["company_name"] == "Mixpanel"
    assert conf_data["tracked_companies"][1]["is_target"] is False


def test_signals_unauthorized():
    res = client.get("/signals")
    assert res.status_code == 401


def test_signals_authenticated_empty(auth_headers):
    res = client.get("/signals", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "signals" in data
    assert "count" in data
    assert "noise_suppressed_count" in data
    assert isinstance(data["signals"], list)
    assert isinstance(data["count"], int)
    assert isinstance(data["noise_suppressed_count"], int)

