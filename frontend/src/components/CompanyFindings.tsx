import React from "react";
import { CompanySection, Finding, OtherActivityItem } from "@/types/brief";
import {
  Building2,
  ChevronDown,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  ShieldAlert,
} from "lucide-react";

interface CompanyFindingsProps {
  companies: CompanySection[];
}

function ConfidenceBadge({ confidence }: { confidence?: string }) {
  const conf = confidence || "Medium";
  const colorMap: Record<string, string> = {
    High: "bg-emerald-950/60 text-emerald-300 border-emerald-800/80",
    Medium: "bg-blue-950/60 text-blue-300 border-blue-800/80",
    Low: "bg-zinc-900 text-zinc-400 border-zinc-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        colorMap[conf] || colorMap.Medium
      }`}
    >
      {conf} confidence
    </span>
  );
}

function SourceBadge({ source }: { source?: string }) {
  const isGithub = source?.toLowerCase() === "github";
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#16171B] border border-[#27272A] px-2 py-0.5 text-[11px] font-medium text-[#A1A1AA]">
      {isGithub ? (
        <Layers className="h-3 w-3 text-violet-400" />
      ) : (
        <Globe className="h-3 w-3 text-cyan-400" />
      )}
      <span className="capitalize">{source || "news"}</span>
    </span>
  );
}

export function CompanyFindings({ companies }: CompanyFindingsProps) {
  if (!companies || companies.length === 0) return null;

  return (
    <section className="space-y-8">
      <div className="border-b border-[#1F2023] pb-3">
        <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-[#71717A] flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-400" />
          <span>Competitive Findings by Entity</span>
        </h2>
        <p className="text-xs text-[#A1A1AA] mt-0.5">
          Detailed intelligence breakdown tiered by strategic importance and operational impact
        </p>
      </div>

      <div className="space-y-8">
        {companies.map((sec) => (
          <div
            key={sec.company}
            className="rounded-2xl border border-[#1F2023] bg-[#0D0E12] p-5 sm:p-6 transition-all duration-200 hover:border-[#2E3036] space-y-6"
          >
            {/* Company Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2023] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black font-bold text-sm shadow-xs">
                  {sec.company.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {sec.company}
                  </h3>
                  <div className="text-xs text-[#71717A]">
                    Tracked competitor entity
                  </div>
                </div>
              </div>

              {/* Tier Counts Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {sec.mustKnow.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-950/60 border border-blue-800/80 px-2.5 py-1 text-xs font-semibold text-blue-300">
                    <Flame className="h-3 w-3" />
                    <span>{sec.mustKnow.length} Must-Know</span>
                  </span>
                )}
                {sec.shouldKnow.length > 0 && (
                  <span className="inline-flex items-center rounded-md bg-[#16171B] border border-[#27272A] px-2.5 py-1 text-xs font-medium text-[#D4D4D8]">
                    {sec.shouldKnow.length} Should-Know
                  </span>
                )}
                {sec.otherActivity.length > 0 && (
                  <span className="inline-flex items-center rounded-md bg-[#121316] border border-[#1F2023] px-2 py-1 text-xs text-[#71717A]">
                    {sec.otherActivity.length} Other
                  </span>
                )}
              </div>
            </div>

            {/* 1. MUST-KNOW FINDINGS (Full detail) */}
            {sec.mustKnow.length > 0 && (
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                  <span>Must-Know Priority Signals ({sec.mustKnow.length})</span>
                </div>

                <div className="space-y-3">
                  {sec.mustKnow.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4.5 transition-all duration-200 ${
                        item.isSecurityRisk
                          ? "border-rose-900/40 bg-rose-950/15 hover:border-rose-700/60 hover:bg-rose-950/25"
                          : "border-[#1F2023] bg-[#121316] hover:border-[#2E3036] hover:bg-[#16171B]"
                      }`}
                    >
                      {/* Title & Clickable Link */}
                      <div className="flex items-start justify-between gap-3">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group text-sm sm:text-base font-bold text-white hover:text-blue-400 hover:underline decoration-blue-500/50 underline-offset-2 transition-colors inline-flex items-baseline gap-1.5"
                        >
                          <span>{item.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-blue-400" />
                        </a>

                        {item.isSecurityRisk && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 text-[11px] font-semibold text-rose-300 shrink-0">
                            <ShieldAlert className="h-3 w-3" />
                            <span>Security</span>
                          </span>
                        )}
                      </div>

                      {/* Metadata row */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-[#71717A]">
                        <SourceBadge source={item.source} />
                        <span>•</span>
                        <ConfidenceBadge confidence={item.confidence} />
                        <span>•</span>
                        <span>{item.date}</span>
                      </div>

                      {/* Why it matters */}
                      <div className="mt-3 rounded-lg bg-[#08090C] border border-[#1F2023] p-3.5 text-xs sm:text-sm text-[#D4D4D8] leading-relaxed">
                        <span className="font-semibold text-white block mb-1">
                          Strategic & Market Impact:
                        </span>
                        {item.whyItMatters}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. SHOULD-KNOW FINDINGS (Compact cards) */}
            {sec.shouldKnow.length > 0 && (
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#71717A]"></span>
                  <span>Should-Know Product Activity ({sec.shouldKnow.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sec.shouldKnow.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#1F2023] bg-[#121316] p-4 flex flex-col justify-between hover:border-[#2E3036] hover:bg-[#16171B] transition-all duration-200"
                    >
                      <div>
                        {/* Title & Clickable Link */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group text-xs sm:text-sm font-bold text-white hover:text-blue-400 hover:underline decoration-blue-500/50 underline-offset-2 transition-colors inline-flex items-baseline gap-1"
                          >
                            <span className="line-clamp-2">{item.title}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-blue-400" />
                          </a>
                          <ConfidenceBadge confidence={item.confidence} />
                        </div>

                        {/* Why it matters */}
                        <p className="text-xs text-[#A1A1AA] leading-relaxed line-clamp-3">
                          {item.whyItMatters}
                        </p>
                      </div>

                      {/* Footer metadata */}
                      <div className="mt-3 pt-2.5 border-t border-[#1F2023] flex items-center justify-between text-[11px] text-[#71717A]">
                        <SourceBadge source={item.source} />
                        <span className="truncate max-w-[140px]">{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. OTHER ACTIVITY (Collapsed by default details/summary) */}
            {sec.otherActivity.length > 0 && (
              <div className="pt-2">
                <details className="group rounded-xl border border-[#1F2023] bg-[#121316] transition-all duration-200 hover:border-[#2E3036]">
                  <summary className="flex cursor-pointer select-none items-center justify-between p-3.5 text-xs font-semibold text-[#D4D4D8] hover:text-white transition-colors">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-[#71717A]" />
                      <span>Other Activity ({sec.otherActivity.length} items)</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-[#71717A] transition-transform duration-300 ease-out group-open:rotate-180" />
                  </summary>

                  <div className="border-t border-[#1F2023] bg-[#0D0E12] p-3.5 divide-y divide-[#1F2023]">
                    {sec.otherActivity.map((item, idx) => (
                      <div
                        key={idx}
                        className="py-2.5 px-2.5 -mx-1 first:pt-1 last:pb-1 rounded-lg flex items-center justify-between gap-3 text-xs transition-colors hover:bg-[#16171B]"
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group text-[#D4D4D8] hover:text-blue-400 hover:underline decoration-blue-500/50 underline-offset-2 transition-colors inline-flex items-center gap-1.5 truncate max-w-[70%]"
                        >
                          <span className="truncate">{item.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-blue-400" />
                        </a>

                        <div className="flex items-center gap-2 text-[#71717A] shrink-0 text-[11px]">
                          <SourceBadge source={item.source} />
                          <span className="hidden sm:inline">{item.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
