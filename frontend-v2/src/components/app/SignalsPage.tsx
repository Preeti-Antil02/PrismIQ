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
  fetchSignals,
  fetchTrackedCompanies,
  type SignalRecord,
  type TrackedCompany,
} from "@/lib/api";

export function SignalsPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [noiseCount, setNoiseCount] = React.useState<number>(0);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedSource, setSelectedSource] = React.useState("ALL");
  const [selectedCompany, setSelectedCompany] = React.useState("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState("ALL");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [signalsRes, compsRes] = await Promise.all([
        fetchSignals({ limit: 200 }),
        fetchTrackedCompanies(),
      ]);
      setSignals(signalsRes.signals || []);
      setNoiseCount(signalsRes.noise_suppressed_count || 0);
      setCompanies(compsRes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering
  const filteredSignals = React.useMemo(() => {
    return signals.filter((sig) => {
      // Source match
      if (selectedSource !== "ALL" && (sig.source || "").toLowerCase() !== selectedSource.toLowerCase()) {
        return false;
      }
      // Company match
      if (selectedCompany !== "ALL" && sig.company_name.toLowerCase() !== selectedCompany.toLowerCase()) {
        return false;
      }
      // Confidence match
      if (selectedConfidence !== "ALL") {
        const conf = (sig.confidence || sig.fact_confidence || "").toLowerCase();
        if (!conf.includes(selectedConfidence.toLowerCase())) return false;
      }
      // Search match
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
    if (s.includes("job") || s.includes("career")) return <Briefcase className="w-3.5 h-3.5 text-pink-600" />;
    if (s.includes("pricing")) return <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
    if (s.includes("research")) return <BookOpen className="w-3.5 h-3.5 text-orange-600" />;
    return <Radio className="w-3.5 h-3.5 text-zinc-600" />;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Corroborated Signal Stream
          </div>
          <h1 className="app-title-lg">
            Signals & Indicators for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Derived atomic intelligence pieces collected across news feeds, repositories, pricing tables, and job boards.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh Signals</span>
        </PrismButton>
      </div>

      {/* Honest Noise-Suppression Disclosure Banner */}
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
            All Companies
          </button>
          {companies.map((comp) => {
            const count = signals.filter(
              (s) => s.company_name.toLowerCase() === comp.company_name.toLowerCase()
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
      </div>

      {/* Signals Grid */}
      {loading ? (
        <PrismLoadingSkeleton count={6} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Signals"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : filteredSignals.length === 0 ? (
        <PrismEmptyState
          icon={<Radio className="w-6 h-6" />}
          title="No Matching Signals"
          description="Try broadening your source or company filters to explore all detected signals."
          actionText="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSignals.map((sig) => (
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
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <PrismCompanyBadge
                      name={sig.company_name}
                      isTarget={sig.company_name.toLowerCase() === targetCompany.toLowerCase()}
                      size="sm"
                    />
                    <span className="app-pill bg-zinc-100 text-zinc-700 text-[10px] flex items-center gap-1 uppercase font-bold tracking-wider">
                      {getSourceIcon(sig.source)}
                      {sig.source || "Web"}
                    </span>
                  </div>

                  <PrismConfidenceBadge confidence={sig.confidence || sig.fact_confidence} />
                </div>

                <h3 className="text-sm sm:text-base font-bold text-[#17171b] leading-snug mb-2 hover:text-[#6e57dc] transition-colors">
                  {sig.title}
                </h3>

                {sig.raw_excerpt && (
                  <p className="text-xs text-[#595a63] line-clamp-3 leading-relaxed mb-3 font-mono bg-zinc-50/70 p-2.5 rounded-lg border border-zinc-100">
                    {sig.raw_excerpt}
                  </p>
                )}

                {sig.why_it_matters && (
                  <div className="p-2.5 rounded-lg bg-purple-50/40 border border-purple-100/60 mb-3 text-xs">
                    <span className="font-extrabold text-[#6e57dc] text-[10px] uppercase block mb-0.5">
                      Why It Matters:
                    </span>
                    <p className="text-[#374151] line-clamp-2 leading-relaxed">
                      {sig.why_it_matters}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[rgba(20,20,30,0.06)] text-[11px] text-[#70717a]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#9ca3af]" />
                  {sig.published_timestamp || sig.published_at || "Recent"}
                </span>

                {sig.url && (
                  <a
                    href={sig.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#6e57dc] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" /> View Source
                  </a>
                )}
              </div>
            </PrismCard>
          ))}
        </div>
      )}
    </div>
  );
}
