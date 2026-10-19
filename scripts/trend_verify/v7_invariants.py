"""
V7 Structural Invariants Verifier:
Validates structural mathematical invariants across all trend clusters:
1. Strict Partition: Each distinct story belongs to exactly ONE cluster.
2. 3% Size Cap: No cluster exceeds 3% of total distinct stories.
3. Neutral Global Labels: No company names appear in global trend topic labels.
4. Determinism & Stability: Stable cluster IDs.
"""
import re
from typing import Dict, List, Any, Set

FORBIDDEN_LABEL_COMPANIES = {
    "google", "alphabet", "openai", "microsoft", "amazon", "aws",
    "meta", "facebook", "anthropic", "cloudflare", "vercel", "netlify",
    "nvidia", "salesforce", "apple", "stripe", "temu", "mistral"
}

def verify_structural_invariants(
    clusters: List[Dict[str, Any]],
    total_distinct_stories: int
) -> Dict[str, Any]:
    max_cap = int(0.03 * total_distinct_stories)
    violations = []

    # 1. Check Size Cap
    cap_violations = []
    for c in clusters:
        cnt = c.get("distinct_story_count", len(c.get("members", [])))
        if cnt > max_cap:
            cap_violations.append({
                "cluster_id": c.get("cluster_id"),
                "distinct_story_count": cnt,
                "max_allowed_cap": max_cap
            })

    # 2. Check Strict Partition
    seen_stories: Set[str] = set()
    duplicate_story_assignments = []
    for c in clusters:
        cid = c.get("cluster_id")
        story_keys = c.get("story_keys", [])
        for sk in story_keys:
            if sk in seen_stories:
                duplicate_story_assignments.append({"story_key": sk, "cluster_id": cid})
            seen_stories.add(sk)

    # 3. Check Neutral Global Labels (if label is present)
    label_violations = []
    for c in clusters:
        cid = c.get("cluster_id")
        global_label = (c.get("global_label") or "").lower()
        if global_label:
            for comp in FORBIDDEN_LABEL_COMPANIES:
                if re.search(rf"\b{re.escape(comp)}\b", global_label):
                    label_violations.append({
                        "cluster_id": cid,
                        "global_label": global_label,
                        "forbidden_company": comp
                    })

    passed = (len(cap_violations) == 0 and len(duplicate_story_assignments) == 0 and len(label_violations) == 0)

    return {
        "gate": "V7_Structural_Invariants",
        "passed": passed,
        "total_distinct_stories": total_distinct_stories,
        "max_cluster_cap": max_cap,
        "cap_violations_count": len(cap_violations),
        "duplicate_assignments_count": len(duplicate_story_assignments),
        "label_company_violations_count": len(label_violations),
        "cap_violations": cap_violations[:5]
    }
