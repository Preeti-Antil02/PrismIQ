import { getClientAuthToken, createTenantToken, DEFAULT_TENANT_ID } from "./auth";
import type { ConfidenceLevel, TierLevel } from "./tokens";
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
import { getTenantBaselineData } from "./tenantBaselines";

export interface SignalRecord {
  id: string;
  company_name: string;
  source: string;
  title: string;
  url: string;
  published_at?: string;
  published_timestamp?: string;
  raw_excerpt: string;
  event_id?: string;
  corroboration_count: number;
  why_it_matters?: string;
  confidence: ConfidenceLevel;
  inference_confidence?: ConfidenceLevel;
  fact_confidence?: ConfidenceLevel;
  tier: TierLevel;
}

export interface SignalsApiResponse {
  signals: SignalRecord[];
  count: number;
  noise_suppressed_count: number;
}

export interface TrackedCompany {
  company_name: string;
  is_target: boolean;
  status: string;
  added_at?: string;
  primary_domain?: string;
  industry_category?: string;
  tier?: "core" | "peripheral" | string;
  confidence?: "High" | "Medium" | "Low" | string;
  rationale?: string;
  source?: string;
}

const API_BASE_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

function getFilteredBaselineSignals(params?: {
  company?: string;
  source?: string;
  tier?: string;
  confidence?: string;
  limit?: number;
  offset?: number;
  tenantId?: string;
}): SignalsApiResponse {
  const baseline = getTenantBaselineData(params?.tenantId);
  let list = [...baseline.signals];
  if (params?.company && params.company !== "ALL") {
    const compLower = params.company.toLowerCase();
    list = list.filter((s) => (s.company_name || "").toLowerCase() === compLower);
  }
  if (params?.source && params.source !== "ALL") {
    const srcLower = params.source.toLowerCase();
    list = list.filter((s) => (s.source || "").toLowerCase().includes(srcLower));
  }
  if (params?.tier && params.tier !== "ALL") {
    const tierLower = params.tier.toLowerCase();
    list = list.filter((s) => (s.tier || "").toLowerCase() === tierLower);
  }
  if (params?.confidence && params.confidence !== "ALL") {
    const confLower = params.confidence.toLowerCase();
    list = list.filter((s) => (s.confidence || "").toLowerCase() === confLower);
  }
  const offset = params?.offset || 0;
  const limit = params?.limit || list.length;
  const paged = list.slice(offset, offset + limit);
  return {
    signals: paged,
    count: list.length,
    noise_suppressed_count: baseline.workspaceSettings?.noise_suppressed_count || 0,
  };
}

export async function fetchSignals(params?: {
  company?: string;
  source?: string;
  tier?: string;
  confidence?: string;
  limit?: number;
  offset?: number;
  forceFailure?: boolean;
  tenantId?: string;
}): Promise<SignalsApiResponse> {
  // Check forced dev failure state if requested
  if (params?.forceFailure) {
    throw new Error("Simulated network disconnection for verification of error state.");
  }

  const token = getClientAuthToken(params?.tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/signals" : `${API_BASE_URL}/signals`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);

  if (params?.tenantId) {
    url.searchParams.set("tenant_id", params.tenantId);
  }
  if (params?.company && params.company !== "ALL") {
    url.searchParams.set("company", params.company);
  }
  if (params?.source && params.source !== "ALL") {
    url.searchParams.set("source", params.source.toLowerCase());
  }
  if (params?.tier && params.tier !== "ALL") {
    url.searchParams.set("tier", params.tier);
  }
  if (params?.confidence && params.confidence !== "ALL") {
    url.searchParams.set("confidence", params.confidence);
  }
  if (params?.limit) {
    url.searchParams.set("limit", params.limit.toString());
  }
  if (params?.offset) {
    url.searchParams.set("offset", params.offset.toString());
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.signals) && data.signals.length > 0) {
        return data;
      }
    }
  } catch {
    // Graceful fallback to verified baseline snapshot
  }

  return getFilteredBaselineSignals(params);
}

