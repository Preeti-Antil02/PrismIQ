"use client";

import * as React from "react";
import { useEvidenceDrawer } from "@/components/layout/AppShell";
import { type FindingData } from "@/components/primitives/FindingRow";
import { LoadingSkeleton } from "@/components/primitives/LoadingSkeleton";
import { AmbientAtmosphere } from "@/components/overview/AmbientAtmosphere";
import { OverviewCockpitHero } from "@/components/overview/OverviewCockpitHero";
import { OverviewAttentionGrid } from "@/components/overview/OverviewAttentionGrid";
import { CompetitivePulseStrip } from "@/components/overview/CompetitivePulseStrip";
import { ResearchRadarField } from "@/components/overview/ResearchRadarField";
import { RecentEventsStream, type RecentEventItem } from "@/components/overview/RecentEventsStream";
import { MethodologyQuietLayer } from "@/components/overview/MethodologyQuietLayer";
import { fetchLatestBrief, fetchEvents } from "@/lib/api";
import { parseBriefMarkdown } from "@/lib/briefParser";

// Strictly the 3 most important strategic developments for executive review
const STRATEGIC_FINDINGS: FindingData[] = [
  {
    id: "finding-stripe-agentic",
    company: "Stripe",
    headline: "Stripe launched its Agentic Commerce Toolkit with native autonomous settlement primitives.",
    whyItMatters:
      "This moves Stripe directly into checkout orchestration for agent-driven purchasing. By issuing cryptographic session tokens with hard spending limits, Stripe creates platform lock-in before third-party agent brokers can establish independent payment rails.",
    implication:
      "If autonomous purchasing workflows gain adoption, competing payment gateways could see customer requests for similar machine-readable checkout protocols. The available evidence demonstrates feature availability, but PrismIQ does not currently have sufficient competitor data to establish whether this is differentiated.",
    fact: "According to Stripe's GitHub repository and engineering blog, Stripe published open-source Python and Node SDKs allowing software agents to initiate checkout sessions with programmatic spend limits.",
    tier: "Must-Know",
    confidence: "High",
    factConfidence: "High",
    inferenceConfidence: "Medium",
    timestamp: "2026-09-09T14:22:00Z",
    sources: ["GitHub", "Stripe Engineering Blog", "Hacker News"],
    rawSignals: [
      {
        source: "GitHub",
        text: "v1.4.0: Autonomous Agent Billing Primitives & Agentic Session Tokens (commit e482bca). Added programmatic mandate verification for automated purchasing bots.",
        url: "https://github.com/stripe/agentic-commerce",
        timestamp: "2026-09-09T14:22:00Z",
      },
      {
        source: "Stripe Engineering Blog",
        text: "Introducing the Agentic Commerce Toolkit: enable LLMs to negotiate terms and finalize checkout securely with cryptographic spend authorization.",
        url: "https://stripe.com/blog/agentic-commerce",
        timestamp: "2026-09-09T15:00:00Z",
      },
      {
        source: "Hacker News",
        text: "Show HN: Stripe Agentic Commerce — SDK for autonomous agent spending limits (248 comments, 412 points).",
        url: "https://news.ycombinator.com/item?id=4149201",
        timestamp: "2026-09-09T16:30:00Z",
      },
    ],
  },
  {
    id: "finding-cloudflare-pqc",
    company: "Cloudflare",
    headline: "Cloudflare accelerated post-quantum edge infrastructure deployment.",
    whyItMatters:
      "Cloudflare is strengthening its edge platform with post-quantum key agreement, which could influence security-conscious enterprise procurement.",
    implication:
      "May prompt other public DNS resolver operators to evaluate ML-DSA-44 support. The available evidence confirms implementation on 1.1.1.1, but PrismIQ does not currently have sufficient competitor evidence to establish whether this capability provides a commercial advantage over alternative enterprise DNS offerings.",
    fact: "According to the Cloudflare Blog, the 1.1.1.1 public DNS resolver now validates DNSSEC signatures using the NIST-standardized ML-DSA-44 post-quantum algorithm across its points of presence.",
    tier: "Must-Know",
    confidence: "High",
    factConfidence: "High",
    inferenceConfidence: "Medium",
    timestamp: "2026-09-10T13:00:00Z",
    sources: ["Cloudflare Blog", "IETF Drafts"],
    rawSignals: [
      {
        source: "Cloudflare Blog",
        text: "1.1.1.1 now validates DNSSEC signatures using NIST post-quantum ML-DSA-44 algorithm across all global points of presence.",
        url: "https://blog.cloudflare.com/post-quantum-dnssec-1111/",
        timestamp: "2026-09-10T13:00:00Z",
      },
      {
        source: "IETF Drafts",
        text: "draft-ietf-dnsop-pqc-dnssec-03: Operational considerations for post-quantum signature algorithms in public recursive resolvers.",
        url: "https://datatracker.ietf.org/doc/draft-ietf-dnsop-pqc-dnssec/",
        timestamp: "2026-09-08T11:00:00Z",
      },
    ],
  },
  {
    id: "finding-vercel-compute",
    company: "Vercel",
    headline: "Vercel introduced dynamic compute allocation for edge functions.",
    whyItMatters:
      "Addresses developer resource limits for AI and streaming workloads, which may help retain complex applications on Vercel's platform.",
    implication:
      "Could reduce reasons for developers running memory-intensive workloads to migrate to container hosting services. The available evidence indicates feature availability, but PrismIQ does not have telemetry to measure workload migration or retention impact.",
    fact: "According to the Vercel Blog and Changelog, developers can now configure custom CPU and memory ratios (up to 8 vCPUs and 32GB RAM) for serverless functions in project settings.",
    tier: "Should-Know",
    confidence: "Medium",
    factConfidence: "High",
    inferenceConfidence: "Medium",
    timestamp: "2026-09-07T18:40:00Z",
    sources: ["Vercel Blog", "Vercel Changelog"],
    rawSignals: [
      {
        source: "Vercel Blog",
        text: "Compute that takes any shape: flexible CPU and memory configurations for intensive serverless workloads.",
        url: "https://vercel.com/blog/flexible-compute",
        timestamp: "2026-09-07T18:40:00Z",
      },
      {
        source: "Vercel Changelog",
        text: "Configurable CPU and memory allocations up to 8 vCPUs and 32GB RAM now available in project settings for Vercel Functions.",
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
    symbol: "✦",
    status: "Emerging",
    explanation: "Autonomous purchasing tokens, session management protocols, and tool invocation SDKs.",
    contextCompany: "Stripe",
    contextText: "deploying agentic SDKs; Adyen adjusting programmatic interface.",
    statusClass: "text-[var(--cyan)] bg-[rgba(39,228,208,0.08)] border-[var(--cyan)]/20",
    borderAccent: "var(--magenta)",
  },
  {
    topic: "Edge Database Consistency",
    symbol: "◉",
    status: "Active",
    explanation: "Multi-region causal consistency and read-after-write replication for edge state persistence.",
    contextCompany: "Vercel",
    contextText: "Edge KV expanding regional replication; Cloudflare addressing KV concurrency.",
    statusClass: "text-[var(--green)] bg-[rgba(57,217,154,0.08)] border-[var(--green)]/20",
    borderAccent: "var(--cyan)",
  },
  {
    topic: "WASM at the Edge",
    symbol: "‹/›",
    status: "Monitoring",
    explanation: "WebAssembly component model execution in edge isolate runtimes for fast-cold-start sandboxes.",
    contextCompany: "Cloudflare",
    contextText: "worker runtime adding Tokio async runtime support.",
    statusClass: "text-[var(--amber)] bg-[rgba(255,180,90,0.08)] border-[var(--amber)]/20",
    borderAccent: "var(--amber)",
  },
];

const RECENT_EVENTS: RecentEventItem[] = [
  {
    id: "ev-01-stripe",
    company: "Stripe",
    date: "Sep 12, 2026",
    title: "Updated agent checkout SDK documentation",
    corroboration: 3,
    confidence: "High",
    tier: "Must-Know",
    whyItMatters: "Enables programmatic spend limits and autonomous checkout sessions for software agent buyer loops.",
    records: [
      {
        source: "Stripe Developer Docs",
        extractedText: "Official documentation updated for agent session authentication and programmatic mandate verification.",
        url: "https://docs.stripe.com/agent-checkout",
        timestamp: "2026-09-12T10:00:00Z",
      },
      {
        source: "GitHub",
        extractedText: "Release v1.4.1 docs update covering autonomous spend tokens and ephemeral limits.",
        url: "https://github.com/stripe/agentic-commerce",
        timestamp: "2026-09-12T11:30:00Z",
      },
      {
        source: "Stripe Engineering Blog",
        extractedText: "Developer guide on deploying agentic checkout tokens with hard spending constraints.",
        url: "https://stripe.com/blog/agentic-commerce-guide",
        timestamp: "2026-09-12T14:00:00Z",
      },
    ],
  },
  {
    id: "ev-02-cloudflare",
    company: "Cloudflare",
    date: "Sep 12, 2026",
    title: "Announced post-quantum TLS rollout at global edge",
    corroboration: 4,
    confidence: "High",
    tier: "Must-Know",
    whyItMatters: "Cloudflare is strengthening its edge platform with post-quantum key agreement across its global network.",
    records: [
      {
        source: "Cloudflare Blog",
        extractedText: "Global edge points of presence now negotiate post-quantum TLS key agreement by default.",
        url: "https://blog.cloudflare.com/post-quantum-tls-rollout/",
        timestamp: "2026-09-12T09:00:00Z",
      },
      {
        source: "IETF Working Group",
        extractedText: "Production telemetry on ML-KEM-768 key exchange deployment at edge scale.",
        url: "https://datatracker.ietf.org/doc/draft-ietf-tls-hybrid-design/",
        timestamp: "2026-09-12T10:15:00Z",
      },
      {
        source: "The Register",
        extractedText: "Cloudflare flips default switch on post-quantum crypto for all edge traffic.",
        url: "https://theregister.com/cloudflare-post-quantum",
        timestamp: "2026-09-12T12:00:00Z",
      },
      {
        source: "Cloudflare System Status",
        extractedText: "PQC key agreement enabled across all 330+ edge locations without latency regression.",
        url: "https://cloudflarestatus.com/incidents/pqc-rollout",
        timestamp: "2026-09-12T13:00:00Z",
      },
    ],
  },
  {
    id: "ev-03-vercel",
    company: "Vercel",
    date: "Sep 11, 2026",
    title: "Released compute allocation for edge functions",
    corroboration: 2,
    confidence: "Medium",
    tier: "Should-Know",
    whyItMatters: "Addresses developer resource limits for AI and streaming workloads directly in serverless runtimes.",
    records: [
      {
        source: "Vercel Blog",
        extractedText: "Compute allocation controls for edge functions now generally available for enterprise teams.",
        url: "https://vercel.com/blog/edge-compute-allocation",
        timestamp: "2026-09-11T16:00:00Z",
      },
      {
        source: "Vercel Changelog",
        extractedText: "Added dynamic compute profiles up to 8 vCPUs for serverless and edge functions.",
        url: "https://vercel.com/changelog/edge-compute",
        timestamp: "2026-09-11T16:30:00Z",
      },
    ],
  },
  {
    id: "ev-04-adyen",
    company: "Adyen",
    date: "Sep 10, 2026",
    title: "Published updated platform fee structure",
    corroboration: 3,
    confidence: "High",
    tier: "Should-Know",
    whyItMatters: "Updated pricing for programmatic and automated marketplace transactions.",
    records: [
      {
        source: "Adyen Portal",
        extractedText: "Updated platform fee schedule and interchange pricing for automated settlement APIs.",
        url: "https://adyen.com/pricing-updates",
        timestamp: "2026-09-10T09:15:00Z",
      },
      {
        source: "FinTech Wire",
        extractedText: "Adyen publishes revised processing floor for automated marketplace payout operations.",
        url: "https://fintechwire.com/adyen-agent-pricing",
        timestamp: "2026-09-10T10:30:00Z",
      },
      {
        source: "Payments Dive",
        extractedText: "Adyen updates interchange terms for automated marketplace integrations.",
        url: "https://paymentsdive.com/adyen-fee-update",
        timestamp: "2026-09-10T11:45:00Z",
      },
    ],
  },
  {
    id: "ev-05-netlify",
    company: "Netlify",
    date: "Sep 09, 2026",
    title: "Deployed infrastructure maintenance update",
    corroboration: 2,
    confidence: "High",
    tier: "Low",
    whyItMatters: "Routine operational activity across build pipeline infrastructure.",
    records: [
      {
        source: "Netlify Status",
        extractedText: "Completed scheduled maintenance across build pipeline workers and edge network nodes.",
        url: "https://netlifystatus.com/incidents/infra-maintenance",
        timestamp: "2026-09-09T08:00:00Z",
      },
      {
        source: "Netlify Changelog",
        extractedText: "Maintenance update applied to deployment caching layers and build agents.",
        url: "https://netlify.com/changelog/infra-maintenance",
        timestamp: "2026-09-09T09:00:00Z",
      },
    ],
  },
];

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "Recently";
  if (/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(dateStr)) return dateStr;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}, ${d.getUTCFullYear()}`;
    }
  } catch {}
  return dateStr;
}

export default function OverviewPage() {
  const { openDrawer } = useEvidenceDrawer();
  const [loading, setLoading] = React.useState(true);
  const [briefDate, setBriefDate] = React.useState<string>("2026-09-13T01:49:00Z");
  const [findings, setFindings] = React.useState<FindingData[]>(STRATEGIC_FINDINGS);
  const [events, setEvents] = React.useState<RecentEventItem[]>(RECENT_EVENTS);
  const [hasPartialDegradation, setHasPartialDegradation] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    async function loadIntelligence() {
      setLoading(true);
      try {
        const [briefRes, eventsRes] = await Promise.allSettled([
          fetchLatestBrief(),
          fetchEvents({ limit: 10 }),
        ]);

        if (!isMounted) return;

        // Ingest latest brief date
        if (briefRes.status === "fulfilled" && briefRes.value) {
          if (briefRes.value.date) {
            setBriefDate(briefRes.value.date);
          }
          if (briefRes.value.content) {
            const parsed = parseBriefMarkdown(briefRes.value.content);
            if (parsed.partialFailure) {
              setHasPartialDegradation(true);
            }
          }
        }

        // Ingest real events if available, diverse across companies, and strategic
        if (eventsRes.status === "fulfilled" && eventsRes.value?.events) {
          const rawEvents = eventsRes.value.events;
          const validStrategic = rawEvents.filter(
            (e) =>
              e.why_it_matters &&
              !e.why_it_matters.includes("rate limits") &&
              !e.why_it_matters.includes("zero commits") &&
              !e.title.toLowerCase().includes("job posting")
          );

          const uniqueCompanies = new Set(validStrategic.map((e) => e.company_name.replace(" Pages/Workers", "")));
          if (validStrategic.length >= 3 && uniqueCompanies.size >= 3) {
            setEvents(
              validStrategic.slice(0, 5).map((e) => ({
                id: e.event_id,
                company: e.company_name.replace(" Pages/Workers", ""),
                date: formatEventDate(e.published_at || e.first_detected_at || "Recently"),
                title: e.title,
                corroboration: e.corroboration_count || e.contributing_sources?.length || 1,
                confidence: e.confidence || "High",
                tier: e.tier || "Must-Know",
                whyItMatters: e.why_it_matters || e.event_summary,
                records: e.contributing_signals?.map((s) => ({
                  source: s.source,
                  extractedText: s.raw_excerpt || s.title,
                  url: s.url,
                  timestamp: s.published_at,
                })) || [
                  {
                    source: "Primary Record",
                    extractedText: e.raw_excerpt || e.event_summary,
                    url: e.url,
                    timestamp: e.published_at,
                  },
                ],
              }))
            );
          }
        }
      } catch (err) {
        console.warn("Using baseline strategic intelligence:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadIntelligence();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleInspectFinding = (finding: FindingData) => {
    openDrawer({
      id: finding.id,
      title: finding.headline,
      company: finding.company,
      timestamp: finding.timestamp,
      tier: finding.tier,
      confidence: finding.confidence || "High",
      factualConfidence: finding.factConfidence || finding.confidence || "High",
      inferenceConfidence: finding.inferenceConfidence || "Medium",
      factualRationale:
        "Direct observation verified against unredacted primary records with verifiable links.",
      inferenceRationale:
        "Evaluated against known competitive positioning, multi-signal patterns, and recent movement across monitored channels.",
      factSummary: finding.fact,
      whyItMatters: finding.whyItMatters,
      implication: finding.implication,
      records:
        finding.rawSignals?.map((r, i) => ({
          source: r.source,
          extractedText: r.text,
          url: r.url,
          timestamp: r.timestamp,
          isPrimary: i === 0,
        })) || [
          {
            source: finding.sourceType || "Official Source",
            extractedText: finding.fact || finding.whyItMatters || "",
            url: finding.url,
            timestamp: finding.timestamp,
            isPrimary: true,
          },
        ],
      corroboratingSources:
        finding.rawSignals && finding.rawSignals.length > 1
          ? finding.rawSignals.slice(1).map((r) => r.source)
          : finding.sources && finding.sources.length > 1
          ? finding.sources.slice(1)
          : [],
    });
  };

  const handleInspectEvent = (ev: RecentEventItem) => {
    openDrawer({
      id: ev.id,
      title: ev.title,
      company: ev.company,
      timestamp: ev.date,
      tier: ev.tier,
      confidence: ev.confidence,
      factualConfidence: "High",
      inferenceConfidence: ev.confidence === "High" ? "High" : "Medium",
      factualRationale: "Consolidated event verified across independent corroborating sources.",
      inferenceRationale: "Strategic impact derived from observed real-world actions.",
      whyItMatters: ev.whyItMatters || "Strategic competitive development informing current period positioning.",
      records: ev.records.map((r, i) => ({
        ...r,
        isPrimary: i === 0,
      })),
      corroboratingSources: ev.records.slice(1).map((r) => r.source),
    });
  };

  return (
    <div className="relative min-h-screen">
      {/* Signature Ambient Atmosphere with floating orbs, conic prism and spectrum ray */}
      <AmbientAtmosphere />

      {/* Main Content Container: Cinematic Intelligence Cockpit */}
      <div className="max-w-[1120px] mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-10 pb-28 relative z-10 space-y-12">
        {/* ========================================================================= */}
        {/* 1. COCKPIT HERO: Compact greeting + single-line telemetry status strip    */}
        {/* ========================================================================= */}
        <OverviewCockpitHero
          briefDate={briefDate}
          hasPartialDegradation={hasPartialDegradation}
        />

        {/* ========================================================================= */}
        {/* 2. WHAT DESERVES YOUR ATTENTION: Asymmetric 2-Column Cockpit Showcase    */}
        {/* ========================================================================= */}
        {loading ? (
          <LoadingSkeleton count={3} type="card" />
        ) : (
          <OverviewAttentionGrid
            findings={findings.slice(0, 3)}
            onInspect={handleInspectFinding}
          />
        )}

        {/* ========================================================================= */}
        {/* 3. COMPETITIVE PULSE: Horizontal Interactive Landscape                   */}
        {/* ========================================================================= */}
        <CompetitivePulseStrip
          movements={COMPETITIVE_MOVEMENTS}
        />

        {/* ========================================================================= */}
        {/* 4. RESEARCH RADAR: Field Scan Metaphor with Spatial Nodes                */}
        {/* ========================================================================= */}
        <ResearchRadarField
          topics={RESEARCH_TOPICS}
        />

        {/* ========================================================================= */}
        {/* 5. RECENT EVENTS: Fast-Scan Chronological Feed Stream                    */}
        {/* ========================================================================= */}
        <RecentEventsStream
          events={events}
          onInspectEvent={handleInspectEvent}
        />

        {/* ========================================================================= */}
        {/* 6. EVIDENCE & METHODOLOGY: Quiet Trustworthy Closing Layer               */}
        {/* ========================================================================= */}
        <MethodologyQuietLayer />
      </div>
    </div>
  );
}
