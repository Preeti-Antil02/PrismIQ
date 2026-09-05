import hashlib
import logging
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Common publisher, aggregator, and hosting domains that must NEVER be used as event anchors
PUBLISHER_AND_GENERIC_DOMAINS: Set[str] = {
    "github.com", "api.github.com", "dev.to", "reddit.com", "infoq.com", "thenewstack.io",
    "thehackernews.com", "vulners.com", "techcrunch.com", "news.ycombinator.com",
    "medium.com", "substack.com", "twitter.com", "x.com", "linkedin.com", "youtube.com",
    "bloomberg.com", "reuters.com", "cnbc.com", "forbes.com", "wsj.com", "nytimes.com",
    "example.com", "test.com", "sample.com", "localhost",
    # Job board and ATS platforms
    "greenhouse.io", "boards.greenhouse.io", "job-boards.greenhouse.io",
    "lever.co", "jobs.lever.co", "api.lever.co",
    "ashbyhq.com", "jobs.ashbyhq.com", "api.ashbyhq.com",
    # Target company corporate sites (hosting thousands of unrelated updates)
    "vercel.com", "netlify.com", "cloudflare.com", "datadog.com", "datadoghq.com",
    "stripe.com", "github.blog", "blog.cloudflare.com",
    # Academic & Paper repositories
    "arxiv.org", "export.arxiv.org",
}

# Stopwords and common generic tech words that must NEVER act as event anchors
GENERIC_STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
    "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
    "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
    "s", "same", "she", "should", "so", "some", "such", "t", "than", "that", "the", "their",
    "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when", "where",
    "which", "while", "who", "whom", "why", "will", "with", "you", "your", "yours", "yourself",
    "yourselves",
    # Tech generic words
    "ai", "agent", "agents", "api", "apis", "app", "apps", "backend", "build", "cloud", "code",
    "commit", "commits", "core", "dashboard", "data", "deploy", "deployment", "deployments",
    "developer", "developers", "development", "devops", "docs", "documentation", "engine", "error",
    "errors", "fast", "feature", "features", "fix", "fixes", "frontend", "function", "functions",
    "github", "guide", "hosting", "infra", "infrastructure", "integration", "issue", "issues",
    "javascript", "js", "latest", "launch", "launches", "log", "logging", "logs", "major",
    "management", "metrics", "migration", "monitoring", "new", "news", "next", "notes", "open",
    "open-source", "opensource", "page", "pages", "performance", "platform", "platforms", "pr",
    "preview", "pricing", "problem", "production", "project", "projects", "pull", "quickstart",
    "readme", "release", "releases", "repo", "report", "repository", "request", "runtime", "saas",
    "scale", "scaling", "sdk", "sdks", "security", "server", "serverless", "service", "services",
    "site", "sites", "software", "source", "speed", "stack", "start", "storage", "summary",
    "support", "system", "systems", "tag", "tags", "team", "test", "testing", "tests", "tool",
    "tooling", "tools", "tracking", "ts", "tutorial", "typescript", "update", "updates", "upgrade",
    "upstream", "use", "user", "users", "v1", "v2", "version", "vs", "vulnerability", "web",
    "website", "week", "work", "worker", "workers", "world", "changelog", "blog",
}


def _extract_cve(text: str) -> Optional[str]:
    """Extract standard CVE identifier (e.g. CVE-2026-1234)."""
    m = re.search(r"\b(cve-\d{4}-\d{4,7})\b", text, re.IGNORECASE)
    return m.group(1).lower() if m else None


def _extract_arxiv_id(text: str) -> Optional[str]:
    """Extract standard arXiv paper identifier (e.g. 2401.12345 or arxiv:2401.12345)."""
    m = re.search(r"(?:arxiv\.org/(?:abs|pdf)/|arxiv:\s*)(\d{4}\.\d{4,5}(?:v\d+)?)", text, re.IGNORECASE)
    if m:
        return f"arxiv_{m.group(1).lower()}"
    return None


