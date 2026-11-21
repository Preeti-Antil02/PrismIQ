"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  Calendar,
  ShieldCheck,
  Target,
  ArrowRight,
  TrendingUp,
  Star,
  BarChart2,
  Briefcase,
  Box,
  Megaphone,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  FileText,
  Globe,
  Tag,
  Heart,
  ExternalLink,
  X,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  fetchTrackedCompanies,
  fetchEvents,
  fetchSignals,
  fetchWinLossAnalytics,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
} from "@/lib/api";

// ============================================================================
// 3D Isometric SVG Artwork Components
// ============================================================================

function HeroIsometricGraphic() {
  return (
    <div className="relative w-48 h-36 sm:w-64 sm:h-44 shrink-0 flex items-center justify-center select-none pointer-events-none">
      <svg
        viewBox="0 0 280 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-lg"
      >
        <defs>
          {/* Gradients for 3D Isometric Bars */}
          <linearGradient id="bar1Top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="bar1Front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <linearGradient id="bar1Side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#5b21b6" />
          </linearGradient>

          <linearGradient id="bar2Top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ddd6fe" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
          <linearGradient id="bar2Front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#7e22ce" />
          </linearGradient>
          <linearGradient id="bar2Side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#86198f" />
            <stop offset="100%" stopColor="#581c87" />
          </linearGradient>

          <linearGradient id="bar3Top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ede9fe" />
            <stop offset="100%" stopColor="#ddd6fe" />
          </linearGradient>
          <linearGradient id="bar3Front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>

          {/* 3D Arrow Gradients */}
          <linearGradient id="arrowGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="arrowShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>

          {/* Base Floor Plane */}
          <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3f0ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#e9e5ff" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Isometric Grid Floor */}
        <path
          d="M140 190 L270 130 L140 70 L10 130 Z"
          fill="url(#floorGrad)"
        />

        {/* Isometric Bar 1 (Short left) */}
        <g transform="translate(45, 25)">
          {/* Top Face */}
          <path d="M30 65 L55 52 L30 40 L5 52 Z" fill="url(#bar1Top)" />
          {/* Front Face */}
          <path d="M5 52 L30 65 L30 115 L5 102 Z" fill="url(#bar1Front)" />
          {/* Right Side Face */}
          <path d="M30 65 L55 52 L55 102 L30 115 Z" fill="url(#bar1Side)" />
        </g>

        {/* Isometric Bar 2 (Medium center) */}
        <g transform="translate(90, 0)">
          {/* Top Face */}
          <path d="M30 50 L55 37 L30 25 L5 37 Z" fill="url(#bar2Top)" />
          {/* Front Face */}
          <path d="M5 37 L30 50 L30 125 L5 112 Z" fill="url(#bar2Front)" />
          {/* Right Side Face */}
          <path d="M30 50 L55 37 L55 112 L30 125 Z" fill="url(#bar2Side)" />
        </g>

        {/* Isometric Bar 3 (Tall right) */}
        <g transform="translate(135, -20)">
          {/* Top Face */}
          <path d="M30 35 L55 22 L30 10 L5 22 Z" fill="url(#bar3Top)" />
          {/* Front Face */}
          <path d="M5 22 L30 35 L30 135 L5 122 Z" fill="url(#bar3Front)" />
          {/* Right Side Face */}
          <path d="M30 35 L55 22 L55 122 L30 135 Z" fill="url(#bar1Side)" />
        </g>

        {/* 3D Ascending Blue Arrow */}
        <g transform="translate(60, 20)">
          {/* Main Arrow Body with 3D Depth */}
          <path
            d="M30 130 L105 85 L98 75 L155 50 L140 110 L132 100 L60 145 Z"
            fill="url(#arrowGrad)"
            filter="drop-shadow(0px 8px 12px rgba(37,99,235,0.35))"
          />
          {/* Arrow Underside / Depth */}
          <path
            d="M30 130 L60 145 L60 152 L30 137 Z"
            fill="url(#arrowShadow)"
          />
          <path
            d="M60 145 L132 100 L132 107 L60 152 Z"
            fill="url(#arrowShadow)"
          />
        </g>
      </svg>
    </div>
  );
}

