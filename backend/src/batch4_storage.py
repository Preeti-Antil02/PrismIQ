"""
Batch 4 Storage Layer for PrismIQ:
Handles:
- Competitive Relationships and Relationship Change History
- Competitive Threat Scores and Factor Breakdowns
- Emerging Competitor Candidates and Human Review Workflows
- Governed Evidence with Provenance, Verification, and Contradictory Links
- Analyst Feedback on Claims and Intelligence Records
- Intelligence Impact Lineage & Reporting
Supports multi-tenant PostgreSQL execution with deterministic in-memory testing fallbacks.
"""

import copy
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# In-memory storage keyed by tenant_id for offline testing
_IN_MEMORY_RELATIONSHIPS: Dict[str, Dict[str, Dict[str, Any]]] = {}     # {tenant_id: {rel_id: rel}}
_IN_MEMORY_REL_HISTORY: Dict[str, List[Dict[str, Any]]] = {}            # {tenant_id: [history_records]}
_IN_MEMORY_THREAT_SCORES: Dict[str, Dict[str, Dict[str, Any]]] = {}     # {tenant_id: {comp_name: score_record}}
_IN_MEMORY_EMERGING_CANDS: Dict[str, Dict[str, Dict[str, Any]]] = {}    # {tenant_id: {cand_id: cand_record}}
_IN_MEMORY_GOVERNED_EVIDENCE: Dict[str, Dict[str, Dict[str, Any]]] = {} # {tenant_id: {evidence_id: evidence_record}}
_IN_MEMORY_CONTRADICTORY_LINKS: Dict[str, List[Dict[str, Any]]] = {}    # {tenant_id: [link_records]}
_IN_MEMORY_ANALYST_FEEDBACK: Dict[str, List[Dict[str, Any]]] = {}       # {tenant_id: [feedback_records]}


def _is_test_mode() -> bool:
    from .storage import is_test_environment, is_live_write_permitted
    return is_test_environment() or not is_live_write_permitted()


def _ensure_tenant_cache(tenant_id: str):
    tid = str(tenant_id).strip()
    if tid not in _IN_MEMORY_RELATIONSHIPS:
        _IN_MEMORY_RELATIONSHIPS[tid] = {}
        _IN_MEMORY_REL_HISTORY[tid] = []
        _IN_MEMORY_THREAT_SCORES[tid] = {}
        _IN_MEMORY_EMERGING_CANDS[tid] = {}
        _IN_MEMORY_GOVERNED_EVIDENCE[tid] = {}
        _IN_MEMORY_CONTRADICTORY_LINKS[tid] = []
        _IN_MEMORY_ANALYST_FEEDBACK[tid] = []


def clear_tenant_cache(tenant_id: Optional[str] = None):
    """Reset Batch 4 in-memory state for test isolation."""
    global _IN_MEMORY_RELATIONSHIPS, _IN_MEMORY_REL_HISTORY, _IN_MEMORY_THREAT_SCORES
    global _IN_MEMORY_EMERGING_CANDS, _IN_MEMORY_GOVERNED_EVIDENCE
    global _IN_MEMORY_CONTRADICTORY_LINKS, _IN_MEMORY_ANALYST_FEEDBACK

    if tenant_id:
        tid = str(tenant_id).strip()
        _IN_MEMORY_RELATIONSHIPS.pop(tid, None)
        _IN_MEMORY_REL_HISTORY.pop(tid, None)
        _IN_MEMORY_THREAT_SCORES.pop(tid, None)
        _IN_MEMORY_EMERGING_CANDS.pop(tid, None)
        _IN_MEMORY_GOVERNED_EVIDENCE.pop(tid, None)
        _IN_MEMORY_CONTRADICTORY_LINKS.pop(tid, None)
        _IN_MEMORY_ANALYST_FEEDBACK.pop(tid, None)
    else:
        _IN_MEMORY_RELATIONSHIPS.clear()
        _IN_MEMORY_REL_HISTORY.clear()
        _IN_MEMORY_THREAT_SCORES.clear()
        _IN_MEMORY_EMERGING_CANDS.clear()
        _IN_MEMORY_GOVERNED_EVIDENCE.clear()
        _IN_MEMORY_CONTRADICTORY_LINKS.clear()
        _IN_MEMORY_ANALYST_FEEDBACK.clear()


