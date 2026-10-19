"""
S0 Provenance Audit: Re-print 5 target clusters (#22, #4, #14, #15, #9)
from actual DB rows in consolidated_events / research_items.
Ensures zero LLM paraphrasing or hallucination.
"""
import os
import sys
import json
import psycopg2
from typing import Dict, List, Any
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))
from src.trends.momentum import calculate_momentum_anchored, get_anchor_completed_weeks, calculate_momentum_with_rule
from src.trends.dates import classify_event_date

def get_db_connection():
    db_url = os.environ.get("SUPABASE_READONLY_DB_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env.readonly")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("SUPABASE_READONLY_DB_URL=") or line.startswith("DATABASE_URL="):
                        db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not db_url:
        raise ValueError("No database URL found")
    return psycopg2.connect(db_url)

def run_s0_provenance_audit():
    with open(os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "t2_third_cut_results.json"), "r", encoding="utf-8") as f:
        t2_data = json.load(f)

    conn = get_db_connection()
    cur = conn.cursor()

    target_indices = [21, 3, 13, 14, 8] # 1-based: 22, 4, 14, 15, 9
    results = {}

    for idx in target_indices:
        c_num = idx + 1
        c = t2_data["stratified_25"][idx]
        cid = c["cluster_id"]
        members = c["members"]

        db_rows = []
        for m in members:
            m_url = m["url"]
            m_title = m["title"]

            # Query exact DB record
            cur.execute("""
                SELECT event_id, company_name, title, url, published_timestamp, published_at, created_at, contributing_sources
                FROM public.consolidated_events
                WHERE url = %s OR title = %s
                LIMIT 1;
            """, (m_url, m_title))
            row = cur.fetchone()

            if not row:
                # Fuzzy fallback
                cur.execute("""
                    SELECT event_id, company_name, title, url, published_timestamp, published_at, created_at, contributing_sources
                    FROM public.consolidated_events
                    WHERE title ILIKE %s
                    LIMIT 1;
                """, (f"%{m_title[:25]}%",))
                row = cur.fetchone()

            if row:
                # Provenance Guard: MUST have event_id
                assert row[0] is not None, f"Provenance violation: event_id missing for {m_title}"
                dt, date_source, date_prec, eligible = classify_event_date(
                    published_ts=row[4],
                    published_at_str=row[5],
                    created_at_fallback=row[6]
                )
                db_rows.append({
                    "event_id": row[0],
                    "company": row[1],
                    "title": row[2],
                    "url": row[3],
                    "published_timestamp": str(row[4]) if row[4] else None,
                    "published_at": str(row[5]) if row[5] else None,
                    "created_at": str(row[6]) if row[6] else None,
                    "date_source": date_source,
                    "date_precision": date_prec,
                    "publisher": m.get("publisher_domain") or m.get("publisher") or "unknown"
                })
            else:
                # Research items fallback
                cur.execute("""
                    SELECT id, 'Research', title, canonical_url, published_timestamp, published_at, created_at
                    FROM public.research_items
                    WHERE canonical_url = %s OR title ILIKE %s
                    LIMIT 1;
                """, (m_url, f"%{m_title[:25]}%"))
                rrow = cur.fetchone()
                if rrow:
                    assert rrow[0] is not None, f"Provenance violation: research_id missing for {m_title}"
                    dt, date_source, date_prec, eligible = classify_event_date(
                        published_ts=rrow[4],
                        published_at_str=rrow[5],
                        created_at_fallback=rrow[6]
                    )
                    db_rows.append({
                        "event_id": rrow[0],
                        "company": rrow[1],
                        "title": rrow[2],
                        "url": rrow[3],
                        "published_timestamp": str(rrow[4]) if rrow[4] else None,
                        "published_at": str(rrow[5]) if rrow[5] else None,
                        "created_at": str(rrow[6]) if rrow[6] else None,
                        "date_source": date_source,
                        "date_precision": date_prec,
                        "publisher": "arXiv/Research"
                    })

        # Recompute momentum strictly from db_rows dates
        # Completed weeks relative to 2026-10-19
        as_of = datetime(2026, 10, 19, tzinfo=timezone.utc).date()
        w1_str, w2_str, w3_str = get_anchor_completed_weeks(as_of)
        
        # Calculate ISO week for each member
        story_weeks = []
        for r in db_rows:
            date_str = r["published_at"] or r["published_timestamp"] or r["created_at"]
            if date_str:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                y, w, _ = dt.isocalendar()
                story_weeks.append(f"{y}-W{w:02d}")

        w1_cnt = sum(1 for w in story_weeks if w == w1_str)
        w2_cnt = sum(1 for w in story_weeks if w == w2_str)
        w3_cnt = sum(1 for w in story_weeks if w == w3_str)
        recomputed_vector = [w1_cnt, w2_cnt, w3_cnt]
        recomputed_label, recomputed_rule = calculate_momentum_with_rule(recomputed_vector, low_coverage=False, historical_distinct_stories=len(db_rows))

        results[c_num] = {
            "cluster_id": cid,
            "representative_title": c["representative_title"],
            "json_vector": c["momentum_vector"],
            "json_rule": c["rule_id"],
            "recomputed_vector": recomputed_vector,
            "recomputed_label": recomputed_label,
            "recomputed_rule": recomputed_rule,
            "anchor_weeks": [w1_str, w2_str, w3_str],
            "db_members": db_rows
        }

    conn.close()
    return results

if __name__ == "__main__":
    res = run_s0_provenance_audit()
    print(json.dumps(res, indent=2))
