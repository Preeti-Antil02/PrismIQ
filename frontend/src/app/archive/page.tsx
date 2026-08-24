import React from "react";
import Link from "next/link";
import { ArrowRight, Calendar, FileText } from "lucide-react";
import { Footer } from "@/components/Footer";
import { fetchBriefsList } from "@/lib/api";
import { formatDateString } from "@/components/WeekSelector";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Archive — PrismIQ",
  description:
    "Browse historical competitive intelligence briefs and weekly summaries.",
};

export default async function ArchivePage() {
  const briefs = await fetchBriefsList();

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] justify-between bg-[#08090C] text-[#EDEDED]">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-10">
        {/* Page Header */}
        <div className="space-y-3">
          <span className="text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-[#71717A]">
            Historical Records
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Brief Archive
          </h1>
          <p className="text-sm text-[#A1A1AA] max-w-xl">
            Review past weekly intelligence snapshots, tracked decision trends,
            and competitive findings across Vercel, Netlify, and Cloudflare.
          </p>
        </div>

        {/* Briefs Grid */}
        {briefs.length === 0 ? (
          <div className="rounded-xl border border-[#1F2023] bg-[#0D0E12] p-10 text-center space-y-3">
            <FileText className="h-8 w-8 text-[#71717A] mx-auto" />
            <div className="text-sm font-semibold text-white">
              No historical briefs found
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Run the pipeline from the backend or check that the API service is active.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {briefs.map((brief, idx) => {
              const href =
                brief.id === "latest" ? "/brief" : `/brief?id=${brief.id}`;
              const isLatest = idx === 0 || brief.id === "latest";

              return (
                <Link
                  key={brief.id}
                  href={href}
                  className="group flex flex-col justify-between rounded-xl border border-[#1F2023] bg-[#0D0E12] p-5 transition-all duration-200 hover:border-[#2E3036] hover:bg-[#121317] hover:-translate-y-0.5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-[#71717A]">
                        <Calendar className="h-3.5 w-3.5 text-blue-400" />
                        <span>{formatDateString(brief.date)}</span>
                      </div>
                      {isLatest && (
                        <span className="inline-flex items-center rounded-full bg-blue-950/80 border border-blue-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
                          Current
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                      {brief.preview || "Weekly Competitive Intelligence Brief"}
                    </h2>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#1F2023] flex items-center justify-between text-xs text-[#71717A] group-hover:text-[#EDEDED] transition-colors">
                    <span className="font-mono text-[11px]">ID: {brief.id}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-blue-400">
                      View brief <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
