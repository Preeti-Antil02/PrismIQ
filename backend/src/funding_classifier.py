"""
Lightweight Funding-Event Classifier for News Signals.

Performs rule-based classification on collected News signals to identify
venture funding rounds, capital raises, and valuation events without adding
a new external data source.

Publicly traded companies (e.g. Cloudflare) are skipped.
"""

import re
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Companies that are publicly traded and do not undergo venture funding rounds
PUBLIC_COMPANIES = {
    "cloudflare",
    "cloudflare pages",
    "cloudflare workers",
    "cloudflare pages/workers",
}

# Regex patterns for venture funding identification
AMOUNT_PATTERN = r"(?:\$[\d\.]+\s*(?:billion|million|b|m)\b|\b\d+(?:\.\d+)?\s*(?:million|billion)\s*dollars?\b|€[\d\.]+\s*(?:million|billion|m|b)\b|£[\d\.]+\s*(?:million|billion|m|b)\b)"
SERIES_PATTERN = r"\b(?:seed(?:\s+round|\s+funding)?|pre-seed|series\s+[a-g]|growth\s+round|funding\s+round|venture\s+round|angel\s+round)\b"
RAISE_VERBS = r"\b(?:raises?|raised|securing|secures|secured|closes?|closed|bagging|bags|bagged|landing|lands|landed|nabbing|nabs|nabbed|pulls\s+in|pulled\s+in)\b"
VALUATION_PATTERN = r"(?:(?:valued\s+at|valuation\s+of)\s+" + AMOUNT_PATTERN + r"|" + AMOUNT_PATTERN + r"\s+(?:post-money\s+|pre-money\s+)?valuation)"

# Anti-trigger patterns for false-positive prevention
NEGATIVE_PATTERNS = [
    r"\b(?:per\s+(?:month|gb|hour|member|user|seat|year|project|1k|1m))\b",
    r"\b(?:billed\s+at|pricing\s+plan|subscription\s+fee|usage\s+credit)\b",
    r"\b(?:quarterly\s+(?:revenue|earnings|results)|q[1-4]\s+(?:revenue|earnings|results)|annual\s+revenue|arr)\b",
    r"\b(?:etf\s+inflow|shares\s+outstanding|market\s+cap|stock\s+jumped|shares\s+rose|nyse|nasdaq)\b",
    r"\b(?:bug\s+bounty|bounty\s+payout|grant\s+program|donation)\b",
    r"\b(?:fine|fined|penalty|penalties|settlement|lawsuit|antitrust\s+fine)\b",
    r"\b(?:acquires|acquired|acquisition\s+of|bought\s+for\s+" + AMOUNT_PATTERN + r")\b",
]


def is_public_company(company: str) -> bool:
    """Check if company is known to be publicly traded."""
    return company.strip().lower() in PUBLIC_COMPANIES


def extract_funding_details(text: str) -> Dict[str, Optional[str]]:
    """Extract structured funding details (amount, round, valuation) if present."""
    amount_match = re.search(AMOUNT_PATTERN, text, re.IGNORECASE)
    amount = amount_match.group(0) if amount_match else None

    round_match = re.search(SERIES_PATTERN, text, re.IGNORECASE)
    round_type = round_match.group(0).title() if round_match else None

    valuation_match = re.search(VALUATION_PATTERN, text, re.IGNORECASE)
    valuation = valuation_match.group(0) if valuation_match else None

    return {
        "amount": amount,
        "round_type": round_type,
        "valuation": valuation,
    }


def classify_news_text(company: str, title: str, excerpt: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Classify whether a news article text reports a genuine funding round.
    
    Returns:
        (is_funding_related, funding_details)
    """
    # 1. Skip publicly traded entities
    if is_public_company(company):
        return False, None

    combined_text = f"{title}. {excerpt}".strip()
    text_lower = combined_text.lower()

    # 2. Check for negative anti-triggers (pricing, revenue, acquisitions, ETF, fines)
    # Only block if there is a strong negative pattern and no unambiguous Series/Round indicator
    has_series = bool(re.search(SERIES_PATTERN, text_lower))
    for neg_pat in NEGATIVE_PATTERNS:
        if re.search(neg_pat, text_lower, re.IGNORECASE):
            # If it's a pricing/revenue/fine mention without an explicit Series A/B/C or funding round keyword, reject
            if not has_series or "per month" in text_lower or "billed at" in text_lower or "bug bounty" in text_lower:
                return False, None

    # 3. Rule matching:
    # Rule A: Explicit funding round (e.g. "Series B", "Seed round") paired with raise verb or dollar amount or "funding"
    if has_series:
        if re.search(AMOUNT_PATTERN, combined_text, re.IGNORECASE) or re.search(RAISE_VERBS, text_lower) or "funding" in text_lower or "raise" in text_lower:
            details = extract_funding_details(combined_text)
            return True, details

    # Rule B: Raise verb paired with explicit dollar amount and funding context
    has_raise_verb = bool(re.search(RAISE_VERBS, text_lower))
    has_amount = bool(re.search(AMOUNT_PATTERN, combined_text, re.IGNORECASE))
    has_funding_keyword = any(k in text_lower for k in ["funding", "valuation", "investors", "venture capital", "capital raise"])

    if has_raise_verb and has_amount and has_funding_keyword:
        details = extract_funding_details(combined_text)
        return True, details

    # Rule C: Explicit valuation announcement paired with dollar amount and company
    if re.search(VALUATION_PATTERN, combined_text, re.IGNORECASE) and has_funding_keyword:
        details = extract_funding_details(combined_text)
        return True, details

    return False, None


def classify_signal(signal: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply funding classification to a raw signal in place.
    Only modifies News signals; sets funding_related and source_subtype.
    """
    if signal.get("source") != "news":
        signal["funding_related"] = False
        return signal

    company = signal.get("company", "")
    title = signal.get("title", "")
    excerpt = signal.get("raw_excerpt", "")

    is_funding, details = classify_news_text(company, title, excerpt)

    signal["funding_related"] = is_funding
    if is_funding:
        signal["source_subtype"] = "funding"
        signal["funding_details"] = details
    else:
        signal["source_subtype"] = "general"

    return signal


def classify_all_news_signals(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Process a batch of raw signals, classifying all news signals."""
    for s in signals:
        classify_signal(s)
    return signals
