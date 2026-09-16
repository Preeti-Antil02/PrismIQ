import * as React from "react";
import { cn } from "@/lib/utils";
import { Inbox, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3",
        className
      )}
    >
      <div className="p-3 rounded-full bg-[#151922] border border-[rgba(255,255,255,0.08)] text-[#9CA3AF] mb-1">
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="text-base font-semibold text-[#F3F4F6] tracking-tight">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[4px] bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
