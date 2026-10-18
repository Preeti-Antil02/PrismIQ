"""
Deterministic trend momentum calculation.
Evaluates trend trajectory across the last 3 completed weeks using an ordered
rule table with documented precedence. Never raises, always returns an allowed label:
'building', 'steady', 'fading', 'too_early_to_call', or 'low_coverage'.
"""
from typing import List, Tuple, Set

ALLOWED_MOMENTUM_LABELS: Set[str] = {
    "building",
    "steady",
    "fading",
    "too_early_to_call",
    "low_coverage",
}


def calculate_momentum(
    weekly_counts: List[int],
    low_coverage: bool = False
) -> str:
    """
    Calculate deterministic trend momentum label from a 3-week completed count vector.
    
    Args:
        weekly_counts: List or tuple of exactly 3 integers [w1, w2, w3] representing
                       distinct story counts for:
                       - w1: 3 weeks ago (earliest completed week)
                       - w2: 2 weeks ago
                       - w3: 1 week ago (most recently completed week)
        low_coverage: Boolean flag indicating that one or more weeks had incomplete
                      data coverage or company tracking started mid-window.
                      
    Evaluation Order & Precedence Rules:
        1. Coverage Guard:
           If low_coverage is True, immediately return 'low_coverage'.
        2. Minimum Evidence Gate:
           If total distinct stories < 3 OR active weeks (< 2 weeks with > 0 stories),
           return 'too_early_to_call'. (Any vector meeting >=3 stories across >=2 weeks
           is guaranteed to proceed to active trajectory classification).
        3. Fading Precedence:
           - Cessation: w3 == 0 (activity ceased in latest completed week).
           - Severe drop: w3 < w2 and w2 >= 2 * w3 (activity dropped by 50% or more).
           - Monotonic decline: w1 > w2 > w3 (strictly decreasing across all 3 weeks).
           - Post-spike drop: w2 > w1 and w3 <= w1 and (w2 - w3) >= 2.
        4. Building Precedence:
           - Monotonic growth: w1 < w2 < w3 (strictly increasing across all 3 weeks).
           - Emergence to sustained: w1 == 0 and w2 >= 2 and w3 >= w2.
           - Recent peak: w3 > w2 and w3 > w1 and w3 >= 2.
        5. Steady Default:
           All other vectors with sustained baseline activity return 'steady'.
    """
    if low_coverage:
        return "low_coverage"

    if len(weekly_counts) != 3:
        raise ValueError(f"Momentum calculation strictly requires exactly 3 completed weekly counts, got {len(weekly_counts)}")

    w1, w2, w3 = int(weekly_counts[0]), int(weekly_counts[1]), int(weekly_counts[2])
    total = w1 + w2 + w3
    active_weeks = sum(1 for x in (w1, w2, w3) if x > 0)

    # Rule 1: Minimum evidence requirement (>=3 distinct stories across >=2 active weeks)
    if total < 3 or active_weeks < 2:
        return "too_early_to_call"

    # Rule 2: Fading
    if w3 == 0:
        return "fading"
    if w3 < w2 and w2 >= 2 * w3:
        return "fading"
    if w1 > w2 > w3:
        return "fading"
    if w2 > w1 and w3 <= w1 and (w2 - w3) >= 2:
        return "fading"

    # Rule 3: Building
    if w1 < w2 < w3:
        return "building"
    if w1 == 0 and w2 >= 2 and w3 >= w2:
        return "building"
    if w3 > w2 and w3 > w1 and w3 >= 2:
        return "building"

    # Rule 4: Steady
    return "steady"
