"""
PrismIQ Batch 2 REST API Routes:
Document Ingestion, Customer Voice, and Next Best Action Engine.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from . import batch2_storage
from .customer_voice_service import CustomerVoiceService
from .document_ingestion_service import DocumentIngestionError, DocumentIngestionService
from .next_best_action_engine import NextBestActionEngine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["batch2_intelligence"])


# ============================================================================
# Helpers
# ============================================================================

def _get_tenant(
    authorization: Optional[str] = Header(None),
    tenant_id: Optional[str] = Query(None),
    x_tenant_id: Optional[str] = Header(None, alias="x-tenant-id"),
) -> str:
    from .api import get_current_tenant
    return get_current_tenant(authorization=authorization, tenant_id=tenant_id, x_tenant_id=x_tenant_id)


# ============================================================================
# Pydantic Schemas
# ============================================================================

class IngestDirectTextRequest(BaseModel):
    title: str = Field("Direct Input", description="Title or document name")
    text: str = Field(..., min_length=10, description="Raw text or review content")
    source_type: str = Field("notes", description="customer_review, support_ticket, interview, notes")
    company_name: Optional[str] = Field(None, description="Optional target or competitor company name")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Arbitrary metadata dictionary")


class CustomerFeedbackRow(BaseModel):
    review: str = Field(..., min_length=5, description="Customer review, quote, or comment")
    company_name: Optional[str] = Field(None, description="Target or competitor company name")
    category: Optional[str] = Field(None, description="love, dislike, feature_request, product_complaint, pricing_complaint, onboarding_issue, reason_for_switching, reason_for_choosing_competitor")
    sentiment: Optional[str] = Field(None, description="positive, negative, neutral")
    aspect: Optional[str] = Field(None, description="Product area or aspect")
    channel: Optional[str] = Field("customer_review", description="g2, reddit, support_ticket, interview, survey")
    customer_segment: Optional[str] = Field("general", description="Customer tier or segment")
    date: Optional[str] = Field(None, description="Publication date")


class BatchCustomerVoiceRequest(BaseModel):
    default_company: str = Field(..., description="Fallback company name if row lacks company")
    records: List[CustomerFeedbackRow] = Field(..., description="Array of customer feedback rows")
    document_id: Optional[str] = Field(None, description="Optional linked raw_document ID")


class UpdateActionStatusRequest(BaseModel):
    status: str = Field(..., description="New status: accept, dismiss, complete, irrelevant")
    notes: Optional[str] = Field(None, description="Review justification or execution notes")
    user_id: Optional[str] = Field("analyst", description="Reviewer name or identifier")


# ============================================================================
# 1. Document Ingestion Routes
# ============================================================================

@router.post("/api/ingest/upload", status_code=status.HTTP_201_CREATED)
async def upload_document_endpoint(
    file: UploadFile = File(...),
    source_type: str = Form("notes"),
    company_name: Optional[str] = Form(None),
    tenant_id: str = Depends(_get_tenant),
):
    """
    Ingest CSV, PDF, DOCX, or TXT file with deduplication and tenant isolation.
    """
    try:
        content_bytes = await file.read()
        parsed = DocumentIngestionService.parse_file(
            file_bytes=content_bytes,
            filename=file.filename or "upload.txt",
            source_type=source_type,
            metadata={"company_name": company_name} if company_name else {},
        )
        saved = batch2_storage.save_document(parsed, tenant_id)

        # Automatic downstream routing if CSV contains rows
        if parsed.get("file_format") == "csv" and parsed.get("parsed_records"):
            rows = parsed["parsed_records"]
            if source_type == "customer_review" and company_name:
                cv_svc = CustomerVoiceService(tenant_id)
                cv_svc.ingest_feedback_rows(rows, default_company=company_name, document_id=saved["id"])

        return {
            "status": "success",
            "document": saved,
            "parsed_records_count": len(parsed.get("parsed_records", [])),
        }
    except DocumentIngestionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Upload document error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process document upload.")


@router.post("/api/ingest/direct-text", status_code=status.HTTP_201_CREATED)
def direct_text_ingest_endpoint(
    payload: IngestDirectTextRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """
    Ingest raw text or pasted transcript with content deduplication.
    """
    try:
        meta = payload.metadata or {}
        if payload.company_name:
            meta["company_name"] = payload.company_name

        parsed = DocumentIngestionService.parse_direct_text(
            raw_text=payload.text,
            title=payload.title,
            source_type=payload.source_type,
            metadata=meta,
        )
        saved = batch2_storage.save_document(parsed, tenant_id)
        return {"status": "success", "document": saved}
    except DocumentIngestionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/ingest/documents")
def list_documents_endpoint(
    source_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """List ingested documents with source_type filter."""
    docs = batch2_storage.list_documents(tenant_id, source_type=source_type, limit=limit, offset=offset)
    return {"documents": docs, "count": len(docs), "limit": limit, "offset": offset}


# ============================================================================
# 2. Customer Voice Routes
# ============================================================================

@router.post("/api/customer-voice/ingest", status_code=status.HTTP_201_CREATED)
def customer_voice_ingest_endpoint(
    payload: BatchCustomerVoiceRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Ingest and classify customer reviews, tickets, and feedback rows."""
    svc = CustomerVoiceService(tenant_id)
    raw_dicts = [r.dict() for r in payload.records]
    saved = svc.ingest_feedback_rows(
        rows=raw_dicts,
        default_company=payload.default_company,
        document_id=payload.document_id,
    )
    return {"status": "success", "saved_count": len(saved), "saved_records_count": len(saved), "records": saved}


