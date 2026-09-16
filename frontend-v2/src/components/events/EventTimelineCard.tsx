"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  GitFork,
  Layers,
  Sparkles,
  Server,
  ShieldCheck,
  Tag,
  Calendar,
  Compass,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ConsolidatedEventRecord } from "@/lib/api";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";
import { formatRelativeTime } from "@/lib/timeUtils";
import { parseEvidenceCount } from "@/lib/evidenceUtils";
import { TierBadge, type TierType } from "@/components/primitives/TierBadge";
import { ConfidenceBadge, type ConfidenceScore } from "@/components/primitives/ConfidenceBadge";
import { normalizeConfidence } from "@/lib/tokens";

interface EventTimelineCardProps {
  event: ConsolidatedEventRecord;
  onInspect: (event: ConsolidatedEventRecord) => void;
  isFirstInGroup?: boolean;
}

export function detectEventCategory(
  title?: string,
  summary?: string,
  sources?: string[]
): {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  dotColor: string;
} {
  const text = `${title || ""} ${summary || ""} ${(sources || []).join(" ")}`.toLowerCase();

  if (
    text.includes("pqc") ||
    text.includes("post-quantum") ||
    text.includes("security") ||
    text.includes("dnssec") ||
    text.includes("bot-auth") ||
    text.includes("auth") ||
    text.includes("token")
  ) {
    return {
      id: "SECURITY",
      label: "SECURITY & AUTH",
      icon: ShieldCheck,
      badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      dotColor: "bg-emerald-400",
    };
  }

  if (
    text.includes("pricing") ||
    text.includes("price") ||
    text.includes("billing") ||
    text.includes("tier") ||
    text.includes("discount") ||
    text.includes("per gb") ||
    text.includes("per month")
  ) {
    return {
      id: "PRICING",
      label: "PRICING & PACKAGING",
      icon: Tag,
      badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      dotColor: "bg-amber-400",
    };
  }

  if (
    text.includes("worker") ||
    text.includes("edge") ||
    text.includes("dns") ||
    text.includes("infrastructure") ||
    text.includes("runtime") ||
    text.includes("compute") ||
    text.includes("latency") ||
    text.includes("durable objects")
  ) {
    return {
      id: "INFRASTRUCTURE",
      label: "INFRASTRUCTURE & EDGE",
      icon: Server,
      badgeClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
      dotColor: "bg-cyan-400",
    };
  }

  return {
    id: "PRODUCT",
    label: "PRODUCT & LAUNCH",
    icon: Sparkles,
    badgeClass: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
    dotColor: "bg-fuchsia-400",
  };
}

