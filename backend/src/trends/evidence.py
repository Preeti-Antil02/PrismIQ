"""
Minimum evidence validation and audited absence tracking.
Enforces honest threshold gates: trends must have >=3 distinct stories across
>=2 completed weeks, and cross-competitor trends require >=2 distinct canonical
entities visible to the specific tenant. Unrepresented tracked competitors are
recorded as audited absences detailing queried sources and dates.
"""
from typing import List, Set, Dict, Any, Tuple, Optional
from datetime import datetime


def validate_trend_evidence(
    distinct_stories_count: int,
    active_weeks_count: int,
    visible_entities_count: int,
    require_cross_competitor: bool = True
) -> Tuple[bool, Optional[str]]:
    """
    Validate that a trend meets hard empirical evidence thresholds.
    
    Returns:
        (is_valid, rejection_reason)
        rejection_reason is None if valid, or a descriptive status code:
        - 'insufficient_stories': < 3 distinct stories
        - 'insufficient_weeks': < 2 active completed weeks
        - 'insufficient_entities': < 2 visible canonical entities when cross-competitor required.
    """
    if distinct_stories_count < 3:
        return False, "insufficient_stories"

    if active_weeks_count < 2:
        return False, "insufficient_weeks"

    if require_cross_competitor and visible_entities_count < 2:
        return False, "insufficient_entities"

    return True, None


def build_audited_absences(
    tenant_tracked_companies: List[str],
    active_trend_entities: Set[str],
    queried_sources: Optional[List[str]] = None,
    window_start: Optional[str or datetime] = None,
    window_end: Optional[str or datetime] = None
) -> List[Dict[str, Any]]:
    """
    Construct audited absence records for all tracked competitors not present in the trend.
    Lists the sources audited and observation window to guarantee truthful non-detection.
    """
    sources = queried_sources or ["news", "github", "jobs", "pricing", "research"]
    start_str = str(window_start) if window_start else "window_start"
    end_str = str(window_end) if window_end else "window_end"

    absences: List[Dict[str, Any]] = []
    for company in tenant_tracked_companies:
        canonical = company.strip()
        if canonical not in active_trend_entities:
            absences.append({
                "company_name": canonical,
                "status": "audited_absence",
                "queried_sources": sources,
                "window_start": start_str,
                "window_end": end_str,
                "reason": "zero_signals_detected_in_window"
            })
    return sorted(absences, key=lambda x: x["company_name"])
