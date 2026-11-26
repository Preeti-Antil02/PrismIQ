"""
Automated Integration and Unit Test Suite for PrismIQ Batch 4:
- Competitive Relationship Engine (Typed Edges, Provenance/Inference Validation, Mutation History, Multi-hop Traversal)
- Competitive Threat Scoring (Explainable 5-Factor Index, Missing Data Normalization, Non-Probability Guarantee)
- Emerging Competitor Detection (Discovery, Entity Resolution, Deduplication, Human Review Gating)
- Competitor Comparison Engine (Strict 3-State Model: Supported / Unsupported / Unknown, Evidence per Cell)
- Analyst Feedback (6 Feedback Types, Ranking/Consensus, Factual Preservation)
- Strict Multi-Tenant Isolation across all Batch 4 datasets
"""

import pytest
import uuid
from fastapi.testclient import TestClient

from src.api import app, _create_jwt_token
from src import batch2_storage, batch4_storage, battlecard_storage, storage
from src.analyst_feedback_service import AnalystFeedbackService
from src.competitor_comparison_engine import CompetitorComparisonEngine
from src.emerging_competitor_service import EmergingCompetitorService, normalize_company_name
from src.relationship_engine import RelationshipEngine
from src.threat_scoring_engine import ThreatScoringEngine

client = TestClient(app)

TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


@pytest.fixture(autouse=True)
def reset_storage_caches():
    batch2_storage.clear_tenant_cache()
    batch4_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()
    yield
    batch2_storage.clear_tenant_cache()
    batch4_storage.clear_tenant_cache()
    battlecard_storage.clear_tenant_cache()


def _get_auth_headers(tenant_id: str, email: str = "analyst@prismiq.dev") -> dict:
    token = _create_jwt_token(tenant_id, email)
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# 1. Competitive Relationship Engine Tests
# ============================================================================

def test_relationship_creation_and_validation():
    engine = RelationshipEngine(TENANT_A)

    # 1. Verified relationship with provenance
    rel = engine.create_relationship(
        subject_id="comp-aws",
        subject_type="competitor",
        subject_name="Amazon Web Services",
        predicate="offers_feature",
        object_id="feat-bedrock",
        object_type="feature",
        object_name="Bedrock Foundation Models",
        relationship_source="https://aws.amazon.com/bedrock",
        confidence="High",
    )
    assert rel["id"] is not None
    assert rel["predicate"] == "offers_feature"
    assert rel["relationship_source"] == "https://aws.amazon.com/bedrock"
    assert not rel["is_inferred"]

    # 2. Inferred relationship requires inference reason
    with pytest.raises(ValueError, match="Inferred relationships must clearly identify an inference reason"):
        engine.create_relationship(
            subject_id="comp-aws",
            subject_type="competitor",
            subject_name="AWS",
            predicate="recruits_for",
            object_id="skill-quantum",
            object_type="feature",
            object_name="Quantum Computing",
            is_inferred=True,
            inference_reason="",  # Missing inference reason
        )

    # 3. Valid inferred relationship
    inferred_rel = engine.create_relationship(
        subject_id="comp-aws",
        subject_type="competitor",
        subject_name="AWS",
        predicate="recruits_for",
        object_id="skill-quantum",
        object_type="hiring",
        object_name="Quantum Computing Research",
        is_inferred=True,
        inference_reason="Heuristic based on 15 job postings for Quantum Physicists in Q3.",
        confidence="Medium",
    )
    assert inferred_rel["is_inferred"] is True
    assert "job postings" in inferred_rel["inference_reason"]

    # 4. Query relationships
    rels = engine.list_relationships(subject_id="comp-aws")
    assert len(rels) == 2

    # 5. Entity graph traversal
    graph = engine.get_entity_graph("comp-aws", max_depth=2)
    assert graph["root_entity_id"] == "comp-aws"
    assert len(graph["nodes"]) >= 3
    assert len(graph["edges"]) >= 2


