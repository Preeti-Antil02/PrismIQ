import * as React from "react";
import { cn } from "@/lib/utils";
import { RefreshCw, AlertCircle } from "lucide-react";

interface StatusBannerProps {
  message: string;
  subtext?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function StatusBanner({
  message,
  subtext,
  onRefresh,
  isRefreshing = false,
  className,
}: StatusBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-[6px] bg-[#11141D] border border-[rgba(245,158,11,0.25)] text-xs text-[#E5E7EB]",
        className
      )}
      role="status"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="font-medium text-[#F3F4F6]">{message}</span>
          {subtext && <span className="text-[#9CA3AF]">· {subtext}</span>}
        </div>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#151922] hover:bg-[#1C222E] text-xs font-medium text-[#F3F4F6] border border-[rgba(255,255,255,0.12)] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
        </button>
      )}
    </div>
  );
}
