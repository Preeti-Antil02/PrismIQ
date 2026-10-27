import type {
  SignalRecord,
  ConsolidatedEventRecord,
  TrackedCompany,
  FindingRecord,
  TrendRecord,
  ResearchTopic,
  BriefDetail,
  BriefEntry,
  WorkspaceConfig,
  WorkspaceSettings,
  RadarEvaluation,
} from "./api";
import {
  BASELINE_TRACKED_COMPANIES,
  BASELINE_SIGNALS,
  BASELINE_EVENTS,
  BASELINE_FINDINGS,
  BASELINE_TRENDS,
  BASELINE_TOPICS,
  BASELINE_RADAR_EVALUATIONS,
  BASELINE_WORKSPACE_SETTINGS,
  BASELINE_WORKSPACE_CONFIG,
  BASELINE_LATEST_BRIEF,
  BASELINE_BRIEFS,
} from "./baselineData";

import vercelRaw from "./baseline_vercel.json";
import openaiRaw from "./baseline_openai.json";

export interface TenantBaselineData {
  tenantId: string;
  targetCompany: string;
  competitors: string[];
  trackedCompanies: TrackedCompany[];
  workspaceConfig: WorkspaceConfig;
  signals: SignalRecord[];
  events: ConsolidatedEventRecord[];
  findings: FindingRecord[];
  trends: TrendRecord[];
  topics: ResearchTopic[];
  radarEvaluations: RadarEvaluation[];
  workspaceSettings: WorkspaceSettings;
  latestBrief: BriefDetail;
  briefs: BriefEntry[];
}

export const KNOWN_TENANT_IDS = {
  MEESHO: "8553449a-c998-4727-be01-9aeb724038cb",
  VERCEL: "c8f13b91-46ef-4682-9975-f85764d8a12e",
  FLIPKART: "7b90477d-2524-4cf9-8e47-f389ec890ff7",
  OPENAI: "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f",
} as const;

// ============================================================================
// 1. VERCEL BASELINE DATA
// ============================================================================
const VERCEL_TRACKED_COMPANIES: TrackedCompany[] = [
  {
    company_name: "Vercel",
    is_target: true,
    status: "active",
    added_at: "2026-08-20T00:00:00+00:00",
    primary_domain: "vercel.com",
    industry_category: "Frontend Cloud & DX",
    tier: "core",
    confidence: "High",
    rationale: "Primary subject entity for frontend deployment and serverless edge compute benchmarking.",
  },
  {
    company_name: "Cloudflare Pages",
    is_target: false,
    status: "active",
    added_at: "2026-08-20T00:00:00+00:00",
    primary_domain: "pages.cloudflare.com",
    industry_category: "Jamstack & Edge Deployment",
    tier: "core",
    confidence: "High",
    rationale: "Direct competitor offering zero-latency edge static hosting and serverless functions integration.",
  },
  {
    company_name: "Cloudflare Workers",
    is_target: false,
    status: "active",
    added_at: "2026-08-20T00:00:00+00:00",
    primary_domain: "workers.cloudflare.com",
    industry_category: "Serverless Edge Compute",
    tier: "core",
    confidence: "High",
    rationale: "V8 isolate serverless platform competing with Vercel Edge Middleware and Edge Functions.",
  },
  {
    company_name: "Netlify",
    is_target: false,
    status: "active",
    added_at: "2026-08-20T00:00:00+00:00",
    primary_domain: "netlify.com",
    industry_category: "Web Development & Hosting",
    tier: "core",
    confidence: "High",
    rationale: "Direct web architecture rival offering composable web platform and frontend developer cloud.",
  },
  {
    company_name: "Stripe",
    is_target: false,
    status: "active",
    added_at: "2026-08-20T00:00:00+00:00",
    primary_domain: "stripe.com",
    industry_category: "Developer Infrastructure & Payments",
    tier: "peripheral",
    confidence: "Medium",
    rationale: "Key ecosystem developer partner and headless commerce integration surface.",
  },
];

