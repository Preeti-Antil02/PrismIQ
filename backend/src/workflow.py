"""
LangGraph State Machine for PrismIQ Competitive Intelligence Pipeline.

Orchestrates Multi-Tenant Architecture across two decoupled phases across 8 nodes:

PHASE 1 - GLOBAL SHARED FACT-GATHERING (once per real distinct company):
1. supervisor: Evaluates run conditions and skip policies across distinct tracked companies
   (e.g. 24h pricing freshness cadence).
2. monitoring: Fetches raw signals across sources with conditional retry and graceful fallback.
3. noise_suppression: Upstream filtering of automated/bot/formatting noise with audit decisions.
4. event_consolidation: Merges related multi-source signals into canonical events with root-signal
   identity stability and canonical fact_confidence computation.

PHASE 2 - PER-TENANT INTELLIGENCE (executed per active tenant):
5. analysis:
   - For each active tenant, filters shared consolidated events to that tenant's tracked companies.
   - Runs Analysis contextualized explicitly to that tenant's target company and competitor list.
     (Option A: Reads fact_confidence directly from the consolidated event; never recomputes it).
   - Dual-writes findings upserted on (tenant_id, event_id).
6. synthesis:
   - Runs Synthesis per tenant for cross-competitor theme and pattern rollups.
7. report:
   - Renders executive markdown brief per tenant with tenant-scoped research activity change detection.
   - Persists brief on (tenant_id, id).
8. delivery:
   - Runs Delivery scoped to each tenant's own delivery config (Slack webhook), skipping gracefully
     if no webhook is configured.
"""

import logging
import os
import time
from typing import Any, Dict, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END

from . import config
from . import monitoring_agent
from . import noise_suppressor
from . import event_consolidator
from . import analysis_agent
from . import synthesis_agent
from . import report_agent
from . import delivery_agent
from . import pricing_extractor
from . import storage

logger = logging.getLogger(__name__)


class PipelineState(TypedDict, total=False):
    # Configuration inputs
    target_company: str
    competitors: List[str]
    configured_sources: List[str]
    companies: List[str]
    tenants: List[Dict[str, Any]]

    # Supervisor & Execution Metadata
    supervisor_decisions: Dict[str, Any]
    source_health: Dict[str, Any]

    # Phase 1: Shared Global Fact Artifacts
    raw_signals: List[Dict[str, Any]]
    noise_suppression_result: Dict[str, Any]
    kept_signals: List[Dict[str, Any]]
    consolidated_events: List[Dict[str, Any]]

    # Phase 2: Per-Tenant Intelligence Artifacts
    tenant_results: Dict[str, Dict[str, Any]]

    # Primary / Owner Tenant Compatibility Artifacts
    findings: List[Dict[str, Any]]
    synthesis: Dict[str, Any]
    report_content: str
    saved_brief_path: str
    slack_digest: str
    delivery_status: Dict[str, Any]
    output_report_path: Optional[Any]
    signals_storage_path: Optional[Any]
    events_storage_path: Optional[Any]
    trigger_mode: Optional[str]
    cadence_name: Optional[str]
    phase_timing: Dict[str, Any]
    slack_webhook_url: Optional[str]


def _resolve_tenants(state: PipelineState) -> List[Dict[str, Any]]:
    """Helper to resolve the list of active tenant configuration contexts."""
    tenants = state.get("tenants")
    if not tenants:
        tenants = storage.get_active_tenants()

    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    # If state explicitly provided target_company/competitors override (e.g. test fixtures)
    if not tenants or (state.get("target_company") and len(tenants) == 1 and tenants[0]["target_company"] != state.get("target_company")):
        target = state.get("target_company") or config.TARGET_COMPANY
        comps = state.get("competitors") or list(config.COMPETITORS)
        tenants = [{
            "tenant_id": owner_id,
            "target_company": target,
            "competitors": comps,
            "tracked_companies": [target] + comps,
            "slack_webhook_url": state.get("slack_webhook_url") or config.SLACK_WEBHOOK_URL or None,
            "delivery_cadence": state.get("cadence_name") or config.SCHEDULE_CADENCE_NAME,
            "is_delivery_enabled": True,
        }]

    return tenants


# ---------------------------------------------------------------------------
# Phase 1 - Node 1: Supervisor Decision Node (Global)
# ---------------------------------------------------------------------------

