"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";
import { parseEvidenceCount } from "@/lib/evidenceUtils";
import type { FindingData } from "@/components/primitives/FindingRow";

interface OverviewAttentionGridProps {
  findings: FindingData[];
  onInspect: (finding: FindingData) => void;
}

export function OverviewAttentionGrid({
  findings,
  onInspect,
}: OverviewAttentionGridProps) {
  const primaryFinding = findings[0];
  const secondaryFinding = findings[1];
  const tertiaryFinding = findings[2];

  if (!primaryFinding) return null;

  const p1Evidence = parseEvidenceCount(
    primaryFinding.rawSignals?.length || primaryFinding.sources?.length || 3,
    1
  );
  const p2Evidence = secondaryFinding
    ? parseEvidenceCount(
        secondaryFinding.rawSignals?.length || secondaryFinding.sources?.length || 2,
        1
      )
    : { total: 2, corroborating: 1 };
  const p3Evidence = tertiaryFinding
    ? parseEvidenceCount(
        tertiaryFinding.rawSignals?.length || tertiaryFinding.sources?.length || 2,
        1
      )
    : { total: 2, corroborating: 1 };

  return (
    <section className="space-y-4" aria-label="What deserves your attention">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div>
          <div className="text-[10px] font-mono tracking-[0.18em] text-[#c5b4ff] uppercase font-bold flex items-center gap-1.5">
            <span className="text-[var(--violet)] text-xs drop-shadow-[0_0_8px_rgba(165,107,255,0.7)]">✦</span>
            WHAT DESERVES YOUR ATTENTION
          </div>
          <h2 className="font-serif text-2xl sm:text-[26px] font-normal mt-1 section-title-gradient leading-snug">
            3 developments prioritized for executive review
          </h2>
        </div>

        <Link
          href="/app/brief"
          className="text-xs font-mono text-[#bba4ff] hover:text-[#ddd] transition-colors inline-flex items-center gap-1 self-start sm:self-auto group"
        >
          <span>View all in Brief</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Asymmetric Intelligence Cockpit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* ========================================================================= */}
        {/* PRIMARY HERO CARD (01 STRIPE) — Left Dominant Feature Column             */}
        {/* ========================================================================= */}
        <article
          className={cn(
            "lg:col-span-7 group relative flex flex-col justify-between p-5 sm:p-6 rounded-[10px]",
            "border border-white/[0.12] bg-gradient-to-b from-[rgba(241,91,181,0.06)] via-[rgba(255,255,255,0.02)] to-[rgba(5,5,8,0.85)]",
            "shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]",
            "transition-all duration-300 hover:border-[rgba(241,91,181,0.5)] hover:-translate-y-0.5"
          )}
        >
          {/* Top Magenta Accent Hairline */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--magenta)] via-[var(--magenta)]/60 to-transparent rounded-t-[10px]" />

          <div className="space-y-4">
            {/* Meta Bar: Priority Tag + Company Mark + Tier + Confidence */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-[#8fdff8] px-1.5 py-0.5 rounded-[3px] bg-white/[0.04] border border-white/[0.08]">
                  01
                </span>
                <CompanyLogo company={primaryFinding.company} variant="mini" />
                <span className="font-bold text-xs uppercase tracking-wider text-[#F3F2EF]">
                  {primaryFinding.company}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[9.5px] font-mono">
                <span className="px-2 py-0.5 rounded-[3px] font-semibold text-[#ff7d95] border border-[#ff5b78]/40 bg-[#ff5b78]/[0.08] uppercase">
                  MUST-KNOW
                </span>
                <span className="px-2 py-0.5 rounded-[3px] font-semibold text-[var(--cyan)] border border-[var(--cyan)]/30 bg-[var(--cyan)]/[0.08]">
                  ● HIGH
                </span>
              </div>
            </div>

            {/* Prominent Headline */}
            <h3 className="font-serif text-2xl sm:text-[25px] text-[#F3F2EF] font-normal leading-[1.22] tracking-tight">
              {primaryFinding.headline}
            </h3>

            {/* Why It Matters Callout */}
            <div className="border-l-2 border-[var(--magenta)] pl-3.5 py-1 space-y-1 bg-gradient-to-r from-[rgba(241,91,181,0.05)] to-transparent rounded-r-[4px]">
              <span className="text-[9.5px] font-mono font-bold uppercase tracking-[0.16em] text-[var(--magenta)] flex items-center gap-1.5">
                <span>↳</span> WHY IT MATTERS
              </span>
              <p className="text-xs sm:text-[13px] text-[#b8b8c2] leading-relaxed">
                {primaryFinding.whyItMatters}
              </p>
            </div>
          </div>

          {/* Footer Bar: Evidence Summary + Action Trigger */}
          <div className="pt-5 mt-5 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap text-xs">
            <div className="font-mono text-[11px] text-[#8e8f9a]">
              <span className="text-white font-medium">{p1Evidence.total} sources</span>
              <span className="text-[#676875] mx-1.5">·</span>
              <span>1 primary · {p1Evidence.corroborating} corroborating</span>
              <span className="text-[#676875] mx-1.5">·</span>
              <span className="text-[var(--cyan)] font-medium">● High confidence</span>
            </div>

            <button
              type="button"
              onClick={() => onInspect(primaryFinding)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[rgba(241,91,181,0.4)] bg-[rgba(241,91,181,0.08)] text-[#fcddec] hover:text-white hover:bg-[rgba(241,91,181,0.18)] hover:border-[rgba(241,91,181,0.6)] transition-all font-mono text-[11px] cursor-pointer select-none"
            >
              <span>Inspect evidence dossier</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </article>

        {/* ========================================================================= */}
        {/* SECONDARY & TERTIARY STACK — Right Modular Co-Pilot Column                */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Card 02: Cloudflare */}
          {secondaryFinding && (
            <article
              className={cn(
                "group relative flex-1 flex flex-col justify-between p-4 sm:p-5 rounded-[10px]",
                "border border-white/[0.09] bg-gradient-to-b from-[rgba(54,230,208,0.05)] via-[rgba(255,255,255,0.015)] to-[rgba(5,5,8,0.85)]",
                "shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-300",
                "hover:border-[rgba(54,230,208,0.45)] hover:-translate-y-0.5"
              )}
            >
              {/* Cyan Accent Hairline */}
              <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[var(--cyan)] via-[var(--cyan)]/50 to-transparent rounded-t-[10px]" />

              <div className="space-y-2.5">
                {/* Meta Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#8fdff8] px-1 py-0.5 rounded-[3px] bg-white/[0.04]">
                      02
                    </span>
                    <CompanyLogo company={secondaryFinding.company} variant="mini" className="w-6 h-6" />
                    <span className="font-bold text-xs uppercase tracking-wider text-[#F3F2EF]">
                      {secondaryFinding.company}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] font-mono">
                    <span className="px-1.5 py-0.5 rounded-[3px] text-[#ff7d95] border border-[#ff5b78]/40 bg-[#ff5b78]/[0.08] uppercase">
                      MUST-KNOW
                    </span>
                    <span className="px-1.5 py-0.5 rounded-[3px] text-[var(--cyan)] border border-[var(--cyan)]/30 bg-[var(--cyan)]/[0.08]">
                      ● HIGH
                    </span>
                  </div>
                </div>

                {/* Headline */}
                <h4 className="font-serif text-lg sm:text-[19px] text-[#F3F2EF] font-normal leading-[1.25] tracking-tight">
                  {secondaryFinding.headline}
                </h4>

                {/* Why it matters preview */}
                <div className="border-l-2 border-[var(--cyan)] pl-3 py-0.5 bg-gradient-to-r from-[rgba(54,230,208,0.04)] to-transparent rounded-r-[3px]">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-[var(--cyan)] block mb-0.5">
                    ↳ WHY IT MATTERS
                  </span>
                  <p className="text-xs text-[#a9aab4] leading-relaxed line-clamp-2">
                    {secondaryFinding.whyItMatters}
                  </p>
                </div>
              </div>

              {/* Action row */}
              <div className="pt-3 mt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#777985]">
                  {p2Evidence.total} sources · 1 primary · {p2Evidence.corroborating} corroborating
                </span>
                <button
                  type="button"
                  onClick={() => onInspect(secondaryFinding)}
                  className="text-[var(--cyan)] hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer select-none font-medium"
                >
                  <span>Inspect</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </article>
          )}

          {/* Card 03: Vercel */}
          {tertiaryFinding && (
            <article
              className={cn(
                "group relative flex-1 flex flex-col justify-between p-4 sm:p-5 rounded-[10px]",
                "border border-white/[0.09] bg-gradient-to-b from-[rgba(165,107,255,0.05)] via-[rgba(255,255,255,0.015)] to-[rgba(5,5,8,0.85)]",
                "shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-300",
                "hover:border-[rgba(165,107,255,0.45)] hover:-translate-y-0.5"
              )}
            >
              {/* Violet Accent Hairline */}
              <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-[var(--violet)] via-[var(--violet)]/50 to-transparent rounded-t-[10px]" />

              <div className="space-y-2.5">
                {/* Meta Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#8fdff8] px-1 py-0.5 rounded-[3px] bg-white/[0.04]">
                      03
                    </span>
                    <CompanyLogo company={tertiaryFinding.company} variant="mini" className="w-6 h-6" />
                    <span className="font-bold text-xs uppercase tracking-wider text-[#F3F2EF]">
                      {tertiaryFinding.company}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] font-mono">
                    <span className="px-1.5 py-0.5 rounded-[3px] text-[#75d7ff] border border-[#27a0ff]/35 bg-[#27a0ff]/[0.07] uppercase">
                      SHOULD-KNOW
                    </span>
                    <span className="px-1.5 py-0.5 rounded-[3px] text-[var(--amber)] border border-[var(--amber)]/30 bg-[var(--amber)]/[0.08]">
                      ● MED
                    </span>
                  </div>
                </div>

                {/* Headline */}
                <h4 className="font-serif text-lg sm:text-[19px] text-[#F3F2EF] font-normal leading-[1.25] tracking-tight">
                  {tertiaryFinding.headline}
                </h4>

                {/* Why it matters preview */}
                <div className="border-l-2 border-[var(--violet)] pl-3 py-0.5 bg-gradient-to-r from-[rgba(165,107,255,0.04)] to-transparent rounded-r-[3px]">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-[var(--violet)] block mb-0.5">
                    ↳ WHY IT MATTERS
                  </span>
                  <p className="text-xs text-[#a9aab4] leading-relaxed line-clamp-2">
                    {tertiaryFinding.whyItMatters}
                  </p>
                </div>
              </div>

              {/* Action row */}
              <div className="pt-3 mt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#777985]">
                  {p3Evidence.total} sources · 1 primary · {p3Evidence.corroborating} corroborating
                </span>
                <button
                  type="button"
                  onClick={() => onInspect(tertiaryFinding)}
                  className="text-[#bba4ff] hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer select-none font-medium"
                >
                  <span>Inspect</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