@router.get("/api/customer-voice/feedback")
def get_customer_feedback_endpoint(
    company_name: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sentiment: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve customer feedback records filtered by category and sentiment."""
    items = batch2_storage.list_feedback_records(
        tenant_id=tenant_id,
        company_name=company_name,
        category=category,
        sentiment=sentiment,
        limit=limit,
        offset=offset,
    )
    return {"feedback": items, "count": len(items)}


@router.get("/api/customer-voice/themes")
def get_customer_voice_themes_endpoint(
    company_name: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    only_opportunities: bool = Query(False),
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve synthesized customer feedback themes with empirical sample sizes."""
    themes = batch2_storage.list_feedback_themes(
        tenant_id=tenant_id,
        company_name=company_name,
        category=category,
        only_opportunities=only_opportunities,
    )
    return {"themes": themes, "count": len(themes)}


@router.get("/api/customer-voice/competitive-comparison")
def get_competitive_comparison_endpoint(
    target_company: str = Query(...),
    competitor_name: str = Query(...),
    tenant_id: str = Depends(_get_tenant),
):
    """
    Compare competitor complaints against our customer sentiment/claims
    to discover high-leverage competitive opportunities.
    """
    svc = CustomerVoiceService(tenant_id)
    res = svc.generate_competitive_opportunities(target_company, competitor_name)
    return res


# ============================================================================
# 3. Next Best Action Engine Routes
# ============================================================================

@router.post("/api/next-best-actions/generate", status_code=status.HTTP_201_CREATED)
def generate_next_best_actions_endpoint(
    target_company: str = Query("Our Company"),
    force_refresh: bool = Query(False),
    tenant_id: str = Depends(_get_tenant),
):
    """
    Synthesize cross-persona recommendations across Sales, Product, Marketing, Leadership.
    """
    engine = NextBestActionEngine(tenant_id)
    actions = engine.generate_recommendations(target_company=target_company, force_refresh=force_refresh)
    return {"status": "success", "actions_generated": len(actions), "actions": actions}


@router.get("/api/next-best-actions")
def list_next_best_actions_endpoint(
    team: Optional[str] = Query(None, description="Sales, Product, Marketing, Leadership"),
    urgency: Optional[str] = Query(None, description="Critical, High, Medium, Low"),
    status: Optional[str] = Query(None, description="pending, accepted, dismissed, completed, irrelevant"),
    related_competitor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
):
    """List Next Best Actions with filters."""
    actions = batch2_storage.list_next_best_actions(
        tenant_id=tenant_id,
        team=team,
        urgency=urgency,
        status=status,
        related_competitor=related_competitor,
        limit=limit,
        offset=offset,
    )
    return {"actions": actions, "count": len(actions)}


@router.patch("/api/next-best-actions/{action_id}/status")
def update_action_status_endpoint(
    action_id: str,
    payload: UpdateActionStatusRequest,
    tenant_id: str = Depends(_get_tenant),
):
    """Transition recommendation status with audit logging."""
    engine = NextBestActionEngine(tenant_id)
    try:
        updated = engine.update_action_review_status(
            action_id=action_id,
            new_status=payload.status,
            user_id=payload.user_id or "analyst",
            notes=payload.notes,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Action not found.")
        return {"status": "success", "action": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/next-best-actions/{action_id}/audits")
def get_action_audits_endpoint(
    action_id: str,
    tenant_id: str = Depends(_get_tenant),
):
    """Retrieve audit history of user reviews for an action."""
    audits = batch2_storage.list_action_audits(action_id, tenant_id)
    return {"action_id": action_id, "audits": audits, "count": len(audits)}