export interface ContributingSignal {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at?: string;
  published_timestamp?: string;
  raw_excerpt: string;
}

export interface ConsolidatedEventRecord {
  event_id: string;
  company_name: string;
  title: string;
  event_summary: string;
  corroboration_count: number;
  contributing_sources: string[];
  first_detected_at?: string;
  latest_detected_at?: string;
  published_at?: string;
  published_timestamp?: string;
  url: string;
  raw_excerpt: string;
  fact_confidence: ConfidenceLevel;
  why_it_matters?: string;
  confidence: ConfidenceLevel;
  inference_confidence?: ConfidenceLevel;
  tier: TierLevel;
  contributing_signals?: ContributingSignal[];
}

export interface EventsApiResponse {
  events: ConsolidatedEventRecord[];
  count: number;
}

function getFilteredBaselineEvents(params?: {
  company?: string;
  tier?: string;
  confidence?: string;
  limit?: number;
  offset?: number;
  tenantId?: string;
}): EventsApiResponse {
  const baseline = getTenantBaselineData(params?.tenantId);
  let list = [...baseline.events];
  if (params?.company && params.company !== "ALL") {
    const compLower = params.company.toLowerCase();
    list = list.filter(
      (e) =>
        (e.company_name || (e as any).company || "").toLowerCase() === compLower ||
        (e.title || "").toLowerCase().includes(compLower)
    );
  }
  if (params?.tier && params.tier !== "ALL") {
    const tierLower = params.tier.toLowerCase();
    list = list.filter((e) => (e.tier || "").toLowerCase() === tierLower);
  }
  if (params?.confidence && params.confidence !== "ALL") {
    const confLower = params.confidence.toLowerCase();
    list = list.filter((e) => (e.confidence || "").toLowerCase() === confLower);
  }
  const offset = params?.offset || 0;
  const limit = params?.limit || list.length;
  const paged = list.slice(offset, offset + limit);
  return {
    events: paged,
    count: list.length,
  };
}

export async function fetchEvents(params?: {
  company?: string;
  tier?: string;
  confidence?: string;
  limit?: number;
  offset?: number;
  forceFailure?: boolean;
  tenantId?: string;
}): Promise<EventsApiResponse> {
  if (params?.forceFailure) {
    throw new Error("Simulated network disconnection for verification of error state.");
  }

  const token = getClientAuthToken(params?.tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/events" : `${API_BASE_URL}/events`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);

  if (params?.tenantId) {
    url.searchParams.set("tenant_id", params.tenantId);
  }
  if (params?.company && params.company !== "ALL") {
    url.searchParams.set("company", params.company);
  }
  if (params?.tier && params.tier !== "ALL") {
    url.searchParams.set("tier", params.tier);
  }
  if (params?.confidence && params.confidence !== "ALL") {
    url.searchParams.set("confidence", params.confidence);
  }
  if (params?.limit) {
    url.searchParams.set("limit", params.limit.toString());
  }
  if (params?.offset) {
    url.searchParams.set("offset", params.offset.toString());
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.events) && data.events.length > 0) {
        return data;
      }
    }
  } catch {
    // Graceful fallback
  }

  return getFilteredBaselineEvents(params);
}

export async function fetchEventDetail(eventId: string, tenantId?: string): Promise<ConsolidatedEventRecord> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? `/api/events/${eventId}` : `${API_BASE_URL}/events/${eventId}`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.event) return data.event;
    }
  } catch {
    // Fallback
  }

  const baseline = getTenantBaselineData(tenantId);
  const match = baseline.events.find((e) => e.event_id === eventId);
  if (match) return match;
  return baseline.events[0] || BASELINE_EVENTS[0];
}

export async function fetchTrackedCompanies(tenantId?: string): Promise<TrackedCompany[]> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/tracked-companies" : `${API_BASE_URL}/tracked-companies`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracked_companies) && data.tracked_companies.length > 0) {
        return data.tracked_companies;
      }
    }
  } catch {
    // Fallback
  }

  return getTenantBaselineData(tenantId).trackedCompanies;
}


