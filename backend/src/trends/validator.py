"""
Label and summary validation for trend clusters.
Enforces strict neutrality, scope bounds, and leak prevention:
1. Cluster labels must be 3-6 words, contain zero company names, and zero causation words.
2. Tenant summaries must be 1-2 sentences, contain zero unverified causation assertions,
   and mention ONLY company names visible to that specific tenant.
3. If validation fails, fails closed to 'unlabelled' (never persists filler or hallucinated text).
"""
import re
from typing import Set, Tuple, Optional, List

# Explicitly banned causation phrases unless backed by stored citation
BANNED_CAUSATION_TERMS: List[str] = [
    r"\bbecause\b",
    r"\bin response to\b",
    r"\breacted to\b",
    r"\bretaliated\b",
    r"\bcountered by\b",
    r"\bdue to\b",
    r"\bas a result of\b",
    r"\bsparked by\b",
    r"\btriggered by\b",
]

# Common generic filler phrases rejected
BANNED_FILLER_PHRASES: List[str] = [
    r"\bstrategic momentum\b",
    r"\bindustry developments\b",
    r"\bongoing product and operational activity\b",
    r"\bactive commercial positioning\b",
    r"\bcompetitive pressure\b",
]


def count_words(text: str) -> int:
    """Return clean word count."""
    return len(text.strip().split())


def validate_cluster_label(
    label: Optional[str],
    all_known_companies: Optional[Set[str]] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Validate global cluster label.
    
    Hard constraints:
    - Must be 3 to 6 words.
    - Global label must contain ZERO company names (labels describe technology/trend, not entities).
    - Must contain ZERO causation words or generic filler.
    
    Returns:
        (is_valid, validated_or_fallback_label, failure_reason)
        If invalid, validated_or_fallback_label is strictly 'unlabelled'.
    """
    if not label or not label.strip():
        return False, "unlabelled", "empty_label"

    clean = label.strip()
    words = clean.split()
    if len(words) < 3:
        return False, "unlabelled", f"too_short_{len(words)}_words"
    if len(words) > 6:
        return False, "unlabelled", f"too_long_{len(words)}_words"

    lower = clean.lower()

    # Check causation words
    for pat in BANNED_CAUSATION_TERMS:
        if re.search(pat, lower):
            return False, "unlabelled", f"causation_word_detected: {pat}"

    # Check generic filler
    for pat in BANNED_FILLER_PHRASES:
        if re.search(pat, lower):
            return False, "unlabelled", f"filler_phrase_detected: {pat}"

    # Check company names in global label
    if all_known_companies:
        for comp in all_known_companies:
            comp_clean = comp.strip().lower()
            if len(comp_clean) >= 3:
                # Match company with word boundary
                pattern = rf"\b{re.escape(comp_clean)}\b"
                if re.search(pattern, lower):
                    return False, "unlabelled", f"company_name_in_global_label: {comp}"

    return True, clean, None


def validate_tenant_summary(
    summary: Optional[str],
    visible_companies: Set[str],
    all_known_companies: Optional[Set[str]] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Validate tenant-scoped trend summary.
    
    Hard constraints:
    - 1 or 2 sentences max.
    - Zero causation words.
    - Every mentioned company MUST be in visible_companies for this tenant.
      Mentioning an un-tracked competitor is a cross-tenant data leak and fails closed.
      
    Returns:
        (is_valid, validated_summary_or_empty, failure_reason)
    """
    if not summary or not summary.strip():
        return False, "", "empty_summary"

    clean = summary.strip()
    
    # Sentence count check (split on periods, exclamation marks, question marks followed by space or end)
    sentences = [s.strip() for s in re.split(r"[.!?]+(?:\s+|$)", clean) if s.strip()]
    if len(sentences) > 2:
        return False, "", f"too_many_sentences_{len(sentences)}"

    lower = clean.lower()

    # Causation check
    for pat in BANNED_CAUSATION_TERMS:
        if re.search(pat, lower):
            return False, "", f"causation_word_detected: {pat}"

    # Tenant company visibility check (leak prevention)
    if all_known_companies:
        vis_lower = {c.strip().lower() for c in visible_companies}
        for comp in all_known_companies:
            comp_lower = comp.strip().lower()
            if len(comp_lower) >= 3 and comp_lower not in vis_lower:
                pattern = rf"\b{re.escape(comp_lower)}\b"
                if re.search(pattern, lower):
                    return False, "", f"cross_tenant_leak_forbidden_company: {comp}"

    return True, clean, None
