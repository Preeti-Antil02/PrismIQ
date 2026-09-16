"use client";

import * as React from "react";
import { Radio, ShieldAlert, Sparkles, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignalsWorkspaceHeaderProps {
  totalCount: number;
  noiseSuppressedCount: number;
  forcedState: "none" | "force_empty" | "force_error";
  onForcedStateChange: (state: "none" | "force_empty" | "force_error") => void;
  filteredCount?: number;
  isFiltered?: boolean;
}

export function SignalsWorkspaceHeader({
  totalCount,
  noiseSuppressedCount,
  forcedState,
  onForcedStateChange,
  filteredCount,
  isFiltered,
}: SignalsWorkspaceHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
      {/* Title & Metaphor */}
      <div>
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xl font-bold tracking-[0.16em] uppercase text-white font-mono">
              SIGNALS
            </h1>
          </div>
          <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.08]">
            EVIDENCE REPOSITORY
          </span>
        </div>
        <p className="text-xs text-zinc-400 flex items-center gap-2">
          <span>Individual evidence detected across monitored channels.</span>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <span className="text-zinc-500 font-mono text-[11px] hidden sm:inline">
            Deterministic detection stream
          </span>
        </p>
      </div>

      {/* Telemetry & Quick State Switches */}
      <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
        {/* Evidence Counts Telemetry Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0D1117] border border-white/[0.08] text-xs font-mono">
          <Radio className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span className="text-zinc-200 font-semibold">
            {isFiltered && filteredCount !== undefined
              ? `${filteredCount.toLocaleString()} / ${totalCount.toLocaleString()}`
              : totalCount.toLocaleString()}
          </span>
          <span className="text-zinc-500">records</span>
        </div>

        {/* Quiet Dev Mode Inspector Controls for QA verification */}
        <div className="flex items-center gap-1 p-1 bg-[#0D1117] rounded border border-white/[0.08] text-[11px] font-mono">
          <span className="text-zinc-500 px-1.5 text-[10px] uppercase font-bold">
            DEV:
          </span>
          <button
            type="button"
            onClick={() => onForcedStateChange("none")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              forcedState === "none"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            )}
            title="Switch to live data"
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => onForcedStateChange("force_empty")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              forcedState === "force_empty"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            )}
            title="Force empty state verification"
          >
            Empty
          </button>
          <button
            type="button"
            onClick={() => onForcedStateChange("force_error")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              forcedState === "force_error"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            )}
            title="Force error state verification"
          >
            Error
          </button>
        </div>
      </div>
    </header>
  );
}