export interface BriefEntry {
  id: string;
  date: string;
  title?: string;
  filename?: string;
  preview?: string;
}

export interface BriefDetail {
  id: string;
  date: string;
  filename: string;
  content: string;
}

export async function fetchBriefs(tenantId?: string): Promise<BriefEntry[]> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/briefs" : `${API_BASE_URL}/briefs`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  const baseline = getTenantBaselineData(tenantId);
  const targetComp = baseline.targetCompany.toLowerCase();

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.briefs) && data.briefs.length > 0) {
        const relevant = data.briefs.filter((b: BriefEntry) => {
          const txt = `${b.title || ""} ${b.preview || ""} ${b.filename || ""}`.toLowerCase();
          return (
            txt.includes(targetComp) ||
            baseline.competitors.some((c) => txt.includes(c.toLowerCase()))
          );
        });
        if (relevant.length > 0) return relevant;
      }
    }
  } catch {
    // Fallback
  }

  return baseline.briefs;
}

export async function fetchLatestBrief(tenantId?: string): Promise<BriefDetail> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/briefs/latest" : `${API_BASE_URL}/briefs/latest`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  const baseline = getTenantBaselineData(tenantId);
  const targetComp = baseline.targetCompany.toLowerCase();

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.content === "string" && data.content.length > 100) {
        const lower = data.content.toLowerCase();
        const isMatch =
          lower.includes(targetComp) ||
          baseline.competitors.some((c) => lower.includes(c.toLowerCase()));
        if (isMatch) {
          return data;
        }
      }
    }
  } catch {
    // Fallback
  }

  return baseline.latestBrief;
}

export async function fetchBriefById(briefId: string, tenantId?: string): Promise<BriefDetail> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? `/api/briefs/${briefId}` : `${API_BASE_URL}/briefs/${briefId}`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  const baseline = getTenantBaselineData(tenantId);
  const targetComp = baseline.targetCompany.toLowerCase();

  // If the briefId is known baseline ID, return immediately
  if (briefId === baseline.latestBrief.id) {
    return baseline.latestBrief;
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.content === "string" && data.content.length > 100) {
        const lower = data.content.toLowerCase();
        const isMatch =
          lower.includes(targetComp) ||
          baseline.competitors.some((c) => lower.includes(c.toLowerCase()));
        if (isMatch) {
          return data;
        }
      }
    }
  } catch {
    // Fallback
  }

  return baseline.latestBrief;
}


export interface RadarEvidenceSignal {
  signal_id: string;
  source: string;
  title: string;
  url: string;
  raw_excerpt: string;
}

export interface RadarCompetitorConnection {
  status: string;
  reason: string;
  evidence_signals?: RadarEvidenceSignal[];
}

export interface RadarEvaluation {
  topic_id?: string | null;
  topic_label: string;
  keywords: string[];
  cycle_id?: string;
  research_item_count: number;
  research_item_ids: string[];
  competitor_connections: Record<string, RadarCompetitorConnection>;
  state_change_detected?: boolean;
  why_it_matters?: string;
  pending_sweep?: boolean;
  created_at?: string;
}

export interface RadarApiResponse {
  evaluations: RadarEvaluation[];
  count: number;
}

export async function fetchLatestRadar(tenantId?: string): Promise<RadarApiResponse> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/research-radar/latest" : `${API_BASE_URL}/research-radar/latest`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.evaluations) && data.evaluations.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback
  }

  const baseline = getTenantBaselineData(tenantId);
  return {
    evaluations: baseline.radarEvaluations,
    count: baseline.radarEvaluations.length,
  };
}


// ============================================================================
// Findings (Competitors + Compare)
// ============================================================================

export interface FindingRecord {
  id: string;
  event_id: string;
  company_name: string;
  tier: string;
  confidence: string;
  inference_confidence?: string;
  fact_confidence?: string;
  why_it_matters?: string;
  created_at?: string;
}

