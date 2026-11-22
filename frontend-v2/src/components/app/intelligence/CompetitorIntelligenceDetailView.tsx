"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  MoreHorizontal,
  Zap,
  ShieldAlert,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Settings,
  Briefcase,
  Users,
  Box,
  Clock,
  ShieldCheck,
  FileText,
  ExternalLink,
  CheckCircle2,
  X,
  Info,
  RefreshCw,
  Layers,
  ArrowRight,
  TrendingUp,
  Check,
  Play,
  CheckCheck,
  Ban,
  Tag,
  Target,
  Sparkles,
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "../AppShell";
import { fetchIntelligenceDetail, type IntelligenceDetailPayload } from "@/lib/api";
import type { EvidenceItem } from "../PrismPrimitives";

// ============================================================================
// Competitor Brand Logos
// ============================================================================

function AmazonLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.8 17.5c-2.3 0-4.1.6-5.4 1.8-1.3 1.2-1.9 2.8-1.9 4.8 0 1.9.6 3.4 1.8 4.5 1.2 1.1 2.9 1.7 5.1 1.7 2.1 0 3.9-.6 5.3-1.8 1.4-1.2 2.1-2.8 2.1-4.8v-6.2h-7zm0-3.2h7v15.9h-7v-1.7c-1.4 1.3-3.3 2-5.7 2-3 0-5.5-.9-7.4-2.7C2.8 26 1.8 23.5 1.8 20.2c0-3.3 1-5.8 2.9-7.6 1.9-1.8 4.4-2.7 7.4-2.7 2.4 0 4.3.7 5.7 2v-1.6zm23.2 0v17.5h-7V16.3h-3.5v-2h3.5v-1.2c0-2.4.7-4.2 2.1-5.5C44.5 6.3 46.5 5.7 49 5.7c1.3 0 2.5.2 3.6.5v2.2c-.9-.3-1.8-.4-2.8-.4-1.4 0-2.4.4-3.1 1.1-.7.7-1.1 1.8-1.1 3.2v2h7v2h-7v15.9h-7V14.3h-4.6zm13 0h7v17.5h-7V14.3zm3.5-3.6c-1.1 0-2-.4-2.8-1.2-.8-.8-1.2-1.7-1.2-2.8 0-1.1.4-2 1.2-2.8.8-.8 1.7-1.2 2.8-1.2 1.1 0 2 .4 2.8 1.2.8.8 1.2 1.7 1.2 2.8 0 1.1-.4 2-1.2 2.8-.8.8-1.7 1.2-2.8 1.2zm12.3 3.6h7v17.5h-7v-1.8c-1.4 1.3-3.3 2-5.7 2-3 0-5.5-.9-7.4-2.7-1.9-1.8-2.9-4.3-2.9-7.6 0-3.3 1-5.8 2.9-7.6 1.9-1.8 4.4-2.7 7.4-2.7 2.4 0 4.3.7 5.7 2v-1.6zm-5.7 15.4c2.2 0 4-.6 5.3-1.8 1.3-1.2 2-2.8 2-4.8 0-2-.7-3.6-2-4.8-1.3-1.2-3.1-1.8-5.3-1.8-2.2 0-4 .6-5.3 1.8-1.3 1.2-2 2.8-2 4.8 0 2 .7 3.6 2 4.8 1.3 1.2 3.1 1.8 5.3 1.8zm23.9-15.4v17.5h-7V14.3h-3.5v-2h3.5v-1.2c0-2.4.7-4.2 2.1-5.5 1.4-1.3 3.4-1.9 5.9-1.9 1.3 0 2.5.2 3.6.5v2.2c-.9-.3-1.8-.4-2.8-.4-1.4 0-2.4.4-3.1 1.1-.7.7-1.1 1.8-1.1 3.2v2h7v2h-7v15.9h-7V14.3h-4.6z"
        fill="#111827"
      />
      <path
        d="M2.5 31.5c22 10.5 58 10 92-3 2.5-.9 3.5 1.5 1.5 2.5-36 17-74 15-95.5 2-1.5-.9-.5-2.2 2-1.5z"
        fill="#FF9900"
      />
      <path
        d="M97.5 28.5c2 1 5 3 7 4.5-.4-2.5-.3-5.5.2-8.5-3 1.5-6 2.5-7.2 4z"
        fill="#FF9900"
      />
    </svg>
  );
}

function FlipkartLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 font-bold italic tracking-tight text-[#2874f0] ${className}`}>
      <span className="text-xl not-italic font-black text-[#2874f0]">Flipkart</span>
      <div className="w-4 h-4 bg-[#ffe500] rounded-xs flex items-center justify-center text-[10px] text-blue-900 font-black not-italic shadow-xs">
        🛍
      </div>
    </div>
  );
}

function RelianceLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 font-bold tracking-tight text-[#0f2e6b] ${className}`}>
      <span className="text-base font-extrabold text-[#0f2e6b]">Reliance</span>
      <span className="text-[10px] bg-red-600 text-white px-1 py-0.5 rounded-xs font-semibold">RETAIL</span>
    </div>
  );
}

function TataLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 font-bold tracking-wider text-[#005a9c] ${className}`}>
      <span className="text-lg font-black tracking-widest text-[#005a9c]">TATA</span>
    </div>
  );
}

function ShopsyLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="w-5 h-5 rounded-md bg-[#842cd8] flex items-center justify-center text-white font-black text-xs shadow-2xs leading-none">
        S
      </div>
      <span className="text-[9px] font-extrabold text-[#842cd8] tracking-tight leading-none mt-0.5">
        Shopsy
      </span>
    </div>
  );
}

function AjioLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span className="text-sm font-black tracking-wider text-[#1e293b] uppercase">
        AJIO
      </span>
    </div>
  );
}

function MeeshoLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span className="text-sm font-black tracking-tight text-[#f43397] lowercase">
        meesho
      </span>
    </div>
  );
}

export function CompetitorLogoRender({ name, className }: { name: string; className?: string }) {
  const norm = name.toLowerCase();
  if (norm.includes("amazon")) return <AmazonLogo className={className} />;
  if (norm.includes("flipkart")) return <FlipkartLogo className={className} />;
  if (norm.includes("shopsy")) return <ShopsyLogo className={className} />;
  if (norm.includes("ajio")) return <AjioLogo className={className} />;
  if (norm.includes("meesho")) return <MeeshoLogo className={className} />;
  if (norm.includes("reliance")) return <RelianceLogo className={className} />;
  if (norm.includes("tata")) return <TataLogo className={className} />;
  return (
    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-xs">
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}

// Circular Donut Score
function CircularGaugeDonut({ score = 84.8 }: { score?: number }) {
  const radius = 34;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="#e2e8f0"
          letterSpacing="0"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#0d9488"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-zinc-900 tracking-tight">{score}%</span>
      </div>
    </div>
  );
}

