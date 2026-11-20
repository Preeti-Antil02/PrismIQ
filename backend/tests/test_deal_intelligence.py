"""
Unit and integration tests for PrismIQ Batch 2 Deal Intelligence Service.
Verifies dossier generation, battlecard linking, objection mitigation,
and strict zero-hallucination historical deal guarantees.
"""

import pytest
from src import batch2_storage
from src import battlecard_storage
from src.deal_intelligence_service import DealIntelligenceService

TENANT_ID = "11111111-2222-3333-4444-555555555555"


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()
    yield
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


def test_dossier_generation_with_evidence_and_battlecard():
    # Setup Battlecard & Claims for CompetitorAlpha
    card = battlecard_storage.save_battlecard({
        "target_company": "Acme",
        "competitor_name": "CompetitorAlpha",
        "title": "Acme vs CompetitorAlpha Battlecard",
        "status": "published",
    }, TENANT_ID)

    claim = battlecard_storage.save_claim({
        "company_name": "CompetitorAlpha",
        "claim_type": "objections_responses",
        "subject": "CompetitorAlpha is cheaper",
        "statement": "CompetitorAlpha charges high hidden fees for API calls.",
        "fact_impact_act": {
            "fact": "Base price is lower but API consumption fees are steep",
            "impact": "Prospective buyers assume competitor is less expensive",
            "act": "Provide TCO calculator highlighting API usage projections",
        },
    }, TENANT_ID)

    # Ingest historical deals for CompetitorAlpha: 2 wins, 1 loss (total 3 deals)
    deals = [
        {
            "deal_name": "Deal Alpha 1",
            "competitor_name": "CompetitorAlpha",
            "deal_stage": "closed_won",
            "deal_value": 75000,
            "decision_factors": ["Better enterprise compliance", "Transparent pricing"],
        },
        {
            "deal_name": "Deal Alpha 2",
            "competitor_name": "CompetitorAlpha",
            "deal_stage": "closed_won",
            "deal_value": 120000,
            "decision_factors": ["Fast deployment time"],
        },
        {
            "deal_name": "Deal Alpha 3",
            "competitor_name": "CompetitorAlpha",
            "deal_stage": "closed_lost",
            "deal_value": 50000,
            "decision_factors": ["Competitor discounting"],
        },
    ]
    batch2_storage.save_win_loss_deals(deals, TENANT_ID)

    svc = DealIntelligenceService(TENANT_ID)

    dossier = svc.generate_deal_dossier(
        deal_name="MegaCorp Enterprise Renewal",
        competitors_involved=["CompetitorAlpha"],
        target_company="Acme",
        crm_notes="MegaCorp mentioned CompetitorAlpha offered 20% discount. Customer worried about our API price.",
        customer_requirements=["High-volume API integration", "SOC2 compliance"],
        deal_value=150000.0,
    )

    assert dossier["deal_name"] == "MegaCorp Enterprise Renewal"
    assert "CompetitorAlpha" in dossier["competitors_involved"]
    assert dossier["competitive_threat"] in ("High", "Critical", "Medium")

    # Objections and recommended responses
    assert len(dossier["customer_objections"]) >= 1
    assert any("price" in obj.lower() or "api" in obj.lower() for obj in dossier["customer_objections"])
    assert len(dossier["recommended_sales_responses"]) >= 1

    # Historical proof points (strictly verified)
    proof_points = dossier["historical_proof_points"]
    assert len(proof_points) >= 1
    alpha_proof = next(p for p in proof_points if p["competitor"] == "CompetitorAlpha")
    assert alpha_proof["historical_deals_count"] == 3
    assert alpha_proof["wins_against"] == 2
    assert alpha_proof["losses_against"] == 1
    assert "Transparent pricing" in alpha_proof["winning_factors"]

    # Verify dossier was saved to storage
    stored = batch2_storage.get_deal_dossier(dossier["id"], TENANT_ID)
    assert stored is not None
    assert stored["deal_name"] == dossier["deal_name"]


def test_zero_hallucination_when_no_historical_data():
    """
    CRITICAL RULE: Never invent previous successful deals or customer proof points.
    When a competitor has zero historical deals in the database, the proof points
    must show 0 sample size and explicitly state insufficient historical records.
    """
    svc = DealIntelligenceService(TENANT_ID)

    dossier = svc.generate_deal_dossier(
        deal_name="Unknown Competitor Deal",
        competitors_involved=["BrandNewRival"],
        target_company="Acme",
        crm_notes="Client mentioned BrandNewRival is also bidding.",
        deal_value=45000.0,
    )

    proof_points = dossier["historical_proof_points"]
    assert len(proof_points) == 1
    rival_proof = proof_points[0]
    assert rival_proof["competitor"] == "BrandNewRival"
    assert rival_proof["historical_deals_count"] == 0
    assert rival_proof["wins_against"] == 0
    assert rival_proof["losses_against"] == 0
    assert rival_proof["winning_factors"] == []
    assert rival_proof["loss_factors"] == []
    assert rival_proof["has_sufficient_data"] is False
    assert "insufficient historical data" in rival_proof["data_note"].lower()
