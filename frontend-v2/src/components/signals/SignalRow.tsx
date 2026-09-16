"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  ArrowRight,
  GitBranch,
  Newspaper,
  Briefcase,
  Tag,
  Layers,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type SignalRecord } from "@/lib/api";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";
import { formatRelativeTime } from "@/lib/timeUtils";
import { parseEvidenceCount } from "@/lib/evidenceUtils";
import { TierBadge, type TierType } from "@/components/primitives/TierBadge";
import { ConfidenceBadge, type ConfidenceScore } from "@/components/primitives/ConfidenceBadge";

interface SignalRowProps {
  signal: SignalRecord;
  onInspect: (signal: SignalRecord) => void;
}

export function detectSignalType(
  source?: string,
  title?: string,
  url?: string
): "News" | "GitHub" | "Jobs" | "Pricing" {
  const s = (source || "").toLowerCase();
  const t = (title || "").toLowerCase();
  const u = (url || "").toLowerCase();

  if (
    s.includes("github") ||
    u.includes("github.com") ||
    t.includes("github pullrequest") ||
    t.includes("github watch") ||
    t.includes("github fork") ||
    t.includes("commit")
  ) {
    return "GitHub";
  }
  if (
    s.includes("job") ||
    s.includes("career") ||
    t.includes("hiring") ||
    t.includes("headcount") ||
    t.includes("job")
  ) {
    return "Jobs";
  }
  if (
    s.includes("pricing") ||
    s.includes("price") ||
    t.includes("pricing") ||
    t.includes("price") ||
    u.includes("pricing")
  ) {
    return "Pricing";
  }
  return "News";
}

export function formatCleanSourceName(source: string, url?: string, company?: string): string {
  if (!url) return source || "Monitored Channel";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host.includes("github.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `github.com/${parts[0]}/${parts[1]}`;
      }
      return "GitHub Repository";
    }
    if (host.includes("stripe.com")) {
      if (parsed.pathname.includes("/blog")) return "Stripe Engineering Blog";
      if (parsed.pathname.includes("/newsroom")) return "Stripe Newsroom";
      return "Stripe Official";
    }
    if (host.includes("cloudflare.com")) {
      if (parsed.pathname.includes("/blog")) return "Cloudflare Blog";
      return "Cloudflare Official";
    }
    if (host.includes("vercel.com")) {
      if (parsed.pathname.includes("/changelog")) return "Vercel Changelog";
      if (parsed.pathname.includes("/blog")) return "Vercel Blog";
      return "Vercel Official";
    }
    if (host.includes("netlify.com")) {
      if (parsed.pathname.includes("/blog")) return "Netlify Blog";
      return "Netlify Official";
    }
    if (host.includes("news.ycombinator.com")) return "Hacker News";
    if (host.includes("dev.to")) return "DEV Community";
    if (host.includes("techradar.com")) return "TechRadar";
    if (host.includes("is-agentic.com")) return "is-agentic.com Benchmark";

    return host;
  } catch {
    return source || "Monitored Channel";
  }
}

