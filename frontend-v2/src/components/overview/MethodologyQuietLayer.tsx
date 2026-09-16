"use client";

import * as React from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function MethodologyQuietLayer() {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <footer className="pt-6 space-y-4" aria-label="Evidence & Methodology">
      {/* Signature Animated Spectrum Hairline */}
      <div className="spectrum-line h-[1px] w-full opacity-60" />

      {/* Quiet Closing Strip */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="rounded-[8px] p-3.5 sm:p-4 border border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.03] transition-colors cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[var(--magenta)] drop-shadow-[0_0_8px_rgba(241,91,181,0.6)] text-xs">◉</span>
          <span className="font-semibold text-[#F3F2EF]">Evidence &amp; Methodology</span>
          <span className="text-white/20 hidden sm:inline">|</span>
          <span className="text-[#8e8f9a] text-[11px] font-mono">
            Sources · Confidence · Freshness · Limitations
          </span>
        </div>

        <div className="flex items-center gap-2 text-[#747581] font-mono text-[11px] self-start sm:self-auto">
          <span>{expanded ? "Hide methodology" : "Why should I trust this?"}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Expandable Trustworthiness Summary */}
      {expanded && (
        <div className="p-5 rounded-[8px] border border-white/[0.06] bg-[#07070b]/90 backdrop-blur-md text-xs text-[#a9aab4] space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="font-bold text-[#ddd] block font-mono text-[11px]">01 · SOURCES</span>
              <p className="text-[11px] text-[#8e8f9a] leading-relaxed">
                Directly verified against unredacted primary records with verifiable links and multi-channel corroboration.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-[#ddd] block font-mono text-[11px]">02 · CONFIDENCE</span>
              <p className="text-[11px] text-[#8e8f9a] leading-relaxed">
                Strict epistemic separation between direct observations (factual grounding) and strategic inferences.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-[#ddd] block font-mono text-[11px]">03 · FRESHNESS</span>
              <p className="text-[11px] text-[#8e8f9a] leading-relaxed">
                Continuous ingestion with transparent timestamps, health telemetry, and partial degradation alerts.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-[#ddd] block font-mono text-[11px]">04 · LIMITATIONS</span>
              <p className="text-[11px] text-[#8e8f9a] leading-relaxed">
                All competitive implications explicitly state epistemic boundaries and unobserved enterprise contracts.
              </p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
