"use client";

import * as React from "react";
import {
  Search,
  RotateCcw,
  Sparkles,
  Server,
  ShieldCheck,
  Tag,
  GitFork,
  ArrowUpDown,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type TrackedCompany } from "@/lib/api";

export type EventCategoryKey =
  | "ALL"
  | "PRODUCT"
  | "INFRASTRUCTURE"
  | "SECURITY"
  | "PRICING";

export type EventSortKey = "newest" | "oldest" | "corroborated";

interface EventsFilterBarProps {
  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;

  // Category
  selectedCategory: EventCategoryKey;
  onCategoryChange: (cat: EventCategoryKey) => void;

  // Company
  selectedCompany: string;
  onCompanyChange: (co: string) => void;
  trackedCompanies: TrackedCompany[];

  // Fact Confidence
  selectedConfidence: string;
  onConfidenceChange: (c: string) => void;

  // Strategic Tier
  selectedTier: string;
  onTierChange: (t: string) => void;

  // Sort
  selectedSort: EventSortKey;
  onSortChange: (s: EventSortKey) => void;

  // Reset
  onClearAll: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

const EVENT_CATEGORIES: Array<{
  id: EventCategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  activeBorder: string;
  activeGlow: string;
}> = [
  {
    id: "ALL",
    label: "All Events",
    icon: GitFork,
    accentColor: "text-zinc-300",
    activeBorder: "border-zinc-400 bg-zinc-800/80 text-white",
    activeGlow: "shadow-[0_0_12px_rgba(255,255,255,0.08)]",
  },
  {
    id: "PRODUCT",
    label: "Product & Launch",
    icon: Sparkles,
    accentColor: "text-fuchsia-400",
    activeBorder: "border-fuchsia-400/80 bg-fuchsia-500/20 text-fuchsia-200",
    activeGlow: "shadow-[0_0_12px_rgba(232,121,249,0.15)]",
  },
  {
    id: "INFRASTRUCTURE",
    label: "Infrastructure",
    icon: Server,
    accentColor: "text-cyan-400",
    activeBorder: "border-cyan-400/80 bg-cyan-500/20 text-cyan-200",
    activeGlow: "shadow-[0_0_12px_rgba(34,211,238,0.15)]",
  },
  {
    id: "SECURITY",
    label: "Security & Auth",
    icon: ShieldCheck,
    accentColor: "text-emerald-400",
    activeBorder: "border-emerald-400/80 bg-emerald-500/20 text-emerald-200",
    activeGlow: "shadow-[0_0_12px_rgba(52,211,153,0.15)]",
  },
  {
    id: "PRICING",
    label: "Pricing",
    icon: Tag,
    accentColor: "text-amber-400",
    activeBorder: "border-amber-400/80 bg-amber-500/20 text-amber-200",
    activeGlow: "shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  },
];

export function EventsFilterBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedCompany,
  onCompanyChange,
  trackedCompanies,
  selectedConfidence,
  onConfidenceChange,
  selectedTier,
  onTierChange,
  selectedSort,
  onSortChange,
  onClearAll,
  hasActiveFilters,
  activeFilterCount,
}: EventsFilterBarProps) {
  return (
    <div className="rounded-[6px] border border-white/[0.08] bg-[#0D1117] p-3 sm:p-3.5 space-y-2.5 shadow-md min-w-0">

      {/* ROW 1: Search + Category Filters
          On desktop: search left, category pills right (wrapping if needed)
          On mobile/tablet: search full-width, pills wrap below */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">

        {/* Instant Search Input — flex-1 so it fills space, min-w-0 so it can shrink */}
        <div className="relative min-w-0 w-full sm:flex-1 sm:min-w-[160px] sm:max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-7.5 min-w-0 pl-8 pr-7 text-xs rounded-[4px] bg-[#161B22] border border-white/[0.08] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 font-sans transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1.5 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills
            CRITICAL FIX: flex-wrap so pills never force overflow.
            Removed shrink-0 from the container.
            Each pill has min-w-0, no fixed width. */}
        <div
          className="flex items-center flex-wrap gap-1.5 min-w-0"
          role="group"
          aria-label="Filter by category"
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
            CATEGORY:
          </span>
          {EVENT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                aria-pressed={isSelected}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-mono tracking-wide transition-all border min-w-0",
                  isSelected
                    ? cn(cat.activeBorder, cat.activeGlow, "font-semibold")
                    : "text-zinc-400 bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:text-zinc-200"
                )}
              >
                <Icon
                  className={cn(
                    "h-3 w-3 shrink-0",
                    isSelected ? "text-current" : cat.accentColor
                  )}
                />
                <span className="truncate">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ROW 2: Secondary Filters (Company, Confidence, Tier, Sort) + Clear
          Uses a responsive flex-wrap layout so controls never overflow.
          Each select uses min-w-0 and has a natural auto width from the browser. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 border-t border-white/[0.05] min-w-0">

        {/* Company Filter */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <span className="text-zinc-500 font-mono text-[11px] shrink-0">CO:</span>
          <div className="relative min-w-0">
            <select
              value={selectedCompany}
              onChange={(e) => onCompanyChange(e.target.value)}
              aria-label="Filter by company"
              className="h-7 appearance-none rounded-[3px] bg-[#161B22] border border-white/[0.08] pl-2.5 pr-6 text-xs font-mono text-zinc-200 focus:outline-none focus:border-violet-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer min-w-0 max-w-[140px]"
            >
              <option value="ALL">All Tracked</option>
              {trackedCompanies.map((c) => (
                <option key={c.company_name} value={c.company_name}>
                  {c.company_name}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-1.5 top-2 pointer-events-none shrink-0" />
          </div>
        </div>

        {/* Confidence Filter */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <span className="text-zinc-500 font-mono text-[11px] shrink-0">CONF:</span>
          <div className="relative min-w-0">
            <select
              value={selectedConfidence}
              onChange={(e) => onConfidenceChange(e.target.value)}
              aria-label="Filter by confidence"
              className="h-7 appearance-none rounded-[3px] bg-[#161B22] border border-white/[0.08] pl-2.5 pr-6 text-xs font-mono text-zinc-200 focus:outline-none focus:border-violet-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer min-w-0 max-w-[130px]"
            >
              <option value="ALL">All Levels</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-1.5 top-2 pointer-events-none shrink-0" />
          </div>
        </div>

        {/* Tier Filter */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <span className="text-zinc-500 font-mono text-[11px] shrink-0">TIER:</span>
          <div className="relative min-w-0">
            <select
              value={selectedTier}
              onChange={(e) => onTierChange(e.target.value)}
              aria-label="Filter by tier"
              className="h-7 appearance-none rounded-[3px] bg-[#161B22] border border-white/[0.08] pl-2.5 pr-6 text-xs font-mono text-zinc-200 focus:outline-none focus:border-violet-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer min-w-0 max-w-[120px]"
            >
              <option value="ALL">All Tiers</option>
              <option value="Must-Know">Must-Know</option>
              <option value="Should-Know">Should-Know</option>
              <option value="Nice-to-Know">Nice-to-Know</option>
            </select>
            <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-1.5 top-2 pointer-events-none shrink-0" />
          </div>
        </div>

        {/* Spacer that pushes sort + clear to the right on wider layouts */}
        <div className="flex-1 min-w-0" />

        {/* Sort Control */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <ArrowUpDown className="h-3 w-3 text-zinc-500 shrink-0" aria-hidden="true" />
          <div className="relative min-w-0">
            <select
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value as EventSortKey)}
              aria-label="Sort events"
              className="h-7 appearance-none rounded-[3px] bg-[#161B22] border border-white/[0.08] pl-2 pr-5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-violet-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer min-w-0 max-w-[140px]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="corroborated">Most corroborated</option>
            </select>
            <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-1 top-2 pointer-events-none shrink-0" />
          </div>
        </div>

        {/* Active Filter Count + Clear All */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[3px] bg-violet-500/10 text-violet-300 border border-violet-500/20 shrink-0">
              {activeFilterCount} active
            </span>
            <button
              type="button"
              onClick={onClearAll}
              className="h-7 px-2 flex items-center gap-1 rounded-[3px] text-xs font-mono text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer shrink-0"
              title="Reset all filters"
              aria-label="Clear all filters"
            >
              <RotateCcw className="h-3 w-3 shrink-0" />
              <span>Clear all</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
