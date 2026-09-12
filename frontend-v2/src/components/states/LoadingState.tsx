import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  layout?: "cards" | "table" | "detail" | "dashboard";
  count?: number;
  className?: string;
}

export function LoadingState({
  layout = "cards",
  count = 3,
  className,
}: LoadingStateProps) {
  if (layout === "table") {
    return (
      <div className={cn("rounded-md border border-slate-200 bg-white p-4 space-y-3", className)}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-48 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "dashboard") {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 rounded-md" />
        </div>
      </div>
    );
  }

  if (layout === "detail") {
    return (
      <div className={cn("rounded-lg border border-slate-200 bg-white p-6 space-y-5", className)}>
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <Skeleton className="h-24 w-full rounded-md" />
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // Default "cards" layout
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-3.5 w-full" />
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
