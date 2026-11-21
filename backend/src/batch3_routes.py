"""
PrismIQ Batch 3 REST API Routes:
- Deal Management (CRUD, Stage Transitions, History, Attachments, Transcripts)
- Sales Transcript Intelligence (8 Extracted Categories)
- Deal Context Retrieval (Competitor Profiles, Battlecards, Claims, Evidence, Events)
- Competitive Response Generation (Grounded Recommendations & Review Flags)
- Next Best Action Engine (Sales, Product, Marketing, Leadership, Engineering)
- Lightweight Outcome Tracking (Non-Causation Recorded Association)
"""

import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from . import batch2_storage
from . import batch3_storage
from .deal_context_service import DealContextService
from .deal_intelligence_service import DealIntelligenceService
from .next_best_action_engine import NextBestActionEngine
from .outcome_tracking_service import OutcomeTrackingService
from .sales_call_service import SalesCallService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["batch3_deal_intelligence"])


def _get_tenant(authorization: Optional[str] = Header(None)) -> str:
    from .api import get_current_tenant
    return get_current_tenant(authorization)


# ============================================================================
# Pydantic Request & Response Schemas
# ============================================================================

class CreateDealRequest(BaseModel):
    deal_name: str = Field(..., min_length=1, description="Opportunity or deal name")
    customer: str = Field(..., min_length=1, description="Customer or prospect account name")
    stage: Optional[str] = Field("discovery", description="Pipeline stage: lead, discovery, qualification, proposal, negotiation, closed_won, closed_lost")
    associated_competitors: Optional[List[str]] = Field(default_factory=list, description="Competitors evaluating this deal")
    description: Optional[str] = Field("", description="Deal description and requirement context")
    deal_value: Optional[float] = Field(None, description="Optional deal financial value")
    customer_segment: Optional[str] = Field("general", description="Target customer tier or segment")
    industry: Optional[str] = Field("General", description="Customer industry")
    close_date: Optional[str] = Field(None, description="Target or closed date")
    notes: Optional[str] = Field(None, description="Additional sales representative notes")


class UpdateDealRequest(BaseModel):
    deal_name: Optional[str] = None
    customer: Optional[str] = None
    stage: Optional[str] = None
    associated_competitors: Optional[List[str]] = None
    description: Optional[str] = None
    deal_value: Optional[float] = None
    customer_segment: Optional[str] = None
    industry: Optional[str] = None
    close_date: Optional[str] = None
    notes: Optional[str] = None
    stage_change_notes: Optional[str] = None
    user_id: Optional[str] = Field("analyst", description="User performing update")


class DealAttachmentRequest(BaseModel):
    filename: str = Field(..., min_length=1, description="Name of the attachment file")
    file_format: Optional[str] = Field("txt", description="File extension / format (txt, pdf, docx, csv)")
    file_url: Optional[str] = Field(None, description="URL or reference path")
    content: Optional[str] = Field(None, description="Raw content excerpt or extracted text")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Attachment metadata")


class DealTranscriptRequest(BaseModel):
    call_title: str = Field("Sales Call Transcript", description="Title or meeting name")
    transcript: Optional[str] = Field(None, description="Verbatim sales call transcript text")
    transcript_text: Optional[str] = Field(None, description="Alternative field for transcript text")
    call_date: Optional[str] = Field(None, description="Date of sales call")
    participants: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Call attendees")
    known_competitors: Optional[List[str]] = Field(default_factory=list, description="Competitors to watch for")


class UpdateActionStatusV2Request(BaseModel):
    status: str = Field(..., description="New status: Pending, In Progress, Completed, Dismissed, Accepted, Irrelevant")
    notes: Optional[str] = Field(None, description="Review justification or execution notes")
    user_id: Optional[str] = Field("analyst", description="Reviewer name or identifier")
    owner: Optional[str] = Field(None, description="Optional action assignee")
    due_date: Optional[str] = Field(None, description="Optional target due date")


