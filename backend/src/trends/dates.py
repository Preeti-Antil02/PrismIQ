"""
Date provenance classification and sequence eligibility.
Enforces strict first-mover and lag constraints: only genuine publisher or event
timestamps can establish sequence; date-only (00:00:00) and ingestion fallbacks
are tagged 'undated-order' and excluded from first-mover/lag calculations.
Never uses database created_at as an event date.
"""
import re
from datetime import datetime, timezone
from typing import Optional, Tuple


def parse_iso_datetime(val: Optional[str or datetime]) -> Optional[datetime]:
    """Parse string or datetime into UTC datetime object."""
    if not val:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    
    clean = str(val).strip().strip("'").strip('"')
    if not clean:
        return None

    # Handle standard ISO formats
    try:
        dt = datetime.fromisoformat(clean.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass

    # Handle RFC 2822 / common RSS date formats
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass

    return None


def get_iso_week(dt: datetime) -> str:
    """Return ISO year-week format 'YYYY-Www' for a given datetime."""
    iso_year, iso_week, _ = dt.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def is_date_only_midnight(dt: datetime) -> bool:
    """Check if timestamp has exact 00:00:00 time, indicating date-only precision."""
    return dt.hour == 0 and dt.minute == 0 and dt.second == 0 and dt.microsecond == 0


def classify_event_date(
    source_event_ts: Optional[str or datetime] = None,
    published_ts: Optional[str or datetime] = None,
    published_at_str: Optional[str] = None,
    created_at_fallback: Optional[str or datetime] = None,
    signal_type: Optional[str] = None
) -> Tuple[datetime, str, str, bool]:
    """
    Classify event date and determine sequence/first-mover eligibility.
    
    Priority:
    1. Exact source event timestamp (e.g. GitHub commit/PR, ATS job post)
    2. Publisher publication timestamp (e.g. news RSS, press release timestamptz)
    3. Publisher string ISO timestamp (e.g. crawler published_at ISO string)
    4. Fallback to ingestion created_at (tagged undated_order, ineligible)
    
    Returns:
        (resolved_dt, date_source, date_precision, is_sequence_eligible)
        - date_source: 'source_event_timestamp', 'source_publication_timestamp',
                       'source_publication_date', or 'undated_order'
        - date_precision: 'second' (exact time), 'day' (date-only/midnight), or 'unknown' (fallback)
        - is_sequence_eligible: True if second or day precision (day allows whole-day ordering; ties on same day).
    """
    # 1. Exact Source Event Timestamp (GitHub push, ATS creation)
    dt_event = parse_iso_datetime(source_event_ts)
    if dt_event:
        if is_date_only_midnight(dt_event):
            return dt_event, "source_publication_date", "day", True
        return dt_event, "source_event_timestamp", "second", True

    # 2. Publisher Publication Timestamp (timestamptz object)
    dt_pub = parse_iso_datetime(published_ts)
    if dt_pub:
        if is_date_only_midnight(dt_pub):
            return dt_pub, "source_publication_date", "day", True
        return dt_pub, "source_publication_timestamp", "second", True

    # 3. Publisher String Fallback (published_at ISO string stored by crawlers)
    dt_str = parse_iso_datetime(published_at_str)
    if dt_str:
        if is_date_only_midnight(dt_str):
            return dt_str, "source_publication_date", "day", True
        return dt_str, "source_publication_timestamp", "second", True

    # 4. Ingestion / Crawler Created At Fallback (strictly ineligible for sequencing)
    dt_created = parse_iso_datetime(created_at_fallback)
    if dt_created:
        return dt_created, "undated_order", "unknown", False

    # Fail closed: default to epoch fallback marked undated_order
    epoch_fallback = datetime(1970, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    return epoch_fallback, "undated_order", "unknown", False


def compute_lag_hours(
    first_mover_dt: datetime,
    follower_dt: datetime,
    is_first_eligible: bool,
    is_follower_eligible: bool,
    first_precision: str = "second",
    follower_precision: str = "second"
) -> Optional[float]:
    """
    Compute lag in hours between first mover and follower.
    Strictly returns None if either timestamp is not sequence-eligible.
    If either timestamp has day-level precision, computes whole-day lag.
    """
    if not is_first_eligible or not is_follower_eligible:
        return None
    delta = follower_dt - first_mover_dt
    hours = delta.total_seconds() / 3600.0

    # If either timestamp is day-precision only, round to whole days (same day = 0.0)
    if first_precision == "day" or follower_precision == "day":
        days = round(hours / 24.0)
        return max(0.0, float(days * 24.0))

    return max(0.0, round(hours, 2))

