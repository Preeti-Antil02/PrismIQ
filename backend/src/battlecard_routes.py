"""
PrismIQ Batch 1: Evidence-Linked Competitive Battlecards & Drift Detection API Routes.
Provides endpoints for:
- GET /api/competitors/{id}/battlecard
- POST /api/competitors/{id}/battlecards/generate
- PATCH /api/battlecards/{id}/blocks/{key}
- POST /api/battlecards/{id}/publish
- GET /api/competitors/{id}/claim-drift
- POST /api/claim-drift/{id}/review
- GET /api/battlecards/{id}/versions
- GET /api/claim-drift (Global drift review workspace)
"""

import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from . import storage
from . import battlecard_storage
from .battlecard_generator import BattlecardGenerator

logger = logging.getLogger(__name__)

router = APIRouter(tags=["battlecards"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class GenerateBattlecardRequest(BaseModel):
    audience: str = Field("sales", description="Target audience: sales, product, marketing, executive")
    segment: str = Field("general", description="Customer segment: general, enterprise, mid-market, smb")
    force_refresh: bool = Field(False, description="Whether to bypass cache and regenerate")


class UpdateBattlecardBlockRequest(BaseModel):
    content: Optional[Dict[str, Any]] = Field(None, description="Updated structured content payload")
    block_title: Optional[str] = Field(None, description="Updated block display title")
    claim_ids: Optional[List[str]] = Field(None, description="List of claim UUIDs linked to this block")


class PublishBattlecardRequest(BaseModel):
    published_by: str = Field("analyst", description="Name or role of publisher")
    change_summary: str = Field("Published latest intelligence snapshot", description="Changelog summary")


class ReviewClaimDriftRequest(BaseModel):
    action: str = Field(..., description="Action: accept, edit_and_accept, dismiss, mark_incorrect")
    notes: Optional[str] = Field(None, description="Analyst review notes or justification")
    reviewer: str = Field("analyst", description="Analyst name or ID")
    edited_claim: Optional[Dict[str, Any]] = Field(None, description="Custom edited claim fields for edit_and_accept")


# ============================================================================
# Helpers
# ============================================================================

def _get_tenant(authorization: Optional[str] = Header(None)) -> str:
    """Import and defer to get_current_tenant in api.py."""
    from .api import get_current_tenant
    return get_current_tenant(authorization)


def _resolve_competitor_name(comp_id: str, tenant_id: str) -> str:
    """Resolve company name from company ID or slug."""
    raw = str(comp_id).strip()
    is_uuid = False
    try:
        uuid.UUID(raw)
        is_uuid = True
    except (ValueError, TypeError):
        is_uuid = False

    if not is_uuid:
        return raw

    if not storage.is_test_environment() and storage.is_live_write_permitted():
        try:
            with storage.get_db_cursor() as cur:
                cur.execute("SELECT name FROM companies WHERE id::text = %s LIMIT 1;", (raw,))
                r = cur.fetchone()
                if r and r[0]:
                    return r[0]
        except Exception:
            pass

    return raw


def _build_frontend_components(card: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """
    Format stable response schemas for the 14 future frontend components:
    BattlecardHeader, SalesView, IntelligenceView, CompetitorSnapshot, PositioningCard,
    CompetitiveStrengths, ObjectionPlaybook, DiscoveryQuestions, PricingSnapshot,
    RecentChanges, EvidenceDrawer, FreshnessPanel, DriftReviewPanel, VersionHistory.
    """
    bid = card.get("id")
    cname = card.get("company_name", "")
    blocks = card.get("blocks", [])
    blocks_by_key = {b.get("block_key"): b for b in blocks}

    # Extract block contents safely
    snap_block = blocks_by_key.get("snapshot_positioning", {}).get("content") or {}
    prod_block = blocks_by_key.get("product_icp", {}).get("content") or {}
    wtw_block = blocks_by_key.get("where_they_win", {}).get("content") or {}
    www_block = blocks_by_key.get("where_we_win", {}).get("content") or {}
    sw_block = blocks_by_key.get("strengths_weaknesses", {}).get("content") or {}
    obj_block = blocks_by_key.get("objections_responses", {}).get("content") or {}
    disc_block = blocks_by_key.get("discovery_questions", {}).get("content") or {}
    price_block = blocks_by_key.get("pricing_comparison", {}).get("content") or {}
    proof_block = blocks_by_key.get("proof_points", {}).get("content") or {}
    rec_block = blocks_by_key.get("recent_changes", {}).get("content") or {}

    # Build Evidence Drawer mapping: { claim_id: [evidence_records] }
    evidence_drawer = {}
    all_claims = []
    for b in blocks:
        for clm in b.get("claims", []):
            cid = clm.get("id")
            if cid:
                all_claims.append(clm)
                evidence_drawer[cid] = clm.get("evidence", [])

    # Fetch pending drift alerts for DriftReviewPanel
    pending_alerts = battlecard_storage.get_claim_drift_alerts(
        tenant_id=tenant_id,
        company_name=cname,
        review_status="pending",
    )

    # Fetch version history for VersionHistory
    revisions = battlecard_storage.get_battlecard_revisions(battlecard_id=bid, tenant_id=tenant_id) if bid else []

    verified_claims_count = sum(1 for c in all_claims if c.get("verification_status") == "verified")
    unknown_claims_count = sum(1 for c in all_claims if c.get("verification_status") == "unknown")

    return {
        "BattlecardHeader": {
            "id": card.get("id"),
            "competitor_name": cname,
            "title": card.get("title"),
            "audience": card.get("audience"),
            "segment": card.get("segment"),
            "status": card.get("status"),
            "current_version": card.get("current_version", 1),
            "published_version": card.get("published_version"),
            "published_at": card.get("published_at"),
            "freshness_score": card.get("freshness_score", 100.0),
            "owner_id": card.get("owner_id", "analyst"),
        },
        "SalesView": {
            "where_we_win": www_block.get("items", []),
            "objection_playbook": obj_block.get("items", []),
            "discovery_questions": disc_block.get("items", []),
            "pricing_snapshot": {
                "model": price_block.get("pricing_model", "Unknown"),
                "tiers": price_block.get("tiers", ["Unknown"]),
                "hidden_costs": price_block.get("hidden_costs_or_traps", "Unknown"),
            },
        },
        "IntelligenceView": {
            "claims_count": len(all_claims),
            "verified_count": verified_claims_count,
            "unknown_count": unknown_claims_count,
            "claims": all_claims,
        },
        "CompetitorSnapshot": {
            "company_name": cname,
            "domain": snap_block.get("domain", f"{cname.lower()}.com"),
            "category": snap_block.get("category", "Enterprise Software"),
            "positioning_statement": snap_block.get("positioning_statement", "Unknown"),
        },
        "PositioningCard": {
            "positioning_statement": snap_block.get("positioning_statement", "Unknown"),
            "target_market": prod_block.get("target_market", "Unknown"),
            "key_products": prod_block.get("key_products", []),
        },
        "CompetitiveStrengths": {
            "strengths": sw_block.get("strengths", []),
            "weaknesses": sw_block.get("weaknesses", []),
        },
        "ObjectionPlaybook": {
            "items": obj_block.get("items", []),
        },
        "DiscoveryQuestions": {
            "questions": disc_block.get("items", []),
        },
        "PricingSnapshot": {
            "pricing_model": price_block.get("pricing_model", "Unknown"),
            "tiers": price_block.get("tiers", ["Unknown"]),
            "hidden_costs_or_traps": price_block.get("hidden_costs_or_traps", "Unknown"),
        },
        "RecentChanges": {
            "items": rec_block.get("items", []),
        },
        "EvidenceDrawer": {
            "evidence_by_claim": evidence_drawer,
        },
        "FreshnessPanel": {
            "freshness_score": card.get("freshness_score", 100.0),
            "total_claims": len(all_claims),
            "verified_claims": verified_claims_count,
            "unknown_claims": unknown_claims_count,
            "pending_drift_alerts_count": len(pending_alerts),
        },
        "DriftReviewPanel": {
            "pending_alerts": pending_alerts,
        },
        "VersionHistory": {
            "current_version": card.get("current_version", 1),
            "published_version": card.get("published_version"),
            "published_at": card.get("published_at"),
            "revisions": [
                {
                    "version": r.get("version"),
                    "published_at": r.get("published_at"),
                    "published_by": r.get("published_by"),
                    "change_summary": r.get("change_summary"),
                }
                for r in revisions
            ],
        },
    }


# ============================================================================
# API Routes
# ============================================================================

@router.get("/api/competitors/{competitor_id}/battlecard")
def get_competitor_battlecard(
    competitor_id: str,
    audience: str = Query("sales", description="Audience: sales, product, marketing, executive"),
    segment: str = Query("general", description="Segment: general, enterprise, mid-market, smb"),
    status: Optional[str] = Query(None, description="Filter by status: draft, published"),
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Retrieve current battlecard for a competitor with all blocks, claims, evidence,
    and pre-computed schemas for all 14 frontend components. Auto-generates initial
    grounded draft if none exists.
    """
    cname = _resolve_competitor_name(competitor_id, tenant_id)
    if not cname:
        raise HTTPException(status_code=400, detail="Competitor ID or company name is required")

    card = battlecard_storage.get_battlecard(
        company_name=cname,
        tenant_id=tenant_id,
        audience=audience,
        segment=segment,
        status=status,
    )

    if not card:
        # Auto-generate baseline draft
        generator = BattlecardGenerator(tenant_id=tenant_id)
        card = generator.generate_battlecard(
            company_name=cname,
            audience=audience,
            segment=segment,
        )

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Battlecard for competitor '{cname}' not found",
        )

    frontend_components = _build_frontend_components(card, tenant_id)
    return {
        "status": "success",
        "battlecard": card,
        "frontend_components": frontend_components,
    }


@router.post("/api/competitors/{competitor_id}/battlecards/generate", status_code=201)
def generate_competitor_battlecard(
    competitor_id: str,
    req: GenerateBattlecardRequest,
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Generate or regenerate a structured competitive battlecard from existing competitor intelligence.
    Extracts claims, links evidence, validates ground truth, marks unsupported facts as Unknown,
    and saves as an editable draft.
    """
    cname = _resolve_competitor_name(competitor_id, tenant_id)
    if not cname:
        raise HTTPException(status_code=400, detail="Competitor ID or company name is required")

    generator = BattlecardGenerator(tenant_id=tenant_id)
    card = generator.generate_battlecard(
        company_name=cname,
        audience=req.audience,
        segment=req.segment,
        force_refresh=req.force_refresh,
    )

    if not card:
        raise HTTPException(status_code=500, detail="Failed to generate competitive battlecard")

    frontend_components = _build_frontend_components(card, tenant_id)
    return {
        "status": "success",
        "message": f"Draft battlecard generated for {cname} ({req.audience})",
        "battlecard": card,
        "frontend_components": frontend_components,
    }


@router.patch("/api/battlecards/{battlecard_id}/blocks/{block_key}")
def update_battlecard_block(
    battlecard_id: str,
    block_key: str,
    req: UpdateBattlecardBlockRequest,
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Edit a specific section block in an editable draft battlecard.
    """
    updates: Dict[str, Any] = {}
    if req.content is not None:
        updates["content"] = req.content
    if req.block_title is not None:
        updates["block_title"] = req.block_title
    if req.claim_ids is not None:
        updates["claim_ids"] = req.claim_ids

    updated = battlecard_storage.update_battlecard_block(
        battlecard_id=battlecard_id,
        block_key=block_key,
        updates=updates,
        tenant_id=tenant_id,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Block '{block_key}' not found in battlecard '{battlecard_id}'",
        )

    return {
        "status": "success",
        "message": f"Block '{block_key}' successfully updated",
        "block": updated,
    }


@router.post("/api/battlecards/{battlecard_id}/publish")
def publish_battlecard(
    battlecard_id: str,
    req: PublishBattlecardRequest,
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Publish a battlecard: freezes current blocks and linked claims into an immutable
    revision history snapshot, increments publication version, and sets status to published.
    """
    try:
        result = battlecard_storage.publish_battlecard(
            battlecard_id=battlecard_id,
            tenant_id=tenant_id,
            published_by=req.published_by,
            change_summary=req.change_summary,
        )
        return {
            "status": "success",
            "message": f"Battlecard successfully published at version {result['revision']['version']}",
            "battlecard": result["battlecard"],
            "revision": result["revision"],
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Publishing failed: {str(e)}")


@router.get("/api/competitors/{competitor_id}/claim-drift")
def get_competitor_claim_drift(
    competitor_id: str,
    review_status: Optional[str] = Query(None, description="Filter by review status: pending, accepted, edited, dismissed, marked_incorrect"),
    drift_type: Optional[str] = Query(None, description="Filter by drift type: stable, new_evidence, contradicted, stale"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Retrieve drift alerts for a specific competitor.
    """
    cname = _resolve_competitor_name(competitor_id, tenant_id)
    alerts = battlecard_storage.get_claim_drift_alerts(
        tenant_id=tenant_id,
        company_name=cname,
        review_status=review_status,
        drift_type=drift_type,
        limit=limit,
        offset=offset,
    )
    return {
        "status": "success",
        "competitor_name": cname,
        "alerts": alerts,
        "total_count": len(alerts),
    }


@router.post("/api/claim-drift/{alert_id}/review")
def review_claim_drift(
    alert_id: str,
    req: ReviewClaimDriftRequest,
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Submit human review decision on a drift alert:
    - accept: Updates claim with suggested update, links new evidence, propagates to draft battlecards.
    - edit_and_accept: Updates claim with analyst's custom edits, links evidence, propagates.
    - dismiss: Marks alert dismissed, leaves claim unchanged.
    - mark_incorrect: Marks new evidence inaccurate, leaves claim unchanged.
    Maintains immutable revision audit trail.
    """
    try:
        res = battlecard_storage.record_claim_review_action(
            alert_id=alert_id,
            tenant_id=tenant_id,
            action=req.action,
            reviewer=req.reviewer,
            notes=req.notes,
            edited_fields=req.edited_claim,
        )
        return {
            "status": "success",
            "message": f"Drift alert successfully reviewed with action '{req.action}'",
            "alert": res["alert"],
            "review_action": res["review_action"],
            "propagated_battlecard_blocks_count": res.get("propagated_count", 0),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Review submission failed: {str(e)}")


@router.get("/api/battlecards/{battlecard_id}/versions")
def get_battlecard_versions(
    battlecard_id: str,
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Retrieve immutable published version history for a battlecard.
    """
    revisions = battlecard_storage.get_battlecard_revisions(
        battlecard_id=battlecard_id,
        tenant_id=tenant_id,
    )
    return {
        "status": "success",
        "battlecard_id": battlecard_id,
        "versions": revisions,
        "total_versions": len(revisions),
    }


@router.get("/api/claim-drift")
def get_global_claim_drift(
    company_name: Optional[str] = Query(None, description="Filter by competitor"),
    review_status: Optional[str] = Query(None, description="Filter: pending, accepted, edited, dismissed, marked_incorrect"),
    drift_type: Optional[str] = Query(None, description="Filter: stable, new_evidence, contradicted, stale"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(_get_tenant),
) -> Dict[str, Any]:
    """
    Global drift review workspace entrypoint.
    Provides tenant-wide view of all pending or historical claim drift alerts across tracked competitors.
    """
    alerts = battlecard_storage.get_claim_drift_alerts(
        tenant_id=tenant_id,
        company_name=company_name,
        review_status=review_status,
        drift_type=drift_type,
        limit=limit,
        offset=offset,
    )
    return {
        "status": "success",
        "alerts": alerts,
        "total_count": len(alerts),
        "limit": limit,
        "offset": offset,
    }
