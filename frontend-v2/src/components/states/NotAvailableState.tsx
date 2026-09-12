import * as React from "react";
import { History, Construction } from "lucide-react";
import { cn } from "@/lib/utils";


interface NotAvailableStateProps {
  featureName: string;
  reason?: string;
  type?: "history" | "deferred" | "unbuilt";
  className?: string;
}

export function NotAvailableState({
  featureName,
  reason,
  type = "history",
  className,
}: NotAvailableStateProps) {
  const defaultReason =
    type === "history"
      ? "Requires more historical monitoring cycles — check back as data accumulates."
      : "Not yet available — reserved route pending subsequent stage implementation.";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50/70 p-8 text-center",
        className
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 mb-2.5">
        {type === "history" ? (
          <History className="h-4 w-4" />
        ) : (
          <Construction className="h-4 w-4" />
        )}
      </div>
      <div className="inline-flex items-center gap-1 rounded bg-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
        <span>Reserved Pipeline Route</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">
        {featureName}
      </h3>
      <p className="max-w-md text-xs text-slate-500 leading-relaxed">
        {reason || defaultReason}
      </p>
    </div>
  );
}
