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
from . import research_radar

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
    run_id: Optional[str]
    is_first_run: Optional[bool]
    progressive_findings: Dict[str, List[Dict[str, Any]]]


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


PIPELINE_SAFETY_CEILING_SECONDS = 2700.0  # 45 minutes safety ceiling


# ---------------------------------------------------------------------------
# Phase 1 - Node 2: Monitoring Node (Global Shared Fetch)
# ---------------------------------------------------------------------------

def monitoring_node(state: PipelineState) -> Dict[str, Any]:
    """
    Executes raw signal collection across active sources for all distinct tracked companies.
    Supports progressive per-company incremental ingestion when run_id is active:
    - Writes rows to DB as soon as any one company finishes fetching/consolidating.
    - Runs tenant-scoped analysis for that company immediately.
    - Records first visible data timestamp on the first company with queryable rows.
    - Enforces 45-minute safety ceiling.
    """
    logger.info("LangGraph Node 2/8 (Phase 1): Monitoring - Collecting raw signals across distinct companies...")
    companies = state.get("companies") or storage.get_all_tracked_companies()
    configured_sources = state.get("configured_sources") or list(config.SOURCES)
    supervisor_decisions = state.get("supervisor_decisions") or {}
    run_id = state.get("run_id")
    is_first_run = state.get("is_first_run", False)
    phase_timing = dict(state.get("phase_timing") or {})
    start_time = phase_timing.get("phase1_start") or time.time()
    tenants = _resolve_tenants(state)

    # Determine sources to run (excluding supervisor skips)
    active_sources = [
        s for s in configured_sources
        if supervisor_decisions.get(s, {}).get("action") != "skip"
    ]

    # Non-progressive legacy/test execution fallback (when no run_id is provided)
    if not run_id:
        signals, source_health = monitoring_agent.run(
            companies=companies,
            active_sources=active_sources,
            supervisor_decisions=supervisor_decisions,
            return_health=True,
        )
        storage.save_signals(signals, filepath=state.get("signals_storage_path"))
        logger.info(f"Monitoring completed: {len(signals)} raw signals collected for {len(companies)} companies.")
        try:
            topic_research_items = monitoring_agent.fetch_topic_research_items(days=14)
            if topic_research_items:
                logger.info(f"Phase 1: Ingested {len(topic_research_items)} global domain research items across active topics.")
        except Exception as e:
            logger.warning(f"Failed to fetch global topic research items: {e}")
        return {"raw_signals": signals, "source_health": source_health, "companies": companies}

    # Progressive execution with per-company incremental persistence
    all_signals: List[Dict[str, Any]] = []
    all_kept_signals: List[Dict[str, Any]] = []
    all_events: List[Dict[str, Any]] = []
    all_health: Dict[str, Any] = {}
    completed_names: List[str] = []
    progressive_findings: Dict[str, List[Dict[str, Any]]] = {}

    # For first-ever run: prioritize fast sources first (News, GitHub, Jobs)
    pass1_sources = [s for s in active_sources if s in monitoring_agent.FAST_SOURCES] if is_first_run else active_sources

    storage.update_pipeline_progress(
        run_id,
        phase="fetching_signals",
        message=f"Fetching signals: 0 of {len(companies)} competitors complete",
    )

    for comp in companies:
        # Check hard 45-minute timeout ceiling
        if (time.time() - start_time) > PIPELINE_SAFETY_CEILING_SECONDS:
            logger.warning(f"Pipeline exceeded {PIPELINE_SAFETY_CEILING_SECONDS}s ceiling. Marking run timed_out.")
            storage.complete_pipeline_run(run_id, status="timed_out", error_message="Pipeline run exceeded 45-minute safety ceiling.")
            break

        c_signals, c_health = monitoring_agent.fetch_company_signals(comp, active_sources=pass1_sources)
        all_signals.extend(c_signals)
        all_health.update(c_health)

        # 1. Immediately persist raw signals for this company
        if c_signals:
            storage.save_signals(c_signals, filepath=state.get("signals_storage_path"))

            # 2. Immediately run noise suppression for this company
            noise_res = noise_suppressor.run(c_signals)
            c_kept = noise_res["kept_signals"]
            all_kept_signals.extend(c_kept)
            storage.save_noise_decisions(noise_res.get("decisions", []))

            # 3. Immediately consolidate events for this company & persist
            if c_kept:
                c_events = event_consolidator.run(c_kept)
                all_events.extend(c_events)
                storage.save_events(c_events, filepath=state.get("events_storage_path"))

                # 4. Immediately run tenant analysis for any tenant tracking this company
                for t in tenants:
                    tid = t["tenant_id"]
                    tracked = t.get("tracked_companies") or ([t.get("target_company")] + t.get("competitors", []))
                    if comp in tracked or not tracked:
                        t_target = t.get("target_company", comp)
                        t_comps = t.get("competitors", [])
                        c_findings = analysis_agent.run(c_events, target_company=t_target, competitors=t_comps)
                        storage.save_findings(c_findings, tenant_id=tid)
                        progressive_findings.setdefault(tid, []).extend(c_findings)

                # Record first visible data timestamp on the first company with queryable rows
                storage.record_first_visible_data(run_id)

        completed_names.append(comp)
        msg = f"Fetching signals: {len(completed_names)} of {len(companies)} competitors complete"
        storage.update_pipeline_progress(
            run_id,
            phase="fetching_signals",
            completed_companies=len(completed_names),
            completed_company_names=completed_names,
            current_company=comp,
            message=msg,
            source_health=all_health,
        )

    # Pass 2: If first-ever run, execute deferred slower sources (pricing, research radar) in background
    if is_first_run:
        deferred_sources = [s for s in active_sources if s in monitoring_agent.SLOW_SOURCES]
        if deferred_sources:
            storage.update_pipeline_progress(
                run_id,
                phase="background_research",
                message="Gathering pricing and research radar sweeps in background...",
            )
            for comp in companies:
                if (time.time() - start_time) > PIPELINE_SAFETY_CEILING_SECONDS:
                    break
                def_sigs, def_health = monitoring_agent.fetch_company_signals(comp, active_sources=deferred_sources)
                all_health.update(def_health)
                if def_sigs:
                    all_signals.extend(def_sigs)
                    storage.save_signals(def_sigs)
                    n_res = noise_suppressor.run(def_sigs)
                    storage.save_noise_decisions(n_res.get("decisions", []))
                    if n_res["kept_signals"]:
                        def_events = event_consolidator.run(n_res["kept_signals"])
                        all_events.extend(def_events)
                        storage.save_events(def_events)
                        for t in tenants:
                            tid = t["tenant_id"]
                            tracked = t.get("tracked_companies") or ([t.get("target_company")] + t.get("competitors", []))
                            if comp in tracked or not tracked:
                                t_target = t.get("target_company", comp)
                                t_comps = t.get("competitors", [])
                                def_findings = analysis_agent.run(def_events, target_company=t_target, competitors=t_comps)
                                storage.save_findings(def_findings, tenant_id=tid)
                                progressive_findings.setdefault(tid, []).extend(def_findings)

    # Phase 1: Ingest shared domain research items across all active tenant topics
    try:
        topic_research_items = monitoring_agent.fetch_topic_research_items(days=14)
        if topic_research_items:
            logger.info(f"Phase 1: Ingested {len(topic_research_items)} global domain research items across active topics.")
    except Exception as e:
        logger.warning(f"Failed to fetch global topic research items: {e}")

    return {
        "raw_signals": all_signals,
        "kept_signals": all_kept_signals,
        "consolidated_events": all_events,
        "source_health": all_health,
        "companies": companies,
        "progressive_findings": progressive_findings,
    }


