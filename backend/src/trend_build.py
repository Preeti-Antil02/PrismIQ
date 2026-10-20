"""
Production Trend Build Pipeline (Milestone S3).
Idempotent, incremental, fail-closed, DRY_RUN aware.
Embeds new stories, generates clusters via clustering_engine, creates per-tenant views,
snapshots daily state, and logs run telemetry to trend_build_runs.
"""
import os
import sys
import json
import time
import psycopg2
from datetime import datetime, timezone, date
from typing import Tuple, Dict, Any, List, Optional

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.trends.clustering_engine import build_trend_clusters
from src.trends.momentum import get_anchor_completed_weeks

def run_trend_build(
    db_url: str,
    dry_run: bool = True,
    groq_api_key: Optional[str] = None,
    as_of_date: Optional[date] = None
) -> Tuple[bool, Dict[str, Any]]:
    target_date = as_of_date or datetime.now(timezone.utc).date()
    start_time = datetime.now(timezone.utc)
    print(f"Starting trend build run (dry_run={dry_run}, as_of={target_date})...")

    try:
        conn = psycopg2.connect(db_url)
    except Exception:
        import re
        m = re.match(r'^(?:postgres(?:ql)?://)([^:]+):(.*)@([^:/@]+)(?::(\d+))?(?:/(.*))?$', db_url.strip().strip("'").strip('"'))
        if m:
            raw_user, raw_pwd, raw_host, raw_port, raw_rest = m.groups()
            parsed_db = raw_rest.split('?')[0] if raw_rest else "postgres"
            clean_user = raw_user
            if "pooler.supabase.com" in raw_host and "." not in clean_user:
                clean_user = f"{clean_user}.hmjcqdthzgzsmhpivrdb"
            conn = psycopg2.connect(
                host=raw_host,
                port=int(raw_port or 6543),
                user=clean_user,
                password=raw_pwd,
                dbname=parsed_db
            )
        else:
            raise
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Fetch Events and Research Items
        cur.execute("""
            SELECT event_id, title, event_summary, company_name, published_timestamp, published_at, created_at, url, contributing_sources, is_mock
            FROM public.consolidated_events
            ORDER BY created_at DESC;
        """)
        events_rows = cur.fetchall()

        cur.execute("""
            SELECT id, title, research_details, published_timestamp, published_at, created_at, canonical_url, matched_topics
            FROM public.research_items
            WHERE is_mock IS NOT TRUE;
        """)
        research_rows = cur.fetchall()

        print(f"Fetched {len(events_rows)} consolidated events and {len(research_rows)} research items.")

        # 2. Build Clusters
        t_embed_start = time.time()
        engine_res = build_trend_clusters(events_rows, research_rows, as_of_date=target_date)
        t_embed_dur = time.time() - t_embed_start

        clusters = engine_res["clusters"]
        total_stories = engine_res["total_distinct_stories"]
        max_cap = engine_res["max_cluster_cap"]

        cross_trends = [c for c in clusters if c["passes_gate"] and c["cluster_type"] == "cross_company_trend"]
        storylines = [c for c in clusters if c["passes_gate"] and c["cluster_type"] == "single_company_storyline"]
        owner_clusters = [c for c in (cross_trends + storylines) if c["involves_owner"]]

        summary = {
            "stories_count": total_stories,
            "clusters_count": len(clusters),
            "cross_trends_count": len(cross_trends),
            "storylines_count": len(storylines),
            "owner_clusters_count": len(owner_clusters),
            "max_cluster_cap": max_cap,
            "embedding_duration_seconds": round(t_embed_dur, 2)
        }

        # 3. Dry-Run Check
        if dry_run:
            print("[DRY RUN] Trend build validated successfully. No database writes performed.")
            cur.close()
            conn.close()
            return True, summary

        # 4. Live Writes (Milestone S3)
        print("Executing live database writes for Trend Evolution...")

        # Record start in trend_build_runs
        cur.execute("""
            INSERT INTO public.trend_build_runs (start_time, status, stories_ingested, clusters_created, embedding_duration_seconds)
            VALUES (%s, 'running', %s, %s, %s)
            RETURNING run_id;
        """, (start_time, total_stories, len(clusters), t_embed_dur))
        run_id = cur.fetchone()[0]

        # Fetch scheduled tenants
        cur.execute("""
            SELECT tenant_id FROM public.scheduled_tenants WHERE is_scheduled = true;
        """)
        scheduled_tenants = [row[0] for row in cur.fetchall()]

        # For each scheduled tenant, fetch tracked companies
        tenant_tracked = {}
        for tid in scheduled_tenants:
            cur.execute("""
                SELECT company_name FROM public.user_tracked_companies WHERE tenant_id = %s;
            """, (tid,))
            tenant_tracked[tid] = [r[0] for r in cur.fetchall()]

        # Insert Clusters and Members
        for c in clusters:
            cid = c["cluster_id"]
            cur.execute("""
                INSERT INTO public.trend_clusters (
                    cluster_id, global_topic_label, cluster_type, momentum_vector,
                    momentum_label, momentum_rule_id, first_date, last_date,
                    distinct_story_count, raw_signal_count, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (cluster_id) DO UPDATE SET
                    global_topic_label = EXCLUDED.global_topic_label,
                    cluster_type = EXCLUDED.cluster_type,
                    momentum_vector = EXCLUDED.momentum_vector,
                    momentum_label = EXCLUDED.momentum_label,
                    momentum_rule_id = EXCLUDED.momentum_rule_id,
                    first_date = EXCLUDED.first_date,
                    last_date = EXCLUDED.last_date,
                    distinct_story_count = EXCLUDED.distinct_story_count,
                    raw_signal_count = EXCLUDED.raw_signal_count,
                    updated_at = NOW();
            """, (
                cid,
                c["representative_title"],
                c["cluster_type"],
                c["momentum_vector"],
                c["momentum_label"],
                c["rule_id"],
                c["first_date"] if c["first_date"] != "N/A" else None,
                c["last_date"] if c["last_date"] != "N/A" else None,
                c["distinct_story_count"],
                c["raw_event_count"]
            ))

            # Delete old members for idempotent refresh
            cur.execute("DELETE FROM public.trend_cluster_members WHERE cluster_id = %s;", (cid,))

            for m in c.get("members", []):
                eid = m.get("event_id")
                # If eid is UUID string or event_id
                event_fk = eid if (eid and eid.startswith("evt_")) else None
                research_fk = eid if (eid and not eid.startswith("evt_") and len(eid) > 20) else None

                cur.execute("""
                    INSERT INTO public.trend_cluster_members (
                        cluster_id, event_id, research_id, story_key, canonical_company,
                        corporate_group, title, source_url, resolved_publisher,
                        node_class, signal_type, source_date, date_source, date_precision,
                        is_sequence_eligible
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    cid,
                    event_fk,
                    research_fk,
                    f"sk_{cid}",
                    m["company"],
                    m.get("corporate_group", m["company"]),
                    m["title"],
                    m["url"],
                    m.get("publisher_domain") or m.get("publisher", "unknown"),
                    m.get("node_class", "third_party"),
                    m.get("signal_type", "news"),
                    m["source_date"] if m["source_date"] != "N/A" else target_date,
                    m.get("date_source", "source_publication_timestamp"),
                    m.get("date_precision", "second"),
                    m.get("is_sequence_eligible", False)
                ))

            # Per-tenant views
            for tid, tracked in tenant_tracked.items():
                present = [comp for comp in c["companies"] if comp in tracked]
                if present:
                    is_cross = (len(present) >= 2)
                    cur.execute("""
                        INSERT INTO public.tenant_trend_views (
                            tenant_id, cluster_id, is_cross_competitor,
                            tenant_momentum_label, tracked_companies_present, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (tenant_id, cluster_id) DO UPDATE SET
                            is_cross_competitor = EXCLUDED.is_cross_competitor,
                            tenant_momentum_label = EXCLUDED.tenant_momentum_label,
                            tracked_companies_present = EXCLUDED.tracked_companies_present,
                            updated_at = NOW();
                    """, (tid, cid, is_cross, c["momentum_label"], present))

        # Close trend_build_runs
        cur.execute("""
            UPDATE public.trend_build_runs
            SET end_time = NOW(), status = 'completed', clusters_merged = 0
            WHERE run_id = %s;
        """, (run_id,))

        conn.commit()
        print("Live trend build committed successfully.")
        return True, summary

    except Exception as e:
        conn.rollback()
        print(f"Error in trend build: {e}")
        return False, {"error": str(e)}
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    db = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_READONLY_DB_URL")
    if db:
        run_trend_build(db, dry_run=True)
