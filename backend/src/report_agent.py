from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

# High-stakes risk & security keywords that warrant immediate executive attention
SECURITY_KEYWORDS: Set[str] = {
    "vulnerability", "vulnerabilities", "security flaw", "spectre", "side-channel",
    "exploit", "cve", "breach", "leak", "leaking", "outage", "incident",
    "vulnerable", "double-billing", "unmitigated", "threat", "attack",
}

# Strategic & commercial movement keywords
STRATEGIC_KEYWORDS: Set[str] = {
    "monetizing", "monetization", "price cut", "pricing", "charge", "partnership",
    "lawsuit", "antitrust", "acquisition", "standardized", "migrating", "migration",
    "browser engine", "agentic", "kitesurf",
}

# Domains / paths indicating routine self-reported changelog or press releases
CHANGELOG_INDICATORS: List[str] = [
    "/changelog", "/changelog/", "/changelogs", "/press/", "/blog/changelog"
]


def _calculate_decision_score(
    finding: Dict[str, Any],
    apply_changelog_penalty: bool = True,
) -> float:
    """
    Calculate an intelligence priority score.
    - When apply_changelog_penalty=True (default, for Top 3 ranking): deprioritizes routine
      self-reported changelogs to prevent them from crowding out high-stakes competitor news.
    - When apply_changelog_penalty=False (for tier assignment): measures underlying
      substantiveness without penalizing genuine feature announcements into Nice-to-Know.
    """
    # 1. Base score from confidence
    confidence = finding.get("confidence", "Low")
    if confidence == "High":
        score = 2.0
    elif confidence == "Medium":
        score = 1.5
    else:
        score = 0.5

    # Text corpus for keyword scanning
    title = finding.get("title", "").lower()
    excerpt = finding.get("raw_excerpt", "").lower()
    why_it_matters = finding.get("why_it_matters", "").lower()
    full_text = f"{title} {excerpt} {why_it_matters}"
    url = finding.get("url", "").lower()

    # 2. High-stakes security & vulnerability boost (+3.0)
    has_security_risk = any(kw in full_text for kw in SECURITY_KEYWORDS)
    if has_security_risk:
        score += 3.0

    # 3. Strategic moves & pricing/positioning shifts boost (+1.5)
    has_strategic_impact = any(kw in full_text for kw in STRATEGIC_KEYWORDS)
    if has_strategic_impact:
        score += 1.5

    # 4. Self-reported changelog penalty (-1.0) for Top-3 selection unless high security risk
    is_changelog = any(ind in url for ind in CHANGELOG_INDICATORS)
    if apply_changelog_penalty and is_changelog and not has_security_risk:
        score -= 1.0

    # 5. External third-party source validation boost (+0.5)
    is_self_domain = any(domain in url for domain in ["vercel.com", "netlify.com", "cloudflare.com"])
    if not is_self_domain:
        score += 0.5

    return score


def _assign_finding_tier(finding: Dict[str, Any]) -> str:
    """
    Assign a finding to Must-know, Should-know, or Nice-to-know tier:
    - must_know: high decision score (>= 3.0) - security disclosures, strategic moves, pricing changes.
    - should_know: moderate decision score (1.5 <= score < 3.0) - substantive product activity, PRs,
      issues, real feature releases (including changelogs without penalty).
    - nice_to_know: low decision score (< 1.5) or low-information WatchEvent/ForkEvent summaries.
    """
    title_lower = finding.get("title", "").lower()
    is_watch_fork = (
        "started watching" in title_lower
        or "forked" in title_lower
        or "watchevent" in title_lower
        or "forkevent" in title_lower
    )

    if is_watch_fork:
        return "nice_to_know"

    # For tiering, do not apply changelog penalty so real feature releases stay in Should-Know/Must-Know
    score = _calculate_decision_score(finding, apply_changelog_penalty=False)
    if score >= 3.0:
        return "must_know"
    elif score >= 1.5:
        return "should_know"
    else:
        return "nice_to_know"


def _select_top_decisions(findings: List[Dict[str, Any]], limit: int = 3) -> List[Dict[str, Any]]:
    """
    Select the top decision items across all companies using scored priority,
    ensuring company diversity where qualifying cross-company findings exist.
    Retains changelog penalty (apply_changelog_penalty=True) for headline selection.
    """
    if not findings:
        return []

    # Score each finding with changelog penalty for Top-3 headline ranking
    scored_findings = [
        (finding, _calculate_decision_score(finding, apply_changelog_penalty=True))
        for finding in findings
    ]
    # Sort descending by score
    scored_findings.sort(key=lambda x: x[1], reverse=True)

    # Diversity-aware selection: allow at most 2 items from any single company
    selected: List[Dict[str, Any]] = []
    company_counts: Dict[str, int] = defaultdict(int)

    # First pass: pick highest scoring items respecting company diversity cap (max 2 per company)
    for finding, _ in scored_findings:
        company = finding.get("company", "Other")
        if company_counts[company] < 2:
            selected.append(finding)
            company_counts[company] += 1
            if len(selected) == limit:
                break

    # Second pass: fill any remaining slots if diversity cap prevented reaching limit
    if len(selected) < limit:
        for finding, _ in scored_findings:
            if finding not in selected:
                selected.append(finding)
                if len(selected) == limit:
                    break

    return selected