export function EventTimelineCard({
  event,
  onInspect,
}: EventTimelineCardProps) {
  const category = detectEventCategory(
    event.title,
    event.event_summary,
    event.contributing_sources
  );
  const CategoryIcon = category.icon;
  const timeInfo = formatRelativeTime(
    event.published_timestamp || event.published_at || event.latest_detected_at
  );
  const evidenceCount = parseEvidenceCount(event.corroboration_count || 1, 1);
  const factConf = normalizeConfidence(event.fact_confidence) as ConfidenceScore;

  const [isInferenceExpanded, setIsInferenceExpanded] = React.useState<boolean>(false);

  const sources =
    event.contributing_sources && event.contributing_sources.length > 0
      ? event.contributing_sources
      : ["Primary Channel Observation"];

  const hasValidInference = Boolean(
    event.why_it_matters &&
      !event.why_it_matters.toLowerCase().includes("rate limit") &&
      !event.why_it_matters.toLowerCase().includes("analysis unavailable") &&
      !event.why_it_matters.toLowerCase().includes("analysis failed")
  );

  /*
   * LAYOUT CONTRACT:
   *   The parent stream has a timeline rail at left-3 (12px).
   *   This wrapper is pl-8 (32px), which pushes card content 32px right.
   *   The dot node sits absolutely at left-[9px], centred on the 12px rail.
   *   (left-[9px] + half dot width ~5px = ~14px ≈ rail centre at 12px → visually aligned)
   *   min-w-0 on all flex children prevents content from pushing container width.
   */
  return (
    <div className="relative pl-8 group min-w-0">
      {/* Timeline node dot — centred on the vertical spine at left-3 (12px) */}
      <div
        aria-hidden="true"
        className="absolute left-[9px] top-4 flex items-center justify-center pointer-events-none"
      >
        <div
          className={cn(
            "h-2.5 w-2.5 rounded-full ring-4 ring-[#08090C] transition-all duration-200 group-hover:scale-125",
            category.dotColor
          )}
        />
      </div>

      {/* Main Event Card */}
      <article
        onClick={() => onInspect(event)}
        className="rounded-[6px] border border-white/[0.08] bg-[#0D1117] hover:bg-[#121620] hover:border-white/[0.16] transition-all duration-150 p-4 sm:p-5 space-y-3 cursor-pointer shadow-xs relative overflow-hidden min-w-0"
      >
        {/* ── HEADER: Company · Category Badge · Timestamp ─────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            {/* Company logo + name */}
            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <CompanyLogo company={event.company_name} variant="mini" />
              <span className="font-semibold text-xs text-white tracking-tight truncate max-w-[120px] sm:max-w-[180px]">
                {event.company_name}
              </span>
            </div>

            <span className="text-zinc-600 shrink-0" aria-hidden="true">·</span>

            {/* Category badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-semibold tracking-wider border shrink-0",
                category.badgeClass
              )}
            >
              <CategoryIcon className="h-2.5 w-2.5 shrink-0" />
              <span>{category.label}</span>
            </span>
          </div>

          {/* Timestamp */}
          <div
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 shrink-0"
            title={timeInfo.full}
          >
            <Calendar className="h-3 w-3 text-zinc-500 shrink-0" />
            <span className="whitespace-nowrap">{timeInfo.relative}</span>
          </div>
        </div>

        {/* ── EVENT TITLE + SUMMARY ─────────────────────────────────────── */}
        <div className="space-y-1 min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight group-hover:text-cyan-300 transition-colors leading-snug break-words">
            {event.title}
          </h3>
          {event.event_summary && (
            <p className="text-xs text-zinc-300 leading-relaxed font-sans break-words">
              {event.event_summary}
            </p>
          )}
        </div>

        {/* ── SUPPORTING SIGNALS (Evidence Block) ──────────────────────── */}
        {(() => {
          const count = event.corroboration_count || sources.length || 1;
          const isMulti = count > 1;

          return (
            <div
              className={cn(
                "rounded-[5px] p-2.5 sm:p-3 space-y-2 transition-colors min-w-0",
                isMulti
                  ? "bg-gradient-to-r from-cyan-950/30 via-[#161B22]/90 to-[#10141D] border border-cyan-500/30 shadow-[0_0_16px_-4px_rgba(6,182,212,0.12)]"
                  : "bg-[#141822]/70 border border-white/[0.06]"
              )}
            >
              {/* Signal count row */}
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-semibold min-w-0",
                    isMulti ? "text-cyan-300 font-bold" : "text-zinc-400"
                  )}
                >
                  <Layers
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isMulti ? "text-cyan-400" : "text-zinc-500"
                    )}
                  />
                  <span className="whitespace-nowrap">
                    SUPPORTED BY {count} {count === 1 ? "SIGNAL" : "SIGNALS"}
                  </span>
                  {isMulti && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-[3px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                      Corroborated
                    </span>
                  )}
                </div>

                {/* Epistemic breakdown badge */}
                <span
                  className={cn(
                    "text-[11px] font-mono shrink-0",
                    isMulti
                      ? "text-cyan-200 font-semibold bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded-[3px] shadow-xs whitespace-nowrap"
                      : "text-zinc-400"
                  )}
                >
                  {evidenceCount.badgeLabel}
                </span>
              </div>

              {/* Contributing source tags — flex-wrap prevents overflow */}
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {sources.map((src, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-[3px] border max-w-full",
                      isMulti
                        ? "bg-cyan-500/10 text-cyan-200 border-cyan-500/25"
                        : "bg-white/[0.04] text-zinc-300 border-white/[0.06]"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        isMulti ? "bg-cyan-400 animate-pulse" : "bg-zinc-500"
                      )}
                    />
                    {/* Truncate very long source names so they don't cause overflow */}
                    <span className="truncate max-w-[200px] sm:max-w-[300px]">{src}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── STRATEGIC INFERENCE (Collapsible) ────────────────────────── */}
        {hasValidInference && (
          <div className="pt-0.5 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsInferenceExpanded(!isInferenceExpanded);
              }}
              className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-violet-300 hover:text-violet-200 transition-colors py-1 px-2 rounded-[4px] bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 cursor-pointer"
              aria-expanded={isInferenceExpanded}
              title="Toggle Strategic Inference analysis"
            >
              <Compass className="h-3 w-3 text-violet-400 shrink-0" />
              <span className="font-semibold whitespace-nowrap">STRATEGIC INFERENCE</span>
              <span className="text-zinc-400 font-sans normal-case text-[10px] whitespace-nowrap">· Analysis</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-violet-400 transition-transform duration-150 ml-0.5 shrink-0",
                  isInferenceExpanded && "rotate-180"
                )}
              />
            </button>

            {isInferenceExpanded && (
              <div className="mt-2 rounded-[4px] bg-[#100E17] border border-violet-500/25 border-l-2 border-l-violet-400 p-3 text-xs space-y-1.5 font-sans min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-violet-400/90 font-semibold tracking-wider uppercase">
                  <span>Analytical Inference · Not Direct Observation</span>
                  <span className="text-zinc-500 font-normal">Derived</span>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed italic break-words">
                  &ldquo;{event.why_it_matters}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── BOTTOM BAR: Confidence + Tier + Actions ───────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2 border-t border-white/[0.04] min-w-0">
          {/* Left: badges */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <ConfidenceBadge confidence={factConf} />
            {event.tier && event.tier !== "Nice-to-Know" && (
              <TierBadge tier={event.tier as TierType} />
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/app/events/${event.event_id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-[3px] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors whitespace-nowrap"
              title="Inspect consolidation tree"
            >
              <GitFork className="h-3 w-3 text-violet-400 shrink-0" />
              <span>Event Tree</span>
            </Link>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInspect(event);
              }}
              className="inline-flex items-center gap-1 text-xs font-mono font-medium text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded-[3px] bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors whitespace-nowrap"
            >
              <span>Inspect Evidence</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
