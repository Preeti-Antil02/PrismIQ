"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  Clock,
  Printer,
  Copy,
  Check,
  BookOpen,
  ArrowRight,
  TrendingUp,
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
  fetchBriefs,
  fetchLatestBrief,
  fetchBriefById,
  type BriefEntry,
  type BriefDetail,
} from "@/lib/api";
import { parseBriefMarkdown, type ParsedBrief } from "@/lib/briefParser";

export function BriefPage() {
  const { targetCompany, triggerSweep } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [loading, setLoading] = React.useState(true);
  const [briefList, setBriefList] = React.useState<BriefEntry[]>([]);
  const [selectedBrief, setSelectedBrief] = React.useState<BriefDetail | null>(null);
  const [parsed, setParsed] = React.useState<ParsedBrief | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Load available briefs
  const loadBriefs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchBriefs();
      setBriefList(list);

      if (list.length > 0) {
        const latest = await fetchLatestBrief();
        setSelectedBrief(latest);
        setParsed(parseBriefMarkdown(latest.content));
      } else {
        // Try direct latest fetch as fallback
        try {
          const latest = await fetchLatestBrief();
          setSelectedBrief(latest);
          setParsed(parseBriefMarkdown(latest.content));
        } catch {
          setSelectedBrief(null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load briefs");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadBriefs();
  }, [loadBriefs]);

  // Handle switching to another historical brief
  const handleSelectBrief = async (briefId: string) => {
    setLoading(true);
    try {
      const b = await fetchBriefById(briefId);
      setSelectedBrief(b);
      setParsed(parseBriefMarkdown(b.content));
    } catch (err: any) {
      alert(`Could not load brief: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = () => {
    if (selectedBrief?.content) {
      navigator.clipboard.writeText(selectedBrief.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !selectedBrief) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-6">
        <div className="app-skeleton h-10 w-72 rounded-xl" />
        <div className="app-skeleton h-4 w-96 rounded-lg" />
        <PrismLoadingSkeleton count={4} />
      </div>
    );
  }

  if (error || !selectedBrief) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <PrismEmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title={`No Briefs Generated Yet for ${targetCompany}`}
          description="Autonomous executive briefs are compiled automatically from validated signals and verified competitive events. Trigger an intelligence sweep to generate your first brief."
          actionText="Trigger Intelligence Sweep"
          onAction={triggerSweep}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Brief Meta & Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Executive Intelligence Brief
          </div>
          <h1 className="app-title-lg">
            Competitive Brief — <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-[#70717a] mt-1.5">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#9ca3af]" />
              {selectedBrief.date ? new Date(selectedBrief.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }) : "Recent"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-[#17171b]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Multi-Source Intelligence
            </span>
          </div>
        </div>

        {/* Historical Switcher & Actions */}
        <div className="flex items-center gap-2">
          {briefList.length > 1 && (
            <select
              aria-label="Select historical brief"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[rgba(20,20,30,0.09)] bg-white text-[#17171b] outline-none"
              value={selectedBrief.id}
              onChange={(e) => handleSelectBrief(e.target.value)}
            >
              {briefList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title || `Brief ${b.date ? b.date.slice(0, 10) : b.id}`}
                </option>
              ))}
            </select>
          )}

          <PrismButton variant="light" size="sm" onClick={copyMarkdown}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#70717a]" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </PrismButton>

          <PrismButton variant="light" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Print</span>
          </PrismButton>
        </div>
      </div>

      {/* Executive Summary Callout */}
      {parsed?.executiveSummary && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-blue-50/40 border border-purple-100/90 shadow-sm">
          <div className="text-[11px] font-extrabold tracking-wider uppercase text-[#6e57dc] mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Executive Summary Rollup
          </div>
          <p className="text-sm text-[#1f2937] leading-relaxed font-medium">
            {parsed.executiveSummary}
          </p>
        </div>
      )}

      {/* Section 1: Major Developments (Numbered Decisions / Developments) */}
      {parsed?.topDecisions && parsed.topDecisions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-purple-100/80 text-[#6e57dc] font-extrabold text-xs flex items-center justify-center">
              1
            </div>
            <h2 className="app-title-md">Major Developments & Priority Shifts</h2>
          </div>

          <div className="space-y-3">
            {parsed.topDecisions.map((dec) => (
              <PrismCard
                key={dec.number}
                interactive
                onClick={() =>
                  openEvidence({
                    title: dec.headline,
                    company_name: dec.company,
                    why_it_matters: dec.impact,
                    raw_excerpt: `${dec.company}: ${dec.headline}. ${dec.impact}`,
                    tier: "Must-Know",
                    confidence: "High",
                  })
                }
                className="p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <PrismCompanyBadge
                        name={dec.company}
                        isTarget={dec.company.toLowerCase() === targetCompany.toLowerCase()}
                        size="sm"
                      />
                      <PrismTierBadge tier="Must-Know" />
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-[#17171b] leading-snug">
                      {dec.headline}
                    </h3>

                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-[#374151] leading-relaxed">
                      <strong className="text-[#6e57dc] font-bold">Strategic Impact: </strong>
                      {dec.impact}
                    </div>
                  </div>

                  <button className="text-[11px] font-bold text-[#6e57dc] hover:underline flex items-center gap-1 shrink-0 pt-1">
                    Evidence <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </PrismCard>
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Competitive Movement Rollup Table */}
      {parsed?.rollupRows && parsed.rollupRows.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-100/80 text-blue-700 font-extrabold text-xs flex items-center justify-center">
              2
            </div>
            <h2 className="app-title-md">Competitive Movement by Strategic Theme</h2>
          </div>

          <div className="app-table-wrap shadow-xs">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Theme</th>
                  <th>Competitors Involved</th>
                  <th>Volume</th>
                  <th>Pattern Detected</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rollupRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-bold text-[#17171b] whitespace-nowrap">
                      {row.theme}
                    </td>
                    <td className="text-xs font-semibold text-[#4b5563]">
                      {row.competitors}
                    </td>
                    <td className="whitespace-nowrap text-xs font-bold text-[#6e57dc]">
                      {row.eventsCount}
                    </td>
                    <td className="text-xs text-[#374151] leading-relaxed max-w-sm">
                      {row.patternDetected}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 3: Must-Know Developments */}
      {parsed?.mustKnow && parsed.mustKnow.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-700 font-extrabold text-xs flex items-center justify-center">
                3
              </div>
              <h2 className="app-title-md">Must-Know Tactical Updates</h2>
            </div>
            <PrismTierBadge tier="Must-Know" />
          </div>

          <div className="space-y-3">
            {parsed.mustKnow.map((item, idx) => (
              <PrismCard
                key={idx}
                interactive
                onClick={() =>
                  openEvidence({
                    title: item.title,
                    company_name: item.company,
                    why_it_matters: item.whyItMatters,
                    raw_excerpt: item.fact || item.title,
                    url: item.url,
                    tier: "Must-Know",
                    confidence: "High",
                  })
                }
                className="p-4 sm:p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <PrismCompanyBadge
                    name={item.company}
                    isTarget={item.company.toLowerCase() === targetCompany.toLowerCase()}
                    size="sm"
                  />
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Source
                    </a>
                  )}
                </div>
                <div className="font-bold text-sm text-[#17171b] mb-1.5">{item.title}</div>
                {item.whyItMatters && (
                  <p className="text-xs text-[#4b5563] leading-relaxed">
                    <strong className="text-[#17171b]">Implication: </strong>
                    {item.whyItMatters}
                  </p>
                )}
              </PrismCard>
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Should-Know Developments */}
      {parsed?.shouldKnow && parsed.shouldKnow.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center">
                4
              </div>
              <h2 className="app-title-md">Should-Know Monitoring Items</h2>
            </div>
            <PrismTierBadge tier="Should-Know" />
          </div>

          <div className="space-y-3">
            {parsed.shouldKnow.map((item, idx) => (
              <PrismCard
                key={idx}
                interactive
                onClick={() =>
                  openEvidence({
                    title: item.title,
                    company_name: item.company,
                    why_it_matters: item.whyItMatters,
                    raw_excerpt: item.fact || item.title,
                    url: item.url,
                    tier: "Should-Know",
                    confidence: "Medium",
                  })
                }
                className="p-4"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <PrismCompanyBadge
                    name={item.company}
                    isTarget={item.company.toLowerCase() === targetCompany.toLowerCase()}
                    size="sm"
                  />
                  <PrismTierBadge tier="Should-Know" />
                </div>
                <div className="font-semibold text-xs sm:text-sm text-[#17171b] mb-1">
                  {item.title}
                </div>
                {item.whyItMatters && (
                  <p className="text-xs text-[#70717a] leading-relaxed">
                    {item.whyItMatters}
                  </p>
                )}
              </PrismCard>
            ))}
          </div>
        </section>
      )}

      {/* Evidence & Methodology Integrity Footer */}
      <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-[#595a63] space-y-2">
        <div className="font-bold text-[#17171b] flex items-center gap-1.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          PrismIQ Grounding & Methodology Standard
        </div>
        <p className="leading-relaxed">
          This brief was synthesized from corroborated raw signals detected across news archives, public code repositories, job disclosures, pricing updates, and research monitors. Uncorroborated single-source claims are flagged or suppressed by design.
        </p>
      </div>
    </div>
  );
}
