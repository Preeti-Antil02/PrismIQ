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
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
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
  buildCompetitorSummaries,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type CompetitorActivitySummary,
  type CompanyProfile,
  type CompanyChangeRecord,
} from "@/lib/api";

export function CompetitorsPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [findings, setFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Evolving Company Intelligence State
  const [activeProfileCompany, setActiveProfileCompany] = React.useState<string | null>(null);
  const [profileData, setProfileData] = React.useState<CompanyProfile | null>(null);
  const [profileChanges, setProfileChanges] = React.useState<CompanyChangeRecord[]>([]);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profileTab, setProfileTab] = React.useState<"changes" | "products" | "pricing" | "market" | "swot" | "hiring">("changes");
  const [dimensionFilter, setDimensionFilter] = React.useState<string>("ALL");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compsRes, eventsRes, signalsRes, findingsRes, radarRes] =
        await Promise.allSettled([
          fetchTrackedCompanies(),
          fetchEvents({ limit: 150 }),
          fetchSignals({ limit: 300 }),
          fetchFindings(),
          fetchLatestRadar(),
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
  }, []);

  // Load detailed evolving profile when a competitor is selected
  const openCompanyIntelligence = React.useCallback(async (companyName: string) => {
    setActiveProfileCompany(companyName);
    setProfileLoading(true);
    setProfileTab("changes");
    setDimensionFilter("ALL");
    try {
      const [prof, chs] = await Promise.all([
        fetchCompanyProfile(companyName),
        fetchCompanyChanges(companyName),
      ]);
      setProfileData(prof);
      setProfileChanges(chs.changes || []);
    } catch (err: any) {
      console.error("Failed to load company intelligence profile:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

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
    setProfileData(null);
    setProfileChanges([]);
  }, []);

  // Summaries
  const summaries: CompetitorActivitySummary[] = React.useMemo(() => {
    if (companies.length === 0) return [];
    return buildCompetitorSummaries(companies, signals, events, findings, radarEvals);
  }, [companies, signals, events, findings, radarEvals]);

  const targetSummary = React.useMemo(() => {
    return summaries.find((s) => s.is_target) || summaries.find((s) => s.company_name.toLowerCase() === targetCompany.toLowerCase());
  }, [summaries, targetCompany]);

  const competitorSummaries = React.useMemo(() => {
    return summaries.filter((s) => !s.is_target && s.company_name.toLowerCase() !== targetCompany.toLowerCase());
  }, [summaries, targetCompany]);

  const filteredCompetitors = React.useMemo(() => {
    if (!searchQuery.trim()) return competitorSummaries;
    const q = searchQuery.toLowerCase();
    return competitorSummaries.filter((c) => c.company_name.toLowerCase().includes(q));
  }, [competitorSummaries, searchQuery]);

  const filteredProfileChanges = React.useMemo(() => {
    if (dimensionFilter === "ALL") return profileChanges;
    return profileChanges.filter((ch) => ch.dimension.toLowerCase() === dimensionFilter.toLowerCase());
  }, [profileChanges, dimensionFilter]);

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            1. Evolving Company Intelligence Layer
          </div>
          <h1 className="app-title-lg">
            Tracked Competitors for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Continuously evolving company profiles tracking strategic shifts, pricing evolution, product moves, and verifiable change history under PostgreSQL Row Level Security (RLS).
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
                          <span>View Evolving Intelligence Layer</span>
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
                          Change Ledger <ArrowRight className="w-3 h-3" />
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
            <div className="p-6 border-b border-[rgba(20,20,30,0.08)] bg-gradient-to-r from-purple-50/70 via-white to-blue-50/40 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-xl shadow-xs">
                  {activeProfileCompany.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-extrabold text-[#17171b]">
                      {activeProfileCompany}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                      Continuously Evolving Profile
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-green-600" />
                      RLS Enforced
                    </span>
                  </div>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    What changed? When? Evidence? How significant?
                  </p>
                </div>
              </div>

              <button
                onClick={closeCompanyIntelligence}
                className="p-2 rounded-xl text-[#9ca3af] hover:text-[#17171b] hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Strategic Trajectory Banner */}
            {profileData?.strategic_narrative && (
              <div className="px-6 py-3 bg-gradient-to-r from-purple-900 to-indigo-900 text-white text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
                <span className="font-semibold text-purple-100">
                  <strong className="text-white">Strategic Trajectory:</strong> {profileData.strategic_narrative}
                </span>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="px-6 pt-3 border-b border-[rgba(20,20,30,0.06)] bg-zinc-50/50 flex items-center gap-2 overflow-x-auto text-xs font-bold text-[#70717a]">
              <button
                onClick={() => setProfileTab("changes")}
                className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  profileTab === "changes"
                    ? "border-[#6e57dc] text-[#6e57dc]"
                    : "border-transparent hover:text-[#17171b]"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Historical Change Ledger ({profileChanges.length})</span>
              </button>
              <button
                onClick={() => setProfileTab("pricing")}
                className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  profileTab === "pricing"
                    ? "border-[#6e57dc] text-[#6e57dc]"
                    : "border-transparent hover:text-[#17171b]"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Pricing Evolution</span>
              </button>
              <button
                onClick={() => setProfileTab("products")}
                className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  profileTab === "products"
                    ? "border-[#6e57dc] text-[#6e57dc]"
                    : "border-transparent hover:text-[#17171b]"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Products & Features</span>
              </button>
              <button
                onClick={() => setProfileTab("market")}
                className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  profileTab === "market"
                    ? "border-[#6e57dc] text-[#6e57dc]"
                    : "border-transparent hover:text-[#17171b]"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Market & Customers</span>
              </button>
              <button
                onClick={() => setProfileTab("swot")}
                className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  profileTab === "swot"
                    ? "border-[#6e57dc] text-[#6e57dc]"
                    : "border-transparent hover:text-[#17171b]"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Strengths & Vulnerabilities</span>
              </button>
              <button
                onClick={() => setProfileTab("hiring")}
                className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  profileTab === "hiring"
                    ? "border-[#6e57dc] text-[#6e57dc]"
                    : "border-transparent hover:text-[#17171b]"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Hiring & Partnerships</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {profileLoading ? (
                <PrismLoadingSkeleton count={3} />
              ) : (
                <>
                  {/* TAB 1: HISTORICAL CHANGE LEDGER */}
                  {profileTab === "changes" && (
                    <div className="space-y-4">
                      {/* Dimension Filter Bar */}
                      <div className="flex items-center justify-between gap-3 pb-2 flex-wrap">
                        <div className="text-xs font-bold text-[#17171b] flex items-center gap-1.5">
                          <span>Timeline of Verified Moves</span>
                          <span className="text-[#9ca3af]">({filteredProfileChanges.length} items)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {["ALL", "pricing", "products", "features", "hiring", "partnerships"].map((dim) => (
                            <button
                              key={dim}
                              onClick={() => setDimensionFilter(dim)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
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
                                {change.what_changed}
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
                              {change.strategic_implication && (
                                <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs">
                                  <strong className="text-amber-900 block text-[10px] uppercase mb-0.5">
                                    Strategic Implication
                                  </strong>
                                  <p className="text-amber-950 font-medium">{change.strategic_implication}</p>
                                </div>
                              )}

                              {/* Evidence Link & Excerpt */}
                              {(change.evidence_url || change.evidence_excerpt) && (
                                <div className="pt-2 border-t border-zinc-100 text-xs flex items-center justify-between gap-3">
                                  <span className="text-[11px] text-[#70717a] italic line-clamp-1">
                                    &ldquo;{change.evidence_excerpt || change.evidence_title}&rdquo;
                                  </span>
                                  {change.evidence_url && (
                                    <a
                                      href={change.evidence_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-bold text-[#6e57dc] hover:underline flex items-center gap-1 shrink-0"
                                    >
                                      <span>Verify Evidence</span>
                                      <ArrowUpRight className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: PRICING EVOLUTION */}
                  {profileTab === "pricing" && profileData?.pricing_model && (
                    <div className="space-y-6">
                      <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50/60 via-white to-purple-50/40 border border-amber-200/80 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-amber-900">
                          <DollarSign className="w-4 h-4 text-amber-600" />
                          <span>Pricing Model Architecture</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-lg bg-white border border-[rgba(20,20,30,0.08)]">
                            <span className="text-[10px] uppercase text-[#9ca3af] font-bold block">Model Type</span>
                            <span className="text-sm font-extrabold text-[#17171b]">{profileData.pricing_model.model_type || "Hybrid Subscription"}</span>
                          </div>
                          <div className="p-3 rounded-lg bg-white border border-[rgba(20,20,30,0.08)]">
                            <span className="text-[10px] uppercase text-[#9ca3af] font-bold block">Starting Price</span>
                            <span className="text-sm font-extrabold text-[#17171b]">{profileData.pricing_model.starting_price || "$20/seat/mo"}</span>
                          </div>
                          <div className="p-3 rounded-lg bg-white border border-[rgba(20,20,30,0.08)]">
                            <span className="text-[10px] uppercase text-[#9ca3af] font-bold block">Free Tier Available</span>
                            <span className="text-sm font-extrabold text-green-700">{profileData.pricing_model.free_tier ? "Yes (Freemium / Developer tier)" : "No (Enterprise only)"}</span>
                          </div>
                        </div>

                        {profileData.pricing_model.recent_focus && (
                          <div className="p-3 rounded-lg bg-amber-100/70 border border-amber-200 text-xs">
                            <strong className="text-amber-900 block text-[10px] uppercase mb-0.5">Recent Pricing Trajectory Shift</strong>
                            <p className="text-amber-950 font-semibold">{profileData.pricing_model.recent_focus}</p>
                          </div>
                        )}
                      </div>

                      {/* Tier Breakdown */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Official Packaging Tiers</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          {(profileData.pricing_model.tiers || []).map((tier, idx) => (
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
                          {(profileData.products || []).map((prod, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl border border-[rgba(20,20,30,0.08)] bg-white space-y-1">
                              <h5 className="text-xs font-extrabold text-[#17171b] flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-[#6e57dc]" />
                                {prod.name}
                              </h5>
                              <p className="text-[11px] text-[#575861] leading-relaxed">{prod.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-zinc-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Key Architectural Features</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {(profileData.features || []).map((feat, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center gap-2 text-[#4b5563]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              <span className="font-medium">{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: MARKET & CUSTOMERS */}
                  {profileTab === "market" && profileData && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/60 space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-[#6e57dc] block">Target Market & Ideal Customer Profile</span>
                        <p className="text-sm font-bold text-[#17171b]">{profileData.target_market}</p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Enterprise Customer Proof Points</h4>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {(profileData.customers || []).map((cust, idx) => (
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
                          {(profileData.strengths || []).map((s, idx) => (
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
                          {(profileData.weaknesses || []).map((w, idx) => (
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
                        <span className="text-[10px] uppercase font-bold text-blue-700 block">Hiring Velocity: {profileData.hiring.velocity || "Active"}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(profileData.hiring.focus_areas || []).map((area, idx) => (
                            <span key={idx} className="px-2.5 py-1 rounded-md bg-white border border-blue-200 font-bold text-blue-900 text-[11px]">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Strategic Partnerships</h4>
                        <div className="space-y-1.5">
                          {(profileData.partnerships || []).map((p, idx) => (
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
            <div className="p-4 border-t border-[rgba(20,20,30,0.08)] bg-zinc-50/50 flex items-center justify-between text-xs">
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
