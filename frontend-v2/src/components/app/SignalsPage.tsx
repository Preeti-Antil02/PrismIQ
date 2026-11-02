"use client";
import { sanitizeSourceUrl } from "@/lib/urlUtils";

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
  Eye,
  FileText,
  X,
  Check,
  Share2,
  SlidersHorizontal,
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
  type EvidenceItem,
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
  // 1. AI Infrastructure Investment
  ai_infrastructure_investment: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    label: "AI Infrastructure Investment",
  },
  // 2. Model Development
  model_development: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    label: "Model Development",
  },
  // 3. AI Product Launch
  ai_product_launch: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    label: "AI Product Launch",
  },
  // 4. Developer Ecosystem Expansion
  developer_ecosystem_expansion: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    label: "Developer Ecosystem Expansion",
  },
  // 5. Enterprise AI Expansion
  enterprise_ai_expansion: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Enterprise AI Expansion",
  },
  // 6. Pricing & Monetization
  pricing_monetization: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Pricing & Monetization",
  },
  // 7. Research & Innovation
  research_innovation: {
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-700",
    border: "border-fuchsia-200",
    label: "Research & Innovation",
  },
  // 8. Talent & Hiring
  talent_hiring: {
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
    label: "Talent & Hiring",
  },
  // 9. Strategic Partnerships
  strategic_partnerships: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    label: "Strategic Partnerships",
  },
  // 10. Cloud Infrastructure
  cloud_infrastructure: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    label: "Cloud Infrastructure",
  },
  // 11. Marketplace Expansion
  marketplace_expansion: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Marketplace Expansion",
  },
  // 12. Logistics & Operations
  logistics_operations: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    label: "Logistics & Operations",
  },
  // 13. Geographic Expansion
  geographic_expansion: {
    bg: "bg-lime-50",
    text: "text-lime-700",
    border: "border-lime-200",
    label: "Geographic Expansion",
  },
  // 14. Acquisitions & Funding
  acquisitions_funding: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    label: "Acquisitions & Funding",
  },
  // 15. Product Deprecation
  product_deprecation: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Product Deprecation",
  },
  // Legacy Aliases
  ai_investment: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    label: "AI Infrastructure Investment",
  },
  enterprise_shift: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Enterprise AI Expansion",
  },
};

