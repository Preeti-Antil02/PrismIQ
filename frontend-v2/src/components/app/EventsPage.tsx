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
  fetchHighImpactChanges,
  type ConsolidatedEventRecord,
  type TrackedCompany,
  type HighImpactChangeRecord,
  type SignalEvidenceItem,
} from "@/lib/api";

const SIGNAL_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  "Product Page": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: <Layers className="w-3 h-3 text-purple-600" />,
  },
  "Official Blog": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <Newspaper className="w-3 h-3 text-blue-600" />,
  },
  "Hiring": {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    icon: <Briefcase className="w-3 h-3 text-indigo-600" />,
  },
  "GitHub Activity": {
    bg: "bg-zinc-100",
    text: "text-zinc-800",
    border: "border-zinc-300",
    icon: <GitBranch className="w-3 h-3 text-zinc-700" />,
  },
  "Pricing Page": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <DollarSign className="w-3 h-3 text-amber-600" />,
  },
  "Pricing": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <DollarSign className="w-3 h-3 text-amber-600" />,
  },
  "Compliance": {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: <ShieldCheck className="w-3 h-3 text-emerald-600" />,
  },
  "Strategic Alliance": {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    icon: <Target className="w-3 h-3 text-cyan-600" />,
  },
  "Official Announcement": {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: <AlertCircle className="w-3 h-3 text-rose-600" />,
  },
};

