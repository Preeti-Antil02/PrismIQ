"use client";

import * as React from "react";
import {
  Search,
  Filter,
  ShieldCheck,
  CalendarDays,
  ExternalLink,
  Clock,
  Sparkles,
  RefreshCw,
  Building2,
  ChevronRight,
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
} from "./PrismPrimitives";
import {
  fetchEvents,
  fetchTrackedCompanies,
  type ConsolidatedEventRecord,
  type TrackedCompany,
} from "@/lib/api";

export function EventsPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCompany, setSelectedCompany] = React.useState("ALL");
  const [selectedTier, setSelectedTier] = React.useState("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState("ALL");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, compsRes] = await Promise.all([
        fetchEvents({ limit: 100 }),
        fetchTrackedCompanies(),
      ]);
      setEvents(eventsRes.events || []);
      setCompanies(compsRes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering
  const filteredEvents = React.useMemo(() => {
    return events.filter((ev) => {
      // Company match
      if (selectedCompany !== "ALL" && ev.company_name.toLowerCase() !== selectedCompany.toLowerCase()) {
        return false;
      }
      // Tier match
      if (selectedTier !== "ALL") {
        const evTier = (ev.tier || "").toLowerCase().replace(/_/g, "-");
        if (!evTier.includes(selectedTier.toLowerCase())) return false;
      }
      // Confidence match
      if (selectedConfidence !== "ALL") {
        const evConf = (ev.confidence || ev.fact_confidence || "").toLowerCase();
        if (!evConf.includes(selectedConfidence.toLowerCase())) return false;
      }
      // Search text match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${ev.title} ${ev.event_summary || ""} ${ev.why_it_matters || ""} ${ev.company_name}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [events, selectedCompany, selectedTier, selectedConfidence, searchQuery]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCompany("ALL");
    setSelectedTier("ALL");
    setSelectedConfidence("ALL");
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Competitive Events Timeline
          </div>
          <h1 className="app-title-lg">
            Events & Developments for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Audit-grade record of corroborated real-world competitive moves, product updates, and market signals.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Events</span>
        </PrismButton>
      </div>

      {/* Search & Filter Strip */}
      <div className="space-y-3">
        {/* Search bar & quick stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Search events, companies, or implications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="app-search-input w-full"
            />
          </div>

          <div className="text-xs text-[#70717a] font-medium flex items-center gap-2">
            <span>
              Showing <strong>{filteredEvents.length}</strong> of {events.length} events
            </span>
            {(selectedCompany !== "ALL" || selectedTier !== "ALL" || selectedConfidence !== "ALL" || searchQuery) && (
              <button
                onClick={resetFilters}
                className="text-[#6e57dc] hover:underline font-bold"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Company Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] shrink-0 mr-1">
            Company:
          </span>
          <button
            onClick={() => setSelectedCompany("ALL")}
            className={`app-filter-btn ${selectedCompany === "ALL" ? "app-filter-btn-active" : ""}`}
          >
            All Companies ({events.length})
          </button>
          {companies.map((comp) => {
            const count = events.filter(
              (e) => e.company_name.toLowerCase() === comp.company_name.toLowerCase()
            ).length;
            if (count === 0) return null;
            return (
              <button
                key={comp.company_name}
                onClick={() => setSelectedCompany(comp.company_name)}
                className={`app-filter-btn ${
                  selectedCompany.toLowerCase() === comp.company_name.toLowerCase()
                    ? "app-filter-btn-active"
                    : ""
                }`}
              >
                {comp.company_name} ({count})
              </button>
            );
          })}
        </div>

        {/* Tier & Confidence Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mr-1">
            Tier:
          </span>
          {["ALL", "must", "should", "nice"].map((tierKey) => (
            <button
              key={tierKey}
              onClick={() => setSelectedTier(tierKey)}
              className={`app-filter-btn ${selectedTier === tierKey ? "app-filter-btn-active" : ""}`}
            >
              {tierKey === "ALL" ? "All Tiers" : tierKey === "must" ? "Must-Know" : tierKey === "should" ? "Should-Know" : "Nice-to-Know"}
            </button>
          ))}

          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] ml-3 mr-1">
            Confidence:
          </span>
          {["ALL", "high", "medium", "low"].map((confKey) => (
            <button
              key={confKey}
              onClick={() => setSelectedConfidence(confKey)}
              className={`app-filter-btn ${selectedConfidence === confKey ? "app-filter-btn-active" : ""}`}
            >
              {confKey === "ALL" ? "All Confidence" : confKey.charAt(0).toUpperCase() + confKey.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <PrismLoadingSkeleton count={5} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Events"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : filteredEvents.length === 0 ? (
        <PrismEmptyState
          icon={<CalendarDays className="w-6 h-6" />}
          title="No Matching Events Found"
          description="Try clearing your search query or filters to view all competitive events."
          actionText="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((ev) => (
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
                  contributing_signals: ev.contributing_signals,
                })
              }
              className="p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PrismCompanyBadge
                    name={ev.company_name}
                    isTarget={ev.company_name.toLowerCase() === targetCompany.toLowerCase()}
                    size="md"
                  />
                  <PrismTierBadge tier={ev.tier} />
                  <PrismConfidenceBadge confidence={ev.confidence || ev.fact_confidence} />
                </div>

                <div className="flex items-center gap-3 text-xs text-[#70717a] shrink-0">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#9ca3af]" />
                    {ev.published_timestamp || ev.published_at || "Recent"}
                  </span>
                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#6e57dc] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Source
                    </a>
                  )}
                </div>
              </div>

              {/* Event Title with word wrapping guarantee */}
              <h3 className="text-base sm:text-lg font-bold text-[#17171b] leading-snug mb-2 break-words">
                {ev.title}
              </h3>

              {/* Event Summary */}
              {ev.event_summary && (
                <p className="text-xs sm:text-sm text-[#4b5563] leading-relaxed mb-3">
                  {ev.event_summary}
                </p>
              )}

              {/* Why It Matters Callout */}
              {ev.why_it_matters && (
                <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100/80 mb-3 text-xs">
                  <div className="font-extrabold uppercase tracking-wider text-[#6e57dc] mb-1 flex items-center gap-1.5 text-[10px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    Why It Matters
                  </div>
                  <p className="text-[#374151] leading-relaxed font-medium">
                    {ev.why_it_matters}
                  </p>
                </div>
              )}

              {/* Provenance Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[rgba(20,20,30,0.06)] text-xs text-[#70717a]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Corroborated by <strong>{ev.corroboration_count || 1}</strong> verified source{ev.corroboration_count !== 1 ? "s" : ""}
                  </span>
                </div>

                <button className="text-[#6e57dc] font-bold hover:underline flex items-center gap-1 text-xs">
                  Inspect Evidence <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </PrismCard>
          ))}
        </div>
      )}
    </div>
  );
}
