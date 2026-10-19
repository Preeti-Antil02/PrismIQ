"""
Master Verification Orchestrator:
Runs V1 through V7 gates across candidate clusters, validates all mathematical invariants,
and exports verification_report.json.
"""
import os
import sys
import json
import psycopg2
from datetime import datetime, timezone, date
from typing import Dict, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from scripts.trend_verify.v1_provenance import verify_provenance
from scripts.trend_verify.v2_momentum import verify_momentum
from scripts.trend_verify.v3_source_check import verify_source_sample
from scripts.trend_verify.v4_subject_check import verify_subject_precision
from scripts.trend_verify.v5_coherence import evaluate_coherence
from scripts.trend_verify.v6_calibration import run_calibration
from scripts.trend_verify.v7_invariants import verify_structural_invariants

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

def run_all_verification():
    results_path = os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "t2_third_cut_results.json")
    if not os.path.exists(results_path):
        print(f"Error: Results file not found at {results_path}")
        sys.exit(1)

    with open(results_path, "r", encoding="utf-8") as f:
        t2_data = json.load(f)

    clusters = t2_data.get("stratified_25", [])
    waterfall = t2_data.get("waterfall", {})
    total_distinct_stories = waterfall.get("distinct_stories", 3136)

    print(f"Loaded {len(clusters)} stratified clusters from third cut.")

    conn = get_db_connection()

    # 1. V1 Provenance
    print("Running V1 Provenance Verification...")
    res_v1 = verify_provenance(clusters, conn)

    # 2. V2 Momentum
    print("Running V2 Momentum Recomputation...")
    res_v2 = verify_momentum(clusters, as_of_date=date(2026, 10, 19))

    # 3. V3 Source Check
    print("Running V3 Source Check (120 nodes)...")
    res_v3 = verify_source_sample(clusters, sample_size=120)

    # 4. V4 Subject Check
    print("Running V4 Subject Entity Check...")
    all_members = [m for c in clusters for m in c.get("members", [])]
    res_v4 = verify_subject_precision(all_members)

    # 5. V5 Coherence Judging
    print("Running V5 Coherence Judging...")
    res_v5 = evaluate_coherence(clusters)

    # 6. V6 Calibration
    print("Running V6 Calibration...")
    res_v6 = run_calibration()

    # 7. V7 Invariants
    print("Running V7 Structural Invariants...")
    res_v7 = verify_structural_invariants(clusters, total_distinct_stories)

    conn.close()

    # Overall Gate Check (V9)
    # V1 100%, V2 100%, V3 failed <=3%, V4 >=98%, V6 passed, V7 passed
    # judged cross_company_trend: Hallucinated 0
    all_gates_passed = (
        res_v1["passed"] and
        res_v2["passed"] and
        res_v3["passed"] and
        res_v4["passed"] and
        res_v6["passed"] and
        res_v7["passed"]
    )

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": "PASSED" if all_gates_passed else "ATTENTION_REQUIRED",
        "gates": {
            "V1_Provenance": res_v1,
            "V2_Momentum": res_v2,
            "V3_Source_Check": res_v3,
            "V4_Subject_Check": res_v4,
            "V5_Coherence_Judging": res_v5,
            "V6_Calibration": res_v6,
            "V7_Structural_Invariants": res_v7
        }
    }

    report_path = os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "verification_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nVerification report written to {report_path}")

    # Print summary table
    print("\n=======================================================")
    print("AUTOMATED VERIFICATION REPORT SUMMARY")
    print("=======================================================")
    print(f"| Gate | Metric | Result | Status |")
    print(f"|---|---|---|---|")
    print(f"| V1 Provenance | Pass Rate: {res_v1['pass_rate_pct']}% | Hallucinated: {res_v1['hallucinated_clusters_count']} | {'PASS' if res_v1['passed'] else 'FAIL'} |")
    print(f"| V2 Momentum | Mismatched Vectors: {res_v2['mismatched_count']} | Exact Match | {'PASS' if res_v2['passed'] else 'FAIL'} |")
    print(f"| V3 Source Check | Verifiable: {res_v3['verifiable_pct']}% | Failed: {res_v3['failed_pct_of_verifiable']}% | {'PASS' if res_v3['passed'] else 'FAIL'} |")
    print(f"| V4 Subject Check | Precision: {res_v4['precision_pct']}% | Min Gate: 98.0% | {'PASS' if res_v4['passed'] else 'FAIL'} |")
    print(f"| V5 Coherence | Usable: {res_v5['usable_pct']}% | OC: {res_v5['over_clustered_pct']}% | Mode: {res_v5['mode']} |")
    print(f"| V6 Calibration | Binary Agr: {res_v6['seed_binary_agreement_pct']}% | Controls: Neg {res_v6['negative_control_rejection_pct']}% / Pos {res_v6['positive_control_precision_pct']}% | {'PASS' if res_v6['passed'] else 'FAIL'} |")
    print(f"| V7 Invariants | Max Cap: {res_v7['max_cluster_cap']} | Cap Violations: {res_v7['cap_violations_count']} | {'PASS' if res_v7['passed'] else 'FAIL'} |")
    print("=======================================================")
    print(f"OVERALL STATUS: {'[PASS] ALL GATES PASSED' if all_gates_passed else '[REMEDIATE] ATTENTION REQUIRED'}")
    print("=======================================================\n")

if __name__ == "__main__":
    run_all_verification()