def supervisor_node(state: PipelineState) -> Dict[str, Any]:
    """
    Evaluates per-cycle run conditions and skip policies across distinct tracked companies.
    - Pricing: Checks whether snapshots for all tracked companies are fresh (< 24.0h old).
      If fresh, skips pricing scrape to avoid unnecessary headless browser overhead.
      If stale or missing, schedules pricing scrape.
    """
    logger.info("LangGraph Node 1/8 (Phase 1): Supervisor evaluating cycle run policies across tracked companies...")
    phase_timing = dict(state.get("phase_timing") or {})
    phase_timing["phase1_start"] = time.time()
    companies = state.get("companies") or storage.get_all_tracked_companies()
    configured_sources = state.get("configured_sources") or list(config.SOURCES)

    supervisor_decisions: Dict[str, Any] = {}

    if "pricing" in configured_sources:
        is_fresh, reason, ages = pricing_extractor.check_pricing_freshness(companies, threshold_hours=24.0)
        if is_fresh:
            supervisor_decisions["pricing"] = {
                "action": "skip",
                "reason": reason,
                "threshold_hours": 24.0,
                "snapshot_ages": ages,
            }
            logger.info(f"Supervisor Decision: SKIPPING pricing source this cycle ({reason}).")
        else:
            supervisor_decisions["pricing"] = {
                "action": "run",
                "reason": reason,
                "threshold_hours": 24.0,
                "snapshot_ages": ages,
            }
            logger.info(f"Supervisor Decision: RUNNING pricing source this cycle ({reason}).")

    return {
        "supervisor_decisions": supervisor_decisions,
        "companies": companies,
        "configured_sources": configured_sources,
        "phase_timing": phase_timing,
    }


# ---------------------------------------------------------------------------
# Phase 1 - Node 2: Monitoring Node (Global Shared Fetch)
# ---------------------------------------------------------------------------

def monitoring_node(state: PipelineState) -> Dict[str, Any]:
    """
    Executes raw signal collection across active sources for all distinct tracked companies.
    Runs with conditional retry on transient failures and graceful fallback.
    """
    logger.info("LangGraph Node 2/8 (Phase 1): Monitoring - Collecting raw signals across distinct companies...")
    companies = state.get("companies") or storage.get_all_tracked_companies()
    configured_sources = state.get("configured_sources") or list(config.SOURCES)
    supervisor_decisions = state.get("supervisor_decisions") or {}

    # Determine sources to run (excluding supervisor skips)
    active_sources = [
        s for s in configured_sources
        if supervisor_decisions.get(s, {}).get("action") != "skip"
    ]

    signals, source_health = monitoring_agent.run(
        companies=companies,
        active_sources=active_sources,
        supervisor_decisions=supervisor_decisions,
        return_health=True,
    )

    # Persist raw signals (dual-write to global raw_signals table)
    storage.save_signals(signals, filepath=state.get("signals_storage_path"))
    logger.info(f"Monitoring completed: {len(signals)} raw signals collected for {len(companies)} companies.")

    return {"raw_signals": signals, "source_health": source_health, "companies": companies}


# ---------------------------------------------------------------------------
# Phase 1 - Node 3: Noise Suppression Node (Global Shared Filtering)
# ---------------------------------------------------------------------------

def noise_suppression_node(state: PipelineState) -> Dict[str, Any]:
    """Filters true raw noise upstream and persists suppression decisions globally."""
    logger.info("LangGraph Node 3/8 (Phase 1): Noise Suppression - Filtering low-value raw noise...")
    raw_signals = state.get("raw_signals", [])
    noise_result = noise_suppressor.run(raw_signals)

    kept_signals = noise_result["kept_signals"]
    decisions = noise_result.get("decisions", [])
    storage.save_noise_decisions(decisions)

    logger.info(f"Noise Suppression: {len(kept_signals)}/{len(raw_signals)} signals kept.")
    return {
        "kept_signals": kept_signals,
        "noise_suppression_result": noise_result,
    }


# ---------------------------------------------------------------------------
# Phase 1 - Node 4: Event Consolidation Node (Global Canonical Fact Layer)
# ---------------------------------------------------------------------------

