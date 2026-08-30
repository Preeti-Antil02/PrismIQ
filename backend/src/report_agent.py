"""
Report Agent for PrismIQ.

Renders executive markdown competitive intelligence briefs from synthesized findings:
1. Top 3 Decisions section at the top.
2. Executive Summary & Cross-Competitor Theme Rollup.
3. Theme-organized competitor findings presented side-by-side with strict pattern detection.
4. Per-Competitor Index / Appendix for direct company-specific lookups.
"""

from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from . import synthesis_agent

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
    "browser engine", "agentic", "kitesurf", "pricing change", "series", "funding",
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
    confidence = finding.get("confidence", "Low")
    if confidence == "High":
        score = 2.0
    elif confidence == "Medium":
        score = 1.5
    else:
        score = 0.5

    title = finding.get("title", "").lower()
    excerpt = finding.get("raw_excerpt", "").lower()
    why_it_matters = finding.get("why_it_matters", "").lower()
    full_text = f"{title} {excerpt} {why_it_matters}"
    url = finding.get("url", "").lower()

    # High-stakes security & vulnerability boost (+3.0)
    has_security_risk = any(kw in full_text for kw in SECURITY_KEYWORDS)
    if has_security_risk:
        score += 3.0

    # Strategic moves & pricing/positioning shifts boost (+1.5)
    has_strategic_impact = any(kw in full_text for kw in STRATEGIC_KEYWORDS)
    if has_strategic_impact:
        score += 1.5

    # Self-reported changelog penalty (-1.0) for Top-3 selection unless high security risk
    is_changelog = any(ind in url for ind in CHANGELOG_INDICATORS)
    if apply_changelog_penalty and is_changelog and not has_security_risk:
        score -= 1.0

    # External third-party source validation boost (+0.5)
    is_self_domain = any(domain in url for domain in ["vercel.com", "netlify.com", "cloudflare.com"])
    if not is_self_domain:
        score += 0.5

    return score


