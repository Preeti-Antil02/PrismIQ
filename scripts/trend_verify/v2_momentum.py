"""
V2 Momentum Recomputation Verifier:
Recomputes weekly count vectors, momentum labels, and rule IDs from member rows
using the executable rule table in backend/src/trends/momentum.py.
Gate: Zero mismatches allowed between cluster metadata and recomputed values.
"""
import os
import sys
from datetime import datetime, timezone, date
from typing import Dict, List, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))
from src.trends.momentum import (
    calculate_momentum_anchored,
    get_anchor_completed_weeks,
    calculate_momentum_with_rule,
    MomentumResult
)

def verify_momentum(
    clusters: List[Dict[str, Any]],
    as_of_date: date = date(2026, 10, 19)
) -> Dict[str, Any]:
    anchor_weeks = get_anchor_completed_weeks(as_of_date)
    w1_str, w2_str, w3_str = anchor_weeks

    total_clusters = len(clusters)
    mismatched_clusters = []

    for c in clusters:
        cid = c.get("cluster_id")
        declared_vec = c.get("momentum_vector", [])
        declared_label = c.get("momentum_label")
        declared_rule = c.get("rule_id")

        # Gather ISO weeks of all distinct stories in the cluster
        # Note: momentum is computed over distinct stories in the cluster
        story_weeks = c.get("story_iso_weeks")
        if not story_weeks:
            # Reconstruct from members
            story_weeks = []
            for m in c.get("members", []):
                date_str = m.get("source_date") or m.get("published_at") or m.get("published_timestamp")
                if date_str:
                    clean_d = date_str[:10]
                    try:
                        dt = datetime.strptime(clean_d, "%Y-%m-%d").date()
                        y, w, _ = dt.isocalendar()
                        story_weeks.append(f"{y}-W{w:02d}")
                    except Exception:
                        pass

        mom_res = calculate_momentum_anchored(
            story_weeks,
            as_of=as_of_date,
            historical_distinct_stories=c.get("distinct_story_count", len(story_weeks))
        )
        recomp_vec = mom_res.vector
        recomp_label = mom_res.label
        recomp_rule = mom_res.rule_id

        # Check for mismatch
        # If declared_vec was computed on the full cluster and members is a subset (e.g. 8 samples),
        # we check against cluster's declared vector or recomputed from all cluster story weeks
        vec_match = (declared_vec == recomp_vec)
        label_match = (declared_label == recomp_label)
        rule_match = (declared_rule == recomp_rule)

        if not (vec_match and label_match and rule_match):
            mismatched_clusters.append({
                "cluster_id": cid,
                "declared": {
                    "vector": declared_vec,
                    "label": declared_label,
                    "rule_id": declared_rule
                },
                "recomputed": {
                    "vector": recomp_vec,
                    "label": recomp_label,
                    "rule_id": recomp_rule
                }
            })

    passed = (len(mismatched_clusters) == 0)
    return {
        "gate": "V2_Momentum_Recomputation",
        "passed": passed,
        "total_clusters": total_clusters,
        "mismatched_count": len(mismatched_clusters),
        "mismatches": mismatched_clusters[:10],
        "anchor_weeks": anchor_weeks
    }
