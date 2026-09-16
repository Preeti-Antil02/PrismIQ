"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Radio,
  TrendingUp,
  Users,
  Scale,
  Radar,
  Building2,
  Hash,
  Send,
  Settings,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  activeInPhase1?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const SIDEBAR_NAVIGATION: NavSection[] = [
  {
    title: "NOW",
    items: [
      { label: "Overview", href: "/app", icon: LayoutDashboard, activeInPhase1: true },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { label: "Brief", href: "/app/brief", icon: FileText, activeInPhase1: true },
      { label: "Events", href: "/app/events", icon: CalendarDays, activeInPhase1: true },
      { label: "Signals", href: "/app/signals", icon: Radio, activeInPhase1: true },
      { label: "Trends", href: "/app/trends", icon: TrendingUp, activeInPhase1: false },
    ],
  },
  {
    title: "COMPETITIVE",
    items: [
      { label: "Competitors", href: "/app/competitors", icon: Users, activeInPhase1: false },
      { label: "Compare", href: "/app/compare", icon: Scale, activeInPhase1: false },
    ],
  },
  {
    title: "RESEARCH",
    items: [
      { label: "Research Radar", href: "/app/research-radar", icon: Radar, activeInPhase1: false },
    ],
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "Companies & competitors", href: "/app/workspace/watchlist", icon: Building2, activeInPhase1: false },
      { label: "Research topics", href: "/app/workspace/topics", icon: Hash, activeInPhase1: false },
      { label: "Delivery", href: "/app/workspace/delivery", icon: Send, activeInPhase1: false },
      { label: "Settings", href: "/app/workspace/settings", icon: Settings, activeInPhase1: false },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  className?: string;
}

export function Sidebar({ mobileOpen = false, onCloseMobile, className }: SidebarProps) {
  const pathname = usePathname();

  const isCurrentRoute = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname?.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-60 bg-[#0B0D12] border-r border-[rgba(255,255,255,0.06)] flex flex-col transition-transform duration-200 md:static md:translate-x-0 select-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <Link href="/app" className="flex items-center gap-2 group">
          <span className="font-bold text-sm tracking-[0.14em] uppercase text-white group-hover:text-blue-400 transition-colors">
            PRISMIQ
          </span>
          <span className="text-[10px] font-mono text-[#6B7280] tracking-tight">
            v2.0
          </span>
        </Link>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-[#9CA3AF] hover:text-white rounded-[4px] hover:bg-[#151922] transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main Navigation">
        {SIDEBAR_NAVIGATION.map((section, sIdx) => {
          const isWorkspace = section.title === "WORKSPACE";
          return (
            <div
              key={sIdx}
              className={cn("space-y-1", isWorkspace && "pt-3 border-t border-[rgba(255,255,255,0.04)] opacity-70")}
            >
              {section.title && (
                <div
                  className={cn(
                    "px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                    isWorkspace ? "text-[#4B5563] text-[9px]" : "text-[#6B7280]"
                  )}
                >
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const active = isCurrentRoute(item.href);
                const Icon = item.icon;

                if (!item.activeInPhase1) {
                  // Inactive / Disabled nav item for Phase 1
                  return (
                    <div
                      key={item.href}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-[4px] font-medium text-[#4B5563] cursor-not-allowed select-none group",
                        isWorkspace ? "text-[11px] py-1" : "text-xs"
                      )}
                      title="Available in subsequent phase"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={cn("shrink-0 text-[#4B5563]", isWorkspace ? "h-3.5 w-3.5" : "h-4 w-4")} />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </div>
                  );
                }

              // Active / Clickable nav item for Phase 1
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-[4px] text-xs font-medium transition-colors select-none",
                    active
                      ? "bg-[#151922] text-white font-semibold"
                      : "text-[#9CA3AF] hover:bg-[#121620] hover:text-[#F3F4F6]"
                  )}
                >
                  {/* Subtle restrained active blue indicator bar */}
                  {active && (
                    <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-blue-500 rounded-r-full" />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-blue-400" : "text-[#6B7280]"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            </div>
          );
        })}
      </nav>

      {/* Workspace Footer status */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.06)] bg-[#090B0F]">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#F3F4F6] truncate">
              Intelligence Workspace
            </div>
            <div className="text-[10px] font-mono text-[#6B7280] truncate">
              Continuous Monitoring
            </div>
          </div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 font-medium shrink-0">
            Active
          </span>
        </div>
      </div>
    </aside>
  );
}
