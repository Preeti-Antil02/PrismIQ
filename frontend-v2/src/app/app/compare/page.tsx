"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchTrackedCompanies,
  fetchSignals,
  fetchEvents,
  fetchFindings,
  fetchLatestRadar,
  buildCompetitorSummaries,
  type CompetitorActivitySummary,
  type TrackedCompany,
} from "@/lib/api";
import {
  ComparisonTable,
  type ComparisonDimensionRow,
  type CompetitorComparisonCell,
} from "@/components/shared/ComparisonTable";
import { EvidenceDrawer, type EvidenceDrawerData } from "@/components/shared/EvidenceDrawer";
import { LoadingState, ErrorState } from "@/components/states";
import { type DirectionalDelta } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  Scale,
  CheckSquare,
  Square,
  Users,
  ArrowRight,
} from "lucide-react";

// ============================================================================
// Comparison dimensions (spec § 3.8: Product, Hiring, Pricing, Security, Research/AI)
// ============================================================================

interface DimensionConfig {
  id: string;
  label: string;
  description: string;
  sourceKeys: string[]; // signal source types that roll up into this dimension
}

const DIMENSIONS: DimensionConfig[] = [
  {
    id: "product",
    label: "Product & Platform Development",
    description: "Code commits, releases, pull requests, and engineering activity",
    sourceKeys: ["github"],
  },
  {
    id: "hiring",
    label: "Hiring & Talent Acquisition",
    description: "Active job postings and role publications",
    sourceKeys: ["jobs"],
  },
  {
    id: "pricing",
    label: "Pricing & Packaging",
    description: "Pricing page changes, plan restructuring, and packaging updates",
    sourceKeys: ["pricing"],
  },
  {
    id: "news",
    label: "Market Positioning & News",
    description: "Public announcements, partnership news, and industry coverage",
    sourceKeys: ["news"],
  },
  {
    id: "research",
    label: "Research & AI Activity",
    description: "Academic research, blog publications, and R&D signals",
    sourceKeys: ["research"],
  },
];

/**
 * Compute directional delta from real signal data.
 * - "up" if has higher-tier signals (should_know/must_know) or significant volume
 * - "flat" if has signals but all nice-to-know
 * - "down" if zero signals in this dimension
 *
 * Per spec § 3.8: directional indicators derived from real signal deltas, not a numeric scorecard.
 */
function computeDelta(
  summary: CompetitorActivitySummary,
  sourceKeys: string[]
): { delta: DirectionalDelta; count: number; deltaSummary: string } {
  let totalCount = 0;
  sourceKeys.forEach((key) => {
    totalCount += summary.signals_by_source[key] || 0;
  });

  if (totalCount === 0) {
    return {
      delta: "down",
      count: 0,
      deltaSummary: "0 signals this period",
    };
  }

  // Check for higher-tier events matching these source categories
  const hasHighTier = summary.must_know_count > 0 || summary.should_know_count > 0;

  // Signals exist: if any higher-tier events exist for this company, it's accelerating
  if (hasHighTier && totalCount > 5) {
    return {
      delta: "up",
      count: totalCount,
      deltaSummary: `${totalCount} signals with high-tier events`,
    };
  }

  if (totalCount > 0) {
    return {
      delta: "flat",
      count: totalCount,
      deltaSummary: `${totalCount} signal${totalCount === 1 ? "" : "s"} this period`,
    };
  }

  return {
    delta: "down",
    count: 0,
    deltaSummary: "No movement",
  };
}

