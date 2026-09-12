"use client";

import * as React from "react";
import { CONFIDENCE_CONFIG, type ConfidenceLevel, type ConfidenceNuance } from "@/lib/tokens";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/lib/../components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ShieldCheck, Sparkles, Clock } from "lucide-react";

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  nuance?: ConfidenceNuance;
  className?: string;
}

export function ConfidenceBadge({
  level,
  nuance,
  className,
}: ConfidenceBadgeProps) {
  const normalizedLevel: "High" | "Medium" | "Low" =
    level === "High" ? "High" : level === "Low" ? "Low" : "Medium";

  const config = CONFIDENCE_CONFIG[normalizedLevel] || CONFIDENCE_CONFIG.Medium;

  const tooltipContent = (
    <div className="space-y-1 text-left text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-slate-100">
        <span className={cn("inline-block h-2 w-2 rounded-full", config.dotClass)} />
        {config.label}
        {nuance?.score !== undefined && (
          <span className="font-mono text-[11px] text-slate-300">
            ({Math.round(nuance.score * 100)}%)
          </span>
        )}
      </div>

      {nuance?.reason ? (
        <p className="text-slate-300 text-[11px] leading-relaxed">{nuance.reason}</p>
      ) : (
        <p className="text-slate-300 text-[11px] leading-relaxed">
          {normalizedLevel === "High" && "Cross-verified across multiple independent sources."}
          {normalizedLevel === "Medium" && "Single-sourced or awaiting corroboration confirmation."}
          {normalizedLevel === "Low" && "Initial unverified signal; requires corroboration."}
        </p>
      )}

      {/* Corroboration & Freshness nuances */}
      <div className="pt-1 border-t border-slate-700/80 space-y-0.5 text-[10px] text-slate-400">
        {nuance?.corroborationCount !== undefined && nuance.corroborationCount > 1 && (
          <div className="flex items-center gap-1 text-emerald-300">
            <Sparkles className="h-3 w-3" />
            <span>Boosted by {nuance.corroborationCount} corroborating sources</span>
          </div>
        )}
        {nuance?.isSelfRated && (
          <div className="flex items-center gap-1 text-slate-300">
            <ShieldCheck className="h-3 w-3" />
            <span>Self-rated baseline score</span>
          </div>
        )}
        {nuance?.decayApplied && (
          <div className="flex items-center gap-1 text-amber-300">
            <Clock className="h-3 w-3" />
            <span>Freshness decay applied ({nuance.freshnessNote || "older than 7 days"})</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight cursor-help transition-colors select-none",
              config.bgClass,
              config.textClass,
              config.borderClass,
              className
            )}
            aria-label={`Confidence: ${config.label}`}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClass)} />
            <span>{config.shortLabel}</span>
            {nuance?.score !== undefined && (
              <span className="font-mono text-[10px] opacity-75">
                {Math.round(nuance.score * 100)}%
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="w-64">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
