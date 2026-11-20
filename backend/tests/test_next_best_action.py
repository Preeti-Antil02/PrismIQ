"""
Unit and integration tests for PrismIQ Batch 2 Next Best Action Engine.
Verifies multi-persona recommendation generation (Sales, Product, Marketing, Leadership),
audit logging, and status lifecycles (accept, dismiss, complete, irrelevant).
"""

import pytest
from src import batch2_storage
from src import battlecard_storage
from src.next_best_action_engine import NextBestActionEngine

TENANT_ID = "22222222-3333-4444-5555-666666666666"


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()
    yield
    batch2_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


def test_generate_actions_for_all_teams():
    # Setup Customer Voice feedback with negative pricing & support
    feedback_rows = [
        {"company": "CompetitorZ", "category": "pricing_complaint", "aspect": "Pricing & Billing", "review": "Competitor pricing jumped 40% upon renewal."},
        {"company": "CompetitorZ", "category": "pricing_complaint", "aspect": "Pricing & Billing", "review": "Renewal fee hike is completely unreasonable."},
        {"company": "CompetitorZ", "category": "pricing_complaint", "aspect": "Pricing & Billing", "review": "Hidden charges in their enterprise tier."},
        {"company": "CompetitorZ", "category": "product_complaint", "aspect": "Integrations & API", "review": "Missing Salesforce and HubSpot native sync."},
        {"company": "CompetitorZ", "category": "product_complaint", "aspect": "Integrations & API", "review": "API webhooks fail frequently with timeout errors."},
    ]
    batch2_storage.save_feedback_records(feedback_rows, TENANT_ID)

    # Ingest themes
    batch2_storage.save_feedback_themes([
        {
            "company_name": "CompetitorZ",
            "theme_title": "Pricing & Billing - Pricing Complaint",
            "category": "pricing_complaint",
            "occurrence_count": 3,
            "sample_size": 3,
            "representative_quotes": [{"quote": "Renewal fee hike is completely unreasonable."}],
            "is_competitive_opportunity": True,
            "confidence": "High",
        },
        {
            "company_name": "CompetitorZ",
            "theme_title": "Integrations & API - Product Complaint",
            "category": "product_complaint",
            "occurrence_count": 2,
            "sample_size": 2,
            "representative_quotes": [{"quote": "Missing Salesforce native sync."}],
            "is_competitive_opportunity": False,
            "confidence": "Medium",
        },
    ], TENANT_ID)

    # Ingest Win/Loss deal losses
    deals = [
        {
            "deal_name": "Enterprise Deal 1",
            "primary_competitor": "CompetitorZ",
            "outcome": "lost",
            "deal_value": 80000,
            "decision_factors": ["Competitor discounting", "Missing Salesforce integration"],
            "buyer_objections": ["Integration gap with existing CRM stack"],
        },
        {
            "deal_name": "Enterprise Deal 2",
            "primary_competitor": "CompetitorZ",
            "outcome": "lost",
            "deal_value": 110000,
            "decision_factors": ["Missing Salesforce integration"],
            "buyer_objections": ["Salesforce connector required"],
        },
    ]
    batch2_storage.save_win_loss_deals(deals, TENANT_ID)

    # Ingest an active sales call with objection
    call = batch2_storage.save_sales_call({
        "call_title": "Q4 Prospect Sync",
        "competitors_mentioned": ["CompetitorZ"],
    }, TENANT_ID)
    batch2_storage.save_call_intelligence_items([
        {
            "call_id": call["id"],
            "item_type": "buyer_objection",
            "competitor_name": "CompetitorZ",
            "verbatim_quote": "Prospect expressed deep hesitation over our lack of HubSpot integration.",
        }
    ], TENANT_ID)

    engine = NextBestActionEngine(TENANT_ID)
    actions = engine.generate_actions(competitor_name="CompetitorZ")

    assert len(actions) >= 4

    teams = {a["affected_team"] for a in actions}
    # Must generate actions across teams
    assert "sales" in teams
    assert "product" in teams
    assert "marketing" in teams
    assert "leadership" in teams

    # Verify 9 required fields on every single action
    for a in actions:
        assert a["what_happened"]
        assert a["why_it_matters"]
        assert a["affected_team"] in ("sales", "product", "marketing", "leadership")
        assert a["recommended_action"]
        assert a["urgency"] in ("Critical", "High", "Medium", "Low")
        assert a["confidence"] in ("High", "Medium", "Low")
        assert isinstance(a["supporting_evidence"], (list, dict))
        assert a["related_competitor"] == "CompetitorZ"
        assert a["review_status"] == "pending"


