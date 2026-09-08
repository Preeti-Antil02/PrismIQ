import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

backend = Path(__file__).resolve().parent
load_dotenv(backend / ".env")
prod_url = os.getenv("SUPABASE_DB_URL")
conn = psycopg2.connect(prod_url)
cur = conn.cursor()

# Pre-run baseline recorded at 2026-09-01 02:47 UTC
BASELINE = {
    "competitors": 42,
    "raw_signals": 1000,
    "noise_suppression_decisions": 1000,
    "consolidated_events": 761,
    "event_signals": 783,
    "findings": 186,
    "briefs": 4,
    "discovery_proposals": 3,
    "discovery_candidates": 11,
    "discovery_sources": 38,
    "pricing_snapshots": 12,
    "eval_grading_records": 33,
}

tables_query = """
SELECT 
    'competitors' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(CASE WHEN is_mock = false THEN 1 END) AS real_rows,
    COUNT(CASE WHEN is_mock = true THEN 1 END) AS mock_rows
FROM competitors
UNION ALL
SELECT 
    'raw_signals' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(CASE WHEN is_mock = false THEN 1 END) AS real_rows,
    COUNT(CASE WHEN is_mock = true THEN 1 END) AS mock_rows
FROM raw_signals
UNION ALL
SELECT 
    'noise_suppression_decisions' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(CASE WHEN rs.is_mock = false THEN 1 END) AS real_rows,
    COUNT(CASE WHEN rs.is_mock = true THEN 1 END) AS mock_rows
FROM noise_suppression_decisions nsd
LEFT JOIN raw_signals rs ON nsd.signal_id = rs.id
UNION ALL
SELECT 
    'consolidated_events' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(CASE WHEN is_mock = false THEN 1 END) AS real_rows,
    COUNT(CASE WHEN is_mock = true THEN 1 END) AS mock_rows
FROM consolidated_events
UNION ALL
SELECT 
    'event_signals' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(CASE WHEN ce.is_mock = false THEN 1 END) AS real_rows,
    COUNT(CASE WHEN ce.is_mock = true THEN 1 END) AS mock_rows
FROM event_signals es
LEFT JOIN consolidated_events ce ON es.event_id = ce.event_id
UNION ALL
SELECT 
    'findings' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(CASE WHEN is_mock = false THEN 1 END) AS real_rows,
    COUNT(CASE WHEN is_mock = true THEN 1 END) AS mock_rows
FROM findings
UNION ALL
SELECT 
    'briefs' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) AS real_rows,
    0 AS mock_rows
FROM briefs
UNION ALL
SELECT 
    'discovery_proposals' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) AS real_rows,
    0 AS mock_rows
FROM discovery_proposals
UNION ALL
SELECT 
    'discovery_candidates' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) AS real_rows,
    0 AS mock_rows
FROM discovery_candidates
UNION ALL
SELECT 
    'discovery_sources' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) AS real_rows,
    0 AS mock_rows
FROM discovery_sources
UNION ALL
SELECT 
    'pricing_snapshots' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) AS real_rows,
    0 AS mock_rows
FROM pricing_snapshots
UNION ALL
SELECT 
    'eval_grading_records' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) AS real_rows,
    0 AS mock_rows
FROM eval_grading_records;
"""

cur.execute(tables_query)
rows = cur.fetchall()

print("=" * 95)
print("LIVE POSTGRESQL POST-RUN DELTA & INTEGRITY AUDIT")
print("=" * 95)
print(f"{'TABLE NAME':<30} | {'BASELINE':>8} | {'CURRENT':>8} | {'DELTA':>8} | {'REAL':>8} | {'MOCK':>6}")
print("-" * 95)

for tname, tot, real, mock in rows:
    base = BASELINE.get(tname, 0)
    delta = tot - base
    delta_str = f"+{delta}" if delta > 0 else f"{delta}"
    print(f"{tname:<30} | {base:>8} | {tot:>8} | {delta_str:>8} | {real:>8} | {mock:>6}")

print("-" * 95)

# Check 1:1 Invariant
cur.execute("SELECT COUNT(*) FROM raw_signals;")
rs_count = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM noise_suppression_decisions;")
nsd_count = cur.fetchone()[0]
print(f"\n1:1 Invariant: raw_signals={rs_count} vs noise_suppression_decisions={nsd_count} -> Match: {rs_count == nsd_count}")

# Check Foreign Keys & Orphans
cur.execute("""
    SELECT COUNT(*) FROM event_signals es
    LEFT JOIN consolidated_events ce ON es.event_id = ce.event_id
    WHERE ce.event_id IS NULL;
""")
orphaned_es = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM findings f
    LEFT JOIN consolidated_events ce ON f.event_id = ce.event_id
    WHERE ce.event_id IS NULL;
""")
orphaned_f = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM noise_suppression_decisions nsd
    LEFT JOIN raw_signals rs ON nsd.signal_id = rs.id
    WHERE rs.id IS NULL;
""")
orphaned_nsd = cur.fetchone()[0]

print(f"Orphaned event_signals: {orphaned_es} | Orphaned findings: {orphaned_f} | Orphaned noise_decisions: {orphaned_nsd}")

# Check latest consolidated events root-signal anchoring
cur.execute("""
    SELECT ce.event_id, MIN(es.signal_id) as min_sig, ce.company_name, ce.title
    FROM consolidated_events ce
    JOIN event_signals es ON ce.event_id = es.event_id
    GROUP BY ce.event_id, ce.company_name, ce.title
    ORDER BY ce.created_at DESC
    LIMIT 5;
""")
sample_events = cur.fetchall()
print("\n--- Latest Consolidated Events Root-Signal Anchoring Sample ---")
for eid, min_sig, comp, title in sample_events:
    expected_id = f"evt_{min_sig.replace('sig_', '')}"
    match = (eid == expected_id)
    print(f"  event_id={eid:<28} | root_signal={min_sig:<25} | match={match} | {comp}: {title[:25]}")

conn.close()
