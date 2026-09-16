import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  type?: "card" | "row" | "text" | "table";
}

export function LoadingSkeleton({
  className,
  count = 1,
  type = "card",
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count });

  if (type === "row") {
    return (
      <div className={cn("space-y-3", className)}>
        {items.map((_, i) => (
          <div
            key={i}
            className="rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] p-4 space-y-2.5 animate-pulse"
          >
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 bg-[#1A1F2C] rounded-[4px]" />
              <div className="h-4 w-16 bg-[#1A1F2C] rounded-[4px]" />
              <div className="h-3 w-14 bg-[#1A1F2C] rounded-[4px] ml-auto" />
            </div>
            <div className="h-5 w-3/4 bg-[#1A1F2C] rounded-[4px]" />
            <div className="h-3.5 w-full bg-[#1A1F2C] rounded-[4px]" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className={cn("rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] p-4 space-y-3 animate-pulse", className)}>
        <div className="h-4 w-full bg-[#1A1F2C] rounded-[4px]" />
        <div className="h-4 w-full bg-[#151924] rounded-[4px]" />
        <div className="h-4 w-full bg-[#1A1F2C] rounded-[4px]" />
        <div className="h-4 w-full bg-[#151924] rounded-[4px]" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {items.map((_, i) => (
        <div
          key={i}
          className="rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] p-5 space-y-3 animate-pulse"
        >
          <div className="h-4 w-1/3 bg-[#1A1F2C] rounded-[4px]" />
          <div className="h-6 w-2/3 bg-[#1A1F2C] rounded-[4px]" />
          <div className="h-4 w-full bg-[#1A1F2C] rounded-[4px]" />
        </div>
      ))}
    </div>
  );
}
