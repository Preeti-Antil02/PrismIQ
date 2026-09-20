"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/primitives/CompanyLogo";

export interface CompetitivePulseItem {
  company: string;
  meaningfulMovement: string;
  domain: string;
  accentColor?: string;
  status?: "verified" | "ingested" | "pending";
  signalCount?: number;
}

interface CompetitivePulseStripProps {
  movements: CompetitivePulseItem[];
}

export function CompetitivePulseStrip({ movements }: CompetitivePulseStripProps) {
  const router = useRouter();

  const handleTileClick = (companyName: string) => {
    // Navigate to competitors overview or specific company view
    router.push("/app/competitors");
  };

  return (
    <section className="space-y-4" aria-label="Competitive pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div>
          <div className="text-[10px] font-mono tracking-[0.18em] text-[#c5b4ff] uppercase font-bold flex items-center gap-1.5">
            <span className="text-[var(--cyan)] text-xs drop-shadow-[0_0_8px_rgba(54,230,208,0.7)]">✦</span>
            COMPETITIVE PULSE
          </div>
          <h3 className="font-serif text-2xl sm:text-[24px] font-normal mt-1 section-title-gradient leading-snug">
            Directional shifts detected across tracked competitors
          </h3>
        </div>

        <Link
          href="/app/competitors"
          className="text-xs font-mono text-[#bba4ff] hover:text-[#ddd] transition-colors inline-flex items-center gap-1 self-start sm:self-auto group"
        >
          <span>View all competitors</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Horizontal Landscape of Tiles */}
      {movements.length === 0 ? (
        <div className="rounded-[8px] border border-white/[0.08] bg-[#07070b]/60 p-6 text-center text-xs text-[#8e8f9a] font-mono">
          No tracked competitors configured. Add competitors in Watchlist to activate competitive pulse.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {movements.map((c, i) => {
          const accentColor =
            c.status === "pending"
              ? "rgba(255, 180, 90, 0.4)"
              : c.status === "ingested"
              ? "var(--cyan)"
              : i === 0
              ? "var(--cyan)"
              : i === 1
              ? "var(--magenta)"
              : i === 2
              ? "var(--cyan)"
              : i === 3
              ? "var(--violet)"
              : "#79d7ff";

          return (
            <div
              key={c.company}
              onClick={() => handleTileClick(c.company)}
              className={cn(
                "group relative p-4 rounded-[8px] cursor-pointer select-none transition-all duration-300",
                "border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-[rgba(5,5,8,0.9)]",
                "hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_12px_28px_rgba(0,0,0,0.4)]",
                "flex flex-col justify-between min-h-[140px]"
              )}
              style={{
                borderTop: `2px solid ${accentColor}`,
              }}
            >
              {/* Subtle top glow on hover */}
              <div
                className="absolute inset-x-0 top-0 h-10 opacity-0 group-hover:opacity-20 transition-opacity rounded-t-[8px] pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${accentColor}, transparent 70%)`,
                }}
              />

              <div className="space-y-3">
                {/* Top: Logo + Company Name */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CompanyLogo company={c.company} variant="mini" className="w-6 h-6" />
                    <span className="font-bold text-xs text-[#F3F2EF] tracking-tight group-hover:text-white transition-colors">
                      {c.company}
                    </span>
                  </div>

                  <span className="text-[10px] text-white/30 group-hover:text-white/70 transition-colors">
                    ↗
                  </span>
                </div>

                {/* Movement text */}
                <p className={cn(
                  "text-xs leading-relaxed line-clamp-2 transition-colors",
                  c.status === "pending" ? "text-[#7a7b85] italic" : "text-[#b8b8c2] group-hover:text-white/90"
                )}>
                  {c.meaningfulMovement}
                </p>
              </div>

              {/* Bottom: Domain Category with status indicator */}
              <div className="pt-3 mt-3 border-t border-white/[0.04] flex items-center gap-1.5 text-[10px] font-mono text-[#8e8f9a]">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: c.status === "pending" ? "rgba(255, 180, 90, 0.6)" : accentColor,
                    boxShadow: c.status === "pending" ? "none" : `0 0 8px ${accentColor}`,
                  }}
                />
                <span className={cn("truncate", c.status === "pending" && "text-amber-300/70 font-semibold")}>
                  {c.domain}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </section>
  );
}
