"""
Evidence-Linked Battlecard Storage & Audit Layer.
Implements multi-tenant PostgreSQL RLS queries and deterministic fallback caching
for intelligence_claims, claim_evidence, battlecards, battlecard_blocks,
battlecard_revisions, claim_drift_alerts, and claim_review_actions.
"""

import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# In-memory storage for test isolation and offline fallback
_IN_MEMORY_CLAIMS: Dict[str, Dict[str, Dict[str, Any]]] = {}       # {tenant_id: {claim_id: claim}}
_IN_MEMORY_EVIDENCE: Dict[str, List[Dict[str, Any]]] = {}          # {tenant_id: [evidence]}
_IN_MEMORY_BATTLECARDS: Dict[str, Dict[str, Dict[str, Any]]] = {}   # {tenant_id: {battlecard_id: card}}
_IN_MEMORY_BLOCKS: Dict[str, Dict[str, Dict[str, Any]]] = {}        # {tenant_id: {block_id: block}}
_IN_MEMORY_REVISIONS: Dict[str, List[Dict[str, Any]]] = {}         # {tenant_id: [revisions]}
_IN_MEMORY_DRIFT_ALERTS: Dict[str, Dict[str, Dict[str, Any]]] = {}  # {tenant_id: {alert_id: alert}}
_IN_MEMORY_REVIEW_ACTIONS: Dict[str, List[Dict[str, Any]]] = {}    # {tenant_id: [actions]}


def _is_test_mode() -> bool:
    from .storage import is_test_environment, is_live_write_permitted
    return is_test_environment() or not is_live_write_permitted()


def _ensure_tenant_cache(tenant_id: str):
    tid = str(tenant_id)
    if tid not in _IN_MEMORY_CLAIMS:
        _IN_MEMORY_CLAIMS[tid] = {}
    if tid not in _IN_MEMORY_EVIDENCE:
        _IN_MEMORY_EVIDENCE[tid] = []
    if tid not in _IN_MEMORY_BATTLECARDS:
        _IN_MEMORY_BATTLECARDS[tid] = {}
    if tid not in _IN_MEMORY_BLOCKS:
        _IN_MEMORY_BLOCKS[tid] = {}
    if tid not in _IN_MEMORY_REVISIONS:
        _IN_MEMORY_REVISIONS[tid] = []
    if tid not in _IN_MEMORY_DRIFT_ALERTS:
        _IN_MEMORY_DRIFT_ALERTS[tid] = {}
    if tid not in _IN_MEMORY_REVIEW_ACTIONS:
        _IN_MEMORY_REVIEW_ACTIONS[tid] = []


def clear_tenant_cache():
    """Clear all in-memory cache structures across tenants (used in tests)."""
    _IN_MEMORY_CLAIMS.clear()
    _IN_MEMORY_EVIDENCE.clear()
    _IN_MEMORY_BATTLECARDS.clear()
    _IN_MEMORY_BLOCKS.clear()
    _IN_MEMORY_REVISIONS.clear()
    _IN_MEMORY_DRIFT_ALERTS.clear()
    _IN_MEMORY_REVIEW_ACTIONS.clear()


# ============================================================================
# 1. Intelligence Claims
# ============================================================================

