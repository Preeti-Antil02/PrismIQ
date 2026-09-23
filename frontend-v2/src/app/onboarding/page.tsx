"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createTenantToken } from "@/lib/auth";
import {
  discoverCompetitors,
  confirmCompetitors,
  createWorkspaceTopic,
  triggerPipelineRun,
  fetchWorkspaceConfig,
  type DiscoveryCandidate,
} from "@/lib/api";
import {
  Building2,
  Compass,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Search,
  Check,
  Layers,
  Cpu,
  Coins,
  Rocket,
  Activity,
  Globe,
} from "lucide-react";
import "@/app/public-website.css";

// Step 4 Intelligence Preferences definition mapped to real backend topics & keywords
interface IntelligenceOption {
  id: string;
  label: string;
  category: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const SUPPORTED_INTELLIGENCE_OPTIONS: IntelligenceOption[] = [
  {
    id: "ai_research",
    label: "AI Research & Agentic Tooling",
    category: "Deep Research",
    description: "Autonomous purchasing tokens, LLM reasoning integration, agentic SDKs, and model deployments.",
    keywords: ["llm", "agentic", "ai", "reasoning", "model", "inference"],
    icon: Cpu,
  },
  {
    id: "pricing_packaging",
    label: "Pricing & Packaging Movements",
    category: "Competitive Analysis",
    description: "Tiers, usage-based metering, feature gating, enterprise discounting, and plan restructuring.",
    keywords: ["pricing", "tier", "subscription", "plan", "billing", "metering"],
    icon: Coins,
  },
  {
    id: "product_launches",
    label: "Product Launches & Releases",
    category: "Real-Time Events",
    description: "Major version rollouts, public betas, breaking updates, and core platform capabilities.",
    keywords: ["launch", "release", "changelog", "v1", "beta", "announcement"],
    icon: Rocket,
  },
  {
    id: "edge_compute",
    label: "Edge Infrastructure & Runtimes",
    category: "Strategic Insights",
    description: "Serverless execution limits, fast cold-starts, WebAssembly components, and global KV replication.",
    keywords: ["edge", "serverless", "workers", "wasm", "runtime", "latency"],
    icon: Layers,
  },
  {
    id: "strategic_partnerships",
    label: "Strategic Alliances & Ecosystem",
    category: "Market Trends",
    description: "Enterprise co-selling, hyperscaler agreements, critical integrations, and platform expansions.",
    keywords: ["partnership", "acquisition", "strategic", "ecosystem", "integration"],
    icon: Globe,
  },
  {
    id: "signals_sentiment",
    label: "Signals & Talent Movements",
    category: "Signals & Sentiment",
    description: "Key engineering leadership hires, developer community discussions, and repo activity shifts.",
    keywords: ["hiring", "talent", "engineering", "careers", "leadership", "community"],
    icon: Activity,
  },
];

interface ReviewCompetitorItem {
  id: string;
  name: string;
  category?: string;
  rationale: string;
  confidence: "High" | "Medium" | "Low";
  source: string;
  sourceAge?: string;
  freshnessNote?: string;
  website?: string;
  selected: boolean;
  isManual?: boolean;
  tier?: "core" | "peripheral";
  isDirectoryOnly?: boolean;
  isDirectoryArtifactRisk?: boolean;
  corroborationStatus?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading, checkOnboardingStatus } = useAuth();

  // Step state: 1 (Company), 2 (Discovering), 3 (Competitors), 4 (Preferences), 5 (Finalizing)
  const [step, setStep] = React.useState<number>(1);

  // Step 1 Inputs
  const [companyName, setCompanyName] = React.useState("");
  const [companyWebsite, setCompanyWebsite] = React.useState("");
  const [companyDescription, setCompanyDescription] = React.useState("");
  const [step1Error, setStep1Error] = React.useState<string | null>(null);

  // Step 2 Discovery State
  const [discoveryStage, setDiscoveryStage] = React.useState<number>(1);
  const [discoveryError, setDiscoveryError] = React.useState<string | null>(null);

  // Step 3 Competitors State
  const [competitors, setCompetitors] = React.useState<ReviewCompetitorItem[]>([]);
  const [newManualName, setNewManualName] = React.useState("");
  const [showAddManual, setShowAddManual] = React.useState(false);
  const [step3Error, setStep3Error] = React.useState<string | null>(null);
  const [isDegradedMode, setIsDegradedMode] = React.useState<boolean>(false);
  const [discoveryMethod, setDiscoveryMethod] = React.useState<string>("llm");
  const [isConfirmingCompetitors, setIsConfirmingCompetitors] = React.useState<boolean>(false);