def test_action_status_transitions_and_audit_trail():
    engine = NextBestActionEngine(TENANT_ID)

    # Create an initial action
    actions = batch2_storage.save_next_best_actions([
        {
            "what_happened": "Competitor increased pricing by 35%",
            "why_it_matters": "Immediate window to convert churn-risk accounts",
            "affected_team": "sales",
            "recommended_action": "Deploy TCO comparison objection script",
            "urgency": "High",
            "confidence": "High",
            "supporting_evidence": [{"source": "G2 Reviews", "n": 5}],
            "related_competitor": "CompetitorZ",
        }
    ], TENANT_ID)

    action_id = actions[0]["id"]
    assert actions[0]["review_status"] == "pending"

    # 1. Accept action
    updated = engine.update_action_status(
        action_id=action_id,
        new_status="accepted",
        changed_by="rep@prism-iq.com",
        reason="Assigned to mid-market SDR team for outreach campaign",
    )
    assert updated["review_status"] == "accepted"

    # 2. Complete action
    updated2 = engine.update_action_status(
        action_id=action_id,
        new_status="completed",
        changed_by="sdr-lead@prism-iq.com",
        reason="Campaign delivered to 45 target accounts",
    )
    assert updated2["review_status"] == "completed"

    # 3. Verify audit history
    audits = batch2_storage.list_action_audits(action_id=action_id, tenant_id=TENANT_ID)
    assert len(audits) == 2

    # Audit 1: pending -> accepted
    assert audits[0]["old_status"] == "pending"
    assert audits[0]["new_status"] == "accepted"
    assert audits[0]["changed_by"] == "rep@prism-iq.com"

    # Audit 2: accepted -> completed
    assert audits[1]["old_status"] == "accepted"
    assert audits[1]["new_status"] == "completed"
    assert audits[1]["changed_by"] == "sdr-lead@prism-iq.com"


def test_dismiss_and_irrelevant_transitions():
    engine = NextBestActionEngine(TENANT_ID)

    actions = batch2_storage.save_next_best_actions([
        {
            "what_happened": "Competitor discontinued legacy product",
            "why_it_matters": "Customers looking for replacements",
            "affected_team": "marketing",
            "recommended_action": "Launch targeted landing page",
            "urgency": "Medium",
            "confidence": "Medium",
            "supporting_evidence": [],
            "related_competitor": "CompetitorZ",
        }
    ], TENANT_ID)

    action_id = actions[0]["id"]

    # Dismiss
    dismissed = engine.update_action_status(
        action_id=action_id,
        new_status="dismissed",
        changed_by="pm@prism-iq.com",
        reason="Not relevant to our target tier",
    )
    assert dismissed["review_status"] == "dismissed"

    # Mark as irrelevant
    irrelevant = engine.update_action_status(
        action_id=action_id,
        new_status="irrelevant",
        changed_by="lead@prism-iq.com",
        reason="Customer base is outside our ICP",
    )
    assert irrelevant["review_status"] == "irrelevant"

    # Invalid status should raise ValueError
    with pytest.raises(ValueError):
        engine.update_action_status(action_id=action_id, new_status="invalid_status")
