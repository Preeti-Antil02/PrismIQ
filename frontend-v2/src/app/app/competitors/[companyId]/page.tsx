"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchTrackedCompanies,
  fetchSignals,
  fetchEvents,
  fetchFindings,
  fetchLatestRadar,
  buildCompetitorSummaries,
  type CompetitorActivitySummary,
  type ConsolidatedEventRecord,
  type FindingRecord,
  type RadarEvaluation,
} from "@/lib/api";
import { SignalSourceBadge } from "@/components/shared/SignalSourceBadge";
import { ClassifierBadge } from "@/components/shared/ClassifierBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { EvidenceDrawer, type EvidenceDrawerData } from "@/components/shared/EvidenceDrawer";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import {
  normalizeClassifierState,
  type ClassifierState,
  type ConfidenceLevel,
} from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Crown,
  Activity,
  Radio,
  CalendarDays,
  Radar,
  Code,
  Briefcase,
  DollarSign,
  Shield,
  Microscope,
  Newspaper,
  ExternalLink,
  Scale,
  AlertCircle,
  Layers,
} from "lucide-react";

// ============================================================================
// Category mapping: signal source → product dimension (spec § 3.7)
// ============================================================================

interface CategoryConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  sources: string[]; // signal source keys that map to this category
}

const CATEGORIES: CategoryConfig[] = [
  {
    label: "Product & Platform",
    description: "Code activity, releases, and engineering developments",
    icon: Code,
    sources: ["github"],
  },
  {
    label: "Market & News",
    description: "Industry news, announcements, and market positioning",
    icon: Newspaper,
    sources: ["news"],
  },
  {
    label: "Hiring & Talent",
    description: "Active job postings and talent acquisition signals",
    icon: Briefcase,
    sources: ["jobs"],
  },
  {
    label: "Pricing & Packaging",
    description: "Pricing changes, plan restructuring, and packaging updates",
    icon: DollarSign,
    sources: ["pricing"],
  },
  {
    label: "Research & AI Activity",
    description: "Academic research, R&D publications, and AI/ML developments",
    icon: Microscope,
    sources: ["research"],
  },
];

