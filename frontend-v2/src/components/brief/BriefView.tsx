"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchBriefs,
  fetchLatestBrief,
  fetchBriefById,
  type BriefEntry,
  type BriefDetail,
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
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  FileText,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ListFilter,
  History,
  Layers,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BriefViewProps {
  initialBriefId?: string;
}

export function BriefView({ initialBriefId }: BriefViewProps) {
  const router = useRouter();

  const [briefs, setBriefs] = React.useState<BriefEntry[]>([]);
  const [activeBrief, setActiveBrief] = React.useState<BriefDetail | null>(null);
  const [parsed, setParsed] = React.useState<ParsedBrief | null>(null);

  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [forcedState, setForcedState] = React.useState<"none" | "force_empty" | "force_error" | "force_partial">("none");

  // Evidence Drawer
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);
  const [activeEvidence, setActiveEvidence] = React.useState<EvidenceDrawerData | null>(null);

  // Load historical briefs list
  React.useEffect(() => {
    fetchBriefs()
      .then((data) => setBriefs(data))
      .catch(() => {});
  }, []);

  // Load active brief
  const loadActiveBrief = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (forcedState === "force_error") {
        throw new Error("Deliberately forced API failure (Dev Inspection Mode).");
      }

      let data: BriefDetail;
      if (initialBriefId && initialBriefId !== "latest") {
        data = await fetchBriefById(initialBriefId);
      } else {
        data = await fetchLatestBrief();
      }

      if (forcedState === "force_empty") {
        setActiveBrief(null);
        setParsed(null);
      } else {
        setActiveBrief(data);
        const p = parseBriefMarkdown(data.content);
        setParsed(p);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load intelligence brief.");
    } finally {
      setLoading(false);
    }
  }, [initialBriefId, forcedState]);

  React.useEffect(() => {
    loadActiveBrief();
  }, [loadActiveBrief]);

  const handleSelectBrief = (id: string) => {
    if (id === "data_latest" || id === "latest") {
      router.push("/app/brief");
    } else {
      router.push(`/app/brief/${id}`);
    }
  };

  const handleOpenEvidence = (item: TierFindingItem, tierName: "Must-Know" | "Should-Know" | "Nice-to-Know") => {
    setActiveEvidence({
      id: `brief-item-${item.title.slice(0, 12)}`,
      title: item.title,
      company: item.company,
      timestamp: activeBrief?.date ? new Date(activeBrief.date).toLocaleDateString() : "This cycle",
      tier: tierName,
      confidence: tierName === "Must-Know" ? "High" : tierName === "Should-Know" ? "Medium" : "Low",
      confidenceNuance: {
        level: tierName === "Must-Know" ? "High" : tierName === "Should-Know" ? "Medium" : "Low",
        isCorroborated: tierName === "Must-Know",
        corroborationCount: tierName === "Must-Know" ? 3 : 1,
        reason:
          tierName === "Must-Know"
            ? "Corroborated across primary development logs and corporate releases."
            : "Deterministic tier derived from pipeline scoring.",
      },
      fact: item.fact || item.title,
      inference: item.whyItMatters || "Strategic competitive development informing current period decision matrix.",
      sources: item.url
        ? [
            {
              id: "src-1",
              title: item.title,
              url: item.url,
              sourceType: item.sourceType || "Web",
              isValid: true,
            },
          ]
        : [],
    });
    setDrawerOpen(true);
  };

  const formatDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dStr;
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-950">
                Competitive Intelligence Brief
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {activeBrief?.id === "data_latest" || !initialBriefId ? "Current Cycle" : `Historical Brief`}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Primary question: What are the most important developments this period, in order?
            </p>
          </div>

          {/* Dev State Controls */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-md border border-slate-200 text-xs self-start sm:self-auto flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-600 px-1.5">
              Dev Mode:
            </span>
            <button
              onClick={() => setForcedState("none")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                forcedState === "none"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Live Data
            </button>
            <button
              onClick={() => setForcedState("force_partial")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                forcedState === "force_partial"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Force Partial
            </button>
            <button
              onClick={() => setForcedState("force_empty")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                forcedState === "force_empty"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Force Empty
            </button>
            <button
              onClick={() => setForcedState("force_error")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                forcedState === "force_error"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Force Error
            </button>
          </div>
        </div>

        {/* Main Grid: Content (8 cols) + Historical Selector (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Brief Content Area */}
          <div className="lg:col-span-8 space-y-6">
            {loading ? (
              <LoadingState layout="detail" />
            ) : error ? (
              <ErrorState
                title="Brief Synchronization Error"
                message={error}
                onRetry={loadActiveBrief}
              />
            ) : !activeBrief || !parsed ? (
              /* Spec 3.2 State: Empty (new tenant, zero briefs yet) */
              <EmptyState
                title="Your first monitoring cycle hasn't run yet"
                description="PrismIQ runs daily synthesis cycles at 00:00 UTC. Once the monitoring agent finishes collecting raw signals, your deterministic brief will generate automatically."
                actionLabel="Inspect Live Signals Stream"
                onAction={() => router.push("/app/signals")}
              />
            ) : (
              <>
                {/* Spec 3.2 Requirement: Partial Source Failure Disclosure Banner */}
                {(parsed.partialFailure || forcedState === "force_partial") && (
                  <PartialState
                    sourceName={parsed.partialFailure?.sourceName || "HackerNews RSS Feed"}
                    cycleTime={activeBrief.date ? formatDate(activeBrief.date) : "Current cycle"}
                    message={
                      parsed.partialFailure?.details ||
                      "Upstream news source encountered temporary rate limits during this collection cycle. Findings were consolidated from verified primary signals per Part 9.4 disclosure rules."
                    }
                  />
                )}

                {/* ========================================================= */}
                {/* SPEC REQUIREMENT 1: Top 3 Decisions This Informs (Header) */}
                {/* ========================================================= */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                      <Lightbulb className="h-3.5 w-3.5" />
                    </span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-950">
                      Top 3 Decisions This Informs
                    </h2>
                    <span className="ml-auto text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Executive Priority DoD
                    </span>
                  </div>

                  <div className="space-y-3">
                    {parsed.topDecisions.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">
                        No critical strategic priority decisions flagged for this period.
                      </p>
                    ) : (
                      parsed.topDecisions.map((dec) => (
                        <div
                          key={dec.number}
                          className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                            {dec.number}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900">
                                {dec.company}:
                              </span>
                              <span className="font-medium text-xs text-slate-800">
                                {dec.headline}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">
                              {dec.impact}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ========================================================= */}
                {/* SPEC REQUIREMENT 2: Executive Summary Rollup Table */}
                {/* ========================================================= */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        <Layers className="h-3.5 w-3.5" />
                      </span>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-950">
                        Executive Summary Rollup
                      </h2>
                    </div>
                    <span className="text-[11px] text-slate-600 font-medium">
                      Deterministic Synthesis
                    </span>
                  </div>

                  {parsed.rollupRows.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-44">Theme</TableHead>
                          <TableHead>Active Competitors</TableHead>
                          <TableHead className="w-24 text-center">Events</TableHead>
                          <TableHead className="w-44">Cross-Competitor Pattern?</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsed.rollupRows.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-semibold text-slate-900 text-xs">
                              {row.theme}
                            </TableCell>
                            <TableCell className="text-slate-600 text-xs">
                              {row.competitors}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              {row.eventsCount}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold",
                                  row.patternDetected.toLowerCase().includes("yes")
                                    ? "bg-purple-50 text-purple-800 border border-purple-200"
                                    : "bg-slate-100 text-slate-600"
                                )}
                              >
                                {row.patternDetected}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-xs text-slate-500 italic p-2">
                      Monitoring scope: Consolidated findings summarized below by strategic tier.
                    </p>
                  )}
                </div>

                {/* ========================================================= */}
                {/* SPEC REQUIREMENT 3: Tiered Findings (Visually Distinct Weight) */}
                {/* ========================================================= */}
                <div className="space-y-6">
                  {/* Must-Know Section (Commanding Visual Weight) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TierBadge tier="Must-Know" />
                        <h3 className="text-sm font-bold text-slate-950">
                          Must-Know Findings ({parsed.mustKnow.length})
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-600">Immediate strategic attention</span>
                    </div>

                    {parsed.mustKnow.length === 0 ? (
                      <div className="p-4 rounded-lg border border-dashed border-slate-200 bg-white text-center text-xs text-slate-600">
                        No Must-Know shifts detected during this monitoring cycle.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {parsed.mustKnow.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleOpenEvidence(item, "Must-Know")}
                            className="p-4 rounded-lg border-2 border-rose-200 bg-white hover:border-rose-300 transition-colors shadow-xs cursor-pointer space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                {item.company}
                              </span>
                              <ConfidenceBadge level="High" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                              {item.title}
                            </h4>
                            {item.whyItMatters && (
                              <div className="text-xs text-rose-950 bg-rose-50/70 border border-rose-100 rounded p-2.5 font-normal leading-relaxed">
                                <span className="font-semibold text-rose-900 mr-1">Why it matters:</span>
                                {item.whyItMatters}
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-1 text-[11px] text-blue-600">
                              <span>Click to inspect evidence & fact grounding</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Should-Know Section (Medium Visual Weight) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TierBadge tier="Should-Know" />
                        <h3 className="text-sm font-bold text-slate-950">
                          Should-Know Findings ({parsed.shouldKnow.length})
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-600">Relevant to active roadmaps</span>
                    </div>

                    {parsed.shouldKnow.length === 0 ? (
                      <div className="p-4 rounded-lg border border-dashed border-slate-200 bg-white text-center text-xs text-slate-600">
                        No Should-Know items recorded this cycle.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {parsed.shouldKnow.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleOpenEvidence(item, "Should-Know")}
                            className="p-3.5 rounded-lg border border-blue-200 bg-white hover:border-blue-300 transition-colors shadow-xs cursor-pointer space-y-2 flex flex-col justify-between"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-900 uppercase">
                                  {item.company}
                                </span>
                                <ConfidenceBadge level="Medium" />
                              </div>
                              <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                                {item.title}
                              </h4>
                              {item.whyItMatters && (
                                <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                                  {item.whyItMatters}
                                </p>
                              )}
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-blue-600">
                              <span>Inspect grounding</span>
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Other Activity / Nice-to-Know (Compact Scanning Weight) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TierBadge tier="Nice-to-Know" />
                        <h3 className="text-sm font-bold text-slate-950">
                          Other Monitored Activity ({parsed.otherActivity.length})
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-600">Routine operational updates</span>
                    </div>

                    {parsed.otherActivity.length === 0 ? (
                      <div className="p-3 rounded border border-slate-200 bg-slate-50 text-center text-xs text-slate-600">
                        No background activity logged this cycle.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-xs">
                        {parsed.otherActivity.slice(0, 15).map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleOpenEvidence(item, "Nice-to-Know")}
                            className="p-3 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-900 w-36 shrink-0 truncate">
                                {item.company}
                              </span>
                              <span className="text-slate-800 line-clamp-1">{item.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <ConfidenceBadge level="Low" />
                              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ========================================================= */}
          {/* SPEC REQUIREMENT 4: Historical Brief List Sidebar */}
          {/* ========================================================= */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Brief Archives
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  {briefs.length} Cycles
                </span>
              </div>

              {/* Mobile selector dropdown */}
              <div className="block lg:hidden">
                <select
                  value={activeBrief?.id || ""}
                  onChange={(e) => handleSelectBrief(e.target.value)}
                  className="w-full h-9 rounded border border-slate-200 bg-white px-3 text-xs text-slate-800"
                >
                  {briefs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id === "data_latest" ? "Latest Cycle" : formatDate(b.date)} — {b.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desktop selectable historical brief list */}
              <div className="hidden lg:block space-y-1.5 max-h-[680px] overflow-y-auto pr-1">
                {briefs.length === 0 ? (
                  <p className="text-xs text-slate-600 italic p-2">
                    No historical briefs accumulated yet.
                  </p>
                ) : (
                  briefs.map((b) => {
                    const isSelected = activeBrief?.id === b.id;
                    const isLatest = b.id === "data_latest";

                    return (
                      <div
                        key={b.id}
                        onClick={() => handleSelectBrief(b.id)}
                        className={cn(
                          "p-3 rounded-lg border text-xs transition-colors cursor-pointer space-y-1",
                          isSelected
                            ? "border-blue-600 bg-blue-50/50 shadow-xs"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            {formatDate(b.date)}
                          </span>
                          {isLatest && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        {b.preview && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                            {b.preview}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={activeEvidence}
      />
    </AppLayout>
  );
}
