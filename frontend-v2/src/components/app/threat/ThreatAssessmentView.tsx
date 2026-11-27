"use client";

import * as React from "react";
import { getClientAuthToken } from "@/lib/auth";
import { useWorkspace } from "../AppShell";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  TrendingUp,
  Sliders,
  RefreshCw,
  Layers,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  BarChart2,
  FileText,
  Loader2,
} from "lucide-react";

export interface FactorBreakdown {
  score: number;
  weight: number;
  weighted_contribution: number;
  data_coverage: number;
  evidence_count: number;
  summary: string;
}

export interface ThreatScoreData {
  competitor_name: string;
  threat_score: number;
  threat_level: "Critical" | "High" | "Medium" | "Low" | string;
  data_coverage: number;
  has_missing_data: boolean;
  calculated_at: string;
  factors: {
    product_activity: FactorBreakdown;
    hiring_activity: FactorBreakdown;
    pricing_movement: FactorBreakdown;
    market_activity: FactorBreakdown;
    customer_evidence: FactorBreakdown;
  };
}

export interface ThreatAssessmentViewProps {
  competitorName: string;
  tenantId?: string;
}

function normalizeThreatScorePayload(raw: any, fallbackComp: string): ThreatScoreData {
  const rawFactors = raw?.factors || raw?.factor_contributions || {};
  const mapFactor = (key: string, defaultWeight: number): FactorBreakdown => {
    const f = rawFactors[key] || {};
    const assessed = f.is_assessed !== false;
    const rawScore = f.score ?? f.raw_score;
    const score = typeof rawScore === "number" ? Math.round(rawScore) : 0;
    const weight = typeof f.weight === "number" ? f.weight : defaultWeight;
    const effectiveWeight = typeof f.effective_weight === "number" ? f.effective_weight : weight;
    const weightedContribution =
      typeof f.weighted_contribution === "number"
        ? f.weighted_contribution
        : Number((score * effectiveWeight).toFixed(1));
    const evidenceCount = Number(f.evidence_count ?? f.data_points_count ?? 0);
    const summary =
      f.summary ||
      f.explanation ||
      (assessed
        ? `Assessed across ${evidenceCount} empirical data point(s).`
        : "Unassessed — no verified data captured yet for this factor.");
    return {
      score,
      weight,
      weighted_contribution: weightedContribution,
      data_coverage: assessed ? 1 : 0,
      evidence_count: evidenceCount,
      summary,
    };
  };

  return {
    competitor_name: raw?.competitor_name || fallbackComp,
    threat_score: Math.round(Number(raw?.threat_score ?? raw?.overall_threat_score ?? 0)),
    threat_level: raw?.threat_level || "Unassessed",
    data_coverage: Number(raw?.data_coverage ?? raw?.data_coverage_score ?? 0),
    has_missing_data: Boolean(raw?.has_missing_data),
    calculated_at: raw?.calculated_at || new Date().toISOString(),
    factors: {
      product_activity: mapFactor("product_activity", 0.25),
      hiring_activity: mapFactor("hiring_activity", 0.15),
      pricing_movement: mapFactor("pricing_movement", 0.25),
      market_activity: mapFactor("market_activity", 0.15),
      customer_evidence: mapFactor("customer_evidence", 0.20),
    },
  };
}

