"use client";

import * as React from "react";
import {
  CLASSIFIER_CONFIG,
  normalizeClassifierState,
  type ClassifierState,
} from "@/lib/tokens";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Rocket, Microscope, MessageSquare, CircleDashed } from "lucide-react";

interface ClassifierBadgeProps {
  state: ClassifierState | string;
  className?: string;
  showIcon?: boolean;
  showDot?: boolean;
  auditedSources?: string[];
}

export function ClassifierBadge({
  state,
  className,
  showIcon = true,
  showDot = false,
  auditedSources,
}: ClassifierBadgeProps) {
  const normState = normalizeClassifierState(state);
  const config = CLASSIFIER_CONFIG[normState];

  const renderIcon = () => {
    switch (normState) {
      case "Adopting":
        return <Rocket className="h-3 w-3 shrink-0 text-emerald-700" />;
      case "Researching":
        return <Microscope className="h-3 w-3 shrink-0 text-cyan-700" />;
      case "Mentioning":
        return <MessageSquare className="h-3 w-3 shrink-0 text-amber-700" />;
      case "No activity detected":
      default:
        return <CircleDashed className="h-3 w-3 shrink-0 text-slate-400" />;
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight cursor-help transition-colors select-none shadow-2xs",
              config.bgClass,
              config.textClass,
              config.borderClass,
              className
            )}
          >
            {showDot && (
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClass)} />
            )}
            {showIcon && renderIcon()}
            <span>{config.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="w-64 text-left p-2.5">
          <p className="font-semibold text-white mb-0.5">{config.label}</p>
          <p className="text-[11px] text-slate-300 leading-relaxed mb-1">
            {config.description}
          </p>
          {normState === "No activity detected" && auditedSources && auditedSources.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-[10px] text-slate-400">
              <span className="font-medium text-slate-300">Audited sources checked: </span>
              {auditedSources.join(", ")}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
