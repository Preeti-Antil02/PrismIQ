"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  ShieldCheck,
  ClipboardList,
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
// 3D Isometric SVG Graphics for Emerging Strategic Patterns
// ============================================================================

function IsometricTrendGraphic() {
  return (
    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 select-none pointer-events-none">
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-md">
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
    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 select-none pointer-events-none">
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-md">
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
// Main OverviewPage Component
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
    if (selectedAction) {
      setActionSuccessMsg(
        `Action "${selectedAction.title}" executed and queued for ${selectedAction.department} team!`
      );
      setSelectedAction(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
    setActionSuccessMsg(
      `Action "${selectedAction.title}" executed and queued for ${selectedAction.department} team!`
    );
    setSelectedAction(null);
    // Reload actions list
    fetchNextBestActions("ALL", "pending", undefined, tenantId)
      .then((res) => setActions(res.actions || []))
      .catch(() => { });
    setTimeout(() => setActionSuccessMsg(null), 4000);
  }
};

if (loading) {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      <div className="h-20 bg-white rounded-3xl border border-zinc-200" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-28 bg-white rounded-3xl border border-zinc-200" />
        <div className="h-28 bg-white rounded-3xl border border-zinc-200" />
        <div className="h-28 bg-white rounded-3xl border border-zinc-200" />
        <div className="h-28 bg-white rounded-3xl border border-zinc-200" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 h-80 bg-white rounded-3xl border border-zinc-200" />
        <div className="lg:col-span-5 h-80 bg-white rounded-3xl border border-zinc-200" />
      </div>
    </div>
  );
}

if (error || !data) {
  return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl">
        <p className="font-semibold">Unable to load executive overview</p>
        <p className="text-sm">{error || "Record not found"}</p>
      </div>
    </div>
  );
}

