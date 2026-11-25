"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Star,
  BarChart2,
  TrendingUp,
  Zap,
  ArrowRight,
  Clock,
  Briefcase,
  Box,
  Compass,
  Settings,
  Target,
  BarChart3,
  Handshake,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import { useWorkspace } from "./AppShell";
import {
  fetchOverview,
  type OverviewPayload,
  type OverviewAttentionItem,
  type OverviewNextBestAction,
} from "@/lib/api";
import { CompetitorLogoRender } from "./intelligence/CompetitorIntelligenceDetailView";

// ============================================================================
// 3D Isometric SVG Graphics for Emerging Strategic Patterns (Compact Cockpit)
// ============================================================================

function IsometricTrendGraphic() {
  return (
    <div className="w-14 h-14 shrink-0 select-none pointer-events-none">
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-xs">
        <defs>
          <linearGradient id="barGrad1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="barGrad2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="arrowGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        {/* Step 1 */}
        <path d="M20 75 L35 67 L45 73 L30 81 Z" fill="#7c3aed" />
        <path d="M20 75 L30 81 L30 88 L20 82 Z" fill="#6d28d9" />
        <path d="M45 73 L30 81 L30 88 L45 80 Z" fill="#5b21b6" />

        {/* Step 2 */}
        <path d="M38 60 L53 52 L63 58 L48 66 Z" fill="url(#barGrad1)" />
        <path d="M38 60 L48 66 L48 76 L38 70 Z" fill="#7c3aed" />
        <path d="M63 58 L48 66 L48 76 L63 68 Z" fill="#6d28d9" />

        {/* Step 3 */}
        <path d="M56 45 L71 37 L81 43 L66 51 Z" fill="url(#barGrad2)" />
        <path d="M56 45 L66 51 L66 65 L56 59 Z" fill="#8b5cf6" />
        <path d="M81 43 L66 51 L66 65 L81 57 Z" fill="#7c3aed" />

        {/* Ascending Arrow */}
        <path
          d="M25 65 Q 50 35 78 20"
          stroke="url(#arrowGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <polygon points="78,14 86,20 76,26" fill="#3b82f6" />
      </svg>
    </div>
  );
}

function IsometricRobotGraphic() {
  return (
    <div className="w-14 h-14 shrink-0 select-none pointer-events-none">
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-xs">
        <defs>
          <linearGradient id="botGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#99f6e4" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        {/* Antenna */}
        <circle cx="50" cy="20" r="4" fill="#0d9488" />
        <line x1="50" y1="24" x2="50" y2="34" stroke="#0d9488" strokeWidth="3" />

        {/* Head */}
        <rect x="28" y="34" width="44" height="34" rx="10" fill="url(#botGrad)" />
        {/* Ears */}
        <rect x="22" y="44" width="6" height="14" rx="3" fill="#0f766e" />
        <rect x="72" y="44" width="6" height="14" rx="3" fill="#0f766e" />

        {/* Visor / Screen */}
        <rect x="34" y="42" width="32" height="14" rx="5" fill="#134e4a" />
        {/* Eyes */}
        <circle cx="42" cy="49" r="3" fill="#5eead4" />
        <circle cx="58" cy="49" r="3" fill="#5eead4" />

        {/* Smile */}
        <path d="M44 60 Q 50 64 56 60" stroke="#134e4a" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Body Base */}
        <path d="M38 72 L62 72 L68 84 L32 84 Z" fill="#0d9488" />
      </svg>
    </div>
  );
}

// ============================================================================
// Main OverviewPage Component (Executive Cockpit Layout)
// ============================================================================

