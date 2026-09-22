"use client";

import * as React from "react";
import {
  Compass,
  Plus,
  Trash2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Loader2,
  RefreshCw,
  X,
  Sparkles,
} from "lucide-react";
import { useWorkspace } from "./AppShell";
import {
  PrismCard,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismSectionHeader,
} from "./PrismPrimitives";
import {
  fetchWorkspaceTopics,
  createWorkspaceTopic,
  updateTopicStatus,
  deleteWorkspaceTopic,
  type ResearchTopic,
} from "@/lib/api";

export function TopicsPage() {
  const { targetCompany } = useWorkspace();

  const [loading, setLoading] = React.useState(true);
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // New topic modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [topicLabel, setTopicLabel] = React.useState("");
  const [keywordsText, setKeywordsText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadTopics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchWorkspaceTopics(true);
      setTopics(list || []);
    } catch (err: any) {
      setError(err.message || "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  // Create topic
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicLabel.trim()) return;
    setIsSubmitting(true);
    try {
      const keywords = keywordsText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      await createWorkspaceTopic(topicLabel.trim(), keywords.length > 0 ? keywords : [topicLabel.trim()]);
      setTopicLabel("");
      setKeywordsText("");
      setModalOpen(false);
      await loadTopics();
    } catch (err: any) {
      alert(`Failed to create topic: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (topic: ResearchTopic) => {
    const newStatus = !(topic.is_active ?? true);
    try {
      await updateTopicStatus(topic.id, newStatus);
      await loadTopics();
    } catch (err: any) {
      alert(`Could not update status: ${err.message}`);
    }
  };

  // Delete topic
  const handleDelete = async (topicId: string, label: string) => {
    if (!confirm(`Are you sure you want to delete topic "${label}"?`)) return;
    try {
      await deleteWorkspaceTopic(topicId);
      await loadTopics();
    } catch (err: any) {
      alert(`Could not delete topic: ${err.message}`);
    }
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Research Configuration
          </div>
          <h1 className="app-title-lg">
            Research Topics for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-2xl">
            Configure the technical domains and keywords monitored during academic, preprint, and patent sweeps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrismButton variant="light" size="sm" onClick={loadTopics}>
            <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
            <span>Refresh</span>
          </PrismButton>
          <PrismButton variant="dark" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Topic</span>
          </PrismButton>
        </div>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={3} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Topics"
          description={error}
          actionText="Retry"
          onAction={loadTopics}
        />
      ) : topics.length === 0 ? (
        <PrismEmptyState
          icon={<Compass className="w-6 h-6" />}
          title="No Research Topics Configured"
          description="Create your first research topic to monitor relevant papers and disclosures for your workspace."
          actionText="Add Research Topic"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          <PrismSectionHeader
            title={`Configured Topics (${topics.length})`}
            subtitle="Active topics are evaluated continuously against arXiv, Semantic Scholar, and technical releases."
          />

          <div className="space-y-3">
            {topics.map((topic) => {
              const isActive = topic.is_active ?? true;
              return (
                <PrismCard
                  key={topic.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-[#17171b]">
                        {topic.topic_label}
                      </h3>
                      <span
                        className={`app-pill text-[10px] font-bold ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                        }`}
                      >
                        {isActive ? "Active Monitoring" : "Paused"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {topic.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-zinc-100 text-[11px] font-semibold text-[#4b5563]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[rgba(20,20,30,0.06)]">
                    <button
                      onClick={() => handleToggleStatus(topic)}
                      className="p-1.5 text-[#70717a] hover:text-[#17171b] rounded-lg hover:bg-zinc-100 transition-colors flex items-center gap-1 text-xs font-semibold"
                      title={isActive ? "Pause Topic" : "Resume Topic"}
                    >
                      {isActive ? (
                        <>
                          <PauseCircle className="w-4 h-4 text-amber-600" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4 text-emerald-600" />
                          <span>Resume</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(topic.id, topic.topic_label)}
                      className="p-1.5 text-[#9ca3af] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete Topic"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </PrismCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-3xl border border-[rgba(20,20,30,0.10)] shadow-2xl p-6 sm:p-8 z-10 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#6e57dc] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="app-title-sm">Add Research Topic</h3>
                  <p className="text-xs text-[#70717a]">
                    Configure domain keywords for {targetCompany}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#9ca3af] hover:text-[#17171b] rounded-lg hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#17171b] mb-1">
                  Topic Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Generative Search & Recommendation Systems"
                  value={topicLabel}
                  onChange={(e) => setTopicLabel(e.target.value)}
                  className="app-search-input w-full max-w-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17171b] mb-1">
                  Keywords (comma-separated)
                </label>
                <textarea
                  placeholder="e.g. semantic retrieval, graph neural networks, ranking latency"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  className="app-search-input w-full max-w-none h-24 py-2 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <PrismButton variant="light" size="sm" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </PrismButton>
                <PrismButton variant="dark" size="sm" type="submit" disabled={isSubmitting || !topicLabel.trim()}>
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Save Topic</span>
                </PrismButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