def event_consolidation_node(state: PipelineState) -> Dict[str, Any]:
    """
    Clusters multi-source signals into canonical events with root-signal anchoring.
    Computes single canonical fact_confidence on consolidated_events per Option A schema.
    """
    logger.info("LangGraph Node 4/8 (Phase 1): Event Consolidation - Clustering signals into canonical events...")
    kept_signals = state.get("kept_signals", [])
    events = event_consolidator.run(kept_signals)

    storage.save_events(events, filepath=state.get("events_storage_path"))
    phase_timing = dict(state.get("phase_timing") or {})
    phase_timing["phase1_end"] = time.time()
    phase1_dur = phase_timing["phase1_end"] - phase_timing.get("phase1_start", phase_timing["phase1_end"])
    logger.info(f"Event Consolidation: {len(kept_signals)} signals consolidated into {len(events)} events.")
    logger.info(f"Phase 1 (Global Shared Fact-Gathering) completed in {phase1_dur:.1f}s.")
    return {"consolidated_events": events, "phase_timing": phase_timing}


# ---------------------------------------------------------------------------
# Phase 2 - Node 5: Analysis Node (Per-Tenant Scoped)
# ---------------------------------------------------------------------------

def analysis_node(state: PipelineState) -> Dict[str, Any]:
    """
    Evaluates strategic impact per active tenant:
    - Filters consolidated events to the tenant's tracked companies.
    - Contextualizes LLM prompt to tenant's target company and competitor list.
    - Option A: Reads fact_confidence from consolidated_events (never recomputes it).
    - Persists findings scoped by tenant_id on (tenant_id, event_id).
    """
    logger.info("LangGraph Node 5/8 (Phase 2): Analysis - Evaluating strategic impact per active tenant...")
    phase_timing = dict(state.get("phase_timing") or {})
    phase_timing["phase2_start"] = time.time()
    events = state.get("consolidated_events", [])
    tenants = _resolve_tenants(state)
    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    tenant_results = dict(state.get("tenant_results") or {})
    primary_findings: List[Dict[str, Any]] = []

    for tenant in tenants:
        t0 = time.time()
        tid = tenant["tenant_id"]
        target = tenant.get("target_company", "Unknown")
        comps = tenant.get("competitors", [])
        tracked = tenant.get("tracked_companies") or ([target] + comps)
        is_owner = (tid == owner_id or len(tenants) == 1)

        # Filter shared consolidated events belonging to ANY company this tenant tracks
        tenant_events = [
            e for e in events
            if e.get("company") in tracked or not tracked
        ]

        tenant_findings = analysis_agent.run(
            tenant_events,
            target_company=target,
            competitors=comps,
        )
        storage.save_findings(tenant_findings, tenant_id=tid)

        if tid not in tenant_results:
            tenant_results[tid] = {"tenant_id": tid, "target_company": target, "competitors": comps, "tracked_companies": tracked}
        tenant_results[tid]["findings"] = tenant_findings

        if is_owner or not primary_findings:
            primary_findings = tenant_findings

        phase_timing.setdefault("tenant_timing", {}).setdefault(tid, 0.0)
        phase_timing["tenant_timing"][tid] += (time.time() - t0)

    logger.info(f"Analysis completed across {len(tenants)} active tenants.")
    return {"findings": primary_findings, "tenant_results": tenant_results, "tenants": tenants, "phase_timing": phase_timing}


# ---------------------------------------------------------------------------
# Phase 2 - Node 6: Synthesis Node (Per-Tenant Scoped)
# ---------------------------------------------------------------------------

def synthesis_node(state: PipelineState) -> Dict[str, Any]:
    """Performs cross-competitor theme rollups and pattern detection per active tenant."""
    logger.info("LangGraph Node 6/8 (Phase 2): Synthesis - Cross-competitor theme and pattern rollup per tenant...")
    tenant_results = dict(state.get("tenant_results") or {})
    phase_timing = dict(state.get("phase_timing") or {})
    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")
    primary_synthesis: Dict[str, Any] = {}

    if not tenant_results:
        # Fallback for direct standalone node call with top-level findings
        findings = state.get("findings", [])
        primary_synthesis = synthesis_agent.run(findings)
        return {"synthesis": primary_synthesis}

    for tid, tdata in tenant_results.items():
        t0 = time.time()
        t_findings = tdata.get("findings", [])
        t_synthesis = synthesis_agent.run(t_findings)
        tdata["synthesis"] = t_synthesis
        is_owner = (tid == owner_id or len(tenant_results) == 1)
        if is_owner or not primary_synthesis:
            primary_synthesis = t_synthesis
        phase_timing.setdefault("tenant_timing", {}).setdefault(tid, 0.0)
        phase_timing["tenant_timing"][tid] += (time.time() - t0)

    logger.info(f"Synthesis completed across {len(tenant_results)} active tenants.")
    return {"synthesis": primary_synthesis, "tenant_results": tenant_results, "phase_timing": phase_timing}


