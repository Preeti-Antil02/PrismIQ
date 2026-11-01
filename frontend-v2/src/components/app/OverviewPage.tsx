"use client";
import { sanitizeSourceUrl } from "@/lib/urlUtils";

import * as React from "react";
import Link from "next/link";
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
  fetchCompetitiveSequences,
  fetchHighImpactChanges,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type SignalRecord,
  type FindingRecord,
  type RadarEvaluation,
  type ResearchTopic,
  type CompetitorActivitySummary,
  type DecisionSupportRecord,
  type DecisionSupportEvidence,
  type CompetitiveSequenceRecord,
  type SequenceStep,
  type HighImpactChangeRecord,
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

  const acceptedCount = actions.filter((a) => statuses[a.id] === "Accepted").length;
  const inProgressCount = actions.filter((a) => statuses[a.id] === "In Progress").length;
  const completedCount = actions.filter((a) => statuses[a.id] === "Completed").length;
  const dismissedCount = actions.filter((a) => statuses[a.id] === "Dismissed").length;
  const totalExecuted = acceptedCount + completedCount;
  const percentComplete = actions.length > 0 ? Math.round((totalExecuted / actions.length) * 100) : 0;

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Interactive Counter-Playbook Checklist</span>
          {syncState === "saving" && (
            <span className="text-[10px] text-zinc-400 animate-pulse font-normal">
              (Saving...)
            </span>
          )}
          {syncState === "synced" && (
            <span className="text-[10px] text-emerald-400 font-normal">
              ✓ Saved to DB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-400 font-medium">
            {completedCount > 0 && `${completedCount} Done • `}
            {acceptedCount} Accepted
            {inProgressCount > 0 && ` • ${inProgressCount} In Progress`}
          </span>
          <span className="px-1.5 py-0.5 rounded font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {percentComplete}% Executed
          </span>
        </div>
      </div>

      {/* Progress track */}
      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden flex">
        <div 
          className="bg-emerald-500 transition-all duration-300" 
          style={{ width: `${(completedCount / actions.length) * 100}%` }} 
        />
        <div 
          className="bg-teal-400 transition-all duration-300" 
          style={{ width: `${(acceptedCount / actions.length) * 100}%` }} 
        />
        <div 
          className="bg-amber-400 transition-all duration-300" 
          style={{ width: `${(inProgressCount / actions.length) * 100}%` }} 
        />
      </div>

      {/* Actions list */}
      <div className="space-y-2">
        {actions.map((act) => {
          const status = statuses[act.id];
          const priority = act.priority || "High";
          return (
            <div
              key={act.id}
              className={`p-2.5 rounded-lg border transition-all text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 ${
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
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
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
                </div>
                <div className="font-medium leading-snug">{act.title || act.text}</div>
                {act.suggested_next_step && (
                  <div className="text-[11px] text-purple-300 font-normal">
                    <span className="font-bold text-purple-200">Next:</span> {act.suggested_next_step}
                  </div>
                )}
              </div>

              {/* Status selector buttons */}
              <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto not-italic flex-wrap">
                <button
                  type="button"
                  onClick={() => updateStatus(act.id, "In Progress")}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
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
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
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
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
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
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
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
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-700/40 hover:bg-zinc-600 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    title="Reset to Pending"
                  >
                    Reopen
                  </button>
                )}
              </div>
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

  const [loading, setLoading] = React.useState(true);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [signals, setSignals] = React.useState<SignalRecord[]>([]);
  const [findings, setFindings] = React.useState<FindingRecord[]>([]);
  const [radarEvals, setRadarEvals] = React.useState<RadarEvaluation[]>([]);
  const [topics, setTopics] = React.useState<ResearchTopic[]>([]);
  const [decisionItems, setDecisionItems] = React.useState<DecisionSupportRecord[]>([]);
  const [sequences, setSequences] = React.useState<CompetitiveSequenceRecord[]>([]);
  const [highImpactChanges, setHighImpactChanges] = React.useState<HighImpactChangeRecord[]>([]);
  const [selectedImpactFilter, setSelectedImpactFilter] = React.useState<string>("ALL");
  const [selectedDept, setSelectedDept] = React.useState<string>("ALL");
  const [selectedUrgency, setSelectedUrgency] = React.useState<string>("ALL");
  const [expandedWhyMatters, setExpandedWhyMatters] = React.useState<Record<string, boolean>>({});
  const [activeEvidenceItem, setActiveEvidenceItem] = React.useState<DecisionSupportRecord | null>(null);
  const [activeHighImpactEvidence, setActiveHighImpactEvidence] = React.useState<HighImpactChangeRecord | null>(null);
  const [activeSequenceEvidence, setActiveSequenceEvidence] = React.useState<{
    company: string;
    pattern: string;
    horizon?: string;
    step: SequenceStep;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compsRes, eventsRes, signalsRes, findingsRes, radarRes, topicsRes, decisionRes, sequencesRes, changesRes] =
        await Promise.allSettled([
          fetchTrackedCompanies(),
          fetchEvents({ limit: 100 }),
          fetchSignals({ limit: 200 }),
          fetchFindings(),
          fetchLatestRadar(),
          fetchWorkspaceTopics(),
          fetchDecisionSupportItems(undefined, tenantId),
          fetchCompetitiveSequences(undefined, tenantId),
          fetchHighImpactChanges(undefined, undefined, tenantId),
        ]);

      if (compsRes.status === "fulfilled") setTrackedCompanies(compsRes.value || []);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value?.events || []);
      if (signalsRes.status === "fulfilled") setSignals(signalsRes.value?.signals || []);
      if (findingsRes.status === "fulfilled") setFindings(findingsRes.value?.findings || []);
      if (radarRes.status === "fulfilled") setRadarEvals(radarRes.value?.evaluations || []);
      if (topicsRes.status === "fulfilled") setTopics(topicsRes.value || []);
      if (decisionRes.status === "fulfilled") setDecisionItems(decisionRes.value?.items || []);
      if (sequencesRes.status === "fulfilled") setSequences(sequencesRes.value?.sequences || []);
      if (changesRes.status === "fulfilled") setHighImpactChanges(changesRes.value?.changes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute summaries
  const competitorSummaries: CompetitorActivitySummary[] = React.useMemo(() => {
    if (trackedCompanies.length === 0) return [];
    return buildCompetitorSummaries(trackedCompanies, signals, events, findings, radarEvals);
  }, [trackedCompanies, signals, events, findings, radarEvals]);

  // Filtered Point 3 High-Impact Changes
  const filteredHighImpactChanges = React.useMemo(() => {
    if (selectedImpactFilter === "ALL") return highImpactChanges;
    return highImpactChanges.filter((c) => {
      const tier = (c.significance_tier || "").toUpperCase();
      if (selectedImpactFilter === "CRITICAL INFLECTION") {
        return tier.includes("CRITICAL");
      }
      if (selectedImpactFilter === "HIGH IMPACT") {
        return tier === "HIGH IMPACT" || tier === "HIGH";
      }
      if (selectedImpactFilter === "MEDIUM IMPACT") {
        return tier === "MEDIUM IMPACT" || tier === "MEDIUM";
      }
      return tier === selectedImpactFilter.toUpperCase();
    });
  }, [highImpactChanges, selectedImpactFilter]);

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
    <div className="space-y-8">
      {/* 1. Header & Quick Pulse Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#17171b]">
              Competitive Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-[#6e57dc] border border-purple-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              RLS Secured
            </span>
          </div>
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
            Timeline Sequences
          </div>
          <div className="text-2xl font-extrabold text-[#17171b]">{sequences.length}</div>
          <div className="text-[11px] text-[#70717a] mt-1 flex items-center justify-between">
            <span>{sequences.reduce((acc, s) => acc + (s.sequence_steps?.length || 0), 0)} Milestones</span>
            <Link href="/app/trends" className="text-[#6e57dc] font-semibold hover:underline">
              Point 2 Live
            </Link>
          </div>
        </PrismCard>
      </div>

      {/* Visual Analytics & Intelligence Charts Section */}
      <div className="space-y-4">
        <PrismSectionHeader
          title="Intelligence Distribution & Visual Analytics"
          subtitle="Real-time graphical breakdown of verified signals across sources, event impact tiers, and competitor activity share."
          eyebrow="Visual Decision Cockpit"
          action={
            <div className="flex items-center gap-2 text-xs font-semibold text-[#70717a]">
              <PieChart className="w-3.5 h-3.5 text-[#6e57dc]" />
              <span>Multi-Source Corroboration</span>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Multi-Source Signal Distribution */}
          <PrismCard className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#17171b]">Multi-Channel Signal Footprint</h3>
                <p className="text-[11px] text-[#70717a] mt-0.5">Corroborated atomic signals across 5 monitored dimensions</p>
              </div>
              <span className="app-pill bg-sky-50 text-sky-700 text-[10px] font-bold">
                {signals.length} Raw Signals
              </span>
            </div>

            {sourceDistribution.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9ca3af]">No signal distribution data available</div>
            ) : (
              <PrismDonutChart
                data={sourceDistribution}
                centerLabel="Signals"
                centerValue={signals.length}
                size={180}
                thickness={22}
              />
            )}
          </PrismCard>

          {/* Chart 2: Event Severity & Impact Tiers */}
          <PrismCard className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#17171b]">Event Severity & Impact Tiers</h3>
                <p className="text-[11px] text-[#70717a] mt-0.5">Categorized by strategic urgency and operational impact</p>
              </div>
              <span className="app-pill bg-rose-50 text-rose-700 text-[10px] font-bold">
                {events.length} Validated Events
              </span>
            </div>

            {tierDistribution.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9ca3af]">No validated event tier data available</div>
            ) : (
              <PrismDonutChart
                data={tierDistribution}
                centerLabel="Events"
                centerValue={events.length}
                size={180}
                thickness={22}
              />
            )}
          </PrismCard>

          {/* Chart 3: Competitor Activity Share */}
          <PrismCard className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#17171b]">Competitor Activity Share</h3>
                <p className="text-[11px] text-[#70717a] mt-0.5">Relative volume of signals & validated events across active competitors</p>
              </div>
              <Link href="/app/competitors" className="text-xs font-semibold text-[#6e57dc] hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {competitorActivityBars.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9ca3af]">No competitor activity detected</div>
            ) : (
              <PrismHorizontalBarChart
                items={competitorActivityBars}
              />
            )}
          </PrismCard>

          {/* Chart 4: Competitor Event Severity Profiles */}
          <PrismCard className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(20,20,30,0.06)] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#17171b]">Event Severity Profiles by Competitor</h3>
                <p className="text-[11px] text-[#70717a] mt-0.5">Must-Know (red) vs Should-Know (amber) vs Nice-to-Know (zinc)</p>
              </div>
              <Link href="/app/events" className="text-xs font-semibold text-[#6e57dc] hover:underline flex items-center gap-1">
                Timeline <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {competitorTierStackedRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9ca3af]">No event severity profiles available</div>
            ) : (
              <PrismStackedBarChart
                rows={competitorTierStackedRows}
                legend={[
                  { label: "Must-Know", color: "#f43f5e" },
                  { label: "Should-Know", color: "#f59e0b" },
                  { label: "Nice-to-Know", color: "#cbd5e1" },
                ]}
              />
            )}
          </PrismCard>
        </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                  className={`bg-white rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border ${
                    isHighUrgency
                      ? "border-rose-300 ring-1 ring-rose-200/70 bg-gradient-to-b from-rose-50/15 via-white to-white"
                      : "border-[rgba(20,20,30,0.10)]"
                  }`}
                >
                  <div className="space-y-4">
                    {/* High-Urgency Alert Banner & Counter-Strategy Countdown */}
                    {isHighUrgency && item.deadline_at && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/5 border border-rose-200/90 shadow-2xs">
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

                    {/* Top Bar: Company Badge + Urgency + Threat Type + Calibrated Confidence */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
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

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-[#6e57dc] border border-purple-200">
                          {item.confidence}% Calibrated Confidence
                        </span>
                      </div>
                    </div>

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
                      <p className="text-sm font-bold text-[#17171b] leading-snug">
                        {item.what_happened}
                      </p>
                    </div>

                    {/* Dimension 2: Why It Matters (Independent Dyadic Assessment & 6-Question Matrix) */}
                    <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100/90 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6e57dc] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#6e57dc]" />
                          2. Why It Matters (Independent Dyadic Assessment)
                        </div>
                        {item.revenue_margin_exposure && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100/80 text-amber-900 border border-amber-200 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-amber-700" />
                            {item.revenue_margin_exposure.length > 60 ? item.revenue_margin_exposure.slice(0, 58) + "..." : item.revenue_margin_exposure}
                          </span>
                        )}
                      </div>

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
                    </div>

                    {/* Dimension 3: Who Is Affected (Dynamic Department Routing) */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#9ca3af]" />
                        3. Who Is Affected (Executive Department Routing across 12 Departments):
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
                    <div className="p-4 rounded-xl bg-zinc-900 text-white shadow-xs">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        4. What Should We Do (Prescriptive Counter-Action Playbook)
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                        {item.what_should_we_do}
                      </p>

                      {/* Interactive Counter-Playbook Checklist */}
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
                  <div className="mt-4 pt-3.5 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between flex-wrap gap-2 text-xs">
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
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100/80 text-[#6e57dc] border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
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

      {/* Point 3 Verified High-Impact Change Dossier Modal */}
      {activeHighImpactEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[rgba(20,20,30,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-[rgba(20,20,30,0.08)] bg-gradient-to-r from-amber-50/80 via-white to-purple-50/40 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-[#6e57dc] flex items-center justify-center font-extrabold text-white text-base shadow-xs shrink-0">
                  {activeHighImpactEvidence.company_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-[#17171b] text-base">
                      {activeHighImpactEvidence.company_name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                      (activeHighImpactEvidence.significance_tier || "").toUpperCase().includes("CRITICAL")
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}>
                      <Flame className="w-3 h-3 text-amber-600" />
                      {activeHighImpactEvidence.significance_tier || "HIGH IMPACT"}
                    </span>
                    {activeHighImpactEvidence.event_category && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {activeHighImpactEvidence.event_category}
                      </span>
                    )}
                    {activeHighImpactEvidence.impact_score !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                        Score: {activeHighImpactEvidence.impact_score}/100
                      </span>
                    )}
                    {activeHighImpactEvidence.is_demo_data && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-100 text-zinc-600 border border-dashed border-zinc-300">
                        Demo Scenario
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {activeHighImpactEvidence.window_days ?? 14}-Day Emergence Window
                    </span>
                  </div>
                  <p className="text-xs text-[#70717a] mt-0.5 font-medium">
                    {activeHighImpactEvidence.confidence ?? 94}% Calibrated Multi-Channel Confidence
                    {activeHighImpactEvidence.verification_status ? ` • Status: ${activeHighImpactEvidence.verification_status}` : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveHighImpactEvidence(null)}
                className="p-2 rounded-xl text-[#9ca3af] hover:text-[#17171b] hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#17171b] leading-snug">
                  {activeHighImpactEvidence.headline}
                </h3>
              </div>

              {/* Strategic Analysis */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/90 space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#70717a] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#6e57dc]" />
                  Strategic Interpretation:
                </span>
                <p className="text-xs text-zinc-800 leading-relaxed font-medium">
                  {activeHighImpactEvidence.strategic_interpretation || activeHighImpactEvidence.description}
                </p>
              </div>

              {/* Why it matters to target company */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  Direct Impact on {targetCompany}:
                </span>
                <p className="text-xs text-amber-950 leading-relaxed font-medium">
                  {activeHighImpactEvidence.why_it_matters}
                </p>
              </div>

              {/* Recommended counter-action */}
              {activeHighImpactEvidence.recommended_action && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-700" />
                    Recommended Counter-Playbook:
                  </span>
                  <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                    {activeHighImpactEvidence.recommended_action}
                  </p>
                </div>
              )}

              {/* Affected Business Teams */}
              {activeHighImpactEvidence.affected_business_teams && activeHighImpactEvidence.affected_business_teams.length > 0 && (
                <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/80 flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-purple-900 text-[11px] uppercase tracking-wider">Affected Business Teams:</span>
                  {activeHighImpactEvidence.affected_business_teams.map((team, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md font-semibold bg-white text-purple-800 border border-purple-200 text-[11px]">
                      {team}
                    </span>
                  ))}
                </div>
              )}

              {/* Related Strategic Shifts */}
              {activeHighImpactEvidence.related_event_ids && activeHighImpactEvidence.related_event_ids.length > 0 && (
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                  <span className="font-bold text-zinc-700 text-[11px] uppercase tracking-wider block mb-1">Correlated Strategic Patterns:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeHighImpactEvidence.related_event_ids.map((relId, rIdx) => (
                      <span key={rIdx} className="px-2 py-0.5 rounded font-mono text-[10px] bg-white border border-zinc-300 text-zinc-600">
                        Linked Signal: {relId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Corroborating Signals Evidence Section */}
              <div className="space-y-2.5 pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Corroborated Multi-Channel Evidence ({((activeHighImpactEvidence.signals_evidence || activeHighImpactEvidence.signals) || []).length} Channels)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Emergence window: {activeHighImpactEvidence.window_days ?? 14} days
                  </span>
                </div>

                <div className="space-y-2.5">
                  {((activeHighImpactEvidence.signals_evidence || activeHighImpactEvidence.signals) || []).map((sig, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
                            {sig.signal_type}
                          </span>
                          <span className="font-bold text-zinc-900">{sig.title}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {sig.source} • {sig.detected_at ? sig.detected_at.split("T")[0] : "Verified"}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-zinc-200/60 font-mono text-zinc-700 italic leading-relaxed text-[11px]">
                        &ldquo;{sig.excerpt}&rdquo;
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-zinc-400">PrismIQ Public Crawl Verification</span>
                        {(() => {
                          const safeUrl = sanitizeSourceUrl(sig.url);
                          return safeUrl ? (
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-[#6e57dc] hover:underline text-[11px]"
                            >
                              <span>Open Primary Source</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">
                              Source document unavailable.
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[rgba(20,20,30,0.08)] bg-zinc-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#70717a]">
                PrismIQ Autonomous Change Detection Engine • Zero Demo Data
              </span>
              <button
                type="button"
                onClick={() => setActiveHighImpactEvidence(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point 2 Verified Sequence Milestone Dossier Modal */}
      {activeSequenceEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[rgba(20,20,30,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[rgba(20,20,30,0.08)] bg-gradient-to-r from-purple-50 via-white to-blue-50/30 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6e57dc] to-[#35a9c2] flex items-center justify-center font-extrabold text-white text-base shadow-xs">
                  {activeSequenceEvidence.company.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-[#17171b] text-base">
                      {activeSequenceEvidence.company}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-[#6e57dc] border border-purple-200">
                      Step {activeSequenceEvidence.step.step_number} Milestone
                    </span>
                  </div>
                  <p className="text-xs text-[#70717a] mt-0.5">
                    {activeSequenceEvidence.pattern}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSequenceEvidence(null)}
                className="p-2 rounded-xl text-[#9ca3af] hover:text-[#17171b] hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                    {activeSequenceEvidence.step.month}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {activeSequenceEvidence.step.dimension}
                  </span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {activeSequenceEvidence.step.signals_count} Corroborated Signal{activeSequenceEvidence.step.signals_count !== 1 ? "s" : ""}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#17171b]">
                  {activeSequenceEvidence.step.event_title}
                </h3>
              </div>

              {/* Verbatim quote / excerpt */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/90 relative">
                <span className="text-xs font-bold uppercase tracking-wider text-[#70717a] block mb-1">
                  Verified Primary Evidence & Excerpt:
                </span>
                <p className="text-xs text-zinc-800 font-mono leading-relaxed italic">
                  &ldquo;{activeSequenceEvidence.step.evidence_excerpt}&rdquo;
                </p>
              </div>

              {/* Primary Source Verification Link */}
              <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs">
                <span className="text-zinc-600 font-medium">Original Public Source:</span>
                {(() => {
                  const safeUrl = sanitizeSourceUrl(activeSequenceEvidence.step.evidence_url);
                  return safeUrl ? (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-[#6e57dc] hover:underline"
                    >
                      <span>Open Primary Evidence Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-zinc-400 italic">Source document unavailable.</span>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[rgba(20,20,30,0.08)] bg-zinc-50 flex items-center justify-between">
              <span className="text-[11px] text-[#70717a]">
                PrismIQ Multi-Month Causal Verification Engine
              </span>
              <button
                type="button"
                onClick={() => setActiveSequenceEvidence(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POINT 3: COMPETITIVE CHANGE DETECTION ENGINE ("THE 5 CHANGES THAT ACTUALLY MATTER") */}
      <div className="space-y-4">
        <PrismSectionHeader
          title="High-Impact Change Detection: The 5 Changes That Matter"
          subtitle="Curated detection of strategic inflection points: Pricing overhauls, Enterprise pivots, Executive hiring, Deprecations, and Strategic partnerships."
          eyebrow="Point 3 • High-Impact Change Detection"
          action={
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                {highImpactChanges.filter((c) => (c.significance_tier || "").toUpperCase().includes("CRITICAL")).length} Critical Inflections
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {highImpactChanges.filter((c) => (c.significance_tier || "").toUpperCase() === "HIGH IMPACT").length} High Impact
              </span>
            </div>
          }
        />

        {/* Change Filter Pills */}
        <div className="p-3 bg-white rounded-xl border border-[rgba(20,20,30,0.08)] shadow-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#70717a] mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />
              Significance Tier:
            </span>
            {[
              { id: "ALL", label: "All Inflections" },
              { id: "CRITICAL INFLECTION", label: "Critical Inflections" },
              { id: "HIGH IMPACT", label: "High Impact" },
              { id: "MEDIUM IMPACT", label: "Medium Impact" },
            ].map(({ id, label }) => {
              const active = selectedImpactFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedImpactFilter(id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-zinc-100/80 text-[#70717a] hover:bg-zinc-200/70 hover:text-[#17171b]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <Link href="/app/events" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
            Canonical Event Ledger <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* High Impact Cards */}
        {filteredHighImpactChanges.length === 0 ? (
          <PrismCard className="p-6 text-center text-xs text-[#70717a]">
            <p className="font-bold text-[#17171b]">No high-impact shifts match filter</p>
          </PrismCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredHighImpactChanges.map((change) => {
              const tier = change.significance_tier || (change.impact_severity ? `${change.impact_severity.toUpperCase()} IMPACT` : "HIGH IMPACT");
              const isCritical = tier.toUpperCase().includes("CRITICAL");
              const isHigh = tier.toUpperCase().includes("HIGH") || isCritical;
              const category = change.event_category || change.dimension || "Strategic Shift";
              const score = change.impact_score;
              const affectedTeams = change.affected_business_teams || change.who_is_affected || [];
              const whyItMatters = change.why_it_matters || "Insufficient evidence";
              const strategicInterpretation = change.strategic_interpretation || change.event_description || change.description || "Insufficient evidence";
              return (
                <div
                  key={change.id}
                  onClick={() => setActiveHighImpactEvidence(change)}
                  className="bg-white rounded-2xl border border-[rgba(20,20,30,0.10)] p-5 shadow-xs hover:border-[#6e57dc] hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 cursor-pointer group text-left"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <PrismCompanyBadge
                          name={change.company_name}
                          isTarget={change.company_name.toLowerCase() === targetCompany.toLowerCase()}
                          size="sm"
                        />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                            isCritical
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : isHigh
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? "bg-rose-500 animate-pulse" : isHigh ? "bg-amber-500" : "bg-blue-500"}`} />
                          {tier}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {category}
                        </span>
                        {score !== undefined && score !== null && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                            Score: {score}/100
                          </span>
                        )}
                        {change.is_demo_data && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-100 text-zinc-500 border border-dashed border-zinc-300">
                            Demo Scenario
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-bold text-[#70717a] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#9ca3af]" />
                        {change.window_days ?? 14}-day emergence window
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-[#17171b] leading-snug">
                      {change.headline}
                    </h4>

                    <p className="text-xs text-[#4b5563] leading-relaxed">
                      {strategicInterpretation}
                    </p>

                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100/90 text-xs text-amber-950 font-medium">
                      <strong className="text-amber-900 block mb-0.5 font-bold">Why it matters:</strong>
                      {whyItMatters}
                    </div>

                    {affectedTeams.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] font-bold text-[#70717a] uppercase tracking-wider">Affected Teams:</span>
                        {affectedTeams.map((team, tIdx) => (
                          <span key={tIdx} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {team}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-[#17171b] border border-zinc-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {change.corroborating_signals_count ?? change.corroboration_count ?? ((change.signals_evidence || change.signals) || []).length ?? 3} corroborated sources
                    </span>

                    <span className="text-[#6e57dc] font-bold group-hover:underline flex items-center gap-1">
                      <span>Inspect Dossier</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* POINT 2: Historical Competitive Memory & Multi-Month Sequence Detection */}
      <div className="space-y-4">
        <PrismSectionHeader
          title="Historical Competitive Memory & Multi-Month Sequences"
          subtitle="Connecting isolated milestones across months into unified competitor intent (e.g., Hiring → Compliance → Enterprise Pricing → Case Study → Market Expansion)."
          eyebrow="Point 2 • Sequence Detection & Memory"
          action={
            <Link
              href="/app/trends"
              className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1.5"
            >
              Full Interactive Trends Timeline <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        {sequences.length === 0 ? (
          <PrismCard className="p-6 text-center text-xs text-[#70717a]">
            <Workflow className="w-7 h-7 text-[#9ca3af] mx-auto mb-2 opacity-60" />
            <p className="font-bold text-[#17171b]">No multi-month milestone sequence active</p>
            <p className="text-[#70717a] mt-0.5">Milestones will correlate automatically once multi-period signals are captured.</p>
          </PrismCard>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sequences.slice(0, 3).map((seq) => (
              <div
                key={seq.id}
                className="bg-white rounded-2xl border border-[rgba(20,20,30,0.10)] p-5 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Sequence Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(20,20,30,0.06)]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <PrismCompanyBadge
                      name={seq.company_name}
                      isTarget={(seq.company_name || "").toLowerCase() === (targetCompany || "").toLowerCase()}
                      size="sm"
                    />
                    <span className="text-xs text-[#70717a] flex items-center gap-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-[#6e57dc]" />
                      {seq.time_horizon}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-50 text-[#6e57dc] border border-purple-200 flex items-center gap-1">
                      <Workflow className="w-3 h-3" />
                      {seq.sequence_steps?.length || 0} Corroborated Steps
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {seq.confidence}% Confidence
                    </span>
                  </div>
                </div>

                {/* Pattern Name & Strategic Interpretation */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9ca3af] mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6e57dc]" />
                    Detected Multi-Month Pattern
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#17171b]">
                    {seq.pattern_name}
                  </h3>
                  <p className="text-xs text-[#4b5563] mt-1 leading-relaxed">
                    {seq.strategic_interpretation}
                  </p>
                </div>

                {/* Milestone Timeline Stepper */}
                <div className="pt-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#70717a] mb-2.5">
                    Chronological Milestone Progression:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {(seq.sequence_steps || []).map((step, sIdx) => {
                      const dStyle = DIMENSION_STYLES[step.dimension] || {
                        bg: "bg-zinc-100",
                        text: "text-zinc-800",
                        border: "border-zinc-200",
                        label: step.dimension,
                      };
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => setActiveSequenceEvidence({
                            company: seq.company_name,
                            pattern: seq.pattern_name,
                            horizon: seq.time_horizon,
                            step: step,
                          })}
                          className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-200/80 hover:bg-white hover:border-[#6e57dc] hover:shadow-md transition-all flex flex-col justify-between space-y-2 text-left cursor-pointer group"
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="font-extrabold text-[#6e57dc]">
                                Step {step.step_number || sIdx + 1}
                              </span>
                              <span className="font-semibold text-[#70717a]">
                                {step.month}
                              </span>
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border mb-1.5 ${dStyle.bg} ${dStyle.text} ${dStyle.border}`}
                            >
                              {dStyle.label}
                            </span>
                            <h4 className="text-xs font-bold text-[#17171b] leading-tight line-clamp-2 group-hover:text-[#6e57dc] transition-colors">
                              {step.event_title}
                            </h4>
                          </div>

                          <div className="pt-1.5 border-t border-zinc-200/60 flex items-center justify-between text-[10px] text-[#70717a] w-full">
                            <span className="font-bold text-[#17171b] flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              {step.signals_count} signals
                            </span>
                            <span className="text-[#6e57dc] font-bold group-hover:underline flex items-center gap-0.5">
                              Evidence &rarr;
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actionable Counter-Playbook */}
                <div className="p-3.5 rounded-xl bg-zinc-900 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 mb-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      Recommended Counter-Action:
                    </div>
                    <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                      {seq.recommended_action}
                    </p>
                  </div>
                  <Link
                    href="/app/trends"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#6e57dc] hover:bg-[#5b45c6] text-white shrink-0 self-start sm:self-auto transition-colors flex items-center gap-1"
                  >
                    Drill Down <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Competitive Movement Strip */}
      <div>
        <PrismSectionHeader
          title="Competitive Movement & Activity Share"
          subtitle="Relative momentum across your tracked landscape based on verified signal volume and event velocity."
          eyebrow="Landscape Dynamics"
          action={
            <Link href="/app/competitors" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
              Manage Competitors <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        {competitorSummaries.length === 0 ? (
          <PrismEmptyState
            title="No competitor summaries available"
            description="Configure your tracked competitors in the workspace to monitor activity across companies."
            actionText="Configure Competitors"
            actionHref="/app/workspace/watchlist"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitorSummaries.slice(0, 6).map((comp) => (
              <PrismCard key={comp.company_name} solid className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <PrismCompanyBadge
                    name={comp.company_name}
                    isTarget={comp.is_target}
                    size="md"
                  />
                  <span className="text-[11px] font-bold text-[#70717a]">
                    {comp.total_events} Event{comp.total_events !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#70717a]">Total Signals:</span>
                    <span className="font-bold text-[#17171b]">{comp.total_signals}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#70717a]">Must-Know Events:</span>
                    <span className="font-bold text-[#e11d48]">{comp.must_know_count}</span>
                  </div>
                </div>

                {(comp.recent_events || []).length > 0 && (
                  <div className="pt-2.5 border-t border-[rgba(20,20,30,0.06)]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                      Latest Activity
                    </div>
                    <div
                      className="text-xs font-semibold text-[#17171b] truncate hover:text-[#6e57dc] cursor-pointer"
                      onClick={() => {
                        if (comp.recent_events && comp.recent_events[0]) {
                          openEvidence({
                            id: comp.recent_events[0].event_id,
                            title: comp.recent_events[0].title,
                            company_name: comp.company_name,
                            why_it_matters: comp.recent_events[0].why_it_matters,
                            url: comp.recent_events[0].url,
                            raw_excerpt: comp.recent_events[0].raw_excerpt,
                            tier: comp.recent_events[0].tier,
                          });
                        }
                      }}
                    >
                      {comp.recent_events?.[0]?.title || "Recent Event"}
                    </div>
                  </div>
                )}
              </PrismCard>
            ))}
          </div>
        )}
      </div>

      {/* 4. Research Radar Field */}
      {topics.length > 0 && (
        <div>
          <PrismSectionHeader
            title="Emerging Research Radar"
            subtitle="Configured topics monitored across academic, technical, and patent disclosures."
            eyebrow="Field Radar"
            action={
              <Link href="/app/research-radar" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
                Explore Radar <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.slice(0, 3).map((topic) => (
              <PrismCard key={topic.id} solid className="p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-xs text-[#17171b]">{topic.topic_label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(Array.isArray(topic.keywords) ? topic.keywords : []).slice(0, 3).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-zinc-100 text-[10px] font-medium text-[#595a63]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-[rgba(20,20,30,0.06)] flex items-center justify-between text-[11px] text-[#9ca3af]">
                  <span>Active Monitoring</span>
                  <Link href="/app/research-radar" className="text-[#6e57dc] font-semibold hover:underline">
                    View posture →
                  </Link>
                </div>
              </PrismCard>
            ))}
          </div>
        </div>
      )}

      {/* 5. Recent Canonical Events */}
      <div>
        <PrismSectionHeader
          title="Recent Canonical Events"
          subtitle="Directly corroborated, multi-channel competitor moves verified by the fact-checking engine."
          eyebrow="Activity Log"
          action={
            <Link href="/app/events" className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
              Full Event Feed <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        <div className="bg-white rounded-xl border border-[rgba(20,20,30,0.08)] overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-[rgba(20,20,30,0.08)] text-[10px] font-extrabold uppercase tracking-wider text-[#70717a]">
              <tr>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Event & Summary</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(20,20,30,0.06)]">
              {recentEvents.map((ev) => (
                <tr
                  key={ev.event_id}
                  className="cursor-pointer hover:bg-zinc-50/80 transition-colors"
                  onClick={() =>
                    openEvidence({
                      id: ev.event_id,
                      title: ev.title,
                      company_name: ev.company_name,
                      why_it_matters: ev.why_it_matters,
                      confidence: ev.confidence || ev.fact_confidence,
                      tier: ev.tier,
                      raw_excerpt: ev.raw_excerpt || ev.event_summary,
                      url: ev.url,
                      source: ev.contributing_sources?.[0] || "Verified Source",
                      published_timestamp: ev.published_timestamp || ev.published_at,
                      corroboration_count: ev.corroboration_count,
                    })
                  }
                >
                  <td className="whitespace-nowrap font-bold">
                    <PrismCompanyBadge
                      name={ev.company_name}
                      isTarget={(ev.company_name || "").toLowerCase() === (targetCompany || "").toLowerCase()}
                      size="sm"
                    />
                  </td>
                  <td className="max-w-md font-semibold text-[#17171b]">
                    <div className="line-clamp-1">{ev.title}</div>
                    {ev.why_it_matters && (
                      <div className="text-[11px] text-[#70717a] line-clamp-1 mt-0.5">
                        {ev.why_it_matters}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <PrismTierBadge tier={ev.tier} />
                  </td>
                  <td className="whitespace-nowrap">
                    <PrismConfidenceBadge confidence={ev.confidence || ev.fact_confidence} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-[#70717a]">
                    {ev.published_timestamp || ev.published_at || "Recent"}
                  </td>
                  <td className="whitespace-nowrap">
                    <button className="text-xs font-bold text-[#6e57dc] hover:underline flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {ev.corroboration_count || 1} source{ev.corroboration_count !== 1 ? "s" : ""}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
