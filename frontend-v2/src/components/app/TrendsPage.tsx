"use client";

import * as React from "react";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  GitBranch,
  Newspaper,
  Briefcase,
  DollarSign,
  ChevronRight,
  ExternalLink,
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
  fetchEvents,
  fetchSignals,
  fetchTrackedCompanies,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type TrackedCompany,
} from "@/lib/api";

export function TrendsPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, signalsRes, compsRes] = await Promise.all([
        fetchEvents({ limit: 150 }),
        fetchSignals({ limit: 300 }),
        fetchTrackedCompanies(),
      ]);
      setEvents(eventsRes.events || []);
      setSignals(signalsRes.signals || []);
      setCompanies(compsRes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Trend Metrics from Real Data
  const sourceBreakdown = React.useMemo(() => {
    const counts: Record<string, number> = {
      news: 0,
      github: 0,
      jobs: 0,
      pricing: 0,
      research: 0,
    };
    signals.forEach((s) => {
      const src = (s.source || "news").toLowerCase();
      if (src.includes("github")) counts.github = (counts.github || 0) + 1;
      else if (src.includes("job") || src.includes("career")) counts.jobs = (counts.jobs || 0) + 1;
      else if (src.includes("pricing")) counts.pricing = (counts.pricing || 0) + 1;
      else if (src.includes("research")) counts.research = (counts.research || 0) + 1;
      else counts.news = (counts.news || 0) + 1;
    });
    const total = signals.length || 1;
    return Object.entries(counts).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [signals]);

  const tierBreakdown = React.useMemo(() => {
    const counts = { must: 0, should: 0, nice: 0 };
    events.forEach((e) => {
      const t = (e.tier || "").toLowerCase();
      if (t.includes("must")) counts.must++;
      else if (t.includes("should")) counts.should++;
      else counts.nice++;
    });
    const total = events.length || 1;
    return {
      must: { count: counts.must, pct: Math.round((counts.must / total) * 100) },
      should: { count: counts.should, pct: Math.round((counts.should / total) * 100) },
      nice: { count: counts.nice, pct: Math.round((counts.nice / total) * 100) },
    };
  }, [events]);

  const companyActivityShare = React.useMemo(() => {
    const map: Record<string, { events: number; signals: number }> = {};
    companies.forEach((c) => {
      map[c.company_name] = { events: 0, signals: 0 };
    });
    events.forEach((e) => {
      if (map[e.company_name]) map[e.company_name].events++;
      else map[e.company_name] = { events: 1, signals: 0 };
    });
    signals.forEach((s) => {
      if (map[s.company_name]) map[s.company_name].signals++;
      else map[s.company_name] = { events: 0, signals: 1 };
    });
    const maxSignals = Math.max(...Object.values(map).map((v) => v.signals), 1);
    return Object.entries(map).map(([name, val]) => ({
      name,
      events: val.events,
      signals: val.signals,
      relativePct: Math.round((val.signals / maxSignals) * 100),
    }));
  }, [companies, events, signals]);

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Competitive Trend Dynamics
          </div>
          <h1 className="app-title-lg">
            Market & Signal Trends for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Derived trends calculated strictly from persisted signal velocities, multi-source channel distributions, and tier impact severities.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Trends</span>
        </PrismButton>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={4} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Compute Trends"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : events.length === 0 && signals.length === 0 ? (
        <PrismEmptyState
          icon={<TrendingUp className="w-6 h-6" />}
          title="No Trend Data Yet"
          description={`PrismIQ needs validated events and signals to derive trends for ${targetCompany}. Run an intelligence sweep to populate your trend baseline.`}
          actionText="Trigger Sweep"
          actionHref="/app"
        />
      ) : (
        <div className="space-y-10">
          {/* 1. Macro Breakdown Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Footprint Chart */}
            <PrismCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="app-title-sm">Monitored Source Distribution</h3>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    Signal share by channel across {signals.length} validated items
                  </p>
                </div>
                <PieChart className="w-4 h-4 text-[#6e57dc]" />
              </div>

              <div className="space-y-3 pt-2">
                {sourceBreakdown.map((src) => (
                  <div key={src.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#17171b]">{src.name}</span>
                      <span className="text-[#70717a] font-bold">
                        {src.count} ({src.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#6e57dc] to-[#72d7e8] transition-all duration-500"
                        style={{ width: `${Math.max(src.pct, 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </PrismCard>

            {/* Impact Tier Distribution */}
            <PrismCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="app-title-sm">Event Impact Breakdown</h3>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    Distribution of {events.length} validated events by tier urgency
                  </p>
                </div>
                <BarChart3 className="w-4 h-4 text-[#6e57dc]" />
              </div>

              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-700 flex items-center gap-1.5">
                      <PrismTierBadge tier="Must-Know" size="sm" />
                      Critical Decisions
                    </span>
                    <span className="font-extrabold text-rose-700">
                      {tierBreakdown.must.count} ({tierBreakdown.must.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-rose-200/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-600 transition-all duration-500"
                      style={{ width: `${tierBreakdown.must.pct}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-700 flex items-center gap-1.5">
                      <PrismTierBadge tier="Should-Know" size="sm" />
                      Strategic Shifts
                    </span>
                    <span className="font-extrabold text-blue-700">
                      {tierBreakdown.should.count} ({tierBreakdown.should.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-blue-200/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${tierBreakdown.should.pct}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-700 flex items-center gap-1.5">
                      <PrismTierBadge tier="Nice-to-Know" size="sm" />
                      Background Signals
                    </span>
                    <span className="font-extrabold text-zinc-700">
                      {tierBreakdown.nice.count} ({tierBreakdown.nice.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-500 transition-all duration-500"
                      style={{ width: `${tierBreakdown.nice.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </PrismCard>
          </div>

          {/* 2. Company Relative Activity Velocity */}
          <div>
            <PrismSectionHeader
              title="Competitor Activity Share"
              subtitle="Relative signal momentum across your tracked competitive universe."
              eyebrow="Market Velocity"
            />

            <div className="app-card p-6">
              <div className="space-y-4">
                {companyActivityShare.map((comp) => (
                  <div key={comp.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <PrismCompanyBadge
                        name={comp.name}
                        isTarget={comp.name.toLowerCase() === targetCompany.toLowerCase()}
                        size="sm"
                      />
                      <div className="flex items-center gap-3 text-[#70717a] font-medium text-xs">
                        <span>{comp.events} events</span>
                        <span>•</span>
                        <span>
                          <strong>{comp.signals}</strong> signals
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#6e57dc] via-[#a36de8] to-[#35a9c2] transition-all duration-500"
                        style={{ width: `${Math.max(comp.relativePct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. High-Velocity Events Behind the Trends */}
          <div>
            <PrismSectionHeader
              title="Underlying Events Driving Trends"
              subtitle="The specific corroborated developments contributing to current momentum."
              eyebrow="Trend Drivers"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.slice(0, 4).map((ev) => (
                <PrismCard
                  key={ev.event_id}
                  interactive
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
                  className="p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <PrismCompanyBadge
                        name={ev.company_name}
                        isTarget={ev.company_name.toLowerCase() === targetCompany.toLowerCase()}
                        size="sm"
                      />
                      <PrismTierBadge tier={ev.tier} />
                    </div>
                    <h3 className="font-bold text-sm text-[#17171b] line-clamp-2 mb-1.5">
                      {ev.title}
                    </h3>
                    {ev.why_it_matters && (
                      <p className="text-xs text-[#70717a] line-clamp-2 leading-relaxed">
                        {ev.why_it_matters}
                      </p>
                    )}
                  </div>
                  <div className="pt-3 mt-3 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-[11px] text-[#9ca3af]">
                    <span>{ev.published_timestamp || ev.published_at || "Recent"}</span>
                    <span className="font-semibold text-[#6e57dc] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {ev.corroboration_count || 1} sources
                    </span>
                  </div>
                </PrismCard>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
