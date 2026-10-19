"""
Deterministic trend momentum calculation.
Evaluates trend trajectory across the last 3 completed weeks using an ordered
rule table with documented precedence. Never raises, always returns an allowed label:
'building', 'steady', 'fading', 'too_early_to_call', or 'low_coverage'.
"""
from datetime import datetime, date, timedelta, timezone
from typing import List, Tuple, Set, Optional

ALLOWED_MOMENTUM_LABELS: Set[str] = {
    "building",
    "steady",
    "fading",
    "too_early_to_call",
    "low_coverage",
}


def get_anchor_completed_weeks(as_of: Optional[datetime or date] = None) -> List[str]:
    """
    Return the ISO year-week strings ('YYYY-Www') for the last 3 COMPLETED weeks relative to as_of.
    The current ongoing ISO week of as_of is excluded because it is incomplete.
    
    Returns:
        [w1, w2, w3] where:
        - w1: 3 completed weeks ago (earliest)
        - w2: 2 completed weeks ago
        - w3: 1 completed week ago (most recently completed)
    """
    if as_of is None:
        target_date = datetime.now(timezone.utc).date()
    elif isinstance(as_of, datetime):
        target_date = as_of.date()
    else:
        target_date = as_of

    # Monday of the current (incomplete) week
    curr_monday = target_date - timedelta(days=target_date.weekday())
    
    # Midpoints of the 3 prior completed weeks
    w3_date = curr_monday - timedelta(days=3)   # 1 week ago
    w2_date = curr_monday - timedelta(days=10)  # 2 weeks ago
    w1_date = curr_monday - timedelta(days=17)  # 3 weeks ago

    def to_iso(d: date) -> str:
        y, w, _ = d.isocalendar()
        return f"{y}-W{w:02d}"

    return [to_iso(w1_date), to_iso(w2_date), to_iso(w3_date)]


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
        low_coverage: Boolean flag indicating incomplete data coverage.
    """
class MomentumResult(tuple):
    """
    A 2-tuple (vector, label) that also provides .rule_id attribute.
    Ensures 100% backwards compatibility with existing callers expecting (vector, label).
    """
    def __new__(cls, vector: List[int], label: str, rule_id: str):
        return super().__new__(cls, (vector, label))

    def __init__(self, vector: List[int], label: str, rule_id: str):
        self.vector = vector
        self.label = label
        self.rule_id = rule_id


def calculate_momentum_with_rule(
    weekly_counts: Tuple[int, int, int] or List[int],
    low_coverage: bool = False,
    historical_distinct_stories: Optional[int] = None
) -> Tuple[str, str]:
    if low_coverage:
        return "low_coverage", "RULE_MOM_01"

    if len(weekly_counts) != 3:
        raise ValueError(f"Momentum calculation strictly requires exactly 3 completed weekly counts, got {len(weekly_counts)}")

    w1, w2, w3 = int(weekly_counts[0]), int(weekly_counts[1]), int(weekly_counts[2])
    total = w1 + w2 + w3
    active_weeks = sum(1 for x in (w1, w2, w3) if x > 0)
    total_hist = historical_distinct_stories if historical_distinct_stories is not None else total

    # Rule 02: Cessation of historical activity (>=3 historical stories, 0 in last 3 weeks)
    if total_hist >= 3 and [w1, w2, w3] == [0, 0, 0]:
        return "fading", "RULE_MOM_02"

    # Rule 12: Insufficient activity across completed weeks (Master prompt baseline)
    # If active_weeks < 2 or total < 3, flag as too_early_to_call
    if total < 3 or active_weeks < 2:
        return "too_early_to_call", "RULE_MOM_12"

    # Rule 04: Cessation in latest completed week
    if w3 == 0:
        return "fading", "RULE_MOM_04"

    # Rule 05: Severe drop of 50% or more
    if w3 < w2 and w2 >= 2 * w3:
        return "fading", "RULE_MOM_05"

    # Rule 06: Monotonic decline
    if w1 > w2 > w3:
        return "fading", "RULE_MOM_06"

    # Rule 07: Post-spike drop
    if w2 > w1 and w3 <= w1 and (w2 - w3) >= 2:
        return "fading", "RULE_MOM_07"

    # Rule 08: Sustained decline from high baseline (e.g. [3, 1, 1], [8, 4, 5], [16, 3, 6])
    if w1 > w2 and w2 >= w3 and (w1 - w3) >= 2:
        return "fading", "RULE_MOM_08"
    if w1 >= 2 * w3 and w1 >= 2 * w2 and (w1 - w3) >= 2:
        return "fading", "RULE_MOM_08"

    # Rule 09: Monotonic growth
    if w1 < w2 < w3:
        return "building", "RULE_MOM_09"

    # Rule 10: Acceleration / Building
    if w1 == 0 and w2 >= 2 and w3 >= w2:
        return "building", "RULE_MOM_10"
    if w3 > w2 and w3 > w1 and w3 >= 2:
        return "building", "RULE_MOM_10"

    # Rule 11: Steady Active Baseline
    return "steady", "RULE_MOM_11"


def calculate_momentum(
    weekly_counts: Tuple[int, int, int] or List[int],
    low_coverage: bool = False
) -> str:
    label, _ = calculate_momentum_with_rule(weekly_counts, low_coverage=low_coverage)
    return label


def calculate_momentum_anchored(
    story_iso_weeks: List[str],
    as_of: Optional[datetime or date] = None,
    low_coverage: bool = False,
    historical_distinct_stories: Optional[int] = None
) -> MomentumResult:
    """
    Calculate momentum vector, label, and rule_id anchored to the last 3 COMPLETED calendar weeks relative to as_of.
    Returns MomentumResult (tuple of (vector, label) with .rule_id attribute).
    """
    if low_coverage:
        return MomentumResult([0, 0, 0], "low_coverage", "RULE_MOM_01")

    anchor_weeks = get_anchor_completed_weeks(as_of)
    w1_str, w2_str, w3_str = anchor_weeks

    w1_cnt = sum(1 for w in story_iso_weeks if w == w1_str)
    w2_cnt = sum(1 for w in story_iso_weeks if w == w2_str)
    w3_cnt = sum(1 for w in story_iso_weeks if w == w3_str)
    vector = [w1_cnt, w2_cnt, w3_cnt]

    total_hist = historical_distinct_stories if historical_distinct_stories is not None else len(story_iso_weeks)

    label, rule_id = calculate_momentum_with_rule(
        vector,
        low_coverage=low_coverage,
        historical_distinct_stories=total_hist
    )
    return MomentumResult(vector, label, rule_id)

