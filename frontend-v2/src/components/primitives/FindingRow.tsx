import * as React from "react";
import { cn } from "@/lib/utils";
import { TierBadge, type TierLevel } from "./TierBadge";
import { ConfidenceBadge, type ConfidenceScore } from "./ConfidenceBadge";
import { ArrowRight, FileSearch } from "lucide-react";
import { formatRelativeTime } from "@/lib/timeUtils";
import { formatEvidenceCount } from "@/lib/evidenceUtils";

export interface FindingData {
  id?: string;
  index?: number;
  company: string;
  headline: string;
  whyItMatters: string;
  implication?: string;
  fact?: string;
  tier?: TierLevel;
  confidence?: ConfidenceScore;
  inferenceConfidence?: ConfidenceScore;
  factConfidence?: ConfidenceScore;
  timestamp?: string;
  url?: string;
  sourceType?: string;
  corroborationCount?: number;
  sources?: string[];
  rawSignals?: Array<{
    source: string;
    text: string;
    url: string;
    timestamp?: string;
  }>;
}

interface FindingRowProps {
  finding: FindingData;
  index?: number;
  onInspect: (finding: FindingData) => void;
  className?: string;
  showIndex?: boolean;
  showImplication?: boolean;
}

export function FindingRow({
  finding,
  index,
  onInspect,
  className,
  showIndex = true,
  showImplication = false,
}: FindingRowProps) {
  const displayIndex = index !== undefined && showIndex ? String(index + 1).padStart(2, "0") : undefined;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onInspect(finding);
    }
  };

  const timeInfo = finding.timestamp ? formatRelativeTime(finding.timestamp) : null;

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`Inspect finding: ${finding.headline}`}
      onClick={() => onInspect(finding)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] p-4 sm:p-5 transition-all duration-150 hover:border-[rgba(255,255,255,0.15)] hover:bg-[#11151E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 cursor-pointer select-none space-y-3.5",
        className
      )}
    >
      {/* Top Header Row: 01 · Company · Priority · Confidence · Relative Timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.04)] pb-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          {displayIndex && (
            <span className="font-mono text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
              {displayIndex}
            </span>
          )}

          <span className="text-xs font-bold text-[#F3F4F6] uppercase tracking-wider">
            {finding.company}
          </span>

          {finding.tier && <TierBadge tier={finding.tier} size="sm" />}
          {finding.confidence && <ConfidenceBadge confidence={finding.confidence} size="sm" />}
        </div>

        {timeInfo && (
          <span
            title={timeInfo.full}
            className="font-mono text-[11px] text-[#6B7280] cursor-help shrink-0"
          >
            {timeInfo.relative}
          </span>
        )}
      </div>

      {/* Headline: Clear, consolidated real-world development */}
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-[#F3F4F6] group-hover:text-white transition-colors leading-snug">
          {finding.headline}
        </h3>
      </div>

      {/* WHY IT MATTERS: 1–2 concise sentences with subtle left accent */}
      <div className="border-l-2 border-l-blue-500/70 pl-3 py-0.5 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] block">
          WHY IT MATTERS
        </span>
        <p className="text-xs sm:text-[13px] text-[#D1D5DB] leading-relaxed">
          {finding.whyItMatters}
        </p>
      </div>

      {/* Optional Decision Implication (Off by default for concise Overview) */}
      {showImplication && finding.implication && (
        <div className="border-l-2 border-l-amber-500/70 pl-3 py-0.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-400/90 block">
            DECISION IMPLICATION
          </span>
          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            {finding.implication}
          </p>
        </div>
      )}

      {/* Bottom Action Affordance */}
      <div className="flex items-center justify-between pt-1 border-t border-[rgba(255,255,255,0.03)] text-xs">
        <span className="text-[11px] font-mono text-[#6B7280]">
          {formatEvidenceCount(
            finding.rawSignals?.length || finding.sources?.length || finding.corroborationCount || 1,
            1
          )}
        </span>

        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
          Inspect evidence
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </article>
  );
}
