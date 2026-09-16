import * as React from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/timeUtils";

interface FreshnessIndicatorProps {
  timestamp?: string | null;
  statusText?: string;
  isLive?: boolean;
  className?: string;
}

export function FreshnessIndicator({
  timestamp,
  statusText,
  isLive = true,
  className,
}: FreshnessIndicatorProps) {
  const timeInfo = formatRelativeTime(timestamp || "2026-09-13T01:49:00Z");

  return (
    <div
      title={`Intelligence snapshot: ${timeInfo.full}`}
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[#0E1117] border border-[rgba(255,255,255,0.08)] text-[11px] font-mono text-[#9CA3AF] cursor-help select-none",
        className
      )}
    >
      <span className="flex h-2 w-2 relative shrink-0">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", isLive ? "bg-emerald-500" : "bg-zinc-500")} />
      </span>
      <span className="truncate">
        {statusText ? `${statusText} · ` : "Updated "}
        <span className="text-[#F3F4F6] font-medium">{timeInfo.relative}</span>
      </span>
    </div>
  );
}
