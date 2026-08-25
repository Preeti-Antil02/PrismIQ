import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src.api import app

client = TestClient(app)


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


def test_list_briefs_sorting_and_preview(mock_data_dir):
    response = client.get("/briefs")
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


def test_get_latest_brief(mock_data_dir):
    response = client.get("/briefs/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "latest"
    assert "Z" in data["date"]
    assert "Spectre Side-Channel Vulnerability Disclosed" in data["content"]
    assert "## Top 3 decisions this informs" in data["content"]


def test_get_historical_brief_by_id(mock_data_dir):
    # Fetch older brief by ID
    response = client.get("/briefs/20260816_100000")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "20260816_100000"
    assert "Netlify Launches New Edge Functions" in data["content"]


def test_get_nonexistent_brief_404(mock_data_dir):
    response = client.get("/briefs/nonexistent_id")
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_empty_data_directory_state(tmp_path, monkeypatch):
    empty_dir = tmp_path / "empty_data"
    empty_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(empty_dir))

    # GET /briefs should return empty list
    r_list = client.get("/briefs")
    assert r_list.status_code == 200
    assert r_list.json() == {"briefs": []}

    # GET /briefs/latest should return 404
    r_latest = client.get("/briefs/latest")
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
