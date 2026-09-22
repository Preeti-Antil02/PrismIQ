"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  GitCompare,
  CheckCircle2,
  ShieldCheck,
  CalendarDays,
  Radio,
  ExternalLink,
  ChevronDown,
  Sparkles,
  ArrowRight,
  RefreshCw,
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
  PrismSectionHeader,
} from "./PrismPrimitives";
import {
  fetchTrackedCompanies,
  fetchEvents,
  fetchSignals,
  fetchFindings,
  fetchLatestRadar,
  buildCompetitorSummaries,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type CompetitorActivitySummary,
} from "@/lib/api";

export function ComparePage() {
  const searchParams = useSearchParams();
  const initialComp = searchParams.get("comp");

  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [findings, setFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [selectedCompetitorName, setSelectedCompetitorName] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

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

      if (compsRes.status === "fulfilled") {
        const comps = compsRes.value || [];
        setCompanies(comps);
        // Default selected competitor
        const competitorOnly = comps.filter(
          (c) => !c.is_target && c.company_name.toLowerCase() !== targetCompany.toLowerCase()
        );
        if (initialComp && competitorOnly.some((c) => c.company_name.toLowerCase() === initialComp.toLowerCase())) {
          setSelectedCompetitorName(initialComp);
        } else if (competitorOnly.length > 0) {
          setSelectedCompetitorName(competitorOnly[0].company_name);
        }
      }
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value?.events || []);
      if (signalsRes.status === "fulfilled") setSignals(signalsRes.value?.signals || []);
      if (findingsRes.status === "fulfilled") setFindings(findingsRes.value?.findings || []);
      if (radarRes.status === "fulfilled") setRadarEvals(radarRes.value?.evaluations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load comparison data");
    } finally {
      setLoading(false);
    }
  }, [targetCompany, initialComp]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Summaries
  const summaries: CompetitorActivitySummary[] = React.useMemo(() => {
    if (companies.length === 0) return [];
    return buildCompetitorSummaries(companies, signals, events, findings, radarEvals);
  }, [companies, signals, events, findings, radarEvals]);

  const targetSummary = React.useMemo(() => {
    return (
      summaries.find((s) => s.is_target) ||
      summaries.find((s) => s.company_name.toLowerCase() === targetCompany.toLowerCase())
    );
  }, [summaries, targetCompany]);

  const competitorOptions = React.useMemo(() => {
    return summaries.filter(
      (s) => !s.is_target && s.company_name.toLowerCase() !== targetCompany.toLowerCase()
    );
  }, [summaries, targetCompany]);

  const selectedCompetitorSummary = React.useMemo(() => {
    return competitorOptions.find(
      (c) => c.company_name.toLowerCase() === selectedCompetitorName.toLowerCase()
    );
  }, [competitorOptions, selectedCompetitorName]);

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Direct Entity Comparison
          </div>
          <h1 className="app-title-lg">
            Compare <span className="app-gradient-text">{targetCompany}</span> vs. Competitor
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Side-by-side analysis of verified signal volume, event tier urgency, source coverage, and research radar posture.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh</span>
        </PrismButton>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={3} />
      ) : error ? (
        <PrismEmptyState
          title="Comparison Data Unavailable"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : competitorOptions.length === 0 ? (
        <PrismEmptyState
          icon={<GitCompare className="w-6 h-6" />}
          title="No Competitors Configured to Compare"
          description={`Add tracked rivals to compare head-to-head against ${targetCompany}.`}
          actionText="Add Competitors"
          actionHref="/app/workspace/watchlist"
        />
      ) : (
        <div className="space-y-8">
          {/* Competitor Selector Bar */}
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] shadow-xs">
            <span className="text-xs font-bold text-[#70717a] uppercase tracking-wider">
              Compare Target with:
            </span>
            <div className="flex flex-wrap gap-2">
              {competitorOptions.map((comp) => (
                <button
                  key={comp.company_name}
                  onClick={() => setSelectedCompetitorName(comp.company_name)}
                  className={`app-filter-btn ${
                    selectedCompetitorName.toLowerCase() === comp.company_name.toLowerCase()
                      ? "app-filter-btn-active"
                      : ""
                  }`}
                >
                  {comp.company_name}
                </button>
              ))}
            </div>
          </div>

          {/* Side-by-Side Comparison Matrix */}
          {targetSummary && selectedCompetitorSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Target Company */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50/60 via-white to-blue-50/40 border border-purple-200/80 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[rgba(20,20,30,0.06)]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6e57dc] block">
                      Target Entity
                    </span>
                    <h2 className="text-xl font-extrabold text-[#17171b]">
                      {targetSummary.company_name}
                    </h2>
                  </div>
                  <PrismCompanyBadge name={targetSummary.company_name} isTarget size="md" />
                </div>

                {/* Key Verified Metrics */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-white border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Total Signals</span>
                    <span className="text-xl font-extrabold text-[#17171b]">{targetSummary.total_signals}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Validated Events</span>
                    <span className="text-xl font-extrabold text-[#17171b]">{targetSummary.total_events}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Must-Know Updates</span>
                    <span className="text-xl font-extrabold text-rose-600">{targetSummary.must_know_count}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Should-Know Updates</span>
                    <span className="text-xl font-extrabold text-blue-600">{targetSummary.should_know_count}</span>
                  </div>
                </div>

                {/* Monitored Channel Footprint */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Source Footprint
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(targetSummary.signals_by_source).map(([src, count]) => (
                      <div key={src} className="flex items-center justify-between p-2 rounded-lg bg-white/80 border border-[rgba(20,20,30,0.05)]">
                        <span className="uppercase text-[11px] font-semibold text-[#4b5563]">{src}</span>
                        <span className="font-extrabold text-[#17171b]">{count} signals</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Events */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Recent Activity
                  </div>
                  <div className="space-y-2">
                    {targetSummary.recent_events.length === 0 ? (
                      <div className="text-xs text-[#9ca3af] italic">No events recorded.</div>
                    ) : (
                      targetSummary.recent_events.map((ev) => (
                        <div
                          key={ev.event_id}
                          onClick={() =>
                            openEvidence({
                              id: ev.event_id,
                              title: ev.title,
                              company_name: ev.company_name,
                              why_it_matters: ev.why_it_matters,
                              raw_excerpt: ev.raw_excerpt,
                              tier: ev.tier,
                              url: ev.url,
                            })
                          }
                          className="p-3 rounded-xl bg-white border border-[rgba(20,20,30,0.06)] hover:border-purple-200 cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <PrismTierBadge tier={ev.tier} />
                            <span className="text-[10px] text-[#9ca3af]">{ev.published_timestamp || ev.published_at || "Recent"}</span>
                          </div>
                          <div className="font-semibold text-[#17171b] line-clamp-2">{ev.title}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Selected Competitor */}
              <div className="p-6 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[rgba(20,20,30,0.06)]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#70717a] block">
                      Competitor Entity
                    </span>
                    <h2 className="text-xl font-extrabold text-[#17171b]">
                      {selectedCompetitorSummary.company_name}
                    </h2>
                  </div>
                  <PrismCompanyBadge name={selectedCompetitorSummary.company_name} size="md" />
                </div>

                {/* Key Verified Metrics */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Total Signals</span>
                    <span className="text-xl font-extrabold text-[#17171b]">{selectedCompetitorSummary.total_signals}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Validated Events</span>
                    <span className="text-xl font-extrabold text-[#17171b]">{selectedCompetitorSummary.total_events}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Must-Know Updates</span>
                    <span className="text-xl font-extrabold text-rose-600">{selectedCompetitorSummary.must_know_count}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-[rgba(20,20,30,0.06)]">
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Should-Know Updates</span>
                    <span className="text-xl font-extrabold text-blue-600">{selectedCompetitorSummary.should_know_count}</span>
                  </div>
                </div>

                {/* Monitored Channel Footprint */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Source Footprint
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(selectedCompetitorSummary.signals_by_source).map(([src, count]) => (
                      <div key={src} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-[rgba(20,20,30,0.05)]">
                        <span className="uppercase text-[11px] font-semibold text-[#4b5563]">{src}</span>
                        <span className="font-extrabold text-[#17171b]">{count} signals</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Events */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">
                    Recent Activity
                  </div>
                  <div className="space-y-2">
                    {selectedCompetitorSummary.recent_events.length === 0 ? (
                      <div className="text-xs text-[#9ca3af] italic">No events recorded.</div>
                    ) : (
                      selectedCompetitorSummary.recent_events.map((ev) => (
                        <div
                          key={ev.event_id}
                          onClick={() =>
                            openEvidence({
                              id: ev.event_id,
                              title: ev.title,
                              company_name: ev.company_name,
                              why_it_matters: ev.why_it_matters,
                              raw_excerpt: ev.raw_excerpt,
                              tier: ev.tier,
                              url: ev.url,
                            })
                          }
                          className="p-3 rounded-xl bg-zinc-50 border border-[rgba(20,20,30,0.06)] hover:border-zinc-300 cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <PrismTierBadge tier={ev.tier} />
                            <span className="text-[10px] text-[#9ca3af]">{ev.published_timestamp || ev.published_at || "Recent"}</span>
                          </div>
                          <div className="font-semibold text-[#17171b] line-clamp-2">{ev.title}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
