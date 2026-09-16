"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";
import { parseEvidenceCount } from "@/lib/evidenceUtils";
import type { FindingData } from "@/components/primitives/FindingRow";

interface OverviewFindingCardProps {
  finding: FindingData;
  index: number;
  onInspect: (finding: FindingData) => void;
  className?: string;
}

export function OverviewFindingCard({
  finding,
  index,
  onInspect,
  className,
}: OverviewFindingCardProps) {
  const norm = finding.company.toLowerCase();
  const displayNumber = String(index + 1).padStart(2, "0");

  // Spectral accent assignment per reference
  const accentColor = norm.includes("stripe")
    ? "var(--magenta)"
    : norm.includes("cloudflare")
    ? "var(--cyan)"
    : norm.includes("vercel")
    ? "var(--violet)"
    : "var(--amber)";

  const backgroundGradient = norm.includes("stripe")
    ? "linear-gradient(105deg, rgba(241,91,181,0.055), transparent 42%)"
    : norm.includes("cloudflare")
    ? "linear-gradient(255deg, rgba(54,230,208,0.05), transparent 45%)"
    : "linear-gradient(105deg, rgba(165,107,255,0.05), transparent 45%)";

  const totalSources =
    finding.rawSignals?.length ||
    finding.sources?.length ||
    finding.corroborationCount ||
    (norm.includes("stripe") ? 3 : 2);

  const evidenceStats = parseEvidenceCount(totalSources, 1);
  const isHigh = (finding.confidence || "High").toLowerCase().includes("high");
  const isMust = (finding.tier || "Must-Know").toLowerCase().includes("must");

  return (
    <article
      style={{
        ["--accent" as any]: accentColor,
        background: backgroundGradient,
      }}
      className={cn(
        "finding group relative grid grid-cols-1 md:grid-cols-[145px_1fr_190px] gap-5 md:gap-6 p-5 sm:p-6",
        "border border-[rgba(255,255,255,0.09)] rounded-[8px] mb-3.5 overflow-hidden transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-[rgba(165,107,255,0.4)]",
        className
      )}
    >
      {/* Top Border Accent Hairline */}
      <div
        className="absolute inset-x-0 top-0 h-[1px] opacity-70 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent 60%)`,
        }}
      />

      {/* Column 1: Recognized Company Logo Box */}
      <div className="flex md:block items-center justify-center">
        <CompanyLogo
          company={finding.company}
          variant="hero"
          accentColor={accentColor}
          className="w-full max-w-[200px] md:max-w-none"
        />
      </div>

      {/* Column 2: Metadata + Serif Headline + Why It Matters */}
      <div className="space-y-3 min-w-0">
        {/* Meta row: Number · Company · Tier · Confidence */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono font-bold tracking-wider">
          <span className="text-[#8fdff8]">{displayNumber}</span>
          <span className="text-[#ddd] uppercase">{finding.company}</span>

          {/* Tier badge */}
          <span
            className={cn(
              "px-2 py-0.5 rounded-[3px] text-[9px] font-mono tracking-wide uppercase border",
              isMust
                ? "text-[#ff7d95] border-[#ff5b78]/40 bg-[#ff5b78]/[0.08]"
                : "text-[#75d7ff] border-[#27a0ff]/35 bg-[#27a0ff]/[0.07]"
            )}
          >
            {isMust ? "MUST-KNOW" : "SHOULD-KNOW"}
          </span>

          {/* Confidence badge */}
          <span
            className={cn(
              "px-2 py-0.5 rounded-[3px] text-[9px] font-mono tracking-wide border",
              isHigh
                ? "text-[var(--cyan)] border-[var(--cyan)]/30 bg-[var(--cyan)]/[0.07]"
                : "text-[var(--amber)] border-[var(--amber)]/30 bg-[var(--amber)]/[0.07]"
            )}
          >
            ● {isHigh ? "HIGH" : "MED"}
          </span>
        </div>

        {/* Serif Headline */}
        <h3 className="font-serif text-xl sm:text-[22px] text-[#f3f2ef] font-normal leading-[1.25] tracking-tight">
          {finding.headline}
        </h3>

        {/* Why It Matters */}
        <div
          className="pl-3.5 text-xs sm:text-[12.5px] leading-relaxed text-[#b8b8c2] space-y-1.5"
          style={{
            borderLeft: `2px solid ${accentColor}`,
          }}
        >
          <span
            className="flex items-center font-bold text-[9.5px] tracking-[0.16em] uppercase"
            style={{ color: accentColor }}
          >
            <span className="mr-1.5 opacity-90">↳</span> WHY IT MATTERS
          </span>
          <p>{finding.whyItMatters}</p>
        </div>
      </div>

      {/* Column 3: Actions & Evidence Stats */}
      <div className="md:border-l border-[rgba(255,255,255,0.09)] md:pl-5 pt-3 md:pt-0 border-t md:border-t-0 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start gap-4 shrink-0">
        {/* Inspect Evidence Button */}
        <button
          type="button"
          onClick={() => onInspect(finding)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[rgba(165,107,255,0.3)] bg-[rgba(165,107,255,0.05)] text-[#d4c8ff] hover:text-white hover:bg-[rgba(165,107,255,0.15)] hover:border-[rgba(165,107,255,0.5)] transition-colors text-[10.5px] font-mono cursor-pointer select-none"
        >
          <span>♧</span>
          <span>Inspect evidence →</span>
        </button>

        {/* Source stats */}
        <div className="text-[11px] text-[#eee] font-mono">
          <div className="font-semibold">
            {evidenceStats.total} {evidenceStats.total === 1 ? "source" : "sources"}
          </div>
          <div className="text-[#777985] text-[9.5px] mt-0.5">
            {evidenceStats.total === 1
              ? "Primary"
              : `1 primary · ${evidenceStats.corroborating} corroborating`}
          </div>
        </div>

        {/* Confidence indicator */}
        <div
          className={cn(
            "text-[10.5px] font-mono font-medium flex items-center gap-1",
            isHigh ? "text-[var(--cyan)]" : "text-[var(--amber)]"
          )}
        >
          <span>◉</span>
          <span>{isHigh ? "High confidence" : "Medium confidence"}</span>
        </div>
      </div>
    </article>
  );
}
