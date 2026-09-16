import * as React from "react";
import { cn } from "@/lib/utils";

interface IntelligenceCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export function IntelligenceCard({
  children,
  className,
  hoverable = false,
  onClick,
}: IntelligenceCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] p-4 sm:p-5 text-[#F3F4F6] transition-colors duration-150",
        hoverable && "hover:border-[rgba(255,255,255,0.16)] hover:bg-[#121620] cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
