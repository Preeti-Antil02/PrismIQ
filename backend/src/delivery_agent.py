"""
Delivery Agent for PrismIQ.

Posts a condensed daily intelligence digest of each brief to Slack via an incoming webhook.
- Fixed LangGraph pipeline step executed after Report Agent.
- Direct HTTP POST via requests library (zero heavy SDK dependencies).
- Strict failure isolation: delivery failure or missing webhook URL never crashes the pipeline.
- Condensed content: Top 3 decisions, Must-Know tier findings only, execution disclosures,
  and 3-state research activity suppression logic.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Union
import requests

from . import config, report_agent, storage, synthesis_agent

logger = logging.getLogger(__name__)


def _format_slack_link(title: str, url: Optional[str]) -> str:
    """Format title and URL as Slack mrkdwn link `<url|title>` if URL is valid."""
    clean_title = title.strip().replace("\n", " ")
    if url and url.strip() and url.strip() != "#":
        clean_url = url.strip()
        return f"<{clean_url}|{clean_title}>"
    return clean_title


_DEFAULT_RESEARCH_SENTINEL = object()


def build_slack_digest(
    synthesis_or_findings: Any,
    supervisor_decisions: Optional[Dict[str, Any]] = None,
    source_health: Optional[Dict[str, Any]] = None,
    trigger_mode: Optional[str] = None,
    cadence_name: Optional[str] = None,
    prior_research_activity: Any = _DEFAULT_RESEARCH_SENTINEL,
    reference_time: Optional[datetime] = None,
) -> str:
    """
    Build a condensed daily intelligence digest formatted in Slack mrkdwn:
    1. Header with date and execution metadata disclosures.
    2. Top 3 decisions this informs (reused from brief scoring).
    3. Must-Know tier findings only (Should-Know and Nice-to-Know excluded).
       If zero Must-Know findings exist, states 'No Must-Know activity today'.
    4. Research Activity with 3-state suppression (Show findings / Transition note / Suppress entirely).
    5. Footer pointing to full brief in Postgres/repo.
    """
    if isinstance(synthesis_or_findings, list):
        synthesis = synthesis_agent.run(synthesis_or_findings)
    elif isinstance(synthesis_or_findings, dict) and "themes" in synthesis_or_findings:
        synthesis = synthesis_or_findings
    else:
        synthesis = synthesis_agent.run([])

    findings: List[Dict[str, Any]] = synthesis.get("enriched_findings", [])

    ref_dt = reference_time or datetime.now(timezone.utc)
    date_str = ref_dt.strftime("%Y-%m-%d")

    # Resolve prior research activity if not explicitly passed
    if prior_research_activity is _DEFAULT_RESEARCH_SENTINEL:
        current_sig_ids: Set[str] = set()
        for f in findings:
            if f.get("signal_id"):
                current_sig_ids.add(f["signal_id"])
            if f.get("event_id"):
                current_sig_ids.add(f["event_id"])
        prior_research_activity = storage.get_prior_research_activity(exclude_signal_ids=current_sig_ids)

    lines: List[str] = []
    lines.append(f"📊 *PrismIQ Daily Intelligence Digest* | {date_str}\n")

    # ---------------------------------------------------------------------------
    # 0. Pipeline Execution & Data Coverage Disclosures
    # ---------------------------------------------------------------------------
    status_lines: List[str] = []
    mode = trigger_mode or config.TRIGGER_MODE
    cadence = cadence_name or config.SCHEDULE_CADENCE_NAME
    if mode == "scheduled":
        status_lines.append(f"⏱️ *Execution Mode:* Autonomous Scheduled Run ({cadence})")
    else:
        status_lines.append("⏱️ *Execution Mode:* Manual Invocation")

    if source_health:
        for src_name, hdata in source_health.items():
            st = hdata.get("status")
            if st == "failed":
                err = hdata.get("error", "Unknown error")
                att = hdata.get("attempts", 2)
                status_lines.append(f"⚠️ *Source Alert:* `{src_name}` unavailable ({err} after {att} attempts)")
            elif st == "recovered":
                att = hdata.get("attempts", 2)
                status_lines.append(f"🔄 *Source Recovery:* `{src_name}` recovered on attempt {att}")

    if supervisor_decisions:
        for src_name, dec in supervisor_decisions.items():
            if dec.get("action") == "skip":
                reason = dec.get("reason", "Skipped by supervisor.")
                status_lines.append(f"ℹ️ *Supervisor Note:* `{src_name}` skipped — {reason}")

    if status_lines:
        lines.extend(status_lines)
        lines.append("")

    # ---------------------------------------------------------------------------
    # 1. Top 3 Decisions This Informs
    # ---------------------------------------------------------------------------
    lines.append("*Top 3 Decisions This Informs:*")
    top_decisions = report_agent._select_top_decisions(findings, limit=3, reference_time=ref_dt)
    if not top_decisions:
        lines.append("_No high-priority decisions identified for this period._\n")
    else:
        for idx, item in enumerate(top_decisions, 1):
            comp = item.get("company", "General")
            title = item.get("title", "Signal")
            url = item.get("url", "#")
            why = item.get("why_it_matters", "No analysis provided.")
            link_str = _format_slack_link(title, url)
            lines.append(f"{idx}. *{comp}* ({link_str}): {why}")
        lines.append("")

    # ---------------------------------------------------------------------------
    # 2. Must-Know Findings (Must-Know Tier Only)
    # ---------------------------------------------------------------------------
    lines.append("*Must-Know Findings:*")
    must_know_findings: List[Dict[str, Any]] = []
    for item in findings:
        tier = report_agent._assign_finding_tier(item, apply_freshness_decay=False, reference_time=ref_dt)
        if tier == "must_know":
            must_know_findings.append(item)

    if not must_know_findings:
        lines.append("No Must-Know activity today\n")
    else:
        # Sort by decay-adjusted priority score
        must_know_findings.sort(
            key=lambda x: report_agent._calculate_decision_score(
                x, apply_changelog_penalty=False, apply_freshness_decay=True, reference_time=ref_dt
            ),
            reverse=True,
        )
        for finding in must_know_findings:
            comp = finding.get("company", "Competitor")
            title = finding.get("title", "Untitled Signal")
            url = finding.get("url", "#")
            why = finding.get("why_it_matters", "")
            link_str = _format_slack_link(title, url)
            lines.append(f"• *{comp}* — {link_str}: {why}")
        lines.append("")

    # ---------------------------------------------------------------------------
    # 3. Research Activity (3-State Suppression Logic)
    # ---------------------------------------------------------------------------
    research_findings = [
        f for f in findings
        if f.get("source") == "research"
        or f.get("source_subtype") == "research"
        or "research" in f.get("contributing_sources", [])
        or f.get("research_details")
    ]

    if research_findings:
        lines.append("*Research Activity (Papers & Technical Write-ups):*")
        for finding in research_findings:
            comp = finding.get("company", "Competitor")
            title = finding.get("title", "Untitled Research Signal")
            url = finding.get("url", "#")
            r_details = finding.get("research_details") or {}
            r_type = r_details.get("type", "technical_writeup")
            type_label = "Academic Paper" if r_type == "arxiv_paper" else "Technical Deep-Dive"
            link_str = _format_slack_link(title, url)
            lines.append(f"• *{comp}* — {link_str} ({type_label})")
        lines.append("")
    elif prior_research_activity:
        last_title = prior_research_activity.get("title", "Research Item")
        last_date = prior_research_activity.get("published_at", "previous cycle")
        last_comp = prior_research_activity.get("company", "")
        comp_str = f" from {last_comp}" if last_comp else ""
        lines.append("*Research Activity:*")
        lines.append(f"_No new research activity today (last research finding{comp_str}: \"{last_title}\" on {last_date})_\n")
    # State 3: Consecutive zero findings -> completely suppressed (0 lines appended)

    return "\n".join(lines).strip()


def post_slack_digest(
    digest_text: str,
    webhook_url: Optional[str] = None,
    max_retries: int = 1,
    backoff: float = 1.0,
) -> Dict[str, Any]:
    """
    Post formatted digest to Slack via direct HTTP POST.
    - If webhook_url is empty/None: skips delivery gracefully without error.
    - If HTTP request fails: retries once with backoff before recording failure metadata.
    - Guaranteed never to raise unhandled exceptions (fail-safe delivery).
    """
    target_url = (webhook_url if webhook_url is not None else config.SLACK_WEBHOOK_URL).strip()

    if not target_url:
        logger.info("SLACK_WEBHOOK_URL is not configured. Skipping Slack delivery.")
        return {
            "status": "skipped",
            "reason": "SLACK_WEBHOOK_URL not configured",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    attempts = 0
    last_error: Optional[str] = None

    while attempts <= max_retries:
        attempts += 1
        try:
            response = requests.post(
                target_url,
                json={"text": digest_text},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            if response.status_code == 200:
                logger.info(f"Slack digest successfully posted on attempt {attempts}.")
                return {
                    "status": "delivered",
                    "attempts": attempts,
                    "status_code": response.status_code,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            else:
                last_error = f"HTTP {response.status_code}: {response.text.strip()[:200]}"
                if attempts <= max_retries:
                    logger.warning(
                        f"Slack delivery attempt {attempts}/{max_retries + 1} failed ({last_error}). "
                        f"Retrying in {backoff:.1f}s..."
                    )
                    time.sleep(backoff)
                else:
                    logger.error(
                        f"Slack delivery failed after {attempts} attempts ({last_error}). "
                        f"Brief generation and database persistence completed unaffected."
                    )
        except Exception as e:
            last_error = str(e)
            if attempts <= max_retries:
                logger.warning(
                    f"Slack delivery attempt {attempts}/{max_retries + 1} encountered exception: {e}. "
                    f"Retrying in {backoff:.1f}s..."
                )
                time.sleep(backoff)
            else:
                logger.error(
                    f"Slack delivery encountered exception after {attempts} attempts: {e}. "
                    f"Disclosing failure in execution metadata without crashing pipeline."
                )

    return {
        "status": "failed",
        "attempts": attempts,
        "error": last_error or "Unknown delivery error",
        "fallback": "brief persisted to postgres and filesystem",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def run(
    synthesis_or_findings: Any,
    supervisor_decisions: Optional[Dict[str, Any]] = None,
    source_health: Optional[Dict[str, Any]] = None,
    trigger_mode: Optional[str] = None,
    cadence_name: Optional[str] = None,
    prior_research_activity: Any = _DEFAULT_RESEARCH_SENTINEL,
    webhook_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute digest generation and delivery."""
    digest_text = build_slack_digest(
        synthesis_or_findings=synthesis_or_findings,
        supervisor_decisions=supervisor_decisions,
        source_health=source_health,
        trigger_mode=trigger_mode,
        cadence_name=cadence_name,
        prior_research_activity=prior_research_activity,
    )
    delivery_status = post_slack_digest(digest_text, webhook_url=webhook_url)
    return {
        "digest_text": digest_text,
        "delivery_status": delivery_status,
    }
