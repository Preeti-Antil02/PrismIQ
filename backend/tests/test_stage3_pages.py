"""
Stage 3 Regression Tests: Competitors, Compare, Intelligence Explorer, and Action Center.
Verifies strict multi-tenant isolation and dynamic synthesis for any arbitrary custom company.
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

from src import batch2_storage, batch4_storage, battlecard_storage
from src.api import app
from src.competitor_comparison_engine import CompetitorComparisonEngine
from src.emerging_competitor_service import EmergingCompetitorService
from src.relationship_engine import RelationshipEngine
from src.threat_scoring_engine import ThreatScoringEngine


def _auth_headers(tenant_id: str, email: str = "stage3@prismiq.dev") -> dict:
    token = jwt.encode(
        {
            "sub": tenant_id,
            "email": email,
            "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
        },
        "stage3-test-secret-key-at-least-32-bytes!",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}


@pytest.fixture(autouse=True)
def reset_caches():
    batch2_storage.clear_tenant_cache()
    batch4_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()
    yield
    batch2_storage.clear_tenant_cache()
    batch4_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


@pytest.fixture
def client():
    return TestClient(app)


def test_threat_scoring_handles_real_swept_company_and_source_fields(tmp_path, monkeypatch):
    """Real pipeline signals use company + source keys and must yield assessed factor scores."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    tid = "10101010-2020-4303-8404-505050505050"
    (tmp_path / f"signals_{tid}.json").write_text(
        json.dumps([
            {"id": "s1", "company": "Framer", "source": "github", "title": "Framer launches design-to-code SDK v2"},
            {"id": "s2", "company": "Framer", "source": "jobs", "title": "Framer hiring Staff Design Systems Engineer"},
            {"id": "s3", "company": "Framer", "source": "pricing", "title": "Framer introduces Enterprise seat pricing tier"},
            {"id": "s4", "company": "Framer", "source": "news", "title": "Framer announces Series D expansion"},
        ]),
        encoding="utf-8",
    )
    score = ThreatScoringEngine(tid).calculate_threat_score("Framer", save=False)
    assert score["threat_level"] != "Unassessed"
    assert score["data_coverage_score"] >= 0.8
    assert score["factor_contributions"]["product_activity"]["is_assessed"] is True
    assert score["factor_contributions"]["hiring_activity"]["is_assessed"] is True
    assert score["factor_contributions"]["pricing_movement"]["is_assessed"] is True
    assert score["factor_contributions"]["market_activity"]["is_assessed"] is True


def test_emerging_competitors_detects_company_field_and_isolates_tenant(tmp_path, monkeypatch):
    """EmergingCompetitorService detects untracked entities using `company` key cleanly."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    tid = "12121212-3434-4565-8787-909090909090"
    (tmp_path / f"tracked_companies_{tid}.json").write_text(
        json.dumps([{"company_name": "Figma", "is_target": True, "status": "active"}]),
        encoding="utf-8",
    )
    (tmp_path / f"signals_{tid}.json").write_text(
        json.dumps([
            {"id": "sig_p1", "company": "Penpot", "source": "github", "title": "Penpot 2.4 open-source release"},
            {"id": "sig_f1", "company": "Figma", "source": "news", "title": "Figma Config updates"},
        ]),
        encoding="utf-8",
    )
    cands = EmergingCompetitorService(tid).discover_candidates()
    names = [c["company_name"] for c in cands]
    assert "Penpot" in names
    assert "Figma" not in names


def test_comparison_matrix_uses_tenant_events_and_keeps_unassessed_unknown(tmp_path, monkeypatch):
    """Compare matrix reflects swept tenant events for observed capabilities and Unknown where absent."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    tid = "23232323-4545-4676-8989-abababababab"
    now_iso = datetime.now(timezone.utc).isoformat()
    (tmp_path / f"events_{tid}.json").write_text(
        json.dumps([
            {
                "event_id": "evt_f1",
                "company_name": "Framer",
                "title": "Framer launches interactive AI site builder & React SDK",
                "event_summary": "Framer expands GitHub SDK and AI generation.",
                "contributing_sources": ["news", "github"],
                "published_at": now_iso,
                "url": "https://framer.com/updates/ai-sdk",
            }
        ]),
        encoding="utf-8",
    )
    res = CompetitorComparisonEngine(tid).generate_comparison_matrix("Figma", ["Framer", "UnseenRival"])
    cat_keys = [c["category_key"] for c in res["comparison_matrix"]]
    assert "observed_market_signals" in cat_keys
    obs = next(c for c in res["comparison_matrix"] if c["category_key"] == "observed_market_signals")
    prod_row = next(r for r in obs["capabilities"] if "Product & Feature" in r["capability_name"])
    assert prod_row["evaluations"]["Framer"]["state"] == "Supported"
    assert prod_row["evaluations"]["Framer"]["evidence_source"] == "https://framer.com/updates/ai-sdk"
    assert prod_row["evaluations"]["UnseenRival"]["state"] == "Unknown"