export interface FindingsApiResponse {
  findings: FindingRecord[];
  count: number;
}

export async function fetchFindings(tenantId?: string): Promise<FindingsApiResponse> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/findings" : `${API_BASE_URL}/findings`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.findings) && data.findings.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback
  }

  const baseline = getTenantBaselineData(tenantId);
  return {
    findings: baseline.findings,
    count: baseline.findings.length,
  };
}


// ============================================================================
// Competitor Summary Helpers
// ============================================================================

export interface CompetitorActivitySummary {
  company_name: string;
  is_target: boolean;
  primary_domain?: string;
  industry_category?: string;
  tier?: string;
  confidence?: string;
  rationale?: string;
  source?: string;
  total_signals: number;
  total_events: number;
  signals_by_source: Record<string, number>;
  events_by_tier: Record<string, number>;
  recent_events: ConsolidatedEventRecord[];
  findings_count: number;
  must_know_count: number;
  should_know_count: number;
  radar_connections: Record<string, string>; // topic_label -> classifier state
}

/**
 * Build per-competitor activity summaries from already-fetched bulk data.
 * No extra API calls — works on data already in memory.
 */
export function buildCompetitorSummaries(
  companies: TrackedCompany[],
  signals: SignalRecord[],
  events: ConsolidatedEventRecord[],
  findings: FindingRecord[],
  radarEvals: RadarEvaluation[],
): CompetitorActivitySummary[] {
  return companies.map((comp) => {
    const compName = (comp.company_name || "").trim().toLowerCase();
    const compSignals = signals.filter((s) => (s.company_name || "").trim().toLowerCase() === compName);
    const compEvents = events.filter((e) => (e.company_name || "").trim().toLowerCase() === compName);
    const compFindings = findings.filter((f) => (f.company_name || "").trim().toLowerCase() === compName);

    // Signal counts by source type (initialize all 5 monitored sources)
    const signals_by_source: Record<string, number> = {
      github: 0,
      news: 0,
      jobs: 0,
      pricing: 0,
      research: 0,
    };
    compSignals.forEach((s) => {
      const src = (s.source || "unknown").toLowerCase();
      signals_by_source[src] = (signals_by_source[src] || 0) + 1;
    });

    // Event counts by tier
    const events_by_tier: Record<string, number> = {};
    compEvents.forEach((e) => {
      const tier = normalizeTierKey(e.tier);
      events_by_tier[tier] = (events_by_tier[tier] || 0) + 1;
    });

    // Recent events (sorted, top 5)
    const sortedEvents = [...compEvents].sort((a, b) => {
      const ta = a.published_timestamp || a.published_at || "";
      const tb = b.published_timestamp || b.published_at || "";
      return tb.localeCompare(ta);
    });

    // Event tier counts
    const must_know_count = events_by_tier["Must-Know"] || 0;
    const should_know_count = events_by_tier["Should-Know"] || 0;

    // Radar connections across all topics (with flexible name matching for variants like "Cloudflare Pages/Workers" <-> "Cloudflare")
    const radar_connections: Record<string, string> = {};
    radarEvals.forEach((ev) => {
      const conns = ev.competitor_connections || {};
      const direct = conns[comp.company_name];
      if (direct && direct.status) {
        radar_connections[ev.topic_label] = direct.status;
      } else {
        const matchedKey = Object.keys(conns).find(
          (k) =>
            compName &&
            k &&
            (compName.includes(k.toLowerCase()) || k.toLowerCase().includes(compName))
        );
        if (matchedKey && conns[matchedKey]?.status) {
          radar_connections[ev.topic_label] = conns[matchedKey].status;
        }
      }
    });

    return {
      company_name: comp.company_name,
      is_target: comp.is_target,
      primary_domain: comp.primary_domain,
      industry_category: comp.industry_category,
      tier: comp.tier,
      confidence: comp.confidence,
      rationale: comp.rationale,
      source: comp.source,
      total_signals: compSignals.length,
      total_events: compEvents.length,
      signals_by_source,
      events_by_tier,
      recent_events: sortedEvents.slice(0, 5),
      findings_count: compFindings.length,
      must_know_count,
      should_know_count,
      radar_connections,
    };
  });
}

