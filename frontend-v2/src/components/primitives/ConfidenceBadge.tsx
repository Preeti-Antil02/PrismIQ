import * as React from "react";
import { cn } from "@/lib/utils";

export type ConfidenceScore = "High" | "Medium" | "Low" | string;

interface ConfidenceBadgeProps {
  confidence: ConfidenceScore;
  kind?: "general" | "factual" | "inference";
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function ConfidenceBadge({
  confidence,
  kind = "general",
  showLabel = true,
  className,
  size = "sm",
}: ConfidenceBadgeProps) {
  const normalized = (confidence || "").toLowerCase();

  let levelText = "LOW";
  let textColor = "text-[#9CA3AF]";
  let bgColor = "bg-[rgba(113,113,122,0.10)]";
  let borderColor = "border-[rgba(113,113,122,0.22)]";
  let dotColor = "bg-[#71717A]";

  if (normalized.includes("high")) {
    levelText = "HIGH";
    textColor = "text-[#34D399]";
    bgColor = "bg-[rgba(16,185,129,0.10)]";
    borderColor = "border-[rgba(16,185,129,0.24)]";
    dotColor = "bg-[#10B981]";
  } else if (normalized.includes("med")) {
    levelText = "MED";
    textColor = "text-[#FBBF24]";
    bgColor = "bg-[rgba(245,158,11,0.10)]";
    borderColor = "border-[rgba(245,158,11,0.24)]";
    dotColor = "bg-[#F59E0B]";
  }

  let prefix = "";
  if (kind === "factual") prefix = "FACT: ";
  if (kind === "inference") prefix = "INFERENCE: ";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono font-medium tracking-tight rounded-[4px] border select-none shrink-0",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        bgColor,
        borderColor,
        textColor,
        className
      )}
    >
      <span className={cn("rounded-full shrink-0", size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2", dotColor)} />
      {showLabel && (
        <span>
          {prefix}{levelText}
        </span>
      )}
    </span>
  );
}
