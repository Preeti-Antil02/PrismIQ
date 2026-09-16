import * as React from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Database, Code2, Newspaper, Tag, FileText } from "lucide-react";
import { formatRelativeTime } from "@/lib/timeUtils";

export interface SourceRecord {
  id?: string;
  source: string;
  sourceType?: string;
  extractedText: string;
  url?: string;
  timestamp?: string;
  isPrimary?: boolean;
}

interface EvidenceLedgerProps {
  records: SourceRecord[];
  className?: string;
}

function getSourceIcon(source: string, type?: string) {
  const s = `${source} ${type || ""}`.toLowerCase();
  if (s.includes("github") || s.includes("commit") || s.includes("repo")) return Code2;
  if (s.includes("news") || s.includes("article") || s.includes("hackernews")) return Newspaper;
  if (s.includes("pricing") || s.includes("tier")) return Tag;
  if (s.includes("database") || s.includes("db")) return Database;
  return FileText;
}

export function EvidenceLedger({ records, className }: EvidenceLedgerProps) {
  if (!records || records.length === 0) {
    return (
      <div className="rounded-[6px] bg-[#0A0D14] border border-[rgba(255,255,255,0.06)] p-4 text-center text-xs text-[#6B7280]">
        No raw source records available for this finding.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {records.map((record, idx) => {
        const Icon = getSourceIcon(record.source, record.sourceType);
        const isPrimary = record.isPrimary !== undefined ? record.isPrimary : idx === 0;

        return (
          <div
            key={record.id || idx}
            className="rounded-[6px] bg-[#0A0D14] border border-[rgba(255,255,255,0.08)] p-3.5 space-y-2 text-xs"
          >
            {/* Source header */}
            <div className="flex items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.04)] pb-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1 rounded-[3px] bg-[#151922] text-[#9CA3AF] border border-[rgba(255,255,255,0.06)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="font-semibold text-[#F3F4F6] uppercase tracking-wide text-[11px]">
                  {record.source}
                </span>
                {/* Explicit Primary vs Corroborating Role */}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono font-medium border",
                    isPrimary
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/25"
                      : "bg-[#151922] text-[#9CA3AF] border-[rgba(255,255,255,0.06)]"
                  )}
                >
                  {isPrimary ? "Primary Source" : "Corroborating Source"}
                </span>
                {record.sourceType && (
                  <span className="px-1.5 py-0.5 rounded-[3px] bg-[#151922] text-[#9CA3AF] text-[10px] font-mono">
                    {record.sourceType}
                  </span>
                )}
              </div>

              {record.timestamp && (() => {
                const t = formatRelativeTime(record.timestamp);
                return (
                  <span
                    title={t.full}
                    className="font-mono text-[11px] text-[#6B7280] cursor-help"
                  >
                    {t.relative}
                  </span>
                );
              })()}
            </div>

            {/* Verbatim extracted evidence quote */}
            <blockquote className="text-[#D1D5DB] font-mono text-[11.5px] leading-relaxed pl-2.5 border-l-2 border-blue-500/50 bg-[#08090C]/60 py-1.5 px-2 rounded-r-[3px] whitespace-pre-wrap break-words">
              {record.extractedText}
            </blockquote>

            {/* Grounding source URL link */}
            {record.url && (
              <div className="pt-1 flex items-center justify-end">
                <a
                  href={record.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  <span>{isPrimary ? "Verify primary source" : "Verify corroborating source"}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
