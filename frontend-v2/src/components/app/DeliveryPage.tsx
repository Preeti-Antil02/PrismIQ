"use client";

import * as React from "react";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { useWorkspace } from "./AppShell";
import {
  PrismCard,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismSectionHeader,
} from "./PrismPrimitives";
import {
  fetchDeliveryConfig,
  saveDeliveryConfig,
  type DeliveryConfig,
} from "@/lib/api";

export function DeliveryPage() {
  const { targetCompany } = useWorkspace();

  const [loading, setLoading] = React.useState(true);
  const [config, setConfig] = React.useState<DeliveryConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [channel, setChannel] = React.useState("");
  const [cadence, setCadence] = React.useState("daily");
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [showWebhook, setShowWebhook] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadDelivery = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchDeliveryConfig();
      if (cfg) {
        setConfig(cfg);
        setWebhookUrl(cfg.slack_webhook_url || "");
        setChannel(cfg.slack_channel || "");
        setCadence(cfg.delivery_cadence || "daily");
        setIsEnabled(cfg.is_enabled ?? false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load delivery configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDelivery();
  }, [loadDelivery]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    try {
      const saved = await saveDeliveryConfig({
        slack_webhook_url: webhookUrl.trim(),
        channel_name: channel.trim(),
        is_active: isEnabled,
      });
      setConfig(saved);
      setSuccessMessage("Delivery preferences saved successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Could not save delivery preferences: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigured = Boolean(config?.slack_webhook_url);

  return (
    <div className="max-w-3xl space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Notification Channels
          </div>
          <h1 className="app-title-lg">
            Delivery Settings for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-xl">
            Configure automated outbound delivery of executive briefs and high-urgency competitive alerts.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadDelivery}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh</span>
        </PrismButton>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={3} />
      ) : error ? (
        <PrismEmptyState
          title="Delivery Preferences Unavailable"
          description={error}
          actionText="Retry"
          onAction={loadDelivery}
        />
      ) : (
        <div className="space-y-8">
          {/* Status Card */}
          <div className="p-5 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isConfigured && isEnabled
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#17171b]">
                  Slack Webhook Integration
                </div>
                <div className="text-xs text-[#70717a]">
                  {isConfigured
                    ? isEnabled
                      ? "Active • Delivering automated executive briefs"
                      : "Configured • Paused"
                    : "Not Configured • Add webhook URL below"}
                </div>
              </div>
            </div>

            <span
              className={`app-pill text-[10px] font-bold uppercase ${
                isConfigured && isEnabled
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : isConfigured
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-zinc-100 text-zinc-500 border border-zinc-200"
              }`}
            >
              {isConfigured && isEnabled ? "Active" : isConfigured ? "Paused" : "Inactive"}
            </span>
          </div>

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successMessage}
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSave} className="space-y-6">
            <PrismCard className="p-6 space-y-5">
              <h3 className="app-title-sm">Slack Webhook Configuration</h3>

              <div>
                <label className="block text-xs font-bold text-[#17171b] mb-1.5">
                  Webhook URL
                </label>
                <div className="relative">
                  <input
                    type={showWebhook ? "text" : "password"}
                    placeholder="https://hooks.slack.com/services/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="app-search-input w-full max-w-none pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhook(!showWebhook)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#17171b]"
                  >
                    {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#9ca3af] mt-1">
                  Incoming webhook URL created in your Slack Workspace app settings.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17171b] mb-1.5">
                  Target Slack Channel
                </label>
                <input
                  type="text"
                  placeholder="#competitive-intel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="app-search-input w-full max-w-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17171b] mb-1.5">
                  Delivery Cadence
                </label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  className="app-search-input w-full max-w-none text-xs font-semibold"
                >
                  <option value="daily">Daily Morning Digest (08:00 UTC)</option>
                  <option value="realtime">Real-Time on Must-Know Critical Events</option>
                  <option value="weekly">Weekly Synthesis Brief (Monday)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[rgba(20,20,30,0.06)]">
                <div>
                  <div className="text-xs font-bold text-[#17171b]">
                    Enable Slack Outbound Delivery
                  </div>
                  <div className="text-[11px] text-[#70717a]">
                    Toggle automated delivery on or off without removing credentials.
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-[#6e57dc] focus:ring-[#6e57dc]"
                />
              </div>
            </PrismCard>

            <div className="flex justify-end">
              <PrismButton variant="dark" size="lg" type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Save Preferences</span>
              </PrismButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
