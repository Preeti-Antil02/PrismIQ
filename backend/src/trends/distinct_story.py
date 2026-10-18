"""
Distinct story identification and deduplication.
Collapses syndicated repeats, same-company same-role-family jobs in a week,
and same-repo GitHub commits in a week into unified distinct story units.
"""
import re
import urllib.parse
import hashlib
from typing import Optional, Dict, Any

# Job role families matched via strict word boundaries (\b), never substrings
JOB_ROLE_PATTERNS = [
    (r"\b(software|backend|frontend|fullstack|infra|infrastructure|platform|devops|sre|systems?|distributed)\s+(engineer|developer|architect)\b|\b(sde|swe)\b", "software_engineering"),
    (r"\b(machine\s+learning|ml|ai|deep\s+learning|nlp|computer\s+vision|research)\s+(engineer|scientist|researcher)\b|\bmle\b", "ai_ml_engineering"),
    (r"\b(data)\s+(engineer|analyst|scientist|architect)\b", "data_engineering"),
    (r"\b(product\s+manager|technical\s+product\s+manager|group\s+product\s+manager|head\s+of\s+product)\b|\b(t?pm)\b", "product_management"),
    (r"\b(product\s+designer|ui|ux|user\s+experience|interaction)\s+(designer|lead)\b", "product_design"),
    (r"\b(account\s+executive|sales\s+development|business\s+development|enterprise\s+sales)\b|\b(ae|sdr|bdr)\b", "sales"),
    (r"\b(marketing|growth|content|developer\s+relations|devrel|product\s+marketing)\b|\b(pmm)\b", "marketing_devrel"),
    (r"\b(legal|counsel|compliance|regulatory)\b", "legal_compliance"),
    (r"\b(finance|accounting|controller|fp&a)\b", "finance_accounting"),
    (r"\b(recruiter|talent|people|hr|human\s+resources)\b", "talent_people"),
]


def normalize_title(title: Optional[str]) -> str:
    """Normalize event title for deduplication by removing syndication tags, punctuation, and excess spaces."""
    if not title:
        return ""
    t = title.strip().lower()
    # Remove common syndication/publication suffixes
    t = re.sub(r"\s+[-–—|]\s+[a-z0-9\s\.\&]+$", "", t)
    # Remove all non-alphanumeric characters
    t = re.sub(r"[^\w\s]", " ", t)
    # Collapse whitespace
    return " ".join(t.split())


def normalize_story_url(url: Optional[str]) -> str:
    """Normalize URL by stripping tracking parameters, scheme, and trailing slashes."""
    if not url:
        return ""
    try:
        parsed = urllib.parse.urlsplit(url.strip())
        # Filter tracking query parameters
        if parsed.query:
            params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
            filtered = [
                (k, v) for k, v in params 
                if not (k.startswith("utm_") or k in {"ref", "source", "fbclid", "gclid", "ocid", "cmpid"})
            ]
            query = urllib.parse.urlencode(filtered)
        else:
            query = ""
        path = parsed.path.rstrip("/")
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return f"{netloc}{path}{'?' + query if query else ''}"
    except Exception:
        return url.strip().lower()


def classify_job_role_family(title: Optional[str]) -> str:
    """Classify a job posting title into a canonical role family using strict word boundaries."""
    if not title:
        return "general_operations"
    clean = title.strip().lower()
    for pattern, family in JOB_ROLE_PATTERNS:
        if re.search(pattern, clean, re.IGNORECASE):
            return family
    return "general_operations"


def extract_github_repo(url: Optional[str], raw_title: Optional[str]) -> str:
    """Extract owner/repo identifier from GitHub URL or signal title."""
    candidate = url or raw_title or ""
    m = re.search(r"github\.com/([^/\s]+/[^/\s\#\?]+)", candidate, re.IGNORECASE)
    if m:
        return m.group(1).lower().rstrip(".git")
    return "repo_activity"


def compute_distinct_story_key(
    canonical_company: str,
    signal_type: str,
    title: str,
    url: str,
    iso_week: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Compute deterministic distinct story grouping key.
    
    Rules:
    - Jobs: same company + same role family in a given ISO week collapse to 1 story.
    - GitHub: same company + same repository in a given ISO week collapse to 1 story.
    - News/Research/Other: normalized title signature or URL collapse syndicated duplicates.
    """
    comp = canonical_company.strip().lower()
    sig = (signal_type or "news").strip().lower()
    meta = metadata or {}

    if sig in {"job", "jobs", "ats"}:
        role_family = classify_job_role_family(title)
        return f"job:{comp}:{role_family}:{iso_week}"

    if sig in {"github", "repo", "git"}:
        repo = extract_github_repo(url, title)
        return f"gh:{comp}:{repo}:{iso_week}"

    # Default (News, Pricing, Research, Announcements):
    norm_title = normalize_title(title)
    if len(norm_title) >= 15:
        # Use first 80 characters of clean title hash for matching syndicated duplicates
        sig_hash = hashlib.sha256(norm_title[:80].encode("utf-8")).hexdigest()[:16]
        return f"story:{comp}:{sig_hash}"

    # Fallback to normalized URL if title is short or empty
    norm_url = normalize_story_url(url)
    url_hash = hashlib.sha256(norm_url.encode("utf-8")).hexdigest()[:16]
    return f"url:{comp}:{url_hash}"