class RecordOutcomeRequest(BaseModel):
    recommendation_id: str = Field(..., min_length=1, description="UUID of the recommendation or next best action")
    action_taken: str = Field(..., min_length=1, description="Description of the action executed by team")
    related_deal: str = Field(..., min_length=1, description="UUID of the related sales deal")
    outcome: str = Field(..., description="Business outcome: won, lost, accelerated, objection_neutralized, stage_advanced, no_decision")
    outcome_date: Optional[str] = Field(None, description="Date outcome was realized (YYYY-MM-DD)")
    notes: Optional[str] = Field(None, description="Optional context notes")


def _dump_model(model: BaseModel) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


# ============================================================================
# 1. Deal Management Endpoints
# ============================================================================

@router.post("/api/deals", status_code=status.HTTP_201_CREATED)
def create_deal_endpoint(
    payload: CreateDealRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Create an individual sales deal with competitors, customer details, and stage tracking.
    """
    data = _dump_model(payload)
    deal = batch3_storage.save_deal(data, tenant_id)
    return {"status": "success", "deal": deal}


@router.get("/api/deals")
def list_deals_endpoint(
    stage: Optional[str] = Query(None, description="Filter by deal stage"),
    customer: Optional[str] = Query(None, description="Filter by customer name"),
    competitor: Optional[str] = Query(None, description="Filter by associated competitor"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """
    List sales deals scoped to the authenticated tenant.
    """
    deals = batch3_storage.list_deals(
        tenant_id=tenant_id,
        stage=stage,
        customer=customer,
        competitor=competitor,
        limit=limit,
        offset=offset,
    )
    return {"deals": deals, "count": len(deals), "limit": limit, "offset": offset}


@router.get("/api/deals/{deal_id}")
def get_deal_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Retrieve deal by ID with its attachments, transcripts, and stage history.
    """
    deal = batch3_storage.get_deal(deal_id, tenant_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    return {"deal": deal}


@router.patch("/api/deals/{deal_id}")
@router.put("/api/deals/{deal_id}")
def update_deal_endpoint(
    deal_id: str,
    payload: UpdateDealRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Update deal properties and track stage transitions in audit history.
    """
    updates = {k: v for k, v in _dump_model(payload).items() if v is not None}
    user_id = updates.pop("user_id", "analyst")
    updated = batch3_storage.update_deal(deal_id, updates, tenant_id, user_id=user_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    return {"status": "success", "deal": updated}


@router.get("/api/deals/{deal_id}/history")
def get_deal_history_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Retrieve stage transition history and audit milestones for a deal.
    """
    deal = batch3_storage.get_deal(deal_id, tenant_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    history = batch3_storage.get_deal_history(deal_id, tenant_id)
    return {"deal_id": deal_id, "history": history, "count": len(history)}


@router.post("/api/deals/{deal_id}/attachments", status_code=status.HTTP_201_CREATED)
def add_deal_attachment_endpoint(
    deal_id: str,
    payload: DealAttachmentRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Attach document or file metadata to an individual deal.
    """
    deal = batch3_storage.get_deal(deal_id, tenant_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    att = batch3_storage.save_deal_attachment(deal_id, _dump_model(payload), tenant_id)
    return {"status": "success", "attachment": att}


@router.get("/api/deals/{deal_id}/attachments")
def list_deal_attachments_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    List all documents and files attached to a deal.
    """
    deal = batch3_storage.get_deal(deal_id, tenant_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    attachments = batch3_storage.list_deal_attachments(deal_id, tenant_id)
    return {"deal_id": deal_id, "attachments": attachments, "count": len(attachments)}


# ============================================================================
# 2. Sales Transcript Intelligence & Linking
# ============================================================================

@router.post("/api/deals/{deal_id}/transcripts", status_code=status.HTTP_201_CREATED)
def ingest_deal_transcript_endpoint(
    deal_id: str,
    payload: DealTranscriptRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Ingest conversation transcript for a deal, extract 8 categories, and preserve excerpts.
    """
    deal = batch3_storage.get_deal(deal_id, tenant_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")

    raw_text = (payload.transcript or payload.transcript_text or "").strip()
    if len(raw_text) < 10:
        raise HTTPException(status_code=400, detail="Transcript is required (minimum 10 characters).")

    comps = payload.known_competitors or deal.get("associated_competitors") or []
    svc = SalesCallService(tenant_id)
    res = svc.ingest_transcript(
        transcript_text=raw_text,
        call_title=payload.call_title,
        deal_id=deal_id,
        call_date=payload.call_date,
        participants=payload.participants,
        known_competitors=comps,
    )
    return {"status": "success", "deal_id": deal_id, **res}


@router.get("/api/deals/{deal_id}/transcripts")
def list_deal_transcripts_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    List sales call transcripts linked to a specific deal.
    """
    deal = batch3_storage.get_deal(deal_id, tenant_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    calls = batch2_storage.list_sales_calls(tenant_id, deal_id=deal_id, limit=50)
    return {"deal_id": deal_id, "transcripts": calls, "count": len(calls)}


# ============================================================================
# 3. Deal Context Retrieval
# ============================================================================

@router.get("/api/deals/{deal_id}/context")
def get_deal_context_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Retrieve deal-specific competitive context: competitor profiles, published battlecards,
    verified claims, supporting evidence citations, win/loss metrics, and recent events.
    """
    svc = DealContextService(tenant_id)
    context = svc.retrieve_deal_context(deal_id)
    if not context:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    return {"status": "success", "context": context}


# ============================================================================
# 4. Competitive Response Generation
# ============================================================================

@router.post("/api/deals/{deal_id}/recommendations", status_code=status.HTTP_201_CREATED)
def generate_deal_recommendations_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Generate tactical response recommendations tailored to customer objections.
    Flags any recommendation as requiring review if supporting evidence is insufficient.
    """
    svc = DealIntelligenceService(tenant_id)
    try:
        recommendations = svc.generate_deal_responses(deal_id)
        return {
            "status": "success",
            "deal_id": deal_id,
            "recommendations": recommendations,
            "count": len(recommendations),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/api/deals/{deal_id}/recommendations")
def get_deal_recommendations_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Retrieve tactical recommendations generated for a deal.
    """
    dossier = batch2_storage.get_deal_dossier_by_deal_id(deal_id, tenant_id)
    if not dossier:
        # Generate on the fly
        svc = DealIntelligenceService(tenant_id)
        try:
            recs = svc.generate_deal_responses(deal_id)
            return {"deal_id": deal_id, "recommendations": recs, "count": len(recs)}
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    recs = dossier.get("recommendations") or dossier.get("recommended_sales_responses") or []
    return {"deal_id": deal_id, "recommendations": recs, "count": len(recs)}


# ============================================================================
# 5. Next Best Action Engine Endpoints
# ============================================================================

@router.post("/api/actions/generate", status_code=status.HTTP_201_CREATED)
def generate_actions_v3_endpoint(
    deal_id: Optional[str] = Query(None, description="Optional linked deal ID"),
    competitor_name: Optional[str] = Query(None),
    target_company: str = Query("Our Company"),
    tenant_id: str = Depends(_get_tenant),
):
    """
    Synthesize actions across Sales, Product, Marketing, Leadership, and Engineering.
    Avoids duplicate actions for the same deal and underlying event.
    """
    engine = NextBestActionEngine(tenant_id)
    actions = engine.generate_recommendations(
        competitor_name=competitor_name,
        target_company=target_company,
        deal_id=deal_id,
    )
    return {"status": "success", "actions_generated": len(actions), "actions": actions}


@router.get("/api/actions")
def list_actions_v3_endpoint(
    department: Optional[str] = Query(None, description="Sales, Product, Marketing, Leadership, Engineering"),
    priority: Optional[str] = Query(None, description="Critical, High, Medium, Low"),
    status: Optional[str] = Query(None, description="Pending, In Progress, Completed, Dismissed"),
    related_competitor: Optional[str] = Query(None),
    deal_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """
    List Next Best Actions with departmental, priority, and status filters.
    """
    actions = batch2_storage.list_next_best_actions(
        tenant_id=tenant_id,
        department=department,
        priority=priority,
        status=status,
        related_competitor=related_competitor,
        related_deal_id=deal_id,
        limit=limit,
        offset=offset,
    )
    return {"actions": actions, "count": len(actions)}


@router.get("/api/actions/{action_id}")
def get_action_endpoint(
    action_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Retrieve single Next Best Action by ID.
    """
    action = batch2_storage.get_next_best_action(action_id, tenant_id)
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found.")
    return {"action": action}


@router.patch("/api/actions/{action_id}/status")
def update_action_status_v3_endpoint(
    action_id: str,
    payload: UpdateActionStatusV2Request,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Transition action status (Pending, In Progress, Completed, Dismissed),
    record audit history, and update completion timestamps.
    """
    engine = NextBestActionEngine(tenant_id)
    try:
        updated = engine.update_action_status(
            action_id=action_id,
            new_status=payload.status,
            user_id=payload.user_id or "analyst",
            notes=payload.notes,
            owner=payload.owner,
            due_date=payload.due_date,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Action not found.")
        return {"status": "success", "action": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/actions/{action_id}/history")
@router.get("/api/actions/{action_id}/audits")
def get_action_history_endpoint(
    action_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Retrieve audit history and status transitions for an action.
    """
    action = batch2_storage.get_next_best_action(action_id, tenant_id)
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found.")
    audits = batch2_storage.list_action_audits(action_id, tenant_id)
    return {"action_id": action_id, "audits": audits, "count": len(audits)}


# ============================================================================
# 6. Lightweight Outcome Tracking Endpoints
# ============================================================================

@router.post("/api/outcomes", status_code=status.HTTP_201_CREATED)
def record_outcome_endpoint(
    payload: RecordOutcomeRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Record verified connection between executed recommendation and deal outcome.
    Strictly enforces recorded association rather than automated causation claims.
    """
    svc = OutcomeTrackingService(tenant_id)
    try:
        outcome = svc.record_outcome(
            recommendation_id=payload.recommendation_id,
            action_taken=payload.action_taken,
            related_deal=payload.related_deal,
            outcome=payload.outcome,
            outcome_date=payload.outcome_date,
            notes=payload.notes,
        )
        return {"status": "success", "outcome": outcome}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/outcomes")
def list_outcomes_endpoint(
    deal_id: Optional[str] = Query(None),
    recommendation_id: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """
    List recorded recommendation outcomes with deal and outcome filters.
    """
    svc = OutcomeTrackingService(tenant_id)
    outcomes = svc.list_outcomes(
        deal_id=deal_id,
        recommendation_id=recommendation_id,
        outcome=outcome,
        limit=limit,
        offset=offset,
    )
    return {"outcomes": outcomes, "count": len(outcomes)}


@router.get("/api/deals/{deal_id}/outcomes")
def get_deal_outcomes_endpoint(
    deal_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    List all recorded recommendation-to-outcome associations for a specific deal.
    """
    deal = batch3_storage.get_deal(deal_id, tenant_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal '{deal_id}' not found.")
    svc = OutcomeTrackingService(tenant_id)
    outcomes = svc.get_deal_outcomes(deal_id)
    return {"deal_id": deal_id, "outcomes": outcomes, "count": len(outcomes)}


@router.get("/api/outcomes/{outcome_id}")
def get_outcome_endpoint(
    outcome_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Retrieve single recorded outcome by ID.
    """
    svc = OutcomeTrackingService(tenant_id)
    rec = svc.get_outcome(outcome_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Outcome '{outcome_id}' not found.")
    return {"outcome": rec}
