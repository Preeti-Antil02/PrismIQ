import React from "react";

export function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-[#121316] border border-[#1F2023] p-4"></div>
        ))}
      </div>

      {/* Top 3 Skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-64 rounded-md bg-[#16171B]"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-[#121316] border border-[#1F2023] p-4"></div>
          ))}
        </div>
      </div>

      {/* Company Section Skeleton */}
      <div className="space-y-6">
        <div className="h-5 w-48 rounded-md bg-[#16171B]"></div>
        {[1, 2].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-[#121316] border border-[#1F2023] p-6"></div>
        ))}
      </div>
    </div>
  );
}
