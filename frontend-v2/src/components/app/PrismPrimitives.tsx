"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  AlertCircle,
  FileText,
} from "lucide-react";

// ============================================================================
// PrismCard
// ============================================================================
export interface PrismCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  solid?: boolean;
  children: React.ReactNode;
}

export function PrismCard({
  interactive = false,
  solid = false,
  className = "",
  children,
  ...props
}: PrismCardProps) {
  const baseClass = solid ? "app-card-solid" : "app-card";
  const hoverClass = interactive ? "app-card-interactive cursor-pointer" : "";
  return (
    <div className={`${baseClass} ${hoverClass} p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

// ============================================================================
// PrismTierBadge
// ============================================================================
export interface PrismTierBadgeProps {
  tier?: string | null;
  size?: "sm" | "md";
}

export function PrismTierBadge({ tier, size = "sm" }: PrismTierBadgeProps) {
  const t = (tier || "Nice-to-Know").toLowerCase().replace(/_/g, "-");
  let label = "Nice-to-Know";
  let tierClass = "app-tier-nice";

  if (t.includes("must")) {
    label = "Must-Know";
    tierClass = "app-tier-must";
  } else if (t.includes("should")) {
    label = "Should-Know";
    tierClass = "app-tier-should";
  }

  const sizeClass = size === "sm" ? "px-2.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

  return (
    <span className={`app-pill ${tierClass} ${sizeClass} font-bold tracking-tight`}>
      {label}
    </span>
  );
}

// ============================================================================
// PrismConfidenceBadge
// ============================================================================
export interface PrismConfidenceBadgeProps {
  confidence?: string | null;
  labelPrefix?: string;
  size?: "sm" | "md";
}

export function PrismConfidenceBadge({
  confidence,
  labelPrefix,
  size = "sm",
}: PrismConfidenceBadgeProps) {
  const conf = (confidence || "Medium").toLowerCase();
  let label = "Medium";
  let confClass = "app-conf-med";
  let dotBg = "bg-amber-500";

  if (conf === "high") {
    label = "High";
    confClass = "app-conf-high";
    dotBg = "bg-emerald-500";
  } else if (conf === "low") {
    label = "Low";
    confClass = "app-conf-low";
    dotBg = "bg-zinc-400";
  }

  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`app-pill ${confClass} ${sizeClass} font-semibold inline-flex items-center gap-1.5`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`} />
      {labelPrefix ? `${labelPrefix}: ` : ""}
      {label}
    </span>
  );
}