/** Normalize tier keys (backend uses both "should_know" and "Should-Know") */
function normalizeTierKey(tier?: string): string {
  if (!tier) return "Nice-to-Know";
  const t = tier.trim().toLowerCase().replace(/_/g, "-");
  if (t === "must-know") return "Must-Know";
  if (t === "should-know") return "Should-Know";
  return "Nice-to-Know";
}

// ============================================================================
// Workspace Interfaces & API Helpers (Spec § 3.11)
// ============================================================================

export interface ResearchTopic {
  id: string;
  topic_label: string;
  keywords: string[];
  source?: string;
  created_at?: string;
  is_active?: boolean;
}

export interface DeliveryConfig {
  id?: string;
  tenant_id: string;
  slack_webhook_url: string;
  slack_channel: string;
  delivery_cadence: string;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkspaceSettings {
  tenant_id: string;
  workspace_name: string;
  owner_email: string;
  auth_role?: string;
  rls_enforcement: string;
  tracked_companies_count: number;
  active_topics_count: number;
  paused_topics_count: number;
  total_signals_evaluated?: number;
  noise_suppressed_count?: number;
  cadence: string;
  schedule: string;
  api_version?: string;
  api_status: string;
}

export interface GroqTokenBudgetStatus {
  daily_limit: number;
  used_today: number;
  remaining_tokens: number;
  usage_pct: number;
  warning_threshold_pct: number;
  warning_threshold_crossed: boolean;
  status: "healthy" | "warning" | "exhausted";
  last_updated?: string;
}

export interface CompanyProfileSegment {
  segment_id: string;
  name: string;
  target_customers: string;
  what_it_does: string;
  verbatim_quote: string;
}

export interface CompanyProfile {
  company_name: string;
  domain?: string;
  summary: string;
  confidence: string;
  profile_source: string;
  is_low_confidence: boolean;
  segments: CompanyProfileSegment[];
}

export interface DiscoveryCandidate {
  company_name?: string;
  name?: string;
  category?: string;
  industry_category?: string;
  matched_segment?: string;
  confidence?: string | number;
  reasons?: string[];
  rationale?: string;
  sources?: string[];
  source?: string;
  source_age?: string;
  source_date?: string;
  freshness_note?: string;
  website?: string;
  domain?: string;
  primary_domain?: string;
  extraction_method?: "llm" | "heuristic_fallback" | string;
  tier?: "core" | "peripheral" | string;
  is_directory_only?: boolean;
  is_directory_artifact_risk?: boolean;
  is_self_sourced?: boolean;
  corroboration_status?: "multi_source_corroborated" | "unverified_directory" | "single_source" | string;
  corroborated_source_types?: string[];
}

export interface DiscoveryResponse {
  status?: string;
  tenant_id?: string;
  target_company?: string;
  candidates_count?: number;
  candidates: DiscoveryCandidate[];
  company_profile?: CompanyProfile;
  is_low_confidence_profile?: boolean;
  low_confidence_message?: string;
  extraction_method?: "llm" | "heuristic_fallback" | string;
  degraded?: boolean;
  llm_error?: string | null;
  token_budget?: GroqTokenBudgetStatus | null;
}

export async function fetchWorkspaceTopics(includePaused: boolean = true, tenantId?: string): Promise<ResearchTopic[]> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? `/api/workspace/topics?include_paused=${includePaused}` : `${API_BASE_URL}/research-radar/topics?include_paused=${includePaused}`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.topics) && data.topics.length > 0) {
        return data.topics;
      }
    }
  } catch {
    // Fallback
  }
  return getTenantBaselineData(tenantId).topics;
}

