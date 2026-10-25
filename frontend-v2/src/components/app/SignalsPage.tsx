"use client";

import * as React from "react";
import {
  Radio,
  Search,
  Filter,
  ShieldCheck,
  ExternalLink,
  Clock,
  Sparkles,
  RefreshCw,
  GitBranch,
  Newspaper,
  Briefcase,
  DollarSign,
  BookOpen,
  VolumeX,
  Target,
  ArrowRight,
  Layers,
  ChevronDown,
  ChevronUp,
  Workflow,
  CheckCircle2,
  Lightbulb,
  Building2,
  Plus,
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
  fetchSignals,
  fetchTrackedCompanies,
  fetchSignalCorrelations,
  type SignalRecord,
  type TrackedCompany,
  type SignalCorrelationRecord,
  type CorrelatedSignalNode,
} from "@/lib/api";

const CORRELATION_CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ai_investment: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    label: "AI Investment & Platform Shift",
  },
  enterprise_shift: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Enterprise Market Consolidation",
  },
  cloud_infrastructure: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Cloud Margin & Compute Disruption",
  },
  marketplace_expansion: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Marketplace & Logistics Scale",
  },
};

export function SignalsPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [correlations, setCorrelations] = React.useState<SignalCorrelationRecord[]>([]);
  const [noiseCount, setNoiseCount] = React.useState<number>(0);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Correlation Filter States
  const [selectedCorrelationCompany, setSelectedCorrelationCompany] = React.useState<string>("ALL");
  const [activeSignalIndices, setActiveSignalIndices] = React.useState<Record<string, number>>({});
  const [expandedCorrelationIds, setExpandedCorrelationIds] = React.useState<Record<string, boolean>>({});

  // Raw Signals Stream Filter States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedSource, setSelectedSource] = React.useState("ALL");
  const [selectedCompany, setSelectedCompany] = React.useState("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState("ALL");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [signalsRes, compsRes, corrRes] = await Promise.all([
        fetchSignals({ limit: 200 }),
        fetchTrackedCompanies(),
        fetchSignalCorrelations().catch(() => ({ correlations: [], count: 0, filter: "ALL" })),
      ]);
      setSignals(signalsRes.signals || []);
      setNoiseCount(signalsRes.noise_suppressed_count || 0);
      setCompanies(compsRes || []);
      setCorrelations(corrRes.correlations || []);

      // Default active signal index to 0 and expand first correlation by default
      const initialSignalMap: Record<string, number> = {};
      const initialExpandMap: Record<string, boolean> = {};
      (corrRes.correlations || []).forEach((c, idx) => {
        initialSignalMap[c.id] = 0;
        initialExpandMap[c.id] = idx === 0;
      });
      setActiveSignalIndices(initialSignalMap);
      setExpandedCorrelationIds(initialExpandMap);
    } catch (err: any) {
      setError(err.message || "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Companies represented in correlations
  const correlationCompanyNames = React.useMemo(() => {
    const set = new Set<string>();
    correlations.forEach((c) => set.add(c.company_name));
    return Array.from(set);
  }, [correlations]);

  // Filtered correlations
  const filteredCorrelations = React.useMemo(() => {
    if (selectedCorrelationCompany === "ALL") return correlations;
    return correlations.filter(
      (c) => c.company_name.toLowerCase() === selectedCorrelationCompany.toLowerCase()
    );
  }, [correlations, selectedCorrelationCompany]);

  // Client-side filtering for raw signals
  const filteredSignals = React.useMemo(() => {
    return signals.filter((sig) => {
      if (selectedSource !== "ALL" && (sig.source || "").toLowerCase() !== selectedSource.toLowerCase()) {
        return false;
      }
      if (selectedCompany !== "ALL" && sig.company_name.toLowerCase() !== selectedCompany.toLowerCase()) {
        return false;
      }
      if (selectedConfidence !== "ALL") {
        const conf = (sig.confidence || sig.fact_confidence || "").toLowerCase();
        if (!conf.includes(selectedConfidence.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${sig.title} ${sig.raw_excerpt || ""} ${sig.why_it_matters || ""} ${sig.company_name}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [signals, selectedSource, selectedCompany, selectedConfidence, searchQuery]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedSource("ALL");
    setSelectedCompany("ALL");
    setSelectedConfidence("ALL");
  };

  const getSourceIcon = (src?: string) => {
    const s = (src || "").toLowerCase();
    if (s.includes("github")) return <GitBranch className="w-3.5 h-3.5 text-purple-600" />;
    if (s.includes("news")) return <Newspaper className="w-3.5 h-3.5 text-blue-600" />;
    if (s.includes("job") || s.includes("career") || s.includes("hiring")) return <Briefcase className="w-3.5 h-3.5 text-pink-600" />;
    if (s.includes("pricing")) return <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
    if (s.includes("research")) return <BookOpen className="w-3.5 h-3.5 text-orange-600" />;
    return <Radio className="w-3.5 h-3.5 text-zinc-600" />;
  };

  const toggleExpandCorrelation = (id: string) => {
    setExpandedCorrelationIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Signal Correlation & Indicator Stream
          </div>
          <h1 className="app-title-lg">
            Signals & Intelligence for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Multi-channel correlation synthesizing atomic indicators across hiring, product updates, GitHub repos, and conferences into higher-level strategic patterns.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Signals</span>
        </PrismButton>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={4} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Signals"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : (
        <div className="space-y-12">
          {/* ========================================================================= */}
          {/* POINT 4: SIGNAL CORRELATION ENGINE (RAW SIGNALS -> EVENTS -> PATTERNS -> INSIGHTS -> ACTIONS) */}
          {/* ========================================================================= */}
          <section className="space-y-6">
            {/* Visual 5-Stage Pipeline Tracker */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-blue-50/60 border border-purple-200/80 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#6e57dc] animate-ping" />
                  <span className="text-xs font-bold text-purple-900 tracking-wide uppercase">
                    Signal-to-Action Correlation Pipeline
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-purple-700 bg-white/80 px-2.5 py-0.5 rounded-full border border-purple-200 shadow-2xs self-start md:self-auto">
                  5-Stage Intelligence Fusion
                </span>
              </div>

              {/* 5 Stages Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center text-xs">
                <div className="p-2 rounded-xl bg-white/80 border border-purple-100 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Stage 1</span>
                  <span className="font-extrabold text-zinc-800">Raw Signals</span>
                  <span className="text-[10px] text-[#70717a]">132 Scraped</span>
                </div>

                <div className="p-2 rounded-xl bg-white/80 border border-purple-100 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Stage 2</span>
                  <span className="font-extrabold text-zinc-800">Canonical Events</span>
                  <span className="text-[10px] text-[#70717a]">Deduplicated</span>
                </div>

                <div className="p-2 rounded-xl bg-purple-100/80 border border-purple-300 flex flex-col items-center ring-1 ring-purple-300">
                  <span className="text-[10px] uppercase font-bold text-purple-600">Stage 3</span>
                  <span className="font-extrabold text-purple-950">Patterns</span>
                  <span className="text-[10px] text-purple-700 font-semibold">{correlations.length} Correlated</span>
                </div>

                <div className="p-2 rounded-xl bg-indigo-100/80 border border-indigo-300 flex flex-col items-center ring-1 ring-indigo-300">
                  <span className="text-[10px] uppercase font-bold text-indigo-600">Stage 4</span>
                  <span className="font-extrabold text-indigo-950">Insights</span>
                  <span className="text-[10px] text-indigo-700 font-semibold">Strategic Impact</span>
                </div>

                <div className="p-2 rounded-xl bg-emerald-100/80 border border-emerald-300 flex flex-col items-center ring-1 ring-emerald-300">
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Stage 5</span>
                  <span className="font-extrabold text-emerald-950">Actions</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Counter-Measures</span>
                </div>
              </div>
            </div>

            {/* Section Heading & Competitor Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#6e57dc]/10 text-[#6e57dc] border border-[#6e57dc]/20">
                    <Workflow className="w-3.5 h-3.5" />
                    Multi-Signal Correlation Engine
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    {correlations.length} Synthesized Strategic Clusters
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  Correlated Patterns & Strategic Implications
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5">
                  Fusing hiring, product landing pages, GitHub code repos, and conferences into concrete recommendations.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100/90 rounded-lg border border-zinc-200/80 self-start sm:self-auto text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCorrelationCompany("ALL")}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                    selectedCorrelationCompany === "ALL"
                      ? "bg-white text-[#17171b] shadow-sm font-bold"
                      : "text-[#70717a] hover:text-[#17171b]"
                  }`}
                >
                  All Correlations ({correlations.length})
                </button>
                {correlationCompanyNames.map((cname) => (
                  <button
                    key={cname}
                    type="button"
                    onClick={() => setSelectedCorrelationCompany(cname)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                      selectedCorrelationCompany === cname
                        ? "bg-white text-[#6e57dc] shadow-sm font-bold"
                        : "text-[#70717a] hover:text-[#17171b]"
                    }`}
                  >
                    {cname}
                  </button>
                ))}
              </div>
            </div>

            {/* Correlated Clusters List */}
            <div className="space-y-6">
              {filteredCorrelations.map((corr) => {
                const isExpanded = expandedCorrelationIds[corr.id] ?? true;
                const activeSigIdx = activeSignalIndices[corr.id] ?? 0;
                const activeSig: CorrelatedSignalNode | undefined = corr.signals_cluster[activeSigIdx];
                const catStyle = CORRELATION_CATEGORY_STYLES[corr.correlation_category] || {
                  bg: "bg-purple-50",
                  text: "text-purple-700",
                  border: "border-purple-200",
                  label: corr.correlation_category,
                };

                return (
                  <div
                    key={corr.id}
                    className="rounded-2xl border border-[rgba(20,20,30,0.1)] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Top Correlation Banner */}
                    <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-50 via-white to-purple-50/20 border-b border-zinc-100">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <PrismCompanyBadge
                            name={corr.company_name}
                            isTarget={corr.company_name.toLowerCase() === targetCompany.toLowerCase()}
                            size="sm"
                          />
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            {catStyle.label}
                          </span>
                          <span className="text-xs text-zinc-300">•</span>
                          <span className="text-xs font-semibold text-[#70717a] flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-[#6e57dc]" />
                            {corr.signals_cluster.length} Correlated Signal Sources
                          </span>
                        </div>

                        {/* Confidence score pill */}
                        <div className="flex items-center gap-2 self-start md:self-auto">
                          <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-extrabold text-emerald-800">
                              {corr.confidence}% Correlation Match
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleExpandCorrelation(corr.id)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
                            aria-label="Toggle correlation details"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Pattern Title */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                          Synthesized Strategic Pattern:
                        </span>
                        <h3 className="text-lg sm:text-xl font-extrabold text-[#17171b] tracking-tight">
                          {corr.pattern_name}
                        </h3>
                        {corr.pattern_summary && (
                          <p className="text-xs text-[#70717a] leading-relaxed font-medium pt-0.5">
                            {corr.pattern_summary}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Multi-Signal Fusion Hub */}
                    <div className="p-5 sm:p-6 bg-zinc-50/60 border-b border-zinc-100">
                      <div className="text-[11px] font-bold text-[#70717a] uppercase tracking-wider mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Workflow className="w-3.5 h-3.5 text-[#6e57dc]" />
                          Multi-Channel Correlated Indicators ({corr.signals_cluster.length})
                        </span>
                        <span className="text-[10px] text-zinc-400 lowercase font-normal">
                          Click node to inspect evidence proof
                        </span>
                      </div>

                      {/* Signals Connected Pipeline Strip */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {corr.signals_cluster.map((sig, sIdx) => {
                          const isSelected = sIdx === activeSigIdx;
                          const isLast = sIdx === corr.signals_cluster.length - 1;

                          return (
                            <React.Fragment key={sIdx}>
                              <button
                                type="button"
                                onClick={() => setActiveSignalIndices((prev) => ({ ...prev, [corr.id]: sIdx }))}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left border transition-all ${
                                  isSelected
                                    ? "bg-white text-zinc-900 border-[#6e57dc] shadow-md ring-2 ring-[#6e57dc]/20 scale-102"
                                    : "bg-white/80 hover:bg-white text-zinc-700 border-zinc-200/90 shadow-2xs hover:border-zinc-300"
                                }`}
                                style={{ minWidth: "160px", maxWidth: "240px" }}
                              >
                                <div className="shrink-0 p-1 rounded-md bg-purple-50 text-[#6e57dc]">
                                  {getSourceIcon(sig.signal_type || sig.source)}
                                </div>
                                <div className="overflow-hidden">
                                  <div className="text-[10px] font-bold text-[#6e57dc] uppercase tracking-wider">
                                    {sig.signal_type}
                                  </div>
                                  <div className="text-xs font-bold text-[#17171b] truncate mt-0.5">
                                    {sig.title}
                                  </div>
                                </div>
                              </button>

                              {!isLast && (
                                <div className="text-purple-400 flex items-center justify-center font-bold">
                                  <Plus className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Active Correlated Signal Proof Inspector */}
                      {activeSig && (
                        <div className="mt-4 p-4 bg-white rounded-xl border border-zinc-200/90 shadow-2xs space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {activeSig.signal_type}
                              </span>
                              <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900">
                                {activeSig.title}
                              </h4>
                            </div>
                            <span className="text-[11px] text-zinc-400 font-mono">
                              Detected: {activeSig.detected_at.split("T")[0]}
                            </span>
                          </div>

                          {/* Verbatim quote */}
                          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80 text-xs text-zinc-800 font-mono italic leading-relaxed">
                            &ldquo;{activeSig.excerpt}&rdquo;
                          </div>

                          {activeSig.url && (
                            <div className="flex items-center justify-between pt-0.5 text-xs">
                              <a
                                href={activeSig.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[#6e57dc] hover:text-[#5841cb] font-bold hover:underline"
                              >
                                <span>Verify Primary Signal ({activeSig.source})</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <span className="text-[10px] text-zinc-400">
                                Corroboration Engine Weight: {activeSig.weight ? `${Math.round(activeSig.weight * 100)}%` : "25%"}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expandable Strategic Implication & Recommended Action Drawer */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 bg-gradient-to-b from-white to-zinc-50/70 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Stage 4: Strategic Implication */}
                        <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                            Stage 4: Strategic Implication (Insight)
                          </div>
                          <p className="text-xs text-purple-950 leading-relaxed font-medium">
                            {corr.strategic_implication}
                          </p>
                        </div>

                        {/* Stage 5: Recommended Action */}
                        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                            <Lightbulb className="w-3.5 h-3.5 text-emerald-700" />
                            Stage 5: Recommended Counter-Action
                          </div>
                          <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                            {corr.recommended_action}
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
          {/* ATOMIC RAW SIGNALS STREAM & NOISE SUPPRESSION */}
          {/* ========================================================================= */}
          <section className="space-y-6 pt-6 border-t border-[rgba(20,20,30,0.08)]">
            <div>
              <div className="app-eyebrow mb-1">
                <span className="app-dot" />
                Raw Signal Stream & Verification Archive
              </div>
              <h2 className="text-lg font-bold text-[#17171b]">
                All Verified Atomic Signals ({signals.length})
              </h2>
              <p className="text-xs text-[#70717a] mt-0.5">
                Every granular data point captured from GitHub commits, job postings, pricing changes, and news announcements.
              </p>
            </div>

            {/* Noise-Suppression Disclosure Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50/60 via-white to-blue-50/50 border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#6e57dc] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#17171b]">
                    Signal-to-Noise Verification Active
                  </div>
                  <div className="text-[11px] text-[#70717a]">
                    PrismIQ filters out promotional noise, affiliate links, and automated PR blasts before presenting intelligence.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[rgba(20,20,30,0.06)]">
                <div>
                  <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Validated</span>
                  <span className="text-sm font-extrabold text-[#17171b]">{signals.length} signals</span>
                </div>
                <div className="h-6 w-[1px] bg-zinc-200" />
                <div>
                  <span className="text-[#9ca3af] block text-[10px] uppercase font-bold flex items-center gap-1">
                    <VolumeX className="w-3 h-3 text-[#9ca3af]" /> Suppressed
                  </span>
                  <span className="text-sm font-extrabold text-[#70717a]">{noiseCount} noise items</span>
                </div>
              </div>
            </div>

            {/* Filters Strip */}
            <div className="space-y-3">
              {/* Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                  <input
                    type="text"
                    placeholder="Search signal headlines, excerpts, or companies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="app-search-input w-full"
                  />
                </div>

                <div className="text-xs text-[#70717a] font-medium flex items-center gap-2">
                  <span>
                    Showing <strong>{filteredSignals.length}</strong> of {signals.length} signals
                  </span>
                  {(selectedSource !== "ALL" || selectedCompany !== "ALL" || selectedConfidence !== "ALL" || searchQuery) && (
                    <button onClick={resetFilters} className="text-[#6e57dc] hover:underline font-bold">
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* Source Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] shrink-0 mr-1">
                  Source:
                </span>
                {["ALL", "news", "github", "jobs", "pricing", "research"].map((srcKey) => (
                  <button
                    key={srcKey}
                    onClick={() => setSelectedSource(srcKey)}
                    className={`app-filter-btn ${selectedSource === srcKey ? "app-filter-btn-active" : ""}`}
                  >
                    {srcKey === "ALL" ? "All Sources" : srcKey.charAt(0).toUpperCase() + srcKey.slice(1)}
                  </button>
                ))}
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
                  All Companies ({signals.length})
                </button>
                {companies.map((comp) => {
                  const count = signals.filter(
                    (s) => s.company_name.toLowerCase() === comp.company_name.toLowerCase()
                  ).length;
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
                      {comp.company_name} {count > 0 ? `(${count})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Raw Signals Stream Cards */}
            {filteredSignals.length === 0 ? (
              <PrismEmptyState
                icon={<Filter className="w-6 h-6" />}
                title="No Signals Found"
                description="No raw signals matched your filter criteria."
                actionText="Reset Filters"
                onAction={resetFilters}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSignals.slice(0, 30).map((sig) => (
                  <PrismCard
                    key={sig.id}
                    interactive
                    onClick={() =>
                      openEvidence({
                        id: sig.id,
                        title: sig.title,
                        company_name: sig.company_name,
                        why_it_matters: sig.why_it_matters,
                        confidence: sig.confidence || sig.fact_confidence,
                        tier: sig.tier,
                        raw_excerpt: sig.raw_excerpt,
                        url: sig.url,
                        source: sig.source,
                        published_timestamp: sig.published_timestamp || sig.published_at,
                        corroboration_count: sig.corroboration_count,
                      })
                    }
                    className="p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <PrismCompanyBadge
                            name={sig.company_name}
                            isTarget={sig.company_name.toLowerCase() === targetCompany.toLowerCase()}
                            size="sm"
                          />
                          <span className="app-badge-gray flex items-center gap-1 text-[11px]">
                            {getSourceIcon(sig.source)}
                            <span className="capitalize">{sig.source}</span>
                          </span>
                        </div>
                        <PrismConfidenceBadge confidence={sig.confidence || sig.fact_confidence} />
                      </div>

                      <h3 className="font-bold text-sm text-[#17171b] line-clamp-2 mb-2">
                        {sig.title}
                      </h3>

                      {sig.raw_excerpt && (
                        <p className="text-xs text-[#70717a] line-clamp-3 leading-relaxed mb-3 font-mono bg-zinc-50/80 p-2.5 rounded-lg border border-zinc-100">
                          &ldquo;{sig.raw_excerpt}&rdquo;
                        </p>
                      )}

                      {sig.why_it_matters && (
                        <div className="text-[11px] text-[#6e57dc] font-medium leading-relaxed bg-[#6e57dc]/5 p-2 rounded border border-[#6e57dc]/10">
                          <strong className="font-bold uppercase tracking-wider text-[10px] block text-[#6e57dc] mb-0.5">
                            Why It Matters:
                          </strong>
                          {sig.why_it_matters}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-4 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-[11px] text-[#9ca3af]">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {sig.published_timestamp || sig.published_at || "Recent"}
                      </span>

                      {sig.url ? (
                        <a
                          href={sig.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-[#6e57dc] hover:text-[#5841cb] flex items-center gap-1"
                        >
                          <span>View Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="font-semibold text-[#6e57dc]">
                          {sig.corroboration_count} sources
                        </span>
                      )}
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
