"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchDeliveryConfig,
  saveDeliveryConfig,
  type DeliveryConfig,
} from "@/lib/api";
import {
  WriteStatusBanner,
  type WriteOperationStatus,
} from "@/components/shared/WorkspaceControls";
import {
  Bell,
  MessageSquare,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Clock,
  Eye,
  EyeOff,
  Radio,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DeliveryPage() {
  const [config, setConfig] = React.useState<DeliveryConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Form State
  const [slackWebhookUrl, setSlackWebhookUrl] = React.useState("");
  const [slackChannel, setSlackChannel] = React.useState("#competitive-intelligence");
  const [isEnabled, setIsEnabled] = React.useState(true);
  const [showWebhookSecret, setShowWebhookSecret] = React.useState(false);

  // Save State
  const [saveStatus, setSaveStatus] = React.useState<WriteOperationStatus>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const loadConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchDeliveryConfig();
      if (cfg) {
        setConfig(cfg);
        setSlackWebhookUrl(cfg.slack_webhook_url || "");
        setSlackChannel(cfg.slack_channel || "#competitive-intelligence");
        setIsEnabled(cfg.is_enabled ?? true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load delivery configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveSlack = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = slackWebhookUrl.trim();

    if (!cleanUrl) {
      setSaveError("Slack webhook URL cannot be empty.");
      setSaveStatus("error");
      return;
    }

    if (!cleanUrl.startsWith("https://hooks.slack.com/")) {
      setSaveError("Invalid URL format. Slack webhooks must begin with https://hooks.slack.com/");
      setSaveStatus("error");
      return;
    }

    setSaveStatus("pending");
    setSaveError(null);
    try {
      const updated = await saveDeliveryConfig({
        slack_webhook_url: cleanUrl,
        channel_name: slackChannel.trim() || "#competitive-intelligence",
        is_active: isEnabled,
      });
      setConfig(updated);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save delivery configuration");
      setSaveStatus("error");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="border-b border-border/40 pb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Bell className="h-4 w-4" />
            <span>Workspace Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Alerts & Delivery
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Configure external alerting destinations for autonomous intelligence updates. Must-Know events
            and major Research Radar shifts are pushed to enabled channels.
          </p>
        </div>

        {/* Security / Validation Notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Tenant-Isolated Webhook Storage: </span>
            <span>
              All alert destination configurations are stored in PostgreSQL under tenant Row-Level Security (RLS).
              Destination URLs are validated against official provider domains to prevent SSRF vulnerabilities.
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading delivery configuration...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Channel 1: Slack Webhook Alerts (LIVE) */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#4A154B]/10 border border-[#4A154B]/20 flex items-center justify-center text-[#4A154B] dark:text-[#E01E5A]">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">Slack Incoming Webhook</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Live Channel
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dispatches high-confidence findings and daily intelligence briefs directly into your Slack workspace.
                    </p>
                  </div>
                </div>

                {/* Channel Active Toggle */}
                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  <span className="text-xs font-semibold text-foreground">
                    {isEnabled ? "Active" : "Paused"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>
              </div>

              <form onSubmit={handleSaveSlack} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Slack Webhook URL
                    </label>
                    <div className="relative">
                      <input
                        type={showWebhookSecret ? "text" : "password"}
                        required
                        value={slackWebhookUrl}
                        onChange={(e) => setSlackWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/your-incoming-webhook-url"
                        className="w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                        title={showWebhookSecret ? "Hide Webhook URL" : "Reveal Webhook URL"}
                      >
                        {showWebhookSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Generate this in your Slack App under <em>Incoming Webhooks</em>. Must begin with <code className="text-primary font-mono">https://hooks.slack.com/</code>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Display Channel Name
                    </label>
                    <input
                      type="text"
                      required
                      value={slackChannel}
                      onChange={(e) => setSlackChannel(e.target.value)}
                      placeholder="#competitive-intelligence"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      For workspace reference in delivery logs.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs">
                    <span className="font-semibold text-foreground block">Delivery Trigger</span>
                    <span className="text-muted-foreground text-[11px]">Must-Know & Should-Know Events</span>
                  </div>
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs">
                    <span className="font-semibold text-foreground block">Cadence</span>
                    <span className="text-muted-foreground text-[11px]">Autonomous (Post-Ingestion)</span>
                  </div>
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs">
                    <span className="font-semibold text-foreground block">Format</span>
                    <span className="text-muted-foreground text-[11px]">Slack Block Kit with Citations</span>
                  </div>
                </div>

                <WriteStatusBanner
                  status={saveStatus}
                  errorMessage={saveError}
                  successMessage="Slack delivery settings updated and verified in PostgreSQL."
                />

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
                  <button
                    type="submit"
                    disabled={saveStatus === "pending"}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                  >
                    {saveStatus === "pending" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Destination...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Delivery Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Channel 2: Email Digest Delivery (EXPLICIT COMING SOON - ZERO FAKE CONTROLS) */}
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 opacity-75 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">Email Executive Digest</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase tracking-wider border border-border">
                        Coming Soon (Part 10.3)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Automated morning briefing email summarizing competitor moves, radar transitions, and noise-filtered signals.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-muted-foreground self-start sm:self-auto px-2.5 py-1 rounded bg-muted">
                  Disabled in Stage 1
                </span>
              </div>

              <div className="p-4 rounded-lg bg-background/60 border border-border/50 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground">
                  Architecture & Implementation Status:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Email delivery integration (Resend / SMTP transport) is verified in system architecture, but intentionally
                  deferred in the Stage 1 build per <strong>Part 10.3</strong> specifications.
                  In accordance with PrismIQ&apos;s zero-fake-controls principle, this channel is presented transparently as disabled rather than simulating inactive toggles.
                </p>
              </div>
            </div>

            {/* Channel 3: Autonomous Webhook Dispatch */}
            <div className="rounded-xl border border-border/60 bg-muted/10 p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Radio className="h-4 w-4 text-primary" />
                <span>Custom Webhook Ingestion Engine</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Need to stream PrismIQ findings into Datadog, Splunk, or an internal data warehouse?
                Custom HTTP POST webhooks with HMAC-SHA256 signature headers are supported in Enterprise tier accounts.
                Contact support to provision automated webhook endpoints.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