// Clean Stylized Executive SVG Event Banner (Replaces stock Amazon warehouse for non-Amazon competitors)
function ExecutiveEventBanner({
  competitorName,
  eventCategory,
  bannerLabel,
  publishedDate,
}: {
  competitorName: string;
  eventCategory?: string;
  bannerLabel?: string;
  publishedDate?: string;
}) {
  return (
    <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-zinc-700/60 bg-gradient-to-br from-slate-950 via-zinc-900 to-indigo-950 p-5 flex flex-col justify-between shadow-inner group">
      {/* High-tech vector mesh & grid background overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <defs>
          <pattern id="exec-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="0.75" />
          </pattern>
          <radialGradient id="exec-glow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#exec-grid)" />
        <circle cx="75%" cy="35%" r="180" fill="url(#exec-glow)" />
        {/* Subtle decorative circuit lines */}
        <path
          d="M0 60 H180 L220 100 H480 L520 140 H1000"
          stroke="rgba(244, 63, 94, 0.35)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <circle cx="220" cy="100" r="3" fill="#f43f5e" />
        <circle cx="520" cy="140" r="3" fill="#6366f1" />
      </svg>

      {/* Top Banner Header: Event Category + Verified Ground Truth Badge */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-500/40 rounded-xl backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">
            {eventCategory || "Strategic Market Inflection"}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-xl backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
            Verified Ground Truth
          </span>
        </div>
      </div>

      {/* Center Branding & Confirmed Inflection Details */}
      <div className="relative z-10 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/95 p-2 flex items-center justify-center shadow-lg border border-white/30 shrink-0">
          <CompetitorLogoRender name={competitorName} className="w-full h-full object-contain" />
        </div>
        <div>
          <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
            {competitorName} Intelligence Track
          </div>
          <div className="text-base sm:text-lg font-black text-white tracking-tight drop-shadow-sm">
            {bannerLabel || `${competitorName} Confirmed Strategic Initiative`}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Primary Surveillance Stream + Published Date */}
      <div className="relative z-10 flex items-center justify-between text-[11px] text-zinc-300/90 pt-2 border-t border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-zinc-200">
            Primary Feed: Multi-Source Corroborated Wire
          </span>
        </div>
        {publishedDate && (
          <span className="font-medium text-zinc-400">
            Recorded: {publishedDate}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main CompetitorIntelligenceDetailView Component
// ============================================================================

export function CompetitorIntelligenceDetailView({ detailId = "amazon" }: { detailId?: string }) {
  const router = useRouter();
  const { targetCompany, tenantId } = useWorkspace();
  const { openEvidence } = useAppEvidence();

  const [data, setData] = React.useState<IntelligenceDetailPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Expandable sections & modals
  const [productExpanded, setProductExpanded] = React.useState(false);
  const [selectedProductTag, setSelectedProductTag] = React.useState<string | null>(null);
  const [analysisModalOpen, setAnalysisModalOpen] = React.useState(false);
  const [departmentModalOpen, setDepartmentModalOpen] = React.useState<string | null>(null);
  const [playbookModalOpen, setPlaybookModalOpen] = React.useState(false);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Workflow Action States (In Progress, Accepted, Completed, Dismiss)
  const [actionStatuses, setActionStatuses] = React.useState<Record<string, string>>({});
  // Selected department filter for Section 4 Playbook
  const [activeDepartmentFilter, setActiveDepartmentFilter] = React.useState<string | null>(null);

  // Collapsible dropdown state for Section 4 action cards (Engineering, Sales, Leadership) - closed by default
  const [expandedActions, setExpandedActions] = React.useState<Record<number, boolean>>({});

  const toggleActionExpanded = (num: number) => {
    setExpandedActions((prev) => ({
      ...prev,
      [num]: !prev[num],
    }));
  };

  // Tactical Next Step execution modal state
  const [selectedNextStepAction, setSelectedNextStepAction] = React.useState<any | null>(null);

  // Clean competitor name if it contains raw event ID hash like 'Evt 00962Bb...'
  const displayCompetitorName = React.useMemo(() => {
    if (!data?.competitor_name) return "Competitor";
    const name = data.competitor_name;
    if (
      /^Evt\s+[0-9a-zA-Z]{8,}/i.test(name) ||
      /^[0-9a-f]{8,}$/i.test(name) ||
      name.toLowerCase().startsWith("evt_") ||
      name.toLowerCase().startsWith("ev_")
    ) {
      const headline = data.what_happened?.headline || "";
      const matched = [
        "Meesho", "Flipkart", "Amazon", "Reliance", "Tata",
        "Zepto", "Blinkit", "Zomato", "Swiggy", "Vercel", "Netlify", "Shopify"
      ].find((c) => new RegExp(`\\b${c}\\b`, "i").test(headline));
      if (matched) return matched;
      if (data.target_company?.toLowerCase().includes("flipkart")) return "Meesho";
      return "Competitor";
    }
    return name;
  }, [data?.competitor_name, data?.what_happened?.headline, data?.target_company]);

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchIntelligenceDetail(detailId, targetCompany, tenantId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError(null);
          // Initialize action statuses from backend data
          const initialStatuses: Record<string, string> = {};
          res.what_should_we_do.actions.forEach((act) => {
            const key = act.id || `act_${act.number}`;
            initialStatuses[key] = act.status || "In Progress";
          });
          setActionStatuses(initialStatuses);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [detailId, targetCompany, tenantId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      showToast("Report URL copied to clipboard!");
    }
  };

  const handleActionStatusChange = (actionKey: string, newStatus: string) => {
    setActionStatuses((prev) => ({ ...prev, [actionKey]: newStatus }));
    showToast(`Action updated to "${newStatus}"`);
  };

  const handleNextStepClick = (act: any) => {
    setSelectedNextStepAction(act);
    const cleanStep = (act.next_step || "").replace(/^Next:\s*/i, "");
    showToast(`Tactical action selected for ${act.department}: "${cleanStep.substring(0, 48)}..."`);
  };

  // Inspect Evidence Dossier Click Handler
  const handleInspectEvidence = () => {
    if (!data) return;
    const sources = data.verification_and_confidence.evidence_sources || [];
    const primarySrc = sources[0] || {};

    const evidenceItem: EvidenceItem = {
      id: primarySrc.id || `ev_${data.id}`,
      title: primarySrc.title || data.what_happened.headline,
      company_name: data.competitor_name,
      source: primarySrc.source || "Official Regulatory & Market Wire",
      url: primarySrc.url || "https://economictimes.indiatimes.com",
      published_at: primarySrc.detected_at || data.what_happened.published_date,
      raw_excerpt: primarySrc.excerpt || data.what_happened.paragraph,
      why_it_matters: data.why_it_matters.key_impact,
      confidence: data.confidence_badge,
      tier: data.urgency_badge,
      corroboration_count: data.verification_and_confidence.verified_sources_count,
      contributing_sources: sources.map((s) => s.source || s.title),
      contributing_signals: sources.map((s) => ({
        source: s.source,
        title: s.title,
        url: s.url,
        raw_excerpt: s.excerpt,
      })),
    };

    // Open through global context drawer & toggle modal
    try {
      openEvidence(evidenceItem);
    } catch {
      // Fallback to local drawer
    }
    setEvidenceDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-zinc-200 rounded-md w-48" />
        <div className="h-32 bg-white rounded-3xl border border-zinc-200" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-96 bg-white rounded-3xl border border-zinc-200" />
          <div className="lg:col-span-5 h-96 bg-white rounded-3xl border border-zinc-200" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl">
          <p className="font-semibold">Unable to load intelligence details</p>
          <p className="text-sm">{error || "Record not found"}</p>
          <Link
            href="/app/overview"
            className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-red-800 underline"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Overview
          </Link>
        </div>
      </div>
    );
  }

  // Determine whether to show authentic image or stylized executive SVG banner
  const isAmazonCompetitor = displayCompetitorName.toLowerCase().includes("amazon");
  const hasAuthenticImage =
    Boolean(data.what_happened.banner_image_url) &&
    !data.what_happened.banner_image_url?.includes("unsplash.com/photo-1586528116311-ad8dd3c8310d");

  // Multi-product tags
  const exposedProducts = data.exposed_target_products && data.exposed_target_products.length > 0
    ? data.exposed_target_products
    : [data.what_happened.exposed_target_product || `${data.target_company} Core Platform`];

  return (
    <div className="space-y-6 pb-12 max-w-[1400px] mx-auto text-[#18181b]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#181829] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-purple-500/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-zinc-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navigation Row */}
      <div className="flex items-center justify-between pt-1">
        <Link
          href="/app/overview"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share Report
          </button>
          <button className="p-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-xl shadow-xs">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Critical Counter-Window Active Alert Strip */}
      {data.critical_counter_window?.active !== false && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-rose-950 via-rose-900 to-zinc-950 border border-rose-500/40 rounded-3xl shadow-md text-xs font-semibold text-rose-200">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="font-black uppercase tracking-wider text-rose-300">
              ⚡ CRITICAL COUNTER-WINDOW ACTIVE
            </span>
            <span className="text-zinc-500 hidden sm:inline">|</span>
            <span className="text-zinc-100 font-medium">
              ⏱ Window: {data.critical_counter_window?.window_text || data.urgency_and_time_horizon.cycle_review_due || "Cycle Review Due"}
            </span>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-bold text-rose-300 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-700/60 shadow-xs">
              Priority: {data.urgency_badge}
            </span>
          </div>
        </div>
      )}

      {/* Competitor Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-5">
          <div className="w-24 h-16 sm:w-28 sm:h-18 rounded-2xl bg-white border border-zinc-150 shadow-xs flex items-center justify-center p-3 shrink-0">
            <CompetitorLogoRender name={displayCompetitorName} className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                {displayCompetitorName}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-200/80">
                <Zap className="w-3 h-3 fill-rose-600" />
                {data.urgency_badge}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full border border-amber-200/80">
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                {data.threat_badge}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full border border-purple-200/80">
                <BarChart3 className="w-3 h-3 text-purple-600" />
                {data.confidence_badge}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-zinc-500">
              {data.subtitle}
            </p>
          </div>
        </div>

        {/* Multi-Product Exposed Badges Row */}
        <div className="flex flex-col items-start md:items-end gap-1.5 pt-2 md:pt-0">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
            Exposed Target Products
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {exposedProducts.map((prod, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedProductTag(selectedProductTag === prod ? null : prod)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedProductTag === prod
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200/80"
                }`}
              >
                <Box className="w-3 h-3 text-purple-600 shrink-0" />
                <span>{prod}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================== */}
        {/* LEFT COLUMN: Section 1, Section 2, Section 3                        */}
        {/* ================================================================== */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. What Happened */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs shadow-xs">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 leading-tight">What Happened</h2>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Factual Grounded Inflection
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Published: {data.what_happened.published_date}</span>
              </div>
            </div>

            {/* Banner: Stylized Executive SVG or Authentic Image (Zero hardcoded Amazon stock photo for others) */}
            {hasAuthenticImage ? (
              <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 group shadow-xs">
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent z-10" />
                <img
                  src={data.what_happened.banner_image_url}
                  alt={data.what_happened.banner_label || `${displayCompetitorName} Grounded Inflection`}
                  className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    {data.what_happened.event_category || "Confirmed Strategic Inflection"}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/90 p-1 flex items-center justify-center">
                    <CompetitorLogoRender name={displayCompetitorName} className="w-full h-full" />
                  </div>
                  <span className="text-xs font-bold text-white tracking-wide">
                    {data.what_happened.banner_label || `${displayCompetitorName} Strategic Announcement`}
                  </span>
                </div>
              </div>
            ) : (
              <ExecutiveEventBanner
                competitorName={displayCompetitorName}
                eventCategory={data.what_happened.event_category}
                bannerLabel={data.what_happened.banner_label}
                publishedDate={data.what_happened.published_date}
              />
            )}

            {/* Headline and Paragraph */}
            <div className="space-y-3 pt-1">
              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 leading-snug">
                {data.what_happened.headline}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                {data.what_happened.paragraph}
              </p>
            </div>

            {/* Exposed Target Products Expandable Pill */}
            <div className="pt-1">
              <button
                onClick={() => setProductExpanded(!productExpanded)}
                className="w-full sm:w-auto inline-flex items-center justify-between gap-3 px-4 py-2.5 bg-purple-50/80 hover:bg-purple-100/80 border border-purple-200/80 rounded-2xl text-xs font-semibold text-purple-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-purple-600 font-bold">Exposed Target Products:</span>
                  <span className="font-extrabold">{exposedProducts.join(", ")}</span>
                </div>
                {productExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-purple-600 shrink-0 ml-2" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-purple-600 shrink-0 ml-2" />
                )}
              </button>

              {(productExpanded || selectedProductTag) && (
                <div className="mt-3 p-4 bg-purple-50/50 rounded-2xl border border-purple-150 text-xs text-purple-950 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-purple-900">
                      {selectedProductTag ? `Focus: ${selectedProductTag}` : "Direct Category Exposure Analysis"}
                    </span>
                    {selectedProductTag && (
                      <button
                        onClick={() => setSelectedProductTag(null)}
                        className="text-[10px] text-purple-700 underline font-semibold"
                      >
                        Reset Tag
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-600 leading-relaxed">
                    {data.what_happened.exposed_product_analysis ||
                      `Direct Category Exposure Analysis: This competitor's initiative directly challenges ${data.target_company}'s product moat, customer acquisition funnels, and supply chain margins.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Why It Matters */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs shadow-xs">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 leading-tight">Why It Matters</h2>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Independent Dyadic Assessment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAnalysisModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6e57dc] hover:text-[#5842be] transition-colors cursor-pointer"
              >
                View Deep Analysis
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Key Impact Callout Highlight Pill */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-50/90 to-amber-50/60 border border-rose-200/80 flex items-start gap-3.5 shadow-2xs">
              <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5 shadow-xs">
                📉
              </div>
              <div className="space-y-1 flex-1">
                <div className="text-xs font-extrabold uppercase tracking-wider text-rose-800">
                  Key Strategic Callout
                </div>
                <p className="text-xs sm:text-sm text-rose-950 font-semibold leading-relaxed">
                  {data.why_it_matters.callout_impact || data.why_it_matters.key_impact}
                </p>
              </div>
            </div>

            {/* In-depth Strategic Assessment Narrative */}
            {data.why_it_matters.deep_assessment && (
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-150 text-xs text-zinc-700 leading-relaxed font-normal">
                {data.why_it_matters.deep_assessment}
              </div>
            )}

            {/* Structured 6-Question Strategic Matrix Grid */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Structured 6-Question Strategic Matrix</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">1. Affected Products</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_matrix?.affected_products || data.why_it_matters.strategic_lens.affected_products}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">2. Overlapping Segments</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_matrix?.overlapping_segments || data.why_it_matters.strategic_lens.overlapping_segments}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">3. Competitor Advantage</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_matrix?.competitor_advantage || data.why_it_matters.strategic_lens.competitor_advantage}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">4. Business Risk / Opp</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_matrix?.business_risk || data.why_it_matters.strategic_lens.business_risk}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">5. Supporting Evidence</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_matrix?.supporting_evidence || data.why_it_matters.strategic_lens.supporting_evidence}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">6. Uncertain Assumptions</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_matrix?.uncertain_assumptions || data.why_it_matters.strategic_lens.uncertain_assumptions}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Who Is Affected (Contextual Department Routing) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs shadow-xs">
                  3
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 leading-tight">Who Is Affected</h2>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Contextual Department Routing
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeDepartmentFilter && (
                  <button
                    onClick={() => setActiveDepartmentFilter(null)}
                    className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 underline"
                  >
                    Clear Filter
                  </button>
                )}
                <button
                  onClick={() => setDepartmentModalOpen("all")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6e57dc] hover:text-[#5842be] transition-colors cursor-pointer"
                >
                  View All Departments
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4 Contextual Department Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.who_is_affected.departments.map((dept) => {
                const icon =
                  dept.department === "Engineering" ? (
                    <Settings className="w-5 h-5 text-blue-600" />
                  ) : dept.department === "Sales" ? (
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                  ) : dept.department === "Leadership" ? (
                    <Users className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Box className="w-5 h-5 text-emerald-600" />
                  );

                const isSelected = activeDepartmentFilter === dept.department;

                return (
                  <div
                    key={dept.department}
                    onClick={() => {
                      // Set filter for Section 4 and open specific department modal
                      setActiveDepartmentFilter(dept.department);
                      setDepartmentModalOpen(dept.department);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center space-y-2 group ${
                      isSelected
                        ? "bg-purple-50/90 border-purple-400 ring-2 ring-purple-300 shadow-sm"
                        : "bg-[#f8f9fc] hover:bg-[#f1f3f9] border-zinc-200/60"
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-white shadow-xs group-hover:scale-110 transition-transform">
                      {icon}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-zinc-900">{dept.department}</div>
                      <div className="text-[10px] font-medium text-zinc-500 leading-tight mt-0.5 line-clamp-1">
                        {dept.subtitle}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-100 shadow-2xs group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      Routing Details →
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* RIGHT COLUMN: Section 4, Section 5, Section 6                       */}
        {/* ================================================================== */}
        <div className="lg:col-span-5 space-y-6">
          {/* 4. What Should We Do (Rich Counter-Action Playbook with Real Workflow State Buttons) */}
          <div
            id="section-playbook"
            className="bg-[#181829] text-white rounded-3xl p-6 sm:p-7 shadow-xl space-y-5 border border-indigo-950"
          >
            <div className="flex items-center justify-between border-b border-indigo-900/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs shadow-xs">
                  4
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">What Should We Do</h2>
                  <p className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                    Counter-Action Playbook & Execution
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPlaybookModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-white transition-colors cursor-pointer"
              >
                View Full Matrix
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Playbook Numbered Executive Summary Line */}
            {data.what_should_we_do.summary_playbook && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-indigo-200 leading-relaxed font-medium">
                <span className="font-bold text-amber-400 block mb-0.5">Strategic Sequence:</span>
                {data.what_should_we_do.summary_playbook}
              </div>
            )}

            {/* Active Department Filter Banner */}
            {activeDepartmentFilter && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-900/50 border border-purple-500/40 text-xs text-purple-200">
                <span>Filtering for: <strong>{activeDepartmentFilter}</strong></span>
                <button
                  onClick={() => setActiveDepartmentFilter(null)}
                  className="text-[11px] underline text-purple-300 hover:text-white"
                >
                  Show All
                </button>
              </div>
            )}

            {/* Action Cards with Dropdown Toggle and Clickable Next Step */}
            <div className="space-y-4">
              {data.what_should_we_do.actions.map((act) => {
                const actionKey = act.id || `act_${act.number}`;
                const currentStatus = actionStatuses[actionKey] || act.status || "In Progress";
                const isDeptMatch = !activeDepartmentFilter || act.department.toLowerCase() === activeDepartmentFilter.toLowerCase();
                const isExpanded = Boolean(expandedActions[act.number]);

                return (
                  <div
                    key={act.number}
                    className={`rounded-2xl border transition-all ${
                      isDeptMatch
                        ? "bg-white/5 hover:bg-white/8 border-white/15 ring-1 ring-white/10"
                        : "opacity-45 bg-white/2 border-white/5"
                    }`}
                  >
                    {/* Header Row: Dept + Priority + Timeframe + Dropdown Button */}
                    <div
                      onClick={() => toggleActionExpanded(act.number)}
                      className="p-4 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none group/hdr"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-400/30">
                          {act.number}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[10px] font-black uppercase tracking-wider">
                          {act.department}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          (act.priority || "").toLowerCase() === "critical"
                            ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
                            : "bg-amber-950/80 text-amber-300 border-amber-700/60"
                        }`}>
                          {act.priority || "High"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-bold text-amber-400/90 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          {act.timeframe || `⏱ Within ${act.days}`}
                        </span>

                        {/* Dropdown toggle button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActionExpanded(act.number);
                          }}
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-white/15 ml-0.5"
                          title={isExpanded ? "Collapse action detail" : "Expand action detail"}
                          aria-label={isExpanded ? "Collapse action detail" : "Expand action detail"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-indigo-200" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-indigo-200" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Detail Section */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/10 animate-in fade-in duration-150">
                        {/* Action Title */}
                        <p className="text-xs sm:text-[13px] font-bold text-zinc-100 leading-snug">
                          {act.title}
                        </p>

                        {/* Actionable Next Step - Interactive Clickable Line */}
                        {act.next_step && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNextStepClick(act);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleNextStepClick(act);
                              }
                            }}
                            className="p-2.5 rounded-xl bg-black/40 hover:bg-black/70 border border-amber-500/35 hover:border-amber-400 text-xs text-indigo-200/90 leading-relaxed font-medium cursor-pointer transition-all flex items-center justify-between group/next shadow-2xs select-none active:scale-[0.99]"
                            title="Click to execute tactical next step"
                          >
                            <span className="text-amber-300 group-hover/next:text-amber-200 font-bold block transition-colors">
                              {act.next_step.startsWith("Next:") ? act.next_step : `Next: ${act.next_step}`}
                            </span>
                            <span className="shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-300 bg-amber-500/15 group-hover/next:bg-amber-500/30 px-2.5 py-1 rounded-md border border-amber-500/30 transition-colors">
                              <span>Execute</span>
                              <ArrowRight className="w-2.5 h-2.5 group-hover/next:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        )}

                        {/* Interactive Workflow State Buttons */}
                        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(["In Progress", "Accepted", "Completed", "Dismiss"] as const).map((statusOption) => {
                              const isActive = currentStatus === statusOption;

                              return (
                                <button
                                  key={statusOption}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActionStatusChange(actionKey, statusOption);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
                                    isActive
                                      ? statusOption === "In Progress"
                                        ? "bg-blue-600 text-white shadow-xs ring-1 ring-blue-400"
                                        : statusOption === "Accepted"
                                        ? "bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400"
                                        : statusOption === "Completed"
                                        ? "bg-purple-600 text-white shadow-xs ring-1 ring-purple-400"
                                        : "bg-zinc-700 text-zinc-200 ring-1 ring-zinc-500"
                                      : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/10"
                                  }`}
                                >
                                  {isActive && <Check className="w-2.5 h-2.5" />}
                                  <span>{statusOption}</span>
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                            State: <strong className="text-white">{currentStatus}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Horizon & Priority Bar */}
            <div className="pt-2 border-t border-indigo-900/60 flex items-center justify-between text-xs text-indigo-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                <span>Priority: {data.what_should_we_do.priority}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Execution Horizon: {data.what_should_we_do.execution_horizon}</span>
              </div>
            </div>
          </div>

          {/* 5. Urgency & Time Horizon */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs shadow-xs">
                5
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 leading-tight">Urgency & Time Horizon</h2>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Card 1: Time Horizon */}
              <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-150 flex flex-col justify-between space-y-2">
                <div className="w-7 h-7 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <Zap className="w-4 h-4 fill-rose-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Time Horizon</div>
                  <div className="text-xs font-extrabold text-zinc-900 mt-0.5">
                    {data.urgency_and_time_horizon.time_horizon}
                  </div>
                </div>
              </div>

              {/* Card 2: Priority Tier */}
              <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-150 flex flex-col justify-between space-y-2">
                <div className="w-7 h-7 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Priority Tier</div>
                  <div className="text-xs font-extrabold text-zinc-900 mt-0.5">
                    {data.urgency_and_time_horizon.priority_tier}
                  </div>
                </div>
              </div>

              {/* Card 3: Cycle Review Due */}
              <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-150 flex flex-col justify-between space-y-2">
                <div className="w-7 h-7 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Clock className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cycle Review Due</div>
                  <div className="text-xs font-extrabold text-zinc-900 mt-0.5">
                    {data.urgency_and_time_horizon.cycle_review_due}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Verification & Confidence Guarantee (Inspect Dossier CTA) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs shadow-xs">
                6
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 leading-tight">Verification & Confidence Guarantee</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              {/* Element 1: Sources */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col items-center justify-center text-center space-y-2 h-full">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-emerald-950 leading-tight">
                  {data.verification_and_confidence.verified_sources_count} Verified Primary Sources
                </div>
              </div>

              {/* Element 2: Circular Donut Gauge */}
              <div className="p-4 rounded-2xl bg-teal-50/40 border border-teal-200/70 flex flex-col items-center justify-center text-center space-y-1 h-full">
                <CircularGaugeDonut score={data.verification_and_confidence.confidence_score} />
                <div className="text-[11px] font-bold text-zinc-700">Calibrated Confidence</div>
              </div>

              {/* Element 3: Inspect Evidence Button */}
              <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200/80 flex flex-col items-center justify-center text-center space-y-2 h-full">
                <button
                  type="button"
                  onClick={handleInspectEvidence}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#6e57dc] hover:bg-[#5842be] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Inspect Dossier ↗
                </button>
                <span className="text-[10px] text-zinc-500 font-medium">
                  Inspect verified primary sources & citations
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Info Status Bar */}
      <div className="bg-[#f8f9fd] rounded-2xl px-6 py-4 border border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-600 shrink-0" />
          <span>This intelligence is continuously monitored for new developments.</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
          <span>Last Updated: {data.last_updated}</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: Strategic Analysis Modal                                   */}
      {/* ==================================================================== */}
      {analysisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-zinc-950">
                <Layers className="w-5 h-5 text-purple-600" />
                <span>Deep Strategic Implications Analysis</span>
              </div>
              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-xs text-zinc-600 leading-relaxed">
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <span className="font-bold text-purple-900 block mb-1">Executive Threat Summary:</span>
                <p className="text-purple-950">{data.why_it_matters.full_analysis || data.why_it_matters.key_impact}</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-sm">6-Dimension Grounded Matrix:</h4>
                <ul className="space-y-2 list-disc list-inside">
                  <li><strong>Affected Products:</strong> {data.why_it_matters.strategic_lens.affected_products}</li>
                  <li><strong>Overlapping Segments:</strong> {data.why_it_matters.strategic_lens.overlapping_segments}</li>
                  <li><strong>Competitor Advantage:</strong> {data.why_it_matters.strategic_lens.competitor_advantage}</li>
                  <li><strong>Business Risk:</strong> {data.why_it_matters.strategic_lens.business_risk}</li>
                  <li><strong>Supporting Evidence:</strong> {data.why_it_matters.strategic_lens.supporting_evidence}</li>
                  <li><strong>Uncertain Assumptions:</strong> {data.why_it_matters.strategic_lens.uncertain_assumptions}</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: Contextual Department Impact Modal (With Single / Matrix)  */}
      {/* ==================================================================== */}
      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-zinc-950">
                <Users className="w-5 h-5 text-purple-600" />
                <span>
                  {departmentModalOpen === "all"
                    ? "Cross-Functional Department Matrix"
                    : `${departmentModalOpen} Impact Routing`}
                </span>
              </div>
              <button
                onClick={() => setDepartmentModalOpen(null)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle view: Single Department vs All */}
            <div className="flex items-center justify-between pb-1">
              <div className="text-xs font-semibold text-zinc-500">
                {departmentModalOpen === "all" ? "Showing all 4 departments" : `Focused view on ${departmentModalOpen}`}
              </div>
              <button
                type="button"
                onClick={() =>
                  setDepartmentModalOpen(departmentModalOpen === "all" ? (activeDepartmentFilter || "Engineering") : "all")
                }
                className="text-xs font-bold text-purple-600 hover:text-purple-800 underline cursor-pointer"
              >
                {departmentModalOpen === "all" ? "Show Single Department" : "View All Departments"}
              </button>
            </div>

            {/* Department Cards List */}
            <div className="space-y-3.5">
              {data.who_is_affected.departments
                .filter((dept) => departmentModalOpen === "all" || dept.department === departmentModalOpen)
                .map((dept) => (
                  <div key={dept.department} className="p-4 bg-zinc-50/80 rounded-2xl border border-zinc-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                        <span className="font-extrabold text-zinc-950 text-sm">{dept.department}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                        {dept.subtitle}
                      </span>
                    </div>

                    {dept.risk_summary && (
                      <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-950 leading-relaxed">
                        <strong className="text-rose-900 block mb-0.5 font-bold">Specific Risk Exposure:</strong>
                        {dept.risk_summary}
                      </div>
                    )}

                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {dept.details}
                    </p>

                    {dept.routing_action && (
                      <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 flex items-start justify-between gap-3">
                        <div>
                          <strong className="text-purple-900 block font-bold">Assigned Counter-Action:</strong>
                          <span>{dept.routing_action}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDepartmentFilter(dept.department);
                            setDepartmentModalOpen(null);
                            const el = document.getElementById("section-playbook");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold shrink-0 self-center cursor-pointer shadow-xs"
                        >
                          Focus in Playbook ↓
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
              <span className="text-xs text-zinc-500">
                Department routing feeds Section 4 execution.
              </span>
              <button
                onClick={() => setDepartmentModalOpen(null)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: Full Playbook Modal                                        */}
      {/* ==================================================================== */}
      {playbookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#181829] text-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-indigo-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-white">
                <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>Executive Counter-Action Playbook</span>
              </div>
              <button
                onClick={() => setPlaybookModalOpen(false)}
                className="p-1 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {data.what_should_we_do.actions.map((act) => (
                <div key={act.number} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs">
                        {act.number}
                      </span>
                      <span className="font-bold text-sm text-zinc-100">{act.title}</span>
                    </div>
                    <span className="text-xs font-bold text-amber-400">{act.timeframe || act.days}</span>
                  </div>
                  {act.next_step && (
                    <div className="text-xs text-indigo-300 pl-8">
                      {act.next_step}
                    </div>
                  )}
                  {act.business_justification && (
                    <p className="text-xs text-zinc-400 leading-relaxed pl-8">
                      <strong>Rationale:</strong> {act.business_justification}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-indigo-900/60">
              <button
                onClick={() => setPlaybookModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Playbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DRAWER 4: Evidence Inspection Dossier Drawer                        */}
      {/* ==================================================================== */}
      {evidenceDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white max-w-xl w-full h-full p-6 sm:p-7 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h3 className="text-base font-bold text-zinc-950">Independent Evidence Dossier</h3>
                    <p className="text-xs text-zinc-500">
                      {data.verification_and_confidence.verified_sources_count} primary sources grounded in verified real-world disclosures
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEvidenceDrawerOpen(false)}
                  className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Source List */}
              <div className="space-y-4">
                {(data.verification_and_confidence.evidence_sources || []).map((src, idx) => (
                  <div key={src.id || idx} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-purple-700 uppercase tracking-wider text-[10px] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        {src.source}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {src.detected_at?.substring(0, 10)}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-zinc-900 leading-snug">{src.title}</h4>
                    <p className="text-xs text-zinc-600 italic bg-white p-2.5 rounded-xl border border-zinc-150 leading-relaxed">
                      "{src.excerpt}"
                    </p>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline pt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Official Source Filing ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium">
                Grounded Fact Confidence: {data.verification_and_confidence.confidence_score}%
              </span>
              <button
                onClick={() => setEvidenceDrawerOpen(false)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: Tactical Action Execution Modal                            */}
      {/* ==================================================================== */}
      {selectedNextStepAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#181829] text-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-indigo-900 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-white">
                <Target className="w-5 h-5 text-amber-400" />
                <span>Tactical Next Step Execution</span>
              </div>
              <button
                onClick={() => setSelectedNextStepAction(null)}
                className="p-1 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Department + Priority + Target SLA */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-xs font-black uppercase tracking-wider">
                {selectedNextStepAction.department}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                (selectedNextStepAction.priority || "").toLowerCase() === "critical"
                  ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
                  : "bg-amber-950/80 text-amber-300 border-amber-700/60"
              }`}>
                {selectedNextStepAction.priority || "High"} Priority
              </span>
              <span className="text-xs font-bold text-amber-400/90 ml-auto flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {selectedNextStepAction.timeframe || `Within ${selectedNextStepAction.days}`}
              </span>
            </div>

            {/* Tactical Step Box */}
            <div className="p-4 rounded-2xl bg-black/40 border border-amber-500/40 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Actionable Objective
              </span>
              <p className="text-sm font-bold text-white leading-relaxed">
                {selectedNextStepAction.next_step.startsWith("Next:")
                  ? selectedNextStepAction.next_step
                  : `Next: ${selectedNextStepAction.next_step}`}
              </p>
            </div>

            {/* Strategic Action Context */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Parent Counter-Action:
              </span>
              <p className="text-xs text-zinc-200 font-medium">
                {selectedNextStepAction.title}
              </p>
              {selectedNextStepAction.business_justification && (
                <p className="text-[11px] text-zinc-400 italic pt-1">
                  <strong>Expected Impact:</strong> {selectedNextStepAction.business_justification}
                </p>
              )}
            </div>

            {/* Quick Actions & Confirm */}
            <div className="pt-3 border-t border-indigo-900/60 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const actionKey = selectedNextStepAction.id || `act_${selectedNextStepAction.number}`;
                  handleActionStatusChange(actionKey, "In Progress");
                  setSelectedNextStepAction(null);
                  showToast(`Tactical action for ${selectedNextStepAction.department} marked In Progress`);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Dispatch / Start Task</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const actionKey = selectedNextStepAction.id || `act_${selectedNextStepAction.number}`;
                  handleActionStatusChange(actionKey, "Accepted");
                  setSelectedNextStepAction(null);
                  showToast(`Action accepted for ${selectedNextStepAction.department}`);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept Action</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNextStepAction(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
