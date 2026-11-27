import os
import re
import json
import base64
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone
from pathlib import Path

from src import storage

logger = logging.getLogger(__name__)

def encode_cursor(relevance_score: float, cluster_id: str) -> str:
    raw = f"{relevance_score:.6f}|{cluster_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")

def decode_cursor(cursor: str) -> Optional[Tuple[float, str]]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        parts = raw.split("|", 1)
        if len(parts) == 2:
            return float(parts[0]), parts[1]
    except Exception:
        pass
    return None

def _get_fallback_clusters(tenant_id: str, target_company: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fallback loader when trend database tables are not yet backfilled.
    Loads stratified clusters from local JSON and filters/scores by tenant tracked companies.
    Strictly excludes any cluster with zero overlap with this company's ecosystem.
    """
    candidate_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", "published_briefs", "trends_clusters.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "trends_clusters.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "scratch", "t2_third_cut_results.json"),
    ]
    clusters = []
    for json_path in candidate_paths:
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                clusters = data.get("stratified_25", [])
                if clusters:
                    break
            except Exception as e:
                logger.warning(f"Could not read fallback clusters from {json_path}: {e}")

    if not clusters:
        return []

    # Get tenant's tracked companies
    tracked = []
    try:
        with storage.get_tenant_db_cursor(tenant_id, readonly=True) as cur:
            cur.execute(
                "SELECT company_name FROM tenant_tracked_companies WHERE status = 'active' AND (tenant_id = %s::uuid OR tenant_id IS NULL);",
                (str(tenant_id),)
            )
            tracked = [r[0] for r in cur.fetchall()]
    except Exception:
        # Fallback to tenant-specific tracked companies
        tracked = [c.get("company_name", "") for c in storage.get_tenant_tracked_companies(tenant_id)]

    tracked_names = {c.lower() for c in tracked if c}
    if target_company:
        tracked_names.add(target_company.lower().strip())

    scored = []
    for c in clusters:
        comp_involved = [m.get("company", "") for m in c.get("members", []) if m.get("company")]
        comp_set = set([comp.lower() for comp in comp_involved])
        overlap = list(tracked_names & comp_set)
        
        # Strict Filtering Rule: NEVER return clusters that have ZERO overlap with this company's ecosystem!
        if not overlap:
            continue

        relevance = 0.7 + (0.05 * len(overlap))

        item = dict(c)
        item["relevance_score"] = round(min(1.0, relevance), 2)
        item["matched_tracked_companies"] = overlap
        # Only surface companies that belong to the active company's tracked ecosystem
        ecosystem_comps = [comp for comp in sorted(list(set(comp_involved))) if comp.lower() in tracked_names]
        item["companies_involved"] = ecosystem_comps if ecosystem_comps else overlap
        scored.append(item)

    scored.sort(key=lambda x: (x.get("relevance_score", 0), x.get("raw_event_count", 0)), reverse=True)
    if scored:
        return scored

    # Dynamic synthesis from the tenant's own persisted events when static trends_clusters.json has no overlap
    return _synthesize_dynamic_clusters_from_events(tenant_id, target_company=target_company)


def _classify_event_theme(ev: Dict[str, Any]) -> Tuple[str, str]:
    """Derive a clean trend theme and primary category from a consolidated event."""
    explicit = ev.get("theme") or ev.get("strategic_theme") or ev.get("dimension") or ev.get("category")
    if explicit and isinstance(explicit, str) and explicit.strip():
        clean = explicit.strip()
        return clean, clean
    text = f"{ev.get('title', '')} {ev.get('event_summary', '')}".lower()
    if any(k in text for k in ("price", "pricing", "tier", "fee", "discount", "commission", "billing")):
        return "Pricing & Commercial Shifts", "Pricing"
    if any(k in text for k in ("ai", "llm", "model", "agent", "Copilot".lower(), "ml")):
        return "AI & Product Capabilities", "AI & Technology"
    if any(k in text for k in ("partner", "alliance", "acquir", "funding", "series", "invest")):
        return "Partnerships & Capital Strategy", "Partnerships"
    if any(k in text for k in ("vp", "director", "chief", "head of", "hiring", "recruit")):
        return "Leadership & Talent Expansion", "Talent & Hiring"
    if any(k in text for k in ("security", "cve", "compliance", "soc2", "gdpr", "breach")):
        return "Security & Compliance Posture", "Compliance"
    return "Product & Platform Moves", "Product"


def _synthesize_dynamic_clusters_from_events(
    tenant_id: str,
    target_company: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Synthesize tenant-isolated trend clusters directly from storage.load_events(tenant_id).
    Used when static trends_clusters.json has zero overlap for a custom or demo tenant.
    """
    events = storage.load_events(tenant_id=tenant_id) or []
    if not events:
        return []

    buckets: Dict[str, List[Dict[str, Any]]] = {}
    categories: Dict[str, str] = {}
    for ev in events:
        theme, cat = _classify_event_theme(ev)
        buckets.setdefault(theme, []).append(ev)
        categories[theme] = cat

    tid_prefix = re.sub(r"[^a-z0-9]", "", str(tenant_id).lower())[:8] or "tenant"
    synthesized: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for theme, ev_list in buckets.items():
        # Sort chronologically
        ev_list_sorted = sorted(
            ev_list,
            key=lambda x: str(x.get("published_at") or x.get("published_timestamp") or ""),
        )
        comps = sorted(list({
            str(e.get("company_name") or e.get("company") or "").strip()
            for e in ev_list_sorted
            if (e.get("company_name") or e.get("company"))
        }))
        if not comps:
            continue

        # Build 3-week velocity vector [w-2, w-1, w0] anchored to the latest event timestamp
        dates: List[datetime] = []
        for e in ev_list_sorted:
            raw_dt = e.get("published_at") or e.get("published_timestamp") or ""
            try:
                dt = datetime.fromisoformat(str(raw_dt).replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                dates.append(dt)
            except Exception:
                pass

        anchor_dt = max(dates) if dates else now
        vec = [0, 0, 0]
        for dt in dates:
            age_days = max(0.0, (anchor_dt - dt).total_seconds() / 86400.0)
            if age_days <= 7:
                vec[2] += 1
            elif age_days <= 14:
                vec[1] += 1
            else:
                vec[0] += 1
        if sum(vec) == 0:
            vec[2] = len(ev_list_sorted)

        if vec[2] > vec[1] and len(ev_list_sorted) >= 3:
            momentum_label = "surging"
        elif vec[2] >= vec[1] and len(ev_list_sorted) >= 2:
            momentum_label = "building"
        else:
            momentum_label = "stable"

        members = []
        for idx, e in enumerate(ev_list_sorted):
            srcs = e.get("contributing_sources") or []
            sig_type = srcs[0] if isinstance(srcs, list) and srcs else (e.get("source") or "news")
            pub_str = e.get("published_at") or e.get("published_timestamp") or anchor_dt.isoformat()
            members.append({
                "event_id": e.get("event_id") or e.get("id") or f"evt_{tid_prefix}_{idx}",
                "company": e.get("company_name") or e.get("company") or comps[0],
                "title": e.get("title") or "Competitive Development",
                "url": e.get("url") or "",
                "signal_type": sig_type,
                "node_class": "first_party" if "github" in str(sig_type).lower() else "third_party",
                "published_at": pub_str,
                "date_precision": "day",
                "is_sequence_eligible": True,
            })

        slug = re.sub(r"[^a-z0-9]+", "_", theme.lower()).strip("_")
        rep_title = f"{theme}: {ev_list_sorted[-1].get('title', theme)}" if len(ev_list_sorted) == 1 else f"{theme} across {', '.join(comps[:3])}"
        synthesized.append({
            "cluster_id": f"dyn_{tid_prefix}_{slug}",
            "trend_name": theme,
            "representative_title": rep_title[:120],
            "cluster_type": "cross_company_trend" if len(comps) >= 2 else "single_company_storyline",
            "primary_category": categories.get(theme, "Technology"),
            "momentum_label": momentum_label,
            "momentum_vector": vec,
            "distinct_story_count": len(ev_list_sorted),
            "raw_event_count": len(ev_list_sorted),
            "companies_involved": comps,
            "matched_tracked_companies": comps,
            "relevance_score": round(min(0.98, 0.72 + (0.05 * len(comps))), 2),
            "first_detected_at": members[0]["published_at"] if members else None,
            "latest_detected_at": members[-1]["published_at"] if members else None,
            "members": members,
        })

    synthesized.sort(key=lambda x: (x.get("relevance_score", 0), x.get("raw_event_count", 0)), reverse=True)
    return synthesized

def get_tenant_trends(
    tenant_id: str,
    limit: int = 20,
    cursor: Optional[str] = None,
    company: Optional[str] = None,
    target_company: Optional[str] = None,
    momentum: Optional[str] = None,
    trend_type: Optional[str] = None,
    min_confidence: Optional[float] = None
) -> Dict[str, Any]:
    """
    Retrieve paginated trends visible to the authenticated tenant.
    Queries tenant_trend_views and trend_clusters, with fallback to local clusters.
    """
    trends_list = []
    has_more = False
    next_cursor = None
    total_count = 0
    resolved_target = target_company or company

    cursor_score, cursor_id = decode_cursor(cursor) if cursor else (None, None)

    # 1. Attempt DB Query (skip cleanly when MockCursor is returned)
    try:
        with storage.get_tenant_db_cursor(tenant_id, readonly=True) as cur:
            if not isinstance(cur, storage.MockCursor):
                # Check if tenant_trend_views table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'tenant_trend_views'
                    );
                """)
                exists_row = cur.fetchone()
                has_table = bool(exists_row and exists_row[0] is True)

                if has_table:
                    # Count total
                    cur.execute("SELECT COUNT(*) FROM tenant_trend_views WHERE tenant_id = %s;", (tenant_id,))
                    cnt_row = cur.fetchone()
                    raw_cnt = cnt_row[0] if cnt_row else 0
                    total_count = int(raw_cnt) if isinstance(raw_cnt, (int, float)) else 0

                    if total_count > 0:
                        query = """
                            SELECT 
                                tc.cluster_id,
                                tc.trend_name,
                                tc.representative_title,
                                tc.cluster_type,
                                tc.primary_category,
                                tc.momentum_label,
                                tc.momentum_vector,
                                tc.distinct_story_count,
                                tc.raw_event_count,
                                tc.companies_involved,
                                tc.first_detected_at,
                                tc.latest_detected_at,
                                tc.published_at,
                                ttv.relevance_score,
                                ttv.matched_tracked_companies
                            FROM tenant_trend_views ttv
                            JOIN trend_clusters tc ON ttv.cluster_id = tc.cluster_id
                            WHERE ttv.tenant_id = %s
                        """
                        params: List[Any] = [tenant_id]

                        if company:
                            query += " AND %s = ANY(tc.companies_involved)"
                            params.append(company)
                        if momentum:
                            query += " AND tc.momentum_label = %s"
                            params.append(momentum)
                        if trend_type:
                            query += " AND tc.cluster_type = %s"
                            params.append(trend_type)
                        if cursor_score is not None and cursor_id is not None:
                            query += " AND (ttv.relevance_score, tc.cluster_id) < (%s, %s)"
                            params.extend([cursor_score, cursor_id])

                        query += " ORDER BY ttv.relevance_score DESC, tc.cluster_id DESC LIMIT %s;"
                        params.append(limit + 1)

                        cur.execute(query, tuple(params))
                        rows = cur.fetchall()

                        if len(rows) > limit:
                            has_more = True
                            rows = rows[:limit]
                            last_row = rows[-1]
                            next_cursor = encode_cursor(last_row[13], last_row[0])

                        for r in rows:
                            trends_list.append({
                                "cluster_id": r[0],
                                "trend_name": r[1] or r[2],
                                "representative_title": r[2],
                                "cluster_type": r[3],
                                "primary_category": r[4],
                                "momentum": {
                                    "label": r[5],
                                    "vector": r[6] if isinstance(r[6], list) else json.loads(r[6] or "[0,0,0]")
                                },
                                "distinct_story_count": r[7],
                                "raw_event_count": r[8],
                                "companies_involved": r[9] or [],
                                "first_detected_at": r[10].isoformat() if r[10] else None,
                                "latest_detected_at": r[11].isoformat() if r[11] else None,
                                "published_at": r[12].isoformat() if r[12] else None,
                                "relevance_score": float(r[13]),
                                "matched_tracked_companies": r[14] or [],
                            })
    except Exception as e:
        logger.info(f"Database query for trends fell back to local store: {e}")

    # 2. Local Fallback if DB empty or not yet migrated
    if not trends_list and total_count == 0:
        fallback_clusters = _get_fallback_clusters(tenant_id, target_company=resolved_target)
        
        # Filter
        filtered = fallback_clusters
        if company and company.lower() != (resolved_target or "").lower():
            filtered = [c for c in filtered if any(company.lower() in comp.lower() for comp in c.get("companies_involved", []))]
        if momentum:
            filtered = [c for c in filtered if c.get("momentum_label") == momentum or (c.get("momentum", {}).get("label") == momentum)]
        if trend_type:
            filtered = [c for c in filtered if c.get("cluster_type") == trend_type]

        total_count = len(filtered)

        # If no trends exist for the company, return empty honest state
        if total_count == 0:
            return {"trends": [], "total_count": 0, "has_more": False, "next_cursor": None}

        # Pagination
        start_idx = 0
        if cursor_id:
            for idx, c in enumerate(filtered):
                if c.get("cluster_id") == cursor_id:
                    start_idx = idx + 1
                    break

        page_items = filtered[start_idx : start_idx + limit]
        if start_idx + limit < len(filtered):
            has_more = True
            last_item = page_items[-1]
            next_cursor = encode_cursor(last_item.get("relevance_score", 0.5), last_item.get("cluster_id", ""))

        for c in page_items:
            # Breakdown signal types
            sig_breakdown = {}
            for m in c.get("members", []):
                st = m.get("signal_type", "news")
                sig_breakdown[st] = sig_breakdown.get(st, 0) + 1

            trends_list.append({
                "cluster_id": c.get("cluster_id"),
                "trend_name": c.get("representative_title", c.get("cluster_id")),
                "representative_title": c.get("representative_title"),
                "cluster_type": c.get("cluster_type", "single_company_storyline"),
                "primary_category": c.get("primary_category", "Technology"),
                "momentum": c.get("momentum") or {
                    "label": c.get("momentum_label", "stable"),
                    "vector": c.get("momentum_vector", [0, 0, 0])
                },
                "distinct_story_count": c.get("distinct_story_count", len(c.get("members", []))),
                "raw_event_count": c.get("raw_event_count", len(c.get("members", []))),
                "companies_involved": c.get("companies_involved", []),
                "signal_breakdown": sig_breakdown,
                "first_detected_at": c.get("first_detected_at") or (c.get("members", [{}])[0].get("published_at")),
                "latest_detected_at": c.get("latest_detected_at") or (c.get("members", [{}])[-1].get("published_at")),
                "relevance_score": c.get("relevance_score", 0.8),
                "matched_tracked_companies": c.get("matched_tracked_companies", [])
            })

    return {
        "trends": trends_list,
        "total_count": total_count,
        "has_more": has_more,
        "next_cursor": next_cursor
    }

def get_trend_detail(tenant_id: str, trend_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve full timeline detail for a specific trend, ensuring tenant access.
    Includes chronological timeline nodes, audited absences, and lineage.
    """
    # 1. Try DB fetch (skip cleanly when MockCursor is returned)
    try:
        with storage.get_tenant_db_cursor(tenant_id, readonly=True) as cur:
            if not isinstance(cur, storage.MockCursor):
                cur.execute("""
                    SELECT 
                        tc.cluster_id,
                        tc.trend_name,
                        tc.representative_title,
                        tc.cluster_type,
                        tc.primary_category,
                        tc.momentum_label,
                        tc.momentum_vector,
                        tc.distinct_story_count,
                        tc.raw_event_count,
                        tc.companies_involved,
                        tc.first_detected_at,
                        tc.latest_detected_at,
                        tc.published_at,
                        ttv.relevance_score
                    FROM tenant_trend_views ttv
                    JOIN trend_clusters tc ON ttv.cluster_id = tc.cluster_id
                    WHERE ttv.tenant_id = %s AND ttv.cluster_id = %s;
                """, (tenant_id, trend_id))
                row = cur.fetchone()

                if row:
                    # Fetch members
                    cur.execute("""
                        SELECT 
                            member_id,
                            event_id,
                            company_name,
                            title,
                            source_url,
                            signal_type,
                            node_class,
                            published_at,
                            date_precision,
                            is_sequence_eligible
                        FROM trend_cluster_members
                        WHERE cluster_id = %s
                        ORDER BY published_at ASC;
                    """, (trend_id,))
                    member_rows = cur.fetchall()

                    timeline = []
                    for m in member_rows:
                        timeline.append({
                            "member_id": str(m[0]),
                            "event_id": m[1],
                            "company": m[2],
                            "title": m[3],
                            "source_url": m[4],
                            "signal_type": m[5],
                            "node_class": m[6],
                            "published_at": m[7].isoformat() if m[7] else None,
                            "date_precision": m[8],
                            "is_sequence_eligible": bool(m[9])
                        })

                    # Fetch lineage
                    cur.execute("""
                        SELECT parent_cluster_id, merge_reason, merged_at
                        FROM trend_cluster_lineage
                        WHERE cluster_id = %s;
                    """, (trend_id,))
                    lineage = [{"parent_id": l[0], "reason": l[1], "merged_at": l[2].isoformat() if l[2] else None} for l in cur.fetchall()]

                    # Calculate audited absences
                    cur.execute("SELECT company_name FROM tenant_tracked_companies WHERE status = 'active' AND tenant_id = %s;", (tenant_id,))
                    tracked = [r[0] for r in cur.fetchall()]
                    companies_in = set(row[9] or [])
                    absences = []
                    for t in tracked:
                        if t not in companies_in:
                            absences.append({
                                "company": t,
                                "status": "absent",
                                "audit_note": "Audited: 0 events detected across tracked window"
                            })

                    return {
                        "cluster_id": row[0],
                        "trend_name": row[1] or row[2],
                        "representative_title": row[2],
                        "cluster_type": row[3],
                        "primary_category": row[4],
                        "momentum": {
                            "label": row[5],
                            "vector": row[6] if isinstance(row[6], list) else json.loads(row[6] or "[0,0,0]")
                        },
                        "distinct_story_count": row[7],
                        "raw_event_count": row[8],
                        "companies_involved": row[9] or [],
                        "relevance_score": float(row[13]),
                        "first_detected_at": row[10].isoformat() if row[10] else None,
                        "latest_detected_at": row[11].isoformat() if row[11] else None,
                        "published_at": row[12].isoformat() if row[12] else None,
                        "timeline": timeline,
                        "lineage": lineage,
                        "audited_absences": absences
                    }
    except Exception as e:
        logger.info(f"Database fetch for trend detail fell back to local store: {e}")

    # 2. Local Fallback
    fallback_clusters = _get_fallback_clusters(tenant_id)
    target = next((c for c in fallback_clusters if c.get("cluster_id") == trend_id), None)
    if not target:
        return None

    timeline = []
    for m in target.get("members", []):
        timeline.append({
            "event_id": m.get("event_id"),
            "company": m.get("company"),
            "title": m.get("title"),
            "source_url": m.get("url"),
            "signal_type": m.get("signal_type", "news"),
            "node_class": m.get("node_class", "third_party"),
            "published_at": m.get("published_at"),
            "date_precision": m.get("date_precision", "day"),
            "is_sequence_eligible": bool(m.get("is_sequence_eligible"))
        })

    # Sort timeline chronologically
    timeline.sort(key=lambda x: str(x.get("published_at") or ""))

    # Audited absences
    tracked = []
    try:
        with storage.get_tenant_db_cursor(tenant_id, readonly=True) as cur:
            cur.execute(
                "SELECT company_name FROM tenant_tracked_companies WHERE status = 'active' AND (tenant_id = %s::uuid OR tenant_id IS NULL);",
                (str(tenant_id),)
            )
            tracked = [r[0] for r in cur.fetchall()]
    except Exception:
        pass
    if not tracked:
        tracked = [c["company_name"] for c in storage.get_tenant_tracked_companies(tenant_id)]

    companies_in = set(target.get("companies_involved", []))
    absences = []
    for t in tracked:
        if t not in companies_in:
            absences.append({
                "company": t,
                "status": "absent",
                "audit_note": "Audited: 0 events detected across tracked window"
            })

    return {
        "cluster_id": target.get("cluster_id"),
        "trend_name": target.get("representative_title", target.get("cluster_id")),
        "representative_title": target.get("representative_title"),
        "cluster_type": target.get("cluster_type", "single_company_storyline"),
        "primary_category": target.get("primary_category", "Technology"),
        "momentum": target.get("momentum") or {
            "label": target.get("momentum_label", "stable"),
            "vector": target.get("momentum_vector", [0, 0, 0])
        },
        "distinct_story_count": target.get("distinct_story_count", len(timeline)),
        "raw_event_count": target.get("raw_event_count", len(timeline)),
        "companies_involved": target.get("companies_involved", []),
        "relevance_score": target.get("relevance_score", 0.85),
        "timeline": timeline,
        "lineage": target.get("lineage", []),
        "audited_absences": absences,
        "first_detected_at": timeline[0]["published_at"] if timeline else None,
        "latest_detected_at": timeline[-1]["published_at"] if timeline else None,
    }