const VERCEL_TOPICS: ResearchTopic[] = [
  {
    id: "topic_vercel_1",
    topic_label: "Frontend Cloud & Developer Experience",
    keywords: ["Next.js", "v0", "deploy previews", "server actions", "turbopack", "edge middleware"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_vercel_2",
    topic_label: "Edge Compute & Serverless Runtimes",
    keywords: ["Cloudflare Workers", "V8 isolates", "cold starts", "streaming SSR", "edge latency"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_vercel_3",
    topic_label: "Web Performance & Core Web Vitals",
    keywords: ["INP", "LCP", "Real User Monitoring", "speed insights", "cache optimization"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_vercel_4",
    topic_label: "Infrastructure Pricing & Bandwidth Economics",
    keywords: ["bandwidth pricing", "serverless pricing tiers", "egress fees", "enterprise SLA"],
    source: "Competitive Monitoring",
    is_active: true,
  },
];

const VERCEL_FINDINGS: FindingRecord[] = [
  {
    id: "find_v1",
    event_id: "evt_v1",
    company_name: "Netlify",
    tier: "core",
    confidence: "High",
    why_it_matters: "Netlify restructured developer pricing tiers with bundled serverless compute to attract high-traffic Next.js apps.",
    created_at: "2026-09-08T09:56:02+00:00",
  },
  {
    id: "find_v2",
    event_id: "evt_v2",
    company_name: "Cloudflare Pages/Workers",
    tier: "core",
    confidence: "High",
    why_it_matters: "Cloudflare deployed new cache storage optimizations using Zstandard and Pingora, reducing cache miss latency across edge nodes.",
    created_at: "2026-09-08T02:56:29+00:00",
  },
  {
    id: "find_v3",
    event_id: "evt_v3",
    company_name: "Vercel",
    tier: "core",
    confidence: "High",
    why_it_matters: "Vercel rolled out v0 Enterprise with team collaboration, fine-grained design systems, and direct repository sync.",
    created_at: "2026-09-08T10:45:00+00:00",
  },
  {
    id: "find_v4",
    event_id: "evt_v4",
    company_name: "Stripe",
    tier: "peripheral",
    confidence: "Medium",
    why_it_matters: "Stripe launched enhanced developer tools for embedded merchant checkout, boosting headless commerce integration options.",
    created_at: "2026-09-08T02:44:10+00:00",
  },
];

const VERCEL_TRENDS: TrendRecord[] = [
  {
    cluster_id: "trend_v1",
    trend_name: "Edge Runtime Convergence & Fast Deployment",
    representative_title: "Cloudflare Workers & Vercel Edge Runtime benchmark race intensifies",
    cluster_type: "cross_company_trend",
    primary_category: "Product & Platform Development",
    momentum: { label: "surging", vector: [1, 0.85, 0.92] },
    distinct_story_count: 14,
    raw_event_count: 38,
    companies_involved: ["Vercel", "Cloudflare Pages/Workers", "Netlify"],
    relevance_score: 0.94,
    matched_tracked_companies: ["Vercel", "Cloudflare Pages", "Cloudflare Workers", "Netlify"],
  },
  {
    cluster_id: "trend_v2",
    trend_name: "Generative UI & AI-Assisted Frontend Development",
    representative_title: "AI-assisted interface generation enters production workflows",
    cluster_type: "cross_company_trend",
    primary_category: "Product & Platform Development",
    momentum: { label: "building", vector: [0.75, 0.8, 0.88] },
    distinct_story_count: 9,
    raw_event_count: 24,
    companies_involved: ["Vercel", "Netlify"],
    relevance_score: 0.89,
    matched_tracked_companies: ["Vercel", "Netlify"],
  },
  {
    cluster_id: "trend_v3",
    trend_name: "Serverless Pricing Realignment & Bandwidth Caps",
    representative_title: "Hosting platforms update bandwidth and serverless function cost structures",
    cluster_type: "cross_company_trend",
    primary_category: "Pricing & Packaging",
    momentum: { label: "stable", vector: [0.6, 0.65, 0.7] },
    distinct_story_count: 6,
    raw_event_count: 15,
    companies_involved: ["Netlify", "Vercel", "Cloudflare Pages/Workers"],
    relevance_score: 0.81,
    matched_tracked_companies: ["Netlify", "Vercel", "Cloudflare Pages"],
  },
];

// ============================================================================
// 2. OPENAI BASELINE DATA
// ============================================================================
const OPENAI_TRACKED_COMPANIES: TrackedCompany[] = [
  {
    company_name: "OpenAI",
    is_target: true,
    status: "active",
    added_at: "2026-09-01T00:00:00+00:00",
    primary_domain: "openai.com",
    industry_category: "Frontier AI & LLMs",
    tier: "core",
    confidence: "High",
    rationale: "Primary subject entity for frontier foundational models and AI reasoning benchmarking.",
  },
  {
    company_name: "Anthropic",
    is_target: false,
    status: "active",
    added_at: "2026-09-01T00:00:00+00:00",
    primary_domain: "anthropic.com",
    industry_category: "Frontier AI & Safety Research",
    tier: "core",
    confidence: "High",
    rationale: "Direct frontier competitor with Claude 3.5 Sonnet leading in coding benchmarks and constitutional AI.",
  },
  {
    company_name: "Google",
    is_target: false,
    status: "active",
    added_at: "2026-09-01T00:00:00+00:00",
    primary_domain: "google.com",
    industry_category: "Multimodal AI & Search Infrastructure",
    tier: "core",
    confidence: "High",
    rationale: "Full-stack AI rival with Gemini 1.5 Pro long-context windows and massive TPUs infrastructure.",
  },
  {
    company_name: "Mistral AI",
    is_target: false,
    status: "active",
    added_at: "2026-09-01T00:00:00+00:00",
    primary_domain: "mistral.ai",
    industry_category: "Open & Efficient Frontier Models",
    tier: "core",
    confidence: "High",
    rationale: "European AI leader producing highly efficient open-weight and commercial enterprise models.",
  },
  {
    company_name: "SpaceXAI",
    is_target: false,
    status: "active",
    added_at: "2026-09-01T00:00:00+00:00",
    primary_domain: "x.ai",
    industry_category: "AI Compute & Infrastructure",
    tier: "peripheral",
    confidence: "Medium",
    rationale: "Grok development backed by Colossus cluster compute capabilities.",
  },
];

const OPENAI_TOPICS: ResearchTopic[] = [
  {
    id: "topic_oai_1",
    topic_label: "Frontier LLM Architectures & Reasoning",
    keywords: ["o1", "o3", "test-time compute", "Chain-of-Thought", "Strawberry", "RLVR"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_oai_2",
    topic_label: "Autonomous Agentic Tool Use & Benchmarks",
    keywords: ["function calling", "tool use", "computer use", "SWE-bench", "agentic workflows"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_oai_3",
    topic_label: "Enterprise API Latency & Token Economics",
    keywords: ["prompt caching", "batch API", "model distillation", "token pricing", "fine-tuning"],
    source: "Competitive Monitoring",
    is_active: true,
  },
  {
    id: "topic_oai_4",
    topic_label: "Multimodal Vision & Realtime Voice",
    keywords: ["Realtime API", "voice mode", "omni vision", "speech-to-speech", "multimodal reasoning"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
];

const OPENAI_FINDINGS: FindingRecord[] = [
  {
    id: "find_o1",
    event_id: "evt_o1",
    company_name: "Anthropic",
    tier: "core",
    confidence: "High",
    why_it_matters: "Anthropic achieved top SWE-bench scores with Claude 3.5 Sonnet, demonstrating superior agentic programming performance.",
    created_at: "2026-09-20T01:11:08+00:00",
  },
  {
    id: "find_o2",
    event_id: "evt_o2",
    company_name: "Google",
    tier: "core",
    confidence: "High",
    why_it_matters: "Google expanded Gemini 1.5 Flash 2.0 with reduced latency and competitive pricing for high-throughput enterprise pipelines.",
    created_at: "2026-09-22T03:18:46+00:00",
  },
  {
    id: "find_o3",
    event_id: "evt_o3",
    company_name: "OpenAI",
    tier: "core",
    confidence: "High",
    why_it_matters: "OpenAI expanded access to the o1 series reasoning models, demonstrating major gains in competitive mathematics and science benchmarks.",
    created_at: "2026-09-20T01:09:55+00:00",
  },
];

const OPENAI_TRENDS: TrendRecord[] = [
  {
    cluster_id: "trend_o1",
    trend_name: "Reasoning Models & Test-Time Compute Scaling",
    representative_title: "Inference-time search and verification emerge as the next frontier for LLM performance",
    cluster_type: "cross_company_trend",
    primary_category: "Product & Platform Development",
    momentum: { label: "surging", vector: [1, 0.95, 0.98] },
    distinct_story_count: 22,
    raw_event_count: 56,
    companies_involved: ["OpenAI", "Anthropic", "Google"],
    relevance_score: 0.98,
    matched_tracked_companies: ["OpenAI", "Anthropic", "Google"],
  },
  {
    cluster_id: "trend_o2",
    trend_name: "Agentic Tool-Use Protocols & Autonomous Execution",
    representative_title: "AI developers standardize tool-calling schemas and computer-use abstractions",
    cluster_type: "cross_company_trend",
    primary_category: "Product & Platform Development",
    momentum: { label: "building", vector: [0.85, 0.9, 0.92] },
    distinct_story_count: 15,
    raw_event_count: 34,
    companies_involved: ["Anthropic", "OpenAI", "Google"],
    relevance_score: 0.92,
    matched_tracked_companies: ["Anthropic", "OpenAI"],
  },
  {
    cluster_id: "trend_o3",
    trend_name: "Enterprise Model Distillation & Token Cost Deflation",
    representative_title: "API pricing drops across frontier providers via prompt caching and specialized small models",
    cluster_type: "cross_company_trend",
    primary_category: "Pricing & Packaging",
    momentum: { label: "stable", vector: [0.7, 0.72, 0.78] },
    distinct_story_count: 11,
    raw_event_count: 26,
    companies_involved: ["Google", "OpenAI", "Mistral AI"],
    relevance_score: 0.86,
    matched_tracked_companies: ["Google", "OpenAI", "Mistral AI"],
  },
];

// ============================================================================
// 3. FLIPKART BASELINE DATA
// ============================================================================
const FLIPKART_TRACKED_COMPANIES: TrackedCompany[] = [
  {
    company_name: "Flipkart",
    is_target: true,
    status: "active",
    added_at: "2026-09-18T00:00:00+00:00",
    primary_domain: "flipkart.com",
    industry_category: "E-Commerce Marketplace",
    tier: "core",
    confidence: "High",
    rationale: "Primary subject entity for Indian retail marketplace and logistics network intelligence.",
  },
  {
    company_name: "Amazon India",
    is_target: false,
    status: "active",
    added_at: "2026-09-18T00:00:00+00:00",
    primary_domain: "amazon.in",
    industry_category: "E-Commerce Marketplace",
    tier: "core",
    confidence: "High",
    rationale: "Leading e-commerce competitor with nationwide fulfilment, Prime ecosystem, and Great Indian Festival sale.",
  },
  {
    company_name: "Meesho",
    is_target: false,
    status: "active",
    added_at: "2026-09-18T00:00:00+00:00",
    primary_domain: "meesho.com",
    industry_category: "Social Commerce / Value Retail",
    tier: "core",
    confidence: "High",
    rationale: "Direct rival in Tier-2/3 cities leveraging a 0% commission model to recruit millions of budget sellers.",
  },
  {
    company_name: "Myntra",
    is_target: false,
    status: "active",
    added_at: "2026-09-18T00:00:00+00:00",
    primary_domain: "myntra.com",
    industry_category: "Fashion E-Commerce",
    tier: "core",
    confidence: "High",
    rationale: "Lifestyle and fashion division leading apparel digital shopping initiatives and creator storefronts.",
  },
  {
    company_name: "Ajio",
    is_target: false,
    status: "active",
    added_at: "2026-09-18T00:00:00+00:00",
    primary_domain: "ajio.com",
    industry_category: "Fashion E-Commerce",
    tier: "core",
    confidence: "High",
    rationale: "Reliance Retail digital fashion storefront competing directly on budget clothing and festive deals.",
  },
  {
    company_name: "Shopsy",
    is_target: false,
    status: "active",
    added_at: "2026-09-18T00:00:00+00:00",
    primary_domain: "shopsy.in",
    industry_category: "Budget Social Commerce",
    tier: "peripheral",
    confidence: "High",
    rationale: "Dedicated social commerce app countering Meesho across Tier-2, 3, and 4 shopping communities.",
  },
];

const FLIPKART_TOPICS: ResearchTopic[] = [
  {
    id: "topic_fk_1",
    topic_label: "Festive Sales Dynamics & Big Billion Days",
    keywords: ["Big Billion Days", "Great Indian Festival", "electronics discounts", "bank offers", "festive GMV"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_fk_2",
    topic_label: "Quick Commerce & Hyperlocal Fulfillment",
    keywords: ["Flipkart Minutes", "Blinkit", "Zepto", "Instamart", "15-minute delivery", "dark stores"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_fk_3",
    topic_label: "Seller Acquisition & Commission Structures",
    keywords: ["zero-commission", "active sellers", "seller onboarding", "catalog tools", "Tier-2 sellers"],
    source: "Core Strategic Priorities",
    is_active: true,
  },
  {
    id: "topic_fk_4",
    topic_label: "Apparel & Lifestyle Market Share Competition",
    keywords: ["Myntra", "Ajio", "festive fashion", "budget apparel", "brand ambassadors"],
    source: "Competitive Monitoring",
    is_active: true,
  },
];

// ============================================================================
// MULTI-TENANT BASELINE RESOLVER
// ============================================================================

export function getTenantBaselineData(
  tenantId?: string,
  targetCompanyName?: string
): TenantBaselineData {
  let tid = (tenantId || "").trim();

  // Browser-environment resolution: read stored tenant ID if not passed
  if (!tid && typeof window !== "undefined") {
    tid = localStorage.getItem("prismiq_active_tenant_id") || KNOWN_TENANT_IDS.MEESHO;
  }
  if (!tid) {
    tid = KNOWN_TENANT_IDS.MEESHO;
  }

  // 1. VERCEL
  if (
    tid === KNOWN_TENANT_IDS.VERCEL ||
    targetCompanyName?.toLowerCase() === "vercel"
  ) {
    const signals: SignalRecord[] = (vercelRaw.signals as unknown) as SignalRecord[];
    const events: ConsolidatedEventRecord[] = (vercelRaw.events as unknown) as ConsolidatedEventRecord[];
    const latestBrief: BriefDetail = {
      id: "brief_vercel_latest",
      date: "2026-09-08T10:45:00+00:00",
      filename: "brief_vercel.md",
      content: vercelRaw.brief,
    };
    const briefs: BriefEntry[] = [
      {
        id: "brief_vercel_latest",
        date: "2026-09-08T10:45:00+00:00",
        title: "PrismIQ Competitive Intelligence Brief: Vercel",
        filename: "brief_vercel.md",
        preview: "Strategic Takeaway: High-priority competitive movements were identified across Vercel, Netlify, Cloudflare.",
      },
    ];

    const workspaceConfig: WorkspaceConfig = {
      tenant_id: KNOWN_TENANT_IDS.VERCEL,
      target_company: "Vercel",
      competitors: ["Cloudflare Pages", "Cloudflare Workers", "Netlify", "Stripe"],
      tracked_companies: VERCEL_TRACKED_COMPANIES,
      topics: VERCEL_TOPICS.map((t) => ({
        id: t.id,
        topic_label: t.topic_label,
        keywords: t.keywords,
        source: t.source,
        is_active: t.is_active,
      })),
      has_target: true,
      has_competitors: true,
      has_preferences: true,
      is_configured: true,
      onboarding_complete: true,
    };

    const workspaceSettings: WorkspaceSettings = {
      tenant_id: KNOWN_TENANT_IDS.VERCEL,
      workspace_name: "Vercel Intelligence",
      owner_email: "c8f13b91@prismiq.ai",
      auth_role: "authenticated",
      rls_enforcement: "Active (PostgreSQL Row Level Security)",
      tracked_companies_count: VERCEL_TRACKED_COMPANIES.length,
      active_topics_count: VERCEL_TOPICS.length,
      paused_topics_count: 0,
      total_signals_evaluated: signals.length,
      noise_suppressed_count: 18,
      cadence: "Daily (00:00 UTC)",
      schedule: "0 0 * * *",
      api_version: "2.0.0",
      api_status: "Operational",
    };

    return {
      tenantId: KNOWN_TENANT_IDS.VERCEL,
      targetCompany: "Vercel",
      competitors: ["Cloudflare Pages", "Cloudflare Workers", "Netlify", "Stripe"],
      trackedCompanies: VERCEL_TRACKED_COMPANIES,
      workspaceConfig,
      signals,
      events,
      findings: VERCEL_FINDINGS,
      trends: VERCEL_TRENDS,
      topics: VERCEL_TOPICS,
      radarEvaluations: [],
      workspaceSettings,
      latestBrief,
      briefs,
    };
  }

  // 2. OPENAI
  if (
    tid === KNOWN_TENANT_IDS.OPENAI ||
    targetCompanyName?.toLowerCase() === "openai"
  ) {
    const signals: SignalRecord[] = (openaiRaw.signals as unknown) as SignalRecord[];
    const events: ConsolidatedEventRecord[] = (openaiRaw.events as unknown) as ConsolidatedEventRecord[];
    const latestBrief: BriefDetail = {
      id: "brief_openai_latest",
      date: "2026-09-22T04:00:00+00:00",
      filename: "brief_openai.md",
      content: openaiRaw.brief,
    };
    const briefs: BriefEntry[] = [
      {
        id: "brief_openai_latest",
        date: "2026-09-22T04:00:00+00:00",
        title: "PrismIQ Competitive Intelligence Brief: OpenAI",
        filename: "brief_openai.md",
        preview: "Pipeline Execution & Data Coverage: Frontier LLM shifts and multi-turn reasoning dynamics.",
      },
    ];

    const workspaceConfig: WorkspaceConfig = {
      tenant_id: KNOWN_TENANT_IDS.OPENAI,
      target_company: "OpenAI",
      competitors: ["Anthropic", "Google", "Mistral AI", "SpaceXAI"],
      tracked_companies: OPENAI_TRACKED_COMPANIES,
      topics: OPENAI_TOPICS.map((t) => ({
        id: t.id,
        topic_label: t.topic_label,
        keywords: t.keywords,
        source: t.source,
        is_active: t.is_active,
      })),
      has_target: true,
      has_competitors: true,
      has_preferences: true,
      is_configured: true,
      onboarding_complete: true,
    };

    const workspaceSettings: WorkspaceSettings = {
      tenant_id: KNOWN_TENANT_IDS.OPENAI,
      workspace_name: "OpenAI Intelligence",
      owner_email: "6a4703ac@prismiq.ai",
      auth_role: "authenticated",
      rls_enforcement: "Active (PostgreSQL Row Level Security)",
      tracked_companies_count: OPENAI_TRACKED_COMPANIES.length,
      active_topics_count: OPENAI_TOPICS.length,
      paused_topics_count: 0,
      total_signals_evaluated: signals.length,
      noise_suppressed_count: 22,
      cadence: "Daily (00:00 UTC)",
      schedule: "0 0 * * *",
      api_version: "2.0.0",
      api_status: "Operational",
    };

    return {
      tenantId: KNOWN_TENANT_IDS.OPENAI,
      targetCompany: "OpenAI",
      competitors: ["Anthropic", "Google", "Mistral AI", "SpaceXAI"],
      trackedCompanies: OPENAI_TRACKED_COMPANIES,
      workspaceConfig,
      signals,
      events,
      findings: OPENAI_FINDINGS,
      trends: OPENAI_TRENDS,
      topics: OPENAI_TOPICS,
      radarEvaluations: [],
      workspaceSettings,
      latestBrief,
      briefs,
    };
  }

  // 3. FLIPKART
  if (
    tid === KNOWN_TENANT_IDS.FLIPKART ||
    targetCompanyName?.toLowerCase() === "flipkart"
  ) {
    const fkTrackedLower = new Set(FLIPKART_TRACKED_COMPANIES.map((c) => c.company_name.toLowerCase()));
    const signals = BASELINE_SIGNALS.filter((s) => fkTrackedLower.has((s.company_name || "").toLowerCase()));
    const events = BASELINE_EVENTS.filter((e) => fkTrackedLower.has((e.company_name || (e as any).company || "").toLowerCase()));
    const findings = BASELINE_FINDINGS.filter((f) => fkTrackedLower.has((f.company_name || "").toLowerCase()));

    const workspaceConfig: WorkspaceConfig = {
      tenant_id: KNOWN_TENANT_IDS.FLIPKART,
      target_company: "Flipkart",
      competitors: ["Amazon India", "Meesho", "Myntra", "Ajio", "Shopsy"],
      tracked_companies: FLIPKART_TRACKED_COMPANIES,
      topics: FLIPKART_TOPICS.map((t) => ({
        id: t.id,
        topic_label: t.topic_label,
        keywords: t.keywords,
        source: t.source,
        is_active: t.is_active,
      })),
      has_target: true,
      has_competitors: true,
      has_preferences: true,
      is_configured: true,
      onboarding_complete: true,
    };

    const workspaceSettings: WorkspaceSettings = {
      tenant_id: KNOWN_TENANT_IDS.FLIPKART,
      workspace_name: "Flipkart Workspace",
      owner_email: "7b90477d@prismiq.ai",
      auth_role: "authenticated",
      rls_enforcement: "Active (PostgreSQL Row Level Security)",
      tracked_companies_count: FLIPKART_TRACKED_COMPANIES.length,
      active_topics_count: FLIPKART_TOPICS.length,
      paused_topics_count: 0,
      total_signals_evaluated: signals.length,
      noise_suppressed_count: 14,
      cadence: "Daily (00:00 UTC)",
      schedule: "0 0 * * *",
      api_version: "2.0.0",
      api_status: "Operational",
    };

    const latestBrief: BriefDetail = {
      ...BASELINE_LATEST_BRIEF,
      id: "brief_flipkart_latest",
      filename: "brief_flipkart.md",
    };

    const briefs: BriefEntry[] = [
      {
        id: "brief_flipkart_latest",
        date: "2026-10-05T03:21:07.520132+00:00",
        title: "PrismIQ Competitive Intelligence Brief: Flipkart",
        filename: "brief_flipkart.md",
        preview: "Executive Summary: Flipkart doubles active seller base in 15 months amidst aggressive festival sale season.",
      },
    ];

    return {
      tenantId: KNOWN_TENANT_IDS.FLIPKART,
      targetCompany: "Flipkart",
      competitors: ["Amazon India", "Meesho", "Myntra", "Ajio", "Shopsy"],
      trackedCompanies: FLIPKART_TRACKED_COMPANIES,
      workspaceConfig,
      signals,
      events,
      findings,
      trends: BASELINE_TRENDS,
      topics: FLIPKART_TOPICS,
      radarEvaluations: BASELINE_RADAR_EVALUATIONS as unknown as RadarEvaluation[],
      workspaceSettings,
      latestBrief,
      briefs,
    };
  }

  // 4. CUSTOM DYNAMIC WORKSPACE (Check targetCompanyName or localStorage)
  const isKnownTenant =
    tid === KNOWN_TENANT_IDS.MEESHO ||
    tid === KNOWN_TENANT_IDS.VERCEL ||
    tid === KNOWN_TENANT_IDS.FLIPKART ||
    tid === KNOWN_TENANT_IDS.OPENAI;

  if (!isKnownTenant && (targetCompanyName || typeof window !== "undefined")) {
    let tgt = targetCompanyName;
    let customName = `${tgt || "Custom"} Workspace`;
    let customSector = "Enterprise Technology";

    if (typeof window !== "undefined") {
      try {
        const rawCustom = localStorage.getItem("prismiq_custom_workspaces");
        if (rawCustom) {
          const customList: Array<{ tenant_id: string; name: string; target: string; sector: string }> = JSON.parse(rawCustom);
          const match = customList.find((w) => w.tenant_id === tid);
          if (match) {
            tgt = match.target || tgt;
            customName = match.name || customName;
            customSector = match.sector || customSector;
          }
        }
      } catch {
        // ignore
      }
    }

    if (tgt && tgt.toLowerCase() !== "meesho") {
      const customTracked: TrackedCompany[] = [
        {
          company_name: tgt,
          is_target: true,
          status: "active",
          added_at: new Date().toISOString(),
          primary_domain: `${tgt.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          industry_category: customSector,
          tier: "core",
          confidence: "High",
          rationale: "Primary subject entity for newly configured custom workspace benchmarking.",
        },
      ];

      const customConfig: WorkspaceConfig = {
        tenant_id: tid || "custom-tenant",
        target_company: tgt,
        competitors: [],
        tracked_companies: customTracked,
        topics: [
          {
            id: `topic_${(tid || "custom").slice(0, 8)}_1`,
            topic_label: `${tgt} Market Position & Releases`,
            keywords: [tgt, "product launch", "pricing update", "partnerships"],
            source: "Custom Workspace Setup",
            is_active: true,
          },
        ],
        has_target: true,
        has_competitors: false,
        has_preferences: true,
        is_configured: true,
        onboarding_complete: true,
      };

      const customSettings: WorkspaceSettings = {
        tenant_id: tid || "custom-tenant",
        workspace_name: customName,
        owner_email: `${(tid || "admin").slice(0, 8)}@prismiq.ai`,
        auth_role: "authenticated",
        rls_enforcement: "Active (PostgreSQL Row Level Security)",
        tracked_companies_count: 1,
        active_topics_count: 1,
        paused_topics_count: 0,
        total_signals_evaluated: 0,
        noise_suppressed_count: 0,
        cadence: "Daily (00:00 UTC)",
        schedule: "0 0 * * *",
        api_version: "2.0.0",
        api_status: "Operational",
      };

      const customBrief: BriefDetail = {
        id: `brief_${(tid || "custom").slice(0, 8)}`,
        date: new Date().toISOString(),
        filename: `brief_${tgt.toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`,
        content: `# PrismIQ Competitive Intelligence Brief: ${tgt}\n\n## Pipeline Execution & Data Coverage\n\n- **Target Company**: ${tgt}\n- **Workspace Status**: Newly Onboarded Entity\n\n## Monitoring Scope\nAutonomous monitoring scheduled for next daily sweep. Tracked competitors and real-time signals will populate following the first pipeline cycle.`,
      };

      return {
        tenantId: tid || "custom-tenant",
        targetCompany: tgt,
        competitors: [],
        trackedCompanies: customTracked,
        workspaceConfig: customConfig,
        signals: [],
        events: [],
        findings: [],
        trends: [],
        topics: customConfig.topics as ResearchTopic[],
        radarEvaluations: [],
        workspaceSettings: customSettings,
        latestBrief: customBrief,
        briefs: [
          {
            id: customBrief.id,
            date: customBrief.date,
            title: `PrismIQ Competitive Intelligence Brief: ${tgt}`,
            filename: customBrief.filename,
            preview: `Newly onboarded workspace for ${tgt}. Scheduled for initial intelligence sweep.`,
          },
        ],
      };
    }
  }

  // 5. DEFAULT MEESHO BASELINE DATA
  return {
    tenantId: KNOWN_TENANT_IDS.MEESHO,
    targetCompany: "Meesho",
    competitors: ["Flipkart", "Amazon India", "Myntra", "Ajio", "Shopify", "Shopsy", "Snapdeal", "Temu"],
    trackedCompanies: BASELINE_TRACKED_COMPANIES,
    workspaceConfig: BASELINE_WORKSPACE_CONFIG,
    signals: BASELINE_SIGNALS,
    events: BASELINE_EVENTS,
    findings: BASELINE_FINDINGS,
    trends: BASELINE_TRENDS,
    topics: BASELINE_TOPICS,
    radarEvaluations: BASELINE_RADAR_EVALUATIONS as unknown as RadarEvaluation[],
    workspaceSettings: BASELINE_WORKSPACE_SETTINGS,
    latestBrief: BASELINE_LATEST_BRIEF,
    briefs: BASELINE_BRIEFS,
  };
}