def save_claim(claim_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """
    Create or update an atomic reusable intelligence claim.
    """
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    cid = str(claim_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    fia = claim_dict.get("fact_impact_act")
    if not isinstance(fia, dict):
        fia = {
            "fact": str(claim_dict.get("statement") or ""),
            "impact": "",
            "act": "",
        }

    record = {
        "id": cid,
        "tenant_id": tid,
        "company_name": str(claim_dict.get("company_name") or "").strip(),
        "claim_type": str(claim_dict.get("claim_type") or "positioning").strip(),
        "subject": str(claim_dict.get("subject") or "").strip(),
        "statement": str(claim_dict.get("statement") or "").strip(),
        "fact_impact_act": fia,
        "status": str(claim_dict.get("status") or "active").strip(),
        "confidence": str(claim_dict.get("confidence") or "Medium").strip(),
        "verification_status": str(claim_dict.get("verification_status") or "verified").strip(),
        "last_verified_at": claim_dict.get("last_verified_at") or now_iso,
        "created_at": claim_dict.get("created_at") or now_iso,
        "updated_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO intelligence_claims (
                        id, tenant_id, company_name, claim_type, subject,
                        statement, fact_impact_act, status, confidence,
                        verification_status, last_verified_at, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        statement = EXCLUDED.statement,
                        subject = EXCLUDED.subject,
                        claim_type = EXCLUDED.claim_type,
                        fact_impact_act = EXCLUDED.fact_impact_act,
                        status = EXCLUDED.status,
                        confidence = EXCLUDED.confidence,
                        verification_status = EXCLUDED.verification_status,
                        last_verified_at = EXCLUDED.last_verified_at,
                        updated_at = EXCLUDED.updated_at;
                """, (
                    record["id"], record["tenant_id"], record["company_name"],
                    record["claim_type"], record["subject"], record["statement"],
                    json.dumps(record["fact_impact_act"]), record["status"],
                    record["confidence"], record["verification_status"],
                    record["last_verified_at"], record["created_at"], record["updated_at"]
                ))
        except Exception as e:
            logger.warning(f"PostgreSQL save_claim fallback: {e}")

    _IN_MEMORY_CLAIMS[tid][cid] = record
    return record


def get_claim(claim_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve single claim by ID for tenant."""
    tid = str(tenant_id).strip()
    cid = str(claim_id).strip()
    _ensure_tenant_cache(tid)

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    SELECT id, tenant_id, company_name, claim_type, subject,
                           statement, fact_impact_act, status, confidence,
                           verification_status, last_verified_at, created_at, updated_at
                    FROM intelligence_claims
                    WHERE tenant_id = %s AND id = %s
                    LIMIT 1;
                """, (tid, cid))
                row = cur.fetchone()
                if row:
                    return {
                        "id": str(row[0]),
                        "tenant_id": str(row[1]),
                        "company_name": row[2],
                        "claim_type": row[3],
                        "subject": row[4],
                        "statement": row[5],
                        "fact_impact_act": row[6] if isinstance(row[6], dict) else json.loads(row[6]),
                        "status": row[7],
                        "confidence": row[8],
                        "verification_status": row[9],
                        "last_verified_at": row[10].isoformat() if hasattr(row[10], "isoformat") else str(row[10]),
                        "created_at": row[11].isoformat() if hasattr(row[11], "isoformat") else str(row[11]),
                        "updated_at": row[12].isoformat() if hasattr(row[12], "isoformat") else str(row[12]),
                    }
        except Exception as e:
            logger.warning(f"PostgreSQL get_claim fallback: {e}")

    return _IN_MEMORY_CLAIMS[tid].get(cid)


def get_claims(
    tenant_id: str,
    company_name: Optional[str] = None,
    claim_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Retrieve claims matching filters for tenant."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                q = """
                    SELECT id, tenant_id, company_name, claim_type, subject,
                           statement, fact_impact_act, status, confidence,
                           verification_status, last_verified_at, created_at, updated_at
                    FROM intelligence_claims
                    WHERE tenant_id = %s
                """
                params: List[Any] = [tid]
                if company_name:
                    q += " AND LOWER(company_name) = LOWER(%s)"
                    params.append(company_name.strip())
                if claim_type:
                    q += " AND claim_type = %s"
                    params.append(claim_type.strip())
                if status:
                    q += " AND status = %s"
                    params.append(status.strip())
                q += " ORDER BY updated_at DESC"
                if limit and int(limit) > 0:
                    q += f" LIMIT {int(limit)}"
                q += ";"

                cur.execute(q, tuple(params))
                rows = cur.fetchall()
                if rows:
                    return [
                        {
                            "id": str(r[0]),
                            "tenant_id": str(r[1]),
                            "company_name": r[2],
                            "claim_type": r[3],
                            "subject": r[4],
                            "statement": r[5],
                            "fact_impact_act": r[6] if isinstance(r[6], dict) else json.loads(r[6]),
                            "status": r[7],
                            "confidence": r[8],
                            "verification_status": r[9],
                            "last_verified_at": r[10].isoformat() if hasattr(r[10], "isoformat") else str(r[10]),
                            "created_at": r[11].isoformat() if hasattr(r[11], "isoformat") else str(r[11]),
                            "updated_at": r[12].isoformat() if hasattr(r[12], "isoformat") else str(r[12]),
                        }
                        for r in rows
                    ]
        except Exception as e:
            logger.warning(f"PostgreSQL get_claims fallback: {e}")

    # Fallback to in-memory
    claims = list(_IN_MEMORY_CLAIMS[tid].values())
    if company_name:
        claims = [c for c in claims if c["company_name"].lower() == company_name.strip().lower()]
    if claim_type:
        claims = [c for c in claims if c["claim_type"] == claim_type.strip()]
    if status:
        claims = [c for c in claims if c["status"] == status.strip()]
    sorted_claims = sorted(claims, key=lambda c: c.get("updated_at", ""), reverse=True)
    if limit and int(limit) > 0:
        return sorted_claims[:int(limit)]
    return sorted_claims


# Alias for compatibility with Batch 2 caller conventions
list_claims = get_claims


# ============================================================================
# 2. Claim Evidence
# ============================================================================

def save_claim_evidence(evidence_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Link evidence to a claim."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    eid = str(evidence_dict.get("id") or uuid.uuid4())
    cid = str(evidence_dict.get("claim_id") or "").strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": eid,
        "claim_id": cid,
        "tenant_id": tid,
        "event_id": evidence_dict.get("event_id"),
        "signal_id": evidence_dict.get("signal_id"),
        "source_url": str(evidence_dict.get("source_url") or "").strip(),
        "source_title": evidence_dict.get("source_title"),
        "excerpt": str(evidence_dict.get("excerpt") or "").strip(),
        "publication_date": evidence_dict.get("publication_date"),
        "relationship": str(evidence_dict.get("relationship") or "supports").strip(),
        "source_quality": str(evidence_dict.get("source_quality") or "primary").strip(),
        "created_at": evidence_dict.get("created_at") or now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO claim_evidence (
                        id, claim_id, tenant_id, event_id, signal_id,
                        source_url, source_title, excerpt, publication_date,
                        relationship, source_quality, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                """, (
                    record["id"], record["claim_id"], record["tenant_id"],
                    record["event_id"], record["signal_id"], record["source_url"],
                    record["source_title"], record["excerpt"], record["publication_date"],
                    record["relationship"], record["source_quality"], record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"PostgreSQL save_claim_evidence fallback: {e}")

    # Deduplicate in memory
    _IN_MEMORY_EVIDENCE[tid] = [
        e for e in _IN_MEMORY_EVIDENCE[tid]
        if not (e["claim_id"] == cid and e["source_url"] == record["source_url"] and e["relationship"] == record["relationship"])
    ]
    _IN_MEMORY_EVIDENCE[tid].append(record)
    return record


def get_claim_evidence(claim_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """Retrieve all evidence records for a claim."""
    tid = str(tenant_id).strip()
    cid = str(claim_id).strip()
    _ensure_tenant_cache(tid)

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    SELECT id, claim_id, tenant_id, event_id, signal_id,
                           source_url, source_title, excerpt, publication_date,
                           relationship, source_quality, created_at
                    FROM claim_evidence
                    WHERE tenant_id = %s AND claim_id = %s
                    ORDER BY created_at DESC;
                """, (tid, cid))
                rows = cur.fetchall()
                if rows:
                    return [
                        {
                            "id": str(r[0]),
                            "claim_id": str(r[1]),
                            "tenant_id": str(r[2]),
                            "event_id": r[3],
                            "signal_id": r[4],
                            "source_url": r[5],
                            "source_title": r[6],
                            "excerpt": r[7],
                            "publication_date": r[8],
                            "relationship": r[9],
                            "source_quality": r[10],
                            "created_at": r[11].isoformat() if hasattr(r[11], "isoformat") else str(r[11]),
                        }
                        for r in rows
                    ]
        except Exception as e:
            logger.warning(f"PostgreSQL get_claim_evidence fallback: {e}")

    return [e for e in _IN_MEMORY_EVIDENCE[tid] if e["claim_id"] == cid]


# ============================================================================
# 3. Battlecards & Blocks
# ============================================================================

def save_battlecard(battlecard_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Create or update a battlecard record."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    bid = str(battlecard_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": bid,
        "tenant_id": tid,
        "company_name": str(battlecard_dict.get("company_name") or "").strip(),
        "title": str(battlecard_dict.get("title") or f"{battlecard_dict.get('company_name')} Battlecard").strip(),
        "audience": str(battlecard_dict.get("audience") or "sales").strip().lower(),
        "segment": str(battlecard_dict.get("segment") or "general").strip().lower(),
        "owner_id": str(battlecard_dict.get("owner_id") or "analyst").strip(),
        "status": str(battlecard_dict.get("status") or "draft").strip(),
        "current_version": int(battlecard_dict.get("current_version") or 1),
        "published_version": battlecard_dict.get("published_version"),
        "published_at": battlecard_dict.get("published_at"),
        "freshness_score": float(battlecard_dict.get("freshness_score") or 100.0),
        "created_at": battlecard_dict.get("created_at") or now_iso,
        "updated_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO battlecards (
                        id, tenant_id, company_name, title, audience, segment,
                        owner_id, status, current_version, published_version,
                        published_at, freshness_score, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, company_name, audience, segment) DO UPDATE SET
                        title = EXCLUDED.title,
                        owner_id = EXCLUDED.owner_id,
                        status = EXCLUDED.status,
                        current_version = EXCLUDED.current_version,
                        published_version = EXCLUDED.published_version,
                        published_at = EXCLUDED.published_at,
                        freshness_score = EXCLUDED.freshness_score,
                        updated_at = EXCLUDED.updated_at
                    RETURNING id;
                """, (
                    record["id"], record["tenant_id"], record["company_name"],
                    record["title"], record["audience"], record["segment"],
                    record["owner_id"], record["status"], record["current_version"],
                    record["published_version"], record["published_at"],
                    record["freshness_score"], record["created_at"], record["updated_at"]
                ))
                ret = cur.fetchone()
                if ret and ret[0]:
                    record["id"] = str(ret[0])
        except Exception as e:
            logger.warning(f"PostgreSQL save_battlecard fallback: {e}")

    _IN_MEMORY_BATTLECARDS[tid][record["id"]] = record
    return record


def save_battlecard_block(block_dict: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    """Create or update a structured battlecard section block."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    blkid = str(block_dict.get("id") or uuid.uuid4())
    bid = str(block_dict.get("battlecard_id") or "").strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    content = block_dict.get("content") or {}
    claim_ids = block_dict.get("claim_ids") or []

    record = {
        "id": blkid,
        "battlecard_id": bid,
        "tenant_id": tid,
        "block_key": str(block_dict.get("block_key") or "").strip(),
        "block_title": str(block_dict.get("block_title") or "").strip(),
        "block_order": int(block_dict.get("block_order") or 0),
        "content": content if isinstance(content, dict) else (json.loads(content) if isinstance(content, str) else {}),
        "claim_ids": claim_ids if isinstance(claim_ids, list) else (json.loads(claim_ids) if isinstance(claim_ids, str) else []),
        "created_at": block_dict.get("created_at") or now_iso,
        "updated_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO battlecard_blocks (
                        id, battlecard_id, tenant_id, block_key, block_title,
                        block_order, content, claim_ids, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (battlecard_id, block_key) DO UPDATE SET
                        block_title = EXCLUDED.block_title,
                        block_order = EXCLUDED.block_order,
                        content = EXCLUDED.content,
                        claim_ids = EXCLUDED.claim_ids,
                        updated_at = EXCLUDED.updated_at
                    RETURNING id;
                """, (
                    record["id"], record["battlecard_id"], record["tenant_id"],
                    record["block_key"], record["block_title"], record["block_order"],
                    json.dumps(record["content"]), json.dumps(record["claim_ids"]),
                    record["created_at"], record["updated_at"]
                ))
                ret = cur.fetchone()
                if ret and ret[0]:
                    record["id"] = str(ret[0])
        except Exception as e:
            logger.warning(f"PostgreSQL save_battlecard_block fallback: {e}")

    _IN_MEMORY_BLOCKS[tid][record["id"]] = record
    return record


def get_battlecard_blocks(battlecard_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """Retrieve blocks for a battlecard ordered by block_order."""
    tid = str(tenant_id).strip()
    bid = str(battlecard_id).strip()
    _ensure_tenant_cache(tid)

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    SELECT id, battlecard_id, tenant_id, block_key, block_title,
                           block_order, content, claim_ids, created_at, updated_at
                    FROM battlecard_blocks
                    WHERE tenant_id = %s AND battlecard_id = %s
                    ORDER BY block_order ASC;
                """, (tid, bid))
                rows = cur.fetchall()
                if rows:
                    return [
                        {
                            "id": str(r[0]),
                            "battlecard_id": str(r[1]),
                            "tenant_id": str(r[2]),
                            "block_key": r[3],
                            "block_title": r[4],
                            "block_order": r[5],
                            "content": r[6] if isinstance(r[6], dict) else json.loads(r[6]),
                            "claim_ids": r[7] if isinstance(r[7], list) else json.loads(r[7]),
                            "created_at": r[8].isoformat() if hasattr(r[8], "isoformat") else str(r[8]),
                            "updated_at": r[9].isoformat() if hasattr(r[9], "isoformat") else str(r[9]),
                        }
                        for r in rows
                    ]
        except Exception as e:
            logger.warning(f"PostgreSQL get_battlecard_blocks fallback: {e}")

    blocks = [b for b in _IN_MEMORY_BLOCKS[tid].values() if b["battlecard_id"] == bid]
    return sorted(blocks, key=lambda b: b.get("block_order", 0))


def update_battlecard_block(
    battlecard_id: str,
    block_key: str,
    updates: Dict[str, Any],
    tenant_id: str
) -> Optional[Dict[str, Any]]:
    """Update block content, title, or claims."""
    tid = str(tenant_id).strip()
    bid = str(battlecard_id).strip()
    bkey = str(block_key).strip()
    _ensure_tenant_cache(tid)

    target_block = None
    for b in _IN_MEMORY_BLOCKS[tid].values():
        if b["battlecard_id"] == bid and b["block_key"] == bkey:
            target_block = b
            break

    if not target_block and not _is_test_mode():
        blocks = get_battlecard_blocks(bid, tid)
        for b in blocks:
            if b["block_key"] == bkey:
                target_block = b
                break

    if not target_block:
        return None

    if "content" in updates:
        target_block["content"] = updates["content"]
    if "block_title" in updates:
        target_block["block_title"] = updates["block_title"]
    if "claim_ids" in updates:
        target_block["claim_ids"] = updates["claim_ids"]
    target_block["updated_at"] = datetime.now(timezone.utc).isoformat()

    return save_battlecard_block(target_block, tid)


def get_battlecard(
    company_name: Optional[str] = None,
    tenant_id: str = "00000000-0000-0000-0000-000000000000",
    audience: str = "sales",
    segment: str = "general",
    status: Optional[str] = None,
    battlecard_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Retrieve battlecard with resolved blocks, claims, and evidence.
    """
    tid = str(tenant_id).strip()
    aud = audience.strip().lower()
    seg = segment.strip().lower()
    _ensure_tenant_cache(tid)

    card_record = None

    if battlecard_id:
        bid = str(battlecard_id).strip()
        card_record = _IN_MEMORY_BATTLECARDS[tid].get(bid)
    elif company_name:
        cname = company_name.strip()
        for c in _IN_MEMORY_BATTLECARDS[tid].values():
            if c["company_name"].lower() == cname.lower() and c["audience"] == aud and c["segment"] == seg:
                if status is None or c["status"] == status:
                    card_record = c
                    break

    if not card_record and not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                if battlecard_id:
                    cur.execute("""
                        SELECT id, tenant_id, company_name, title, audience, segment,
                               owner_id, status, current_version, published_version,
                               published_at, freshness_score, created_at, updated_at
                        FROM battlecards
                        WHERE tenant_id = %s AND id = %s
                        LIMIT 1;
                    """, (tid, str(battlecard_id)))
                elif company_name:
                    cur.execute("""
                        SELECT id, tenant_id, company_name, title, audience, segment,
                               owner_id, status, current_version, published_version,
                               published_at, freshness_score, created_at, updated_at
                        FROM battlecards
                        WHERE tenant_id = %s AND LOWER(company_name) = LOWER(%s)
                          AND audience = %s AND segment = %s
                        LIMIT 1;
                    """, (tid, company_name.strip(), aud, seg))
                row = cur.fetchone()
                if row:
                    card_record = {
                        "id": str(row[0]),
                        "tenant_id": str(row[1]),
                        "company_name": row[2],
                        "title": row[3],
                        "audience": row[4],
                        "segment": row[5],
                        "owner_id": row[6],
                        "status": row[7],
                        "current_version": row[8],
                        "published_version": row[9],
                        "published_at": row[10].isoformat() if hasattr(row[10], "isoformat") and row[10] else row[10],
                        "freshness_score": float(row[11] or 100.0),
                        "created_at": row[12].isoformat() if hasattr(row[12], "isoformat") else str(row[12]),
                        "updated_at": row[13].isoformat() if hasattr(row[13], "isoformat") else str(row[13]),
                    }
        except Exception as e:
            logger.warning(f"PostgreSQL get_battlecard fallback: {e}")

    if not card_record:
        return None

    # Resolve blocks
    blocks = get_battlecard_blocks(card_record["id"], tid)

    # Collect all claim IDs across blocks
    all_claim_ids = set()
    for blk in blocks:
        for cid in blk.get("claim_ids", []):
            all_claim_ids.add(str(cid))

    # Resolve claims and their evidence
    claims_dict: Dict[str, Any] = {}
    for cid in all_claim_ids:
        clm = get_claim(cid, tid)
        if clm:
            evidence = get_claim_evidence(cid, tid)
            clm["evidence"] = evidence
            claims_dict[cid] = clm

    # Enrich blocks with resolved claims
    enriched_blocks = []
    for blk in blocks:
        blk_copy = dict(blk)
        blk_copy["claims"] = [claims_dict[cid] for cid in blk.get("claim_ids", []) if cid in claims_dict]
        enriched_blocks.append(blk_copy)

    card_record["blocks"] = enriched_blocks
    card_record["claims_count"] = len(claims_dict)

    # Calculate freshness score based on claim verification dates
    if claims_dict:
        now = datetime.now(timezone.utc)
        fresh_count = 0
        for clm in claims_dict.values():
            last_v = clm.get("last_verified_at")
            if last_v:
                try:
                    dt = datetime.fromisoformat(str(last_v).replace("Z", "+00:00"))
                    if (now - dt).days < 30:
                        fresh_count += 1
                except Exception:
                    fresh_count += 1
            else:
                fresh_count += 1
        card_record["freshness_score"] = round((fresh_count / len(claims_dict)) * 100.0, 1)

    return card_record


# ============================================================================
# 4. Publishing & Immutable Revisions
# ============================================================================

def publish_battlecard(
    battlecard_id: str,
    tenant_id: str,
    published_by: str = "analyst",
    change_summary: str = "Published latest intelligence snapshot"
) -> Dict[str, Any]:
    """
    Freeze current battlecard state into an immutable revision, bump publication version,
    and update battlecard status to 'published'.
    """
    tid = str(tenant_id).strip()
    bid = str(battlecard_id).strip()
    _ensure_tenant_cache(tid)

    card = get_battlecard(battlecard_id=bid, tenant_id=tid)
    if not card:
        raise ValueError(f"Battlecard '{bid}' not found for tenant '{tid}'")

    next_version = (card.get("published_version") or 0) + 1
    now_iso = datetime.now(timezone.utc).isoformat()

    # Immutable snapshot payload
    snapshot_payload = {
        "id": card["id"],
        "company_name": card["company_name"],
        "title": card["title"],
        "audience": card["audience"],
        "segment": card["segment"],
        "version": next_version,
        "blocks": card["blocks"],
        "freshness_score": card["freshness_score"],
        "snapshot_at": now_iso,
    }

    revision_id = str(uuid.uuid4())
    revision_record = {
        "id": revision_id,
        "battlecard_id": bid,
        "tenant_id": tid,
        "version": next_version,
        "snapshot": snapshot_payload,
        "change_summary": change_summary,
        "published_by": published_by,
        "published_at": now_iso,
    }

    # 1. Save revision
    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO battlecard_revisions (
                        id, battlecard_id, tenant_id, version,
                        snapshot, change_summary, published_by, published_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    revision_record["id"], revision_record["battlecard_id"],
                    revision_record["tenant_id"], revision_record["version"],
                    json.dumps(revision_record["snapshot"]), revision_record["change_summary"],
                    revision_record["published_by"], revision_record["published_at"]
                ))
        except Exception as e:
            logger.warning(f"PostgreSQL publish_battlecard revision fallback: {e}")

    _IN_MEMORY_REVISIONS[tid].append(revision_record)

    # 2. Update battlecard
    card["status"] = "published"
    card["published_version"] = next_version
    card["published_at"] = now_iso
    card["current_version"] = next_version + 1
    card["updated_at"] = now_iso

    save_battlecard(card, tid)

    return {
        "battlecard": card,
        "revision": revision_record,
    }


def get_battlecard_revisions(battlecard_id: str, tenant_id: str) -> List[Dict[str, Any]]:
    """Retrieve immutable published revisions for a battlecard."""
    tid = str(tenant_id).strip()
    bid = str(battlecard_id).strip()
    _ensure_tenant_cache(tid)

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    SELECT id, battlecard_id, tenant_id, version,
                           snapshot, change_summary, published_by, published_at
                    FROM battlecard_revisions
                    WHERE tenant_id = %s AND battlecard_id = %s
                    ORDER BY version DESC;
                """, (tid, bid))
                rows = cur.fetchall()
                if rows:
                    return [
                        {
                            "id": str(r[0]),
                            "battlecard_id": str(r[1]),
                            "tenant_id": str(r[2]),
                            "version": r[3],
                            "snapshot": r[4] if isinstance(r[4], dict) else json.loads(r[4]),
                            "change_summary": r[5],
                            "published_by": r[6],
                            "published_at": r[7].isoformat() if hasattr(r[7], "isoformat") else str(r[7]),
                        }
                        for r in rows
                    ]
        except Exception as e:
            logger.warning(f"PostgreSQL get_battlecard_revisions fallback: {e}")

    revs = [r for r in _IN_MEMORY_REVISIONS[tid] if r["battlecard_id"] == bid]
    return sorted(revs, key=lambda r: r["version"], reverse=True)


# ============================================================================
# 5. Claim Drift Alerts
# ============================================================================

def compute_drift_deduplication_key(
    claim_id: str,
    drift_type: str,
    trigger_event_id: Optional[str] = None,
    new_evidence_url: Optional[str] = None
) -> str:
    """Deterministic hash preventing duplicate drift alerts for the same event and claim."""
    raw = f"{str(claim_id).strip()}::{str(trigger_event_id or '').strip()}::{str(drift_type).strip()}::{str(new_evidence_url or '').strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def save_claim_drift_alert(alert_dict: Dict[str, Any], tenant_id: str) -> Tuple[Dict[str, Any], bool]:
    """
    Save drift alert if not already existing. Returns (record, is_new).
    """
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    cid = str(alert_dict.get("claim_id") or "").strip()
    dtype = str(alert_dict.get("drift_type") or "new_evidence").strip()
    teid = alert_dict.get("trigger_event_id")
    eurl = alert_dict.get("new_evidence_url")

    dedup_key = alert_dict.get("deduplication_key") or compute_drift_deduplication_key(cid, dtype, teid, eurl)

    # Check for existing alert in memory
    for existing in _IN_MEMORY_DRIFT_ALERTS[tid].values():
        if existing.get("deduplication_key") == dedup_key:
            return existing, False

    aid = str(alert_dict.get("id") or uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": aid,
        "tenant_id": tid,
        "claim_id": cid,
        "company_name": str(alert_dict.get("company_name") or "").strip(),
        "drift_type": dtype,
        "trigger_event_id": teid,
        "new_evidence_excerpt": str(alert_dict.get("new_evidence_excerpt") or "").strip(),
        "new_evidence_url": str(eurl or "").strip(),
        "suggested_update": alert_dict.get("suggested_update") or {},
        "review_status": str(alert_dict.get("review_status") or "pending").strip(),
        "review_decision_notes": alert_dict.get("review_decision_notes"),
        "reviewed_by": alert_dict.get("reviewed_by"),
        "reviewed_at": alert_dict.get("reviewed_at"),
        "deduplication_key": dedup_key,
        "created_at": alert_dict.get("created_at") or now_iso,
        "updated_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO claim_drift_alerts (
                        id, tenant_id, claim_id, company_name, drift_type,
                        trigger_event_id, new_evidence_excerpt, new_evidence_url,
                        suggested_update, review_status, review_decision_notes,
                        reviewed_by, reviewed_at, deduplication_key, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, deduplication_key) DO NOTHING
                    RETURNING id;
                """, (
                    record["id"], record["tenant_id"], record["claim_id"],
                    record["company_name"], record["drift_type"], record["trigger_event_id"],
                    record["new_evidence_excerpt"], record["new_evidence_url"],
                    json.dumps(record["suggested_update"]), record["review_status"],
                    record["review_decision_notes"], record["reviewed_by"],
                    record["reviewed_at"], record["deduplication_key"],
                    record["created_at"], record["updated_at"]
                ))
                ret = cur.fetchone()
                if not ret:
                    # Alert already existed in DB
                    return record, False
        except Exception as e:
            logger.warning(f"PostgreSQL save_claim_drift_alert fallback: {e}")

    _IN_MEMORY_DRIFT_ALERTS[tid][aid] = record
    return record, True


def get_claim_drift_alert(alert_id: str, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve single drift alert by ID."""
    tid = str(tenant_id).strip()
    aid = str(alert_id).strip()
    _ensure_tenant_cache(tid)

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    SELECT id, tenant_id, claim_id, company_name, drift_type,
                           trigger_event_id, new_evidence_excerpt, new_evidence_url,
                           suggested_update, review_status, review_decision_notes,
                           reviewed_by, reviewed_at, deduplication_key, created_at, updated_at
                    FROM claim_drift_alerts
                    WHERE tenant_id = %s AND id = %s
                    LIMIT 1;
                """, (tid, aid))
                row = cur.fetchone()
                if row:
                    return {
                        "id": str(row[0]),
                        "tenant_id": str(row[1]),
                        "claim_id": str(row[2]),
                        "company_name": row[3],
                        "drift_type": row[4],
                        "trigger_event_id": row[5],
                        "new_evidence_excerpt": row[6],
                        "new_evidence_url": row[7],
                        "suggested_update": row[8] if isinstance(row[8], dict) else json.loads(row[8]),
                        "review_status": row[9],
                        "review_decision_notes": row[10],
                        "reviewed_by": row[11],
                        "reviewed_at": row[12].isoformat() if hasattr(row[12], "isoformat") and row[12] else row[12],
                        "deduplication_key": row[13],
                        "created_at": row[14].isoformat() if hasattr(row[14], "isoformat") else str(row[14]),
                        "updated_at": row[15].isoformat() if hasattr(row[15], "isoformat") else str(row[15]),
                    }
        except Exception as e:
            logger.warning(f"PostgreSQL get_claim_drift_alert fallback: {e}")

    return _IN_MEMORY_DRIFT_ALERTS[tid].get(aid)


def get_claim_drift_alerts(
    tenant_id: str,
    company_name: Optional[str] = None,
    review_status: Optional[str] = None,
    drift_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Retrieve filtered drift alerts with pagination."""
    tid = str(tenant_id).strip()
    _ensure_tenant_cache(tid)

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                q = """
                    SELECT id, tenant_id, claim_id, company_name, drift_type,
                           trigger_event_id, new_evidence_excerpt, new_evidence_url,
                           suggested_update, review_status, review_decision_notes,
                           reviewed_by, reviewed_at, deduplication_key, created_at, updated_at
                    FROM claim_drift_alerts
                    WHERE tenant_id = %s
                """
                params: List[Any] = [tid]
                if company_name:
                    q += " AND LOWER(company_name) = LOWER(%s)"
                    params.append(company_name.strip())
                if review_status:
                    q += " AND review_status = %s"
                    params.append(review_status.strip())
                if drift_type:
                    q += " AND drift_type = %s"
                    params.append(drift_type.strip())
                q += " ORDER BY created_at DESC LIMIT %s OFFSET %s;"
                params.extend([limit, offset])

                cur.execute(q, tuple(params))
                rows = cur.fetchall()
                if rows:
                    alerts = []
                    for r in rows:
                        alert = {
                            "id": str(r[0]),
                            "tenant_id": str(r[1]),
                            "claim_id": str(r[2]),
                            "company_name": r[3],
                            "drift_type": r[4],
                            "trigger_event_id": r[5],
                            "new_evidence_excerpt": r[6],
                            "new_evidence_url": r[7],
                            "suggested_update": r[8] if isinstance(r[8], dict) else json.loads(r[8]),
                            "review_status": r[9],
                            "review_decision_notes": r[10],
                            "reviewed_by": r[11],
                            "reviewed_at": r[12].isoformat() if hasattr(r[12], "isoformat") and r[12] else r[12],
                            "deduplication_key": r[13],
                            "created_at": r[14].isoformat() if hasattr(r[14], "isoformat") else str(r[14]),
                            "updated_at": r[15].isoformat() if hasattr(r[15], "isoformat") else str(r[15]),
                        }
                        # Attach current claim
                        alert["claim"] = get_claim(alert["claim_id"], tid)
                        alerts.append(alert)
                    return alerts
        except Exception as e:
            logger.warning(f"PostgreSQL get_claim_drift_alerts fallback: {e}")

    alerts = list(_IN_MEMORY_DRIFT_ALERTS[tid].values())
    if company_name:
        alerts = [a for a in alerts if a["company_name"].lower() == company_name.strip().lower()]
    if review_status:
        alerts = [a for a in alerts if a["review_status"] == review_status.strip()]
    if drift_type:
        alerts = [a for a in alerts if a["drift_type"] == drift_type.strip()]

    alerts = sorted(alerts, key=lambda a: a.get("created_at", ""), reverse=True)
    paged = alerts[offset:offset + limit]

    for a in paged:
        a["claim"] = get_claim(a["claim_id"], tid)
    return paged


# ============================================================================
# 6. Human Review & Claim Propagation
# ============================================================================

def propagate_claim_update_to_battlecards(
    claim_id: str,
    updated_claim: Dict[str, Any],
    tenant_id: str
) -> int:
    """
    Propagate an approved claim update to every draft battlecard referencing that claim.
    Published battlecard revisions remain frozen and immutable!
    """
    tid = str(tenant_id).strip()
    cid = str(claim_id).strip()
    _ensure_tenant_cache(tid)

    updated_count = 0

    # Iterate over all battlecard blocks
    for blk in list(_IN_MEMORY_BLOCKS[tid].values()):
        if cid in blk.get("claim_ids", []):
            content = dict(blk.get("content") or {})
            # Update matching bullet items or statements within block content
            items = content.get("items")
            if isinstance(items, list):
                modified = False
                for item in items:
                    if isinstance(item, dict) and item.get("claim_id") == cid:
                        item["statement"] = updated_claim.get("statement", item.get("statement"))
                        item["fact_impact_act"] = updated_claim.get("fact_impact_act", item.get("fact_impact_act"))
                        item["confidence"] = updated_claim.get("confidence", item.get("confidence"))
                        modified = True
                if modified:
                    content["items"] = items
                    blk["content"] = content
                    blk["updated_at"] = datetime.now(timezone.utc).isoformat()
                    save_battlecard_block(blk, tid)
                    updated_count += 1

    return updated_count


def record_claim_review_action(
    alert_id: str,
    tenant_id: str,
    action: str,
    reviewer: str = "analyst",
    notes: Optional[str] = None,
    edited_fields: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Record human review decision:
    - 'accept': Updates claim statement/fact_impact_act with suggested_update, links evidence, updates alert status.
    - 'edit_and_accept': Updates claim with analyst's custom edits, links evidence, updates alert status.
    - 'dismiss': Marks alert dismissed, leaves claim unchanged.
    - 'mark_incorrect': Marks alert / new evidence as inaccurate, leaves claim unchanged.
    """
    tid = str(tenant_id).strip()
    aid = str(alert_id).strip()
    clean_action = str(action).strip().lower()

    if clean_action not in ("accept", "edit_and_accept", "dismiss", "mark_incorrect"):
        raise ValueError(f"Invalid review action '{action}'. Must be one of: accept, edit_and_accept, dismiss, mark_incorrect")

    alert = get_claim_drift_alert(aid, tid)
    if not alert:
        raise ValueError(f"Drift alert '{aid}' not found for tenant '{tid}'")

    cid = alert["claim_id"]
    prior_claim = get_claim(cid, tid)
    if not prior_claim:
        raise ValueError(f"Associated claim '{cid}' not found for alert '{aid}'")

    now_iso = datetime.now(timezone.utc).isoformat()
    updated_claim = None
    propagated_count = 0

    if clean_action == "accept":
        sugg = alert.get("suggested_update") or {}
        updated_claim = dict(prior_claim)
        if sugg.get("statement"):
            updated_claim["statement"] = sugg["statement"]
        if sugg.get("fact_impact_act"):
            updated_claim["fact_impact_act"] = sugg["fact_impact_act"]
        if sugg.get("confidence"):
            updated_claim["confidence"] = sugg["confidence"]
        updated_claim["verification_status"] = "verified"
        updated_claim["last_verified_at"] = now_iso
        save_claim(updated_claim, tid)

        # Link new evidence if available
        if alert.get("new_evidence_url"):
            save_claim_evidence({
                "claim_id": cid,
                "event_id": alert.get("trigger_event_id"),
                "source_url": alert["new_evidence_url"],
                "excerpt": alert.get("new_evidence_excerpt") or "",
                "relationship": "supports",
                "source_quality": "primary",
            }, tid)

        alert["review_status"] = "accepted"
        propagated_count = propagate_claim_update_to_battlecards(cid, updated_claim, tid)

    elif clean_action == "edit_and_accept":
        edits = edited_fields or {}
        updated_claim = dict(prior_claim)
        if edits.get("statement"):
            updated_claim["statement"] = edits["statement"]
        if edits.get("subject"):
            updated_claim["subject"] = edits["subject"]
        if edits.get("fact_impact_act"):
            updated_claim["fact_impact_act"] = edits["fact_impact_act"]
        if edits.get("confidence"):
            updated_claim["confidence"] = edits["confidence"]
        updated_claim["verification_status"] = "verified"
        updated_claim["last_verified_at"] = now_iso
        save_claim(updated_claim, tid)

        if alert.get("new_evidence_url"):
            save_claim_evidence({
                "claim_id": cid,
                "event_id": alert.get("trigger_event_id"),
                "source_url": alert["new_evidence_url"],
                "excerpt": alert.get("new_evidence_excerpt") or "",
                "relationship": "supports",
                "source_quality": "primary",
            }, tid)

        alert["review_status"] = "edited"
        propagated_count = propagate_claim_update_to_battlecards(cid, updated_claim, tid)

    elif clean_action == "dismiss":
        alert["review_status"] = "dismissed"

    elif clean_action == "mark_incorrect":
        alert["review_status"] = "marked_incorrect"

    alert["review_decision_notes"] = notes or ""
    alert["reviewed_by"] = reviewer
    alert["reviewed_at"] = now_iso
    alert["updated_at"] = now_iso

    # Update alert in storage
    _IN_MEMORY_DRIFT_ALERTS[tid][aid] = alert

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    UPDATE claim_drift_alerts
                    SET review_status = %s,
                        review_decision_notes = %s,
                        reviewed_by = %s,
                        reviewed_at = %s,
                        updated_at = %s
                    WHERE tenant_id = %s AND id = %s;
                """, (
                    alert["review_status"], alert["review_decision_notes"],
                    alert["reviewed_by"], alert["reviewed_at"], alert["updated_at"],
                    tid, aid
                ))
        except Exception as e:
            logger.warning(f"PostgreSQL update drift alert review fallback: {e}")

    # Record review action audit log
    action_id = str(uuid.uuid4())
    review_record = {
        "id": action_id,
        "tenant_id": tid,
        "drift_alert_id": aid,
        "claim_id": cid,
        "action": clean_action,
        "prior_claim_state": prior_claim,
        "updated_claim_state": updated_claim,
        "notes": notes or "",
        "reviewer": reviewer,
        "created_at": now_iso,
    }

    if not _is_test_mode():
        try:
            from .storage import get_tenant_db_cursor
            with get_tenant_db_cursor(tid) as cur:
                cur.execute("""
                    INSERT INTO claim_review_actions (
                        id, tenant_id, drift_alert_id, claim_id,
                        action, prior_claim_state, updated_claim_state,
                        notes, reviewer, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    review_record["id"], review_record["tenant_id"],
                    review_record["drift_alert_id"], review_record["claim_id"],
                    review_record["action"], json.dumps(review_record["prior_claim_state"]),
                    json.dumps(review_record["updated_claim_state"]) if review_record["updated_claim_state"] else None,
                    review_record["notes"], review_record["reviewer"], review_record["created_at"]
                ))
        except Exception as e:
            logger.warning(f"PostgreSQL record review action fallback: {e}")

    _IN_MEMORY_REVIEW_ACTIONS[tid].append(review_record)

    return {
        "alert": alert,
        "review_action": review_record,
        "propagated_count": propagated_count,
    }
