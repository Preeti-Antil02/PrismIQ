"use client";
import { sanitizeSourceUrl } from "@/lib/urlUtils";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Flame,
  ArrowRight,
  TrendingUp,
  FileText,
  CalendarDays,
  Radio,
  ExternalLink,
  ShieldCheck,
  Building2,
  Clock,
  Layers,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  Target,
  X,
  Filter,
  ArrowUpRight,
  Workflow,
  Calendar,
  BarChart2,
  PieChart,
  Activity,
  TrendingDown,
  RotateCcw,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "./AppShell";
import {
  PrismDonutChart,
  PrismHorizontalBarChart,
  PrismStackedBarChart,
} from "@/components/ui/VisualCharts";
import {
  PrismCard,
  PrismTierBadge,
  PrismConfidenceBadge,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismSectionHeader,
  PrismCompanyBadge,
} from "./PrismPrimitives";
import { BattlecardView } from "./battlecard/BattlecardView";
import { NextBestActionsView } from "./nextbestactions/NextBestActionsView";
import {
  fetchTrackedCompanies,
  fetchEvents,
  fetchSignals,
  fetchLatestRadar,
  fetchFindings,
  fetchWorkspaceTopics,
  buildCompetitorSummaries,
  fetchDecisionSupportItems,
  updateDecisionSupportActionStatus,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type ResearchTopic,
  type CompetitorActivitySummary,
  type DecisionSupportRecord,
  type DecisionSupportEvidence,
} from "@/lib/api";

