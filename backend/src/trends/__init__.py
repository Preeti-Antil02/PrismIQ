"""
Trend Evolution Timeline Pure Core Module.
Exposes entity aliasing, distinct story deduplication, date provenance classification,
deterministic 3-week momentum evaluation, evidence gates, cluster lineage matching,
and adversarial label/summary validators.
"""
from .aliases import (
    resolve_canonical_company,
    is_quarantined_entity,
    normalize_entity_name,
    DEFAULT_COMPANY_ALIASES,
    DEFAULT_QUARANTINED_ENTITIES,
)
from .distinct_story import (
    compute_distinct_story_key,
    classify_job_role_family,
    extract_github_repo,
    normalize_title,
    normalize_story_url,
)
from .dates import (
    classify_event_date,
    compute_lag_hours,
    get_iso_week,
    parse_iso_datetime,
    is_date_only_midnight,
)
from .momentum import (
    calculate_momentum,
    ALLOWED_MOMENTUM_LABELS,
)
from .evidence import (
    validate_trend_evidence,
    build_audited_absences,
)
from .lineage import (
    match_cluster_identity,
    compute_overlap_ratio,
)
from .validator import (
    validate_cluster_label,
    validate_tenant_summary,
    BANNED_CAUSATION_TERMS,
    BANNED_FILLER_PHRASES,
)

__all__ = [
    "resolve_canonical_company",
    "is_quarantined_entity",
    "normalize_entity_name",
    "DEFAULT_COMPANY_ALIASES",
    "DEFAULT_QUARANTINED_ENTITIES",
    "compute_distinct_story_key",
    "classify_job_role_family",
    "extract_github_repo",
    "normalize_title",
    "normalize_story_url",
    "classify_event_date",
    "compute_lag_hours",
    "get_iso_week",
    "parse_iso_datetime",
    "is_date_only_midnight",
    "calculate_momentum",
    "ALLOWED_MOMENTUM_LABELS",
    "validate_trend_evidence",
    "build_audited_absences",
    "match_cluster_identity",
    "compute_overlap_ratio",
    "validate_cluster_label",
    "validate_tenant_summary",
    "BANNED_CAUSATION_TERMS",
    "BANNED_FILLER_PHRASES",
]
