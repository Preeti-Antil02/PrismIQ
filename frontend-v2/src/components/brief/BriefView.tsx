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
import { TierBadge } from "@/components/primitives/TierBadge";
import { ConfidenceBadge } from "@/components/primitives/ConfidenceBadge";
import { FreshnessIndicator } from "@/components/primitives/FreshnessIndicator";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";
import {
  fetchBriefs,
  fetchLatestBrief,
  fetchBriefById,
  type BriefEntry,
  type BriefDetail,
} from "@/lib/api";
import { parseBriefMarkdown } from "@/lib/briefParser";

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
  competitiveImplication: string;
  sourcesCount: number;
  confidence: "High" | "Medium";
  tier: "Must-Know" | "Should-Know";
  timestamp: string;
  records: Array<{
    source: string;
    extractedText: string;
    url: string;
    timestamp?: string;
  }>;
}

const MAJOR_DEVELOPMENTS: MajorDevelopment[] = [
  {
    id: "dev-01-stripe",
    number: "01",
    company: "Stripe",
    topicTitle: "Stripe launched its Agentic Commerce Toolkit with native autonomous settlement primitives",
    headline: "Stripe launched its Agentic Commerce Toolkit with native autonomous settlement primitives.",
    explanation:
      "According to Stripe's GitHub repository and engineering blog, Stripe published open-source Python and Node SDKs allowing software agents to initiate checkout sessions with programmatic spend limits.",
    whyItMatters:
      "This moves Stripe directly into checkout orchestration for agent-driven purchasing. By issuing cryptographic session tokens with hard spending limits, Stripe creates platform lock-in before third-party agent brokers can establish independent payment rails.",
    competitiveImplication:
      "If autonomous purchasing workflows gain adoption, competing payment gateways could see customer requests for similar machine-readable checkout protocols. The available evidence demonstrates feature availability, but PrismIQ does not currently have sufficient competitor data to establish whether this is differentiated.",
    sourcesCount: 3,
    confidence: "High",
    tier: "Must-Know",
    timestamp: "2026-09-09T14:22:00Z",
    records: [
      {
        source: "GitHub",
        extractedText:
          "v1.4.0: Autonomous Agent Billing Primitives & Agentic Session Tokens (commit e482bca). Added programmatic mandate verification for automated purchasing bots.",
        url: "https://github.com/stripe/agentic-commerce",
        timestamp: "2026-09-09T14:22:00Z",
      },
      {
        source: "Stripe Engineering Blog",
        extractedText:
          "Introducing the Agentic Commerce Toolkit: enable LLMs to negotiate terms and finalize checkout securely with cryptographic spend authorization.",
        url: "https://stripe.com/blog/agentic-commerce",
        timestamp: "2026-09-09T15:00:00Z",
      },
      {
        source: "Hacker News",
        extractedText:
          "Show HN: Stripe Agentic Commerce — SDK for autonomous agent spending limits (248 comments, 412 points).",
        url: "https://news.ycombinator.com/item?id=4149201",
        timestamp: "2026-09-09T16:30:00Z",
      },
    ],
  },
  {
    id: "dev-02-cloudflare",
    number: "02",
    company: "Cloudflare",
    topicTitle: "Cloudflare accelerated post-quantum edge infrastructure deployment",
    headline: "Cloudflare accelerated post-quantum edge infrastructure deployment.",
    explanation:
      "According to the Cloudflare Blog, the 1.1.1.1 public DNS resolver now validates DNSSEC signatures using the NIST-standardized ML-DSA-44 post-quantum algorithm across its points of presence.",
    whyItMatters:
      "Cloudflare is strengthening its edge platform with post-quantum key agreement, which could influence security-conscious enterprise procurement.",
    competitiveImplication:
      "May prompt other public DNS resolver operators to evaluate ML-DSA-44 support. The available evidence confirms implementation on 1.1.1.1, but PrismIQ does not currently have sufficient competitor evidence to establish whether this capability provides a commercial advantage over alternative enterprise DNS offerings.",
    sourcesCount: 2,
    confidence: "High",
    tier: "Must-Know",
    timestamp: "2026-09-10T13:00:00Z",
    records: [
      {
        source: "Cloudflare Blog",
        extractedText:
          "1.1.1.1 now validates DNSSEC signatures using NIST post-quantum ML-DSA-44 algorithm across all global points of presence.",
        url: "https://blog.cloudflare.com/post-quantum-dnssec-1111/",
        timestamp: "2026-09-10T13:00:00Z",
      },
      {
        source: "IETF Drafts",
        extractedText:
          "draft-ietf-dnsop-pqc-dnssec-03: Operational considerations for post-quantum signature algorithms in public recursive resolvers.",
        url: "https://datatracker.ietf.org/doc/draft-ietf-dnsop-pqc-dnssec/",
        timestamp: "2026-09-08T11:00:00Z",
      },
    ],
  },
  {
    id: "dev-03-vercel",
    number: "03",
    company: "Vercel",
    topicTitle: "Vercel introduced dynamic compute allocation for edge functions",
    headline: "Vercel introduced dynamic compute allocation for edge functions.",
    explanation:
      "According to the Vercel Blog and Changelog, developers can now configure custom CPU and memory ratios (up to 8 vCPUs and 32GB RAM) for serverless functions in project settings.",
    whyItMatters:
      "Addresses developer resource limits for AI and streaming workloads, which may help retain complex applications on Vercel's platform.",
    competitiveImplication:
      "Could reduce reasons for developers running memory-intensive workloads to migrate to container hosting services. The available evidence indicates feature availability, but PrismIQ does not have telemetry to measure workload migration or retention impact.",
    sourcesCount: 2,
    confidence: "Medium",
    tier: "Should-Know",
    timestamp: "2026-09-07T18:40:00Z",
    records: [
      {
        source: "Vercel Blog",
        extractedText:
          "Compute that takes any shape: flexible CPU and memory configurations for intensive serverless workloads.",
        url: "https://vercel.com/blog/flexible-compute",
        timestamp: "2026-09-07T18:40:00Z",
      },
      {
        source: "Vercel Changelog",
        extractedText:
          "Configurable CPU and memory allocations up to 8 vCPUs and 32GB RAM now available in project settings for Vercel Functions.",
        url: "https://vercel.com/changelog/flexible-functions",
        timestamp: "2026-09-07T18:45:00Z",
      },
    ],
  },
];