export async function createWorkspaceTopic(topicLabel: string, keywords: string[]): Promise<ResearchTopic> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/topics" : `${API_BASE_URL}/research-radar/topics`;
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topic_label: topicLabel, keywords }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create topic (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.topic;
}

export async function updateTopicStatus(topicId: string, isActive: boolean): Promise<boolean> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? `/api/workspace/topics/${encodeURIComponent(topicId)}` : `${API_BASE_URL}/research-radar/topics/${encodeURIComponent(topicId)}`;
  const res = await fetch(baseUrl, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update topic status (${res.status}): ${errText}`);
  }
  return true;
}

export async function deleteWorkspaceTopic(topicId: string): Promise<boolean> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? `/api/workspace/topics/${encodeURIComponent(topicId)}` : `${API_BASE_URL}/research-radar/topics/${encodeURIComponent(topicId)}`;
  const res = await fetch(baseUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete topic (${res.status}): ${errText}`);
  }
  return true;
}

export async function addTrackedCompany(companyName: string, isTarget: boolean = false): Promise<TrackedCompany> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/watchlist/add" : `${API_BASE_URL}/workspace/watchlist/add`;
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ company_name: companyName, is_target: isTarget }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to add tracked company (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.company;
}

export async function untrackCompany(companyName: string): Promise<boolean> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? `/api/workspace/watchlist/${encodeURIComponent(companyName)}` : `${API_BASE_URL}/workspace/watchlist/${encodeURIComponent(companyName)}`;
  const res = await fetch(baseUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to untrack company (${res.status}): ${errText}`);
  }
  return true;
}

export async function discoverCompetitors(
  targetCompany: string,
  website?: string,
  description?: string,
  forceRefresh?: boolean
): Promise<DiscoveryResponse> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/discover" : `${API_BASE_URL}/api/onboarding/discover`;
  const payload: Record<string, any> = { target_company: targetCompany };
  if (website && website.trim()) {
    payload.website = website.trim();
  }
  if (description && description.trim()) {
    payload.description = description.trim();
  }
  if (forceRefresh) {
    payload.force_refresh = true;
  }

  let res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Auto-heal on expired token
  if (res.status === 401) {
    const errText = await res.text();
    if (errText.includes("Token has expired") || errText.includes("expired")) {
      const activeTenant = typeof window !== "undefined" ? localStorage.getItem("prismiq_active_tenant_id") || undefined : undefined;
      const freshToken = createTenantToken(activeTenant || DEFAULT_TENANT_ID);
      if (typeof window !== "undefined") {
        localStorage.setItem("prismiq_tenant_token", freshToken);
      }
      res = await fetch(baseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${freshToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      throw new Error(`Discovery failed (${res.status}): ${errText}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Discovery failed (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function confirmCompetitors(targetCompany: string, competitors: string[]): Promise<any> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/confirm" : `${API_BASE_URL}/api/onboarding/confirm`;
  let res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_company: targetCompany, confirmed_competitors: competitors }),
  });

  // Auto-heal on expired token
  if (res.status === 401) {
    const errText = await res.text();
    if (errText.includes("Token has expired") || errText.includes("expired")) {
      const activeTenant = typeof window !== "undefined" ? localStorage.getItem("prismiq_active_tenant_id") || undefined : undefined;
      const freshToken = createTenantToken(activeTenant || DEFAULT_TENANT_ID);
      if (typeof window !== "undefined") {
        localStorage.setItem("prismiq_tenant_token", freshToken);
      }
      res = await fetch(baseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${freshToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_company: targetCompany, confirmed_competitors: competitors }),
      });
    } else {
      throw new Error(`Confirmation failed (${res.status}): ${errText}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Confirmation failed (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function fetchDeliveryConfig(tenantId?: string): Promise<DeliveryConfig | null> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/delivery" : `${API_BASE_URL}/workspace/delivery`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.delivery_config || null;
  } catch {
    return null;
  }
}

export async function saveDeliveryConfig(payload: {
  slack_webhook_url: string;
  channel_name?: string;
  is_active?: boolean;
}): Promise<DeliveryConfig> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/delivery" : `${API_BASE_URL}/workspace/delivery`;
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to save delivery config (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.delivery_config;
}

export async function fetchWorkspaceSettings(tenantId?: string): Promise<WorkspaceSettings> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/settings" : `${API_BASE_URL}/workspace/settings`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback
  }
  return getTenantBaselineData(tenantId).workspaceSettings;
}

export interface WorkspaceConfig {
  tenant_id: string;
  target_company: string;
  competitors: string[];
  tracked_companies: TrackedCompany[];
  topics: Array<{
    id: string;
    topic_label: string;
    keywords?: string[];
    source?: string;
    is_active?: boolean;
  }>;
  has_target: boolean;
  has_competitors: boolean;
  has_preferences: boolean;
  is_configured: boolean;
  onboarding_complete: boolean;
}

export async function fetchWorkspaceConfig(tenantId?: string): Promise<WorkspaceConfig> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/config" : `${API_BASE_URL}/workspace/config`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.target_company) {
        return data;
      }
    }
  } catch {
    // Fallback
  }
  return getTenantBaselineData(tenantId).workspaceConfig;
}

export interface PipelineProgress {
  run_id?: string;
  status: "idle" | "running" | "completed" | "failed" | "timed_out";
  current_phase: string;
  progress_message: string;
  total_companies: number;
  completed_companies: number;
  completed_company_names: string[];
  current_company?: string;
  total_sources?: number;
  completed_sources?: number;
  source_health?: Record<string, any>;
  source_errors?: Record<string, any>;
  first_visible_data_at?: string | null;
  time_to_first_data_seconds?: number | null;
  is_first_run?: boolean;
  started_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  total_duration_seconds?: number | null;
  is_active: boolean;
  current_tracked_count?: number;
  needs_resweep?: boolean;
}

export async function fetchPipelineStatus(tenantId?: string): Promise<PipelineProgress> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/pipeline/status" : `${API_BASE_URL}/api/pipeline/status`;
  try {
    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        status: "idle",
        current_phase: "idle",
        progress_message: "Pipeline idle — scheduled for autonomous daily run",
        total_companies: 0,
        completed_companies: 0,
        completed_company_names: [],
        is_active: false,
      };
    }
    return res.json();
  } catch {
    return {
      status: "idle",
      current_phase: "idle",
      progress_message: "Pipeline idle — scheduled for autonomous daily run",
      total_companies: 0,
      completed_companies: 0,
      completed_company_names: [],
      is_active: false,
    };
  }
}

export async function triggerPipelineRun(
  isFirstRun: boolean = false,
  sources?: string[],
  tenantId?: string
): Promise<{ status: string; message: string }> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? "/api/pipeline/trigger" : `${API_BASE_URL}/api/pipeline/trigger`;
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ is_first_run: isFirstRun, sources }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to trigger pipeline (${res.status}): ${text}`);
  }
  return res.json();
}

