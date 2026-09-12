"use client";

import * as React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchEvents,
  fetchTrackedCompanies,
  type ConsolidatedEventRecord,
  type TrackedCompany,
} from "@/lib/api";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import {
  EvidenceDrawer,
  type EvidenceDrawerData,
} from "@/components/shared/EvidenceDrawer";
import {
  LoadingState,
  EmptyState,
  ErrorState,
} from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { normalizeConfidence } from "@/lib/tokens";
import {
  GitFork,
  Layers,
  RotateCcw,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Sparkles,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function EventsPage() {
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);

  // Filter state
  const [selectedCompany, setSelectedCompany] = React.useState<string>("ALL");
  const [selectedTier, setSelectedTier] = React.useState<string>("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Loading & Error states
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [forcedState, setForcedState] = React.useState<"none" | "force_empty" | "force_error">("none");

  // Evidence Drawer state
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);
  const [activeEvidence, setActiveEvidence] = React.useState<EvidenceDrawerData | null>(null);

  React.useEffect(() => {
    fetchTrackedCompanies()
      .then((comps) => setTrackedCompanies(comps))
      .catch(() => {});
  }, []);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (forcedState === "force_error") {
        throw new Error("Deliberately forced API failure (Dev State Inspection Gate).");
      }

      const res = await fetchEvents({
        company: selectedCompany !== "ALL" ? selectedCompany : undefined,
        tier: selectedTier !== "ALL" ? selectedTier : undefined,
        confidence: selectedConfidence !== "ALL" ? selectedConfidence : undefined,
        limit: 100,
      });

      if (forcedState === "force_empty") {
        setEvents([]);
        setTotalCount(0);
      } else {
        setEvents(res.events || []);
        setTotalCount(res.count || 0);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, selectedTier, selectedConfidence, forcedState]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const displayedEvents = React.useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.company_name.toLowerCase().includes(q) ||
        (e.event_summary && e.event_summary.toLowerCase().includes(q))
    );
  }, [events, searchQuery]);

  const hasActiveFilters =
    selectedCompany !== "ALL" ||
    selectedTier !== "ALL" ||
    selectedConfidence !== "ALL" ||
    searchQuery !== "";

  const clearFilters = () => {
    setSelectedCompany("ALL");
    setSelectedTier("ALL");
    setSelectedConfidence("ALL");
    setSearchQuery("");
  };

  const handleOpenEvidence = (ev: ConsolidatedEventRecord) => {
    const factConf = normalizeConfidence(ev.fact_confidence);
    setActiveEvidence({
      id: ev.event_id,
      title: ev.title,
      company: ev.company_name,
      timestamp: ev.published_at || ev.published_timestamp || "Recent",
      tier: ev.tier,
      confidence: factConf,
      confidenceNuance: {
        level: factConf,
        isCorroborated: ev.corroboration_count > 1,
        corroborationCount: ev.corroboration_count,
        reason:
          ev.corroboration_count > 1
            ? `Consolidated from ${ev.corroboration_count} distinct corroborating sources.`
            : "Single-source verified real-world observation.",
      },
      fact: ev.raw_excerpt || ev.event_summary || ev.title,
      inference:
        ev.why_it_matters ||
        `Consolidated event recorded across ${ev.contributing_sources?.join(", ") || "monitored sources"} for ${ev.company_name}.`,
      corroborationCount: ev.corroboration_count,
      sources: [
        {
          id: `src-${ev.event_id}`,
          title: ev.title,
          url: ev.url,
          sourceType: ev.contributing_sources?.[0] || "Event Source",
          publishedAt: ev.published_at,
          excerpt: ev.raw_excerpt,
          isValid: true,
        },
      ],
    });
    setDrawerOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-950">
                Consolidated Events
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {totalCount} Total
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Primary question: What real-world events happened, and what's the evidence behind each one?
            </p>
          </div>

          {/* Dev State Controls */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-md border border-slate-200 text-xs self-start sm:self-auto">
            <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5">
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

        {/* Filter Bar */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Company Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Company:</span>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Tracked</option>
                  {trackedCompanies.map((c) => (
                    <option key={c.company_name} value={c.company_name}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tier Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Tier:</span>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Tiers</option>
                  <option value="Must-Know">Must-Know</option>
                  <option value="Should-Know">Should-Know</option>
                  <option value="Nice-to-Know">Nice-to-Know</option>
                </select>
              </div>

              {/* Fact Confidence Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Fact Confidence:</span>
                <select
                  value={selectedConfidence}
                  onChange={(e) => setSelectedConfidence(e.target.value)}
                  className="h-8 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Confidence</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Keyword Search & Reset */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter event title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs rounded border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 w-40 sm:w-56"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-slate-600 hover:text-slate-900"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Section: Loading / Error / Empty / Events List */}
        {loading ? (
          <LoadingState layout="table" count={6} />
        ) : error ? (
          <ErrorState
            title="Events Query Error"
            message={error}
            onRetry={loadData}
          />
        ) : displayedEvents.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No events match these filters" : "No consolidated events recorded yet"}
            description={
              hasActiveFilters
                ? "No events matched your selected company, tier, or confidence criteria."
                : "Consolidated events will emerge once monitoring cycles complete and multiple signals are clustered."
            }
            actionLabel={hasActiveFilters ? "Clear all filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Company</TableHead>
                  <TableHead>Consolidated Real-World Event</TableHead>
                  <TableHead className="w-28">Fact Confidence</TableHead>
                  <TableHead className="w-28">Strategic Tier</TableHead>
                  <TableHead className="w-24">Sources</TableHead>
                  <TableHead className="w-32 text-right">Consolidation Tree</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedEvents.map((event) => {
                  const factConf = normalizeConfidence(event.fact_confidence);

                  return (
                    <TableRow key={event.event_id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Company Name */}
                      <TableCell className="font-semibold text-slate-900 text-xs">
                        {event.company_name}
                      </TableCell>

                      {/* Event Title & Summary */}
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            href={`/app/events/${event.event_id}`}
                            className="font-medium text-slate-950 text-xs hover:text-blue-600 leading-snug inline-block"
                          >
                            {event.title}
                          </Link>
                          {event.event_summary && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                              {event.event_summary}
                            </p>
                          )}
                          {event.why_it_matters && (
                            <div className="text-[11px] text-indigo-950 font-normal bg-indigo-50/60 border border-indigo-100 rounded px-2 py-0.5 mt-1 inline-block">
                              <span className="font-semibold text-indigo-900 mr-1">Inference:</span>
                              {event.why_it_matters}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Fact Confidence (Shared canonical fact_confidence per spec 3.4) */}
                      <TableCell>
                        <ConfidenceBadge
                          level={factConf}
                          nuance={{
                            level: factConf,
                            isCorroborated: event.corroboration_count > 1,
                            corroborationCount: event.corroboration_count,
                            reason:
                              event.corroboration_count > 1
                                ? `Fact corroborated across ${event.corroboration_count} independent sources.`
                                : "Canonical ground truth observation.",
                          }}
                        />
                      </TableCell>

                      {/* Tier Badge */}
                      <TableCell>
                        <TierBadge tier={event.tier || "Nice-to-Know"} />
                      </TableCell>

                      {/* Signal Count Badge (e.g. '3 sources') */}
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          <Layers className="h-3 w-3 text-slate-500" />
                          <span>
                            {event.corroboration_count}{" "}
                            {event.corroboration_count === 1 ? "source" : "sources"}
                          </span>
                        </span>
                      </TableCell>

                      {/* Tree View Action */}
                      <TableCell className="text-right">
                        <Link href={`/app/events/${event.event_id}`}>
                          <Button
                            variant="subtle"
                            size="sm"
                            className="h-7 text-[11px] gap-1 text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"
                          >
                            <GitFork className="h-3 w-3" />
                            <span>View Tree</span>
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={activeEvidence}
      />
    </AppLayout>
  );
}
