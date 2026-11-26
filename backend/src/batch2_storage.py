"""
Batch 2 Storage Layer for PrismIQ:
Handles raw_documents, customer_feedback_records, customer_feedback_themes,
next_best_actions, and action_status_audits.
Supports multi-tenant PostgreSQL execution with deterministic in-memory testing fallbacks.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# In-memory storage structures keyed by tenant_id for offline testing
_IN_MEMORY_DOCS: Dict[str, Dict[str, Dict[str, Any]]] = {}            # {tenant_id: {doc_id: doc}}
_IN_MEMORY_DOCS_BY_HASH: Dict[str, Dict[str, str]] = {}              # {tenant_id: {content_hash: doc_id}}
_IN_MEMORY_FEEDBACK: Dict[str, List[Dict[str, Any]]] = {}            # {tenant_id: [feedback_records]}
_IN_MEMORY_THEMES: Dict[str, List[Dict[str, Any]]] = {}              # {tenant_id: [themes]}
_IN_MEMORY_ACTIONS: Dict[str, Dict[str, Dict[str, Any]]] = {}        # {tenant_id: {action_id: action}}
_IN_MEMORY_AUDITS: Dict[str, List[Dict[str, Any]]] = {}              # {tenant_id: [audits]}


def _is_test_mode() -> bool:
    from .storage import is_test_environment, is_live_write_permitted
    return is_test_environment() or not is_live_write_permitted()


def _ensure_tenant_cache(tenant_id: str):
    tid = str(tenant_id).strip()
    if tid not in _IN_MEMORY_DOCS:
        _IN_MEMORY_DOCS[tid] = {}
        _IN_MEMORY_DOCS_BY_HASH[tid] = {}
        _IN_MEMORY_FEEDBACK[tid] = []
        _IN_MEMORY_THEMES[tid] = []
        _IN_MEMORY_ACTIONS[tid] = {}
        _IN_MEMORY_AUDITS[tid] = []

        from .storage import is_test_environment
        known_demo_tenants = {
            "8553449a-c998-4727-be01-9aeb724038cb",
            "c8f13b91-46ef-4682-9975-f85764d8a12e",
            "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f",
        }
        if not is_test_environment() and tid in known_demo_tenants:
            try:
                from . import storage
                from .batch2_seed_data import seed_batch2_intelligence
                cfg = storage.get_tenant_workspace_config(tid)
                seed_batch2_intelligence(tid, (cfg or {}).get("target_company"))
            except Exception as e:
                logger.warning(f"Could not auto-seed batch 2 data for {tid}: {e}")


def clear_tenant_cache(tenant_id: Optional[str] = None):
    """Utility for test suites to reset in-memory state."""
    global _IN_MEMORY_DOCS, _IN_MEMORY_DOCS_BY_HASH, _IN_MEMORY_FEEDBACK, _IN_MEMORY_THEMES
    global _IN_MEMORY_ACTIONS, _IN_MEMORY_AUDITS
    if tenant_id:
        tid = str(tenant_id).strip()
        _IN_MEMORY_DOCS.pop(tid, None)
        _IN_MEMORY_DOCS_BY_HASH.pop(tid, None)
        _IN_MEMORY_FEEDBACK.pop(tid, None)
        _IN_MEMORY_THEMES.pop(tid, None)
        _IN_MEMORY_ACTIONS.pop(tid, None)
        _IN_MEMORY_AUDITS.pop(tid, None)
    else:
        _IN_MEMORY_DOCS.clear()
        _IN_MEMORY_DOCS_BY_HASH.clear()
        _IN_MEMORY_FEEDBACK.clear()
        _IN_MEMORY_THEMES.clear()
        _IN_MEMORY_ACTIONS.clear()
        _IN_MEMORY_AUDITS.clear()

    try:
        from . import batch4_storage
        batch4_storage.clear_tenant_cache(tenant_id)
    except Exception:
        pass


# ============================================================================
# 1. Raw Documents
# ============================================================================

def save_document(doc_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Save an ingested document record or return existing if duplicate hash."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    chash = str(doc_dict.get("content_hash") or "").strip()
    if chash and chash in _IN_MEMORY_DOCS_BY_HASH[tid]:
        existing_id = _IN_MEMORY_DOCS_BY_HASH[tid][chash]
        existing = _IN_MEMORY_DOCS[tid].get(existing_id)
        if existing:
            res = dict(existing)
            res["is_duplicate"] = True
            return res

    doc_id = str(doc_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": doc_id,
        "tenant_id": tid,
        "source_type": str(doc_dict.get("source_type") or "notes").strip(),
        "file_format": str(doc_dict.get("file_format") or "txt").strip(),
        "filename": str(doc_dict.get("filename") or doc_dict.get("title") or "untitled").strip(),
        "title": str(doc_dict.get("title") or doc_dict.get("filename") or "untitled").strip(),
        "content_hash": chash,
        "raw_content": str(doc_dict.get("raw_content") or ""),
        "metadata": doc_dict.get("metadata") or {},
        "processing_status": str(doc_dict.get("processing_status") or "processed").strip(),
        "created_at": doc_dict.get("created_at") or now_iso,
        "is_duplicate": False,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO raw_documents (
                        id, tenant_id, source_type, file_format, filename,
                        content_hash, raw_content, metadata, processing_status, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, content_hash) DO NOTHING
                    RETURNING id;
                """, (
                    doc_id, tid, record["source_type"], record["file_format"], record["filename"],
                    record["content_hash"], record["raw_content"], json.dumps(record["metadata"]),
                    record["processing_status"], record["created_at"]
                ))
                row = cur.fetchone()
                if not row:
                    # Duplicate hit in DB
                    cur.execute("""
                        SELECT id, tenant_id, source_type, file_format, filename,
                               content_hash, raw_content, metadata, processing_status, created_at
                        FROM raw_documents
                        WHERE tenant_id = %s AND content_hash = %s;
                    """, (tid, record["content_hash"]))
                    existing_db = cur.fetchone()
                    if existing_db:
                        return {
                            "id": str(existing_db[0]), "tenant_id": str(existing_db[1]),
                            "source_type": existing_db[2], "file_format": existing_db[3],
                            "filename": existing_db[4], "content_hash": existing_db[5],
                            "raw_content": existing_db[6],
                            "metadata": existing_db[7] if isinstance(existing_db[7], dict) else json.loads(existing_db[7] or "{}"),
                            "processing_status": existing_db[8], "created_at": str(existing_db[9]),
                            "is_duplicate": True,
                        }
        except Exception as e:
            logger.warning(f"DB save_document error: {e}. Falling back to in-memory.")

    _IN_MEMORY_DOCS[tid][doc_id] = record
    if chash:
        _IN_MEMORY_DOCS_BY_HASH[tid][chash] = doc_id
    return record