def test_historical_relationship_changes():
    engine = RelationshipEngine(TENANT_A)

    rel = engine.create_relationship(
        subject_id="comp-snowflake",
        subject_type="competitor",
        subject_name="Snowflake",
        predicate="competes_with",
        object_id="comp-databricks",
        object_type="competitor",
        object_name="Databricks",
        relationship_source="https://snowflake.com/press",
        actor_id="analyst_1",
    )
    rel_id = rel["id"]

    # Retrieve initial history
    history = engine.get_relationship_history(rel_id)
    assert len(history) == 1
    assert history[0]["action_type"] == "created"
    assert history[0]["actor_id"] == "analyst_1"

    # Update relationship status & confidence
    rel["confidence"] = "Medium"
    rel["status"] = "deprecated"
    batch4_storage.save_relationship(rel, TENANT_A, actor_id="analyst_2")

    updated_history = engine.get_relationship_history(rel_id)
    assert len(updated_history) == 2
    assert updated_history[1]["action_type"] == "updated"
    assert updated_history[1]["actor_id"] == "analyst_2"
    assert updated_history[1]["prior_state"]["confidence"] == "High"
    assert updated_history[1]["new_state"]["confidence"] == "Medium"


# ============================================================================
# 2. Competitive Threat Scoring Engine Tests
# ============================================================================

def test_threat_scoring_calculation_and_explainability():
    # Seed signals for competitor
    storage.save_signals([
        {"id": "sig-1", "company_name": "Databricks", "category": "product", "title": "Launched Lakehouse GenAI Apps", "signal_type": "product_release"},
        {"id": "sig-2", "company_name": "Databricks", "category": "product", "title": "Added vector search endpoints", "signal_type": "api_feature"},
        {"id": "sig-3", "company_name": "Databricks", "category": "hiring", "title": "Hiring 50 enterprise sales directors", "signal_type": "talent_expansion"},
        {"id": "sig-4", "company_name": "Databricks", "category": "pricing", "title": "Updated DBU compute pricing discounts", "signal_type": "pricing_tier"},
        {"id": "sig-5", "company_name": "Databricks", "category": "news", "title": "Announced $500M Series I funding round", "signal_type": "funding_pr"},
    ], tenant_id=TENANT_A)

    # Seed customer feedback
    batch2_storage.save_feedback_records([{
        "id": "fb-1",
        "company_name": "Databricks",
        "feedback_text": "Customer evaluating Databricks due to unified catalog and cheaper GPU clusters.",
        "sentiment": "negative",
        "category": "objection",
    }], tenant_id=TENANT_A)

    engine = ThreatScoringEngine(TENANT_A)
    score = engine.calculate_threat_score("Databricks")

    assert score["competitor_name"] == "Databricks"
    assert score["score_representation"] == "threat_intensity_index"
    assert score["is_probability"] is False
    assert 0.0 <= score["overall_threat_score"] <= 100.0
    assert score["threat_level"] in ("Critical", "High", "Medium", "Low")
    assert score["data_coverage_score"] == 1.0  # All 5 dimensions assessed
    assert score["has_missing_data"] is False
    assert len(score["unassessed_factors"]) == 0

    # Verify factor breakdown
    contributions = score["factor_contributions"]
    assert "product_activity" in contributions
    assert "hiring_activity" in contributions
    assert "pricing_movement" in contributions
    assert "market_activity" in contributions
    assert "customer_evidence" in contributions


def test_threat_scoring_missing_evidence_safeguards():
    """
    CRUCIAL: Missing data must NEVER be treated as confirmed low threat!
    """
    engine = ThreatScoringEngine(TENANT_A)
    # Competitor with NO signals and NO customer feedback
    score = engine.calculate_threat_score("CompletelyUnknownStealthCo")

    assert score["has_missing_data"] is True
    assert len(score["unassessed_factors"]) == 5
    assert score["data_coverage_score"] == 0.0

    # Must NOT produce a false 0.0 low threat; baseline neutral index is assigned with explicit flag
    assert score["overall_threat_score"] == 50.0
    assert score["threat_level"] == "Unassessed"

    # Now add only 1 factor (Product activity)
    storage.save_signals([
        {"id": "sig-p1", "company_name": "PartiallyKnownCo", "category": "product", "title": "New enterprise feature"}
    ], tenant_id=TENANT_A)

    score_partial = engine.calculate_threat_score("PartiallyKnownCo")
    assert score_partial["has_missing_data"] is True
    assert len(score_partial["unassessed_factors"]) == 4  # 4 factors unassessed
    # Normalized across assessed factor (product_activity raw_score = 20.0), so overall score = 20.0
    # It is NOT diluted down to (20.0 * 0.25) = 5.0 which would falsely imply zero threat!
    assert score_partial["overall_threat_score"] == 20.0
    assert score_partial["factor_contributions"]["product_activity"]["is_assessed"] is True
    assert score_partial["factor_contributions"]["customer_evidence"]["is_assessed"] is False