def run(findings: List[Dict[str, Any]]) -> str:
    """
    Generate a markdown competitive intelligence brief from analyzed findings.
    - Top 3 decisions headline section
    - Deterministic Executive Summary & Activity Rollup
    - Company-grouped findings tiered into Must-Know, Should-Know, and Other Activity (Nice-to-Know).
    """
    lines: List[str] = []
    lines.append("# PrismIQ Competitive Intelligence Brief\n")

    # ==========================================
    # Top 3 Decisions Section
    # ==========================================
    lines.append("## Top 3 decisions this informs\n")

    top_decisions = _select_top_decisions(findings, limit=3)

    if not top_decisions:
        lines.append("*No high-priority decisions identified for this period.*\n")
    else:
        for idx, item in enumerate(top_decisions, 1):
            company = item.get("company", "General")
            why = item.get("why_it_matters", "No analysis provided.")
            title = item.get("title", "Signal")
            lines.append(f"{idx}. **{company}** ({title}): {why}")
        lines.append("")

    # ==========================================
    # Executive Summary Rollup Block
    # ==========================================
    if findings:
        by_company_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: {"must_know": 0, "should_know": 0, "nice_to_know": 0})
        total_tiers: Dict[str, int] = {"must_know": 0, "should_know": 0, "nice_to_know": 0}

        for finding in findings:
            comp = finding.get("company", "Other")
            tier = _assign_finding_tier(finding)
            by_company_counts[comp][tier] += 1
            total_tiers[tier] += 1

        lines.append("### Executive Summary Rollup\n")
        lines.append(
            f"- **Total Monitored**: {len(findings)} findings across {len(by_company_counts)} companies "
            f"({total_tiers['must_know']} Must-Know, {total_tiers['should_know']} Should-Know, {total_tiers['nice_to_know']} Nice-to-Know)"
        )

        # Highlight most active company in must-know category
        most_active_comp = None
        max_must = -1
        for comp, counts in by_company_counts.items():
            if counts["must_know"] > max_must:
                max_must = counts["must_know"]
                most_active_comp = comp

        if most_active_comp and max_must > 0:
            lines.append(f"- **Key Focus**: {most_active_comp} recorded the highest critical activity with {max_must} Must-Know findings.")

        lines.append("- **Activity by Company**:")
        for comp, counts in sorted(by_company_counts.items()):
            lines.append(f"  - **{comp}**: {counts['must_know']} Must-Know, {counts['should_know']} Should-Know, {counts['nice_to_know']} Nice-to-Know")
        lines.append("")

    # ==========================================
    # Findings Grouped by Company & Tier
    # ==========================================
    lines.append("## Findings by Company\n")

    if not findings:
        lines.append("*No competitive signals detected for this monitoring window.*\n")
        return "\n".join(lines)

    by_company: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for f in findings:
        company_name = f.get("company", "Other")
        by_company[company_name].append(f)

    for company, comp_findings in by_company.items():
        lines.append(f"### {company}\n")

        # Partition findings by tier
        must_know: List[Dict[str, Any]] = []
        should_know: List[Dict[str, Any]] = []
        nice_to_know: List[Dict[str, Any]] = []

        for finding in comp_findings:
            tier = _assign_finding_tier(finding)
            if tier == "must_know":
                must_know.append(finding)
            elif tier == "should_know":
                should_know.append(finding)
            else:
                nice_to_know.append(finding)

        # 1. Must-Know Section (Full Treatment)
        if must_know:
            lines.append("#### Must-Know\n")
            for finding in must_know:
                title = finding.get("title", "Untitled Signal")
                url = finding.get("url", "#")
                source = finding.get("source", "unknown")
                confidence = finding.get("confidence", "Low")
                why_it_matters = finding.get("why_it_matters", "")
                published_at = finding.get("published_at", "Recent")

                lines.append(f"- **[{title}]({url})**")
                lines.append(f"  - **Source**: {source} | **Confidence**: {confidence} | **Date**: {published_at}")
                lines.append(f"  - **Why it matters**: {why_it_matters}")
            lines.append("")

        # 2. Should-Know Section (Compact Entry with Full Explanation & Provenance)
        if should_know:
            lines.append("#### Should-Know\n")
            for finding in should_know:
                title = finding.get("title", "Untitled Signal")
                url = finding.get("url", "#")
                source = finding.get("source", "unknown")
                confidence = finding.get("confidence", "Low")
                why_it_matters = finding.get("why_it_matters", "")
                published_at = finding.get("published_at", "Recent")

                lines.append(f"- **[{title}]({url})** ({confidence} confidence)")
                lines.append(f"  - **Why it matters**: {why_it_matters} (*Source: {source} | Date: {published_at}*)")
            lines.append("")

        # 3. Nice-to-Know Section (Condensed One-Line List with Source Links)
        if nice_to_know:
            lines.append(f"#### Other Activity ({len(nice_to_know)} items)\n")
            for finding in nice_to_know:
                title = finding.get("title", "Untitled Signal")
                url = finding.get("url", "#")
                source = finding.get("source", "unknown")
                published_at = finding.get("published_at", "Recent")

                lines.append(f"- [{title}]({url}) — *{source}, {published_at}*")
            lines.append("")

    return "\n".join(lines)
