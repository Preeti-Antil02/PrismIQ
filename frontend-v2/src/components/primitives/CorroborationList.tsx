import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Layers } from "lucide-react";

interface CorroborationListProps {
  sources: string[];
  className?: string;
  count?: number;
}

export function CorroborationList({
  sources,
  count,
  className,
}: CorroborationListProps) {
  if (!sources || sources.length === 0) {
    return (
      <div className="text-xs text-[#6B7280]">
        Single source signal (not yet corroborated).
      </div>
    );
  }

  const corroborationCount = count || sources.length;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF]">
        <Layers className="h-3.5 w-3.5 text-blue-400" />
        <span>Independent corroborating sources ({sources.length}):</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {sources.map((src, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#151922] border border-[rgba(255,255,255,0.08)] text-[11px] font-mono text-[#E5E7EB]"
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
            <span className="capitalize">{src}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