def _assign_finding_tier(finding: Dict[str, Any]) -> str:
    """
    Assign a finding to Must-know, Should-know, or Nice-to-know tier:
    - must_know: high decision score (>= 3.0) - security disclosures, strategic moves, pricing changes.
    - should_know: moderate decision score (1.5 <= score < 3.0) - substantive product activity, PRs,
      issues, real feature releases.
    - nice_to_know: low decision score (< 1.5) or routine IC job postings / watch events.
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

    source = finding.get("source", "")
    is_job = source == "jobs" or "job posting:" in title_lower
    is_leadership_job = any(k in title_lower for k in ["vp", "vice president", "director", "head of", "chief", "principal", "fellow"])

    score = _calculate_decision_score(finding, apply_changelog_penalty=False)

    if is_job and not is_leadership_job and score < 3.0:
        return "nice_to_know"

    if score >= 3.0:
        return "must_know"
    elif score >= 1.5:
        return "should_know"
    else:
        return "nice_to_know"


def _select_top_decisions(findings: List[Dict[str, Any]], limit: int = 3) -> List[Dict[str, Any]]:
    """
    Select top decision items across all companies using scored priority,
    ensuring company diversity where qualifying cross-company findings exist.
    """
    if not findings:
        return []

    scored_findings = [
        (finding, _calculate_decision_score(finding, apply_changelog_penalty=True))
        for finding in findings
    ]
    scored_findings.sort(key=lambda x: x[1], reverse=True)

    selected: List[Dict[str, Any]] = []
    company_counts: Dict[str, int] = defaultdict(int)

    for finding, _ in scored_findings:
        company = finding.get("company", "Other")
        if company_counts[company] < 2:
            selected.append(finding)
            company_counts[company] += 1
            if len(selected) == limit:
                break

    if len(selected) < limit:
        for finding, _ in scored_findings:
            if finding not in selected:
                selected.append(finding)
                if len(selected) == limit:
                    break

    return selected


def run(
    synthesis_or_findings: Any,
    supervisor_decisions: Optional[Dict[str, Any]] = None,
    source_health: Optional[Dict[str, Any]] = None,
    trigger_mode: Optional[str] = None,
    cadence_name: Optional[str] = None,
) -> str:
    """
    Generate a markdown competitive intelligence brief organized by Theme.
    Accepts either a synthesized dict from synthesis_agent.run() or a raw list of findings,
    along with optional supervisor decisions, source health metadata, and trigger mode.
    """
    if isinstance(synthesis_or_findings, list):
        synthesis = synthesis_agent.run(synthesis_or_findings)
    elif isinstance(synthesis_or_findings, dict) and "themes" in synthesis_or_findings:
        synthesis = synthesis_or_findings
    else:
        synthesis = synthesis_agent.run([])

    findings = synthesis.get("enriched_findings", [])
    themes = synthesis.get("themes", {})
    exec_summary = synthesis.get("executive_summary", {})
    competitor_index = synthesis.get("competitor_index", {})

    lines: List[str] = []
    lines.append("# PrismIQ Competitive Intelligence Brief\n")

    # ==========================================
    # 0. Pipeline Execution & Source Coverage (Health & Skips & Mode)
    # ==========================================
    status_notes: List[str] = []

    # Execution Mode
    mode = trigger_mode or "manual"
    cadence = cadence_name or "weekly"
    if mode == "scheduled":
        status_notes.append(f"- ⏱️ **Execution Mode**: Autonomous Scheduled Run (cadence: {cadence})")
    else:
        status_notes.append("- ⏱️ **Execution Mode**: Manual Invocation")

    if source_health:
        for src_name, hdata in source_health.items():
            st = hdata.get("status")
            if st == "failed":
                err = hdata.get("error", "Unknown error")
                att = hdata.get("attempts", 2)
                status_notes.append(f"- ⚠️ **Source Alert**: `{src_name}` source unavailable this cycle ({err} after {att} attempts). Pipeline continued with remaining healthy sources.")
            elif st == "recovered":
                att = hdata.get("attempts", 2)
                status_notes.append(f"- 🔄 **Source Recovery**: `{src_name}` source recovered after {att} attempts.")

    if supervisor_decisions:
        for src_name, dec in supervisor_decisions.items():
            if dec.get("action") == "skip":
                reason = dec.get("reason", "Skipped by supervisor.")
                status_notes.append(f"- ℹ️ **Supervisor Note**: `{src_name}` source skipped this cycle — {reason}")

    if status_notes:
        lines.append("## Pipeline Execution & Data Coverage\n")
        for note in status_notes:
            lines.append(note)
        lines.append("")

    # ==========================================
    # 1. Top 3 Decisions Section
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
    # 2. Executive Summary & Theme Rollup
    # ==========================================
    if findings:
        lines.append("## Executive Summary & Theme Synthesis Rollup\n")
        total_f = exec_summary.get("total_findings", len(findings))
        pat_count = exec_summary.get("patterns_detected_count", 0)
        lines.append(
            f"- **Monitoring Scope**: {total_f} consolidated events synthesized across {len(themes)} strategic themes."
        )
        lines.append(
            f"- **Cross-Competitor Patterns**: {pat_count} verified multi-competitor pattern(s) identified."
        )

        lines.append("\n| Theme | Active Competitors | Total Events | Cross-Competitor Pattern Detected? |")
        lines.append("|---|---|---|---|")
        for theme_name, theme_data in themes.items():
            active_str = ", ".join(theme_data.get("active_companies", [])) or "None"
            tot = theme_data.get("total_findings", 0)
            pat = theme_data.get("pattern", {})
            if pat.get("pattern_detected"):
                pat_status = "✅ **Yes** (Verified 2+ competitors)"
            else:
                pat_status = "❌ No pattern"
            lines.append(f"| **{theme_name}** | {active_str} | {tot} | {pat_status} |")
        lines.append("")

    # ==========================================
    # 3. Strategic Themes & Side-by-Side Competitor Activity
    # ==========================================
    lines.append("## Strategic Themes & Cross-Competitor Analysis\n")

    if not findings:
        lines.append("*No competitive signals detected for this monitoring window.*\n")
        return "\n".join(lines)

    for theme_name, theme_data in themes.items():
        total_items = theme_data.get("total_findings", 0)
        if total_items == 0:
            continue

        lines.append(f"### Theme: {theme_name}\n")

        # A. Pattern Analysis Block
        pattern = theme_data.get("pattern", {})
        if pattern.get("pattern_detected"):
            lines.append(f"> 🔍 **Cross-Competitor Pattern**: {pattern.get('pattern_claim')}\n>")
            ev_dict = pattern.get("supporting_evidence", {})
            for comp, ev_list in ev_dict.items():
                ev_str = "; ".join(ev_list)
                lines.append(f"> - **{comp}**: {ev_str}")
            lines.append("")
        else:
            reason = pattern.get("no_pattern_reason", "No cross-competitor pattern detected.")
            lines.append(f"*{reason}*\n")

        # B. Side-by-Side Competitor Activity
        competitors_map = theme_data.get("competitors", {})
        for company, comp_items in competitors_map.items():
            if not comp_items:
                continue

            lines.append(f"#### {company} ({len(comp_items)} items)\n")

            must_know: List[Dict[str, Any]] = []
            should_know: List[Dict[str, Any]] = []
            nice_to_know: List[Dict[str, Any]] = []

            for item in comp_items:
                tier = _assign_finding_tier(item)
                if tier == "must_know":
                    must_know.append(item)
                elif tier == "should_know":
                    should_know.append(item)
                else:
                    nice_to_know.append(item)

            # Must-Know
            if must_know:
                lines.append("##### Must-Know\n")
                for finding in must_know:
                    title = finding.get("title", "Untitled Signal")
                    url = finding.get("url", "#")
                    confidence = finding.get("confidence", "Low")
                    corrob_lvl = finding.get("corroboration_level", "Single-Source")
                    why_it_matters = finding.get("why_it_matters", "")
                    published_at = finding.get("published_at", "Recent")
                    corrob_count = finding.get("corroboration_count", 1)
                    contrib_sources = finding.get("contributing_sources", [])

                    lines.append(f"- **[{title}]({url})**")
                    if corrob_count > 1:
                        sources_str = ", ".join(contrib_sources)
                        lines.append(f"  - **Corroboration**: {corrob_count} signals ({sources_str} — {corrob_lvl}) | **Confidence**: {confidence} | **Date**: {published_at}")
                    else:
                        source = finding.get("source") or (contrib_sources[0] if contrib_sources else "unknown")
                        lines.append(f"  - **Source**: {source} ({corrob_lvl}) | **Confidence**: {confidence} | **Date**: {published_at}")
                    lines.append(f"  - **Why it matters**: {why_it_matters}")
                lines.append("")

            # Should-Know
            if should_know:
                lines.append("##### Should-Know\n")
                for finding in should_know:
                    title = finding.get("title", "Untitled Signal")
                    url = finding.get("url", "#")
                    confidence = finding.get("confidence", "Low")
                    corrob_lvl = finding.get("corroboration_level", "Single-Source")
                    why_it_matters = finding.get("why_it_matters", "")
                    published_at = finding.get("published_at", "Recent")
                    corrob_count = finding.get("corroboration_count", 1)
                    contrib_sources = finding.get("contributing_sources", [])

                    if corrob_count > 1:
                        sources_str = ", ".join(contrib_sources)
                        lines.append(f"- **[{title}]({url})** ({confidence} confidence | {corrob_lvl} corroboration [{sources_str}])")
                    else:
                        source = finding.get("source") or (contrib_sources[0] if contrib_sources else "unknown")
                        lines.append(f"- **[{title}]({url})** ({confidence} confidence | {source})")
                    lines.append(f"  - **Why it matters**: {why_it_matters} (*Date: {published_at}*)")
                lines.append("")

            # Nice-to-Know
            if nice_to_know:
                lines.append(f"##### Other Activity ({len(nice_to_know)} items)\n")
                for finding in nice_to_know:
                    title = finding.get("title", "Untitled Signal")
                    url = finding.get("url", "#")
                    published_at = finding.get("published_at", "Recent")
                    corrob_count = finding.get("corroboration_count", 1)
                    contrib_sources = finding.get("contributing_sources", [])
                    source = finding.get("source") or (contrib_sources[0] if contrib_sources else "unknown")

                    if corrob_count > 1:
                        sources_str = ", ".join(contrib_sources)
                        lines.append(f"- [{title}]({url}) — *{corrob_count} signals ({sources_str}), {published_at}*")
                    else:
                        lines.append(f"- [{title}]({url}) — *{source}, {published_at}*")
                lines.append("")

    # ==========================================
    # 4. Per-Competitor Index (Appendix)
    # ==========================================
    lines.append("## Per-Competitor Index\n")
    for comp, cdata in competitor_index.items():
        tot = cdata.get("total_findings", 0)
        t_counts = cdata.get("tier_counts", {})
        active_themes = cdata.get("active_themes", [])
        lines.append(f"### {comp}")
        lines.append(
            f"- **Activity Overview**: {tot} total events ({t_counts.get('must_know', 0)} Must-Know, "
            f"{t_counts.get('should_know', 0)} Should-Know, {t_counts.get('nice_to_know', 0)} Nice-to-Know)"
        )
        lines.append(f"- **Active Strategic Themes**: {', '.join(active_themes) if active_themes else 'None'}")
        lines.append("")

    return "\n".join(lines)
