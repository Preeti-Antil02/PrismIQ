"""
LangGraph State Machine for PrismIQ Competitive Intelligence Pipeline.

Orchestrates Stage 1/2 pipeline execution across 7 nodes:
1. supervisor: Evaluates run conditions and skip policies per cycle (e.g. 24h pricing freshness cadence).
2. monitoring: Fetches raw signals across sources with conditional retry on transient failures and graceful fallback.
3. noise_suppression: Upstream filtering of automated/bot/formatting noise with persistent audit metrics.
4. event_consolidation: Merges related multi-source signals into canonical events with root-signal identity stability.
5. analysis: Evaluates strategic impact and generates 'Why It Matters' intelligence.
6. synthesis: Cross-competitor pattern detection and theme rollups.
7. report: Renders theme-organized markdown brief with explicit health and supervisor disclosures.
"""

import logging
import os
from typing import Any, Dict, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END

from . import config
from . import monitoring_agent
from . import noise_suppressor
from . import event_consolidator
from . import analysis_agent
from . import synthesis_agent
from . import report_agent
from . import pricing_extractor
from . import storage

logger = logging.getLogger(__name__)


class PipelineState(TypedDict, total=False):
    # Configuration inputs
    target_company: str
    competitors: List[str]
    configured_sources: List[str]
    companies: List[str]

    # Supervisor & Execution Metadata
    supervisor_decisions: Dict[str, Any]
    source_health: Dict[str, Any]

    # Stage Artifacts
    raw_signals: List[Dict[str, Any]]
    noise_suppression_result: Dict[str, Any]
    kept_signals: List[Dict[str, Any]]
    consolidated_events: List[Dict[str, Any]]
    findings: List[Dict[str, Any]]
    synthesis: Dict[str, Any]
    report_content: str
    saved_brief_path: str
    output_report_path: Optional[Any]
    signals_storage_path: Optional[Any]
    events_storage_path: Optional[Any]
    trigger_mode: Optional[str]
    cadence_name: Optional[str]


# ---------------------------------------------------------------------------
# Node 1: Supervisor Decision Node
# ---------------------------------------------------------------------------

def supervisor_node(state: PipelineState) -> Dict[str, Any]:
    """
    Evaluates per-cycle run conditions and skip policies.
    - Pricing: Checks whether snapshots for all tracked companies are fresh (< 24.0h old).
      If fresh, skips pricing scrape to avoid unnecessary headless browser overhead.
      If stale or missing, schedules pricing scrape.
    """
    logger.info("LangGraph Node 1/7: Supervisor evaluating cycle run policies...")
    companies = state.get("companies") or [config.TARGET_COMPANY] + config.COMPETITORS
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
    }


# ---------------------------------------------------------------------------
# Node 2: Monitoring Node (with Per-Source Conditional Retry & Fallback)
# ---------------------------------------------------------------------------

def monitoring_node(state: PipelineState) -> Dict[str, Any]:
    """
    Executes raw signal collection across active sources with conditional retry on failure.
    If a source fails after retry, continues with healthy sources and records structured failure metadata.
    """
    logger.info("LangGraph Node 2/7: Monitoring - Collecting raw signals with retry & fallback...")
    companies = state.get("companies") or [config.TARGET_COMPANY] + config.COMPETITORS
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

    # Persist raw signals (dual-write)
    storage.save_signals(signals, filepath=state.get("signals_storage_path"))
    logger.info(f"Monitoring completed: {len(signals)} raw signals collected across sources.")

    return {"raw_signals": signals, "source_health": source_health}


# ---------------------------------------------------------------------------
# Node 3: Noise Suppression Node
# ---------------------------------------------------------------------------

def noise_suppression_node(state: PipelineState) -> Dict[str, Any]:
    """Filters true raw noise upstream and persists suppression decisions."""
    logger.info("LangGraph Node 3/7: Noise Suppression - Filtering low-value raw noise...")
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
# Node 4: Event Consolidation Node
# ---------------------------------------------------------------------------

