"use client";

import * as React from "react";
import {
  Building2,
  Plus,
  Trash2,
  Sparkles,
  Search,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import { useWorkspace } from "./AppShell";
import {
  PrismCard,
  PrismTierBadge,
  PrismConfidenceBadge,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismCompanyBadge,
  PrismSectionHeader,
} from "./PrismPrimitives";
import {
  fetchTrackedCompanies,
  addTrackedCompany,
  untrackCompany,
  discoverCompetitors,
  type TrackedCompany,
  type DiscoveryCandidate,
} from "@/lib/api";

export function WatchlistPage() {
  const { targetCompany, refreshConfig } = useWorkspace();

  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<TrackedCompany[]>([]);
  const [newCompanyName, setNewCompanyName] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Discovery Agent State
  const [discoveryModalOpen, setDiscoveryModalOpen] = React.useState(false);
  const [isDiscovering, setIsDiscovering] = React.useState(false);
  const [candidates, setCandidates] = React.useState<DiscoveryCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = React.useState<string[]>([]);
  const [isAddingCandidates, setIsAddingCandidates] = React.useState(false);
  const [discoveryError, setDiscoveryError] = React.useState<string | null>(null);

  const loadCompanies = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchTrackedCompanies();
      setCompanies(list || []);
    } catch (err: any) {
      setError(err.message || "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Handle manual add
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setIsAdding(true);
    try {
      await addTrackedCompany(newCompanyName.trim(), false);
      setNewCompanyName("");
      await loadCompanies();
      await refreshConfig();
    } catch (err: any) {
      alert(`Could not add company: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Handle untrack
  const handleUntrack = async (companyName: string) => {
    if (!confirm(`Are you sure you want to stop tracking ${companyName}?`)) return;
    try {
      await untrackCompany(companyName);
      await loadCompanies();
      await refreshConfig();
    } catch (err: any) {
      alert(`Could not untrack company: ${err.message}`);
    }
  };

  // Run discovery agent
  const handleRunDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    setDiscoveryModalOpen(true);
    try {
      const res = await discoverCompetitors(targetCompany);
      setCandidates(res.candidates || []);
      // Pre-select all by default
      const names = (res.candidates || [])
        .map((c) => c.company_name || c.name || "")
        .filter(Boolean);
      setSelectedCandidates(names);
    } catch (err: any) {
      setDiscoveryError(err.message || "Discovery agent run failed");
    } finally {
      setIsDiscovering(false);
    }
  };

  // Add selected discovered candidates
  const handleAddSelectedCandidates = async () => {
    if (selectedCandidates.length === 0) return;
    setIsAddingCandidates(true);
    try {
      for (const name of selectedCandidates) {
        // Skip if already in companies
        if (!companies.some((c) => c.company_name.toLowerCase() === name.toLowerCase())) {
          await addTrackedCompany(name, false);
        }
      }
      await loadCompanies();
      await refreshConfig();
      setDiscoveryModalOpen(false);
    } catch (err: any) {
      alert(`Failed to add candidates: ${err.message}`);
    } finally {
      setIsAddingCandidates(false);
    }
  };

  const target = companies.find((c) => c.is_target) || {
    company_name: targetCompany,
    is_target: true,
    status: "active",
  };

  const trackedCompetitors = companies.filter((c) => !c.is_target);

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Workspace Watchlist
          </div>
          <h1 className="app-title-lg">
            Companies & Competitors for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Configure the entities monitored across the intelligence pipeline. Add or remove competitors and run autonomous discovery sweeps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrismButton variant="light" size="sm" onClick={loadCompanies}>
            <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Refresh</span>
          </PrismButton>
          <PrismButton variant="grad" size="sm" onClick={handleRunDiscovery}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover Rivals</span>
          </PrismButton>
        </div>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={3} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Watchlist"
          description={error}
          actionText="Retry"
          onAction={loadCompanies}
        />
      ) : (
        <div className="space-y-8">
          {/* Target Company Box */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-blue-50/50 border border-purple-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-lg shadow-sm">
                {target.company_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-[#17171b]">
                    {target.company_name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                    Target Company
                  </span>
                </div>
                <div className="text-xs text-[#70717a] mt-0.5">
                  Primary subject entity for market benchmarking and signal correlation.
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold text-[#059669] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              Active Monitoring
            </div>
          </div>

          {/* Quick Add Competitor Form */}
          <form
            onSubmit={handleAddCompany}
            className="p-4 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] shadow-xs flex flex-col sm:flex-row items-center gap-3"
          >
            <div className="relative flex-1 w-full">
              <Plus className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Enter competitor company name (e.g. Amazon, Myntra, Temu)..."
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="app-search-input w-full max-w-none"
              />
            </div>
            <PrismButton
              type="submit"
              variant="dark"
              size="md"
              disabled={isAdding || !newCompanyName.trim()}
              className="w-full sm:w-auto shrink-0"
            >
              {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Competitor</span>
            </PrismButton>
          </form>

          {/* Tracked Competitors Table */}
          <div className="space-y-4">
            <PrismSectionHeader
              title={`Tracked Competitors (${trackedCompetitors.length})`}
              subtitle="All rivals currently scheduled for autonomous multi-channel signal collection."
            />

            {trackedCompetitors.length === 0 ? (
              <PrismEmptyState
                icon={<Building2 className="w-6 h-6" />}
                title="No Competitors Tracked"
                description="Add your first competitor using the form above, or launch our autonomous discovery agent to suggest market rivals."
                actionText="Discover Rivals"
                onAction={handleRunDiscovery}
              />
            ) : (
              <div className="app-table-wrap">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Competitor</th>
                      <th>Status</th>
                      <th>Coverage</th>
                      <th>Added Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedCompetitors.map((comp) => (
                      <tr key={comp.company_name}>
                        <td className="font-bold text-[#17171b] whitespace-nowrap">
                          <PrismCompanyBadge name={comp.company_name} size="sm" />
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="app-pill bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Active
                          </span>
                        </td>
                        <td className="text-xs text-[#70717a] whitespace-nowrap">
                          News, Repos, Jobs, Pricing
                        </td>
                        <td className="text-xs text-[#9ca3af] whitespace-nowrap">
                          {comp.added_at ? new Date(comp.added_at).toLocaleDateString() : "Active"}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            onClick={() => handleUntrack(comp.company_name)}
                            className="p-1.5 text-[#9ca3af] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title={`Untrack ${comp.company_name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autonomous Competitor Discovery Modal */}
      {discoveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            onClick={() => setDiscoveryModalOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-[rgba(20,20,30,0.10)] shadow-2xl p-6 sm:p-8 z-10 max-h-[90vh] overflow-y-auto space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#6e57dc] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="app-title-sm">Competitor Discovery Agent</h3>
                  <p className="text-xs text-[#70717a]">
                    Autonomous competitor extraction for {targetCompany}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiscoveryModalOpen(false)}
                className="p-1 text-[#9ca3af] hover:text-[#17171b] rounded-lg hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDiscovering ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#6e57dc]" />
                <div className="font-bold text-sm text-[#17171b]">
                  Analyzing Market Landscape...
                </div>
                <div className="text-xs text-[#70717a] max-w-xs">
                  Searching live news snippets, competitor listings, and market indexes.
                </div>
              </div>
            ) : discoveryError ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {discoveryError}
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#70717a]">
                No competitor candidates discovered. Try manual addition.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-[#70717a] flex items-center justify-between">
                  <span>
                    Discovered <strong>{candidates.length}</strong> candidates for {targetCompany}:
                  </span>
                  <span className="text-[11px] font-bold text-[#6e57dc]">
                    {selectedCandidates.length} selected
                  </span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {candidates.map((cand, i) => {
                    const name = cand.company_name || cand.name || `Candidate ${i + 1}`;
                    const isSelected = selectedCandidates.includes(name);
                    const alreadyTracked = companies.some(
                      (c) => c.company_name.toLowerCase() === name.toLowerCase()
                    );

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (alreadyTracked) return;
                          if (isSelected) {
                            setSelectedCandidates(selectedCandidates.filter((n) => n !== name));
                          } else {
                            setSelectedCandidates([...selectedCandidates, name]);
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          alreadyTracked
                            ? "bg-zinc-50 border-zinc-200 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-purple-50/70 border-purple-200 text-[#17171b]"
                            : "bg-white border-[rgba(20,20,30,0.08)] hover:bg-zinc-50"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-xs text-[#17171b] flex items-center gap-2">
                            <span>{name}</span>
                            {alreadyTracked && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-600">
                                Already Tracked
                              </span>
                            )}
                          </div>
                          {(cand.rationale || cand.source) && (
                            <div className="text-[11px] text-[#70717a] line-clamp-1">
                              {cand.rationale || cand.source}
                            </div>
                          )}
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={alreadyTracked}
                          readOnly
                          className="w-4 h-4 rounded text-[#6e57dc] focus:ring-[#6e57dc]"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                  <PrismButton variant="light" size="sm" onClick={() => setDiscoveryModalOpen(false)}>
                    Cancel
                  </PrismButton>
                  <PrismButton
                    variant="dark"
                    size="sm"
                    disabled={isAddingCandidates || selectedCandidates.length === 0}
                    onClick={handleAddSelectedCandidates}
                  >
                    {isAddingCandidates ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Add Selected to Watchlist</span>
                  </PrismButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
