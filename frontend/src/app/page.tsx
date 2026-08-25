"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { fetchBriefById } from "@/lib/api";
import { parseMarkdownBrief } from "@/lib/parser";

export default function HomePage() {
  const [trackedCompanies, setTrackedCompanies] = useState<string[]>([
    "Vercel",
    "Netlify",
    "Cloudflare Pages",
    "Cloudflare Workers",
  ]);

  useEffect(() => {
    async function loadCompanies() {
      try {
        const latestBriefData = await fetchBriefById("latest");
        if (latestBriefData?.content) {
          const parsed = parseMarkdownBrief(latestBriefData.content);
          if (parsed && parsed.companies.length > 0) {
            setTrackedCompanies(parsed.companies.map((c) => c.company));
          }
        }
      } catch {
        // Fallback to default tracked companies
      }
    }
    loadCompanies();
  }, []);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] justify-between bg-[#08090C] text-[#EDEDED]">
      <div className="flex-1 flex flex-col justify-center">
        {/* HERO SECTION WITH SOFT RADIAL GLOW */}
        <section className="relative px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center overflow-hidden">
          {/* Subtle Radial Glow behind title */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[380px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.14)_0%,transparent_70%)] blur-3xl opacity-80"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-4xl space-y-6">
            {/* Eyebrow Label */}
            <div className="animate-fade-in-up">
              <span className="text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-[#71717A]">
                Competitive Intelligence, Automated
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="animate-fade-in-up delay-50 text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
              Reveal the
              <br />
              Intelligence
            </h1>

            {/* Value Proposition Description */}
            <p className="animate-fade-in-up delay-100 mx-auto max-w-xl text-sm sm:text-base text-[#A1A1AA] leading-relaxed">
              PrismIQ turns scattered news and GitHub signals from your
              competitors into one weekly brief — sourced, tiered by what
              actually matters, and ready in one command.
            </p>

            {/* Action CTA Buttons */}
            <div className="animate-fade-in-up delay-150 pt-3 flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href="/brief"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-xs sm:text-sm font-medium text-black transition-all duration-150 hover:bg-[#E5E5E5] active:scale-98 shadow-sm"
              >
                View Latest Brief
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-[#27272A] bg-[#121316] px-6 py-2.5 text-xs sm:text-sm font-medium text-white transition-all duration-150 hover:bg-[#1C1D21] hover:border-[#3F3F46] active:scale-98"
              >
                How it works
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION DIVIDER */}
        <div className="border-t border-[#1F2023] w-full" />

        {/* "FROM INFORMATION TO DECISIONS" 4 CARDS */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="text-center">
              <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-[#71717A]">
                From Information to Decisions
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Information */}
              <div className="animate-fade-in-up delay-50 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-5 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]">
                <div className="font-semibold text-sm sm:text-base text-white">
                  Information
                </div>
                <div className="mt-1 text-xs text-[#71717A]">
                  What happened?
                </div>
              </div>

              {/* 2. Intelligence (Blue Accent) */}
              <div className="animate-fade-in-up delay-100 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-5 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]">
                <div className="font-semibold text-sm sm:text-base text-[#3B82F6]">
                  Intelligence
                </div>
                <div className="mt-1 text-xs text-[#71717A]">
                  Why does it matter?
                </div>
              </div>

              {/* 3. Opportunity (Cyan Accent) */}
              <div className="animate-fade-in-up delay-150 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-5 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]">
                <div className="font-semibold text-sm sm:text-base text-[#4FD1E5]">
                  Opportunity
                </div>
                <div className="mt-1 text-xs text-[#71717A]">
                  What&apos;s nobody doing?
                </div>
              </div>

              {/* 4. Decision (Violet Accent) */}
              <div className="animate-fade-in-up delay-200 rounded-xl border border-[#1F2023] bg-[#0D0E12] p-5 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317]">
                <div className="font-semibold text-sm sm:text-base text-[#8B7CF6]">
                  Decision
                </div>
                <div className="mt-1 text-xs text-[#71717A]">
                  What next?
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* "HOW IT WORKS" PREVIEW STRIP */}
        <section className="px-4 pb-16 sm:pb-20">
          <div className="mx-auto max-w-5xl space-y-6 text-center">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-[#71717A]">
                How It Works
              </h2>
            </div>

            <Link
              href="/how-it-works"
              className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 group transition-transform active:scale-98"
            >
              <span className="rounded-lg border border-[#1F2023] bg-[#121316] px-4 py-2 text-xs font-medium text-[#D4D4D8] group-hover:border-[#3F3F46] group-hover:text-white transition-colors">
                Monitoring
              </span>
              <span className="text-[#71717A] text-xs font-mono">→</span>
              <span className="rounded-lg border border-[#1F2023] bg-[#121316] px-4 py-2 text-xs font-medium text-[#D4D4D8] group-hover:border-[#3F3F46] group-hover:text-white transition-colors">
                Storage
              </span>
              <span className="text-[#71717A] text-xs font-mono">→</span>
              <span className="rounded-lg border border-[#1F2023] bg-[#121316] px-4 py-2 text-xs font-medium text-[#D4D4D8] group-hover:border-[#3F3F46] group-hover:text-white transition-colors">
                Analysis
              </span>
              <span className="text-[#71717A] text-xs font-mono">→</span>
              <span className="rounded-lg border border-[#1F2023] bg-[#121316] px-4 py-2 text-xs font-medium text-[#D4D4D8] group-hover:border-[#3F3F46] group-hover:text-white transition-colors">
                Report
              </span>
            </Link>
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <Footer companies={trackedCompanies} />
    </div>
  );
}