export function SignalRow({ signal, onInspect }: SignalRowProps) {
  const signalType = detectSignalType(signal.source, signal.title, signal.url);
  const timeInfo = formatRelativeTime(signal.published_timestamp || signal.published_at);
  const evidenceCount = parseEvidenceCount(signal.corroboration_count || 1, 1);
  const sourceName = formatCleanSourceName(signal.source, signal.url, signal.company_name);

  // Signal type visual badges
  const typeBadgeConfig = {
    News: {
      icon: Newspaper,
      label: "NEWS",
      className: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
      accentBar: "bg-cyan-400",
    },
    GitHub: {
      icon: GitBranch,
      label: "GITHUB",
      className: "bg-violet-500/10 text-violet-300 border-violet-500/20",
      accentBar: "bg-violet-400",
    },
    Jobs: {
      icon: Briefcase,
      label: "JOBS",
      className: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
      accentBar: "bg-fuchsia-400",
    },
    Pricing: {
      icon: Tag,
      label: "PRICING",
      className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      accentBar: "bg-amber-400",
    },
  }[signalType];

  const TypeIcon = typeBadgeConfig.icon;

  return (
    <article
      onClick={() => onInspect(signal)}
      className="group relative rounded-lg border border-white/[0.06] bg-[#0D1117] hover:bg-[#121722] hover:border-white/[0.14] transition-all duration-150 p-4 space-y-3 cursor-pointer shadow-xs"
    >
      {/* Semantic Left Accent Hairline */}
      <div
        className={cn(
          "absolute left-0 top-3 bottom-3 w-[2px] rounded-r transition-opacity opacity-40 group-hover:opacity-100",
          typeBadgeConfig.accentBar
        )}
      />

      {/* Row Header: Company + Type + Timestamp + Event Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          {/* Company Vector Mark & Name */}
          <div className="flex items-center gap-1.5">
            <CompanyLogo company={signal.company_name} variant="mini" />
            <span className="font-semibold text-xs text-white tracking-tight">
              {signal.company_name}
            </span>
          </div>

          <span className="text-zinc-600">·</span>

          {/* Visibly Distinguishable Signal Type Badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider border",
              typeBadgeConfig.className
            )}
          >
            <TypeIcon className="h-2.5 w-2.5" />
            <span>{typeBadgeConfig.label}</span>
          </span>
        </div>

        {/* Right Header Metadata: Timestamp & Event Relationship */}
        <div className="flex items-center gap-2.5">
          {signal.event_id && (
            <Link
              href={`/app/events`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              title="Consolidated into strategic event"
            >
              <Sparkles className="h-2.5 w-2.5 text-blue-400" />
              <span>Part of event</span>
              <span className="text-blue-400">→</span>
            </Link>
          )}

          {/* Timestamp with Full Hover Tooltip */}
          <div
            className="flex items-center gap-1 text-[11px] font-mono text-zinc-400"
            title={timeInfo.full}
          >
            <Calendar className="h-3 w-3 text-zinc-500" />
            <span>{timeInfo.relative}</span>
          </div>
        </div>
      </div>

      {/* Signal Headline & Raw Observation Excerpt */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-zinc-100 group-hover:text-white transition-colors leading-snug">
          {signal.title}
        </h3>
        {signal.raw_excerpt && (
          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-sans">
            "{signal.raw_excerpt}"
          </p>
        )}
      </div>

      {/* Bottom Metadata: Prominent Source + Evidence Count + Confidence + Inspect Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.04]">
        {/* Source Attribution (Source-First Design) */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500 font-mono text-[11px]">SRC:</span>
          {signal.url ? (
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 font-mono text-cyan-400 hover:text-cyan-300 hover:underline transition-colors max-w-[280px] sm:max-w-md truncate"
              title={`Open primary evidence link: ${signal.url}`}
            >
              <span>{sourceName}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <span className="font-mono text-zinc-300">{sourceName}</span>
          )}
        </div>

        {/* Evidence Count, Badges, and Inspect Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Epistemic Evidence Count */}
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.08]"
            title={evidenceCount.label}
          >
            <Layers className="h-3 w-3 text-zinc-400" />
            <span>{evidenceCount.badgeLabel}</span>
          </span>

          {/* Confidence Badge */}
          {signal.confidence && (
            <ConfidenceBadge confidence={signal.confidence as ConfidenceScore} />
          )}

          {/* Tier Badge (if assigned) */}
          {signal.tier && signal.tier !== "Nice-to-Know" && (
            <TierBadge tier={signal.tier as TierType} />
          )}

          {/* Inspect Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(signal);
            }}
            className="inline-flex items-center gap-1 text-xs font-mono font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-cyan-500/10 transition-colors ml-1"
          >
            <span>Inspect</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </article>
  );
}
