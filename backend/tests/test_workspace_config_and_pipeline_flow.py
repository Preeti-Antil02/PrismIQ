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
from src import storage, workflow

client = TestClient(app)

TENANT_A_ID = "aaaa1111-0000-0000-0000-aaaaaaaaaaaa"
TENANT_B_ID = "bbbb2222-0000-0000-0000-bbbbbbbbbbbb"


def make_jwt(tenant_id: str, email: str) -> str:
    payload = {
        "sub": tenant_id,
        "aud": "authenticated",
        "role": "authenticated",
        "email": email,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, "test_secret", algorithm="HS256")


@pytest.fixture
def auth_headers_tenant_a(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    token = make_jwt(TENANT_A_ID, "user_a@openai-fan.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_tenant_b(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    token = make_jwt(TENANT_B_ID, "user_b@flipkart-team.com")
    return {"Authorization": f"Bearer {token}"}


def test_target_vs_competitor_separation_and_persistence(auth_headers_tenant_a):
    """
    Phase 2 & Phase 3:
    Target company (OpenAI) must be stored with is_target=True.
    Confirmed competitors (Anthropic, Google) must be stored with is_target=False.
    """
    res = client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "OpenAI",
            "confirmed_competitors": ["Anthropic", "Google", "Microsoft"],
        },
        headers=auth_headers_tenant_a,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "confirmed"
    assert data["target_company"] == "OpenAI"

    tracked = data["tracked_companies"]
    targets = [c for c in tracked if c["is_target"] is True]
    competitors = [c for c in tracked if c["is_target"] is False]

    # Target company remains distinct
    assert len(targets) == 1
    assert targets[0]["company_name"] == "OpenAI"

    # Competitors are separate
    assert len(competitors) == 3
    comp_names = [c["company_name"] for c in competitors]
    assert "Anthropic" in comp_names
    assert "Google" in comp_names
    assert "Microsoft" in comp_names


def test_human_confirmation_gate(auth_headers_tenant_a):
    """
    Phase 4:
    Only human-selected competitors must be saved as active.
    Omitted / deselected competitors must NOT be tracked.
    """
    # Suppose candidates were [Anthropic, Cohere, Google, Mistral]
    # Human selects only Anthropic and Google
    res = client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "OpenAI",
            "confirmed_competitors": ["Anthropic", "Google"],
        },
        headers=auth_headers_tenant_a,
    )
    assert res.status_code == 200
    cfg = client.get("/api/workspace/config", headers=auth_headers_tenant_a).json()

    assert cfg["target_company"] == "OpenAI"
    assert set(cfg["competitors"]) == {"Anthropic", "Google"}
    assert "Cohere" not in cfg["competitors"]
    assert "Mistral" not in cfg["competitors"]


def test_manual_competitor_addition(auth_headers_tenant_a):
    """
    Phase 5:
    Manually adding a competitor updates the workspace tracked companies seamlessly.
    """
    # Start with initial confirmation
    client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "OpenAI",
            "confirmed_competitors": ["Anthropic"],
        },
        headers=auth_headers_tenant_a,
    )

    # Manually track "xAI"
    entry = storage.track_tenant_company(TENANT_A_ID, "xAI", is_target=False)
    assert entry["company_name"] == "xAI"
    assert entry["is_target"] is False

    cfg = client.get("/api/workspace/config", headers=auth_headers_tenant_a).json()
    assert "xAI" in cfg["competitors"]
    assert "Anthropic" in cfg["competitors"]
    assert cfg["target_company"] == "OpenAI"


