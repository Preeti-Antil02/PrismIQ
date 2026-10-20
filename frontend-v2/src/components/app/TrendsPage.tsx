"use client";

import * as React from "react";
import {
  TrendingUp,
  BarChart3,
  RefreshCw,
  Clock,
  Sparkles,
  GitBranch,
  Newspaper,
  Briefcase,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Activity,
  Flame,
  Search,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  PrismCard,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismSectionHeader,
  PrismCompanyBadge,
} from "./PrismPrimitives";
import {
  fetchTrends,
  fetchTrendDetail,
  fetchTrackedCompanies,
  type TrendRecord,
  type TrendDetailRecord,
  type TimelineNode,
  type TrackedCompany,
} from "@/lib/api";

// ============================================================================
// Mini Momentum Velocity Sparkline Component
// ============================================================================
function MomentumSparkline({
  vector,
  label,
}: {
  vector: [number, number, number];
  label: string;
}) {
  const maxVal = Math.max(...vector, 1);
  const colorCls =
    label === "surging"
      ? "bg-emerald-500"
      : label === "building"
      ? "bg-blue-500"
      : label === "fading"
      ? "bg-amber-500"
      : label === "transient"
      ? "bg-purple-500"
      : "bg-zinc-400";

  return (
    <div
      className="flex items-end gap-1 h-5 px-1.5 py-0.5 rounded bg-zinc-100/80 border border-zinc-200/60"
      title={`3-Week Velocity Vector: W-2: ${vector[0]}, W-1: ${vector[1]}, Current: ${vector[2]}`}
    >
      {vector.map((val, idx) => {
        const heightPct = Math.max(18, Math.round((val / maxVal) * 100));
        return (
          <div key={idx} className="flex flex-col items-center">
            <div
              style={{ height: `${(heightPct * 13) / 100}px` }}
              className={`w-1.5 rounded-xs transition-all ${colorCls} ${
                idx === 2 ? "opacity-100 ring-1 ring-white" : "opacity-60"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Signal Breakdown Proportion Bar Component
// ============================================================================
function SignalMixBar({ breakdown }: { breakdown?: Record<string, number> }) {
  if (!breakdown || Object.keys(breakdown).length === 0) return null;
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-zinc-100">
        {(breakdown.news || 0) > 0 && (
          <div
            style={{ width: `${((breakdown.news || 0) / total) * 100}%` }}
            className="bg-sky-500"
            title={`News: ${breakdown.news}`}
          />
        )}
        {(breakdown.research || 0) > 0 && (
          <div
            style={{ width: `${((breakdown.research || 0) / total) * 100}%` }}
            className="bg-purple-500"
            title={`Research: ${breakdown.research}`}
          />
        )}
        {(breakdown.github || 0) > 0 && (
          <div
            style={{ width: `${((breakdown.github || 0) / total) * 100}%` }}
            className="bg-emerald-500"
            title={`GitHub: ${breakdown.github}`}
          />
        )}
        {(breakdown.hiring || 0) > 0 && (
          <div
            style={{ width: `${((breakdown.hiring || 0) / total) * 100}%` }}
            className="bg-amber-500"
            title={`Hiring: ${breakdown.hiring}`}
          />
        )}
        {(breakdown.pricing || 0) > 0 && (
          <div
            style={{ width: `${((breakdown.pricing || 0) / total) * 100}%` }}
            className="bg-rose-500"
            title={`Pricing: ${breakdown.pricing}`}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main TrendsPage Component
// ============================================================================
export function TrendsPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [trends, setTrends] = React.useState<TrendRecord[]>([]);
  const [selectedTrendId, setSelectedTrendId] = React.useState<string | null>(null);
  const [trendDetail, setTrendDetail] = React.useState<TrendDetailRecord | null>(null);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [selectedCompanyFilter, setSelectedCompanyFilter] = React.useState<string>("all");
  const [selectedMomentumFilter, setSelectedMomentumFilter] = React.useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<string>("all");
  const [timelineSignalFilter, setTimelineSignalFilter] = React.useState<string>("all");

  const loadTrends = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendsRes, compsRes] = await Promise.all([
        fetchTrends({ limit: 50 }),
        fetchTrackedCompanies(),
      ]);
      const list = trendsRes.trends || [];
      setTrends(list);
      setCompanies(compsRes || []);

      if (list.length > 0 && !selectedTrendId) {
        setSelectedTrendId(list[0].cluster_id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load trend dynamics");
    } finally {
      setLoading(false);
    }
  }, [selectedTrendId]);

  React.useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  // Load trend detail on selection
  React.useEffect(() => {
    if (!selectedTrendId) {
      setTrendDetail(null);
      return;
    }
    let isCancelled = false;
    setLoadingDetail(true);

    fetchTrendDetail(selectedTrendId)
      .then((detail) => {
        if (!isCancelled) {
          setTrendDetail(detail);
        }
      })
      .catch((err) => {
        console.error("Failed to load trend detail:", err);
      })
      .finally(() => {
        if (!isCancelled) setLoadingDetail(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedTrendId]);

  // Filter trends list
  const filteredTrends = React.useMemo(() => {
    return trends.filter((t) => {
      if (selectedCompanyFilter !== "all") {
        const matchesComp = t.companies_involved.some((c) =>
          c.toLowerCase().includes(selectedCompanyFilter.toLowerCase())
        );
        if (!matchesComp) return false;
      }
      if (selectedMomentumFilter !== "all") {
        if (t.momentum.label !== selectedMomentumFilter) return false;
      }
      if (selectedTypeFilter !== "all") {
        if (t.cluster_type !== selectedTypeFilter) return false;
      }
      return true;
    });
  }, [trends, selectedCompanyFilter, selectedMomentumFilter, selectedTypeFilter]);

  // KPI Metrics Computed
  const kpis = React.useMemo(() => {
    const totalCount = trends.length;
    const surgingCount = trends.filter(
      (t) => t.momentum.label === "surging" || t.momentum.label === "building"
    ).length;
    const crossCompanyCount = trends.filter(
      (t) => t.cluster_type === "cross_company_trend"
    ).length;
    const allInvolved = new Set<string>();
    trends.forEach((t) => t.companies_involved.forEach((c) => allInvolved.add(c)));
    return {
      totalCount,
      surgingCount,
      crossCompanyCount,
      companiesCount: allInvolved.size,
    };
  }, [trends]);

  // Momentum badge helper
  const getMomentumBadge = (momentum: { label: string; vector: [number, number, number] }) => {
    const { label, vector } = momentum;
    let colorCls = "bg-zinc-100 text-zinc-700 border-zinc-200";
    if (label === "surging") colorCls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (label === "building") colorCls = "bg-blue-50 text-blue-700 border-blue-200";
    else if (label === "fading") colorCls = "bg-amber-50 text-amber-700 border-amber-200";
    else if (label === "transient") colorCls = "bg-purple-50 text-purple-700 border-purple-200";

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorCls}`}>
        <span className="capitalize">{label.replace(/_/g, " ")}</span>
        <span className="text-[10px] opacity-75 font-mono">[{vector.join(",")}]</span>
      </span>
    );
  };

  // Signal badge helper
  const getSignalBadge = (signalType: string) => {
    const st = signalType.toLowerCase();
    if (st.includes("github")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
          <GitBranch className="w-3 h-3" /> GitHub
        </span>
      );
    }
    if (st.includes("research")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-medium border border-purple-200">
          <Sparkles className="w-3 h-3" /> Research
        </span>
      );
    }
    if (st.includes("hiring") || st.includes("job")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] font-medium border border-amber-200">
          <Briefcase className="w-3 h-3" /> Hiring
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-[11px] font-medium border border-sky-200">
        <Newspaper className="w-3 h-3" /> News
      </span>
    );
  };

  // Swimlanes grouped by company and filtered by signal type
  const swimlanes = React.useMemo(() => {
    if (!trendDetail) return [];
    const map: Record<string, TimelineNode[]> = {};
    trendDetail.companies_involved.forEach((comp) => {
      map[comp] = [];
    });
    trendDetail.timeline.forEach((node) => {
      const comp = node.company || "Other";
      if (!map[comp]) map[comp] = [];
      if (
        timelineSignalFilter === "all" ||
        node.signal_type.toLowerCase().includes(timelineSignalFilter.toLowerCase())
      ) {
        map[comp].push(node);
      }
    });
    return Object.entries(map).map(([comp, nodes]) => ({
      company: comp,
      nodes: nodes.sort(
        (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
      ),
    }));
  }, [trendDetail, timelineSignalFilter]);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Cross-Company Trend Evolution
          </div>
          <h1 className="app-title-lg">
            Market Signals & Storylines for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Autonomous multi-week storylines derived strictly from validated signals across news, GitHub, research, and hiring surges.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadTrends}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Trends</span>
        </PrismButton>
      </div>

      {/* Top KPI Summary Metrics Bar */}
      {trends.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Total Storylines
              </span>
              <Layers className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900">{kpis.totalCount}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Clustered & tracked</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                High Velocity
              </span>
              <Flame className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{kpis.surgingCount}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Surging or building</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Cross-Company Waves
              </span>
              <Activity className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600">{kpis.crossCompanyCount}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Multi-competitor shifts</div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Competitors Monitored
              </span>
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900">{kpis.companiesCount}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Active across storylines</div>
          </div>
        </div>
      )}

      {loading ? (
        <PrismLoadingSkeleton count={3} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Compute Trends"
          description={error}
          actionText="Retry"
          onAction={loadTrends}
        />
      ) : trends.length === 0 ? (
        <PrismEmptyState
          icon={<TrendingUp className="w-6 h-6" />}
          title="No Active Trend Storylines"
          description={`PrismIQ has not yet detected multi-event storylines for ${targetCompany}. Nightly intelligence runs will automatically cluster and evolve trends.`}
          actionText="Trigger Intelligence Sweep"
          actionHref="/app"
        />
      ) : (
        <div className="space-y-8">
          {/* Controls & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-[rgba(20,20,30,0.07)] rounded-xl shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 pr-2 border-r border-zinc-200">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Company Filter */}
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c.company_name} value={c.company_name}>
                  {c.company_name}
                </option>
              ))}
            </select>

            {/* Momentum Filter */}
            <select
              value={selectedMomentumFilter}
              onChange={(e) => setSelectedMomentumFilter(e.target.value)}
              className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Momentum</option>
              <option value="surging">Surging [Week 3 Peak]</option>
              <option value="building">Building [Week 2 &gt; 1]</option>
              <option value="fading">Fading [Inactive W3]</option>
              <option value="stable">Stable [Continuous]</option>
              <option value="transient">Transient [Single Event]</option>
            </select>

            {/* Type Filter */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Storyline Types</option>
              <option value="cross_company_trend">Cross-Company Trends</option>
              <option value="single_company_storyline">Single-Company Storylines</option>
            </select>

            <div className="ml-auto text-xs text-zinc-500 font-medium">
              Showing {filteredTrends.length} of {trends.length} Storylines
            </div>
          </div>

          {/* Main Grid: Left Trend Cards, Right Swimlane Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Trend Cards Column */}
            <div className="lg:col-span-4 space-y-3 max-h-[820px] overflow-y-auto pr-1">
              {filteredTrends.map((t) => {
                const isSelected = t.cluster_id === selectedTrendId;
                return (
                  <div
                    key={t.cluster_id}
                    onClick={() => setSelectedTrendId(t.cluster_id)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all text-left ${
                      isSelected
                        ? "bg-white border-[#6e57dc] shadow-md ring-1 ring-[#6e57dc]"
                        : "bg-white/80 border-[rgba(20,20,30,0.07)] hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                        {t.cluster_id}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <MomentumSparkline vector={t.momentum.vector} label={t.momentum.label} />
                        {getMomentumBadge(t.momentum)}
                      </div>
                    </div>

                    <h3 className="font-semibold text-sm text-zinc-900 line-clamp-2 mb-2">
                      {t.representative_title}
                    </h3>

                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                      {t.companies_involved.map((comp) => (
                        <span
                          key={comp}
                          className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[11px] font-semibold"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>

                    {/* Signal proportion bar */}
                    <div className="mb-2.5">
                      <SignalMixBar breakdown={t.signal_breakdown} />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-500 font-medium">
                      <span>{t.distinct_story_count} Distinct Stories</span>
                      <span className="capitalize text-zinc-400">
                        {t.cluster_type.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Swimlane Timeline & Details */}
            <div className="lg:col-span-8 space-y-6">
              {loadingDetail ? (
                <PrismLoadingSkeleton count={2} />
              ) : !trendDetail ? (
                <PrismCard className="p-8 text-center text-zinc-400">
                  Select a trend storyline to inspect chronological swimlanes.
                </PrismCard>
              ) : (
                <div className="space-y-6">
                  {/* Trend Detail Header Card */}
                  <PrismCard className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                            {trendDetail.cluster_type === "cross_company_trend"
                              ? "Cross-Company Trend"
                              : "Single-Company Storyline"}
                          </span>
                          <MomentumSparkline
                            vector={trendDetail.momentum.vector}
                            label={trendDetail.momentum.label}
                          />
                          {getMomentumBadge(trendDetail.momentum)}
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900 leading-snug">
                          {trendDetail.representative_title}
                        </h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                      <div>
                        <span className="text-zinc-400 block font-medium">Distinct Stories</span>
                        <span className="font-bold text-zinc-800 text-sm">
                          {trendDetail.distinct_story_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-medium">Raw Signals</span>
                        <span className="font-bold text-zinc-800 text-sm">
                          {trendDetail.raw_event_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-medium">Relevance Score</span>
                        <span className="font-bold text-zinc-800 text-sm">
                          {Math.round(trendDetail.relevance_score * 100)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-medium">Primary Focus</span>
                        <span className="font-bold text-zinc-800 text-sm">
                          {trendDetail.primary_category || "Technology"}
                        </span>
                      </div>
                    </div>
                  </PrismCard>

                  {/* Horizontal Swimlane Timeline Card */}
                  <PrismCard className="p-6 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                      <div>
                        <h3 className="app-title-sm">Storyline Chronology (Swimlanes)</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Chronological sequence grouped by corporate group. Click any node to open verified Evidence Ledger.
                        </p>
                      </div>

                      {/* Source Legend & Filter */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {["all", "news", "research", "github", "hiring"].map((st) => (
                          <button
                            key={st}
                            onClick={() => setTimelineSignalFilter(st)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                              timelineSignalFilter === st
                                ? "bg-zinc-900 text-white shadow-2xs"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                            }`}
                          >
                            {st === "all" ? "All Sources" : st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Swimlanes Container */}
                    <div className="space-y-6">
                      {swimlanes.map((lane) => (
                        <div key={lane.company} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-zinc-800 px-2 py-0.5 bg-zinc-100 rounded">
                              {lane.company}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-medium">
                              ({lane.nodes.length} events)
                            </span>
                          </div>

                          {/* Node Row */}
                          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1">
                            {lane.nodes.map((node, idx) => (
                              <div
                                key={node.event_id || idx}
                                onClick={() =>
                                  openEvidence({
                                    company_name: node.company || lane.company,
                                    title: node.title,
                                    why_it_matters: `Cross-company storyline event (${
                                      node.node_class === "first_party"
                                        ? "1st Party Direct Announcement"
                                        : "3rd Party Corroboration"
                                    }). Grounded in validated market signals.`,
                                    raw_excerpt: node.title,
                                    url: node.source_url,
                                    source: node.signal_type,
                                    published_at: node.published_at,
                                    confidence: "High",
                                    tier: "Must-Know",
                                  })
                                }
                                className="min-w-[280px] max-w-[320px] bg-zinc-50/80 hover:bg-white border border-zinc-200/80 hover:border-[#6e57dc] rounded-xl p-3.5 transition-all shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between group"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-2">
                                    {getSignalBadge(node.signal_type)}
                                    <span className="text-[10px] font-semibold text-zinc-400 font-mono">
                                      {node.node_class === "first_party" ? "1st Party" : "3rd Party"}
                                    </span>
                                  </div>

                                  <h4 className="text-xs font-semibold text-zinc-900 group-hover:text-indigo-600 line-clamp-3 leading-snug mb-2 transition-colors">
                                    {node.title}
                                  </h4>
                                </div>

                                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                                  <span>{node.published_at ? node.published_at.slice(0, 10) : "Undated"}</span>
                                  <span className="inline-flex items-center gap-0.5 text-[#6e57dc] group-hover:underline font-semibold">
                                    <span>Evidence</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </PrismCard>

                  {/* Audited Absences Section */}
                  {trendDetail.audited_absences && trendDetail.audited_absences.length > 0 && (
                    <PrismCard className="p-6 border-dashed">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-4 h-4 text-zinc-500" />
                        <h3 className="app-title-sm text-zinc-700">Audited Absence Log</h3>
                      </div>
                      <p className="text-xs text-zinc-500 mb-4">
                        Explicit verification of tracked competitors with zero activity in this storyline window.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {trendDetail.audited_absences.map((abs) => (
                          <div
                            key={abs.company}
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs"
                          >
                            <span className="font-semibold text-zinc-700">{abs.company}</span>
                            <span className="text-zinc-500 text-[11px] font-mono">{abs.audit_note}</span>
                          </div>
                        ))}
                      </div>
                    </PrismCard>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
