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
  Workflow,
  Calendar,
  Layers,
  ArrowRight,
  Target,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  ChevronRight,
  Filter,
  AlertCircle,
  Building2,
  Activity,
  Flame,
  Search,
  PieChart,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  PrismDonutChart,
  PrismHorizontalBarChart,
  PrismLineChart,
} from "@/components/ui/VisualCharts";
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
  fetchCompetitiveSequences,
  fetchSignalCorrelations,
  type TrendRecord,
  type TrendDetailRecord,
  type TimelineNode,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type TrackedCompany,
  type CompetitiveSequenceRecord,
  type SequenceStep,
  type SignalCorrelationRecord,
  type CorrelatedSignalNode,
} from "@/lib/api";

const DIMENSION_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  hiring: {
    bg: "bg-blue-50/70",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Hiring Signal",
  },
  compliance: {
    bg: "bg-emerald-50/70",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Compliance & Security",
  },
  pricing: {
    bg: "bg-amber-50/70",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Pricing Structure",
  },
  proof: {
    bg: "bg-purple-50/70",
    text: "text-purple-700",
    border: "border-purple-200",
    label: "Case Study / Proof",
  },
  go_to_market: {
    bg: "bg-indigo-50/70",
    text: "text-indigo-700",
    border: "border-indigo-200",
    label: "GTM / Field Sales",
  },
  partnerships: {
    bg: "bg-cyan-50/70",
    text: "text-cyan-700",
    border: "border-cyan-200",
    label: "Strategic Alliance",
  },
  product: {
    bg: "bg-violet-50/70",
    text: "text-violet-700",
    border: "border-violet-200",
    label: "Product Infrastructure",
  },
  infrastructure: {
    bg: "bg-teal-50/70",
    text: "text-teal-700",
    border: "border-teal-200",
    label: "Core Infrastructure",
  },
  margin_disruption: {
    bg: "bg-rose-50/70",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Disruption Vector",
  },
};

