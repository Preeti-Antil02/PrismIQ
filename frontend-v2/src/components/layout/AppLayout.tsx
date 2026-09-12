"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Radio,
  CalendarDays,
  TrendingUp,
  Radar,
  Users,
  Scale,
  Eye,
  Hash,
  Send,
  Settings,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAVIGATION: NavSection[] = [
  {
    items: [
      { label: "Overview", href: "/app", icon: LayoutDashboard },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { label: "Brief", href: "/app/brief", icon: FileText },
      { label: "Signals", href: "/app/signals", icon: Radio },
      { label: "Events", href: "/app/events", icon: CalendarDays },
      { label: "Trends", href: "/app/trends", icon: TrendingUp },
      { label: "Research Radar", href: "/app/research-radar", icon: Radar },
    ],
  },
  {
    title: "COMPETITIVE",
    items: [
      { label: "Competitors", href: "/app/competitors", icon: Users },
      { label: "Compare", href: "/app/compare", icon: Scale },
    ],
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "Watchlist", href: "/app/workspace/watchlist", icon: Eye },
      { label: "Topics", href: "/app/workspace/topics", icon: Hash },
      { label: "Delivery", href: "/app/workspace/delivery", icon: Send },
      { label: "Settings", href: "/app/workspace/settings", icon: Settings },
    ],
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wider uppercase text-slate-950">
            PRISMIQ
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
            Intelligence
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 md:static md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
          <Link href="/app" className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wider uppercase text-slate-950">
              PRISMIQ
            </span>
          </Link>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
            Live
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAVIGATION.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {section.title && (
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors select-none",
                      active
                        ? "bg-slate-900 text-white font-semibold shadow-xs"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-600")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User / Tenant status footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <div className="text-[11px] font-semibold text-slate-900 truncate">
            Workspace Tenant
          </div>
          <div className="text-[10px] font-mono text-slate-600 truncate">
            RLS-Enforced
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
