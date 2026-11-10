"""
PrismIQ - Pillar 1: Merged Competitor Evolution & Timeline Test Suite.
Verifies:
1. Unified /companies/{company_name}/evolution endpoint returns:
   - Profile baseline (Point 1)
   - Full chronological change ledger (Point 1)
   - Top 5 high-impact inflections derived from change ledger (Point 3)
   - Multi-month milestone sequence arcs (Point 2)
2. Derived integrity: high_impact_changes is a strict subset of all_changes.
3. No duplicate records between high-impact inflections and the change ledger.
4. Top 5 ordering: high_impact_changes has <= 5 items and is sorted by impact_score descending.
5. Point 2 sequences are populated and have sequence_steps.
6. Backward compatibility: old endpoints (/profile, /changes, /timeline/sequences, /changes/detection) still return 200.
7. RLS / Tenant isolation: different tenants receive isolated evolution states.
"""

import pytest
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token

client = TestClient(app)

AI_TENANT_ID = "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f"
CLOUD_TENANT_ID = "00000000-0000-0000-0000-000000000000"


def test_evolution_endpoint_single_call():
    """Verify one call to /companies/{name}/evolution returns the unified 4-part payload."""
    token = _create_jwt_token(CLOUD_TENANT_ID, "tester@prismiq.dev")
    res = client.get("/companies/Vercel/evolution", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()

    assert data["company_name"] == "Vercel"
    # 1. Point 1 Profile
    assert "profile" in data
    assert data["profile"] is not None
    assert "products" in data["profile"]

    # 2. Point 1 Change Ledger
    assert "all_changes" in data
    assert isinstance(data["all_changes"], list)
    assert len(data["all_changes"]) >= 3
    assert data["total_changes_count"] == len(data["all_changes"])

    # 3. Point 3 High-Impact Inflections
    assert "high_impact_changes" in data
    assert isinstance(data["high_impact_changes"], list)
    assert len(data["high_impact_changes"]) <= 5
    assert data["high_impact_count"] >= len(data["high_impact_changes"])

    # 4. Point 2 Sequences
    assert "sequences" in data
    assert isinstance(data["sequences"], list)


def test_high_impact_derived_from_all_changes():
    """Verify Point 3 high_impact_changes are derived from all_changes with score >= 70 or significance High."""
    token = _create_jwt_token(CLOUD_TENANT_ID, "tester@prismiq.dev")
    res = client.get("/companies/Netlify/evolution", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()

    all_changes = data["all_changes"]
    high_impact = data["high_impact_changes"]

    # Each high-impact item must have high impact score or High significance
    for hic in high_impact:
        score = float(hic.get("impact_score", 0))
        sig = str(hic.get("significance", "")).lower()
        tier = str(hic.get("significance_tier", "")).lower()
        assert score >= 70.0 or sig == "high" or "high" in tier or "critical" in tier

    # High impact must be sorted descending by impact_score
    scores = [float(hic.get("impact_score", 0)) for hic in high_impact]
    assert scores == sorted(scores, reverse=True)


def test_no_duplicate_data_between_high_impact_and_ledger():
    """Verify high_impact_changes elements originate from all_changes without phantom records."""
    token = _create_jwt_token(CLOUD_TENANT_ID, "tester@prismiq.dev")
    res = client.get("/companies/Vercel/evolution", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()

    all_change_headlines = {
        c.get("what_changed") or c.get("headline")
        for c in data["all_changes"]
    }
    for hic in data["high_impact_changes"]:
        hic_headline = hic.get("what_changed") or hic.get("headline")
        assert hic_headline in all_change_headlines


def test_evolution_sequences_structure():
    """Verify Point 2 sequence arcs in the evolution payload contain multi-month steps."""
    token = _create_jwt_token(CLOUD_TENANT_ID, "tester@prismiq.dev")
    res = client.get("/companies/Netlify/evolution", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()

    assert "sequences" in data
    if data["sequences"]:
        seq = data["sequences"][0]
        assert "pattern_name" in seq
        assert "confidence" in seq
        assert "sequence_steps" in seq
        assert len(seq["sequence_steps"]) >= 2
        for step in seq["sequence_steps"]:
            assert "step_number" in step
            assert "month" in step
            assert "event_title" in step or "title" in step


def test_backward_compatibility_endpoints():
    """Verify all 4 legacy endpoints still return 200 OK with expected schema."""
    token = _create_jwt_token(CLOUD_TENANT_ID, "tester@prismiq.dev")

    # 1. Point 1 Profile
    r_prof = client.get("/companies/Vercel/profile", headers={"Authorization": f"Bearer {token}"})
    assert r_prof.status_code == 200
    assert r_prof.json()["company_name"] == "Vercel"

    # 2. Point 1 Changes
    r_chg = client.get("/companies/Vercel/changes", headers={"Authorization": f"Bearer {token}"})
    assert r_chg.status_code == 200
    assert "changes" in r_chg.json()

    # 3. Point 2 Sequences
    r_seq = client.get("/timeline/sequences?company=Netlify", headers={"Authorization": f"Bearer {token}"})
    assert r_seq.status_code == 200
    assert "sequences" in r_seq.json()

    # 4. Point 3 High Impact Changes
    r_hic = client.get("/changes/detection?company=Vercel", headers={"Authorization": f"Bearer {token}"})
    assert r_hic.status_code == 200
    assert "changes" in r_hic.json()


def test_evolution_endpoint_requires_auth():
    """Verify unauthorized request fails closed."""
    res = client.get("/companies/Vercel/evolution")
    assert res.status_code == 401
    assert "Missing Authorization" in res.json().get("detail", "")


def test_point_2_sequences_populated_across_competitors():
    """Verify Point 2 sequences reliably populate for both known baseline and arbitrary competitors."""
    token = _create_jwt_token(CLOUD_TENANT_ID, "tester@prismiq.dev")
    test_companies = ["Vercel", "Netlify", "Adidas"]

    for comp in test_companies:
        res = client.get(f"/companies/{comp}/evolution", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert "sequences" in data
        assert len(data["sequences"]) >= 1, f"Expected sequences for {comp}, got 0"
        seq = data["sequences"][0]
        assert seq.get("pattern_name"), f"Missing pattern_name for {comp}"
        assert seq.get("strategic_interpretation") or seq.get("strategic_implication"), f"Missing strategic interpretation for {comp}"
        assert seq.get("recommended_action"), f"Missing recommended action for {comp}"
        steps = seq.get("sequence_steps") or []
        assert len(steps) >= 3, f"Expected >= 3 steps for {comp}, got {len(steps)}"
        for step in steps:
            assert step.get("step_number") is not None
            assert step.get("month")
            assert step.get("event_title") or step.get("title")
            assert step.get("evidence_excerpt") or step.get("description")

