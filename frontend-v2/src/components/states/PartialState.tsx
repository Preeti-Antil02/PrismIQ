import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";


interface PartialStateProps {
  sourceName?: string;
  cycleTime?: string;
  message?: string;
  details?: string;
  className?: string;
}

export function PartialState({
  sourceName,
  cycleTime,
  message,
  details,
  className,
}: PartialStateProps) {
  const displayMessage =
    message ||
    (sourceName
      ? `${sourceName} source was unavailable during this monitoring cycle.`
      : "Some upstream sources were degraded or unavailable during this monitoring cycle.");

  return (
    <div
      role="status"
      className={cn(
        "rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 shadow-sm flex items-start gap-2.5",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between font-semibold">
          <span>Data Gap Disclosed</span>
          {cycleTime && (
            <span className="text-[10px] font-mono text-amber-700 font-normal">
              Cycle: {cycleTime}
            </span>
          )}
        </div>
        <p className="text-amber-800 leading-normal">{displayMessage}</p>
        {details && (
          <p className="text-[11px] text-amber-700/90 pt-0.5">{details}</p>
        )}
      </div>
    </div>
  );
}
