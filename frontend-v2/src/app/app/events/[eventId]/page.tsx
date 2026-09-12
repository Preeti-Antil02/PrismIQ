"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchEventDetail,
  type ConsolidatedEventRecord,
} from "@/lib/api";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import {
  EvidenceDrawer,
  type EvidenceDrawerData,
} from "@/components/shared/EvidenceDrawer";
import {
  LoadingState,
  ErrorState,
} from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SIGNAL_TYPE_CONFIG, type SignalType, normalizeConfidence } from "@/lib/tokens";
import {
  ArrowLeft,
  GitFork,
  Layers,
  ExternalLink,
  ShieldCheck,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params?.eventId as string;

  const [event, setEvent] = React.useState<ConsolidatedEventRecord | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Evidence Drawer state
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);
  const [drawerData, setDrawerData] = React.useState<EvidenceDrawerData | null>(null);

  const loadEvent = React.useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEventDetail(eventId);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || "Failed to load event consolidation tree.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleOpenDrawer = () => {
    if (!event) return;
    const factConf = normalizeConfidence(event.fact_confidence);
    setDrawerData({
      id: event.event_id,
      title: event.title,
      company: event.company_name,
      timestamp: event.published_at || event.published_timestamp || "Recent",
      tier: event.tier,
      confidence: factConf,
      confidenceNuance: {
        level: factConf,
        isCorroborated: (event.contributing_signals?.length || 1) > 1,
        corroborationCount: event.contributing_signals?.length || 1,
        reason:
          (event.contributing_signals?.length || 1) > 1
            ? `Consolidated from ${event.contributing_signals?.length} distinct contributing signals.`
            : "Single-source observation recorded from source monitoring.",
      },
      fact: event.raw_excerpt || event.event_summary || event.title,
      inference:
        event.why_it_matters ||
        `Real-world consolidated event for ${event.company_name} clustered across ${event.contributing_sources?.join(", ") || "monitored sources"}.`,
      corroborationCount: event.contributing_signals?.length || 1,
      sources: (event.contributing_signals || []).map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        sourceType: s.source,
        publishedAt: s.published_at,
        excerpt: s.raw_excerpt,
        isValid: true,
      })),
    });
    setDrawerOpen(true);
  };

  const formatSource = (src: string): SignalType => {
    const s = src.toLowerCase();
    if (s.includes("news")) return "News";
    if (s.includes("github")) return "GitHub";
    if (s.includes("jobs")) return "Jobs";
    if (s.includes("pricing")) return "Pricing";
    return "Research";
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/app/events"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Consolidated Events</span>
          </Link>

          {event && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDrawer}
              className="text-xs"
            >
              Open Evidence Drawer
            </Button>
          )}
        </div>

        {loading ? (
          <LoadingState layout="detail" />
        ) : error || !event ? (
          <ErrorState
            title="Event Consolidation Tree Not Found"
            message={error || `Could not find event ${eventId}.`}
            onRetry={loadEvent}
          />
        ) : (
          <div className="space-y-6">
            {/* Header / Primary Spec Question */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {event.company_name}
                </span>
                <TierBadge tier={event.tier || "Nice-to-Know"} />
                <ConfidenceBadge
                  level={normalizeConfidence(event.fact_confidence)}
                  nuance={{
                    level: normalizeConfidence(event.fact_confidence),
                    isCorroborated: (event.contributing_signals?.length || 1) > 1,
                    corroborationCount: event.contributing_signals?.length || 1,
                  }}
                />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950">
                {event.title}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Spec 3.4 Consolidation Tree: Visualizing root consolidated event and contributing evidence.
              </p>
            </div>

            {/* ========================================================= */}
            {/* VISUAL CONSOLIDATION TREE (Spec Section 3.4) */}
            {/* ========================================================= */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-8">
              {/* Top Node: Root Consolidated Event */}
              <div className="max-w-2xl mx-auto rounded-lg border-2 border-slate-900 bg-slate-900 text-white p-5 shadow-md relative">
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-white">
                      <GitFork className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                      Root Consolidated Event
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {event.event_id}
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white leading-snug mb-2">
                  {event.title}
                </h3>

                {event.event_summary && (
                  <p className="text-xs text-slate-300 leading-relaxed font-normal mb-3">
                    {event.event_summary}
                  </p>
                )}

                {/* Tenant inference overlay */}
                {event.why_it_matters && (
                  <div className="rounded border border-indigo-500/30 bg-indigo-950/60 p-3 mt-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
                      <Brain className="h-3 w-3 text-indigo-400" />
                      <span>Strategic Inference (Per-Tenant Findings Overlay)</span>
                    </div>
                    <p className="text-xs text-indigo-100 leading-relaxed font-normal">
                      {event.why_it_matters}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-blue-400" />
                    <span>
                      {event.contributing_signals?.length || event.corroboration_count}{" "}
                      {(event.contributing_signals?.length || event.corroboration_count) === 1
                        ? "contributing signal"
                        : "contributing signals"}
                    </span>
                  </div>
                  {event.published_at && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>{event.published_at}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Trunk line branching downward */}
              <div className="flex flex-col items-center justify-center -my-3">
                <div className="h-8 w-0.5 bg-slate-300" />
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
                  <span>
                    {(event.contributing_signals?.length || 1) === 1
                      ? "Single-Signal Branch"
                      : "Evidence Consolidation Branches"}
                  </span>
                </div>
                <div className="h-4 w-0.5 bg-slate-300" />
              </div>

              {/* Contributing Signals Tree (Branching grid on desktop, stacked list on mobile) */}
              {(!event.contributing_signals || event.contributing_signals.length === 0) ? (
                <div className="max-w-md mx-auto p-4 rounded-md border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                  No individual raw signals mapped to this consolidated event.
                </div>
              ) : event.contributing_signals.length === 1 ? (
                /* Spec 3.4 State: Single-signal event — renders with one clean branch */
                <div className="max-w-xl mx-auto space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold tracking-tight border",
                          SIGNAL_TYPE_CONFIG[formatSource(event.contributing_signals[0].source)]?.bgClass,
                          SIGNAL_TYPE_CONFIG[formatSource(event.contributing_signals[0].source)]?.textClass,
                          SIGNAL_TYPE_CONFIG[formatSource(event.contributing_signals[0].source)]?.borderClass
                        )}
                      >
                        {formatSource(event.contributing_signals[0].source)}
                      </span>
                      {event.contributing_signals[0].published_at && (
                        <span className="text-[11px] text-slate-400">
                          {event.contributing_signals[0].published_at}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-slate-900 leading-snug mb-1">
                      {event.contributing_signals[0].title}
                    </h4>
                    {event.contributing_signals[0].raw_excerpt && (
                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 mb-3 bg-slate-50 p-2 rounded border border-slate-100">
                        "{event.contributing_signals[0].raw_excerpt}"
                      </p>
                    )}
                    <a
                      href={event.contributing_signals[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <span>Open primary source</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                /* Multi-signal event: Horizontal branching tree on desktop, vertical stack on mobile */
                <div className="relative">
                  {/* Branching rail line on desktop */}
                  <div className="hidden md:block absolute -top-4 left-12 right-12 h-0.5 bg-slate-300" />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {event.contributing_signals.map((sig, idx) => {
                      const typeKey = formatSource(sig.source);
                      const typeCfg = SIGNAL_TYPE_CONFIG[typeKey] || SIGNAL_TYPE_CONFIG.News;

                      return (
                        <div key={sig.id} className="relative pt-2">
                          {/* Desktop branch connector stem */}
                          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 h-2 w-0.5 bg-slate-300" />

                          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 transition-colors flex flex-col justify-between h-full">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold tracking-tight border",
                                    typeCfg.bgClass,
                                    typeCfg.textClass,
                                    typeCfg.borderClass
                                  )}
                                >
                                  {typeKey}
                                </span>
                                {sig.published_at && (
                                  <span className="text-[11px] text-slate-400">
                                    {sig.published_at}
                                  </span>
                                )}
                              </div>

                              <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                                {sig.title}
                              </h4>

                              {sig.raw_excerpt && (
                                <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 bg-slate-50/70 p-2 rounded border border-slate-100">
                                  "{sig.raw_excerpt}"
                                </p>
                              )}
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                                {sig.id}
                              </span>
                              <a
                                href={sig.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                              >
                                <span>Source</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={drawerData}
      />
    </AppLayout>
  );
}
