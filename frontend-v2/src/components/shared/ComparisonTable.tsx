"use client";

import * as React from "react";
import {
  DIRECTIONAL_CONFIG,
  type DirectionalDelta,
} from "@/lib/tokens";
import { ArrowUpRight, ArrowDownRight, MoveRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompetitorComparisonCell {
  companyName: string;
  delta: DirectionalDelta;
  deltaSummary: string; // e.g., "+3 product launches this period" or "0 new releases"
  evidenceCount: number;
  highlightText?: string;
  onViewEvidence?: () => void;
}

export interface ComparisonDimensionRow {
  id: string;
  dimensionLabel: string;
  description: string;
  cells: Record<string, CompetitorComparisonCell>; // Keyed by companyName
}

interface ComparisonTableProps {
  competitors: string[]; // 2 to 3 competitor company names
  rows: ComparisonDimensionRow[];
  onSelectEvidence?: (company: string, dimensionId: string) => void;
  className?: string;
}

export function DirectionalBadge({
  delta,
  summary,
}: {
  delta: DirectionalDelta;
  summary: string;
}) {
  const config = DIRECTIONAL_CONFIG[delta];

  const renderIcon = () => {
    switch (delta) {
      case "up":
        return <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
      case "down":
        return <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-rose-600" />;
      case "flat":
      default:
        return <MoveRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />;
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium select-none",
        config.bgClass,
        config.textClass,
        config.borderClass
      )}
    >
      {renderIcon()}
      <span className="font-semibold">{config.label}</span>
      <span className="text-[10px] opacity-80">({summary})</span>
    </div>
  );
}

export function ComparisonTable({
  competitors,
  rows,
  onSelectEvidence,
  className,
}: ComparisonTableProps) {
  if (!competitors || competitors.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center bg-slate-50">
        <Layers className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-800">
          Select at least 2 competitors to compare
        </p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Choose 2 to 3 tracked companies to evaluate real movement across Product, Pricing, Hiring, and Security.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop / Tablet Table View */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 w-1/4">Monitored Dimension</th>
                {competitors.map((comp) => (
                  <th key={comp} className="py-3 px-4 w-1/4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-xs">{comp}</span>
                      <span className="text-[10px] font-normal text-slate-500 lowercase">
                        tracked
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 align-top">
                    <div className="font-semibold text-slate-900">{row.dimensionLabel}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {row.description}
                    </div>
                  </td>
                  {competitors.map((comp) => {
                    const cell = row.cells[comp];
                    if (!cell) {
                      return (
                        <td key={comp} className="py-4 px-4 align-top text-slate-400 italic text-[11px]">
                          No tracked signals
                        </td>
                      );
                    }
                    return (
                      <td key={comp} className="py-4 px-4 align-top space-y-2">
                        <DirectionalBadge delta={cell.delta} summary={cell.deltaSummary} />
                        {cell.highlightText && (
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            {cell.highlightText}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-500">
                            {cell.evidenceCount} {cell.evidenceCount === 1 ? "signal" : "signals"} backing
                          </span>
                          {onSelectEvidence && cell.evidenceCount > 0 && (
                            <button
                              type="button"
                              onClick={() => onSelectEvidence(comp, row.id)}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              View evidence →
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Stacked Card View */}
      <div className="block md:hidden space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">{row.dimensionLabel}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{row.description}</p>
            </div>
            <div className="divide-y divide-slate-100 space-y-2.5">
              {competitors.map((comp) => {
                const cell = row.cells[comp];
                if (!cell) return null;
                return (
                  <div key={comp} className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800">{comp}</span>
                      <DirectionalBadge delta={cell.delta} summary={cell.deltaSummary} />
                    </div>
                    {cell.highlightText && (
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {cell.highlightText}
                      </p>
                    )}
                    {onSelectEvidence && cell.evidenceCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectEvidence(comp, row.id)}
                        className="text-[10px] font-medium text-blue-600 hover:underline"
                      >
                        Inspect {cell.evidenceCount} evidence items →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
