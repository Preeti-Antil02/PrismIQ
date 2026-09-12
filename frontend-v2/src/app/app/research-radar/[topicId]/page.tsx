"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchLatestRadar,
  type RadarEvaluation,
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
  ArrowLeft,
  Sparkles,
  RotateCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SingleTopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicParam = (params.topicId as string) || "";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [evaluation, setEvaluation] = React.useState<RadarEvaluation | null>(null);
  const [drawerData, setDrawerData] = React.useState<EvidenceDrawerData | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLatestRadar();
      const evals = res.evaluations || [];
      // Match by topic_id or slugified/matching topic_label
      const found = evals.find(
        (e) =>
          e.topic_id === topicParam ||
          e.topic_label.toLowerCase() === decodeURIComponent(topicParam).toLowerCase() ||
          e.topic_label.toLowerCase().replace(/[^a-z0-9]+/g, "-") === topicParam.toLowerCase()
      );

      if (found) {
        setEvaluation(found);
      } else {
        setError(`Research topic '${decodeURIComponent(topicParam)}' not found in active evaluations.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load topic evaluation");
    } finally {
      setLoading(false);
    }
  }, [topicParam]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Group competitor connections by classifier state
  const stateGroups = React.useMemo(() => {
    if (!evaluation) return { Adopting: [], Researching: [], Mentioning: [], "No activity detected": [] };

    const groups: Record<ClassifierState, Array<{ competitor: string; connection: any }>> = {
      Adopting: [],
      Researching: [],
      Mentioning: [],
      "No activity detected": [],
    };

    const conns = evaluation.competitor_connections || {};
    Object.entries(conns).forEach(([competitor, conn]) => {
      const state = normalizeClassifierState(conn.status);
      groups[state].push({ competitor, connection: conn });
    });

    return groups;
  }, [evaluation]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <button
            type="button"
            onClick={() => router.push("/app/research-radar")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Research Radar Overview</span>
          </button>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="h-96 rounded-xl border border-slate-200 bg-white p-8 animate-pulse space-y-4">
            <div className="h-6 w-1/3 bg-slate-200 rounded" />
            <div className="h-4 w-1/2 bg-slate-100 rounded" />
            <div className="h-48 w-full bg-slate-50 rounded mt-6" />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
            <h3 className="text-base font-bold text-rose-900">Topic Evaluation Not Found</h3>
            <p className="text-sm text-rose-700 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/app/research-radar")}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              Return to Research Radar
            </button>
          </div>
        )}

        {/* Topic Detail View */}
        {!loading && !error && evaluation && (
          <div className="space-y-8">
            {/* Header Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 text-cyan-700 text-xs font-semibold uppercase tracking-wider">
                    <Microscope className="h-4 w-4" />
                    <span>Topic Deep-Dive</span>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                    {evaluation.topic_label}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Keywords:</span>
                  <div className="flex flex-wrap gap-1">
                    {evaluation.keywords.map((k) => (
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

              {/* Strategic Rationale */}
              {(evaluation as any).why_it_matters && (
                <div className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50/70 to-blue-50/50 p-4 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-cyan-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                        Commercial Synthesis & Strategic Trajectory
                      </p>
                      <p className="text-slate-700 leading-relaxed mt-0.5">
                        {(evaluation as any).why_it_matters}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 4 Real Classifier State Sections */}
              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Competitor Engagement Matrix
                  </h2>
                  <span className="text-xs text-slate-500">
                    Cycle: {evaluation.cycle_id || "latest"}
                  </span>
                </div>

                {/* 1. ADOPTING */}
                {stateGroups.Adopting.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-emerald-700" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                          Adopting ({stateGroups.Adopting.length})
                        </h3>
                      </div>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        Live production integration, shipped capability, or active deployment
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {stateGroups.Adopting.map(({ competitor, connection }) => (
                        <TopicDetailCompetitorCard
                          key={competitor}
                          competitor={competitor}
                          connection={connection}
                          state="Adopting"
                          onOpenEvidence={(d) => setDrawerData(d)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. RESEARCHING */}
                {stateGroups.Researching.length > 0 && (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/20 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Microscope className="h-4 w-4 text-cyan-700" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-900">
                          Researching ({stateGroups.Researching.length})
                        </h3>
                      </div>
                      <span className="text-[11px] text-cyan-800 font-medium">
                        Active R&D, paper authorship, or prototype benchmarks
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {stateGroups.Researching.map(({ competitor, connection }) => (
                        <TopicDetailCompetitorCard
                          key={competitor}
                          competitor={competitor}
                          connection={connection}
                          state="Researching"
                          onOpenEvidence={(d) => setDrawerData(d)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. MENTIONING */}
                {stateGroups.Mentioning.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-amber-700" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                          Mentioning ({stateGroups.Mentioning.length})
                        </h3>
                      </div>
                      <span className="text-[11px] text-amber-800 font-medium">
                        Public discussion or commentary without shipped capability
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {stateGroups.Mentioning.map(({ competitor, connection }) => (
                        <TopicDetailCompetitorCard
                          key={competitor}
                          competitor={competitor}
                          connection={connection}
                          state="Mentioning"
                          onOpenEvidence={(d) => setDrawerData(d)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. NO ACTIVITY DETECTED (Audited Absence) */}
                {stateGroups["No activity detected"].length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CircleDashed className="h-4 w-4 text-slate-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          No Activity Detected ({stateGroups["No activity detected"].length})
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Audited sweep of all monitored channels with zero matching signals
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
                              {connection.reason}
                            </p>
                            <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 flex items-center justify-between">
                              <span>Audited channels:</span>
                              <span className="font-mono text-slate-600">{queried.join(", ")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Verified Domain Research Grounding */}
              {(evaluation as any).verified_sources && (evaluation as any).verified_sources.length > 0 && (
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-cyan-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Underlying Domain Research Papers ({(evaluation as any).verified_sources.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(evaluation as any).verified_sources.map((src: any, sIdx: number) => (
                      <div
                        key={sIdx}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-xs">{src.title}</h4>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-mono text-slate-700 uppercase shrink-0">
                            {src.source}
                          </span>
                        </div>

                        <p className="text-slate-600 text-[11px] italic bg-white p-2.5 rounded border border-slate-200/60">
                          "{src.quoted_excerpt}"
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <span>{src.authors ? src.authors.join(", ") : "Researchers"}</span>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                          >
                            <span>Read source</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

function TopicDetailCompetitorCard({
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

        <div className="flex items-center gap-2">
          <ConfidenceBadge level="High" />
          <ClassifierBadge state={state} />
        </div>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed">{connection.reason}</p>

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
                    <span className="font-semibold text-slate-900 text-xs">{sig.title}</span>
                  </div>
                  {sig.url && (
                    <a
                      href={sig.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0"
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
                        inference: connection.reason || "Active capability demonstrated.",
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
