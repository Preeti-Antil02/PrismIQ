"use client";

import * as React from "react";
import { X, ShieldCheck, AlertCircle, Info, ExternalLink } from "lucide-react";
import { formatRelativeTime } from "@/lib/timeUtils";
import { cn } from "@/lib/utils";
import { TierBadge, type TierType } from "@/components/primitives/TierBadge";
import { ConfidenceBadge, type ConfidenceScore } from "@/components/primitives/ConfidenceBadge";
import { EvidenceLedger, type SourceRecord } from "@/components/primitives/EvidenceLedger";
import { CorroborationList } from "@/components/primitives/CorroborationList";
import { formatEvidenceCount } from "@/lib/evidenceUtils";

export interface EvidenceDrawerItem {
  id?: string;
  title: string;
  company?: string;
  timestamp?: string;
  tier?: TierType;
  factualConfidence?: ConfidenceScore;
  factualRationale?: string;
  inferenceConfidence?: ConfidenceScore;
  inferenceRationale?: string;
  /** Overall confidence if separate not available */
  confidence?: ConfidenceScore;
  /** Factual summary */
  factSummary?: string;
  /** Tenant-specific strategic interpretation */
  whyItMatters: string;
  /** Competitive implication */
  implication?: string;
  /** Extracted raw source records */
  records?: SourceRecord[];
  /** Corroborating channels (e.g. ["GitHub", "News", "Pricing"]) */
  corroboratingSources?: string[];
}

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: EvidenceDrawerItem | null;
}

