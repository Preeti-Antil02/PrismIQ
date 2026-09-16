import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  isEditorial?: boolean;
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  children,
  className,
  isEditorial = false,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[rgba(255,255,255,0.06)]", className)}>
      <div className="space-y-1.5 max-w-3xl">
        {eyebrow && (
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">
            {eyebrow}
          </div>
        )}
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight text-[#F3F4F6]",
            isEditorial && "font-serif italic text-3xl sm:text-4xl text-white font-normal"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[#9CA3AF] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {children && (
        <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
          {children}
        </div>
      )}
    </div>
  );
}
