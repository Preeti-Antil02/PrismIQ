"""
Cluster identity matching and lineage management.
Preserves stable cluster identities across nightly runs via member overlap tracking:
- >= 50% overlap: assign existing identity (or merge if multiple prior clusters match)
- < 20% overlap: create new cluster identity
- Lineage relationships (create, assign, merge, split) recorded for snapshot survival.
"""
import uuid
from typing import Dict, List, Set, Tuple, Optional, Any


def compute_overlap_ratio(new_set: Set[str], old_set: Set[str]) -> float:
    """Compute member overlap ratio relative to previous cluster size."""
    if not old_set:
        return 0.0
    return len(new_set & old_set) / float(len(old_set))


def match_cluster_identity(
    new_member_keys: Set[str],
    previous_clusters: Dict[str, Set[str]]
) -> Tuple[str, str, List[str], float]:
    """
    Match a new cluster candidate against prior active clusters.
    
    Args:
        new_member_keys: Set of distinct story keys in the new cluster.
        previous_clusters: Dict mapping previous cluster_id -> set of member keys.
        
    Returns:
        (action, cluster_id, parent_ids, best_overlap)
        - action: 'assign' | 'merge' | 'split' | 'create'
        - cluster_id: the assigned UUID (reused or newly generated)
        - parent_ids: prior cluster UUIDs merged or split from
        - best_overlap: highest overlap ratio observed
    """
    if not previous_clusters or not new_member_keys:
        new_id = str(uuid.uuid4())
        return "create", new_id, [], 0.0

    matches_above_50: List[Tuple[str, float]] = []
    matches_between_20_and_50: List[Tuple[str, float]] = []
    best_overlap = 0.0

    for old_id, old_keys in previous_clusters.items():
        overlap = compute_overlap_ratio(new_member_keys, old_keys)
        if overlap > best_overlap:
            best_overlap = overlap

        if overlap >= 0.50:
            matches_above_50.append((old_id, overlap))
        elif overlap >= 0.20:
            matches_between_20_and_50.append((old_id, overlap))

    # Case 1: Multiple previous clusters merged into one
    if len(matches_above_50) > 1:
        # Sort by overlap descending, primary parent retains identity
        matches_above_50.sort(key=lambda x: x[1], reverse=True)
        primary_id = matches_above_50[0][0]
        other_parents = [m[0] for m in matches_above_50[1:]]
        return "merge", primary_id, [primary_id] + other_parents, best_overlap

    # Case 2: Clean continuation (>= 50% overlap with single parent)
    if len(matches_above_50) == 1:
        matched_id = matches_above_50[0][0]
        return "assign", matched_id, [matched_id], best_overlap

    # Case 3: Partial lineage (split or branch with 20% to 50% overlap)
    if matches_between_20_and_50:
        matches_between_20_and_50.sort(key=lambda x: x[1], reverse=True)
        parent_id = matches_between_20_and_50[0][0]
        new_id = str(uuid.uuid4())
        return "split", new_id, [parent_id], best_overlap

    # Case 4: New emergence (< 20% overlap with any known cluster)
    new_id = str(uuid.uuid4())
    return "create", new_id, [], best_overlap
