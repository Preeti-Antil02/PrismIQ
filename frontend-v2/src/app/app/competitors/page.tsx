"use client";

import * as React from "react";
import Link from "next/link";
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
  type SignalRecord,
  type ConsolidatedEventRecord,
} from "@/lib/api";
import { SignalSourceBadge } from "@/components/shared/SignalSourceBadge";
import { ClassifierBadge } from "@/components/shared/ClassifierBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { normalizeClassifierState } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  Users,
  ArrowRight,
  Crown,
  Radio,
  CalendarDays,
  Scale,
  Radar,
  Activity,
  AlertCircle,
} from "lucide-react";

export default function CompetitorsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summaries, setSummaries] = React.useState<CompetitorActivitySummary[]>([]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companies, findingsRes, radarRes] = await Promise.all([
        fetchTrackedCompanies(),
        fetchFindings(),
        fetchLatestRadar(),
      ]);

      // Fetch per-company signals and events to avoid global pagination truncation
      const allSignals: SignalRecord[] = [];
      const allEvents: ConsolidatedEventRecord[] = [];

      await Promise.all(
        companies.map(async (comp) => {
          const [sigRes, evtRes] = await Promise.all([
            fetchSignals({ company: comp.company_name, limit: 200 }),
            fetchEvents({ company: comp.company_name, limit: 200 }),
          ]);
          allSignals.push(...sigRes.signals);
          allEvents.push(...evtRes.events);
        })
      );

      const built = buildCompetitorSummaries(
        companies,
        allSignals,
        allEvents,
        findingsRes.findings,
        radarRes.evaluations || [],
      );
      setSummaries(built);
    } catch (err: any) {
      setError(err.message || "Failed to load competitor data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute max signal count for relative volume bars
  const maxSignals = React.useMemo(
    () => Math.max(...summaries.map((s) => s.total_signals), 1),
    [summaries]
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold tracking-wide uppercase">
              <Users className="h-4 w-4" />
              <span>Competitive Intelligence</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Competitors
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Activity summary for your tracked competitors. Signal volumes and event
              counts are computed from real monitoring data — no invented scores.
            </p>
          </div>
          <Link
            href="/app/compare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Scale className="h-3.5 w-3.5" />
            Compare Side-by-Side
          </Link>
        </div>

        {/* States */}
        {loading && (
          <LoadingState layout="cards" count={3} />
        )}

        {!loading && error && (
          <ErrorState
            message={error}
            onRetry={loadData}
          />
        )}

        {!loading && !error && summaries.length === 0 && (
          <EmptyState
            title="No tracked competitors yet"
            description="Add competitors via the Watchlist to start monitoring their activity."
          />
        )}

        {/* Competitor Cards */}
        {!loading && !error && summaries.length > 0 && (
          <div className="grid gap-5">
            {summaries.map((comp) => (
              <CompetitorCard
                key={comp.company_name}
                summary={comp}
                maxSignals={maxSignals}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ============================================================================
// Competitor Card
// ============================================================================

function CompetitorCard({
  summary,
  maxSignals,
}: {
  summary: CompetitorActivitySummary;
  maxSignals: number;
}) {
  const companySlug = encodeURIComponent(summary.company_name);
  const volumePct = Math.round((summary.total_signals / maxSignals) * 100);

  // Get the most notable recent event (highest tier first)
  const notableEvent = React.useMemo(() => {
    const tiered = summary.recent_events.filter(
      (e) => e.tier && e.tier.toLowerCase() !== "nice-to-know"
    );
    return tiered[0] || summary.recent_events[0] || null;
  }, [summary.recent_events]);

  // Source types that have signals
  const activeSources = Object.entries(summary.signals_by_source)
    .sort((a, b) => b[1] - a[1]);

  // Radar topics with non-idle states
  const activeRadarTopics = Object.entries(summary.radar_connections)
    .filter(([, status]) => {
      const s = status.toLowerCase();
      return s !== "no activity detected";
    });

  return (
    <Link
      href={`/app/competitors/${companySlug}`}
      className="block group"
    >
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Company Avatar */}
            <div className={cn(
              "flex items-center justify-center h-10 w-10 rounded-lg text-sm font-bold",
              summary.is_target
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-slate-100 text-slate-700 border border-slate-200"
            )}>
              {summary.company_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {summary.company_name}
                </h3>
                {summary.is_target && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Crown className="h-3 w-3" />
                    Target
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3" />
                  {summary.total_signals} signals
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {summary.total_events} events
                </span>
                {summary.must_know_count > 0 && (
                  <span className="text-rose-600 font-semibold">
                    {summary.must_know_count} must-know
                  </span>
                )}
                {summary.should_know_count > 0 && (
                  <span className="text-blue-600 font-semibold">
                    {summary.should_know_count} should-know
                  </span>
                )}
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
        </div>

        {/* Signal Volume Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Relative signal volume
            </span>
            <span className="font-medium text-slate-700">{summary.total_signals}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                summary.is_target ? "bg-blue-500" : "bg-slate-400"
              )}
              style={{ width: `${volumePct}%` }}
            />
          </div>
        </div>

        {/* Signal Source Breakdown + Radar */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Signal Sources */}
          <div className="flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Signal sources
            </div>
            {activeSources.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeSources.map(([source, count]) => (
                  <SignalSourceBadge key={source} source={source} count={count} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                No new activity this period
              </p>
            )}
          </div>

          {/* Radar Connections */}
          {Object.keys(summary.radar_connections).length > 0 && (
            <div className="flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                <Radar className="h-3 w-3" />
                Research Radar
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.radar_connections).map(([topic, status]) => (
                  <div key={topic} className="inline-flex items-center gap-1.5">
                    <ClassifierBadge state={normalizeClassifierState(status)} />
                    <span className="text-[10px] text-slate-600 truncate max-w-[120px]" title={topic}>
                      {topic}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notable Event */}
        {notableEvent && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Latest notable event
            </div>
            <div className="flex items-start gap-2">
              <TierBadge tier={notableEvent.tier as any} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 line-clamp-1">
                  {notableEvent.title}
                </p>
                {notableEvent.why_it_matters && (
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {notableEvent.why_it_matters}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