export default function CompetitorProfilePage() {
  const params = useParams();
  const companyId = decodeURIComponent((params?.companyId as string) || "");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<CompetitorActivitySummary | null>(null);
  const [allEvents, setAllEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [allFindings, setAllFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [drawerData, setDrawerData] = React.useState<EvidenceDrawerData | null>(null);

  const loadData = React.useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [companies, signalsRes, eventsRes, findingsRes, radarRes] = await Promise.all([
        fetchTrackedCompanies(),
        fetchSignals({ company: companyId, limit: 200 }),
        fetchEvents({ company: companyId, limit: 200 }),
        fetchFindings(),
        fetchLatestRadar(),
      ]);

      // Verify company is tracked
      const isTracked = companies.some((c) => c.company_name === companyId);
      if (!isTracked) {
        setError(`"${companyId}" is not a tracked competitor.`);
        setLoading(false);
        return;
      }

      const built = buildCompetitorSummaries(
        companies,
        signalsRes.signals,
        eventsRes.events,
        findingsRes.findings,
        radarRes.evaluations || [],
      );

      const match = built.find((s) => s.company_name === companyId);
      setSummary(match || null);

      // Keep full events/findings for this company
      setAllEvents(eventsRes.events.filter((e) => e.company_name === companyId));
      setAllFindings(findingsRes.findings.filter((f) => f.company_name === companyId));
      setRadarEvals(radarRes.evaluations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load competitor profile");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Group events by category (source type)
  const categorizedEvents = React.useMemo(() => {
    const result: Record<string, ConsolidatedEventRecord[]> = {};
    CATEGORIES.forEach((cat) => {
      result[cat.label] = [];
    });

    allEvents.forEach((event) => {
      const sources = event.contributing_sources || [];
      // Map event to category based on its primary contributing source
      const primarySource = (sources[0] || "news").toLowerCase();
      const matchedCat = CATEGORIES.find((cat) =>
        cat.sources.some((s) => primarySource.includes(s))
      );
      const catLabel = matchedCat?.label || "Product & Platform";
      if (!result[catLabel]) result[catLabel] = [];
      result[catLabel].push(event);
    });

    // Sort events within each category by published date (newest first)
    Object.keys(result).forEach((key) => {
      result[key].sort((a, b) => {
        const ta = a.published_timestamp || a.published_at || "";
        const tb = b.published_timestamp || b.published_at || "";
        return tb.localeCompare(ta);
      });
    });

    return result;
  }, [allEvents]);

  // Build findings lookup by event_id
  const findingsByEventId = React.useMemo(() => {
    const map: Record<string, FindingRecord> = {};
    allFindings.forEach((f) => {
      map[f.event_id] = f;
    });
    return map;
  }, [allFindings]);

  // Radar connections for this company
  const radarConnections = React.useMemo(() => {
    const connections: Array<{
      topic: string;
      status: ClassifierState;
      reason: string;
      evidence_count: number;
    }> = [];
    radarEvals.forEach((ev) => {
      const conns = ev.competitor_connections || {};
      let conn = conns[companyId];
      if (!conn) {
        const matchedKey = Object.keys(conns).find(
          (k) =>
            companyId.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(companyId.toLowerCase())
        );
        if (matchedKey) {
          conn = conns[matchedKey];
        }
      }
      if (conn) {
        connections.push({
          topic: ev.topic_label,
          status: normalizeClassifierState(conn.status),
          reason: conn.reason || "",
          evidence_count: conn.evidence_signals?.length || 0,
        });
      }
    });
    return connections;
  }, [radarEvals, companyId]);

  const openEvidenceDrawer = (event: ConsolidatedEventRecord) => {
    const finding = findingsByEventId[event.event_id];
    setDrawerData({
      title: event.title,
      company: companyId,
      timestamp: event.published_at,
      tier: event.tier as any,
      confidence: (event.fact_confidence || "Medium") as ConfidenceLevel,
      fact: event.event_summary || event.raw_excerpt || event.title,
      inference: finding?.why_it_matters || "Identified as a notable event through pipeline monitoring.",
      sources: [
        {
          id: event.event_id || String(Math.random()),
          title: event.title,
          url: event.url || "#",
          sourceType: (event.contributing_sources || [])[0] || "unknown",
          publishedAt: event.published_at,
        },
      ],
    });
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Back Navigation */}
        <div className="flex items-center gap-4">
          <Link
            href="/app/competitors"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Competitors
          </Link>
        </div>

        {/* Loading / Error / Not Found */}
        {loading && (
          <LoadingState layout="detail" count={4} />
        )}

        {!loading && error && (
          <ErrorState message={error} onRetry={loadData} />
        )}

        {!loading && !error && !summary && (
          <EmptyState
            title="Competitor not found"
            description={`"${companyId}" is not in your tracked competitor list.`}
          />
        )}

        {/* Profile Content */}
        {!loading && !error && summary && (
          <>
            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex items-center justify-center h-12 w-12 rounded-xl text-lg font-bold",
                  summary.is_target
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                )}>
                  {summary.company_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      {summary.company_name}
                    </h1>
                    {summary.is_target && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Crown className="h-3 w-3" />
                        Your Company
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Radio className="h-3 w-3" />
                      {summary.total_signals} signals detected
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {summary.total_events} consolidated events
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {summary.findings_count} strategic findings
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={`/app/compare?companies=${encodeURIComponent(summary.company_name)}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm shrink-0"
              >
                <Scale className="h-3.5 w-3.5" />
                Compare
              </Link>
            </div>

            {/* Signal Volume + Source Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Signal Volume Card */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Signal Activity
                </div>
                <div className="text-3xl font-bold text-slate-900">{summary.total_signals}</div>
                <p className="text-[11px] text-slate-500 mt-1">total signals this monitoring period</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(summary.signals_by_source)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => (
                      <SignalSourceBadge key={source} source={source} count={count} />
                    ))}
                  {Object.keys(summary.signals_by_source).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No signals detected</p>
                  )}
                </div>
              </div>

              {/* Tier Breakdown Card */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Event Severity
                </div>
                <div className="space-y-2">
                  {["Must-Know", "Should-Know", "Nice-to-Know"].map((tier) => {
                    const count = summary.events_by_tier[tier] || 0;
                    return (
                      <div key={tier} className="flex items-center justify-between">
                        <TierBadge tier={tier as any} />
                        <span className="text-sm font-bold text-slate-900">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Radar Connections Card */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Radar className="h-3.5 w-3.5" />
                  Research Radar
                </div>
                {radarConnections.length > 0 ? (
                  <div className="space-y-2.5">
                    {radarConnections.map((conn) => (
                      <div key={conn.topic} className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <ClassifierBadge state={conn.status} />
                          <span className="text-xs font-medium text-slate-800 truncate" title={conn.topic}>
                            {conn.topic}
                          </span>
                        </div>
                        {conn.evidence_count > 0 && (
                          <p className="text-[10px] text-slate-500 pl-1">
                            {conn.evidence_count} evidence {conn.evidence_count === 1 ? "signal" : "signals"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    No radar topics configured
                  </p>
                )}
              </div>
            </div>

            {/* Category-Grouped Events */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-900">
                Recent Movement by Category
              </h2>
              {CATEGORIES.map((cat) => {
                const events = categorizedEvents[cat.label] || [];
                const Icon = cat.icon;
                return (
                  <div key={cat.label} className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Category Header */}
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-slate-600" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{cat.label}</h3>
                          <p className="text-[10px] text-slate-500">{cat.description}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {events.length} {events.length === 1 ? "event" : "events"}
                      </span>
                    </div>

                    {/* Events List */}
                    {events.length === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <AlertCircle className="h-5 w-5 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-400">
                          No new activity this period
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {events.slice(0, 8).map((event) => {
                          const finding = findingsByEventId[event.event_id];
                          return (
                            <div
                              key={event.event_id}
                              className="px-5 py-3 hover:bg-slate-50/50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                  <TierBadge tier={event.tier as any} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-medium text-slate-800 line-clamp-2">
                                      {event.title}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {event.url && (
                                        <a
                                          href={event.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-slate-400 hover:text-blue-600 transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => openEvidenceDrawer(event)}
                                        className="text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap cursor-pointer"
                                      >
                                        Evidence →
                                      </button>
                                    </div>
                                  </div>
                                  {finding?.why_it_matters && (
                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                      {finding.why_it_matters}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <ConfidenceBadge
                                      level={(event.fact_confidence || "Medium") as ConfidenceLevel}
                                    />
                                    {event.corroboration_count > 1 && (
                                      <span className="text-[10px] text-slate-500">
                                        {event.corroboration_count} corroborating sources
                                      </span>
                                    )}
                                    {event.published_at && (
                                      <span className="text-[10px] text-slate-400">
                                        {event.published_at}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {events.length > 8 && (
                          <div className="px-5 py-2.5 text-center text-[11px] text-slate-500 bg-slate-50/50">
                            +{events.length - 8} more events in this category
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Evidence Drawer */}
      <EvidenceDrawer
        data={drawerData}
        isOpen={!!drawerData}
        onClose={() => setDrawerData(null)}
      />
    </AppLayout>
  );
}