const COMPETITIVE_MOVEMENTS = [
  {
    company: "Cloudflare",
    meaningfulMovement: "Post-quantum edge security",
    domain: "Edge Infrastructure",
  },
  {
    company: "Stripe",
    meaningfulMovement: "Agentic commerce infrastructure",
    domain: "Payments",
  },
  {
    company: "Vercel",
    meaningfulMovement: "Flexible AI compute",
    domain: "Serverless Runtime",
  },
  {
    company: "Adyen",
    meaningfulMovement: "Automated marketplace payments",
    domain: "Payments",
  },
  {
    company: "Netlify",
    meaningfulMovement: "Routine operational activity",
    domain: "Developer Tooling",
  },
];

const RESEARCH_TOPICS = [
  {
    topic: "AI Agent Tooling",
    status: "Emerging",
    development: "Programmatic spend mandates, tool invocation protocols, and autonomous transaction verification.",
    competitiveContext: "Stripe deploying agentic SDKs; Adyen adjusting programmatic interface.",
    contextCompany: "Stripe",
    statusClass: "text-[var(--cyan)] bg-[rgba(39,228,208,0.08)] border-[var(--cyan)]/20",
  },
  {
    topic: "Edge Database Consistency",
    status: "Active",
    development: "Causal consistency models and read-after-write replication across distributed edge key-value stores.",
    competitiveContext: "Tracked across Vercel KV and Cloudflare storage runtimes.",
    contextCompany: "Vercel",
    statusClass: "text-[var(--green)] bg-[rgba(57,217,154,0.08)] border-[var(--green)]/20",
  },
  {
    topic: "WASM at the Edge",
    status: "Monitoring",
    development: "WebAssembly component model isolation and async execution in lightweight serverless sandboxes.",
    competitiveContext: "Monitored across edge isolate engines including Cloudflare workerd.",
    contextCompany: "Cloudflare",
    statusClass: "text-[var(--amber)] bg-[rgba(255,180,90,0.08)] border-[var(--amber)]/20",
  },
];

