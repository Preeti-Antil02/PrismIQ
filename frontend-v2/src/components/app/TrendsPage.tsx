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
} from "lucide-react";
import { useWorkspace } from "./AppShell";
import {
  PrismCard,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismSectionHeader,
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

export function TrendsPage() {
  const { targetCompany } = useWorkspace();

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
        <span className="capitalize">{label}</span>
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

  // Swimlanes grouped by company
  const swimlanes = React.useMemo(() => {
    if (!trendDetail) return [];
    const map: Record<string, TimelineNode[]> = {};
    trendDetail.companies_involved.forEach((comp) => {
      map[comp] = [];
    });
    trendDetail.timeline.forEach((node) => {
      const comp = node.company || "Other";
      if (!map[comp]) map[comp] = [];
      map[comp].push(node);
    });
    return Object.entries(map).map(([comp, nodes]) => ({
      company: comp,
      nodes: nodes.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()),
    }));
  }, [trendDetail]);

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
                      {getMomentumBadge(t.momentum)}
                    </div>

                    <h3 className="font-semibold text-sm text-zinc-900 line-clamp-2 mb-2">
                      {t.representative_title}
                    </h3>

                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      {t.companies_involved.map((comp) => (
                        <span
                          key={comp}
                          className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[11px] font-semibold"
                        >
                          {comp}
                        </span>
                      ))}
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
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="app-title-sm">Storyline Chronology (Swimlanes)</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Chronological sequence grouped by corporate group with node classification badges.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> News
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block ml-2" /> Research
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ml-2" /> GitHub
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
                                className="min-w-[280px] max-w-[320px] bg-zinc-50/80 hover:bg-white border border-zinc-200/80 hover:border-indigo-300 rounded-xl p-3.5 transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-2">
                                    {getSignalBadge(node.signal_type)}
                                    <span className="text-[10px] font-semibold text-zinc-400 font-mono">
                                      {node.node_class === "first_party" ? "1st Party" : "3rd Party"}
                                    </span>
                                  </div>

                                  <h4 className="text-xs font-semibold text-zinc-900 line-clamp-3 leading-snug mb-2">
                                    {node.title}
                                  </h4>
                                </div>

                                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                                  <span>{node.published_at ? node.published_at.slice(0, 10) : "Undated"}</span>
                                  {node.source_url && (
                                    <a
                                      href={node.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                      <span>Source</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
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
