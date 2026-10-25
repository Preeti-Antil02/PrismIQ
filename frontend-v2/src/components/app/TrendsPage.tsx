"use client";

import * as React from "react";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  GitBranch,
  Newspaper,
  Briefcase,
  DollarSign,
  ChevronRight,
  ExternalLink,
  Workflow,
  Calendar,
  Layers,
  ArrowRight,
  Target,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
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
  fetchSignals,
  fetchTrackedCompanies,
  fetchCompetitiveSequences,
  fetchSignalCorrelations,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type TrackedCompany,
  type CompetitiveSequenceRecord,
  type SequenceStep,
  type SignalCorrelationRecord,
  type CorrelatedSignalNode,
} from "@/lib/api";

const DIMENSION_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  hiring: {
    bg: "bg-blue-50/70",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Hiring Signal",
  },
  compliance: {
    bg: "bg-emerald-50/70",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Compliance & Security",
  },
  pricing: {
    bg: "bg-amber-50/70",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Pricing Structure",
  },
  proof: {
    bg: "bg-purple-50/70",
    text: "text-purple-700",
    border: "border-purple-200",
    label: "Case Study / Proof",
  },
  go_to_market: {
    bg: "bg-indigo-50/70",
    text: "text-indigo-700",
    border: "border-indigo-200",
    label: "GTM / Field Sales",
  },
  partnerships: {
    bg: "bg-cyan-50/70",
    text: "text-cyan-700",
    border: "border-cyan-200",
    label: "Strategic Alliance",
  },
  product: {
    bg: "bg-violet-50/70",
    text: "text-violet-700",
    border: "border-violet-200",
    label: "Product Infrastructure",
  },
  infrastructure: {
    bg: "bg-teal-50/70",
    text: "text-teal-700",
    border: "border-teal-200",
    label: "Core Infrastructure",
  },
  margin_disruption: {
    bg: "bg-rose-50/70",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Disruption Vector",
  },
};

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
    label: "Enterprise Market & Compliance",
  },
  cloud_margin: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Cloud Margin & Bandwidth Disruption",
  },
  cloud_infrastructure: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Infrastructure Baseload & Compute",
  },
  mobile_logistics: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Merchant App & Logistics Tier",
  },
};

