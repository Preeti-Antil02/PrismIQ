"use client";

import * as React from "react";
import {
  Loader2,
  AlertCircle,
  Check,
  Pause,
  Play,
  Trash2,
  Plus,
  Building2,
  Bell,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WriteOperationStatus = "idle" | "confirming" | "pending" | "success" | "error";

export interface WriteStatusBannerProps {
  status: WriteOperationStatus;
  errorMessage?: string | null;
  successMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function WriteStatusBanner({
  status,
  errorMessage,
  successMessage,
  onRetry,
  className,
}: WriteStatusBannerProps) {
  if (status === "idle" || status === "confirming") return null;

  if (status === "pending") {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-md border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-800",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
        <span>Executing tenant-scoped write operation... committing transaction.</span>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800",
          className
        )}
      >
        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>{successMessage || "Changes saved successfully to your tenant workspace."}</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className={cn(
          "flex items-start justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800",
          className
        )}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-900">Write action rejected or failed</p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              {errorMessage || "Database constraint error or authorization violation."}
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-50 shrink-0 cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ----------------------------------------------------------------------------
// 1. Topic Action Controls (Add, Pause/Resume, Remove)
// ----------------------------------------------------------------------------

interface TopicItemControlProps {
  topicId: string;
  topicLabel: string;
  isActive: boolean;
  onTogglePause: (topicId: string, willPause: boolean) => Promise<void>;
  onRemoveTopic: (topicId: string) => Promise<void>;
}

export function TopicItemControl({
  topicId,
  topicLabel,
  isActive,
  onTogglePause,
  onRemoveTopic,
}: TopicItemControlProps) {
  const [status, setStatus] = React.useState<WriteOperationStatus>("idle");
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleToggle = async () => {
    setStatus("pending");
    setErrorMsg(null);
    try {
      await onTogglePause(topicId, !isActive);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to update topic status");
      setStatus("error");
    }
  };

  const handleConfirmDelete = async () => {
    setStatus("pending");
    setErrorMsg(null);
    try {
      await onRemoveTopic(topicId);
      setStatus("success");
      setIsConfirmingDelete(false);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to remove topic");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={status === "pending"}
          title={isActive ? "Pause evaluation without deleting history" : "Resume topic monitoring"}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer disabled:opacity-50",
            isActive
              ? "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          )}
        >
          {status === "pending" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isActive ? (
            <>
              <Pause className="h-3 w-3 text-slate-500" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 text-emerald-600" />
              <span>Resume</span>
            </>
          )}
        </button>

        {!isConfirmingDelete ? (
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            disabled={status === "pending"}
            className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded cursor-pointer"
            title="Remove research topic"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded px-2 py-0.5 text-[11px]">
            <span className="text-rose-800 font-medium">Remove?</span>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="text-rose-700 font-bold hover:underline cursor-pointer"
            >
              Yes
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(false)}
              className="text-slate-600 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <WriteStatusBanner
        status={status}
        errorMessage={errorMsg}
        successMessage={isActive ? "Topic resumed" : "Topic paused (history preserved)"}
        onRetry={handleToggle}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// 2. Unbypassable Confirm/Edit Gate Modal for Discovery & Tracked Companies
// ----------------------------------------------------------------------------

export interface CandidateReviewItem {
  name: string;
  rationale: string;
  confidence: "High" | "Medium" | "Low";
  sourceCitation: string;
  selected: boolean;
}

interface CompanyConfirmGateProps {
  targetCompany: string;
  candidates: CandidateReviewItem[];
  isOpen: boolean;
  isSaving: boolean;
  error?: string | null;
  onToggleCandidate: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CompanyConfirmGateModal({
  targetCompany,
  candidates,
  isOpen,
  isSaving,
  error,
  onToggleCandidate,
  onConfirm,
  onCancel,
}: CompanyConfirmGateProps) {
  if (!isOpen) return null;

  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4" />
              <span>Mandatory Human Verification Gate</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Confirm Tracked Competitors for {targetCompany}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Discovery proposals require explicit confirmation. Zero auto-writes occur without human review.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-700">
            Select candidates to actively monitor ({selectedCount} selected):
          </label>
          <div className="space-y-2">
            {candidates.map((cand) => (
              <div
                key={cand.name}
                onClick={() => onToggleCandidate(cand.name)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors",
                  cand.selected
                    ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-300"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100/70"
                )}
              >
                <input
                  type="checkbox"
                  checked={cand.selected}
                  onChange={() => {}}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{cand.name}</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                      {cand.confidence}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {cand.rationale}
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    Source: {cand.sourceCitation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3.5 py-2 rounded text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Writing to tenant...</span>
              </>
            ) : (
              <>
                <span>Confirm & Track ({selectedCount})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 3. Delivery Configuration Toggle
// ----------------------------------------------------------------------------

interface DeliveryToggleProps {
  channelName: string;
  isEnabled: boolean;
  webhookUrl?: string;
  isAvailable: boolean; // false for Email (coming soon)
  unavailableReason?: string;
  onSaveConfig: (url: string, enabled: boolean) => Promise<void>;
}

export function DeliveryToggle({
  channelName,
  isEnabled,
  webhookUrl = "",
  isAvailable,
  unavailableReason,
  onSaveConfig,
}: DeliveryToggleProps) {
  const [status, setStatus] = React.useState<WriteOperationStatus>("idle");
  const [url, setUrl] = React.useState(webhookUrl);
  const [enabled, setEnabled] = React.useState(isEnabled);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  if (!isAvailable) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 opacity-70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">{channelName}</span>
          </div>
          <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
            Coming Soon
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {unavailableReason || "Delivery channel planned for future integration."}
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("pending");
    setErrorMsg(null);
    try {
      await onSaveConfig(url, enabled);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update delivery settings");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSave} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-bold text-slate-900">{channelName}</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-700">Webhook URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.slack.com/your-incoming-webhook-url"
          disabled={!enabled || status === "pending"}
          className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <WriteStatusBanner
          status={status}
          errorMessage={errorMsg}
          successMessage="Delivery configuration updated"
        />
        <button
          type="submit"
          disabled={status === "pending"}
          className="ml-auto rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
        >
          {status === "pending" ? "Saving..." : "Save Delivery Settings"}
        </button>
      </div>
    </form>
  );
}