def event_consolidation_node(state: PipelineState) -> Dict[str, Any]:
    """Clusters multi-source signals into canonical events with root-signal anchoring."""
    logger.info("LangGraph Node 4/7: Event Consolidation - Clustering signals into events...")
    kept_signals = state.get("kept_signals", [])
    events = event_consolidator.run(kept_signals)

    storage.save_events(events, filepath=state.get("events_storage_path"))
    logger.info(f"Event Consolidation: {len(kept_signals)} signals consolidated into {len(events)} events.")
    return {"consolidated_events": events}


# ---------------------------------------------------------------------------
# Node 5: Analysis Node
# ---------------------------------------------------------------------------

def analysis_node(state: PipelineState) -> Dict[str, Any]:
    """Analyzes events for strategic impact and 'Why It Matters' insights."""
    logger.info("LangGraph Node 5/7: Analysis - Evaluating strategic impact of events...")
    events = state.get("consolidated_events", [])
    findings = analysis_agent.run(events)

    storage.save_findings(findings)
    logger.info(f"Analysis: {len(findings)} findings produced and persisted.")
    return {"findings": findings}


# ---------------------------------------------------------------------------
# Node 6: Synthesis Node
# ---------------------------------------------------------------------------

def synthesis_node(state: PipelineState) -> Dict[str, Any]:
    """Performs cross-competitor theme rollups and strict pattern detection."""
    logger.info("LangGraph Node 6/7: Synthesis - Cross-competitor theme and pattern rollup...")
    findings = state.get("findings", [])
    synthesis = synthesis_agent.run(findings)
    logger.info(f"Synthesis: {len(synthesis.get('themes', {}))} strategic themes synthesized.")
    return {"synthesis": synthesis}


# ---------------------------------------------------------------------------
# Node 7: Report Node (Never Skipped)
# ---------------------------------------------------------------------------

def report_node(state: PipelineState) -> Dict[str, Any]:
    """Renders executive brief with explicit health and supervisor disclosures."""
    logger.info("LangGraph Node 7/7: Report - Generating executive markdown intelligence brief...")
    synthesis = state.get("synthesis", {})
    supervisor_decisions = state.get("supervisor_decisions", {})
    source_health = state.get("source_health", {})
    trigger_mode = state.get("trigger_mode") or os.getenv("PIPELINE_TRIGGER_MODE", config.TRIGGER_MODE)
    cadence_name = state.get("cadence_name") or config.SCHEDULE_CADENCE_NAME

    report_content = report_agent.run(
        synthesis,
        supervisor_decisions=supervisor_decisions,
        source_health=source_health,
        trigger_mode=trigger_mode,
        cadence_name=cadence_name,
    )

    saved_path = storage.save_brief(report_content, filepath=state.get("output_report_path"))
    logger.info(f"Report: Brief generated and persisted to {saved_path}")
    return {"report_content": report_content, "saved_brief_path": str(saved_path)}


# ---------------------------------------------------------------------------
# Graph Compilation
# ---------------------------------------------------------------------------

def create_pipeline_graph():
    """Build and compile the LangGraph StateGraph pipeline."""
    graph = StateGraph(PipelineState)

    # Register Nodes
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("monitoring", monitoring_node)
    graph.add_node("noise_suppression", noise_suppression_node)
    graph.add_node("event_consolidation", event_consolidation_node)
    graph.add_node("analysis", analysis_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("report", report_node)

    # Define Linear State Machine Edges
    graph.add_edge(START, "supervisor")
    graph.add_edge("supervisor", "monitoring")
    graph.add_edge("monitoring", "noise_suppression")
    graph.add_edge("noise_suppression", "event_consolidation")
    graph.add_edge("event_consolidation", "analysis")
    graph.add_edge("analysis", "synthesis")
    graph.add_edge("synthesis", "report")
    graph.add_edge("report", END)

    return graph.compile()
