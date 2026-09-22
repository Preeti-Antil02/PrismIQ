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
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type ResearchTopic,
  type CompetitorActivitySummary,
} from "@/lib/api";

export function OverviewPage() {
  const { targetCompany, triggerSweep, isSweeping } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [findings, setFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compsRes, eventsRes, signalsRes, findingsRes, radarRes, topicsRes] =
        await Promise.allSettled([
          fetchTrackedCompanies(),
          fetchEvents({ limit: 50 }),
          fetchSignals({ limit: 200 }),
          fetchFindings(),
          fetchLatestRadar(),
          fetchWorkspaceTopics(),
        ]);

      if (compsRes.status === "fulfilled") setTrackedCompanies(compsRes.value || []);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value?.events || []);
      if (signalsRes.status === "fulfilled") setSignals(signalsRes.value?.signals || []);
      if (findingsRes.status === "fulfilled") setFindings(findingsRes.value?.findings || []);
      if (radarRes.status === "fulfilled") setRadarEvals(radarRes.value?.evaluations || []);
      if (topicsRes.status === "fulfilled") setTopics(topicsRes.value || []);
    } catch (err: any) {
      setError(err.message || "Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute summaries
  const competitorSummaries: CompetitorActivitySummary[] = React.useMemo(() => {
    if (trackedCompanies.length === 0) return [];
    return buildCompetitorSummaries(trackedCompanies, signals, events, findings, radarEvals);
  }, [trackedCompanies, signals, events, findings, radarEvals]);

  // High priority "Attention" items: Events marked Must-Know or Should-Know or with findings
  const attentionItems = React.useMemo(() => {
    // Sort events by tier severity (Must-Know > Should-Know > Nice-to-Know) and recency
    const items = [...events].sort((a, b) => {
      const tierRank = (t?: string) => {
        const lower = (t || "").toLowerCase();
        if (lower.includes("must")) return 3;
        if (lower.includes("should")) return 2;
        return 1;
      };
      const rA = tierRank(a.tier);
      const rB = tierRank(b.tier);
      if (rB !== rA) return rB - rA;
      const tA = a.published_timestamp || a.published_at || "";
      const tB = b.published_timestamp || b.published_at || "";
      return tB.localeCompare(tA);
    });
    return items.slice(0, 5);
  }, [events]);

  const recentEvents = React.useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const tA = a.published_timestamp || a.published_at || "";
        const tB = b.published_timestamp || b.published_at || "";
        return tB.localeCompare(tA);
      })
      .slice(0, 6);
  }, [events]);

  if (loading) {
    return (
      <div className="space-y-8">
        <PrismLoadingSkeleton type="hero" />
        <PrismLoadingSkeleton count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <PrismEmptyState
        title="Intelligence Temporarily Unavailable"
        description={error}
        actionText="Retry Connection"
        onAction={loadData}
      />
    );
  }

  return (
    <div className="space-y-10 pb-12">
      {/* 1. Page Introduction / Cockpit Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Competitive Intelligence Cockpit
          </div>
          <h1 className="app-title-lg">
            What deserves your attention for{" "}
            <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Real-time decision support grounded in validated competitive developments, corroborated signals, and emerging research sweeps.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <PrismButton variant="light" onClick={loadData} size="sm">
            <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Refresh</span>
          </PrismButton>
          <Link href="/app/brief" className="app-btn app-btn-dark px-4 py-2 text-xs">
            <FileText className="w-3.5 h-3.5" />
            <span>Read Latest Brief</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Tracked Competitors
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">
            {trackedCompanies.filter((c) => !c.is_target).length}
          </div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>Target: {targetCompany}</span>
            <Link href="/app/competitors" className="text-[#6e57dc] font-semibold hover:underline">
              View all
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Validated Events
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{events.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>
              {events.filter((e) => (e.tier || "").toLowerCase().includes("must")).length} Must-Know
            </span>
            <Link href="/app/events" className="text-[#6e57dc] font-semibold hover:underline">
              Timeline
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Corroborated Signals
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{signals.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>Monitored multi-source</span>
            <Link href="/app/signals" className="text-[#6e57dc] font-semibold hover:underline">
              Stream
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Research Radar Themes
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{topics.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>{radarEvals.length} evaluated items</span>
            <Link href="/app/research-radar" className="text-[#6e57dc] font-semibold hover:underline">
              Radar
            </Link>
          </div>
        </PrismCard>
      </div>

      {/* 2. Attention Section — What Deserves Attention Right Now? */}
      <div>
        <PrismSectionHeader
          title="Attention: High-Impact Developments"
          subtitle="Directly answering: What happened, why does it matter, who did it, and what evidence supports it."
          eyebrow="Priority Intelligence"
          action={
            <Link href="/app/events" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
              View all {events.length} events <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        {attentionItems.length === 0 ? (
          <PrismEmptyState
            title="No high-impact developments detected yet"
            description={`PrismIQ is continuously monitoring verified sources for ${targetCompany} and its tracked competitors. Run a sweep to collect fresh signals.`}
            actionText="Trigger Sweep"
            onAction={triggerSweep}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {attentionItems.map((item) => (
              <PrismCard
                key={item.event_id}
                interactive
                onClick={() =>
                  openEvidence({
                    id: item.event_id,
                    title: item.title,
                    company_name: item.company_name,
                    why_it_matters: item.why_it_matters,
                    confidence: item.confidence || item.fact_confidence,
                    tier: item.tier,
                    raw_excerpt: item.raw_excerpt || item.event_summary,
                    url: item.url,
                    source: item.contributing_sources?.[0] || "Verified Source",
                    published_timestamp: item.published_timestamp || item.published_at,
                    corroboration_count: item.corroboration_count,
                    contributing_signals: item.contributing_signals,
                  })
                }
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <PrismCompanyBadge
                      name={item.company_name}
                      isTarget={item.company_name.toLowerCase() === targetCompany.toLowerCase()}
                      size="sm"
                    />
                    <div className="flex items-center gap-1.5">
                      <PrismTierBadge tier={item.tier} />
                      <PrismConfidenceBadge confidence={item.confidence || item.fact_confidence} />
                    </div>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-[#17171b] leading-snug mb-2 hover:text-[#6e57dc] transition-colors">
                    {item.title}
                  </h3>

                  {item.why_it_matters ? (
                    <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100/80 mb-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] mb-0.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Why It Matters
                      </div>
                      <p className="text-xs text-[#374151] line-clamp-2 leading-relaxed">
                        {item.why_it_matters}
                      </p>
                    </div>
                  ) : item.event_summary ? (
                    <p className="text-xs text-[#70717a] line-clamp-2 leading-relaxed mb-3">
                      {item.event_summary}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[rgba(20,20,30,0.06)] text-[11px] text-[#9ca3af]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.published_timestamp || item.published_at || "Recent"}
                  </span>
                  <span className="font-semibold text-[#6e57dc] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {item.corroboration_count || 1} Evidence Source{item.corroboration_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </PrismCard>
            ))}
          </div>
        )}
      </div>

      {/* 3. Competitive Movement Strip */}
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

      {/* 4. Research Radar Field */}
      {topics.length > 0 && (
        <div>
          <PrismSectionHeader
            title="Emerging Research Radar"
            subtitle="Configured topics monitored across academic, technical, and patent disclosures."
            eyebrow="Field Radar"
            action={
              <Link href="/app/research-radar" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
                Explore Radar <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.slice(0, 3).map((topic) => (
              <PrismCard key={topic.id} solid className="p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-xs text-[#17171b]">{topic.topic_label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {topic.keywords.slice(0, 3).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-zinc-100 text-[10px] font-medium text-[#595a63]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-[11px] text-[#9ca3af]">
                  <span>Active Monitoring</span>
                  <Link href="/app/research-radar" className="text-[#6e57dc] font-semibold hover:underline">
                    View posture →
                  </Link>
                </div>
              </PrismCard>
            ))}
          </div>
        </div>
      )}

      {/* 5. Recent Validated Events Stream */}
      <div>
        <PrismSectionHeader
          title="Recent Validated Events"
          subtitle="Chronological audit stream of corroborated events with source provenance."
          eyebrow="Event Stream"
          action={
            <Link href="/app/events" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
              All events <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Event / Headline</th>
                <th>Tier</th>
                <th>Confidence</th>
                <th>Date</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
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
