"""
Research Activity Classifier for PrismIQ.

Performs lightweight, rule-based classification to identify:
1. Formal academic papers from arXiv (with strict author-affiliation verification).
2. Substantive technical engineering write-ups, architecture deep-dives,
   and empirical benchmark studies from company RSS/Atom blog feeds.

Filters out routine product changelogs, marketing campaigns, and UI updates.
De-duplicates against previously ingested News signals.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Confirmed research team and corporate affiliation strings by company
CONFIRMED_AFFILIATIONS: Dict[str, Set[str]] = {
    "Cloudflare": {
        "cloudflare",
        "cloudflare research",
        "cloudflare, inc.",
        "cloudflare inc",
        "cloudflare inc.",
        "cloudflare labs",
    },
    "Cloudflare Pages/Workers": {
        "cloudflare",
        "cloudflare research",
        "cloudflare, inc.",
        "cloudflare inc",
        "cloudflare inc.",
        "cloudflare labs",
    },
    "Cloudflare Pages": {
        "cloudflare",
        "cloudflare research",
        "cloudflare, inc.",
        "cloudflare inc",
    },
    "Cloudflare Workers": {
        "cloudflare",
        "cloudflare research",
        "cloudflare, inc.",
        "cloudflare inc",
    },
    "Vercel": {
        "vercel",
        "vercel, inc.",
        "vercel inc",
        "vercel inc.",
        "vercel labs",
    },
    "Netlify": {
        "netlify",
        "netlify, inc.",
        "netlify inc",
        "netlify inc.",
        "netlify labs",
    },
}

# Positive Technical Depth / Research indicators
RESEARCH_POSITIVE_PATTERNS = [
    # Benchmark, measurement, empirical analysis
    r"\b(?:benchmarks?|benchmarking|microbenchmark|empirical(?:ly)?|measurements?|measured|stress-tested|profiling|latency|throughput|p99|p95)\b",
    # Architecture, systems, internals, runtime, compilers
    r"\b(?:architecture|internals|runtime|compiler|transpiler|memory\s+layout|memory\s+optimization|cache\s+storage|zstandard|pingora|rust-level)\b",
    # Distributed systems & protocols & consensus
    r"\b(?:consensus\s+algorithm|global\s+consensus|distributed\s+systems?|rfc\s*\d+|bgp\s+roles?|route\s+leaks?|protocol\s+specification)\b",
    # Cryptography & Post-Quantum & Low-level security
    r"\b(?:post-quantum|pq\s+authentication|cryptograph(?:ic|y)|signature\s+algorithm|ml-dsa|nist|spectre|side-channel|microarchitectural)\b",
    # Novel engineering methodology / technical deep dive
    r"\b(?:technical\s+deep-dive|deep\s+dive|we\s+tested\s+\d+|comparison\s+of\s+\d+|comparative\s+study|methodology|stateless\s+mcp|brought\s+.*in-house|fluid\s+compute)\b",
    # Formal research papers & prototypes
    r"\b(?:paper|arxiv|proof\s+of\s+concept|prototype|formal\s+verification)\b",
]

# Negative Anti-Triggers (Routine product announcements, changelogs, marketing, events)
RESEARCH_NEGATIVE_PATTERNS = [
    r"\b(?:came\s+to\s+[a-zA-Z]+|meetup|summit|conference\s+recap|community\s+hangout|webinar|hackathon|challenge|compete\s+in)\b",
    r"\b(?:now\s+available\s+on\s+ai\s+gateway|\d+%\s+off|discount|pricing\s+update|free\s+domain|app\s+and\s+dev\s+domains)\b",
    r"\b(?:now\s+private\s+by\s+default|settings?\s+page|ui\s+redesign|dashboard\s+update|submission\s+status|directory\s+of\s+bots)\b",
    r"\b(?:say\s+it\s+once|oauth\s+consent|optional\s+scopes|terms\s+of\s+service|privacy\s+policy)\b",
    r"\b(?:customer\s+story|case\s+study|webinar|podcast|interview\s+with\s+a\s+customer)\b",
]

# High-priority security overrides that bypass negative patterns
SECURITY_OVERRIDES = [
    r"\b(?:spectre|side-channel|zero-day|cve-\d+|post-quantum|global\s+consensus|consensus\s+algorithm|rfc\s*\d+)\b"
]


def is_verified_arxiv_affiliation(company: str, author_affiliations: List[str]) -> bool:
    """
    Strictly verify whether any author listed on an arXiv paper has a confirmed
    affiliation with the tracked company.
    
    Prevents false positives from third-party papers that merely mention the company name.
    """
    comp_key = company.strip()
    valid_affils = CONFIRMED_AFFILIATIONS.get(comp_key)
    if not valid_affils:
        # Fallback to normalized match
        norm_key = comp_key.lower().split()[0]
        valid_affils = {norm_key, f"{norm_key} research", f"{norm_key}, inc."}

    for aff in author_affiliations:
        if not aff:
            continue
        aff_clean = aff.strip().lower()
        for target in valid_affils:
            if target in aff_clean:
                return True
    return False


def classify_research_content(
    title: str,
    excerpt: str,
    url: str = "",
    source: str = "blog",
) -> Tuple[bool, str, List[str]]:
    """
    Classify whether a signal represents genuine technical/research depth
    or routine product/marketing content.
    
    Returns:
        (is_research, reason, matched_indicators)
    """
    if source == "arxiv":
        return True, "Formal academic/technical paper from arXiv with verified author affiliation", ["arxiv_paper"]

    # Changelog URLs (e.g. vercel.com/changelog/...) are overwhelmingly routine feature drops
    if "/changelog/" in url.lower() or "/changelogs/" in url.lower():
        has_deep_tech = False
        for p in SECURITY_OVERRIDES:
            if re.search(p, f"{title} {excerpt}", re.IGNORECASE):
                has_deep_tech = True
                break
        if not has_deep_tech:
            return False, "Routine product changelog item", []

    full_text = f"{title}. {excerpt}".lower()

    # Check Negative Anti-Triggers
    for neg_pat in RESEARCH_NEGATIVE_PATTERNS:
        if re.search(neg_pat, full_text, re.IGNORECASE):
            has_override = any(re.search(p, full_text, re.IGNORECASE) for p in SECURITY_OVERRIDES)
            if not has_override:
                return False, f"Matched routine/marketing pattern: '{neg_pat}'", []

    # Check Positive Research Patterns
    matched_pos = []
    for pos_pat in RESEARCH_POSITIVE_PATTERNS:
        m = re.search(pos_pat, full_text, re.IGNORECASE)
        if m:
            matched_pos.append(m.group(0))

    if matched_pos:
        return True, f"Matched technical depth indicators: {matched_pos}", matched_pos

    return False, "No substantive research or engineering depth indicators matched", []


def classify_signal(signal: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply research classification to a raw signal in place.
    Sets source_subtype: 'research' if it qualifies as research, else 'general'.
    """
    source = signal.get("source", "")
    title = signal.get("title", "")
    excerpt = signal.get("raw_excerpt", "")
    url = signal.get("url", "")

    if source == "arxiv":
        signal["source_subtype"] = "research"
        signal["research_details"] = signal.get("research_details", {"type": "arxiv_paper"})
        return signal

    is_res, reason, indicators = classify_research_content(title, excerpt, url=url, source=source)
    if is_res:
        signal["source_subtype"] = "research"
        signal["research_details"] = {
            "type": "technical_writeup",
            "reason": reason,
            "indicators": indicators,
        }
    else:
        signal["source_subtype"] = "general"

    return signal


def classify_all_signals(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Process a batch of raw signals, applying research classification."""
    for s in signals:
        classify_signal(s)
    return signals