def test_relationship_synthesis_and_next_best_actions_for_custom_company(client, tmp_path, monkeypatch):
    """Custom company gets tenant-isolated Relationships & Next Best Actions synthesized from swept events."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    tid = "34343434-5656-4787-8909-cdcdcdcdcdcd"
    other_tid = "45454545-6767-4898-8010-efefefefefef"
    now_iso = datetime.now(timezone.utc).isoformat()

    (tmp_path / f"tracked_companies_{tid}.json").write_text(
        json.dumps([
            {"company_name": "Figma", "is_target": True, "status": "active"},
            {"company_name": "Framer", "is_target": False, "status": "active"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / f"events_{tid}.json").write_text(
        json.dumps([
            {
                "event_id": "evt_fr_1",
                "company_name": "Framer",
                "title": "Framer launches Enterprise Design Tokens Sync",
                "event_summary": "Enterprise design workflow expansion.",
                "why_it_matters": "Directly challenges Figma Variables and enterprise design system lock-in.",
                "contributing_sources": ["news"],
                "published_at": now_iso,
                "url": "https://framer.com/tokens",
                "fact_confidence": "High",
                "tier": "must_know",
            }
        ]),
        encoding="utf-8",
    )

    hdr = _auth_headers(tid)
    # 1. Intelligence Explorer (/api/relationships) synthesizes Figma -> Framer and Framer -> event
    rel_res = client.get(f"/api/relationships?tenant_id={tid}", headers=hdr)
    assert rel_res.status_code == 200
    rels = rel_res.json()
    assert len(rels) >= 2
    rel_blob = json.dumps(rels).lower()
    assert "framer" in rel_blob
    assert "meesho" not in rel_blob and "flipkart" not in rel_blob

    # Tenant B stays completely isolated
    rel_other = client.get(f"/api/relationships?tenant_id={other_tid}", headers=_auth_headers(other_tid))
    assert rel_other.status_code == 200
    assert rel_other.json() == []

    # 2. Action Center (/api/next-best-actions) synthesizes from Figma's swept events and persists audit status
    act_res = client.get(f"/api/next-best-actions?target_company=Figma&tenant_id={tid}", headers=hdr)
    assert act_res.status_code == 200
    actions = act_res.json()["actions"]
    assert len(actions) >= 1
    assert actions[0]["related_competitor"] == "Framer"
    assert "figma" in actions[0]["recommended_action"].lower()
    assert "meesho" not in json.dumps(actions).lower()

    # Verify status transition + audit log works for synthesized action
    aid = actions[0]["id"]
    patch_res = client.patch(
        f"/api/next-best-actions/{aid}/status",
        json={"status": "accepted", "notes": "Approved in Stage 3 test", "changed_by": "qa"},
        headers=hdr,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["action"]["review_status"] == "accepted"

    # Unauthenticated/isolated check on other_tid must return 0 actions
    other_act_res = client.get(f"/api/next-best-actions?tenant_id={other_tid}", headers=_auth_headers(other_tid))
    assert other_act_res.status_code == 200
    assert other_act_res.json()["actions"] == []
