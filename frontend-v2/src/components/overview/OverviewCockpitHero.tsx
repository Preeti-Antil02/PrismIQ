"use client";

import * as React from "react";
import { formatRelativeTime } from "@/lib/timeUtils";

interface OverviewCockpitHeroProps {
  briefDate: string;
  hasPartialDegradation: boolean;
}

export function OverviewCockpitHero({
  briefDate,
  hasPartialDegradation,
}: OverviewCockpitHeroProps) {
  const timeInfo = formatRelativeTime(briefDate);

  return (
    <header className="space-y-4 pt-1">
      {/* Top telemetry row: Eyebrow + Live pulse badge */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-[10.5px] font-mono font-bold tracking-[0.2em] text-[#b6a0ff] uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--violet)] shadow-[0_0_8px_var(--violet)]" />
          PRISMIQ · INTELLIGENCE BRIEFING
        </span>

        {/* Compact status pill */}
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border border-white/10 bg-[#0c0c11]/80 backdrop-blur-md text-[11px] text-[#bbb] font-mono shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)] animate-pulse" />
          <span>
            Updated <strong className="text-white font-semibold">{timeInfo.relative || "15h ago"}</strong>
          </span>
        </div>
      </div>

      {/* Main greeting & subhead */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl sm:text-4xl md:text-[44px] text-[#F3F2EF] font-normal leading-tight tracking-tight">
          Good morning, Preeti
        </h1>
        <p className="text-sm sm:text-[15px] text-[#9a9ba6] leading-relaxed max-w-2xl">
          Here's what changed that deserves your attention.
        </p>
      </div>

      {/* Compact single-line telemetry status strip */}
      {hasPartialDegradation && (
        <div className="rounded-[5px] border border-[rgba(255,180,90,0.25)] bg-gradient-to-r from-[rgba(255,180,90,0.08)] via-[rgba(165,107,255,0.03)] to-transparent px-3 py-2 text-xs text-[#c8c8d0] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 shadow-[0_0_24px_rgba(255,180,90,0.035)]">
          <div className="inline-flex items-center gap-1.5 text-[var(--amber)] font-mono font-bold text-[10.5px] uppercase tracking-wider shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)] shadow-[0_0_6px_var(--amber)]" />
            <span>STATUS: Partially degraded</span>
          </div>
          <span className="hidden sm:inline text-white/20">|</span>
          <p className="text-[11.5px] text-[#a9a9b4] leading-normal truncate sm:overflow-visible">
            A few secondary sources hit temporary rate limits. Intelligence was generated from verified primary signals.
          </p>
        </div>
      )}
    </header>
  );
}