def get_document(document_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve document by ID."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    did = str(document_id).strip()
    return _IN_MEMORY_DOCS[tid].get(did)


def list_documents(
    tenant_id: str,
    source_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """List documents for tenant with optional source_type filter."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    docs = list(_IN_MEMORY_DOCS[tid].values())
    if source_type:
        st = source_type.strip().lower()
        docs = [d for d in docs if d.get("source_type", "").lower() == st]
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs[offset : offset + limit]


# ============================================================================
# 2. Customer Feedback Records
# ============================================================================

def save_feedback_records(records: List[Dict[str, Any]], tenant_id: str) -> List[Dict[str, Any]]:
    """Save customer feedback records."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    saved = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for r in records:
        fid = str(r.get("id") or uuid.uuid4())
        rec = {
            "id": fid,
            "tenant_id": tid,
            "document_id": str(r.get("document_id")) if r.get("document_id") else None,
            "company_name": str(r.get("company_name") or "Unknown").strip(),
            "feedback_channel": str(r.get("feedback_channel") or "customer_review").strip(),
            "category": str(r.get("category") or "dislike").strip(),
            "sentiment": str(r.get("sentiment") or "neutral").strip(),
            "raw_quote": str(r.get("raw_quote") or "").strip(),
            "aspect": str(r.get("aspect") or "General").strip(),
            "customer_segment": str(r.get("customer_segment") or "general").strip(),
            "publication_date": r.get("publication_date") or now_iso,
            "created_at": r.get("created_at") or now_iso,
        }
        _IN_MEMORY_FEEDBACK[tid].append(rec)
        saved.append(rec)

    return saved


def list_feedback_records(
    tenant_id: str,
    company_name: Optional[str] = None,
    category: Optional[str] = None,
    sentiment: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Query customer feedback records by tenant and filters."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    items = _IN_MEMORY_FEEDBACK[tid]

    if company_name:
        cn = company_name.strip().lower()
        items = [i for i in items if i.get("company_name", "").lower() == cn]
    if category:
        cat = category.strip().lower()
        items = [i for i in items if i.get("category", "").lower() == cat]
    if sentiment:
        snt = sentiment.strip().lower()
        items = [i for i in items if i.get("sentiment", "").lower() == snt]

    items = sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)
    return items[offset : offset + limit]


# ============================================================================
# 3. Customer Feedback Themes
# ============================================================================

def save_feedback_themes(themes: List[Dict[str, Any]], tenant_id: str) -> List[Dict[str, Any]]:
    """Save aggregated feedback themes."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    saved = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for t in themes:
        thid = str(t.get("id") or uuid.uuid4())
        rec = {
            "id": thid,
            "tenant_id": tid,
            "company_name": str(t.get("company_name") or "Unknown").strip(),
            "theme_title": str(t.get("theme_title") or "").strip(),
            "category": str(t.get("category") or "dislike").strip(),
            "occurrence_count": int(t.get("occurrence_count") or 1),
            "sample_size": int(t.get("sample_size") or 1),
            "sentiment_breakdown": t.get("sentiment_breakdown") or {"positive": 0, "negative": 0, "neutral": 0},
            "representative_quotes": t.get("representative_quotes") or [],
            "is_competitive_opportunity": bool(t.get("is_competitive_opportunity")),
            "confidence": str(t.get("confidence") or "Medium").strip(),
            "created_at": t.get("created_at") or now_iso,
            "updated_at": now_iso,
        }
        _IN_MEMORY_THEMES[tid].append(rec)
        saved.append(rec)

    return saved


def list_feedback_themes(
    tenant_id: str,
    company_name: Optional[str] = None,
    category: Optional[str] = None,
    only_opportunities: bool = False,
) -> List[Dict[str, Any]]:
    """List feedback themes filtered by company, category, and opportunity flag."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    themes = _IN_MEMORY_THEMES[tid]

    if company_name:
        cn = company_name.strip().lower()
        themes = [t for t in themes if t.get("company_name", "").lower() == cn]
    if category:
        cat = category.strip().lower()
        themes = [t for t in themes if t.get("category", "").lower() == cat]
    if only_opportunities:
        themes = [t for t in themes if t.get("is_competitive_opportunity")]

    themes = sorted(themes, key=lambda t: t.get("occurrence_count", 0), reverse=True)
    return themes


# ============================================================================
# 4. Next Best Actions & Audits
# ============================================================================

def save_next_best_action(action_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Save Next Best Action recommendation with duplicate prevention."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    now_iso = datetime.now(timezone.utc).isoformat()

    raw_team = str(action_dict.get("responsible_department") or action_dict.get("department") or action_dict.get("team") or action_dict.get("affected_team") or "Sales").strip()
    team_title = raw_team.title()
    team_lower = raw_team.lower()

    title = str(action_dict.get("title") or "Recommended Action").strip()
    category = str(action_dict.get("category") or "positioning").strip()

    # Deduplication key across department, category, and title
    dedup_key = str(action_dict.get("deduplication_key") or f"{tid}_global_{team_lower}_{title[:40]}").strip()

    # Check for existing action to prevent duplicates
    for existing in _IN_MEMORY_ACTIONS[tid].values():
        existing_status = str(existing.get("status", "")).lower()
        if existing_status not in ("dismissed", "completed"):
            if existing.get("deduplication_key") == dedup_key:
                return existing
            if (
                existing.get("team", "").lower() == team_lower
                and existing.get("title", "").strip().lower() == title.lower()
            ):
                return existing

    aid = str(action_dict.get("id") or uuid.uuid4())
    urgency = str(action_dict.get("priority") or action_dict.get("urgency") or "Medium").strip().title()
    priority = urgency
    desc = str(action_dict.get("description") or action_dict.get("recommended_action") or "").strip()
    reason = str(action_dict.get("reason") or action_dict.get("why_it_matters") or "").strip()
    evidence = action_dict.get("evidence_references") or action_dict.get("supporting_evidence") or []

    status_val = str(action_dict.get("status") or action_dict.get("review_status") or "pending").strip()
    status_lower = status_val.lower().replace(" ", "_")

    record = {
        "id": aid,
        "tenant_id": tid,
        "team": team_title,
        "department": team_title,
        "responsible_department": team_title,
        "affected_team": team_lower,
        "category": category,
        "title": title,
        "description": desc,
        "recommended_action": desc,
        "reason": reason,
        "why_it_matters": reason,
        "what_happened": str(action_dict.get("what_happened") or "").strip(),
        "priority": priority,
        "urgency": urgency,
        "confidence": str(action_dict.get("confidence") or "Medium").strip(),
        "status": status_val,
        "review_status": status_lower,
        "owner": action_dict.get("owner"),
        "due_date": action_dict.get("due_date"),
        "related_competitor": str(action_dict.get("related_competitor") or "").strip(),
        "supporting_evidence": evidence,
        "evidence_references": evidence,
        "deduplication_key": dedup_key,
        "created_at": action_dict.get("created_at") or now_iso,
        "completed_at": action_dict.get("completed_at"),
        "updated_at": now_iso,
    }

    _IN_MEMORY_ACTIONS[tid][aid] = record
    return record


def save_next_best_actions_batch(actions: List[Dict[str, Any]], tenant_id: str) -> List[Dict[str, Any]]:
    """Save batch of next best actions."""
    saved = []
    for a in actions:
        rec = save_next_best_action(a, tenant_id)
        if rec not in saved:
            saved.append(rec)
    return saved


def save_next_best_actions(actions: List[Dict[str, Any]], tenant_id: str) -> List[Dict[str, Any]]:
    """Save batch of next best actions."""
    return save_next_best_actions_batch(actions, tenant_id)


def get_next_best_action(action_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve action by ID."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    return _IN_MEMORY_ACTIONS[tid].get(str(action_id).strip())


def list_next_best_actions(
    tenant_id: str,
    team: Optional[str] = None,
    department: Optional[str] = None,
    urgency: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    related_competitor: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """List Next Best Actions with filters."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    actions = list(_IN_MEMORY_ACTIONS[tid].values())

    filter_team = (team or department or "").strip().lower()
    if filter_team:
        actions = [a for a in actions if a.get("team", "").lower() == filter_team or a.get("department", "").lower() == filter_team]

    filter_urg = (priority or urgency or "").strip().lower()
    if filter_urg:
        actions = [a for a in actions if a.get("urgency", "").lower() == filter_urg or a.get("priority", "").lower() == filter_urg]

    if status:
        st = status.strip().lower().replace(" ", "_")
        actions = [a for a in actions if a.get("status", "").lower().replace(" ", "_") == st or a.get("review_status", "").lower() == st]

    if related_competitor:
        rc = related_competitor.strip().lower()
        actions = [a for a in actions if a.get("related_competitor", "").lower() == rc]

    actions = sorted(actions, key=lambda a: a.get("created_at", ""), reverse=True)
    return actions[offset : offset + limit]


def update_action_status(
    action_id: str,
    new_status: str,
    user_id: str = "analyst",
    notes: Optional[str] = None,
    tenant_id: str = "00000000-0000-0000-0000-000000000000",
    owner: Optional[str] = None,
    due_date: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Update action status, owner, due_date and record audit log."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    aid = str(action_id).strip()
    action = _IN_MEMORY_ACTIONS[tid].get(aid)
    if not action:
        return None

    valid_statuses = {
        "pending", "in_progress", "in progress", "accepted", "completed", "dismissed", "irrelevant"
    }
    raw_ns = str(new_status).strip().lower().replace(" ", "_")
    if raw_ns not in valid_statuses:
        raise ValueError(f"Invalid action status '{new_status}'. Must be one of: Pending, In Progress, Completed, Dismissed, Accepted, Irrelevant")

    prior = str(action.get("review_status") or action.get("status") or "pending").lower().replace(" ", "_")
    now_iso = datetime.now(timezone.utc).isoformat()

    if raw_ns == "accepted":
        canonical = "accepted" if new_status.islower() else "Accepted"
        audit_new = "accepted" if new_status.islower() else "Accepted"
    elif raw_ns in ("in_progress", "in progress"):
        canonical = "in_progress" if new_status.islower() else "In Progress"
        audit_new = "in_progress" if new_status.islower() else "In Progress"
    elif raw_ns == "completed":
        canonical = "completed" if new_status.islower() else "Completed"
        audit_new = "completed" if new_status.islower() else "Completed"
    elif raw_ns == "dismissed":
        canonical = "dismissed" if new_status.islower() else "Dismissed"
        audit_new = "dismissed" if new_status.islower() else "Dismissed"
    elif raw_ns == "irrelevant":
        canonical = "irrelevant"
        audit_new = "irrelevant"
    else:
        canonical = new_status
        audit_new = new_status.lower()

    action["status"] = canonical
    action["review_status"] = raw_ns
    action["updated_at"] = now_iso

    if raw_ns == "completed":
        action["completed_at"] = now_iso
    elif prior == "completed" and raw_ns != "completed":
        action["completed_at"] = None

    if owner is not None:
        action["owner"] = owner
    if due_date is not None:
        action["due_date"] = due_date

    audit_entry = {
        "id": str(uuid.uuid4()),
        "tenant_id": tid,
        "action_id": aid,
        "prior_status": prior,
        "old_status": prior,
        "new_status": audit_new,
        "user_id": str(user_id or "analyst").strip(),
        "changed_by": str(user_id or "analyst").strip(),
        "notes": str(notes or "").strip(),
        "reason": str(notes or "").strip(),
        "created_at": now_iso,
    }
    _IN_MEMORY_AUDITS[tid].append(audit_entry)

    return action

    return action


def list_action_audits(action_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """List audit entries for an action."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    aid = str(action_id).strip()
    return [a for a in _IN_MEMORY_AUDITS[tid] if a.get("action_id") == aid]

