"""
Batch 3 Storage Layer for PrismIQ:
Handles Sales Deals, Deal Stage History, Deal Attachments,
Recommendation Outcomes, and enhanced Next Best Actions.
Supports multi-tenant PostgreSQL execution with deterministic in-memory testing fallbacks.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from . import batch2_storage
from . import battlecard_storage

logger = logging.getLogger(__name__)

# In-memory storage structures keyed by tenant_id for offline testing
_IN_MEMORY_SALES_DEALS: Dict[str, Dict[str, Dict[str, Any]]] = {}     # {tenant_id: {deal_id: deal}}
_IN_MEMORY_DEAL_HISTORY: Dict[str, List[Dict[str, Any]]] = {}         # {tenant_id: [history_records]}
_IN_MEMORY_DEAL_ATTACHMENTS: Dict[str, List[Dict[str, Any]]] = {}     # {tenant_id: [attachment_records]}
_IN_MEMORY_OUTCOMES: Dict[str, Dict[str, Dict[str, Any]]] = {}         # {tenant_id: {outcome_id: outcome}}


def _is_test_mode() -> bool:
    from .storage import is_test_environment, is_live_write_permitted
    return is_test_environment() or not is_live_write_permitted()


def _ensure_tenant_cache(tenant_id: str):
    tid = str(tenant_id).strip()
    batch2_storage._ensure_tenant_cache(tid)
    if tid not in _IN_MEMORY_SALES_DEALS:
        _IN_MEMORY_SALES_DEALS[tid] = {}
        _IN_MEMORY_DEAL_HISTORY[tid] = []
        _IN_MEMORY_DEAL_ATTACHMENTS[tid] = []
        _IN_MEMORY_OUTCOMES[tid] = {}


def clear_tenant_cache(tenant_id: Optional[str] = None):
    """Reset Batch 3 in-memory state for test runs."""
    global _IN_MEMORY_SALES_DEALS, _IN_MEMORY_DEAL_HISTORY, _IN_MEMORY_DEAL_ATTACHMENTS, _IN_MEMORY_OUTCOMES
    if tenant_id:
        tid = str(tenant_id).strip()
        _IN_MEMORY_SALES_DEALS.pop(tid, None)
        _IN_MEMORY_DEAL_HISTORY.pop(tid, None)
        _IN_MEMORY_DEAL_ATTACHMENTS.pop(tid, None)
        _IN_MEMORY_OUTCOMES.pop(tid, None)
    else:
        _IN_MEMORY_SALES_DEALS.clear()
        _IN_MEMORY_DEAL_HISTORY.clear()
        _IN_MEMORY_DEAL_ATTACHMENTS.clear()
        _IN_MEMORY_OUTCOMES.clear()


# ============================================================================
# 1. Sales Deal Management
# ============================================================================

VALID_DEAL_STAGES = {
    "lead",
    "discovery",
    "qualification",
    "proposal",
    "negotiation",
    "contract_review",
    "closed_won",
    "closed_lost",
    "on_hold",
}


def save_deal(deal_dict: Dict[str, Any], tenant_id: str, user_id: str = "analyst") -> Dict[str, Any]:
    """
    Create or save an individual sales deal with tenant isolation.
    Maintains synchronized win/loss deal record for analytics.
    """
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    did = str(deal_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    comps = deal_dict.get("associated_competitors") or deal_dict.get("competitors_involved") or []
    if isinstance(comps, str):
        comps = [c.strip() for c in comps.split(",") if c.strip()]
    comps = [str(c).strip() for c in comps if str(c).strip()]

    stage_val = str(deal_dict.get("stage") or "discovery").strip().lower()
    raw_outcome = deal_dict.get("outcome")
    if not raw_outcome:
        if stage_val == "closed_won":
            raw_outcome = "won"
        elif stage_val == "closed_lost":
            raw_outcome = "lost"
        else:
            raw_outcome = "in_progress"

    val = deal_dict.get("deal_value")
    if val is not None:
        try:
            val = float(val)
        except (ValueError, TypeError):
            val = 0.0

    record = {
        "id": did,
        "tenant_id": tid,
        "deal_name": str(deal_dict.get("deal_name") or "Unnamed Deal").strip(),
        "customer": str(deal_dict.get("customer") or deal_dict.get("customer_name") or "Prospective Customer").strip(),
        "stage": stage_val,
        "associated_competitors": comps,
        "competitors_involved": comps,
        "primary_competitor": comps[0] if comps else "Unknown",
        "description": str(deal_dict.get("description") or deal_dict.get("notes") or "").strip(),
        "notes": str(deal_dict.get("notes") or deal_dict.get("description") or "").strip(),
        "deal_value": val,
        "outcome": str(raw_outcome).strip().lower(),
        "close_date": deal_dict.get("close_date"),
        "customer_segment": str(deal_dict.get("customer_segment") or "general").strip(),
        "industry": str(deal_dict.get("industry") or "General").strip(),
        "buyer_objections": deal_dict.get("buyer_objections") or [],
        "target_company": deal_dict.get("target_company"),
        "transcript_ids": deal_dict.get("transcript_ids") or [],
        "attachments": deal_dict.get("attachments") or [],
        "created_at": deal_dict.get("created_at") or now_iso,
        "updated_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO sales_deals (
                        id, tenant_id, deal_name, customer, stage, associated_competitors,
                        description, deal_value, outcome, close_date, customer_segment,
                        industry, buyer_objections, target_company, transcript_ids, attachments,
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        deal_name = EXCLUDED.deal_name,
                        customer = EXCLUDED.customer,
                        stage = EXCLUDED.stage,
                        associated_competitors = EXCLUDED.associated_competitors,
                        description = EXCLUDED.description,
                        deal_value = EXCLUDED.deal_value,
                        outcome = EXCLUDED.outcome,
                        close_date = EXCLUDED.close_date,
                        customer_segment = EXCLUDED.customer_segment,
                        industry = EXCLUDED.industry,
                        buyer_objections = EXCLUDED.buyer_objections,
                        target_company = EXCLUDED.target_company,
                        transcript_ids = EXCLUDED.transcript_ids,
                        attachments = EXCLUDED.attachments,
                        updated_at = EXCLUDED.updated_at
                    RETURNING id;
                """, (
                    record["id"], tid, record["deal_name"], record["customer"],
                    record["stage"], record["associated_competitors"], record["description"],
                    record["deal_value"], record["outcome"], record["close_date"],
                    record["customer_segment"], record["industry"], record["buyer_objections"],
                    record["target_company"], json.dumps(record["transcript_ids"]),
                    json.dumps(record["attachments"]), record["created_at"], record["updated_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_deal fallback: {e}")

    _IN_MEMORY_SALES_DEALS[tid][did] = record

    # Also sync into Batch 2 win_loss_deals for backwards compatibility and analytics
    batch2_storage.save_win_loss_deal({
        "id": did,
        "tenant_id": tid,
        "deal_name": record["deal_name"],
        "outcome": record["outcome"],
        "deal_value": record["deal_value"] or 0.0,
        "close_date": record["close_date"] or record["created_at"][:10],
        "primary_competitor": record["primary_competitor"],
        "competitors_involved": record["associated_competitors"],
        "customer_segment": record["customer_segment"],
        "industry": record["industry"],
        "buyer_objections": record["buyer_objections"],
        "notes": record["description"],
    }, tid)

    # Initial history record if new
    existing_history = [h for h in _IN_MEMORY_DEAL_HISTORY[tid] if h.get("deal_id") == did]
    if not existing_history:
        save_deal_stage_history(
            deal_id=did,
            from_stage=None,
            to_stage=record["stage"],
            changed_by=user_id,
            notes="Deal created",
            tenant_id=tid,
        )

    return record


def get_deal(deal_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve deal by ID with its attachments, transcripts, and stage history."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    did = str(deal_id).strip()

    deal = _IN_MEMORY_SALES_DEALS[tid].get(did)
    if not deal:
        # Check Batch 2 deals
        wl_deal = batch2_storage.get_win_loss_deal(did, tid)
        if wl_deal:
            deal = {
                "id": wl_deal["id"],
                "tenant_id": tid,
                "deal_name": wl_deal["deal_name"],
                "customer": wl_deal.get("customer") or "Customer",
                "stage": "closed_won" if wl_deal.get("outcome") == "won" else ("closed_lost" if wl_deal.get("outcome") == "lost" else "discovery"),
                "associated_competitors": wl_deal.get("competitors_involved") or ([wl_deal["primary_competitor"]] if wl_deal.get("primary_competitor") else []),
                "description": wl_deal.get("notes") or "",
                "notes": wl_deal.get("notes") or "",
                "deal_value": wl_deal.get("deal_value"),
                "outcome": wl_deal.get("outcome"),
                "close_date": wl_deal.get("close_date"),
                "customer_segment": wl_deal.get("customer_segment") or "general",
                "industry": wl_deal.get("industry") or "General",
                "buyer_objections": wl_deal.get("buyer_objections") or [],
                "transcript_ids": [],
                "attachments": [],
                "created_at": wl_deal.get("created_at"),
                "updated_at": wl_deal.get("created_at"),
            }
            _IN_MEMORY_SALES_DEALS[tid][did] = deal

    if not deal:
        return None

    # Populate nested related items
    res = dict(deal)
    res["history"] = get_deal_history(did, tid)
    res["attachments"] = list_deal_attachments(did, tid)
    
    # Retrieve linked transcripts/calls
    calls = batch2_storage.list_sales_calls(tid, deal_id=did, limit=50)
    res["transcripts"] = calls
    res["sales_calls"] = calls
    return res


def update_deal(
    deal_id: str,
    updates: Dict[str, Any],
    tenant_id: str,
    user_id: str = "analyst",
) -> Optional[Dict[str, Any]]:
    """Update deal properties and track stage transitions in history."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    did = str(deal_id).strip()

    deal = get_deal(did, tid)
    if not deal:
        return None

    old_stage = deal.get("stage", "discovery")
    new_stage = updates.get("stage")
    if new_stage:
        new_stage = str(new_stage).strip().lower()

    # Track stage transition
    if new_stage and new_stage != old_stage:
        deal["stage"] = new_stage
        if new_stage == "closed_won":
            deal["outcome"] = "won"
        elif new_stage == "closed_lost":
            deal["outcome"] = "lost"

        save_deal_stage_history(
            deal_id=did,
            from_stage=old_stage,
            to_stage=new_stage,
            changed_by=user_id,
            notes=str(updates.get("stage_change_notes") or updates.get("notes") or f"Stage updated from {old_stage} to {new_stage}"),
            tenant_id=tid,
        )

    # Apply other updates
    for field in [
        "deal_name", "customer", "description", "notes", "deal_value",
        "close_date", "customer_segment", "industry", "target_company", "outcome",
    ]:
        if field in updates and updates[field] is not None:
            deal[field] = updates[field]

    if "associated_competitors" in updates and updates["associated_competitors"] is not None:
        comps = updates["associated_competitors"]
        if isinstance(comps, str):
            comps = [c.strip() for c in comps.split(",") if c.strip()]
        deal["associated_competitors"] = [str(c).strip() for c in comps if str(c).strip()]
        deal["competitors_involved"] = deal["associated_competitors"]
        if deal["associated_competitors"]:
            deal["primary_competitor"] = deal["associated_competitors"][0]

    deal["updated_at"] = datetime.now(timezone.utc).isoformat()
    return save_deal(deal, tid, user_id=user_id)


def list_deals(
    tenant_id: str,
    stage: Optional[str] = None,
    customer: Optional[str] = None,
    competitor: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """List sales deals for tenant with stage, customer, and competitor filters."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    deals = list(_IN_MEMORY_SALES_DEALS[tid].values())

    # Include any Batch 2 win_loss_deals not yet represented
    wl_deals = batch2_storage.list_win_loss_deals(tid, limit=200)
    for w in wl_deals:
        if w["id"] not in _IN_MEMORY_SALES_DEALS[tid]:
            d_mapped = {
                "id": w["id"],
                "tenant_id": tid,
                "deal_name": w["deal_name"],
                "customer": w.get("customer") or "Customer",
                "stage": "closed_won" if w.get("outcome") == "won" else ("closed_lost" if w.get("outcome") == "lost" else "discovery"),
                "associated_competitors": w.get("competitors_involved") or ([w["primary_competitor"]] if w.get("primary_competitor") else []),
                "description": w.get("notes") or "",
                "notes": w.get("notes") or "",
                "deal_value": w.get("deal_value"),
                "outcome": w.get("outcome"),
                "close_date": w.get("close_date"),
                "customer_segment": w.get("customer_segment") or "general",
                "industry": w.get("industry") or "General",
                "buyer_objections": w.get("buyer_objections") or [],
                "transcript_ids": [],
                "attachments": [],
                "created_at": w.get("created_at"),
                "updated_at": w.get("created_at"),
            }
            _IN_MEMORY_SALES_DEALS[tid][w["id"]] = d_mapped
            deals.append(d_mapped)

    if stage:
        st = stage.strip().lower()
        deals = [d for d in deals if d.get("stage", "").lower() == st]
    if customer:
        cust = customer.strip().lower()
        deals = [d for d in deals if cust in d.get("customer", "").lower()]
    if competitor:
        comp = competitor.strip().lower()
        deals = [
            d for d in deals
            if any(comp == str(c).lower() for c in d.get("associated_competitors", []))
            or comp == str(d.get("primary_competitor", "")).lower()
        ]

    deals = sorted(deals, key=lambda d: d.get("updated_at", d.get("created_at", "")), reverse=True)
    return deals[offset : offset + limit]


# ============================================================================
# 2. Deal History & Attachments
# ============================================================================

def save_deal_stage_history(
    deal_id: str,
    from_stage: Optional[str],
    to_stage: str,
    changed_by: str,
    notes: Optional[str],
    tenant_id: str,
) -> Dict[str, Any]:
    """Record historical stage transition or deal milestone."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    hid = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": hid,
        "deal_id": str(deal_id).strip(),
        "tenant_id": tid,
        "from_stage": from_stage,
        "to_stage": to_stage,
        "changed_by": str(changed_by or "analyst").strip(),
        "notes": str(notes or "").strip(),
        "created_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO deal_stage_history (
                        id, deal_id, tenant_id, from_stage, to_stage, changed_by, notes, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    record["id"], record["deal_id"], tid, record["from_stage"],
                    record["to_stage"], record["changed_by"], record["notes"], record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_deal_stage_history fallback: {e}")

    _IN_MEMORY_DEAL_HISTORY[tid].append(record)
    return record


def get_deal_history(deal_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """Retrieve chronological history for a deal."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    did = str(deal_id).strip()

    history = [h for h in _IN_MEMORY_DEAL_HISTORY[tid] if h.get("deal_id") == did]
    return sorted(history, key=lambda h: h.get("created_at", ""))


def save_deal_attachment(
    deal_id: str,
    attachment_dict: Dict[str, Any],
    tenant_id: str,
) -> Dict[str, Any]:
    """Store attachment metadata or document linked to a deal."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    att_id = str(attachment_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": att_id,
        "deal_id": str(deal_id).strip(),
        "tenant_id": tid,
        "filename": str(attachment_dict.get("filename") or "document.txt").strip(),
        "file_format": str(attachment_dict.get("file_format") or "txt").strip(),
        "file_url": attachment_dict.get("file_url"),
        "content": attachment_dict.get("content"),
        "metadata": attachment_dict.get("metadata") or {},
        "uploaded_at": attachment_dict.get("uploaded_at") or now_iso,
        "created_at": attachment_dict.get("uploaded_at") or now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO deal_attachments (
                        id, deal_id, tenant_id, filename, file_format, file_url, metadata, uploaded_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    record["id"], record["deal_id"], tid, record["filename"],
                    record["file_format"], record["file_url"], json.dumps(record["metadata"]),
                    record["uploaded_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_deal_attachment fallback: {e}")

    _IN_MEMORY_DEAL_ATTACHMENTS[tid].append(record)

    # Also register attachment on deal record
    deal = _IN_MEMORY_SALES_DEALS[tid].get(str(deal_id).strip())
    if deal:
        att_list = deal.get("attachments") or []
        att_list.append(record)
        deal["attachments"] = att_list

    return record


def list_deal_attachments(deal_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """List attachments associated with a specific deal."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    did = str(deal_id).strip()

    attachments = [a for a in _IN_MEMORY_DEAL_ATTACHMENTS[tid] if a.get("deal_id") == did]
    return sorted(attachments, key=lambda a: a.get("uploaded_at", ""), reverse=True)


# ============================================================================
# 3. Lightweight Outcome Tracking
# ============================================================================

def record_recommendation_outcome(
    outcome_dict: Dict[str, Any],
    tenant_id: str,
) -> Dict[str, Any]:
    """
    Connect recommendation/action to business outcomes.
    Strictly distinguishes recorded association from proven causation.
    """
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    oid = str(outcome_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    rec_id = str(outcome_dict.get("recommendation_id") or outcome_dict.get("action_id") or "").strip()
    deal_id = str(outcome_dict.get("related_deal") or outcome_dict.get("deal_id") or "").strip()
    outcome_val = str(outcome_dict.get("outcome") or "won").strip().lower()
    action_taken = str(outcome_dict.get("action_taken") or "").strip()

    record = {
        "id": oid,
        "tenant_id": tid,
        "recommendation_id": rec_id,
        "action_taken": action_taken,
        "related_deal": deal_id,
        "deal_id": deal_id,
        "outcome": outcome_val,
        "outcome_date": outcome_dict.get("outcome_date") or now_iso[:10],
        "notes": str(outcome_dict.get("notes") or "").strip(),
        # Strict causation boundary
        "attribution_type": "recorded_association",
        "causation_claimed": False,
        "attribution_disclaimer": "Recorded association between action and deal outcome; does not establish direct causation.",
        "created_at": outcome_dict.get("created_at") or now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO recommendation_outcomes (
                        id, tenant_id, recommendation_id, action_taken, related_deal,
                        outcome, outcome_date, notes, attribution_type, causation_claimed,
                        attribution_disclaimer, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    record["id"], tid, record["recommendation_id"], record["action_taken"],
                    record["related_deal"], record["outcome"], record["outcome_date"],
                    record["notes"], record["attribution_type"], record["causation_claimed"],
                    record["attribution_disclaimer"], record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"DB record_recommendation_outcome fallback: {e}")

    _IN_MEMORY_OUTCOMES[tid][oid] = record
    return record


def get_recommendation_outcome(outcome_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve outcome record by ID."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    return _IN_MEMORY_OUTCOMES[tid].get(str(outcome_id).strip())


def list_recommendation_outcomes(
    tenant_id: str,
    deal_id: Optional[str] = None,
    recommendation_id: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """List recorded outcomes with filters."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    items = list(_IN_MEMORY_OUTCOMES[tid].values())
    if deal_id:
        did = str(deal_id).strip()
        items = [i for i in items if i.get("related_deal") == did or i.get("deal_id") == did]
    if recommendation_id:
        rid = str(recommendation_id).strip()
        items = [i for i in items if i.get("recommendation_id") == rid]
    if outcome:
        oc = str(outcome).strip().lower()
        items = [i for i in items if i.get("outcome", "").lower() == oc]

    items = sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)
    return items[offset : offset + limit]
