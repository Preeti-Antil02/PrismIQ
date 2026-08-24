import React from "react";
import { TopDecision } from "@/types/brief";
import { Compass, ShieldAlert, Zap } from "lucide-react";

interface Top3DecisionsProps {
  decisions: TopDecision[];
}

export function Top3Decisions({ decisions }: Top3DecisionsProps) {
  if (!decisions || decisions.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-[#71717A] flex items-center gap-2">
            <Compass className="h-4 w-4 text-blue-400" />
            <span>Top Decisions Informed This Period</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Highest-priority strategic signals and competitor risks requiring executive attention
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {decisions.map((item, idx) => {
          const delayClass =
            idx === 0 ? "delay-250" : idx === 1 ? "delay-300" : "delay-350";

          return (
            <div
              key={item.index}
              className={`animate-fade-in-up ${delayClass} flex flex-col justify-between rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                item.isSecurityRisk
                  ? "border-rose-900/50 bg-rose-950/20 hover:border-rose-700/60 hover:bg-rose-950/30"
                  : "border-[#1F2023] bg-[#0D0E12] hover:border-[#2E3036] hover:bg-[#121317]"
              }`}
            >
              <div>
                {/* Header: Number index + Company Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-black shadow-2xs">
                    {item.index}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      item.isSecurityRisk
                        ? "border-rose-800/80 bg-rose-950/60 text-rose-300"
                        : "border-blue-800/80 bg-blue-950/60 text-blue-300"
                    }`}
                  >
                    {item.isSecurityRisk ? (
                      <ShieldAlert className="h-3 w-3 text-rose-400" />
                    ) : (
                      <Zap className="h-3 w-3 text-blue-400" />
                    )}
                    <span>{item.company}</span>
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 mb-2.5">
                  {item.title}
                </h3>

                {/* Explanation */}
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  {item.explanation}
                </p>
              </div>

              {/* Bottom Risk / Strategic Indicator */}
              <div className="mt-4 pt-3 border-t border-[#1F2023] flex items-center justify-between text-[11px] text-[#71717A]">
                <span>
                  {item.isSecurityRisk
                    ? "Security Risk Signal"
                    : "Strategic Intelligence"}
                </span>
                <span className="font-medium text-[#A1A1AA]">
                  Priority #{item.index}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