# ---------------------------------------------------------------------------
# Phase 1 - Node 3: Noise Suppression Node (Global Shared Filtering)
# ---------------------------------------------------------------------------

def noise_suppression_node(state: PipelineState) -> Dict[str, Any]:
    """Filters true raw noise upstream and persists suppression decisions globally."""
    logger.info("LangGraph Node 3/8 (Phase 1): Noise Suppression - Filtering low-value raw noise...")
    if state.get("kept_signals") is not None:
        return {
            "kept_signals": state.get("kept_signals", []),
            "noise_suppression_result": state.get("noise_suppression_result") or {"kept_signals": state.get("kept_signals", [])},
        }

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
    phase_timing = dict(state.get("phase_timing") or {})
    phase_timing["phase1_end"] = time.time()
    phase1_dur = phase_timing["phase1_end"] - phase_timing.get("phase1_start", phase_timing["phase1_end"])

    if state.get("consolidated_events") is not None:
        return {"consolidated_events": state.get("consolidated_events", []), "phase_timing": phase_timing}

    kept_signals = state.get("kept_signals", [])
    events = event_consolidator.run(kept_signals)

    storage.save_events(events, filepath=state.get("events_storage_path"))
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
    run_id = state.get("run_id")
    progressive_findings = state.get("progressive_findings") or {}

    tenant_results = dict(state.get("tenant_results") or {})
    primary_findings: List[Dict[str, Any]] = []

    for tenant in tenants:
        t0 = time.time()
        tid = tenant["tenant_id"]
        target = tenant.get("target_company", "Unknown")
        comps = tenant.get("competitors", [])
        tracked = tenant.get("tracked_companies") or ([target] + comps)
        is_owner = (tid == owner_id or len(tenants) == 1)

        # If findings were already computed progressively for this tenant, reuse them
        if tid in progressive_findings and progressive_findings[tid]:
            tenant_findings = progressive_findings[tid]
        else:
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

    if run_id:
        storage.update_pipeline_progress(
            run_id,
            phase="analyzing",
            message=f"Strategic impact analysis complete across {len(tenants)} active tenant contexts",
        )

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

        # Phase 2: Per-tenant Field Research Radar evaluation
        radar_evals = []
        try:
            tenant_topics = storage.get_tenant_research_topics(tid)
            if tenant_topics:
                topic_labels = [t["topic_label"] for t in tenant_topics]
                topic_items = storage.get_research_items_for_topics(topic_labels)
                comps = tdata.get("competitors") or [c for c in (tracked or []) if c != tdata.get("target_company")]
                pipeline_sigs = state.get("raw_signals", [])
                for top in tenant_topics:
                    ev = research_radar.evaluate_topic_radar(
                        topic=top,
                        research_items=topic_items,
                        competitors=comps,
                        pipeline_signals=pipeline_sigs,
                        source_health=source_health,
                        tenant_id=tid,
                    )
                    radar_evals.append(ev)
                storage.save_radar_evaluations(radar_evals, tenant_id=tid)
                tdata["radar_evaluations"] = radar_evals
        except Exception as e:
            logger.warning(f"Error evaluating research radar for tenant {tid}: {e}")

        t_report = report_agent.run(
            t_synthesis,
            supervisor_decisions=supervisor_decisions,
            source_health=source_health,
            trigger_mode=trigger_mode,
            cadence_name=cadence_name,
            tenant_id=tid,
            tracked_companies=tracked,
            radar_evaluations=radar_evals if radar_evals else None,
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

    run_id = state.get("run_id")
    if run_id:
        storage.complete_pipeline_run(run_id, status="completed")

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


def run_progressive_pipeline(
    tenant_id: Optional[str] = None,
    companies: Optional[List[str]] = None,
    sources: Optional[List[str]] = None,
    is_first_run: bool = False,
    output_report_path: Optional[Any] = None,
    signals_storage_path: Optional[Any] = None,
    events_storage_path: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Execute end-to-end monitoring pipeline with real progressive data persistence,
    honest run-state tracking, and fail-closed timeout protection.
    """
    tracked_comps = companies or storage.get_all_tracked_companies()
    active_tenants = storage.get_active_tenants()
    if tenant_id and not any(t.get("tenant_id") == tenant_id for t in active_tenants):
        t_comps = storage.load_confirmed_competitors(tenant_id)
        if t_comps:
            active_tenants = [{
                "tenant_id": tenant_id,
                "target_company": t_comps.get("target_company", "Unknown"),
                "competitors": t_comps.get("confirmed_competitors", []),
                "tracked_companies": [t_comps.get("target_company")] + t_comps.get("confirmed_competitors", []),
            }]

    run_id = storage.create_pipeline_run(
        tenant_id=tenant_id,
        total_companies=len(tracked_comps),
        companies=tracked_comps,
        sources=sources,
        is_first_run=is_first_run,
    )

    app = create_pipeline_graph()
    initial_state: PipelineState = {
        "run_id": run_id,
        "is_first_run": is_first_run,
        "target_company": config.TARGET_COMPANY,
        "competitors": list(config.COMPETITORS),
        "configured_sources": sources or list(config.SOURCES),
        "companies": tracked_comps,
        "tenants": active_tenants,
        "output_report_path": output_report_path,
        "signals_storage_path": signals_storage_path,
        "events_storage_path": events_storage_path,
    }

    try:
        final_state = app.invoke(initial_state)
        storage.complete_pipeline_run(run_id, status="completed")
        return dict(final_state)
    except Exception as e:
        logger.error(f"Progressive pipeline run {run_id} failed: {e}", exc_info=True)
        storage.complete_pipeline_run(run_id, status="failed", error_message=str(e))
        raise
