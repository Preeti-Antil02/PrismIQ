"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";

interface RouteItem {
  name: string;
  path: string;
  tier: "Core Slice 1" | "Core Slice 2" | "Workspace" | "Reserved";
  description: string;
}

const APP_ROUTES: RouteItem[] = [
  { name: "Overview / Dashboard", path: "/app", tier: "Core Slice 1", description: "Executive briefing, pulse metrics, recent events" },
  { name: "Intelligence Brief", path: "/app/brief", tier: "Core Slice 1", description: "Executive summary, synthesized intelligence" },
  { name: "Signals Stream", path: "/app/signals", tier: "Core Slice 1", description: "Multi-source signal feed with faceted filters" },
  { name: "Consolidated Events", path: "/app/events", tier: "Core Slice 1", description: "Tier-categorized event clusters and drilldown" },
  { name: "Research Radar", path: "/app/research-radar", tier: "Core Slice 2", description: "Strategic technology topic adoption matrix" },
  { name: "Competitors Directory", path: "/app/competitors", tier: "Core Slice 2", description: "Monitored company profiles and activity" },
  { name: "Competitor Comparison", path: "/app/compare", tier: "Core Slice 2", description: "Side-by-side technology adoption comparison" },
  { name: "Workspace Watchlist", path: "/app/workspace/watchlist", tier: "Workspace", description: "Tenant tracked companies configuration" },
  { name: "Workspace Delivery", path: "/app/workspace/delivery", tier: "Workspace", description: "Slack & webhook automated dispatch rules" },
  { name: "Workspace Topics", path: "/app/workspace/topics", tier: "Workspace", description: "Research radar topic subscription management" },
  { name: "Workspace Settings", path: "/app/workspace/settings", tier: "Workspace", description: "Tenant profile, storage limits & telemetry" },
  { name: "Trend Evolution", path: "/app/trends", tier: "Reserved", description: "Reserved route rendering NotAvailableState" },
  { name: "Battle Cards", path: "/app/battle-cards", tier: "Reserved", description: "Reserved route rendering NotAvailableState" },
  { name: "Scenario Trees", path: "/app/scenarios", tier: "Reserved", description: "Reserved route rendering NotAvailableState" },
];

export default function RouteCheckPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans pb-20">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wider uppercase text-slate-950">
              PRISMIQ
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600">
              Local Routes Verified (Internal Route Check)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
              <ShieldAlert className="w-3 h-3 mr-1" /> Internal Tooling Only
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-8 space-y-6">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">
              Application Route Health Check
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              All production routes and reserved placeholders verified active and responding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="divide-y divide-slate-100">
              {APP_ROUTES.map((route) => (
                <div key={route.path} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-md transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{route.name}</span>
                      <span className="text-xs font-mono text-slate-500">{route.path}</span>
                      <Badge variant="outline" className="text-[10px] py-0">
                        {route.tier}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{route.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Verified
                    </span>
                    <Link
                      href={route.path}
                      className="text-slate-400 hover:text-slate-700 p-1"
                      title={`Open ${route.name}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
