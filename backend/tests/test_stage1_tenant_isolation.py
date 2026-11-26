"""
Stage 1 Regression Tests: Strict Multi-Company & Tenant Isolation.

Verifies that custom/unconfigured tenants NEVER inherit another company's
workspace config, signals, events, findings, briefs, or Batch 2 Customer Voice
& Next Best Actions, and that unauthenticated ?tenant_id= requests are rejected.
"""

import json
import sys
import uuid
from pathlib import Path
from unittest.mock import patch

import jwt
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.api import app, _get_fallback_findings  # noqa: E402
from src import batch2_storage, overview_service, storage  # noqa: E402
from src.batch2_seed_data import seed_batch2_intelligence  # noqa: E402

client = TestClient(app)


def _make_jwt(tenant_id: str, email: str = "analyst@prismiq.ai") -> str:
    import time

    return jwt.encode(
        {
            "sub": tenant_id,
            "aud": "authenticated",
            "role": "authenticated",
            "email": email,
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        },
        "test_secret",
        algorithm="HS256",
    )


def test_workspace_config_never_globs_other_tenant_confirmed_competitors(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(data_dir))

    other_tid = str(uuid.uuid4())
    custom_tid = str(uuid.uuid4())

    (data_dir / f"confirmed_competitors_{other_tid}.json").write_text(
        json.dumps({"target_company": "Meesho", "competitors": ["Flipkart", "Amazon India"]}),
        encoding="utf-8",
    )

    with patch.object(storage, "is_live_write_permitted", return_value=False):
        cfg = storage.get_tenant_workspace_config(custom_tid)

    assert not cfg.get("target_company")
    assert cfg.get("competitors") == []
    assert cfg.get("is_configured") is False


def test_load_signals_and_events_return_empty_for_unknown_tenant(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(data_dir))

    (data_dir / "signals.json").write_text(
        json.dumps([{"id": "sig_m1", "company": "Meesho", "title": "Global signal"}]),
        encoding="utf-8",
    )
    (data_dir / "events.json").write_text(
        json.dumps([{"event_id": "evt_m1", "company_name": "Meesho", "title": "Global event"}]),
        encoding="utf-8",
    )

    custom_tid = str(uuid.uuid4())
    other_tid = str(uuid.uuid4())

    assert storage.load_signals(tenant_id=custom_tid) == []
    assert storage.load_events(tenant_id=custom_tid) == []

    # Saving tenant-scoped records keeps global events.json untouched and isolates reads
    with patch.object(storage, "is_dry_run", return_value=True):
        pass
    monkeypatch.setenv("PRISMIQ_DRY_RUN", "false")
    with patch.object(storage, "get_db_cursor") as mock_cur:
        mock_cur.return_value.__enter__.return_value = storage.MockCursor()
        storage.save_signals(
            [{"id": "sig_custom_1", "company": "NovaAI", "title": "NovaAI launch"}],
            tenant_id=custom_tid,
        )
        storage.save_events(
            [{"event_id": "evt_custom_1", "company": "NovaAI", "company_name": "NovaAI", "title": "NovaAI GA"}],
            tenant_id=custom_tid,
        )

    assert len(storage.load_signals(tenant_id=custom_tid)) == 1
    assert storage.load_signals(tenant_id=custom_tid)[0]["company"] == "NovaAI"
    assert len(storage.load_events(tenant_id=custom_tid)) == 1
    assert storage.load_events(tenant_id=custom_tid)[0]["event_id"] == "evt_custom_1"
    assert storage.load_signals(tenant_id=other_tid) == []
    assert storage.load_events(tenant_id=other_tid) == []
    global_events = json.loads((data_dir / "events.json").read_text(encoding="utf-8"))
    assert global_events[0]["event_id"] == "evt_m1"