  // Step 4 Intelligence Preferences State
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>([
    "ai_research",
    "pricing_packaging",
    "product_launches",
    "edge_compute",
  ]);

  // Step 5 Saving State
  const [finalizingStep, setFinalizingStep] = React.useState<string>("Registering company...");
  const [finalizingError, setFinalizingError] = React.useState<string | null>(null);

  // Already onboarded workspace detection & prompt
  const [showAlreadyOnboardedPrompt, setShowAlreadyOnboardedPrompt] = React.useState<boolean>(false);
  const [existingTarget, setExistingTarget] = React.useState<string>("");

  // Start fresh company onboarding with a clean tenant ID
  const handleStartNewWorkspace = React.useCallback(() => {
    const newTid = crypto.randomUUID();
    if (typeof window !== "undefined") {
      localStorage.setItem("prismiq_active_tenant_id", newTid);
      const freshToken = createTenantToken(newTid);
      localStorage.setItem("prismiq_tenant_token", freshToken);
      localStorage.removeItem("prismiq_onboarding_state");
      localStorage.setItem(
        "prismiq_user",
        JSON.stringify({
          id: newTid,
          email: `${newTid.slice(0, 8)}@prismiq.ai`,
          name: "New Workspace",
          tenant_id: newTid,
        })
      );
    }
    setCompanyName("");
    setCompanyWebsite("");
    setCompanyDescription("");
    setCompetitors([]);
    setShowAlreadyOnboardedPrompt(false);
    setStep(1);
  }, []);

  // Guard: Redirect unauthenticated users and restore persisted workspace state from DB
  React.useEffect(() => {
    if (authLoading) return;
    if (!token && !user) {
      router.push("/login?redirect=/onboarding");
      return;
    }

    const loadWorkspaceState = async () => {
      try {
        const isNewMode = typeof window !== "undefined" && (
          window.location.search.includes("new=1") ||
          window.location.search.includes("force=1") ||
          window.location.search.includes("reset=1")
        );

        if (isNewMode) {
          handleStartNewWorkspace();
          return;
        }

        const cfg = await fetchWorkspaceConfig();

        if (cfg.onboarding_complete) {
          setExistingTarget(cfg.target_company || "configured");
          setShowAlreadyOnboardedPrompt(true);
          return;
        }

        // Restore target company from database
        if (cfg.target_company) {
          setCompanyName(cfg.target_company);
        }

        // Restore persisted competitors from database
        if (cfg.competitors && cfg.competitors.length > 0) {
          const restoredItems: ReviewCompetitorItem[] = cfg.competitors.map((cName, idx) => ({
            id: `persisted-${idx}-${cName.toLowerCase().replace(/\s+/g, "-")}`,
            name: cName,
            rationale: `Confirmed competitor for tracking alongside ${cfg.target_company || "your target company"}.`,
            confidence: "High",
            source: "Workspace Configuration",
            selected: true,
          }));
          setCompetitors(restoredItems);
        }

        // If target and competitors already persisted, resume directly on Preferences (Step 4)
        if (cfg.is_configured && !cfg.onboarding_complete) {
          setStep(4);
        }
      } catch (err) {
        console.warn("Notice loading workspace config:", err);
      }
    };

    loadWorkspaceState();
  }, [authLoading, token, user, router, handleStartNewWorkspace]);

  // Clean and validate website domain
  const cleanDomain = (raw: string): string => {
    let clean = raw.trim().toLowerCase();
    clean = clean.replace(/^https?:\/\//, "");
    clean = clean.replace(/\/.*$/, "");
    return clean;
  };

  // --------------------------------------------------------------------------
  // STEP 1: Submit Company -> Start Discovery
  // --------------------------------------------------------------------------
  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = companyName.trim();
    const cleanWeb = cleanDomain(companyWebsite);

    if (!cleanName) {
      setStep1Error("Company name is required.");
      return;
    }

    if (!cleanWeb || !cleanWeb.includes(".")) {
      setStep1Error("Please enter a valid website (e.g. acme.com or https://acme.com).");
      return;
    }

    setStep1Error(null);
    setStep(2);
    runDiscovery(cleanName);
  };

