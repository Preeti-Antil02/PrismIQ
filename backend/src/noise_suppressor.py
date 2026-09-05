"""
Noise Suppressor for PrismIQ.

Runs upstream of Event Consolidation to filter out true raw noise that carries zero
competitive intelligence value (e.g. automated bot reviews, lockfile bumps, isolated
single-star events, documentation typos).

Governing Principle:
Conservative suppression ("False suppression is worse than missed suppression").
When uncertain, signals are preserved.
"""

import logging
import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Canonical Noise Categories
CAT_BOT_DEPENDENCY = "bot_and_dependency_bumps"
CAT_CI_DOC_FORMATTING = "ci_and_doc_formatting"
CAT_ISOLATED_SOCIAL = "isolated_github_social_noise"
CAT_PLACEHOLDER_JOB = "placeholder_job_postings"

NOISE_CATEGORIES = [
    CAT_BOT_DEPENDENCY,
    CAT_CI_DOC_FORMATTING,
    CAT_ISOLATED_SOCIAL,
    CAT_PLACEHOLDER_JOB,
]

# 1. Whitelist / Anti-Trigger Patterns (NEVER Suppress)
SECURITY_WHITELIST_PATTERNS = [
    r"\bcve-\d{4}-\d+\b",
    r"\bspectre\b",
    r"\bside-channel\b",
    r"\bvulnerabilit(?:y|ies)\b",
    r"\bexploit\b",
    r"\bbreach\b",
    r"\bjwt\b",
    r"\bsecurity\b",
    r"\boutage\b",
    r"\bincident\b",
    r"\bmalicious\b",
    r"\bthreat\b",
    r"\battack\b",
    r"\bzero-day\b",
    r"\badvisory\b",
]

STRATEGIC_WHITELIST_PATTERNS = [
    r"\bagent(?:s|ic)?\b",
    r"\bis-agentic\b",
    r"\bkitesurf\b",
    r"\bbrowser\s+engine\b",
    r"\bruntime\b",
    r"\bcompiler\b",
    r"\bwasm\b",
    r"\brelease\s+v\b",
    r"\bv15\.",
    r"\bv2\.",
    r"\bpricing\b",
    r"\bfunding\b",
    r"\bpartnership\b",
    r"\bcoalition\b",
]

# Automated bot identifiers
KNOWN_BOT_IDENTIFIERS = [
    "dependabot[bot]",
    "renovate[bot]",
    "kodiakhq[bot]",
    "snyk-bot",
    "greenkeeper[bot]",
    "github-actions[bot]",
    "vercel[bot]",
    "ai-sdk-factory[bot]",
    "[bot]",
]

# Placeholder job posting indicators
PLACEHOLDER_JOB_PATTERNS = [
    r"\btest\s+posting\b",
    r"\bdo\s+not\s+apply\b",
    r"\bsample\s+job\b",
    r"\bdelete\s+me\b",
    r"\binternal\s+test\b",
]