def _extract_version_tag(text: str) -> Optional[str]:
    """
    Extract specific semantic or date-based version tags (e.g. v1.20260815.0, v15.2.0, 3.4.1).
    Avoids trivial single-digit 'v1' or 'v2'.
    """
    m = re.search(r"\b(?:v)?(\d+\.\d+(?:\.\d+)?(?:[a-zA-Z0-9_\-\.]*)?)\b", text)
    if m:
        val = m.group(1).lower().strip(".")
        if "." in val and not val.endswith("."):
            return f"ver_{val}"
    return None


def _extract_github_repo_and_item(url: str, title: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract github repository (e.g. 'cloudflare/workerd') and specific issue/PR/commit/release/branch.
    """
    m_repo = re.search(r"github\.com/([a-zA-Z0-9_\-]+/[a-zA-Z0-9_\-\.]+)", url, re.IGNORECASE)
    if not m_repo:
        return None, None
    
    repo = m_repo.group(1).lower()

    # 1. Issue or PR number
    m_num = re.search(r"github\.com/[^/]+/[^/]+/(?:issues|pull)/(\d+)", url, re.IGNORECASE)
    if m_num:
        return repo, f"{repo}#num_{m_num.group(1)}"

    # 2. Release tag
    m_rel = re.search(r"github\.com/[^/]+/[^/]+/releases/tag/([^/?#]+)", url, re.IGNORECASE)
    if m_rel:
        return repo, f"{repo}#tag_{m_rel.group(1).lower()}"

    # 3. Release mentioned in title
    m_title_rel = re.search(r"Release in [^:]+:\s*([^\s]+)", title, re.IGNORECASE)
    if m_title_rel:
        return repo, f"{repo}#tag_{m_title_rel.group(1).lower()}"

    # 4. Specific Issue title in title string
    # e.g., "Issue labeled in vercel/ai: Security: no working private channel..."
    m_issue_title = re.search(r"Issue (?:labeled|opened|closed|reopened) in [^:]+:\s*(.+)$", title, re.IGNORECASE)
    if m_issue_title:
        issue_clean = re.sub(r"[^a-zA-Z0-9]+", "_", m_issue_title.group(1).strip().lower())
        if len(issue_clean) > 8:
            return repo, f"{repo}#issue_{issue_clean[:40]}"

    # 5. Specific branch created
    m_branch = re.search(r"Created branch ([^\s]+) in", title, re.IGNORECASE)
    if m_branch:
        return repo, f"{repo}#branch_{m_branch.group(1).lower()}"

    # 6. Specific Push Event to exact branch/repo within narrow timeframe
    if "push to" in title.lower():
        return repo, f"{repo}#push"

    return repo, None


def _normalize_title_headline(title: str) -> str:
    """Normalize news/announcement headlines to detect exact identical multi-source syndications."""
    clean = re.sub(r"\s*-\s*(?:Vercel|Netlify|Cloudflare|The Hacker News|InfoQ|Dev\.to|Reddit).*$", "", title, flags=re.IGNORECASE)
    clean = re.sub(r"[^a-zA-Z0-9]+", " ", clean).strip().lower()
    return clean


def _extract_distinct_feature_initiative(title: str, url: str) -> Optional[str]:
    """
    Extract specific, highly distinctive initiative/tool names (e.g. 'is-agentic.com', 'kitesurf', 'spectre attack').
    """
    combined = f"{title} {url}".lower()

    # 1. Custom dedicated domain (e.g. is-agentic.com)
    parsed = urlparse(url)
    domain = parsed.netloc.lower().replace("www.", "")
    if domain and domain not in PUBLISHER_AND_GENERIC_DOMAINS and "." in domain:
        base = domain.split(".")[0]
        base_clean = re.sub(r"[^a-z0-9]+", "_", base)
        if len(base_clean) >= 4 and base_clean not in GENERIC_STOPWORDS:
            return f"initiative_{base_clean}"

    # 2. Specific named products/initiatives
    named_initiatives = [
        "is-agentic", "is_agentic", "kitesurf", "webvm", "spectre attack",
        "spectre v2", "fluid compute", "deployment storage"
    ]
    for init in named_initiatives:
        if init in combined:
            slug = re.sub(r"[^a-z0-9]+", "_", init)
            return f"initiative_{slug}"

    return None


def _should_merge_signals(sig1: Dict[str, Any], sig2: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Strict guardrail evaluation: Determine whether two signals describe the exact same real-world business event.
    Returns (True, reason) or (False, reason).
    
    Guardrail rules:
    - Company must match strictly.
    - Must share at least one specific, checkable anchor:
      1. Exact same CVE identifier.
      2. Exact same GitHub release tag (e.g. cloudflare/workerd#tag_v1.20260815.0).
      3. Exact same GitHub Issue / PR / branch item.
      4. Exact same news headline across syndicated outlets (e.g. Spectre Attack disclosure).
      5. Exact same distinct product initiative (e.g. 'is-agentic' launch, 'kitesurf' browser engine).
      6. Direct cross-reference: one source URL cited directly in the other.
    - Company website changelogs with different feature titles NEVER merge.
    - Reddit/Tech media articles about different topics NEVER merge.
    - Generic keyword or company-level co-occurrence is strictly rejected.
    """
    comp1 = str(sig1.get("company", "")).strip().lower()
    comp2 = str(sig2.get("company", "")).strip().lower()
    if comp1 != comp2 or not comp1:
        return False, "Different companies"

    t1 = sig1.get("title", "")
    t2 = sig2.get("title", "")
    t1_lower = t1.lower()
    t2_lower = t2.lower()
    url1 = sig1.get("url", "").strip()
    url2 = sig2.get("url", "").strip()

    # Rule 1: WatchEvent / ForkEvent summaries on different repos or different dates NEVER merge with each other or with other events
    is_wf_1 = "started watching" in t1_lower or "forked" in t1_lower
    is_wf_2 = "started watching" in t2_lower or "forked" in t2_lower
    if is_wf_1 or is_wf_2:
        if is_wf_1 and is_wf_2 and url1 == url2 and t1_lower == t2_lower:
            return True, "Identical repo watch/fork aggregation"
        return False, "Watch/Fork event cannot merge with different event"

    # Rule 2: Direct URL cross-referencing
    if url1 and url1 in sig2.get("raw_excerpt", ""):
        return True, f"Signal 2 directly references Signal 1 URL ({url1})"
    if url2 and url2 in sig1.get("raw_excerpt", ""):
        return True, f"Signal 1 directly references Signal 2 URL ({url2})"

    # Rule 3: CVE Match
    cve1 = _extract_cve(f"{t1} {sig1.get('raw_excerpt', '')}")
    cve2 = _extract_cve(f"{t2} {sig2.get('raw_excerpt', '')}")
    if cve1 and cve2 and cve1 == cve2:
        return True, f"Matching CVE: {cve1}"

    # Rule 3b: ArXiv Paper Match
    arxiv1 = _extract_arxiv_id(f"{url1} {t1} {sig1.get('raw_excerpt', '')}")
    arxiv2 = _extract_arxiv_id(f"{url2} {t2} {sig2.get('raw_excerpt', '')}")
    if arxiv1 and arxiv2 and arxiv1 == arxiv2:
        return True, f"Matching arXiv paper ID: {arxiv1}"

    # Rule 4: GitHub Specific Item Match (Exact Release, PR, Issue, or Branch)
    repo1, item1 = _extract_github_repo_and_item(url1, t1)
    repo2, item2 = _extract_github_repo_and_item(url2, t2)
    if repo1 and repo2 and repo1 == repo2 and item1 and item2 and item1 == item2:
        return True, f"Matching GitHub item: {item1}"

    # Rule 5: Cross-Source Release Match (GitHub Release + News Article announcing the same release)
    # e.g. "GitHub Release in cloudflare/workerd: v1.20260815.0" + "Workerd v1.20260815.0 Released"
    v1 = _extract_version_tag(t1)
    v2 = _extract_version_tag(t2)
    if v1 and v2 and v1 == v2:
        # Check if project name also matches in title/url
        if repo1 and repo2:
            if repo1 == repo2:
                return True, f"Matching version on same repository: {repo1} {v1}"
        else:
            # Cross-source (news + github): check for shared project name token
            words1 = set(re.findall(r"\b[a-zA-Z0-9_\-]{4,}\b", t1_lower)) - GENERIC_STOPWORDS
            words2 = set(re.findall(r"\b[a-zA-Z0-9_\-]{4,}\b", t2_lower)) - GENERIC_STOPWORDS
            if words1.intersection(words2):
                return True, f"Cross-source version announcement: {v1}"

    # Rule 6: Identical Syndicated Headline (e.g. same news article published across TheHackerNews and Vulners)
    norm_head1 = _normalize_title_headline(t1)
    norm_head2 = _normalize_title_headline(t2)
    if len(norm_head1) >= 20 and norm_head1 == norm_head2:
        return True, f"Identical syndicated headline: '{t1}'"

    # Rule 7: Distinct Specific Initiative / Tool Launch (e.g. 'is-agentic.com', 'kitesurf')
    init1 = _extract_distinct_feature_initiative(t1, url1)
    init2 = _extract_distinct_feature_initiative(t2, url2)
    if init1 and init2 and init1 == init2:
        return True, f"Shared distinct initiative launch: {init1}"

    return False, "No shared specific checkable anchor"


def _generate_signal_id(company: str, source: str, url: str, title: str, published_at: str) -> str:
    """Generate deterministic signal identifier matching schema and storage layer."""
    raw = f"{company.strip()}::{source.strip()}::{url.strip()}::{title.strip()}::{str(published_at).strip()}"
    return "sig_" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _get_root_signal_id(company: str, signals: List[Dict[str, Any]]) -> str:
    """
    Find the earliest detected contributing signal in the cluster as the immutable root anchor.
    Breaks ties deterministically by signal ID.
    """
    sig_tuples = []
    for s in signals:
        s_comp = s.get("company", company).strip()
        sig_id = s.get("id") or _generate_signal_id(
            s_comp, s.get("source", ""), s.get("url", ""), s.get("title", ""), s.get("published_at", "")
        )
        # Ensure signal dictionary itself contains the canonical ID
        if not s.get("id"):
            s["id"] = sig_id
        pub = str(s.get("published_at") or "9999-99-99")
        sig_tuples.append((pub, sig_id))
    sig_tuples.sort(key=lambda x: (x[0], x[1]))
    return sig_tuples[0][1]


def _generate_event_id(company: str, signals: List[Dict[str, Any]]) -> str:
    """
    Generate immutable, order-independent event identifier anchored on earliest root signal.
    Guarantees event stability across future runs and scheduling evolution.
    """
    root_sig = _get_root_signal_id(company, signals)
    return "evt_" + root_sig.replace("sig_", "")


def _build_canonical_event(company: str, cluster: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build a unified, consolidated Event record from a cluster of one or more signals.
    Preserves all raw signals in full.
    """
    sorted_signals = sorted(
        cluster,
        key=lambda s: s.get("published_at") or "9999-99-99",
    )

    contributing_sources = sorted(list(set(s.get("source", "unknown") for s in cluster)))
    source_urls = [s.get("url", "") for s in cluster if s.get("url")]
    corroboration_count = len(cluster)

    timestamps = [s.get("published_at") for s in cluster if s.get("published_at")]
    first_detected = min(timestamps) if timestamps else None
    latest_detected = max(timestamps) if timestamps else None
    published_at = latest_detected or first_detected or datetime.now(timezone.utc).isoformat()

    def _title_priority(s: Dict[str, Any]) -> int:
        src = s.get("source", "")
        title = s.get("title", "")
        prio = 0
        if src == "news":
            prio += 20
        if "release" in title.lower() or "shipped" in title.lower() or "introduces" in title.lower():
            prio += 10
        if not ("started watching" in title.lower() or "forked" in title.lower()):
            prio += 5
        return prio

    best_signal = max(cluster, key=_title_priority)
    canonical_title = best_signal.get("title", "Consolidated Business Event")
    canonical_url = best_signal.get("url", source_urls[0] if source_urls else "")

    excerpts: List[str] = []
    for idx, s in enumerate(sorted_signals, 1):
        src_type = s.get("source", "source")
        s_title = s.get("title", "")
        s_pub = s.get("published_at", "")
        s_text = s.get("raw_excerpt", "")
        excerpts.append(f"[{src_type.upper()} ({s_pub})]: {s_title} — {s_text}")

    combined_excerpt = "\n\n".join(excerpts)
    event_id = _generate_event_id(company, cluster)

    return {
        "event_id": event_id,
        "company": company,
        "title": canonical_title,
        "event_summary": canonical_title,
        "corroboration_count": corroboration_count,
        "contributing_sources": contributing_sources,
        "first_detected_at": first_detected,
        "latest_detected_at": latest_detected,
        "published_at": published_at,
        "url": canonical_url,
        "source_urls": source_urls,
        "raw_excerpt": combined_excerpt,
        "raw_signals": cluster,
    }


def consolidate_signals(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Consolidate raw signals into multi-source Event records.
    
    1. Groups signals strictly by target company.
    2. Clusters signals that share verifiable event anchors (version tags, CVEs, product slugs, cross-links).
    3. Standalone signals remain as single-signal events (corroboration_count: 1).
    4. Guarantees 100% signal preservation: sum(len(e['raw_signals']) for e in events) == len(signals).
    5. Returns consolidated Event list.
    """
    if not signals:
        return []

    by_company: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for s in signals:
        comp = s.get("company", "Unknown").strip()
        by_company[comp].append(s)

    consolidated_events: List[Dict[str, Any]] = []

    for comp, comp_signals in by_company.items():
        n = len(comp_signals)
        parent = list(range(n))

        def find(i: int) -> int:
            if parent[i] == i:
                return i
            parent[i] = find(parent[i])
            return parent[i]

        def union(i: int, j: int) -> None:
            root_i = find(i)
            root_j = find(j)
            if root_i != root_j:
                parent[root_i] = root_j

        for i in range(n):
            for j in range(i + 1, n):
                should_merge, reason = _should_merge_signals(comp_signals[i], comp_signals[j])
                if should_merge:
                    logger.debug(f"Merging signals ({comp}): [{comp_signals[i].get('title')}] + [{comp_signals[j].get('title')}] Reason: {reason}")
                    union(i, j)

        clusters: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        for i in range(n):
            root = find(i)
            clusters[root].append(comp_signals[i])

        for cluster in clusters.values():
            event = _build_canonical_event(comp, cluster)
            consolidated_events.append(event)

    consolidated_events.sort(
        key=lambda e: e.get("published_at") or "0000-00-00",
        reverse=True,
    )

    total_preserved_signals = sum(len(e.get("raw_signals", [])) for e in consolidated_events)
    if total_preserved_signals != len(signals):
        raise ValueError(
            f"Consolidation invariant violation: input had {len(signals)} signals, but consolidated events contain {total_preserved_signals} signals."
        )

    return consolidated_events


def run(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Entrypoint for Event Consolidator."""
    logger.info(f"Starting Event Consolidation on {len(signals)} raw signals...")
    events = consolidate_signals(signals)
    multi_corroborated = [e for e in events if e.get("corroboration_count", 1) > 1]
    logger.info(
        f"Consolidated {len(signals)} raw signals into {len(events)} Events ({len(multi_corroborated)} multi-source corroborated events)."
    )
    return events