# ---------------------------------------------------------------------------
# Phase 2 - Node 7: Report Node (Per-Tenant Scoped)
# ---------------------------------------------------------------------------

def report_node(state: PipelineState) -> Dict[str, Any]:
    """Renders executive brief per tenant with tenant-scoped research activity change detection."""
    logger.info("LangGraph Node 7/8 (Phase 2): Report - Generating executive markdown brief per tenant...")
    tenant_results = dict(state.get("tenant_results") or {})
    phase_timing = dict(state.get("phase_timing") or {})
    supervisor_decisions = state.get("supervisor_decisions", {})
    source_health = state.get("source_health", {})
    trigger_mode = state.get("trigger_mode") or os.getenv("PIPELINE_TRIGGER_MODE", config.TRIGGER_MODE)
    cadence_name = state.get("cadence_name") or config.SCHEDULE_CADENCE_NAME
    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")

    if not tenant_results:
        # Fallback for standalone node call
        synthesis = state.get("synthesis", {})
        report_content = report_agent.run(
            synthesis,
            supervisor_decisions=supervisor_decisions,
            source_health=source_health,
            trigger_mode=trigger_mode,
            cadence_name=cadence_name,
        )
        saved_path = storage.save_brief(report_content, filepath=state.get("output_report_path"))
        return {"report_content": report_content, "saved_brief_path": str(saved_path)}

    primary_report = ""
    primary_saved_path = ""

    for tid, tdata in tenant_results.items():
        t0 = time.time()
        t_synthesis = tdata.get("synthesis", {})
        tracked = tdata.get("tracked_companies")
        is_owner = (tid == owner_id or len(tenant_results) == 1)

        t_report = report_agent.run(
            t_synthesis,
            supervisor_decisions=supervisor_decisions,
            source_health=source_health,
            trigger_mode=trigger_mode,
            cadence_name=cadence_name,
            tenant_id=tid,
            tracked_companies=tracked,
        )

        custom_path = state.get("output_report_path") if is_owner else None
        saved_path = storage.save_brief(
            t_report,
            filepath=custom_path,
            tenant_id=tid,
        )

        tdata["report_content"] = t_report
        tdata["saved_brief_path"] = str(saved_path)

        if is_owner or not primary_report:
            primary_report = t_report
            primary_saved_path = str(saved_path)

        phase_timing.setdefault("tenant_timing", {}).setdefault(tid, 0.0)
        phase_timing["tenant_timing"][tid] += (time.time() - t0)

    logger.info(f"Report generation completed across {len(tenant_results)} active tenants.")
    return {
        "report_content": primary_report,
        "saved_brief_path": primary_saved_path,
        "tenant_results": tenant_results,
        "phase_timing": phase_timing,
    }


# ---------------------------------------------------------------------------
# Phase 2 - Node 8: Delivery Node (Per-Tenant Scoped)
# ---------------------------------------------------------------------------

