"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import type { ConfidenceLevel, ConfidenceNuance, TierLevel } from "@/lib/tokens";
import {
  ExternalLink,
  Brain,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
} from "lucide-react";


export interface EvidenceSource {
  id: string;
  title: string;
  url: string;
  sourceType?: string;
  publishedAt?: string;
  excerpt?: string;
  /** Visible fail-loud flag: true if resolvable/verified, false if failed/broken */
  isValid?: boolean;
  failureReason?: string;
}

export interface EvidenceDrawerData {
  id?: string;
  title: string;
  company: string;
  timestamp?: string;
  tier?: TierLevel;
  confidence: ConfidenceLevel;
  confidenceNuance?: ConfidenceNuance;
  /** Documented, confident factual statement */
  fact: string;
  /** Hedged, analytical inference clearly marked */
  inference: string;
  sources: EvidenceSource[];
  corroborationCount?: number;
}

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: EvidenceDrawerData | null;
}

export function EvidenceDrawer({ isOpen, onClose, data }: EvidenceDrawerProps) {
  if (!data) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col h-full overflow-y-auto w-full sm:max-w-xl p-0 gap-0"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-6 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {data.company}
            </span>
            {data.tier && <TierBadge tier={data.tier} />}
            <ConfidenceBadge
              level={data.confidence}
              nuance={data.confidenceNuance}
            />
          </div>
          <SheetTitle className="text-lg font-semibold text-slate-900 leading-snug">
            {data.title}
          </SheetTitle>
          {data.timestamp && (
            <SheetDescription className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Detected {data.timestamp}</span>
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Content Body */}
        <div className="flex-1 p-6 space-y-6">
          {/* Strict Separation: FACT Section */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Documented Fact
              </h4>
              <span className="ml-auto text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                Verified Grounding
              </span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-normal">
              {data.fact || "Factual observation pending recording."}
            </p>
          </div>

          {/* Strict Separation: INFERENCE Section */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-indigo-100/70">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-indigo-700">
                <Brain className="h-3.5 w-3.5 text-indigo-700" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                Strategic Inference (Why It Matters)
              </h4>
              <span className="ml-auto text-[10px] font-medium text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                Analytical Model
              </span>
            </div>
            <p className="text-xs text-indigo-950 leading-relaxed font-normal">
              {data.inference || "No analytical inference attached to this record."}
            </p>
          </div>

          {/* Source Grounding List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Primary Sources ({data.sources?.length || 0})</span>
              </h4>
              {data.corroborationCount && data.corroborationCount > 1 && (
                <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  {data.corroborationCount} independent corroborations
                </span>
              )}
            </div>

            {(!data.sources || data.sources.length === 0) ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-1.5 text-amber-600" />
                No direct primary source citations linked to this finding.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
                {data.sources.map((source, index) => {
                  const isBroken = source.isValid === false;
                  return (
                    <div key={source.id || index} className="p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {source.sourceType || "Web Source"}
                            </span>
                            {source.publishedAt && (
                              <span className="text-[11px] text-slate-400">
                                {source.publishedAt}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-medium text-slate-900 pt-0.5">
                            {source.title}
                          </div>
                        </div>

                        {/* Visible fail-loud citation status */}
                        {isBroken ? (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded shrink-0">
                            <AlertTriangle className="h-3 w-3 text-rose-600" />
                            <span>Broken citation</span>
                          </div>
                        ) : (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                          >
                            <span>Open source</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {/* Excerpt if present */}
                      {source.excerpt && (
                        <blockquote className="text-[11px] italic text-slate-600 border-l-2 border-slate-300 pl-2 py-0.5 bg-slate-50/50">
                          &ldquo;{source.excerpt}&rdquo;
                        </blockquote>
                      )}


                      {/* Broken citation explanation if failed */}
                      {isBroken && source.failureReason && (
                        <p className="text-[10px] text-rose-600 font-mono">
                          Citation check failed: {source.failureReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
          <span>PrismIQ Verified Grounding Engine</span>
          <button
            onClick={onClose}
            type="button"
            className="text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
