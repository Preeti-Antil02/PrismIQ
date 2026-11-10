"use client";
import { sanitizeSourceUrl } from "@/lib/urlUtils";

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
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Target,
  Lightbulb,
  GitBranch,
  Briefcase,
  DollarSign,
  Newspaper,
  CheckCircle2,
  Layers,
  Flame,
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
  fetchTrackedCompanies,
  type ConsolidatedEventRecord,
  type TrackedCompany,
} from "@/lib/api";

export function EventsPage() {
  const { targetCompany, tenantId } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Granular Event Archive Filter States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCompany, setSelectedCompany] = React.useState("ALL");
  const [selectedTier, setSelectedTier] = React.useState("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState("ALL");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, compsRes] = await Promise.all([
        fetchEvents({ limit: 200 }),
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

  // Combined list of companies from tracked companies and events
  const allCompanyNames = React.useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.company_name) set.add(c.company_name);
    });
    events.forEach((e) => {
      if (e.company_name) set.add(e.company_name);
    });
    return Array.from(set).sort();
  }, [companies, events]);

  // Client-side filtering for granular archive
  const filteredEvents = React.useMemo(() => {
    return events.filter((ev) => {
      // Company match
      if (selectedCompany !== "ALL" && (ev.company_name || "").toLowerCase() !== selectedCompany.toLowerCase()) {
        return false;
      }
      if (selectedTier !== "ALL") {
        const evTier = (ev.tier || "").toLowerCase().replace(/_/g, "-");
        if (!evTier.includes(selectedTier.toLowerCase())) return false;
      }
      if (selectedConfidence !== "ALL") {
        const evConf = (ev.confidence || ev.fact_confidence || "").toLowerCase();
        if (!evConf.includes(selectedConfidence.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${ev.title || ""} ${ev.event_summary || ""} ${ev.why_it_matters || ""} ${ev.company_name || ""}`.toLowerCase();
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
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Canonical Event Ledger &amp; Verified Developments
          </div>
          <h1 className="app-title-lg">
            Events & Developments for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Corroborated intelligence isolating the critical competitive moves that matter, supported by an audit-grade timeline of verified signals.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Events</span>
        </PrismButton>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={4} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Events"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : (
        <div className="space-y-12">
          {/* ========================================================================= */}
          {/* GRANULAR EVENT ARCHIVE & HISTORICAL AUDIT LOG */}
          {/* ========================================================================= */}
          <section className="space-y-6 pt-6 border-t border-[rgba(20,20,30,0.08)]">
            <div>
              <div className="app-eyebrow mb-1">
                <span className="app-dot" />
                Raw Event Archive & Evidence Ledger
              </div>
              <h2 className="text-lg font-bold text-[#17171b]">
                All Historical Events ({events.length})
              </h2>
              <p className="text-xs text-[#70717a] mt-0.5">
                Full chronological archive of validated single and multi-source competitor updates.
              </p>
            </div>

            {/* Search & Filter Strip */}
            <div className="space-y-3">
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
                {allCompanyNames.map((compName) => {
                  const count = events.filter(
                    (e) => e.company_name.toLowerCase() === compName.toLowerCase()
                  ).length;
                  return (
                    <button
                      key={compName}
                      onClick={() => setSelectedCompany(compName)}
                      className={`app-filter-btn ${
                        selectedCompany.toLowerCase() === compName.toLowerCase()
                          ? "app-filter-btn-active"
                          : ""
                      }`}
                    >
                      {compName} {count > 0 ? `(${count})` : ""}
                    </button>
                  );
                })}
              </div>

              {/* Tier & Confidence Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mr-1">
                  Tier:
                </span>
                {["ALL", "Must-Know", "Should-Know", "Nice-to-Know"].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`app-filter-btn ${selectedTier === tier ? "app-filter-btn-active" : ""}`}
                  >
                    {tier}
                  </button>
                ))}

                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] ml-3 mr-1">
                  Confidence:
                </span>
                {["ALL", "High", "Medium", "Low"].map((conf) => (
                  <button
                    key={conf}
                    onClick={() => setSelectedConfidence(conf)}
                    className={`app-filter-btn ${selectedConfidence === conf ? "app-filter-btn-active" : ""}`}
                  >
                    {conf}
                  </button>
                ))}
              </div>
            </div>

            {/* Events List */}
            {filteredEvents.length === 0 ? (
              <PrismEmptyState
                icon={<Filter className="w-6 h-6" />}
                title="No Events Found"
                description="No events match your current filter and search criteria."
                actionText="Reset Filters"
                onAction={resetFilters}
              />
            ) : (
              <div className="space-y-3">
                {filteredEvents.slice(0, 30).map((ev) => (
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
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PrismCompanyBadge
                          name={ev.company_name}
                          isTarget={(ev.company_name || "").toLowerCase() === (targetCompany || "").toLowerCase()}
                          size="sm"
                        />
                        <PrismTierBadge tier={ev.tier} />
                        <PrismConfidenceBadge confidence={ev.confidence || ev.fact_confidence} />
                        <span className="text-xs text-[#9ca3af] ml-auto sm:ml-0">
                          {ev.published_timestamp || ev.published_at || "Recent"}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#17171b] hover:text-[#6e57dc] transition-colors">
                        {ev.title}
                      </h3>

                      {ev.why_it_matters && (
                        <div className="p-2.5 rounded-lg bg-zinc-50/80 border border-zinc-100 text-xs text-[#70717a] leading-relaxed">
                          <span className="font-bold text-[#17171b] flex items-center gap-1 mb-0.5">
                            <Sparkles className="w-3 h-3 text-[#6e57dc]" />
                            Why It Matters
                          </span>
                          {ev.why_it_matters}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2 text-xs">
                      <span className="font-semibold text-[#6e57dc] flex items-center gap-1 bg-[#6e57dc]/5 px-2.5 py-1 rounded-full border border-[#6e57dc]/10">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {ev.corroboration_count || 1} sources
                      </span>
                      <span className="text-[#70717a] text-[11px] flex items-center gap-1">
                        Inspect Evidence
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </PrismCard>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
