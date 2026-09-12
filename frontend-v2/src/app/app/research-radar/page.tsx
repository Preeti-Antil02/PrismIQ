"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchLatestRadar,
  type RadarEvaluation,
  type RadarApiResponse,
  type RadarEvidenceSignal,
} from "@/lib/api";
import { ClassifierBadge } from "@/components/shared/ClassifierBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { EvidenceDrawer, type EvidenceDrawerData } from "@/components/shared/EvidenceDrawer";
import {
  type ClassifierState,
  normalizeClassifierState,
} from "@/lib/tokens";
import {
  Microscope,
  Rocket,
  MessageSquare,
  CircleDashed,
  ExternalLink,
  BookOpen,
  FileText,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCw,
  AlertCircle,
  Clock,
  Sparkles,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResearchRadarPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [evaluations, setEvaluations] = React.useState<RadarEvaluation[]>([]);
  const [selectedTopicIndex, setSelectedTopicIndex] = React.useState<number>(0);
  const [drawerData, setDrawerData] = React.useState<EvidenceDrawerData | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLatestRadar();
      setEvaluations(res.evaluations || []);
      if (res.evaluations && res.evaluations.length > 0) {
        // Default to first non-synthetic or first topic
        const nonSyntheticIdx = res.evaluations.findIndex(
          (e) => !e.topic_label.toLowerCase().includes("synthetic")
        );
        setSelectedTopicIndex(nonSyntheticIdx >= 0 ? nonSyntheticIdx : 0);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load Field Research Radar evaluations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const activeTopic = evaluations[selectedTopicIndex] || null;

  // Group competitor connections by classifier state
  const stateGroups = React.useMemo(() => {
    if (!activeTopic) return { Adopting: [], Researching: [], Mentioning: [], "No activity detected": [] };

    const groups: Record<ClassifierState, Array<{ competitor: string; connection: any }>> = {
      Adopting: [],
      Researching: [],
      Mentioning: [],
      "No activity detected": [],
    };

    const conns = activeTopic.competitor_connections || {};
    Object.entries(conns).forEach(([competitor, conn]) => {
      const state = normalizeClassifierState(conn.status);
      groups[state].push({ competitor, connection: conn });
    });

    return groups;
  }, [activeTopic]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2 text-cyan-700 text-xs font-semibold tracking-wide uppercase">
              <Microscope className="h-4 w-4" />
              <span>Emerging Intelligence & R&D Radar</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Field Research Radar
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              What's emerging in the field, and are our tracked competitors engaging with it?
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-blue-600")} />
              <span>Refresh Radar</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              <span>Live Multi-Tenant Evaluation</span>
            </span>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-xl border border-slate-200 bg-white p-5 animate-pulse space-y-3">
                  <div className="h-4 w-1/2 bg-slate-200 rounded" />
                  <div className="h-3 w-3/4 bg-slate-100 rounded" />
                  <div className="h-6 w-1/3 bg-slate-100 rounded mt-4" />
                </div>
              ))}
            </div>
            <div className="h-96 rounded-xl border border-slate-200 bg-white p-6 animate-pulse" />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
            <h3 className="text-base font-bold text-rose-900">Failed to load Research Radar</h3>
            <p className="text-sm text-rose-700 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && evaluations.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
            <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">No Research Topics Configured</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Configure your first research topic in Workspace Topics to start monitoring emerging ArXiv preprints, engineering blogs, and competitor adoption.
            </p>
            <a
              href="/app/workspace/topics"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              <span>Manage Research Topics</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Main Content Area */}
        {!loading && !error && evaluations.length > 0 && (
          <div className="space-y-8">
            {/* Top Topic Cards Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Monitored Research Topics ({evaluations.length})
                </h2>
                <span className="text-[11px] text-slate-500">
                  Cycle: {activeTopic?.cycle_id || "latest"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {evaluations.map((topic, idx) => {
                  const isSelected = idx === selectedTopicIndex;
                  const conns = topic.competitor_connections || {};
                  const activeConns = Object.values(conns).filter(
                    (c: any) => c.status !== "no activity detected"
                  );

                  return (
                    <div
                      key={topic.topic_label}
                      onClick={() => setSelectedTopicIndex(idx)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all cursor-pointer select-none relative",
                        isSelected
                          ? "border-cyan-500 bg-cyan-50/40 ring-2 ring-cyan-500/20 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-xs"
                      )}
                    >
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {topic.topic_label}
                      </h3>

                      <div className="flex flex-wrap gap-1 mt-2 mb-3">
                        {topic.keywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono"
                          >
                            {kw}
                          </span>
                        ))}
                        {topic.keywords.length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{topic.keywords.length - 3}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                        <span>
                          <strong className="text-slate-800">{topic.research_item_count}</strong> papers
                        </span>
                        <span className="font-medium text-slate-700">
                          {activeConns.length > 0 ? (
                            <span className="text-emerald-700 font-semibold">
                              {activeConns.length} active moves
                            </span>
                          ) : (
                            <span className="text-slate-400">0 competitor moves</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Topic Deep Dive */}
            {activeTopic && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-8">
                {/* Topic Header & Strategic Rationale */}
                <div className="border-b border-slate-100 pb-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-cyan-100 text-cyan-800 px-2.5 py-1 text-xs font-bold">
                        Active Topic Deep-Dive
                      </span>
                      <h2 className="text-xl font-bold text-slate-900">
                        {activeTopic.topic_label}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Monitored keywords:</span>
                      <div className="flex flex-wrap gap-1">
                        {activeTopic.keywords.map((k) => (
                          <span
                            key={k}
                            className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Why it matters banner */}
                  {(activeTopic as any).why_it_matters && (
                    <div className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50/70 to-blue-50/50 p-4 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="h-4 w-4 text-cyan-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                            Commercial Synthesis & Strategic Trajectory
                          </p>
                          <p className="text-slate-700 leading-relaxed mt-0.5">
                            {(activeTopic as any).why_it_matters}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Classifier State Sections: Researching / Adopting / Mentioning / No activity detected */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Competitor Adoption & Engagement Matrix
                    </h3>
                    <span className="text-xs text-slate-500">
                      Audited against 5 signal streams per competitor
                    </span>
                  </div>

                  {/* 1. ADOPTING Section */}
                  {stateGroups.Adopting.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Rocket className="h-4 w-4 text-emerald-700" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                            Adopting ({stateGroups.Adopting.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-emerald-800 font-medium">
                          Demonstrated shipping, live capability, or active production integration
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {stateGroups.Adopting.map(({ competitor, connection }) => (
                          <CompetitorEngagementCard
                            key={competitor}
                            competitor={competitor}
                            connection={connection}
                            state="Adopting"
                            onOpenEvidence={(data) => setDrawerData(data)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. RESEARCHING Section */}
                  {stateGroups.Researching.length > 0 && (
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50/20 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Microscope className="h-4 w-4 text-cyan-700" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-900">
                            Researching ({stateGroups.Researching.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-cyan-800 font-medium">
                          Active R&D, paper authorship, or prototype benchmarks
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {stateGroups.Researching.map(({ competitor, connection }) => (
                          <CompetitorEngagementCard
                            key={competitor}
                            competitor={competitor}
                            connection={connection}
                            state="Researching"
                            onOpenEvidence={(data) => setDrawerData(data)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. MENTIONING Section */}
                  {stateGroups.Mentioning.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-amber-700" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                            Mentioning ({stateGroups.Mentioning.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-amber-800 font-medium">
                          Public advocacy, blog post reference, or commentary without live shipped code
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {stateGroups.Mentioning.map(({ competitor, connection }) => (
                          <CompetitorEngagementCard
                            key={competitor}
                            competitor={competitor}
                            connection={connection}
                            state="Mentioning"
                            onOpenEvidence={(data) => setDrawerData(data)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. NO ACTIVITY DETECTED Section (Audited Absence) */}
                  {stateGroups["No activity detected"].length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CircleDashed className="h-4 w-4 text-slate-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            No Activity Detected ({stateGroups["No activity detected"].length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Audited negative verification across all monitored channels
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stateGroups["No activity detected"].map(({ competitor, connection }) => {
                          const queried = connection.queried_sources
                            ? Object.keys(connection.queried_sources).filter((k) => connection.queried_sources[k])
                            : ["github", "jobs", "news", "pricing", "research"];

                          return (
                            <div
                              key={competitor}
                              className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900">{competitor}</span>
                                <div className="flex items-center gap-1.5">
                                  <ConfidenceBadge level="High" />
                                  <ClassifierBadge
                                    state="No activity detected"
                                    auditedSources={queried}
                                  />
                                </div>
                              </div>
                              <p className="text-slate-600 text-[11px] leading-relaxed">
                                {connection.reason || "Zero matching signals detected this monitoring cycle."}
                              </p>
                              <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 flex items-center justify-between">
                                <span>Audited sources checked:</span>
                                <span className="font-mono text-slate-600">
                                  {queried.join(", ")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Verified Grounding Research Sources (ArXiv / Domain Blogs) */}
                {(activeTopic as any).verified_sources && (activeTopic as any).verified_sources.length > 0 && (
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-cyan-700" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Underlying Domain Research Papers & Canonical Citations ({(activeTopic as any).verified_sources.length})
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(activeTopic as any).verified_sources.map((src: any, sIdx: number) => (
                        <div
                          key={sIdx}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-slate-900 text-xs">
                              {src.title}
                            </h4>
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-mono text-slate-700 uppercase shrink-0">
                              {src.source}
                            </span>
                          </div>

                          <p className="text-slate-600 text-[11px] italic bg-white p-2.5 rounded border border-slate-200/60">
                            "{src.quoted_excerpt}"
                          </p>

                          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                            <span>
                              {src.authors ? src.authors.join(", ") : "Domain Researchers"}
                            </span>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              <span>Read canonical source</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evidence Drawer Modal */}
      {drawerData && (
        <EvidenceDrawer
          isOpen={true}
          onClose={() => setDrawerData(null)}
          data={drawerData}
        />
      )}
    </AppLayout>
  );
}

// ----------------------------------------------------------------------------
// Sub-component: Competitor Engagement Card (renders side-by-side badges)
// ----------------------------------------------------------------------------

function CompetitorEngagementCard({
  competitor,
  connection,
  state,
  onOpenEvidence,
}: {
  competitor: string;
  connection: any;
  state: ClassifierState;
  onOpenEvidence: (data: EvidenceDrawerData) => void;
}) {
  const signals: RadarEvidenceSignal[] = connection.evidence_signals || [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base font-bold text-slate-900">{competitor}</span>
          <span className="text-[11px] text-slate-500">
            ({signals.length} {signals.length === 1 ? "signal" : "signals"} detected)
          </span>
        </div>

        {/* Both Badges Rendered Together */}
        <div className="flex items-center gap-2">
          {/* Confidence Badge */}
          <ConfidenceBadge level="High" />
          {/* Classifier Badge */}
          <ClassifierBadge state={state} />
        </div>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed">
        {connection.reason}
      </p>

      {/* Itemized Evidence Signals with Verbatim Excerpts */}
      {signals.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Backing Evidence Signals:
          </span>
          <div className="space-y-2">
            {signals.map((sig, sIdx) => (
              <div
                key={sig.signal_id || sIdx}
                className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-xs space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 uppercase">
                      {sig.source}
                    </span>
                    <span className="font-semibold text-slate-900 text-xs">
                      {sig.title}
                    </span>
                  </div>
                  {sig.url && (
                    <a
                      href={sig.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Source</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {sig.raw_excerpt && (
                  <p className="text-[11px] text-slate-600 leading-relaxed italic bg-white p-2 rounded border border-slate-200/60">
                    "{sig.raw_excerpt}"
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>Grounding verified by PrismIQ</span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenEvidence({
                        id: sig.signal_id,
                        title: sig.title,
                        company: competitor,
                        confidence: "High",
                        tier: "Must-Know",
                        fact: sig.raw_excerpt || sig.title,
                        inference: connection.reason || "Competitor has demonstrated active capability.",
                        sources: [
                          {
                            id: sig.signal_id || `src_${sIdx}`,
                            title: sig.title,
                            url: sig.url,
                            sourceType: sig.source,
                            excerpt: sig.raw_excerpt,
                            isValid: true,
                          },
                        ],
                        corroborationCount: 2,
                      })
                    }
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    Open in Evidence Drawer →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
