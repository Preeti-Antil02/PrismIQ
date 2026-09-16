import * as React from "react";
import { cn } from "@/lib/utils";

export type TierLevel = "Must-Know" | "Should-Know" | "Nice-to-Know" | string;
export type TierType = TierLevel;

interface TierBadgeProps {
  tier: TierLevel;
  className?: string;
  size?: "sm" | "md";
}

export function TierBadge({ tier, className, size = "sm" }: TierBadgeProps) {
  const normalized = (tier || "").toLowerCase();

  let text = "NICE-TO-KNOW";
  let badgeStyle = "text-[#94A3B8] bg-[rgba(100,116,139,0.12)] border-[rgba(100,116,139,0.24)]";

  if (normalized.includes("must")) {
    text = "MUST-KNOW";
    badgeStyle = "text-[#FB7185] bg-[rgba(225,29,72,0.12)] border-[rgba(225,29,72,0.28)]";
  } else if (normalized.includes("should")) {
    text = "SHOULD-KNOW";
    badgeStyle = "text-[#60A5FA] bg-[rgba(37,99,235,0.12)] border-[rgba(37,99,235,0.28)]";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-bold tracking-[0.06em] uppercase rounded-[4px] border select-none shrink-0",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        badgeStyle,
        className
      )}
    >
      {text}
    </span>
  );
}