# ============================================================================
# 3. Emerging Competitor Detection Tests
# ============================================================================

def test_emerging_competitor_discovery_and_deduplication():
    # Register existing tracked company
    storage.track_tenant_company(TENANT_A, "Snowflake", is_target=False)

    # Seed signals for untracked entity with various alias forms: "Acme AI" and "Acme Inc."
    storage.save_signals([
        {"id": "sig-e1", "company_name": "Acme AI", "category": "product", "title": "Acme AI launches high-speed vector DB", "domain": "acme.ai"},
        {"id": "sig-e2", "company_name": "Acme Inc.", "category": "hiring", "title": "Acme Inc. recruiting search engineers", "domain": "acme.ai"},
        # Signal for already tracked company Snowflake -> should NOT be discovered as emerging
        {"id": "sig-e3", "company_name": "Snowflake", "category": "news", "title": "Snowflake keynote"},
    ], tenant_id=TENANT_A)

    # Seed customer feedback mention for Acme
    batch2_storage.save_feedback_records([{
        "id": "fb-e1",
        "company_name": "Acme AI",
        "feedback_text": "Prospect asked if we benchmarked against Acme AI vector search.",
        "category": "objection",
        "sentiment": "neutral",
    }], tenant_id=TENANT_A)

    service = EmergingCompetitorService(TENANT_A)
    candidates = service.discover_candidates()

    # Acme should be discovered exactly ONCE (deduplicated across Acme AI and Acme Inc.)
    acme_cands = [c for c in candidates if normalize_company_name(c["company_name"]) == normalize_company_name("Acme")]
    assert len(acme_cands) == 1
    acme = acme_cands[0]

    assert acme["corroboration_count"] == 3  # 2 signals + 1 customer feedback citation
    assert acme["review_status"] == "pending_approval"
    assert "external market signal" in acme["discovery_explanation"]
    assert "customer feedback citation" in acme["discovery_explanation"]
    assert acme["relevance_score"] > 20.0

    # Snowflake must NOT be discovered because it is already tracked
    sf_cands = [c for c in candidates if "snowflake" in c["company_name"].lower()]
    assert len(sf_cands) == 0


def test_emerging_competitor_approval_workflow():
    service = EmergingCompetitorService(TENANT_A)

    cand = batch4_storage.save_emerging_candidate({
        "company_name": "Vektor Technologies",
        "domain": "vektor.tech",
        "industry": "Vector Analytics",
        "discovery_explanation": "Identified in 2 customer evaluations.",
        "relevance_score": 75.0,
    }, tenant_id=TENANT_A)

    cand_id = cand["id"]
    assert cand["review_status"] == "pending_approval"

    # 1. Approve candidate
    approved = service.approve_candidate(
        candidate_id=cand_id,
        reviewer_id="lead_analyst_dan",
        notes="Confirmed competitive threat in Q4 pipeline.",
    )
    assert approved["review_status"] == "approved"
    assert approved["reviewed_by"] == "lead_analyst_dan"

    # Verify automatically registered in tracked companies
    tracked = storage.get_tenant_tracked_companies(TENANT_A)
    tracked_names = [t["company_name"] for t in tracked]
    assert "Vektor Technologies" in tracked_names


# ============================================================================
# 4. Competitor Comparison Engine Tests
# ============================================================================

