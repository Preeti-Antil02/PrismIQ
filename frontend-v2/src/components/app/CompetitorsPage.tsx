"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Search,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  GitCompare,
  CalendarDays,
  Radio,
  Plus,
  RefreshCw,
  BarChart2,
  PieChart,
  ArrowRight,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  PrismDonutChart,
  PrismHorizontalBarChart,
  PrismStackedBarChart,
} from "@/components/ui/VisualCharts";
import {
  PrismCard,
  PrismTierBadge,
  PrismConfidenceBadge,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismCompanyBadge,
  PrismSectionHeader,
} from "./PrismPrimitives";
import {
  fetchTrackedCompanies,
  fetchEvents,
  fetchSignals,
  fetchFindings,
  fetchLatestRadar,
  buildCompetitorSummaries,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type CompetitorActivitySummary,
} from "@/lib/api";

export function CompetitorsPage() {
  const { targetCompany, tenantId } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [findings, setFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compsRes, eventsRes, signalsRes, findingsRes, radarRes] =
        await Promise.allSettled([
          fetchTrackedCompanies(tenantId),
          fetchEvents({ limit: 150, tenantId }),
          fetchSignals({ limit: 300, tenantId }),
          fetchFindings(tenantId),
          fetchLatestRadar(tenantId),
        ]);

      if (compsRes.status === "fulfilled") setCompanies(compsRes.value || []);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value?.events || []);
      if (signalsRes.status === "fulfilled") setSignals(signalsRes.value?.signals || []);
      if (findingsRes.status === "fulfilled") setFindings(findingsRes.value?.findings || []);
      if (radarRes.status === "fulfilled") setRadarEvals(radarRes.value?.evaluations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load competitors");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Summaries
  const summaries: CompetitorActivitySummary[] = React.useMemo(() => {
    if (companies.length === 0) return [];
    return buildCompetitorSummaries(companies, signals, events, findings, radarEvals);
  }, [companies, signals, events, findings, radarEvals]);

  const targetSummary = React.useMemo(() => {
    return (
      summaries.find((s) => s.is_target) ||
      summaries.find(
        (s) =>
          (s.company_name || "").toLowerCase() === (targetCompany || "").toLowerCase()
      )
    );
  }, [summaries, targetCompany]);

  const competitorSummaries = React.useMemo(() => {
    return summaries.filter(
      (s) =>
        !s.is_target &&
        (s.company_name || "").toLowerCase() !== (targetCompany || "").toLowerCase()
    );
  }, [summaries, targetCompany]);

  const filteredCompetitors = React.useMemo(() => {
    if (!searchQuery.trim()) return competitorSummaries;
    const q = searchQuery.toLowerCase();
    return competitorSummaries.filter((c) =>
      (c.company_name || "").toLowerCase().includes(q)
    );
  }, [competitorSummaries, searchQuery]);

  // Competitor Visual Benchmark Aggregations (from actual summaries, signals, events)
  const competitorActivityBars = React.useMemo(() => {
    return [...summaries]
      .filter((s) => s.total_signals > 0 || s.total_events > 0)
      .sort((a, b) => b.total_signals + b.total_events * 2 - (a.total_signals + a.total_events * 2))
      .slice(0, 8)
      .map((s) => ({
        label: s.company_name,
        value: s.total_signals + s.total_events,
        badge: s.is_target ? "Target" : undefined,
        secondaryText: `${s.total_events} events · ${s.total_signals} signals`,
        color: s.is_target ? "#6e57dc" : "#0284c7",
      }));
  }, [summaries]);

  const competitorSourceStackedRows = React.useMemo(() => {
    return [...summaries]
      .filter((s) => s.total_signals > 0)
      .sort((a, b) => b.total_signals - a.total_signals)
      .slice(0, 6)
      .map((s) => ({
        label: s.company_name,
        isTarget: s.is_target,
        totalLabel: `${s.total_signals} signals`,
        segments: [
          { label: "News", value: s.signals_by_source?.news || 0, color: "#0ea5e9" },
          { label: "Research", value: s.signals_by_source?.research || 0, color: "#8b5cf6" },
          { label: "GitHub", value: s.signals_by_source?.github || 0, color: "#10b981" },
          { label: "Hiring", value: s.signals_by_source?.jobs || 0, color: "#f59e0b" },
          { label: "Pricing", value: s.signals_by_source?.pricing || 0, color: "#ec4899" },
        ],
      }));
  }, [summaries]);

  const landscapeTierDistribution = React.useMemo(() => {
    let must = 0;
    let should = 0;
    let nice = 0;
    events.forEach((e) => {
      const t = (e.tier || "").toLowerCase();
      if (t.includes("must")) must++;
      else if (t.includes("should")) should++;
      else nice++;
    });
    return [
      { label: "Must-Know", value: must, color: "#f43f5e" },
      { label: "Should-Know", value: should, color: "#f59e0b" },
      { label: "Nice-to-Know", value: nice, color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [events]);

  const landscapeSourceDistribution = React.useMemo(() => {
    const counts: Record<string, number> = { news: 0, research: 0, github: 0, jobs: 0, pricing: 0 };
    signals.forEach((s) => {
      const src = (s.source || "").toLowerCase();
      if (src.includes("news")) counts.news++;
      else if (src.includes("research") || src.includes("arxiv")) counts.research++;
      else if (src.includes("git")) counts.github++;
      else if (src.includes("job") || src.includes("career")) counts.jobs++;
      else if (src.includes("pric")) counts.pricing++;
    });
    return [
      { label: "News & Media", value: counts.news, color: "#0ea5e9" },
      { label: "Research & Patents", value: counts.research, color: "#8b5cf6" },
      { label: "GitHub Repositories", value: counts.github, color: "#10b981" },
      { label: "Hiring & Headcount", value: counts.jobs, color: "#f59e0b" },
      { label: "Pricing & Packaging", value: counts.pricing, color: "#ec4899" },
    ].filter((d) => d.value > 0);
  }, [signals]);

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Competitive Landscape Directory
          </div>
          <h1 className="app-title-lg">
            Tracked Competitors for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Detailed profile breakdown of all tracked rivals, multi-channel signal footprints, and recent strategic moves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrismButton variant="light" size="sm" onClick={loadData}>
            <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Refresh</span>
          </PrismButton>
          <Link href="/app/workspace/watchlist" className="app-btn app-btn-dark px-4 py-2 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Watchlist</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={4} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Competitors"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : (
        <div className="space-y-10">
          {/* 1. Target Company Feature Card */}
          {targetSummary && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-blue-50/50 border border-purple-200/80 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(20,20,30,0.06)]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-lg shadow-sm">
                    {targetSummary.company_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-extrabold text-[#17171b]">
                        {targetSummary.company_name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                        Target Organization
                      </span>
                      {targetSummary.industry_category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {targetSummary.industry_category}
                        </span>
                      )}
                      {targetSummary.primary_domain && (
                        <a
                          href={`https://${targetSummary.primary_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-medium text-[#70717a] hover:text-[#6e57dc] inline-flex items-center gap-1 hover:underline"
                        >
                          <span>{targetSummary.primary_domain}</span>
                          <ExternalLink className="w-3 h-3 text-[#9ca3af]" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-[#70717a] mt-0.5">
                      Your primary competitive baseline entity.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[#9ca3af] block text-[10px] uppercase">Validated Events</span>
                    <span className="text-base font-extrabold text-[#17171b]">{targetSummary.total_events}</span>
                  </div>
                  <div className="h-8 w-[1px] bg-zinc-200" />
                  <div>
                    <span className="text-[#9ca3af] block text-[10px] uppercase">Raw Signals</span>
                    <span className="text-base font-extrabold text-[#17171b]">{targetSummary.total_signals}</span>
                  </div>
                </div>
              </div>

              {/* Source Distribution Pills */}
              <div className="pt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mr-1">
                  Monitored Footprint:
                </span>
                {Object.entries(targetSummary.signals_by_source).map(([src, cnt]) => (
                  <span
                    key={src}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[rgba(20,20,30,0.08)] text-[11px] font-semibold text-[#4b5563]"
                  >
                    {src.toUpperCase()}: <strong className="text-[#17171b]">{cnt}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Competitive Intelligence Visual Benchmark */}
          <div className="space-y-4">
            <PrismSectionHeader
              title="Competitive Intelligence Visual Benchmark"
              subtitle="Comparative graphical representation of rival activity volume, source footprints, and threat severity."
              eyebrow="Rival Visual Analytics"
              action={
                <div className="flex items-center gap-2 text-xs font-semibold text-[#70717a]">
                  <BarChart2 className="w-3.5 h-3.5 text-[#6e57dc]" />
                  <span>Market Footprint Comparison</span>
                </div>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Chart 1: Activity Volume Benchmark */}
              <PrismCard className="p-5">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#17171b]">Overall Market Activity Benchmark</h3>
                    <p className="text-[11px] text-[#70717a] mt-0.5">Ranked by combined verified signals and corroborated events</p>
                  </div>
                  <span className="app-pill bg-purple-50 text-[#6e57dc] text-[10px] font-bold">
                    Top Active Competitors
                  </span>
                </div>

                {competitorActivityBars.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9ca3af]">No competitor activity detected</div>
                ) : (
                  <PrismHorizontalBarChart items={competitorActivityBars} />
                )}
              </PrismCard>

              {/* Chart 2: Competitor Multi-Channel Footprint */}
              <PrismCard className="p-5">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#17171b]">Multi-Channel Intelligence Footprint</h3>
                    <p className="text-[11px] text-[#70717a] mt-0.5">Channel mix: News, Research, GitHub, Hiring, Pricing</p>
                  </div>
                  <span className="app-pill bg-blue-50 text-blue-700 text-[10px] font-bold">
                    Signal Channel Mix
                  </span>
                </div>

                {competitorSourceStackedRows.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9ca3af]">No multi-channel signals available</div>
                ) : (
                  <PrismStackedBarChart
                    rows={competitorSourceStackedRows}
                    legend={[
                      { label: "News", color: "#0ea5e9" },
                      { label: "Research", color: "#8b5cf6" },
                      { label: "GitHub", color: "#10b981" },
                      { label: "Hiring", color: "#f59e0b" },
                      { label: "Pricing", color: "#ec4899" },
                    ]}
                  />
                )}
              </PrismCard>

              {/* Chart 3: Landscape Event Severity Donut */}
              <PrismCard className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#17171b]">Landscape Event Severity Split</h3>
                    <p className="text-[11px] text-[#70717a] mt-0.5">Critical Must-Know shifts vs Tactical & Operational developments</p>
                  </div>
                  <span className="app-pill bg-rose-50 text-rose-700 text-[10px] font-bold">
                    {events.length} Events Total
                  </span>
                </div>

                {landscapeTierDistribution.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9ca3af]">No event severity data</div>
                ) : (
                  <PrismDonutChart
                    data={landscapeTierDistribution}
                    centerLabel="Events"
                    centerValue={events.length}
                    size={180}
                    thickness={22}
                  />
                )}
              </PrismCard>

              {/* Chart 4: Landscape Multi-Source Signal Donut */}
              <PrismCard className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#17171b]">Channel Source Share</h3>
                    <p className="text-[11px] text-[#70717a] mt-0.5">Distribution across external evidence channels</p>
                  </div>
                  <span className="app-pill bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    {signals.length} Signals Total
                  </span>
                </div>

                {landscapeSourceDistribution.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9ca3af]">No signal source data</div>
                ) : (
                  <PrismDonutChart
                    data={landscapeSourceDistribution}
                    centerLabel="Signals"
                    centerValue={signals.length}
                    size={180}
                    thickness={22}
                  />
                )}
              </PrismCard>
            </div>
          </div>

          {/* 2. Tracked Competitors Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <PrismSectionHeader
                title={`Tracked Competitors (${competitorSummaries.length})`}
                subtitle="Monitored rivals actively tracked for strategy shifts, product launches, and pricing adjustments."
              />

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  type="text"
                  placeholder="Filter competitor names..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="app-search-input w-full"
                />
              </div>
            </div>

            {filteredCompetitors.length === 0 ? (
              <PrismEmptyState
                icon={<Users className="w-6 h-6" />}
                title="No Competitors Found"
                description={
                  searchQuery
                    ? "No competitor matches your search query."
                    : `No competitors are currently configured for ${targetCompany}. Add rivals or run discovery to populate your competitive landscape.`
                }
                actionText="Add Competitors"
                actionHref="/app/workspace/watchlist"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCompetitors.map((comp) => (
                  <PrismCard key={comp.company_name} className="flex flex-col justify-between p-5 sm:p-6">
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <PrismCompanyBadge name={comp.company_name} size="md" />
                        <Link
                          href={`/app/compare?comp=${encodeURIComponent(comp.company_name)}`}
                          className="text-[11px] font-bold text-[#6e57dc] hover:underline flex items-center gap-1 shrink-0 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border border-purple-200/60"
                        >
                          <GitCompare className="w-3.5 h-3.5" /> Compare
                        </Link>
                      </div>

                      {/* Metadata Row: Category, Domain, Tier */}
                      <div className="flex items-center gap-1.5 flex-wrap my-2.5">
                        {comp.industry_category && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-[#4b5563] text-[10px] font-semibold border border-zinc-200/80">
                            {comp.industry_category}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            (comp.tier || "core").toLowerCase() === "core"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {(comp.tier || "core").toLowerCase() === "core" ? "Core Rival" : "Secondary"}
                        </span>
                        {comp.primary_domain && (
                          <a
                            href={`https://${comp.primary_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#70717a] hover:text-[#6e57dc] inline-flex items-center gap-1 font-medium hover:underline"
                          >
                            <span>{comp.primary_domain}</span>
                            <ExternalLink className="w-3 h-3 text-[#9ca3af]" />
                          </a>
                        )}
                      </div>

                      {/* Strategic Positioning Rationale */}
                      {comp.rationale && (
                        <p className="text-[11px] text-[#575861] leading-relaxed my-2.5 p-2 rounded-lg bg-zinc-50 border border-zinc-100 line-clamp-2">
                          {comp.rationale}
                        </p>
                      )}

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs">
                        <div>
                          <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Signals</span>
                          <span className="text-sm font-extrabold text-[#17171b]">{comp.total_signals}</span>
                        </div>
                        <div>
                          <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Events</span>
                          <span className="text-sm font-extrabold text-[#17171b]">{comp.total_events}</span>
                        </div>
                      </div>

                      {/* Monitored Channels */}
                      <div className="space-y-1.5 my-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                          Active Channels
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(comp.signals_by_source)
                            .filter(([_, count]) => count > 0)
                            .map(([src, count]) => (
                              <span
                                key={src}
                                className="px-2 py-0.5 rounded-md bg-white border border-[rgba(20,20,30,0.07)] text-[10px] font-semibold text-[#4b5563]"
                              >
                                {src}: {count}
                              </span>
                            ))}
                        </div>
                      </div>

                      {/* Latest Event Preview */}
                      {comp.recent_events.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[rgba(20,20,30,0.06)]">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                            Latest Validated Move
                          </div>
                          <div
                            onClick={() =>
                              openEvidence({
                                id: comp.recent_events[0].event_id,
                                title: comp.recent_events[0].title,
                                company_name: comp.company_name,
                                why_it_matters: comp.recent_events[0].why_it_matters,
                                raw_excerpt: comp.recent_events[0].raw_excerpt,
                                url: comp.recent_events[0].url,
                                tier: comp.recent_events[0].tier,
                              })
                            }
                            className="text-xs font-semibold text-[#17171b] line-clamp-2 hover:text-[#6e57dc] cursor-pointer"
                          >
                            {comp.recent_events[0].title}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-4 mt-4 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-xs">
                      <Link
                        href={`/app/events`}
                        className="text-[#70717a] hover:text-[#17171b] font-medium flex items-center gap-1"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        {comp.total_events} Events
                      </Link>

                      <Link
                        href={`/app/compare?comp=${encodeURIComponent(comp.company_name)}`}
                        className="text-[#6e57dc] font-bold hover:underline flex items-center gap-1"
                      >
                        Full Analysis <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </PrismCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