  // --------------------------------------------------------------------------
  // STEP 2: Real Discovery Agent Ingestion
  // --------------------------------------------------------------------------
  const runDiscovery = async (target: string) => {
    setDiscoveryError(null);
    setDiscoveryStage(1);

    // Staged visual feedback mapped to actual backend steps
    const stageTimer1 = setTimeout(() => setDiscoveryStage(2), 1200);
    const stageTimer2 = setTimeout(() => setDiscoveryStage(3), 2800);
    const stageTimer3 = setTimeout(() => setDiscoveryStage(4), 4500);

    try {
      const res = await discoverCompetitors(target);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);

      setIsDegradedMode(Boolean(res.degraded));
      setDiscoveryMethod(res.extraction_method || "llm");

      const rawCandidates: DiscoveryCandidate[] = res.candidates || [];
      const parsedItems: ReviewCompetitorItem[] = rawCandidates.map((c, idx) => {
        const cName = c.name || c.company_name || `Competitor ${idx + 1}`;
        let confLevel: "High" | "Medium" | "Low" = "Medium";
        if (typeof c.confidence === "string") {
          const norm = c.confidence.toLowerCase();
          if (norm === "high") confLevel = "High";
          else if (norm === "low") confLevel = "Low";
        } else if (typeof c.confidence === "number") {
          if (c.confidence >= 0.8) confLevel = "High";
          else if (c.confidence < 0.6) confLevel = "Low";
        }

        const rationale =
          c.rationale ||
          (c.reasons && c.reasons.join(". ")) ||
          `Overlapping market positioning and architectural capabilities with ${target}.`;

        const sourceCitation =
          c.source ||
          (c.sources && c.sources.join(", ")) ||
          `Competitive index & domain crawl for ${target}`;

        const isCore = c.tier === "core" || (!c.is_directory_only && confLevel === "High");
        const category = c.category || c.industry_category || "Competitor Platform";

        return {
          id: `disc-${idx}-${cName.toLowerCase().replace(/\s+/g, "-")}`,
          name: cName,
          category,
          rationale,
          confidence: confLevel,
          source: sourceCitation,
          sourceAge: c.source_age,
          freshnessNote: c.freshness_note,
          website: c.website || c.domain || c.primary_domain,
          selected: true, // Pre-select ALL authentic discovered candidates by default!
          tier: (c.tier as "core" | "peripheral") || (isCore ? "core" : "peripheral"),
          isDirectoryOnly: Boolean(c.is_directory_only),
          isDirectoryArtifactRisk: Boolean(c.is_directory_artifact_risk),
          corroborationStatus: c.corroboration_status,
        };
      });

      setCompetitors(parsedItems);
      setStep(3);
    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setDiscoveryError(err.message || "Discovery agent timed out or encountered an error.");
    }
  };

  // --------------------------------------------------------------------------
  // STEP 3: Review Competitors Handler
  // --------------------------------------------------------------------------
  const toggleCompetitor = (id: string) => {
    setCompetitors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleAddManualCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newManualName.trim();
    if (!clean) return;

    // Check duplicate
    if (competitors.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      setStep3Error(`'${clean}' is already in your competitor list.`);
      return;
    }

    const newItem: ReviewCompetitorItem = {
      id: `manual-${Date.now()}`,
      name: clean,
      rationale: `Manually added competitor for tracking alongside ${companyName}.`,
      confidence: "High",
      source: "Manual entry by workspace admin",
      selected: true,
      isManual: true,
    };

    setCompetitors((prev) => [...prev, newItem]);
    setNewManualName("");
    setShowAddManual(false);
    setStep3Error(null);
  };

  const removeManualCompetitor = (id: string) => {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  };

  const handleConfirmCompetitorsStep = async () => {
    const selected = competitors.filter((c) => c.selected);
    if (selected.length === 0) {
      setStep3Error("Please select at least one competitor to track.");
      return;
    }
    const cleanTarget = companyName.trim();
    if (!cleanTarget) {
      setStep3Error("Target company is required.");
      return;
    }

    setStep3Error(null);
    setIsConfirmingCompetitors(true);

    try {
      const selectedNames = selected.map((c) => c.name);
      await confirmCompetitors(cleanTarget, selectedNames);
      setStep(4);
    } catch (err: any) {
      setStep3Error(err.message || "Failed to persist selected competitors. Please try again.");
    } finally {
      setIsConfirmingCompetitors(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 4: Intelligence Preferences Handler
  // --------------------------------------------------------------------------
  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  // --------------------------------------------------------------------------
  // STEP 5: Finalize Setup & Persist
  // --------------------------------------------------------------------------
  const handleFinalizeSetup = async () => {
    setStep(5);
    setFinalizingError(null);

    const selectedCompetitorNames = competitors
      .filter((c) => c.selected)
      .map((c) => c.name);

    try {
      // 1. Confirm tracked companies in backend
      setFinalizingStep("Persisting target company and confirmed competitors...");
      await confirmCompetitors(companyName.trim(), selectedCompetitorNames);

      // 2. Persist configured research topics in backend under tenant RLS
      setFinalizingStep("Activating intelligence streams and research topics...");
      const activeOptions = SUPPORTED_INTELLIGENCE_OPTIONS.filter((opt) =>
        selectedTopics.includes(opt.id)
      );

      for (const opt of activeOptions) {
        try {
          await createWorkspaceTopic(opt.label, opt.keywords);
        } catch (topicErr) {
          // Non-blocking if topic already registered
          console.warn(`Topic setup notice for '${opt.label}':`, topicErr);
        }
      }

      // 3. Trigger initial progressive monitoring run (Fast pass: News/GitHub/Jobs first)
      setFinalizingStep("Initializing continuous competitive monitoring...");
      try {
        await triggerPipelineRun(true);
      } catch (trigErr) {
        console.warn("Pipeline trigger notice:", trigErr);
      }

      setFinalizingStep("Generating initial intelligence workspace...");

      // Save new workspace to custom workspaces list so it shows in the workspace switcher dropdown
      try {
        const activeTid = localStorage.getItem("prismiq_active_tenant_id") || "";
        if (activeTid) {
          const raw = localStorage.getItem("prismiq_custom_workspaces");
          const existing = raw ? JSON.parse(raw) : [];
          const entry = {
            tenant_id: activeTid,
            name: `${companyName.trim()} Intelligence`,
            target: companyName.trim(),
            sector: "Custom Workspace",
          };
          const updated = [...existing.filter((w: any) => w.tenant_id !== activeTid), entry];
          localStorage.setItem("prismiq_custom_workspaces", JSON.stringify(updated));
        }
      } catch {
        // ignore
      }

      // Short delay for database consistency and visual confirmation
      setTimeout(() => {
        router.push("/app");
      }, 1200);
    } catch (err: any) {
      setFinalizingError(err.message || "Failed to save workspace configuration. Please retry.");
    }
  };

  // Step Progress Bar Component
  const renderProgressBar = () => {
    const stepsMeta = [
      { num: 1, label: "Your Company" },
      { num: 2, label: "Discovery" },
      { num: 3, label: "Competitors" },
      { num: 4, label: "Preferences" },
      { num: 5, label: "Setup" },
    ];

    return (
      <div className="w-full max-w-2xl mx-auto mb-8 px-4">
        <div className="flex items-center justify-between relative">
          {/* Connector line behind circles */}
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-[2px] bg-[rgba(20,20,30,0.08)] z-0" />
          <div
            className="absolute top-1/2 left-4 -translate-y-1/2 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / (stepsMeta.length - 1)) * 100}%` }}
          />

          {stepsMeta.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                    isCompleted
                      ? "bg-emerald-500 text-white shadow-sm"
                      : isCurrent
                      ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white ring-4 ring-purple-500/20 shadow-md"
                      : "bg-white text-[#8c8e96] border border-[rgba(20,20,30,0.12)]"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : s.num}
                </div>
                <span
                  className={`text-[11px] mt-1.5 font-medium whitespace-nowrap hidden sm:block ${
                    isCurrent ? "text-[#17171b] font-bold" : "text-[#8c8e96]"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="public-site min-h-screen flex flex-col justify-between"
      style={{
        background:
          "radial-gradient(circle at 10% 8%, rgba(139,114,255,0.12), transparent 30rem), radial-gradient(circle at 90% 12%, rgba(114,215,232,0.13), transparent 30rem), radial-gradient(circle at 50% 65%, rgba(244,168,202,0.08), transparent 34rem), #fbfaf8",
      }}
    >
      {/* Top Brand Header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between shrink-0">
        <Link href="/" className="ps-brand flex items-center gap-2.5">
          <svg className="ps-brandLogo" viewBox="0 0 42 42" aria-label="PrismIQ logo">
            <defs>
              <linearGradient id="onbA" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#5A72FF" />
                <stop offset=".52" stopColor="#8B4DFF" />
                <stop offset="1" stopColor="#FF83C8" />
              </linearGradient>
              <linearGradient id="onbB" x1="0" y1="1" x2="1" y2="0">
                <stop stopColor="#62DDF2" />
                <stop offset=".55" stopColor="#7264FF" />
                <stop offset="1" stopColor="#FFB18F" />
              </linearGradient>
            </defs>
            <path d="M21 3 37 31 21 39 5 31Z" fill="url(#onbA)" opacity=".95" />
            <path d="M21 3 21 39 5 31Z" fill="url(#onbB)" opacity=".88" />
            <path d="M21 3 37 31 21 26Z" fill="#9D8CFF" opacity=".72" />
            <path d="M21 26 37 31 21 39Z" fill="#FF72C2" opacity=".58" />
            <path d="M21 8 21 26 13 29Z" fill="#FFFFFF" opacity=".45" />
          </svg>
          <span className="font-extrabold text-lg tracking-tight text-[#17171b]">PrismIQ</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#70717a] hidden sm:inline">
            Logged in as <span className="text-[#17171b]">{user?.email || "workspace"}</span>
          </span>
          <Link
            href="/app"
            className="text-xs font-semibold text-[#595a63] hover:text-[#17171b] px-3 py-1.5 rounded-lg border border-[rgba(20,20,30,0.1)] bg-white/70 hover:bg-white transition-all"
          >
            Skip to App →
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 w-full max-w-5xl mx-auto">
        {showAlreadyOnboardedPrompt ? (
          <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-8 sm:p-10 space-y-7 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <span className="ps-eyebrow mb-1 mx-auto inline-flex">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Active Workspace Configured
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#17171b]">
                You are currently tracking <span className="text-purple-600">{existingTarget}</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#70717a] max-w-md mx-auto leading-relaxed">
                Your workspace is active and monitoring competitive intelligence. You can view your current dashboard or set up a brand-new company workspace.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/app")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-sm cursor-pointer"
              >
                Go to {existingTarget} Dashboard →
              </button>
              <button
                type="button"
                onClick={handleStartNewWorkspace}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 transition-all cursor-pointer"
              >
                + Set Up Another Company
              </button>
            </div>
          </div>
        ) : (
          <>
            {renderProgressBar()}

            {/* ==================================================================== */}
            {/* STEP 1: YOUR COMPANY */}
            {/* ==================================================================== */}
            {step === 1 && (
          <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-8 sm:p-10 space-y-7 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-2 text-center">
              <span className="ps-eyebrow mb-1">
                <Building2 className="h-3.5 w-3.5 text-purple-600" />
                Step 1 of 4
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17171b]">
                Start with your company.
              </h1>
              <p className="text-xs sm:text-sm text-[#70717a] max-w-md mx-auto leading-relaxed">
                PrismIQ will build an automated competitive intelligence view tailored to your
                product footprint, positioning, and market landscape.
              </p>
            </div>

            {step1Error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700"
              >
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{step1Error}</span>
              </div>
            )}

            <form onSubmit={handleCompanySubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="company-name" className="block text-xs font-bold text-[#323338]">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="company-name"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. PostHog, Vercel, Supabase, Stripe"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(20,20,30,0.14)] rounded-xl text-[#17171b] placeholder:text-[#9ea0a8] focus:outline-none focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="company-website" className="block text-xs font-bold text-[#323338]">
                  Company Website <span className="text-red-500">*</span>
                </label>
                <input
                  id="company-website"
                  type="text"
                  required
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  placeholder="e.g. posthog.com or https://posthog.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(20,20,30,0.14)] rounded-xl text-[#17171b] placeholder:text-[#9ea0a8] focus:outline-none focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition-all"
                />
                <p className="text-[11px] text-[#70717a]">
                  Accepts standard formats like example.com or https://example.com
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="company-desc" className="block text-xs font-bold text-[#323338]">
                  Core Offering or Sector <span className="text-xs font-normal text-[#70717a]">(optional)</span>
                </label>
                <textarea
                  id="company-desc"
                  rows={2}
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  placeholder="e.g. Open-source product analytics, session recording, and feature flags"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[rgba(20,20,30,0.14)] rounded-xl text-[#17171b] placeholder:text-[#9ea0a8] focus:outline-none focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-3 py-3 px-4 rounded-xl text-white font-bold text-sm tracking-wide transition-all shadow-[0_10px_25px_rgba(124,58,237,0.28)] hover:shadow-[0_14px_30px_rgba(124,58,237,0.36)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background: "linear-gradient(110deg, #3b82f6, #7c3aed 50%, #ec4899)",
                }}
              >
                <span>Continue to Discovery</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STEP 2: COMPANY DISCOVERY (Meaningful Loading State) */}
        {/* ==================================================================== */}
        {step === 2 && (
          <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-8 sm:p-10 space-y-7 animate-in fade-in duration-200">
            <div className="space-y-2 text-center">
              <span className="ps-eyebrow mb-1">
                <Compass className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                Discovery Agent Active
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17171b]">
                Mapping your competitive landscape...
              </h1>
              <p className="text-xs sm:text-sm text-[#70717a]">
                PrismIQ is running live market discovery on <span className="font-semibold text-[#17171b]">{companyName}</span>.
              </p>
            </div>

            {discoveryError ? (
              <div className="space-y-4 text-center p-4 bg-red-50/80 border border-red-200 rounded-xl">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                <div className="space-y-1 text-xs text-red-800">
                  <p className="font-bold">Discovery encounter notice</p>
                  <p>{discoveryError}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => runDiscovery(companyName)}
                    className="px-4 py-2 bg-white border border-red-300 rounded-lg text-xs font-bold text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Retry Discovery
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompetitors([]);
                      setStep(3);
                    }}
                    className="px-4 py-2 bg-[#17171b] text-white rounded-lg text-xs font-bold hover:bg-black transition-colors cursor-pointer"
                  >
                    Enter Manually →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 py-3">
                {[
                  {
                    stepNum: 1,
                    title: "Analyzing company domain and product architecture",
                    desc: "Crawling public domain signals, product offerings, and documentation.",
                  },
                  {
                    stepNum: 2,
                    title: "Scanning technical writeups & market comparisons",
                    desc: "Checking comparative discussions on Hacker News, repositories, and media.",
                  },
                  {
                    stepNum: 3,
                    title: "Identifying overlapping products & architectures",
                    desc: "Isolating direct competitors, alternative runtimes, and functional overlaps.",
                  },
                  {
                    stepNum: 4,
                    title: "Calibrating candidate confidence & source freshness",
                    desc: "Verifying grounded source citations and eliminating hallucinated matches.",
                  },
                ].map((item) => {
                  const isDone = discoveryStage > item.stepNum;
                  const isCurrent = discoveryStage === item.stepNum;
                  return (
                    <div
                      key={item.stepNum}
                      className={`flex items-start gap-3.5 p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? "bg-purple-50/70 border-purple-200 shadow-sm"
                          : isDone
                          ? "bg-emerald-50/40 border-emerald-100"
                          : "bg-[#fbfaf8] border-[rgba(20,20,30,0.06)] opacity-50"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-gray-300 flex items-center justify-center text-[10px] text-gray-400">
                            {item.stepNum}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-bold ${
                            isCurrent ? "text-purple-900" : isDone ? "text-emerald-950" : "text-[#575861]"
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#70717a] mt-0.5 leading-relaxed">
                          {item.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* STEP 3: REVIEW COMPETITORS */}
        {/* ==================================================================== */}
        {step === 3 && (
          <div className="w-full max-w-4xl bg-white/95 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-6 sm:p-9 space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[rgba(20,20,30,0.06)] pb-5">
              <div>
                <span className="ps-eyebrow mb-1">
                  <Compass className="h-3.5 w-3.5 text-purple-600" />
                  Step 2 of 4 &bull; Human Confirmation Gate
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17171b]">
                  Review your competitive landscape
                </h1>
                <p className="text-xs sm:text-sm text-[#70717a] mt-1">
                  These are the companies PrismIQ will monitor alongside{" "}
                  <span className="font-semibold text-[#17171b]">{companyName}</span>. Select which
                  competitors to track.
                </p>
              </div>

              {/* Counter Pill & Select All Toggle & Manual Add Toggle */}
              <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = competitors.every((c) => c.selected);
                    setCompetitors((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 transition-all cursor-pointer"
                >
                  {competitors.every((c) => c.selected) ? "Deselect All" : "Select All"}
                </button>
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
                  {competitors.filter((c) => c.selected).length} of {competitors.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddManual(!showAddManual)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[rgba(20,20,30,0.12)] bg-white hover:bg-[#fbfaf8] text-[#17171b] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add competitor</span>
                </button>
              </div>
            </div>

            {isDegradedMode && (
              <div
                role="status"
                className="flex items-start gap-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-900 shadow-sm animate-in fade-in duration-200"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-950">Heuristic Fallback Mode</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900">
                      Reduced Precision
                    </span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Competitors were discovered using deterministic pattern matching because LLM synthesis was temporarily unavailable. Results may be less precise — you can retry for full AI analysis or add competitors manually.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runDiscovery(companyName)}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Retry AI Discovery
                </button>
              </div>
            )}

            {step3Error && (
              <div
                role="alert"
                className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700"
              >
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span>{step3Error}</span>
              </div>
            )}

            {/* Manual Add Input Box */}
            {showAddManual && (
              <form
                onSubmit={handleAddManualCompetitor}
                className="p-4 bg-[#fbfaf8] border border-purple-200 rounded-xl space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="manual-name" className="text-xs font-bold text-[#17171b]">
                    Add competitor company name:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddManual(false)}
                    className="text-xs text-[#70717a] hover:text-[#17171b]"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    id="manual-name"
                    type="text"
                    value={newManualName}
                    onChange={(e) => setNewManualName(e.target.value)}
                    placeholder="e.g. Segment, Mixpanel, Amplitude"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[rgba(20,20,30,0.14)] rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

            {/* Empty State */}
            {competitors.length === 0 ? (
              <div className="text-center py-10 px-4 bg-[#fbfaf8] border border-dashed border-[rgba(20,20,30,0.15)] rounded-2xl space-y-3">
                <Search className="h-8 w-8 text-[#9ea0a8] mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#17171b]">No candidate competitors found</p>
                  <p className="text-xs text-[#70717a] max-w-sm mx-auto">
                    The discovery agent did not find indexed comparison writeups. You can add your competitors manually using the button above.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddManual(true)}
                  className="px-4 py-2 bg-white border border-[rgba(20,20,30,0.12)] text-xs font-bold rounded-lg shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  + Add first competitor manually
                </button>
              </div>
            ) : (
              /* Competitors Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[460px] overflow-y-auto pr-1">
                {competitors.map((comp) => {
                  const initialLetter = comp.name.charAt(0).toUpperCase();
                  return (
                    <div
                      key={comp.id}
                      onClick={() => toggleCompetitor(comp.id)}
                      className={`relative p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                        comp.selected
                          ? "bg-purple-50/40 border-purple-300 shadow-sm"
                          : "bg-white border-[rgba(20,20,30,0.08)] opacity-60 hover:opacity-90"
                      }`}
                    >
                      {/* Top Bar: Checkbox + Avatar + Title + Badges */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                            comp.selected
                              ? "bg-purple-600 text-white"
                              : "border border-gray-300 bg-white"
                          }`}
                        >
                          {comp.selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>

                        {/* Letter Avatar */}
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600/10 to-blue-600/10 border border-purple-200/50 flex items-center justify-center font-bold text-xs text-purple-700 shrink-0">
                          {initialLetter}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-[#17171b] truncate">
                              {comp.name}
                            </h3>
                            {comp.isManual && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeManualCompetitor(comp.id);
                                }}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="Remove competitor"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {comp.category && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200/70">
                                {comp.category}
                              </span>
                            )}
                            {comp.tier === "core" ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200/80">
                                Core Competitor
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200/80">
                                Secondary Competitor
                              </span>
                            )}

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                comp.confidence === "High"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : comp.confidence === "Medium"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {comp.confidence} confidence
                            </span>

                            {comp.freshnessNote && comp.freshnessNote.includes("Indirect") ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 border border-amber-200/60 font-medium">
                                Indirect Mention
                              </span>
                            ) : comp.sourceAge ? (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  comp.sourceAge === "recent"
                                    ? "bg-purple-100/70 text-purple-800"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {comp.sourceAge === "recent" ? "Recent source" : "Historical"}
                              </span>
                            ) : null}
                          </div>

                          {comp.website && (
                            <div className="flex items-center gap-1 text-[11px] text-[#70717a] mt-1 font-medium">
                              <ExternalLink className="w-3 h-3 text-[#9ca3af]" />
                              <span>{comp.website}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rationale Body */}
                      <p className="text-xs text-[#575861] leading-relaxed line-clamp-3">
                        {comp.rationale}
                      </p>

                      {/* Source Citation */}
                      <div className="pt-2 border-t border-[rgba(20,20,30,0.06)] text-[11px] text-[#8c8e96] flex items-center justify-between truncate">
                        <span className="truncate">Source: {comp.source}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step 3 Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[rgba(20,20,30,0.06)]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl border border-[rgba(20,20,30,0.12)] text-xs font-bold text-[#575861] hover:text-[#17171b] hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmCompetitorsStep}
                disabled={competitors.filter((c) => c.selected).length === 0 || isConfirmingCompetitors}
                className="py-2.5 px-6 rounded-xl text-white font-bold text-xs tracking-wide transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
                style={{
                  background: "linear-gradient(110deg, #3b82f6, #7c3aed 50%, #ec4899)",
                }}
              >
                {isConfirmingCompetitors ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Competitors...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Intelligence Preferences</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STEP 4: WHAT SHOULD PRISMIQ WATCH? (Intelligence Preferences) */}
        {/* ==================================================================== */}
        {step === 4 && (
          <div className="w-full max-w-3xl bg-white/95 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-6 sm:p-9 space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <span className="ps-eyebrow mb-1">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                Step 3 of 4 &bull; Intelligence Configuration
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17171b]">
                What should PrismIQ watch?
              </h1>
              <p className="text-xs sm:text-sm text-[#70717a] max-w-lg mx-auto">
                Configure the strategic themes and signals PrismIQ will track across your competitors.
                These map directly to your workspace research radar.
              </p>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {SUPPORTED_INTELLIGENCE_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = selectedTopics.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleTopic(opt.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer select-none space-y-2.5 ${
                      isSelected
                        ? "bg-purple-50/50 border-purple-300 shadow-sm"
                        : "bg-white border-[rgba(20,20,30,0.08)] opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-purple-600 text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                            {opt.category}
                          </div>
                          <div className="text-xs font-bold text-[#17171b]">
                            {opt.label}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "bg-purple-600 text-white"
                            : "border border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#575861] leading-relaxed">
                      {opt.description}
                    </p>

                    <div className="flex items-center gap-1 flex-wrap">
                      {opt.keywords.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[rgba(20,20,30,0.08)] text-gray-600"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step 4 Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[rgba(20,20,30,0.06)]">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-xl border border-[rgba(20,20,30,0.12)] text-xs font-bold text-[#575861] hover:text-[#17171b] hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleFinalizeSetup}
                className="py-3 px-6 rounded-xl text-white font-bold text-sm tracking-wide transition-all shadow-[0_10px_25px_rgba(124,58,237,0.28)] hover:shadow-[0_14px_30px_rgba(124,58,237,0.36)] hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 cursor-pointer"
                style={{
                  background: "linear-gradient(110deg, #3b82f6, #7c3aed 50%, #ec4899)",
                }}
              >
                <span>Build my intelligence feed</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STEP 5: FINALIZING & COMPLETE SETUP */}
        {/* ==================================================================== */}
        {step === 5 && (
          <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-8 sm:p-10 space-y-6 text-center animate-in fade-in duration-200">
            {finalizingError ? (
              <div className="space-y-4">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#17171b]">Setup Error</h2>
                  <p className="text-xs text-red-600">{finalizingError}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Back to settings
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeSetup}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
                  >
                    Retry Setup
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-[#17171b]">
                    Building your intelligence feed...
                  </h2>
                  <p className="text-xs text-[#70717a]">{finalizingStep}</p>
                </div>

                <div className="text-[11px] text-[#8c8e96] bg-gray-50 p-3 rounded-xl border border-gray-100 text-left space-y-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Target company: <strong>{companyName}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Tracking <strong>{competitors.filter((c) => c.selected).length}</strong> competitors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Configured <strong>{selectedTopics.length}</strong> active research topics</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    )}
  </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs text-[#9ea0a8]">
        PrismIQ Competitive Intelligence Workspace Setup &bull; Tenant Isolation via PostgreSQL RLS
      </footer>
    </div>
  );
}