function ImpactDartboardGraphic() {
  return (
    <div className="absolute -right-4 -bottom-4 w-36 h-36 sm:w-44 sm:h-44 select-none pointer-events-none opacity-90">
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dartRing1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ede9fe" />
            <stop offset="100%" stopColor="#ddd6fe" />
          </linearGradient>
          <linearGradient id="dartRing2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="dartBullseye" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#6e57dc" />
          </linearGradient>
          <linearGradient id="dartShaft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>

        {/* Concentric Dartboard Rings (Isometric Tilt) */}
        <g transform="translate(80, 80) rotate(-15) scale(1, 0.65)">
          <circle cx="0" cy="0" r="68" fill="url(#dartRing1)" stroke="#c4b5fd" strokeWidth="4" />
          <circle cx="0" cy="0" r="50" fill="white" stroke="#c4b5fd" strokeWidth="4" />
          <circle cx="0" cy="0" r="32" fill="url(#dartRing2)" stroke="#a78bfa" strokeWidth="3" />
          <circle cx="0" cy="0" r="15" fill="url(#dartBullseye)" />
        </g>

        {/* 3D Dart Piercing Bullseye */}
        <g transform="translate(68, 62) rotate(35)">
          {/* Dart Shaft */}
          <path d="M0 0 L-25 -25 L-22 -28 L3 -3 Z" fill="url(#dartShaft)" />
          {/* Dart Tip into Center */}
          <polygon points="0,0 6,-3 2,3" fill="#4c1d95" />
          {/* Dart Flights / Wings */}
          <polygon points="-25,-25 -42,-22 -35,-32" fill="#8b5cf6" />
          <polygon points="-25,-25 -28,-42 -37,-32" fill="#a78bfa" />
        </g>
      </svg>
    </div>
  );
}