# ============================================================================
# 1. Competitive Relationship Engine Storage
# ============================================================================

VALID_ENTITY_TYPES = {
    "competitor", "product", "feature", "event", "signal",
    "partnership", "hiring", "strategic_pattern", "evidence", "deal"
}


def save_relationship(rel_dict: Dict[str, Any], tenant_id: str, actor_id: str = "system") -> Dict[str, Any]:
    """Create or update a structured competitive relationship with source/inference tracking."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    rid = str(rel_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    sub_id = str(rel_dict.get("subject_id") or "").strip()
    sub_type = str(rel_dict.get("subject_type") or "competitor").strip().lower()
    sub_name = str(rel_dict.get("subject_name") or sub_id).strip()

    predicate = str(rel_dict.get("predicate") or "relates_to").strip().lower()

    obj_id = str(rel_dict.get("object_id") or "").strip()
    obj_type = str(rel_dict.get("object_type") or "competitor").strip().lower()
    obj_name = str(rel_dict.get("object_name") or obj_id).strip()

    is_inferred = bool(rel_dict.get("is_inferred", False))
    inference_reason = str(rel_dict.get("inference_reason") or "").strip() if is_inferred else None
    rel_source = str(rel_dict.get("relationship_source") or ("inferred" if is_inferred else "verified_fact")).strip()
    source_ref = str(rel_dict.get("source_reference") or "").strip() or None

    is_update = rid in _IN_MEMORY_RELATIONSHIPS[tid]
    old_state = copy.deepcopy(_IN_MEMORY_RELATIONSHIPS[tid].get(rid)) if is_update else None

    record = {
        "id": rid,
        "tenant_id": tid,
        "subject_id": sub_id,
        "subject_type": sub_type,
        "subject_name": sub_name,
        "predicate": predicate,
        "object_id": obj_id,
        "object_type": obj_type,
        "object_name": obj_name,
        "relationship_source": rel_source,
        "source_reference": source_ref,
        "is_inferred": is_inferred,
        "inference_reason": inference_reason,
        "confidence": str(rel_dict.get("confidence") or "High").strip(),
        "status": str(rel_dict.get("status") or "active").strip().lower(),
        "metadata": rel_dict.get("metadata") or {},
        "created_at": rel_dict.get("created_at") or (old_state.get("created_at") if old_state else now_iso),
        "updated_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO competitive_relationships (
                        id, tenant_id, subject_id, subject_type, subject_name,
                        predicate, object_id, object_type, object_name,
                        relationship_source, source_reference, is_inferred,
                        inference_reason, confidence, status, metadata,
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        predicate = EXCLUDED.predicate,
                        object_id = EXCLUDED.object_id,
                        object_name = EXCLUDED.object_name,
                        relationship_source = EXCLUDED.relationship_source,
                        source_reference = EXCLUDED.source_reference,
                        is_inferred = EXCLUDED.is_inferred,
                        inference_reason = EXCLUDED.inference_reason,
                        confidence = EXCLUDED.confidence,
                        status = EXCLUDED.status,
                        metadata = EXCLUDED.metadata,
                        updated_at = EXCLUDED.updated_at;
                """, (
                    record["id"], tid, record["subject_id"], record["subject_type"], record["subject_name"],
                    record["predicate"], record["object_id"], record["object_type"], record["object_name"],
                    record["relationship_source"], record["source_reference"], record["is_inferred"],
                    record["inference_reason"], record["confidence"], record["status"], json.dumps(record["metadata"]),
                    record["created_at"], record["updated_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_relationship fallback: {e}")

    _IN_MEMORY_RELATIONSHIPS[tid][rid] = copy.deepcopy(record)

    # Log relationship history
    action_type = "updated" if is_update else "created"
    save_relationship_history(
        relationship_id=rid,
        action_type=action_type,
        actor_id=actor_id,
        prior_state=old_state,
        new_state=copy.deepcopy(record),
        tenant_id=tid,
    )

    return copy.deepcopy(record)


def get_relationship(rel_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve relationship by ID."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    rel = _IN_MEMORY_RELATIONSHIPS[tid].get(str(rel_id).strip())
    return copy.deepcopy(rel) if rel else None


def list_relationships(
    tenant_id: str,
    subject_id: Optional[str] = None,
    subject_type: Optional[str] = None,
    predicate: Optional[str] = None,
    object_id: Optional[str] = None,
    object_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    status: Optional[str] = "active",
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Query relationships with multi-faceted graph edge filters."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    items = list(_IN_MEMORY_RELATIONSHIPS[tid].values())

    if status:
        st = status.strip().lower()
        items = [i for i in items if i.get("status", "").lower() == st]

    if entity_id:
        eid = str(entity_id).strip().lower()
        items = [i for i in items if i.get("subject_id", "").lower() == eid or i.get("object_id", "").lower() == eid or i.get("subject_name", "").lower() == eid or i.get("object_name", "").lower() == eid]

    if subject_id:
        sid = str(subject_id).strip().lower()
        items = [i for i in items if i.get("subject_id", "").lower() == sid or i.get("subject_name", "").lower() == sid]

    if subject_type:
        stype = str(subject_type).strip().lower()
        items = [i for i in items if i.get("subject_type", "").lower() == stype]

    if predicate:
        pred = str(predicate).strip().lower()
        items = [i for i in items if i.get("predicate", "").lower() == pred]

    if object_id:
        oid = str(object_id).strip().lower()
        items = [i for i in items if i.get("object_id", "").lower() == oid or i.get("object_name", "").lower() == oid]

    if object_type:
        otype = str(object_type).strip().lower()
        items = [i for i in items if i.get("object_type", "").lower() == otype]

    items = sorted(items, key=lambda x: x.get("updated_at", ""), reverse=True)
    return items[offset : offset + limit]


def save_relationship_history(
    relationship_id: str,
    action_type: str,
    actor_id: str,
    prior_state: Optional[Dict[str, Any]],
    new_state: Dict[str, Any],
    tenant_id: str,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Record relationship mutation audit entry."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    hid = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": hid,
        "relationship_id": str(relationship_id).strip(),
        "tenant_id": tid,
        "action_type": str(action_type).strip().lower(),
        "actor_id": str(actor_id or "system").strip(),
        "prior_state": prior_state,
        "new_state": new_state,
        "notes": str(notes or "").strip(),
        "created_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO relationship_history (
                        id, relationship_id, tenant_id, action_type, actor_id,
                        prior_state, new_state, notes, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    record["id"], record["relationship_id"], tid, record["action_type"],
                    record["actor_id"], json.dumps(record["prior_state"]) if record["prior_state"] else None,
                    json.dumps(record["new_state"]), record["notes"], record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_relationship_history fallback: {e}")

    _IN_MEMORY_REL_HISTORY[tid].append(record)
    return record


def get_relationship_history(relationship_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """Retrieve chronological mutations for a relationship."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    rid = str(relationship_id).strip()
    history = [h for h in _IN_MEMORY_REL_HISTORY[tid] if h.get("relationship_id") == rid]
    return sorted(history, key=lambda h: h.get("created_at", ""))


# ============================================================================
# 2. Competitive Threat Scoring Storage
# ============================================================================

def save_threat_score(score_record: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Store calculated competitor threat score and factor contribution breakdown."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    cid = str(score_record.get("competitor_name") or "Unknown").strip()
    sid = str(score_record.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": sid,
        "tenant_id": tid,
        "competitor_name": cid,
        "overall_threat_score": float(score_record.get("overall_threat_score") or 0.0),
        "threat_level": str(score_record.get("threat_level") or "Medium").strip(),
        "factor_contributions": score_record.get("factor_contributions") or {},
        "configured_weights": score_record.get("configured_weights") or {},
        "data_coverage_score": float(score_record.get("data_coverage_score") or 0.0),
        "has_missing_data": bool(score_record.get("has_missing_data", False)),
        "unassessed_factors": score_record.get("unassessed_factors") or [],
        "supporting_evidence": score_record.get("supporting_evidence") or [],
        "calculation_formula": str(score_record.get("calculation_formula") or "Weighted Factor Contribution with Coverage Normalization"),
        "score_representation": "threat_intensity_index",
        "is_probability": False,
        "disclaimer": "Threat score is an explainable activity and risk index on a 0-100 scale; it does not represent a probability of competitive success.",
        "calculated_at": score_record.get("calculated_at") or now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO competitor_threat_scores (
                        id, tenant_id, competitor_name, overall_threat_score, threat_level,
                        factor_contributions, configured_weights, data_coverage_score,
                        has_missing_data, unassessed_factors, supporting_evidence,
                        calculation_formula, score_representation, is_probability,
                        disclaimer, calculated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, competitor_name) DO UPDATE SET
                        overall_threat_score = EXCLUDED.overall_threat_score,
                        threat_level = EXCLUDED.threat_level,
                        factor_contributions = EXCLUDED.factor_contributions,
                        configured_weights = EXCLUDED.configured_weights,
                        data_coverage_score = EXCLUDED.data_coverage_score,
                        has_missing_data = EXCLUDED.has_missing_data,
                        unassessed_factors = EXCLUDED.unassessed_factors,
                        supporting_evidence = EXCLUDED.supporting_evidence,
                        calculation_formula = EXCLUDED.calculation_formula,
                        calculated_at = EXCLUDED.calculated_at;
                """, (
                    record["id"], tid, record["competitor_name"], record["overall_threat_score"],
                    record["threat_level"], json.dumps(record["factor_contributions"]),
                    json.dumps(record["configured_weights"]), record["data_coverage_score"],
                    record["has_missing_data"], json.dumps(record["unassessed_factors"]),
                    json.dumps(record["supporting_evidence"]), record["calculation_formula"],
                    record["score_representation"], record["is_probability"], record["disclaimer"],
                    record["calculated_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_threat_score fallback: {e}")

    _IN_MEMORY_THREAT_SCORES[tid][cid.lower()] = record
    return record


def get_threat_score(competitor_name: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve latest threat score for a competitor."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    return _IN_MEMORY_THREAT_SCORES[tid].get(competitor_name.strip().lower())


def list_threat_scores(tenant_id: str) -> List[Dict[str, Any]]:
    """List all calculated threat scores."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    return list(_IN_MEMORY_THREAT_SCORES[tid].values())


# ============================================================================
# 3. Emerging Competitor Candidates Storage
# ============================================================================

def save_emerging_candidate(cand_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Save an identified emerging competitor candidate."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    cid = str(cand_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    name = str(cand_dict.get("company_name") or "").strip()
    domain = str(cand_dict.get("domain") or "").strip().lower()

    record = {
        "id": cid,
        "tenant_id": tid,
        "company_name": name,
        "domain": domain or None,
        "industry": str(cand_dict.get("industry") or "Technology").strip(),
        "similarity_reason": str(cand_dict.get("similarity_reason") or cand_dict.get("discovery_explanation") or "").strip(),
        "discovery_explanation": str(cand_dict.get("discovery_explanation") or cand_dict.get("similarity_reason") or "").strip(),
        "discovery_sources": cand_dict.get("discovery_sources") or [],
        "supporting_signals": cand_dict.get("supporting_signals") or [],
        "review_status": str(cand_dict.get("review_status") or "pending_approval").strip().lower(),
        "relevance_score": float(cand_dict.get("relevance_score") or 0.0),
        "corroboration_count": int(cand_dict.get("corroboration_count") or 1),
        "first_detected_at": cand_dict.get("first_detected_at") or now_iso,
        "reviewed_at": cand_dict.get("reviewed_at"),
        "reviewed_by": cand_dict.get("reviewed_by"),
        "review_notes": cand_dict.get("review_notes"),
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO emerging_competitor_candidates (
                        id, tenant_id, company_name, domain, industry,
                        similarity_reason, discovery_explanation, discovery_sources,
                        supporting_signals, review_status, relevance_score,
                        corroboration_count, first_detected_at, reviewed_at,
                        reviewed_by, review_notes
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        review_status = EXCLUDED.review_status,
                        reviewed_at = EXCLUDED.reviewed_at,
                        reviewed_by = EXCLUDED.reviewed_by,
                        review_notes = EXCLUDED.review_notes;
                """, (
                    record["id"], tid, record["company_name"], record["domain"],
                    record["industry"], record["similarity_reason"], record["discovery_explanation"],
                    json.dumps(record["discovery_sources"]), json.dumps(record["supporting_signals"]),
                    record["review_status"], record["relevance_score"], record["corroboration_count"],
                    record["first_detected_at"], record["reviewed_at"], record["reviewed_by"],
                    record["review_notes"]
                ))
        except Exception as e:
            logger.warning(f"DB save_emerging_candidate fallback: {e}")

    _IN_MEMORY_EMERGING_CANDS[tid][cid] = record
    return record


def get_emerging_candidate(candidate_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve emerging competitor candidate by ID."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    return _IN_MEMORY_EMERGING_CANDS[tid].get(str(candidate_id).strip())


def list_emerging_candidates(
    tenant_id: str,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """List emerging competitor candidates with review_status filter."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    items = list(_IN_MEMORY_EMERGING_CANDS[tid].values())
    if status:
        st = status.strip().lower()
        items = [i for i in items if i.get("review_status", "").lower() == st]

    items = sorted(items, key=lambda x: x.get("first_detected_at", ""), reverse=True)
    return items[offset : offset + limit]


def update_candidate_review_status(
    candidate_id: str,
    new_status: str,
    reviewer_id: str,
    notes: Optional[str],
    tenant_id: str,
) -> Optional[Dict[str, Any]]:
    """Approve or reject emerging candidate with audit logging."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    cid = str(candidate_id).strip()
    cand = _IN_MEMORY_EMERGING_CANDS[tid].get(cid)
    if not cand:
        return None

    valid_statuses = {"pending_approval", "approved", "rejected"}
    ns = new_status.strip().lower()
    if ns not in valid_statuses:
        raise ValueError(f"Invalid candidate review status '{new_status}'. Must be one of: {', '.join(sorted(valid_statuses))}")

    now_iso = datetime.now(timezone.utc).isoformat()
    cand["review_status"] = ns
    cand["reviewed_at"] = now_iso
    cand["reviewed_by"] = str(reviewer_id or "analyst").strip()
    cand["review_notes"] = str(notes or "").strip()

    # If approved, automatically register into tenant_tracked_companies
    if ns == "approved":
        try:
            from . import storage
            storage.add_tracked_company(
                tenant_id=tid,
                company_name=cand["company_name"],
                is_target=False,
            )
        except Exception as e:
            logger.warning(f"Could not auto-add approved company to tracked table: {e}")

    return save_emerging_candidate(cand, tid)


# ============================================================================
# 4. Governed Evidence Storage with Provenance & Contradictions
# ============================================================================

def save_governed_evidence(evidence_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Save extended governed evidence record with source provenance and confidence methodology."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    eid = str(evidence_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": eid,
        "tenant_id": tid,
        "claim_id": str(evidence_dict.get("claim_id") or "").strip() or None,
        "source_url": str(evidence_dict.get("source_url") or "").strip(),
        "source_title": str(evidence_dict.get("source_title") or "Primary Source Citation").strip(),
        "source_type": str(evidence_dict.get("source_type") or "documentation").strip().lower(),
        "excerpt": str(evidence_dict.get("excerpt") or "").strip(),
        "publication_date": evidence_dict.get("publication_date") or now_iso[:10],
        "relationship": str(evidence_dict.get("relationship") or "supports").strip().lower(), # 'supports', 'contradicts', 'disputes'
        "source_quality": str(evidence_dict.get("source_quality") or "primary").strip().lower(),
        "confidence_methodology": str(evidence_dict.get("confidence_methodology") or "primary_documentation_verified").strip(),
        "verification_status": str(evidence_dict.get("verification_status") or "verified").strip().lower(),
        "last_verified_at": evidence_dict.get("last_verified_at") or now_iso,
        "related_company": str(evidence_dict.get("related_company") or "").strip() or None,
        "related_competitor": str(evidence_dict.get("related_competitor") or "").strip() or None,
        "related_event_id": str(evidence_dict.get("related_event_id") or "") or None,
        "related_battlecard_id": str(evidence_dict.get("related_battlecard_id") or "") or None,
        "related_recommendation_id": str(evidence_dict.get("related_recommendation_id") or "") or None,
        "created_at": evidence_dict.get("created_at") or now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO governed_evidence (
                        id, tenant_id, claim_id, source_url, source_title,
                        source_type, excerpt, publication_date, relationship,
                        source_quality, confidence_methodology, verification_status,
                        last_verified_at, related_company, related_competitor,
                        related_event_id, related_battlecard_id, related_recommendation_id,
                        created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                """, (
                    record["id"], tid, record["claim_id"], record["source_url"],
                    record["source_title"], record["source_type"], record["excerpt"],
                    record["publication_date"], record["relationship"], record["source_quality"],
                    record["confidence_methodology"], record["verification_status"], record["last_verified_at"],
                    record["related_company"], record["related_competitor"], record["related_event_id"],
                    record["related_battlecard_id"], record["related_recommendation_id"], record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_governed_evidence fallback: {e}")

    _IN_MEMORY_GOVERNED_EVIDENCE[tid][eid] = record

    # Also register in Batch 1 claim_evidence for backward compatibility if claim_id given
    if record["claim_id"]:
        from . import battlecard_storage
        battlecard_storage.save_claim_evidence({
            "id": eid,
            "claim_id": record["claim_id"],
            "source_url": record["source_url"],
            "source_title": record["source_title"],
            "excerpt": record["excerpt"],
            "publication_date": record["publication_date"],
            "relationship": record["relationship"],
            "source_quality": record["source_quality"],
        }, tid)

    return record


def get_governed_evidence(evidence_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve governed evidence record by ID."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    return _IN_MEMORY_GOVERNED_EVIDENCE[tid].get(str(evidence_id).strip())


def list_governed_evidence(
    tenant_id: str,
    claim_id: Optional[str] = None,
    relationship: Optional[str] = None,
    related_company: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Query governed evidence records with relationship filter."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    items = list(_IN_MEMORY_GOVERNED_EVIDENCE[tid].values())
    if claim_id:
        cid = str(claim_id).strip()
        items = [i for i in items if i.get("claim_id") == cid]
    if relationship:
        rel = str(relationship).strip().lower()
        items = [i for i in items if i.get("relationship", "").lower() == rel]
    if related_company:
        comp = str(related_company).strip().lower()
        items = [i for i in items if str(i.get("related_company", "")).lower() == comp or str(i.get("related_competitor", "")).lower() == comp]

    items = sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)
    return items[offset : offset + limit]


# ============================================================================
# 5. Analyst Feedback Storage
# ============================================================================

VALID_FEEDBACK_TYPES = {
    "correct", "incorrect", "important", "not_useful", "ignore", "change_interpretation"
}


def save_analyst_feedback(feedback_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Store analyst feedback on a claim or intelligence record without corrupting underlying facts."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    fid = str(feedback_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    fb_type = str(feedback_dict.get("feedback_type") or "correct").strip().lower().replace(" ", "_")
    if fb_type not in VALID_FEEDBACK_TYPES:
        raise ValueError(f"Invalid feedback type '{feedback_dict.get('feedback_type')}'. Must be one of: {', '.join(sorted(VALID_FEEDBACK_TYPES))}")

    record = {
        "id": fid,
        "tenant_id": tid,
        "target_entity_type": str(feedback_dict.get("target_entity_type") or "claim").strip().lower(),
        "target_entity_id": str(feedback_dict.get("target_entity_id") or "").strip(),
        "feedback_type": fb_type,
        "analyst_id": str(feedback_dict.get("analyst_id") or "analyst").strip(),
        "notes": str(feedback_dict.get("notes") or "").strip(),
        "suggested_interpretation": str(feedback_dict.get("suggested_interpretation") or "").strip() or None,
        "created_at": feedback_dict.get("created_at") or now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO analyst_feedback (
                        id, tenant_id, target_entity_type, target_entity_id,
                        feedback_type, analyst_id, notes, suggested_interpretation,
                        created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    record["id"], tid, record["target_entity_type"], record["target_entity_id"],
                    record["feedback_type"], record["analyst_id"], record["notes"],
                    record["suggested_interpretation"], record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_analyst_feedback fallback: {e}")

    _IN_MEMORY_ANALYST_FEEDBACK[tid].append(record)
    return record


def save_contradictory_link(
    evidence_id_a: str,
    evidence_id_b: str,
    contradiction_reason: str,
    tenant_id: str,
    confidence: str = "High",
    actor_id: str = "analyst",
) -> Dict[str, Any]:
    """Store bidirectional contradictory link between two evidence items."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    cid = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    e_a = str(evidence_id_a).strip()
    e_b = str(evidence_id_b).strip()

    record = {
        "id": cid,
        "tenant_id": tid,
        "evidence_id_a": e_a,
        "evidence_id_b": e_b,
        "contradiction_reason": str(contradiction_reason or "").strip(),
        "confidence": str(confidence or "High").strip(),
        "actor_id": str(actor_id or "analyst").strip(),
        "created_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO contradictory_evidence_links (
                        id, tenant_id, evidence_id_a, evidence_id_b,
                        contradiction_reason, confidence, actor_id, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    record["id"], tid, record["evidence_id_a"], record["evidence_id_b"],
                    record["contradiction_reason"], record["confidence"], record["actor_id"],
                    record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"DB save_contradictory_link fallback: {e}")

    _IN_MEMORY_CONTRADICTORY_LINKS[tid].append(record)

    # Also automatically create a typed relationship in the relationship engine
    try:
        save_relationship({
            "subject_id": e_a,
            "subject_type": "evidence",
            "subject_name": f"Evidence {e_a[:8]}",
            "predicate": "contradicts",
            "object_id": e_b,
            "object_type": "evidence",
            "object_name": f"Evidence {e_b[:8]}",
            "relationship_source": "analyst_verification",
            "is_inferred": False,
            "metadata": {"contradiction_reason": contradiction_reason},
        }, tid, actor_id=actor_id)
    except Exception as e:
        logger.warning(f"Failed to record contradiction in relationship engine: {e}")

    return record


def list_contradictory_links(evidence_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """Retrieve contradictory links involving a specific evidence item."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)
    eid = str(evidence_id).strip()

    return [
        link for link in _IN_MEMORY_CONTRADICTORY_LINKS[tid]
        if link.get("evidence_id_a") == eid or link.get("evidence_id_b") == eid
    ]


def list_analyst_feedback(
    tenant_id: str,
    target_entity_type: Optional[str] = None,
    target_entity_id: Optional[str] = None,
    feedback_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """List submitted feedback entries."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    items = _IN_MEMORY_ANALYST_FEEDBACK[tid]
    if target_entity_type:
        tet = target_entity_type.strip().lower()
        items = [i for i in items if i.get("target_entity_type") == tet]
    if target_entity_id:
        teid = str(target_entity_id).strip()
        items = [i for i in items if i.get("target_entity_id") == teid]
    if feedback_type:
        ft = feedback_type.strip().lower().replace(" ", "_")
        items = [i for i in items if i.get("feedback_type") == ft]

    items = sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)
    return items[offset : offset + limit]
