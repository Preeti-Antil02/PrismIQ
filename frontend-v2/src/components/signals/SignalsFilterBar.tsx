"use client";

import * as React from "react";
import {
  Search,
  RotateCcw,
  Newspaper,
  GitBranch,
  Briefcase,
  Tag,
  Layers,
  ArrowUpDown,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type TrackedCompany } from "@/lib/api";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";

export type SignalTypeKey = "ALL" | "NEWS" | "GITHUB" | "JOBS" | "PRICING";
export type SortOptionKey = "newest" | "oldest" | "confidence" | "company";

interface SignalsFilterBarProps {
  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;

  // Signal Type
  selectedType: SignalTypeKey;
  onTypeChange: (t: SignalTypeKey) => void;

  // Company
  selectedCompany: string;
  onCompanyChange: (c: string) => void;
  trackedCompanies: TrackedCompany[];

  // Confidence
  selectedConfidence: string;
  onConfidenceChange: (c: string) => void;

  // Tier
  selectedTier: string;
  onTierChange: (t: string) => void;

  // Sorting
  selectedSort: SortOptionKey;
  onSortChange: (s: SortOptionKey) => void;

  // Reset
  onClearAll: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

const SIGNAL_TYPES: Array<{
  id: SignalTypeKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  activeBorder: string;
  activeGlow: string;
}> = [
  {
    id: "ALL",
    label: "ALL",
    icon: Layers,
    accentColor: "text-zinc-300",
    badgeBg: "bg-white/[0.04]",
    badgeBorder: "border-white/[0.08]",
    activeBorder: "border-zinc-400 bg-zinc-800/80 text-white",
    activeGlow: "shadow-[0_0_12px_rgba(255,255,255,0.08)]",
  },
  {
    id: "NEWS",
    label: "NEWS",
    icon: Newspaper,
    accentColor: "text-cyan-400",
    badgeBg: "bg-cyan-500/[0.06]",
    badgeBorder: "border-cyan-500/20",
    activeBorder: "border-cyan-400/80 bg-cyan-500/20 text-cyan-200",
    activeGlow: "shadow-[0_0_12px_rgba(34,211,238,0.15)]",
  },
  {
    id: "GITHUB",
    label: "GITHUB",
    icon: GitBranch,
    accentColor: "text-violet-400",
    badgeBg: "bg-violet-500/[0.06]",
    badgeBorder: "border-violet-500/20",
    activeBorder: "border-violet-400/80 bg-violet-500/20 text-violet-200",
    activeGlow: "shadow-[0_0_12px_rgba(167,139,250,0.15)]",
  },
  {
    id: "JOBS",
    label: "JOBS",
    icon: Briefcase,
    accentColor: "text-fuchsia-400",
    badgeBg: "bg-fuchsia-500/[0.06]",
    badgeBorder: "border-fuchsia-500/20",
    activeBorder: "border-fuchsia-400/80 bg-fuchsia-500/20 text-fuchsia-200",
    activeGlow: "shadow-[0_0_12px_rgba(232,121,249,0.15)]",
  },
  {
    id: "PRICING",
    label: "PRICING",
    icon: Tag,
    accentColor: "text-amber-400",
    badgeBg: "bg-amber-500/[0.06]",
    badgeBorder: "border-amber-500/20",
    activeBorder: "border-amber-400/80 bg-amber-500/20 text-amber-200",
    activeGlow: "shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  },
];

export function SignalsFilterBar({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
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
}: SignalsFilterBarProps) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0D1117] p-3.5 space-y-3 shadow-md">
      {/* Top Filter Row: Instant Search + Signal Type Segmented Control */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search headline, excerpt, or source name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 pl-8 pr-8 text-xs rounded bg-[#161B22] border border-white/[0.08] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 font-sans transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Signal Type Segmented Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-1 hidden sm:inline">
            TYPE:
          </span>
          {SIGNAL_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onTypeChange(type.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono tracking-wider transition-all shrink-0 border",
                  isSelected
                    ? cn(type.activeBorder, type.activeGlow, "font-semibold")
                    : cn(
                        "text-zinc-400 bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:text-zinc-200"
                      )
                )}
              >
                <Icon
                  className={cn(
                    "h-3 w-3",
                    isSelected ? "text-current" : type.accentColor
                  )}
                />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Filter Row: Company, Confidence, Tier, Sorting & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/[0.05]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-mono text-[11px]">CO:</span>
            <div className="relative">
              <select
                value={selectedCompany}
                onChange={(e) => onCompanyChange(e.target.value)}
                className="h-7 appearance-none rounded bg-[#161B22] border border-white/[0.08] pl-2.5 pr-7 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer"
              >
                <option value="ALL">All Tracked</option>
                {trackedCompanies.map((c) => (
                  <option key={c.company_name} value={c.company_name}>
                    {c.company_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Confidence Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-mono text-[11px]">CONF:</span>
            <div className="relative">
              <select
                value={selectedConfidence}
                onChange={(e) => onConfidenceChange(e.target.value)}
                className="h-7 appearance-none rounded bg-[#161B22] border border-white/[0.08] pl-2.5 pr-7 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer"
              >
                <option value="ALL">All Levels</option>
                <option value="High">High Confidence</option>
                <option value="Medium">Medium Confidence</option>
                <option value="Low">Low Confidence</option>
              </select>
              <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Tier Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-mono text-[11px]">TIER:</span>
            <div className="relative">
              <select
                value={selectedTier}
                onChange={(e) => onTierChange(e.target.value)}
                className="h-7 appearance-none rounded bg-[#161B22] border border-white/[0.08] pl-2.5 pr-7 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer"
              >
                <option value="ALL">All Tiers</option>
                <option value="Must-Know">Must-Know</option>
                <option value="Should-Know">Should-Know</option>
                <option value="Nice-to-Know">Nice-to-Know</option>
              </select>
              <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right Controls: Sort Order & Clear All */}
        <div className="flex items-center gap-2">
          {/* Sorting Control */}
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="h-3 w-3 text-zinc-500" />
            <div className="relative">
              <select
                value={selectedSort}
                onChange={(e) => onSortChange(e.target.value as SortOptionKey)}
                className="h-7 appearance-none rounded bg-[#161B22] border border-white/[0.08] pl-2 pr-6 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500/50 hover:bg-[#1C2128] transition-colors cursor-pointer"
                title="Sort records"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="confidence">Highest confidence</option>
                <option value="company">Company A-Z</option>
              </select>
              <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-1.5 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Active Filter Counter & Clear All Button */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {activeFilterCount} active
              </span>
              <button
                type="button"
                onClick={onClearAll}
                className="h-7 px-2 flex items-center gap-1 rounded text-xs font-mono text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear all</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
