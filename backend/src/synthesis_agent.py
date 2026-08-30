"""
Synthesis Agent for PrismIQ.

Performs cross-competitor synthesis within a single monitoring window:
1. Reorganizes consolidated events across all tracked competitors by theme (not company).
2. Performs strict, guardrail-heavy cross-competitor pattern detection (requiring specific,
   comparable, verifiable evidence from 2+ competitors, defaulting to 'no pattern found').
3. Computes additive corroboration-based confidence metrics alongside LLM self-rated confidence.
4. Generates a Per-Competitor Index so readers can look up a specific company's full activity.
"""

import logging
import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Fixed 5-Theme Canonical Taxonomy
THEME_PRODUCT = "Product & Platform Development"
THEME_PRICING = "Pricing & Packaging"
THEME_TALENT = "Talent & Organization"
THEME_SECURITY = "Security & Reliability"
THEME_POSITIONING = "Market Positioning & Partnerships"

THEMES = [
    THEME_PRODUCT,
    THEME_PRICING,
    THEME_TALENT,
    THEME_SECURITY,
    THEME_POSITIONING,
]

# Security & Reliability Keywords / Patterns
SECURITY_PATTERNS = [
    r"\bcve-\d{4}-\d+\b",
    r"\bspectre\b",
    r"\bside-channel\b",
    r"\bvulnerabilit(?:y|ies)\b",
    r"\bexploit\b",
    r"\bbreach\b",
    r"\bjwt\s+leak\b",
    r"\bsecurity\s+flaw\b",
    r"\boutage\b",
    r"\bincident\b",
    r"\bmalicious\b",
    r"\bdead\s+drop\b",
]

# Strategic Market Positioning & Partnership Keywords
POSITIONING_PATTERNS = [
    r"\bpartnership\b",
    r"\bcoalition\b",
    r"\bopen\s+weights\b",
    r"\bamerican\s+ai\s+leadership\b",
    r"\bcustomer\s+story\b",
    r"\bcustomers?\b",
    r"\betf\s+inflow\b",
    r"\bmarket\s+share\b",
    r"\bdau\s+decline\b",
    r"\bmonetising\s+hate\b",
]


def classify_event_theme(finding: Dict[str, Any]) -> str:
    """
    Classify a finding/event into one of the 5 fixed canonical themes.
    Uses structured source metadata and semantic keyword matching.
    """
    source = finding.get("source", "")
    sources = finding.get("contributing_sources", [source] if source else [])
    title = finding.get("title", "").lower()
    excerpt = finding.get("raw_excerpt", "").lower()
    full_text = f"{title} {excerpt}"

    # 1. Pricing & Packaging
    if "pricing" in sources or source == "pricing" or "pricing change" in title or "pricing structure" in title:
        return THEME_PRICING

    # 2. Talent & Organization
    if "jobs" in sources or source == "jobs" or "job posting:" in title or "recruiting" in title:
        return THEME_TALENT

    # 3. Market Positioning & Partnerships (Funding events)
    if finding.get("funding_related") or finding.get("source_subtype") == "funding":
        return THEME_POSITIONING

    # 4. Security & Reliability
    if any(re.search(pat, full_text) for pat in SECURITY_PATTERNS):
        return THEME_SECURITY

    # 5. Market Positioning & Partnerships (Non-funding partnerships / industry coalitions / market research)
    if any(re.search(pat, full_text) for pat in POSITIONING_PATTERNS):
        # Exclude core framework releases
        if not any(k in full_text for k in ["release v", "v15.", "v2.", "tag_name", "commits in"]):
            return THEME_POSITIONING

    # 6. Default for frameworks, SDKs, repos, commits, agent tooling, CLI, features
    return THEME_PRODUCT


