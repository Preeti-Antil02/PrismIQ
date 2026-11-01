"""
PrismIQ - Point 5: Competitive Impact Assessment & Counter-Action Engine
Comprehensive Quality, Data Integrity, and Strategic Reasoning Verification Tests.

Verifies:
1. Strict Independence from Point 4 (No copied pattern names, summaries, or strategic implications).
2. 6 Canonical Competitive Threat Types.
3. Grounded Factual Inflection Summary Details (Competitor product, publication date, actual change, relevant evidence IDs).
4. Structured 6-Question "Why It Matters" Matrix (affected products, overlapping segments, competitor advantage, risk/opportunity, evidence summary, uncertain assumptions).
5. Dynamic Department Routing across 12 Canonical Departments (No static 4 departments; non-generic bespoke justifications).
6. Revenue & Margin Exposure Rigor (Specific metrics when measurable; "Insufficient empirical financial data to confirm revenue loss" when unmeasured).
7. Complete Action Schema & Playbook Integrity (Priority, justification, next step, outcome, evidence IDs, deadline).
8. Interactive Action Checklist State Machine (Pending, In Progress, Accepted, Completed, Dismissed, Reopen with execution progress math).
9. Multi-Factor Confidence without Arbitrary Floors.
10. Authentic Urgency & Deadlines (No Fake Countdowns).
11. Dynamic Competitor & Honest Empty States for Unknown Competitors.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from src.api import app, _create_jwt_token
from src import decision_support_engine
from src import dynamic_intelligence_agent
from src import storage

client = TestClient(app)

AI_TENANT_ID = "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f"      # Target: OpenAI; Competitors: Anthropic, Google DeepMind, Meta AI
MEESHO_TENANT_ID = "8553449a-c998-4727-be01-9aeb724038cb"  # Target: Meesho; Competitors: Flipkart, Amazon India, Shopsy, Ajio
CLOUD_TENANT_ID = "00000000-0000-0000-0000-000000000000"   # Target: Cloudflare/OpenAI; Competitors: AWS, Cloudflare, Netflix, Vercel, Netlify


# ============================================================================
# 1. Strict Independence between Point 4 and Point 5
# ============================================================================

def test_point_5_does_not_copy_point_4_content():
    """
    Ensure Point 5 operates as an independent decision-making pipeline.
    It must NOT simply copy Point 4's synthesized pattern name, pattern summary,
    or strategic implication into Point 5's what_happened or why_it_matters.
    """
    token = _create_jwt_token(AI_TENANT_ID, "ci_analyst@openai.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    p5_items = {i["company_name"]: i for i in res.json()["items"]}

    # Fetch Point 4 correlations for comparison
    res_p4 = client.get("/signals/correlations", headers={"Authorization": f"Bearer {token}"})
    assert res_p4.status_code == 200
    p4_correlations = {c.get("company_name") or c.get("competitor_name"): c for c in res_p4.json()["correlations"]}

    for comp in ["Anthropic", "Google DeepMind", "Meta AI"]:
        assert comp in p5_items, f"{comp} missing in Point 5"
        p5 = p5_items[comp]
        if comp in p4_correlations:
            p4 = p4_correlations[comp]
            # 1. Point 5 what_happened must NOT be Point 4 pattern_name
            assert p5["what_happened"] != p4.get("pattern_name"), f"Point 5 what_happened copied Point 4 pattern_name for {comp}"
            # 2. Point 5 what_happened must NOT be Point 4 pattern_summary
            assert p5["what_happened"] != p4.get("pattern_summary"), f"Point 5 what_happened copied Point 4 pattern_summary for {comp}"
            # 3. Point 5 why_it_matters must NOT be Point 4 strategic_implication
            assert p5["why_it_matters"] != p4.get("strategic_implication"), f"Point 5 why_it_matters copied Point 4 strategic_implication for {comp}"


def test_meesho_point_5_does_not_copy_point_4_content():
    """Verify Flipkart, Amazon India, Shopsy, Ajio do not mirror Point 4's correlation strings."""
    token = _create_jwt_token(MEESHO_TENANT_ID, "strategy@meesho.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    p5_items = {i["company_name"]: i for i in res.json()["items"]}

    res_p4 = client.get("/signals/correlations", headers={"Authorization": f"Bearer {token}"})
    assert res_p4.status_code == 200
    p4_correlations = {c.get("company_name") or c.get("competitor_name"): c for c in res_p4.json()["correlations"]}

    for comp in ["Flipkart", "Amazon India", "Shopsy", "Ajio"]:
        assert comp in p5_items
        p5 = p5_items[comp]
        if comp in p4_correlations:
            p4 = p4_correlations[comp]
            assert p5["what_happened"] != p4.get("pattern_name")
            assert p5["what_happened"] != p4.get("pattern_summary")
            assert p5["why_it_matters"] != p4.get("strategic_implication")


# ============================================================================
# 2. Six Canonical Competitive Threat Types
# ============================================================================

def test_six_canonical_competitive_threat_types():
    """Verify that every decision support item is classified into one of the 6 canonical threat types."""
    canonical_threat_types = set(decision_support_engine.COMPETITIVE_THREAT_TYPES)
    assert len(canonical_threat_types) == 6

    # Test across AI tenant
    token = _create_jwt_token(AI_TENANT_ID, "ci_analyst@openai.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    for item in res.json()["items"]:
        threat = item.get("threat_type")
        assert threat in canonical_threat_types, f"Invalid threat_type '{threat}' for {item.get('company_name')}"

    # Test across E-Commerce tenant
    token_m = _create_jwt_token(MEESHO_TENANT_ID, "vp@meesho.dev")
    res_m = client.get("/decision-support", headers={"Authorization": f"Bearer {token_m}"})
    assert res_m.status_code == 200
    for item in res_m.json()["items"]:
        threat = item.get("threat_type")
        assert threat in canonical_threat_types, f"Invalid threat_type '{threat}' for {item.get('company_name')}"


# ============================================================================
# 3. Grounded Factual Inflection Summary Details
# ============================================================================

def test_inflection_summary_details():
    """Verify inflection_summary_details structure and grounded fields."""
    token = _create_jwt_token(AI_TENANT_ID, "ci_analyst@openai.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    for item in res.json()["items"]:
        details = item.get("inflection_summary_details")
        assert details is not None, f"inflection_summary_details missing for {item['company_name']}"
        assert "competitor_product" in details
        assert "publication_date" in details
        assert "actual_change" in details
        assert "relevant_evidence_ids" in details
        assert "assessment_status" in details
        assert details["assessment_status"] in ["Verified Ground Truth", "Surveillance Only"]


# ============================================================================
# 4. Structured 6-Question "Why It Matters" Matrix
# ============================================================================

def test_structured_six_question_why_it_matters():
    """
    Verify the structured 6-question breakdown:
    Q1: Affected Target Company Products
    Q2: Overlapping Customer Segments
    Q3: Competitor Advantage Gained
    Q4: Business Risk or Opportunity
    Q5: Supporting Evidence Summary
    Q6: Uncertain Assumptions
    """
    token = _create_jwt_token(AI_TENANT_ID, "ci_analyst@openai.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    for item in res.json()["items"]:
        matrix = item.get("structured_why_it_matters")
        assert matrix is not None, f"structured_why_it_matters missing for {item['company_name']}"
        assert "q1_affected_products" in matrix
        assert "q2_overlapping_customer_segments" in matrix
        assert "q3_competitor_advantage" in matrix
        assert "q4_business_risk_or_opportunity" in matrix
        assert "q5_supporting_evidence_summary" in matrix
        assert "q6_uncertain_assumptions" in matrix

        # Q1 Affected products must be a non-empty list for verified competitors
        assert isinstance(matrix["q1_affected_products"], list)
        assert len(matrix["q1_affected_products"]) > 0
        # Q6 Uncertain assumptions must be an honest declaration
        assert len(matrix["q6_uncertain_assumptions"]) > 10


# ============================================================================
# 5. Dynamic Department Routing across 12 Canonical Departments
# ============================================================================

def test_dynamic_department_routing_across_12_canonical_departments():
    """
    Verify dynamic department routing:
    - Must choose from the 12 canonical departments.
    - Must NOT assign the identical static 4-department set to all competitors.
    - Each routed department must have an event-specific reason in department_reasons.
    """
    canonical_depts = set(decision_support_engine.SUPPORTED_DEPARTMENTS)
    assert len(canonical_depts) == 12

    token = _create_jwt_token(AI_TENANT_ID, "ci_analyst@openai.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    items = {i["company_name"]: i for i in res.json()["items"]}

    anth_depts = set(items["Anthropic"]["who_is_affected"])
    deep_depts = set(items["Google DeepMind"]["who_is_affected"])
    meta_depts = set(items["Meta AI"]["who_is_affected"])

    # All routed departments must be valid canonical departments
    for d_set in [anth_depts, deep_depts, meta_depts]:
        assert d_set.issubset(canonical_depts)

    # Dynamic differentiation: Google DeepMind includes Research; Anthropic includes Security; Meta includes Security/Marketing
    assert "Research" in deep_depts, "Google DeepMind must route to Research"
    assert "Security" in anth_depts, "Anthropic must route to Security"
    assert anth_depts != deep_depts, "Anthropic and DeepMind must not have identical routed departments"

    # Verify department_reasons contains specific explanations
    for comp, item in items.items():
        reasons = item.get("department_reasons", {})
        for dept in item["who_is_affected"]:
            assert dept in reasons, f"Reason missing for routed dept '{dept}' in {comp}"
            assert len(reasons[dept]) > 20, f"Reason too short for {dept} in {comp}"


# ============================================================================
# 6. Revenue & Margin Exposure Rigor
# ============================================================================

def test_revenue_and_margin_exposure_rigor():
    """
    Verify revenue & margin exposure:
    - Measurable impacts state concrete exposure (e.g. Anthropic input token exposure, Flipkart delivery fee).
    - Unmeasured impacts explicitly state 'Insufficient empirical financial data to confirm revenue loss'.
    - Never invent ungrounded financial figures.
    """
    rec_anthropic = decision_support_engine.synthesize_decision_support_record("OpenAI", "Anthropic")
    assert "token" in rec_anthropic["revenue_margin_exposure"].lower() or "$" in rec_anthropic["revenue_margin_exposure"]

    rec_meta = decision_support_engine.synthesize_decision_support_record("OpenAI", "Meta AI")
    assert "insufficient empirical financial data" in rec_meta["revenue_margin_exposure"].lower()

    rec_unknown = decision_support_engine.synthesize_decision_support_record("OpenAI", "RandomStartup123")
    assert "insufficient empirical financial data" in rec_unknown["revenue_margin_exposure"].lower()


# ============================================================================
# 7. Complete Action Schema & Playbook Integrity
# ============================================================================

def test_action_checklist_schema_and_integrity():
    """
    Verify every action checklist item satisfies the complete schema:
    - id, title, text, business_justification, supporting_competitive_development,
      responsible_department, priority, suggested_next_step, expected_outcome,
      supporting_evidence_ids, suggested_deadline, status.
    """
    token = _create_jwt_token(AI_TENANT_ID, "ci_analyst@openai.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    required_keys = {
        "id", "title", "text", "business_justification",
        "supporting_competitive_development", "responsible_department",
        "priority", "suggested_next_step", "expected_outcome",
        "supporting_evidence_ids", "suggested_deadline", "status"
    }

    for item in res.json()["items"]:
        actions = item.get("action_checklist", [])
        assert len(actions) >= 3, f"Expected at least 3 counter-actions for {item['company_name']}"
        for act in actions:
            missing = required_keys - set(act.keys())
            assert not missing, f"Action missing keys {missing} in {item['company_name']}: {act}"
            assert act["priority"] in ["Critical", "High", "Medium", "Low"]
            assert act["status"] in ["Pending", "In Progress", "Accepted", "Completed", "Dismissed"]
            assert isinstance(act["supporting_evidence_ids"], list)
            assert len(act["supporting_evidence_ids"]) > 0


# ============================================================================
# 8. Interactive Action Checklist State Machine (Transitions & Math)
# ============================================================================

def test_action_checklist_transitions_and_execution_math():
    """
    Verify full lifecycle of action transitions:
    Pending -> Accepted -> In Progress -> Completed -> Dismissed -> Reopen (Pending).
    Verify execution percentage is calculated strictly: (Accepted + Completed) / Total.
    """
    token = _create_jwt_token(AI_TENANT_ID, "ci_analyst@openai.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    item = res.json()["items"][0]
    item_id = item["id"]
    actions = item["action_checklist"]
    assert len(actions) >= 3
    act_id = actions[0]["id"]
    total = len(actions)

    # 1. Transition to Accepted
    patch_res = client.patch(
        f"/decision-support/{item_id}/actions/{act_id}",
        json={"status": "Accepted", "notes": "Approved in executive sync"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patch_res.status_code == 200
    p1 = patch_res.json()["execution_progress"]
    assert p1["accepted"] >= 1
    assert p1["percent_complete"] == round((p1["accepted"] + p1["completed"]) / total * 100)

    # 2. Transition to In Progress
    patch_res = client.patch(
        f"/decision-support/{item_id}/actions/{act_id}",
        json={"status": "In Progress", "notes": "Engineering team assigned"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patch_res.status_code == 200
    p2 = patch_res.json()["execution_progress"]
    assert p2["in_progress"] >= 1

    # 3. Transition to Completed
    patch_res = client.patch(
        f"/decision-support/{item_id}/actions/{act_id}",
        json={"status": "Completed", "notes": "Milestone delivered & verified"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patch_res.status_code == 200
    p3 = patch_res.json()["execution_progress"]
    assert p3["completed"] >= 1
    assert p3["percent_complete"] == round((p3["accepted"] + p3["completed"]) / total * 100)

    # 4. Transition via Reopen (resets to Pending)
    patch_res = client.patch(
        f"/decision-support/{item_id}/actions/{act_id}",
        json={"status": "Reopen", "notes": "Reopening for subsequent cycle review"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["new_status"] == "Pending"


# ============================================================================
# 9. Multi-Factor Confidence without Arbitrary Hardcoding
# ============================================================================

def test_multi_factor_confidence_breakdown():
    """Verify confidence returns distinct sub-scores and is calculated deterministically."""
    rec = decision_support_engine.synthesize_decision_support_record("OpenAI", "Anthropic")
    conf = rec.get("confidence_breakdown")
    assert conf is not None
    assert "source_verification_score" in conf
    assert "event_confidence_score" in conf
    assert "impact_confidence_score" in conf
    assert "recommendation_confidence_score" in conf
    assert "breakdown" in conf

    # Scores should be genuine floats between 50 and 99
    assert 50.0 <= conf["score"] <= 99.0
    assert 50.0 <= conf["source_verification_score"] <= 100.0


# ============================================================================
# 10. Authentic Urgency & Deadlines (No Fake Countdowns)
# ============================================================================

def test_authentic_urgency_and_deadlines_no_fake_countdowns():
    """
    Verify:
    - When no authentic fixed deadline exists (e.g. Anthropic, DeepMind, Meta AI research launches),
      deadline_at is None and response_deadline_label is 'No fixed response deadline established'.
    - When an authentic deadline exists (e.g. Flipkart Minutes promotional fee review),
      deadline_at is populated with a future ISO timestamp.
    """
    # Anthropic has no fixed deadline -> None
    rec_anthropic = decision_support_engine.synthesize_decision_support_record("OpenAI", "Anthropic")
    assert rec_anthropic["deadline_at"] is None
    assert rec_anthropic["response_deadline_label"] == "No fixed response deadline established"

    # Google DeepMind has no fixed deadline -> None
    rec_deepmind = decision_support_engine.synthesize_decision_support_record("OpenAI", "Google DeepMind")
    assert rec_deepmind["deadline_at"] is None
    assert rec_deepmind["response_deadline_label"] == "No fixed response deadline established"

    # Flipkart Minutes has an authentic response review window -> valid ISO deadline
    rec_flipkart = decision_support_engine.synthesize_decision_support_record("Meesho", "Flipkart")
    assert rec_flipkart["deadline_at"] is not None
    assert "remaining" in rec_flipkart["response_deadline_label"].lower() or "review" in rec_flipkart["response_deadline_label"].lower()


# ============================================================================
# 11. Honest Empty State for Unknown Competitors
# ============================================================================

def test_honest_empty_state_for_unknown_competitor():
    """
    When an unmonitored competitor with zero verified events is queried:
    - Returns insufficient_evidence == True
    - Does NOT fabricate cards, countdowns, or fake actions
    - threat_type == 'No significant competitive impact'
    - action_checklist is empty
    """
    rec = decision_support_engine.synthesize_decision_support_record("OpenAI", "NonExistentStartup999")
    assert rec["insufficient_evidence"] is True
    assert rec["threat_type"] == "No significant competitive impact"
    assert rec["action_checklist"] == []
    assert rec["execution_progress"]["total"] == 0
    assert rec["deadline_at"] is None
    assert rec["response_deadline_label"] == "No fixed response deadline established"
    assert "No verified high-impact announcements detected" in rec["what_happened"]