// ============================================================================
// PrismButton
// ============================================================================
export interface PrismButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "dark" | "light" | "grad" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function PrismButton({
  variant = "light",
  size = "md",
  className = "",
  children,
  ...props
}: PrismButtonProps) {
  const variantClass =
    variant === "dark"
      ? "app-btn-dark"
      : variant === "grad"
      ? "app-btn-grad"
      : variant === "ghost"
      ? "app-btn-ghost"
      : "app-btn-light";

  const sizeClass =
    size === "sm"
      ? "px-3 py-1.5 text-xs rounded-lg"
      : size === "lg"
      ? "px-5 py-2.5 text-sm rounded-xl font-bold"
      : "px-4 py-2 text-xs rounded-xl";

  return (
    <button className={`app-btn ${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ============================================================================
// PrismEmptyState
// ============================================================================
export interface PrismEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function PrismEmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionHref,
}: PrismEmptyStateProps) {
  return (
    <div className="app-card flex flex-col items-center justify-center text-center p-8 sm:p-12 my-6 max-w-xl mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8b72ff]/15 via-[#72d7e8]/15 to-[#f4a8ca]/15 border border-[rgba(20,20,30,0.08)] flex items-center justify-center text-[#6e57dc] mb-4">
        {icon || <Sparkles className="w-6 h-6" />}
      </div>
      <h3 className="app-title-md mb-2">{title}</h3>
      <p className="app-caption max-w-md mb-6">{description}</p>
      {actionHref ? (
        <Link href={actionHref} className="app-btn app-btn-dark">
          {actionText}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      ) : actionText && onAction ? (
        <PrismButton variant="dark" onClick={onAction}>
          {actionText}
          <ChevronRight className="w-3.5 h-3.5" />
        </PrismButton>
      ) : null}
    </div>
  );
}

// ============================================================================
// PrismLoadingSkeleton
// ============================================================================
export function PrismLoadingSkeleton({
  count = 3,
  type = "cards",
}: {
  count?: number;
  type?: "cards" | "table" | "hero";
}) {
  if (type === "hero") {
    return (
      <div className="space-y-4 mb-8">
        <div className="app-skeleton h-8 w-64 rounded-xl" />
        <div className="app-skeleton h-4 w-96 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="app-card p-5 space-y-3">
              <div className="app-skeleton h-4 w-20 rounded" />
              <div className="app-skeleton h-7 w-28 rounded-lg" />
              <div className="app-skeleton h-3 w-36 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 my-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="app-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="app-skeleton h-4 w-32 rounded" />
            <div className="app-skeleton h-4 w-20 rounded-full" />
          </div>
          <div className="app-skeleton h-5 w-3/4 rounded" />
          <div className="app-skeleton h-4 w-full rounded" />
          <div className="flex gap-2 pt-2">
            <div className="app-skeleton h-4 w-16 rounded" />
            <div className="app-skeleton h-4 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PrismSectionHeader
// ============================================================================
export interface PrismSectionHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}

export function PrismSectionHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: PrismSectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && (
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            {eyebrow}
          </div>
        )}
        <h2 className="app-title-md">{title}</h2>
        {subtitle && <p className="app-caption mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ============================================================================
// PrismCompanyBadge
// ============================================================================
export interface PrismCompanyBadgeProps {
  name: string;
  isTarget?: boolean;
  size?: "sm" | "md";
}

export function PrismCompanyBadge({
  name,
  isTarget = false,
  size = "md",
}: PrismCompanyBadgeProps) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const sizeClasses =
    size === "sm"
      ? "text-xs gap-1.5"
      : "text-sm gap-2";
  const avatarClasses =
    size === "sm"
      ? "w-5 h-5 text-[10px]"
      : "w-6 h-6 text-xs";

  return (
    <div className={`inline-flex items-center font-bold text-[#17171b] ${sizeClasses}`}>
      <div
        className={`${avatarClasses} rounded-lg flex items-center justify-center font-extrabold text-white shrink-0 ${
          isTarget
            ? "bg-gradient-to-tr from-[#6e57dc] via-[#a36de8] to-[#35a9c2] shadow-sm"
            : "bg-[#17171b]"
        }`}
      >
        {initial}
      </div>
      <span className="truncate">{name}</span>
      {isTarget && (
        <span className="px-1.5 py-0.2 text-[9px] font-extrabold tracking-wider uppercase rounded bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe]">
          Target
        </span>
      )}
    </div>
  );
}

// ============================================================================
// PrismEvidenceDrawer (Slide-out Inspector)
// ============================================================================
export interface EvidenceItem {
  id?: string;
  title?: string;
  company_name?: string;
  source?: string;
  url?: string;
  published_at?: string;
  published_timestamp?: string;
  raw_excerpt?: string;
  why_it_matters?: string;
  confidence?: string;
  tier?: string;
  corroboration_count?: number;
  contributing_sources?: string[];
  contributing_signals?: Array<{
    source: string;
    title?: string;
    url?: string;
    raw_excerpt?: string;
  }>;
}

export function PrismEvidenceDrawer({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: EvidenceItem | null;
}) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-[#ffffff] border-l border-[rgba(20,20,30,0.10)] h-full overflow-y-auto shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[rgba(20,20,30,0.08)] flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#17171b]">Intelligence Provenance</div>
              <div className="text-[11px] text-[#70717a]">Verified Evidence Ledger</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#70717a] hover:text-[#17171b] rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Company & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PrismCompanyBadge name={data.company_name || "Company"} />
            <div className="flex items-center gap-1.5">
              {data.tier && <PrismTierBadge tier={data.tier} />}
              {data.confidence && <PrismConfidenceBadge confidence={data.confidence} />}
            </div>
          </div>

          {/* Event / Signal Title */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
              Event / Development
            </div>
            <h3 className="text-base font-bold text-[#17171b] leading-snug">
              {data.title || "Intelligence Record"}
            </h3>
          </div>

          {/* Why It Matters */}
          {data.why_it_matters && (
            <div className="p-4 rounded-xl bg-[#fafafc] border border-[rgba(20,20,30,0.07)]">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#6e57dc] mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Why It Matters
              </div>
              <p className="text-xs text-[#374151] leading-relaxed">
                {data.why_it_matters}
              </p>
            </div>
          )}

          {/* Raw Grounded Evidence */}
          {data.raw_excerpt && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Primary Grounded Excerpt
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70 font-mono text-[11px] text-[#374151] leading-relaxed whitespace-pre-wrap">
                {data.raw_excerpt}
              </div>
            </div>
          )}

          {/* Source Attribution & Link */}
          <div className="p-4 rounded-xl border border-[rgba(20,20,30,0.07)] bg-white space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
              Source Provenance
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#70717a]">Monitored Source:</span>
              <span className="font-semibold text-[#17171b] uppercase text-[11px]">
                {data.source || "Grounded Web"}
              </span>
            </div>
            {(data.published_at || data.published_timestamp) && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#70717a]">Publication Time:</span>
                <span className="font-medium text-[#17171b]">
                  {data.published_timestamp || data.published_at}
                </span>
              </div>
            )}
            {data.url && (
              <div className="pt-2 border-t border-[rgba(20,20,30,0.06)]">
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6e57dc] hover:underline break-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  View Original Source
                </a>
              </div>
            )}
          </div>

          {/* Contributing Signals (if event consolidated from multiple) */}
          {data.contributing_signals && data.contributing_signals.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                Corroborating Signals ({data.contributing_signals.length})
              </div>
              <div className="space-y-2">
                {data.contributing_signals.map((sig, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-[rgba(20,20,30,0.06)] bg-zinc-50 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#17171b] uppercase text-[10px]">
                        {sig.source}
                      </span>
                      {sig.url && (
                        <a
                          href={sig.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6e57dc] hover:underline text-[10px]"
                        >
                          View Link
                        </a>
                      )}
                    </div>
                    {sig.title && <div className="font-medium text-[#374151] mb-1">{sig.title}</div>}
                    {sig.raw_excerpt && (
                      <p className="text-[11px] text-[#70717a] line-clamp-2">
                        {sig.raw_excerpt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