export function EventsPage() {
  const { targetCompany, tenantId } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [highImpactChanges, setHighImpactChanges] = React.useState<HighImpactChangeRecord[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Change Detection Filter States
  const [changeFilterCompany, setChangeFilterCompany] = React.useState<string>("ALL");
  const [selectedSignalIndices, setSelectedSignalIndices] = React.useState<Record<string, number>>({});
  const [expandedChangeIds, setExpandedChangeIds] = React.useState<Record<string, boolean>>({});

  // Granular Event Archive Filter States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCompany, setSelectedCompany] = React.useState("ALL");
  const [selectedTier, setSelectedTier] = React.useState("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState("ALL");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, compsRes, changesRes] = await Promise.all([
        fetchEvents({ limit: 200 }),
        fetchTrackedCompanies(),
        fetchHighImpactChanges().catch(() => ({ changes: [], count: 0, high_impact_count: 0, filter: "ALL" })),
      ]);
      setEvents(eventsRes.events || []);
      setCompanies(compsRes || []);
      setHighImpactChanges(changesRes.changes || []);

      // Default first signal active for each change card
      const initialSignalMap: Record<string, number> = {};
      const initialExpandMap: Record<string, boolean> = {};
      (changesRes.changes || []).forEach((c, idx) => {
        initialSignalMap[c.id] = 0;
        initialExpandMap[c.id] = idx === 0; // expand first by default
      });
      setSelectedSignalIndices(initialSignalMap);
      setExpandedChangeIds(initialExpandMap);
    } catch (err: any) {
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

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

  // Companies represented in detected high-impact changes
  const changeCompanyNames = React.useMemo(() => {
    const set = new Set<string>();
    highImpactChanges.forEach((c) => set.add(c.company_name));
    return Array.from(set);
  }, [highImpactChanges]);

  // Filtered high-impact changes based on selection
  const filteredHighImpactChanges = React.useMemo(() => {
    if (changeFilterCompany === "ALL") return highImpactChanges;
    return highImpactChanges.filter(
      (c) => c.company_name.toLowerCase() === changeFilterCompany.toLowerCase()
    );
  }, [highImpactChanges, changeFilterCompany]);

  // Client-side filtering for granular archive
  const filteredEvents = React.useMemo(() => {
    return events.filter((ev) => {
      if (selectedCompany !== "ALL" && ev.company_name.toLowerCase() !== selectedCompany.toLowerCase()) {
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

  const toggleExpandChange = (id: string) => {
    setExpandedChangeIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Competitive Change Detection & Events
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
          {/* POINT 3: COMPETITIVE CHANGE DETECTION ENGINE ("THE CHANGES THAT MATTER") */}
          {/* ========================================================================= */}
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <Flame className="w-3.5 h-3.5 text-rose-600" />
                    Change Detection Engine
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    The {highImpactChanges.length} Changes That Actually Matter
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  High-Impact Strategic Moves
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5 max-w-2xl">
                  PrismIQ filters out routine feed noise, isolating moves corroborated by 3+ independent channels (Product, Blog, GitHub, Hiring, Pricing) within 14 days.
                </p>
              </div>

              {/* Competitor filter tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100/90 rounded-lg border border-zinc-200/80 self-start sm:self-auto text-xs">
                <button
                  type="button"
                  onClick={() => setChangeFilterCompany("ALL")}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                    changeFilterCompany === "ALL"
                      ? "bg-white text-[#17171b] shadow-sm"
                      : "text-[#70717a] hover:text-[#17171b]"
                  }`}
                >
                  All High Impact ({highImpactChanges.length})
                </button>
                {changeCompanyNames.map((cname) => (
                  <button
                    key={cname}
                    type="button"
                    onClick={() => setChangeFilterCompany(cname)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                      changeFilterCompany === cname
                        ? "bg-white text-rose-700 shadow-sm font-bold"
                        : "text-[#70717a] hover:text-[#17171b]"
                    }`}
                  >
                    {cname}
                  </button>
                ))}
              </div>
            </div>

            {/* Change Detection Cards */}
            <div className="space-y-4">
              {filteredHighImpactChanges.map((change) => {
                const isExpanded = expandedChangeIds[change.id] ?? false;
                const activeSignalIdx = selectedSignalIndices[change.id] ?? 0;
                const activeSignal: SignalEvidenceItem | undefined = change.signals_evidence[activeSignalIdx];
                const activeSigStyle = activeSignal
                  ? (SIGNAL_TYPE_STYLES[activeSignal.signal_type] || {
                      bg: "bg-zinc-100",
                      text: "text-zinc-800",
                      border: "border-zinc-300",
                      icon: <ShieldCheck className="w-3 h-3 text-zinc-600" />,
                    })
                  : null;

                const isHighImpact = change.significance_tier.toUpperCase().includes("HIGH");

                return (
                  <div
                    key={change.id}
                    className="rounded-2xl border border-[rgba(20,20,30,0.1)] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Card Header */}
                    <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-50 via-white to-rose-50/20 border-b border-zinc-100">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                              isHighImpact
                                ? "bg-rose-100/90 text-rose-800 border border-rose-300 animate-pulse"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {change.significance_tier}
                          </span>

                          <PrismCompanyBadge
                            name={change.company_name}
                            isTarget={change.company_name.toLowerCase() === targetCompany.toLowerCase()}
                            size="sm"
                          />

                          <span className="text-xs text-zinc-300">•</span>
                          <span className="text-xs font-semibold text-[#70717a] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#6e57dc]" />
                            Within {change.window_days} Days
                          </span>

                          <span className="text-xs text-zinc-300">•</span>
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            {change.corroborating_signals_count} Independent Signals
                          </span>
                        </div>

                        {/* Confidence score pill */}
                        <div className="flex items-center gap-2 self-start md:self-auto">
                          <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-extrabold text-emerald-800">
                              {change.confidence}% Confidence
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleExpandChange(change.id)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
                            aria-label="Toggle details"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Main Headline */}
                      <h3 className="text-lg sm:text-xl font-extrabold text-[#17171b] tracking-tight">
                        {change.headline}
                      </h3>

                      {/* Corroboration Why-it-matters */}
                      <p className="text-xs text-[#70717a] mt-1.5 leading-relaxed font-medium">
                        <strong className="text-zinc-800">Why it matters:</strong> {change.why_it_matters}
                      </p>
                    </div>

                    {/* Multi-Signal Evidence Strip */}
                    <div className="p-4 sm:p-5 bg-zinc-50/70 border-b border-zinc-100">
                      <div className="text-[11px] font-bold text-[#70717a] uppercase tracking-wider mb-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#6e57dc]" />
                          Multi-Signal Corroboration Evidence ({change.signals_evidence.length})
                        </span>
                        <span className="text-[10px] text-zinc-400 lowercase font-normal">
                          click source chip to inspect verbatim excerpt
                        </span>
                      </div>

                      {/* Signal Chips Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {change.signals_evidence.map((sig, sIdx) => {
                          const isSelected = sIdx === activeSignalIdx;
                          const sigStyle = SIGNAL_TYPE_STYLES[sig.signal_type] || {
                            bg: "bg-zinc-100",
                            text: "text-zinc-800",
                            border: "border-zinc-300",
                            icon: <ShieldCheck className="w-3 h-3 text-zinc-600" />,
                          };

                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => {
                                setSelectedSignalIndices((prev) => ({ ...prev, [change.id]: sIdx }));
                                if (!isExpanded) toggleExpandChange(change.id);
                              }}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isSelected
                                  ? `${sigStyle.bg} ${sigStyle.text} ${sigStyle.border} ring-2 ring-[#6e57dc]/30 shadow-xs scale-102`
                                  : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                              }`}
                            >
                              {sigStyle.icon}
                              <span>{sig.signal_type}</span>
                              <span className="text-[10px] font-normal opacity-70">({sig.source})</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Signal Inspector Box */}
                      {activeSignal && (
                        <div className="mt-3 p-3.5 bg-white rounded-xl border border-zinc-200/90 shadow-2xs space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${activeSigStyle?.bg} ${activeSigStyle?.text} ${activeSigStyle?.border}`}
                              >
                                {activeSignal.signal_type}
                              </span>
                              <h4 className="text-xs font-extrabold text-zinc-900 line-clamp-1">
                                {activeSignal.title}
                              </h4>
                            </div>
                            <span className="text-[11px] text-zinc-400 font-mono">
                              Detected: {activeSignal.detected_at.split("T")[0]}
                            </span>
                          </div>

                          {/* Verbatim quote */}
                          <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200/70 text-xs text-zinc-800 font-mono italic leading-relaxed">
                            &ldquo;{activeSignal.excerpt}&rdquo;
                          </div>

                          {activeSignal.url && (
                            <div className="flex items-center justify-between pt-0.5 text-xs">
                              <a
                                href={activeSignal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#6e57dc] hover:text-[#5841cb] font-bold hover:underline"
                              >
                                <span>Verify Primary Source</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <span className="text-[10px] text-zinc-400">
                                Verified by PrismIQ Evidence Crawler
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expandable Strategic Analysis & Recommended Action Drawer */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 bg-gradient-to-b from-white to-zinc-50/70 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Strategic Interpretation */}
                        <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                            PrismIQ Strategic Interpretation
                          </div>
                          <p className="text-xs text-purple-950 leading-relaxed font-medium">
                            {change.strategic_interpretation}
                          </p>
                        </div>

                        {/* Recommended Counter-Action */}
                        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                            <Lightbulb className="w-3.5 h-3.5 text-emerald-700" />
                            Recommended Counter-Action
                          </div>
                          <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                            {change.recommended_action}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

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
                          isTarget={ev.company_name.toLowerCase() === targetCompany.toLowerCase()}
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