const CORRELATION_CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ai_investment: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    label: "AI Investment & Platform Shift",
  },
  enterprise_shift: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Enterprise Market & Compliance",
  },
  cloud_margin: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Cloud Margin & Bandwidth Disruption",
  },
  cloud_infrastructure: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Infrastructure Baseload & Compute",
  },
  mobile_logistics: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Merchant App & Logistics Tier",
  },
};

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
  const [sequences, setSequences] = React.useState<CompetitiveSequenceRecord[]>([]);
  const [selectedSequenceCompany, setSelectedSequenceCompany] = React.useState<string>("ALL");
  const [activeStepIndices, setActiveStepIndices] = React.useState<Record<string, number>>({});
  const [correlations, setCorrelations] = React.useState<SignalCorrelationRecord[]>([]);
  const [selectedCorrelationCompany, setSelectedCorrelationCompany] = React.useState<string>("ALL");
  const [activeSignalIndices, setActiveSignalIndices] = React.useState<Record<string, number>>({});
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
      const [trendsRes, compsRes, seqRes, corrRes] = await Promise.all([
        fetchTrends({ limit: 50 }),
        fetchTrackedCompanies(),
        fetchCompetitiveSequences().catch(() => ({ sequences: [], count: 0, filter: "ALL" })),
        fetchSignalCorrelations().catch(() => ({ correlations: [], count: 0, filter: "ALL" })),
      ]);
      const list = trendsRes.trends || [];
      setTrends(list);
      setCompanies(compsRes || []);
      setSequences(seqRes.sequences || []);
      setCorrelations(corrRes.correlations || []);

      const initialSignalMap: Record<string, number> = {};
      (corrRes.correlations || []).forEach((c) => {
        initialSignalMap[c.id] = 0;
      });
      setActiveSignalIndices(initialSignalMap);

      // Default active step to the final step of each sequence
      const initialStepMap: Record<string, number> = {};
      (seqRes.sequences || []).forEach((seq) => {
        initialStepMap[seq.id] = (seq.sequence_steps?.length || 1) - 1;
      });
      setActiveStepIndices(initialStepMap);

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

  // Visual Analytics for Trends (from actual live trend clusters)
  const trendVelocityPoints = React.useMemo(() => {
    const top4 = [...trends]
      .sort((a, b) => b.distinct_story_count - a.distinct_story_count)
      .slice(0, 4);

    if (top4.length === 0) return [];

    return [
      {
        label: "2 Wks Ago",
        ...Object.fromEntries(top4.map((t) => [t.cluster_id, t.momentum.vector[0] || 0])),
      },
      {
        label: "1 Wk Ago",
        ...Object.fromEntries(top4.map((t) => [t.cluster_id, t.momentum.vector[1] || 0])),
      },
      {
        label: "Current Week",
        ...Object.fromEntries(top4.map((t) => [t.cluster_id, t.momentum.vector[2] || 0])),
      },
    ];
  }, [trends]);

  const trendVelocitySeries = React.useMemo(() => {
    const colors = ["#8b5cf6", "#0ea5e9", "#10b981", "#f43f5e"];
    return [...trends]
      .sort((a, b) => b.distinct_story_count - a.distinct_story_count)
      .slice(0, 4)
      .map((t, idx) => {
        const title = t.representative_title || t.trend_name || t.cluster_id;
        return {
          key: t.cluster_id,
          name: title.length > 25 ? title.slice(0, 22) + "..." : title,
          color: colors[idx % colors.length],
        };
      });
  }, [trends]);

  const momentumLifecycleDonut = React.useMemo(() => {
    const counts = { surging: 0, building: 0, fading: 0, transient: 0, too_early: 0 };
    trends.forEach((t) => {
      const l = t.momentum.label;
      if (l === "surging") counts.surging++;
      else if (l === "building") counts.building++;
      else if (l === "fading") counts.fading++;
      else if (l === "transient") counts.transient++;
      else counts.too_early++;
    });

    return [
      { label: "Surging / Rapid", value: counts.surging, color: "#10b981" },
      { label: "Building / Gaining", value: counts.building, color: "#3b82f6" },
      { label: "Fading / Maturing", value: counts.fading, color: "#f59e0b" },
      { label: "Transient / Early", value: counts.transient + counts.too_early, color: "#8b5cf6" },
    ].filter((d) => d.value > 0);
  }, [trends]);

  const competitorStorylineBars = React.useMemo(() => {
    const compCounts: Record<string, number> = {};
    trends.forEach((t) => {
      t.companies_involved.forEach((comp) => {
        compCounts[comp] = (compCounts[comp] || 0) + 1;
      });
    });

    return Object.entries(compCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([comp, cnt]) => ({
        label: comp,
        value: cnt,
        badge: comp.toLowerCase() === (targetCompany || "").toLowerCase() ? "Target" : undefined,
        secondaryText: `${cnt} storyline${cnt !== 1 ? "s" : ""}`,
        color: comp.toLowerCase() === (targetCompany || "").toLowerCase() ? "#6e57dc" : "#0284c7",
      }));
  }, [trends, targetCompany]);

  const trendSignalMixDonut = React.useMemo(() => {
    const mix: Record<string, number> = { news: 0, research: 0, github: 0, hiring: 0, pricing: 0 };
    trends.forEach((t) => {
      if (t.signal_breakdown) {
        Object.entries(t.signal_breakdown).forEach(([k, v]) => {
          const lk = k.toLowerCase();
          if (lk.includes("news")) mix.news += v;
          else if (lk.includes("research")) mix.research += v;
          else if (lk.includes("git")) mix.github += v;
          else if (lk.includes("hir") || lk.includes("job")) mix.hiring += v;
          else if (lk.includes("pric")) mix.pricing += v;
        });
      }
    });

    return [
      { label: "News & Media", value: mix.news, color: "#0ea5e9" },
      { label: "Research Disclosures", value: mix.research, color: "#8b5cf6" },
      { label: "Code & Repositories", value: mix.github, color: "#10b981" },
      { label: "Hiring Openings", value: mix.hiring, color: "#f59e0b" },
      { label: "Pricing Adjustments", value: mix.pricing, color: "#ec4899" },
    ].filter((d) => d.value > 0);
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

  // Unique companies with detected sequences
  const sequenceCompanies = React.useMemo(() => {
    const set = new Set<string>();
    sequences.forEach((s) => set.add(s.company_name));
    return Array.from(set);
  }, [sequences]);

  // Filtered sequences based on user tab selection
  const filteredSequences = React.useMemo(() => {
    if (selectedSequenceCompany === "ALL") return sequences;
    return sequences.filter(
      (s) => s.company_name.toLowerCase() === selectedSequenceCompany.toLowerCase()
    );
  }, [sequences, selectedSequenceCompany]);

  const correlationCompanies = React.useMemo(() => {
    const set = new Set<string>();
    correlations.forEach((c) => set.add(c.company_name));
    return Array.from(set).sort();
  }, [correlations]);

  const filteredCorrelations = React.useMemo(() => {
    if (selectedCorrelationCompany === "ALL") return correlations;
    return correlations.filter(
      (c) => c.company_name.toLowerCase() === selectedCorrelationCompany.toLowerCase()
    );
  }, [correlations, selectedCorrelationCompany]);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Cross-Company Trend Evolution & Historical Memory
          </div>
          <h1 className="app-title-lg">
            Market Signals & Storylines for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Derived cross-company trends, momentum vectors, and multi-month sequence detection calculated from corroborated signals across hiring, compliance, pricing, proof, and strategic partnerships.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadTrends}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Intelligence</span>
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

      {/* Visual Analytics: Longitudinal Trend Velocity & Storyline Wave Dynamics */}
      {!loading && !error && trends.length > 0 && (
        <div className="space-y-4">
          <PrismSectionHeader
            title="Longitudinal Trend Velocity & Storyline Dynamics"
            subtitle="Trajectory curves across multi-week velocity vectors, momentum lifecycles, and competitor storyline exposure."
            eyebrow="Trend Visual Analytics"
            action={
              <div className="flex items-center gap-2 text-xs font-semibold text-[#70717a]">
                <TrendingUp className="w-3.5 h-3.5 text-[#6e57dc]" />
                <span>3-Week Acceleration Vectors</span>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart 1: 3-Week Multi-Storyline Velocity Trajectory (Line Chart) */}
            <PrismCard className="p-5">
              <div className="pb-3 border-b border-[rgba(20,20,30,0.06)] mb-3">
                <h3 className="text-sm font-bold text-[#17171b]">3-Week Storyline Velocity Trajectories</h3>
                <p className="text-[11px] text-[#70717a] mt-0.5">Tracking velocity progression over W-2, W-1, and Current Week</p>
              </div>

              {trendVelocityPoints.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#9ca3af]">No multi-week trajectory data</div>
              ) : (
                <PrismLineChart
                  points={trendVelocityPoints}
                  series={trendVelocitySeries}
                  height={190}
                />
              )}
            </PrismCard>

            {/* Chart 2: Storyline Momentum Lifecycle Split (Donut Chart) */}
            <PrismCard className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#17171b]">Momentum Lifecycle Distribution</h3>
                  <p className="text-[11px] text-[#70717a] mt-0.5">Surging, Building, Fading, and Transient market storylines</p>
                </div>
                <span className="app-pill bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  {trends.length} Storylines
                </span>
              </div>

              {momentumLifecycleDonut.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#9ca3af]">No momentum lifecycle data</div>
              ) : (
                <PrismDonutChart
                  data={momentumLifecycleDonut}
                  centerLabel="Storylines"
                  centerValue={trends.length}
                  size={180}
                  thickness={22}
                />
              )}
            </PrismCard>

            {/* Chart 3: Competitor Storyline Engagement (Horizontal Bar Chart) */}
            <PrismCard className="p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#17171b]">Competitor Storyline Exposure</h3>
                  <p className="text-[11px] text-[#70717a] mt-0.5">Number of evolving market storylines involving each competitor</p>
                </div>
                <span className="app-pill bg-purple-50 text-[#6e57dc] text-[10px] font-bold">
                  Storyline Drivers
                </span>
              </div>

              {competitorStorylineBars.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#9ca3af]">No competitor involvement recorded</div>
              ) : (
                <PrismHorizontalBarChart
                  items={competitorStorylineBars}
                />
              )}
            </PrismCard>

            {/* Chart 4: Evidence Channel Distribution fueling trends (Donut Chart) */}
            <PrismCard className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#17171b]">Trend Evidence Channel Mix</h3>
                  <p className="text-[11px] text-[#70717a] mt-0.5">Corroborating signal sources fueling active trend clusters</p>
                </div>
                <span className="app-pill bg-sky-50 text-sky-700 text-[10px] font-bold">
                  Multi-Source
                </span>
              </div>

              {trendSignalMixDonut.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#9ca3af]">No signal breakdown available</div>
              ) : (
                <PrismDonutChart
                  data={trendSignalMixDonut}
                  centerLabel="Signals"
                  size={180}
                  thickness={22}
                />
              )}
            </PrismCard>
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
      ) : (
        <div className="space-y-12">
          {/* ========================================================================= */}
          {/* POINT 2: HISTORICAL COMPETITIVE MEMORY & MULTI-MONTH SEQUENCE DETECTION */}
          {/* ========================================================================= */}
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#6e57dc]/10 text-[#6e57dc] border border-[#6e57dc]/20">
                    <Workflow className="w-3.5 h-3.5" />
                    Multi-Month Sequence Detection
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    {sequences.length} Strategic Patterns Detected
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  Historical Competitive Memory Pipeline
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5">
                  PrismIQ connects isolated milestones across months into unified strategic intent
                  (e.g., Hiring → SOC2 → Enterprise Pricing → Case Study → Enterprise Expansion).
                </p>
              </div>

              {/* Competitor filter tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100/90 rounded-lg border border-zinc-200/80 self-start sm:self-auto text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedSequenceCompany("ALL")}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                    selectedSequenceCompany === "ALL"
                      ? "bg-white text-[#17171b] shadow-sm"
                      : "text-[#70717a] hover:text-[#17171b]"
                  }`}
                >
                  All Competitors ({sequences.length})
                </button>
                {sequenceCompanies.map((cname) => (
                  <button
                    key={cname}
                    type="button"
                    onClick={() => setSelectedSequenceCompany(cname)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                      selectedSequenceCompany === cname
                        ? "bg-white text-[#6e57dc] shadow-sm font-bold"
                        : "text-[#70717a] hover:text-[#17171b]"
                    }`}
                  >
                    {cname}
                  </button>
                ))}
              </div>
            </div>

            {/* Sequence Cards List */}
            {filteredSequences.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl">
                <Workflow className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No multi-month sequence detected for this filter</p>
                <p className="text-xs text-zinc-500 mt-1">Select &apos;All Competitors&apos; to view all synthesized patterns.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredSequences.map((seq) => {
                  const activeStepIdx = activeStepIndices[seq.id] ?? (seq.sequence_steps.length - 1);
                  const activeStep: SequenceStep | undefined = seq.sequence_steps[activeStepIdx];
                  const dimStyle = activeStep ? (DIMENSION_STYLES[activeStep.dimension] || {
                    bg: "bg-zinc-100",
                    text: "text-zinc-800",
                    border: "border-zinc-300",
                    label: activeStep.dimension,
                  }) : null;

                  return (
                    <div
                      key={seq.id}
                      className="rounded-2xl border border-[rgba(20,20,30,0.1)] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Top Sequence Header Bar */}
                      <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-50 via-white to-purple-50/20 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <PrismCompanyBadge
                              name={seq.company_name}
                              isTarget={seq.company_name.toLowerCase() === targetCompany.toLowerCase()}
                              size="sm"
                            />
                            <span className="text-xs text-zinc-300">•</span>
                            <span className="text-xs font-semibold text-[#70717a] flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#6e57dc]" />
                              {seq.time_horizon}
                            </span>
                            <span className="text-xs text-zinc-300">•</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100/70 text-purple-800 border border-purple-200">
                              {seq.sequence_steps.length} Verified Milestones
                            </span>
                          </div>

                          <div className="flex flex-wrap items-baseline gap-2 pt-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                              Synthesized Pattern:
                            </span>
                            <h3 className="text-lg sm:text-xl font-extrabold text-[#17171b] tracking-tight">
                              {seq.pattern_name}
                            </h3>
                          </div>
                        </div>

                        {/* Confidence & Impact Pills */}
                        <div className="flex items-center gap-2.5 self-start md:self-auto">
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-extrabold text-emerald-800">
                              {seq.confidence}% Confidence
                            </span>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span className="text-xs font-bold text-rose-800">
                              {seq.potential_impact} Impact
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Milestone Pipeline Track */}
                      <div className="p-5 sm:p-6 bg-zinc-50/50 border-b border-zinc-100">
                        <div className="text-xs font-bold text-[#70717a] uppercase tracking-wider mb-3 flex items-center justify-between">
                          <span>Chronological Multi-Month Sequence</span>
                          <span className="text-[11px] font-normal lowercase text-zinc-400">
                            Click milestone to inspect evidence
                          </span>
                        </div>

                        {/* Pipeline Node Strip */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                          {seq.sequence_steps.map((st, idx) => {
                            const isSelected = idx === activeStepIdx;
                            const isLast = idx === seq.sequence_steps.length - 1;
                            const stepDim = DIMENSION_STYLES[st.dimension] || {
                              bg: "bg-zinc-100",
                              text: "text-zinc-700",
                              border: "border-zinc-300",
                              label: st.dimension,
                            };

                            return (
                              <React.Fragment key={st.step_number}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveStepIndices((prev) => ({ ...prev, [seq.id]: idx }))
                                  }
                                  className={`flex-shrink-0 text-left p-3 rounded-xl border transition-all duration-200 ${
                                    isSelected
                                      ? "bg-white border-[#6e57dc] shadow-md ring-2 ring-[#6e57dc]/20 translate-y-[-2px]"
                                      : "bg-white/80 hover:bg-white border-zinc-200/80 hover:border-zinc-300 shadow-xs"
                                  }`}
                                  style={{ minWidth: "165px", maxWidth: "200px" }}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                                      {st.month}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${stepDim.bg} ${stepDim.text} ${stepDim.border}`}
                                    >
                                      Step {st.step_number}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold text-[#17171b] line-clamp-1 mt-1">
                                    {st.event_title}
                                  </h4>
                                  <div className="text-[10px] text-[#70717a] font-medium mt-1 truncate">
                                    {stepDim.label}
                                  </div>
                                </button>

                                {!isLast && (
                                  <div className="flex-shrink-0 text-zinc-300">
                                    <ArrowRight className="w-4 h-4 text-purple-400" />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {/* Final Pattern Synthesis Outcome Node */}
                          <div className="flex-shrink-0 text-zinc-300">
                            <ArrowRight className="w-4 h-4 text-emerald-500 font-bold" />
                          </div>
                          <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md min-w-[175px]">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-purple-200 flex items-center gap-1">
                              <Target className="w-3 h-3 text-emerald-300" />
                              Pattern Result
                            </div>
                            <div className="text-xs font-extrabold text-white mt-1 line-clamp-1">
                              {seq.pattern_name}
                            </div>
                            <div className="text-[10px] text-emerald-200 font-bold mt-0.5">
                              {seq.confidence}% Pattern Match
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Active Milestone Inspector Drawer */}
                      {activeStep && (
                        <div className="p-5 sm:p-6 bg-white border-b border-zinc-100">
                          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[#6e57dc] text-white flex items-center justify-center text-xs font-bold">
                                  {activeStep.step_number}
                                </span>
                                <h4 className="font-extrabold text-sm sm:text-base text-[#17171b]">
                                  {activeStep.event_title}
                                </h4>
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${dimStyle?.bg} ${dimStyle?.text} ${dimStyle?.border}`}
                                >
                                  {dimStyle?.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs font-semibold text-[#70717a]">
                                <Calendar className="w-3.5 h-3.5 text-[#6e57dc]" />
                                <span>{activeStep.month}</span>
                                <span>•</span>
                                <span className="text-[#6e57dc] font-bold">
                                  {activeStep.signals_count} corroborated signal{activeStep.signals_count > 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>

                            {/* Verbatim quote / proof excerpt */}
                            <div className="p-3 bg-white rounded-lg border border-zinc-200 text-xs text-zinc-700 font-mono leading-relaxed relative">
                              <span className="text-zinc-400 font-serif text-lg leading-none absolute top-2 left-2">
                                &ldquo;
                              </span>
                              <p className="pl-4 italic text-zinc-800">
                                {activeStep.evidence_excerpt}
                              </p>
                            </div>

                            {/* Primary proof link */}
                            {activeStep.evidence_url && (
                              <div className="flex items-center justify-between pt-1 text-xs">
                                <a
                                  href={activeStep.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-bold text-[#6e57dc] hover:text-[#5841cb] hover:underline"
                                >
                                  <span>Verify Primary Source</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <span className="text-[11px] text-zinc-400">
                                  Corroborated by PrismIQ Verification Engine
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Strategic Synthesis & Tactical Counter-Action */}
                      <div className="p-5 sm:p-6 bg-gradient-to-b from-white to-zinc-50/70 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            Strategic Interpretation
                          </div>
                          <p className="text-xs text-purple-950 leading-relaxed font-medium">
                            {seq.strategic_interpretation}
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                            <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
                            Recommended Counter-Action
                          </div>
                          <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                            {seq.recommended_action}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* POINT 4: SIGNAL CORRELATION ENGINE & 5-STAGE STRATEGIC IMPLICATION PIPELINE */}
          {/* ========================================================================= */}
          <section className="space-y-5 pt-6 border-t border-[rgba(20,20,30,0.07)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    <Layers className="w-3.5 h-3.5" />
                    Point 4 • 5-Stage Synthesis Pipeline
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    {correlations.length} Correlated Signal Chains
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  Signal Correlation Engine & Strategic Implication Pipeline
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5">
                  Raw telemetry clustered across sources into high-confidence patterns and competitive counter-actions.
                </p>
              </div>

              {/* Correlation competitor filter */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100/90 rounded-lg border border-zinc-200/80 self-start sm:self-auto text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCorrelationCompany("ALL")}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                    selectedCorrelationCompany === "ALL"
                      ? "bg-white text-[#17171b] shadow-sm font-bold"
                      : "text-[#70717a] hover:text-[#17171b]"
                  }`}
                >
                  All ({correlations.length})
                </button>
                {correlationCompanies.map((cname) => (
                  <button
                    key={cname}
                    type="button"
                    onClick={() => setSelectedCorrelationCompany(cname)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                      selectedCorrelationCompany === cname
                        ? "bg-white text-[#6e57dc] shadow-sm font-bold"
                        : "text-[#70717a] hover:text-[#17171b]"
                    }`}
                  >
                    {cname}
                  </button>
                ))}
              </div>
            </div>

            {/* Correlation Cards */}
            {filteredCorrelations.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl">
                <Layers className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No signal correlations match this filter</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredCorrelations.map((corr) => {
                  const activeSigIdx = activeSignalIndices[corr.id] ?? 0;
                  const activeSig: CorrelatedSignalNode | undefined = corr.signals_cluster[activeSigIdx];
                  const catStyle = CORRELATION_CATEGORY_STYLES[corr.correlation_category] || {
                    bg: "bg-purple-50",
                    text: "text-purple-700",
                    border: "border-purple-200",
                    label: corr.correlation_category,
                  };

                  return (
                    <div
                      key={corr.id}
                      className="rounded-2xl border border-[rgba(20,20,30,0.1)] bg-white shadow-xs overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Card Header */}
                      <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-50 via-white to-purple-50/20 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <PrismCompanyBadge
                              name={corr.company_name}
                              isTarget={corr.company_name.toLowerCase() === targetCompany.toLowerCase()}
                              size="sm"
                            />
                            <span className="text-xs text-zinc-300">•</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                              {catStyle.label}
                            </span>
                            <span className="text-xs text-zinc-300">•</span>
                            <span className="text-xs font-semibold text-[#70717a] flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-[#6e57dc]" />
                              {corr.signals_cluster.length} Correlated Signal Sources
                            </span>
                          </div>

                          <h3 className="text-lg sm:text-xl font-extrabold text-[#17171b] tracking-tight pt-1">
                            {corr.pattern_name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2.5 self-start md:self-auto">
                          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#6e57dc]" />
                            <span className="text-xs font-extrabold text-purple-900">
                              {corr.confidence}% Calibrated
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 5-Stage Synthesis Progression Strip */}
                      <div className="px-5 sm:px-6 py-3 bg-zinc-50/80 border-b border-zinc-100 flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mr-2">
                          Pipeline Stage:
                        </span>
                        {["Raw Signals", "Events", "Patterns", "Insights", "Actions"].map((stage, sIdx) => {
                          const isComplete = true;
                          return (
                            <React.Fragment key={stage}>
                              <span
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 ${
                                  stage === "Actions"
                                    ? "bg-zinc-900 text-white shadow-xs"
                                    : "bg-white text-[#17171b] border border-zinc-200"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${stage === "Actions" ? "bg-green-400" : "bg-[#6e57dc]"}`} />
                                {stage}
                              </span>
                              {sIdx < 4 && <ArrowRight className="w-3 h-3 text-zinc-400" />}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Connected Signals Strip */}
                      <div className="p-5 sm:p-6 space-y-4">
                        <div className="space-y-2">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a] flex items-center justify-between">
                            <span>Corroborating Signal Nodes ({corr.signals_cluster.length})</span>
                            <span className="text-zinc-400 font-normal">Select node to inspect evidence proof</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {corr.signals_cluster.map((sig, sIdx) => {
                              const isSelected = sIdx === activeSigIdx;
                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => setActiveSignalIndices((prev) => ({ ...prev, [corr.id]: sIdx }))}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? "bg-[#6e57dc] text-white shadow-xs"
                                      : "bg-zinc-100 hover:bg-zinc-200 text-[#374151]"
                                  }`}
                                >
                                  <span>{sig.signal_type || sig.source}</span>
                                  {sig.weight && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-zinc-200 text-[#70717a]"}`}>
                                      {Math.round(sig.weight * 100)}%
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Active Signal Inspector */}
                        {activeSig && (
                          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-[#17171b]">{activeSig.title}</span>
                              <span className="text-[#70717a] text-[11px]">{activeSig.source}</span>
                            </div>
                            {activeSig.excerpt && (
                              <blockquote className="p-2.5 rounded-lg bg-white border border-zinc-200 text-[#4b5563] italic">
                                &ldquo;{activeSig.excerpt}&rdquo;
                              </blockquote>
                            )}
                            {activeSig.url && (
                              <a
                                href={activeSig.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-[#6e57dc] hover:underline"
                              >
                                View Primary Source Document <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Strategic Implication & Recommended Action */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              Strategic Implication
                            </div>
                            <p className="text-xs text-purple-950 font-medium leading-relaxed">
                              {corr.strategic_implication}
                            </p>
                          </div>

                          <div className="p-4 rounded-xl bg-zinc-900 text-white space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              Recommended Action
                            </div>
                            <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                              {corr.recommended_action}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* TREND EVOLUTION & CROSS-COMPANY STORYLINES */}
          {/* ========================================================================= */}
          <section className="space-y-6 pt-6 border-t border-[rgba(20,20,30,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#6e57dc]/10 text-[#6e57dc] border border-[#6e57dc]/20">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Cross-Company Storylines
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    {trends.length} Active Storylines
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  Trend Evolution Engine
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5">
                  Chronological swimlanes, momentum vectors, and audited competitor absence tracking.
                </p>
              </div>
            </div>

            {trends.length === 0 ? (
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
    </section>
  </div>
)}
</div>
);
}
