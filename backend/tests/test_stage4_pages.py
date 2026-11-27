"""
Stage 4 Regression Tests: Workspace Settings, Watchlist, Topics, Delivery, and Research Radar.
Verifies local/offline DB fallback without 500s, strict multi-tenant isolation,
durable flat-file persistence, and dynamic signal-grounded Research Radar synthesis.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from src import storage
from src.api import app


def _auth_headers(tenant_id: str, email: str = "stage4@prismiq.dev") -> dict:
    token = jwt.encode(
        {
            "sub": tenant_id,
            "email": email,
            "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
        },
        "stage4-test-secret-key-at-least-32-bytes!",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}


@pytest.fixture
def client():
    return TestClient(app)


def test_workspace_settings_offline_and_multi_tenant_isolation(client, tmp_path, monkeypatch):
    """GET /api/workspace/settings never 500s locally and isolates telemetry + workspace identity."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    tid_a = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
    tid_b = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"

    # Seed custom tenant A (Linear vs Jira + Shortcut)
    (tmp_path / f"tracked_companies_{tid_a}.json").write_text(
        json.dumps([
            {"company_name": "Linear", "is_target": True, "status": "active"},
            {"company_name": "Jira", "is_target": False, "status": "active"},
            {"company_name": "Shortcut", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"signals_{tid_a}.json").write_text(
        json.dumps([
            {"id": "s1", "company": "Jira", "title": "Jira AI workflow engine", "is_noise": False},
            {"id": "s2", "company": "Jira", "title": "Cookie policy tweak", "is_noise": True},
        ]),
        encoding="utf-8",
    )
    storage.save_tenant_research_topic(tid_a, "Agentic Issue Triage", ["agent", "triage"])
    paused = storage.save_tenant_research_topic(tid_a, "Legacy XML Export", ["xml"])
    storage.update_tenant_research_topic_status(tid_a, paused["id"], False)

    resp_a = client.get("/api/workspace/settings", headers=_auth_headers(tid_a))
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["tenant_id"] == tid_a
    assert "Linear" in data_a["workspace_name"]
    assert "preetiantil" not in data_a["owner_email"]
    assert data_a["tracked_companies_count"] == 2
    assert data_a["active_topics_count"] == 1
    assert data_a["paused_topics_count"] == 1
    assert data_a["total_signals_evaluated"] == 2
    assert data_a["noise_suppressed_count"] == 1

    # Tenant B remains clean and zeroed
    resp_b = client.get("/api/workspace/settings", headers=_auth_headers(tid_b))
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["tenant_id"] == tid_b
    assert data_b["tracked_companies_count"] == 0
    assert data_b["active_topics_count"] == 0
    assert data_b["total_signals_evaluated"] == 0


def test_watchlist_add_untrack_and_tenant_isolation(client, tmp_path, monkeypatch):
    """Watchlist add/untrack persists in tenant-scoped files and respects case-insensitive untrack."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    tid_a = "cccccccc-3333-4333-8333-cccccccccccc"
    tid_b = "dddddddd-4444-4444-8444-dddddddddddd"

    add_resp = client.post(
        "/workspace/watchlist/add",
        json={"company_name": "Plane", "is_target": False},
        headers=_auth_headers(tid_a),
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["company"]["company_name"] == "Plane"

    list_a = client.get("/tracked-companies", headers=_auth_headers(tid_a))
    assert list_a.status_code == 200
    assert any(c["company_name"] == "Plane" for c in list_a.json()["tracked_companies"])

    list_b = client.get("/tracked-companies", headers=_auth_headers(tid_b))
    assert list_b.status_code == 200
    assert list_b.json()["tracked_companies"] == []

    # Case-insensitive untrack succeeds cleanly
    del_resp = client.delete("/workspace/watchlist/plane", headers=_auth_headers(tid_a))
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "untracked"

    list_a_after = client.get("/tracked-companies", headers=_auth_headers(tid_a))
    assert all(c["company_name"].lower() != "plane" for c in list_a_after.json()["tracked_companies"])


def test_topics_crud_pause_and_zero_cross_tenant_leakage(client, tmp_path, monkeypatch):
    """Shared legacy research_topics.json without tenant_id must never leak into other tenants."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    # Write legacy unscoped topic file without tenant_id
    (tmp_path / "research_topics.json").write_text(
        json.dumps([{"id": "legacy-1", "topic_label": "Legacy Global Topic", "keywords": ["legacy"], "is_active": True}]),
        encoding="utf-8",
    )

    tid_a = "eeeeeeee-5555-4555-8555-eeeeeeeeeeee"
    tid_b = "ffffffff-6666-4666-8666-ffffffffffff"

    # Unconfigured tenant must NOT inherit unscoped topics
    init_a = client.get("/api/topics?include_paused=true", headers=_auth_headers(tid_a))
    assert init_a.status_code == 200
    assert init_a.json()["topics"] == []

    # Create, pause, resume, delete in tenant A
    created = client.post(
        "/api/workspace/topics",
        json={"topic_label": "Multiplayer Sync", "keywords": ["crdt", "sync"]},
        headers=_auth_headers(tid_a),
    )
    assert created.status_code == 200
    topic_id = created.json()["topic"]["id"]

    # Tenant B still sees zero topics
    init_b = client.get("/api/topics?include_paused=true", headers=_auth_headers(tid_b))
    assert init_b.status_code == 200
    assert init_b.json()["topics"] == []

    # Pause in A
    patch_resp = client.patch(
        f"/api/workspace/topics/{topic_id}",
        json={"is_active": False},
        headers=_auth_headers(tid_a),
    )
    assert patch_resp.status_code == 200
    active_only = client.get("/api/topics?include_paused=false", headers=_auth_headers(tid_a))
    assert active_only.json()["count"] == 0
    with_paused = client.get("/api/topics?include_paused=true", headers=_auth_headers(tid_a))
    assert with_paused.json()["count"] == 1
    assert with_paused.json()["topics"][0]["is_active"] is False


def test_delivery_config_persistence_validation_and_isolation(client, tmp_path, monkeypatch):
    """Slack webhook settings persist per tenant and expose both frontend and backend field names."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    tid_a = "12121212-1111-4111-8111-121212121212"
    tid_b = "34343434-2222-4222-8222-343434343434"

    # Invalid webhook fails with 400
    bad = client.post(
        "/api/workspace/delivery",
        json={
            "slack_webhook_url": "https://evil.example.com/hook",
            "channel_name": "#alerts",
            "is_active": True,
        },
        headers=_auth_headers(tid_a),
    )
    assert bad.status_code == 400

    # Valid save persists for tenant A
    ok = client.post(
        "/api/workspace/delivery",
        json={
            "slack_webhook_url": "https://hooks.slack.com/services/T00/B00/XXXX",
            "channel_name": "#linear-ci",
            "is_active": True,
            "delivery_cadence": "realtime",
        },
        headers=_auth_headers(tid_a),
    )
    assert ok.status_code == 200
    saved = ok.json()["delivery_config"]
    assert saved["slack_channel"] == "#linear-ci"
    assert saved["channel_name"] == "#linear-ci"
    assert saved["is_enabled"] is True
    assert saved["is_active"] is True
    assert saved["delivery_cadence"] == "realtime"

    fetched_a = client.get("/api/workspace/delivery", headers=_auth_headers(tid_a)).json()["delivery_config"]
    assert fetched_a["slack_webhook_url"] == "https://hooks.slack.com/services/T00/B00/XXXX"
    assert fetched_a["slack_channel"] == "#linear-ci"
    assert fetched_a["delivery_cadence"] == "realtime"

    # Tenant B retains blank unconfigured state
    fetched_b = client.get("/api/workspace/delivery", headers=_auth_headers(tid_b)).json()["delivery_config"]
    assert fetched_b["slack_webhook_url"] == ""
    assert fetched_b["is_enabled"] is False


def test_research_radar_synthesizes_from_tenant_signals_without_prebaked_file(client, tmp_path, monkeypatch):
    """Any newly onboarded company with swept signals gets real grounded Radar states automatically."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    tid = "56565656-7777-4777-8777-565656565656"
    (tmp_path / f"tracked_companies_{tid}.json").write_text(
        json.dumps([
            {"company_name": "Linear", "is_target": True, "status": "active"},
            {"company_name": "Jira", "is_target": False, "status": "active"},
            {"company_name": "Asana", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"signals_{tid}.json").write_text(
        json.dumps([
            {
                "id": "sig_jira_1",
                "company": "Jira",
                "source": "news",
                "title": "Jira launches autonomous agentic triage workflow in general availability",
                "url": "https://atlassian.com/blog/jira-agentic-triage",
                "raw_excerpt": "Atlassian rolled out general availability for autonomous agentic triage in Jira.",
                "published_at": "2026-11-20T10:00:00Z",
            }
        ]),
        encoding="utf-8",
    )
    storage.save_tenant_research_topic(tid, "AI Agentic Triage", ["agentic", "triage"])

    radar_resp = client.get("/api/radar", headers=_auth_headers(tid))
    assert radar_resp.status_code == 200
    body = radar_resp.json()
    assert body["count"] == 1
    ev = body["evaluations"][0]
    assert ev["pending_sweep"] is False
    conns = ev["competitor_connections"]
    assert conns["Jira"]["status"] == "adopting"
    assert len(conns["Jira"]["evidence_signals"]) == 1
    assert conns["Asana"]["status"] == "no activity detected"