export function getCorrelationCategoryStyle(category?: string) {
  if (!category) {
    return {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
      label: "Cross-Channel Strategic Shift",
    };
  }
  const cleanKey = category
    .toLowerCase()
    .trim()
    .replace(/[&/\\#,+()$~%.'":*?<>{}]/g, "")
    .replace(/\s+/g, "_");

  if (CORRELATION_CATEGORY_STYLES[cleanKey]) {
    return CORRELATION_CATEGORY_STYLES[cleanKey];
  }
  const directMatch = Object.entries(CORRELATION_CATEGORY_STYLES).find(
    ([k, v]) => v.label.toLowerCase() === category.toLowerCase() || k === category.toLowerCase()
  );
  if (directMatch) {
    return directMatch[1];
  }
  return {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    label: category,
  };
}

export function getChannelInfo(channel?: string, signalType?: string, source?: string) {
  const ch = (channel || "").toLowerCase();
  const st = (signalType || "").toLowerCase();
  const src = (source || "").toLowerCase();

  if (
    ch === "github" ||
    ch === "code" ||
    st.includes("github") ||
    st.includes("commit") ||
    st.includes("repo") ||
    src.includes("github")
  ) {
    return {
      key: "github",
      label: "GitHub / Code",
      fullLabel: "GitHub Repositories (Commits & Releases)",
      badgeBg: "bg-purple-50",
      badgeText: "text-purple-700",
      badgeBorder: "border-purple-200",
      icon: GitBranch,
      iconColor: "text-purple-600",
    };
  }
  if (
    ch === "careers" ||
    ch === "hiring" ||
    st.includes("job") ||
    st.includes("career") ||
    st.includes("hiring") ||
    src.includes("naukri") ||
    src.includes("greenhouse") ||
    src.includes("jobs")
  ) {
    return {
      key: "careers",
      label: "Careers & Hiring",
      fullLabel: "Careers & Job Postings",
      badgeBg: "bg-pink-50",
      badgeText: "text-pink-700",
      badgeBorder: "border-pink-200",
      icon: Briefcase,
      iconColor: "text-pink-600",
    };
  }
  if (
    ch === "pricing" ||
    ch === "packaging" ||
    st.includes("pricing") ||
    st.includes("fee") ||
    st.includes("commission") ||
    src.includes("pricing") ||
    src.includes("seller central")
  ) {
    return {
      key: "pricing",
      label: "Pricing & Packaging",
      fullLabel: "Pricing & Packaging Pages",
      badgeBg: "bg-emerald-50",
      badgeText: "text-emerald-700",
      badgeBorder: "border-emerald-200",
      icon: DollarSign,
      iconColor: "text-emerald-600",
    };
  }
  return {
    key: "news",
    label: "News & PR",
    fullLabel: "News & PR Releases",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    icon: Newspaper,
    iconColor: "text-blue-600",
  };
}

export function SignalsPage() {
  const { targetCompany, tenantId } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [correlations, setCorrelations] = React.useState<SignalCorrelationRecord[]>([]);
  const [noiseCount, setNoiseCount] = React.useState<number>(0);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Correlation Filter States
  const [selectedCorrelationCompany, setSelectedCorrelationCompany] = React.useState<string>("ALL");
  const [selectedCorrelationChannel, setSelectedCorrelationChannel] = React.useState<string>("ALL");
  const [correlationSearchQuery, setCorrelationSearchQuery] = React.useState<string>("");
  const [activeSignalIndices, setActiveSignalIndices] = React.useState<Record<string, number>>({});
  const [expandedCorrelationIds, setExpandedCorrelationIds] = React.useState<Record<string, boolean>>({});
  const [activePipelineStage, setActivePipelineStage] = React.useState<number | null>(null);

  // Modal / Drawer State for Correlated Signal Dossier
  const [selectedDossierCorrelation, setSelectedDossierCorrelation] = React.useState<SignalCorrelationRecord | null>(null);
  const [copiedDossierId, setCopiedDossierId] = React.useState<string | null>(null);

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
        fetchSignalCorrelations(
          selectedCorrelationCompany !== "ALL" ? selectedCorrelationCompany : undefined,
          undefined,
          tenantId,
          selectedCorrelationChannel !== "ALL" ? selectedCorrelationChannel : undefined
        ).catch(() => ({ correlations: [], count: 0, filter: "ALL" })),
      ]);
      setSignals(signalsRes.signals || []);
      setNoiseCount(signalsRes.noise_suppressed_count || 0);
      setCompanies(compsRes || []);
      setCorrelations(corrRes.correlations || []);

      // Default active signal index to 0 and expand correlations
      const initialSignalMap: Record<string, number> = {};
      const initialExpandMap: Record<string, boolean> = {};
      (corrRes.correlations || []).forEach((c, idx) => {
        initialSignalMap[c.id] = 0;
        initialExpandMap[c.id] = true;
      });
      setActiveSignalIndices(initialSignalMap);
      setExpandedCorrelationIds(initialExpandMap);
    } catch (err: any) {
      setError(err.message || "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedCorrelationCompany, selectedCorrelationChannel]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Companies represented in correlations
  const correlationCompanyNames = React.useMemo(() => {
    const set = new Set<string>();
    correlations.forEach((c) => {
      if (c.company_name) set.add(c.company_name);
    });
    return Array.from(set);
  }, [correlations]);

  // Filtered correlations with search query & stage filter
  const filteredCorrelations = React.useMemo(() => {
    let result = correlations;

    if (selectedCorrelationCompany !== "ALL") {
      result = result.filter(
        (c) => c.company_name.toLowerCase() === selectedCorrelationCompany.toLowerCase()
      );
    }

    if (selectedCorrelationChannel !== "ALL") {
      result = result.filter((c) => {
        const cluster = c.signals_cluster || c.signals || [];
        return cluster.some((s) => {
          const info = getChannelInfo(s.channel, s.signal_type, s.source);
          return info.key === selectedCorrelationChannel.toLowerCase();
        });
      });
    }

    if (correlationSearchQuery.trim()) {
      const q = correlationSearchQuery.toLowerCase();
      result = result.filter((c) => {
        const text = `${c.company_name} ${c.pattern_name} ${c.pattern_summary || ""} ${c.strategic_implication} ${c.recommended_action}`.toLowerCase();
        const signalText = (c.signals_cluster || c.signals || [])
          .map((s) => `${s.title} ${s.excerpt || s.evidence_excerpt || ""} ${s.source}`)
          .join(" ")
          .toLowerCase();
        return text.includes(q) || signalText.includes(q);
      });
    }

    return result;
  }, [correlations, selectedCorrelationCompany, selectedCorrelationChannel, correlationSearchQuery]);

  // Channel breakdown counts
  const channelCounts = React.useMemo(() => {
    let github = 0;
    let careers = 0;
    let news = 0;
    let pricing = 0;

    correlations.forEach((c) => {
      const cluster = c.signals_cluster || c.signals || [];
      cluster.forEach((s) => {
        const info = getChannelInfo(s.channel, s.signal_type, s.source);
        if (info.key === "github") github++;
        else if (info.key === "careers") careers++;
        else if (info.key === "pricing") pricing++;
        else news++;
      });
    });

    return { github, careers, news, pricing };
  }, [correlations]);

  // Client-side filtering for raw signals stream
  const filteredSignals = React.useMemo(() => {
    return signals.filter((sig) => {
      if (selectedSource !== "ALL" && (sig.source || "").toLowerCase() !== selectedSource.toLowerCase()) {
        return false;
      }
      if (selectedCompany !== "ALL" && (sig.company_name || "").toLowerCase() !== selectedCompany.toLowerCase()) {
        return false;
      }
      if (selectedConfidence !== "ALL") {
        const conf = (sig.confidence || sig.fact_confidence || "").toLowerCase();
        if (!conf.includes(selectedConfidence.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${sig.title || ""} ${sig.raw_excerpt || ""} ${sig.why_it_matters || ""} ${sig.company_name || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [signals, selectedSource, selectedCompany, selectedConfidence, searchQuery]);

  const toggleExpandCorrelation = (id: string) => {
    setExpandedCorrelationIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyDossier = (corr: SignalCorrelationRecord) => {
    const text = `[PrismIQ Signal Correlation Dossier]
Company: ${corr.company_name}
Pattern: ${corr.pattern_name}
Confidence: ${corr.confidence}%
Category: ${corr.correlation_category}
Strategic Implication: ${corr.strategic_implication}
Recommended Counter-Action: ${corr.recommended_action}
Constituent Signals:
${(corr.signals_cluster || corr.signals || []).map((s, idx) => `  ${idx + 1}. [${s.channel || s.signal_type}] ${s.title} (${s.source}) -> ${s.url || 'No URL'}\n     "${s.excerpt || s.evidence_excerpt || ''}"`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedDossierId(corr.id);
    setTimeout(() => setCopiedDossierId(null), 2500);
  };

  const handleOpenInProvenanceDrawer = (corr: SignalCorrelationRecord) => {
    const cluster = corr.signals_cluster || corr.signals || [];
    const firstSig = cluster[0];
    const evidenceItem: EvidenceItem = {
      id: corr.id,
      title: corr.pattern_name,
      company_name: corr.company_name,
      source: `Multi-Channel Correlation (${cluster.length} Verified Sources)`,
      url: firstSig?.url || "",
      published_at: corr.last_signal_at || corr.created_at,
      raw_excerpt: cluster.map((s) => `[${s.signal_type} • ${s.source}]: ${s.excerpt || s.evidence_excerpt || s.title}`).join("\n\n"),
      why_it_matters: corr.strategic_implication,
      confidence: `${corr.confidence}% Correlation Match`,
      tier: "CRITICAL CORRELATION",
      corroboration_count: cluster.length,
      contributing_sources: cluster.map((s) => s.source),
      contributing_signals: cluster.map((s) => ({
        source: s.source,
        title: s.title,
        url: s.url,
        raw_excerpt: s.excerpt || s.evidence_excerpt,
      })),
    };
    openEvidence(evidenceItem);
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Point 4: Cross-Channel Signal Correlation Engine
          </div>
          <h1 className="app-title-lg">
            Multi-Channel Signals & Strategic Correlation for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Correlating atomic indicators across 4 distinct channels: GitHub repositories (commit spikes/releases), Careers/Job postings, News &amp; PR releases, and Pricing/Packaging pages into unified strategic playbooks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PrismButton variant="light" size="sm" onClick={loadData}>
            <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Refresh Engine</span>
          </PrismButton>
        </div>
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
          {/* POINT 4: VISUAL 5-STAGE PIPELINE INTERACTIVE VIEW */}
          {/* ========================================================================= */}
          <section className="space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-blue-50/70 border border-purple-200/90 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6e57dc] animate-ping" />
                  <span className="text-xs font-bold text-purple-950 tracking-wider uppercase flex items-center gap-1.5">
                    <Workflow className="w-3.5 h-3.5 text-[#6e57dc]" />
                    Interactive 5-Stage Signal-to-Action Correlation Pipeline
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-purple-800 bg-white/90 px-3 py-0.5 rounded-full border border-purple-200 shadow-2xs">
                    Multi-Channel Corroboration Engine
                  </span>
                  {activePipelineStage && (
                    <button
                      type="button"
                      onClick={() => setActivePipelineStage(null)}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 underline"
                    >
                      Reset Stage View
                    </button>
                  )}
                </div>
              </div>

              {/* 5 Stages Grid - Clickable & Interactive */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1 text-left sm:text-center text-xs">
                {/* Stage 1: Raw Signals */}
                <button
                  type="button"
                  onClick={() => setActivePipelineStage(activePipelineStage === 1 ? null : 1)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left sm:text-center flex flex-col justify-between ${
                    activePipelineStage === 1
                      ? "bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300"
                      : "bg-white/90 hover:bg-white border-purple-100 hover:border-purple-300 shadow-2xs"
                  }`}
                >
                  <div className="flex sm:flex-col items-center sm:items-center justify-between gap-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activePipelineStage === 1 ? "text-purple-100" : "text-zinc-400"}`}>
                      Stage 1
                    </span>
                    <span className={`font-extrabold ${activePipelineStage === 1 ? "text-white" : "text-zinc-900"}`}>
                      Raw Signals
                    </span>
                  </div>
                  <div className={`text-[10px] mt-1.5 font-medium ${activePipelineStage === 1 ? "text-purple-100" : "text-[#70717a]"}`}>
                    Across 4 Distinct Channels
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center mt-2 pt-1.5 border-t border-purple-100/60">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activePipelineStage === 1 ? "bg-purple-700 text-white" : "bg-purple-50 text-purple-700"}`}>GitHub</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activePipelineStage === 1 ? "bg-purple-700 text-white" : "bg-pink-50 text-pink-700"}`}>Careers</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activePipelineStage === 1 ? "bg-purple-700 text-white" : "bg-blue-50 text-blue-700"}`}>News</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activePipelineStage === 1 ? "bg-purple-700 text-white" : "bg-emerald-50 text-emerald-700"}`}>Pricing</span>
                  </div>
                </button>

                {/* Stage 2: Canonical Events */}
                <button
                  type="button"
                  onClick={() => setActivePipelineStage(activePipelineStage === 2 ? null : 2)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left sm:text-center flex flex-col justify-between ${
                    activePipelineStage === 2
                      ? "bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300"
                      : "bg-white/90 hover:bg-white border-purple-100 hover:border-purple-300 shadow-2xs"
                  }`}
                >
                  <div className="flex sm:flex-col items-center sm:items-center justify-between gap-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activePipelineStage === 2 ? "text-purple-100" : "text-zinc-400"}`}>
                      Stage 2
                    </span>
                    <span className={`font-extrabold ${activePipelineStage === 2 ? "text-white" : "text-zinc-900"}`}>
                      Canonical Events
                    </span>
                  </div>
                  <div className={`text-[10px] mt-1.5 font-medium ${activePipelineStage === 2 ? "text-purple-100" : "text-[#70717a]"}`}>
                    Entity Resolution &amp; Deduplication
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-purple-100/60">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activePipelineStage === 2 ? "bg-purple-700 text-white" : "bg-indigo-50 text-indigo-700"}`}>
                      Zero-Noise Filtered
                    </span>
                  </div>
                </button>

                {/* Stage 3: Patterns */}
                <button
                  type="button"
                  onClick={() => setActivePipelineStage(activePipelineStage === 3 ? null : 3)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left sm:text-center flex flex-col justify-between ${
                    activePipelineStage === 3
                      ? "bg-[#6e57dc] text-white border-[#5841cb] shadow-md ring-2 ring-purple-300"
                      : "bg-purple-100/90 hover:bg-purple-100 border-purple-300 shadow-2xs ring-1 ring-purple-300/60"
                  }`}
                >
                  <div className="flex sm:flex-col items-center sm:items-center justify-between gap-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activePipelineStage === 3 ? "text-purple-200" : "text-purple-700"}`}>
                      Stage 3
                    </span>
                    <span className={`font-extrabold ${activePipelineStage === 3 ? "text-white" : "text-purple-950"}`}>
                      Patterns
                    </span>
                  </div>
                  <div className={`text-[10px] mt-1.5 font-semibold ${activePipelineStage === 3 ? "text-purple-100" : "text-purple-800"}`}>
                    Multi-Channel Clusters
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-purple-200/80">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activePipelineStage === 3 ? "bg-purple-800 text-white" : "bg-purple-200 text-purple-900"}`}>
                      {correlations.length} Correlated Clusters
                    </span>
                  </div>
                </button>

                {/* Stage 4: Insights */}
                <button
                  type="button"
                  onClick={() => setActivePipelineStage(activePipelineStage === 4 ? null : 4)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left sm:text-center flex flex-col justify-between ${
                    activePipelineStage === 4
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-300"
                      : "bg-indigo-100/90 hover:bg-indigo-100 border-indigo-300 shadow-2xs ring-1 ring-indigo-300/60"
                  }`}
                >
                  <div className="flex sm:flex-col items-center sm:items-center justify-between gap-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activePipelineStage === 4 ? "text-indigo-200" : "text-indigo-700"}`}>
                      Stage 4
                    </span>
                    <span className={`font-extrabold ${activePipelineStage === 4 ? "text-white" : "text-indigo-950"}`}>
                      Strategic Insights
                    </span>
                  </div>
                  <div className={`text-[10px] mt-1.5 font-semibold ${activePipelineStage === 4 ? "text-indigo-100" : "text-indigo-800"}`}>
                    Threat &amp; Margin Impact
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-indigo-200/80">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activePipelineStage === 4 ? "bg-indigo-800 text-white" : "bg-indigo-200 text-indigo-900"}`}>
                      Active Target Risk
                    </span>
                  </div>
                </button>

                {/* Stage 5: Actions */}
                <button
                  type="button"
                  onClick={() => setActivePipelineStage(activePipelineStage === 5 ? null : 5)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left sm:text-center flex flex-col justify-between ${
                    activePipelineStage === 5
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300"
                      : "bg-emerald-100/90 hover:bg-emerald-100 border-emerald-300 shadow-2xs ring-1 ring-emerald-300/60"
                  }`}
                >
                  <div className="flex sm:flex-col items-center sm:items-center justify-between gap-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activePipelineStage === 5 ? "text-emerald-200" : "text-emerald-700"}`}>
                      Stage 5
                    </span>
                    <span className={`font-extrabold ${activePipelineStage === 5 ? "text-white" : "text-emerald-950"}`}>
                      Counter-Actions
                    </span>
                  </div>
                  <div className={`text-[10px] mt-1.5 font-semibold ${activePipelineStage === 5 ? "text-emerald-100" : "text-emerald-800"}`}>
                    Tactical Playbooks
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-emerald-200/80">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activePipelineStage === 5 ? "bg-emerald-800 text-white" : "bg-emerald-200 text-emerald-900"}`}>
                      Defensive Playbooks
                    </span>
                  </div>
                </button>
              </div>

              {/* Stage Detail Callout if a Stage is clicked */}
              {activePipelineStage && (
                <div className="mt-3 p-3 bg-white/95 rounded-xl border border-purple-200 text-xs text-purple-950 flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#6e57dc] shrink-0" />
                    <span>
                      {activePipelineStage === 1 && "Stage 1 Focus: Multi-channel signal collectors continuously monitor GitHub commit spikes, Careers/Job boards, News & PR wires, and Pricing tier adjustments."}
                      {activePipelineStage === 2 && "Stage 2 Focus: Raw signals undergo semantic entity resolution, deduplicating repetitive articles into canonical corporate events."}
                      {activePipelineStage === 3 && "Stage 3 Focus: Correlating co-occurring events across all 4 channels to synthesize cohesive patterns with multi-channel corroboration confidence."}
                      {activePipelineStage === 4 && "Stage 4 Focus: Translating synthesized patterns into quantified strategic business implications for the active tenant."}
                      {activePipelineStage === 5 && "Stage 5 Focus: Formulating concrete, prioritized counter-actions and defensive playbooks before competitor initiatives reach market lock-in."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePipelineStage(null)}
                    className="p-1 hover:bg-zinc-100 rounded text-zinc-500 hover:text-zinc-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Filter Bar: Competitor Tabs, Channel Filter Pills, and Search */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Competitor Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100/90 rounded-xl border border-zinc-200/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCorrelationCompany("ALL")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      selectedCorrelationCompany === "ALL"
                        ? "bg-white text-[#17171b] shadow-xs font-bold"
                        : "text-[#70717a] hover:text-[#17171b]"
                    }`}
                  >
                    All Competitors ({correlations.length})
                  </button>
                  {correlationCompanyNames.map((cname) => (
                    <button
                      key={cname}
                      type="button"
                      onClick={() => setSelectedCorrelationCompany(cname)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        selectedCorrelationCompany === cname
                          ? "bg-white text-[#6e57dc] shadow-xs font-bold ring-1 ring-[#6e57dc]/20"
                          : "text-[#70717a] hover:text-[#17171b]"
                      }`}
                    >
                      {cname}
                    </button>
                  ))}
                </div>

                {/* Instant Search Bar */}
                <div className="relative w-full lg:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={correlationSearchQuery}
                    onChange={(e) => setCorrelationSearchQuery(e.target.value)}
                    placeholder="Search patterns, evidence, codes..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-white rounded-xl border border-zinc-200/90 focus:border-[#6e57dc] focus:outline-none focus:ring-2 focus:ring-[#6e57dc]/20 transition-all placeholder:text-zinc-400"
                  />
                  {correlationSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCorrelationSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Distinct Channels Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" />
                  Filter by Channel:
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedCorrelationChannel("ALL")}
                  className={`px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                    selectedCorrelationChannel === "ALL"
                      ? "bg-zinc-800 text-white border-zinc-900 shadow-2xs"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  All Channels
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCorrelationChannel("github")}
                  className={`px-2.5 py-1 rounded-lg font-semibold border flex items-center gap-1.5 transition-all ${
                    selectedCorrelationChannel === "github"
                      ? "bg-purple-600 text-white border-purple-700 shadow-2xs"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>GitHub / Code</span>
                  {channelCounts.github > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCorrelationChannel === "github" ? "bg-purple-700" : "bg-purple-200/80"}`}>
                      {channelCounts.github}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCorrelationChannel("careers")}
                  className={`px-2.5 py-1 rounded-lg font-semibold border flex items-center gap-1.5 transition-all ${
                    selectedCorrelationChannel === "careers"
                      ? "bg-pink-600 text-white border-pink-700 shadow-2xs"
                      : "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Careers &amp; Hiring</span>
                  {channelCounts.careers > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCorrelationChannel === "careers" ? "bg-pink-700" : "bg-pink-200/80"}`}>
                      {channelCounts.careers}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCorrelationChannel("news")}
                  className={`px-2.5 py-1 rounded-lg font-semibold border flex items-center gap-1.5 transition-all ${
                    selectedCorrelationChannel === "news"
                      ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>News &amp; PR Releases</span>
                  {channelCounts.news > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCorrelationChannel === "news" ? "bg-blue-700" : "bg-blue-200/80"}`}>
                      {channelCounts.news}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCorrelationChannel("pricing")}
                  className={`px-2.5 py-1 rounded-lg font-semibold border flex items-center gap-1.5 transition-all ${
                    selectedCorrelationChannel === "pricing"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Pricing &amp; Packaging</span>
                  {channelCounts.pricing > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCorrelationChannel === "pricing" ? "bg-emerald-700" : "bg-emerald-200/80"}`}>
                      {channelCounts.pricing}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Correlated Clusters List */}
            {filteredCorrelations.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-center">
                <Workflow className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-zinc-800">
                  {selectedCorrelationCompany !== "ALL"
                    ? `No Correlated Signals for ${selectedCorrelationCompany}`
                    : "No Matching Correlated Clusters"}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                  {selectedCorrelationCompany !== "ALL"
                    ? `PrismIQ enforces strict competitor isolation and evidence validation. No verified multi-channel signals currently confirm an active strategic shift for ${selectedCorrelationCompany}.`
                    : "No multi-channel clusters found for the active filter combination. Try resetting competitor or channel filters."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCorrelationCompany("ALL");
                    setSelectedCorrelationChannel("ALL");
                    setCorrelationSearchQuery("");
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredCorrelations.map((corr) => {
                  const isExpanded = expandedCorrelationIds[corr.id] ?? true;
                  const signalsCluster: CorrelatedSignalNode[] =
                    corr.signals_cluster && corr.signals_cluster.length > 0
                      ? corr.signals_cluster
                      : (corr.signals || []);

                  const activeSigIdx = Math.min(
                    activeSignalIndices[corr.id] ?? 0,
                    signalsCluster.length - 1
                  );
                  const activeSig = signalsCluster[Math.max(0, activeSigIdx)];
                  const catStyle = getCorrelationCategoryStyle(corr.correlation_category);

                  const activeSigChannel = activeSig ? getChannelInfo(activeSig.channel, activeSig.signal_type, activeSig.source) : null;

                  return (
                    <div
                      key={corr.id}
                      className="rounded-2xl border border-[rgba(20,20,30,0.1)] bg-white shadow-xs overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Top Correlation Banner */}
                      <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-50 via-white to-purple-50/20 border-b border-zinc-100">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <PrismCompanyBadge
                              name={corr.company_name}
                              isTarget={(corr.company_name || "").toLowerCase() === (targetCompany || "").toLowerCase()}
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
                              {corr.independent_sources_count || signalsCluster.length} Verified Sources across {corr.distinct_channels_count || 4} Channels
                            </span>
                          </div>

                          {/* Confidence score pill & Dossier action button */}
                          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                            <div className="px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-1.5 shadow-2xs" title={`Corroboration: ${corr.corroboration_level || "High"} multi-channel convergence`}>
                              <Layers className="w-3.5 h-3.5 text-purple-600" />
                              <span className="text-xs font-extrabold text-purple-900">
                                {corr.corroboration_score ?? corr.confidence}% Corroboration
                              </span>
                            </div>

                            <div className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-1.5 shadow-2xs" title={`Confidence: ${corr.confidence_level || "High"} source authority & recency`}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-xs font-extrabold text-emerald-900">
                                {corr.confidence}% Confidence
                              </span>
                            </div>

                            {/* INSPECT CLUSTER DOSSIER BUTTON */}
                            <button
                              type="button"
                              onClick={() => setSelectedDossierCorrelation(corr)}
                              className="px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 text-xs font-bold transition-colors shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#6e57dc]" />
                              <span>Inspect Cluster Dossier</span>
                            </button>

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
                          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Stage 3 Synthesized Pattern:
                          </span>
                          <h3 className="text-lg sm:text-xl font-extrabold text-[#17171b] tracking-tight">
                            {corr.pattern_name}
                          </h3>
                          {(corr.pattern_summary || corr.synthesized_narrative) && (
                            <p className="text-xs text-[#70717a] leading-relaxed font-medium pt-0.5">
                              {corr.pattern_summary || corr.synthesized_narrative}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Multi-Signal Fusion Hub */}
                      <div className="p-5 sm:p-6 bg-zinc-50/60 border-b border-zinc-100">
                        <div className="text-[11px] font-bold text-[#70717a] uppercase tracking-wider mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Workflow className="w-3.5 h-3.5 text-[#6e57dc]" />
                            Constituent Correlated Signals ({signalsCluster.length} Channels Verified)
                          </span>
                          <span className="text-[10px] text-zinc-500 lowercase font-normal">
                            Click channel node to inspect primary source proof
                          </span>
                        </div>

                        {/* Signals Connected Pipeline Strip */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          {signalsCluster.map((sig, sIdx) => {
                            const isSelected = sIdx === activeSigIdx;
                            const isLast = sIdx === signalsCluster.length - 1;
                            const sigChan = getChannelInfo(sig.channel, sig.signal_type, sig.source);
                            const IconComponent = sigChan.icon;

                            return (
                              <React.Fragment key={sIdx}>
                                <button
                                  type="button"
                                  onClick={() => setActiveSignalIndices((prev) => ({ ...prev, [corr.id]: sIdx }))}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-white text-zinc-900 border-[#6e57dc] shadow-md ring-2 ring-[#6e57dc]/20 scale-102"
                                      : "bg-white/90 hover:bg-white text-zinc-700 border-zinc-200/90 shadow-2xs hover:border-zinc-300"
                                  }`}
                                  style={{ minWidth: "170px", maxWidth: "260px" }}
                                >
                                  <div className={`shrink-0 p-1.5 rounded-lg ${sigChan.badgeBg} ${sigChan.iconColor}`}>
                                    <IconComponent className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider truncate text-[#6e57dc]">
                                      {sigChan.label}
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
                        {activeSig && activeSigChannel && (
                          <div className="mt-4 p-4 bg-white rounded-xl border border-zinc-200/90 shadow-2xs space-y-2.5 animate-in fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${activeSigChannel.badgeBg} ${activeSigChannel.badgeText} ${activeSigChannel.badgeBorder}`}>
                                  {activeSigChannel.label}
                                </span>
                                <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900">
                                  {activeSig.title}
                                </h4>
                              </div>
                              <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-400" />
                                {activeSig.detected_at ? activeSig.detected_at.split("T")[0] : "Recent"}
                              </span>
                            </div>

                            {/* Verbatim quote */}
                            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80 text-xs text-zinc-800 font-mono italic leading-relaxed">
                              &ldquo;{activeSig.excerpt || activeSig.evidence_excerpt || activeSig.title}&rdquo;
                            </div>

                            {/* Footer link to source */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
                              {(() => {
                                const safeUrl = sanitizeSourceUrl(activeSig.url);
                                return safeUrl ? (
                                  <a
                                    href={safeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[#6e57dc] hover:text-[#5841cb] font-bold hover:underline"
                                  >
                                    <span>Verify Primary Source ({activeSig.source})</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                ) : (
                                  <span className="text-zinc-500 font-medium italic">Source document unavailable.</span>
                                );
                              })()}

                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-zinc-500">
                                  Corroboration Weight: {activeSig.weight ? `${Math.round(activeSig.weight * 100)}%` : "25%"}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {activeSig.confidence ? `${activeSig.confidence}% Confidence` : "Verified Proof"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expandable Strategic Implication & Recommended Action Drawer */}
                      {isExpanded && (
                        <div className="p-5 sm:p-6 bg-gradient-to-b from-white to-zinc-50/70 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Stage 4: Strategic Implication */}
                          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                                <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                                Stage 4: Strategic Impact Insight
                              </div>
                              <span className="text-[10px] font-bold uppercase text-purple-700 bg-white/80 px-2 py-0.5 rounded border border-purple-200">
                                Impact on {targetCompany}
                              </span>
                            </div>
                            {corr.strategic_implication_details?.observed_move && (
                              <div className="text-[11px] font-medium text-purple-950 bg-white/80 p-2 rounded border border-purple-200/70">
                                <span className="font-bold text-purple-900 block mb-0.5">Observed Move:</span>
                                {corr.strategic_implication_details.observed_move}
                              </div>
                            )}
                            {corr.strategic_implication_details?.strategic_direction && (
                              <div className="text-[11px] font-semibold text-purple-900 bg-purple-100/60 px-2 py-1 rounded">
                                <span className="font-bold">Direction: </span>
                                {corr.strategic_implication_details.strategic_direction}
                              </div>
                            )}
                            {corr.strategic_implication_details?.affected_business_area && (
                              <div className="text-[10px] font-semibold text-purple-800 bg-purple-100/50 px-2 py-0.5 rounded">
                                <span className="font-bold">Affected Area: </span>
                                {corr.strategic_implication_details.affected_business_area}
                              </div>
                            )}
                            <p className="text-xs text-purple-950 leading-relaxed font-medium">
                              {corr.strategic_implication_details?.competitive_implication || corr.strategic_implication}
                            </p>
                            {(corr.strategic_implication_details?.strategic_uncertainty || corr.strategic_implication_details?.key_uncertainty) && (
                              <div className="text-[10px] text-purple-700 italic border-t border-purple-200/60 pt-1.5">
                                Key Uncertainty: {corr.strategic_implication_details.strategic_uncertainty || corr.strategic_implication_details.key_uncertainty}
                              </div>
                            )}
                          </div>

                          {/* Stage 5: Recommended Action */}
                          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                                <Lightbulb className="w-3.5 h-3.5 text-emerald-700" />
                                Stage 5: Recommended Counter-Action
                              </div>
                              <div className="flex items-center gap-1">
                                {corr.recommended_action_details?.priority && (
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                    corr.recommended_action_details.priority.toLowerCase() === "critical"
                                      ? "bg-rose-100 text-rose-800 border-rose-200"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  }`}>
                                    {corr.recommended_action_details.priority} Priority
                                  </span>
                                )}
                                {corr.recommended_action_details?.responsible_team && (
                                  <span className="text-[10px] font-bold text-zinc-700 bg-white px-2 py-0.5 rounded border border-zinc-200">
                                    {corr.recommended_action_details.responsible_team}
                                  </span>
                                )}
                              </div>
                            </div>
                            {corr.recommended_action_details?.action_title && (
                              <div className="text-xs font-bold text-emerald-950">
                                {corr.recommended_action_details.action_title}
                              </div>
                            )}
                            <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                              {corr.recommended_action_details?.reason || corr.recommended_action}
                            </p>
                            {corr.recommended_action_details?.suggested_next_step && (
                              <div className="text-[11px] font-semibold text-emerald-900 bg-emerald-100/70 p-2 rounded border border-emerald-200/70 flex items-start gap-1.5">
                                <ArrowRight className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                                <span>Next Step: {corr.recommended_action_details.suggested_next_step}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* RAW SIGNALS STREAM (POINT 1 CHANNEL INGESTION STREAM) */}
          {/* ========================================================================= */}
          <section className="space-y-6 pt-6 border-t border-zinc-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    <Radio className="w-3.5 h-3.5 text-zinc-500" />
                    Multi-Channel Signal Ledger
                  </span>
                  <span className="text-xs text-[#70717a]">•</span>
                  <span className="text-xs text-[#70717a] font-medium">
                    {filteredSignals.length} Stream Signals ({noiseCount} Noise Suppressed)
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#17171b] tracking-tight mt-1">
                  Raw Signal Telemetry Feed
                </h2>
                <p className="text-xs text-[#70717a] mt-0.5">
                  Real-time multi-channel surveillance stream feeding Stages 1 &amp; 2 of the correlation pipeline.
                </p>
              </div>

              {/* Reset Filters */}
              {(selectedSource !== "ALL" || selectedCompany !== "ALL" || selectedConfidence !== "ALL" || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSource("ALL");
                    setSelectedCompany("ALL");
                    setSelectedConfidence("ALL");
                  }}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900 underline self-start sm:self-auto"
                >
                  Reset Stream Filters
                </button>
              )}
            </div>

            {/* Filter controls for Raw Signals */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stream signals..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-zinc-200/90 focus:border-[#6e57dc] focus:outline-none focus:ring-2 focus:ring-[#6e57dc]/20 placeholder:text-zinc-400"
                />
              </div>

              <div>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white rounded-xl border border-zinc-200/90 focus:border-[#6e57dc] focus:outline-none"
                >
                  <option value="ALL">All Tracked Entities</option>
                  {companies.map((c) => (
                    <option key={c.company_name} value={c.company_name}>
                      {c.company_name} {c.is_target ? "(Target)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white rounded-xl border border-zinc-200/90 focus:border-[#6e57dc] focus:outline-none"
                >
                  <option value="ALL">All Ingestion Sources</option>
                  <option value="GitHub">GitHub Commits &amp; Releases</option>
                  <option value="Greenhouse">Careers &amp; Job Postings</option>
                  <option value="News">News &amp; PR Releases</option>
                  <option value="Pricing">Pricing &amp; Packaging</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedConfidence}
                  onChange={(e) => setSelectedConfidence(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white rounded-xl border border-zinc-200/90 focus:border-[#6e57dc] focus:outline-none"
                >
                  <option value="ALL">All Confidence Ratings</option>
                  <option value="High">High Confidence (&gt;90%)</option>
                  <option value="Medium">Medium Confidence</option>
                </select>
              </div>
            </div>

            {/* Raw Signals Stream List */}
            {filteredSignals.length === 0 ? (
              <PrismEmptyState
                title="No Signals Matched"
                description="Try broadening your stream filter criteria."
                actionText="Reset Filters"
                onAction={() => {
                  setSearchQuery("");
                  setSelectedSource("ALL");
                  setSelectedCompany("ALL");
                  setSelectedConfidence("ALL");
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSignals.slice(0, 16).map((sig) => {
                  const channelInfo = getChannelInfo(undefined, sig.source, sig.source);
                  const Icon = channelInfo.icon;

                  return (
                    <div
                      key={sig.id}
                      className="p-4 rounded-xl border border-zinc-200/90 bg-white shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`p-1 rounded-md ${channelInfo.badgeBg} ${channelInfo.iconColor}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs font-bold text-zinc-900">{sig.company_name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {sig.published_at ? sig.published_at.split("T")[0] : "Recent"}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-zinc-900 leading-snug">
                          {sig.title}
                        </h4>

                        <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed font-mono">
                          {sig.raw_excerpt || sig.why_it_matters}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
                        <span className="text-[10px] text-zinc-500 uppercase font-medium">
                          {sig.source || "Official Portal"}
                        </span>
                        {sig.url ? (
                          <a
                            href={sig.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#6e57dc] hover:underline font-bold text-[11px]"
                          >
                            <span>Verify Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEvidence({
                              id: sig.id,
                              title: sig.title,
                              company_name: sig.company_name,
                              source: sig.source,
                              raw_excerpt: sig.raw_excerpt,
                              why_it_matters: sig.why_it_matters,
                              confidence: sig.confidence || "High",
                            })}
                            className="text-[#6e57dc] hover:underline font-bold text-[11px]"
                          >
                            Inspect Proof
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POINT 3: CORRELATED SIGNAL DOSSIER MODAL / SLIDE-OVER DRAWER */}
      {/* ========================================================================= */}
      {selectedDossierCorrelation && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedDossierCorrelation(null)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-2xl bg-white border-l border-[rgba(20,20,30,0.12)] h-full overflow-y-auto shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Dossier Header */}
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-[#6e57dc]">
                    <Workflow className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6e57dc]">
                      Cross-Channel Signal Correlation Dossier
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono ml-2">
                      Ref #{selectedDossierCorrelation.id}
                    </span>
                  </div>
                </div>
                <h2 className="text-lg font-extrabold text-[#17171b] tracking-tight">
                  {selectedDossierCorrelation.pattern_name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDossierCorrelation(null)}
                className="p-2 text-zinc-400 hover:text-zinc-800 rounded-xl hover:bg-zinc-100 transition-colors"
                aria-label="Close dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Body Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* Entity & Classification Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Competitor:</span>
                  <PrismCompanyBadge name={selectedDossierCorrelation.company_name} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Category:</span>
                  {(() => {
                    const dCatStyle = getCorrelationCategoryStyle(selectedDossierCorrelation.correlation_category);
                    return (
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${dCatStyle.bg} ${dCatStyle.text} ${dCatStyle.border}`}>
                        {dCatStyle.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-zinc-300">•</span>
                  <span className="text-xs text-zinc-500 font-medium">Pipeline:</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Stage 1 ➔ 5 Synthesized
                  </span>
                </div>
              </div>

              {/* Multi-Channel Corroboration Score Hero */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-emerald-50/50 border border-purple-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                      Multi-Channel Corroboration &amp; Confidence
                    </div>
                    <div className="flex items-baseline gap-3 mt-0.5">
                      <div className="text-3xl font-extrabold text-[#17171b] tracking-tight">
                        {selectedDossierCorrelation.corroboration_score ?? selectedDossierCorrelation.confidence}% Corroboration
                      </div>
                      <div className="text-lg font-bold text-emerald-800">
                        {selectedDossierCorrelation.confidence}% Confidence
                      </div>
                    </div>
                  </div>
                  <div className="self-start sm:self-auto px-3 py-1 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{selectedDossierCorrelation.independent_sources_count || 4} Verified Independent Sources</span>
                  </div>
                </div>

                <div className="text-xs text-zinc-600 leading-relaxed font-medium">
                  Verified convergence across code commits, talent requisitions, media press rooms, and pricing portals confirms genuine operational execution rather than speculative research.
                </div>
              </div>

              {/* 4 Distinct Channels Verification Breakdown */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#6e57dc]" />
                    4-Channel Ingestion &amp; Weight Matrix
                  </span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    Equal 25% Weighting
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 flex flex-col items-center justify-between">
                    <GitBranch className="w-4 h-4 text-purple-600 mb-1" />
                    <span className="font-extrabold text-purple-950">GitHub / Code</span>
                    <span className="text-[10px] font-bold text-purple-700 mt-1">25% Weight</span>
                    <span className="text-[9px] text-purple-600 font-semibold mt-0.5">Verified Tag</span>
                  </div>

                  <div className="p-3 rounded-xl bg-pink-50/80 border border-pink-200 flex flex-col items-center justify-between">
                    <Briefcase className="w-4 h-4 text-pink-600 mb-1" />
                    <span className="font-extrabold text-pink-950">Careers</span>
                    <span className="text-[10px] font-bold text-pink-700 mt-1">25% Weight</span>
                    <span className="text-[9px] text-pink-600 font-semibold mt-0.5">Requisition Open</span>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col items-center justify-between">
                    <Newspaper className="w-4 h-4 text-blue-600 mb-1" />
                    <span className="font-extrabold text-blue-950">News &amp; PR</span>
                    <span className="text-[10px] font-bold text-blue-700 mt-1">25% Weight</span>
                    <span className="text-[9px] text-blue-600 font-semibold mt-0.5">Press Briefing</span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col items-center justify-between">
                    <DollarSign className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="font-extrabold text-emerald-950">Pricing</span>
                    <span className="text-[10px] font-bold text-emerald-700 mt-1">25% Weight</span>
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">Slashed Take Rate</span>
                  </div>
                </div>
              </div>

              {/* Cross-Channel Impact Breakdown Narrative */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#6e57dc]" />
                  Cross-Channel Impact Breakdown: Why Corroboration Matters
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed font-normal">
                  Isolated data points frequently generate false alerts. A hiring requisition may only signify exploratory talent scouting, while a pricing tweak may reflect localized promotional experiments.
                  However, when {selectedDossierCorrelation.company_name} synchronizes software releases on GitHub with senior operational hiring, simultaneous press releases, and permanent zero-commission pricing slabs, the probability of an imminent strategic commercial offensive approaches certainty.
                </p>
              </div>

              {/* Timestamped Proof Points (Constituent Signals Evidence Ledger) */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Timestamped Proof Points &amp; Primary Verification Evidence
                </div>

                <div className="space-y-3">
                  {(selectedDossierCorrelation.signals_cluster || selectedDossierCorrelation.signals || []).map((sig, sIdx) => {
                    const chan = getChannelInfo(sig.channel, sig.signal_type, sig.source);
                    const ChanIcon = chan.icon;

                    return (
                      <div
                        key={sIdx}
                        className="p-4 rounded-xl border border-zinc-200 bg-white shadow-2xs space-y-2 hover:border-zinc-300 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`p-1 rounded-md ${chan.badgeBg} ${chan.iconColor}`}>
                              <ChanIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${chan.badgeBg} ${chan.badgeText} ${chan.badgeBorder}`}>
                              {chan.label}
                            </span>
                            <h4 className="text-xs font-bold text-zinc-900">
                              {sig.title}
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {sig.detected_at ? sig.detected_at.split("T")[0] : "Recent"}
                          </span>
                        </div>

                        {/* Verbatim Excerpt */}
                        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/70 font-mono text-xs text-zinc-800 leading-relaxed italic">
                          &ldquo;{sig.excerpt || sig.evidence_excerpt || sig.title}&rdquo;
                        </div>

                        {/* Source attribution & Direct URL */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                          <div className="text-zinc-500 font-medium">
                            Source: <span className="text-zinc-800 font-semibold">{sig.source}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {(() => {
                              const safeUrl = sanitizeSourceUrl(sig.url);
                              return safeUrl ? (
                                <a
                                  href={safeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#6e57dc] font-bold text-xs transition-colors border border-purple-200"
                                >
                                  <span>Verify Primary Source</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="text-[11px] text-zinc-400 italic">Source document unavailable.</span>
                              );
                            })()}
                            <span className="text-[10px] font-mono text-zinc-400">
                              Weight: {sig.weight ? `${Math.round(sig.weight * 100)}%` : "25%"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stage 4 & 5 Synthesis in Dossier */}
              <div className="grid grid-cols-1 gap-3.5 pt-2">
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
                  <div className="text-xs font-extrabold text-purple-900 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#6e57dc]" />
                      Stage 4: Strategic Impact Insight
                    </div>
                    {selectedDossierCorrelation.strategic_implication_details?.affected_business_area && (
                      <span className="text-[10px] font-bold text-purple-800 bg-white/80 px-2 py-0.5 rounded border border-purple-200">
                        Area: {selectedDossierCorrelation.strategic_implication_details.affected_business_area}
                      </span>
                    )}
                  </div>
                  {selectedDossierCorrelation.strategic_implication_details?.observed_move && (
                    <div className="text-[11px] font-medium text-purple-950 bg-white/80 p-2.5 rounded border border-purple-200/70">
                      <span className="font-bold text-purple-900 block mb-0.5">Observed Move:</span>
                      {selectedDossierCorrelation.strategic_implication_details.observed_move}
                    </div>
                  )}
                  {selectedDossierCorrelation.strategic_implication_details?.strategic_direction && (
                    <div className="text-[11px] font-semibold text-purple-900 bg-white/70 px-2 py-1 rounded border border-purple-200/60">
                      <span className="font-bold">Direction: </span>
                      {selectedDossierCorrelation.strategic_implication_details.strategic_direction}
                    </div>
                  )}
                  <p className="text-xs text-purple-950 leading-relaxed font-medium">
                    {selectedDossierCorrelation.strategic_implication_details?.competitive_implication || selectedDossierCorrelation.strategic_implication}
                  </p>
                  {(selectedDossierCorrelation.strategic_implication_details?.strategic_uncertainty || selectedDossierCorrelation.strategic_implication_details?.key_uncertainty) && (
                    <div className="text-[10px] text-purple-700 italic border-t border-purple-200/60 pt-1.5">
                      Strategic Uncertainty: {selectedDossierCorrelation.strategic_implication_details.strategic_uncertainty || selectedDossierCorrelation.strategic_implication_details.key_uncertainty}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="text-xs font-extrabold text-emerald-900 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-emerald-700" />
                      Stage 5: Recommended Counter-Action
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedDossierCorrelation.recommended_action_details?.priority && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          selectedDossierCorrelation.recommended_action_details.priority.toLowerCase() === "critical"
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}>
                          {selectedDossierCorrelation.recommended_action_details.priority} Priority
                        </span>
                      )}
                      {selectedDossierCorrelation.recommended_action_details?.responsible_team && (
                        <span className="text-[10px] font-bold text-zinc-700 bg-white px-2 py-0.5 rounded border border-zinc-200">
                          {selectedDossierCorrelation.recommended_action_details.responsible_team}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedDossierCorrelation.recommended_action_details?.action_title && (
                    <div className="text-xs font-bold text-emerald-950">
                      {selectedDossierCorrelation.recommended_action_details.action_title}
                    </div>
                  )}
                  <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                    {selectedDossierCorrelation.recommended_action_details?.reason || selectedDossierCorrelation.recommended_action}
                  </p>
                  {selectedDossierCorrelation.recommended_action_details?.suggested_next_step && (
                    <div className="text-[11px] font-semibold text-emerald-900 bg-white/70 p-2 rounded border border-emerald-200 flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>Next Step: {selectedDossierCorrelation.recommended_action_details.suggested_next_step}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dossier Footer Action Bar */}
            <div className="p-5 border-t border-zinc-100 bg-zinc-50 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyDossier(selectedDossierCorrelation)}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-700 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {copiedDossierId === selectedDossierCorrelation.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied to Clipboard</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Copy Dossier Summary</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenInProvenanceDrawer(selectedDossierCorrelation)}
                  className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-bold text-purple-700 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#6e57dc]" />
                  <span>Inspect in Full Provenance Drawer</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDossierCorrelation(null)}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold transition-colors shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