def delivery_node(state: PipelineState) -> Dict[str, Any]:
    """
    Posts condensed daily intelligence digest to Slack per tenant webhook.
    Strictly isolated: delivery failure or missing webhook URL never crashes the pipeline.
    """
    logger.info("LangGraph Node 8/8 (Phase 2): Delivery - Posting intelligence digest to Slack per tenant...")
    tenant_results = dict(state.get("tenant_results") or {})
    supervisor_decisions = state.get("supervisor_decisions", {})
    source_health = state.get("source_health", {})
    trigger_mode = state.get("trigger_mode") or os.getenv("PIPELINE_TRIGGER_MODE", config.TRIGGER_MODE)
    cadence_name = state.get("cadence_name") or config.SCHEDULE_CADENCE_NAME
    owner_id = os.getenv("OWNER_TENANT_ID", "c8f13b91-46ef-4682-9975-f85764d8a12e")
    tenants = state.get("tenants") or []
    tenant_cfg_map = {t["tenant_id"]: t for t in tenants if t.get("tenant_id")}

    if not tenant_results:
        # Fallback for standalone node call
        synthesis = state.get("synthesis", {})
        webhook_url = state.get("slack_webhook_url") or config.SLACK_WEBHOOK_URL
        delivery_result = delivery_agent.run(
            synthesis_or_findings=synthesis,
            supervisor_decisions=supervisor_decisions,
            source_health=source_health,
            trigger_mode=trigger_mode,
            cadence_name=cadence_name,
            webhook_url=webhook_url,
        )
        return {
            "slack_digest": delivery_result.get("digest_text", ""),
            "delivery_status": delivery_result.get("delivery_status", {}),
        }

    primary_digest = ""
    primary_delivery_status: Dict[str, Any] = {}
    phase_timing = dict(state.get("phase_timing") or {})

    for tid, tdata in tenant_results.items():
        t0 = time.time()
        t_synthesis = tdata.get("synthesis", {})
        cfg = tenant_cfg_map.get(tid, {})
        webhook_url = cfg.get("slack_webhook_url") if cfg else (state.get("slack_webhook_url") if tid == owner_id else None)
        is_owner = (tid == owner_id or len(tenant_results) == 1)

        t_delivery = delivery_agent.run(
            synthesis_or_findings=t_synthesis,
            supervisor_decisions=supervisor_decisions,
            source_health=source_health,
            trigger_mode=trigger_mode,
            cadence_name=cadence_name,
            webhook_url=webhook_url,
        )

        tdata["slack_digest"] = t_delivery.get("digest_text", "")
        tdata["delivery_status"] = t_delivery.get("delivery_status", {})

        status = t_delivery.get("delivery_status", {}).get("status", "unknown")
        logger.info(f"Delivery [Tenant {tid}]: Slack digest status: {status}")

        if is_owner or not primary_digest:
            primary_digest = t_delivery.get("digest_text", "")
            primary_delivery_status = t_delivery.get("delivery_status", {})

        phase_timing.setdefault("tenant_timing", {}).setdefault(tid, 0.0)
        phase_timing["tenant_timing"][tid] += (time.time() - t0)

    phase_timing["phase2_end"] = time.time()
    phase2_dur = phase_timing["phase2_end"] - phase_timing.get("phase2_start", phase_timing["phase2_end"])
    phase_timing["phase2_duration"] = phase2_dur
    phase_timing["phase1_duration"] = phase_timing.get("phase1_end", 0) - phase_timing.get("phase1_start", 0)
    logger.info(f"Phase 2 (Per-Tenant Intelligence) completed in {phase2_dur:.1f}s.")
    return {
        "slack_digest": primary_digest,
        "delivery_status": primary_delivery_status,
        "tenant_results": tenant_results,
        "phase_timing": phase_timing,
    }


# ---------------------------------------------------------------------------
# Graph Compilation
# ---------------------------------------------------------------------------

def create_pipeline_graph():
    """Build and compile the LangGraph StateGraph pipeline with all 8 nodes."""
    graph = StateGraph(PipelineState)

    # Register Phase 1 Nodes (Global Fact-Gathering)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("monitoring", monitoring_node)
    graph.add_node("noise_suppression", noise_suppression_node)
    graph.add_node("event_consolidation", event_consolidation_node)

    # Register Phase 2 Nodes (Per-Tenant Intelligence)
    graph.add_node("analysis", analysis_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("report", report_node)
    graph.add_node("delivery", delivery_node)

    # Define Linear State Machine Edges
    graph.add_edge(START, "supervisor")
    graph.add_edge("supervisor", "monitoring")
    graph.add_edge("monitoring", "noise_suppression")
    graph.add_edge("noise_suppression", "event_consolidation")
    graph.add_edge("event_consolidation", "analysis")
    graph.add_edge("analysis", "synthesis")
    graph.add_edge("synthesis", "report")
    graph.add_edge("report", "delivery")
    graph.add_edge("delivery", END)

    return graph.compile()