def test_intelligence_preferences_persistence_and_refresh_test(auth_headers_tenant_a):
    """
    Phase 6, 7, 10, 12:
    - Step 2: User confirms competitors.
    - Refresh test at Step 2 -> Step 3 transition:
      onboarding_complete is FALSE, so user is NOT prematurely redirected to /app.
      is_configured is TRUE.
    - Step 3/4: User saves intelligence preferences.
    - onboarding_complete becomes TRUE.
    """
    # 1. Step 2: Confirm competitors
    client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "OpenAI",
            "confirmed_competitors": ["Anthropic", "Google"],
        },
        headers=auth_headers_tenant_a,
    )

    # 2. Simulate refresh after Step 2 (before preferences configured)
    cfg_step2 = client.get("/api/workspace/config", headers=auth_headers_tenant_a).json()
    assert cfg_step2["target_company"] == "OpenAI"
    assert set(cfg_step2["competitors"]) == {"Anthropic", "Google"}
    assert cfg_step2["is_configured"] is True
    assert cfg_step2["has_preferences"] is False
    assert cfg_step2["onboarding_complete"] is False  # CRITICAL: prevents premature redirect

    # Check /api/auth/me reflects the honest incomplete onboarding
    me_res = client.get("/api/auth/me", headers=auth_headers_tenant_a).json()
    assert me_res["onboarding_complete"] is False

    # 3. Step 3/4: Configure research topic
    topic = storage.save_tenant_research_topic(
        tenant_id=TENANT_A_ID,
        topic_label="AI Agentic Models",
        keywords=["reasoning", "agent", "llm"],
        source="manual",
    )
    assert topic["topic_label"] == "AI Agentic Models"

    # 4. Now workspace configuration is complete
    cfg_step4 = client.get("/api/workspace/config", headers=auth_headers_tenant_a).json()
    assert cfg_step4["is_configured"] is True
    assert cfg_step4["has_preferences"] is True
    assert cfg_step4["onboarding_complete"] is True
    assert len(cfg_step4["topics"]) >= 1

    me_res_done = client.get("/api/auth/me", headers=auth_headers_tenant_a).json()
    assert me_res_done["onboarding_complete"] is True


def test_pipeline_gating_unconfigured_workspace(auth_headers_tenant_b):
    """
    Phase 9:
    Pipeline cannot run if workspace is incomplete.
    """
    # Tenant B has neither target nor competitors yet
    res = client.post(
        "/api/pipeline/trigger",
        json={"is_first_run": True},
        headers=auth_headers_tenant_b,
    )
    assert res.status_code == 400
    assert "incomplete" in res.json()["detail"].lower()

    # Calling run_progressive_pipeline directly also returns incomplete_configuration
    workflow_res = workflow.run_progressive_pipeline(tenant_id=TENANT_B_ID)
    assert workflow_res.get("status") == "incomplete_configuration"


def test_workspace_isolation_two_tenants(tmp_path, monkeypatch):
    """
    Phase 11:
    Workspace A: OpenAI -> Anthropic, Google
    Workspace B: Flipkart -> Amazon, Meesho
    Verify: Workspace A NEVER receives Workspace B's competitors.
    Verify: Workspace B NEVER receives Workspace A's competitors.
    """
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(data_dir))

    headers_a = {"Authorization": f"Bearer {make_jwt(TENANT_A_ID, 'a@test.com')}"}
    headers_b = {"Authorization": f"Bearer {make_jwt(TENANT_B_ID, 'b@test.com')}"}

    # Setup Workspace A
    client.post(
        "/api/onboarding/confirm",
        json={"target_company": "OpenAI", "confirmed_competitors": ["Anthropic", "Google"]},
        headers=headers_a,
    )
    storage.save_tenant_research_topic(TENANT_A_ID, "LLM Scaling", ["compute", "transformer"])

    # Setup Workspace B
    client.post(
        "/api/onboarding/confirm",
        json={"target_company": "Flipkart", "confirmed_competitors": ["Amazon", "Meesho"]},
        headers=headers_b,
    )
    storage.save_tenant_research_topic(TENANT_B_ID, "E-commerce Logistics", ["delivery", "supply-chain"])

    # Check Workspace A
    cfg_a = client.get("/api/workspace/config", headers=headers_a).json()
    assert cfg_a["target_company"] == "OpenAI"
    assert set(cfg_a["competitors"]) == {"Anthropic", "Google"}
    assert "Amazon" not in cfg_a["competitors"]
    assert "Meesho" not in cfg_a["competitors"]
    assert "Flipkart" not in cfg_a["competitors"]
    assert any(t["topic_label"] == "LLM Scaling" for t in cfg_a["topics"])
    assert not any(t["topic_label"] == "E-commerce Logistics" for t in cfg_a["topics"])

    # Check Workspace B
    cfg_b = client.get("/api/workspace/config", headers=headers_b).json()
    assert cfg_b["target_company"] == "Flipkart"
    assert set(cfg_b["competitors"]) == {"Amazon", "Meesho"}
    assert "OpenAI" not in cfg_b["competitors"]
    assert "Anthropic" not in cfg_b["competitors"]
    assert "Google" not in cfg_b["competitors"]
    assert any(t["topic_label"] == "E-commerce Logistics" for t in cfg_b["topics"])
    assert not any(t["topic_label"] == "LLM Scaling" for t in cfg_b["topics"])