def test_competitor_comparison_three_state_matrix():
    """
    CRUCIAL: Unknown must NEVER be treated as Unsupported.
    """
    # 1. Seed verified claims for our company (PrismIQ)
    battlecard_storage.save_claim({
        "company_name": "PrismIQ",
        "claim_text": "PrismIQ provides full SOC2 Type II compliance and tenant isolation.",
        "claim_type": "feature",
        "status": "verified",
    }, tenant_id=TENANT_A)

    battlecard_storage.save_claim({
        "company_name": "PrismIQ",
        "claim_text": "PrismIQ offers automated battlecard generation and next best actions.",
        "claim_type": "product",
        "status": "verified",
    }, tenant_id=TENANT_A)

    # 2. Seed verified NEGATIVE claim for Competitor A (Explicitly unsupported)
    battlecard_storage.save_claim({
        "company_name": "CompetitorA",
        "claim_text": "CompetitorA lacks native Slack & Teams notifications and webhook alerts.",
        "claim_type": "feature",
        "status": "verified",
    }, tenant_id=TENANT_A)

    # 3. Seed verified positive claim for Competitor A
    battlecard_storage.save_claim({
        "company_name": "CompetitorA",
        "claim_text": "CompetitorA supports Single Sign-On (SSO / SAML) authentication.",
        "claim_type": "feature",
        "status": "verified",
    }, tenant_id=TENANT_A)

    # Competitor B has NO claims or evidence seeded (completely unknown)

    engine = CompetitorComparisonEngine(TENANT_A)
    matrix = engine.generate_comparison_matrix(
        target_company="PrismIQ",
        competitors=["CompetitorA", "CompetitorB"],
        categories=["enterprise_capabilities", "integrations", "product_capabilities"],
    )

    assert matrix["target_company"] == "PrismIQ"
    assert "CompetitorA" in matrix["competitors"]
    assert "CompetitorB" in matrix["competitors"]

    # Verify SOC2 capability
    enterprise_cat = next(c for c in matrix["comparison_matrix"] if c["category_key"] == "enterprise_capabilities")
    soc2_row = next(r for r in enterprise_cat["capabilities"] if "SOC2" in r["capability_name"])

    # PrismIQ must be Supported
    assert soc2_row["evaluations"]["PrismIQ"]["state"] == "Supported"
    assert "SOC2" in soc2_row["evaluations"]["PrismIQ"]["evidence_excerpt"]

    # Competitor B has NO data for SOC2: MUST BE 'Unknown' (NEVER 'Unsupported')
    comp_b_soc2 = soc2_row["evaluations"]["CompetitorB"]
    assert comp_b_soc2["state"] == "Unknown", "Unknown must never be treated as Unsupported!"
    assert comp_b_soc2["verification_status"] == "unassessed"

    # Verify Competitor A Slack integration is Unsupported
    integrations_cat = next(c for c in matrix["comparison_matrix"] if c["category_key"] == "integrations")
    slack_row = next(r for r in integrations_cat["capabilities"] if "Slack" in r["capability_name"])
    assert slack_row["evaluations"]["CompetitorA"]["state"] == "Unsupported"
    assert "lacks" in slack_row["evaluations"]["CompetitorA"]["evidence_excerpt"].lower()


# ============================================================================
# 5. Analyst Feedback Workflows Tests
# ============================================================================

