"""
Automated Integration and Unit Test Suite for PrismIQ Batch 3:
- Deal Management (Creation, Updates, Stage Transitions, History, Attachments)
- Sales Transcript Intelligence (8 Canonical Extraction Categories, Grounding)
- Deal Context Retrieval (Competitor Profiles, Battlecards, Claims, Evidence, Win/Loss, Events)
- Competitive Response Generation (Verified vs Insufficient Evidence Review Flags)
- Next Best Action Engine (Sales, Product, Marketing, Leadership, Engineering, Deduplication)
- Lightweight Outcome Tracking (Non-Causation Recorded Association)
- Tenant Isolation across all Batch 3 entities
- Missing and Contradictory Information Handling
"""

import pytest
import uuid
from fastapi.testclient import TestClient

from src.api import app, _create_jwt_token
from src import batch2_storage, batch3_storage, battlecard_storage
from src.deal_context_service import DealContextService
from src.deal_intelligence_service import DealIntelligenceService
from src.next_best_action_engine import NextBestActionEngine
from src.outcome_tracking_service import OutcomeTrackingService
from src.sales_call_service import SalesCallService

client = TestClient(app)

TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


@pytest.fixture(autouse=True)
def reset_storage_caches():
    batch2_storage.clear_tenant_cache()
    batch3_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()
    yield
    batch2_storage.clear_tenant_cache()
    batch3_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


def _get_auth_headers(tenant_id: str, email: str = "sales_lead@prismiq.dev") -> dict:
    token = _create_jwt_token(tenant_id, email)
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# 1. Deal Management Tests (Creation, Updates, Attachments, Stage History)
# ============================================================================

def test_deal_creation_and_lifecycle_updates():
    headers = _get_auth_headers(TENANT_A)

    # 1. Create deal
    create_payload = {
        "deal_name": "Acme FinTech Cloud Migration",
        "customer": "Acme Financial Services",
        "stage": "discovery",
        "associated_competitors": ["AWS", "Azure"],
        "description": "Evaluating hybrid cloud architecture with regulatory compliance constraints.",
        "deal_value": 350000.0,
        "customer_segment": "enterprise",
        "industry": "Financial Services",
    }
    res = client.post("/api/deals", json=create_payload, headers=headers)
    assert res.status_code == 201
    deal = res.json()["deal"]
    deal_id = deal["id"]
    assert deal["deal_name"] == "Acme FinTech Cloud Migration"
    assert deal["customer"] == "Acme Financial Services"
    assert deal["stage"] == "discovery"
    assert "AWS" in deal["associated_competitors"]
    assert deal["deal_value"] == 350000.0

    # 2. Update stage and value
    update_payload = {
        "stage": "negotiation",
        "deal_value": 380000.0,
        "stage_change_notes": "Passed security review; entered final commercial terms negotiation.",
        "user_id": "sarah_rep",
    }
    res_update = client.patch(f"/api/deals/{deal_id}", json=update_payload, headers=headers)
    assert res_update.status_code == 200
    updated_deal = res_update.json()["deal"]
    assert updated_deal["stage"] == "negotiation"
    assert updated_deal["deal_value"] == 380000.0

    # 3. Verify stage history was preserved
    res_history = client.get(f"/api/deals/{deal_id}/history", headers=headers)
    assert res_history.status_code == 200
    history = res_history.json()["history"]
    assert len(history) >= 2
    # First entry: created, Second entry: transition to negotiation
    assert history[0]["to_stage"] == "discovery"
    assert history[1]["from_stage"] == "discovery"
    assert history[1]["to_stage"] == "negotiation"
    assert history[1]["changed_by"] == "sarah_rep"
    assert "Passed security review" in history[1]["notes"]


def test_deal_attachments_flow():
    headers = _get_auth_headers(TENANT_A)

    # Create deal
    deal = batch3_storage.save_deal({
        "deal_name": "Global Retail Expansion",
        "customer": "RetailCo",
        "stage": "qualification",
    }, TENANT_A)
    deal_id = deal["id"]

    # Add attachment
    att_payload = {
        "filename": "security_rfp_response.pdf",
        "file_format": "pdf",
        "file_url": "https://vault.prismiq.dev/docs/rfp_101.pdf",
        "metadata": {"pages": 24, "reviewed_by": "infosec"},
    }
    res = client.post(f"/api/deals/{deal_id}/attachments", json=att_payload, headers=headers)
    assert res.status_code == 201
    att = res.json()["attachment"]
    assert att["filename"] == "security_rfp_response.pdf"
    assert att["deal_id"] == deal_id

    # List attachments
    res_list = client.get(f"/api/deals/{deal_id}/attachments", headers=headers)
    assert res_list.status_code == 200
    items = res_list.json()["attachments"]
    assert len(items) == 1
    assert items[0]["id"] == att["id"]


