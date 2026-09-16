"use client";

import * as React from "react";
import { type ConsolidatedEventRecord } from "@/lib/api";
import { EventTimelineCard } from "./EventTimelineCard";
import { AlertTriangle, RotateCcw, SearchX } from "lucide-react";

interface EventsTimelineStreamProps {
  events: ConsolidatedEventRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onInspect: (event: ConsolidatedEventRecord) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

interface DateGroup {
  dateKey: string;
  dateLabel: string;
  events: ConsolidatedEventRecord[];
}

function groupEventsByDate(events: ConsolidatedEventRecord[]): DateGroup[] {
  const groups: Map<string, { label: string; events: ConsolidatedEventRecord[] }> = new Map();

  for (const ev of events) {
    const rawDate = ev.published_timestamp || ev.published_at || ev.latest_detected_at;
    let key = "Earlier";
    let label = "EARLIER EVENTS";

    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        label = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
      }
    }

    if (!groups.has(key)) {
      groups.set(key, { label, events: [] });
    }
    groups.get(key)!.events.push(ev);
  }

  return Array.from(groups.entries()).map(([dateKey, val]) => ({
    dateKey,
    dateLabel: val.label,
    events: val.events,
  }));
}

export function EventsTimelineStream({
  events,
  loading,
  error,
  onRetry,
  onInspect,
  hasActiveFilters,
  onClearFilters,
}: EventsTimelineStreamProps) {
  const dateGroups = React.useMemo(() => groupEventsByDate(events), [events]);

  /* ── LOADING SKELETON ───────────────────────────────────────────────── */
  if (loading) {
    return (
      /*
       * Timeline rail is absolutely positioned at left-3 (12px from container edge).
       * Cards are offset via pl-8 (32px) leaving 20px for the rail + dot.
       * min-w-0 + overflow-hidden ensure no child can push the container wider.
       */
      <div className="relative min-w-0 space-y-6 overflow-hidden">
        {/* Skeleton spine */}
        <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-white/[0.06]" />

        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative pl-8 animate-pulse min-w-0">
            {/* Skeleton dot on spine */}
            <div className="absolute left-[9px] top-4 h-2.5 w-2.5 rounded-full bg-zinc-700 ring-4 ring-[#08090C]" />
            <div className="rounded-[6px] bg-[#0D1117] border border-white/[0.06] p-4 sm:p-5 space-y-3 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="h-4 w-20 bg-[#1A1F2C] rounded" />
                <div className="h-4 w-20 bg-[#1A1F2C] rounded" />
                <div className="h-3 w-14 bg-[#1A1F2C] rounded ml-auto" />
              </div>
              <div className="h-5 w-3/4 bg-[#1A1F2C] rounded" />
              <div className="h-3 w-full bg-[#1A1F2C] rounded" />
              <div className="h-10 w-full bg-[#151924] rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ── ERROR STATE ────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="rounded-[6px] border border-rose-500/20 bg-rose-500/[0.04] p-8 text-center space-y-3 min-w-0">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-white">Events Query Error</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto break-words">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-mono bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1] transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Retry Query</span>
        </button>
      </div>
    );
  }

  /* ── EMPTY STATE ────────────────────────────────────────────────────── */
  if (events.length === 0) {
    return (
      <div className="rounded-[6px] border border-white/[0.06] bg-[#0D1117] p-10 sm:p-12 text-center space-y-3 min-w-0">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-zinc-500 border border-white/[0.06]">
          <SearchX className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-white font-mono">
          {hasActiveFilters ? "No events match these filters" : "No events detected yet"}
        </h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto font-sans leading-relaxed">
          {hasActiveFilters
            ? "No consolidated events match your currently selected company, category, tier, or search query."
            : "Once PrismIQ has enough verified signals, consolidated events will appear here."}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-mono bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear all filters</span>
          </button>
        )}
      </div>
    );
  }

  /* ── MAIN TIMELINE ──────────────────────────────────────────────────── */
  /*
   * LAYOUT CONTRACT:
   *   The stream container is relative + min-w-0 + overflow-hidden.
   *   The timeline rail sits at left-3 (12px from the left edge of this container).
   *   Date anchor nodes sit at left-[10px] (centred on the 2px rail → 12px - 7px = 5px).
   *   Event card nodes sit at left-[9px] (dot is 10px wide, centred on rail).
   *   Cards are padded away from the rail via pl-8 (32px), giving 20px of clearance.
   *   All children use min-w-0 so long titles/source names can't push the layout.
   */
  return (
    <div className="relative min-w-0 overflow-hidden">
      {/* Continuous Vertical Chronological Timeline Spine */}
      <div
        aria-hidden="true"
        className="absolute left-3 top-4 bottom-4 w-[2px] bg-gradient-to-b from-violet-500/40 via-cyan-500/30 to-violet-500/10 pointer-events-none"
      />

      {/* Date Groups */}
      <div className="space-y-8 min-w-0">
        {dateGroups.map((group) => (
          <section key={group.dateKey} className="space-y-3 min-w-0">

            {/* Date Anchor Header — anchored on the timeline rail */}
            <div className="relative pl-8 flex items-center gap-3 py-1 min-w-0">
              {/* Date anchor node (ring around the rail) */}
              <div
                aria-hidden="true"
                className="absolute left-[10px] top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              >
                <div className="h-3.5 w-3.5 rounded-full bg-[#08090C] border-2 border-violet-400 flex items-center justify-center shadow-[0_0_10px_rgba(167,139,250,0.45)]">
                  <div className="h-1 w-1 rounded-full bg-violet-300" />
                </div>
              </div>

              {/* Date label + event count */}
              <div className="flex flex-wrap items-baseline gap-2 min-w-0">
                <span className="text-xs font-mono font-bold tracking-[0.12em] uppercase text-zinc-100 whitespace-nowrap">
                  {group.dateLabel}
                </span>
                <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap">
                  {group.events.length}{" "}
                  {group.events.length === 1 ? "event" : "events"}
                </span>
              </div>

              {/* Separator rule */}
              <div className="flex-1 h-[1px] bg-white/[0.08] min-w-0" />
            </div>

            {/* Event cards for this date group */}
            <div className="space-y-3 min-w-0">
              {group.events.map((event, idx) => (
                <EventTimelineCard
                  key={event.event_id}
                  event={event}
                  onInspect={onInspect}
                  isFirstInGroup={idx === 0}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
