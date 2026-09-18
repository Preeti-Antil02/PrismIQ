"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";

export interface RecentEventItem {
  id: string;
  company: string;
  date: string;
  title: string;
  corroboration: number;
  confidence: string;
  tier: string;
  whyItMatters?: string;
  records: Array<{
    source: string;
    extractedText: string;
    url?: string;
    timestamp?: string;
  }>;
}

interface RecentEventsStreamProps {
  events: RecentEventItem[];
  onInspectEvent: (event: RecentEventItem) => void;
}

export function RecentEventsStream({
  events,
  onInspectEvent,
}: RecentEventsStreamProps) {
  return (
    <section className="space-y-4" aria-label="Recent events">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div>
          <div className="text-[10px] font-mono tracking-[0.18em] text-[#c5b4ff] uppercase font-bold flex items-center gap-1.5">
            <span className="text-[var(--violet)] text-xs">◷</span>
            RECENT EVENTS
          </div>
          <h3 className="font-serif text-2xl sm:text-[24px] font-normal mt-1 section-title-gradient leading-snug">
            Verified real-world actions consolidated from multiple external signals
          </h3>
        </div>

        <Link
          href="/app/events"
          className="text-xs font-mono text-[#bba4ff] hover:text-[#ddd] transition-colors inline-flex items-center gap-1 self-start sm:self-auto group"
        >
          <span>View all events</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Chronological Stream Feed */}
      {events.length === 0 ? (
        <div className="rounded-[8px] border border-white/[0.08] bg-[#07070b]/60 p-8 text-center space-y-2">
          <p className="text-xs font-mono text-[#F3F2EF]">No consolidated events detected yet</p>
          <p className="text-[11px] text-[#8e8f9a] max-w-md mx-auto">
            Events require multi-source corroboration before synthesis. Once incoming signals for your tracked companies are verified, they will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-[8px] border border-white/[0.08] bg-[#07070b]/60 divide-y divide-white/[0.04] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          {events.slice(0, 5).map((ev, idx) => {
          const dotColor =
            idx === 0
              ? "var(--magenta)"
              : idx === 1
              ? "var(--amber)"
              : idx === 2
              ? "var(--cyan)"
              : idx === 3
              ? "var(--violet)"
              : "#72e2ff";

          const sourceCount = ev.records?.length || ev.corroboration || 2;

          return (
            <div
              key={ev.id || idx}
              onClick={() => onInspectEvent(ev)}
              className="group grid grid-cols-[90px_110px_1fr] md:grid-cols-[115px_130px_1fr_90px_80px] items-center gap-3 p-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer select-none text-xs"
            >
              {/* Date with Glowing Spectrum Dot */}
              <div className="flex items-center gap-2.5 font-mono text-[11px] text-[#8e8f9a]">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                  style={{
                    backgroundColor: dotColor,
                    boxShadow: `0 0 10px ${dotColor}`,
                  }}
                />
                <span>{ev.date}</span>
              </div>

              {/* Company with mini vector mark */}
              <div className="flex items-center gap-2 truncate font-semibold text-[#F3F2EF] text-xs">
                <CompanyLogo company={ev.company} variant="mini" className="w-5 h-5" />
                <span className="truncate">{ev.company}</span>
              </div>

              {/* Verified Event Title */}
              <p className="text-xs text-[#c8c8d0] group-hover:text-white transition-colors truncate">
                {ev.title}
              </p>

              {/* Sources count */}
              <div className="font-mono text-[11px] text-[#777985] hidden md:block">
                {sourceCount} {sourceCount === 1 ? "source" : "sources"}
              </div>

              {/* Inspect trigger */}
              <div className="text-right font-mono text-[11px] text-[#bba4ff] group-hover:text-white transition-colors hidden md:flex items-center justify-end gap-1 font-medium">
                <span>Inspect</span>
                <span className="text-[10px] group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </section>
  );
}