function CompareContent() {
  const searchParams = useSearchParams();
  const preselectedCompany = searchParams?.get("companies") || "";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [summaries, setSummaries] = React.useState<CompetitorActivitySummary[]>([]);
  const [selectedCompanies, setSelectedCompanies] = React.useState<Set<string>>(new Set());
  const [drawerData, setDrawerData] = React.useState<EvidenceDrawerData | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [comps, signalsRes, eventsRes, findingsRes, radarRes] = await Promise.all([
        fetchTrackedCompanies(),
        fetchSignals({ limit: 200 }),
        fetchEvents({ limit: 200 }),
        fetchFindings(),
        fetchLatestRadar(),
      ]);

      setCompanies(comps);

      const built = buildCompetitorSummaries(
        comps,
        signalsRes.signals,
        eventsRes.events,
        findingsRes.findings,
        radarRes.evaluations || [],
      );
      setSummaries(built);

      // Preselect from URL param or default to first 2
      if (preselectedCompany) {
        const preselected = new Set<string>();
        preselected.add(preselectedCompany);
        // Also pre-select first competitor that isn't the same
        const other = comps.find((c) => c.company_name !== preselectedCompany);
        if (other) preselected.add(other.company_name);
        setSelectedCompanies(preselected);
      } else if (comps.length >= 2) {
        setSelectedCompanies(new Set(comps.slice(0, 2).map((c) => c.company_name)));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load comparison data");
    } finally {
      setLoading(false);
    }
  }, [preselectedCompany]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleCompany = (name: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else if (next.size < 3) {
        next.add(name);
      }
      return next;
    });
  };

  const selectedNames = Array.from(selectedCompanies);
  const selectedSummaries = summaries.filter((s) => selectedCompanies.has(s.company_name));

  // Build comparison rows from real data
  const comparisonRows: ComparisonDimensionRow[] = React.useMemo(() => {
    if (selectedSummaries.length < 2) return [];

    return DIMENSIONS.map((dim) => {
      const cells: Record<string, CompetitorComparisonCell> = {};
      selectedSummaries.forEach((summary) => {
        const { delta, count, deltaSummary } = computeDelta(summary, dim.sourceKeys);
        
        // Find a notable recent event for this dimension
        const relevantEvent = summary.recent_events.find((e) => {
          const src = (e.contributing_sources || [])[0] || "";
          return dim.sourceKeys.some((key) => src.toLowerCase().includes(key));
        });

        cells[summary.company_name] = {
          companyName: summary.company_name,
          delta,
          deltaSummary,
          evidenceCount: count,
          highlightText: relevantEvent?.title,
          onViewEvidence: relevantEvent
            ? () => {
                setDrawerData({
                  title: relevantEvent.title,
                  company: summary.company_name,
                  timestamp: relevantEvent.published_at,
                  tier: relevantEvent.tier as any,
                  confidence: (relevantEvent.fact_confidence || "Medium") as any,
                  fact: relevantEvent.event_summary || relevantEvent.raw_excerpt || relevantEvent.title,
                  inference: `Comparative observation for ${dim.label}`,
                  sources: [
                    {
                      id: relevantEvent.event_id || String(Math.random()),
                      title: relevantEvent.title,
                      url: relevantEvent.url || "#",
                      sourceType: (relevantEvent.contributing_sources || [])[0] || "unknown",
                      publishedAt: relevantEvent.published_at,
                    },
                  ],
                });
              }
            : undefined,
        };
      });

      return {
        id: dim.id,
        dimensionLabel: dim.label,
        description: dim.description,
        cells,
      };
    });
  }, [selectedSummaries]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold tracking-wide uppercase">
            <Scale className="h-4 w-4" />
            <span>Side-by-Side Comparison</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Competitor Comparison
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Directional movement across tracked dimensions. Indicators derived from
            real signal counts — no invented numeric scores.
          </p>
        </div>

        {/* States */}
        {loading && (
          <LoadingState layout="table" count={4} />
        )}

        {!loading && error && (
          <ErrorState message={error} onRetry={loadData} />
        )}

        {/* Company Selector */}
        {!loading && !error && companies.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Select 2–3 competitors to compare
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {companies.map((comp) => {
                const isSelected = selectedCompanies.has(comp.company_name);
                const isDisabled = !isSelected && selectedCompanies.size >= 3;
                return (
                  <button
                    key={comp.company_name}
                    type="button"
                    onClick={() => toggleCompany(comp.company_name)}
                    disabled={isDisabled}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all cursor-pointer",
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50",
                      isDisabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    {comp.company_name}
                    {comp.is_target && (
                      <span className="text-[9px] opacity-70">(target)</span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedCompanies.size >= 3 && (
              <p className="text-[10px] text-slate-500 mt-2">
                Maximum of 3 competitors for comparison. Deselect one to choose another.
              </p>
            )}
          </div>
        )}

        {/* Comparison Table */}
        {!loading && !error && (
          <ComparisonTable
            competitors={selectedNames}
            rows={comparisonRows}
            onSelectEvidence={(company, dimensionId) => {
              const summary = selectedSummaries.find((s) => s.company_name === company);
              const dim = DIMENSIONS.find((d) => d.id === dimensionId);
              if (!summary || !dim) return;

              const relevantEvent = summary.recent_events.find((e) => {
                const src = (e.contributing_sources || [])[0] || "";
                return dim.sourceKeys.some((key) => src.toLowerCase().includes(key));
              });

              if (relevantEvent) {
                setDrawerData({
                  title: relevantEvent.title,
                  company: company,
                  timestamp: relevantEvent.published_at,
                  tier: relevantEvent.tier as any,
                  confidence: (relevantEvent.fact_confidence || "Medium") as any,
                  fact: relevantEvent.event_summary || relevantEvent.raw_excerpt || relevantEvent.title,
                  inference: `Comparative observation for ${dim.label}`,
                  sources: [
                    {
                      id: relevantEvent.event_id || String(Math.random()),
                      title: relevantEvent.title,
                      url: relevantEvent.url || "#",
                      sourceType: (relevantEvent.contributing_sources || [])[0] || "unknown",
                      publishedAt: relevantEvent.published_at,
                    },
                  ],
                });
              }
            }}
          />
        )}

        {/* Data disclosure */}
        {!loading && !error && selectedNames.length >= 2 && (
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-500">
            <strong className="text-slate-700">Data note:</strong>{" "}
            Directional indicators (↑ Accelerating / → Steady / ↓ No movement) are
            derived from signal counts and event tier distribution for this monitoring
            period. They reflect relative activity levels, not predictive scoring.
          </div>
        )}
      </div>

      {/* Evidence Drawer */}
      <EvidenceDrawer
        data={drawerData}
        isOpen={!!drawerData}
        onClose={() => setDrawerData(null)}
      />
    </AppLayout>
  );
}

export default function ComparePage() {
  return (
    <React.Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <LoadingState layout="table" count={4} />
          </div>
        </AppLayout>
      }
    >
      <CompareContent />
    </React.Suspense>
  );
}