export function ThreatAssessmentView({ competitorName, tenantId }: ThreatAssessmentViewProps) {
  const workspace = useWorkspace();
  const effectiveTenantId = tenantId || workspace.tenantId;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ThreatScoreData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [weights, setWeights] = React.useState({
    product_activity: 0.25,
    hiring_activity: 0.15,
    pricing_movement: 0.25,
    market_activity: 0.15,
    customer_evidence: 0.20,
  });
  const [isRecalculating, setIsRecalculating] = React.useState(false);
  const [showWeightSliders, setShowWeightSliders] = React.useState(false);

  const loadScore = React.useCallback(async () => {
    if (!competitorName) return;
    setLoading(true);
    setError(null);
    try {
      const token = getClientAuthToken(effectiveTenantId);
      const qs = effectiveTenantId ? `?tenant_id=${encodeURIComponent(effectiveTenantId)}` : "";
      const res = await fetch(`/api/threat-scoring/${encodeURIComponent(competitorName)}${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {}),
        },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Threat score request returned ${res.status}`);
      }
      const json = await res.json();
      setData(normalizeThreatScorePayload(json, competitorName));
    } catch (err: any) {
      setData(null);
      setError(err?.message || "Unable to calculate threat score for this competitor.");
    } finally {
      setLoading(false);
    }
  }, [competitorName, effectiveTenantId]);

  React.useEffect(() => {
    loadScore();
  }, [loadScore, workspace.pipelineSyncVersion]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const token = getClientAuthToken(effectiveTenantId);
      const qs = effectiveTenantId ? `?tenant_id=${encodeURIComponent(effectiveTenantId)}` : "";
      const res = await fetch(`/api/threat-scoring/calculate${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(effectiveTenantId ? { "X-Tenant-ID": effectiveTenantId } : {}),
        },
        body: JSON.stringify({
          competitor_name: competitorName,
          custom_weights: weights,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(normalizeThreatScorePayload(updated, competitorName));
      }
    } catch (err: any) {
      setError(err?.message || "Recalculation failed.");
    } finally {
      setIsRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-xs text-slate-400">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-violet-600 mb-2" />
        Calculating explainable threat score...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-2">
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
        <p className="text-sm font-bold text-slate-900">Threat Score Unavailable</p>
        <p className="text-xs text-slate-500">{error || "No empirical threat data available yet."}</p>
        <button
          type="button"
          onClick={loadScore}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const factorEntries = Object.entries(data.factors);

  return (
    <div className="space-y-6">
      {/* Non-Probability Disclaimer Alert Banner */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-xs text-violet-900 flex items-start gap-3">
        <Info className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Explainability & Missing Data Transparency</p>
          <p className="text-[11px] leading-relaxed text-violet-800">
            This Threat Score (<strong>{data.threat_score}/100</strong>) is an explainable index synthesized from verified multi-factor market signals. It does <em>not</em> represent a probability of competitive loss. Missing data is never treated as confirmed low threat; missing dimensions are clearly flagged with coverage indicators.
          </p>
        </div>
      </div>

      {/* Main Threat Index Gauge Card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-black text-xl shadow-md shadow-violet-200">
              {data.threat_score}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {data.competitor_name} Threat Index
                </h3>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600 border border-rose-100">
                  ● {data.threat_level} Threat
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Data Coverage: {(data.data_coverage * 100).toFixed(0)}% • Calculated: {data.calculated_at.slice(0, 10)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowWeightSliders(!showWeightSliders)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Sliders className="h-3.5 w-3.5 text-violet-600" />
            {showWeightSliders ? "Hide Weight Controls" : "Configure Factor Weights"}
          </button>
        </div>

        {/* Configurable Weight Sliders (Collapsible) */}
        {showWeightSliders && (
          <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Factor Weight Simulation (Normalized to 1.0)
              </span>
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-violet-600 px-3 py-1.5 rounded-lg hover:bg-violet-700 transition"
              >
                {isRecalculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Recalculate Score
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {Object.entries(weights).map(([factorKey, weightVal]) => (
                <div key={factorKey} className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span className="capitalize">{factorKey.replace(/_/g, " ")}</span>
                    <span className="font-mono font-bold text-violet-600">
                      {(weightVal * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.50"
                    step="0.05"
                    value={weightVal}
                    onChange={(e) =>
                      setWeights((prev) => ({
                        ...prev,
                        [factorKey]: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-violet-600 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Factor Contribution Cards Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {factorEntries.map(([key, factor]) => (
            <div
              key={key}
              className="rounded-xl border border-slate-100 bg-white p-4 hover:border-violet-200 transition space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 capitalize">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-bold text-violet-700">
                  {factor.score}/100
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-600"
                  style={{ width: `${factor.score}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Weight: {(factor.weight * 100).toFixed(0)}%</span>
                <span>Contribution: +{factor.weighted_contribution.toFixed(1)} pts</span>
              </div>

              <p className="text-[11px] text-slate-600 leading-snug line-clamp-2 pt-1 border-t border-slate-50">
                {factor.summary}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
