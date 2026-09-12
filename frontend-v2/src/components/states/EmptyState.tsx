import * as React from "react";
import { Button } from "@/components/ui/button";
import { Inbox, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="max-w-sm text-xs text-slate-500 leading-relaxed mb-4">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