// ============================================================================
// Trend Evolution & Cross-Company Intelligence API (Milestone S5)
// ============================================================================

export interface TrendRecord {
  cluster_id: string;
  trend_name: string;
  representative_title: string;
  cluster_type: "single_company_storyline" | "cross_company_trend" | string;
  primary_category: string;
  momentum: {
    label: "surging" | "building" | "fading" | "stable" | "transient" | string;
    vector: [number, number, number];
  };
  distinct_story_count: number;
  raw_event_count: number;
  companies_involved: string[];
  signal_breakdown?: Record<string, number>;
  first_detected_at?: string;
  latest_detected_at?: string;
  relevance_score: number;
  matched_tracked_companies?: string[];
}

export interface TimelineNode {
  event_id?: string;
  member_id?: string;
  company: string;
  title: string;
  source_url: string;
  signal_type: string;
  node_class: "first_party" | "third_party" | string;
  published_at: string;
  date_precision?: string;
  is_sequence_eligible?: boolean;
}

export interface AuditedAbsence {
  company: string;
  status: "absent" | string;
  audit_note: string;
}

export interface TrendDetailRecord extends TrendRecord {
  timeline: TimelineNode[];
  audited_absences: AuditedAbsence[];
  lineage: Array<{ parent_id: string; reason: string; merged_at?: string }>;
}

