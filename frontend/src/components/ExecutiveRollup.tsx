import React from "react";
import { RollupStats } from "@/types/brief";
import { Activity, CheckCircle2, Flame, Info } from "lucide-react";

interface ExecutiveRollupProps {
  rollup: RollupStats;
}

export function ExecutiveRollup({ rollup }: ExecutiveRollupProps) {
  if (!rollup || rollup.totalMonitored === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs sm:text-sm font-semibold tracking-[0.15em] uppercase text-[#71717A] flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <span>Executive Summary & Activity Rollup</span>
        </h2>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Monitored */}
        <div className="animate-fade-in-up delay-50 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-4 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#71717A]">
              Total Signals
            </span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#16171B] text-[#A1A1AA]">
              <Activity className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {rollup.totalMonitored}
          </div>
          <div className="mt-1 text-[11px] text-[#71717A]">
            across {rollup.companyCount || rollup.activityByCompany.length} tracked entities
          </div>
        </div>

        {/* Must-Know */}
        <div className="animate-fade-in-up delay-100 rounded-xl border border-blue-900/50 bg-blue-950/20 p-4 transition-all duration-200 hover:border-blue-700/60 hover:bg-blue-950/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-blue-400">
              Must-Know
            </span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-900/40 text-blue-400">
              <Flame className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-blue-300">
            {rollup.mustKnowTotal}
          </div>
          <div className="mt-1 text-[11px] text-blue-400/90 font-medium">
            Critical security & strategic moves
          </div>
        </div>

        {/* Should-Know */}
        <div className="animate-fade-in-up delay-150 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-4 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#A1A1AA]">
              Should-Know
            </span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#16171B] text-[#A1A1AA]">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {rollup.shouldKnowTotal}
          </div>
          <div className="mt-1 text-[11px] text-[#71717A]">
            Product launches & core updates
          </div>
        </div>

        {/* Other Activity */}
        <div className="animate-fade-in-up delay-200 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-4 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#71717A]">
              Other Activity
            </span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#16171B] text-[#71717A]">
              <Info className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#A1A1AA]">
            {rollup.niceToKnowTotal}
          </div>
          <div className="mt-1 text-[11px] text-[#71717A]">
            Low-information background events
          </div>
        </div>
      </div>

      {/* Key Focus Highlight & Per-Company breakdown */}
      <div className="animate-fade-in-up delay-250 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-4 space-y-3">
        {rollup.keyFocus && (
          <div className="flex items-start gap-2.5 rounded-lg bg-blue-950/30 border border-blue-900/40 px-3.5 py-2.5 text-xs text-blue-200">
            <span className="font-semibold shrink-0 text-blue-400">Key Focus:</span>
            <span>{rollup.keyFocus}</span>
          </div>
        )}

        {rollup.activityByCompany.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-2">
              Activity by Entity
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {rollup.activityByCompany.map((c) => (
                <div
                  key={c.company}
                  className="rounded-lg border border-[#1F2023] bg-[#121316] p-2.5 text-xs transition-colors hover:border-[#2E3036]"
                >
                  <div className="font-semibold text-white truncate mb-1">
                    {c.company}
                  </div>
                  <div className="flex items-center gap-2 text-[#A1A1AA]">
                    <span className="font-medium text-blue-400">{c.mustKnow} Must</span>
                    <span className="text-[#3F3F46]">•</span>
                    <span>{c.shouldKnow} Should</span>
                    <span className="text-[#3F3F46]">•</span>
                    <span className="text-[#71717A]">{c.niceToKnow} Other</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
