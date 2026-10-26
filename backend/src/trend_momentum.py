"""
Trend Evolution Offline Pure Functions (Phase F0).
Provides deterministic momentum calculation and distinct-story counting.
Zero database access; completely pure and unit-testable.
"""
import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Word-boundary regex token definitions to avoid substring collisions
# (e.g. 'ai' must not match 'maintain', 'ui' must not match 'build', 'pm' must not match 'development')
ROLE_FAMILY_PATTERNS = {
    "frontend": [r"\bfrontend\b", r"\bfront-end\b", r"\bui\b", r"\bweb engineer\b", r"\breact\b"],
    "backend": [r"\bbackend\b", r"\bback-end\b", r"\bdistributed\b", r"\bsystems\b", r"\binfra\b", r"\bdatabase\b", r"\bplatform\b"],
    "ai_ml": [r"\bai\b", r"\bmachine learning\b", r"\bml\b", r"\bllm\b", r"\bresearcher\b", r"\bdata science\b"],
    "security": [r"\bsecurity\b", r"\bsecops\b", r"\bcve\b", r"\binfosec\b"],
    "devops_sre": [r"\bdevops\b", r"\bsre\b", r"\bcloud\b", r"\bsite reliability\b"],
    "product": [r"\bproduct manager\b", r"\bpm\b", r"\bproduct lead\b"],
    "gtm": [r"\bsales\b", r"\baccount executive\b", r"\bbdr\b", r"\bsdr\b", r"\bmarketing\b"],
}


def calculate_trend_momentum(
    vector: List[int],
    total_historical_stories: Optional[int] = None,
    is_low_coverage: bool = False,
) -> str:
    """
    Pure deterministic momentum evaluator for Trend Evolution Timeline.
    Evaluates completed 7-day windows [W-3, W-2, W-1].
    vector: [c1, c2, c3] representing distinct story counts in the last 3 completed weeks.

    Returns one of:
      - "low_coverage"
      - "building"
      - "steady"
      - "fading"
      - "irregular"
      - "too_early_to_call"

    Rule Precedence Order:
      1. Low coverage guard
      2. Zero activity in window [0,0,0]
      3. Single active week guard
      4. Total volume threshold (< 3 stories across window)
      5. Dip-and-resurge / discontinuous pattern [c1, 0, c3] -> "irregular"
      6. Immediate cessation to zero in latest week [c1, c2, 0] -> "fading"
      7. High-volume steady plateau [e.g. 3,3,2], [2,3,3], [4,4,4] -> "steady"
      8. Sharp decline from historical peak or plateau [e.g. 5,5,1], [4,4,1], [1,5,2] -> "fading"
      9. Monotonic acceleration or emergence from zero baseline [e.g. 1,2,4], [0,3,3], [0,2,2] -> "building"
      10. Rebound breakout above historical levels -> "building"
      11. Strictly decreasing progression -> "fading"
      12. Peaked in W-2 and declined in W-1 -> "fading"
      13. Multi-week cadence fallback (guarantees >=3 stories in >=2 weeks never returns too_early_to_call)
    """
    if is_low_coverage:
        return "low_coverage"

    if len(vector) != 3:
        raise ValueError(f"Vector must have exactly 3 completed week counts, got {vector}")

    c1, c2, c3 = vector
    total_3w = c1 + c2 + c3
    hist_total = total_historical_stories if total_historical_stories is not None else total_3w
    active_weeks = sum(1 for c in vector if c > 0)

    # 1. Total extinction: no events in last 3 weeks but existed historically
    if total_3w == 0:
        if hist_total >= 3:
            return "fading"
        return "too_early_to_call"

    # 2. Single active week guard:
    # A burst of >= 3 stories in W-1 is building; otherwise isolated single-week blips are too early
    if active_weeks <= 1:
        if c1 == 0 and c2 == 0 and c3 >= 3:
            return "building"
        return "too_early_to_call"

    # 3. Insufficient evidence threshold: less than 3 stories across the window
    if total_3w < 3:
        return "too_early_to_call"

    # 4. Discontinuous dip-and-resurge across zero: active in W-3, completely silent in W-2, re-emerged in W-1
    if c2 == 0 and c1 > 0 and c3 > 0:
        return "irregular"

    # 5. Immediate cessation to zero in latest completed week
    if c3 == 0:
        return "fading"

    # 6. High-volume steady plateau: sustained activity with small delta (handles [3,3,2], [2,3,3], [4,4,4])
    if c3 >= 2 and c2 >= 2 and abs(c3 - c2) <= 1 and (c1 >= 2 or abs(c2 - c1) <= 1):
        if not (c1 < c2 and c3 < c2 and (c2 - c3) >= 2) and not (c1 == c2 and (c2 - c3) >= 2):
            return "steady"

    # 7. Sharp decline from plateau or peak (handles [5,5,1], [4,4,1], [1,5,2], [2,6,1])
    if c3 < c2 and (c2 >= c1 or (c2 - c3) >= 2):
        return "fading"

    # 8. Monotonic acceleration or emergence from zero baseline (handles [1,2,4], [0,3,3], [0,2,2], [0,1,3])
    if (c3 > c2 and c2 >= c1 and c3 >= 2) or (c1 == 0 and c2 >= 1 and c3 >= c2 and total_3w >= 3):
        return "building"

    # 9. Rebound breakout
    if c3 > c2 and c3 > c1 and c3 >= 3:
        return "building"

    # 10. Strictly decreasing momentum
    if c3 < c2 and c2 < c1:
        return "fading"

    # 11. Peaked in W-2 and declined in W-1
    if c1 < c2 and c3 < c2:
        return "fading"

    # 12. Steady active cadence across all 3 weeks (e.g. [1,1,1], [1,2,2])
    if c3 >= 1 and c2 >= 1 and c1 >= 1 and abs(c3 - c2) <= 1 and abs(c2 - c1) <= 1:
        return "steady"

    # 13. Fallback for remaining multi-week active vectors (ensures >=3 stories in >=2 weeks never returns too_early_to_call)
    if c3 > c1:
        return "building"
    elif c3 < c1:
        return "fading"
    else:
        return "steady"


