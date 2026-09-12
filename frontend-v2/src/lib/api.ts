import { getClientAuthToken } from "./auth";
import type { ConfidenceLevel, TierLevel, SignalType } from "./tokens";

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
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export async function fetchSignals(params?: {
  company?: string;
  source?: string;
  tier?: string;
  confidence?: string;
  limit?: number;
  offset?: number;
  forceFailure?: boolean;
}): Promise<SignalsApiResponse> {
  // Check forced dev failure state if requested
  if (params?.forceFailure) {
    throw new Error("Simulated network disconnection for verification of error state.");
  }

  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/signals" : `${API_BASE_URL}/signals`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");

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

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error (${res.status}): ${errText || res.statusText}`);
  }

  return res.json();
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

export async function fetchEvents(params?: {
  company?: string;
  tier?: string;
  confidence?: string;
  limit?: number;
  offset?: number;
  forceFailure?: boolean;
}): Promise<EventsApiResponse> {
  if (params?.forceFailure) {
    throw new Error("Simulated network disconnection for verification of error state.");
  }

  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/events" : `${API_BASE_URL}/events`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");

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

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error (${res.status}): ${errText || res.statusText}`);
  }

  return res.json();
}

export async function fetchEventDetail(eventId: string): Promise<ConsolidatedEventRecord> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? `/api/events/${eventId}` : `${API_BASE_URL}/events/${eventId}`;
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  return data.event;
}

export async function fetchTrackedCompanies(): Promise<TrackedCompany[]> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/tracked-companies" : `${API_BASE_URL}/tracked-companies`;
  const res = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch tracked companies (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.tracked_companies || [];
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

export async function fetchBriefs(): Promise<BriefEntry[]> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/briefs" : `${API_BASE_URL}/briefs`;
  const res = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch briefs: ${err}`);
  }

  const data = await res.json();
  return data.briefs || [];
}

export async function fetchLatestBrief(): Promise<BriefDetail> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/briefs/latest" : `${API_BASE_URL}/briefs/latest`;
  const res = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch latest brief: ${err}`);
  }

  return res.json();
}

export async function fetchBriefById(briefId: string): Promise<BriefDetail> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? `/api/briefs/${briefId}` : `${API_BASE_URL}/briefs/${briefId}`;
  const res = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch brief ${briefId}: ${err}`);
  }

  return res.json();
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
}

export interface RadarApiResponse {
  evaluations: RadarEvaluation[];
  count: number;
}

export async function fetchLatestRadar(): Promise<RadarApiResponse> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/research-radar/latest" : `${API_BASE_URL}/research-radar/latest`;
  const res = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch latest radar: ${err}`);
  }

  return res.json();
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

export async function fetchFindings(): Promise<FindingsApiResponse> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/findings" : `${API_BASE_URL}/findings`;
  const res = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch findings: ${err}`);
  }

  return res.json();
}


// ============================================================================
// Competitor Summary Helpers
// ============================================================================

export interface CompetitorActivitySummary {
  company_name: string;
  is_target: boolean;
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
    const compSignals = signals.filter((s) => s.company_name === comp.company_name);
    const compEvents = events.filter((e) => e.company_name === comp.company_name);
    const compFindings = findings.filter((f) => f.company_name === comp.company_name);

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
      if (direct) {
        radar_connections[ev.topic_label] = direct.status;
      } else {
        const matchedKey = Object.keys(conns).find(
          (k) =>
            comp.company_name.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(comp.company_name.toLowerCase())
        );
        if (matchedKey && conns[matchedKey]) {
          radar_connections[ev.topic_label] = conns[matchedKey].status;
        }
      }
    });

    return {
      company_name: comp.company_name,
      is_target: comp.is_target,
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

export interface DiscoveryCandidate {
  company_name: string;
  confidence: number;
  reasons: string[];
  sources?: string[];
  website?: string;
}

export async function fetchWorkspaceTopics(includePaused: boolean = true): Promise<ResearchTopic[]> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? `/api/workspace/topics?include_paused=${includePaused}` : `${API_BASE_URL}/research-radar/topics?include_paused=${includePaused}`;
  const res = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to load topics (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.topics || [];
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

export async function discoverCompetitors(targetCompany: string): Promise<{ candidates: DiscoveryCandidate[] }> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/discover" : `${API_BASE_URL}/api/onboarding/discover`;
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_company: targetCompany }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Discovery failed (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function confirmCompetitors(targetCompany: string, competitors: string[]): Promise<any> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/confirm" : `${API_BASE_URL}/api/onboarding/confirm`;
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_company: targetCompany, confirmed_competitors: competitors }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Confirmation failed (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function fetchDeliveryConfig(): Promise<DeliveryConfig | null> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/delivery" : `${API_BASE_URL}/workspace/delivery`;
  const res = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch delivery config (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.delivery_config || null;
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

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  const token = getClientAuthToken();
  const baseUrl = typeof window !== "undefined" ? "/api/workspace/settings" : `${API_BASE_URL}/workspace/settings`;
  const res = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch workspace settings (${res.status}): ${errText}`);
  }
  return res.json();
}
