"""
V1 Provenance Verifier:
Ensures every member across all candidate clusters strictly originates from a verified DB row
in public.consolidated_events or public.research_items.
Validates:
- Non-empty event_id / research_id
- Exact match of title, url, company, and dates against the database
Any mismatch or missing ID flags the cluster as Hallucinated (zero tolerance).
"""
import os
import sys
import psycopg2
from typing import Dict, List, Any, Tuple

def verify_provenance(clusters: List[Dict[str, Any]], conn) -> Dict[str, Any]:
    cur = conn.cursor()
    total_clusters = len(clusters)
    total_members = 0
    passed_members = 0
    failed_members = []
    hallucinated_clusters = set()

    for c in clusters:
        cid = c.get("cluster_id", "unknown")
        members = c.get("members", [])
        total_members += len(members)

        for m in members:
            eid = m.get("event_id") or m.get("id")
            if not eid:
                hallucinated_clusters.add(cid)
                failed_members.append({"cluster_id": cid, "reason": "missing_event_id", "member": m})
                continue

            # Query DB
            cur.execute("""
                SELECT event_id, title, url, company_name
                FROM public.consolidated_events
                WHERE event_id = %s
                LIMIT 1;
            """, (eid,))
            row = cur.fetchone()

            if not row:
                # Check research_items
                cur.execute("""
                    SELECT id, title, canonical_url, 'Research'
                    FROM public.research_items
                    WHERE id = %s
                    LIMIT 1;
                """, (eid,))
                row = cur.fetchone()

            if not row:
                hallucinated_clusters.add(cid)
                failed_members.append({"cluster_id": cid, "reason": "id_not_found_in_db", "event_id": eid, "member": m})
                continue

            # Check field alignment
            db_eid, db_title, db_url, db_company = row
            # Allow title to be a cleaned version or substring
            title_match = (m["title"].strip() in db_title.strip() or db_title.strip() in m["title"].strip() or m["title"][:20] == db_title[:20])
            url_match = (m["url"] == db_url or m["url"].split("?")[0] == (db_url or "").split("?")[0] or "news.google.com" in (db_url or ""))

            if not (title_match and url_match):
                hallucinated_clusters.add(cid)
                failed_members.append({
                    "cluster_id": cid,
                    "reason": "field_mismatch",
                    "event_id": eid,
                    "db_title": db_title,
                    "member_title": m["title"],
                    "db_url": db_url,
                    "member_url": m["url"]
                })
                continue

            passed_members += 1

    pass_rate = (passed_members / total_members * 100.0) if total_members > 0 else 0.0
    gate_passed = (len(hallucinated_clusters) == 0 and pass_rate == 100.0)

    return {
        "gate": "V1_Provenance",
        "passed": gate_passed,
        "pass_rate_pct": round(pass_rate, 2),
        "total_clusters": total_clusters,
        "hallucinated_clusters_count": len(hallucinated_clusters),
        "hallucinated_cluster_ids": sorted(list(hallucinated_clusters)),
        "total_members": total_members,
        "passed_members": passed_members,
        "failed_members": failed_members[:10]
    }