def _normalize_title_for_story(title: str) -> str:
    """Normalize news headline to collapse syndicated wire stories."""
    if not title:
        return ""
    clean = title.strip().lower()
    # Strip common wire prefixes/suffixes
    clean = re.sub(r"^(reuters|bloomberg|techcrunch|prnewswire|businesswire)\s*[:|-]\s*", "", clean)
    clean = re.sub(r"\s*[-|]\s*(reuters|bloomberg|techcrunch|prnewswire|businesswire)$", "", clean)
    clean = re.sub(r"[^\w\s]", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _extract_job_role_family(title: str) -> str:
    """
    Extract standard role family from job titles using regex word-boundary matching.
    Prevents substring false positives:
      - 'ai' will not match 'maintain'
      - 'ui' will not match 'build'
      - 'pm' will not match 'development'
    """
    if not title:
        return "general"
    t = title.lower()
    for family, regexes in ROLE_FAMILY_PATTERNS.items():
        if any(re.search(pat, t) for pat in regexes):
            return family
    return "general"


def _extract_github_repo(url: str, title: str) -> str:
    """
    Extract owner/repo identifier from GitHub signal URL or title.
    Uses exact suffix stripping (.removesuffix) rather than character-set stripping (.rstrip).
    """
    clean_url = (url or "").strip()
    m = re.search(r"github\.com/([^/]+/[^/]+)", clean_url)
    if m:
        repo = m.group(1).rstrip("/").removesuffix(".git")
        return repo.lower()
    m_title = re.search(r"([a-zA-Z0-9_\-]+/[a-zA-Z0-9_\-]+)", title or "")
    if m_title:
        return m_title.group(1).lower().removesuffix(".git")
    return "unknown_repo"


def count_distinct_stories(signals: List[Dict[str, Any]]) -> int:
    """
    Count distinct strategic stories from raw signals in a time window.
    Pure function executing offline deduplication:
    1. Syndicated news: collapses matching normalized titles and canonical URLs.
       [PROVISIONAL NOTE]: Uses a 6-word title prefix heuristic as initial story key.
    2. Same-company same-role-family job postings: collapses bulk hiring for similar roles.
    3. Same-repo GitHub activity: collapses multiple commits/releases/PRs to the same repository.
    """
    if not signals:
        return 0

    seen_stories: Set[Tuple[str, str, str]] = set()

    for s in signals:
        comp = (s.get("company") or s.get("company_name") or "unknown").strip().lower()
        source = (s.get("source") or "unknown").strip().lower()
        title = s.get("title") or ""
        url = s.get("url") or s.get("canonical_url") or ""

        if source in ("news", "rss"):
            norm_title = _normalize_title_for_story(title)
            # PROVISIONAL: Use first 6 normalized words as title signature
            words = norm_title.split()[:6]
            story_key = " ".join(words) if words else norm_title
            key = (comp, "news_story", story_key)

        elif source == "jobs":
            family = _extract_job_role_family(title)
            key = (comp, "jobs_family", family)

        elif source == "github":
            repo = _extract_github_repo(url, title)
            key = (comp, "github_repo", repo)

        else:
            norm_title = _normalize_title_for_story(title)
            key = (comp, source, norm_title or url)

        seen_stories.add(key)

    return len(seen_stories)
