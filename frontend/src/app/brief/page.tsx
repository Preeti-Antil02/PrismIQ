"use client";

import React, { Suspense, useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WeekSelector } from "@/components/WeekSelector";
import { ExecutiveRollup } from "@/components/ExecutiveRollup";
import { Top3Decisions } from "@/components/Top3Decisions";
import { CompanyFindings } from "@/components/CompanyFindings";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { Footer } from "@/components/Footer";
import { parseMarkdownBrief } from "@/lib/parser";
import { BriefSummary, ParsedBrief } from "@/types/brief";
import { Info, Sparkles } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function BriefContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryId = searchParams.get("id") || "latest";

  const [briefs, setBriefs] = useState<BriefSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>(queryId);
  const [parsedBrief, setParsedBrief] = useState<ParsedBrief | null>(null);
  const [briefDate, setBriefDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load available briefs list and target brief
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch briefs list
        const listRes = await fetch(`${API_BASE_URL}/briefs`);
        if (!listRes.ok) {
          throw new Error(`Failed to load briefs list (HTTP ${listRes.status})`);
        }
        const listData = await listRes.json();
        const availableBriefs: BriefSummary[] = listData.briefs || [];
        setBriefs(availableBriefs);

        // Fetch selected or latest brief
        const endpoint =
          queryId === "latest"
            ? `${API_BASE_URL}/briefs/latest`
            : `${API_BASE_URL}/briefs/${queryId}`;

        const briefRes = await fetch(endpoint);
        if (!briefRes.ok) {
          if (briefRes.status === 404) {
            setParsedBrief(parseMarkdownBrief(""));
            setIsLoading(false);
            return;
          }
          throw new Error(`Failed to fetch brief '${queryId}' (HTTP ${briefRes.status})`);
        }

        const briefData = await briefRes.json();
        const md = briefData.content || "";
        setBriefDate(briefData.date || "");
        setSelectedId(briefData.id || queryId);
        setParsedBrief(parseMarkdownBrief(md));
      } catch (err: any) {
        setError(err.message || "Could not connect to PrismIQ intelligence API.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [queryId]);

  // Handle dropdown selection
  const handleSelectBrief = (id: string) => {
    setSelectedId(id);
    startTransition(async () => {
      router.push(id === "latest" ? "/brief" : `/brief?id=${id}`);
    });
  };

  const trackedCompanies = parsedBrief
    ? parsedBrief.companies.map((c) => c.company)
    : [];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] justify-between bg-[#08090C] text-[#EDEDED]">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => handleSelectBrief(selectedId)}
          />
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : parsedBrief ? (
          <div
            className={`space-y-10 transition-opacity duration-200 ease-out ${
              isPending ? "opacity-40 pointer-events-none" : "opacity-100"
            }`}
          >
            {/* Header Title & Week Selector */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#1F2023]">
              <div>
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#71717A]">
                  Weekly Competitive Brief
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                  Competitive Intelligence Brief
                </h1>
                <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1">
                  Source-grounded strategic intelligence synthesized from 7-day monitoring window
                </p>
              </div>

              {/* Archive Dropdown */}
              <WeekSelector
                briefs={briefs}
                selectedId={selectedId}
                onSelect={handleSelectBrief}
                isLoading={isPending}
              />
            </div>

            {/* Plain-language explanation for non-technical visitors */}
            <div className="rounded-xl border border-[#1F2023] bg-[#0D0E12] p-4 flex items-start gap-3 text-xs text-[#A1A1AA] leading-relaxed">
              <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Reading this brief: </span>
                <span className="text-blue-300 font-medium">Must-Know</span> highlights critical strategic shifts and vulnerabilities that change what you pay attention to next.{" "}
                <span className="text-[#EDEDED] font-medium">Should-Know</span> covers real feature releases and customer activity.{" "}
                <span className="text-[#71717A] font-medium">Other Activity</span> tracks routine repository events and background signals.
              </div>
            </div>

            {/* Executive Summary Rollup Metrics */}
            <ExecutiveRollup rollup={parsedBrief.rollup} />

            {/* Top 3 Decisions Informed */}
            <Top3Decisions decisions={parsedBrief.topDecisions} />

            {/* Per-Company Findings */}
            <CompanyFindings companies={parsedBrief.companies} />
          </div>
        ) : null}
      </main>

      <Footer companies={trackedCompanies} />
    </div>
  );
}

export default function BriefPage() {
  return (
    <Suspense fallback={<div className="p-8"><LoadingSkeleton /></div>}>
      <BriefContent />
    </Suspense>
  );
}
