"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  CalendarDays,
  Radio,
  ExternalLink,
  ShieldCheck,
  Building2,
  Clock,
  Layers,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  Target,
  X,
  Filter,
  ArrowUpRight,
  Workflow,
  Calendar,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  PrismCard,
  PrismTierBadge,
  PrismConfidenceBadge,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismSectionHeader,
  PrismCompanyBadge,
} from "./PrismPrimitives";
import {
  fetchTrackedCompanies,
  fetchEvents,
  fetchSignals,
  fetchLatestRadar,
  fetchFindings,
  fetchWorkspaceTopics,
  buildCompetitorSummaries,
  fetchDecisionSupportItems,
  fetchCompetitiveSequences,
  fetchHighImpactChanges,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type ResearchTopic,
  type CompetitorActivitySummary,
  type DecisionSupportRecord,
  type DecisionSupportEvidence,
  type CompetitiveSequenceRecord,
  type SequenceStep,
  type HighImpactChangeRecord,
} from "@/lib/api";

function getDepartmentBadgeClass(dept: string): string {
  const d = dept.toLowerCase();
  if (d.includes("product")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (d.includes("sales")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (d.includes("market")) return "bg-violet-50 text-violet-700 border-violet-200";
  if (d.includes("engineer")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (d.includes("leader") || d.includes("exec")) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-purple-50 text-[#6e57dc] border-purple-200";
}

function getUrgencyBadgeConfig(urgency: string): { bg: string; text: string; border: string; dot: string } {
  const u = (urgency || "").toLowerCase();
  if (u.includes("high")) return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };
  if (u.includes("med")) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" };
  return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" };
}

const DIMENSION_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  hiring: { bg: "bg-blue-50/80", text: "text-blue-700", border: "border-blue-200", label: "Hiring Signal" },
  compliance: { bg: "bg-emerald-50/80", text: "text-emerald-700", border: "border-emerald-200", label: "Compliance & Security" },
  pricing: { bg: "bg-amber-50/80", text: "text-amber-700", border: "border-amber-200", label: "Pricing Structure" },
  proof: { bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200", label: "Case Study / Proof" },
  proof_point: { bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200", label: "Case Study / Proof" },
  go_to_market: { bg: "bg-indigo-50/80", text: "text-indigo-700", border: "border-indigo-200", label: "GTM / Field Sales" },
  partnerships: { bg: "bg-cyan-50/80", text: "text-cyan-700", border: "border-cyan-200", label: "Strategic Alliance" },
  product: { bg: "bg-violet-50/80", text: "text-violet-700", border: "border-violet-200", label: "Product Infrastructure" },
  infrastructure: { bg: "bg-teal-50/80", text: "text-teal-700", border: "border-teal-200", label: "Core Infrastructure" },
  margin_disruption: { bg: "bg-rose-50/80", text: "text-rose-700", border: "border-rose-200", label: "Disruption Vector" },
};

export function OverviewPage() {
  const { targetCompany, tenantId, triggerSweep, isSweeping } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [findings, setFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [decisionItems, setDecisionItems] = React.useState<DecisionSupportRecord[]>([]);
  const [sequences, setSequences] = React.useState<CompetitiveSequenceRecord[]>([]);
  const [highImpactChanges, setHighImpactChanges] = React.useState<HighImpactChangeRecord[]>([]);
  const [selectedImpactFilter, setSelectedImpactFilter] = React.useState<string>("ALL");
  const [selectedDept, setSelectedDept] = React.useState<string>("ALL");
  const [selectedUrgency, setSelectedUrgency] = React.useState<string>("ALL");
  const [activeEvidenceItem, setActiveEvidenceItem] = React.useState<DecisionSupportRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compsRes, eventsRes, signalsRes, findingsRes, radarRes, topicsRes, decisionRes, sequencesRes, changesRes] =
        await Promise.allSettled([
          fetchTrackedCompanies(),
          fetchEvents({ limit: 100 }),
          fetchSignals({ limit: 200 }),
          fetchFindings(),
          fetchLatestRadar(),
          fetchWorkspaceTopics(),
          fetchDecisionSupportItems(),
          fetchCompetitiveSequences(),
          fetchHighImpactChanges(),
        ]);

      if (compsRes.status === "fulfilled") setTrackedCompanies(compsRes.value || []);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value?.events || []);
      if (signalsRes.status === "fulfilled") setSignals(signalsRes.value?.signals || []);
      if (findingsRes.status === "fulfilled") setFindings(findingsRes.value?.findings || []);
      if (radarRes.status === "fulfilled") setRadarEvals(radarRes.value?.evaluations || []);
      if (topicsRes.status === "fulfilled") setTopics(topicsRes.value || []);
      if (decisionRes.status === "fulfilled") setDecisionItems(decisionRes.value?.items || []);
      if (sequencesRes.status === "fulfilled") setSequences(sequencesRes.value?.sequences || []);
      if (changesRes.status === "fulfilled") setHighImpactChanges(changesRes.value?.changes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute summaries
  const competitorSummaries: CompetitorActivitySummary[] = React.useMemo(() => {
    if (trackedCompanies.length === 0) return [];
    return buildCompetitorSummaries(trackedCompanies, signals, events, findings, radarEvals);
  }, [trackedCompanies, signals, events, findings, radarEvals]);

  // Filtered Point 3 High-Impact Changes
  const filteredHighImpactChanges = React.useMemo(() => {
    if (selectedImpactFilter === "ALL") return highImpactChanges;
    return highImpactChanges.filter(
      (c) => (c.significance_tier || "").toUpperCase() === selectedImpactFilter.toUpperCase()
    );
  }, [highImpactChanges, selectedImpactFilter]);

  // Filtered Decision Support Items
  const filteredDecisionItems = React.useMemo(() => {
    return decisionItems.filter((item) => {
      const matchDept =
        selectedDept === "ALL" ||
        (item.who_is_affected || []).some(
          (d) => d.toLowerCase() === selectedDept.toLowerCase()
        );
      const matchUrgency =
        selectedUrgency === "ALL" ||
        (item.urgency || "").toLowerCase() === selectedUrgency.toLowerCase();
      return matchDept && matchUrgency;
    });
  }, [decisionItems, selectedDept, selectedUrgency]);

  // Recent 5 verified events for quick audit
  const recentEvents = React.useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const tA = a.published_timestamp || a.published_at || "";
        const tB = b.published_timestamp || b.published_at || "";
        return tB.localeCompare(tA);
      })
      .slice(0, 5);
  }, [events]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PrismLoadingSkeleton type="hero" />
        <PrismLoadingSkeleton type="cards" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header & Quick Pulse Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#17171b]">
              Competitive Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-[#6e57dc] border border-purple-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              RLS Secured
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#70717a] mt-1">
            Real-time multi-channel surveillance across your tracked landscape.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PrismButton
            variant="light"
            size="sm"
            onClick={loadData}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </PrismButton>
          <PrismButton
            variant="dark"
            size="sm"
            onClick={triggerSweep}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-300" />
            {isSweeping ? "Sweeping..." : "Run Intelligence Sweep"}
          </PrismButton>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Tracked Landscape
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">
            {trackedCompanies.length}
          </div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>Target: <strong className="text-[#17171b]">{targetCompany}</strong></span>
            <Link href="/app/competitors" className="text-[#6e57dc] font-semibold hover:underline">
              Landscape
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Verified Canonical Events
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{events.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>{events.filter((e) => (e.corroboration_count || 1) >= 2).length} Multi-Source</span>
            <Link href="/app/events" className="text-[#6e57dc] font-semibold hover:underline">
              Feed
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Multi-Channel Signals
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{signals.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>5 Monitored Channels</span>
            <Link href="/app/signals" className="text-[#6e57dc] font-semibold hover:underline">
              Pipeline
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Decision Support Items
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{decisionItems.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>{decisionItems.filter((d) => d.urgency === "High").length} High Urgency</span>
            <span className="text-[#6e57dc] font-semibold">Point 5 Live</span>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Timeline Sequences
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{sequences.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>{sequences.reduce((acc, s) => acc + (s.sequence_steps?.length || 0), 0)} Milestones</span>
            <Link href="/app/trends" className="text-[#6e57dc] font-semibold hover:underline">
              Point 2 Live
            </Link>
          </div>
        </PrismCard>
      </div>

      {/* 2. "Why Should I Care?" Decision Support System Cockpit (Point 5) */}
      <div className="space-y-4">
        <PrismSectionHeader
          title="Why Should I Care? Decision Support Cockpit"
          subtitle="Executive synthesis answering 6 core dimensions: What happened, why it matters, who is affected, what to do, urgency, and independent multi-source verification."
          eyebrow="Point 5 • Decision Support System"
          action={
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                {filteredDecisionItems.length} Actionable Items
              </span>
            </div>
          }
        />

        {/* Filter Pills Toolbar */}
        <div className="p-3.5 bg-white rounded-xl border border-[rgba(20,20,30,0.08)] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#70717a] mr-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#9ca3af]" />
              Department:
            </span>
            {["ALL", "Product", "Sales", "Marketing", "Engineering", "Leadership"].map((dept) => {
              const active = selectedDept === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-[#6e57dc] text-white shadow-xs"
                      : "bg-zinc-100/80 text-[#70717a] hover:bg-zinc-200/70 hover:text-[#17171b]"
                  }`}
                >
                  {dept === "ALL" ? "All Departments" : dept}
                </button>
              );
            })}
          </div>

          {/* Urgency Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#70717a] mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />
              Urgency:
            </span>
            {["ALL", "High", "Medium", "Low"].map((urg) => {
              const active = selectedUrgency === urg;
              return (
                <button
                  key={urg}
                  type="button"
                  onClick={() => setSelectedUrgency(urg)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-[#17171b] text-white shadow-xs"
                      : "bg-zinc-100/80 text-[#70717a] hover:bg-zinc-200/70 hover:text-[#17171b]"
                  }`}
                >
                  {urg === "ALL" ? "All Urgencies" : urg}
                </button>
              );
            })}
          </div>
        </div>

        {/* Decision Support Cards */}
        {filteredDecisionItems.length === 0 ? (
          <PrismEmptyState
            title="No decision support items match filter"
            description="Adjust your department or urgency filter to view synthesized competitive developments."
            actionText="Reset Filters"
            onAction={() => {
              setSelectedDept("ALL");
              setSelectedUrgency("ALL");
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredDecisionItems.map((item) => {
              const urgConfig = getUrgencyBadgeConfig(item.urgency);
              const sourceCount = item.corroboration_sources_count || item.evidence_sources?.length || 3;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[rgba(20,20,30,0.10)] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Top Bar: Company Badge + Urgency + Calibrated Confidence */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <PrismCompanyBadge
                          name={item.company_name}
                          isTarget={item.company_name.toLowerCase() === targetCompany.toLowerCase()}
                          size="sm"
                        />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1.5 ${urgConfig.bg} ${urgConfig.text} ${urgConfig.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${urgConfig.dot}`} />
                          {item.urgency} Urgency
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                          {item.confidence}% Calibrated Confidence
                        </span>
                      </div>
                    </div>

                    {/* Dimension 1: What Happened? */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6e57dc]" />
                        1. What Happened?
                      </div>
                      <p className="text-sm font-bold text-[#17171b] leading-snug">
                        {item.what_happened}
                      </p>
                    </div>

                    {/* Dimension 2: Why Does It Matter? */}
                    <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100/90">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] mb-1 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        2. Why It Matters
                      </div>
                      <p className="text-xs text-[#374151] leading-relaxed">
                        {item.why_it_matters}
                      </p>
                    </div>

                    {/* Dimension 3: Who Is Affected? */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1.5 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#9ca3af]" />
                        3. Who Is Affected:
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(item.who_is_affected || []).map((dept) => (
                          <span
                            key={dept}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getDepartmentBadgeClass(dept)}`}
                          >
                            {dept}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Dimension 4: What Should We Do? */}
                    <div className="p-3.5 rounded-xl bg-zinc-900 text-white shadow-xs">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        4. Actionable Counter-Playbook: What Should We Do?
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                        {item.what_should_we_do}
                      </p>
                    </div>
                  </div>

                  {/* Dimension 5 & 6 Footer: Urgency & Evidence */}
                  <div className="mt-4 pt-3.5 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-[11px] text-[#9ca3af] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Active Intelligence"}
                    </span>

                    <button
                      type="button"
                      onClick={() => setActiveEvidenceItem(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100/80 text-[#6e57dc] border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#6e57dc]" />
                      Inspect {sourceCount} Independent Sources
                      <ArrowUpRight className="w-3 h-3 text-[#6e57dc]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Evidence Modal: Full Primary Verification Dossier */}
      {activeEvidenceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[rgba(20,20,30,0.12)] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[rgba(20,20,30,0.08)] bg-gradient-to-r from-purple-50/70 via-white to-blue-50/40 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-lg shadow-xs">
                  {activeEvidenceItem.company_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold text-[#17171b]">
                      Verified Evidence Dossier: {activeEvidenceItem.company_name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                      Point 5 Corroboration
                    </span>
                  </div>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    {activeEvidenceItem.corroboration_sources_count || activeEvidenceItem.evidence_sources?.length || 3} Independent primary verification sources supporting this decision item.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveEvidenceItem(null)}
                className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#17171b] hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Recap Box */}
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a]">
                  Development Under Review
                </div>
                <div className="text-sm font-bold text-[#17171b]">
                  {activeEvidenceItem.what_happened}
                </div>
                <div className="text-xs text-[#70717a]">
                  {activeEvidenceItem.why_it_matters}
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-[#9ca3af]">Affected:</span>
                  {(activeEvidenceItem.who_is_affected || []).map((dept) => (
                    <span
                      key={dept}
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getDepartmentBadgeClass(dept)}`}
                    >
                      {dept}
                    </span>
                  ))}
                </div>
              </div>

              {/* Independent Sources List */}
              <div>
                <div className="text-xs font-extrabold text-[#17171b] mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#6e57dc]" />
                    Corroborated Primary Sources ({(activeEvidenceItem.evidence_sources || []).length})
                  </span>
                  <span className="text-[11px] font-normal text-[#70717a]">
                    Cross-verified across documentation, release feeds, career portals & audit reports
                  </span>
                </div>

                <div className="space-y-3">
                  {(activeEvidenceItem.evidence_sources || []).map((src, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-[rgba(20,20,30,0.10)] shadow-xs hover:border-[#6e57dc]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-[#17171b] border border-zinc-200">
                          {src.source}
                        </span>
                        {src.detected_at && (
                          <span className="text-[10px] text-[#9ca3af] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(src.detected_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-[#17171b] mb-1">
                        {src.title}
                      </h4>

                      {src.excerpt && (
                        <blockquote className="text-xs text-[#4b5563] pl-2.5 my-2 border-l-2 border-[#6e57dc] bg-purple-50/30 py-1 italic rounded-r">
                          &ldquo;{src.excerpt}&rdquo;
                        </blockquote>
                      )}

                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-[#6e57dc] hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          Verify Source URL
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[rgba(20,20,30,0.08)] bg-zinc-50 flex items-center justify-between">
              <span className="text-xs text-[#70717a]">
                PrismIQ Verification Engine • Multi-source corroborate guarantee
              </span>
              <button
                type="button"
                onClick={() => setActiveEvidenceItem(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POINT 3: COMPETITIVE CHANGE DETECTION ENGINE ("THE 5 CHANGES THAT ACTUALLY MATTER") */}
      <div className="space-y-4">
        <PrismSectionHeader
          title="High-Impact Change Detection: The 5 Changes That Matter"
          subtitle="Curated detection of strategic inflection points: Pricing overhauls, Enterprise pivots, Executive hiring, Deprecations, and Strategic partnerships."
          eyebrow="Point 3 • High-Impact Change Detection"
          action={
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {highImpactChanges.filter((c) => c.significance_tier === "HIGH IMPACT").length} Critical Inflections
              </span>
            </div>
          }
        />

        {/* Change Filter Pills */}
        <div className="p-3 bg-white rounded-xl border border-[rgba(20,20,30,0.08)] shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#70717a] mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />
              Significance Tier:
            </span>
            {["ALL", "HIGH IMPACT", "MEDIUM IMPACT"].map((tier) => {
              const active = selectedImpactFilter === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedImpactFilter(tier)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-zinc-100/80 text-[#70717a] hover:bg-zinc-200/70 hover:text-[#17171b]"
                  }`}
                >
                  {tier === "ALL" ? "All Inflections" : tier}
                </button>
              );
            })}
          </div>

          <Link href="/app/events" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
            Canonical Event Ledger <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* High Impact Cards */}
        {filteredHighImpactChanges.length === 0 ? (
          <PrismCard className="p-6 text-center text-xs text-[#70717a]">
            <p className="font-bold text-[#17171b]">No high-impact shifts match filter</p>
          </PrismCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredHighImpactChanges.map((change) => {
              const isHigh = change.significance_tier === "HIGH IMPACT";
              return (
                <div
                  key={change.id}
                  className="bg-white rounded-2xl border border-[rgba(20,20,30,0.10)] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <PrismCompanyBadge
                          name={change.company_name}
                          isTarget={change.company_name.toLowerCase() === targetCompany.toLowerCase()}
                          size="sm"
                        />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                            isHigh
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? "bg-amber-500 animate-pulse" : "bg-blue-500"}`} />
                          {change.significance_tier}
                        </span>
                      </div>

                      <span className="text-[11px] font-bold text-[#70717a] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#9ca3af]" />
                        {change.window_days}-day emergence window
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-[#17171b] leading-snug">
                      {change.headline}
                    </h4>

                    <p className="text-xs text-[#4b5563] leading-relaxed">
                      {change.strategic_interpretation}
                    </p>

                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100/90 text-xs text-amber-950 font-medium">
                      <strong className="text-amber-900 block mb-0.5 font-bold">Why it matters:</strong>
                      {change.why_it_matters}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-[#17171b] border border-zinc-200">
                      {change.corroborating_signals_count} corroborated source{change.corroborating_signals_count !== 1 ? "s" : ""}
                    </span>

                    <span className="text-[11px] font-bold text-[#6e57dc]">
                      {change.confidence}% Calibrated Confidence
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* POINT 2: Historical Competitive Memory & Multi-Month Sequence Detection */}
      <div className="space-y-4">
        <PrismSectionHeader
          title="Historical Competitive Memory & Multi-Month Sequences"
          subtitle="Connecting isolated milestones across months into unified competitor intent (e.g., Hiring → Compliance → Enterprise Pricing → Case Study → Market Expansion)."
          eyebrow="Point 2 • Sequence Detection & Memory"
          action={
            <Link
              href="/app/trends"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1.5"
            >
              Full Interactive Trends Timeline <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        {sequences.length === 0 ? (
          <PrismCard className="p-6 text-center text-xs text-[#70717a]">
            <Workflow className="w-7 h-7 text-[#9ca3af] mx-auto mb-2 opacity-60" />
            <p className="font-bold text-[#17171b]">No multi-month milestone sequence active</p>
            <p className="text-[#70717a] mt-0.5">Milestones will correlate automatically once multi-period signals are captured.</p>
          </PrismCard>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sequences.slice(0, 3).map((seq) => (
              <div
                key={seq.id}
                className="bg-white rounded-2xl border border-[rgba(20,20,30,0.10)] p-5 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Sequence Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(20,20,30,0.06)]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <PrismCompanyBadge
                      name={seq.company_name}
                      isTarget={seq.company_name.toLowerCase() === targetCompany.toLowerCase()}
                      size="sm"
                    />
                    <span className="text-xs text-[#70717a] flex items-center gap-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-[#6e57dc]" />
                      {seq.time_horizon}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-50 text-[#6e57dc] border border-purple-200 flex items-center gap-1">
                      <Workflow className="w-3 h-3" />
                      {seq.sequence_steps?.length || 0} Corroborated Steps
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {seq.confidence}% Confidence
                    </span>
                  </div>
                </div>

                {/* Pattern Name & Strategic Interpretation */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6e57dc]" />
                    Detected Multi-Month Pattern
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#17171b]">
                    {seq.pattern_name}
                  </h3>
                  <p className="text-xs text-[#4b5563] mt-1 leading-relaxed">
                    {seq.strategic_interpretation}
                  </p>
                </div>

                {/* Milestone Timeline Stepper */}
                <div className="pt-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a] mb-2.5">
                    Chronological Milestone Progression:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {(seq.sequence_steps || []).map((step, sIdx) => {
                      const dStyle = DIMENSION_STYLES[step.dimension] || {
                        bg: "bg-zinc-100",
                        text: "text-zinc-800",
                        border: "border-zinc-200",
                        label: step.dimension,
                      };
                      return (
                        <div
                          key={sIdx}
                          className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-200/80 hover:bg-white hover:border-[#6e57dc]/40 transition-colors flex flex-col justify-between space-y-2"
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="font-extrabold text-[#6e57dc]">
                                Step {step.step_number || sIdx + 1}
                              </span>
                              <span className="font-semibold text-[#70717a]">
                                {step.month}
                              </span>
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border mb-1.5 ${dStyle.bg} ${dStyle.text} ${dStyle.border}`}
                            >
                              {dStyle.label}
                            </span>
                            <h4 className="text-xs font-bold text-[#17171b] leading-tight line-clamp-2">
                              {step.event_title}
                            </h4>
                          </div>

                          <div className="pt-1.5 border-t border-zinc-200/60 flex items-center justify-between text-[10px] text-[#70717a]">
                            <span>Corroboration:</span>
                            <span className="font-bold text-[#17171b]">
                              {step.signals_count} signal{step.signals_count !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actionable Counter-Playbook */}
                <div className="p-3.5 rounded-xl bg-zinc-900 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 mb-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      Recommended Counter-Action:
                    </div>
                    <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                      {seq.recommended_action}
                    </p>
                  </div>
                  <Link
                    href="/app/trends"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#6e57dc] hover:bg-[#5b45c6] text-white shrink-0 self-start sm:self-auto transition-colors flex items-center gap-1"
                  >
                    Drill Down <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Competitive Movement Strip */}
      <div>
        <PrismSectionHeader
          title="Competitive Movement & Activity Share"
          subtitle="Relative momentum across your tracked landscape based on verified signal volume and event velocity."
          eyebrow="Landscape Dynamics"
          action={
            <Link href="/app/competitors" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
              Manage Competitors <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        {competitorSummaries.length === 0 ? (
          <PrismEmptyState
            title="No competitor summaries available"
            description="Configure your tracked competitors in the workspace to monitor activity across companies."
            actionText="Configure Competitors"
            actionHref="/app/workspace/watchlist"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitorSummaries.slice(0, 6).map((comp) => (
              <PrismCard key={comp.company_name} solid className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <PrismCompanyBadge
                    name={comp.company_name}
                    isTarget={comp.is_target}
                    size="md"
                  />
                  <span className="text-[11px] font-bold text-[#70717a]">
                    {comp.total_events} Event{comp.total_events !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#70717a]">Total Signals:</span>
                    <span className="font-bold text-[#17171b]">{comp.total_signals}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#70717a]">Must-Know Events:</span>
                    <span className="font-bold text-[#e11d48]">{comp.must_know_count}</span>
                  </div>
                </div>

                {comp.recent_events.length > 0 && (
                  <div className="pt-2.5 border-t border-[rgba(20,20,30,0.06)]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                      Latest Activity
                    </div>
                    <div
                      className="text-xs font-semibold text-[#17171b] truncate hover:text-[#6e57dc] cursor-pointer"
                      onClick={() =>
                        openEvidence({
                          id: comp.recent_events[0].event_id,
                          title: comp.recent_events[0].title,
                          company_name: comp.company_name,
                          why_it_matters: comp.recent_events[0].why_it_matters,
                          url: comp.recent_events[0].url,
                          raw_excerpt: comp.recent_events[0].raw_excerpt,
                          tier: comp.recent_events[0].tier,
                        })
                      }
                    >
                      {comp.recent_events[0].title}
                    </div>
                  </div>
                )}
              </PrismCard>
            ))}
          </div>
        )}
      </div>

      {/* 5. Recent Verified Canonical Events Table */}
      <div>
        <PrismSectionHeader
          title="Recent Canonical Events"
          subtitle="Directly corroborated, multi-channel competitor moves verified by the fact-checking engine."
          eyebrow="Activity Log"
          action={
            <Link href="/app/events" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
              Full Event Feed <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        <div className="bg-white rounded-xl border border-[rgba(20,20,30,0.08)] overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-[rgba(20,20,30,0.08)] text-[10px] font-extrabold uppercase tracking-wider text-[#70717a]">
              <tr>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Event & Summary</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(20,20,30,0.06)]">
              {recentEvents.map((ev) => (
                <tr
                  key={ev.event_id}
                  className="cursor-pointer hover:bg-zinc-50/80 transition-colors"
                  onClick={() =>
                    openEvidence({
                      id: ev.event_id,
                      title: ev.title,
                      company_name: ev.company_name,
                      why_it_matters: ev.why_it_matters,
                      confidence: ev.confidence || ev.fact_confidence,
                      tier: ev.tier,
                      raw_excerpt: ev.raw_excerpt || ev.event_summary,
                      url: ev.url,
                      source: ev.contributing_sources?.[0] || "Verified Source",
                      published_timestamp: ev.published_timestamp || ev.published_at,
                      corroboration_count: ev.corroboration_count,
                    })
                  }
                >
                  <td className="whitespace-nowrap font-bold">
                    <PrismCompanyBadge
                      name={ev.company_name}
                      isTarget={ev.company_name.toLowerCase() === targetCompany.toLowerCase()}
                      size="sm"
                    />
                  </td>
                  <td className="max-w-md font-semibold text-[#17171b]">
                    <div className="line-clamp-1">{ev.title}</div>
                    {ev.why_it_matters && (
                      <div className="text-[11px] text-[#70717a] line-clamp-1 mt-0.5">
                        {ev.why_it_matters}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <PrismTierBadge tier={ev.tier} />
                  </td>
                  <td className="whitespace-nowrap">
                    <PrismConfidenceBadge confidence={ev.confidence || ev.fact_confidence} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-[#70717a]">
                    {ev.published_timestamp || ev.published_at || "Recent"}
                  </td>
                  <td className="whitespace-nowrap">
                    <button className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {ev.corroboration_count || 1} source{ev.corroboration_count !== 1 ? "s" : ""}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
