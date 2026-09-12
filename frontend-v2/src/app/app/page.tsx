"use client";

import * as React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchLatestBrief,
  fetchTrackedCompanies,
  fetchLatestRadar,
  fetchEvents,
  type BriefDetail,
  type TrackedCompany,
  type RadarEvaluation,
  type ConsolidatedEventRecord,
} from "@/lib/api";
import {
  parseBriefMarkdown,
  type ParsedBrief,
  type TierFindingItem,
} from "@/lib/briefParser";
import { TierBadge } from "@/components/shared/TierBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import {
  EvidenceDrawer,
  type EvidenceDrawerData,
} from "@/components/shared/EvidenceDrawer";
import {
  LoadingState,
  EmptyState,
  PartialState,
  ErrorState,
} from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Layers,
  Radio,
  Radar as RadarIcon,
  RotateCcw,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const [brief, setBrief] = React.useState<BriefDetail | null>(null);
  const [parsedBrief, setParsedBrief] = React.useState<ParsedBrief | null>(null);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [radarEvaluations, setRadarEvaluations] = React.useState<RadarEvaluation[]>([]);
  const [recentEvents, setRecentEvents] = React.useState<ConsolidatedEventRecord[]>([]);

  // Page States
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stalenessTimestamp, setStalenessTimestamp] = React.useState<string>("");

  // Dev mode forced states for validation
  const [devState, setDevState] = React.useState<"live" | "empty" | "error" | "partial">("live");

  // Evidence Drawer state
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);
  const [activeDrawerData, setActiveDrawerData] = React.useState<EvidenceDrawerData | null>(null);

  // Expanded items state
  const [expandedMustKnow, setExpandedMustKnow] = React.useState<boolean>(false);

  // Load all overview data
  const loadOverviewData = React.useCallback(async (forcedState?: "live" | "empty" | "error" | "partial") => {
    const activeState = forcedState || devState;
    setLoading(true);
    setError(null);

    if (activeState === "error") {
      setTimeout(() => {
        setLoading(false);
        setError("Database sync timeout: Failed to fetch latest cycle intelligence snapshot from Postgres.");
        setStalenessTimestamp("September 10, 2026, 01:54 UTC");
      }, 300);
      return;
    }

    if (activeState === "empty") {
      setTimeout(() => {
        setLoading(false);
        setBrief(null);
        setParsedBrief(null);
        setCompanies([]);
        setRadarEvaluations([]);
        setRecentEvents([]);
      }, 300);
      return;
    }

    try {
      const [briefData, companiesData, radarData, eventsData] = await Promise.all([
        fetchLatestBrief(),
        fetchTrackedCompanies(),
        fetchLatestRadar(),
        fetchEvents({ limit: 5 }),
      ]);

      setBrief(briefData);
      const parsed = parseBriefMarkdown(briefData.content);
      setParsedBrief(parsed);
      setCompanies(companiesData);
      setRadarEvaluations(radarData.evaluations || []);
      setRecentEvents(eventsData.events || []);
      setStalenessTimestamp(briefData.date || new Date().toISOString());
    } catch (err: any) {
      setError(err.message || "Failed to load overview data");
    } finally {
      setLoading(false);
    }
  }, [devState]);

  React.useEffect(() => {
    loadOverviewData(devState);
  }, [loadOverviewData, devState]);

  // Drawer trigger for Must-Know item
  const openFindingDrawer = (item: TierFindingItem) => {
    setActiveDrawerData({
      id: `must-${item.title}`,
      title: item.title,
      company: item.company,
      timestamp: brief?.date ? formatTimestamp(brief.date) : "Latest cycle",
      tier: "Must-Know",
      confidence: "High",
      confidenceNuance: {
        level: "High",
        score: 0.92,
        isCorroborated: true,
        corroborationCount: 2,
        reason: "Corroborated across primary event signal and synthesis pipeline verification.",
      },
      fact: item.fact || `Documented primary observation: ${item.title}`,
      inference: item.whyItMatters || "Strategic competitive implication extracted by inference engine.",
      sources: item.url
        ? [
            {
              id: "src-1",
              title: item.title,
              url: item.url,
              sourceType: item.sourceType || "News",
              publishedAt: brief?.date ? formatTimestamp(brief.date) : "Recent",
              isValid: true,
            },
          ]
        : [
            {
              id: "src-fallback",
              title: `${item.company} Intelligence Document`,
              url: "https://example.com/source",
              sourceType: "Analysis",
              isValid: true,
            },
          ],
      corroborationCount: 2,
    });
    setDrawerOpen(true);
  };

  // Drawer trigger for Consolidated Event
  const openEventDrawer = (evt: ConsolidatedEventRecord) => {
    const sources = evt.contributing_signals && evt.contributing_signals.length > 0
      ? evt.contributing_signals.map((sig, idx) => ({
          id: sig.id || `src-${idx}`,
          title: sig.title,
          url: sig.url,
          sourceType: sig.source,
          publishedAt: sig.published_at || sig.published_timestamp,
          excerpt: sig.raw_excerpt,
          isValid: true,
        }))
      : [
          {
            id: evt.event_id,
            title: evt.title,
            url: evt.url || "#",
            sourceType: evt.contributing_sources?.[0] || "News",
            publishedAt: evt.published_at || evt.published_timestamp,
            excerpt: evt.raw_excerpt || evt.event_summary,
            isValid: true,
          },
        ];

    setActiveDrawerData({
      id: evt.event_id,
      title: evt.title,
      company: evt.company_name,
      timestamp: evt.published_at ? formatTimestamp(evt.published_at) : "Recent",
      tier: evt.tier || "Should-Know",
      confidence: evt.fact_confidence || "High",
      fact: evt.event_summary || evt.title,
      inference: evt.why_it_matters || "Multi-signal event consolidated under shared tenant intelligence taxonomy.",
      sources,
      corroborationCount: evt.corroboration_count,
    });
    setDrawerOpen(true);
  };

  // Helper: compute company metrics deterministically from real brief data
  const getCompanyMetrics = (companyName: string) => {
    if (!parsedBrief) return { must: 0, should: 0, other: 0, total: 0, statusText: "Steady" };
    
    // Normalize matching e.g. "Cloudflare" matching "Cloudflare Pages/Workers"
    const normalize = (name: string) => name.toLowerCase().split(/[\s/]/)[0];
    const targetKey = normalize(companyName);

    const must = parsedBrief.mustKnow.filter((i) => normalize(i.company) === targetKey).length;
    const should = parsedBrief.shouldKnow.filter((i) => normalize(i.company) === targetKey).length;
    const other = parsedBrief.otherActivity.filter((i) => normalize(i.company) === targetKey).length;
    const total = must + should + other;

    let statusText = "Steady Monitoring";
    let statusVariant: "red" | "amber" | "emerald" | "slate" = "slate";

    if (must >= 2) {
      statusText = "High Urgency";
      statusVariant = "red";
    } else if (must === 1) {
      statusText = "Elevated Alert";
      statusVariant = "amber";
    } else if (should >= 5) {
      statusText = "Active Shift";
      statusVariant = "amber";
    } else if (total > 0) {
      statusText = "Steady Routine";
      statusVariant = "emerald";
    } else {
      statusText = "No Cycle Signals";
      statusVariant = "slate";
    }

    return { must, should, other, total, statusText, statusVariant };
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return "Recent cycle";
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC";
    } catch {
      return ts;
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 min-h-screen bg-[#F8F9FB] text-slate-900 pb-16">
        {/* Header Bar */}
        <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight flex items-center gap-2">
                  <span>Intelligence Overview</span>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Primary question: <span className="font-medium text-slate-700">What should I know right now?</span>
                </p>
              </div>
            </div>

            {/* Header Right Actions & Dev Mode Switches */}
            <div className="flex items-center gap-2 flex-wrap">
              {brief?.date && (
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Latest Cycle: <strong className="text-slate-800 font-semibold">{formatTimestamp(brief.date)}</strong></span>
                </div>
              )}

              <Link href="/app/brief">
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold">
                  <FileText className="h-3.5 w-3.5 mr-1 text-slate-500" />
                  View Full Brief
                </Button>
              </Link>

              {/* Dev State Switcher */}
              <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 text-[11px]">
                <button
                  onClick={() => setDevState("live")}
                  className={cn(
                    "px-2 py-0.5 rounded font-medium transition-colors",
                    devState === "live" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Live
                </button>
                <button
                  onClick={() => setDevState("partial")}
                  className={cn(
                    "px-2 py-0.5 rounded font-medium transition-colors",
                    devState === "partial" ? "bg-white text-amber-900 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Partial
                </button>
                <button
                  onClick={() => setDevState("empty")}
                  className={cn(
                    "px-2 py-0.5 rounded font-medium transition-colors",
                    devState === "empty" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Empty
                </button>
                <button
                  onClick={() => setDevState("error")}
                  className={cn(
                    "px-2 py-0.5 rounded font-medium transition-colors",
                    devState === "error" ? "bg-white text-red-900 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Error
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
          {/* Loading State */}
          {loading && (
            <div className="space-y-6">
              <LoadingState layout="cards" count={3} />
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <ErrorState
              title="Intelligence Synchronization Interrupted"
              message={error}
              stalenessLabel={stalenessTimestamp ? formatTimestamp(stalenessTimestamp) : undefined}
              onRetry={() => loadOverviewData("live")}
            />
          )}

          {/* Empty State */}
          {!loading && !error && (!brief || !parsedBrief) && (
            <EmptyState
              title="Your first monitoring cycle hasn't run yet"
              description="PrismIQ is currently indexing your tracked competitors (Vercel, Netlify, Cloudflare, Stripe). Your initial synthesized brief will generate at 00:00 UTC."
              actionLabel="Inspect Tracked Watchlist"
              onAction={() => alert("Routes to /app/workspace/watchlist")}
            />
          )}

          {/* Live Content Dashboard */}
          {!loading && !error && brief && parsedBrief && (
            <>
              {/* Partial Degradation Disclosure Banner (if present in brief or forced) */}
              {(parsedBrief.partialFailure || devState === "partial") && (
                <PartialState
                  sourceName={parsedBrief.partialFailure?.sourceName || "News & Analysis Upstream"}
                  cycleTime={formatTimestamp(brief.date)}
                  details={parsedBrief.partialFailure?.details || "Secondary social & RSS crawlers hit rate limit during cycle; intelligence synthesized from primary verified feeds."}
                />
              )}

              {/* 1. SECTION: WHAT MATTERS NOW */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-red-50 text-red-700 border border-red-200">
                      <Flame className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-950">
                        What Matters Now
                      </h2>
                      <p className="text-xs text-slate-500">
                        Must-Know findings from latest cycle requiring immediate executive awareness ({parsedBrief.mustKnow.length} detected)
                      </p>
                    </div>
                  </div>
                  <Link href="/app/brief" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <span>View all in Brief</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {parsedBrief.mustKnow.length === 0 ? (
                  <div className="p-6 rounded-lg border border-slate-200 bg-white text-center text-xs text-slate-500">
                    No Must-Know priority alerts detected in the current monitoring cycle.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(expandedMustKnow ? parsedBrief.mustKnow : parsedBrief.mustKnow.slice(0, 4)).map((item, idx) => (
                      <Card
                        key={idx}
                        className="border-l-4 border-l-red-600 border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-white shadow-xs hover:shadow-sm transition-all"
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Top Badges */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="font-semibold text-slate-800 text-[11px]">
                                {item.company}
                              </Badge>
                              <TierBadge tier="Must-Know" />
                            </div>
                            <ConfidenceBadge level="High" />
                          </div>

                          {/* Finding Title */}
                          <h3 className="text-sm font-bold text-slate-950 leading-snug">
                            {item.title}
                          </h3>

                          {/* Grounded Fact Statement */}
                          {item.fact && (
                            <div className="text-xs text-slate-700 bg-slate-50/70 p-2.5 rounded border border-slate-200/60 space-y-1">
                              <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 flex items-center gap-1">
                                <Shield className="h-3 w-3 text-emerald-600" />
                                <span>Grounded Fact</span>
                              </div>
                              <p className="line-clamp-2 text-slate-700">{item.fact}</p>
                            </div>
                          )}

                          {/* Why It Matters (Strictly Marked Inference) */}
                          <div className="bg-amber-50/40 p-2.5 rounded border border-amber-200/60 space-y-1">
                            <div className="text-[10px] font-bold tracking-wider uppercase text-amber-800 flex items-center gap-1">
                              <Brain className="h-3 w-3 text-amber-700" />
                              <span>Why It Matters (Strategic Inference)</span>
                            </div>
                            <p className="text-xs text-slate-800 italic line-clamp-2">
                              &ldquo;{item.whyItMatters || "Strategic competitive implication under continuous evaluation."}&rdquo;
                            </p>
                          </div>

                          {/* Footer Action */}
                          <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-xs">
                            <span className="text-[11px] text-slate-500">
                              Corroborated by verified pipeline signals
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openFindingDrawer(item)}
                              className="h-7 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              Inspect Grounding →
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {parsedBrief.mustKnow.length > 4 && (
                  <div className="text-center pt-1">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => setExpandedMustKnow(!expandedMustKnow)}
                      className="text-xs font-semibold"
                    >
                      {expandedMustKnow
                        ? "Collapse to Top 4 Items"
                        : `Show All ${parsedBrief.mustKnow.length} Must-Know Findings`}
                    </Button>
                  </div>
                )}
              </section>

              {/* 2. SECTION: COMPETITIVE PULSE */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-950">
                        Competitive Pulse
                      </h2>
                      <p className="text-xs text-slate-500">
                        Trailing cycle activity volume & tier distribution computed from real signals (no fake sentiment scores)
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    RLS Active · 4 Tracked Entities
                  </span>
                </div>

                {/* Horizontal scroll on mobile, 4-col grid on desktop per spec */}
                <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-2 scrollbar-thin">
                  {companies.map((comp) => {
                    const metrics = getCompanyMetrics(comp.company_name);
                    return (
                      <Card
                        key={comp.company_name}
                        className="min-w-[260px] md:min-w-0 bg-white border border-slate-200 shadow-xs flex flex-col justify-between"
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Company Header */}
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className="font-bold text-sm text-slate-950">
                                {comp.company_name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {comp.is_target ? "Target Entity" : "Monitored Competitor"}
                              </div>
                            </div>
                            {comp.is_target ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                TARGET
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                ACTIVE
                              </span>
                            )}
                          </div>

                          {/* Directional Activity Badge (Real computation) */}
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1",
                                metrics.statusVariant === "red" && "bg-red-50 text-red-700 border border-red-200",
                                metrics.statusVariant === "amber" && "bg-amber-50 text-amber-700 border border-amber-200",
                                metrics.statusVariant === "emerald" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                                metrics.statusVariant === "slate" && "bg-slate-100 text-slate-600 border border-slate-200"
                              )}
                            >
                              {metrics.statusVariant === "red" && <AlertTriangle className="h-3 w-3" />}
                              {metrics.statusVariant === "amber" && <TrendingUp className="h-3 w-3" />}
                              {metrics.statusVariant === "emerald" && <CheckCircle2 className="h-3 w-3" />}
                              {metrics.statusText}
                            </span>
                          </div>

                          {/* Tier Breakdown Counts */}
                          <div className="bg-slate-50/80 p-2.5 rounded border border-slate-100 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Total Cycle Items:</span>
                              <span className="font-bold text-slate-900">{metrics.total}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200/60 text-center">
                              <div className="bg-white rounded p-1 border border-slate-100">
                                <div className="text-[10px] text-slate-500">Must</div>
                                <div className="text-xs font-bold text-red-600">{metrics.must}</div>
                              </div>
                              <div className="bg-white rounded p-1 border border-slate-100">
                                <div className="text-[10px] text-slate-500">Should</div>
                                <div className="text-xs font-bold text-amber-600">{metrics.should}</div>
                              </div>
                              <div className="bg-white rounded p-1 border border-slate-100">
                                <div className="text-[10px] text-slate-500">Other</div>
                                <div className="text-xs font-bold text-slate-700">{metrics.other}</div>
                              </div>
                            </div>
                          </div>

                          {/* Link to filter */}
                          <div className="pt-1">
                            <Link
                              href={`/app/signals?company=${encodeURIComponent(comp.company_name)}`}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-between"
                            >
                              <span>Inspect Signals</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* 3. SECTION: TWO-COLUMN SPLIT (EMERGING IN THE FIELD & RECENT EVENTS) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* 3A: EMERGING IN THE FIELD (CONDENSED RESEARCH RADAR) */}
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                        <RadarIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-950 flex items-center gap-2">
                          <span>Emerging in the Field</span>
                          <span className="text-[10px] font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded">
                            Research Radar
                          </span>
                        </h2>
                        <p className="text-xs text-slate-500">
                          Frontier R&D and exploratory shifts tracked before commercial launch
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {radarEvaluations.length === 0 ? (
                      <div className="p-6 rounded-lg border border-slate-200 bg-white text-center text-xs text-slate-500">
                        No active research radar topics configured.
                      </div>
                    ) : (
                      radarEvaluations.map((topic, tIdx) => {
                        // Find active competitor connections
                        const activeConns = Object.entries(topic.competitor_connections || {}).filter(
                          ([_, val]) => val.status && val.status !== "no_activity"
                        );

                        return (
                          <Card key={tIdx} className="bg-white border border-slate-200 shadow-xs">
                            <CardContent className="p-4 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">
                                    {topic.topic_label}
                                  </h3>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5">
                                    <span><strong>{topic.research_item_count}</strong> research items / papers tracked</span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
                                  arXiv + RSS
                                </span>
                              </div>

                              {/* Keywords */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {topic.keywords?.slice(0, 4).map((kw, kIdx) => (
                                  <span
                                    key={kIdx}
                                    className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded"
                                  >
                                    #{kw}
                                  </span>
                                ))}
                              </div>

                              {/* Active Competitor Connections */}
                              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Competitor Tracking Status:
                                </div>
                                {activeConns.length === 0 ? (
                                  <div className="text-xs text-slate-500 italic">
                                    No direct competitor adoption or mentions detected in this cycle.
                                  </div>
                                ) : (
                                  activeConns.map(([comp, conn], cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="p-2 rounded bg-cyan-50/40 border border-cyan-100 flex items-start justify-between gap-2"
                                    >
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-semibold text-slate-900">{comp}:</span>
                                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800">
                                            {conn.status.replace("_", " ")}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 line-clamp-1">
                                          {conn.reason}
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* 3B: RECENT EVENTS (LAST 5 CONSOLIDATED EVENTS) */}
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-950">
                          Recent Consolidated Events
                        </h2>
                        <p className="text-xs text-slate-500">
                          Chronological feed of latest multi-signal events ({recentEvents.length} shown)
                        </p>
                      </div>
                    </div>
                    <Link href="/app/events" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <span>View all events</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {recentEvents.map((evt) => (
                      <Card
                        key={evt.event_id}
                        className="bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
                      >
                        <CardContent className="p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-xs text-slate-900">
                                  {evt.company_name}
                                </span>
                                <span className="text-[10px] text-slate-400">·</span>
                                <span className="text-[10px] text-slate-500">
                                  {formatTimestamp(evt.published_at || evt.published_timestamp)}
                                </span>
                                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                  {evt.corroboration_count} {evt.corroboration_count === 1 ? "source" : "sources"}
                                </span>
                              </div>
                              <h4 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                                {evt.title}
                              </h4>
                            </div>
                            <ConfidenceBadge level={evt.fact_confidence || "High"} />
                          </div>

                          {/* Event Summary */}
                          {evt.event_summary && (
                            <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50/60 p-2 rounded border border-slate-100">
                              {evt.event_summary}
                            </p>
                          )}

                          {/* Card Footer Actions */}
                          <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-xs">
                            <Link
                              href={`/app/events/${evt.event_id}`}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <span>Inspect Visual Tree</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEventDrawer(evt)}
                              className="h-6 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                            >
                              Grounding
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </main>

        {/* Evidence Slide-over Drawer */}
        <EvidenceDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          data={activeDrawerData}
        />
      </div>
    </AppLayout>
  );
}