const handleGenerateActions = async () => {
  setGeneratingActions(true);
  try {
    await generateNextBestActions(targetCompany || "Meesho", targetCompany || "Our Company", tenantId);
    const res = await fetchNextBestActions("ALL", "pending", undefined, tenantId);
    setActions(res.actions || []);
    setActionSuccessMsg("Generated new Next Best Actions based on latest intelligence signals!");
    setTimeout(() => setActionSuccessMsg(null), 4000);
  } catch (err: any) {
    console.error("Failed to generate actions:", err);
  } finally {
    setGeneratingActions(false);
  }
};

      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200/80 rounded-full text-xs font-bold text-[#6e57dc]">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{data.headline_badge}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
            {data.headline_title}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-zinc-500">
            {data.headline_subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium bg-white px-3.5 py-2 rounded-xl border border-zinc-200/80 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Last Updated: {data.last_updated}</span>
          </div>

          <Link
            href="/app/intelligence/amazon"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#6e57dc] hover:bg-[#5842be] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <span>View Intelligence</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {/* Large Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
          {data.headline_title}
        </h1>
        {/* Subtitle */}
        <p className="text-xs sm:text-sm font-medium text-zinc-500">
          {data.headline_subtitle}
        </p>
      </div>

      {/* 2. TOP METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/app/intelligence/amazon"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#6e57dc] hover:bg-[#5842be] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
        >
          <span>View Intelligence</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>

    {/* ==================================================================== */}
    {/* 2. TOP METRIC CARDS (4 Cards in a Row)                              */}
    {/* ==================================================================== */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Tracked Competitors */}
      <Link
        href="/app/competitors"
        className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs hover:border-purple-300 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100/80 text-[#6e57dc] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-500">
              {metrics.tracked_competitors.label}
              {trackedCompanies.length > 0 && (
                <span className="text-xs font-bold text-emerald-600 inline-flex items-center">
                  Tracked
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500">
                {metrics.tracked_competitors.label}
              </div>
              <div className="text-2xl font-extrabold text-zinc-950 tracking-tight mt-0.5">
                {metrics.tracked_competitors.value}
              </div>
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                <span>↑</span>
                <span>{metrics.tracked_competitors.delta}</span>
              </div>
            </div>
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>{metrics.tracked_competitors.delta}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-purple-600 transition-colors" />
      </Link>

        <Link
          href="/app/events"
          className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs hover:border-blue-300 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500">
                {metrics.verified_events.label}
              </div>
              <div className="text-2xl font-extrabold text-zinc-950 tracking-tight mt-0.5">
                {metrics.verified_events.value}
              </div>
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                <span>↑</span>
                <span>{metrics.verified_events.delta}</span>
              </div>
            </div>
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>{metrics.verified_events.delta}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-blue-600 transition-colors" />
      </Link>

        <Link
          href="/app/intelligence/amazon"
          className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs hover:border-emerald-300 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-2xl font-extrabold text-zinc-950 tracking-tight mt-0.5">
              {metrics.high_priority_developments.value}
            </div>
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>{metrics.high_priority_developments.delta}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-emerald-600 transition-colors" />
      </Link>

        <Link
          href="/app/actions"
          className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs hover:border-amber-300 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500">
                {metrics.pending_actions.label}
              </div>
              <div className="text-2xl font-extrabold text-zinc-950 tracking-tight mt-0.5">
                {metrics.pending_actions.value}
              </div>
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                <span>↑</span>
                <span>{metrics.pending_actions.delta}</span>
              </div>
            </div>
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>{metrics.pending_actions.delta}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-amber-600 transition-colors" />
      </Link>
    </div>

      {/* 3. ROW 2: What Deserves Attention & Competitive Landscape */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-[#6e57dc] fill-[#6e57dc]" />
              <h2 className="text-base font-extrabold text-zinc-950">What Deserves Attention</h2>
            </div>
            <Link
              href="/app/events"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <Link
            href="/app/events"
            className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

          <div className="divide-y divide-zinc-100">
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
                  className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start sm:items-center gap-4 flex-1">
                    <div className="w-16 h-10 rounded-xl bg-zinc-50 border border-zinc-150 flex items-center justify-center p-1.5 shrink-0">
                      <CompetitorLogoRender name={item.competitor} className="w-full h-full object-contain" />
                    </div>

                    <div className="space-y-1 flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-zinc-950 group-hover:text-[#6e57dc] transition-colors leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full border ${impactBg}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {item.impact}
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                      {deptIcon}
                      {item.department}
                    </span>

                    <Link
                      href={`/app/intelligence/${item.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-50 hover:bg-purple-50 text-zinc-700 hover:text-[#6e57dc] text-xs font-bold rounded-xl border border-zinc-200 hover:border-purple-200 transition-colors"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
                );
            })}
          </div>
              </div>

        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-extrabold text-zinc-950">Competitive Landscape</h2>
            </div>

            <div className="relative">
              <button
                onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 transition-colors"
              >
                <span>{timeRange === "6m" ? "Last 6 Months" : timeRange === "30d" ? "Last 30 Days" : "Last 90 Days"}</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>
              {rangeDropdownOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white border border-zinc-200 rounded-2xl shadow-xl z-20 py-1 text-xs">
                  <button
                    onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 transition-colors"
                  >
                    <span>{timeRange === "6m" ? "Last 6 Months" : timeRange === "30d" ? "Last 30 Days" : "Last 90 Days"}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                  {rangeDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-36 bg-white border border-zinc-200 rounded-2xl shadow-xl z-20 py-1 text-xs">
                      <button
                        onClick={() => {
                          setTimeRange("6m");
                          setRangeDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-purple-50 text-zinc-700 font-semibold"
                      >
                        Last 6 Months
                      </button>
                      <button
                        onClick={() => {
                          setTimeRange("30d");
                          setRangeDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-purple-50 text-zinc-700 font-semibold"
                      >
                        Last 30 Days
                      </button>
                      <button
                        onClick={() => {
                          setTimeRange("90d");
                          setRangeDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-purple-50 text-zinc-700 font-semibold"
                      >
                        Last 90 Days
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-semibold">
            {competitive_landscape.competitors.map((comp) => (
              <div key={comp} className="flex items-center gap-1.5 text-zinc-600">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: competitive_landscape.colors[comp] || "#6e57dc" }}
                />
                <span>{comp}</span>
              </div>

          <div className="space-y-3 pt-2">
            <div className="relative h-44 flex items-end justify-between gap-2 border-b border-zinc-200 px-2 pb-1">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none -left-2 pr-2 text-[10px] font-semibold text-zinc-400">
                <div className="border-b border-zinc-100 w-full flex justify-between">
                  <span>15</span>
                </div>
                <div className="border-b border-zinc-100 w-full flex justify-between">
                  <span>10</span>
                </div>
                <div className="border-b border-zinc-100 w-full flex justify-between">
                  <span>5</span>
                </div>
                <div className="flex justify-between">
                  <span>0</span>
                </div>
              </div>

              {competitive_landscape.chart_data.map((item, idx) => (
                <div key={item.month || idx} className="flex-1 flex flex-col items-center gap-1 z-10 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-[82%]">
                    {competitive_landscape.competitors.map((comp) => {
                      const val = item[comp] || 4;
                      const heightPercent = Math.min(100, Math.round((val / 16) * 100));
                      const color = competitive_landscape.colors[comp] || "#6e57dc";

                      return (
                        <div
                          key={comp}
                          title={`${comp}: ${val} events`}
                          style={{ height: `${heightPercent}%`, backgroundColor: color }}
                          className="w-2 sm:w-2.5 rounded-t-md hover:brightness-110 transition-all cursor-pointer"
                        />
                      );
                    })}
                  </div>
                  <span className="text-[11px] font-bold text-zinc-500 mt-1">{item.month}</span>
                </div>
          </div>
        </div>
      </div>

      {/* 4. ROW 3: Emerging Strategic Patterns & Next Best Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#6e57dc]" />
              <h2 className="text-base font-extrabold text-zinc-950">Emerging Strategic Patterns</h2>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {emerging_strategic_patterns.map((pat) => (
              <div
                key={pat.id}
                className="p-5 rounded-3xl bg-[#f9faff] border border-indigo-100/70 hover:border-indigo-300 transition-all flex items-start justify-between gap-3 group"
              >
                <div className="space-y-2 flex-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      pat.tag_color === "teal"
                        ? "bg-teal-50 text-teal-700 border border-teal-200"
                        : "bg-purple-50 text-purple-700 border border-purple-200"
                    }`}
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {pat.visual_type === "ai_bot" ? (
                  <IsometricRobotGraphic />
                ) : (
                  <IsometricTrendGraphic />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600 fill-purple-600" />
              <h2 className="text-base font-extrabold text-zinc-950">Next Best Actions</h2>
            </div>
            <Link
              href="/app/actions"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-100">
            {next_best_actions.map((act) => {
              const actionIcon =
                act.icon === "barchart" ? (
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                ) : act.icon === "handshake" ? (
                  <Handshake className="w-4 h-4 text-purple-600" />
                ) : (
                  <Target className="w-4 h-4 text-purple-600" />
                );

                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                          <FileText className="w-3 h-3 text-zinc-400" />
                          <span>
                            {pat.related_events_count} related events • {pat.competitors_count} competitors
                          </span>
                        </div>

                        <p className="text-xs text-zinc-600 leading-relaxed pt-1">
                          {pat.description}
                        </p>
                      </div>

                      {/* 3D Isometric Art on Right */}
                      {pat.visual_type === "ai_bot" ? (
                        <IsometricRobotGraphic />
                      ) : (
                        <IsometricTrendGraphic />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Next Best Actions (5 Cols) */}
              <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-600 fill-purple-600" />
                    <h2 className="text-base font-extrabold text-zinc-950">Next Best Actions</h2>
                  </div>
                  <Link
                    href="/app/actions"
                    className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

      {/* ACTION EXECUTION MODAL */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-zinc-950">
                <Target className="w-5 h-5 text-purple-600" />
                <span>Execute Next Best Action</span>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

                    const statusBadgeClass =
                      act.status === "In Progress"
                        ? "bg-purple-100/80 text-purple-800 border-purple-200"
                        : act.status === "Planned"
                          ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200";

                    return (
                      <div
                        key={act.id}
                        className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 group cursor-pointer"
                        onClick={() => setSelectedAction(act)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-150 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {actionIcon}
                          </div>
                          <div className="space-y-0.5 truncate">
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-950 truncate group-hover:text-[#6e57dc] transition-colors">
                              {act.title}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                              <span>{act.department}</span>
                              <span>•</span>
                              <span className="font-semibold text-amber-600">{act.priority}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            <span>{act.due_date}</span>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}
                          >
                            {act.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ==================================================================== */ }
            {/* ACTION EXECUTION MODAL                                               */ }
            {/* ==================================================================== */ }
            {
              selectedAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                  <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-zinc-200">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2 text-base font-bold text-zinc-950">
                        <Target className="w-5 h-5 text-purple-600" />
                        <span>Execute Next Best Action</span>
                      </div>
                      <button
                        onClick={() => setSelectedAction(null)}
                        className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-extrabold text-zinc-900 leading-snug">
                        {selectedAction.title}
                      </h3>
                      <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-150 space-y-1.5 text-xs">
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

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                      <button
                        onClick={() => setSelectedAction(null)}
                        className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmAction}
                        className="px-5 py-2.5 bg-[#6e57dc] hover:bg-[#5842be] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                      >
                        Confirm & Dispatch Action
                      </button>
                    </div>
                  </div>
                </div>
              )
            }
    </div>
        );
}
