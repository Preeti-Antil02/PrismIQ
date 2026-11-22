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
} from "lucide-react";
import { useWorkspace, useAppEvidence } from "../AppShell";
import { fetchIntelligenceDetail, type IntelligenceDetailPayload } from "@/lib/api";

// ============================================================================
// Competitor Brand Logos
// ============================================================================

function AmazonLogo({ className = "w-16 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* amazon wordmark */}
      <path
        d="M17.8 17.5c-2.3 0-4.1.6-5.4 1.8-1.3 1.2-1.9 2.8-1.9 4.8 0 1.9.6 3.4 1.8 4.5 1.2 1.1 2.9 1.7 5.1 1.7 2.1 0 3.9-.6 5.3-1.8 1.4-1.2 2.1-2.8 2.1-4.8v-6.2h-7zm0-3.2h7v15.9h-7v-1.7c-1.4 1.3-3.3 2-5.7 2-3 0-5.5-.9-7.4-2.7C2.8 26 1.8 23.5 1.8 20.2c0-3.3 1-5.8 2.9-7.6 1.9-1.8 4.4-2.7 7.4-2.7 2.4 0 4.3.7 5.7 2v-1.6zm23.2 0v17.5h-7V16.3h-3.5v-2h3.5v-1.2c0-2.4.7-4.2 2.1-5.5C44.5 6.3 46.5 5.7 49 5.7c1.3 0 2.5.2 3.6.5v2.2c-.9-.3-1.8-.4-2.8-.4-1.4 0-2.4.4-3.1 1.1-.7.7-1.1 1.8-1.1 3.2v2h7v2h-7v15.9h-7V14.3h-4.6zm13 0h7v17.5h-7V14.3zm3.5-3.6c-1.1 0-2-.4-2.8-1.2-.8-.8-1.2-1.7-1.2-2.8 0-1.1.4-2 1.2-2.8.8-.8 1.7-1.2 2.8-1.2 1.1 0 2 .4 2.8 1.2.8.8 1.2 1.7 1.2 2.8 0 1.1-.4 2-1.2 2.8-.8.8-1.7 1.2-2.8 1.2zm12.3 3.6h7v17.5h-7v-1.8c-1.4 1.3-3.3 2-5.7 2-3 0-5.5-.9-7.4-2.7-1.9-1.8-2.9-4.3-2.9-7.6 0-3.3 1-5.8 2.9-7.6 1.9-1.8 4.4-2.7 7.4-2.7 2.4 0 4.3.7 5.7 2v-1.6zm-5.7 15.4c2.2 0 4-.6 5.3-1.8 1.3-1.2 2-2.8 2-4.8 0-2-.7-3.6-2-4.8-1.3-1.2-3.1-1.8-5.3-1.8-2.2 0-4 .6-5.3 1.8-1.3 1.2-2 2.8-2 4.8 0 2 .7 3.6 2 4.8 1.3 1.2 3.1 1.8 5.3 1.8zm23.9-15.4v17.5h-7V14.3h-3.5v-2h3.5v-1.2c0-2.4.7-4.2 2.1-5.5 1.4-1.3 3.4-1.9 5.9-1.9 1.3 0 2.5.2 3.6.5v2.2c-.9-.3-1.8-.4-2.8-.4-1.4 0-2.4.4-3.1 1.1-.7.7-1.1 1.8-1.1 3.2v2h7v2h-7v15.9h-7V14.3h-4.6z"
        fill="#111827"
      />
      {/* smile curve */}
      <path
        d="M2.5 31.5c22 10.5 58 10 92-3 2.5-.9 3.5 1.5 1.5 2.5-36 17-74 15-95.5 2-1.5-.9-.5-2.2 2-1.5z"
        fill="#FF9900"
      />
      {/* smile arrowhead */}
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

export function CompetitorLogoRender({ name, className }: { name: string; className?: string }) {
  const norm = name.toLowerCase();
  if (norm.includes("amazon")) return <AmazonLogo className={className} />;
  if (norm.includes("flipkart")) return <FlipkartLogo className={className} />;
  if (norm.includes("reliance")) return <RelianceLogo className={className} />;
  if (norm.includes("tata")) return <TataLogo className={className} />;
  return (
    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-sm">
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
  const [analysisModalOpen, setAnalysisModalOpen] = React.useState(false);
  const [departmentModalOpen, setDepartmentModalOpen] = React.useState<string | null>(null);
  const [playbookModalOpen, setPlaybookModalOpen] = React.useState(false);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = React.useState(false);
  const [shareToast, setShareToast] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchIntelligenceDetail(detailId, targetCompany, tenantId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError(null);
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

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
    }
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

  return (
    <div className="space-y-6 pb-12 max-w-[1400px] mx-auto text-[#18181b]">
      {/* Toast Notification */}
      {shareToast && (
        <div className="fixed top-20 right-8 z-50 bg-[#181829] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-purple-500/30 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">Report URL copied to clipboard!</span>
          <button onClick={() => setShareToast(false)} className="text-zinc-400 hover:text-white p-1">
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share Report
          </button>
          <button className="p-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-xl shadow-xs">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Competitor Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-5">
          <div className="w-24 h-16 sm:w-28 sm:h-18 rounded-2xl bg-white border border-zinc-150 shadow-xs flex items-center justify-center p-3 shrink-0">
            <CompetitorLogoRender name={data.competitor_name} className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
                {data.competitor_name}
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
      </div>

      {/* Main 2-Column Grid Matching Reference Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================== */}
        {/* LEFT COLUMN: Section 1, Section 2, Section 3                        */}
        {/* ================================================================== */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. What Happened */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs">
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

            {/* Banner Facility Photo */}
            <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent z-10" />
              <img
                src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80"
                alt="Amazon Logistics Facility"
                className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Confirmed Infrastructure Expansion
                </span>
              </div>
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/90 p-1 flex items-center justify-center">
                  <AmazonLogo className="w-full h-full" />
                </div>
                <span className="text-xs font-bold text-white tracking-wide">
                  Air Cargo & Rail Hub Disclosures
                </span>
              </div>
            </div>

            {/* Headline and Paragraph */}
            <div className="space-y-3 pt-1">
              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 leading-snug">
                {data.what_happened.headline}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                {data.what_happened.paragraph}
              </p>
            </div>

            {/* Exposed Target Product Expandable Pill */}
            <div className="pt-1">
              <button
                onClick={() => setProductExpanded(!productExpanded)}
                className="w-full sm:w-auto inline-flex items-center justify-between gap-3 px-4 py-2.5 bg-purple-50/80 hover:bg-purple-100/80 border border-purple-200/80 rounded-2xl text-xs font-semibold text-purple-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 font-bold">Exposed Target Product:</span>
                  <span className="font-extrabold">{data.what_happened.exposed_target_product}</span>
                </div>
                {productExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-purple-600" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-purple-600" />
                )}
              </button>

              {productExpanded && (
                <div className="mt-3 p-4 bg-purple-50/40 rounded-2xl border border-purple-100 text-xs text-purple-950 space-y-2 animate-in fade-in duration-150">
                  <p className="font-semibold">Direct Category Exposure Analysis:</p>
                  <p className="text-zinc-600 leading-relaxed">
                    Apparel below ₹300 accounts for ~40% of non-metro transaction volume on {targetCompany}. Waiving seller referral fees creates immediate merchant catalog poaching risks from Surat and Ludhiana clusters.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Why It Matters */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 leading-tight">Why It Matters</h2>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Strategic Implications
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAnalysisModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6e57dc] hover:text-[#5842be] transition-colors"
              >
                View Analysis
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Key Impact Alert Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-start gap-3.5">
              <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                !
              </div>
              <div className="space-y-1">
                <div className="text-xs font-extrabold uppercase tracking-wider text-rose-800">
                  Key Impact
                </div>
                <p className="text-xs sm:text-sm text-rose-950 font-medium leading-relaxed">
                  {data.why_it_matters.key_impact}
                </p>
              </div>
            </div>

            {/* Strategic Lens (6 Dimensions Grid) */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Strategic Lens</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Affected Products</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_lens.affected_products}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Overlapping Segments</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_lens.overlapping_segments}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Competitor Advantage</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_lens.competitor_advantage}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Business Risk</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_lens.business_risk}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Supporting Evidence</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_lens.supporting_evidence}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-150">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Uncertain Assumptions</div>
                  <div className="text-xs font-bold text-zinc-900 mt-1">
                    {data.why_it_matters.strategic_lens.uncertain_assumptions}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Who Is Affected */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs">
                  3
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 leading-tight">Who Is Affected</h2>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Department Impact
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDepartmentModalOpen("all")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6e57dc] hover:text-[#5842be] transition-colors"
              >
                View Details
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Department Cards in a Row */}
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

                return (
                  <div
                    key={dept.department}
                    onClick={() => setDepartmentModalOpen(dept.department)}
                    className="p-4 rounded-2xl bg-[#f8f9fc] hover:bg-[#f1f3f9] border border-zinc-200/60 transition-all cursor-pointer flex flex-col items-center text-center space-y-1.5 group"
                  >
                    <div className="p-2.5 rounded-xl bg-white shadow-xs group-hover:scale-110 transition-transform">
                      {icon}
                    </div>
                    <div className="text-xs font-extrabold text-zinc-900">{dept.department}</div>
                    <div className="text-[11px] font-medium text-zinc-500 leading-tight">
                      {dept.subtitle}
                    </div>
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
          {/* 4. What Should We Do (Dark Indigo Card) */}
          <div className="bg-[#181829] text-white rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 border border-indigo-950">
            <div className="flex items-center justify-between border-b border-indigo-900/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs">
                  4
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">What Should We Do</h2>
                  <p className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                    Counter-Action Playbook
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPlaybookModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-white transition-colors"
              >
                View Full Playbook
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3 Numbered Counter-Action Items */}
            <div className="space-y-3.5">
              {data.what_should_we_do.actions.map((act) => (
                <div
                  key={act.number}
                  className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-start gap-3 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-indigo-400/30">
                    {act.number}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs sm:text-[13px] font-medium text-zinc-100 leading-snug">
                      {act.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 text-[10px] font-bold">
                        {act.department}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-400">
                        {act.days}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
              <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs">
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

          {/* 6. Verification & Confidence Guarantee */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-7 h-7 rounded-full bg-[#6e57dc] text-white flex items-center justify-center font-black text-xs">
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
                  onClick={() => setEvidenceDrawerOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#6e57dc] hover:bg-[#5842be] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Inspect Evidence
                </button>
                <span className="text-[10px] text-zinc-500 font-medium">
                  View source details and methodology
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
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
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
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: Department Details Modal                                   */}
      {/* ==================================================================== */}
      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-zinc-950">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Department Impact Breakdown</span>
              </div>
              <button
                onClick={() => setDepartmentModalOpen(null)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {data.who_is_affected.departments.map((dept) => (
                <div key={dept.department} className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-150">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-zinc-900 text-xs">{dept.department}</span>
                    <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      {dept.subtitle}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">{dept.details}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                onClick={() => setDepartmentModalOpen(null)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold"
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
                className="p-1 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white"
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
                    <span className="text-xs font-bold text-amber-400">{act.days}</span>
                  </div>
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
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                Close Playbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DRAWER 4: Evidence Inspection Drawer                                */}
      {/* ==================================================================== */}
      {evidenceDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white max-w-xl w-full h-full p-6 sm:p-7 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h3 className="text-base font-bold text-zinc-950">Verified Evidence Sources</h3>
                    <p className="text-xs text-zinc-500">
                      {data.verification_and_confidence.verified_sources_count} primary sources grounded in real-world filings
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEvidenceDrawerOpen(false)}
                  className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {data.verification_and_confidence.evidence_sources.map((src, idx) => (
                  <div key={src.id || idx} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-purple-700 uppercase tracking-wider text-[10px]">
                        {src.source}
                      </span>
                      <span className="text-[10px] text-zinc-400">
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
                      View Official Source
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setEvidenceDrawerOpen(false)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
