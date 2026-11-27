"use client";

import * as React from "react";
import { getClientAuthToken } from "@/lib/auth";
import { useWorkspace } from "../AppShell";
import {
  Radar,
  Sparkles,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  AlertCircle,
  Building2,
  TrendingUp,
  Tag,
  Loader2,
  Check,
  X,
} from "lucide-react";

export interface EmergingCandidate {
  id: string;
  tenant_id?: string;
  candidate_name: string;
  normalized_name: string;
  discovery_source: string;
  discovery_reason: string;
  first_detected_at: string;
  mention_count: number;
  product_similarity_score: number;
  status: "pending_review" | "approved" | "rejected";
  reviewed_by?: string;
  reviewed_at?: string;
  supporting_signals: string[];
}

export interface EmergingCompetitorsViewProps {
  tenantId?: string;
  onCompetitorAdded?: (name: string) => void;
}

function normalizeCandidate(raw: any): EmergingCandidate {
  const name = raw?.candidate_name || raw?.company_name || "Unknown Candidate";
  const rawScore = Number(raw?.product_similarity_score ?? raw?.relevance_score ?? 0);
  const sim = rawScore > 1 ? Math.min(1, rawScore / 100) : Math.max(0, rawScore);
  const evidenceArr = Array.isArray(raw?.supporting_signals)
    ? raw.supporting_signals
    : Array.isArray(raw?.evidence_sources)
    ? raw.evidence_sources.map((e: any) => e?.title || e?.url || String(e))
    : [];
  return {
    id: String(raw?.id || name.toLowerCase().replace(/\s+/g, "_")),
    tenant_id: raw?.tenant_id,
    candidate_name: name,
    normalized_name: raw?.normalized_name || name.toLowerCase().replace(/\s+/g, "_"),
    discovery_source: raw?.discovery_source || raw?.industry || "Monitored Workspace Signals",
    discovery_reason: raw?.discovery_reason || raw?.discovery_explanation || "Detected across workspace signal feeds.",
    first_detected_at: raw?.first_detected_at || raw?.detected_at || new Date().toISOString(),
    mention_count: Number(raw?.mention_count ?? raw?.corroboration_count ?? evidenceArr.length ?? 1),
    product_similarity_score: sim,
    status: (raw?.status || raw?.review_status || "pending_approval") as any,
    reviewed_by: raw?.reviewed_by,
    reviewed_at: raw?.reviewed_at,
    supporting_signals: evidenceArr,
  };
}

export function EmergingCompetitorsView({ tenantId, onCompetitorAdded }: EmergingCompetitorsViewProps) {
  const workspace = useWorkspace();
  const effectiveTenantId = tenantId || workspace.tenantId;
  const [loading, setLoading] = React.useState(true);
  const [candidates, setCandidates] = React.useState<EmergingCandidate[]>([]);
  const [isDiscovering, setIsDiscovering] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("pending_approval");
  const [actionSuccessMsg, setActionSuccessMsg] = React.useState<string | null>(null);

  const loadCandidates = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = getClientAuthToken(effectiveTenantId);
      const params = new URLSearchParams({ status: statusFilter });
      if (effectiveTenantId) params.set("tenant_id", effectiveTenantId);
      const res = await fetch(`/api/emerging-competitors?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {}),
        },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.candidates || (Array.isArray(data) ? data : []);
        setCandidates(list.map(normalizeCandidate));
      } else {
        setCandidates([]);
      }
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, effectiveTenantId]);

  React.useEffect(() => {
    loadCandidates();
  }, [loadCandidates, workspace.pipelineSyncVersion]);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      const token = getClientAuthToken(effectiveTenantId);
      const qs = effectiveTenantId ? `?tenant_id=${encodeURIComponent(effectiveTenantId)}` : "";
      await fetch(`/api/emerging-competitors/discover${qs}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {}),
        },
      });
      await loadCandidates();
      setActionSuccessMsg("Landscape sweep complete: emerging signals scanned.");
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch {
      setActionSuccessMsg("Unable to complete emerging rival scan.");
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleApprove = async (candidate: EmergingCandidate) => {
    try {
      const token = getClientAuthToken(effectiveTenantId);
      const qs = effectiveTenantId ? `?tenant_id=${encodeURIComponent(effectiveTenantId)}` : "";
      const res = await fetch(`/api/emerging-competitors/${candidate.id}/approve${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {}),
        },
        body: JSON.stringify({ reviewer_id: "analyst", notes: "Approved from Competitors hub" }),
      });
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
        setActionSuccessMsg(`Approved ${candidate.candidate_name}: added to active monitored landscape.`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
        if (onCompetitorAdded) onCompetitorAdded(candidate.candidate_name);
      }
    } catch {
      // ignore
    }
  };

  const handleReject = async (candidate: EmergingCandidate) => {
    try {
      const token = getClientAuthToken(effectiveTenantId);
      const qs = effectiveTenantId ? `?tenant_id=${encodeURIComponent(effectiveTenantId)}` : "";
      const res = await fetch(`/api/emerging-competitors/${candidate.id}/reject${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {}),
        },
        body: JSON.stringify({ reviewer_id: "analyst", notes: "Dismissed from Competitors hub" }),
      });
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
        setActionSuccessMsg(`Dismissed ${candidate.candidate_name}.`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-700">
            <Radar className="h-4 w-4" />
            Emerging Competitor Detection
          </div>
          <h2 className="mt-0.5 text-base font-bold text-slate-900">
            Candidate Discovery & Human Review
          </h2>
          <p className="text-xs text-slate-500">
            Early signals, market movements, and product similarity scores requiring analyst approval before addition to the tracked landscape.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDiscover}
          disabled={isDiscovering}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 transition"
        >
          {isDiscovering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Scan Signals for Emerging Rivals
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          {actionSuccessMsg}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-violet-600 mb-2" />
          Scanning emerging candidate pipeline...
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <h3 className="text-sm font-bold text-slate-900">Landscape Review Up to Date</h3>
          <p className="text-xs text-slate-400 mt-1">
            No unreviewed emerging competitor candidates detected in active monitored signals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {candidates.map((cand) => (
            <div
              key={cand.id}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:border-violet-200 transition space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 font-bold text-xs">
                      {cand.candidate_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{cand.candidate_name}</h4>
                      <p className="text-[11px] text-slate-400">
                        First Seen: {cand.first_detected_at.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-100">
                    {(cand.product_similarity_score * 100).toFixed(0)}% Similarity
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 leading-relaxed border border-slate-100">
                  <p className="font-semibold text-slate-900 mb-0.5">Discovery Reason:</p>
                  <p>{cand.discovery_reason}</p>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>
                    <span className="font-semibold text-slate-700">Source:</span> {cand.discovery_source}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Mentions:</span> {cand.mention_count} corroborations
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleReject(cand)}
                  className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(cand)}
                  className="flex-1 rounded-lg bg-violet-600 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 transition flex items-center justify-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Add to Watchlist
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
