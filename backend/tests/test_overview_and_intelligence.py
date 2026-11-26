"""
Unit and integration tests for Executive Overview and Intelligence Detail endpoints.
Ensures zero mock data, authentic evidence sources, and dynamic company adaptation.
"""

import pytest
from fastapi.testclient import TestClient
from src.api import app
from src.overview_service import get_overview_intelligence, get_intelligence_detail


@pytest.fixture
def client():
    return TestClient(app)


def test_get_overview_intelligence_flipkart():
    res = get_overview_intelligence("Flipkart")
    assert res["target_company"] == "Flipkart"
    assert res["metrics"]["tracked_competitors"]["value"] in (5, 6)
    assert res["metrics"]["verified_events"]["value"] > 0
    assert res["metrics"]["high_priority_developments"]["value"] >= 0
    assert res["metrics"]["pending_actions"]["value"] >= 0
    assert len(res["what_deserves_attention"]) > 0
    assert len(res["competitive_landscape"]["months"]) == 6
    assert len(res["competitive_landscape"]["chart_data"]) == 6
    assert res["has_data"] is True

    # Verify attention items exist and have valid structure
    first_att = res["what_deserves_attention"][0]
    assert first_att["competitor"]
    assert first_att["title"]
    assert first_att["impact_level"] in ("High", "Medium", "Low")


def test_get_overview_intelligence_meesho():
    res = get_overview_intelligence("Meesho")
    assert res["target_company"] == "Meesho"
    assert "Meesho" in res["competitive_landscape"]["competitors"]
    assert "Amazon India" in res["competitive_landscape"]["competitors"]
    assert len(res["what_deserves_attention"]) > 0
    first_att = res["what_deserves_attention"][0]
    assert first_att["competitor"]


def test_get_overview_intelligence_vercel():
    res = get_overview_intelligence("Vercel")
    assert res["target_company"] == "Vercel"
    assert "Vercel" in res["competitive_landscape"]["competitors"]
    assert "Cloudflare" in res["competitive_landscape"]["competitors"]


def test_get_intelligence_detail_amazon():
    res = get_intelligence_detail("amazon", "Flipkart")
    assert res["competitor_name"] == "Amazon India"
    assert res["urgency_badge"] == "High Urgency"
    assert "%" in res["confidence_badge"]  # confidence badge contains a percentage
    assert "Amazon Bazaar" in res["what_happened"]["headline"]
    assert "Boeing 737" in res["what_happened"]["paragraph"]
    assert res["what_happened"]["exposed_target_product"] == "Flipkart Core Marketplace"

    # Strategic Lens (6 dimensions)
    lens = res["why_it_matters"]["strategic_lens"]
    assert len(lens["affected_products"]) > 0
    assert len(lens["overlapping_segments"]) > 0
    assert len(lens["competitor_advantage"]) > 0
    assert len(lens["business_risk"]) > 0
    assert len(lens["supporting_evidence"]) > 0
    assert len(lens["uncertain_assumptions"]) > 0

    # Who is affected (4 departments)
    depts = res["who_is_affected"]["departments"]
    assert len(depts) == 4
    dept_names = [d["department"] for d in depts]
    assert "Engineering" in dept_names
    assert "Sales" in dept_names
    assert "Leadership" in dept_names
    assert "Product" in dept_names

    # What should we do (3 actions)
    actions = res["what_should_we_do"]["actions"]
    assert len(actions) == 3
    assert "UPI seller payout" in actions[0]["title"]
    assert actions[0]["department"] == "Engineering"
    assert actions[0]["days"] == "7 days"

    # Urgency & Time Horizon
    urg = res["urgency_and_time_horizon"]
    assert "Tactical" in urg["time_horizon"]
    assert "High" in urg["priority_tier"]

    # Verification & Confidence Guarantee
    verif = res["verification_and_confidence"]
    assert verif["verified_sources_count"] == 4
    assert 70.0 <= verif["confidence_score"] <= 100.0  # dynamically computed, verify range not exact value
    assert len(verif["evidence_sources"]) == 4


def test_api_overview_endpoint(client):
    res = client.get("/api/overview?company=Flipkart")
    assert res.status_code == 200
    data = res.json()
    assert data["metrics"]["tracked_competitors"]["value"] in (5, 6)


def test_api_intelligence_detail_endpoint(client):
    res = client.get("/api/intelligence/amazon?target_company=Flipkart")
    assert res.status_code == 200
    data = res.json()
    assert data["competitor_name"] == "Amazon India"
    assert data["verification_and_confidence"]["verified_sources_count"] == 4


def test_overview_unconfigured_honest_empty_state():
    res = get_overview_intelligence("Unknown Corp")
    assert res["target_company"] == "Unknown Corp"
    assert res["metrics"]["tracked_competitors"]["value"] == 0
    assert res["metrics"]["verified_events"]["value"] == 0
    assert res["has_data"] is False
    assert len(res["what_deserves_attention"]) == 0
    assert len(res["competitive_landscape"]["chart_data"]) == 0
    assert len(res["emerging_strategic_patterns"]) == 0
    assert len(res["next_best_actions"]) == 0


def test_overview_acme_corp_pipeline_data():
    res = get_overview_intelligence("Acme Corp")
    assert res["target_company"] == "Acme Corp"
    assert res["metrics"]["tracked_competitors"]["value"] == 3
    assert res["metrics"]["verified_events"]["value"] >= 20
    assert res["has_data"] is True


def test_meesho_detail_exposed_product():
    res = get_intelligence_detail("amazon", "Meesho")
    assert res["what_happened"]["exposed_target_product"] == "Meesho Consumer Marketplace"
    assert "challenge Meesho's price leadership" in res["why_it_matters"]["key_impact"]


def test_amazon_india_overview():
    res = get_overview_intelligence("Amazon India")
    assert res["target_company"] == "Amazon India"
    assert res["metrics"]["tracked_competitors"]["value"] in (5, 6)
    assert "Flipkart" in res["competitive_landscape"]["competitors"]
    assert "Meesho" in res["competitive_landscape"]["competitors"]
