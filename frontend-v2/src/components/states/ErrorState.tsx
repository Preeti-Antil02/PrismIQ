import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertOctagon, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  stalenessLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Failed to load data",
  message,
  onRetry,
  isRetrying = false,
  stalenessLabel,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-rose-200 bg-rose-50/70 p-5 text-rose-950 shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-700 shrink-0">
          <AlertOctagon className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
            {title}
          </h4>
          <p className="text-xs text-rose-800 leading-relaxed">{message}</p>
          {stalenessLabel && (
            <div className="text-[11px] font-medium text-rose-700 bg-rose-100/60 inline-block px-2 py-0.5 rounded mt-1">
              Warning: Showing cached data from {stalenessLabel}
            </div>
          )}
          {onRetry && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="bg-white border-rose-300 text-rose-900 hover:bg-rose-50"
              >
                <RotateCw
                  className={cn("h-3 w-3 mr-1.5", isRetrying && "animate-spin")}
                />
                {isRetrying ? "Retrying..." : "Retry connection"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
