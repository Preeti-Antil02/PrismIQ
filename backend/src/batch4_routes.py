"""
PrismIQ Batch 4 REST API Routes:
- Competitive Relationship Engine (CRUD, History, Multi-hop Graph Traversal)
- Competitive Threat Scoring (Explainable 6-Factor Index, Missing Data Safeguards)
- Emerging Competitor Detection (Discovery, Entity Resolution, Review Gating)
- Competitor Comparison Engine (3-State Capability Matrix, Evidence Grounding)
- Evidence Governance (Provenance, Confidence Methodology, Contradictory Links)
- Analyst Feedback (6 Feedback Types, Ranking/Consensus, Fact Preservation)
- Intelligence Impact Tracking (End-to-End Lineage, Non-Causation Attribution)
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from .analyst_feedback_service import AnalystFeedbackService
from .batch4_storage import clear_tenant_cache
from .competitor_comparison_engine import CompetitorComparisonEngine
from .emerging_competitor_service import EmergingCompetitorService
from .evidence_governance_service import EvidenceGovernanceService
from .intelligence_impact_service import IntelligenceImpactService
from .relationship_engine import RelationshipEngine
from .threat_scoring_engine import ThreatScoringEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["batch4_market_intelligence"])


def _get_tenant(authorization: Optional[str] = Header(None)) -> str:
    from .api import get_current_tenant
    return get_current_tenant(authorization)


# ============================================================================
# Request / Response Schemas
# ============================================================================

class CreateRelationshipRequest(BaseModel):
    subject_id: str = Field(..., min_length=1, description="Subject entity identifier")
    subject_type: str = Field(..., min_length=1, description="Entity type: competitor, product, feature, event, signal, etc.")
    subject_name: str = Field(..., min_length=1, description="Display name of subject")
    predicate: str = Field(..., min_length=1, description="Relationship predicate (e.g. competes_with, offers_feature, contradicts)")
    object_id: str = Field(..., min_length=1, description="Object entity identifier")
    object_type: str = Field(..., min_length=1, description="Entity type: competitor, product, feature, event, etc.")
    object_name: str = Field(..., min_length=1, description="Display name of object")
    relationship_source: Optional[str] = Field("verified_fact", description="Source provenance or citation")
    source_reference: Optional[str] = Field(None, description="URL or document reference")
    is_inferred: Optional[bool] = Field(False, description="Whether this edge was algorithmically inferred")
    inference_reason: Optional[str] = Field(None, description="Required when is_inferred=True")
    confidence: Optional[str] = Field("High", description="High, Medium, or Low")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arbitrary typed metadata")


class CalculateThreatScoreRequest(BaseModel):
    competitor_name: str = Field(..., min_length=1, description="Target competitor name")
    custom_weights: Optional[Dict[str, float]] = Field(None, description="Optional custom factor weights (must sum to ~1.0)")
    save: Optional[bool] = Field(True, description="Whether to persist calculated score")


class CandidateReviewActionRequest(BaseModel):
    reviewer_id: Optional[str] = Field("analyst", description="Reviewer or analyst ID")
    notes: Optional[str] = Field(None, description="Human review rationale or notes")


class ComparisonMatrixRequest(BaseModel):
    target_company: str = Field(..., min_length=1, description="Primary company (our company)")
    competitors: List[str] = Field(..., min_length=1, description="Competitors to benchmark against")
    categories: Optional[List[str]] = Field(None, description="Categories: enterprise_capabilities, integrations, product_capabilities, pricing")
    custom_capabilities: Optional[List[Dict[str, Any]]] = Field(None, description="Additional custom capabilities to evaluate")


class RecordEvidenceRequest(BaseModel):
    source_url: str = Field(..., min_length=1, description="Primary source URL")
    source_title: str = Field(..., min_length=1, description="Citation or publication title")
    excerpt: str = Field(..., min_length=1, description="Verbatim factual excerpt")
    source_type: Optional[str] = Field("documentation", description="documentation, pricing_page, financial_filing, press_release, etc.")
    claim_id: Optional[str] = Field(None, description="Associated claim ID if grounding an existing claim")
    publication_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    relationship: Optional[str] = Field("supports", description="supports, contradicts, or disputes")
    source_quality: Optional[str] = Field("primary", description="primary, secondary, or inferred")
    confidence_methodology: Optional[str] = Field("primary_source_verification", description="Methodology label")
    verification_status: Optional[str] = Field("verified", description="verified, unverified, disputed, deprecated")
    related_company: Optional[str] = Field(None, description="Primary company associated")
    related_competitor: Optional[str] = Field(None, description="Competitor entity associated")
    related_event_id: Optional[str] = Field(None, description="Associated market event ID")
    related_battlecard_id: Optional[str] = Field(None, description="Associated battlecard ID")
    related_recommendation_id: Optional[str] = Field(None, description="Associated recommendation ID")


class LinkContradictionRequest(BaseModel):
    target_evidence_id: str = Field(..., min_length=1, description="Opposing evidence item ID")
    contradiction_reason: str = Field(..., min_length=1, description="Detailed explanation of factual contradiction")
    confidence: Optional[str] = Field("High", description="High, Medium, or Low")
    actor_id: Optional[str] = Field("analyst", description="Analyst submitting contradiction")


class SubmitAnalystFeedbackRequest(BaseModel):
    target_entity_type: str = Field(..., min_length=1, description="Target type: claim, signal, battlecard, recommendation")
    target_entity_id: str = Field(..., min_length=1, description="Target entity identifier")
    feedback_type: str = Field(..., min_length=1, description="correct, incorrect, important, not_useful, ignore, change_interpretation")
    analyst_id: Optional[str] = Field("analyst", description="Analyst identifier")
    notes: Optional[str] = Field(None, description="Analyst feedback reasoning")
    suggested_interpretation: Optional[str] = Field(None, description="Proposed revised text or interpretation")


# ============================================================================
# 1. Competitive Relationship Engine Endpoints
# ============================================================================

@router.post("/relationships", status_code=status.HTTP_201_CREATED)
def create_relationship(
    req: CreateRelationshipRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Create a structured competitive relationship edge with provenance or inference justification."""
    engine = RelationshipEngine(tenant_id)
    try:
        res = engine.create_relationship(
            subject_id=req.subject_id,
            subject_type=req.subject_type,
            subject_name=req.subject_name,
            predicate=req.predicate,
            object_id=req.object_id,
            object_type=req.object_type,
            object_name=req.object_name,
            relationship_source=req.relationship_source or "verified_fact",
            source_reference=req.source_reference,
            is_inferred=bool(req.is_inferred),
            inference_reason=req.inference_reason,
            confidence=req.confidence or "High",
            metadata=req.metadata,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/relationships")
def list_relationships(
    subject_id: Optional[str] = None,
    subject_type: Optional[str] = None,
    predicate: Optional[str] = None,
    object_id: Optional[str] = None,
    object_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    status: Optional[str] = "active",
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """List and filter competitive relationship edges."""
    engine = RelationshipEngine(tenant_id)
    return engine.list_relationships(
        subject_id=subject_id,
        subject_type=subject_type,
        predicate=predicate,
        object_id=object_id,
        object_type=object_type,
        entity_id=entity_id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.get("/relationships/graph")
def get_relationship_graph(
    entity_id: str = Query(..., description="Root entity identifier"),
    max_depth: int = Query(2, ge=1, le=4),
    tenant_id: str = Depends(_get_tenant),
):
    """Multi-hop traversal graph around an entity."""
    engine = RelationshipEngine(tenant_id)
    return engine.get_entity_graph(entity_id=entity_id, max_depth=max_depth)


@router.get("/relationships/{relationship_id}")
def get_relationship(
    relationship_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve single relationship edge."""
    engine = RelationshipEngine(tenant_id)
    rel = engine.get_relationship(relationship_id)
    if not rel:
        raise HTTPException(status_code=404, detail=f"Relationship '{relationship_id}' not found.")
    return rel


@router.get("/relationships/{relationship_id}/history")
def get_relationship_history(
    relationship_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve chronological mutation audit trail for a relationship."""
    engine = RelationshipEngine(tenant_id)
    return engine.get_relationship_history(relationship_id)


# ============================================================================
# 2. Competitive Threat Scoring Endpoints
# ============================================================================

@router.post("/threat-scoring/calculate")
def calculate_threat_score(
    req: CalculateThreatScoreRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Calculate 6-factor explainable threat intensity index with missing data coverage safeguards."""
    engine = ThreatScoringEngine(tenant_id)
    try:
        return engine.calculate_threat_score(
            competitor_name=req.competitor_name,
            custom_weights=req.custom_weights,
            save=req.save if req.save is not None else True,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/threat-scoring/weights/default")
def get_threat_scoring_weights(
    tenant_id: str = Depends(_get_tenant),
):
    """Return default factor weights and explainable scoring methodology."""
    engine = ThreatScoringEngine(tenant_id)
    return {
        "default_weights": engine.get_default_weights(),
        "factors": [
            {"factor": "product_activity", "default_weight": 0.20, "description": "Release velocity, product updates, and technical capability additions"},
            {"factor": "hiring_activity", "default_weight": 0.15, "description": "Job openings, talent acquisition, and strategic team expansion"},
            {"factor": "pricing_movement", "default_weight": 0.20, "description": "Discounting changes, tier adjustments, and aggressive packaging shifts"},
            {"factor": "market_activity", "default_weight": 0.15, "description": "Press announcements, marketing campaigns, funding, and partnerships"},
            {"factor": "customer_evidence", "default_weight": 0.15, "description": "Customer feedback, objections raised in deal conversations, sentiment"},
            {"factor": "win_loss_evidence", "default_weight": 0.15, "description": "Historical sales head-to-head outcomes and competitive loss rate"},
        ],
        "score_representation": "threat_intensity_index",
        "is_probability": False,
        "missing_data_rule": "Missing data is flagged in unassessed_factors and normalized out; it is never treated as confirmed low threat.",
    }


@router.get("/threat-scoring/{competitor_name}")
def get_threat_score(
    competitor_name: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve latest calculated threat score for a competitor, or compute on demand."""
    from . import batch4_storage
    score = batch4_storage.get_threat_score(competitor_name, tenant_id)
    if not score:
        # Compute on demand
        engine = ThreatScoringEngine(tenant_id)
        score = engine.calculate_threat_score(competitor_name, save=True)
    return score


# ============================================================================
# 3. Emerging Competitor Detection Endpoints
# ============================================================================

@router.post("/emerging-competitors/discover")
def discover_emerging_competitors(
    tenant_id: str = Depends(_get_tenant),
):
    """Scan monitored signals, customer feedback, and sales deals to discover untracked competitors."""
    service = EmergingCompetitorService(tenant_id)
    return service.discover_candidates()


@router.get("/emerging-competitors")
def list_emerging_competitors(
    status: Optional[str] = Query(None, description="pending_approval, approved, or rejected"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """List discovered emerging competitor candidates."""
    service = EmergingCompetitorService(tenant_id)
    return service.list_candidates(status=status, limit=limit, offset=offset)


@router.get("/emerging-competitors/{candidate_id}")
def get_emerging_competitor(
    candidate_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve single emerging competitor candidate."""
    service = EmergingCompetitorService(tenant_id)
    cand = service.get_candidate(candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate '{candidate_id}' not found.")
    return cand


@router.post("/emerging-competitors/{candidate_id}/approve")
def approve_emerging_competitor(
    candidate_id: str,
    req: CandidateReviewActionRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Approve an emerging candidate and promote them to the tenant's tracked landscape."""
    service = EmergingCompetitorService(tenant_id)
    try:
        return service.approve_candidate(
            candidate_id=candidate_id,
            reviewer_id=req.reviewer_id or "analyst",
            notes=req.notes,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.post("/emerging-competitors/{candidate_id}/reject")
def reject_emerging_competitor(
    candidate_id: str,
    req: CandidateReviewActionRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Reject an emerging competitor candidate."""
    service = EmergingCompetitorService(tenant_id)
    try:
        return service.reject_candidate(
            candidate_id=candidate_id,
            reviewer_id=req.reviewer_id or "analyst",
            notes=req.notes,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


# ============================================================================
# 4. Competitor Comparison Engine Endpoints
# ============================================================================

@router.post("/competitor-comparison")
def generate_competitor_comparison(
    req: ComparisonMatrixRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Generate side-by-side capability matrix with strict Supported, Unsupported, and Unknown states."""
    engine = CompetitorComparisonEngine(tenant_id)
    try:
        return engine.generate_comparison_matrix(
            target_company=req.target_company,
            competitors=req.competitors,
            categories=req.categories,
            custom_capabilities=req.custom_capabilities,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# ============================================================================
# 5. Evidence Governance Endpoints
# ============================================================================

@router.post("/evidence", status_code=status.HTTP_201_CREATED)
def record_governed_evidence(
    req: RecordEvidenceRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Record governed evidence with source provenance, confidence methodology, and verification audit."""
    service = EvidenceGovernanceService(tenant_id)
    return service.record_evidence(
        source_url=req.source_url,
        source_title=req.source_title,
        excerpt=req.excerpt,
        source_type=req.source_type or "documentation",
        claim_id=req.claim_id,
        publication_date=req.publication_date,
        relationship=req.relationship or "supports",
        source_quality=req.source_quality or "primary",
        confidence_methodology=req.confidence_methodology or "primary_source_verification",
        verification_status=req.verification_status or "verified",
        related_company=req.related_company,
        related_competitor=req.related_competitor,
        related_event_id=req.related_event_id,
        related_battlecard_id=req.related_battlecard_id,
        related_recommendation_id=req.related_recommendation_id,
    )


@router.get("/evidence")
def list_governed_evidence(
    claim_id: Optional[str] = None,
    relationship: Optional[str] = None,
    related_company: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """List governed evidence records."""
    service = EvidenceGovernanceService(tenant_id)
    return service.list_evidence(
        claim_id=claim_id,
        relationship=relationship,
        related_company=related_company,
        limit=limit,
        offset=offset,
    )


@router.get("/evidence/{evidence_id}")
def get_governed_evidence(
    evidence_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve single evidence record."""
    service = EvidenceGovernanceService(tenant_id)
    ev = service.get_evidence(evidence_id)
    if not ev:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found.")
    return ev


@router.post("/evidence/{evidence_id}/contradict")
def link_contradictory_evidence(
    evidence_id: str,
    req: LinkContradictionRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Link bidirectional contradictory relationship between two evidence records."""
    service = EvidenceGovernanceService(tenant_id)
    try:
        return service.link_contradictory_evidence(
            evidence_id_a=evidence_id,
            evidence_id_b=req.target_evidence_id,
            contradiction_reason=req.contradiction_reason,
            confidence=req.confidence or "High",
            actor_id=req.actor_id or "analyst",
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.get("/evidence/{evidence_id}/traceability")
def get_evidence_traceability(
    evidence_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Trace end-to-end lineage, contradictory links, and associated claims for an evidence record."""
    service = EvidenceGovernanceService(tenant_id)
    try:
        return service.get_evidence_traceability(evidence_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


# ============================================================================
# 6. Analyst Feedback Endpoints
# ============================================================================

@router.post("/analyst-feedback", status_code=status.HTTP_201_CREATED)
def submit_analyst_feedback(
    req: SubmitAnalystFeedbackRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Submit analyst feedback (correct, incorrect, important, not_useful, ignore, change_interpretation)."""
    service = AnalystFeedbackService(tenant_id)
    try:
        return service.submit_feedback(
            target_entity_type=req.target_entity_type,
            target_entity_id=req.target_entity_id,
            feedback_type=req.feedback_type,
            analyst_id=req.analyst_id or "analyst",
            notes=req.notes,
            suggested_interpretation=req.suggested_interpretation,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/analyst-feedback")
def list_analyst_feedback(
    target_entity_type: Optional[str] = None,
    target_entity_id: Optional[str] = None,
    feedback_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """List submitted analyst feedback."""
    service = AnalystFeedbackService(tenant_id)
    return service.list_feedback(
        target_entity_type=target_entity_type,
        target_entity_id=target_entity_id,
        feedback_type=feedback_type,
        limit=limit,
        offset=offset,
    )


@router.get("/analyst-feedback/summary")
def get_analyst_feedback_summary(
    target_entity_type: str = Query(..., min_length=1),
    target_entity_id: str = Query(..., min_length=1),
    tenant_id: str = Depends(_get_tenant),
):
    """Aggregate feedback summary and consensus assessment without modifying underlying facts."""
    service = AnalystFeedbackService(tenant_id)
    return service.get_feedback_summary(
        target_entity_type=target_entity_type,
        target_entity_id=target_entity_id,
    )


# ============================================================================
# 7. Intelligence Impact Tracking Endpoints
# ============================================================================

@router.get("/intelligence-impact/summary")
def get_intelligence_impact_summary(
    tenant_id: str = Depends(_get_tenant),
):
    """Get aggregated impact metrics connecting intelligence, recommendations, actions, and deal outcomes."""
    service = IntelligenceImpactService(tenant_id)
    return service.get_impact_summary()


@router.get("/intelligence-impact/deal/{deal_id}")
def trace_deal_intelligence_impact(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Trace end-to-end intelligence to outcome lineage for an individual deal."""
    service = IntelligenceImpactService(tenant_id)
    try:
        return service.trace_lineage_for_deal(deal_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