def test_analyst_feedback_workflows_and_consensus():
    feedback_service = AnalystFeedbackService(TENANT_A)

    claim_id = str(uuid.uuid4())

    # Analyst 1: marks claim as 'correct'
    feedback_service.submit_feedback(
        target_entity_type="claim",
        target_entity_id=claim_id,
        feedback_type="correct",
        analyst_id="analyst_alice",
        notes="Verified against Q3 10-Q filing.",
    )

    # Analyst 2: marks claim as 'important'
    feedback_service.submit_feedback(
        target_entity_type="claim",
        target_entity_id=claim_id,
        feedback_type="important",
        analyst_id="analyst_bob",
        notes="High competitive significance in Enterprise RFP.",
    )

    summary = feedback_service.get_feedback_summary("claim", claim_id)
    assert summary["total_feedback_count"] == 2
    assert summary["feedback_type_counts"]["correct"] == 1
    assert summary["feedback_type_counts"]["important"] == 1
    assert summary["consensus_status"] == "analyst_validated"
    assert summary["requires_governance_review"] is False

    # Analyst 3 disputes: 'change_interpretation'
    feedback_service.submit_feedback(
        target_entity_type="claim",
        target_entity_id=claim_id,
        feedback_type="change_interpretation",
        analyst_id="analyst_charlie",
        notes="Wording overstates scope of encryption support.",
        suggested_interpretation="Supports customer-managed keys (CMK) in US regions only.",
    )

    updated_summary = feedback_service.get_feedback_summary("claim", claim_id)
    assert updated_summary["total_feedback_count"] == 3
    assert updated_summary["feedback_type_counts"]["change_interpretation"] == 1
    assert updated_summary["requires_governance_review"] is True


# ============================================================================
# 6. Strict Multi-Tenant Isolation Tests
# ============================================================================

def test_batch4_tenant_isolation():
    # Tenant A records a relationship and an emerging competitor
    engine_a = RelationshipEngine(TENANT_A)
    rel_a = engine_a.create_relationship(
        subject_id="comp-a",
        subject_type="competitor",
        subject_name="Alpha",
        predicate="competes_with",
        object_id="comp-b",
        object_type="competitor",
        object_name="Beta",
    )

    batch4_storage.save_emerging_candidate({
        "id": "cand-tenant-a",
        "company_name": "SecretStartupA",
    }, tenant_id=TENANT_A)

    # Tenant B queries
    engine_b = RelationshipEngine(TENANT_B)
    assert engine_b.get_relationship(rel_a["id"]) is None
    assert len(engine_b.list_relationships()) == 0

    assert batch4_storage.get_emerging_candidate("cand-tenant-a", TENANT_B) is None


# ============================================================================
# 7. FastAPI REST API Integration Endpoints Tests
# ============================================================================

def test_api_batch4_routes_end_to_end():
    headers = _get_auth_headers(TENANT_A)

    # 1. API: Create relationship
    rel_res = client.post(
        "/api/relationships",
        json={
            "subject_id": "api-comp-1",
            "subject_type": "competitor",
            "subject_name": "API Competitor 1",
            "predicate": "offers_feature",
            "object_id": "api-feat-1",
            "object_type": "feature",
            "object_name": "Auto-scaling Clusters",
            "relationship_source": "https://docs.apicomp.com",
            "confidence": "High",
        },
        headers=headers,
    )
    assert rel_res.status_code == 201

    # 2. API: Query relationships
    list_rel_res = client.get(f"/api/relationships?subject_id=api-comp-1", headers=headers)
    assert list_rel_res.status_code == 200
    assert len(list_rel_res.json()) >= 1

    # 3. API: Calculate threat score
    threat_res = client.post(
        "/api/threat-scoring/calculate",
        json={"competitor_name": "API Competitor 1"},
        headers=headers,
    )
    assert threat_res.status_code == 200
    assert threat_res.json()["competitor_name"] == "API Competitor 1"
    assert threat_res.json()["score_representation"] == "threat_intensity_index"

    # 4. API: Competitor comparison matrix
    comp_res = client.post(
        "/api/competitor-comparison",
        json={
            "target_company": "PrismIQ",
            "competitors": ["API Competitor 1"],
            "categories": ["enterprise_capabilities"],
        },
        headers=headers,
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["target_company"] == "PrismIQ"

    # 5. API: Analyst feedback
    fb_res = client.post(
        "/api/analyst-feedback",
        json={
            "target_entity_type": "claim",
            "target_entity_id": str(uuid.uuid4()),
            "feedback_type": "correct",
            "analyst_id": "api_analyst",
            "notes": "Verified successfully.",
        },
        headers=headers,
    )
    assert fb_res.status_code == 201

    # 6. Verify deleted module endpoints return 404
    assert client.get("/api/evidence", headers=headers).status_code == 404
    assert client.get("/api/intelligence-impact/summary", headers=headers).status_code == 404
