"use client";

import * as React from "react";
import { useEvidenceDrawer } from "@/components/layout/AppShell";
import {
  fetchSignals,
  fetchTrackedCompanies,
  type SignalRecord,
  type TrackedCompany,
} from "@/lib/api";
import { SignalsWorkspaceHeader } from "./SignalsWorkspaceHeader";
import {
  SignalsFilterBar,
  type SignalTypeKey,
  type SortOptionKey,
} from "./SignalsFilterBar";
import { SignalRow, detectSignalType, formatCleanSourceName } from "./SignalRow";
import { LoadingSkeleton } from "@/components/primitives/LoadingSkeleton";
import { TierType } from "@/components/primitives/TierBadge";
import { ConfidenceScore } from "@/components/primitives/ConfidenceBadge";
import {
  VolumeX,
  RotateCcw,
  AlertTriangle,
  SearchX,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

export function SignalsWorkspace() {
  const { openDrawer } = useEvidenceDrawer();
  const { user } = useAuth();

  // Data states
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [noiseSuppressedCount, setNoiseSuppressedCount] = React.useState<number>(0);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedType, setSelectedType] = React.useState<SignalTypeKey>("ALL");
  const [selectedCompany, setSelectedCompany] = React.useState<string>("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState<string>("ALL");
  const [selectedTier, setSelectedTier] = React.useState<string>("ALL");
  const [selectedSort, setSelectedSort] = React.useState<SortOptionKey>("newest");

  // Loading & error states
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dev verification toggle for testing empty / error edge cases
  const [forcedState, setForcedState] = React.useState<"none" | "force_empty" | "force_error">("none");

  // Load tracked companies on mount and when tenant changes
  React.useEffect(() => {
    fetchTrackedCompanies()
      .then((comps) => setTrackedCompanies(comps || []))
      .catch(() => {});
  }, [user?.tenant_id]);

  // Fetch signals from API
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (forcedState === "force_error") {
        throw new Error("Deliberately forced API failure (Dev State Inspection Gate).");
      }

      const res = await fetchSignals({
        company: selectedCompany !== "ALL" ? selectedCompany : undefined,
        tier: selectedTier !== "ALL" ? selectedTier : undefined,
        confidence: selectedConfidence !== "ALL" ? selectedConfidence : undefined,
        limit: 150,
      });

      if (forcedState === "force_empty") {
        setSignals([]);
        setTotalCount(0);
        setNoiseSuppressedCount(res.noise_suppressed_count || 0);
      } else {
        setSignals(res.signals || []);
        setTotalCount(res.count || 0);
        setNoiseSuppressedCount(res.noise_suppressed_count || 0);
      }
    } catch (err: any) {
      setError(err.message || "Failed to query signals stream.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, selectedTier, selectedConfidence, forcedState, user?.tenant_id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering & search across available signals
  const filteredSignals = React.useMemo(() => {
    let result = [...signals];

    // Filter by Signal Type (NEWS, GITHUB, JOBS, PRICING)
    if (selectedType !== "ALL") {
      result = result.filter((s) => {
        const detected = detectSignalType(s.source, s.title, s.url);
        return detected.toUpperCase() === selectedType;
      });
    }

    // Deterministic instant search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.company_name.toLowerCase().includes(q) ||
          (s.raw_excerpt && s.raw_excerpt.toLowerCase().includes(q)) ||
          (s.source && s.source.toLowerCase().includes(q)) ||
          (s.url && s.url.toLowerCase().includes(q)) ||
          (s.why_it_matters && s.why_it_matters.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (selectedSort === "newest") {
        const timeA = new Date(a.published_timestamp || a.published_at || 0).getTime();
        const timeB = new Date(b.published_timestamp || b.published_at || 0).getTime();
        return timeB - timeA;
      }
      if (selectedSort === "oldest") {
        const timeA = new Date(a.published_timestamp || a.published_at || 0).getTime();
        const timeB = new Date(b.published_timestamp || b.published_at || 0).getTime();
        return timeA - timeB;
      }
      if (selectedSort === "confidence") {
        const score = (c?: string) => (c === "High" ? 3 : c === "Medium" ? 2 : 1);
        return score(b.confidence) - score(a.confidence);
      }
      if (selectedSort === "company") {
        return a.company_name.localeCompare(b.company_name);
      }
      return 0;
    });

    return result;
  }, [signals, selectedType, searchQuery, selectedSort]);

  // Active filter state tracking
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedType !== "ALL" ||
    selectedCompany !== "ALL" ||
    selectedConfidence !== "ALL" ||
    selectedTier !== "ALL";

  const activeFilterCount = [
    searchQuery !== "",
    selectedType !== "ALL",
    selectedCompany !== "ALL",
    selectedConfidence !== "ALL",
    selectedTier !== "ALL",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedType("ALL");
    setSelectedCompany("ALL");
    setSelectedConfidence("ALL");
    setSelectedTier("ALL");
  };

  // Inspect signal: opens the shared Evidence Drawer with complete 3-layer assessment
  const handleInspectSignal = (signal: SignalRecord) => {
    const cleanSource = formatCleanSourceName(signal.source, signal.url, signal.company_name);
    const confScore = (signal.confidence as ConfidenceScore) || "Medium";

    openDrawer({
      id: signal.id,
      title: signal.title,
      company: signal.company_name,
      timestamp: signal.published_timestamp || signal.published_at || "Recent cycle",
      tier: (signal.tier as TierType) || "Nice-to-Know",
      confidence: confScore,
      factualConfidence: (signal.fact_confidence as ConfidenceScore) || confScore,
      factualRationale: `Direct observation captured from ${cleanSource}. Primary source recorded during automated channel monitoring.`,
      inferenceConfidence: (signal.inference_confidence as ConfidenceScore) || "Medium",
      inferenceRationale:
        "Preliminary observation synthesized against existing competitor profile. Analysis subject to ongoing corroboration sweep.",
      factSummary: signal.raw_excerpt || signal.title,
      whyItMatters:
        signal.why_it_matters ||
        `Observed ${signal.source} activity detected for ${signal.company_name}. Integrated into current competitive monitoring stream.`,
      implication: signal.why_it_matters
        ? `May signal evolving technical focus or feature prioritization at ${signal.company_name}. Continue automated tracking across related channels.`
        : undefined,
      records: [
        {
          id: `rec-${signal.id}`,
          source: cleanSource,
          sourceType: cleanSource,
          url: signal.url,
          timestamp: signal.published_timestamp || signal.published_at,
          extractedText: signal.raw_excerpt || signal.title,
          isPrimary: true,
        },
      ],
      corroboratingSources:
        signal.corroboration_count > 1 ? ["Additional Monitored Channel"] : undefined,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* 1. Compact Workspace Header */}
      <SignalsWorkspaceHeader
        totalCount={totalCount}
        noiseSuppressedCount={noiseSuppressedCount}
        forcedState={forcedState}
        onForcedStateChange={setForcedState}
        filteredCount={filteredSignals.length}
        isFiltered={hasActiveFilters}
      />

      {/* 2. Honest Disclosure: Noise-Suppressed Stream Telemetry */}
      <div className="rounded-lg border border-white/[0.06] bg-[#0D1117] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06] shrink-0">
            <VolumeX className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-zinc-200">
              {noiseSuppressedCount.toLocaleString()} low-value signals suppressed this period
            </span>
            <span className="text-zinc-500 ml-1.5 hidden md:inline">
              (Automated dependency bumps, CI formatting, and bot noise filtered per intelligence relevance rules)
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.08] self-start sm:self-auto shrink-0">
          Transparent Suppression
        </span>
      </div>

      {/* 3. First-Class Filter Bar */}
      <SignalsFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedCompany={selectedCompany}
        onCompanyChange={setSelectedCompany}
        trackedCompanies={trackedCompanies}
        selectedConfidence={selectedConfidence}
        onConfidenceChange={setSelectedConfidence}
        selectedTier={selectedTier}
        onTierChange={setSelectedTier}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        onClearAll={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 4. Results Workspace: Loading, Error, Empty, or Dense Evidence List */}
      <section className="space-y-3">
        {/* Results Bar Header */}
        <div className="flex items-center justify-between px-1 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-cyan-400" />
            <span>
              Showing {filteredSignals.length} evidence {filteredSignals.length === 1 ? "record" : "records"}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            Click any record to inspect complete epistemic dossier
          </span>
        </div>

        {loading ? (
          <LoadingSkeleton type="row" count={7} />
        ) : error ? (
          /* Error State */
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Signals Query Error</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Retry Query</span>
            </button>
          </div>
        ) : filteredSignals.length === 0 ? (
          /* Filtered or General Empty State */
          <div className="rounded-lg border border-white/[0.06] bg-[#0D1117] p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-zinc-500 border border-white/[0.06]">
              <SearchX className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-white font-mono">
              {hasActiveFilters ? "No signals match these filters" : "No signals recorded yet"}
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto font-sans leading-relaxed">
              {hasActiveFilters
                ? "No evidence records match your currently selected company, signal type, tier, or search query."
                : "Your tracked companies have not produced active signals yet in this monitoring cycle."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>
        ) : (
          /* Dense Signal Results */
          <div className="space-y-2.5">
            {filteredSignals.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                onInspect={handleInspectSignal}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
