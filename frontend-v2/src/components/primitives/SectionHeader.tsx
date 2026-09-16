import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  count?: number | string;
  children?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  eyebrow,
  count,
  children,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 pt-2 pb-3", className)}>
      <div className="flex items-center gap-2.5">
        <div className="space-y-0.5">
          {eyebrow && (
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
              {eyebrow}
            </span>
          )}
          <h2 className="text-sm font-semibold text-[#F3F4F6] tracking-tight">
            {title}
          </h2>
        </div>
        {count !== undefined && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#151922] border border-[rgba(255,255,255,0.08)] text-[11px] font-mono font-medium text-[#9CA3AF]">
            {count}
          </span>
        )}
      </div>

      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
