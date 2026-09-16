"use client";

import * as React from "react";
import { GitFork } from "lucide-react";

interface EventsTimelineHeaderProps {
  totalCount: number;
  filteredCount?: number;
  isFiltered?: boolean;
}

export function EventsTimelineHeader({
  totalCount,
  filteredCount,
  isFiltered,
}: EventsTimelineHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-white/[0.08] min-w-0">
      {/* Title block — min-w-0 so it can shrink if count badge needs space */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
            <h1 className="text-xl font-bold tracking-[0.16em] uppercase text-white font-mono">
              EVENTS
            </h1>
          </div>
          <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-[3px] bg-white/[0.04] text-zinc-400 border border-white/[0.08] shrink-0">
            EVENT INTELLIGENCE
          </span>
        </div>
        {/* Subtitle — wraps naturally, no nowrap */}
        <p className="text-xs text-zinc-400 leading-relaxed">
          <span>What real-world events happened, and what&apos;s the evidence behind each one?</span>
          <span className="text-zinc-600 mx-1.5 hidden sm:inline">|</span>
          <span className="text-zinc-500 font-mono text-[11px] hidden sm:inline">
            Chronological intelligence stream
          </span>
        </p>
      </div>

      {/* Event Count Badge — self-start prevents stretching, shrink-0 so it doesn't collapse */}
      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[4px] bg-[#0D1117] border border-white/[0.08] text-xs font-mono whitespace-nowrap">
          <GitFork className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span className="text-zinc-200 font-semibold tabular-nums">
            {isFiltered && filteredCount !== undefined
              ? `${filteredCount.toLocaleString()} / ${totalCount.toLocaleString()}`
              : totalCount.toLocaleString()}
          </span>
          <span className="text-zinc-500">consolidated events</span>
        </div>
      </div>
    </header>
  );
}
