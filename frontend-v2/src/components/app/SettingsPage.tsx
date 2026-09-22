"use client";

import * as React from "react";
import {
  Settings,
  ShieldCheck,
  Building2,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Database,
  Key,
  Users,
  Radio,
  Clock,
  Sparkles,
} from "lucide-react";
import { useWorkspace, AVAILABLE_WORKSPACES } from "./AppShell";
import { useAuth } from "@/lib/AuthContext";
import {
  PrismCard,
  PrismButton,
  PrismEmptyState,
  PrismLoadingSkeleton,
  PrismSectionHeader,
} from "./PrismPrimitives";
import {
  fetchWorkspaceSettings,
  type WorkspaceSettings,
} from "@/lib/api";

export function SettingsPage() {
  const { targetCompany, tenantId, switchWorkspace } = useWorkspace();
  const { user, logout } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<WorkspaceSettings | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || "Failed to load workspace settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const copyTenantId = () => {
    navigator.clipboard.writeText(tenantId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[rgba(20,20,30,0.07)]">
        <div>
          <div className="app-eyebrow mb-2">
            <span className="app-dot" />
            Workspace Administration
          </div>
          <h1 className="app-title-lg">
            Settings & Security for <span className="app-gradient-text">{targetCompany}</span>
          </h1>
          <p className="app-caption mt-1 max-w-xl">
            Workspace identification, multi-tenant isolation telemetry, and account security.
          </p>
        </div>

        <PrismButton variant="light" size="sm" onClick={loadSettings}>
          <RefreshCw className="w-3.5 h-3.5 text-[#70717a]" />
          <span>Refresh</span>
        </PrismButton>
      </div>

      {loading ? (
        <PrismLoadingSkeleton count={3} />
      ) : error ? (
        <PrismEmptyState
          title="Could Not Load Settings"
          description={error}
          actionText="Retry"
          onAction={loadSettings}
        />
      ) : (
        <div className="space-y-8">
          {/* Workspace Identity Section */}
          <PrismCard className="p-6 space-y-5">
            <h3 className="app-title-sm">Workspace Identity</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold mb-1">
                  Workspace Name
                </span>
                <span className="font-bold text-sm text-[#17171b]">
                  {settings?.workspace_name || `${targetCompany} Intelligence`}
                </span>
              </div>

              <div>
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold mb-1">
                  Target Company
                </span>
                <span className="font-bold text-sm text-[#6e57dc]">
                  {targetCompany}
                </span>
              </div>

              <div>
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold mb-1">
                  Owner Email
                </span>
                <span className="font-semibold text-[#17171b]">
                  {user?.email || settings?.owner_email || "authenticated@prismiq.ai"}
                </span>
              </div>

              <div>
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold mb-1">
                  Role
                </span>
                <span className="font-semibold text-[#17171b]">
                  {settings?.auth_role || "Workspace Administrator"}
                </span>
              </div>
            </div>

            {/* Tenant ID Copy Box */}
            <div className="pt-3 border-t border-[rgba(20,20,30,0.06)]">
              <span className="text-[#9ca3af] block text-[10px] uppercase font-bold mb-1">
                PostgreSQL Tenant ID
              </span>
              <div className="flex items-center gap-2 max-w-lg">
                <input
                  type="text"
                  readOnly
                  value={tenantId}
                  className="app-search-input w-full font-mono text-xs text-[#595a63] bg-zinc-50"
                />
                <PrismButton variant="light" size="sm" onClick={copyTenantId}>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#70717a]" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </PrismButton>
              </div>
            </div>
          </PrismCard>

          {/* Multi-Tenant Isolation & RLS Security Section */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50/60 via-white to-blue-50/40 border border-emerald-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#17171b]">
                    Row Level Security (RLS) Active
                  </h3>
                  <p className="text-xs text-[#70717a]">
                    Database isolation guarantees zero cross-tenant contamination.
                  </p>
                </div>
              </div>

              <span className="app-pill bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold uppercase">
                {settings?.rls_enforcement || "Enforced by PostgreSQL"}
              </span>
            </div>

            <p className="text-xs text-[#4b5563] leading-relaxed">
              Every database query and intelligence pipeline operation executes under an isolated session claim. Signals, briefs, competitor lists, and research sweeps for <strong>{targetCompany}</strong> are strictly segregated from other tenants.
            </p>
          </div>

          {/* Telemetry Statistics */}
          <PrismCard className="p-6 space-y-4">
            <h3 className="app-title-sm">Intelligence Pipeline Telemetry</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100">
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Tracked Rivals</span>
                <span className="text-xl font-extrabold text-[#17171b]">
                  {settings?.tracked_companies_count ?? 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100">
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Active Topics</span>
                <span className="text-xl font-extrabold text-[#17171b]">
                  {settings?.active_topics_count ?? 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100">
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Signals Evaluated</span>
                <span className="text-xl font-extrabold text-[#17171b]">
                  {settings?.total_signals_evaluated ?? 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100">
                <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Noise Suppressed</span>
                <span className="text-xl font-extrabold text-[#70717a]">
                  {settings?.noise_suppressed_count ?? 0}
                </span>
              </div>
            </div>
          </PrismCard>

          {/* Quick Switch Workspace */}
          <PrismCard className="p-6 space-y-4">
            <h3 className="app-title-sm">Switch Active Workspace</h3>
            <p className="text-xs text-[#70717a]">
              Switch into another tenant workspace to verify isolation and evaluate separate intelligence environments:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AVAILABLE_WORKSPACES.map((ws) => (
                <button
                  key={ws.tenant_id}
                  onClick={() => switchWorkspace(ws.tenant_id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    tenantId === ws.tenant_id
                      ? "bg-purple-50 border-purple-300 shadow-xs"
                      : "bg-white border-[rgba(20,20,30,0.08)] hover:bg-zinc-50"
                  }`}
                >
                  <div className="font-extrabold text-sm text-[#17171b] mb-1">
                    {ws.target}
                  </div>
                  <div className="text-[11px] text-[#70717a] line-clamp-1 mb-2">
                    {ws.name}
                  </div>
                  {tenantId === ws.tenant_id ? (
                    <span className="text-[10px] font-extrabold uppercase text-[#6e57dc] flex items-center gap-1">
                      <Check className="w-3 h-3" /> Current Workspace
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-[#9ca3af] hover:text-[#17171b]">
                      Switch to {ws.target} →
                    </span>
                  )}
                </button>
              ))}
            </div>
          </PrismCard>

          {/* Sign Out Action */}
          <div className="flex items-center justify-between p-6 rounded-2xl bg-white border border-[rgba(20,20,30,0.08)] shadow-xs">
            <div>
              <div className="text-sm font-bold text-[#17171b]">End Session</div>
              <div className="text-xs text-[#70717a]">
                Sign out of this workstation and clear local session tokens.
              </div>
            </div>

            <PrismButton variant="light" onClick={logout} className="text-rose-600 hover:bg-rose-50 hover:border-rose-200">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </PrismButton>
          </div>
        </div>
      )}
    </div>
  );
}