# ============================================================================
# 2. Sales Transcript Intelligence (8 Canonical Categories)
# ============================================================================

def test_sales_transcript_extraction_all_eight_categories():
    headers = _get_auth_headers(TENANT_A)

    deal = batch3_storage.save_deal({
        "deal_name": "Healthcare Analytics Deal",
        "customer": "HealthHealth",
        "stage": "proposal",
        "associated_competitors": ["CompetitorAlpha"],
    }, TENANT_A)
    deal_id = deal["id"]

    # Verbatim transcript containing 8 explicit categories
    transcript = """
Buyer (01:10): Thanks for the call. We are actively reviewing CompetitorAlpha as well.
Buyer (02:00): Our primary goal with this project is ensuring zero downtime for clinical telemetry.
Buyer (03:15): How do you compare versus CompetitorAlpha on analytics latency?
Buyer (04:00): One major concern is your pricing seems significantly higher than CompetitorAlpha.
Buyer (05:00): Also, we require strict HIPAA compliance and SAML SSO integration as our mandatory decision criteria.
Buyer (06:30): If you can include dedicated support and confirm HIPAA, we are ready to sign by end of quarter.
Buyer (07:15): But if leadership rejects the additional budget, there is a risk of budget freeze until next year.
"""

    payload = {
        "call_title": "Q3 Technical Deep-Dive",
        "transcript_text": transcript,
        "known_competitors": ["CompetitorAlpha"],
    }

    res = client.post(f"/api/deals/{deal_id}/transcripts", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert data["deal_id"] == deal_id
    assert "CompetitorAlpha" in data["competitors_mentioned"]

    intel = data["extracted_intelligence"]

    # 1. Competitor mentions
    assert len(intel["competitor_mentions"]) >= 1
    assert intel["competitor_mentions"][0]["competitor_name"] == "CompetitorAlpha"
    assert intel["competitor_mentions"][0]["timestamp_offset"] == "01:10"

    # 2. Customer objections
    assert len(intel["customer_objections"]) >= 1
    assert any("pricing" in o["verbatim_quote"].lower() or "concern" in o["verbatim_quote"].lower() for o in intel["customer_objections"])

    # 3. Pricing concerns
    assert len(intel["pricing_concerns"]) >= 1
    assert any("pricing" in p["verbatim_quote"].lower() for p in intel["pricing_concerns"])

    # 4. Feature comparisons
    assert len(intel["feature_comparisons"]) >= 1
    assert any("compare" in f["verbatim_quote"].lower() for f in intel["feature_comparisons"])

    # 5. Buying signals
    assert len(intel["buying_signals"]) >= 1
    assert any("ready to sign" in b["verbatim_quote"].lower() for b in intel["buying_signals"])

    # 6. Decision criteria
    assert len(intel["decision_criteria"]) >= 1
    assert any("hipaa" in d["verbatim_quote"].lower() or "require" in d["verbatim_quote"].lower() for d in intel["decision_criteria"])

    # 7. Competitive threats
    assert len(intel["competitive_threats"]) >= 1
    assert any("freeze" in t["verbatim_quote"].lower() for t in intel["competitive_threats"])

    # 8. Important customer statements
    assert len(intel["important_customer_statements"]) >= 1
    assert any("primary goal" in s["verbatim_quote"].lower() for s in intel["important_customer_statements"])

    # Verify transcript is linked to deal
    res_deal = client.get(f"/api/deals/{deal_id}", headers=headers)
    assert len(res_deal.json()["deal"]["transcripts"]) >= 1


def test_transcript_no_hallucinations_on_clean_neutral_text():
    """Verify system does not invent statements or infer buying signals without context."""
    headers = _get_auth_headers(TENANT_A)
    deal = batch3_storage.save_deal({"deal_name": "Neutral Conversation", "customer": "BetaCorp"}, TENANT_A)

    neutral_transcript = """
Buyer (00:30): Good morning. We are just conducting general market research today.
Rep (01:00): Great to meet you. We can walk through our standard product deck.
Buyer (01:30): Sounds good, thank you.
"""
    res = client.post(f"/api/deals/{deal['id']}/transcripts", json={"transcript_text": neutral_transcript}, headers=headers)
    assert res.status_code == 201
    intel = res.json()["extracted_intelligence"]
    assert len(intel["buying_signals"]) == 0
    assert len(intel["pricing_concerns"]) == 0
    assert len(intel["competitive_threats"]) == 0


# ============================================================================
# 3. Deal Context Retrieval (Profiles, Battlecards, Claims, Evidence, Events)
# ============================================================================

def test_deal_context_retrieval_grounding():
    headers = _get_auth_headers(TENANT_A)

    # 1. Setup competitor battlecard, verified claim, and evidence
    battlecard_storage.save_battlecard({
        "company_name": "CompetitorX",
        "title": "CompetitorX Sales Battlecard",
        "status": "published",
        "current_version": 2,
    }, TENANT_A)

    claim = battlecard_storage.save_claim({
        "company_name": "CompetitorX",
        "claim_type": "pricing_comparison",
        "subject": "CompetitorX pricing is opaque",
        "statement": "CompetitorX charges 3x overage multipliers once consumption exceeds base allowance.",
        "verification_status": "verified",
        "fact_impact_act": {
            "fact": "CompetitorX overage multipliers are 300%",
            "impact": "Prospect bill shock in month 3",
            "act": "Provide transparent multi-year capped pricing agreement",
        },
    }, TENANT_A)

    battlecard_storage.save_claim_evidence({
        "claim_id": claim["id"],
        "source_url": "https://industry-benchmark.org/reports/pricing_study.pdf",
        "excerpt": "Analysis showed overage rates average 3.2x base consumption fees for CompetitorX.",
        "relationship": "supports",
        "source_quality": "primary",
    }, TENANT_A)

    # Setup historical deals: 3 deals (sample size >= 3)
    batch2_storage.save_win_loss_deals([
        {"deal_name": "Deal 1", "primary_competitor": "CompetitorX", "outcome": "won", "decision_factors": ["Transparent pricing"]},
        {"deal_name": "Deal 2", "primary_competitor": "CompetitorX", "outcome": "won", "decision_factors": ["Predictable costs"]},
        {"deal_name": "Deal 3", "primary_competitor": "CompetitorX", "outcome": "lost", "decision_factors": ["Initial discount"]},
    ], TENANT_A)

    # 2. Create deal with CompetitorX
    deal = batch3_storage.save_deal({
        "deal_name": "Omega Corp Enterprise Pursuit",
        "customer": "Omega Corp",
        "stage": "proposal",
        "associated_competitors": ["CompetitorX"],
        "buyer_objections": ["Prospect worried about pricing structure and overage costs"],
    }, TENANT_A)

    # 3. Fetch deal context
    res = client.get(f"/api/deals/{deal['id']}/context", headers=headers)
    assert res.status_code == 200
    ctx = res.json()["context"]

    # Verify Competitor Profile
    assert len(ctx["competitor_profiles"]) >= 1
    assert ctx["competitor_profiles"][0]["company_name"] == "CompetitorX"

    # Verify Published Battlecard
    assert len(ctx["published_battlecards"]) >= 1
    assert ctx["published_battlecards"][0]["competitor_name"] == "CompetitorX"
    assert ctx["published_battlecards"][0]["status"] == "published"

    # Verify Verified Claims & Supporting Evidence
    assert len(ctx["verified_claims"]) >= 1
    matched_claim = next(c for c in ctx["verified_claims"] if c["id"] == claim["id"])
    assert matched_claim["verification_status"] == "verified"
    assert len(matched_claim["evidence"]) >= 1
    assert "https://industry-benchmark.org" in matched_claim["evidence"][0]["source_url"]

    # Verify Historical Win/Loss with statistical validity
    hw = ctx["historical_win_loss"][0]
    assert hw["competitor_name"] == "CompetitorX"
    assert hw["has_sufficient_data"] is True
    assert hw["sample_size"] == 3
    assert hw["win_rate_percent"] == 66.7
    assert "Transparent pricing" in hw["winning_factors"]


# ============================================================================
# 4. Competitive Response Generation & Review Flags
# ============================================================================

def test_competitive_response_generation_insufficient_vs_verified_evidence():
    headers = _get_auth_headers(TENANT_A)

    # Competitor Y has NO claims and NO evidence in knowledge base
    deal = batch3_storage.save_deal({
        "deal_name": "Delta Enterprise SaaS",
        "customer": "Delta Holdings",
        "stage": "discovery",
        "associated_competitors": ["CompetitorY"],
        "description": "Delta mentioned CompetitorY has a proprietary AI engine that reduces indexing time.",
        "buyer_objections": ["CompetitorY claimed 10x faster indexing than your product"],
    }, TENANT_A)

    # Generate response recommendations
    res = client.post(f"/api/deals/{deal['id']}/recommendations", headers=headers)
    assert res.status_code == 201
    data = res.json()
    recs = data["recommendations"]
    assert len(recs) >= 1

    # Because CompetitorY has NO verified claims/evidence, must explicitly mark requires_review = True
    insufficient_rec = recs[0]
    assert insufficient_rec["requires_review"] is True
    assert insufficient_rec["evidence_status"] == "insufficient"
    assert "insufficient" in insufficient_rec["reasoning"].lower() or "requires" in insufficient_rec["reasoning"].lower()


# ============================================================================
# 5. Next Best Action Engine & Deduplication
# ============================================================================

def test_next_best_actions_cross_department_and_deduplication():
    headers = _get_auth_headers(TENANT_A)

    # Setup underlying call with technical requirement (Engineering), customer complaint (Product), objection (Sales)
    deal = batch3_storage.save_deal({
        "deal_name": "Sigma Global Rollout",
        "customer": "Sigma Corp",
        "stage": "qualification",
        "associated_competitors": ["CompetitorZ"],
    }, TENANT_A)

    transcript = """
Buyer (01:00): We are testing CompetitorZ.
Buyer (02:00): One major concern is CompetitorZ claims your API has high latency.
Buyer (03:00): Furthermore, we require SAML SSO and SOC2 Type II compliance as an engineering prerequisite.
"""
    client.post(f"/api/deals/{deal['id']}/transcripts", json={"transcript_text": transcript, "known_competitors": ["CompetitorZ"]}, headers=headers)

    # 1. Generate Next Best Actions
    res_gen = client.post(f"/api/actions/generate?deal_id={deal['id']}&competitor_name=CompetitorZ", headers=headers)
    assert res_gen.status_code == 201
    actions = res_gen.json()["actions"]
    assert len(actions) >= 2

    departments = [a.get("department") or a.get("team") for a in actions]
    assert "Sales" in departments
    assert "Engineering" in departments

    eng_action = next(a for a in actions if (a.get("department") or a.get("team")) == "Engineering")
    assert eng_action["priority"] in ("Critical", "High", "Medium")
    assert "SAML" in eng_action["description"] or "SOC2" in eng_action["description"] or "technical" in eng_action["description"].lower()
    assert eng_action["status"] == "Pending"

    # 2. Duplicate Prevention: Generating again for the same deal/event should NOT create duplicate actions
    res_gen2 = client.post(f"/api/actions/generate?deal_id={deal['id']}&competitor_name=CompetitorZ", headers=headers)
    assert res_gen2.status_code == 201
    actions2 = res_gen2.json()["actions"]
    assert len(actions2) == len(actions)

    res_all = client.get(f"/api/actions?deal_id={deal['id']}", headers=headers)
    assert len(res_all.json()["actions"]) == len(actions)


def test_action_status_transitions_and_completion_timestamp():
    headers = _get_auth_headers(TENANT_A)

    action = batch2_storage.save_next_best_action({
        "department": "Engineering",
        "title": "Implement SAML SSO Connector",
        "description": "Develop and verify SAML SSO workflow for enterprise prospect.",
        "priority": "High",
        "status": "Pending",
    }, TENANT_A)
    action_id = action["id"]
    assert action["status"] == "Pending"
    assert action.get("completed_at") is None

    # Transition to In Progress
    res_prog = client.patch(f"/api/actions/{action_id}/status", json={
        "status": "In Progress",
        "owner": "engineer_dave",
        "due_date": "2026-12-01",
        "notes": "Sprint ticket created and assigned to Dave.",
    }, headers=headers)
    assert res_prog.status_code == 200
    prog_action = res_prog.json()["action"]
    assert prog_action["status"] == "In Progress"
    assert prog_action["owner"] == "engineer_dave"

    # Transition to Completed -> Must set completed_at
    res_comp = client.patch(f"/api/actions/{action_id}/status", json={
        "status": "Completed",
        "notes": "SAML integration passed QA and merged to staging.",
    }, headers=headers)
    assert res_comp.status_code == 200
    comp_action = res_comp.json()["action"]
    assert comp_action["status"] == "Completed"
    assert comp_action.get("completed_at") is not None

    # Verify audit history log
    res_hist = client.get(f"/api/actions/{action_id}/history", headers=headers)
    assert res_hist.status_code == 200
    audits = res_hist.json()["audits"]
    assert len(audits) >= 2
    assert audits[0]["new_status"] == "In Progress"
    assert audits[1]["new_status"] == "Completed"


# ============================================================================
# 6. Lightweight Outcome Tracking & Non-Causation Guarantee
# ============================================================================

def test_outcome_recording_and_non_causation_attribution():
    headers = _get_auth_headers(TENANT_A)

    deal = batch3_storage.save_deal({
        "deal_name": "Apex Enterprise Expansion",
        "customer": "Apex Global",
        "stage": "negotiation",
    }, TENANT_A)
    deal_id = deal["id"]

    action = batch2_storage.save_next_best_action({
        "department": "Sales",
        "title": "Deliver 3-Year TCO Comparison against Competitor",
        "status": "Completed",
    }, TENANT_A)
    action_id = action["id"]

    # Record outcome
    payload = {
        "recommendation_id": action_id,
        "action_taken": "Shared transparent multi-year TCO sheet with CFO during final review.",
        "related_deal": deal_id,
        "outcome": "won",
        "outcome_date": "2026-11-20",
        "notes": "CFO confirmed our pricing predictability resolved their primary hesitation.",
    }
    res = client.post("/api/outcomes", json=payload, headers=headers)
    assert res.status_code == 201
    outcome = res.json()["outcome"]
    assert outcome["recommendation_id"] == action_id
    assert outcome["related_deal"] == deal_id
    assert outcome["outcome"] == "won"

    # CRITICAL: Verify non-causation recorded association guarantee
    assert outcome["attribution_type"] == "recorded_association"
    assert outcome["causation_claimed"] is False
    assert "does not establish direct causation" in outcome["attribution_disclaimer"]

    # Verify deal outcomes listing
    res_list = client.get(f"/api/deals/{deal_id}/outcomes", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()["outcomes"]) == 1


# ============================================================================
# 7. Strict Tenant Isolation
# ============================================================================

def test_tenant_isolation_deals_actions_and_outcomes():
    headers_a = _get_auth_headers(TENANT_A)
    headers_b = _get_auth_headers(TENANT_B)

    # 1. Create deal in Tenant A
    deal_a = batch3_storage.save_deal({
        "deal_name": "Tenant A Secret Deal",
        "customer": "Classified Client A",
        "stage": "proposal",
    }, TENANT_A)

    # Tenant B must NOT see Tenant A's deal (404)
    res_b_get = client.get(f"/api/deals/{deal_a['id']}", headers=headers_b)
    assert res_b_get.status_code == 404

    # Tenant B deal listing must be empty
    res_b_list = client.get("/api/deals", headers=headers_b)
    assert res_b_list.status_code == 200
    assert len(res_b_list.json()["deals"]) == 0

    # 2. Actions isolation
    action_a = batch2_storage.save_next_best_action({
        "department": "Product",
        "title": "Tenant A Confidential Roadmap Action",
        "status": "Pending",
    }, TENANT_A)

    res_b_action = client.get(f"/api/actions/{action_a['id']}", headers=headers_b)
    assert res_b_action.status_code == 404

    # 3. Outcomes isolation
    outcome_a = batch3_storage.record_recommendation_outcome({
        "recommendation_id": action_a["id"],
        "action_taken": "Tenant A executed action",
        "related_deal": deal_a["id"],
        "outcome": "won",
    }, TENANT_A)

    res_b_outcome = client.get(f"/api/outcomes/{outcome_a['id']}", headers=headers_b)
    assert res_b_outcome.status_code == 404


# ============================================================================
# 8. Missing and Contradictory Information Handling
# ============================================================================

def test_missing_deal_id_and_invalid_data_handling():
    headers = _get_auth_headers(TENANT_A)

    # Non-existent deal ID
    fake_id = str(uuid.uuid4())
    res_get = client.get(f"/api/deals/{fake_id}", headers=headers)
    assert res_get.status_code == 404

    res_context = client.get(f"/api/deals/{fake_id}/context", headers=headers)
    assert res_context.status_code == 404

    res_rec = client.post(f"/api/deals/{fake_id}/recommendations", headers=headers)
    assert res_rec.status_code == 404

    # Empty transcript rejected with 400
    deal = batch3_storage.save_deal({"deal_name": "Valid Deal", "customer": "Test Corp"}, TENANT_A)
    res_empty_trans = client.post(f"/api/deals/{deal['id']}/transcripts", json={"transcript_text": "   "}, headers=headers)
    assert res_empty_trans.status_code == 400

    # Invalid action status rejected with 400
    action = batch2_storage.save_next_best_action({"title": "Test Action"}, TENANT_A)
    res_bad_status = client.patch(f"/api/actions/{action['id']}/status", json={"status": "invalid_status_xyz"}, headers=headers)
    assert res_bad_status.status_code == 400