def is_whitelisted(signal: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Check whether a signal triggers any safety whitelist / anti-trigger rule.
    Whitelisted signals are guaranteed never to be suppressed.
    """
    title = signal.get("title", "")
    excerpt = signal.get("raw_excerpt", "")
    full_text = f"{title} {excerpt}".lower()
    source = signal.get("source", "")

    # Security check (highest priority)
    for pat in SECURITY_WHITELIST_PATTERNS:
        if re.search(pat, full_text):
            return True, f"Security / vulnerability indicator matched pattern '{pat}'"

    # Strategic AI / product / release check
    for pat in STRATEGIC_WHITELIST_PATTERNS:
        if re.search(pat, full_text):
            return True, f"Strategic product / AI keyword matched pattern '{pat}'"

    # Preserved sources check
    if source == "pricing":
        return True, "Pricing source calibrated downstream"

    if source == "jobs":
        # Only placeholder jobs are suppressed; real jobs are whitelisted for downstream analysis
        if not any(re.search(pat, full_text) for pat in PLACEHOLDER_JOB_PATTERNS):
            return True, "Real job posting preserved for downstream analysis"

    if signal.get("funding_related") or signal.get("source_subtype") == "funding":
        return True, "Funding-classified news signal"

    if source == "research" or signal.get("source_subtype") == "research":
        return True, "Research-classified academic paper or technical engineering writeup"

    return False, ""


def classify_signal(signal: Dict[str, Any]) -> Tuple[bool, Optional[str], str]:
    """
    Classify whether a raw signal is noise or a viable candidate signal.
    
    Returns:
        (is_noise, noise_category, explanation)
    """
    # Step 1: Safety Whitelist Check
    whitelisted, whitelist_reason = is_whitelisted(signal)
    if whitelisted:
        return False, None, f"Preserved: {whitelist_reason}"

    title = signal.get("title", "").lower()
    excerpt = signal.get("raw_excerpt", "").lower()
    full_text = f"{title} {excerpt}"
    source = signal.get("source", "")

    # Step 2: Placeholder Job Postings
    if source == "jobs":
        for pat in PLACEHOLDER_JOB_PATTERNS:
            if re.search(pat, full_text):
                return True, CAT_PLACEHOLDER_JOB, f"Placeholder ATS test posting matching '{pat}'"

    # Step 3: Bot & Dependency Lockfile Bumps
    if any(bot in excerpt for bot in KNOWN_BOT_IDENTIFIERS):
        return True, CAT_BOT_DEPENDENCY, "Automated bot activity (PR review/comment/branch)"

    if any(dep in title for dep in ["dependabot/", "renovate/", "bump ", "update lockfile", "lockfile update"]):
        return True, CAT_BOT_DEPENDENCY, "Automated dependency or lockfile bump without functional feature"

    # Step 4: CI / Documentation / Formatting Tweaks
    if any(ci in title for ci in ["update readme", "fix typo", "ci: update", ".github/workflows", "update badge"]):
        return True, CAT_CI_DOC_FORMATTING, "CI configuration or documentation typo fix"

    # Step 5: Isolated Single-Star / Single-Fork Noise
    is_watch = "watchevent" in title or "started watching" in title
    is_fork = "forkevent" in title or "forked in" in title

    if is_watch:
        return True, CAT_ISOLATED_SOCIAL, "Isolated single GitHub WatchEvent (star)"

    if is_fork and "docs" in title:
        return True, CAT_ISOLATED_SOCIAL, "Isolated documentation repository ForkEvent"

    # Step 6: Default to Keep (Conservative Bias)
    return False, None, "Substantive candidate signal (Preserved)"


def filter_signals(signals: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Filter a list of raw signals into kept candidate signals and suppressed noise signals.
    
    Returns:
        (kept_signals, suppressed_signals)
    """
    kept: List[Dict[str, Any]] = []
    suppressed: List[Dict[str, Any]] = []

    for s in signals:
        is_noise, cat, reason = classify_signal(s)
        enriched = dict(s)
        enriched["is_noise"] = is_noise
        enriched["noise_category"] = cat
        enriched["noise_reason"] = reason

        if is_noise:
            suppressed.append(enriched)
        else:
            kept.append(enriched)

    return kept, suppressed


def run(signals: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Execute Noise Suppression on raw signals:
    1. Filters signals into kept vs suppressed.
    2. Categorizes suppressed signals.
    3. Produces audit metrics.
    
    Returns:
        Structured dictionary with kept_signals, suppressed_signals, and metrics.
    """
    kept, suppressed = filter_signals(signals)

    by_category: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in NOISE_CATEGORIES}
    for s in suppressed:
        cat = s.get("noise_category")
        if cat in by_category:
            by_category[cat].append(s)

    total_count = len(signals)
    suppressed_count = len(suppressed)
    kept_count = len(kept)
    suppression_rate = (suppressed_count / total_count * 100) if total_count > 0 else 0.0

    metrics = {
        "total_signals_in": total_count,
        "signals_kept": kept_count,
        "signals_suppressed": suppressed_count,
        "suppression_rate_pct": round(suppression_rate, 2),
        "suppressed_by_category": {cat: len(items) for cat, items in by_category.items()},
    }

    logger.info(
        f"Noise Suppression: {suppressed_count}/{total_count} signals suppressed "
        f"({suppression_rate:.1f}%), {kept_count} kept."
    )

    all_decisions: List[Dict[str, Any]] = []
    for s in (kept + suppressed):
        s_id = s.get("id")
        if s_id:
            all_decisions.append({
                "signal_id": s_id,
                "is_noise": s.get("is_noise", False),
                "noise_category": s.get("noise_category", "none"),
                "noise_reason": s.get("noise_reason", ""),
            })

    return {
        "kept_signals": kept,
        "suppressed_signals": suppressed,
        "by_category": by_category,
        "metrics": metrics,
        "decisions": all_decisions,
    }