export function OverviewPage() {
  const router = useRouter();
  const { targetCompany, tenantId } = useWorkspace();

  const [data, setData] = React.useState<OverviewPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Time range filter
  const [timeRange, setTimeRange] = React.useState<string>("6m");
  const [rangeDropdownOpen, setRangeDropdownOpen] = React.useState(false);

  // Interactive Competitor Filter for Landscape Chart
  const [highlightedCompetitor, setHighlightedCompetitor] = React.useState<string | null>(null);

  // Action execution modal
  const [selectedAction, setSelectedAction] = React.useState<OverviewNextBestAction | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = React.useState<string | null>(null);

  // Fetch real overview data dynamically based on targetCompany
  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchOverview(targetCompany, timeRange, tenantId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetCompany, timeRange, tenantId]);

  const handleConfirmAction = () => {
    if (selectedAction && data) {
      const updatedActions = data.next_best_actions.map((act) =>
        act.id === selectedAction.id
          ? { ...act, status: "In Progress" }
          : act
      );
      setData({ ...data, next_best_actions: updatedActions });
      setActionSuccessMsg(
        `Action "${selectedAction.title}" executed and dispatched to ${selectedAction.department} team!`
      );
      setSelectedAction(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-6 animate-pulse w-full">
        <div className="h-16 bg-white rounded-2xl border border-zinc-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="h-20 bg-white rounded-2xl border border-zinc-200" />
          <div className="h-20 bg-white rounded-2xl border border-zinc-200" />
          <div className="h-20 bg-white rounded-2xl border border-zinc-200" />
          <div className="h-20 bg-white rounded-2xl border border-zinc-200" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 h-64 bg-white rounded-2xl border border-zinc-200" />
          <div className="lg:col-span-5 h-64 bg-white rounded-2xl border border-zinc-200" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 w-full">
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl">
          <p className="font-semibold text-sm">Unable to load executive overview</p>
          <p className="text-xs">{error || "Record not found"}</p>
        </div>
      </div>
    );
  }

  const { metrics, what_deserves_attention, competitive_landscape, emerging_strategic_patterns, next_best_actions } = data;

  return (
    <div className="space-y-4 pb-6 w-full text-[#18181b]">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-8 z-50 bg-[#181829] text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 border border-purple-500/30 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-zinc-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 border border-purple-200/80 rounded-full text-[11px] font-bold text-[#6e57dc]">
            <TrendingUp className="w-3 h-3" />
            <span>{data.headline_badge || "Competitive Intelligence"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
            {data.headline_title || "Competitive Intelligence"}
          </h1>
          <p className="text-xs font-medium text-zinc-500">
            {data.headline_subtitle || "Real-time competitive movements, emerging threats and actionable intelligence."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium bg-white px-3 py-1.5 rounded-xl border border-zinc-200/80 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Last Updated: {data.last_updated}</span>
          </div>

          <Link
            href={`/app/intelligence/${data.what_deserves_attention?.[0]?.id || data.competitive_landscape?.competitors?.[0]?.toLowerCase() || 'overview'}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#6e57dc] hover:bg-[#5842be] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors"
          >
            <span>View Intelligence</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. TOP METRIC CARDS (4 Cards in a Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: Tracked Competitors */}
        <Link
          href="/app/competitors"
          className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#6e57dc] group-hover:scale-105 transition-transform shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{metrics.tracked_competitors.label}</div>
              <div className="text-2xl font-black text-zinc-950 tracking-tight leading-none mt-1 mb-0.5">
                {metrics.tracked_competitors.value}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span>{metrics.tracked_competitors.delta}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors shrink-0" />
        </Link>

        {/* Card 2: Verified Events */}
        <Link
          href="/app/events"
          className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{metrics.verified_events.label}</div>
              <div className="text-2xl font-black text-zinc-950 tracking-tight leading-none mt-1 mb-0.5">
                {metrics.verified_events.value}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span>{metrics.verified_events.delta}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors shrink-0" />
        </Link>

        {/* Card 3: High-Priority Developments */}
        <Link
          href="/app/signals"
          className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{metrics.high_priority_developments.label}</div>
              <div className="text-2xl font-black text-zinc-950 tracking-tight leading-none mt-1 mb-0.5">
                {metrics.high_priority_developments.value}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <span>{metrics.high_priority_developments.delta}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors shrink-0" />
        </Link>

        {/* Card 4: Pending Actions */}
        <Link
          href="/app/actions"
          className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{metrics.pending_actions.label}</div>
              <div className="text-2xl font-black text-zinc-950 tracking-tight leading-none mt-1 mb-0.5">
                {metrics.pending_actions.value}
              </div>
              <div className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
                <span>{metrics.pending_actions.delta}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors shrink-0" />
        </Link>
      </div>

      {/* 3. ROW 2: What Deserves Attention (7 Cols) & Competitive Landscape (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: What Deserves Attention */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 mb-2">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-purple-600 fill-purple-600" />
              <h2 className="text-sm sm:text-base font-extrabold text-zinc-950">What Deserves Attention</h2>
            </div>
            <Link
              href="/app/events"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {what_deserves_attention && what_deserves_attention.length > 0 ? (
            <div className="divide-y divide-zinc-100 flex-1 flex flex-col justify-around">
              {what_deserves_attention.map((item) => {
                const impactBg =
                  item.impact_level === "High"
                    ? "bg-rose-50 text-rose-700 border-rose-200/80"
                    : item.impact_level === "Medium"
                    ? "bg-amber-50 text-amber-800 border-amber-200/80"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200/80";

                const deptIcon =
                  item.department === "Sales" ? (
                    <Briefcase className="w-3 h-3 text-zinc-500" />
                  ) : item.department === "Product" ? (
                    <Box className="w-3 h-3 text-zinc-500" />
                  ) : item.department === "Strategy" ? (
                    <Compass className="w-3 h-3 text-zinc-500" />
                  ) : (
                    <Settings className="w-3 h-3 text-zinc-500" />
                  );

                return (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 group min-w-0"
                  >
                    {/* Left: Logo & Headline (min-w-0 prevents flex blowout) */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-14 h-9 rounded-lg bg-white border border-zinc-200/80 flex items-center justify-center p-1 shrink-0 shadow-2xs">
                        <CompetitorLogoRender name={item.competitor} className="w-full h-full object-contain" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h3 className="text-xs sm:text-[13px] font-bold text-zinc-950 group-hover:text-[#6e57dc] transition-colors leading-tight truncate">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-zinc-500 leading-normal font-normal truncate">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Right: Badges & View Details */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${impactBg}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {item.impact}
                      </span>

                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                        {deptIcon}
                        {item.department}
                      </span>

                      <Link
                        href={`/app/intelligence/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 hover:bg-purple-50 text-zinc-700 hover:text-[#6e57dc] text-[11px] font-bold rounded-lg border border-zinc-200 hover:border-purple-200 transition-colors shadow-2xs"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center p-4 bg-zinc-50/60 rounded-xl border border-dashed border-zinc-200">
              <ShieldCheck className="w-6 h-6 text-zinc-300 mb-1" />
              <p className="text-xs font-bold text-zinc-700">No verified developments detected</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mt-0.5">
                PrismIQ surveillance is continuously monitoring competitor filings and market signals.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Competitive Landscape */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 mb-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-950">Competitive Landscape</h2>
              </div>

              <div className="relative">
                <button
                  onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 transition-colors"
                >
                  <span>{timeRange === "6m" ? "Last 6 Months" : timeRange === "30d" ? "Last 30 Days" : "Last 90 Days"}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>
                {rangeDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-zinc-200 rounded-xl shadow-xl z-20 py-1 text-xs">
                    <button
                      onClick={() => {
                        setTimeRange("6m");
                        setRangeDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-purple-50 text-zinc-700 font-semibold"
                    >
                      Last 6 Months
                    </button>
                    <button
                      onClick={() => {
                        setTimeRange("30d");
                        setRangeDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-purple-50 text-zinc-700 font-semibold"
                    >
                      Last 30 Days
                    </button>
                    <button
                      onClick={() => {
                        setTimeRange("90d");
                        setRangeDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-purple-50 text-zinc-700 font-semibold"
                    >
                      Last 90 Days
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Competitor Legend with Click-to-Filter */}
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold pt-0.5 pb-2">
              {competitive_landscape.competitors.map((comp) => {
                const isSelected = highlightedCompetitor === comp;
                const isDimmed = highlightedCompetitor && !isSelected;
                return (
                  <button
                    key={comp}
                    onClick={() => setHighlightedCompetitor(isSelected ? null : comp)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-zinc-600 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-purple-100/70 font-bold text-purple-900 shadow-2xs"
                        : isDimmed
                        ? "opacity-35"
                        : "hover:bg-zinc-100"
                    }`}
                    title={isSelected ? "Click to clear filter" : `Click to filter ${comp}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: competitive_landscape.colors[comp] || "#6e57dc" }}
                    />
                    <span className="text-[11px]">{comp}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Compact Bar Chart (Fixed Height to prevent void) */}
          {competitive_landscape.chart_data && competitive_landscape.chart_data.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="relative h-44 sm:h-48 flex items-end justify-between gap-1.5 border-b border-zinc-200 px-2 pb-1">
                {(() => {
                  const maxVal = Math.max(
                    ...competitive_landscape.chart_data.flatMap((d) =>
                      competitive_landscape.competitors.map((c) => Number(d[c]) || 0)
                    ),
                    15
                  );
                  const midHigh = Math.round((maxVal * 2) / 3);
                  const midLow = Math.round(maxVal / 3);

                  return (
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none -left-2 pr-2 text-[10px] font-semibold text-zinc-400">
                      <div className="border-b border-zinc-100 w-full flex justify-between">
                        <span>{maxVal}</span>
                      </div>
                      <div className="border-b border-zinc-100 w-full flex justify-between">
                        <span>{midHigh}</span>
                      </div>
                      <div className="border-b border-zinc-100 w-full flex justify-between">
                        <span>{midLow}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>0</span>
                      </div>
                    </div>
                  );
                })()}

                {competitive_landscape.chart_data.map((item, idx) => {
                  const maxVal = Math.max(
                    ...competitive_landscape.chart_data.flatMap((d) =>
                      competitive_landscape.competitors.map((c) => Number(d[c]) || 0)
                    ),
                    15
                  );

                  return (
                    <div key={item.month || idx} className="flex-1 flex flex-col items-center gap-0.5 z-10 h-full justify-end">
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full pb-0.5">
                        {competitive_landscape.competitors.map((comp) => {
                          const val = Number(item[comp]) || 0;
                          const heightPercent = Math.min(100, Math.max(6, Math.round((val / maxVal) * 100)));
                          const color = competitive_landscape.colors[comp] || "#6e57dc";
                          const isSelected = highlightedCompetitor === comp;
                          const isDimmed = highlightedCompetitor && !isSelected;

                          return (
                            <div
                              key={comp}
                              onClick={() => setHighlightedCompetitor(isSelected ? null : comp)}
                              title={`${comp}: ${val} verified events in ${item.month}`}
                              style={{
                                height: `${heightPercent}%`,
                                backgroundColor: color,
                              }}
                              className={`w-2 sm:w-2.5 rounded-t-[3px] transition-all cursor-pointer shadow-2xs ${
                                isDimmed ? "opacity-25" : "opacity-100 hover:brightness-110"
                              } ${isSelected ? "ring-2 ring-purple-400 ring-offset-1" : ""}`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 mt-1">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-44 sm:h-48 flex flex-col items-center justify-center text-center p-4 bg-zinc-50/60 rounded-xl border border-dashed border-zinc-200">
              <BarChart2 className="w-6 h-6 text-zinc-300 mb-1" />
              <p className="text-xs font-bold text-zinc-700">Insufficient historical activity data</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mt-0.5">
                Surveillance pipeline is monitoring movements. Trend will populate as events are verified.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. ROW 3: Emerging Strategic Patterns (7 Cols) & Next Best Actions (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: Emerging Strategic Patterns */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/80 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#6e57dc]" />
              <h2 className="text-sm sm:text-base font-extrabold text-zinc-950">Emerging Strategic Patterns</h2>
            </div>
            <Link
              href="/app/trends"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {emerging_strategic_patterns && emerging_strategic_patterns.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {emerging_strategic_patterns.map((pat) => (
                <div
                  key={pat.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#f9faff] border border-indigo-100/70 hover:border-indigo-300 transition-all flex items-start justify-between gap-2.5 group min-w-0"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        pat.tag_color === "teal"
                          ? "bg-teal-50 text-teal-700 border border-teal-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {pat.tag}
                    </span>

                    <h3 className="text-xs sm:text-[13px] font-bold text-zinc-950 group-hover:text-[#6e57dc] transition-colors leading-snug line-clamp-2">
                      {pat.title}
                    </h3>

                    <div className="text-[11px] font-semibold text-zinc-600 truncate">
                      {pat.companies_text}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium truncate">
                      <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span>
                        {pat.related_events_count} related events • {pat.competitors_count} competitors
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 pt-0.5">
                      {pat.description}
                    </p>
                  </div>

                  {pat.visual_type === "ai_bot" ? (
                    <IsometricRobotGraphic />
                  ) : (
                    <IsometricTrendGraphic />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center p-4 bg-zinc-50/60 rounded-xl border border-dashed border-zinc-200">
              <TrendingUp className="w-6 h-6 text-zinc-300 mb-1" />
              <p className="text-xs font-bold text-zinc-700">No consolidated patterns yet</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mt-0.5">
                Strategic patterns emerge across multiple related competitor events over 30-90 day cycles.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Next Best Actions */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/80 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600 fill-purple-600" />
              <h2 className="text-sm sm:text-base font-extrabold text-zinc-950">Next Best Actions</h2>
            </div>
            <Link
              href="/app/actions"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {next_best_actions && next_best_actions.length > 0 ? (
            <div className="divide-y divide-zinc-100 flex-1 flex flex-col justify-around">
              {next_best_actions.map((act) => {
                const actionIcon =
                  act.icon === "barchart" ? (
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                  ) : act.icon === "handshake" ? (
                    <Handshake className="w-4 h-4 text-purple-600" />
                  ) : (
                    <Target className="w-4 h-4 text-purple-600" />
                  );

                const statusBadgeClass =
                  act.status === "In Progress"
                    ? "bg-purple-100/80 text-purple-800 border-purple-200"
                    : act.status === "Planned"
                    ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                    : "bg-zinc-100 text-zinc-700 border-zinc-200";

                return (
                  <div
                    key={act.id}
                    className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 group cursor-pointer min-w-0"
                    onClick={() => setSelectedAction(act)}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-150 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {actionIcon}
                      </div>
                      <div className="space-y-0.5 truncate min-w-0 flex-1">
                        <h4 className="text-xs sm:text-[13px] font-bold text-zinc-950 truncate group-hover:text-[#6e57dc] transition-colors">
                          {act.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-500 font-medium truncate">
                          <span>{act.department}</span>
                          <span>•</span>
                          <span className="font-semibold text-amber-600">{act.priority}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-zinc-400">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        <span>{act.due_date}</span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}
                      >
                        {act.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center p-4 bg-zinc-50/60 rounded-xl border border-dashed border-zinc-200">
              <Zap className="w-6 h-6 text-zinc-300 mb-1" />
              <p className="text-xs font-bold text-zinc-700">No pending actions</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mt-0.5">
                Action recommendations are generated when high-priority competitor moves occur.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ACTION EXECUTION MODAL */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-zinc-950">
                <Target className="w-5 h-5 text-purple-600" />
                <span>Execute Next Best Action</span>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-zinc-900 leading-snug">
                {selectedAction.title}
              </h3>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Assigned Department:</span>
                  <strong className="text-zinc-900">{selectedAction.department}</strong>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Priority Tier:</span>
                  <strong className="text-amber-600">{selectedAction.priority}</strong>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Target Due Date:</span>
                  <strong className="text-zinc-900">{selectedAction.due_date}</strong>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Current Status:</span>
                  <strong className="text-purple-700">{selectedAction.status}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
              <button
                onClick={() => setSelectedAction(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-4 py-2 bg-[#6e57dc] hover:bg-[#5842be] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Confirm & Dispatch Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
