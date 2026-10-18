"""
Canonical company key resolution and entity alias management.
Data-driven mappings, casing reconciliation, and global entity exclusion filtering.
"""
from typing import Dict, Optional, Set, Tuple

# Quarantined or noise entities that must be excluded at event level
DEFAULT_QUARANTINED_ENTITIES: Set[str] = {
    "place",
    "carousel",
    "segment",
    "amazon (india)",
    "amazon india",
}

# Known alias mappings: normalized alias -> canonical key
# Maps child services or common variants to canonical parent entities
DEFAULT_COMPANY_ALIASES: Dict[str, str] = {
    "google": "Google",
    "google cloud": "Google",
    "gcp": "Google",
    "google llc": "Google",
    "alphabet": "Google",
    "openai": "OpenAI",
    "open ai": "OpenAI",
    "openai ai hub": "OpenAI",
    "microsoft": "Microsoft",
    "microsoft azure": "Microsoft",
    "azure": "Microsoft",
    "msft": "Microsoft",
    "amazon": "Amazon",
    "aws": "Amazon",
    "amazon web services": "Amazon",
    "cloudflare": "Cloudflare",
    "cloudflare pages/workers": "Cloudflare",
    "cloudflare workers": "Cloudflare",
    "cloudflare pages": "Cloudflare",
    "vercel": "Vercel",
    "netlify": "Netlify",
    "anthropic": "Anthropic",
    "meta": "Meta",
    "meta platforms": "Meta",
    "facebook": "Meta",
    "flipkart": "Flipkart",
    "meesho": "Meesho",
    "nvidia": "NVIDIA",
    "oracle": "Oracle",
    "stripe": "Stripe",
    "apple": "Apple",
}


def normalize_entity_name(name: Optional[str]) -> str:
    """Normalize company name string for consistent matching."""
    if not name:
        return ""
    return " ".join(name.strip().lower().split())


def is_quarantined_entity(name: Optional[str], quarantined_set: Optional[Set[str]] = None) -> bool:
    """
    Check if an entity name matches known quarantined or noise entities.
    Case-insensitive exact or substring match.
    """
    if not name:
        return False
    norm = normalize_entity_name(name)
    q_set = quarantined_set if quarantined_set is not None else DEFAULT_QUARANTINED_ENTITIES
    for q in q_set:
        if norm == q or q in norm:
            return True
    return False


def resolve_canonical_company(
    name: Optional[str],
    aliases: Optional[Dict[str, str]] = None,
    quarantined_set: Optional[Set[str]] = None
) -> Tuple[Optional[str], bool]:
    """
    Resolve a raw company string to its canonical entity name.
    
    Returns:
        (canonical_name, is_excluded)
        If the company is quarantined/excluded, returns (None, True).
        If unresolved, returns the cleaned title-cased name, False.
    """
    if not name:
        return None, True

    norm = normalize_entity_name(name)
    if not norm:
        return None, True

    if is_quarantined_entity(norm, quarantined_set):
        return None, True

    alias_map = aliases if aliases is not None else DEFAULT_COMPANY_ALIASES
    canonical = alias_map.get(norm)
    if canonical:
        return canonical, False

    # Title-case clean fallback if unmapped but not quarantined
    return name.strip(), False
