"use client";

import React, { useEffect, useState } from "react";
import {
  fetchRadarTopics,
  createRadarTopic,
  deleteRadarTopic,
  fetchLatestRadar,
  fetchRadarHistory,
} from "@/lib/api";
import { HistoricalRadarRecord, ResearchTopic } from "@/types/brief";

export default function ResearchRadarPage() {
  const [topics, setTopics] = useState<ResearchTopic[]>([]);
  const [evaluations, setEvaluations] = useState<HistoricalRadarRecord[]>([]);
  const [history, setHistory] = useState<HistoricalRadarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  // Form state for adding a topic
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTopicLabel, setNewTopicLabel] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filters for historical view
  const [filterTopic, setFilterTopic] = useState("");
  const [filterCompetitor, setFilterCompetitor] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, latestEvals, histList] = await Promise.all([
        fetchRadarTopics(),
        fetchLatestRadar(),
        fetchRadarHistory(filterTopic || undefined, filterCompetitor || undefined),
      ]);
      setTopics(tList);
      setEvaluations(latestEvals);
      setHistory(histList);
    } catch (err) {
      console.error("Failed to load radar data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const [tList, latestEvals, histList] = await Promise.all([
          fetchRadarTopics(),
          fetchLatestRadar(),
          fetchRadarHistory(filterTopic || undefined, filterCompetitor || undefined),
        ]);
        if (!ignore) {
          setTopics(tList);
          setEvaluations(latestEvals);
          setHistory(histList);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Failed to load radar data:", err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [filterTopic, filterCompetitor]);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicLabel.trim()) return;

    setSubmitting(true);
    const kws = newKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const res = await createRadarTopic(newTopicLabel.trim(), kws);
    if (res) {
      setNewTopicLabel("");
      setNewKeywords("");
      setShowAddModal(false);
      setLoading(true);
      await loadData();
    }
    setSubmitting(false);
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm("Are you sure you want to remove this research radar topic?")) return;
    const ok = await deleteRadarTopic(topicId);
    if (ok) {
      setLoading(true);
      await loadData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "researching":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-800">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Researching
          </span>
        );
      case "adopting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Adopting
          </span>
        );
      case "mentioning":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Mentioning
          </span>
        );
      case "no activity detected":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#141518] text-[#8E8F99] border border-[#26282E]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
            No activity detected
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#08090C] text-[#E4E4E7] pb-24">
      {/* Header Banner */}
      <div className="border-b border-[#1F2023] bg-linear-to-b from-[#101116] to-[#08090C] pt-10 pb-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔬</span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Field Research Radar
                </h1>
                <span className="rounded-full bg-[#1F2023] px-2.5 py-0.5 text-xs font-medium text-[#A1A1AA] border border-[#2E3036]">
                  Stage 3/4
                </span>
              </div>
              <p className="mt-2 text-sm text-[#A1A1AA] max-w-2xl leading-relaxed">
                Domain-scoped intelligence layer cross-referencing emerging research topics against
                your tracked competitors. Surfaces competitive gaps, active bet validation, and deliberate
                absence findings.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition shadow-sm"
              >
                <span>+</span> Add Research Topic
              </button>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center gap-4 mt-8 border-b border-[#1F2023]">
            <button
              onClick={() => setActiveTab("current")}
              className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition ${
                activeTab === "current"
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-[#71717A] hover:text-white"
              }`}
            >
              Current Cycle Radar ({evaluations.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition ${
                activeTab === "history"
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-[#71717A] hover:text-white"
              }`}
            >
              Historical Timeline View
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-8">
        {/* Configured Topics Pill Bar */}
        <div className="mb-8 p-4 rounded-xl bg-[#0D0E12] border border-[#1F2023]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
              Active Tenant Research Topics ({topics.length})
            </span>
            <span className="text-[11px] text-[#52525B]">
              Stage 1: Manual Topic Configuration (Suggestions deferred)
            </span>
          </div>

          {topics.length === 0 ? (
            <div className="text-center py-6 text-[#71717A] text-xs">
              No research topics configured yet. Click &ldquo;+ Add Research Topic&rdquo; to monitor domain areas like &ldquo;WASM at the edge&rdquo; or &ldquo;Edge database consistency&rdquo;.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {topics.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg bg-[#14151B] border border-[#27282F] px-3 py-1.5 text-xs text-white"
                >
                  <span className="font-medium">{t.topic_label}</span>
                  <span className="rounded bg-[#1F2028] px-1.5 py-0.5 text-[10px] text-[#A1A1AA]">
                    {t.keywords.length} terms
                  </span>
                  <button
                    onClick={() => handleDeleteTopic(t.id)}
                    className="text-[#71717A] hover:text-red-400 ml-1 transition"
                    title="Remove topic"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: Current Cycle Evaluations */}
        {activeTab === "current" && (
          <div>
            {loading ? (
              <div className="text-center py-16 text-[#71717A] text-sm animate-pulse">
                Loading Field Research Radar snapshot...
              </div>
            ) : evaluations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#27282F] p-12 text-center">
                <div className="text-3xl mb-3">📡</div>
                <h3 className="text-base font-semibold text-white">No Radar Evaluations Available</h3>
                <p className="mt-1 text-xs text-[#71717A] max-w-md mx-auto">
                  Configure topic areas above. On the next autonomous cycle or manual pipeline trigger,
                  PrismIQ will cross-reference research publications with your tracked competitors.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {evaluations.map((ev, idx) => (
                  <div
                    key={ev.id || idx}
                    className="rounded-2xl border border-[#1F2023] bg-[#0E0F14] p-6 shadow-sm"
                  >
                    {/* Topic Header & Item Count */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#1C1D23]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔬</span>
                          <h2 className="text-lg font-bold text-white tracking-tight">
                            {ev.topic_label}
                          </h2>
                          {ev.state_change_detected && (
                            <span className="rounded-full bg-amber-950/80 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-800">
                              State Change Detected
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#8E8F99]">
                          {ev.research_item_count > 0 ? (
                            <span>
                              <strong className="text-white font-semibold">{ev.research_item_count}</strong> verified research items surfaced this cycle
                            </span>
                          ) : (
                            <span className="italic text-[#71717A]">
                              No new research items detected this cycle
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-[#52525B]">Cycle: {ev.cycle_id}</span>
                      </div>
                    </div>

                    {/* Competitor Connection Matrix */}
                    <div className="mt-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA] mb-3">
                        Competitor Connection Status Matrix
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(ev.competitor_connections || {}).map(([compName, conn]) => (
                          <div
                            key={compName}
                            className="rounded-xl bg-[#13141A] border border-[#24252C] p-4 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm text-white">{compName}</span>
                                {getStatusBadge(conn.status)}
                              </div>

                              <p className="text-xs text-[#A1A1AA] leading-relaxed line-clamp-3">
                                {conn.reason}
                              </p>

                              {/* Evidence Signals (if any) */}
                              {conn.evidence_signals && conn.evidence_signals.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-[#1C1D24]">
                                  <span className="text-[10px] font-semibold uppercase text-[#71717A]">
                                    Evidence Signal:
                                  </span>
                                  <a
                                    href={conn.evidence_signals[0].url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-xs text-indigo-400 hover:text-indigo-300 truncate mt-0.5"
                                  >
                                    &ldquo;{conn.evidence_signals[0].title}&rdquo;
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Audited Sources Checkmark Indicator */}
                            {conn.queried_sources && (
                              <div className="mt-3 pt-2.5 border-t border-[#1A1B22] flex items-center justify-between text-[10px] text-[#52525B]">
                                <span>Audited Sources:</span>
                                <div className="flex items-center gap-1.5">
                                  {Object.entries(conn.queried_sources).map(([src, checked]) => (
                                    <span
                                      key={src}
                                      className={`px-1 py-0.5 rounded font-mono ${
                                        checked
                                          ? "text-emerald-400 bg-emerald-950/40"
                                          : "text-red-400 bg-red-950/40"
                                      }`}
                                      title={`${src}: ${checked ? "Queried" : "Unqueried/Skipped"}`}
                                    >
                                      {src.slice(0, 3)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Why It Matters */}
                    {ev.why_it_matters && (
                      <div className="mt-5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 p-4">
                        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                          <span>💡</span> Decision Framing (Why it matters)
                        </div>
                        <p className="text-xs text-[#D4D4D8] leading-relaxed">
                          {ev.why_it_matters}
                        </p>
                      </div>
                    )}

                    {/* Verified Real Sources */}
                    {ev.verified_sources && ev.verified_sources.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-[#1C1D23]">
                        <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider block mb-2">
                          Verified Research Sources ({ev.verified_sources.length})
                        </span>
                        <ul className="space-y-1.5 text-xs">
                          {ev.verified_sources.map((s, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2">
                              <span className="text-indigo-400 shrink-0">↗</span>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-300 hover:underline"
                              >
                                {s.title}
                              </a>
                              {s.authors && s.authors.length > 0 && (
                                <span className="text-[#71717A]">
                                  — {s.authors.slice(0, 3).join(", ")}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Historical Timeline View */}
        {activeTab === "history" && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl bg-[#0E0F14] border border-[#1F2023]">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#71717A] mb-1">
                  Filter by Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. WASM"
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                  className="rounded-lg bg-[#14151B] border border-[#27282F] px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#71717A] mb-1">
                  Filter by Competitor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cloudflare"
                  value={filterCompetitor}
                  onChange={(e) => setFilterCompetitor(e.target.value)}
                  className="rounded-lg bg-[#14151B] border border-[#27282F] px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="ml-auto self-end">
                <button
                  onClick={() => {
                    setFilterTopic("");
                    setFilterCompetitor("");
                  }}
                  className="text-xs text-[#71717A] hover:text-white underline"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-16 text-[#71717A] text-sm">
                No historical radar records matching criteria.
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((h, hIdx) => (
                  <div
                    key={h.id || hIdx}
                    className="rounded-xl border border-[#1F2023] bg-[#0E0F14] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{h.topic_label}</span>
                        <span className="text-xs text-[#71717A]">&bull;</span>
                        <span className="text-xs text-[#A1A1AA]">
                          {h.research_item_count} items
                        </span>
                        {h.state_change_detected && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                            State Change
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(h.competitor_connections || {}).map(([cName, cData]) => (
                          <div
                            key={cName}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#14151B] border border-[#26282E] text-[11px]"
                          >
                            <span className="text-[#A1A1AA]">{cName}:</span>
                            {getStatusBadge(cData.status)}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-[#71717A] md:text-right shrink-0">
                      <div>Cycle: {h.cycle_id}</div>
                      <div className="text-[11px] text-[#52525B]">
                        {new Date(h.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Topic Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#27282F] bg-[#111218] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Add Research Radar Topic</h3>
            <p className="mt-1 text-xs text-[#8E8F99]">
              Configure domain areas to monitor. PrismIQ cross-references these topics against your tracked competitors.
            </p>

            <form onSubmit={handleAddTopic} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">
                  Topic Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WASM at the edge"
                  value={newTopicLabel}
                  onChange={(e) => setNewTopicLabel(e.target.value)}
                  className="w-full rounded-lg bg-[#181920] border border-[#2E303A] px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">
                  Keywords / Search Terms (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="wasm, webassembly, edge runtime, microvm"
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  className="w-full rounded-lg bg-[#181920] border border-[#2E303A] px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                />
                <p className="mt-1 text-[11px] text-[#52525B]">
                  Used for scoped arXiv queries and competitor signal matching.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#16171E] border border-[#24252E] text-[11px] text-[#71717A]">
                ℹ️ <strong>Stage 1 Discipline</strong>: Manual entry only. Automated suggestion generation is deferred to future stages to prevent ungrounded topic guesses.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#A1A1AA] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTopicLabel.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition"
                >
                  {submitting ? "Adding..." : "Save Topic"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
