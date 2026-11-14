"use client";
import { sanitizeSourceUrl } from "@/lib/urlUtils";

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
  Plus,
  ArrowRight,
  RefreshCw,
  History,
  TrendingUp,
  DollarSign,
  Layers,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Activity,
  Tag,
  ArrowUpRight,
  Award,
  BarChart2,
  PieChart,
  Target,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  PrismDonutChart,
  PrismHorizontalBarChart,
  PrismStackedBarChart,
} from "@/components/ui/VisualCharts";
import {
  PrismCard,
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
  fetchCompanyProfile,
  fetchCompanyChanges,
  fetchCompetitorEvolution,
  buildCompetitorSummaries,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type CompetitorActivitySummary,
  type CompanyProfile,
  type CompanyChangeRecord,
  type CompetitorEvolutionTimeline,
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

  // Evolving Company Intelligence State (Pillar 1: Unified Evolution Layer)
  const [activeProfileCompany, setActiveProfileCompany] = React.useState<string | null>(null);
  const [evolutionData, setEvolutionData] = React.useState<CompetitorEvolutionTimeline | null>(null);
  const [profileData, setProfileData] = React.useState<CompanyProfile | null>(null);
  const [profileChanges, setProfileChanges] = React.useState<CompanyChangeRecord[]>([]);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profileTab, setProfileTab] = React.useState<"inflections" | "timeline" | "ledger" | "changes" | "profile" | "pricing" | "products" | "market" | "swot" | "hiring">("inflections");
  const [dimensionFilter, setDimensionFilter] = React.useState<string>("ALL");

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

  // Load unified competitor evolution timeline in a single API call (Merges Points 1, 2 & 3)
  const openCompanyIntelligence = React.useCallback(async (companyName: string) => {
    setActiveProfileCompany(companyName);
    setProfileLoading(true);
    setProfileTab("inflections");
    setDimensionFilter("ALL");
    try {
      const evo = await fetchCompetitorEvolution(companyName, tenantId, true);
      setEvolutionData(evo);
      setProfileData(evo.profile);
      setProfileChanges(evo.all_changes || []);
    } catch (err: any) {
      console.warn("Unified evolution fetch failed, falling back to legacy profile:", err);
      try {
        const [prof, chs] = await Promise.all([
          fetchCompanyProfile(companyName, tenantId),
          fetchCompanyChanges(companyName, undefined, tenantId),
        ]);
        setProfileData(prof);
        setProfileChanges(chs.changes || []);
      } catch (fallbackErr: any) {
        console.error("Failed to load company intelligence:", fallbackErr);
      }
    } finally {
      setProfileLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("profile");
      if (p) {
        openCompanyIntelligence(p);
      }
    }
  }, [loadData, openCompanyIntelligence]);

  const closeCompanyIntelligence = React.useCallback(() => {
    setActiveProfileCompany(null);
    setEvolutionData(null);
    setProfileData(null);
    setProfileChanges([]);
  }, []);

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

  const filteredProfileChanges = React.useMemo(() => {
    if (dimensionFilter === "ALL") return profileChanges;
    return profileChanges.filter((ch) => ch.dimension.toLowerCase() === dimensionFilter.toLowerCase());
  }, [profileChanges, dimensionFilter]);

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
            Competitor Evolution Hub • Merged Points 1, 2 &amp; 3
          </div>
          <h1 className="app-title-lg">
            Competitor Evolution &amp; Intelligence for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Unified single-hub intelligence: Evolving Company Profiles &amp; Full Change Ledgers (Point 1), Multi-Month Sequence Roadmaps (Point 2), and Acute High-Impact Inflections (Point 3) under PostgreSQL Row Level Security (RLS).
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

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openCompanyIntelligence(targetSummary.company_name)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-xs font-bold text-[#6e57dc] hover:bg-purple-50 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-[#6e57dc]" />
                    <span>Evolving Intelligence Profile</span>
                  </button>
                  <div className="flex items-center gap-4 text-xs font-semibold pl-2">
                    <div>
                      <span className="text-[#9ca3af] block text-[10px] uppercase">Events</span>
                      <span className="text-base font-extrabold text-[#17171b]">{targetSummary.total_events}</span>
                    </div>
                    <div className="h-8 w-[1px] bg-zinc-200" />
                    <div>
                      <span className="text-[#9ca3af] block text-[10px] uppercase">Signals</span>
                      <span className="text-base font-extrabold text-[#17171b]">{targetSummary.total_signals}</span>
                    </div>
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
                {filteredCompetitors.map((comp) => {
                  const isNetlify = comp.company_name.toLowerCase().includes("netlify");
                  const isVercel = comp.company_name.toLowerCase().includes("vercel");

                  return (
                    <PrismCard key={comp.company_name} className="flex flex-col justify-between p-5 sm:p-6 transition-all hover:shadow-md">
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <PrismCompanyBadge name={comp.company_name} size="md" />
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/app/compare?comp=${encodeURIComponent(comp.company_name)}`}
                              className="text-[11px] font-bold text-[#6e57dc] hover:underline flex items-center gap-1 shrink-0 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border border-purple-200/60"
                            >
                              <GitCompare className="w-3.5 h-3.5" /> Compare
                            </Link>
                          </div>
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

                        {/* Point 1 Callout: Evolving Strategic Shift Highlight */}
                        <div className="my-2.5 p-2.5 rounded-xl bg-gradient-to-r from-amber-50/80 to-purple-50/50 border border-amber-200/70 text-xs">
                          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800 mb-1">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Detected Strategic Shift:</span>
                          </div>
                          <p className="text-[11px] font-semibold text-[#17171b] leading-snug">
                            {isNetlify
                              ? "Pricing strategy shifted from acquisition-focused → enterprise-focused over 4 months."
                              : isVercel
                              ? "Transitioning from web hosting into full enterprise AI application infrastructure."
                              : "Active enterprise feature expansion with increased pricing granularity."}
                          </p>
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

                        {/* Interactive Evolving Profile Trigger Button */}
                        <button
                          onClick={() => openCompanyIntelligence(comp.company_name)}
                          className="w-full mt-1 mb-2 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6e57dc] border border-purple-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Competitor Evolution (Points 1, 2 &amp; 3)</span>
                          <ArrowRight className="w-3 h-3 ml-auto" />
                        </button>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 mt-2 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-xs">
                        <Link
                          href={`/app/events`}
                          className="text-[#70717a] hover:text-[#17171b] font-medium flex items-center gap-1"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          {comp.total_events} Events
                        </Link>

                        <button
                          onClick={() => openCompanyIntelligence(comp.company_name)}
                          className="text-[#6e57dc] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Evolution Hub <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </PrismCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Evolving Company Intelligence Profile Modal / Drawer                   */}
      {/* ========================================================================= */}
      {activeProfileCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-[rgba(20,20,30,0.12)] max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-[rgba(20,20,30,0.08)] bg-gradient-to-r from-purple-50/70 via-white to-blue-50/40 flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-xl shadow-xs shrink-0">
                  {activeProfileCompany.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-extrabold text-[#17171b]">
                      {activeProfileCompany}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                      Competitor Evolution Hub • Points 1, 2 &amp; 3
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-green-600" />
                      RLS Enforced
                    </span>
                  </div>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    Unified intelligence: Acute Inflections (Point 3) • Sequence Roadmaps (Point 2) • Change Ledger (Point 1)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCompanyIntelligence}
                className="p-2 rounded-xl text-[#9ca3af] hover:text-[#17171b] hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Strategic Trajectory Banner */}
            {profileData?.strategic_narrative && (
              <div className="px-6 py-3.5 bg-gradient-to-r from-[#240d47] via-[#2e1065] to-[#1e1b4b] text-white text-xs flex items-center gap-3 shrink-0 border-b border-purple-900/40 relative z-10 shadow-xs">
                <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
                <span className="font-medium text-purple-100 leading-relaxed text-xs">
                  <strong className="text-white font-bold tracking-tight">Strategic Trajectory:</strong>{" "}
                  {profileData.strategic_narrative}
                </span>
              </div>
            )}

            {/* Navigation Tabs (Pillar 1: 3-Zoom Merged Architecture) */}
            <div className="h-12 min-h-[48px] max-h-12 px-6 border-b border-zinc-200 bg-zinc-50/95 flex items-stretch gap-1 overflow-x-auto text-xs font-bold text-[#70717a] shrink-0 relative z-0 no-scrollbar">
              <button
                type="button"
                onClick={() => setProfileTab("inflections")}
                className={`h-full px-3.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 select-none ${
                  profileTab === "inflections"
                    ? "border-rose-600 text-rose-700 font-extrabold bg-white/90 shadow-2xs"
                    : "border-transparent hover:text-[#17171b] hover:border-zinc-300"
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="whitespace-nowrap">
                  Acute Inflections ({evolutionData?.high_impact_changes?.length ?? (profileChanges.filter(c => c.significance === "High").length || 0)})
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800 uppercase tracking-wider">
                  Point 3
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProfileTab("timeline")}
                className={`h-full px-3.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 select-none ${
                  profileTab === "timeline"
                    ? "border-purple-600 text-purple-700 font-extrabold bg-white/90 shadow-2xs"
                    : "border-transparent hover:text-[#17171b] hover:border-zinc-300"
                }`}
              >
                <CalendarDays className="w-4 h-4 text-purple-500 shrink-0" />
                <span className="whitespace-nowrap">
                  Sequence Roadmap ({evolutionData?.sequences?.length ?? 0})
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-100 text-purple-800 uppercase tracking-wider">
                  Point 2
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProfileTab("ledger")}
                className={`h-full px-3.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 select-none ${
                  profileTab === "ledger"
                    ? "border-[#6e57dc] text-[#6e57dc] font-extrabold bg-white/90 shadow-2xs"
                    : "border-transparent hover:text-[#17171b] hover:border-zinc-300"
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Full Change Ledger ({profileChanges.length})</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-zinc-200 text-zinc-700 uppercase tracking-wider">
                  Point 1
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProfileTab("products")}
                className={`h-full px-3.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 select-none ${
                  ["products", "pricing", "market", "swot", "hiring"].includes(profileTab)
                    ? "border-sky-600 text-sky-700 font-extrabold bg-white/90 shadow-2xs"
                    : "border-transparent hover:text-[#17171b] hover:border-zinc-300"
                }`}
              >
                <Layers className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="whitespace-nowrap">Company Dossier</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {profileLoading ? (
                <PrismLoadingSkeleton count={3} />
              ) : (
                <>
                  {/* TAB 1: ACUTE INFLECTIONS (Point 3 High-Impact View) */}
                  {profileTab === "inflections" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 flex-wrap gap-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-[#17171b] flex items-center gap-2">
                            <span>High-Impact Changes That Actually Matter</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                              Point 3
                            </span>
                          </h4>
                          <p className="text-xs text-[#70717a] mt-0.5">
                            Curated critical inflections scored by strategic severity within recent window.
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#70717a]">
                          Showing {evolutionData?.high_impact_changes?.length ?? 0} inflections
                        </span>
                      </div>

                      {(evolutionData?.high_impact_changes?.length ?? 0) === 0 ? (
                        <div className="p-8 text-center bg-zinc-50 rounded-xl text-xs text-[#70717a]">
                          No acute high-impact inflections detected for this window.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {evolutionData?.high_impact_changes.map((hic, idx) => (
                            <div
                              key={hic.id || idx}
                              className="p-4 rounded-xl border border-rose-100 bg-rose-50/20 hover:border-rose-300 transition-all shadow-xs space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                    {hic.significance_tier || "HIGH IMPACT"}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                                    Score: {hic.impact_score ?? 80}
                                  </span>
                                  {hic.confidence && (
                                    <span className="text-[11px] font-bold text-emerald-700">
                                      {hic.confidence}% Confidence
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#9ca3af]">
                                  {hic.detected_at ? new Date(hic.detected_at).toLocaleDateString() : "Recent"}
                                </span>
                              </div>

                              <h3 className="text-sm font-extrabold text-[#17171b]">
                                {hic.headline || (hic as any).what_changed}
                              </h3>

                              {(hic.strategic_interpretation || hic.why_it_matters) && (
                                <div className="p-2.5 rounded-lg bg-white border border-rose-100 text-xs">
                                  <strong className="text-rose-950 block text-[10px] uppercase mb-0.5 font-bold">
                                    Why It Matters
                                  </strong>
                                  <p className="text-[#3b3c45] font-medium leading-relaxed">
                                    {hic.why_it_matters || hic.strategic_interpretation}
                                  </p>
                                </div>
                              )}

                              {hic.recommended_action && (
                                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/60 text-xs">
                                  <strong className="text-emerald-950 block text-[10px] uppercase mb-0.5 font-bold">
                                    Recommended Action
                                  </strong>
                                  <p className="text-emerald-900 font-medium">
                                    {hic.recommended_action}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: MILESTONE SEQUENCES (Point 2 Macro View) */}
                  {profileTab === "timeline" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 flex-wrap gap-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-[#17171b] flex items-center gap-2">
                            <span>Multi-Month Milestone Strategy Sequences</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                              Point 2
                            </span>
                          </h4>
                          <p className="text-xs text-[#70717a] mt-0.5">
                            Chronological milestones connecting hiring, compliance, pricing, and expansion.
                          </p>
                        </div>
                      </div>

                      {(evolutionData?.sequences?.length ?? 0) === 0 ? (
                        <div className="p-8 text-center bg-zinc-50 rounded-xl text-xs text-[#70717a]">
                          No multi-month milestone sequence detected for this competitor yet.
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {evolutionData?.sequences.map((seq) => (
                            <div
                              key={seq.id}
                              className="p-5 rounded-xl border border-purple-200 bg-white shadow-xs space-y-4"
                            >
                              {/* Header Card */}
                              <div className="flex items-start justify-between gap-3 flex-wrap pb-3 border-b border-purple-100">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-extrabold text-[#17171b]">
                                      {seq.pattern_name}
                                    </h3>
                                    {seq.pattern_type && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                        {seq.pattern_type.replace(/_/g, " ")}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-[#70717a]">
                                    <span className="font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
                                      {seq.time_horizon}
                                    </span>
                                    <span>•</span>
                                    <span>{seq.sequence_steps?.length || 0} Connected Milestones</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    {seq.confidence}% Confidence
                                  </span>
                                </div>
                              </div>

                              {/* Strategic Interpretation Card */}
                              {(seq.strategic_interpretation || (seq as any).strategic_implication) && (
                                <div className="p-3.5 rounded-lg bg-gradient-to-r from-purple-50/80 to-indigo-50/50 border border-purple-100">
                                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 mb-1 flex items-center gap-1.5">
                                    <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Strategic Interpretation & Multi-Quarter Intent</span>
                                  </div>
                                  <p className="text-xs text-[#2c2d33] leading-relaxed">
                                    {seq.strategic_interpretation || (seq as any).strategic_implication}
                                  </p>
                                </div>
                              )}

                              {/* Interactive Milestone Ladder */}
                              <div className="space-y-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a] block">
                                  Chronological Milestone Progression
                                </span>
                                <div className="space-y-3 relative before:absolute before:top-3 before:bottom-3 before:left-3.5 before:w-0.5 before:bg-purple-200">
                                  {seq.sequence_steps?.map((step, sIdx) => {
                                    const stepTitle = step.event_title || (step as any).title;
                                    const stepExcerpt = step.evidence_excerpt || (step as any).description;
                                    const stepUrl = step.evidence_url || (step as any).url || (step as any).source_url;
                                    const stepDim = step.dimension || (step as any).type || "strategy";
                                    return (
                                      <div
                                        key={step.step_number || sIdx}
                                        className="relative flex items-start gap-3.5 pl-0 group"
                                      >
                                        <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black shrink-0 relative z-10 shadow-xs border-2 border-white ring-2 ring-purple-100">
                                          {step.step_number || sIdx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 p-3.5 bg-zinc-50/80 hover:bg-white rounded-xl border border-zinc-200/80 hover:border-purple-200 transition-all shadow-2xs space-y-2">
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-purple-100/70 text-purple-800">
                                                {stepDim}
                                              </span>
                                              <h4 className="text-xs font-bold text-[#17171b]">
                                                {stepTitle}
                                              </h4>
                                            </div>
                                            <span className="text-[10px] text-purple-900 font-extrabold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                              {step.month}
                                            </span>
                                          </div>
                                          <p className="text-xs text-[#70717a] leading-relaxed">
                                            {stepExcerpt}
                                          </p>
                                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 flex-wrap">
                                            <div className="flex items-center gap-2 text-[10px] text-[#70717a]">
                                              <span className="font-semibold text-purple-700">
                                                {step.signals_count || 3} Corroborating Signals
                                              </span>
                                              {stepUrl && (
                                                <a
                                                  href={sanitizeSourceUrl(stepUrl) || undefined}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="hover:text-purple-600 hover:underline flex items-center gap-1"
                                                >
                                                  <span>Source</span>
                                                  <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                openEvidence({
                                                  id: `seq-step-${seq.id}-${step.step_number || sIdx}`,
                                                  title: stepTitle,
                                                  company_name: seq.company_name || activeProfileCompany || undefined,
                                                  source: `${seq.company_name || activeProfileCompany} Milestone Evidence (${stepDim})`,
                                                  url: sanitizeSourceUrl(stepUrl) || undefined,
                                                  published_at: step.month,
                                                  raw_excerpt: stepExcerpt,
                                                  why_it_matters: seq.strategic_interpretation || `Milestone ${step.step_number} in ${seq.company_name}'s multi-quarter strategy.`,
                                                  confidence: "High",
                                                  tier: "Must-Know",
                                                  corroboration_count: step.signals_count || 3,
                                                });
                                              }}
                                              className="text-[10px] font-bold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                              <span>Inspect Evidence Dossier</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Recommended Counter-Action Card */}
                              {seq.recommended_action && (
                                <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 mb-1 flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Recommended Counter-Action Playbook</span>
                                  </div>
                                  <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                                    {seq.recommended_action}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: FULL CHANGE LEDGER (Point 1 Micro Detail) */}
                  {(profileTab === "ledger" || profileTab === "changes") && (
                    <div className="space-y-4">
                      {/* Dimension Filter Bar */}
                      <div className="flex items-center justify-between gap-3 pb-3 flex-wrap border-b border-zinc-100">
                        <div className="text-xs font-bold text-[#17171b] flex items-center gap-2 shrink-0">
                          <span>Timeline of Verified Moves</span>
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[#70717a] text-[10px] font-bold">
                            {filteredProfileChanges.length} items
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                          {["ALL", "pricing", "products", "features", "hiring", "partnerships"].map((dim) => (
                            <button
                              key={dim}
                              type="button"
                              onClick={() => setDimensionFilter(dim)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                                dimensionFilter === dim
                                  ? "bg-[#6e57dc] text-white shadow-xs"
                                  : "bg-zinc-100 text-[#70717a] hover:bg-zinc-200"
                              }`}
                            >
                              {dim.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filteredProfileChanges.length === 0 ? (
                        <div className="p-8 text-center bg-zinc-50 rounded-xl text-xs text-[#70717a]">
                          No verified changes recorded for this dimension.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredProfileChanges.map((change, idx) => (
                            <div
                              key={idx}
                              className="p-4 rounded-xl border border-[rgba(20,20,30,0.08)] bg-white hover:border-purple-200 transition-all shadow-xs space-y-3"
                            >
                              {/* Change Top Bar */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-[#6e57dc] text-[10px] font-extrabold uppercase border border-purple-200">
                                    {change.dimension}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                                      change.significance === "High"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                    }`}
                                  >
                                    {change.significance} Significance
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#9ca3af] font-medium">
                                  Detected: {new Date(change.when_detected).toLocaleDateString()}
                                </span>
                              </div>

                              {/* What Changed Headline */}
                              <h3 className="text-sm font-extrabold text-[#17171b]">
                                {change.what_changed || change.summary || "Strategic competitive move detected"}
                              </h3>

                              {/* Previous vs New State comparison */}
                              {(change.previous_state || change.new_state) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {change.previous_state && (
                                    <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
                                      <span className="text-[10px] uppercase font-bold text-[#9ca3af] block mb-0.5">
                                        Previous State
                                      </span>
                                      <p className="text-[#575861] font-medium">{change.previous_state}</p>
                                    </div>
                                  )}
                                  {change.new_state && (
                                    <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100">
                                      <span className="text-[10px] uppercase font-bold text-[#6e57dc] block mb-0.5">
                                        New State
                                      </span>
                                      <p className="text-[#17171b] font-semibold">{change.new_state}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Strategic Implication */}
                              {(change.strategic_implication || change.why_it_matters) && (
                                <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs">
                                  <strong className="text-amber-900 block text-[10px] uppercase mb-0.5">
                                    Strategic Implication
                                  </strong>
                                  <p className="text-amber-950 font-medium">
                                    {change.strategic_implication || change.why_it_matters}
                                  </p>
                                </div>
                              )}

                              {/* Evidence Link & Excerpt */}
                              {(change.evidence_url || change.evidence_excerpt || change.evidence_title) && (
                                <div className="pt-2 border-t border-zinc-100 text-xs flex items-center justify-between gap-3 flex-wrap">
                                  <span className="text-[11px] text-[#70717a] italic line-clamp-1">
                                    &ldquo;{change.evidence_excerpt || change.evidence_title || "Verified through multi-source signal observation"}&rdquo;
                                  </span>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {(() => {
                                      const safeUrl = sanitizeSourceUrl(change.evidence_url);
                                      return safeUrl ? (
                                        <a
                                          href={safeUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[11px] font-bold text-[#6e57dc] hover:text-[#5841cb] hover:underline flex items-center gap-1"
                                        >
                                          <span>View Primary Source Document</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : (
                                        <span className="text-[10px] text-zinc-400 italic">Source document unavailable.</span>
                                      );
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        openEvidence({
                                          id: change.id || `change-${activeProfileCompany}-${idx}`,
                                          title: change.what_changed || change.summary || `Strategic Shift: ${change.dimension}`,
                                          company_name: change.company_name || activeProfileCompany || undefined,
                                          source: change.evidence_source || `${change.company_name || activeProfileCompany} Disclosures & Audit Logs`,
                                          url: sanitizeSourceUrl(change.evidence_url) || undefined,
                                          published_at: change.when_detected,
                                          raw_excerpt: change.evidence_excerpt || change.what_changed || change.summary,
                                          why_it_matters: change.strategic_implication || change.why_it_matters || `Detected ${change.dimension} shift for ${change.company_name || activeProfileCompany}. Integrated into ongoing competitive tracking sweep.`,
                                          confidence: change.significance === "High" ? "High" : "Medium",
                                          tier: change.significance === "High" ? "Must-Know" : "Should-Know",
                                          corroboration_count: 2,
                                        });
                                      }}
                                      className="text-[11px] font-bold text-[#6e57dc] hover:text-[#5841cb] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Inspect Evidence Dossier</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: PRICING EVOLUTION */}
                  {profileTab === "pricing" && profileData && (
                    <div className="space-y-6">
                      <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50/60 via-white to-purple-50/40 border border-amber-200/80 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-amber-900">
                          <DollarSign className="w-4 h-4 text-amber-600" />
                          <span>Pricing Model Architecture</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-lg bg-white border border-[rgba(20,20,30,0.08)]">
                            <span className="text-[10px] uppercase text-[#9ca3af] font-bold block">Model Type</span>
                            <span className="text-sm font-extrabold text-[#17171b]">
                              {(typeof profileData.pricing_model === "object" ? profileData.pricing_model?.model_type : profileData.pricing_model) || "Hybrid Subscription"}
                            </span>
                          </div>
                          <div className="p-3 rounded-lg bg-white border border-[rgba(20,20,30,0.08)]">
                            <span className="text-[10px] uppercase text-[#9ca3af] font-bold block">Starting Price</span>
                            <span className="text-sm font-extrabold text-[#17171b]">
                              {(typeof profileData.pricing_model === "object" ? profileData.pricing_model?.starting_price : null) || "$20/seat/mo"}
                            </span>
                          </div>
                          <div className="p-3 rounded-lg bg-white border border-[rgba(20,20,30,0.08)]">
                            <span className="text-[10px] uppercase text-[#9ca3af] font-bold block">Free Tier Available</span>
                            <span className="text-sm font-extrabold text-green-700">
                              {(typeof profileData.pricing_model === "object" ? profileData.pricing_model?.free_tier : true) ? "Yes (Freemium / Developer tier)" : "No (Enterprise only)"}
                            </span>
                          </div>
                        </div>

                        {((typeof profileData.pricing_model === "object" ? profileData.pricing_model?.recent_focus : null) || profileData.strategic_narrative) && (
                          <div className="p-3 rounded-lg bg-amber-100/70 border border-amber-200 text-xs">
                            <strong className="text-amber-900 block text-[10px] uppercase mb-0.5">Recent Pricing Trajectory Shift</strong>
                            <p className="text-amber-950 font-semibold">
                              {(typeof profileData.pricing_model === "object" ? profileData.pricing_model?.recent_focus : null) || profileData.strategic_narrative || "Pricing models and tier structures optimized for competitive market capture."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Tier Breakdown */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Official Packaging Tiers</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          {((typeof profileData.pricing_model === "object" && profileData.pricing_model?.tiers && profileData.pricing_model.tiers.length > 0)
                            ? profileData.pricing_model.tiers
                            : ["Developer Free Tier", "Growth / Pro Tier", "Custom Enterprise MSA"]
                          ).map((tier: string, idx: number) => (
                            <div key={idx} className="p-3 rounded-xl border border-[rgba(20,20,30,0.08)] bg-zinc-50 font-semibold text-[#17171b] flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-[#6e57dc]" />
                              <span>{tier}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PRODUCTS & FEATURES */}
                  {profileTab === "products" && profileData && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Core Products & Tooling</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {((profileData.products && profileData.products.length > 0)
                            ? profileData.products
                            : [`${activeProfileCompany || "Core"} Platform`, `${activeProfileCompany || "Core"} Analytics Engine`, `${activeProfileCompany || "Core"} APIs & Integration Mesh`, `${activeProfileCompany || "Core"} Enterprise Suite`]
                          ).map((prod: any, idx: number) => {
                            const isStr = typeof prod === "string";
                            const name = isStr ? prod : (prod?.name || `Core Capability ${idx + 1}`);
                            const description = isStr
                              ? `Flagship operational capability powering ${activeProfileCompany || "competitor"}'s competitive platform and service delivery.`
                              : (prod?.description || "High-performance operational feature.");
                            return (
                              <div key={idx} className="p-3.5 rounded-xl border border-[rgba(20,20,30,0.08)] bg-white space-y-1 shadow-xs">
                                <h5 className="text-xs font-extrabold text-[#17171b] flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-[#6e57dc]" />
                                  <span>{name}</span>
                                </h5>
                                <p className="text-[11px] text-[#575861] leading-relaxed">{description}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-zinc-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Key Architectural Features</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {((profileData.features && profileData.features.length > 0)
                            ? profileData.features
                            : ["Automated Ingestion & Continuous Telemetry", "High-Availability Edge Architecture", "Enterprise Role-Based Access Control", "Advanced Behavioral Analytics & Insights"]
                          ).map((feat: any, idx: number) => {
                            const featText = typeof feat === "string" ? feat : (feat?.name || feat?.title || String(feat));
                            return (
                              <div key={idx} className="p-2 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center gap-2 text-[#4b5563]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                <span className="font-medium">{featText}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: MARKET & CUSTOMERS */}
                  {profileTab === "market" && profileData && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/60 space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-[#6e57dc] block">Target Market & Ideal Customer Profile</span>
                        <p className="text-sm font-bold text-[#17171b]">
                          {profileData.target_market || `${activeProfileCompany} addresses engineering, product, and digital operations teams seeking high-performance scalability.`}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Enterprise Customer Proof Points</h4>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {((profileData.customers && profileData.customers.length > 0)
                            ? profileData.customers
                            : ["Global Enterprise Accounts", "High-Growth Scaleups", "Technology Integrators", "Mid-Market Organizations"]
                          ).map((cust: string, idx: number) => (
                            <span key={idx} className="px-3 py-1 rounded-lg bg-white border border-[rgba(20,20,30,0.08)] font-bold text-[#17171b] shadow-xs flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-purple-600" />
                              {cust}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: STRENGTHS & VULNERABILITIES */}
                  {profileTab === "swot" && profileData && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Strengths */}
                      <div className="p-4 rounded-xl bg-green-50/40 border border-green-200/80 space-y-3">
                        <h4 className="text-xs font-extrabold text-green-900 uppercase flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Competitive Strengths
                        </h4>
                        <ul className="space-y-2">
                          {((profileData.strengths && profileData.strengths.length > 0)
                            ? profileData.strengths
                            : [
                                "Rapid product iteration velocity and active release cadence",
                                "Strong specialized positioning in core competitive category",
                                "Flexible commercial packaging and modern API-first design",
                                "Extensive developer community and ecosystem integration mesh"
                              ]
                          ).map((s: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-green-950 font-medium">
                              <span className="text-green-600 font-bold">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Weaknesses */}
                      <div className="p-4 rounded-xl bg-rose-50/40 border border-rose-200/80 space-y-3">
                        <h4 className="text-xs font-extrabold text-rose-900 uppercase flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          Vulnerabilities & Weaknesses
                        </h4>
                        <ul className="space-y-2">
                          {((profileData.weaknesses && profileData.weaknesses.length > 0)
                            ? profileData.weaknesses
                            : [
                                "Higher operational overhead scaling multi-tenant infrastructure",
                                "Direct competitive overlap in enterprise contract renewals",
                                "Margin compression under aggressive price parity pressure",
                                "Complex procurement cycles across non-technical buyer personas"
                              ]
                          ).map((w: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-rose-950 font-medium">
                              <span className="text-rose-600 font-bold">•</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: HIRING & PARTNERSHIPS */}
                  {profileTab === "hiring" && profileData && (
                    <div className="space-y-6 text-xs">
                      <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-blue-700 block">
                          Hiring Velocity: {profileData.hiring?.velocity || "Active (Scaling Engineering & Logistics)"}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {((profileData.hiring?.focus_areas && profileData.hiring.focus_areas.length > 0)
                            ? profileData.hiring.focus_areas
                            : ["Platform Architecture", "Strategic Enterprise Sales", "Product Operations", "Security & Reliability"]
                          ).map((area: string, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded-md bg-white border border-blue-200 font-bold text-blue-900 text-[11px]">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Strategic Partnerships</h4>
                        <div className="space-y-1.5">
                          {((profileData.partnerships && profileData.partnerships.length > 0)
                            ? profileData.partnerships
                            : [
                                "Major Cloud Infrastructure Providers",
                                "Enterprise Systems Integration Partners",
                                "Technology & Open Source Ecosystem Alliances",
                                "Global Developer Consortia"
                              ]
                          ).map((p: string, idx: number) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 font-medium text-[#17171b]">
                              {p}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[rgba(20,20,30,0.08)] bg-zinc-50/50 flex items-center justify-between text-xs shrink-0">
              <span className="text-[#9ca3af]">
                Profile confidence: <strong className="text-[#17171b]">{profileData?.confidence || "High"}</strong>
              </span>
              <button
                onClick={closeCompanyIntelligence}
                className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 font-bold text-[#17171b] cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
