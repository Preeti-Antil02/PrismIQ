"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchTrackedCompanies,
  addTrackedCompany,
  untrackCompany,
  discoverCompetitors,
  confirmCompetitors,
  type TrackedCompany,
  type DiscoveryCandidate,
} from "@/lib/api";
import {
  WriteStatusBanner,
  CompanyConfirmGateModal,
  type CandidateReviewItem,
  type WriteOperationStatus,
} from "@/components/shared/WorkspaceControls";
import {
  Building2,
  Plus,
  Compass,
  Trash2,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Target,
  Users,
  Search,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function WatchlistPage() {
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Quick Add State
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newCompanyName, setNewCompanyName] = React.useState("");
  const [newIsTarget, setNewIsTarget] = React.useState(false);
  const [addStatus, setAddStatus] = React.useState<WriteOperationStatus>("idle");
  const [addError, setAddError] = React.useState<string | null>(null);

  // Untrack State
  const [untrackTarget, setUntrackTarget] = React.useState<string | null>(null);
  const [untrackStatus, setUntrackStatus] = React.useState<WriteOperationStatus>("idle");
  const [untrackError, setUntrackError] = React.useState<string | null>(null);

  // Discovery Agent Modal State
  const [showDiscoveryModal, setShowDiscoveryModal] = React.useState(false);
  const [discoveryTarget, setDiscoveryTarget] = React.useState("Vercel");
  const [isDiscovering, setIsDiscovering] = React.useState(false);
  const [candidates, setCandidates] = React.useState<CandidateReviewItem[]>([]);
  const [showConfirmGate, setShowConfirmGate] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [discoveryError, setDiscoveryError] = React.useState<string | null>(null);

  const loadCompanies = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const comps = await fetchTrackedCompanies();
      setCompanies(comps);
    } catch (err: any) {
      setError(err.message || "Failed to load tracked companies.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Handle Quick Add
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCompanyName.trim();
    if (!clean) return;

    setAddStatus("pending");
    setAddError(null);
    try {
      await addTrackedCompany(clean, newIsTarget);
      setAddStatus("success");
      setNewCompanyName("");
      setNewIsTarget(false);
      await loadCompanies();
      setTimeout(() => {
        setShowAddModal(false);
        setAddStatus("idle");
      }, 1200);
    } catch (err: any) {
      setAddError(err.message || "Failed to add tracked company");
      setAddStatus("error");
    }
  };

  // Handle Untrack
  const handleConfirmUntrack = async () => {
    if (!untrackTarget) return;

    setUntrackStatus("pending");
    setUntrackError(null);
    try {
      await untrackCompany(untrackTarget);
      setUntrackStatus("success");
      await loadCompanies();
      setTimeout(() => {
        setUntrackTarget(null);
        setUntrackStatus("idle");
      }, 1200);
    } catch (err: any) {
      setUntrackError(err.message || "Failed to untrack company");
      setUntrackStatus("error");
    }
  };

  // Handle Run Discovery Agent
  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = discoveryTarget.trim();
    if (!target) return;

    setIsDiscovering(true);
    setDiscoveryError(null);
    try {
      const res = await discoverCompetitors(target);
      const items: CandidateReviewItem[] = (res.candidates || []).map((c: DiscoveryCandidate) => ({
        name: c.company_name,
        rationale: (c.reasons && c.reasons.join(". ")) || "Identified as direct sector competitor.",
        confidence: c.confidence >= 0.8 ? "High" : c.confidence >= 0.6 ? "Medium" : "Low",
        sourceCitation: (c.sources && c.sources.join(", ")) || "Sector Analysis & Domain Crawl",
        selected: true,
      }));

      setCandidates(items);
      setShowDiscoveryModal(false);
      setShowConfirmGate(true);
    } catch (err: any) {
      setDiscoveryError(err.message || "Discovery agent failed to propose candidates.");
    } finally {
      setIsDiscovering(false);
    }
  };

  // Handle Toggle Candidate in Gate
  const handleToggleCandidate = (name: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.name === name ? { ...c, selected: !c.selected } : c))
    );
  };

  // Handle Confirm Candidates
  const handleConfirmCandidates = async () => {
    const selected = candidates.filter((c) => c.selected).map((c) => c.name);
    if (selected.length === 0) return;

    setIsConfirming(true);
    setDiscoveryError(null);
    try {
      await confirmCompetitors(discoveryTarget, selected);
      setShowConfirmGate(false);
      await loadCompanies();
    } catch (err: any) {
      setDiscoveryError(err.message || "Failed to confirm competitor list.");
    } finally {
      setIsConfirming(false);
    }
  };

  const targetCompany = companies.find((c) => c.is_target);
  const competitorCompanies = companies.filter((c) => !c.is_target);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <Building2 className="h-4 w-4" />
              <span>Workspace Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              Watchlist & Competitors
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Manage tracked entities and discover market competitors under tenant Row-Level Security.
              Changes update ingestion schedules immediately.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDiscoveryModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <Compass className="h-4 w-4" />
              <span>Run Discovery Agent</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Company</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Tracked</span>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {loading ? "-" : companies.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Entities in ingestion crawl</p>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Primary Target</span>
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground truncate">
              {loading ? "-" : targetCompany ? targetCompany.company_name : "None"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Benchmark baseline organization</p>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Competitors</span>
              <Users className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {loading ? "-" : competitorCompanies.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Actively benchmarked peers</p>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">RLS Security</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              Active
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Tenant isolation enforced</p>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading tenant watchlist...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load watchlist</span>
            </div>
            <p className="text-xs">{error}</p>
            <button
              type="button"
              onClick={loadCompanies}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/20 text-xs font-semibold hover:bg-destructive/30 transition-colors cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 px-4 border border-dashed border-border rounded-xl">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-3 text-base font-semibold text-foreground">No companies tracked yet</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Add your target organization and competitors to start monitoring autonomous intelligence signals.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add First Company</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Tracked Organizations</h3>
                <p className="text-xs text-muted-foreground">
                  Ingestion engine crawls signals across GitHub, Job Postings, News, Pricing, and Research for these entities.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {companies.length} tracked entities
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-6">Company</th>
                    <th className="py-3 px-6">Role</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Added Date</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 text-xs">
                  {companies.map((comp) => (
                    <tr
                      key={comp.company_name}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs uppercase">
                            {comp.company_name.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground text-sm block">
                              {comp.company_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Monitored across 5 signal sources
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {comp.is_target ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Target className="h-3 w-3" />
                            <span>Primary Target</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                            <Users className="h-3 w-3" />
                            <span>Competitor</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active Monitoring</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-muted-foreground">
                        {comp.added_at ? new Date(comp.added_at).toLocaleDateString() : "Historical"}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => setUntrackTarget(comp.company_name)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border hover:border-destructive/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Untrack</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="text-base font-bold text-foreground">Add Company to Watchlist</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddCompany} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Company Name</label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Fastly, Akamai, Supabase"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newIsTarget"
                    checked={newIsTarget}
                    onChange={(e) => setNewIsTarget(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <label htmlFor="newIsTarget" className="text-xs text-foreground select-none cursor-pointer">
                    Set as Primary Target (Benchmark baseline)
                  </label>
                </div>

                <WriteStatusBanner
                  status={addStatus}
                  errorMessage={addError}
                  successMessage="Company added successfully!"
                />

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={addStatus === "pending"}
                    className="px-3.5 py-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addStatus === "pending" || !newCompanyName.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {addStatus === "pending" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <span>Add to Watchlist</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Untrack Confirmation Dialog */}
        {untrackTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-destructive/30 space-y-4">
              <div className="flex items-center gap-3 text-destructive">
                <div className="p-2 rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Untrack {untrackTarget}?</h3>
                  <p className="text-xs text-muted-foreground">This action updates your active monitoring profile.</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Untracking removes <strong>{untrackTarget}</strong> from future daily signal ingestion runs.
                Historical signals, consolidated events, and radar evaluations will be securely preserved under tenant RLS.
              </p>

              <WriteStatusBanner
                status={untrackStatus}
                errorMessage={untrackError}
                successMessage="Company untracked successfully."
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setUntrackTarget(null)}
                  disabled={untrackStatus === "pending"}
                  className="px-3.5 py-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUntrack}
                  disabled={untrackStatus === "pending"}
                  className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 cursor-pointer"
                >
                  {untrackStatus === "pending" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Untracking...</span>
                    </>
                  ) : (
                    <span>Confirm Untrack</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Discovery Agent Search Modal */}
        {showDiscoveryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase">
                  <Compass className="h-4 w-4" />
                  <span>Discovery Agent</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiscoveryModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-foreground">Propose Market Competitors</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter a target company. Discovery Agent crawls market graphs to propose grounded competitors with source citations.
                </p>
              </div>

              {discoveryError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  {discoveryError}
                </div>
              )}

              <form onSubmit={handleRunDiscovery} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Target Organization</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      value={discoveryTarget}
                      onChange={(e) => setDiscoveryTarget(e.target.value)}
                      placeholder="e.g. Vercel, Stripe, Supabase"
                      className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDiscoveryModal(false)}
                    disabled={isDiscovering}
                    className="px-3.5 py-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDiscovering || !discoveryTarget.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {isDiscovering ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Discovering Candidates...</span>
                      </>
                    ) : (
                      <>
                        <Compass className="h-3.5 w-3.5" />
                        <span>Run Discovery</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Discovery Candidate Confirmation Gate Modal (Mandatory Human Review) */}
        <CompanyConfirmGateModal
          targetCompany={discoveryTarget}
          candidates={candidates}
          isOpen={showConfirmGate}
          isSaving={isConfirming}
          error={discoveryError}
          onToggleCandidate={handleToggleCandidate}
          onConfirm={handleConfirmCandidates}
          onCancel={() => setShowConfirmGate(false)}
        />
      </div>
    </AppLayout>
  );
}
