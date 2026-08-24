import React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Flame,
  Globe,
  Layers,
  Sparkles,
} from "lucide-react";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "How It Works — PrismIQ",
  description:
    "Learn how PrismIQ automates competitive intelligence through a source-grounded 4-stage pipeline.",
};

export default function HowItWorksPage() {
  const steps = [
    {
      index: "01",
      name: "Monitoring",
      icon: <Eye className="h-5 w-5 text-blue-400" />,
      title: "Real-time Signal Ingestion",
      description:
        "Continuously streams recent competitive signals across news publications (via Currents API) and engineering repositories (via GitHub Events API). Redundant events like star bursts and forks are consolidated to eliminate noise.",
    },
    {
      index: "02",
      name: "Storage",
      icon: <Database className="h-5 w-5 text-cyan-400" />,
      title: "Immutable Run Persistence",
      description:
        "Persists normalized signals into flat structured JSON archives for every weekly execution, maintaining an exact historical record alongside latest pointer files for immediate query retrieval.",
    },
    {
      index: "03",
      name: "Analysis",
      icon: <Sparkles className="h-5 w-5 text-violet-400" />,
      title: "Impact Synthesis & Calibration",
      description:
        "Analyzes raw events with strict guardrails separating verifiable facts from strategic inferences. Assigns calibrated confidence scores (High, Medium, Low) and calculates decision impact values.",
    },
    {
      index: "04",
      name: "Report",
      icon: <FileText className="h-5 w-5 text-emerald-400" />,
      title: "Tiered Executive Intelligence",
      description:
        "Ranks findings into Top 3 strategic decisions, rolls up activity metrics, and categorizes company developments into Must-Know, Should-Know, and Other Activity tiers, guaranteeing 100% source attribution.",
    },
  ];

  const tiers = [
    {
      tier: "Must-Know",
      badge: "bg-blue-950/60 text-blue-400 border-blue-800/80",
      icon: <Flame className="h-4 w-4 text-blue-400" />,
      tagline: "High-stakes strategic shifts and vulnerabilities",
      description:
        "Game-changing competitor releases, critical security side-channel flaws (e.g. Spectre isolate leaks), or major ecosystem repositioning that demands executive attention.",
    },
    {
      tier: "Should-Know",
      badge: "bg-zinc-900 text-zinc-300 border-zinc-700",
      icon: <CheckCircle2 className="h-4 w-4 text-zinc-400" />,
      tagline: "Meaningful product launches and platform updates",
      description:
        "Legitimate feature announcements, developer SDK releases, customer case studies, and core product iterations that inform ongoing roadmap awareness.",
    },
    {
      tier: "Other Activity",
      badge: "bg-zinc-900/60 text-zinc-400 border-zinc-800",
      icon: <Activity className="h-4 w-4 text-zinc-500" />,
      tagline: "Routine background noise and repository logs",
      description:
        "Low-information routine signals such as star counts, repository watch spikes, internal branch creations, and dependency chores—preserved for completeness without cluttering the main brief.",
    },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] justify-between bg-[#08090C] text-[#EDEDED]">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-16">
        {/* Page Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-[#71717A]">
            Architecture & Methodology
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
            How PrismIQ Works
          </h1>
          <p className="text-sm sm:text-base text-[#A1A1AA] leading-relaxed">
            A deterministic, source-grounded intelligence pipeline designed to
            convert hundreds of scattered public signals into a clear, actionable
            weekly executive brief.
          </p>
        </div>

        {/* 4-Stage Pipeline */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-[#71717A]">
              The 4-Stage Pipeline
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((s) => (
              <div
                key={s.index}
                className="rounded-xl border border-[#1F2023] bg-[#0D0E12] p-6 space-y-4 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#16171B] border border-[#27272A]">
                      {s.icon}
                    </div>
                    <div>
                      <span className="text-xs font-mono text-[#71717A]">
                        Stage {s.index}
                      </span>
                      <h3 className="text-base font-bold text-white leading-tight">
                        {s.name}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-[#EDEDED]">
                    {s.title}
                  </h4>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Content Tiering Philosophy */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-[#71717A]">
              Content Tiering Philosophy
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Why some findings get full analytical breakdowns while others are
              condensed or collapsed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiers.map((t) => (
              <div
                key={t.tier}
                className="rounded-xl border border-[#1F2023] bg-[#0D0E12] p-5 space-y-3 transition-all duration-200 hover:border-[#2E3036]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}
                  >
                    {t.icon}
                    <span>{t.tier}</span>
                  </span>
                </div>

                <div className="font-semibold text-xs text-white">
                  {t.tagline}
                </div>

                <p className="text-xs text-[#71717A] leading-relaxed">
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Call to Action Bar */}
        <section className="rounded-2xl border border-[#1F2023] bg-gradient-to-b from-[#121316] to-[#0D0E12] p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Ready to explore live intelligence?
          </h2>
          <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-md mx-auto">
            View the current weekly brief for Vercel, Netlify, and Cloudflare, or
            browse past historical runs.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/brief"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-xs font-medium text-black transition-all hover:bg-[#E5E5E5] active:scale-98"
            >
              View Live Brief
            </Link>
            <Link
              href="/archive"
              className="inline-flex items-center justify-center rounded-full border border-[#27272A] bg-[#16171B] px-5 py-2 text-xs font-medium text-white transition-all hover:bg-[#202126] active:scale-98"
            >
              Browse Archive
            </Link>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
