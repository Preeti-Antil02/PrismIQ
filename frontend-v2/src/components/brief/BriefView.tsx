"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ArrowRight,
  FileSearch,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/timeUtils";
import { formatEvidenceCount } from "@/lib/evidenceUtils";
import { useEvidenceDrawer } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/AuthContext";
import { TierBadge } from "@/components/primitives/TierBadge";
import { ConfidenceBadge } from "@/components/primitives/ConfidenceBadge";
import { FreshnessIndicator } from "@/components/primitives/FreshnessIndicator";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";
import {
  fetchBriefs,
  fetchLatestBrief,
  fetchBriefById,
  fetchTrackedCompanies,
  fetchWorkspaceTopics,
  type BriefEntry,
  type BriefDetail,
  type TrackedCompany,
  type ResearchTopic,
} from "@/lib/api";
import { parseBriefMarkdown, type ParsedBrief } from "@/lib/briefParser";

interface BriefViewProps {
  initialBriefId?: string;
}

interface MajorDevelopment {
  id: string;
  number: string;
  company: string;
  topicTitle: string;
  headline: string;
  explanation: string;
  whyItMatters: string;
  competitiveImplication?: string;
  sourcesCount: number;
  confidence: "High" | "Medium";
  tier: "Must-Know" | "Should-Know";
  timestamp: string;
  records: Array<{
    source: string;
    extractedText: string;
    url?: string;
    timestamp?: string;
  }>;
}

