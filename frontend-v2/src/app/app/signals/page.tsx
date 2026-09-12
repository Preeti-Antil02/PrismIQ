"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchSignals,
  fetchTrackedCompanies,
  type SignalRecord,
  type TrackedCompany,
} from "@/lib/api";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import {
  EvidenceDrawer,
  type EvidenceDrawerData,
} from "@/components/shared/EvidenceDrawer";
import {
  LoadingState,
  EmptyState,
  PartialState,
  ErrorState,
} from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { SIGNAL_TYPE_CONFIG, type SignalType, normalizeConfidence } from "@/lib/tokens";
import {
  Filter,
  VolumeX,
  RotateCcw,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Search,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignalsPage() {
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [noiseSuppressedCount, setNoiseSuppressedCount] = React.useState<number>(0);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);

  // Filter state
  const [selectedCompany, setSelectedCompany] = React.useState<string>("ALL");
  const [selectedType, setSelectedType] = React.useState<string>("ALL");
  const [selectedTier, setSelectedTier] = React.useState<string>("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Loading & Error states
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dev verification toggle (Step 4 requirement: deliberately force states for inspection)
  const [forcedState, setForcedState] = React.useState<"none" | "force_empty" | "force_error">("none");

  // Evidence Drawer state
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);
  const [activeEvidence, setActiveEvidence] = React.useState<EvidenceDrawerData | null>(null);

  // Load companies once
  React.useEffect(() => {
    fetchTrackedCompanies()
      .then((comps) => setTrackedCompanies(comps))
      .catch(() => {});
  }, []);

  // Fetch signals
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (forcedState === "force_error") {
        throw new Error("Deliberately forced API failure (Dev State Inspection Gate).");
      }

      const res = await fetchSignals({
        company: selectedCompany !== "ALL" ? selectedCompany : undefined,
        source: selectedType !== "ALL" ? selectedType : undefined,
        tier: selectedTier !== "ALL" ? selectedTier : undefined,
        confidence: selectedConfidence !== "ALL" ? selectedConfidence : undefined,
        limit: 100,
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
      setError(err.message || "Failed to load signals stream.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, selectedType, selectedTier, selectedConfidence, forcedState]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side quick search filter on title
  const displayedSignals = React.useMemo(() => {
    if (!searchQuery.trim()) return signals;
    const q = searchQuery.toLowerCase();
    return signals.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.company_name.toLowerCase().includes(q) ||
        (s.why_it_matters && s.why_it_matters.toLowerCase().includes(q))
    );
  }, [signals, searchQuery]);

  const hasActiveFilters =
    selectedCompany !== "ALL" ||
    selectedType !== "ALL" ||
    selectedTier !== "ALL" ||
    selectedConfidence !== "ALL" ||
    searchQuery !== "";

  const clearFilters = () => {
    setSelectedCompany("ALL");
    setSelectedType("ALL");
    setSelectedTier("ALL");
    setSelectedConfidence("ALL");
    setSearchQuery("");
  };

  const handleOpenEvidence = (signal: SignalRecord) => {
    const confLevel = normalizeConfidence(signal.confidence);
    setActiveEvidence({
      id: signal.id,
      title: signal.title,
      company: signal.company_name,
      timestamp: signal.published_at || signal.published_timestamp || "Recent",
      tier: signal.tier,
      confidence: confLevel,
      confidenceNuance: {
        level: confLevel,
        isCorroborated: signal.corroboration_count > 1,
        corroborationCount: signal.corroboration_count,
        reason:
          signal.corroboration_count > 1
            ? `Corroborated by ${signal.corroboration_count} independent sources.`
            : "Single-source observation recorded from source monitoring.",
      },
      fact: signal.raw_excerpt || signal.title,
      inference:
        signal.why_it_matters ||
        `Direct observation detected from ${signal.source} for ${signal.company_name}. Analysis integrated into latest brief cycle.`,
      corroborationCount: signal.corroboration_count,
      sources: [
        {
          id: `src-${signal.id}`,
          title: signal.title,
          url: signal.url,
          sourceType: signal.source,
          publishedAt: signal.published_at,
          excerpt: signal.raw_excerpt,
          isValid: true,
        },
      ],
    });
    setDrawerOpen(true);
  };

  const formatSource = (src: string): SignalType => {
    const s = src.toLowerCase();
    if (s.includes("news")) return "News";
    if (s.includes("github")) return "GitHub";
    if (s.includes("jobs")) return "Jobs";
    if (s.includes("pricing")) return "Pricing";
    return "Research";
  };

  const formatRelativeTime = (ts?: string, dateStr?: string) => {
    if (dateStr) return dateStr;
    if (!ts) return "Recently";
    try {
      const d = new Date(ts);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-950">
                Signals
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {totalCount} Total
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Primary question: What individual signals were detected across monitored channels?
            </p>
          </div>

          {/* Dev State Inspector Controls */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-md border border-slate-200 text-xs self-start sm:self-auto">
            <span className="text-[10px] uppercase font-bold text-slate-600 px-1.5">
              Dev Mode:
            </span>
            <button
              onClick={() => setForcedState("none")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                forcedState === "none"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Live Data
            </button>
            <button
              onClick={() => setForcedState("force_empty")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                forcedState === "force_empty"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Force Empty
            </button>
            <button
              onClick={() => setForcedState("force_error")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                forcedState === "force_error"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Force Error
            </button>
          </div>
        </div>

        {/* Spec 3.3 Requirement: Noise-Suppressed Disclosure Banner */}
        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 shrink-0">
              <VolumeX className="h-4 w-4" />
            </div>
            <div className="text-xs">
              <span className="font-semibold text-slate-900">
                {noiseSuppressedCount} low-value signals suppressed this period
              </span>
              <span className="text-slate-500 ml-1.5 hidden sm:inline">
                (Automated dependency bumps, CI formatting, and placeholder posts filtered per Part 8.2 rules)
              </span>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded shrink-0">
            Transparent Suppression
          </span>
        </div>

        {/* Spec 3.3 Requirement: Filter Bar */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Company Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Company:</span>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Tracked</option>
                  {trackedCompanies.map((c) => (
                    <option key={c.company_name} value={c.company_name}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Signal Type Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Type:</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Types</option>
                  <option value="news">News</option>
                  <option value="github">GitHub</option>
                  <option value="jobs">Jobs</option>
                  <option value="pricing">Pricing</option>
                  <option value="research">Research</option>
                </select>
              </div>

              {/* Tier Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Tier:</span>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Tiers</option>
                  <option value="Must-Know">Must-Know</option>
                  <option value="Should-Know">Should-Know</option>
                  <option value="Nice-to-Know">Nice-to-Know</option>
                </select>
              </div>

              {/* Confidence Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Confidence:</span>
                <select
                  value={selectedConfidence}
                  onChange={(e) => setSelectedConfidence(e.target.value)}
                  className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Confidence</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Keyword Search & Reset */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-600" />
                <input
                  type="text"
                  placeholder="Filter headline..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs rounded border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 w-40 sm:w-52"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-slate-600 hover:text-slate-900"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Section: Loading / Error / Empty / Data Table */}
        {loading ? (
          <LoadingState layout="table" count={8} />
        ) : error ? (
          <ErrorState
            title="Signals Query Error"
            message={error}
            onRetry={loadData}
          />
        ) : displayedSignals.length === 0 ? (
          /* Spec Requirement: Empty filtered state with clear-filters action */
          <EmptyState
            title={
              hasActiveFilters
                ? "No signals match these filters"
                : "No signals recorded yet"
            }
            description={
              hasActiveFilters
                ? "No signals were detected matching your currently selected company, source type, tier, or confidence filters."
                : "Your tracked companies have not generated any active signals yet in this monitoring cycle."
            }
            actionLabel={hasActiveFilters ? "Clear all filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          /* Real Data Table */
          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-36">Company</TableHead>
                  <TableHead>Signal Headline & Observation</TableHead>
                  <TableHead className="w-28">Tier</TableHead>
                  <TableHead className="w-28">Confidence</TableHead>
                  <TableHead className="w-24">Sources</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedSignals.map((signal) => {
                  const typeKey = formatSource(signal.source);
                  const typeCfg = SIGNAL_TYPE_CONFIG[typeKey] || SIGNAL_TYPE_CONFIG.News;

                  return (
                    <TableRow
                      key={signal.id}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      onClick={() => handleOpenEvidence(signal)}
                    >
                      {/* Signal Type Badge */}
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold tracking-tight border",
                            typeCfg.bgClass,
                            typeCfg.textClass,
                            typeCfg.borderClass
                          )}
                        >
                          {typeKey}
                        </span>
                      </TableCell>

                      {/* Company Name */}
                      <TableCell className="font-semibold text-slate-900 text-xs">
                        {signal.company_name}
                      </TableCell>

                      {/* Headline, relative time, and why-it-matters */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-950 text-xs leading-snug">
                            {signal.title}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-600">
                            <span>{formatRelativeTime(signal.published_timestamp, signal.published_at)}</span>
                            {signal.why_it_matters && (
                              <>
                                <span>•</span>
                                <span className="text-slate-600 italic line-clamp-1">
                                  {signal.why_it_matters}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Tier Badge */}
                      <TableCell>
                        <TierBadge tier={signal.tier || "Nice-to-Know"} />
                      </TableCell>

                      {/* Confidence Badge */}
                      <TableCell>
                        <ConfidenceBadge
                          level={normalizeConfidence(signal.confidence)}
                          nuance={{
                            level: normalizeConfidence(signal.confidence),
                            isCorroborated: signal.corroboration_count > 1,
                            corroborationCount: signal.corroboration_count,
                            reason:
                              signal.corroboration_count > 1
                                ? `Boosted by ${signal.corroboration_count} corroborating sources.`
                                : "Single-source observation recorded from source monitoring.",
                          }}
                        />
                      </TableCell>

                      {/* Corroboration Count */}
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          <Layers className="h-3 w-3 text-slate-600" />
                          <span>{signal.corroboration_count || 1}</span>
                        </span>
                      </TableCell>

                      {/* Inspect Action */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEvidence(signal);
                          }}
                          className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          Evidence
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Cross-cutting Evidence Drawer */}
      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={activeEvidence}
      />
    </AppLayout>
  );
}
