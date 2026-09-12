"use client";

import * as React from "react";
import { SIGNAL_TYPE_CONFIG, type SignalType } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  Newspaper,
  Briefcase,
  DollarSign,
  Microscope,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  news: Newspaper,
  github: GithubIcon,
  jobs: Briefcase,
  pricing: DollarSign,
  research: Microscope,
};

function normalizeSourceKey(source: string): SignalType {
  const s = source.trim().toLowerCase();
  if (s === "news") return "News";
  if (s === "github") return "GitHub";
  if (s === "jobs") return "Jobs";
  if (s === "pricing") return "Pricing";
  if (s === "research") return "Research";
  return "News"; // fallback
}

interface SignalSourceBadgeProps {
  source: string;
  count?: number;
  className?: string;
}

export function SignalSourceBadge({ source, count, className }: SignalSourceBadgeProps) {
  const normalizedKey = normalizeSourceKey(source);
  const config = SIGNAL_TYPE_CONFIG[normalizedKey];
  const Icon = SOURCE_ICONS[source.toLowerCase()] || Newspaper;
  const isZero = count === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium select-none transition-colors",
        isZero
          ? "bg-slate-50 text-slate-400 border-slate-200 border-dashed"
          : cn(config.bgClass, config.textClass, config.borderClass),
        className
      )}
      title={isZero ? `No ${normalizedKey} signals recorded this period` : undefined}
    >
      <Icon className={cn("h-3 w-3 shrink-0", isZero ? "text-slate-400" : undefined)} />
      <span>{normalizedKey}</span>
      {count !== undefined && (
        <span className={cn("text-[10px]", isZero ? "text-slate-400" : "opacity-75")}>
          ({count})
        </span>
      )}
    </span>
  );
}
