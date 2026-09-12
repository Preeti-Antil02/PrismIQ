"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchWorkspaceTopics,
  createWorkspaceTopic,
  updateTopicStatus,
  deleteWorkspaceTopic,
  type ResearchTopic,
} from "@/lib/api";
import {
  WriteStatusBanner,
  type WriteOperationStatus,
} from "@/components/shared/WorkspaceControls";
import {
  Radar,
  Plus,
  Pause,
  Play,
  Trash2,
  Tag,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCw,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TopicsPage() {
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Add Topic Modal State
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newTopicLabel, setNewTopicLabel] = React.useState("");
  const [newKeywordsInput, setNewKeywordsInput] = React.useState("");
  const [addStatus, setAddStatus] = React.useState<WriteOperationStatus>("idle");
  const [addError, setAddError] = React.useState<string | null>(null);

  // Per-topic operation states (keyed by topic ID)
  const [actionStates, setActionStates] = React.useState<
    Record<string, { status: WriteOperationStatus; error?: string | null }>
  >({});
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const loadTopics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceTopics(true); // include paused
      setTopics(data);
    } catch (err: any) {
      setError(err.message || "Failed to load research topics.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  // Handle Add Topic
  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = newTopicLabel.trim();
    if (!cleanLabel) return;

    const keywords = newKeywordsInput
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    setAddStatus("pending");
    setAddError(null);
    try {
      await createWorkspaceTopic(cleanLabel, keywords);
      setAddStatus("success");
      setNewTopicLabel("");
      setNewKeywordsInput("");
      await loadTopics();
      setTimeout(() => {
        setShowAddModal(false);
        setAddStatus("idle");
      }, 1200);
    } catch (err: any) {
      setAddError(err.message || "Failed to create research topic");
      setAddStatus("error");
    }
  };

  // Handle Pause/Resume Toggle
  const handleToggleStatus = async (topic: ResearchTopic) => {
    const topicId = topic.id;
    const currentActive = topic.is_active ?? true;
    const nextActive = !currentActive;

    setActionStates((prev) => ({
      ...prev,
      [topicId]: { status: "pending", error: null },
    }));

    try {
      await updateTopicStatus(topicId, nextActive);
      setActionStates((prev) => ({
        ...prev,
        [topicId]: { status: "success" },
      }));
      await loadTopics();
      setTimeout(() => {
        setActionStates((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });
      }, 1500);
    } catch (err: any) {
      setActionStates((prev) => ({
        ...prev,
        [topicId]: {
          status: "error",
          error: err.message || "Failed to update topic status",
        },
      }));
    }
  };

  // Handle Delete Topic
  const handleDeleteTopic = async (topicId: string) => {
    setActionStates((prev) => ({
      ...prev,
      [topicId]: { status: "pending", error: null },
    }));

    try {
      await deleteWorkspaceTopic(topicId);
      setActionStates((prev) => ({
        ...prev,
        [topicId]: { status: "success" },
      }));
      setDeleteConfirmId(null);
      await loadTopics();
    } catch (err: any) {
      setActionStates((prev) => ({
        ...prev,
        [topicId]: {
          status: "error",
          error: err.message || "Failed to delete topic",
        },
      }));
    }
  };

  const activeTopics = topics.filter((t) => t.is_active ?? true);
  const pausedTopics = topics.filter((t) => !(t.is_active ?? true));
  const totalKeywords = topics.reduce(
    (acc, t) => acc + (t.keywords ? t.keywords.length : 0),
    0
  );

  const liveParsedKeywords = newKeywordsInput
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <Radar className="h-4 w-4" />
              <span>Workspace Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              Research Topics
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Configure topics evaluated by the Field Research Radar. Pausing a topic preserves historical
              signal evidence while omitting it from future autonomous evaluation cycles.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm self-start md:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Research Topic</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Active Topics</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {loading ? "-" : activeTopics.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Scanned during daily 00:00 UTC cycle</p>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Paused Topics</span>
              <Pause className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {loading ? "-" : pausedTopics.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Evaluations preserved in Postgres</p>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Monitored Keywords</span>
              <Tag className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {loading ? "-" : totalKeywords}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Targeted research query patterns</p>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Classification Engine</span>
              <ShieldCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              4-State
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Adopting / Researching / Talking / None</p>
          </div>
        </div>

        {/* Historical Integrity Callout */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-foreground">Historical Auditability Guarantee:</strong> Pausing a topic stops the daily
            crawler from generating new evaluations without dropping prior evaluation records or evidence signals from PostgreSQL.
            Historical radar findings remain fully queryable in the Research Radar timeline.
          </p>
        </div>

        {/* Topic List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading research topics...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load research topics</span>
            </div>
            <p className="text-xs">{error}</p>
            <button
              type="button"
              onClick={loadTopics}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/20 text-xs font-semibold hover:bg-destructive/30 transition-colors cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center py-16 px-4 border border-dashed border-border rounded-xl">
            <Radar className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-3 text-base font-semibold text-foreground">No research topics configured</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Add your first research topic to begin tracking technology adoptions and arXiv papers across competitors.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add First Topic</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => {
              const isActive = topic.is_active ?? true;
              const opState = actionStates[topic.id];
              const isPending = opState?.status === "pending";
              const isConfirming = deleteConfirmId === topic.id;

              return (
                <div
                  key={topic.id}
                  className={cn(
                    "p-6 rounded-xl border transition-all shadow-xs",
                    isActive
                      ? "border-border bg-card/80 backdrop-blur-sm"
                      : "border-border/60 bg-muted/20 opacity-80"
                  )}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-foreground">
                          {topic.topic_label}
                        </h3>

                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>Active Monitoring</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Pause className="h-3 w-3" />
                            <span>Paused (History Preserved)</span>
                          </span>
                        )}

                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase tracking-wider">
                          {topic.source || "manual"}
                        </span>
                      </div>

                      {/* Keywords list */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-medium text-muted-foreground mr-1">
                          Keywords:
                        </span>
                        {topic.keywords && topic.keywords.length > 0 ? (
                          topic.keywords.map((kw, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary border border-primary/20"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              <span>{kw}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            No keywords configured
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-3 self-end lg:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(topic)}
                        disabled={isPending}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50",
                          isActive
                            ? "bg-muted/50 text-foreground border-border hover:bg-muted"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        )}
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isActive ? (
                          <>
                            <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Pause Topic</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            <span>Resume Topic</span>
                          </>
                        )}
                      </button>

                      {!isConfirming ? (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(topic.id)}
                          disabled={isPending}
                          title="Delete research topic"
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
                          <span className="text-destructive font-semibold text-[11px]">Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTopic(topic.id)}
                            className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground font-bold text-[11px] hover:bg-destructive/90 cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {opState && (
                    <div className="mt-3">
                      <WriteStatusBanner
                        status={opState.status}
                        errorMessage={opState.error}
                        successMessage={
                          isActive ? "Topic resumed successfully" : "Topic paused (evaluation history preserved)"
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Topic Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase">
                  <Radar className="h-4 w-4" />
                  <span>Configure Topic</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-foreground">Add Research Radar Topic</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Radar topics search arXiv, research preprints, technical whitepapers, and engineering blogs for adoption indicators.
                </p>
              </div>

              <form onSubmit={handleAddTopic} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Topic Label</label>
                  <input
                    type="text"
                    required
                    value={newTopicLabel}
                    onChange={(e) => setNewTopicLabel(e.target.value)}
                    placeholder="e.g. WASM at the edge, Vector database sharding"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Monitored Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={newKeywordsInput}
                    onChange={(e) => setNewKeywordsInput(e.target.value)}
                    placeholder="e.g. wasm, webassembly, edge runtime, v8 isolate"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />

                  {liveParsedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <span className="text-[11px] text-muted-foreground mr-1">Parsed tags:</span>
                      {liveParsedKeywords.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <WriteStatusBanner
                  status={addStatus}
                  errorMessage={addError}
                  successMessage="Research topic added to tenant watchlist!"
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
                    disabled={addStatus === "pending" || !newTopicLabel.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {addStatus === "pending" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>Create Topic</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
