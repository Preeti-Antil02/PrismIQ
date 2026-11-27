"use client";

import * as React from "react";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  Edit3,
  Check,
  X,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Building2,
} from "lucide-react";
import {
  fetchGlobalClaimDrift,
  reviewClaimDrift,
  type ClaimDriftAlert,
} from "@/lib/api";

interface GlobalDriftReviewProps {
  tenantId?: string;
}

export function GlobalDriftReview({ tenantId }: GlobalDriftReviewProps) {
  const [loading, setLoading] = React.useState(true);
  const [alerts, setAlerts] = React.useState<ClaimDriftAlert[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>("pending");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Review modal state
  const [selectedAlert, setSelectedAlert] = React.useState<ClaimDriftAlert | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedStatement, setEditedStatement] = React.useState("");
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Toast notification
  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadAlerts = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = { limit: 100 };
      if (statusFilter !== "ALL") filters.review_status = statusFilter;
      if (typeFilter !== "ALL") filters.drift_type = typeFilter;
      const res = await fetchGlobalClaimDrift(filters, tenantId);
      setAlerts(res.alerts || []);
    } catch (err: any) {
      setError(err.message || "Failed to load global claim drift alerts");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, tenantId]);

  React.useEffect(() => {
    setSearchQuery("");
    setSelectedAlert(null);
    setModalOpen(false);
    loadAlerts();
  }, [loadAlerts]);

  const handleOpenReview = (alert: ClaimDriftAlert) => {
    setSelectedAlert(alert);
    setIsEditing(false);
    setEditedStatement(alert.suggested_update?.statement || alert.claim?.statement || "");
    setReviewNotes("");
    setModalOpen(true);
  };

  const handleSubmitReview = async (action: "accept" | "edit_and_accept" | "dismiss" | "mark_incorrect") => {
    if (!selectedAlert) return;
    setSubmitting(true);
    try {
      const payload: any = {
        action,
        notes: reviewNotes,
        reviewer: "analyst",
      };
      if (action === "edit_and_accept") {
        payload.edited_claim = {
          statement: editedStatement,
        };
      }
      await reviewClaimDrift(selectedAlert.id, payload, tenantId);
      showToast(`Alert marked '${action}' successfully`);
      setModalOpen(false);
      await loadAlerts();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter alerts by search query
  const filteredAlerts = alerts.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.company_name?.toLowerCase().includes(q) ||
      a.claim?.statement?.toLowerCase().includes(q) ||
      a.new_evidence_excerpt?.toLowerCase().includes(q)
    );
  });

  const contradictedCount = alerts.filter((a) => a.drift_type === "contradicted").length;
  const staleCount = alerts.filter((a) => a.drift_type === "stale").length;
  const newEvidenceCount = alerts.filter((a) => a.drift_type === "new_evidence").length;

  return (
    <div className="space-y-6 text-slate-200">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 text-sm shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header and Summary Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Global Battlecard Drift Review Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Centralized queue monitoring where incoming competitor signals contradict, update, or make battlecard claims outdated.
          </p>
        </div>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-400" : ""}`} />
        </button>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111726]/90 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Pending Review</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{alerts.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#111726]/90 border border-rose-500/20">
          <div className="text-xs text-rose-400 font-medium">Contradicted Claims</div>
          <div className="text-2xl font-black text-rose-400 mt-1">{contradictedCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#111726]/90 border border-sky-500/20">
          <div className="text-xs text-sky-400 font-medium">New Evidence</div>
          <div className="text-2xl font-black text-sky-400 mt-1">{newEvidenceCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#111726]/90 border border-amber-500/20">
          <div className="text-xs text-amber-300 font-medium">Stale Claims (&gt;90d)</div>
          <div className="text-2xl font-black text-amber-300 mt-1">{staleCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#111726]/90 border border-slate-800">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Filter by competitor, claim, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
          >
            <option value="pending">Status: Pending</option>
            <option value="accepted">Status: Accepted</option>
            <option value="edited">Status: Edited</option>
            <option value="dismissed">Status: Dismissed</option>
            <option value="ALL">Status: All</option>
          </select>

          {/* Drift Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">Type: All Types</option>
            <option value="contradicted">Contradicted</option>
            <option value="new_evidence">New Evidence</option>
            <option value="stale">Stale</option>
            <option value="stable">Stable</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading drift alerts...</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#111726]/60 border border-slate-800 space-y-3">
          <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Zero Drift Alerts in Queue</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            All active competitor battlecards and claims match verified ground truth with no contradictions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border transition-all ${
                alert.drift_type === "contradicted"
                  ? "bg-slate-900/90 border-rose-500/40 hover:border-rose-500"
                  : "bg-[#111726]/90 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                    {alert.company_name}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    alert.drift_type === "contradicted"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      : alert.drift_type === "new_evidence"
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                      : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                  }`}>
                    {alert.drift_type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : "Nov 2026"}
                </span>
              </div>

              {/* Claims Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Existing Claim</div>
                  <div className="text-slate-200">{alert.claim?.statement || "Original claim text."}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-amber-400 uppercase">Incoming Trigger Evidence</div>
                  <div className="text-slate-200">{alert.new_evidence_excerpt}</div>
                </div>
              </div>

              {/* Suggested Update */}
              {alert.suggested_update?.statement && (
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Suggested Update</span>
                  <div className="text-slate-200 italic">&ldquo;{alert.suggested_update.statement}&rdquo;</div>
                </div>
              )}

              {/* Review Button */}
              <div className="flex justify-end pt-3">
                <button
                  onClick={() => handleOpenReview(alert)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer shadow-sm"
                >
                  <span>Review &amp; Decide</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {modalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Review Claim Drift for {selectedAlert.company_name}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Existing Claim</div>
                <div className="text-slate-200 mt-1">{selectedAlert.claim?.statement}</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/40">
                <div className="text-[10px] font-bold text-amber-400 uppercase">New Evidence</div>
                <div className="text-slate-200 mt-1">{selectedAlert.new_evidence_excerpt}</div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Claim Statement to Apply</label>
                <textarea
                  value={editedStatement}
                  onChange={(e) => setEditedStatement(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Review Notes</label>
                <input
                  type="text"
                  placeholder="Notes for audit history..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitReview("dismiss")}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitReview("mark_incorrect")}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium cursor-pointer"
                >
                  Mark Incorrect
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitReview("accept")}
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 cursor-pointer"
                >
                  {submitting ? "Saving..." : "Accept Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
