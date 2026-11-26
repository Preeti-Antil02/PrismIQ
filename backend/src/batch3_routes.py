"""
PrismIQ Batch 3 REST API Routes:
- Next Best Action Engine (Sales, Product, Marketing, Leadership, Engineering)
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from . import batch2_storage
from .next_best_action_engine import NextBestActionEngine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["batch3_actions"])


def _get_tenant(
    authorization: Optional[str] = Header(None),
    tenant_id: Optional[str] = Query(None),
    x_tenant_id: Optional[str] = Header(None, alias="x-tenant-id"),
) -> str:
    from .api import get_current_tenant
    return get_current_tenant(authorization=authorization, tenant_id=tenant_id, x_tenant_id=x_tenant_id)


# ============================================================================
# Pydantic Request & Response Schemas
# ============================================================================

class UpdateActionStatusV2Request(BaseModel):
    status: str = Field(..., description="New status: Pending, In Progress, Completed, Dismissed, Accepted, Irrelevant")
    notes: Optional[str] = Field(None, description="Review justification or execution notes")
    user_id: Optional[str] = Field("analyst", description="Reviewer name or identifier")
    owner: Optional[str] = Field(None, description="Optional action assignee")
    due_date: Optional[str] = Field(None, description="Optional target due date")


# ============================================================================
# Next Best Action Engine Endpoints
# ============================================================================

@router.post("/api/actions/generate", status_code=status.HTTP_201_CREATED)
def generate_actions_v3_endpoint(
    competitor_name: Optional[str] = Query(None),
    target_company: str = Query("Our Company"),
    tenant_id: str = Depends(_get_tenant),
):
    """
    Synthesize actions across Sales, Product, Marketing, Leadership, and Engineering.
    """
    engine = NextBestActionEngine(tenant_id)
    actions = engine.generate_recommendations(
        competitor_name=competitor_name,
        target_company=target_company,
    )
    return {"status": "success", "actions_generated": len(actions), "actions": actions}


@router.get("/api/actions")
def list_actions_v3_endpoint(
    department: Optional[str] = Query(None, description="Sales, Product, Marketing, Leadership, Engineering"),
    priority: Optional[str] = Query(None, description="Critical, High, Medium, Low"),
    status: Optional[str] = Query(None, description="Pending, In Progress, Completed, Dismissed"),
    related_competitor: Optional[str] = Query(None),
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