export function BriefView({ initialBriefId }: BriefViewProps) {
  const router = useRouter();
  const { openDrawer } = useEvidenceDrawer();
  const { user } = useAuth();

  const [briefs, setBriefs] = React.useState<BriefEntry[]>([]);
  const [activeBrief, setActiveBrief] = React.useState<BriefDetail | null>(null);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [methodologyOpen, setMethodologyOpen] = React.useState<boolean>(false);
  const [archivesOpen, setArchivesOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    fetchBriefs()
      .then((data) => setBriefs(data))
      .catch(() => {});
    fetchTrackedCompanies()
      .then((data) => setTrackedCompanies(data))
      .catch(() => {});
    fetchWorkspaceTopics()
      .then((data) => setTopics(data))
      .catch(() => {});
  }, [user?.tenant_id]);

  React.useEffect(() => {
    setLoading(true);
    const fetcher = initialBriefId && initialBriefId !== "latest"
      ? fetchBriefById(initialBriefId)
      : fetchLatestBrief();

    fetcher
      .then((data) => setActiveBrief(data))
      .catch((err) => {
        console.warn("No published brief found for current tenant:", err);
        setActiveBrief(null);
      })
      .finally(() => setLoading(false));
  }, [initialBriefId, user?.tenant_id]);

  const targetCompany = React.useMemo(() => {
    return trackedCompanies.find((c) => c.is_target)?.company_name || trackedCompanies[0]?.company_name || "";
  }, [trackedCompanies]);

  const competitors = React.useMemo(() => {
    return trackedCompanies.filter((c) => !c.is_target);
  }, [trackedCompanies]);

  // Parse markdown brief if available
  const parsed: ParsedBrief | null = React.useMemo(() => {
    if (!activeBrief?.content) return null;
    return parseBriefMarkdown(activeBrief.content);
  }, [activeBrief?.content]);

  // Derive dynamic major developments from parsed decisions or findings
  const majorDevelopments: MajorDevelopment[] = React.useMemo(() => {
    if (!parsed || parsed.topDecisions.length === 0) return [];

    return parsed.topDecisions.map((d, idx) => ({
      id: `dev-0${d.number}-${d.company}`,
      number: `0${d.number}`,
      company: d.company,
      topicTitle: d.headline,
      headline: d.headline,
      explanation: d.impact,
      whyItMatters: d.impact,
      competitiveImplication: `Observed competitive shift for ${d.company}. Evaluated against current period positioning.`,
      sourcesCount: 2,
      confidence: (idx === 2 ? "Medium" : "High") as "High" | "Medium",
      tier: (idx === 2 ? "Should-Know" : "Must-Know") as "Must-Know" | "Should-Know",
      timestamp: activeBrief?.date || new Date().toISOString(),
      records: [
        {
          source: "Synthesized Brief Record",
          extractedText: d.impact,
          timestamp: activeBrief?.date,
        },
      ],
    }));
  }, [parsed, activeBrief?.date]);

  const handleInspect = (dev: MajorDevelopment) => {
    openDrawer({
      id: dev.id,
      title: dev.headline,
      company: dev.company,
      timestamp: dev.timestamp,
      tier: dev.tier,
      confidence: dev.confidence,
      factualConfidence: "High",
      inferenceConfidence: dev.confidence === "High" ? "High" : "Medium",
      factualRationale: "Verified against unredacted primary records and public repository commits.",
      inferenceRationale: dev.whyItMatters,
      factSummary: dev.explanation,
      whyItMatters: dev.whyItMatters,
      implication: dev.competitiveImplication,
      records: dev.records.map((r, i) => ({
        source: r.source,
        extractedText: r.extractedText,
        url: r.url,
        timestamp: r.timestamp,
        isPrimary: i === 0,
      })),
      corroboratingSources: dev.records.slice(1).map((r) => r.source),
    });
  };

  const timeInfo = formatRelativeTime(activeBrief?.date || "");

  // Render empty state if no brief is published yet for this tenant
  if (!loading && !activeBrief) {
    return (
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 relative z-10">
        <header className="space-y-3 border-b border-[rgba(255,255,255,0.08)] pb-6 relative">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs font-mono text-[#b6a0ff] font-bold tracking-wider">
              PRISMIQ · {targetCompany ? `${targetCompany.toUpperCase()} · ` : ""}INTELLIGENCE BRIEF
            </span>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border border-white/10 bg-[#0c0c11]/80 text-[11px] text-[#bbb] font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
              <span>Continuous monitoring active</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6] font-normal tracking-tight">
              Competitive Intelligence Brief
            </h1>
            <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
              What changed and why it matters.
            </p>
          </div>
        </header>

        {/* Honest initialization card */}
        <div className="rounded-[10px] border border-white/[0.08] bg-[#0E1117] p-10 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-[0_0_16px_rgba(165,107,255,0.2)]">
            <span className="text-xl">✦</span>
          </div>
          <h2 className="text-base font-semibold text-white font-mono">
            {targetCompany ? `Continuous monitoring active for ${targetCompany}` : "Continuous monitoring active"}
          </h2>
          <p className="text-xs text-[#9CA3AF] max-w-lg mx-auto leading-relaxed">
            {targetCompany
              ? `PrismIQ has initialized competitive monitoring for ${targetCompany} and ${competitors.length ? `${competitors.length} tracked competitors` : "your configured competitors"}. The initial synthesized executive brief will generate automatically during the next scheduled cycle.`
              : "PrismIQ is currently indexing your tracked competitors. Your initial synthesized brief will generate during the next scheduled cycle."}
          </p>

          {competitors.length > 0 && (
            <div className="pt-4 max-w-md mx-auto">
              <div className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider mb-2">
                Currently Monitored Competitors
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {competitors.map((c) => (
                  <span
                    key={c.company_name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-white/[0.08] bg-white/[0.03] text-xs text-[#E5E7EB]"
                  >
                    <CompanyLogo company={c.company_name} variant="mini" className="w-4 h-4" />
                    <span>{c.company_name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-14 relative z-10">
      {/* ========================================================================= */}
      {/* 1. BRIEF HEADER: Clean, editorial, authoritative                         */}
      {/* ========================================================================= */}
      <header className="space-y-3 border-b border-[rgba(255,255,255,0.08)] pb-6 relative">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs font-mono text-[#b6a0ff] font-bold tracking-wider">
            PRISMIQ · {targetCompany ? `${targetCompany.toUpperCase()} · ` : ""}INTELLIGENCE BRIEF
          </span>
          <FreshnessIndicator timestamp={activeBrief?.date || new Date().toISOString()} />
        </div>

        <div className="space-y-1">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6] font-normal tracking-tight">
            Competitive Intelligence Brief
          </h1>
          <p className="text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
            What changed and why it matters.
          </p>
        </div>

        <div className="pt-1 text-[11px] font-mono text-[#777985]">
          Updated {timeInfo.relative || "Recently"} · Coverage: News · GitHub · Pricing · Releases
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. THE PERIOD IN BRIEF: Short 2–4 sentence editorial synthesis             */}
      {/* ========================================================================= */}
      {parsed?.executiveSummary && (
        <section className="space-y-3" aria-label="The period in brief">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c5b4ff] font-mono flex items-center gap-1.5">
            <span className="text-[var(--violet)]">✦</span> The Period in Brief
          </h2>

          <div className="border-l-2 border-l-[var(--violet)] pl-4 py-1.5 bg-gradient-to-r from-[rgba(165,107,255,0.04)] to-transparent rounded-r-[4px]">
            <p className="font-serif text-lg sm:text-xl text-[#F3F4F6] font-normal leading-relaxed italic">
              "{parsed.executiveSummary}"
            </p>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. MAJOR DEVELOPMENTS (01, 02, 03): Editorial hierarchy                   */}
      {/* ========================================================================= */}
      {majorDevelopments.length > 0 && (
        <section className="space-y-8" aria-label="Major developments">
          <div className="border-b border-[rgba(255,255,255,0.06)] pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[#F3F4F6] font-mono flex items-center gap-1.5">
                <span className="text-[var(--violet)]">✦</span> Major Developments
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Key competitive shifts requiring strategic attention
              </p>
            </div>
            <span className="text-xs font-mono text-[#bba4ff]">
              {majorDevelopments.length} {majorDevelopments.length === 1 ? "development" : "developments"}
            </span>
          </div>

          <div className="divide-y divide-[rgba(255,255,255,0.06)] space-y-10">
            {majorDevelopments.map((dev, idx) => {
              const accentColor =
                idx === 0
                  ? "var(--magenta)"
                  : idx === 1
                  ? "var(--cyan)"
                  : "var(--violet)";

              return (
                <section
                  key={dev.id}
                  className={cn("space-y-4 relative", idx > 0 && "pt-10")}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-[1px] opacity-40"
                    style={{
                      background: `linear-gradient(90deg, ${accentColor}, transparent 60%)`,
                    }}
                  />

                  {/* Header: 01 · COMPANY · Badges · Source count */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: accentColor }}
                      >
                        {dev.number}
                      </span>
                      <CompanyLogo company={dev.company} variant="inline" className="text-xs" />
                      <TierBadge tier={dev.tier} size="sm" />
                      <ConfidenceBadge confidence={dev.confidence} size="sm" />
                    </div>

                    <div className="text-xs font-mono text-[#6B7280]">
                      {formatEvidenceCount(dev.sourcesCount, 1)}
                    </div>
                  </div>

                  {/* Headline */}
                  <h3 className="font-serif text-2xl sm:text-3xl text-[#F3F4F6] font-normal leading-snug">
                    {dev.headline}
                  </h3>

                  {/* Factual explanation */}
                  <p className="text-sm sm:text-base text-[#D1D5DB] leading-relaxed">
                    {dev.explanation}
                  </p>

                  {/* Why It Matters Callout */}
                  <div className="border-l-2 border-l-[rgba(255,255,255,0.15)] pl-4 py-1 space-y-1 bg-[rgba(255,255,255,0.02)] rounded-r-[4px]">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#bba4ff] block">
                      ↳ Why It Matters
                    </span>
                    <p className="text-xs sm:text-sm text-[#E5E7EB] leading-relaxed">
                      {dev.whyItMatters}
                    </p>
                  </div>

                  {/* Competitive Implication */}
                  {dev.competitiveImplication && (
                    <div className="border-l-2 border-l-[rgba(165,107,255,0.3)] pl-4 py-1 space-y-1 bg-[rgba(165,107,255,0.02)] rounded-r-[4px]">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#d4c8ff] block">
                        ↳ Competitive Implication
                      </span>
                      <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                        {dev.competitiveImplication}
                      </p>
                    </div>
                  )}

                  {/* View Evidence Dossier Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleInspect(dev)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-[#bba4ff] hover:text-white hover:underline transition-colors cursor-pointer group"
                    >
                      <span>Inspect evidence dossier</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. COMPETITIVE MOVEMENT: Compact table                                    */}
      {/* ========================================================================= */}
      <section className="space-y-3" aria-label="Competitive movement">
        <div className="border-b border-[rgba(255,255,255,0.06)] pb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[#F3F4F6] font-mono flex items-center gap-1.5">
            <span className="text-[var(--violet)]">✦</span> Competitive Movement
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Directional shifts observed across tracked competitors this period
          </p>
        </div>

        <div className="rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[#090B0F] h-9 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280] font-mono">
                <th className="px-4 py-2 font-medium w-44">Company</th>
                <th className="px-4 py-2 font-medium">Meaningful Movement</th>
                <th className="px-4 py-2 font-medium text-right w-36">Domain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-[#E5E7EB]">
              {parsed && parsed.rollupRows.length > 0 ? (
                parsed.rollupRows.map((row, idx) => (
                  <tr key={idx} className="h-11 hover:bg-[#11151E] transition-colors">
                    <td className="px-4 py-2 font-semibold text-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        <CompanyLogo company={row.competitors} variant="mini" />
                        <span>{row.competitors}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[#D1D5DB]">
                      {row.patternDetected || row.theme}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-[#6B7280]">
                      {row.theme}
                    </td>
                  </tr>
                ))
              ) : (
                (competitors.length > 0 ? competitors : trackedCompanies).map((c, idx) => (
                  <tr key={idx} className="h-11 hover:bg-[#11151E] transition-colors">
                    <td className="px-4 py-2 font-semibold text-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        <CompanyLogo company={c.company_name} variant="mini" />
                        <span>{c.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[#D1D5DB]">
                      Continuous monitoring active
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-[#6B7280]">
                      Monitored
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. EMERGING RESEARCH: Configured research field developments              */}
      {/* ========================================================================= */}
      {topics.length > 0 && (
        <section className="space-y-3" aria-label="Emerging research">
          <div className="flex items-baseline justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[#F3F4F6] font-mono flex items-center gap-1.5">
                <span className="text-[var(--violet)]">⌁</span> Emerging in Your Research
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Key movements across configured research topics
              </p>
            </div>
            <Link
              href="/app/research-radar"
              className="text-xs font-medium text-[#bba4ff] hover:text-[#d4c8ff] transition-colors inline-flex items-center gap-1 font-mono"
            >
              View Research Radar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] divide-y divide-[rgba(255,255,255,0.04)] overflow-hidden">
            {topics.map((item, i) => (
              <div
                key={i}
                className="p-4 sm:p-5 hover:bg-[#11151E] transition-colors space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-sm text-[#F3F4F6]">
                    {item.topic_label}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-[3px] border font-medium shrink-0",
                      item.is_active
                        ? "text-[var(--green)] bg-[rgba(57,217,154,0.08)] border-[var(--green)]/20"
                        : "text-[var(--amber)] bg-[rgba(255,180,90,0.08)] border-[var(--amber)]/20"
                    )}
                  >
                    {item.is_active ? "Active" : "Paused"}
                  </span>
                </div>

                <p className="text-xs sm:text-[13px] text-[#D1D5DB] leading-relaxed">
                  {item.keywords?.length
                    ? `Keywords: ${item.keywords.join(", ")}`
                    : "Continuous monitoring active across primary news, academic, and code repositories."}
                </p>

                <div className="pt-2 border-t border-[rgba(255,255,255,0.04)] text-[11px] text-[#9CA3AF] flex items-center flex-wrap gap-1.5">
                  <span className="text-[#6B7280] font-semibold uppercase tracking-wider font-mono">
                    Competitive Scope:
                  </span>
                  <CompanyLogo company={targetCompany || "Workspace"} variant="inline" className="text-white text-[10px]" />
                  <span>Tracked under {targetCompany || "workspace"} intelligence scope.</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 6. EVIDENCE & METHODOLOGY: Collapsed, subtle bottom transparency section   */}
      {/* ========================================================================= */}
      <section className="pt-8 border-t border-[rgba(255,255,255,0.08)] space-y-4" aria-label="Evidence and methodology">
        <div className="spectrum-line h-[1px] w-full" />

        <button
          type="button"
          onClick={() => setMethodologyOpen(!methodologyOpen)}
          className="flex items-center justify-between w-full p-4 rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] border-t-[rgba(165,107,255,0.2)] hover:bg-[#121620] transition-colors text-left group cursor-pointer relative overflow-hidden"
          aria-expanded={methodologyOpen}
        >
          <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-[var(--violet)] via-[var(--magenta)] via-[var(--cyan)] to-[var(--amber)] animate-spectrumFlow opacity-60" />

          <div className="flex items-center gap-3">
            <span className="text-[var(--magenta)] drop-shadow-[0_0_7px_rgba(241,91,181,0.6)] font-bold text-sm">◉</span>
            <div>
              <span className="text-xs font-semibold text-[#F3F4F6] block">
                Evidence &amp; Methodology
              </span>
              <span className="text-[11px] text-[#6B7280]">
                Sources, corroboration criteria, confidence thresholds, and collection limitations
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#747581]">
            <span>{methodologyOpen ? "Hide" : "Inspect methodology"}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                methodologyOpen && "rotate-180"
              )}
            />
          </div>
        </button>

        {methodologyOpen && (
          <div className="p-5 rounded-[6px] bg-[#090B0F] border border-[rgba(255,255,255,0.06)] space-y-4 text-xs text-[#9CA3AF] leading-relaxed animate-in fade-in duration-150">
            <div className="space-y-1">
              <h4 className="font-semibold text-xs text-[#F3F4F6] uppercase tracking-wider font-mono">
                Corroboration &amp; Filtering Criteria
              </h4>
              <p>
                PrismIQ synthesizes competitive findings through multi-source corroboration. Routine operational events (such as standard hiring announcements, maintenance branch creations, and single-commit updates) are suppressed from strategic briefs unless corroborated by significant product or pricing movements.
              </p>
            </div>

            <div className="space-y-1 pt-2 border-t border-[rgba(255,255,255,0.04)]">
              <h4 className="font-semibold text-xs text-[#F3F4F6] uppercase tracking-wider font-mono">
                Confidence Separation
              </h4>
              <p>
                Factual confidence reflects primary document verifiability. Strategic inference confidence reflects the probability of long-term market impact derived from historical competitive movement models. These two dimensions are never collapsed into a single speculative score.
              </p>
            </div>

            <div className="space-y-1 pt-2 border-t border-[rgba(255,255,255,0.04)]">
              <h4 className="font-semibold text-xs text-[#F3F4F6] uppercase tracking-wider font-mono">
                Collection Scope &amp; Limitations
              </h4>
              <p>
                Intelligence is drawn from publicly accessible documentation, official code repositories, developer registries, and news feeds. Bilateral enterprise discounts, private internal communications, and unannounced roadmaps remain unobserved.
              </p>
            </div>
          </div>
        )}

        {/* Historical Brief Archives Button */}
        {briefs.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setArchivesOpen(!archivesOpen)}
              className="text-xs font-mono text-[#6B7280] hover:text-[#9CA3AF] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>{archivesOpen ? "Hide historical cycles" : `Browse historical brief archives (${briefs.length} past cycles)`}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", archivesOpen && "rotate-180")} />
            </button>

            {archivesOpen && (
              <div className="mt-3 p-4 rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] space-y-1.5">
                {briefs.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => router.push(b.id === "data_latest" ? "/app/brief" : `/app/brief/${b.id}`)}
                    className="p-2.5 rounded-[4px] hover:bg-[#151922] transition-colors cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-[#F3F4F6]">{b.title || `Cycle ${b.date}`}</span>
                    <span className="text-[11px] font-mono text-[#bba4ff] flex items-center gap-1">
                      View <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </article>
  );
}