// Sparkline Wave SVG
function SparklineWave({ color = "#a855f7" }: { color?: string }) {
  return (
    <div className="w-16 h-8 shrink-0">
      <svg viewBox="0 0 64 28" fill="none" className="w-full h-full">
        <path
          d="M2 18 C 12 18, 16 6, 26 12 C 36 18, 42 2, 52 8 C 58 12, 60 4, 62 6"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
  const { openEvidence } = useAppEvidence();

  const [timeRange, setTimeRange] = React.useState<"30" | "7" | "90">("30");
  const [rangeDropdownOpen, setRangeDropdownOpen] = React.useState(false);

  // Next Best Action Modal
  const [selectedAction, setSelectedAction] = React.useState<{
    id: string;
    title: string;
    subtitle: string;
    priority: string;
    department: string;
    due: string;
  } | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = React.useState<string | null>(null);

  // Grouped Bar Data for "Competitive Landscape"
  const landscapeData = React.useMemo(() => {
    return [
      { competitor: "Meesho", wins: 12, losses: 6 },
      { competitor: "Flipkart", wins: 10, losses: 5 },
      { competitor: "Amazon India", wins: 8, losses: 7 },
      { competitor: "Shopify", wins: 6, losses: 4 },
    ];
  }, []);

  const handleTakeAction = (action: {
    id: string;
    title: string;
    subtitle: string;
    priority: string;
    department: string;
    due: string;
  }) => {
    setSelectedAction(action);
  };

  const handleConfirmAction = () => {
    if (selectedAction) {
      setActionSuccessMsg(`Action "${selectedAction.title}" executed and assigned to ${selectedAction.department}!`);
      setSelectedAction(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Action Success Toast */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 bg-[#17171b] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-purple-500/30 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{actionSuccessMsg}</span>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-zinc-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. HERO BANNER: "Stay Ahead. Make Smarter Decisions." */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#f4f2ff] via-[#fbfaff] to-[#ede9fe] border border-purple-100/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            {/* Soft violet pill badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#ede9fe] text-[#6e57dc] text-xs font-bold tracking-tight mb-3">
              <span>Competitive Intelligence at Your Fingertips</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#17171b] leading-tight">
              Stay Ahead. Make Smarter Decisions.
            </h1>

            {/* Subheadline */}
            <p className="text-xs sm:text-sm text-[#595a63] font-medium mt-2 leading-relaxed">
              Real-time competitive insights, actionable recommendations and clear business impact.
            </p>
          </div>

          {/* Right Side Isometric Graphic + Button */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 self-start md:self-center">
            <HeroIsometricGraphic />
            <Link
              href="/app/brief"
              className="bg-white hover:bg-zinc-50 text-[#17171b] px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-md border border-zinc-200/80 inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>View Intelligence</span>
              <ArrowRight className="w-4 h-4 text-[#17171b]" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. STAT CARDS ROW (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Active Competitors */}
        <div className="rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6e57dc] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 fill-[#6e57dc] text-[#6e57dc]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#70717a]">Active Competitors</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-[#17171b]">6</span>
                <span className="text-xs font-bold text-emerald-600 inline-flex items-center">
                  ↑ 1
                </span>
              </div>
            </div>
          </div>
          <SparklineWave color="#a855f7" />
        </div>

        {/* Card 2: Recent Events */}
        <div className="rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0284c7] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#0284c7]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#70717a]">Recent Events</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-[#17171b]">12</span>
                <span className="text-xs font-bold text-emerald-600 inline-flex items-center">
                  ↑ 3
                </span>
              </div>
            </div>
          </div>
          <SparklineWave color="#0284c7" />
        </div>

        {/* Card 3: Threat Score */}
        <div className="rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#70717a]">Threat Score</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-[#17171b]">72/100</span>
              </div>
            </div>
          </div>
          <SparklineWave color="#f59e0b" />
        </div>

        {/* Card 4: Open Actions */}
        <div className="rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6e57dc] flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-[#6e57dc]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#70717a]">Open Actions</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-[#17171b]">8</span>
                <span className="text-xs font-bold text-emerald-600 inline-flex items-center">
                  ↑ 2
                </span>
              </div>
            </div>
          </div>
          <SparklineWave color="#a855f7" />
        </div>
      </div>

      {/* 3. MIDDLE ROW (Next Best Actions + Competitive Landscape) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Next Best Actions (7 columns) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] p-6 shadow-xs flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#6e57dc] flex items-center justify-center">
                <Star className="w-4 h-4 fill-[#6e57dc] text-[#6e57dc]" />
              </div>
              <h2 className="text-base font-extrabold text-[#17171b]">Next Best Actions</h2>
            </div>
            <Link
              href="/app/actions"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* 3 Action Rows */}
          <div className="space-y-3.5">
            {/* Item 1 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-zinc-50/80 transition-colors border border-transparent hover:border-zinc-100">
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200/60 shrink-0 mt-0.5">
                  High
                </span>
                <div>
                  <div className="font-bold text-sm text-[#17171b] leading-tight">
                    Prepare response to Meesho's pricing push
                  </div>
                  <div className="text-xs text-[#70717a] mt-0.5">
                    Competitor increased pricing for enterprise plan
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 sm:self-center self-end">
                <div className="text-right">
                  <div className="text-xs font-medium text-[#70717a] flex items-center gap-1 sm:justify-end">
                    <Briefcase className="w-3.5 h-3.5 text-[#9ca3af]" />
                    <span>Sales</span>
                  </div>
                  <div className="text-xs text-[#9ca3af] font-medium">Today</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleTakeAction({
                      id: "act-1",
                      title: "Prepare response to Meesho's pricing push",
                      subtitle: "Competitor increased pricing for enterprise plan",
                      priority: "High",
                      department: "Sales",
                      due: "Today",
                    })
                  }
                  className="bg-purple-50 hover:bg-purple-100 text-[#6e57dc] font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  Take Action
                </button>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-zinc-50/80 transition-colors border border-transparent hover:border-zinc-100">
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0 mt-0.5">
                  Medium
                </span>
                <div>
                  <div className="font-bold text-sm text-[#17171b] leading-tight">
                    Review feature gap in AI capabilities
                  </div>
                  <div className="text-xs text-[#70717a] mt-0.5">
                    Competitor launched new AI features
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 sm:self-center self-end">
                <div className="text-right">
                  <div className="text-xs font-medium text-[#70717a] flex items-center gap-1 sm:justify-end">
                    <Box className="w-3.5 h-3.5 text-[#9ca3af]" />
                    <span>Product</span>
                  </div>
                  <div className="text-xs text-[#9ca3af] font-medium">Tomorrow</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleTakeAction({
                      id: "act-2",
                      title: "Review feature gap in AI capabilities",
                      subtitle: "Competitor launched new AI features",
                      priority: "Medium",
                      department: "Product",
                      due: "Tomorrow",
                    })
                  }
                  className="bg-purple-50 hover:bg-purple-100 text-[#6e57dc] font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  Take Action
                </button>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-zinc-50/80 transition-colors border border-transparent hover:border-zinc-100">
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-[#6e57dc] border border-purple-200/60 shrink-0 mt-0.5">
                  Medium
                </span>
                <div>
                  <div className="font-bold text-sm text-[#17171b] leading-tight">
                    Update comparison page
                  </div>
                  <div className="text-xs text-[#70717a] mt-0.5">
                    New competitor capabilities detected
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 sm:self-center self-end">
                <div className="text-right">
                  <div className="text-xs font-medium text-[#70717a] flex items-center gap-1 sm:justify-end">
                    <Megaphone className="w-3.5 h-3.5 text-[#9ca3af]" />
                    <span>Marketing</span>
                  </div>
                  <div className="text-xs text-[#9ca3af] font-medium">This Week</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleTakeAction({
                      id: "act-3",
                      title: "Update comparison page",
                      subtitle: "New competitor capabilities detected",
                      priority: "Medium",
                      department: "Marketing",
                      due: "This Week",
                    })
                  }
                  className="bg-purple-50 hover:bg-purple-100 text-[#6e57dc] font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  Take Action
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Competitive Landscape Grouped Bar Chart (5 columns) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] p-6 shadow-xs flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#6e57dc] flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-[#6e57dc]" />
              </div>
              <h2 className="text-base font-extrabold text-[#17171b]">Competitive Landscape</h2>
            </div>

            {/* Time range dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 text-xs font-semibold text-[#70717a] flex items-center gap-1 hover:bg-zinc-50 bg-white"
              >
                <span>
                  {timeRange === "30" ? "Last 30 Days" : timeRange === "7" ? "Last 7 Days" : "Last 90 Days"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#9ca3af]" />
              </button>

              {rangeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setRangeDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl border border-zinc-200 shadow-lg p-1 z-30 text-xs font-medium">
                    <button
                      onClick={() => {
                        setTimeRange("7");
                        setRangeDropdownOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100"
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => {
                        setTimeRange("30");
                        setRangeDropdownOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 font-bold text-[#6e57dc]"
                    >
                      Last 30 Days
                    </button>
                    <button
                      onClick={() => {
                        setTimeRange("90");
                        setRangeDropdownOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100"
                    >
                      Last 90 Days
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-4 py-1 text-xs font-semibold text-[#595a63]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6e57dc]" />
              <span>Wins</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c4b5fd]" />
              <span>Losses</span>
            </div>
          </div>

          {/* Grouped Bar Chart Area */}
          <div className="relative pt-4 pb-2">
            {/* Horizontal Gridlines & Y-Axis values */}
            <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none text-[10px] text-[#9ca3af]">
              <div className="flex items-center gap-2">
                <span className="w-4 text-right">15</span>
                <div className="flex-1 border-b border-dashed border-zinc-100" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-right">10</span>
                <div className="flex-1 border-b border-dashed border-zinc-100" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-right">5</span>
                <div className="flex-1 border-b border-dashed border-zinc-100" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-right">0</span>
                <div className="flex-1 border-b border-zinc-200" />
              </div>
            </div>

            {/* Bars Container */}
            <div className="ml-7 grid grid-cols-4 gap-2 sm:gap-4 h-48 items-end relative z-10 pb-6">
              {landscapeData.map((d) => {
                // Max height mapped to 15
                const maxVal = 15;
                const winH = (d.wins / maxVal) * 100;
                const lossH = (d.losses / maxVal) * 100;

                return (
                  <div key={d.competitor} className="flex flex-col items-center h-full justify-end">
                    {/* Pair of Bars */}
                    <div className="flex items-end gap-1 sm:gap-1.5 w-full justify-center h-full">
                      {/* Wins Bar (Solid Purple) */}
                      <div className="flex flex-col items-center flex-1 max-w-[20px] sm:max-w-[24px] h-full justify-end group">
                        <span className="text-[11px] font-bold text-[#17171b] mb-1 opacity-90 group-hover:opacity-100">
                          {d.wins}
                        </span>
                        <div
                          style={{ height: `${winH}%` }}
                          className="w-full bg-[#6e57dc] hover:bg-[#5b46cc] rounded-t-md transition-all shadow-2xs"
                        />
                      </div>

                      {/* Losses Bar (Light Lavender) */}
                      <div className="flex flex-col items-center flex-1 max-w-[20px] sm:max-w-[24px] h-full justify-end group">
                        <span className="text-[11px] font-bold text-[#70717a] mb-1 opacity-90 group-hover:opacity-100">
                          {d.losses}
                        </span>
                        <div
                          style={{ height: `${lossH}%` }}
                          className="w-full bg-[#c4b5fd] hover:bg-[#b4a0fa] rounded-t-md transition-all shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Competitor X-Axis Label */}
                    <div className="text-[11px] font-semibold text-[#17171b] text-center mt-2 truncate w-full" title={d.competitor}>
                      {d.competitor}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ROW (Competitive Threat Overview + Turn Intelligence into Impact) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Competitive Threat Overview (8 columns) */}
        <div className="lg:col-span-8 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] p-6 shadow-xs">
          {/* Header */}
          <div className="flex items-center gap-2 pb-4 border-b border-zinc-100 mb-6">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#6e57dc] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#6e57dc]" />
            </div>
            <h2 className="text-base font-extrabold text-[#17171b]">Competitive Threat Overview</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Col 1: Circular Progress Gauge (4 cols) */}
            <div className="md:col-span-4 flex flex-col items-center justify-center py-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f3f4f6"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#6e57dc"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={(2 * Math.PI * 40) * (1 - 0.72)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-[#17171b] tracking-tight">72</span>
                  <span className="text-xs text-[#9ca3af] font-medium -mt-1">/100</span>
                </div>
              </div>
              <span className="mt-3 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
                High Threat
              </span>
            </div>

            {/* Col 2: Key Drivers (4 cols) */}
            <div className="md:col-span-4 space-y-3.5 border-t md:border-t-0 md:border-l md:border-r border-zinc-100 md:px-5 py-2">
              <div className="text-xs font-bold text-[#17171b]">Key Drivers</div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#595a63]">
                  <FileText className="w-3.5 h-3.5 text-[#6e57dc]" />
                  <span>Product Activity</span>
                </div>
                <span className="font-bold text-[#17171b]">32%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#595a63]">
                  <Globe className="w-3.5 h-3.5 text-[#0284c7]" />
                  <span>Market Expansion</span>
                </div>
                <span className="font-bold text-[#17171b]">28%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#595a63]">
                  <Tag className="w-3.5 h-3.5 text-[#f59e0b]" />
                  <span>Pricing Movement</span>
                </div>
                <span className="font-bold text-[#17171b]">24%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#595a63]">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>Customer Sentiment</span>
                </div>
                <span className="font-bold text-[#17171b]">16%</span>
              </div>
            </div>

            {/* Col 3: Line Chart Trend (4 cols) */}
            <div className="md:col-span-4 flex flex-col justify-between h-full py-2">
              <div className="flex justify-end mb-2">
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 inline-flex items-center gap-0.5">
                  ↑ +8%
                </span>
              </div>

              {/* Gradient Shaded Sparkline Wave */}
              <div className="w-full h-24 relative">
                <svg viewBox="0 0 160 70" fill="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="threatTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Fill Area */}
                  <path
                    d="M5 45 C 25 42, 35 55, 55 40 C 75 25, 95 38, 115 22 C 135 15, 145 20, 155 12 L155 70 L5 70 Z"
                    fill="url(#threatTrendGrad)"
                  />
                  {/* Stroke Line */}
                  <path
                    d="M5 45 C 25 42, 35 55, 55 40 C 75 25, 95 38, 115 22 C 135 15, 145 20, 155 12"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="text-center text-xs text-[#9ca3af] font-medium mt-1">
                vs last month
              </div>
            </div>
          </div>
        </div>

        {/* Right: Turn Intelligence into Impact (4 columns) */}
        <div className="lg:col-span-4 rounded-2xl bg-gradient-to-br from-[#f8f6ff] via-[#fbfaff] to-[#ede9fe] border border-purple-100/90 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            {/* Target Icon */}
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#6e57dc] flex items-center justify-center mb-3">
              <Target className="w-5 h-5 text-[#6e57dc]" />
            </div>

            {/* Headline */}
            <h3 className="text-lg font-black text-[#17171b] tracking-tight">
              Turn Intelligence into Impact
            </h3>

            {/* Subtitle */}
            <p className="text-xs text-[#595a63] font-medium mt-1.5 leading-relaxed max-w-[210px] sm:max-w-xs">
              Get actionable recommendations tailored to your business goals.
            </p>

            {/* CTA Button */}
            <Link
              href="/app/actions"
              className="bg-[#6e57dc] hover:bg-[#5b46cc] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-purple-500/20 inline-flex items-center gap-1.5 mt-5 transition-all cursor-pointer"
            >
              <span>Explore Action Center</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </Link>
          </div>

          {/* 3D Dartboard Graphic */}
          <ImpactDartboardGraphic />
        </div>
      </div>

      {/* Action Execution Modal */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                  {selectedAction.priority} Priority
                </span>
                <span className="text-xs text-[#70717a] font-semibold">{selectedAction.department}</span>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-2">
              <h3 className="text-base font-extrabold text-[#17171b] leading-snug">
                {selectedAction.title}
              </h3>
              <p className="text-xs text-[#595a63] leading-relaxed">
                {selectedAction.subtitle}
              </p>
              <div className="pt-2 text-xs text-[#70717a] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#9ca3af]" />
                <span>Due: {selectedAction.due}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setSelectedAction(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#6e57dc] hover:bg-[#5b46cc] text-white shadow-xs"
              >
                Execute Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
