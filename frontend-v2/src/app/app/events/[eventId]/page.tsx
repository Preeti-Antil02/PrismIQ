"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEvidenceDrawer } from "@/components/layout/AppShell";
import {
  fetchEventDetail,
  type ConsolidatedEventRecord,
} from "@/lib/api";
import { ConfidenceBadge, type ConfidenceScore } from "@/components/primitives/ConfidenceBadge";
import { TierBadge, type TierType } from "@/components/primitives/TierBadge";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";
import {
  LoadingState,
  ErrorState,
} from "@/components/states";
import { normalizeConfidence } from "@/lib/tokens";
import { formatRelativeTime } from "@/lib/timeUtils";
import { parseEvidenceCount } from "@/lib/evidenceUtils";
import { detectEventCategory } from "@/components/events/EventTimelineCard";
import {
  ArrowLeft,
  GitFork,
  Layers,
  ExternalLink,
  ShieldCheck,
  Compass,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Code,
  Globe,
  Briefcase,
  DollarSign,
  FileText,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getSourceMeta(src?: string): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  const s = (src || "").toLowerCase();
  if (s.includes("github") || s.includes("git")) {
    return { label: "GitHub", icon: Code };
  }
  if (s.includes("job") || s.includes("career") || s.includes("hiring")) {
    return { label: "Jobs", icon: Briefcase };
  }
  if (s.includes("pricing") || s.includes("price") || s.includes("billing")) {
    return { label: "Pricing", icon: DollarSign };
  }
  if (s.includes("news") || s.includes("article") || s.includes("press")) {
    return { label: "News", icon: Globe };
  }
  return { label: src || "Research", icon: FileText };
}

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const { openDrawer } = useEvidenceDrawer();

  const [event, setEvent] = React.useState<ConsolidatedEventRecord | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isInferenceExpanded, setIsInferenceExpanded] = React.useState<boolean>(false);

  const loadEvent = React.useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEventDetail(eventId);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || "Failed to load event consolidation tree.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleOpenDrawer = (selectedSignalId?: string) => {
    if (!event) return;
    const factConf = normalizeConfidence(event.fact_confidence) as ConfidenceScore;
    const sourcesList = event.contributing_sources?.length
      ? event.contributing_sources
      : ["Primary Event Record"];

    openDrawer({
      id: event.event_id,
      title: event.title,
      company: event.company_name,
      timestamp: event.published_timestamp || event.published_at || "Recent cycle",
      tier: (event.tier as TierType) || "Nice-to-Know",
      confidence: factConf,
      factualConfidence: factConf,
      factualRationale:
        event.raw_excerpt ||
        event.event_summary ||
        `Ground truth observation consolidated from ${sourcesList.join(", ")}.`,
      inferenceConfidence:
        (normalizeConfidence(event.inference_confidence) as ConfidenceScore) || "Medium",
      inferenceRationale:
        event.why_it_matters &&
        !event.why_it_matters.toLowerCase().includes("rate limit") &&
        !event.why_it_matters.toLowerCase().includes("analysis unavailable")
          ? event.why_it_matters
          : "Preliminary observation synthesized against competitor profile under active monitoring.",
      factSummary: event.event_summary || event.title,
      whyItMatters:
        event.why_it_matters &&
        !event.why_it_matters.toLowerCase().includes("rate limit") &&
        !event.why_it_matters.toLowerCase().includes("analysis unavailable")
          ? event.why_it_matters
          : event.event_summary ||
            `Real-world consolidated event for ${event.company_name} clustered across ${sourcesList.join(", ")}.`,
      implication:
        event.why_it_matters &&
        !event.why_it_matters.toLowerCase().includes("rate limit") &&
        !event.why_it_matters.toLowerCase().includes("analysis unavailable")
          ? `May signal shifts in competitive velocity or feature parity for ${event.company_name}. Continue monitoring related channels.`
          : undefined,
      records: sourcesList.map((src, i) => ({
        id: `rec-${event.event_id}-${i}`,
        source: src,
        sourceType: src,
        url: event.url,
        timestamp: event.published_timestamp || event.published_at,
        extractedText: event.raw_excerpt || event.event_summary || event.title,
        isPrimary: i === 0,
      })),
      corroboratingSources: sourcesList.length > 1 ? sourcesList.slice(1) : undefined,
    });
  };

  const category = event
    ? detectEventCategory(event.title, event.event_summary, event.contributing_sources)
    : { id: "PRODUCT", label: "PRODUCT & LAUNCH", icon: Sparkles, badgeClass: "", dotColor: "" };
  const CategoryIcon = category.icon;

  const timeInfo = event
    ? formatRelativeTime(event.published_timestamp || event.published_at || event.latest_detected_at)
    : { relative: "", full: "" };

  const sigCount = event?.contributing_signals?.length || event?.corroboration_count || 1;
  const isMulti = sigCount > 1;
  const evidenceCount = parseEvidenceCount(sigCount, 1);
  const factConf = normalizeConfidence(event?.fact_confidence) as ConfidenceScore;

  const hasValidInference = Boolean(
    event?.why_it_matters &&
    !event.why_it_matters.toLowerCase().includes("rate limit") &&
    !event.why_it_matters.toLowerCase().includes("analysis unavailable") &&
    !event.why_it_matters.toLowerCase().includes("analysis failed")
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* 1. Breadcrumb Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <Link
          href="/app/events"
          className="inline-flex items-center gap-2 text-xs font-mono font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-zinc-500" />
          <span>Back to Event Intelligence</span>
        </Link>

        {event && (
          <button
            type="button"
            onClick={() => handleOpenDrawer()}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-[4px] bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors cursor-pointer"
          >
            <span>Inspect Evidence Drawer</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState layout="detail" />
      ) : error || !event ? (
        <ErrorState
          title="Event Consolidation Tree Not Found"
          message={error || `Could not find event ${eventId}.`}
          onRetry={loadEvent}
        />
      ) : (
        <div className="space-y-6">
          {/* 2. Compact Event Context Bar: Company + Category + Date */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Company Logo & Clean Name */}
              <div className="flex items-center gap-2">
                <CompanyLogo company={event.company_name} variant="mini" />
                <span className="font-semibold text-sm text-white tracking-tight">
                  {event.company_name}
                </span>
              </div>

              <span className="text-zinc-600">·</span>

              {/* Category Badge */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-semibold tracking-wider border",
                  category.badgeClass
                )}
              >
                <CategoryIcon className="h-2.5 w-2.5" />
                <span>{category.label}</span>
              </span>

              <span className="text-zinc-600">·</span>

              {/* Confidence & Tier Badges */}
              <div className="flex items-center gap-2">
                <ConfidenceBadge confidence={factConf} />
                {event.tier && event.tier !== "Nice-to-Know" && (
                  <TierBadge tier={event.tier as TierType} />
                )}
              </div>
            </div>

            {/* Relative Timestamp */}
            <div
              className="text-xs font-mono text-zinc-400 flex items-center gap-1.5 self-start sm:self-auto"
              title={timeInfo.full}
            >
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>{timeInfo.relative}</span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. CENTERED EVIDENCE GRAPH: ROOT EVENT -> BRANCHES -> SIGNALS */}
          {/* ========================================================= */}
          <div className="rounded-[8px] border border-white/[0.08] bg-[#0A0D14] p-5 sm:p-8 shadow-sm space-y-8 relative overflow-hidden">
            {/* Ambient Background Gradient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-violet-500/5 to-transparent pointer-events-none blur-2xl" />

            {/* FOCAL POINT: ROOT CONSOLIDATED EVENT */}
            <div className="max-w-3xl mx-auto rounded-[6px] border border-white/[0.12] bg-[#0D1117] p-5 sm:p-6 shadow-md relative space-y-4">
              {/* Header: Root Event Label + Subtle Internal ID */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-violet-500/20 text-violet-400 border border-violet-500/30">
                    <GitFork className="h-3 w-3" />
                  </span>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-violet-300">
                    Root Consolidated Event
                  </span>
                </div>
                {/* Internal ID as subtle metadata */}
                <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.02] border border-white/[0.05] px-2 py-0.5 rounded-[3px]">
                  {event.event_id}
                </span>
              </div>

              {/* Title & Factual Context */}
              <div className="space-y-1.5">
                <h1 className="text-base sm:text-lg font-semibold text-white leading-snug tracking-tight">
                  {event.title}
                </h1>
                {event.event_summary && (
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {event.event_summary}
                  </p>
                )}
              </div>

              {/* Evidence Consolidation Status */}
              <div
                className={cn(
                  "rounded-[5px] p-3 space-y-1.5 transition-colors",
                  isMulti
                    ? "bg-gradient-to-r from-cyan-950/30 via-[#161B22]/90 to-[#10141D] border border-cyan-500/30 shadow-[0_0_16px_-4px_rgba(6,182,212,0.12)]"
                    : "bg-[#141822]/70 border border-white/[0.06]"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-semibold",
                      isMulti ? "text-cyan-300 font-bold" : "text-zinc-400"
                    )}
                  >
                    <Layers
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isMulti ? "text-cyan-400" : "text-zinc-500"
                      )}
                    />
                    <span>
                      SUPPORTED BY {sigCount} {sigCount === 1 ? "SIGNAL" : "SIGNALS"}
                    </span>
                    {isMulti && (
                      <span className="ml-1 px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-[3px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Corroborated
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-mono",
                      isMulti
                        ? "text-cyan-200 font-semibold bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded-[3px]"
                        : "text-zinc-400"
                    )}
                  >
                    {evidenceCount.badgeLabel}
                  </span>
                </div>
              </div>

              {/* Strategic Inference (Optional Expandable Block) */}
              {hasValidInference && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsInferenceExpanded(!isInferenceExpanded)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-violet-300 hover:text-violet-200 transition-colors py-1 px-2 rounded-[4px] bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 cursor-pointer"
                  >
                    <Compass className="h-3 w-3 text-violet-400" />
                    <span className="font-semibold">STRATEGIC INFERENCE</span>
                    <span className="text-zinc-400 font-sans normal-case text-[10px]">· Analysis</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-violet-400 transition-transform duration-150 ml-0.5",
                        isInferenceExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isInferenceExpanded && (
                    <div className="mt-2 rounded-[4px] bg-[#100E17] border border-violet-500/25 p-3 text-xs space-y-1.5 font-sans border-l-2 border-l-violet-400 animate-fade-in-up">
                      <div className="flex items-center justify-between text-[10px] font-mono text-violet-400/90 font-semibold tracking-wider uppercase">
                        <span>Analytical Inference · Not Direct Observation</span>
                        <span className="text-zinc-500 font-normal">Derived</span>
                      </div>
                      <p className="text-zinc-300 text-xs leading-relaxed italic">
                        "{event.why_it_matters}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CONNECTING TRUNK LINE WITH FLOW PULSE */}
            <div className="flex flex-col items-center justify-center -my-3">
              {/* Upper trunk line with subtle evidence flow pulse */}
              <div className="relative w-[2px] h-8 bg-gradient-to-b from-white/[0.15] to-cyan-500/50 overflow-hidden">
                <div className="absolute inset-x-0 w-full h-3 bg-cyan-300 rounded-full blur-[1px] animate-pulse-up opacity-90" />
              </div>

              {/* Branch Node Tag */}
              <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#121722] border border-cyan-500/30 text-[10px] font-mono font-semibold text-cyan-300 shadow-xs">
                <Layers className="h-3 w-3 text-cyan-400" />
                <span>
                  {isMulti
                    ? `Evidence Consolidation Branches (${sigCount} Supporting Signals)`
                    : "Single-Source Evidence Branch"}
                </span>
              </div>

              {/* Lower trunk line */}
              <div className="relative w-[2px] h-6 bg-cyan-500/50 overflow-hidden">
                <div className="absolute inset-x-0 w-full h-3 bg-cyan-300 rounded-full blur-[1px] animate-pulse-up opacity-90" />
              </div>
            </div>

            {/* SUPPORTING SIGNALS GRAPH */}
            {(!event.contributing_signals || event.contributing_signals.length === 0) ? (
              <div className="max-w-md mx-auto p-4 rounded-[6px] border border-white/[0.08] bg-[#0D1117] text-center text-xs text-zinc-400 font-mono">
                No individual raw signals mapped to this consolidated event.
              </div>
            ) : event.contributing_signals.length === 1 ? (
              /* Single-Signal Branch */
              <div className="max-w-2xl mx-auto space-y-2">
                {(() => {
                  const sig = event.contributing_signals[0];
                  const sourceMeta = getSourceMeta(sig.source);
                  const SourceIcon = sourceMeta.icon;

                  return (
                    <div className="rounded-[6px] border border-cyan-500/40 bg-gradient-to-b from-[#0D1522] to-[#0A0F18] p-5 space-y-3.5 shadow-sm hover:border-cyan-500/50 transition-colors">
                      {/* Node Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <SourceIcon className="h-3 w-3" />
                            <span>{sourceMeta.label}</span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-cyan-200 px-2 py-0.5 rounded-[3px] bg-cyan-500/20 border border-cyan-500/40">
                            PRIMARY EVIDENCE
                          </span>
                        </div>
                        {sig.published_at && (
                          <span className="text-xs font-mono text-zinc-400">
                            {sig.published_at}
                          </span>
                        )}
                      </div>

                      {/* Signal Title */}
                      <h3 className="text-sm font-semibold text-white leading-snug">
                        {sig.title}
                      </h3>

                      {/* Excerpt */}
                      {sig.raw_excerpt && (
                        <p className="text-xs text-zinc-300 leading-relaxed bg-black/50 p-3 rounded-[4px] border border-white/[0.05] font-sans">
                          "{sig.raw_excerpt}"
                        </p>
                      )}

                      {/* Node Footer */}
                      <div className="pt-2.5 flex items-center justify-between border-t border-white/[0.06] text-xs font-mono">
                        <span className="text-[10px] text-zinc-500">
                          ID: {sig.id}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(sig.id)}
                            className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs"
                          >
                            Inspect in Drawer
                          </button>
                          <a
                            href={sig.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                          >
                            <span>Inspect Source</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Multi-Signal Grid with Connecting Rail */
              <div className="relative">
                {/* Horizontal Rail Line on Desktop */}
                <div className="hidden md:block absolute -top-5 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {event.contributing_signals.map((sig, idx) => {
                    const sourceMeta = getSourceMeta(sig.source);
                    const SourceIcon = sourceMeta.icon;
                    const isPrimary = idx === 0;

                    return (
                      <div key={sig.id} className="relative pt-2">
                        {/* Branch Connector Stem */}
                        <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 h-2 w-[2px] bg-cyan-500/40" />

                        <div
                          className={cn(
                            "rounded-[6px] p-4 flex flex-col justify-between h-full space-y-3 transition-all",
                            isPrimary
                              ? "border border-cyan-500/40 bg-gradient-to-b from-[#0D1522] to-[#0A0F18] shadow-[0_0_16px_-4px_rgba(6,182,212,0.12)]"
                              : "border border-white/[0.08] bg-[#0D1117] hover:bg-[#121622] hover:border-violet-500/30"
                          )}
                        >
                          <div className="space-y-2.5">
                            {/* Header: Source Type + Primary/Corroborating Badge */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                                <SourceIcon className="h-2.5 w-2.5 text-zinc-400" />
                                <span>{sourceMeta.label}</span>
                              </span>
                              <span
                                className={cn(
                                  "text-[9px] font-mono px-2 py-0.5 rounded-[3px] uppercase tracking-wider font-semibold border",
                                  isPrimary
                                    ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                                    : "bg-violet-500/15 text-violet-300 border-violet-500/25"
                                )}
                              >
                                {isPrimary ? "PRIMARY" : "CORROBORATING"}
                              </span>
                            </div>

                            {/* Signal Title */}
                            <h3 className="text-xs font-semibold text-white leading-snug">
                              {sig.title}
                            </h3>

                            {/* Excerpt */}
                            {sig.raw_excerpt && (
                              <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-4 bg-black/45 p-2.5 rounded-[4px] border border-white/[0.04] font-sans">
                                "{sig.raw_excerpt}"
                              </p>
                            )}
                          </div>

                          {/* Node Footer */}
                          <div className="pt-2.5 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono">
                            <span className="text-zinc-500 truncate max-w-[100px]" title={sig.id}>
                              {sig.id}
                            </span>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenDrawer(sig.id)}
                                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              >
                                Drawer
                              </button>
                              <a
                                href={sig.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                              >
                                <span>Inspect Source</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