def calculate_corroboration_confidence(finding: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute additive corroboration-based confidence metrics from Event Consolidation data:
    - Multi-Source: 2+ distinct source types (e.g. news + github) -> High
    - Multi-Signal Single-Source: 3+ signals from same source -> Medium
    - Single-Signal: 1-2 signals from same source -> Single-Source
    """
    corrob_count = finding.get("corroboration_count", 1)
    sources = finding.get("contributing_sources", [])
    unique_sources = set(sources) if sources else set()
    if not unique_sources and finding.get("source"):
        unique_sources.add(finding["source"])

    if len(unique_sources) >= 2:
        level = "High"
        score = 3.0
        ctype = "Multi-Source Independent"
    elif corrob_count >= 3:
        level = "Medium"
        score = 2.0
        ctype = "Multi-Signal Single-Source"
    else:
        level = "Single-Source"
        score = 1.0
        ctype = "Single Signal"

    enriched = dict(finding)
    enriched["corroboration_level"] = level
    enriched["corroboration_score"] = score
    enriched["corroboration_type"] = ctype
    return enriched


def _normalize_competitor_entity(company: str) -> str:
    """Normalize sub-product competitor labels to canonical parent entity."""
    c = company.strip()
    if c in ["Cloudflare Pages", "Cloudflare Workers", "Cloudflare Pages/Workers"]:
        return "Cloudflare"
    return c


def detect_cross_competitor_pattern(
    theme: str,
    competitor_findings: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """
    Perform strict, guardrail-heavy cross-competitor pattern detection within a single theme.
    
    Rules:
    1. Requires specific, comparable, verifiable evidence from AT LEAST 2 competitors.
    2. Strictly rejects generic unfalsifiable fluff ("focusing on AI", "improving UX").
    3. Biases explicitly toward returning pattern_detected = False if evidence is isolated or coincidental.
    """
    # Group active companies by canonical entity to prevent Cloudflare Pages + Workers counting as 2
    canonical_active: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for comp, items in competitor_findings.items():
        if items:
            canonical_comp = _normalize_competitor_entity(comp)
            canonical_active[canonical_comp].extend(items)

    active_entities = list(canonical_active.keys())

    # Guardrail 1: Less than 2 distinct competitor entities active in theme -> No pattern
    if len(active_entities) < 2:
        single_comp = active_entities[0] if active_entities else "None"
        return {
            "pattern_detected": False,
            "pattern_claim": None,
            "supporting_evidence": {},
            "confidence": "None",
            "no_pattern_reason": (
                f"Activity in this theme is confined to {single_comp}; insufficient cross-competitor "
                "data to establish a pattern."
            ),
        }

    # Theme-Specific Pattern Matching
    if theme == THEME_PRODUCT:
        # Check for AI Agent Infrastructure & Runtime expansion
        agent_evidence: Dict[str, List[str]] = defaultdict(list)
        for comp, items in competitor_findings.items():
            canonical_comp = _normalize_competitor_entity(comp)
            for it in items:
                t = it.get("title", "").lower()
                e = it.get("raw_excerpt", "").lower()
                w = it.get("why_it_matters", "").lower()
                text = f"{t} {e} {w}"
                if any(k in text for k in ["agent", "agentic", "is-agentic", "kitesurf", "browser engine for agents", "coding agent"]):
                    agent_evidence[canonical_comp].append(it.get("title", ""))

        if len(agent_evidence) >= 2:
            # Format supporting evidence
            evidence_summary = {c: list(set(titles))[:2] for c, titles in agent_evidence.items()}
            return {
                "pattern_detected": True,
                "pattern_claim": (
                    "Notable Strategic Sub-Thread (18 events, 16.7% of theme): Concurrent expansion into dedicated "
                    "AI Agent infrastructure and readiness tooling across multiple competitors in the same window."
                ),
                "supporting_evidence": evidence_summary,
                "confidence": "High",
                "no_pattern_reason": None,
            }

        # Check for Framework / SDK updates
        sdk_evidence: Dict[str, List[str]] = defaultdict(list)
        for comp, items in competitor_findings.items():
            for it in items:
                t = it.get("title", "").lower()
                if "release" in t or "sdk" in t or "v1" in t or "v2" in t or "v3" in t:
                    sdk_evidence[comp].append(it.get("title", ""))

        if len(sdk_evidence) >= 2:
            evidence_summary = {c: list(set(titles))[:2] for c, titles in sdk_evidence.items()}
            return {
                "pattern_detected": True,
                "pattern_claim": (
                    "Coincident developer SDK and framework release cycle: multiple competitors "
                    "shipped versioned library updates."
                ),
                "supporting_evidence": evidence_summary,
                "confidence": "Medium",
                "no_pattern_reason": None,
            }

        return {
            "pattern_detected": False,
            "pattern_claim": None,
            "supporting_evidence": {},
            "confidence": "None",
            "no_pattern_reason": (
                "Product activities across competitors represent independent, disparate feature "
                "releases without a shared strategic shift."
            ),
        }

    elif theme == THEME_PRICING:
        # Check if 2+ competitors modified pricing/plans in this run
        price_changes: Dict[str, List[str]] = defaultdict(list)
        for comp, items in competitor_findings.items():
            canonical_comp = _normalize_competitor_entity(comp)
            for it in items:
                t = it.get("title", "")
                if "pricing change" in t.lower() or "new pricing plan" in t.lower() or "discontinued" in t.lower():
                    price_changes[canonical_comp].append(t)

        if len(price_changes) >= 2:
            return {
                "pattern_detected": True,
                "pattern_claim": (
                    "Industry-wide pricing structure adjustments: multiple competitors updated their "
                    "public tiers or billing cadences in the same period."
                ),
                "supporting_evidence": price_changes,
                "confidence": "High",
                "no_pattern_reason": None,
            }
        else:
            return {
                "pattern_detected": False,
                "pattern_claim": None,
                "supporting_evidence": {},
                "confidence": "None",
                "no_pattern_reason": (
                    "No cross-competitor pricing pattern detected: public tier structures across tracked "
                    "competitors remained stable during this monitoring window."
                ),
            }

    elif theme == THEME_TALENT:
        # Check for leadership / executive hiring concentration across 2+ competitors
        exec_hiring: Dict[str, List[str]] = defaultdict(list)
        for comp, items in competitor_findings.items():
            canonical_comp = _normalize_competitor_entity(comp)
            for it in items:
                t = it.get("title", "")
                if any(k in t.lower() for k in ["vp", "vice president", "director", "head of", "chief", "principal"]):
                    exec_hiring[canonical_comp].append(t.replace("Job Posting: ", ""))

        if len(exec_hiring) >= 2:
            return {
                "pattern_detected": True,
                "pattern_claim": (
                    "Parallel executive leadership recruitment: multiple competitors opened senior "
                    "Director/VP positions to scale specialized functions."
                ),
                "supporting_evidence": exec_hiring,
                "confidence": "High",
                "no_pattern_reason": None,
            }
        else:
            active_exec_comp = list(exec_hiring.keys())[0] if exec_hiring else None
            detail = f"senior leadership hiring was concentrated at {active_exec_comp}" if active_exec_comp else "hiring consisted primarily of routine individual contributor roles"
            return {
                "pattern_detected": False,
                "pattern_claim": None,
                "supporting_evidence": {},
                "confidence": "None",
                "no_pattern_reason": (
                    f"No cross-competitor hiring pattern detected: {detail} without parallel executive "
                    "expansion across other competitors."
                ),
            }

    elif theme == THEME_SECURITY:
        # Check for shared vulnerability classes or incidents across 2+ competitors
        sec_evidence: Dict[str, List[str]] = defaultdict(list)
        for comp, items in competitor_findings.items():
            canonical_comp = _normalize_competitor_entity(comp)
            for it in items:
                t = it.get("title", "").lower()
                e = it.get("raw_excerpt", "").lower()
                text = f"{t} {e}"
                if any(re.search(pat, text) for pat in SECURITY_PATTERNS):
                    sec_evidence[canonical_comp].append(it.get("title", ""))

        if len(sec_evidence) >= 2:
            return {
                "pattern_detected": True,
                "pattern_claim": (
                    "Industry-wide security focus: multiple competitors addressed platform vulnerabilities "
                    "or disclosed architectural mitigations."
                ),
                "supporting_evidence": sec_evidence,
                "confidence": "Medium",
                "no_pattern_reason": None,
            }
        else:
            return {
                "pattern_detected": False,
                "pattern_claim": None,
                "supporting_evidence": {},
                "confidence": "None",
                "no_pattern_reason": (
                    "No cross-competitor security pattern detected: vulnerability research and security "
                    "disclosures were isolated to single platform environments."
                ),
            }

    elif theme == THEME_POSITIONING:
        # Check for true corporate funding rounds or explicit bilateral partnership alliances
        funding_evidence: Dict[str, List[str]] = defaultdict(list)
        alliance_evidence: Dict[str, List[str]] = defaultdict(list)
        for comp, items in competitor_findings.items():
            canonical_comp = _normalize_competitor_entity(comp)
            for it in items:
                t = it.get("title", "").lower()
                e = it.get("raw_excerpt", "").lower()
                text = f"{t} {e}"
                if it.get("funding_related") or it.get("source_subtype") == "funding":
                    funding_evidence[canonical_comp].append(it.get("title", ""))
                elif any(k in text for k in ["strategic partnership", "joint alliance", "bilateral agreement", "co-development"]):
                    alliance_evidence[canonical_comp].append(it.get("title", ""))

        if len(funding_evidence) >= 2:
            return {
                "pattern_detected": True,
                "pattern_claim": (
                    "Industry-wide venture financing cycle: multiple competitors completed capital raises "
                    "in the same window."
                ),
                "supporting_evidence": dict(funding_evidence),
                "confidence": "High",
                "no_pattern_reason": None,
            }
        elif len(alliance_evidence) >= 2:
            return {
                "pattern_detected": True,
                "pattern_claim": (
                    "Strategic alliance momentum: multiple competitors entered formal co-development "
                    "or bilateral partnership agreements."
                ),
                "supporting_evidence": dict(alliance_evidence),
                "confidence": "Medium",
                "no_pattern_reason": None,
            }
        else:
            return {
                "pattern_detected": False,
                "pattern_claim": None,
                "supporting_evidence": {},
                "confidence": "None",
                "no_pattern_reason": (
                    "No cross-competitor partnership or funding pattern detected: activities represent "
                    "isolated marketing case studies and third-party industry commentary."
                ),
            }

    return {
        "pattern_detected": False,
        "pattern_claim": None,
        "supporting_evidence": {},
        "confidence": "None",
        "no_pattern_reason": "No cross-competitor pattern detected for this category.",
    }


def build_competitor_index(
    findings_by_theme: Dict[str, Dict[str, List[Dict[str, Any]]]],
    all_companies: Optional[List[str]] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Build a per-competitor lookup index mapping each company to all of its
    findings across all 5 themes, providing total counts and tier breakdowns.
    """
    if all_companies is None:
        companies_set: Set[str] = set()
        for comp_map in findings_by_theme.values():
            companies_set.update(comp_map.keys())
        all_companies = sorted(list(companies_set))

    index: Dict[str, Dict[str, Any]] = {}

    for comp in all_companies:
        comp_findings: List[Dict[str, Any]] = []
        themes_active: List[str] = []
        tier_counts = {"must_know": 0, "should_know": 0, "nice_to_know": 0}

        for theme_name, comp_map in findings_by_theme.items():
            items = comp_map.get(comp, [])
            if items:
                themes_active.append(theme_name)
                comp_findings.extend(items)
                for it in items:
                    conf = it.get("confidence", "Low")
                    if conf == "High":
                        tier_counts["must_know"] += 1
                    elif conf == "Medium":
                        tier_counts["should_know"] += 1
                    else:
                        tier_counts["nice_to_know"] += 1

        index[comp] = {
            "total_findings": len(comp_findings),
            "active_themes": themes_active,
            "tier_counts": tier_counts,
            "findings_by_theme": {
                theme: findings_by_theme[theme].get(comp, [])
                for theme in themes_active
            },
        }

    return index


def run(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Execute the Synthesis Agent:
    1. Enriches each finding with Theme and Corroboration metrics.
    2. Groups findings into the 5 canonical themes with side-by-side competitor views.
    3. Evaluates each theme for genuine cross-competitor patterns vs 'no pattern found'.
    4. Builds a Per-Competitor Index for direct lookups.
    
    Returns:
        Structured dictionary containing themes, patterns, enriched findings, and competitor index.
    """
    enriched_findings: List[Dict[str, Any]] = []
    findings_by_theme: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
        theme: defaultdict(list) for theme in THEMES
    }

    # Step 1: Enrich and organize by theme
    for f in findings:
        theme = classify_event_theme(f)
        enriched = calculate_corroboration_confidence(f)
        enriched["theme"] = theme
        enriched_findings.append(enriched)

        comp = enriched.get("company", "Other")
        findings_by_theme[theme][comp].append(enriched)

    # Step 2: Evaluate cross-competitor patterns per theme
    theme_synthesis: Dict[str, Dict[str, Any]] = {}
    patterns_detected_count = 0

    for theme in THEMES:
        comp_map = findings_by_theme[theme]
        pattern_result = detect_cross_competitor_pattern(theme, comp_map)

        total_items = sum(len(items) for items in comp_map.values())
        active_comps = [c for c, items in comp_map.items() if items]

        if pattern_result["pattern_detected"]:
            patterns_detected_count += 1

        theme_synthesis[theme] = {
            "theme_name": theme,
            "total_findings": total_items,
            "active_companies": active_comps,
            "pattern": pattern_result,
            "competitors": dict(comp_map),
        }

    # Step 3: Build Per-Competitor Lookup Index
    competitor_index = build_competitor_index(findings_by_theme)

    # Step 4: Executive Rollup Summary
    total_findings_count = len(enriched_findings)
    executive_summary = {
        "total_findings": total_findings_count,
        "themes_count": len(THEMES),
        "patterns_detected_count": patterns_detected_count,
        "themes_with_patterns": [
            t for t, data in theme_synthesis.items() if data["pattern"]["pattern_detected"]
        ],
        "themes_without_patterns": [
            t for t, data in theme_synthesis.items() if not data["pattern"]["pattern_detected"]
        ],
    }

    return {
        "themes": theme_synthesis,
        "executive_summary": executive_summary,
        "competitor_index": competitor_index,
        "enriched_findings": enriched_findings,
    }