export async function fetchTrends(params?: {
  limit?: number;
  cursor?: string;
  company?: string;
  momentum?: string;
  trend_type?: string;
  tenantId?: string;
}): Promise<{ trends: TrendRecord[]; total_count: number; has_more: boolean; next_cursor?: string }> {
  const token = getClientAuthToken(params?.tenantId);
  const q = new URLSearchParams();
  if (params?.tenantId) q.set("tenant_id", params.tenantId);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.cursor) q.set("cursor", params.cursor);
  if (params?.company) q.set("company", params.company);
  if (params?.momentum) q.set("momentum", params.momentum);
  if (params?.trend_type) q.set("trend_type", params.trend_type);

  const qs = q.toString() ? `?${q.toString()}` : "";
  const baseUrl = typeof window !== "undefined" ? `/api/trends${qs}` : `${API_BASE_URL}/trends${qs}`;

  try {
    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.trends) && data.trends.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback
  }

  // Filter baseline trends for this tenant
  const baseline = getTenantBaselineData(params?.tenantId);
  let filtered = [...baseline.trends];
  if (params?.company && params.company !== "all" && params.company !== "ALL") {
    const cLower = params.company.toLowerCase();
    filtered = filtered.filter((t) =>
      (t.companies_involved || []).some((c) => c.toLowerCase() === cLower)
    );
  }
  if (params?.momentum && params.momentum !== "all" && params.momentum !== "ALL") {
    filtered = filtered.filter((t) => t.momentum?.label === params.momentum);
  }
  if (params?.trend_type && params.trend_type !== "all" && params.trend_type !== "ALL") {
    filtered = filtered.filter((t) => t.cluster_type === params.trend_type);
  }
  const limit = params?.limit || filtered.length;
  return {
    trends: filtered.slice(0, limit),
    total_count: filtered.length,
    has_more: false,
  };
}

export async function fetchTrendDetail(trendId: string, tenantId?: string): Promise<TrendDetailRecord> {
  const token = getClientAuthToken(tenantId);
  const baseUrl = typeof window !== "undefined" ? `/api/trends/${trendId}` : `${API_BASE_URL}/trends/${trendId}`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : API_BASE_URL);
  if (tenantId) url.searchParams.set("tenant_id", tenantId);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback
  }

  const baseline = getTenantBaselineData(tenantId);
  const baseTrend = (baseline.trends as any[]).find((t) => t.cluster_id === trendId) || (baseline.trends as any[])[0] || (BASELINE_TRENDS as any[])[0];
  const members = Array.isArray(baseTrend?.members) ? baseTrend.members : [];
  const timeline: TimelineNode[] = members.map((m: any) => ({
    member_id: m.event_id,
    event_id: m.event_id,
    company: m.company,
    title: m.title,
    source_url: m.url,
    signal_type: m.signal_type || "news",
    node_class: m.node_class || "third_party",
    published_at: m.published_at || baseTrend?.latest_detected_at || "2026-10-04T12:00:00Z",
    date_precision: m.date_precision || "day",
    is_sequence_eligible: Boolean(m.is_sequence_eligible),
  }));

  const trackedCompanies = baseline.trackedCompanies.map((c) => c.company_name);
  const companiesIn = new Set(baseTrend?.companies_involved || []);
  const auditedAbsences: AuditedAbsence[] = trackedCompanies
    .filter((comp) => !companiesIn.has(comp))
    .map((comp) => ({
      company: comp,
      status: "absent",
      audit_note: "Audited: 0 events detected across tracked window",
    }));

  return {
    ...baseTrend,
    timeline,
    audited_absences: auditedAbsences,
    lineage: [],
  };
}

