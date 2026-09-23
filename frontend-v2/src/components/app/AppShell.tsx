"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  CalendarDays,
  Radio,
  TrendingUp,
  Users,
  GitCompare,
  Radar,
  Compass,
  Building2,
  Bell,
  Settings,
  Menu,
  X,
  Play,
  CheckCircle2,
  Loader2,
  ChevronDown,
  LogOut,
  Sparkles,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { createTenantToken } from "@/lib/auth";
import {
  fetchWorkspaceConfig,
  fetchPipelineStatus,
  triggerPipelineRun,
  type PipelineProgress,
  type WorkspaceConfig,
} from "@/lib/api";
import {
  PrismEvidenceDrawer,
  type EvidenceItem,
  PrismCompanyBadge,
} from "./PrismPrimitives";

// ============================================================================
// Workspace Context & Known Test Tenants
// ============================================================================
export const AVAILABLE_WORKSPACES = [
  {
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    name: "Meesho Competitive Intelligence",
    target: "Meesho",
    sector: "Social Commerce & Marketplace",
  },
  {
    tenant_id: "7b90477d-2524-4cf9-8e47-f389ec890ff7",
    name: "Flipkart Workspace",
    target: "Flipkart",
    sector: "E-Commerce",
  },
  {
    tenant_id: "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f",
    name: "OpenAI Intelligence",
    target: "OpenAI",
    sector: "Frontier AI & LLMs",
  },
];

export interface WorkspaceItem {
  tenant_id: string;
  name: string;
  target: string;
  sector: string;
}

interface WorkspaceContextType {
  targetCompany: string;
  tenantId: string;
  config: WorkspaceConfig | null;
  pipeline: PipelineProgress | null;
  switchWorkspace: (tenantId: string) => void;
  triggerSweep: () => Promise<void>;
  isSweeping: boolean;
  refreshConfig: () => Promise<void>;
  allWorkspaces: WorkspaceItem[];
  startNewCompanyOnboarding: () => void;
}

const WorkspaceContext = React.createContext<WorkspaceContextType>({
  targetCompany: "Meesho",
  tenantId: "8553449a-c998-4727-be01-9aeb724038cb",
  config: null,
  pipeline: null,
  switchWorkspace: () => {},
  triggerSweep: async () => {},
  isSweeping: false,
  refreshConfig: async () => {},
  allWorkspaces: AVAILABLE_WORKSPACES,
  startNewCompanyOnboarding: () => {},
});

export function useWorkspace() {
  return React.useContext(WorkspaceContext);
}

// ============================================================================
// Evidence Drawer Context
// ============================================================================
interface EvidenceContextType {
  openEvidence: (item: EvidenceItem) => void;
  closeEvidence: () => void;
}

const EvidenceContext = React.createContext<EvidenceContextType>({
  openEvidence: () => {},
  closeEvidence: () => {},
});

export function useAppEvidence() {
  return React.useContext(EvidenceContext);
}

// ============================================================================
// Navigation Links Configuration
// ============================================================================
const NAV_SECTIONS = [
  {
    title: "INTELLIGENCE",
    items: [
      { name: "Overview", href: "/app", icon: LayoutGrid },
      { name: "Brief", href: "/app/brief", icon: FileText },
      { name: "Events", href: "/app/events", icon: CalendarDays },
      { name: "Signals", href: "/app/signals", icon: Radio },
      { name: "Trends", href: "/app/trends", icon: TrendingUp },
    ],
  },
  {
    title: "COMPETITIVE",
    items: [
      { name: "Competitors", href: "/app/competitors", icon: Users },
      { name: "Compare", href: "/app/compare", icon: GitCompare },
    ],
  },
  {
    title: "RESEARCH",
    items: [
      { name: "Research Radar", href: "/app/research-radar", icon: Radar },
      { name: "Research Topics", href: "/app/workspace/topics", icon: Compass },
    ],
  },
  {
    title: "WORKSPACE",
    items: [
      { name: "Companies & Competitors", href: "/app/workspace/watchlist", icon: Building2 },
      { name: "Delivery", href: "/app/workspace/delivery", icon: Bell },
      { name: "Settings", href: "/app/workspace/settings", icon: Settings },
      { name: "Onboard New Company", href: "/onboarding?new=1", icon: Sparkles },
    ],
  },
];

