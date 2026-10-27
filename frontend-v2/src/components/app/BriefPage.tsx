"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  Clock,
  Printer,
  Copy,
  Check,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Search,
  Building2,
  Flame,
  Zap,
  Filter,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  PrismCard,
  PrismTierBadge,
  PrismConfidenceBadge,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismCompanyBadge,
} from "./PrismPrimitives";
import {
  fetchBriefs,
  fetchLatestBrief,
  fetchBriefById,
  type BriefEntry,
  type BriefDetail,
} from "@/lib/api";
import {
  parseBriefMarkdown,
  getCompanySummaries,
  resolveSourceInfo,
  getImpactfulExecutiveSummary,
  type ParsedBrief,
  type CompanySummary,
  type TierFindingItem,
  type ImpactfulSummary,
  type SourceInfo,
} from "@/lib/briefParser";

// ============================================================================
// Reusable PrismScorableBar Component
// ============================================================================
export interface PrismScorableBarProps {
  score: number; // 0 - 100
  size?: "sm" | "md" | "lg";
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function PrismScorableBar({
  score,
  size = "md",
  label,
  showValue = true,
  className = "",
}: PrismScorableBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));

  // Color gradient and styling based on score threshold
  let gradientClass = "from-emerald-500 via-teal-500 to-cyan-600";
  let glowColor = "rgba(16, 185, 129, 0.25)";
  let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let statusText = "Routine";

  if (clamped >= 80) {
    gradientClass = "from-rose-500 via-pink-500 to-red-600";
    glowColor = "rgba(244, 63, 94, 0.3)";
    badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
    statusText = "Critical Impact";
  } else if (clamped >= 62) {
    gradientClass = "from-amber-500 via-violet-500 to-indigo-600";
    glowColor = "rgba(139, 114, 255, 0.3)";
    badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
    statusText = "High Momentum";
  } else if (clamped >= 45) {
    gradientClass = "from-sky-500 via-blue-500 to-indigo-500";
    glowColor = "rgba(59, 130, 246, 0.25)";
    badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
    statusText = "Moderate Velocity";
  }

  const heightClass = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {label && (
            <span className="text-[#595a63] font-medium truncate">
              {label}
            </span>
          )}
          {showValue && (
            <div className="flex items-center gap-1.5 shrink-0">
              {size !== "sm" && (
                <span className="text-[10px] font-semibold text-[#8a8b94]">{statusText}</span>
              )}
              <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[11px] border ${badgeClass}`}>
                {clamped}/100
              </span>
            </div>
          )}
        </div>
      )}
      <div className={`w-full bg-zinc-100 rounded-full overflow-hidden ${heightClass} p-[1px] shadow-inner`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-500 ease-out`}
          style={{
            width: `${clamped}%`,
            boxShadow: `0 0 8px ${glowColor}`,
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Brief Page
// ============================================================================
export function BriefPage() {
  const { targetCompany, tenantId, triggerSweep } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [briefList, setBriefList] = React.useState<BriefEntry[]>([]);
  const [selectedBrief, setSelectedBrief] = React.useState<BriefDetail | null>(null);
  const [parsed, setParsed] = React.useState<ParsedBrief | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Ergonomic filter & view controls
  const [viewMode, setViewMode] = React.useState<"companies" | "priority" | "themes">("companies");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedTierFilter, setSelectedTierFilter] = React.useState<string>("ALL");

  // Load briefs
  const loadBriefs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchBriefs(tenantId);
      setBriefList(list);

      if (list.length > 0) {
        const latest = await fetchLatestBrief(tenantId);
        setSelectedBrief(latest);
        setParsed(parseBriefMarkdown(latest.content));
      } else {
        try {
          const latest = await fetchLatestBrief(tenantId);
          setSelectedBrief(latest);
          setParsed(parseBriefMarkdown(latest.content));
        } catch {
          setSelectedBrief(null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load briefs");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadBriefs();
  }, [loadBriefs]);

  // Handle switching to historical brief
  const handleSelectBrief = async (briefId: string) => {
    setLoading(true);
    try {
      const b = await fetchBriefById(briefId, tenantId);
      setSelectedBrief(b);
      setParsed(parseBriefMarkdown(b.content));
    } catch (err: any) {
      alert(`Could not load brief: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = () => {
    if (selectedBrief?.content) {
      navigator.clipboard.writeText(selectedBrief.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Compute Company Aggregations
  const companySummaries = React.useMemo(() => {
    if (!parsed) return [];
    return getCompanySummaries(parsed, targetCompany);
  }, [parsed, targetCompany]);

  // Impactful Executive Intelligence Summary (Qualitative, Strategic Narrative & Recommendations)
  const impactfulSummary = React.useMemo(() => {
    if (!parsed) return null;
    return getImpactfulExecutiveSummary(parsed, targetCompany);
  }, [parsed, targetCompany]);

  // Distinct company list for filter pills
  const availableCompanies = React.useMemo(() => {
    const set = new Set<string>();
    companySummaries.forEach((c) => set.add(c.companyName));
    return Array.from(set);
  }, [companySummaries]);

  // Overall brief KPIs
  const kpis = React.useMemo(() => {
    const totalMust = parsed?.mustKnow.length || 0;
    const totalShould = parsed?.shouldKnow.length || 0;
    const activeComps = companySummaries.filter((c) => c.companyName !== "General").length;
    const themesCount = parsed?.rollupRows.length || 0;

    // Average threat score across active competitors
    const avgScore =
      activeComps > 0
        ? Math.round(
            companySummaries
              .filter((c) => c.companyName !== "General")
              .reduce((acc, c) => acc + c.threatScore, 0) / activeComps
          )
        : 72;

    return { totalMust, totalShould, activeComps, themesCount, avgScore };
  }, [parsed, companySummaries]);

  // Filter helper for finding items
  const matchesSearch = (item: TierFindingItem) => {
    if (selectedCompanyFilter !== "ALL" && item.company.toLowerCase() !== selectedCompanyFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchWhy = item.whyItMatters.toLowerCase().includes(q);
      const matchComp = item.company.toLowerCase().includes(q);
      if (!matchTitle && !matchWhy && !matchComp) return false;
    }
    return true;
  };

  if (loading && !selectedBrief) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        <div className="app-skeleton h-10 w-72 rounded-xl" />
        <div className="app-skeleton h-4 w-96 rounded-lg" />
        <PrismLoadingSkeleton count={4} />
      </div>
    );
  }

  if (error || !selectedBrief) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <PrismEmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title={`No Briefs Generated Yet for ${targetCompany}`}
          description="Autonomous executive briefs are compiled automatically from validated signals and verified competitive events. Trigger an intelligence sweep to generate your first brief."
          actionText="Trigger Intelligence Sweep"
          onAction={triggerSweep}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* ============================================================
          1. Header & Meta Controls
         ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Executive Intelligence Brief
          </div>
          <h1 className="app-title-lg">
            Competitive Brief — <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#70717a] mt-1.5">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#9ca3af]" />
              {selectedBrief.date
                ? new Date(selectedBrief.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recent"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-[#17171b]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Multi-Source Intelligence
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[#6e57dc] font-semibold">
              <Clock className="w-3.5 h-3.5" />
              Updated automatically
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {briefList.length > 1 && (
            <select
              aria-label="Select historical brief"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[rgba(20,20,30,0.09)] bg-white text-[#17171b] outline-none shadow-xs"
              value={selectedBrief.id}
              onChange={(e) => handleSelectBrief(e.target.value)}
            >
              {briefList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title || `Brief ${b.date ? b.date.slice(0, 10) : b.id}`}
                </option>
              ))}
            </select>
          )}

          <PrismButton variant="light" size="sm" onClick={copyMarkdown}>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#70717a]" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </PrismButton>

          <PrismButton variant="light" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Print</span>
          </PrismButton>
        </div>
      </div>

      {/* ============================================================
          2. Executive KPI Summary Banner
         ============================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#70717a] font-medium mb-1">
            <span>Tracked Competitors</span>
            <Building2 className="w-4 h-4 text-[#6e57dc]" />
          </div>
          <div className="text-2xl font-black text-[#17171b]">{kpis.activeComps}</div>
          <div className="text-[11px] text-[#8a8b94] mt-0.5 font-medium">Active in this cycle</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#70717a] font-medium mb-1">
            <span>Critical Shifts</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">{kpis.totalMust}</div>
          <div className="text-[11px] text-[#8a8b94] mt-0.5 font-medium">Must-Know developments</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#70717a] font-medium mb-1">
            <span>Competitive Pulse</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-[#17171b]">{kpis.avgScore}/100</div>
          <div className="text-[11px] text-[#8a8b94] mt-0.5 font-medium">Average threat momentum</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(20,20,30,0.07)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#70717a] font-medium mb-1">
            <span>Verified Patterns</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{kpis.themesCount}</div>
          <div className="text-[11px] text-[#8a8b94] mt-0.5 font-medium">Cross-competitor themes</div>
        </div>
      </div>

      {/* ============================================================
          3. Executive Intelligence Synthesis: New & Impactful for Company
         ============================================================ */}
      <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-purple-50/80 via-white to-blue-50/50 border border-purple-100 shadow-sm relative overflow-hidden space-y-5">
        <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-purple-400/10 to-transparent rounded-full pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100/70 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#6e57dc] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#6e57dc]">
                Executive Intelligence Synthesis
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#17171b]">
                Key Strategic Takeaways & Business Impact for {targetCompany}
              </h2>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#70717a] bg-white px-3 py-1 rounded-full border border-purple-100 shadow-2xs self-start sm:self-auto">
            Strategic Decisional Signal
          </span>
        </div>

        {/* Primary Narrative Summary */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#70717a]">
            Competitive Landscape Shift
          </div>
          <p className="text-sm sm:text-[15px] text-[#1f2937] leading-relaxed font-medium">
            {impactfulSummary?.headlineNarrative ||
              (parsed?.executiveSummary &&
              !parsed.executiveSummary.toLowerCase().includes("monitoring scope:")
                ? parsed.executiveSummary
                : `Monitored intelligence indicates critical competitor movements across platform development and market positioning. Leadership should track these developments to preserve competitive differentiation.`)}
          </p>
        </div>

        {/* High-Impact Strategic Vectors (2-3 Cards) */}
        {impactfulSummary?.takeaways && impactfulSummary.takeaways.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#70717a] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#6e57dc]" />
              Impactful Developments & Implications for {targetCompany}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {impactfulSummary.takeaways.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white border border-[rgba(20,20,30,0.08)] shadow-2xs space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${
                          item.badgeColor === "rose"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : item.badgeColor === "amber"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : item.badgeColor === "blue"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        {item.vector}
                      </span>
                      <span className="text-xs font-bold text-[#17171b]">
                        {item.competitor}
                      </span>
                    </div>

                    <div className="font-bold text-xs sm:text-sm text-[#17171b] leading-snug line-clamp-2">
                      {item.headline}
                    </div>

                    <div className="text-xs text-[#4b5563] leading-relaxed bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                      <strong className="text-[#17171b] font-semibold">Impact on {targetCompany}: </strong>
                      {item.strategicImpact}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 text-[11px] text-[#6e57dc] font-semibold flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#17171b]">Action: </strong>
                      {item.actionRecommendation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Executive Action Banner */}
        {impactfulSummary?.executiveAction && (
          <div className="p-3.5 rounded-xl bg-[#17171b] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong className="text-amber-300">Executive Priority for {targetCompany}: </strong>
                {impactfulSummary.executiveAction}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          4. Organization Toolbar: View Modes, Search, and Company Filter
         ============================================================ */}
      <div className="space-y-3.5 pt-2">
        {/* Top Controls Bar: View Mode Switcher + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View Mode Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100/80 border border-zinc-200/60 w-fit">
            <button
              onClick={() => setViewMode("companies")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "companies"
                  ? "bg-white text-[#17171b] shadow-xs"
                  : "text-[#70717a] hover:text-[#17171b]"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#6e57dc]" />
              By Company Sections
            </button>

            <button
              onClick={() => setViewMode("priority")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "priority"
                  ? "bg-white text-[#17171b] shadow-xs"
                  : "text-[#70717a] hover:text-[#17171b]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Strategic Priority
            </button>

            <button
              onClick={() => setViewMode("themes")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "themes"
                  ? "bg-white text-[#17171b] shadow-xs"
                  : "text-[#70717a] hover:text-[#17171b]"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              Strategic Themes ({parsed?.rollupRows.length || 0})
            </button>
          </div>

          {/* Real-time Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search developments, implications..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[rgba(20,20,30,0.09)] bg-white text-[#17171b] placeholder-[#9ca3af] outline-none focus:border-[#6e57dc] transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9ca3af] hover:text-[#17171b]"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Company Quick-Filter Pills (without native scrollbar line) */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <span className="text-[#8a8b94] font-medium text-xs flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          <button
            onClick={() => setSelectedCompanyFilter("ALL")}
            className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 ${
              selectedCompanyFilter === "ALL"
                ? "bg-[#17171b] text-white shadow-xs"
                : "bg-white border border-[rgba(20,20,30,0.08)] text-[#595a63] hover:bg-zinc-50"
            }`}
          >
            All Companies ({companySummaries.reduce((acc, c) => acc + c.totalCount, 0)})
          </button>

          {companySummaries.map((c) => (
            <button
              key={c.companyName}
              onClick={() => setSelectedCompanyFilter(c.companyName)}
              className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedCompanyFilter.toLowerCase() === c.companyName.toLowerCase()
                  ? "bg-[#6e57dc] text-white shadow-xs"
                  : "bg-white border border-[rgba(20,20,30,0.08)] text-[#595a63] hover:bg-zinc-50"
              }`}
            >
              <span>{c.companyName}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedCompanyFilter.toLowerCase() === c.companyName.toLowerCase()
                    ? "bg-white/20 text-white"
                    : "bg-zinc-100 text-[#70717a]"
                }`}
              >
                {c.totalCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================
          VIEW 1: BY COMPANY SECTIONS & DOSSIERS
         ============================================================ */}
      {viewMode === "companies" && (
        <div className="space-y-8">
          {/* Competitive Threat Matrix Overview (At-A-Glance Cards) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#70717a]">
              <span className="font-semibold text-[#17171b] flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#6e57dc]" />
                Competitive Momentum Matrix
              </span>
              <span>Click competitor to focus dossier</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {companySummaries.map((c) => {
                const isTarget = c.companyName.toLowerCase() === targetCompany.toLowerCase();
                const isSelected = selectedCompanyFilter.toLowerCase() === c.companyName.toLowerCase();
                return (
                  <button
                    key={c.companyName}
                    onClick={() => setSelectedCompanyFilter(isSelected ? "ALL" : c.companyName)}
                    className={`p-3.5 rounded-xl text-left border transition-all ${
                      isSelected
                        ? "bg-purple-50/70 border-[#6e57dc] shadow-sm ring-1 ring-[#6e57dc]"
                        : "bg-white border-[rgba(20,20,30,0.08)] hover:border-zinc-300 shadow-xs hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <PrismCompanyBadge name={c.companyName} isTarget={isTarget} size="sm" />
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-[#70717a]">
                        {c.totalCount} items
                      </span>
                    </div>
                    <PrismScorableBar score={c.threatScore} size="sm" showValue={true} />
                    <div className="flex items-center justify-between text-[10px] text-[#8a8b94] font-medium mt-1.5">
                      <span>{c.mustCount} critical</span>
                      <span>{c.threatLevel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {companySummaries
            .filter((c) =>
              selectedCompanyFilter === "ALL"
                ? true
                : c.companyName.toLowerCase() === selectedCompanyFilter.toLowerCase()
            )
            .map((company) => {
              const filteredMust = company.mustItems.filter(matchesSearch);
              const filteredShould = company.shouldItems.filter(matchesSearch);
              const hasItems = filteredMust.length > 0 || filteredShould.length > 0;

              if (searchQuery && !hasItems && !company.topDecisionHeadline?.toLowerCase().includes(searchQuery.toLowerCase())) {
                return null;
              }

              const isTarget = company.companyName.toLowerCase() === targetCompany.toLowerCase();

              return (
                <section
                  key={company.companyName}
                  className="p-6 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] shadow-sm space-y-6"
                >
                  {/* Company Header Card */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <PrismCompanyBadge
                          name={company.companyName}
                          isTarget={isTarget}
                          size="md"
                        />
                        <span className="text-xs font-semibold text-[#8a8b94]">
                          • {company.totalCount} active developments
                        </span>
                      </div>
                      <p className="text-xs text-[#595a63] leading-relaxed">
                        {isTarget
                          ? `Primary monitored workspace. Intelligence synthesized across verified competitive events.`
                          : `Tracked competitor profile. Monitored for product, pricing, hiring, and repository activity.`}
                      </p>
                    </div>

                    {/* Scorable Momentum Bar in Header */}
                    <div className="w-full sm:w-80 p-3 rounded-xl bg-zinc-50 border border-zinc-100 shrink-0">
                      <PrismScorableBar
                        score={company.threatScore}
                        label="Threat Velocity"
                        size="md"
                        showValue={true}
                      />
                    </div>
                  </div>

                  {/* Top Decision Spotlight if exists for this company */}
                  {company.topDecisionHeadline && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50/80 via-white to-pink-50/40 border border-purple-100/80 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#6e57dc] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#6e57dc]">
                          Top Strategic Decision Spotlight
                        </div>
                        <div className="font-bold text-sm text-[#17171b]">
                          {company.topDecisionHeadline}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Must-Know Developments for this Company */}
                  {filteredMust.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          Must-Know Tactical Updates ({filteredMust.length})
                        </div>
                        <PrismTierBadge tier="Must-Know" size="sm" />
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {filteredMust.map((item, idx) => {
                          const sourceInfo = resolveSourceInfo(item);
                          return (
                            <PrismCard
                              key={idx}
                              interactive
                              onClick={() =>
                                openEvidence({
                                  title: item.title,
                                  company_name: item.company,
                                  why_it_matters: item.whyItMatters,
                                  raw_excerpt: item.fact || item.title,
                                  url: item.url,
                                  tier: "Must-Know",
                                  confidence: item.confidence || "High",
                                })
                              }
                              className="p-4.5 bg-gradient-to-r from-rose-50/20 via-white to-white border-zinc-200/80"
                            >
                              <div className="space-y-2.5">
                                {/* Development Header */}
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                      CRITICAL
                                    </span>
                                    {item.confidence && (
                                      <PrismConfidenceBadge confidence={item.confidence} size="sm" />
                                    )}
                                    {/* Prominent Source Badge alongside Headline */}
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200/80 text-[11px] text-[#27272a]">
                                      <span className="text-[#71717a] font-medium text-[10px]">Source:</span>
                                      {sourceInfo.url ? (
                                        <a
                                          href={sourceInfo.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="font-bold text-[#6e57dc] hover:underline inline-flex items-center gap-1"
                                        >
                                          {sourceInfo.label}
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      ) : (
                                        <span className="font-bold text-[#18181b]">{sourceInfo.label}</span>
                                      )}
                                    </span>
                                  </div>

                                  <h4 className="text-sm font-bold text-[#17171b] hover:text-[#6e57dc] transition-colors leading-snug">
                                    {item.title}
                                  </h4>
                                </div>

                                {/* Why it Matters Callout */}
                                {item.whyItMatters && (
                                  <div className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-100 text-xs text-[#374151] leading-relaxed">
                                    <strong className="text-[#17171b] font-bold">Strategic Implication: </strong>
                                    {item.whyItMatters}
                                  </div>
                                )}

                                {/* Card Footer */}
                                <div className="flex items-center justify-between text-xs pt-1">
                                  <div className="text-[11px] text-[#8a8b94]">
                                    {item.date ? `Detected: ${item.date}` : "Corroborated by PrismIQ Engine"}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {item.url && (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[11px] font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
                                      >
                                        Source <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                    <button className="text-[11px] font-bold text-[#17171b] hover:text-[#6e57dc] flex items-center gap-1">
                                      Inspect Evidence <ArrowRight className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </PrismCard>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Should-Know Developments for this Company */}
                  {filteredShould.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Should-Know Monitoring Items ({filteredShould.length})
                        </div>
                        <PrismTierBadge tier="Should-Know" size="sm" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredShould.map((item, idx) => {
                          const shouldSource = resolveSourceInfo(item);
                          return (
                            <PrismCard
                              key={idx}
                              interactive
                              onClick={() =>
                                openEvidence({
                                  title: item.title,
                                  company_name: item.company,
                                  why_it_matters: item.whyItMatters,
                                  raw_excerpt: item.fact || item.title,
                                  url: item.url,
                                  tier: "Should-Know",
                                  confidence: item.confidence || "Medium",
                                })
                              }
                              className="p-4 bg-white border-zinc-200/80"
                            >
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <PrismTierBadge tier="Should-Know" size="sm" />
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200/80 text-[10px] text-[#27272a]">
                                    <span className="text-[#71717a] font-medium">Source:</span>
                                    {shouldSource.url ? (
                                      <a
                                        href={shouldSource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="font-bold text-[#6e57dc] hover:underline inline-flex items-center gap-0.5"
                                      >
                                        {shouldSource.label}
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    ) : (
                                      <span className="font-bold text-[#18181b]">{shouldSource.label}</span>
                                    )}
                                  </span>
                                </div>

                                <h5 className="font-bold text-xs sm:text-sm text-[#17171b] leading-snug line-clamp-2">
                                  {item.title}
                                </h5>

                                {item.whyItMatters && (
                                  <p className="text-xs text-[#595a63] line-clamp-2 leading-relaxed">
                                    {item.whyItMatters}
                                  </p>
                                )}

                                <div className="flex items-center justify-between text-[11px] text-[#6e57dc] font-bold pt-1">
                                  <span>Drilldown</span>
                                  <ArrowRight className="w-3 h-3" />
                                </div>
                              </div>
                            </PrismCard>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!hasItems && (
                    <div className="p-4 rounded-xl bg-zinc-50 text-center text-xs text-[#8a8b94]">
                      No active developments matching &quot;{searchQuery}&quot; for {company.companyName}.
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      )}

      {/* ============================================================
          VIEW 2: STRATEGIC PRIORITY VIEW (Decisions & Tiers)
         ============================================================ */}
      {viewMode === "priority" && (
        <div className="space-y-10">
          {/* Section 1: Major Developments (Numbered Decisions) */}
          {parsed?.topDecisions && parsed.topDecisions.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-100/80 text-[#6e57dc] font-extrabold text-xs flex items-center justify-center">
                  1
                </div>
                <h2 className="app-title-md">Major Strategic Decisions & Priority Shifts</h2>
              </div>

              <div className="space-y-3">
                {parsed.topDecisions.map((dec) => {
                  const decSource = resolveSourceInfo({ title: dec.headline, company: dec.company });
                  return (
                    <PrismCard
                      key={dec.number}
                      interactive
                      onClick={() =>
                        openEvidence({
                          title: dec.headline,
                          company_name: dec.company,
                          why_it_matters: dec.impact,
                          raw_excerpt: `${dec.company}: ${dec.headline}. ${dec.impact}`,
                          tier: "Must-Know",
                          confidence: "High",
                        })
                      }
                      className="p-5"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <PrismCompanyBadge
                            name={dec.company}
                            isTarget={dec.company.toLowerCase() === targetCompany.toLowerCase()}
                            size="sm"
                          />
                          <PrismTierBadge tier="Must-Know" />
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200/60 text-[11px] text-[#5b3ee0]">
                            <span className="text-[#71717a] font-medium text-[10px]">Source:</span>
                            <span className="font-bold">{decSource.label}</span>
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-[#17171b] leading-snug">
                          {dec.headline}
                        </h3>

                        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-[#374151] leading-relaxed">
                          <strong className="text-[#6e57dc] font-bold">Strategic Impact: </strong>
                          {dec.impact}
                        </div>
                      </div>
                    </PrismCard>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 2: All Must-Know Tactical Updates */}
          {parsed?.mustKnow && parsed.mustKnow.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-700 font-extrabold text-xs flex items-center justify-center">
                    2
                  </div>
                  <h2 className="app-title-md">Must-Know Tactical Updates</h2>
                </div>
                <PrismTierBadge tier="Must-Know" />
              </div>

              <div className="space-y-3">
                {parsed.mustKnow.filter(matchesSearch).map((item, idx) => {
                  const sourceInfo = resolveSourceInfo(item);
                  return (
                    <PrismCard
                      key={idx}
                      interactive
                      onClick={() =>
                        openEvidence({
                          title: item.title,
                          company_name: item.company,
                          why_it_matters: item.whyItMatters,
                          raw_excerpt: item.fact || item.title,
                          url: item.url,
                          tier: "Must-Know",
                          confidence: item.confidence || "High",
                        })
                      }
                      className="p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <PrismCompanyBadge
                            name={item.company}
                            isTarget={item.company.toLowerCase() === targetCompany.toLowerCase()}
                            size="sm"
                          />
                          <PrismTierBadge tier="Must-Know" size="sm" />
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200/80 text-[11px] text-[#27272a]">
                            <span className="text-[#71717a] font-medium text-[10px]">Source:</span>
                            {sourceInfo.url ? (
                              <a
                                href={sourceInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold text-[#6e57dc] hover:underline inline-flex items-center gap-1"
                              >
                                {sourceInfo.label}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="font-bold text-[#18181b]">{sourceInfo.label}</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="font-bold text-sm text-[#17171b] mb-1.5">{item.title}</div>
                      {item.whyItMatters && (
                        <p className="text-xs text-[#4b5563] leading-relaxed">
                          <strong className="text-[#17171b]">Implication: </strong>
                          {item.whyItMatters}
                        </p>
                      )}
                    </PrismCard>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 3: Should-Know Monitoring Items */}
          {parsed?.shouldKnow && parsed.shouldKnow.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center">
                    3
                  </div>
                  <h2 className="app-title-md">Should-Know Monitoring Items</h2>
                </div>
                <PrismTierBadge tier="Should-Know" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsed.shouldKnow.filter(matchesSearch).map((item, idx) => {
                  const shouldSource = resolveSourceInfo(item);
                  return (
                    <PrismCard
                      key={idx}
                      interactive
                      onClick={() =>
                        openEvidence({
                          title: item.title,
                          company_name: item.company,
                          why_it_matters: item.whyItMatters,
                          raw_excerpt: item.fact || item.title,
                          url: item.url,
                          tier: "Should-Know",
                          confidence: item.confidence || "Medium",
                        })
                      }
                      className="p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <PrismCompanyBadge
                          name={item.company}
                          isTarget={item.company.toLowerCase() === targetCompany.toLowerCase()}
                          size="sm"
                        />
                        <PrismTierBadge tier="Should-Know" size="sm" />
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200/80 text-[10px] text-[#27272a]">
                          <span className="text-[#71717a] font-medium">Source:</span>
                          {shouldSource.url ? (
                            <a
                              href={shouldSource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold text-[#6e57dc] hover:underline inline-flex items-center gap-0.5"
                            >
                              {shouldSource.label}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="font-bold text-[#18181b]">{shouldSource.label}</span>
                          )}
                        </span>
                      </div>
                      <div className="font-semibold text-xs sm:text-sm text-[#17171b] mb-1">
                        {item.title}
                      </div>
                      {item.whyItMatters && (
                        <p className="text-xs text-[#70717a] leading-relaxed line-clamp-2">
                          {item.whyItMatters}
                        </p>
                      )}
                    </PrismCard>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ============================================================
          VIEW 3: STRATEGIC THEMES ROLLUP MATRIX
         ============================================================ */}
      {viewMode === "themes" && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-100/80 text-blue-700 font-extrabold text-xs flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="app-title-md">Cross-Competitor Movement by Strategic Theme</h2>
          </div>

          {parsed?.rollupRows && parsed.rollupRows.length > 0 ? (
            <div className="app-table-wrap shadow-xs">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Theme</th>
                    <th>Competitors Involved</th>
                    <th>Volume</th>
                    <th>Pattern Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rollupRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="font-bold text-[#17171b] whitespace-nowrap">
                        {row.theme}
                      </td>
                      <td className="text-xs font-semibold text-[#4b5563]">
                        {row.competitors}
                      </td>
                      <td className="whitespace-nowrap text-xs font-bold text-[#6e57dc]">
                        {row.eventsCount}
                      </td>
                      <td className="text-xs text-[#374151] leading-relaxed max-w-sm">
                        {row.patternDetected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 text-center text-xs text-[#70717a]">
              No multi-competitor thematic matrix generated for this cycle yet.
            </div>
          )}
        </section>
      )}

      {/* Fallback Display if brief has no standard structured headers */}
      {(!parsed ||
        (parsed.topDecisions.length === 0 &&
          parsed.mustKnow.length === 0 &&
          parsed.shouldKnow.length === 0 &&
          parsed.rollupRows.length === 0)) &&
        selectedBrief?.content && (
          <section className="p-6 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6e57dc]" />
              <h2 className="app-title-md">Executive Intelligence Analysis</h2>
            </div>
            <div className="text-xs sm:text-sm text-[#374151] leading-relaxed whitespace-pre-wrap font-sans bg-zinc-50 p-5 rounded-xl border border-zinc-100 max-h-[600px] overflow-y-auto">
              {selectedBrief.content}
            </div>
          </section>
        )}

      {/* Grounding & Methodology Integrity Footer */}
      <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-[#595a63] space-y-2">
        <div className="font-bold text-[#17171b] flex items-center gap-1.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          PrismIQ Grounding & Methodology Standard
        </div>
        <p className="leading-relaxed">
          This brief was synthesized from corroborated raw signals detected across news archives,
          public code repositories, job disclosures, pricing updates, and research monitors.
          Uncorroborated single-source claims are flagged or suppressed by design.
        </p>
      </div>
    </div>
  );
}
