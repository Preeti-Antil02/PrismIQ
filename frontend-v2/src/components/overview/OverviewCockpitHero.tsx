"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/timeUtils";
import { type PipelineProgress } from "@/lib/api";

interface OverviewCockpitHeroProps {
  briefDate?: string | null;
  hasPartialDegradation?: boolean;
  userName?: string;
  targetCompany?: string;
  pipelineProgress?: PipelineProgress | null;
}

export function OverviewCockpitHero({
  briefDate,
  hasPartialDegradation = false,
  userName,
  targetCompany,
  pipelineProgress,
}: OverviewCockpitHeroProps) {
  const timeInfo = briefDate ? formatRelativeTime(briefDate) : null;

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    let prefix = "Good morning";
    if (hour >= 12 && hour < 17) prefix = "Good afternoon";
    else if (hour >= 17) prefix = "Good evening";

    const name = userName?.trim().split(" ")[0] || "";
    return name ? `${prefix}, ${name}` : `${prefix}`;
  }, [userName]);

  const isPipelineRunning = pipelineProgress?.status === "running";
  const isTimedOut = pipelineProgress?.status === "timed_out";
  const totalCompanies = pipelineProgress?.total_companies || 0;
  const completedCompanies = pipelineProgress?.completed_companies || 0;
  const progressPercent =
    totalCompanies > 0 ? Math.min(100, Math.round((completedCompanies / totalCompanies) * 100)) : 0;

  // Calculate elapsed time
  const elapsedMinutes = React.useMemo(() => {
    if (!pipelineProgress?.started_at) return 0;
    try {
      const start = new Date(pipelineProgress.started_at).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((now - start) / 60000));
    } catch {
      return 0;
    }
  }, [pipelineProgress?.started_at]);

  const estimatedRemainingMinutes = React.useMemo(() => {
    if (totalCompanies <= 0 || completedCompanies >= totalCompanies) return null;
    const remaining = totalCompanies - completedCompanies;
    // Fast-pass first run ~2-3 min per company
    return Math.max(1, remaining * 3);
  }, [totalCompanies, completedCompanies]);

  const degradedSourceKeys = React.useMemo(() => {
    if (!pipelineProgress?.source_errors) return [];
    return Object.keys(pipelineProgress.source_errors).filter(
      (k) => pipelineProgress.source_errors![k]
    );
  }, [pipelineProgress?.source_errors]);

  return (
    <header className="space-y-4 pt-1">
      {/* Top telemetry row: Eyebrow + Live pulse badge */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-[10.5px] font-mono font-bold tracking-[0.2em] text-[#b6a0ff] uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--violet)] shadow-[0_0_8px_var(--violet)]" />
          PRISMIQ · {targetCompany ? `${targetCompany.toUpperCase()} · ` : ""}INTELLIGENCE BRIEFING
        </span>

        {/* Compact status pill */}
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border border-white/10 bg-[#0c0c11]/80 backdrop-blur-md text-[11px] text-[#bbb] font-mono shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          {isPipelineRunning ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] animate-ping" />
              <span>
                Pipeline syncing:{" "}
                <strong className="text-white font-semibold">
                  {totalCompanies > 0 ? `${completedCompanies}/${totalCompanies} complete` : "Initializing..."}
                </strong>
              </span>
            </>
          ) : (
            <>
              <span className={cn("inline-block w-2 h-2 rounded-full", timeInfo?.relative ? "bg-[var(--green)] shadow-[0_0_8px_var(--green)] animate-pulse" : "bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]")} />
              <span>
                {timeInfo?.relative ? (
                  <>Updated <strong className="text-white font-semibold">{timeInfo.relative}</strong></>
                ) : (
                  <strong className="text-amber-200/90 font-semibold">Initial pipeline sweep pending</strong>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main greeting & subhead */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl sm:text-4xl md:text-[44px] text-[#F3F2EF] font-normal leading-tight tracking-tight">
          {greeting}
        </h1>
        <p className="text-sm sm:text-[15px] text-[#9a9ba6] leading-relaxed max-w-2xl">
          {targetCompany
            ? `Here's what changed that deserves your strategic attention for ${targetCompany}.`
            : "Here's what changed that deserves your attention."}
        </p>
      </div>

      {/* Active Pipeline Honest Progress Strip */}
      {isPipelineRunning && (
        <div className="rounded-[8px] border border-[var(--cyan)]/30 bg-gradient-to-r from-[rgba(0,229,255,0.06)] via-[rgba(165,107,255,0.05)] to-transparent p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] animate-pulse" />
              <span className="font-mono font-semibold text-white tracking-wide uppercase text-[11px]">
                {pipelineProgress?.progress_message || `Fetching signals: ${completedCompanies} of ${totalCompanies} competitors complete`}
              </span>
              {completedCompanies > 0 && (
                <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--cyan)]/15 border border-[var(--cyan)]/30 text-[var(--cyan)] font-mono">
                  first insights ready below
                </span>
              )}
            </div>

            <div className="font-mono text-[11px] text-[#9a9ba6] shrink-0">
              Started {elapsedMinutes}m ago
              {estimatedRemainingMinutes ? ` · Est. ${estimatedRemainingMinutes}m remaining` : ""}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-[var(--cyan)] via-[var(--violet)] to-[var(--magenta)] transition-all duration-500 ease-out"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>

          {/* Inline notice for degraded or rate-limited sources */}
          {degradedSourceKeys.length > 0 && (
            <div className="text-[11px] text-[#d4b06f] font-mono flex items-center gap-1.5 pt-0.5">
              <span>⚠</span>
              <span>
                {degradedSourceKeys.join(", ")} running with rate-limit delays or temporary degradation (normal) — other sources complete
              </span>
            </div>
          )}
        </div>
      )}

      {/* Timeout / Long-running Notice */}
      {isTimedOut && (
        <div className="rounded-[6px] border border-[var(--amber)]/40 bg-[rgba(255,180,90,0.08)] px-3.5 py-2.5 text-xs text-[#eed] flex items-center justify-between gap-3 shadow-[0_0_16px_rgba(255,180,90,0.1)]">
          <div className="flex items-center gap-2 font-mono text-[11.5px]">
            <span className="text-[var(--amber)]">⚠</span>
            <span>
              Pipeline run taking longer than expected. Partial data is available below. Background sync continuing.
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--amber)] uppercase tracking-wider shrink-0 border border-[var(--amber)]/30 px-2 py-0.5 rounded">
            Continuing Sync
          </span>
        </div>
      )}

      {/* Compact single-line telemetry status strip for historical degradation */}
      {!isPipelineRunning && !isTimedOut && hasPartialDegradation && (
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

