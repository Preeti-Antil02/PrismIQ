"use client";

import * as React from "react";
import { TIER_CONFIG, type TierLevel } from "@/lib/tokens";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: TierLevel;
  className?: string;
  showDot?: boolean;
}

export function TierBadge({ tier, className, showDot = true }: TierBadgeProps) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG["Nice-to-Know"];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold tracking-tight cursor-help transition-colors select-none",
              config.bgClass,
              config.textClass,
              config.borderClass,
              className
            )}
          >
            {showDot && (
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClass)} />
            )}
            <span>{config.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="w-56 text-left">
          <p className="font-semibold text-white mb-0.5">{config.label}</p>
          <p className="text-[11px] text-slate-300 leading-normal">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