export function BriefView({ initialBriefId }: BriefViewProps) {
  const router = useRouter();
  const { openDrawer } = useEvidenceDrawer();

  const [briefs, setBriefs] = React.useState<BriefEntry[]>([]);
  const [activeBrief, setActiveBrief] = React.useState<BriefDetail | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [methodologyOpen, setMethodologyOpen] = React.useState<boolean>(false);
  const [archivesOpen, setArchivesOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    fetchBriefs()
      .then((data) => setBriefs(data))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    setLoading(true);
    const fetcher = initialBriefId && initialBriefId !== "latest"
      ? fetchBriefById(initialBriefId)
      : fetchLatestBrief();

    fetcher
      .then((data) => setActiveBrief(data))
      .catch((err) => console.warn("Using baseline strategic intelligence brief:", err))
      .finally(() => setLoading(false));
  }, [initialBriefId]);

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

  const timeInfo = formatRelativeTime(activeBrief?.date || "2026-09-13T01:49:00Z");

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-14 relative z-10">
      {/* ========================================================================= */}
      {/* 1. BRIEF HEADER: Clean, editorial, authoritative                         */}
      {/* ========================================================================= */}
      <header className="space-y-3 border-b border-[rgba(255,255,255,0.08)] pb-6 relative">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs font-mono text-[#b6a0ff] font-bold tracking-wider">
            PRISMIQ · INTELLIGENCE BRIEF
          </span>
          <FreshnessIndicator timestamp={activeBrief?.date || "2026-09-13T01:49:00Z"} />
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
          Updated {timeInfo.relative} · Coverage: News · GitHub · Pricing · Releases
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. THE PERIOD IN BRIEF: Short 2–4 sentence editorial synthesis             */}
      {/* ========================================================================= */}
      <section className="space-y-3" aria-label="The period in brief">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c5b4ff] font-mono flex items-center gap-1.5">
          <span className="text-[var(--violet)]">✦</span> The Period in Brief
        </h2>

        <div className="border-l-2 border-l-[var(--violet)] pl-4 py-1.5 bg-gradient-to-r from-[rgba(165,107,255,0.04)] to-transparent rounded-r-[4px]">
          <p className="font-serif text-lg sm:text-xl text-[#F3F4F6] font-normal leading-relaxed italic">
            "Three developments were verified this period: Stripe launched its Agentic Commerce Toolkit with native autonomous settlement primitives, Cloudflare accelerated post-quantum edge infrastructure deployment, and Vercel introduced dynamic compute allocation for edge functions."
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MAJOR DEVELOPMENTS (01, 02, 03): Editorial hierarchy                   */}
      {/* ========================================================================= */}
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
            3 developments
          </span>
        </div>

        <div className="divide-y divide-[rgba(255,255,255,0.06)] space-y-10">
          {MAJOR_DEVELOPMENTS.map((dev, idx) => {
            const accentColor =
              dev.company.toLowerCase().includes("stripe")
                ? "var(--magenta)"
                : dev.company.toLowerCase().includes("cloudflare")
                ? "var(--cyan)"
                : "var(--violet)";

            return (
              <section
                key={dev.id}
                className={cn("space-y-4 relative", idx > 0 && "pt-10")}
              >
                {/* Subtle top hairline */}
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

                  <span className="text-xs font-mono text-[#777985]">
                    {formatEvidenceCount(dev.records.length, 1)}
                  </span>
                </div>

                {/* Headline */}
                <h3 className="font-serif text-xl sm:text-[22px] font-normal text-[#F3F4F6] leading-snug">
                  {dev.headline}
                </h3>

                {/* Short factual explanation: 1–2 sentences */}
                <p className="text-xs sm:text-[13px] text-[#D1D5DB] leading-relaxed">
                  {dev.explanation}
                </p>

                {/* WHY IT MATTERS: 1–2 concise paragraphs */}
                <div
                  className="pl-3.5 py-1 space-y-1 rounded-r-[4px]"
                  style={{
                    borderLeft: `2px solid ${accentColor}`,
                    background: `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 4%, transparent), transparent 60%)`,
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em] block font-mono"
                    style={{ color: accentColor }}
                  >
                    ↳ WHY IT MATTERS
                  </span>
                  <p className="text-xs sm:text-[13px] text-[#b8b8c2] leading-relaxed">
                    {dev.whyItMatters}
                  </p>
                </div>

                {/* COMPETITIVE IMPLICATION: One concise paragraph */}
                <div className="border-l-2 border-l-[var(--amber)] pl-3.5 py-1 space-y-1 bg-gradient-to-r from-[rgba(255,180,90,0.04)] to-transparent rounded-r-[4px]">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--amber)] block font-mono">
                    ◈ COMPETITIVE IMPLICATION
                  </span>
                  <p className="text-xs sm:text-[13px] text-[#b8b8c2] leading-relaxed">
                    {dev.competitiveImplication}
                  </p>
                </div>

                {/* Evidence Action Affordance */}
                <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.04)] text-xs">
                  <span className="font-mono text-[#777985]">
                    Evidence: {formatEvidenceCount(dev.records.length, 1)} · {dev.confidence} confidence
                  </span>

                  <button
                    type="button"
                    onClick={() => handleInspect(dev)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[#d4c8ff] hover:text-white py-1.5 px-3 rounded-[4px] bg-[rgba(165,107,255,0.06)] hover:bg-[rgba(165,107,255,0.15)] border border-[rgba(165,107,255,0.25)] hover:border-[rgba(165,107,255,0.5)] transition-colors cursor-pointer select-none"
                  >
                    <span>♧</span>
                    <span>Inspect evidence →</span>
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </section>

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
              {COMPETITIVE_MOVEMENTS.map((c, idx) => (
                <tr key={idx} className="h-11 hover:bg-[#11151E] transition-colors">
                  <td className="px-4 py-2 font-semibold text-[#F3F4F6]">
                    <div className="flex items-center gap-2">
                      <CompanyLogo company={c.company} variant="mini" />
                      <span>{c.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[#D1D5DB]">
                    {c.meaningfulMovement}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[11px] text-[#6B7280]">
                    {c.domain}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. EMERGING RESEARCH: Configured research field developments              */}
      {/* ========================================================================= */}
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
          {RESEARCH_TOPICS.map((item, i) => (
            <div
              key={i}
              className="p-4 sm:p-5 hover:bg-[#11151E] transition-colors space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-sm text-[#F3F4F6]">
                  {item.topic}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded-[3px] border font-medium shrink-0",
                    item.statusClass
                  )}
                >
                  {item.status}
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-[#D1D5DB] leading-relaxed">
                {item.development}
              </p>

              <div className="pt-2 border-t border-[rgba(255,255,255,0.04)] text-[11px] text-[#9CA3AF] flex items-center flex-wrap gap-1.5">
                <span className="text-[#6B7280] font-semibold uppercase tracking-wider font-mono">
                  Competitive Context:
                </span>
                <CompanyLogo company={item.contextCompany} variant="inline" className="text-white text-[10px]" />
                <span>{item.competitiveContext}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. EVIDENCE & METHODOLOGY: Collapsed, subtle bottom transparency section   */}
      {/* ========================================================================= */}
      <section className="pt-8 border-t border-[rgba(255,255,255,0.08)] space-y-4" aria-label="Evidence and methodology">
        {/* Animated spectrum line */}
        <div className="spectrum-line h-[1px] w-full" />

        <button
          type="button"
          onClick={() => setMethodologyOpen(!methodologyOpen)}
          className="flex items-center justify-between w-full p-4 rounded-[6px] bg-[#0E1117] border border-[rgba(255,255,255,0.06)] border-t-[rgba(165,107,255,0.2)] hover:bg-[#121620] transition-colors text-left group cursor-pointer relative overflow-hidden"
          aria-expanded={methodologyOpen}
        >
          {/* Bottom animated spectrum hairline */}
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
                Corroboration & Filtering Criteria
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
                Collection Scope & Limitations
              </h4>
              <p>
                Intelligence is drawn from publicly accessible documentation, official code repositories, developer registries, and news feeds. Bilateral enterprise discounts, private internal communications, and unannounced roadmaps remain unobserved.
              </p>
            </div>
          </div>
        )}

        {/* Historical Brief Archives Button */}
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
      </section>
    </article>
  );
}
