"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Target,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Upload,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  X,
  Loader2,
  Users,
  DollarSign,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  HelpCircle,
  Clock,
  Play,
  ArrowLeft,
  Calendar,
  Share2,
  Download,
  Info,
  Check,
  ShieldAlert,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "../AppShell";
import {
  PrismCard,
  PrismButton,
  PrismConfidenceBadge,
  PrismLoadingSkeleton,
  PrismEmptyState,
  PrismCompanyBadge,
} from "../PrismPrimitives";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface DealRecord {
  id: string;
  tenant_id?: string;
  deal_name: string;
  customer: string;
  stage: string;
  associated_competitors: string[];
  competitors_involved?: string[];
  primary_competitor?: string;
  description?: string;
  notes?: string;
  deal_value?: number;
  outcome?: string;
  close_date?: string;
  customer_segment?: string;
  industry?: string;
  buyer_objections?: string[];
  target_company?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NextBestActionItem {
  id: string;
  deal_id?: string;
  title: string;
  department: "Sales" | "Product" | "Marketing" | "Leadership" | "Engineering" | string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: "Pending" | "In Progress" | "Completed" | "Dismissed";
  due_date?: string;
  created_at?: string;
  reason?: string;
  evidence_references?: string[];
}

export interface DealEvidenceItem {
  id: string;
  title: string;
  source: string;
  published_date: string;
  confidence: "High" | "Medium" | "Low";
  excerpt: string;
  url?: string;
  category?: string;
  contradictory_notes?: string;
}

export interface DealIntelligenceViewProps {
  initialDealId?: string | null;
  targetCompany?: string;
  tenantId?: string;
  onOpenBattlecard?: (comp: any) => void;
  onOpenCustomerVoice?: (comp: any) => void;
}

export function DealIntelligenceView({
  initialDealId,
  targetCompany,
  tenantId,
}: DealIntelligenceViewProps) {
  const workspace = useWorkspace();
  const effectiveTenantId = tenantId || workspace.tenantId;
  const effectiveTarget = targetCompany || workspace.targetCompany || "Acme Corp";

  // Data states
  const [deals, setDeals] = React.useState<DealRecord[]>([]);
  const [selectedDeal, setSelectedDeal] = React.useState<DealRecord | null>(null);
  const [actions, setActions] = React.useState<NextBestActionItem[]>([]);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<
    "deal_analysis" | "competitor_context" | "battlecard" | "evidence" | "history"
  >("deal_analysis");
  const [battlecardSubTab, setBattlecardSubTab] = React.useState<
    "overview" | "where_they_win" | "where_we_win" | "objections"
  >("overview");

  // Accordion state
  const [expandedAccordions, setExpandedAccordions] = React.useState<{ [key: string]: boolean }>({
    feature_comp: false,
    customer_interest: false,
    next_steps: false,
  });

  // Modals
  const [updateDealModalOpen, setUpdateDealModalOpen] = React.useState(false);
  const [transcriptModalOpen, setTranscriptModalOpen] = React.useState(false);
  const [addActionModalOpen, setAddActionModalOpen] = React.useState(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = React.useState<string | null>(null);

  // Loading & Submission
  const [loading, setLoading] = React.useState(true);
  const [isUpdatingDeal, setIsUpdatingDeal] = React.useState(false);
  const [isSubmittingTranscript, setIsSubmittingTranscript] = React.useState(false);

  // Forms
  const [editDealForm, setEditDealForm] = React.useState({
    stage: "proposal",
    deal_value: 2500000,
    customer: "Acme Corp",
    competitors: "Competitor X",
    notes: "Evaluating enterprise CRM migration and workflow automation.",
  });

  const [transcriptInput, setTranscriptInput] = React.useState(
    `[02:15] Prospect: "Their enterprise plan is cheaper than yours. Competitor X is offering 20% off for the first two years."\n[05:32] Prospect: "We also need better integration with our existing tools and custom APIs."\n[08:17] Prospect: "Our priority is long-term value and stability, not just initial cost, but we need executive justification."\n[10:45] Rep: "Our total implementation cost includes full migration and zero API surcharge, which offsets their discount by month 6."`
  );

  // Fetch or build default deals based on active workspace target
  const loadWorkspaceDeals = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("prismiq_tenant_token") || "";
      const res = await fetch(`/api/deals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const serverDeals: DealRecord[] = data.deals || (Array.isArray(data) ? data : []);
        if (serverDeals.length > 0) {
          setDeals(serverDeals);
          const active = serverDeals.find((d) => d.id === initialDealId) || serverDeals[0];
          setSelectedDeal(active);
          setEditDealForm({
            stage: active.stage || "proposal",
            deal_value: active.deal_value || 2500000,
            customer: active.customer || effectiveTarget,
            competitors: (active.associated_competitors || ["Competitor X"]).join(", "),
            notes: active.description || active.notes || "",
          });
          setLoading(false);
          return;
        }
      }
    } catch {
      // Backend offline or in-memory empty, fallback to dynamic company baseline
    }

    // Dynamic fallback per workspace
    const isAcme = effectiveTarget.toLowerCase().includes("acme");
    const isMeesho = effectiveTarget.toLowerCase().includes("meesho");
    const isVercel = effectiveTarget.toLowerCase().includes("vercel");
    const isOpenAI = effectiveTarget.toLowerCase().includes("openai");

    let fallbackDeals: DealRecord[] = [];
    if (isAcme) {
      fallbackDeals = [
        {
          id: "deal_acme_1",
          deal_name: "Enterprise CRM Migration",
          customer: "Acme Corp",
          stage: "proposal",
          associated_competitors: ["Competitor X"],
          competitors_involved: ["Competitor X"],
          primary_competitor: "Competitor X",
          deal_value: 2500000,
          description: "Enterprise CRM replacement deal evaluating workflow automation and multi-year TCO.",
          created_at: new Date().toISOString(),
        },
        {
          id: "deal_acme_2",
          deal_name: "Global Sales Automation Modernization",
          customer: "Meridian Logistics",
          stage: "evaluation",
          associated_competitors: ["Salesforce", "Competitor X"],
          competitors_involved: ["Salesforce", "Competitor X"],
          primary_competitor: "Competitor X",
          deal_value: 1800000,
          description: "Evaluating AI lead routing and SI partner integrations.",
          created_at: new Date().toISOString(),
        },
      ];
    } else if (isMeesho) {
      fallbackDeals = [
        {
          id: "deal_meesho_1",
          deal_name: "Surat Textile Consortium - 500 Sellers Onboarding",
          customer: "Surat Textile Consortium",
          stage: "proposal",
          associated_competitors: ["Flipkart", "Shopsy"],
          competitors_involved: ["Flipkart", "Shopsy"],
          primary_competitor: "Flipkart",
          deal_value: 850000,
          description: "Zero-commission seller catalog onboarding vs Flipkart Assured SLA guarantees.",
          created_at: new Date().toISOString(),
        },
        {
          id: "deal_meesho_2",
          deal_name: "Jaipur Handloom Regional Distribution Enterprise",
          customer: "Jaipur Handloom",
          stage: "negotiation",
          associated_competitors: ["Flipkart"],
          competitors_involved: ["Flipkart"],
          primary_competitor: "Flipkart",
          deal_value: 420000,
          description: "Regional distribution hub evaluating logistics speed and return penalty protection.",
          created_at: new Date().toISOString(),
        },
      ];
    } else if (isVercel) {
      fallbackDeals = [
        {
          id: "deal_vercel_1",
          deal_name: "Enterprise Next.js & Edge Middleware Migration",
          customer: "FinTech Global",
          stage: "proposal",
          associated_competitors: ["Cloudflare Pages", "AWS Amplify"],
          competitors_involved: ["Cloudflare Pages", "AWS Amplify"],
          primary_competitor: "Cloudflare Pages",
          deal_value: 1200000,
          description: "Global banking application migrating to Next.js App Router and edge security.",
          created_at: new Date().toISOString(),
        },
      ];
    } else {
      fallbackDeals = [
        {
          id: "deal_gen_1",
          deal_name: "Enterprise Modernization Contract",
          customer: effectiveTarget,
          stage: "proposal",
          associated_competitors: ["Competitor X"],
          competitors_involved: ["Competitor X"],
          primary_competitor: "Competitor X",
          deal_value: 1500000,
          description: `Enterprise deal for ${effectiveTarget} competitive replacement.`,
          created_at: new Date().toISOString(),
        },
      ];
    }

    setDeals(fallbackDeals);
    const active = fallbackDeals[0];
    setSelectedDeal(active);
    setEditDealForm({
      stage: active.stage || "proposal",
      deal_value: active.deal_value || 2500000,
      customer: active.customer,
      competitors: (active.associated_competitors || ["Competitor X"]).join(", "),
      notes: active.description || "",
    });
    setLoading(false);
  }, [effectiveTarget, initialDealId]);

  // Load next best actions
  React.useEffect(() => {
    async function loadActions() {
      try {
        const token = localStorage.getItem("prismiq_tenant_token") || "";
        const res = await fetch(`/api/actions?deal_id=${selectedDeal?.id || ""}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const items = data.actions || (Array.isArray(data) ? data : []);
          if (items.length > 0) {
            setActions(items);
            return;
          }
        }
      } catch {
        // fallback
      }

      // Default high-attention actions matching screenshot
      const primaryComp = selectedDeal?.associated_competitors?.[0] || "Competitor X";
      setActions([
        {
          id: "act_1",
          deal_id: selectedDeal?.id,
          title: `Prepare competitor response on pricing`,
          department: "Sales",
          priority: "High",
          status: "Pending",
          due_date: "Today",
          reason: `Customer cited ${primaryComp} 15-20% lower monthly plan during proposal call.`,
          evidence_references: ["ev_1", "ev_3"],
        },
        {
          id: "act_2",
          deal_id: selectedDeal?.id,
          title: `Review deal positioning vs ${primaryComp}`,
          department: "Product",
          priority: "Medium",
          status: "Pending",
          due_date: "Tomorrow",
          reason: `Prospect raised feature comparison regarding workflow automation triggers.`,
          evidence_references: ["ev_2"],
        },
      ]);
    }

    loadActions();
  }, [selectedDeal]);

  React.useEffect(() => {
    loadWorkspaceDeals();
  }, [loadWorkspaceDeals]);

  // Evidence Items matching Image 4
  const primaryComp = selectedDeal?.associated_competitors?.[0] || "Competitor X";
  const evidenceList: DealEvidenceItem[] = React.useMemo(() => [
    {
      id: "ev_1",
      title: "Competitive Pricing Analysis",
      source: "Gartner",
      published_date: "Nov 2026",
      confidence: "High",
      excerpt: `"${primaryComp}'s enterprise plan remains 15-20% lower than industry average, but requires unbundled add-ons for custom integrations and 99.99% SLAs."`,
      url: "https://gartner.com/research/crm-pricing-benchmarks-2026",
      category: "Pricing",
    },
    {
      id: "ev_2",
      title: `${primaryComp} Launches Enhanced Workflow`,
      source: "TechCrunch",
      published_date: "Nov 2026",
      confidence: "Medium",
      excerpt: `"${primaryComp} introduces advanced automation features and AI-assisted lead scoring, though enterprise deployment cycles average 4-6 months longer."`,
      url: "https://techcrunch.com/2026/11/competitor-workflow",
      category: "Market",
    },
    {
      id: "ev_3",
      title: "Win/Loss Insight",
      source: "PrismIQ Internal",
      published_date: "Last Updated: 2 days ago",
      confidence: "High",
      excerpt: `"23% of lost deals in Q3 were due to ${primaryComp} pricing perception, but 78% of won renewals highlighted our total operational cost advantage."`,
      category: "Win/Loss",
    },
  ], [primaryComp]);

  // Handle Update Deal
  const handleUpdateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal) return;
    setIsUpdatingDeal(true);
    try {
      const token = localStorage.getItem("prismiq_tenant_token") || "";
      const comps = editDealForm.competitors.split(",").map((s) => s.trim()).filter(Boolean);
      await fetch(`/api/deals/${selectedDeal.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: editDealForm.stage,
          deal_value: Number(editDealForm.deal_value),
          customer: editDealForm.customer,
          associated_competitors: comps,
          notes: editDealForm.notes,
        }),
      });

      setSelectedDeal((prev) =>
        prev
          ? {
              ...prev,
              stage: editDealForm.stage,
              deal_value: Number(editDealForm.deal_value),
              customer: editDealForm.customer,
              associated_competitors: comps,
              description: editDealForm.notes,
            }
          : null
      );
      setUpdateDealModalOpen(false);
    } catch {
      // offline update
      setSelectedDeal((prev) =>
        prev
          ? {
              ...prev,
              stage: editDealForm.stage,
              deal_value: Number(editDealForm.deal_value),
              customer: editDealForm.customer,
              associated_competitors: editDealForm.competitors.split(",").map((s) => s.trim()).filter(Boolean),
              description: editDealForm.notes,
            }
          : null
      );
      setUpdateDealModalOpen(false);
    } finally {
      setIsUpdatingDeal(false);
    }
  };

  // Handle Transcript Upload & Intelligence Extraction
  const handleSubmitTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal) return;
    setIsSubmittingTranscript(true);
    try {
      const token = localStorage.getItem("prismiq_tenant_token") || "";
      await fetch(`/api/deals/${selectedDeal.id}/transcripts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: transcriptInput,
          media_type: "text/plain",
          metadata: { deal_id: selectedDeal.id, customer: selectedDeal.customer },
        }),
      });

      // Also trigger recommendation generation
      await fetch(`/api/deals/${selectedDeal.id}/recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      setTranscriptModalOpen(false);
    } catch {
      setTranscriptModalOpen(false);
    } finally {
      setIsSubmittingTranscript(false);
    }
  };

  // Handle Analyst Feedback on Evidence
  const handleFeedback = async (evidenceId: string, feedbackType: string) => {
    try {
      const token = localStorage.getItem("prismiq_tenant_token") || "";
      await fetch(`/api/analyst-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entity_type: "evidence",
          entity_id: evidenceId,
          feedback_type: feedbackType,
          comment: `Analyst marked evidence as ${feedbackType}`,
        }),
      });
      setFeedbackSuccessMsg(`Feedback recorded: marked as ${feedbackType}`);
      setTimeout(() => setFeedbackSuccessMsg(null), 3000);
    } catch {
      setFeedbackSuccessMsg(`Feedback saved locally`);
      setTimeout(() => setFeedbackSuccessMsg(null), 3000);
    }
  };

  // Handle Action Completion Check
  const handleToggleAction = async (actionId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: nextStatus } : a))
    );
    try {
      const token = localStorage.getItem("prismiq_tenant_token") || "";
      await fetch(`/api/actions/${actionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: nextStatus,
          notes: `Action marked as ${nextStatus} from Deal Room Cockpit`,
        }),
      });
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PrismLoadingSkeleton count={4} />
      </div>
    );
  }

  const dealValueDisplay = selectedDeal?.deal_value
    ? `$${(selectedDeal.deal_value / 1000000).toFixed(1)}M`
    : "$2.5M";

  return (
    <div className="relative min-h-[calc(100vh-5rem)] pb-16">
      {/* ---------------------------------------------------------------------- */}
      {/* Top Header & Breadcrumbs (Image 1) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Link href="/app/overview" className="hover:text-slate-600">
              <Briefcase className="h-3.5 w-3.5" />
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600">Deal Room</span>
          </div>

          {/* Deal Title & High Attention Pill */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm shadow-violet-200">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                  {selectedDeal?.deal_name || "Enterprise CRM Migration"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-600 border border-rose-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  High Attention
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {selectedDeal?.customer || "Acme Corp"} • {dealValueDisplay} Opportunity • Stage:{" "}
                <span className="font-semibold capitalize text-slate-700">
                  {selectedDeal?.stage || "Proposal"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setUpdateDealModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 transition"
          >
            Update Deal
          </button>
          <button
            type="button"
            onClick={() => setTranscriptModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            Upload Transcript
          </button>
          <button
            type="button"
            onClick={() => setEvidenceDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            Deal Evidence
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 4 Stat Cards Row (Image 1) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Competitor Detected */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Competitor Detected
            </p>
            <p className="truncate text-sm font-bold text-slate-900">{primaryComp}</p>
          </div>
        </div>

        {/* Threat Level */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Threat Level
            </p>
            <p className="truncate text-sm font-bold text-rose-600">High</p>
          </div>
        </div>

        {/* Buying Signals */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Buying Signals
            </p>
            <p className="truncate text-sm font-bold text-slate-900">Strong</p>
          </div>
        </div>

        {/* Last Activity */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Last Activity
            </p>
            <p className="truncate text-sm font-bold text-slate-900">Today, 2:30 PM</p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Horizontal Deal Tabs (Image 1) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="mb-6 flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("deal_analysis")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "deal_analysis"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Deal Analysis
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("competitor_context")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "competitor_context"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Competitor Context
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("battlecard")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "battlecard"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Battlecard
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("evidence")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "evidence"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Evidence
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "history"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Tab 1: Deal Analysis (Pixel-Perfect from Image 1) */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "deal_analysis" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column (8 cols): Transcript Intelligence & Relevant Battlecard */}
          <div className="space-y-6 lg:col-span-8">
            {/* Sales Transcript Analysis Card */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Sales Transcript Analysis
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Analysis Complete • 2 min ago
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTranscriptModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                >
                  View Full Transcript <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              {/* 4 Inner Stat Pills */}
              <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Competitor Mentioned</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    1 <span className="text-xs font-normal text-slate-500">({primaryComp})</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Customer Objections</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    1 <span className="text-xs font-normal text-slate-500">(Pricing)</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Buying Signals</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    2 <span className="text-xs font-normal text-slate-500">(Expansion Interest)</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Threat Level</p>
                  <p className="mt-0.5 text-base font-bold text-rose-600">High</p>
                </div>
              </div>

              {/* Key Insights from Call */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Key Insights from Call
                </h3>

                {/* Quote Box */}
                <div className="relative rounded-xl border border-slate-100 bg-violet-50/30 p-4 transition hover:border-violet-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium italic text-slate-800">
                        &ldquo;Their enterprise plan is cheaper than yours.&rdquo;
                      </p>
                      <p className="text-xs text-slate-400">— Prospect • 02:15</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                      Pricing Concern
                    </span>
                  </div>
                </div>

                {/* Accordion Item 1: Feature Comparison */}
                <div className="rounded-xl border border-slate-100 bg-white overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAccordions((prev) => ({
                        ...prev,
                        feature_comp: !prev.feature_comp,
                      }))
                    }
                    className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                        <Users className="h-3 w-3" />
                      </span>
                      <span>Feature Comparison</span>
                      <span className="font-normal text-slate-500">
                        • {primaryComp}&apos;s enterprise features discussed
                      </span>
                    </div>
                    {expandedAccordions.feature_comp ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {expandedAccordions.feature_comp && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 text-xs text-slate-600 space-y-2">
                      <p>
                        Prospect asked whether our workflow automation requires third-party iPaaS or includes native webhooks. {primaryComp} bundles automation in their higher tier.
                      </p>
                      <button
                        type="button"
                        onClick={() => setEvidenceDrawerOpen(true)}
                        className="text-violet-600 font-semibold hover:underline"
                      >
                        Inspect Comparison Evidence →
                      </button>
                    </div>
                  )}
                </div>

                {/* Accordion Item 2: Customer Interest */}
                <div className="rounded-xl border border-slate-100 bg-white overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAccordions((prev) => ({
                        ...prev,
                        customer_interest: !prev.customer_interest,
                      }))
                    }
                    className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                        <Sparkles className="h-3 w-3" />
                      </span>
                      <span>Customer Interest</span>
                      <span className="font-normal text-slate-500">
                        • Interest in AI-powered features
                      </span>
                    </div>
                    {expandedAccordions.customer_interest ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {expandedAccordions.customer_interest && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 text-xs text-slate-600 space-y-2">
                      <p>
                        Prospect specifically requested a demo of our predictive deal scoring and real-time sales transcript extraction.
                      </p>
                    </div>
                  )}
                </div>

                {/* Accordion Item 3: Next Steps */}
                <div className="rounded-xl border border-slate-100 bg-white overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAccordions((prev) => ({
                        ...prev,
                        next_steps: !prev.next_steps,
                      }))
                    }
                    className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-50 text-violet-600">
                        <Calendar className="h-3 w-3" />
                      </span>
                      <span>Next Steps</span>
                      <span className="font-normal text-slate-500">
                        • Schedule technical deep-dive
                      </span>
                    </div>
                    {expandedAccordions.next_steps ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {expandedAccordions.next_steps && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 text-xs text-slate-600 space-y-2">
                      <p>
                        Agreed to convene enterprise architect team on Thursday 10:00 AM to present multi-tenant security architecture.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Relevant Battlecard Card (Image 1) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Relevant Battlecard — {primaryComp}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("battlecard")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                >
                  Open Battlecard <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              {/* Battlecard Subtabs */}
              <div className="mb-4 flex gap-2 border-b border-slate-100 pb-2">
                {(["overview", "where_they_win", "where_we_win", "objections"] as const).map(
                  (tabKey) => (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setBattlecardSubTab(tabKey)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        battlecardSubTab === tabKey
                          ? "bg-violet-50 text-violet-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      {tabKey.replace(/_/g, " ")}
                    </button>
                  )
                )}
              </div>

              {/* Subtab Content */}
              {battlecardSubTab === "overview" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm">
                      {primaryComp.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{primaryComp}</h4>
                      <p className="text-xs text-slate-400">Enterprise CRM & Sales Platform</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Strong presence in enterprise CRM with advanced analytics and competitive pricing.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h5 className="mb-2 text-xs font-bold text-slate-700">Key Strengths</h5>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Competitive pricing</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Strong enterprise features</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Large partner ecosystem</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {battlecardSubTab === "where_they_win" && (
                <div className="space-y-2 text-xs text-slate-600">
                  <p className="font-semibold text-rose-700">Competitor Advantages:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span>Initial year price discounts (15-20% below market average)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500">•</span>
                      <span>Established brand recognition with traditional IT buyers</span>
                    </li>
                  </ul>
                </div>
              )}

              {battlecardSubTab === "where_we_win" && (
                <div className="space-y-2 text-xs text-slate-600">
                  <p className="font-semibold text-emerald-700">Our Strategic Advantages:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">•</span>
                      <span>Zero hidden integration add-on fees (saves 28% TCO over 3 years)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">•</span>
                      <span>Native AI transcript intelligence and predictive deal signals</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">•</span>
                      <span>Sub-second API response SLA and automated schema migration</span>
                    </li>
                  </ul>
                </div>
              )}

              {battlecardSubTab === "objections" && (
                <div className="space-y-2 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Objection Handling Playbook:</p>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="font-medium text-slate-900">&ldquo;Competitor X is cheaper&rdquo;</p>
                    <p className="mt-1 text-slate-500">
                      Highlight unbundled API connectors, SI implementation cost, and year-2 price escalators.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 cols): Recommended Response, Action Center, Details */}
          <div className="space-y-6 lg:col-span-4">
            {/* Recommended Response Card (Image 1) */}
            <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-900">
                  Recommended Response
                </h3>
              </div>

              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium leading-relaxed text-slate-800">
                  Focus on total implementation cost, integration coverage and long-term operational value. Don&apos;t compete only on monthly pricing.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setEvidenceDrawerOpen(true)}
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 transition flex items-center justify-center gap-1.5"
                >
                  View Supporting Evidence <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAddActionModalOpen(true)}
                  className="w-full rounded-xl border border-violet-200 bg-white py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 transition"
                >
                  + Add to Action Center
                </button>
              </div>
            </div>

            {/* Action Center Card (Image 1) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Action Center
                  </h3>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100">
                    {actions.filter((a) => a.status === "Pending").length} New
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>

              {/* Action List */}
              <div className="space-y-3">
                {actions.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:bg-slate-50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            act.priority === "High" || act.priority === "Critical"
                              ? "bg-rose-50 text-rose-600 border border-rose-100"
                              : "bg-amber-50 text-amber-600 border border-amber-100"
                          }`}
                        >
                          ● {act.priority}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800">{act.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{act.department}</span>
                        <span>•</span>
                        <span>{act.due_date || "Today"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleAction(act.id, act.status)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                        act.status === "Completed"
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-300 text-transparent hover:border-violet-500"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link
                  href="/app/actions"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                >
                  View All Actions <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Deal Intelligence Details Card (Image 1) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Deal Intelligence Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUpdateDealModalOpen(true)}
                  className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-0.5"
                >
                  View Details <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>Deal Stage</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {selectedDeal?.stage || "Proposal"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full w-3/4 rounded-full bg-violet-600" />
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Estimated Value</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {dealValueDisplay}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Competitor Threat</span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600 border border-rose-100">
                    ● High
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Tab 2: Competitor Context */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "competitor_context" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Monitored Competitors on Deal
              </h3>
              <div className="space-y-4">
                {(selectedDeal?.associated_competitors || ["Competitor X"]).map((comp) => (
                  <div key={comp} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-xs">
                        {comp.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{comp}</p>
                        <p className="text-xs text-slate-500">Active evaluation in Proposal stage</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-rose-50 text-rose-600 px-2 py-0.5 text-xs font-bold">
                      High Threat
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Historical Win/Loss Reference
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Based on 14 recorded deals competing against {primaryComp} in similar enterprise categories:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[11px] font-medium text-emerald-800">Wins when TCO Framed</p>
                  <p className="text-lg font-black text-emerald-700">71%</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                  <p className="text-[11px] font-medium text-rose-800">Losses on List Price</p>
                  <p className="text-lg font-black text-rose-700">62%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Tab 3: Battlecard */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "battlecard" && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Full Published Battlecard — {primaryComp}
              </h2>
              <p className="text-xs text-slate-500">
                Verified battlecard claims, proof points, and talk tracks for sales engagement.
              </p>
            </div>
            <Link
              href={`/app/competitors`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
            >
              Browse All Battlecards <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                1. Positioning & Overview
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {primaryComp} markets a bundled enterprise CRM suite targeting mid-market and enterprise migrations. They use aggressive discounting up front.
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4 bg-emerald-50/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                2. Where We Win
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5">
                <li>• No hidden add-ons for custom webhooks and APIs</li>
                <li>• Real-time transcript intelligence natively embedded</li>
                <li>• 4x faster migration SLA backed by dedicated engineers</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-100 p-4 bg-rose-50/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2">
                3. Where They Win
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5">
                <li>• First-year price cuts undercutting market list prices</li>
                <li>• Large global systems integrator ecosystem</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Tab 4: Evidence */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "evidence" && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Evidence Supporting Deal Recommendations
            </h2>
            <Link
              href="/app/evidence"
              className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-1"
            >
              View Full Evidence Center <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-4">
            {evidenceList.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-slate-100 p-4 hover:border-violet-200 transition bg-slate-50/30"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-slate-900">{ev.title}</h4>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                    ● {ev.confidence} Confidence
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  Source: {ev.source} • {ev.published_date}
                </p>
                <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-100 mb-2">
                  {ev.excerpt}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>Analyst feedback:</span>
                    <button
                      type="button"
                      onClick={() => handleFeedback(ev.id, "correct")}
                      className="hover:text-emerald-600 p-1 rounded"
                      title="Mark Correct"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(ev.id, "incorrect")}
                      className="hover:text-rose-600 p-1 rounded"
                      title="Mark Incorrect"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-violet-600 hover:underline flex items-center gap-1"
                    >
                      View Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Tab 5: History */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Deal History & Audit Trail
          </h2>
          <div className="relative pl-6 space-y-6 before:absolute before:bottom-0 before:top-2 before:left-2 before:w-0.5 before:bg-slate-200">
            <div className="relative">
              <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-violet-600" />
              <p className="text-xs font-bold text-slate-900">Deal Stage Transitioned to Proposal</p>
              <p className="text-[11px] text-slate-400">Today, 2:30 PM • Changed by Account Executive</p>
              <p className="text-xs text-slate-600 mt-1">Submitted updated scope and pricing calculator based on prospect transcript.</p>
            </div>
            <div className="relative">
              <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500" />
              <p className="text-xs font-bold text-slate-900">Sales Transcript Uploaded & Analyzed</p>
              <p className="text-[11px] text-slate-400">Today, 2:15 PM • Intelligence Engine</p>
              <p className="text-xs text-slate-600 mt-1">Extracted competitor mention ({primaryComp}) and pricing objection at timestamp 02:15.</p>
            </div>
            <div className="relative">
              <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
              <p className="text-xs font-bold text-slate-900">Deal Created</p>
              <p className="text-[11px] text-slate-400">Yesterday • System Ingestion</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Slide-out Deal Evidence Drawer (Image 4) */}
      {/* ---------------------------------------------------------------------- */}
      {evidenceDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-md bg-white p-6 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-violet-600" />
                <h3 className="text-base font-bold text-slate-900">Deal Evidence</h3>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceDrawerOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success Toast */}
            {feedbackSuccessMsg && (
              <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-100">
                {feedbackSuccessMsg}
              </div>
            )}

            {/* Drawer Subtabs */}
            <div className="my-4 flex border-b border-slate-100 pb-2 gap-4 text-xs font-semibold">
              <span className="text-violet-600 border-b-2 border-violet-600 pb-2">Evidence</span>
              <span className="text-slate-400 hover:text-slate-600 cursor-pointer">Related Insights</span>
            </div>

            {/* Evidence Cards */}
            <div className="space-y-4 flex-1">
              {evidenceList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-violet-200 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Source: <span className="font-medium text-slate-600">{item.source}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Published: {item.published_date}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                      ● {item.confidence} Confidence
                    </span>
                  </div>

                  <p className="my-2.5 text-xs leading-relaxed text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {item.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <span>Feedback:</span>
                      <button
                        type="button"
                        onClick={() => handleFeedback(item.id, "correct")}
                        className="rounded px-1.5 py-0.5 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        ✓ Correct
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFeedback(item.id, "incorrect")}
                        className="rounded px-1.5 py-0.5 hover:bg-rose-50 hover:text-rose-600"
                      >
                        ✕ Disputed
                      </button>
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-violet-600 hover:underline flex items-center gap-0.5"
                      >
                        View Source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                href="/app/evidence"
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                View All Evidence <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal: Update Deal */}
      {/* ---------------------------------------------------------------------- */}
      {updateDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Update Sales Deal</h3>
              <button
                type="button"
                onClick={() => setUpdateDealModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateDeal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Deal Stage</label>
                <select
                  value={editDealForm.stage}
                  onChange={(e) =>
                    setEditDealForm((prev) => ({ ...prev, stage: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
                >
                  <option value="discovery">Discovery</option>
                  <option value="qualification">Qualification</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Opportunity Value ($ USD)
                </label>
                <input
                  type="number"
                  value={editDealForm.deal_value}
                  onChange={(e) =>
                    setEditDealForm((prev) => ({
                      ...prev,
                      deal_value: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Associated Competitors (comma separated)
                </label>
                <input
                  type="text"
                  value={editDealForm.competitors}
                  onChange={(e) =>
                    setEditDealForm((prev) => ({ ...prev, competitors: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Notes & Strategy</label>
                <textarea
                  rows={3}
                  value={editDealForm.notes}
                  onChange={(e) =>
                    setEditDealForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUpdateDealModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingDeal}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 flex items-center gap-1.5"
                >
                  {isUpdatingDeal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal: Upload / Paste Transcript */}
      {/* ---------------------------------------------------------------------- */}
      {transcriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Sales Call Transcript Analysis
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitTranscript} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Paste Sales Call Transcript (with timestamps)
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">
                  The intelligence engine extracts competitor mentions, buyer objections, and buying signals.
                </p>
                <textarea
                  rows={8}
                  value={transcriptInput}
                  onChange={(e) => setTranscriptInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-slate-400">
                  Tenant: {effectiveTarget}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTranscriptModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTranscript}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 flex items-center gap-1.5"
                  >
                    {isSubmittingTranscript ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Extract Intelligence
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Modal: Add Next Best Action */}
      {/* ---------------------------------------------------------------------- */}
      {addActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Next Best Action</h3>
              <button
                type="button"
                onClick={() => setAddActionModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Action Title</label>
                <input
                  type="text"
                  defaultValue={`Prepare competitor response on pricing`}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Responsible Department</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none">
                  <option value="Sales">Sales</option>
                  <option value="Product">Product</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Leadership">Leadership</option>
                  <option value="Engineering">Engineering</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Priority</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none">
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddActionModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActions((prev) => [
                      {
                        id: `act_${Date.now()}`,
                        title: "Prepare competitor response on pricing",
                        department: "Sales",
                        priority: "High",
                        status: "Pending",
                        due_date: "Today",
                      },
                      ...prev,
                    ]);
                    setAddActionModalOpen(false);
                  }}
                  className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700"
                >
                  Create Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