// ============================================================================
// AppShell Component
// ============================================================================
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, isLoading: authLoading } = useAuth();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const [activeTenantId, setActiveTenantId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("prismiq_active_tenant_id");
      if (stored) return stored;
    }
    return "8553449a-c998-4727-be01-9aeb724038cb"; // Default to Meesho
  });

  const [customWorkspaces, setCustomWorkspaces] = React.useState<
    Array<{ tenant_id: string; name: string; target: string; sector: string }>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("prismiq_custom_workspaces");
        if (raw) return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    return [];
  });

  // Combine built-in workspaces with custom user-created workspaces
  const allWorkspaces = React.useMemo(() => {
    const combined = [...AVAILABLE_WORKSPACES];
    for (const cw of customWorkspaces) {
      if (!combined.some((w) => w.tenant_id === cw.tenant_id)) {
        combined.push(cw);
      }
    }
    return combined;
  }, [customWorkspaces]);

  const [config, setConfig] = React.useState<WorkspaceConfig | null>(null);
  const [pipeline, setPipeline] = React.useState<PipelineProgress | null>(null);
  const [isSweeping, setIsSweeping] = React.useState(false);

  // Evidence Drawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerData, setDrawerData] = React.useState<EvidenceItem | null>(null);

  const openEvidence = React.useCallback((item: EvidenceItem) => {
    setDrawerData(item);
    setDrawerOpen(true);
  }, []);

  const closeEvidence = React.useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // Fetch workspace configuration & target company
  const refreshConfig = React.useCallback(async () => {
    try {
      const cfg = await fetchWorkspaceConfig();
      setConfig(cfg);
    } catch {
      // Graceful fallback
    }
  }, []);

  // Auto-record active workspace if missing from list
  React.useEffect(() => {
    if (config?.target_company && activeTenantId) {
      const existsInAvailable = AVAILABLE_WORKSPACES.some((w) => w.tenant_id === activeTenantId);
      const existsInCustom = customWorkspaces.some((w) => w.tenant_id === activeTenantId);
      if (!existsInAvailable && !existsInCustom) {
        const newEntry = {
          tenant_id: activeTenantId,
          name: `${config.target_company} Intelligence`,
          target: config.target_company,
          sector: "Custom Workspace",
        };
        const updated = [...customWorkspaces, newEntry];
        setCustomWorkspaces(updated);
        try {
          localStorage.setItem("prismiq_custom_workspaces", JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
    }
  }, [config, activeTenantId, customWorkspaces]);

  // Fetch pipeline status
  const checkPipeline = React.useCallback(async () => {
    try {
      const p = await fetchPipelineStatus();
      setPipeline(p);
    } catch {
      // Graceful fallback
    }
  }, []);

  React.useEffect(() => {
    refreshConfig();
    checkPipeline();
    const interval = setInterval(checkPipeline, 10000);
    return () => clearInterval(interval);
  }, [refreshConfig, checkPipeline]);

  // Target company name
  const targetCompany = React.useMemo(() => {
    if (config?.target_company) return config.target_company;
    const match = allWorkspaces.find((w) => w.tenant_id === activeTenantId);
    return match ? match.target : "Meesho";
  }, [config, activeTenantId, allWorkspaces]);

  // Switch workspace
  const switchWorkspace = React.useCallback(
    (newTenantId: string) => {
      setActiveTenantId(newTenantId);
      if (typeof window !== "undefined") {
        localStorage.setItem("prismiq_active_tenant_id", newTenantId);
        // Explicitly construct and store token for this specific tenant
        const token = createTenantToken(newTenantId);
        localStorage.setItem("prismiq_tenant_token", token);

        const ws = allWorkspaces.find((w) => w.tenant_id === newTenantId);
        const targetName = ws ? ws.target : "Workspace";
        localStorage.setItem(
          "prismiq_user",
          JSON.stringify({
            id: newTenantId,
            email: `${newTenantId.slice(0, 8)}@prismiq.ai`,
            name: `${targetName} Workspace`,
            tenant_id: newTenantId,
          })
        );
        setWorkspaceMenuOpen(false);
        // Refresh page to reset all memory caches
        window.location.reload();
      }
    },
    [allWorkspaces]
  );

  // Start onboarding a brand new target company
  const startNewCompanyOnboarding = React.useCallback(() => {
    if (typeof window !== "undefined") {
      setWorkspaceMenuOpen(false);
      const newTid = crypto.randomUUID();
      localStorage.setItem("prismiq_active_tenant_id", newTid);
      const token = createTenantToken(newTid);
      localStorage.setItem("prismiq_tenant_token", token);
      localStorage.removeItem("prismiq_onboarding_state");
      localStorage.setItem(
        "prismiq_user",
        JSON.stringify({
          id: newTid,
          email: `${newTid.slice(0, 8)}@prismiq.ai`,
          name: "New Workspace",
          tenant_id: newTid,
        })
      );
      router.push("/onboarding?new=1");
    }
  }, [router]);


  // Trigger sweep
  const triggerSweep = React.useCallback(async () => {
    setIsSweeping(true);
    try {
      await triggerPipelineRun(false);
      await checkPipeline();
    } catch (err: any) {
      alert(`Sweep trigger error: ${err.message}`);
    } finally {
      setIsSweeping(false);
    }
  }, [checkPipeline]);

  return (
    <WorkspaceContext.Provider
      value={{
        targetCompany,
        tenantId: activeTenantId,
        config,
        pipeline,
        switchWorkspace,
        triggerSweep,
        isSweeping,
        refreshConfig,
        allWorkspaces,
        startNewCompanyOnboarding,
      }}
    >
      <EvidenceContext.Provider value={{ openEvidence, closeEvidence }}>
        <div className="prismiq-app-root min-h-screen flex flex-col antialiased text-[#17171b]">
          {/* Top Context Header Bar */}
          <header className="sticky top-0 z-30 h-16 border-b border-[rgba(20,20,30,0.08)] bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-6">
              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 text-[#70717a] hover:text-[#17171b] rounded-lg hover:bg-zinc-100"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Brand Logo matching Landing Page */}
              <Link href="/app" className="flex items-center gap-2.5 group">
                <svg viewBox="0 0 42 42" className="w-7 h-7 flex-shrink-0">
                  <defs>
                    <linearGradient id="prismShellGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop stopColor="#5A72FF" />
                      <stop offset=".52" stopColor="#8B4DFF" />
                      <stop offset="1" stopColor="#FF83C8" />
                    </linearGradient>
                  </defs>
                  <path d="M21 3 37 31 21 39 5 31Z" fill="url(#prismShellGrad)" />
                  <path d="M21 3 21 39 5 31Z" fill="#62DDF2" opacity=".85" />
                  <path d="M21 26 37 31 21 39Z" fill="#FF72C2" opacity=".6" />
                </svg>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm tracking-tight text-[#17171b]">
                    PrismIQ
                  </span>
                  <span className="text-[10px] font-semibold text-[#9ca3af] -mt-1 hidden sm:inline">
                    Decision Intelligence
                  </span>
                </div>
              </Link>

              <div className="hidden sm:block h-5 w-[1px] bg-[rgba(20,20,30,0.1)]" />

              {/* Target Company Badge with Workspace Switcher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[rgba(20,20,30,0.08)] bg-zinc-50 hover:bg-zinc-100/80 transition-all text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                    Target:
                  </span>
                  <span className="font-bold text-xs text-[#17171b]">
                    {targetCompany}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#9ca3af]" />
                </button>

                {/* Workspace Dropdown */}
                {workspaceMenuOpen && (
                  <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white border border-[rgba(20,20,30,0.09)] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-zinc-100">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                        Select Active Workspace
                      </div>
                      <div className="text-xs text-[#70717a]">
                        Strict Tenant-Isolated State
                      </div>
                    </div>
                    <div className="py-1 space-y-1 max-h-64 overflow-y-auto">
                      {allWorkspaces.map((ws) => (
                        <button
                          key={ws.tenant_id}
                          onClick={() => switchWorkspace(ws.tenant_id)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                            activeTenantId === ws.tenant_id
                              ? "bg-purple-50 font-bold text-[#6e57dc]"
                              : "hover:bg-zinc-50 text-[#374151]"
                          }`}
                        >
                          <div>
                            <div className="font-bold">{ws.target}</div>
                            <div className="text-[11px] text-[#9ca3af]">{ws.sector}</div>
                          </div>
                          {activeTenantId === ws.tenant_id && (
                            <CheckCircle2 className="w-4 h-4 text-[#6e57dc]" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Action to Onboard a New Company */}
                    <div className="pt-2 mt-1 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={startNewCompanyOnboarding}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50/80 hover:bg-purple-100 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Set Up Another Company</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Pipeline Status Indicator */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(20,20,30,0.08)] bg-white text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pipeline?.is_active
                      ? "bg-amber-500 animate-pulse"
                      : "bg-emerald-500"
                  }`}
                />
                <span className="text-[11px] font-semibold text-[#595a63]">
                  {pipeline?.is_active
                    ? `Sweeping: ${pipeline.current_phase || "Active"}`
                    : "Pipeline Synchronized"}
                </span>
              </div>

              {/* Sweep Trigger Button */}
              <button
                type="button"
                onClick={triggerSweep}
                disabled={isSweeping || pipeline?.is_active}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgba(20,20,30,0.08)] bg-white hover:bg-zinc-50 text-xs font-bold text-[#17171b] shadow-xs disabled:opacity-50"
              >
                {isSweeping || pipeline?.is_active ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6e57dc]" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-[#6e57dc]" />
                )}
                <span>Sweep</span>
              </button>

              {/* User Avatar / Logout */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6e57dc] to-[#72d7e8] flex items-center justify-center font-bold text-white text-xs shadow-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : "P"}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 text-[#9ca3af] hover:text-[#17171b] rounded-lg hover:bg-zinc-100 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Body Container */}
          <div className="flex-1 flex min-h-0">
            {/* Desktop Persistent Sidebar */}
            <aside className="hidden md:flex flex-col w-64 border-r border-[rgba(20,20,30,0.08)] bg-white/70 backdrop-blur-md p-4 shrink-0 overflow-y-auto">
              <nav className="space-y-6">
                {NAV_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <div className="px-3 text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-2">
                      {section.title}
                    </div>
                    <ul className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/app" && pathname.startsWith(item.href));
                        return (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                isActive
                                  ? "bg-purple-50 text-[#6e57dc] font-bold shadow-xs border border-purple-100/60"
                                  : "text-[#595a63] hover:text-[#17171b] hover:bg-zinc-100/70"
                              }`}
                            >
                              <Icon
                                className={`w-4 h-4 ${
                                  isActive ? "text-[#6e57dc]" : "text-[#9ca3af]"
                                }`}
                              />
                              <span>{item.name}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>

              {/* Bottom Target Information Card */}
              <div className="mt-auto pt-6">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/80 via-white to-blue-50/50 border border-purple-100 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#6e57dc] mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Workspace Active</span>
                  </div>
                  <div className="font-extrabold text-[#17171b] truncate">
                    {targetCompany}
                  </div>
                  <div className="text-[11px] text-[#70717a] mt-0.5">
                    Grounding intelligence in verified sources.
                  </div>
                </div>
              </div>
            </aside>

            {/* Mobile Drawer */}
            {mobileOpen && (
              <div className="fixed inset-0 z-50 md:hidden flex">
                <div
                  className="fixed inset-0 bg-black/25 backdrop-blur-xs"
                  onClick={() => setMobileOpen(false)}
                />
                <div className="relative w-72 max-w-full bg-white h-full p-4 overflow-y-auto z-10 flex flex-col shadow-2xl">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#17171b]">PrismIQ</span>
                      <span className="text-[10px] text-[#9ca3af]">Navigation</span>
                    </div>
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="p-1.5 text-[#9ca3af] hover:text-[#17171b] rounded-lg hover:bg-zinc-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <nav className="space-y-6">
                    {NAV_SECTIONS.map((section) => (
                      <div key={section.title}>
                        <div className="px-3 text-[10px] font-extrabold tracking-wider uppercase text-[#9ca3af] mb-2">
                          {section.title}
                        </div>
                        <ul className="space-y-1">
                          {section.items.map((item) => {
                            const Icon = item.icon;
                            const isActive =
                              pathname === item.href ||
                              (item.href !== "/app" && pathname.startsWith(item.href));
                            return (
                              <li key={item.name}>
                                <Link
                                  href={item.href}
                                  onClick={() => setMobileOpen(false)}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                                    isActive
                                      ? "bg-purple-50 text-[#6e57dc] font-bold"
                                      : "text-[#595a63] hover:text-[#17171b]"
                                  }`}
                                >
                                  <Icon className="w-4 h-4" />
                                  <span>{item.name}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </nav>
                </div>
              </div>
            )}

            {/* Main Content Viewport */}
            <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>

          {/* Global Evidence Drawer */}
          <PrismEvidenceDrawer
            isOpen={drawerOpen}
            onClose={closeEvidence}
            data={drawerData}
          />
        </div>
      </EvidenceContext.Provider>
    </WorkspaceContext.Provider>
  );
}