export function TrendsPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [sequences, setSequences] = React.useState<CompetitiveSequenceRecord[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = React.useState<string>("ALL");
  const [activeStepIndices, setActiveStepIndices] = React.useState<Record<string, number>>({});
  const [correlations, setCorrelations] = React.useState<SignalCorrelationRecord[]>([]);
  const [selectedCorrelationCompany, setSelectedCorrelationCompany] = React.useState<string>("ALL");
  const [activeSignalIndices, setActiveSignalIndices] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, signalsRes, compsRes, seqRes, corrRes] = await Promise.all([
        fetchEvents({ limit: 150 }),
        fetchSignals({ limit: 300 }),
        fetchTrackedCompanies(),
        fetchCompetitiveSequences().catch(() => ({ sequences: [], count: 0, filter: "ALL" })),
        fetchSignalCorrelations().catch(() => ({ correlations: [], count: 0, filter: "ALL" })),
      ]);
      setEvents(eventsRes.events || []);
      setSignals(signalsRes.signals || []);
      setCompanies(compsRes || []);
      setSequences(seqRes.sequences || []);
      setCorrelations(corrRes.correlations || []);

      const initialSignalMap: Record<string, number> = {};
      (corrRes.correlations || []).forEach((c) => {
        initialSignalMap[c.id] = 0;
      });
      setActiveSignalIndices(initialSignalMap);

      // Default active step to the final step of each sequence
      const initialStepMap: Record<string, number> = {};
      (seqRes.sequences || []).forEach((seq) => {
        initialStepMap[seq.id] = (seq.sequence_steps?.length || 1) - 1;
      });
      setActiveStepIndices(initialStepMap);
    } catch (err: any) {
      setError(err.message || "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Trend Metrics from Real Data
  const sourceBreakdown = React.useMemo(() => {
    const counts: Record<string, number> = {
      news: 0,
      github: 0,
      jobs: 0,
      pricing: 0,
      research: 0,
    };
    signals.forEach((s) => {
      const src = (s.source || "news").toLowerCase();
      if (src.includes("github")) counts.github = (counts.github || 0) + 1;
      else if (src.includes("job") || src.includes("career")) counts.jobs = (counts.jobs || 0) + 1;
      else if (src.includes("pricing")) counts.pricing = (counts.pricing || 0) + 1;
      else if (src.includes("research")) counts.research = (counts.research || 0) + 1;
      else counts.news = (counts.news || 0) + 1;
    });
    const total = signals.length || 1;
    return Object.entries(counts).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [signals]);

  const tierBreakdown = React.useMemo(() => {
    const counts = { must: 0, should: 0, nice: 0 };
    events.forEach((e) => {
      const t = (e.tier || "").toLowerCase();
      if (t.includes("must")) counts.must++;
      else if (t.includes("should")) counts.should++;
      else counts.nice++;
    });
    const total = events.length || 1;
    return {
      must: { count: counts.must, pct: Math.round((counts.must / total) * 100) },
      should: { count: counts.should, pct: Math.round((counts.should / total) * 100) },
      nice: { count: counts.nice, pct: Math.round((counts.nice / total) * 100) },
    };
  }, [events]);

  const companyActivityShare = React.useMemo(() => {
    const map: Record<string, { events: number; signals: number }> = {};
    companies.forEach((c) => {
      map[c.company_name] = { events: 0, signals: 0 };
    });
    events.forEach((e) => {
      if (map[e.company_name]) map[e.company_name].events++;
      else map[e.company_name] = { events: 1, signals: 0 };
    });
    signals.forEach((s) => {
      if (map[s.company_name]) map[s.company_name].signals++;
      else map[s.company_name] = { events: 0, signals: 1 };
    });
    const maxSignals = Math.max(...Object.values(map).map((v) => v.signals), 1);
    return Object.entries(map).map(([name, val]) => ({
      name,
      events: val.events,
      signals: val.signals,
      relativePct: Math.round((val.signals / maxSignals) * 100),
    }));
  }, [companies, events, signals]);

  // Unique companies with detected sequences
  const sequenceCompanies = React.useMemo(() => {
    const set = new Set<string>();
    sequences.forEach((s) => set.add(s.company_name));
    return Array.from(set);
  }, [sequences]);

  // Filtered sequences based on user tab selection
  const filteredSequences = React.useMemo(() => {
    if (selectedCompanyFilter === "ALL") return sequences;
    return sequences.filter(
      (s) => s.company_name.toLowerCase() === selectedCompanyFilter.toLowerCase()
    );
  }, [sequences, selectedCompanyFilter]);

  const correlationCompanies = React.useMemo(() => {
    const set = new Set<string>();
    correlations.forEach((c) => set.add(c.company_name));
    return Array.from(set).sort();
  }, [correlations]);

  const filteredCorrelations = React.useMemo(() => {
    if (selectedCorrelationCompany === "ALL") return correlations;
    return correlations.filter(
      (c) => c.company_name.toLowerCase() === selectedCorrelationCompany.toLowerCase()
    );
  }, [correlations, selectedCorrelationCompany]);

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Competitive Trend Dynamics & Historical Memory
          </div>
          <h1 className="app-title-lg">
            Market & Signal Trends for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Derived trends and multi-month sequence detection calculated from corroborated signals across hiring, compliance, pricing, proof, and strategic partnerships.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Intelligence</span>
        </PrismButton>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={4} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Compute Trends"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : (
        <div className="space-y-12">
          {/* ========================================================================= */}
          {/* POINT 2: HISTORICAL COMPETITIVE MEMORY & MULTI-MONTH SEQUENCE DETECTION */}
          {/* ========================================================================= */}
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#6e57dc]/10 text-[#6e57dc] border border-[#6e57dc]/20">
                    <Workflow className="w-3.5 h-3.5" />
                    Multi-Month Sequence Detection
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    {sequences.length} Strategic Patterns Detected
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  Historical Competitive Memory Pipeline
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5">
                  PrismIQ connects isolated milestones across months into unified strategic intent
                  (e.g., Hiring → SOC2 → Enterprise Pricing → Case Study → Enterprise Expansion).
                </p>
              </div>

              {/* Competitor filter tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100/90 rounded-lg border border-zinc-200/80 self-start sm:self-auto text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCompanyFilter("ALL")}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                    selectedCompanyFilter === "ALL"
                      ? "bg-white text-[#17171b] shadow-sm"
                      : "text-[#70717a] hover:text-[#17171b]"
                  }`}
                >
                  All Competitors ({sequences.length})
                </button>
                {sequenceCompanies.map((cname) => (
                  <button
                    key={cname}
                    type="button"
                    onClick={() => setSelectedCompanyFilter(cname)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                      selectedCompanyFilter === cname
                        ? "bg-white text-[#6e57dc] shadow-sm font-bold"
                        : "text-[#70717a] hover:text-[#17171b]"
                    }`}
                  >
                    {cname}
                  </button>
                ))}
              </div>
            </div>

            {/* Sequence Cards List */}
            {filteredSequences.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl">
                <Workflow className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No multi-month sequence detected for this filter</p>
                <p className="text-xs text-zinc-500 mt-1">Select &apos;All Competitors&apos; to view all synthesized patterns.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredSequences.map((seq) => {
                  const activeStepIdx = activeStepIndices[seq.id] ?? (seq.sequence_steps.length - 1);
                  const activeStep: SequenceStep | undefined = seq.sequence_steps[activeStepIdx];
                  const dimStyle = activeStep ? (DIMENSION_STYLES[activeStep.dimension] || {
                    bg: "bg-zinc-100",
                    text: "text-zinc-800",
                    border: "border-zinc-300",
                    label: activeStep.dimension,
                  }) : null;

                  return (
                    <div
                      key={seq.id}
                      className="rounded-2xl border border-[rgba(20,20,30,0.1)] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Top Sequence Header Bar */}
                      <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-50 via-white to-purple-50/20 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <PrismCompanyBadge
                              name={seq.company_name}
                              isTarget={seq.company_name.toLowerCase() === targetCompany.toLowerCase()}
                              size="sm"
                            />
                            <span className="text-xs text-zinc-300">•</span>
                            <span className="text-xs font-semibold text-[#70717a] flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#6e57dc]" />
                              {seq.time_horizon}
                            </span>
                            <span className="text-xs text-zinc-300">•</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100/70 text-purple-800 border border-purple-200">
                              {seq.sequence_steps.length} Verified Milestones
                            </span>
                          </div>

                          <div className="flex flex-wrap items-baseline gap-2 pt-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                              Synthesized Pattern:
                            </span>
                            <h3 className="text-lg sm:text-xl font-extrabold text-[#17171b] tracking-tight">
                              {seq.pattern_name}
                            </h3>
                          </div>
                        </div>

                        {/* Confidence & Impact Pills */}
                        <div className="flex items-center gap-2.5 self-start md:self-auto">
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-extrabold text-emerald-800">
                              {seq.confidence}% Confidence
                            </span>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span className="text-xs font-bold text-rose-800">
                              {seq.potential_impact} Impact
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Milestone Pipeline Track */}
                      <div className="p-5 sm:p-6 bg-zinc-50/50 border-b border-zinc-100">
                        <div className="text-xs font-bold text-[#70717a] uppercase tracking-wider mb-3 flex items-center justify-between">
                          <span>Chronological Multi-Month Sequence</span>
                          <span className="text-[11px] font-normal lowercase text-zinc-400">
                            Click milestone to inspect evidence
                          </span>
                        </div>

                        {/* Pipeline Node Strip */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                          {seq.sequence_steps.map((st, idx) => {
                            const isSelected = idx === activeStepIdx;
                            const isLast = idx === seq.sequence_steps.length - 1;
                            const stepDim = DIMENSION_STYLES[st.dimension] || {
                              bg: "bg-zinc-100",
                              text: "text-zinc-700",
                              border: "border-zinc-300",
                              label: st.dimension,
                            };

                            return (
                              <React.Fragment key={st.step_number}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveStepIndices((prev) => ({ ...prev, [seq.id]: idx }))
                                  }
                                  className={`flex-shrink-0 text-left p-3 rounded-xl border transition-all duration-200 ${
                                    isSelected
                                      ? "bg-white border-[#6e57dc] shadow-md ring-2 ring-[#6e57dc]/20 translate-y-[-2px]"
                                      : "bg-white/80 hover:bg-white border-zinc-200/80 hover:border-zinc-300 shadow-xs"
                                  }`}
                                  style={{ minWidth: "165px", maxWidth: "200px" }}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                                      {st.month}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${stepDim.bg} ${stepDim.text} ${stepDim.border}`}
                                    >
                                      Step {st.step_number}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold text-[#17171b] line-clamp-1 mt-1">
                                    {st.event_title}
                                  </h4>
                                  <div className="text-[10px] text-[#70717a] font-medium mt-1 truncate">
                                    {stepDim.label}
                                  </div>
                                </button>

                                {!isLast && (
                                  <div className="flex-shrink-0 text-zinc-300">
                                    <ArrowRight className="w-4 h-4 text-purple-400" />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {/* Final Pattern Synthesis Outcome Node */}
                          <div className="flex-shrink-0 text-zinc-300">
                            <ArrowRight className="w-4 h-4 text-emerald-500 font-bold" />
                          </div>
                          <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md min-w-[175px]">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-purple-200 flex items-center gap-1">
                              <Target className="w-3 h-3 text-emerald-300" />
                              Pattern Result
                            </div>
                            <div className="text-xs font-extrabold text-white mt-1 line-clamp-1">
                              {seq.pattern_name}
                            </div>
                            <div className="text-[10px] text-emerald-200 font-bold mt-0.5">
                              {seq.confidence}% Pattern Match
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Active Milestone Inspector Drawer */}
                      {activeStep && (
                        <div className="p-5 sm:p-6 bg-white border-b border-zinc-100">
                          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[#6e57dc] text-white flex items-center justify-center text-xs font-bold">
                                  {activeStep.step_number}
                                </span>
                                <h4 className="font-extrabold text-sm sm:text-base text-[#17171b]">
                                  {activeStep.event_title}
                                </h4>
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${dimStyle?.bg} ${dimStyle?.text} ${dimStyle?.border}`}
                                >
                                  {dimStyle?.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs font-semibold text-[#70717a]">
                                <Calendar className="w-3.5 h-3.5 text-[#6e57dc]" />
                                <span>{activeStep.month}</span>
                                <span>•</span>
                                <span className="text-[#6e57dc] font-bold">
                                  {activeStep.signals_count} corroborated signal{activeStep.signals_count > 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>

                            {/* Verbatim quote / proof excerpt */}
                            <div className="p-3 bg-white rounded-lg border border-zinc-200 text-xs text-zinc-700 font-mono leading-relaxed relative">
                              <span className="text-zinc-400 font-serif text-lg leading-none absolute top-2 left-2">
                                &ldquo;
                              </span>
                              <p className="pl-4 italic text-zinc-800">
                                {activeStep.evidence_excerpt}
                              </p>
                            </div>

                            {/* Primary proof link */}
                            {activeStep.evidence_url && (
                              <div className="flex items-center justify-between pt-1 text-xs">
                                <a
                                  href={activeStep.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-bold text-[#6e57dc] hover:text-[#5841cb] hover:underline"
                                >
                                  <span>Verify Primary Source</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <span className="text-[11px] text-zinc-400">
                                  Corroborated by PrismIQ Verification Engine
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Strategic Synthesis & Tactical Counter-Action */}
                      <div className="p-5 sm:p-6 bg-gradient-to-b from-white to-zinc-50/70 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            Strategic Interpretation
                          </div>
                          <p className="text-xs text-purple-950 leading-relaxed font-medium">
                            {seq.strategic_interpretation}
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                            <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
                            Recommended Counter-Action
                          </div>
                          <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                            {seq.recommended_action}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* POINT 4: SIGNAL CORRELATION ENGINE & 5-STAGE STRATEGIC IMPLICATION PIPELINE */}
          {/* ========================================================================= */}
          <section className="space-y-5 pt-6 border-t border-[rgba(20,20,30,0.07)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    <Layers className="w-3.5 h-3.5" />
                    Point 4 • 5-Stage Synthesis Pipeline
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    {correlations.length} Correlated Signal Chains
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  Signal Correlation Engine & Strategic Implication Pipeline
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5">
                  Raw telemetry clustered across sources into high-confidence patterns and competitive counter-actions.
                </p>
              </div>

              {/* Correlation competitor filter */}
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
                  All ({correlations.length})
                </button>
                {correlationCompanies.map((cname) => (
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

            {/* Correlation Cards */}
            {filteredCorrelations.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl">
                <Layers className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No signal correlations match this filter</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredCorrelations.map((corr) => {
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
                      className="rounded-2xl border border-[rgba(20,20,30,0.1)] bg-white shadow-xs overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Card Header */}
                      <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-50 via-white to-purple-50/20 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <PrismCompanyBadge
                              name={corr.company_name}
                              isTarget={corr.company_name.toLowerCase() === targetCompany.toLowerCase()}
                              size="sm"
                            />
                            <span className="text-xs text-zinc-300">•</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                              {catStyle.label}
                            </span>
                            <span className="text-xs text-zinc-300">•</span>
                            <span className="text-xs font-semibold text-[#70717a] flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-[#6e57dc]" />
                              {corr.signals_cluster.length} Correlated Signal Sources
                            </span>
                          </div>

                          <h3 className="text-lg sm:text-xl font-extrabold text-[#17171b] tracking-tight pt-1">
                            {corr.pattern_name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2.5 self-start md:self-auto">
                          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#6e57dc]" />
                            <span className="text-xs font-extrabold text-purple-900">
                              {corr.confidence}% Calibrated
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 5-Stage Synthesis Progression Strip */}
                      <div className="px-5 sm:px-6 py-3 bg-zinc-50/80 border-b border-zinc-100 flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mr-2">
                          Pipeline Stage:
                        </span>
                        {["Raw Signals", "Events", "Patterns", "Insights", "Actions"].map((stage, sIdx) => {
                          const isComplete = true;
                          return (
                            <React.Fragment key={stage}>
                              <span
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 ${
                                  stage === "Actions"
                                    ? "bg-zinc-900 text-white shadow-xs"
                                    : "bg-white text-[#17171b] border border-zinc-200"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${stage === "Actions" ? "bg-green-400" : "bg-[#6e57dc]"}`} />
                                {stage}
                              </span>
                              {sIdx < 4 && <ArrowRight className="w-3 h-3 text-zinc-400" />}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Connected Signals Strip */}
                      <div className="p-5 sm:p-6 space-y-4">
                        <div className="space-y-2">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a] flex items-center justify-between">
                            <span>Corroborating Signal Nodes ({corr.signals_cluster.length})</span>
                            <span className="text-zinc-400 font-normal">Select node to inspect evidence proof</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {corr.signals_cluster.map((sig, sIdx) => {
                              const isSelected = sIdx === activeSigIdx;
                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => setActiveSignalIndices((prev) => ({ ...prev, [corr.id]: sIdx }))}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? "bg-[#6e57dc] text-white shadow-xs"
                                      : "bg-zinc-100 hover:bg-zinc-200 text-[#374151]"
                                  }`}
                                >
                                  <span>{sig.signal_type || sig.source}</span>
                                  {sig.weight && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-zinc-200 text-[#70717a]"}`}>
                                      {Math.round(sig.weight * 100)}%
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Active Signal Inspector */}
                        {activeSig && (
                          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-[#17171b]">{activeSig.title}</span>
                              <span className="text-[#70717a] text-[11px]">{activeSig.source}</span>
                            </div>
                            {activeSig.excerpt && (
                              <blockquote className="p-2.5 rounded-lg bg-white border border-zinc-200 text-[#4b5563] italic">
                                &ldquo;{activeSig.excerpt}&rdquo;
                              </blockquote>
                            )}
                            {activeSig.url && (
                              <a
                                href={activeSig.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-[#6e57dc] hover:underline"
                              >
                                View Primary Source Document <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Strategic Implication & Recommended Action */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              Strategic Implication
                            </div>
                            <p className="text-xs text-purple-950 font-medium leading-relaxed">
                              {corr.strategic_implication}
                            </p>
                          </div>

                          <div className="p-4 rounded-xl bg-zinc-900 text-white space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              Recommended Action
                            </div>
                            <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                              {corr.recommended_action}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* MACRO BREAKDOWN GRIDS */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[rgba(20,20,30,0.07)]">
            {/* Source Footprint Chart */}
            <PrismCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="app-title-sm">Monitored Source Distribution</h3>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    Signal share by channel across {signals.length} validated items
                  </p>
                </div>
                <PieChart className="w-4 h-4 text-[#6e57dc]" />
              </div>

              <div className="space-y-3 pt-2">
                {sourceBreakdown.map((src) => (
                  <div key={src.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#17171b]">{src.name}</span>
                      <span className="text-[#70717a] font-bold">
                        {src.count} ({src.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#6e57dc] to-[#72d7e8] transition-all duration-500"
                        style={{ width: `${Math.max(src.pct, 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </PrismCard>

            {/* Impact Tier Distribution */}
            <PrismCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="app-title-sm">Event Impact Breakdown</h3>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    Distribution of {events.length} validated events by tier urgency
                  </p>
                </div>
                <BarChart3 className="w-4 h-4 text-[#6e57dc]" />
              </div>

              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-700 flex items-center gap-1.5">
                      <PrismTierBadge tier="Must-Know" size="sm" />
                      Critical Decisions
                    </span>
                    <span className="font-extrabold text-rose-700">
                      {tierBreakdown.must.count} ({tierBreakdown.must.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-rose-200/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-600 transition-all duration-500"
                      style={{ width: `${tierBreakdown.must.pct}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-700 flex items-center gap-1.5">
                      <PrismTierBadge tier="Should-Know" size="sm" />
                      Strategic Shifts
                    </span>
                    <span className="font-extrabold text-blue-700">
                      {tierBreakdown.should.count} ({tierBreakdown.should.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-blue-200/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${tierBreakdown.should.pct}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-700 flex items-center gap-1.5">
                      <PrismTierBadge tier="Nice-to-Know" size="sm" />
                      Background Signals
                    </span>
                    <span className="font-extrabold text-zinc-700">
                      {tierBreakdown.nice.count} ({tierBreakdown.nice.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-500 transition-all duration-500"
                      style={{ width: `${tierBreakdown.nice.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </PrismCard>
          </div>

          {/* ========================================================================= */}
          {/* COMPETITOR VELOCITY & ACTIVITY SHARE */}
          {/* ========================================================================= */}
          <div>
            <PrismSectionHeader
              title="Competitor Activity Share"
              subtitle="Relative signal momentum across your tracked competitive universe."
              eyebrow="Market Velocity"
            />

            <div className="app-card p-6">
              <div className="space-y-4">
                {companyActivityShare.map((comp) => (
                  <div key={comp.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <PrismCompanyBadge
                        name={comp.name}
                        isTarget={comp.name.toLowerCase() === targetCompany.toLowerCase()}
                        size="sm"
                      />
                      <div className="flex items-center gap-3 text-[#70717a] font-medium text-xs">
                        <span>{comp.events} events</span>
                        <span>•</span>
                        <span>
                          <strong>{comp.signals}</strong> signals
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#6e57dc] via-[#a36de8] to-[#35a9c2] transition-all duration-500"
                        style={{ width: `${Math.max(comp.relativePct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* UNDERLYING EVENTS DRIVING TRENDS */}
          {/* ========================================================================= */}
          <div>
            <PrismSectionHeader
              title="Underlying Events Driving Trends"
              subtitle="The specific corroborated developments contributing to current momentum."
              eyebrow="Trend Drivers"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.slice(0, 4).map((ev) => (
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
                  className="p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <PrismCompanyBadge
                        name={ev.company_name}
                        isTarget={ev.company_name.toLowerCase() === targetCompany.toLowerCase()}
                        size="sm"
                      />
                      <PrismTierBadge tier={ev.tier} />
                    </div>
                    <h3 className="font-bold text-sm text-[#17171b] line-clamp-2 mb-1.5">
                      {ev.title}
                    </h3>
                    {ev.why_it_matters && (
                      <p className="text-xs text-[#70717a] line-clamp-2 leading-relaxed">
                        {ev.why_it_matters}
                      </p>
                    )}
                  </div>
                  <div className="pt-3 mt-3 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-[11px] text-[#9ca3af]">
                    <span>{ev.published_timestamp || ev.published_at || "Recent"}</span>
                    <span className="font-semibold text-[#6e57dc] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {ev.corroboration_count || 1} sources
                    </span>
                  </div>
                </PrismCard>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
