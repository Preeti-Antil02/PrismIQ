"""
Unit & Integration Tests for Sales Call Intelligence (Batch 2).
Tests speaker turn segmentation, 9-category signal extraction,
and linkage to Batch 1 claims.
"""

import pytest
from src import batch2_storage
from src import battlecard_storage
from src.sales_call_service import SalesCallService

TENANT_ID = "55555555-5555-5555-5555-555555555555"


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


def test_parse_speaker_turns():
    transcript = """Prospect (01:15): Hi, thanks for taking the time to show us the platform.
Rep [01:25]: Absolutely, excited to dive in.
Prospect (02:40): We've been looking at CompetitorX as well. Their pricing is a bit cheaper.
Rep (03:10): That's fair. Let's look at what's included in our enterprise tier."""

    turns = SalesCallService.parse_speaker_turns(transcript)
    assert len(turns) == 4
    assert turns[0]["speaker"] == "Prospect"
    assert turns[0]["timestamp"] == "01:15"
    assert "show us the platform" in turns[0]["text"]
    assert turns[2]["speaker"] == "Prospect"
    assert turns[2]["timestamp"] == "02:40"
    assert "CompetitorX" in turns[2]["text"]


def test_extract_signals_and_link_claims():
    # Setup an existing Batch 1 battlecard claim for CompetitorX
    claim = battlecard_storage.save_claim({
        "company_name": "CompetitorX",
        "claim_type": "objections_responses",
        "subject": "CompetitorX is cheaper",
        "statement": "While CompetitorX has lower upfront pricing, their renewal jumps 40%.",
        "fact_impact_act": {
            "fact": "CompetitorX pricing is initially cheaper",
            "impact": "Buyers hesitate on our initial quote",
            "act": "Show 3-year TCO comparison and renewal rate guarantees",
        },
    }, TENANT_ID)

    svc = SalesCallService(TENANT_ID)

    transcript = """
John Doe (02:10): We are currently evaluating CompetitorX alongside your solution.
Sarah (03:00): Understood. What are the key priorities for your security team?
John Doe (04:15): We require strict SOC2 Type II compliance and SAML SSO integration.
John Doe (05:20): One concern we have is your pricing is significantly more expensive than CompetitorX.
John Doe (06:00): Also, their team told us they already have a native ServiceNow connector.
John Doe (07:30): If you can match our budget and confirm SOC2, we are ready to sign by the end of the month.
"""

    res = svc.ingest_transcript(
        transcript_text=transcript,
        call_title="Enterprise Discovery Call",
        known_competitors=["CompetitorX"],
    )

    assert res["items_count"] >= 5
    assert "CompetitorX" in res["competitors_mentioned"]

    item_types = [itm["item_type"] for itm in res["items"]]
    assert "competitor_mention" in item_types
    assert "customer_requirement" in item_types
    assert "pricing_discussion" in item_types
    assert "buying_signal" in item_types

    # Verify claim linkage: the pricing/objection item linked to the saved claim
    linked_items = [itm for itm in res["items"] if itm.get("linked_claim_id") == claim["id"]]
    assert len(linked_items) >= 1
    assert "pricing" in linked_items[0]["verbatim_quote"].lower()