export function EvidenceDrawer({ isOpen, onClose, data }: EvidenceDrawerProps) {
  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const factualConf = data.factualConfidence || data.confidence || "High";
  const inferenceConf = data.inferenceConfidence || "Medium";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#08090C]/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full sm:w-[520px] h-full bg-[#151922] border-l border-[rgba(255,255,255,0.08)] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Section 1: Header */}
        <header className="p-5 border-b border-[rgba(255,255,255,0.08)] bg-[#0E1117] shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {data.company && (
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#9CA3AF] px-2 py-0.5 rounded-[3px] bg-[#151922] border border-[rgba(255,255,255,0.06)]">
                  {data.company}
                </span>
              )}
              {data.tier && <TierBadge tier={data.tier} />}
              {data.confidence && <ConfidenceBadge confidence={data.confidence} size="sm" />}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-[4px] text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C222E] transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Close evidence inspection drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-400 block mb-1">
              EVIDENCE DOSSIER · WHY SHOULD I BELIEVE THIS?
            </span>
            <h2 id="drawer-title" className="text-base font-semibold text-[#F3F4F6] leading-snug">
              {data.title}
            </h2>
            {data.timestamp && (() => {
              const t = formatRelativeTime(data.timestamp);
              return (
                <p
                  title={t.full}
                  className="font-mono text-[11px] text-[#6B7280] mt-1 cursor-help"
                >
                  Detected: <span className="text-[#9CA3AF]">{t.relative}</span>
                </p>
              );
            })()}
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 2: Confidence Breakdown (Factual vs. Inference Separated) */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6B7280]">
                01 · Confidence & Epistemic Separation
              </span>
              <span className="text-[10px] text-[#9CA3AF] font-mono">
                Fact vs. Inference separated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Factual Confidence */}
              <div className="p-3 rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#9CA3AF]">Factual Grounding</span>
                  <ConfidenceBadge confidence={factualConf} kind="factual" size="sm" />
                </div>
                <p className="text-[11.5px] text-[#9CA3AF] leading-relaxed">
                  {data.factualRationale ||
                    "Direct observation verified against primary unredacted records."}
                </p>
              </div>

              {/* Inference Confidence */}
              <div className="p-3 rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#9CA3AF]">Strategic Inference</span>
                  <ConfidenceBadge confidence={inferenceConf} kind="inference" size="sm" />
                </div>
                <p className="text-[11.5px] text-[#9CA3AF] leading-relaxed">
                  {data.inferenceRationale ||
                    "Derived from multi-signal competitive positioning and observed activity patterns."}
                </p>
              </div>
            </div>

            {/* Terminology Definition */}
            <div className="p-2.5 rounded-[4px] bg-[#0A0D14] border border-[rgba(255,255,255,0.04)] text-[10.5px] font-mono text-[#6B7280] space-y-0.5">
              <span className="text-[#9CA3AF] font-semibold block uppercase tracking-wider text-[9.5px]">
                Evidence Count Terminology:
              </span>
              <div>
                <span className="text-blue-400">Primary</span> = Original first-party record supporting the claim ·{" "}
                <span className="text-[#9CA3AF]">Corroborating</span> = Additional independent source.
              </div>
            </div>
          </section>

          {/* Section 3: Assessment Layers (OBSERVED -> INTERPRETATION -> IMPLICATION) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6B7280]">
                02 · Three-Layer Assessment
              </span>
              <span className="px-1.5 py-0.5 rounded-[3px] bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono font-medium">
                FACT · INTERPRETATION · IMPLICATION
              </span>
            </div>

            <div className="rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] divide-y divide-[rgba(255,255,255,0.04)] overflow-hidden">
              {/* Layer 1: OBSERVED */}
              <div className="p-3.5 space-y-1 bg-[#0B0D12]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    OBSERVED
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    Directly established by primary sources
                  </span>
                </div>
                <p className="text-xs text-[#E5E7EB] leading-relaxed">
                  {data.factSummary || data.title}
                </p>
              </div>

              {/* Layer 2: INTERPRETATION */}
              <div className="p-3.5 space-y-1 border-l-2 border-l-blue-500/80">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                    INTERPRETATION
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    PrismIQ analytical inference
                  </span>
                </div>
                <p className="text-xs text-[#D1D5DB] leading-relaxed">
                  {data.whyItMatters}
                </p>
              </div>

              {/* Layer 3: IMPLICATION */}
              {(data.implication || data.inferenceRationale) && (
                <div className="p-3.5 space-y-1 border-l-2 border-l-amber-500/80">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                      COMPETITIVE IMPLICATION
                    </span>
                    <span className="text-[10px] text-[#6B7280]">
                      Potential competitive effect
                    </span>
                  </div>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    {data.implication || data.inferenceRationale}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Section 4: Evidence Ledger (Individual source records) */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6B7280]">
                03 · Evidence Ledger
              </span>
              <span className="text-[10px] text-[#9CA3AF] font-mono">
                {formatEvidenceCount(data.records?.length || 1, 1)}
              </span>
            </div>

            <EvidenceLedger records={data.records || []} />
          </section>

          {/* Section 5: Corroboration (Supporting sources connected set) */}
          <section className="space-y-2.5 pt-2 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6B7280] block">
                04 · Corroboration Graph
              </span>
              <span className="text-[10px] text-[#6B7280] font-mono">
                {(data.records?.length || 1) > 1
                  ? `${(data.records?.length || 1) - 1} corroborating sources`
                  : "Awaiting corroboration"}
              </span>
            </div>

            <div className="p-3.5 rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)]">
              <CorroborationList
                sources={
                  data.corroboratingSources && data.corroboratingSources.length > 0
                    ? data.corroboratingSources
                    : (data.records && data.records.length > 1)
                    ? data.records.slice(1).map((r) => r.source)
                    : []
                }
              />
            </div>
          </section>

          {/* Section 5: Data Limitations & Scope */}
          <section className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6B7280] block">
              05 · Data Limitations & Scope
            </span>
            <div className="p-3 rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.04)] text-[11.5px] text-[#9CA3AF] leading-relaxed">
              Synthesized from unredacted primary records, published developer repositories, and monitored external endpoints. Private internal roadmaps, unpublished bilateral customer contracts, and unannounced pricing discounts remain unobserved.
            </div>
          </section>
        </div>

        {/* Footer info */}
        <footer className="p-3.5 px-5 border-t border-[rgba(255,255,255,0.06)] bg-[#0E1117] text-[11px] text-[#6B7280] flex items-center justify-between shrink-0 font-mono">
          <span>PrismIQ Grounded Evidence Protocol</span>
          <span>Press ESC to dismiss</span>
        </footer>
      </div>
    </div>
  );
}
