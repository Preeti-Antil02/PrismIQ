"""
Unit & Integration Tests for Win/Loss Intelligence (Batch 2).
Tests deal ingestion, factor extraction, sample size thresholds (N < 3),
and zero-fabrication guarantees.
"""

import pytest
from src import batch2_storage
from src.win_loss_service import WinLossService

TENANT_ID = "44444444-4444-4444-4444-444444444444"


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()


def test_empty_deals_analytics():
    svc = WinLossService(TENANT_ID)
    res = svc.get_analytics(competitor_name="NonExistentCorp")
    assert res["status"] == "no_data"
    assert res["total_deals"] == 0
    assert res["win_rate_percentage"] is None
    assert "Upload CRM exports" in res["sample_size_warning"]


def test_insufficient_sample_size_handling():
    svc = WinLossService(TENANT_ID)

    # Ingest only 2 deals (N < 3)
    deals = [
        {
            "deal_name": "Acme Renewal",
            "outcome": "won",
            "deal_value": 50000,
            "primary_competitor": "SmallRival",
            "notes": "Won on customer support SLA and quick turnaround.",
        },
        {
            "deal_name": "Beta Expansion",
            "outcome": "lost",
            "deal_value": 30000,
            "primary_competitor": "SmallRival",
            "notes": "Lost due to pricing budget constraint.",
        },
    ]
    svc.ingest_deals(deals)

    res = svc.get_analytics(competitor_name="SmallRival")
    assert res["total_deals"] == 2
    assert res["sample_size"] == 2
    assert res["status"] == "insufficient_data"
    assert res["confidence"] == "Low"
    # STRICT NON-NEGOTIABLE RULE: Win rate must NOT be presented as a statistical metric on insufficient samples
    assert res["win_rate_percentage"] is None
    assert "Small sample size (n = 2 deals)" in res["sample_size_warning"]


def test_valid_sample_analytics_and_factor_extraction():
    svc = WinLossService(TENANT_ID)

    # Ingest 5 deals against BigRival (N >= 3)
    deals = [
        {
            "deal_name": "Deal 1",
            "outcome": "won",
            "deal_value": 100000,
            "primary_competitor": "BigRival",
            "winning_factor": "Stronger security governance",
            "notes": "Won because we had SSO and SOC2 ready.",
        },
        {
            "deal_name": "Deal 2",
            "outcome": "won",
            "deal_value": 80000,
            "primary_competitor": "BigRival",
            "winning_factor": "Turnkey workflow flexibility",
            "notes": "Customer loved our flexibility over BigRival.",
        },
        {
            "deal_name": "Deal 3",
            "outcome": "lost",
            "deal_value": 120000,
            "primary_competitor": "BigRival",
            "loss_factor": "BigRival discounted 50%",
            "buyer_objections": ["Expensive", "Budget freeze"],
            "notes": "Lost on pricing budget freeze.",
        },
        {
            "deal_name": "Deal 4",
            "outcome": "lost",
            "deal_value": 90000,
            "primary_competitor": "BigRival",
            "loss_factor": "BigRival has deeper connectors",
            "buyer_objections": ["Missing integrations", "Budget freeze"],
            "notes": "Missing native ServiceNow connector.",
        },
        {
            "deal_name": "Deal 5",
            "outcome": "lost",
            "deal_value": 110000,
            "primary_competitor": "BigRival",
            "buyer_objections": ["Budget freeze"],
            "notes": "Executive budget freeze.",
        },
    ]
    svc.ingest_deals(deals)

    res = svc.get_analytics(competitor_name="BigRival")
    assert res["status"] == "valid_sample"
    assert res["total_deals"] == 5
    assert res["confidence"] in ("Medium", "High")
    # 2 won out of 5 decided = 40.0%
    assert res["win_rate_percentage"] == 40.0
    assert res["outcomes"]["won"] == 2
    assert res["outcomes"]["lost"] == 3
    assert res["financials"]["total_pipeline_value"] == 500000

    # Verify factor extractions
    assert len(res["top_loss_factors"]) >= 1
    assert any("pricing" in f["factor"].lower() or "missing" in f["factor"].lower() for f in res["top_loss_factors"])

    # Verify emerging loss patterns
    assert len(res["emerging_patterns"]) >= 1
    assert "Budget freeze" in res["emerging_patterns"][0]["pattern"]
