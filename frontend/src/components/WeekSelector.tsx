import React from "react";
import { Calendar, ChevronDown, Loader2 } from "lucide-react";
import { BriefSummary } from "@/types/brief";

interface WeekSelectorProps {
  briefs: BriefSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

export function formatDateString(dateStr: string): string {
  if (!dateStr) return "Latest Brief";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    );
  } catch {
    return dateStr;
  }
}

export function WeekSelector({
  briefs,
  selectedId,
  onSelect,
  isLoading = false,
}: WeekSelectorProps) {
  if (briefs.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-3.5 transition-all duration-200 hover:border-[#2E3036]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#16171B] text-blue-400 border border-[#27272A] transition-transform active:scale-95">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          ) : (
            <Calendar className="h-4.5 w-4.5" />
          )}
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
            Intelligence Period
          </div>
          <div className="text-xs sm:text-sm font-semibold text-white">
            Weekly Executive Digest
          </div>
        </div>
      </div>

      <div className="relative min-w-[280px]">
        <select
          value={selectedId}
          disabled={isLoading}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-lg border border-[#27272A] bg-[#121316] py-2 pl-3.5 pr-10 text-xs sm:text-sm font-medium text-white transition-all duration-150 hover:border-[#3F3F46] hover:bg-[#16171B] focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {briefs.map((brief, idx) => (
            <option key={brief.id} value={brief.id} className="bg-[#121316] text-white">
              {idx === 0 ? "Latest: " : "Archive: "}
              {formatDateString(brief.date)}
              {brief.preview ? ` — ${brief.preview.slice(0, 48)}...` : ""}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A]">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>
    </div>
  );
}
