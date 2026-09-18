"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";

export interface ResearchTopicItem {
  topic: string;
  symbol: string;
  status: string;
  explanation: string;
  contextCompany: string;
  contextText: string;
  statusClass: string;
  borderAccent: string;
}

interface ResearchRadarFieldProps {
  topics: ResearchTopicItem[];
}

export function ResearchRadarField({ topics }: ResearchRadarFieldProps) {
  return (
    <section className="space-y-4" aria-label="Emerging in your research">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div>
          <div className="text-[10px] font-mono tracking-[0.18em] text-[#c5b4ff] uppercase font-bold flex items-center gap-1.5">
            <span className="text-[var(--violet)] text-xs">⌁</span>
            EMERGING IN YOUR RESEARCH
          </div>
          <h3 className="font-serif text-2xl sm:text-[24px] font-normal mt-1 section-title-gradient leading-snug flex items-center gap-2">
            <span>
              {topics.length > 0
                ? `${topics.length} configured research ${topics.length === 1 ? "theme" : "themes"} under continuous monitoring`
                : "Configured research themes under continuous monitoring"}
            </span>
          </h3>
        </div>

        <Link
          href="/app/research-radar"
          className="text-xs font-mono text-[#bba4ff] hover:text-[#ddd] transition-colors inline-flex items-center gap-1 self-start sm:self-auto group"
        >
          <span>Open Research Radar</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Radar Field Container: Atmospheric scan grid */}
      <div className="relative rounded-[12px] p-5 sm:p-6 border border-white/[0.09] bg-[#07070b]/90 overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.3)]">
        {/* Radar Background Metaphor: Subtle concentric scan rings & crosshair */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/10 border-dashed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border border-white/10" />
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Top Radar Coordinates Strip */}
        <div className="relative z-10 flex items-center justify-between pb-4 mb-4 border-b border-white/[0.05] text-[10px] font-mono text-[#777985]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] animate-ping" />
            <span className="text-[#a9aab4] uppercase tracking-wider font-semibold">Radar Field Scan Active</span>
          </div>
          <span className="tracking-widest hidden sm:inline">COORDINATES: MONITORED THEMES [{topics.length}/{topics.length} ACTIVE]</span>
        </div>

        {/* Research Frontier Nodes Grid */}
        {topics.length === 0 ? (
          <div className="relative z-10 p-8 text-center space-y-2">
            <p className="text-xs font-mono text-[#F3F2EF]">No research topics active</p>
            <p className="text-[11px] text-[#8e8f9a] max-w-md mx-auto">
              Configure research themes in Workspace Topics to monitor specialized competitive frontiers.
            </p>
          </div>
        ) : (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {topics.map((item, idx) => {
            const ringAccent = item.borderAccent || "var(--cyan)";

            return (
              <Link
                key={item.topic}
                href="/app/research-radar"
                className={cn(
                  "group relative p-4 sm:p-5 rounded-[8px] transition-all duration-300 block",
                  "border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm",
                  "hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04]",
                  "hover:shadow-[0_12px_28px_rgba(0,0,0,0.4)]"
                )}
                style={{
                  borderLeft: `3px solid ${ringAccent}`,
                }}
              >
                {/* Node Status Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-semibold text-[13px] text-[#F3F2EF] group-hover:text-white flex items-center gap-2">
                    <span className="text-[var(--violet)] font-mono text-xs">{item.symbol}</span>
                    <span>{item.topic}</span>
                  </span>

                  <span className={cn("text-[9px] font-mono px-2 py-0.5 rounded-[3px] border font-medium shrink-0", item.statusClass)}>
                    {item.status}
                  </span>
                </div>

                {/* Synthesis Description */}
                <p className="text-xs text-[#a9aab4] leading-relaxed mb-4 group-hover:text-[#c8c8d0] transition-colors">
                  {item.explanation}
                </p>

                {/* Competitor Context */}
                <div className="pt-3 border-t border-white/[0.05] text-[10.5px] text-[#8e8f9a] flex items-center flex-wrap gap-1.5">
                  <span className="text-[#676875] font-mono font-semibold uppercase tracking-wider text-[9px]">
                    Context:
                  </span>
                  <CompanyLogo company={item.contextCompany} variant="inline" className="text-white text-[10px]" />
                  <span className="truncate">{item.contextText}</span>
                </div>
              </Link>
            );
          })}
          </div>
        )}
      </div>
    </section>
  );
}