def test_batch2_seed_and_cache_never_leak_meesho_to_custom_tenant(monkeypatch):
    batch2_storage.clear_tenant_cache()
    custom_tid = str(uuid.uuid4())

    res = seed_batch2_intelligence(custom_tid, "NovaAI")
    assert res == {"actions": 0, "feedback": 0}
    assert batch2_storage.list_feedback_records(custom_tid) == []
    assert batch2_storage.list_feedback_themes(custom_tid) == []
    assert batch2_storage.list_next_best_actions(custom_tid) == []

    # Even outside test flag, _ensure_tenant_cache must not auto-seed Meesho for custom tenants
    batch2_storage.clear_tenant_cache(custom_tid)
    monkeypatch.setattr(storage, "is_test_environment", lambda: False)
    with patch.object(storage, "is_live_write_permitted", return_value=False):
        assert batch2_storage.list_feedback_records(custom_tid) == []
        assert batch2_storage.list_next_best_actions(custom_tid) == []


def test_unauthenticated_tenant_id_query_rejected_with_401():
    meesho_tid = "8553449a-c998-4727-be01-9aeb724038cb"
    endpoints = [
        f"/briefs?tenant_id={meesho_tid}",
        f"/briefs/latest?tenant_id={meesho_tid}",
        f"/events?tenant_id={meesho_tid}",
        f"/findings?tenant_id={meesho_tid}",
        f"/tracked-companies?tenant_id={meesho_tid}",
        f"/api/customer-voice/feedback?tenant_id={meesho_tid}",
        f"/api/next-best-actions?tenant_id={meesho_tid}",
        f"/api/relationships?tenant_id={meesho_tid}",
        f"/api/competitors/Vercel/battlecard?tenant_id={meesho_tid}",
        f"/api/trends?tenant_id={meesho_tid}",
    ]
    for path in endpoints:
        resp = client.get(path)
        assert resp.status_code == 401, f"Expected 401 for unauthenticated {path}, got {resp.status_code}"


def test_unconfigured_tenant_gets_empty_briefs_findings_and_intelligence_detail(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(data_dir))

    (data_dir / "brief.md").write_text("# Meesho Intelligence Brief\nFlipkart launched Express.", encoding="utf-8")
    (data_dir / "brief_20260823_120000.md").write_text("# Cloudflare Workers Report\nVercel edge", encoding="utf-8")
    (data_dir / "events.json").write_text(
        json.dumps([{"event_id": "evt_meesho_secret", "company_name": "Flipkart", "title": "Flipkart Secret"}]),
        encoding="utf-8",
    )

    custom_tid = str(uuid.uuid4())
    headers = {"Authorization": f"Bearer {_make_jwt(custom_tid)}"}

    assert client.get("/briefs", headers=headers).json() == {"briefs": []}
    assert client.get("/briefs/latest", headers=headers).status_code == 404
    assert client.get("/briefs/20260823_120000", headers=headers).status_code == 404
    assert client.get("/findings", headers=headers).json() == {"findings": [], "count": 0}
    assert _get_fallback_findings(tenant_id=custom_tid) == {"findings": [], "count": 0}
    assert client.get("/tracked-companies", headers=headers).json() == {"tracked_companies": [], "count": 0}

    ws_cfg = client.get("/workspace/config", headers=headers).json()
    assert not ws_cfg.get("target_company")
    assert ws_cfg.get("is_configured") is False

    detail = overview_service.get_intelligence_detail("evt_meesho_secret", target_company="NovaAI", tenant_id=custom_tid)
    assert "Flipkart Secret" not in (detail.get("title") or "")


def test_router_x_tenant_id_enforces_secret_when_configured(monkeypatch):
    batch2_storage.clear_tenant_cache()
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())
    headers_a_to_b = {
        "Authorization": f"Bearer {_make_jwt(tenant_a)}",
        "X-Tenant-ID": tenant_b,
    }

    batch2_storage.save_next_best_action(
        {"title": "Tenant B Secret Action", "team": "Sales"},
        tenant_b,
    )

    # Strict JWT secret mode rejects cross-tenant X-Tenant-ID override
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test_secret")
    resp_forbidden = client.get("/api/next-best-actions", headers=headers_a_to_b)
    assert resp_forbidden.status_code == 403

    # Dev mode without secret honors authenticated X-Tenant-ID cleanly
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    resp_ok = client.get("/api/next-best-actions", headers=headers_a_to_b)
    assert resp_ok.status_code == 200
    titles = [a.get("title") for a in resp_ok.json().get("actions", [])]
    assert "Tenant B Secret Action" in titles
