"use client";

import * as React from "react";
import Link from "next/link";
import {
  Radar,
  Radio,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Clock,
  Plus,
  AlertCircle,
  RefreshCw,
  Search,
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
  fetchLatestRadar,
  fetchWorkspaceTopics,
  type RadarEvaluation,
  type ResearchTopic,
  type RadarCompetitorConnection,
} from "@/lib/api";

export function ResearchRadarPage() {
  const { targetCompany } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topicsRes, radarRes] = await Promise.all([
        fetchWorkspaceTopics(),
        fetchLatestRadar(),
      ]);
      setTopics(topicsRes || []);
      setRadarEvals(radarRes.evaluations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load research radar");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Status badge helper for competitor connection
  const getStatusBadge = (status?: string) => {
    const s = (status || "unobserved").toLowerCase();
    if (s.includes("active") || s.includes("adopter")) {
      return (
        <span className="app-pill bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
          Active Adopter
        </span>
      );
    }
    if (s.includes("experiment") || s.includes("explor")) {
      return (
        <span className="app-pill bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase">
          Experimenting
        </span>
      );
    }
    return (
      <span className="app-pill bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px] font-semibold uppercase">
        Unobserved
      </span>
    );
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Emerging Research Radar
          </div>
          <h1 className="app-title-lg">
            Research Radar for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Frontier monitoring across academic papers, technical disclosures, and competitor technology adoption postures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrismButton variant="light" size="sm" onClick={loadData}>
            <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Refresh</span>
          </PrismButton>
          <Link href="/app/workspace/topics" className="app-btn app-btn-dark px-4 py-2 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Topics</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={3} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Research Radar"
          description={error}
          actionText="Retry"
          onAction={loadData}
        />
      ) : topics.length === 0 ? (
        <PrismEmptyState
          icon={<Radar className="w-6 h-6" />}
          title={`No Research Topics Configured for ${targetCompany}`}
          description="Define strategic keywords and technical topics you want to track across preprints, academic publications, and patent disclosures."
          actionText="Configure Research Topics"
          actionHref="/app/workspace/topics"
        />
      ) : (
        <div className="space-y-8">
          {topics.map((topic) => {
            // Match evaluation for this topic
            const evaluation = radarEvals.find(
              (ev) => ev.topic_label.toLowerCase() === topic.topic_label.toLowerCase()
            );

            const connections = evaluation?.competitor_connections || {};

            return (
              <PrismCard key={topic.id} className="p-6 space-y-6">
                {/* Topic Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[rgba(20,20,30,0.06)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-lg bg-purple-50 text-[#6e57dc] flex items-center justify-center">
                        <Radar className="w-3.5 h-3.5" />
                      </span>
                      <h2 className="text-lg font-extrabold text-[#17171b]">
                        {topic.topic_label}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mr-1">
                        Keywords:
                      </span>
                      {topic.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-zinc-100 text-[11px] font-semibold text-[#4b5563]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs shrink-0 flex items-center gap-2">
                    {evaluation?.pending_sweep ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Sweep Pending
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Swept ({evaluation?.research_item_count || 0} papers)
                      </span>
                    )}
                  </div>
                </div>

                {/* Why It Matters */}
                {evaluation?.why_it_matters && (
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100/70 text-xs">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Strategic Implications
                    </div>
                    <p className="text-[#374151] leading-relaxed font-medium">
                      {evaluation.why_it_matters}
                    </p>
                  </div>
                )}

                {/* Competitor Connections Matrix */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-3">
                    Observed Competitor Posture & Evidence
                  </div>

                  {Object.keys(connections).length === 0 ? (
                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/60 text-xs text-[#70717a] italic">
                      No competitor evidence observed yet for this topic. Run a radar sweep to evaluate competitor publications.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(connections).map(([compName, conn]) => (
                        <div
                          key={compName}
                          className="p-4 rounded-xl border border-[rgba(20,20,30,0.06)] bg-white space-y-2 hover:border-purple-200 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <PrismCompanyBadge
                              name={compName}
                              isTarget={compName.toLowerCase() === targetCompany.toLowerCase()}
                              size="sm"
                            />
                            {getStatusBadge(conn.status)}
                          </div>

                          <p className="text-xs text-[#4b5563] leading-relaxed">
                            {conn.reason}
                          </p>

                          {conn.evidence_signals && conn.evidence_signals.length > 0 && (
                            <div className="pt-2 border-t border-[rgba(20,20,30,0.05)]">
                              <button
                                onClick={() =>
                                  openEvidence({
                                    title: `${compName} — ${topic.topic_label} Evidence`,
                                    company_name: compName,
                                    why_it_matters: conn.reason,
                                    raw_excerpt: conn.evidence_signals?.[0]?.raw_excerpt,
                                    url: conn.evidence_signals?.[0]?.url,
                                    source: conn.evidence_signals?.[0]?.source,
                                    tier: "Should-Know",
                                  })
                                }
                                className="text-[11px] font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
                              >
                                View {conn.evidence_signals.length} Corroborating Signal{conn.evidence_signals.length !== 1 ? "s" : ""} →
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PrismCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