function getDepartmentBadgeClass(dept: string): string {
  const d = dept.toLowerCase();
  if (d.includes("product")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (d.includes("sales")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (d.includes("market") || d.includes("growth")) return "bg-violet-50 text-violet-700 border-violet-200";
  if (d.includes("engineer") || d.includes("devrel")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (d.includes("leader") || d.includes("exec")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (d.includes("research") || d.includes("ai")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (d.includes("finance")) return "bg-teal-50 text-teal-700 border-teal-200";
  if (d.includes("security") || d.includes("legal")) return "bg-slate-100 text-slate-700 border-slate-300";
  if (d.includes("partner")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (d.includes("success") || d.includes("support")) return "bg-orange-50 text-orange-700 border-orange-200";
  if (d.includes("operation")) return "bg-zinc-100 text-zinc-700 border-zinc-200";
  return "bg-purple-50 text-[#6e57dc] border-purple-200";
}

function getThreatTypeBadgeClass(threatType?: string): string {
  const tt = (threatType || "").toLowerCase();
  if (tt.includes("direct")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (tt.includes("indirect") || tt.includes("operational")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (tt.includes("technology")) return "bg-purple-50 text-[#6e57dc] border-purple-200";
  if (tt.includes("opportunity") || tt.includes("market")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function getPriorityBadgeClass(priority?: string): string {
  const p = (priority || "").toLowerCase();
  if (p.includes("crit")) return "bg-rose-950/60 text-rose-300 border-rose-800/80";
  if (p.includes("high")) return "bg-amber-950/60 text-amber-300 border-amber-800/80";
  if (p.includes("med")) return "bg-blue-950/60 text-blue-300 border-blue-800/80";
  return "bg-zinc-800 text-zinc-400 border-zinc-700";
}

function getUrgencyBadgeConfig(urgency: string): { bg: string; text: string; border: string; dot: string } {
  const u = (urgency || "").toLowerCase();
  if (u.includes("high")) return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };
  if (u.includes("med")) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" };
  return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" };
}

const DIMENSION_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  hiring: { bg: "bg-blue-50/80", text: "text-blue-700", border: "border-blue-200", label: "Hiring Signal" },
  compliance: { bg: "bg-emerald-50/80", text: "text-emerald-700", border: "border-emerald-200", label: "Compliance & Security" },
  pricing: { bg: "bg-amber-50/80", text: "text-amber-700", border: "border-amber-200", label: "Pricing Structure" },
  proof: { bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200", label: "Case Study / Proof" },
  proof_point: { bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200", label: "Case Study / Proof" },
  go_to_market: { bg: "bg-indigo-50/80", text: "text-indigo-700", border: "border-indigo-200", label: "GTM / Field Sales" },
  partnerships: { bg: "bg-cyan-50/80", text: "text-cyan-700", border: "border-cyan-200", label: "Strategic Alliance" },
  product: { bg: "bg-violet-50/80", text: "text-violet-700", border: "border-violet-200", label: "Product Infrastructure" },
  infrastructure: { bg: "bg-teal-50/80", text: "text-teal-700", border: "border-teal-200", label: "Core Infrastructure" },
  margin_disruption: { bg: "bg-rose-50/80", text: "text-rose-700", border: "border-rose-200", label: "Disruption Vector" },
};


const DEPT_ROUTING_MAP: Record<string, string[]> = {
  product: ["product", "category management", "merchandising", "catalog", "pricing"],
  sales: ["sales", "commercial", "merchant growth", "seller growth", "monetization"],
  marketing: ["marketing", "growth", "community operations", "community", "brand"],
  engineering: ["engineering", "infrastructure", "security", "platform", "technology", "logistics"],
  leadership: ["leadership", "executive", "executive leadership", "strategy", "founders"]
};

function matchesDepartmentRouting(whoIsAffected: string[] = [], selectedDept: string): boolean {
  if (!selectedDept || selectedDept === "ALL") return true;
  const s = selectedDept.toLowerCase().trim();
  const allowed = DEPT_ROUTING_MAP[s] || [s];
  return whoIsAffected.some((dept) => {
    const d = dept.toLowerCase().trim();
    if (d === s) return true;
    return allowed.some((term) => d.includes(term) || term.includes(d));
  });
}

function DecisionCardCountdown({ item }: { item: DecisionSupportRecord }) {
  const [timeLeft, setTimeLeft] = React.useState<string>(() => {
    if (!item.deadline_at) {
      return item.response_deadline_label || "No fixed response deadline established";
    }
    return "";
  });

  React.useEffect(() => {
    if (!item.deadline_at) {
      setTimeLeft(item.response_deadline_label || "No fixed response deadline established");
      return;
    }

    function compute() {
      const targetTime = new Date(item.deadline_at!).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("Cycle Review Due");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    }

    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [item.deadline_at, item.response_deadline_label]);

  return <span>{timeLeft}</span>;
}

function getEffectiveActionChecklist(item: DecisionSupportRecord) {
  if (item.action_checklist && item.action_checklist.length > 0) {
    return item.action_checklist;
  }
  return [];
}

function ActionablePlaybookChecklist({
  itemId,
  actions,
  companyName,
  tenantId
}: {
  itemId: string;
  actions: any[];
  companyName: string;
  tenantId?: string;
}) {
  const storageKey = `prismiq_ds_checklist_${itemId}`;
  const [statuses, setStatuses] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const a of actions) {
      if (a.status && a.status !== "Pending") {
        initial[a.id] = a.status;
      }
    }
    return initial;
  });
  const [expandedActions, setExpandedActions] = React.useState<Record<string, boolean>>({});
  const [syncState, setSyncState] = React.useState<"idle" | "saving" | "synced">("idle");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStatuses((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore
    }
  }, [storageKey]);

  if (actions.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
          <span>Continuous surveillance active on official endpoints. Action playbook triggers automatically on verified inflection.</span>
        </div>
      </div>
    );
  }

  const updateStatus = async (actionId: string, newStatus: string) => {
    let nextStatus = newStatus;
    if (statuses[actionId] === newStatus) {
      nextStatus = "Pending";
    }

    setStatuses((prev) => {
      const next = { ...prev };
      if (nextStatus === "Pending") {
        delete next[actionId];
      } else {
        next[actionId] = nextStatus;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // LocalStorage quota/access handling
      }
      return next;
    });

    setSyncState("saving");
    try {
      await updateDecisionSupportActionStatus(itemId, actionId, nextStatus, undefined, tenantId);
      setSyncState("synced");
      setTimeout(() => setSyncState("idle"), 2500);
    } catch (e) {
      console.warn("Could not sync action status to backend DB:", e);
      setSyncState("idle");
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {syncState !== "idle" && (
        <div className={`text-[10px] ${syncState === "synced" ? "text-emerald-400" : "text-zinc-400 animate-pulse"}`}>
          {syncState === "saving" ? "Saving action status…" : "✓ Saved to DB"}
        </div>
      )}
      <div className="space-y-2">
        {actions.map((act) => {
          const status = statuses[act.id];
          const priority = act.priority || "High";
          return (
            <div
              key={act.id}
              className={`p-2.5 rounded-lg border transition-all text-xs ${
                status === "Completed"
                  ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-100"
                  : status === "Accepted"
                  ? "bg-teal-950/40 border-teal-500/40 text-teal-100"
                  : status === "In Progress"
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-100"
                  : status === "Dismissed"
                  ? "bg-zinc-800/40 border-zinc-700 text-zinc-500 line-through"
                  : "bg-zinc-800/70 border-zinc-700/70 text-zinc-200 hover:border-zinc-600"
              }`}
            >
              <button
                type="button"
                aria-expanded={Boolean(expandedActions[act.id])}
                onClick={() => setExpandedActions((prev) => ({ ...prev, [act.id]: !prev[act.id] }))}
                className="w-full min-h-9 flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <span className="min-w-0 flex items-center gap-1.5 flex-wrap">
                  {act.department && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-zinc-700/80 text-zinc-300 border border-zinc-600">
                      {act.department}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border ${getPriorityBadgeClass(priority)}`}>
                    {priority}
                  </span>
                    {act.suggested_deadline && (
                      <span className="text-[10px] text-zinc-400 font-medium">
                        ⏱ {act.suggested_deadline}
                      </span>
                    )}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform ${expandedActions[act.id] ? "rotate-90" : ""}`} />
              </button>

              {expandedActions[act.id] && (
                <div className="mt-2 space-y-2">
                  <div className="font-medium leading-snug">{act.title || act.text}</div>
                  {act.suggested_next_step && (
                    <div className="text-[11px] text-purple-300 font-normal">
                      <span className="font-bold text-purple-200">Next:</span> {act.suggested_next_step}
                    </div>
                  )}
              {/* Status selector buttons */}
              <div className="flex items-center gap-1.5 not-italic flex-wrap">
                <button
                  type="button"
                  onClick={() => updateStatus(act.id, "In Progress")}
                  className={`min-h-8 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    status === "In Progress"
                      ? "bg-amber-500 text-black shadow-xs font-black"
                      : "bg-zinc-700/60 hover:bg-zinc-600/80 text-zinc-400 hover:text-amber-200"
                  }`}
                  title="Mark action In Progress"
                >
                  In Progress
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(act.id, "Accepted")}
                  className={`min-h-8 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    status === "Accepted"
                      ? "bg-teal-500 text-black shadow-xs font-black"
                      : "bg-zinc-700/60 hover:bg-zinc-600/80 text-zinc-400 hover:text-teal-200"
                  }`}
                  title="Mark action Accepted"
                >
                  Accepted
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(act.id, "Completed")}
                  className={`min-h-8 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    status === "Completed"
                      ? "bg-emerald-500 text-black shadow-xs font-black"
                      : "bg-zinc-700/60 hover:bg-zinc-600/80 text-zinc-400 hover:text-emerald-200"
                  }`}
                  title="Mark action Completed"
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(act.id, "Dismissed")}
                  className={`min-h-8 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    status === "Dismissed"
                      ? "bg-zinc-600 text-white font-black"
                      : "bg-zinc-700/60 hover:bg-zinc-600/80 text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Mark action Dismissed"
                >
                  Dismiss
                </button>
                {status && status !== "Pending" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(act.id, "Pending")}
                    className="min-h-8 px-2 py-1 rounded text-[10px] font-medium bg-zinc-700/40 hover:bg-zinc-600 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    title="Reset to Pending"
                  >
                    Reopen
                  </button>
                )}
              </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { targetCompany, tenantId, triggerSweep, isSweeping } = useWorkspace();
  const { openEvidence } = useAppEvidence();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [findings, setFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [decisionItems, setDecisionItems] = React.useState<DecisionSupportRecord[]>([]);
  const [selectedDept, setSelectedDept] = React.useState<string>("ALL");
  const [selectedUrgency, setSelectedUrgency] = React.useState<string>("ALL");
  const [mainPageTab, setMainPageTab] = React.useState<"overview" | "battlecards" | "next_best_actions">("overview");
  const [selectedBattlecardCompetitor, setSelectedBattlecardCompetitor] = React.useState<string>(targetCompany || "OpenAI");
  const [expandedWhyAssessment, setExpandedWhyAssessment] = React.useState<Record<string, boolean>>({});
  const [expandedWhyMatters, setExpandedWhyMatters] = React.useState<Record<string, boolean>>({});
  const [activeEvidenceItem, setActiveEvidenceItem] = React.useState<DecisionSupportRecord | null>(null);
  const [expandedDecisionItem, setExpandedDecisionItem] = React.useState<DecisionSupportRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compsRes, eventsRes, signalsRes, findingsRes, radarRes, topicsRes, decisionRes] =
        await Promise.allSettled([
          fetchTrackedCompanies(tenantId),
          fetchEvents({ limit: 100, tenantId }),
          fetchSignals({ limit: 200, tenantId }),
          fetchFindings(tenantId),
          fetchLatestRadar(tenantId),
          fetchWorkspaceTopics(true, tenantId),
          fetchDecisionSupportItems(undefined, tenantId),
        ]);

      if (compsRes.status === "fulfilled") setTrackedCompanies(compsRes.value || []);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value?.events || []);
      if (signalsRes.status === "fulfilled") setSignals(signalsRes.value?.signals || []);
      if (findingsRes.status === "fulfilled") setFindings(findingsRes.value?.findings || []);
      if (radarRes.status === "fulfilled") setRadarEvals(radarRes.value?.evaluations || []);
      if (topicsRes.status === "fulfilled") setTopics(topicsRes.value || []);
      if (decisionRes.status === "fulfilled") setDecisionItems(decisionRes.value?.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle escape key to dismiss fullscreen modals
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expandedDecisionItem) {
          setExpandedDecisionItem(null);
        } else if (activeEvidenceItem) {
          setActiveEvidenceItem(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedDecisionItem, activeEvidenceItem]);

  React.useEffect(() => {
    if (targetCompany && (!selectedBattlecardCompetitor || selectedBattlecardCompetitor === "OpenAI")) {
      setSelectedBattlecardCompetitor(targetCompany);
    }
  }, [targetCompany, selectedBattlecardCompetitor]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "battlecards" || t === "battlecard") {
        setMainPageTab("battlecards");
      }
      const c = new URLSearchParams(window.location.search).get("competitor");
      if (c) {
        setSelectedBattlecardCompetitor(c);
      }
    }
  }, []);

  // Compute summaries
  const competitorSummaries: CompetitorActivitySummary[] = React.useMemo(() => {
    if (trackedCompanies.length === 0) return [];
    return buildCompetitorSummaries(trackedCompanies, signals, events, findings, radarEvals);
  }, [trackedCompanies, signals, events, findings, radarEvals]);

  const battlecardCompetitorOptions = React.useMemo(() => {
    const list: string[] = [];
    if (targetCompany && !list.includes(targetCompany)) list.push(targetCompany);
    trackedCompanies.forEach((c) => {
      if (c.company_name && !list.includes(c.company_name)) {
        list.push(c.company_name);
      }
    });
    decisionItems.forEach((d) => {
      if (d.company_name && !list.includes(d.company_name)) {
        list.push(d.company_name);
      }
    });
    return list.length > 0 ? list : ["OpenAI", "Anthropic", "Google"];
  }, [targetCompany, trackedCompanies, decisionItems]);

  // Real-time Department counts for Point 5 filter tabs (12 canonical departments)
  const canonicalDepartments = React.useMemo(() => [
    "Product", "Sales", "Marketing", "Engineering", "Leadership",
    "Research", "Finance", "Security", "Legal", "Partnerships", "Customer Success", "Operations"
  ], []);

  const departmentCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      ALL: decisionItems.length,
    };
    canonicalDepartments.forEach((dept) => {
      counts[dept] = 0;
    });
    decisionItems.forEach((item) => {
      canonicalDepartments.forEach((dept) => {
        if (matchesDepartmentRouting(item.who_is_affected, dept)) {
          counts[dept] = (counts[dept] || 0) + 1;
        }
      });
    });
    return counts;
  }, [decisionItems, canonicalDepartments]);

  const activeDepartmentTabs = React.useMemo(() => {
    const primary = ["Product", "Sales", "Marketing", "Engineering", "Leadership"];
    const extra = canonicalDepartments.filter(
      (dept) => !primary.includes(dept) && (departmentCounts[dept] || 0) > 0
    );
    return ["ALL", ...primary, ...extra];
  }, [canonicalDepartments, departmentCounts]);

  // Real-time Urgency counts for Point 5 filter tabs
  const urgencyCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      ALL: decisionItems.length,
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    decisionItems.forEach((item) => {
      const u = (item.urgency || "High").toLowerCase();
      if (u.includes("crit")) counts.Critical = (counts.Critical || 0) + 1;
      else if (u.includes("high")) counts.High = (counts.High || 0) + 1;
      else if (u.includes("med")) counts.Medium = (counts.Medium || 0) + 1;
      else counts.Low = (counts.Low || 0) + 1;
    });
    return counts;
  }, [decisionItems]);

  // Filtered Decision Support Items with Executive Semantic Routing
  const filteredDecisionItems = React.useMemo(() => {
    return decisionItems.filter((item) => {
      const matchDept = matchesDepartmentRouting(item.who_is_affected, selectedDept);
      const itemUrg = (item.urgency || "High").toLowerCase();
      const selUrg = selectedUrgency.toLowerCase();
      const matchUrgency =
        selectedUrgency === "ALL" ||
        itemUrg === selUrg ||
        (selUrg === "critical" && itemUrg.includes("crit")) ||
        (selUrg === "high" && (itemUrg.includes("high") || itemUrg.includes("crit"))) ||
        (selUrg === "medium" && itemUrg.includes("med")) ||
        (selUrg === "low" && itemUrg.includes("low"));
      return matchDept && matchUrgency;
    });
  }, [decisionItems, selectedDept, selectedUrgency]);

  // Recent 5 verified events for quick audit
  const recentEvents = React.useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const tA = a.published_timestamp || a.published_at || "";
        const tB = b.published_timestamp || b.published_at || "";
        return tB.localeCompare(tA);
      })
      .slice(0, 5);
  }, [events]);

  // Visual Analytics Aggregations (from actual live signals, events, and summaries)
  const sourceDistribution = React.useMemo(() => {
    const counts: Record<string, number> = { news: 0, github: 0, jobs: 0, pricing: 0, research: 0, other: 0 };
    signals.forEach((s) => {
      const src = (s.source || "").toLowerCase();
      if (src.includes("news")) counts.news++;
      else if (src.includes("git")) counts.github++;
      else if (src.includes("job") || src.includes("career")) counts.jobs++;
      else if (src.includes("pric")) counts.pricing++;
      else if (src.includes("research") || src.includes("arxiv")) counts.research++;
      else counts.other++;
    });

    return [
      { label: "News & Media", value: counts.news, color: "#0ea5e9" },
      { label: "Research & Patents", value: counts.research, color: "#8b5cf6" },
      { label: "Code Repositories", value: counts.github, color: "#10b981" },
      { label: "Hiring & Roles", value: counts.jobs, color: "#f59e0b" },
      { label: "Pricing & Plans", value: counts.pricing, color: "#ec4899" },
      ...(counts.other > 0 ? [{ label: "Other Sources", value: counts.other, color: "#64748b" }] : []),
    ].filter((d) => d.value > 0);
  }, [signals]);

  const tierDistribution = React.useMemo(() => {
    let must = 0;
    let should = 0;
    let nice = 0;
    events.forEach((e) => {
      const t = (e.tier || "").toLowerCase();
      if (t.includes("must")) must++;
      else if (t.includes("should")) should++;
      else nice++;
    });
    return [
      { label: "Must-Know", value: must, color: "#f43f5e" },
      { label: "Should-Know", value: should, color: "#f59e0b" },
      { label: "Nice-to-Know", value: nice, color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [events]);

  const competitorActivityBars = React.useMemo(() => {
    return [...competitorSummaries]
      .filter((c) => c.total_signals > 0 || c.total_events > 0)
      .sort((a, b) => b.total_signals + b.total_events * 2 - (a.total_signals + a.total_events * 2))
      .slice(0, 6)
      .map((c) => ({
        label: c.company_name,
        value: c.total_signals + c.total_events,
        badge: c.is_target ? "Target" : undefined,
        secondaryText: `${c.total_events} ev / ${c.total_signals} sig`,
        color: c.is_target ? "#6e57dc" : "#3b82f6",
      }));
  }, [competitorSummaries]);

  const competitorTierStackedRows = React.useMemo(() => {
    return [...competitorSummaries]
      .filter((c) => c.total_events > 0)
      .sort((a, b) => b.total_events - a.total_events)
      .slice(0, 5)
      .map((c) => {
        const must = c.must_know_count || 0;
        const should = c.should_know_count || 0;
        const nice = Math.max(0, c.total_events - must - should);
        return {
          label: c.company_name,
          isTarget: c.is_target,
          totalLabel: `${c.total_events} events`,
          segments: [
            { label: "Must-Know", value: must, color: "#f43f5e" },
            { label: "Should-Know", value: should, color: "#f59e0b" },
            { label: "Nice-to-Know", value: nice, color: "#cbd5e1" },
          ],
        };
      });
  }, [competitorSummaries]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PrismLoadingSkeleton type="hero" />
        <PrismLoadingSkeleton type="cards" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs: Executive Overview vs Battlecards vs Next Best Actions */}
      <div className="flex items-center gap-2 border-b border-[rgba(20,20,30,0.08)]">
        <button
          type="button"
          onClick={() => setMainPageTab("overview")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            mainPageTab === "overview"
              ? "border-[#6e57dc] text-[#17171b] font-bold"
              : "border-transparent text-[#70717a] hover:text-[#17171b]"
          }`}
        >
          <Activity className="w-4 h-4 text-[#6e57dc]" />
          <span>Executive Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setMainPageTab("battlecards")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            mainPageTab === "battlecards"
              ? "border-amber-500 text-[#17171b] font-bold"
              : "border-transparent text-[#70717a] hover:text-[#17171b]"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>Battlecards</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
            Live
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMainPageTab("next_best_actions")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            mainPageTab === "next_best_actions"
              ? "border-violet-600 text-[#17171b] font-bold"
              : "border-transparent text-[#70717a] hover:text-[#17171b]"
          }`}
        >
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span>Next Best Actions</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
            Decision Engine
          </span>
        </button>
      </div>

      {mainPageTab === "battlecards" ? (
        <div className="space-y-6">
          {/* Competitor Selector Bar */}
          <div className="p-4 rounded-xl bg-white border border-[rgba(20,20,30,0.08)] shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#70717a] uppercase tracking-wider mr-1">
                Select Competitor:
              </span>
              {battlecardCompetitorOptions.map((comp) => (
                <button
                  key={comp}
                  type="button"
                  onClick={() => setSelectedBattlecardCompetitor(comp)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedBattlecardCompetitor.toLowerCase() === comp.toLowerCase()
                      ? "bg-[#17171b] text-white shadow-xs"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {comp}
                </button>
              ))}
            </div>
            <div className="text-xs text-[#70717a] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Evidence-Linked Battlecard · Freshness Monitored</span>
            </div>
          </div>

          {/* Embedded Battlecard */}
          <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-white p-6 shadow-xs">
            <BattlecardView competitorName={selectedBattlecardCompetitor} tenantId={tenantId} />
          </div>
        </div>
      ) : mainPageTab === "next_best_actions" ? (
        <NextBestActionsView
          targetCompany={targetCompany}
          tenantId={tenantId}
          onOpenBattlecard={(comp) => {
            setSelectedBattlecardCompetitor(comp);
            setMainPageTab("battlecards");
          }}
          onOpenCustomerVoice={(comp) => {
            router.push(`/app/competitors/${encodeURIComponent(comp.toLowerCase())}?tab=voice`);
          }}
          onOpenDealRoom={(dealId) => {
            router.push(`/app/workspace/delivery?dealId=${dealId}`);
          }}
        />
      ) : (
        <>
          {/* 1. Header & Quick Pulse Metrics */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#17171b]">
                Competitive Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-[#70717a] mt-1">
                Real-time multi-channel surveillance across your tracked landscape.
              </p>
            </div>

        <div className="flex items-center gap-2.5">
          <PrismButton
            variant="light"
            size="sm"
            onClick={loadData}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </PrismButton>
          <PrismButton
            variant="dark"
            size="sm"
            onClick={triggerSweep}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-300" />
            {isSweeping ? "Sweeping..." : "Run Intelligence Sweep"}
          </PrismButton>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Tracked Landscape
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">
            {trackedCompanies.length}
          </div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>Target: <strong className="text-[#17171b]">{targetCompany}</strong></span>
            <Link href="/app/competitors" className="text-[#6e57dc] font-semibold hover:underline">
              Landscape
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Verified Canonical Events
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{events.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>{events.filter((e) => (e.corroboration_count || 1) >= 2).length} Multi-Source</span>
            <Link href="/app/events" className="text-[#6e57dc] font-semibold hover:underline">
              Feed
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Multi-Channel Signals
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{signals.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>5 Monitored Channels</span>
            <Link href="/app/signals" className="text-[#6e57dc] font-semibold hover:underline">
              Pipeline
            </Link>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Decision Support Items
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{decisionItems.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>{decisionItems.filter((d) => d.urgency === "High").length} High Urgency</span>
            <span className="text-[#6e57dc] font-semibold">Point 5 Live</span>
          </div>
        </PrismCard>

        <PrismCard>
          <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-1">
            Competitor Evolution
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{trackedCompanies.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>Unified Profiles &amp; Arcs</span>
            <Link href="/app/competitors" className="text-[#6e57dc] font-semibold hover:underline">
              Points 1, 2 &amp; 3 Live
            </Link>
          </div>
        </PrismCard>
      </div>

      {/* 2. "Why Should I Care?" Decision Support System Cockpit (Point 5) */}
      <div className="space-y-4">
        <PrismSectionHeader
          title="Why Should I Care? Decision Support Cockpit"
          subtitle="Executive 6-Dimension Decision Engine: What happened, why it matters, department routing, prescriptive counter-action playbook, urgency horizon with rapid countdown, and multi-source verification."
          eyebrow="Point 5 • Decision Support System"
          action={
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-50 text-[#6e57dc] border border-purple-200">
                {filteredDecisionItems.length} Actionable Items
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {decisionItems.filter((d) => (d.urgency || "").toLowerCase().includes("crit") || (d.urgency || "").toLowerCase().includes("high")).length} Immediate Priority
              </span>
            </div>
          }
        />

        {/* Filter Pills Toolbar */}
        <div className="p-3.5 bg-white rounded-xl border border-[rgba(20,20,30,0.08)] shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Department Filter with Real-Time Counts */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#70717a] mr-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#9ca3af]" />
              Department:
            </span>
            {activeDepartmentTabs.map((dept) => {
              const active = selectedDept === dept;
              const count = departmentCounts[dept] || 0;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-[#6e57dc] text-white shadow-xs"
                      : "bg-zinc-100/80 text-[#70717a] hover:bg-zinc-200/70 hover:text-[#17171b]"
                  }`}
                >
                  <span>{dept === "ALL" ? "All Departments" : dept}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      active ? "bg-white/25 text-white" : "bg-zinc-200/80 text-[#70717a]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Urgency Filter with Real-Time Counts */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#70717a] mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />
              Urgency:
            </span>
            {["ALL", "Critical", "High", "Medium", "Low"].map((urg) => {
              const active = selectedUrgency === urg;
              const count = urgencyCounts[urg] || 0;
              return (
                <button
                  key={urg}
                  type="button"
                  onClick={() => setSelectedUrgency(urg)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-[#17171b] text-white shadow-xs"
                      : "bg-zinc-100/80 text-[#70717a] hover:bg-zinc-200/70 hover:text-[#17171b]"
                  }`}
                >
                  <span>{urg === "ALL" ? "All Urgencies" : urg}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      active ? "bg-white/25 text-white" : "bg-zinc-200/80 text-[#70717a]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Decision Support Cards */}
        {filteredDecisionItems.length === 0 ? (
          <PrismEmptyState
            title="No decision support items match filter"
            description="Adjust your department or urgency filter to view synthesized competitive developments."
            actionText="Reset Filters"
            onAction={() => {
              setSelectedDept("ALL");
              setSelectedUrgency("ALL");
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredDecisionItems.map((item) => {
              const urgConfig = getUrgencyBadgeConfig(item.urgency);
              const sourceCount = item.corroboration_sources_count || item.evidence_sources?.length || 4;
              const isHighUrgency =
                (item.urgency || "").toLowerCase().includes("crit") ||
                (item.urgency || "").toLowerCase().includes("high");
              const effectiveHorizon =
                item.time_horizon ||
                (isHighUrgency ? "Immediate (<7d)" : (item.urgency === "Medium" ? "Tactical (<30d)" : "Strategic (90d+)"));

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col h-[520px] max-h-[520px] border ${
                    isHighUrgency
                      ? "border-rose-300 ring-1 ring-rose-200/70 bg-gradient-to-b from-rose-50/15 via-white to-white"
                      : "border-[rgba(20,20,30,0.10)]"
                  }`}
                >
                  {/* High-Urgency Alert Banner & Counter-Strategy Countdown */}
                  {isHighUrgency && item.deadline_at && (
                    <div className="mb-2 shrink-0 flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/5 border border-rose-200/90 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                          ⚡ Critical Counter-Window
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-rose-800 bg-white/90 px-2.5 py-0.5 rounded-lg border border-rose-200 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                        <span>Window: <DecisionCardCountdown item={item} /></span>
                      </div>
                    </div>
                  )}

                  {/* Top Bar: Company Badge + Urgency + Threat Type + Calibrated Confidence + Zoom/Expand Icon */}
                  <div className="flex items-center justify-between gap-2 flex-wrap shrink-0 pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <PrismCompanyBadge
                        name={item.company_name}
                        isTarget={item.company_name.toLowerCase() === targetCompany.toLowerCase()}
                        size="sm"
                      />
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1.5 ${urgConfig.bg} ${urgConfig.text} ${urgConfig.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${urgConfig.dot}`} />
                        {item.urgency} Urgency
                      </span>
                      {item.threat_type && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getThreatTypeBadgeClass(item.threat_type)}`}
                        >
                          {item.threat_type}
                        </span>
                      )}
                      {item.dimension && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {item.dimension}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                        {item.confidence}% Calibrated
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedDecisionItem(item)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-[#6e57dc] hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all cursor-pointer flex items-center justify-center"
                        title="Expand to Fullscreen View"
                        aria-label={`Expand ${item.company_name} to fullscreen`}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Independently Scrollable Content Area */}
                  <div
                    className="flex-1 overflow-y-auto pr-1.5 space-y-3 my-2.5 min-h-0 focus:outline-none"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {/* Target Company Affected Products Exposure */}
                    {item.affected_products && item.affected_products.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] p-2 rounded-lg bg-zinc-50 border border-zinc-200/60">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                          Exposed Target Products:
                        </span>
                        {item.affected_products.map((prod) => (
                          <span key={prod} className="px-2 py-0.5 rounded bg-white text-zinc-800 font-semibold border border-zinc-300 text-[10px] shadow-2xs">
                            {prod}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dimension 1: What Happened (Factual Grounded Inflection Summary) */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6e57dc]" />
                          1. What Happened (Factual Grounded Inflection)
                        </span>
                        {item.inflection_summary_details?.publication_date && (
                          <span className="text-[10px] text-zinc-400 font-medium">
                            Published: {item.inflection_summary_details.publication_date}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-[#17171b] leading-snug">
                        {item.what_happened}
                      </p>
                    </div>

                    {/* Dimension 2: Why It Matters (Independent Dyadic Assessment & 6-Question Matrix) */}
                    <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100/90 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          type="button"
                          aria-expanded={Boolean(expandedWhyAssessment[item.id])}
                          onClick={() => setExpandedWhyAssessment((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className="min-h-9 text-left text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#6e57dc]" />
                          2. Why It Matters (Independent Dyadic Assessment)
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedWhyAssessment[item.id] ? "rotate-90" : ""}`} />
                        </button>
                        {item.revenue_margin_exposure && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100/80 text-amber-900 border border-amber-200 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-amber-700" />
                            {item.revenue_margin_exposure.length > 50 ? item.revenue_margin_exposure.slice(0, 48) + "..." : item.revenue_margin_exposure}
                          </span>
                        )}
                      </div>

                      {expandedWhyAssessment[item.id] && (
                        <>
                          <p className="text-xs text-[#374151] leading-relaxed font-normal">
                            {item.why_it_matters}
                          </p>

                          {/* Structured 6-Question Breakdown Accordion */}
                          {item.structured_why_it_matters && (
                            <div className="pt-2 border-t border-purple-200/60">
                              <button
                                type="button"
                                onClick={() => setExpandedWhyMatters((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                                className="text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] hover:text-[#533ab7] flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>{expandedWhyMatters[item.id] ? "▾ Hide 6-Question Strategic Matrix" : "▸ Inspect 6-Question Strategic Matrix"}</span>
                              </button>

                              {expandedWhyMatters[item.id] && (
                                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white/90 p-3 rounded-lg border border-purple-100 shadow-2xs">
                                  <div>
                                    <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">1. Affected Products:</span>
                                    <span className="text-zinc-600 font-medium">
                                      {(item.structured_why_it_matters.q1_affected_products || []).join(", ") || "None specified"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">2. Overlapping Segments:</span>
                                    <span className="text-zinc-600 font-medium">
                                      {(item.structured_why_it_matters.q2_overlapping_customer_segments || []).join(", ") || "None specified"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">3. Competitor Advantage:</span>
                                    <span className="text-zinc-600 font-medium">
                                      {item.structured_why_it_matters.q3_competitor_advantage || "None verified"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">4. Business Risk / Opportunity:</span>
                                    <span className="text-zinc-600 font-medium">
                                      {item.structured_why_it_matters.q4_business_risk_or_opportunity || item.why_it_matters}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">5. Supporting Evidence:</span>
                                    <span className="text-zinc-600 font-medium">
                                      {item.structured_why_it_matters.q5_supporting_evidence_summary || `${item.corroboration_sources_count} primary sources`}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">6. Uncertain Assumptions:</span>
                                    <span className="text-zinc-600 font-medium">
                                      {item.structured_why_it_matters.q6_uncertain_assumptions || "None stated"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Dimension 3: Who Is Affected (Dynamic Department Routing) */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#9ca3af]" />
                        3. Who Is Affected (Executive Department Routing):
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(item.who_is_affected || []).map((dept) => {
                          const reason = item.department_reasons ? item.department_reasons[dept] : undefined;
                          return (
                            <span
                              key={dept}
                              title={reason || `${dept} strategic execution`}
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getDepartmentBadgeClass(dept)} cursor-help`}
                            >
                              {dept}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dimension 4: What Should We Do (Prescriptive Counter-Action Playbook) & Checklist */}
                    <div className="p-3 rounded-xl bg-zinc-900 text-white shadow-xs border border-zinc-800">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        4. What Should We Do · Counter-Action Playbook
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                        {item.what_should_we_do}
                      </p>
                      <ActionablePlaybookChecklist
                        itemId={item.id}
                        actions={getEffectiveActionChecklist(item)}
                        companyName={item.company_name}
                        tenantId={tenantId}
                      />
                    </div>

                    {/* Dimension 5: Urgency & Time Horizon */}
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a] mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#6e57dc]" />
                          5. Urgency & Time Horizon
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1.5 ${urgConfig.bg} ${urgConfig.text} ${urgConfig.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${urgConfig.dot}`} />
                            {item.urgency} Urgency
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200/80 text-zinc-800 border border-zinc-300">
                            Horizon: {effectiveHorizon}
                          </span>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <div className="text-[10px] font-bold text-[#9ca3af]">Counter-Strategy Countdown</div>
                        <div className="text-xs font-black text-[#17171b] flex items-center gap-1 sm:justify-end mt-0.5">
                          <Clock className="w-3 h-3 text-[#6e57dc]" />
                          <DecisionCardCountdown item={item} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dimension 6: Verification & Confidence Footer */}
                  <div className="pt-2.5 mt-auto border-t border-[rgba(20,20,30,0.06)] shrink-0 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        6. Verification & Confidence:
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {sourceCount} Verified Primary Sources
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                        {item.confidence}% Calibrated
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveEvidenceItem(item)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100/80 text-[#6e57dc] border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#6e57dc]" />
                      Inspect {sourceCount} Independent Sources
                      <ArrowUpRight className="w-3 h-3 text-[#6e57dc]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Expanded View for Decision Support Card */}
      {expandedDecisionItem && (() => {
        const item = expandedDecisionItem;
        const urgConfig = getUrgencyBadgeConfig(item.urgency);
        const sourceCount = item.corroboration_sources_count || item.evidence_sources?.length || 4;
        const isHighUrgency =
          (item.urgency || "").toLowerCase().includes("crit") ||
          (item.urgency || "").toLowerCase().includes("high");
        const effectiveHorizon =
          item.time_horizon ||
          (isHighUrgency ? "Immediate (<7d)" : (item.urgency === "Medium" ? "Tactical (<30d)" : "Strategic (90d+)"));

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 md:p-8 animate-in fade-in duration-200"
            onClick={() => setExpandedDecisionItem(null)}
          >
            <div
              className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-[rgba(20,20,30,0.15)] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-[rgba(20,20,30,0.08)] bg-gradient-to-r from-purple-50/70 via-white to-blue-50/40 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-base shadow-xs shrink-0">
                    {item.company_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-extrabold text-[#17171b] truncate">
                        {item.company_name}
                      </h2>
                      {item.company_name.toLowerCase() === targetCompany.toLowerCase() && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc]">
                          Target Organization
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1.5 ${urgConfig.bg} ${urgConfig.text} ${urgConfig.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${urgConfig.dot}`} />
                        {item.urgency} Urgency
                      </span>
                      {item.threat_type && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getThreatTypeBadgeClass(item.threat_type)}`}
                        >
                          {item.threat_type}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                        {item.confidence}% Calibrated Confidence
                      </span>
                    </div>
                    <p className="text-xs text-[#70717a] mt-0.5 truncate">
                      Executive 6-Dimension Strategic Intelligence Profile · Full-Screen View
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setExpandedDecisionItem(null)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer border border-zinc-200/80 flex items-center gap-1.5 text-xs font-bold"
                    title="Exit Fullscreen (Esc)"
                  >
                    <Minimize2 className="w-4 h-4 text-zinc-600" />
                    <span className="hidden sm:inline">Close</span>
                  </button>
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 focus:outline-none" style={{ scrollbarWidth: "thin" }}>
                {/* High-Urgency Alert Banner */}
                {isHighUrgency && item.deadline_at && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/5 border border-rose-200 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-rose-700">
                        ⚡ Critical Counter-Window Active
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-800 bg-white px-3 py-1 rounded-lg border border-rose-200 shadow-2xs">
                      <Clock className="w-4 h-4 text-rose-600 animate-pulse" />
                      <span>Window: <DecisionCardCountdown item={item} /></span>
                    </div>
                  </div>
                )}

                {/* Exposed Target Products */}
                {item.affected_products && item.affected_products.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs p-3 rounded-xl bg-zinc-50 border border-zinc-200/70">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                      Exposed Target Products:
                    </span>
                    {item.affected_products.map((prod) => (
                      <span key={prod} className="px-2.5 py-0.5 rounded-md bg-white text-zinc-800 font-semibold border border-zinc-300 text-xs shadow-2xs">
                        {prod}
                      </span>
                    ))}
                  </div>
                )}

                {/* Grid: Dimension 1 & Dimension 5 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Dimension 1: What Happened */}
                  <div className="md:col-span-2 p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6e57dc]" />
                        1. What Happened (Factual Grounded Inflection)
                      </span>
                      {item.inflection_summary_details?.publication_date && (
                        <span className="text-[10px] text-zinc-400 font-medium">
                          Published: {item.inflection_summary_details.publication_date}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#17171b] leading-relaxed">
                      {item.what_happened}
                    </p>
                  </div>

                  {/* Dimension 5: Urgency & Time Horizon */}
                  <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a] mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#6e57dc]" />
                        5. Urgency & Time Horizon
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-zinc-700">
                          Time Horizon: <span className="font-extrabold text-zinc-900">{effectiveHorizon}</span>
                        </div>
                        <div className="text-xs font-bold text-zinc-700">
                          Priority Tier: <span className="font-extrabold text-zinc-900">{item.urgency} Urgency</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-zinc-200">
                      <div className="text-[10px] font-bold text-[#9ca3af]">Counter-Strategy Countdown</div>
                      <div className="text-xs font-black text-[#17171b] flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-[#6e57dc]" />
                        <DecisionCardCountdown item={item} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dimension 2: Why It Matters (Independent Dyadic Assessment & 6-Question Matrix) */}
                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100/90 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#6e57dc]" />
                      2. Why It Matters (Independent Dyadic Assessment)
                    </div>
                    {item.revenue_margin_exposure && (
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100/80 text-amber-900 border border-amber-200 flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5 text-amber-700" />
                        {item.revenue_margin_exposure}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                    {item.why_it_matters}
                  </p>

                  {/* Structured 6-Question Matrix */}
                  {item.structured_why_it_matters && (
                    <div className="pt-3 border-t border-purple-200/60">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] mb-2">
                        Structured 6-Question Strategic Matrix:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-white/90 p-4 rounded-xl border border-purple-100 shadow-2xs">
                        <div>
                          <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">1. Affected Products:</span>
                          <span className="text-zinc-600 font-medium">
                            {(item.structured_why_it_matters.q1_affected_products || []).join(", ") || "None specified"}
                          </span>
                        </div>
                        <div>
                          <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">2. Overlapping Segments:</span>
                          <span className="text-zinc-600 font-medium">
                            {(item.structured_why_it_matters.q2_overlapping_customer_segments || []).join(", ") || "None specified"}
                          </span>
                        </div>
                        <div>
                          <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">3. Competitor Advantage:</span>
                          <span className="text-zinc-600 font-medium">
                            {item.structured_why_it_matters.q3_competitor_advantage || "None verified"}
                          </span>
                        </div>
                        <div>
                          <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">4. Business Risk / Opportunity:</span>
                          <span className="text-zinc-600 font-medium">
                            {item.structured_why_it_matters.q4_business_risk_or_opportunity || item.why_it_matters}
                          </span>
                        </div>
                        <div>
                          <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">5. Supporting Evidence:</span>
                          <span className="text-zinc-600 font-medium">
                            {item.structured_why_it_matters.q5_supporting_evidence_summary || `${item.corroboration_sources_count} primary sources`}
                          </span>
                        </div>
                        <div>
                          <span className="font-extrabold text-zinc-900 block text-[10px] uppercase">6. Uncertain Assumptions:</span>
                          <span className="text-zinc-600 font-medium">
                            {item.structured_why_it_matters.q6_uncertain_assumptions || "None stated"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dimension 3: Who Is Affected */}
                <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#9ca3af]" />
                    3. Who Is Affected (Executive Department Routing across 12 Departments):
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(item.who_is_affected || []).map((dept) => {
                      const reason = item.department_reasons ? item.department_reasons[dept] : undefined;
                      return (
                        <span
                          key={dept}
                          title={reason || `${dept} strategic execution`}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border ${getDepartmentBadgeClass(dept)} cursor-help flex items-center gap-1`}
                        >
                          <span>{dept}</span>
                          {reason && <span className="text-[10px] opacity-75 font-normal ml-1">({reason.slice(0, 30)}...)</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Dimension 4: What Should We Do (Prescriptive Counter-Action Playbook) & Interactive Checklist */}
                <div className="p-4 sm:p-5 rounded-xl bg-zinc-900 text-white shadow-xs border border-zinc-800 space-y-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    4. What Should We Do · Counter-Action Playbook & Execution Tracking
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-medium">
                    {item.what_should_we_do}
                  </p>
                  <ActionablePlaybookChecklist
                    itemId={item.id}
                    actions={getEffectiveActionChecklist(item)}
                    companyName={item.company_name}
                    tenantId={tenantId}
                  />
                </div>

                {/* Dimension 6: Verification & Confidence */}
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      6. Verification & Confidence Guarantee:
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {sourceCount} Verified Primary Sources
                    </span>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                      {item.confidence}% Calibrated
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveEvidenceItem(item);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#6e57dc] hover:bg-[#5b45c6] text-white shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Inspect Independent Evidence Dossier
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 border-t border-[rgba(20,20,30,0.08)] bg-zinc-50 flex items-center justify-between shrink-0">
                <span className="text-xs text-[#70717a]">
                  PrismIQ Executive Decision Cockpit • Press Esc or Click Close to exit
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedDecisionItem(null)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Close Fullscreen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. Evidence Modal: Full Primary Verification Dossier */}
      {activeEvidenceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[rgba(20,20,30,0.12)] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[rgba(20,20,30,0.08)] bg-gradient-to-r from-purple-50/70 via-white to-blue-50/40 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-lg shadow-xs">
                  {activeEvidenceItem.company_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold text-[#17171b]">
                      Verified Evidence Dossier: {activeEvidenceItem.company_name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                      Point 5 Corroboration
                    </span>
                  </div>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    {activeEvidenceItem.corroboration_sources_count || activeEvidenceItem.evidence_sources?.length || 3} Independent primary verification sources supporting this decision item.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveEvidenceItem(null)}
                className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#17171b] hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Recap Box */}
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a]">
                  Development Under Review
                </div>
                <div className="text-sm font-bold text-[#17171b]">
                  {activeEvidenceItem.what_happened}
                </div>
                <div className="text-xs text-[#70717a]">
                  {activeEvidenceItem.why_it_matters}
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-[#9ca3af]">Affected:</span>
                  {(activeEvidenceItem.who_is_affected || []).map((dept) => (
                    <span
                      key={dept}
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getDepartmentBadgeClass(dept)}`}
                    >
                      {dept}
                    </span>
                  ))}
                </div>
              </div>

              {/* Independent Sources List */}
              <div>
                <div className="text-xs font-extrabold text-[#17171b] mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#6e57dc]" />
                    Corroborated Primary Sources ({(activeEvidenceItem.evidence_sources || []).length})
                  </span>
                  <span className="text-[11px] font-normal text-[#70717a]">
                    Cross-verified across documentation, release feeds, career portals & audit reports
                  </span>
                </div>

                <div className="space-y-3">
                  {(activeEvidenceItem.evidence_sources || []).map((src, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-[rgba(20,20,30,0.10)] shadow-xs hover:border-[#6e57dc]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-[#17171b] border border-zinc-200">
                          {src.source || (src as any).source_name || "Primary Corroboration"}
                        </span>
                        {(src.detected_at || (src as any).verified_at) && (
                          <span className="text-[10px] text-[#9ca3af] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(src.detected_at || (src as any).verified_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-[#17171b] mb-1">
                        {src.title || (src as any).source_type || "Verified Corroboration Finding"}
                      </h4>

                      {src.excerpt && (
                        <blockquote className="text-xs text-[#4b5563] pl-2.5 my-2 border-l-2 border-[#6e57dc] bg-purple-50/30 py-1 italic rounded-r">
                          &ldquo;{src.excerpt}&rdquo;
                        </blockquote>
                      )}

                      {(() => {
                        const safeUrl = sanitizeSourceUrl(src.url);
                        return safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#6e57dc] hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            <span>Verify Source URL</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-[#9ca3af] italic mt-1 block">
                            Source document unavailable.
                          </span>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[rgba(20,20,30,0.08)] bg-zinc-50 flex items-center justify-between">
              <span className="text-xs text-[#70717a]">
                PrismIQ Verification Engine • Multi-source corroborate guarantee
              </span>
              <button
                type="button"
                onClick={() => setActiveEvidenceItem(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Merged Competitor Evolution & Timeline Hub Bridge (Points 1, 2 & 3) */}
      <div className="p-6 bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/60 rounded-2xl border border-[rgba(20,20,30,0.10)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-lg shadow-xs shrink-0">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-[#17171b]">
                Competitor Evolution &amp; Timeline Hub
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                Merged Points 1, 2 &amp; 3
              </span>
            </div>
            <p className="text-xs text-[#70717a] mt-1 max-w-2xl leading-relaxed">
              Consolidated intelligence layer: explore acute strategic inflections, multi-month sequence roadmaps, and complete historical change ledgers per competitor in one unified place.
            </p>
          </div>
        </div>
        <Link
          href="/app/competitors"
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#6e57dc] hover:bg-[#5b45c6] text-white shadow-xs transition-colors flex items-center gap-2 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <span>Open Competitor Evolution</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      </>
      )}
    </div>
  );
}
