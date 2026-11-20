"""
Unit & Integration Tests for Customer Voice Intelligence (Batch 2).
Tests 8-category classification, theme aggregation with sample sizes,
and competitor vs target company opportunity analysis.
"""

import pytest
from src import batch2_storage
from src.customer_voice_service import CustomerVoiceService

TENANT_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture(autouse=True)
def reset_storage():
    batch2_storage.clear_tenant_cache()


def test_classify_all_8_categories():
    svc = CustomerVoiceService(TENANT_ID)

    # 1. love
    cat, sent, asp = svc.classify_statement("We absolutely love their fast search and clean UI.")
    assert cat == "love"
    assert sent == "positive"

    # 2. dislike
    cat, sent, asp = svc.classify_statement("The navigation is clunky and annoying to use daily.")
    assert cat == "dislike"
    assert sent == "negative"

    # 3. feature_request
    cat, sent, asp = svc.classify_statement("We really wish they had support for SCIM user provisioning.")
    assert cat == "feature_request"
    assert sent == "neutral"

    # 4. product_complaint
    cat, sent, asp = svc.classify_statement("Frequent timeout errors and broken dashboard syncs are terrible.")
    assert cat == "product_complaint"
    assert sent == "negative"

    # 5. pricing_complaint
    cat, sent, asp = svc.classify_statement("Their pricing jumped 40% with hidden fees and expensive seat minimums.")
    assert cat == "pricing_complaint"
    assert sent == "negative"
    assert asp == "Pricing & Billing"

    # 6. onboarding_issue
    cat, sent, asp = svc.classify_statement("Onboarding took 4 months and the setup documentation was confusing.")
    assert cat == "onboarding_issue"
    assert sent == "negative"
    assert asp == "Onboarding & Setup"

    # 7. reason_for_switching
    cat, sent, asp = svc.classify_statement("We switched to another vendor because their support stopped responding.")
    assert cat == "reason_for_switching"
    assert sent == "negative"

    # 8. reason_for_choosing_competitor
    cat, sent, asp = svc.classify_statement("We chose RivalApp because of their turnkey Slack and Jira integrations.")
    assert cat == "reason_for_choosing_competitor"
    assert sent == "positive"


def test_ingest_and_aggregate_themes():
    svc = CustomerVoiceService(TENANT_ID)

    feedback_rows = [
        {"review": "Setup took 3 months and onboarding was awful.", "company": "CompetitorX"},
        {"review": "Onboarding was delayed by 6 weeks due to bad setup docs.", "company": "CompetitorX"},
        {"review": "We love their search latency and blazingly fast indexing.", "company": "CompetitorX"},
    ]

    saved = svc.ingest_feedback_rows(feedback_rows, default_company="CompetitorX")
    assert len(saved) == 3

    # Check themes generated for CompetitorX
    themes = batch2_storage.list_feedback_themes(TENANT_ID, company_name="CompetitorX")
    assert len(themes) >= 2

    onboarding_theme = next((t for t in themes if "Onboarding" in t["theme_title"]), None)
    assert onboarding_theme is not None
    assert onboarding_theme["occurrence_count"] == 2
    assert onboarding_theme["sample_size"] == 2
    assert onboarding_theme["sentiment_breakdown"]["negative"] == 2
    assert len(onboarding_theme["representative_quotes"]) == 2


def test_competitive_comparison_opportunities():
    svc = CustomerVoiceService(TENANT_ID)

    # Ingest negative competitor feedback in Support & Pricing
    competitor_reviews = [
        {"review": "Competitor support ticket SLA took 8 days with no response.", "company": "CompetitorY"},
        {"review": "Support agent was totally unhelpful and slow to resolve.", "company": "CompetitorY"},
        {"review": "Pricing is expensive and renewal fees are unreasonable.", "company": "CompetitorY"},
    ]
    svc.ingest_feedback_rows(competitor_reviews, default_company="CompetitorY")

    # Ingest positive target company feedback in Support
    target_reviews = [
        {"review": "We love their customer support SLA, responses within 10 minutes!", "company": "OurCompany"},
    ]
    svc.ingest_feedback_rows(target_reviews, default_company="OurCompany")

    opp_report = svc.generate_competitive_opportunities(
        target_company="OurCompany",
        competitor_name="CompetitorY",
    )

    assert opp_report["competitor_name"] == "CompetitorY"
    assert opp_report["opportunities_found"] >= 1

    support_opp = next((o for o in opp_report["opportunities"] if "Support" in o["aspect"]), None)
    assert support_opp is not None
    assert support_opp["complaint_count"] == 2
    assert len(support_opp["our_counter_strengths"]) >= 1
    assert "Customer Voice" in support_opp["our_counter_strengths"][0]["type"]
