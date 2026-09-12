"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { TierBadge } from "@/components/shared/TierBadge";
import {
  EvidenceDrawer,
  type EvidenceDrawerData,
} from "@/components/shared/EvidenceDrawer";
import {
  LoadingState,
  EmptyState,
  PartialState,
  ErrorState,
  NotAvailableState,
} from "@/components/states";
import {
  CONFIDENCE_CONFIG,
  TIER_CONFIG,
  CLASSIFIER_CONFIG,
  SIGNAL_TYPE_CONFIG,
} from "@/lib/tokens";
import { Shield, Sparkles, AlertCircle, Layers, CheckCircle } from "lucide-react";

export default function DesignSystemShowcase() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeDrawerData, setActiveDrawerData] = React.useState<EvidenceDrawerData | null>(null);

  const sampleEvidence: EvidenceDrawerData = {
    id: "sample-ev-1",
    title: "Vercel introduces micro-frontend isolated edge middleware",
    company: "Vercel",
    timestamp: "2 hours ago",
    tier: "Must-Know",
    confidence: "High",
    confidenceNuance: {
      level: "High",
      score: 0.94,
      isCorroborated: true,
      corroborationCount: 3,
      reason: "Confirmed across official GitHub PR, changelog RSS, and developer blog.",
    },
    fact: "Vercel merged PR #48921 adding native multi-zone support to Edge Middleware runtime, allowing independent team deployments without routing coordination.",
    inference: "Direct competitive move against Cloudflare Workers micro-routing; significantly lowers migration friction for enterprise Next.js customers who currently require custom proxy clusters.",
    corroborationCount: 3,
    sources: [
      {
        id: "s1",
        title: "GitHub Pull Request: Edge Middleware Multi-Zone Isolation",
        url: "https://github.com/vercel/next.js/pull/48921",
        sourceType: "GitHub",
        publishedAt: "Today, 14:12 UTC",
        excerpt: "Enables isolated middleware routing boundaries per tenant zone.",
        isValid: true,
      },
      {
        id: "s2",
        title: "Vercel Changelog: Zone-level middleware now available",
        url: "https://vercel.com/changelog/edge-middleware-multi-zone",
        sourceType: "News",
        publishedAt: "Today, 15:00 UTC",
        isValid: true,
      },
      {
        id: "s3",
        title: "Broken citation demonstration (Part 11.2 fail-loud rule)",
        url: "https://example.com/unresolved-source",
        sourceType: "Research",
        publishedAt: "Yesterday",
        isValid: false,
        failureReason: "HTTP 404 Not Found — URL unreachable during verification check",
      },
    ],
  };

  const handleOpenDrawer = () => {
    setActiveDrawerData(sampleEvidence);
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans pb-20">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wider uppercase text-slate-950">
              PRISMIQ
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600">
              Design System & Token Showcase (Phase B)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
              Slice 1 Product Mode Active
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-10">
        {/* Section 1: Philosophy & Color Tokens */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              1. Restrained Palette & Semantic Token System
            </h2>
            <p className="text-xs text-slate-500">
              Deep Navy foundation, warm neutral base (#F8F9FB), zero purple gradients or glassmorphism. Fixed accent meanings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Accent */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Electric Blue</span>
                <span className="h-3 w-3 rounded-full bg-blue-600" />
              </div>
              <p className="text-[11px] text-slate-500">
                Primary interaction, core calls-to-action, navigation state.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <Button size="sm" variant="primary">Primary Action</Button>
                <Button size="sm" variant="subtle">Subtle Action</Button>
              </div>
            </div>

            {/* Cyan Accent */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Cyan</span>
                <span className="h-3 w-3 rounded-full bg-cyan-600" />
              </div>
              <p className="text-[11px] text-slate-500">
                Emerging developments & Research Radar classifier tracking.
              </p>
              <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                <Badge variant="cyan">Researching</Badge>
                <span className="text-[11px] text-cyan-800 font-mono bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
                  arXiv + Blog RSS
                </span>
              </div>
            </div>

            {/* Violet Accent */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Violet</span>
                <span className="h-3 w-3 rounded-full bg-purple-600" />
              </div>
              <p className="text-[11px] text-slate-500">
                Synthesized intelligence, cross-competitor pattern emergence (Trends).
              </p>
              <div className="pt-2 flex items-center gap-1.5">
                <Badge variant="violet">Cross-Competitor Synthesis</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Shared Badges (Confidence & Tier) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              2. Shared Cross-Cutting Badges
            </h2>
            <p className="text-xs text-slate-500">
              Surfaces corroboration bumps, freshness decay, and deterministic tier weight (Hover to inspect nuance).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confidence Badges */}
            <Card>
              <CardHeader>
                <CardTitle>Confidence Level Badges (Hover for Nuance)</CardTitle>
                <CardDescription>
                  Grounded in backend scores, corroboration counts, and decay rules.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">High Confidence:</span>{" "}
                    <span className="text-slate-500">3 corroborations, 94%</span>
                  </div>
                  <ConfidenceBadge
                    level="High"
                    nuance={{
                      level: "High",
                      score: 0.94,
                      isCorroborated: true,
                      corroborationCount: 3,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">Medium Confidence:</span>{" "}
                    <span className="text-slate-500">Single source, 72%</span>
                  </div>
                  <ConfidenceBadge
                    level="Medium"
                    nuance={{
                      level: "Medium",
                      score: 0.72,
                      isSelfRated: true,
                      reason: "Single primary source confirmed; awaiting corroborating news release.",
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">Low Confidence:</span>{" "}
                    <span className="text-slate-500">Decay applied (&gt;7 days)</span>
                  </div>
                  <ConfidenceBadge
                    level="Low"
                    nuance={{
                      level: "Low",
                      score: 0.45,
                      decayApplied: true,
                      freshnessNote: "12 days old without update",
                      reason: "Freshness decay applied per Part 10.1 rules.",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tier Badges */}
            <Card>
              <CardHeader>
                <CardTitle>Deterministic Tier Badges</CardTitle>
                <CardDescription>
                  Strict vocabulary per Part 6.7. Used identically across all 4 Slice 1 pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-600">Executive Priority Alert</span>
                  <TierBadge tier="Must-Know" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-600">Active Strategic Notice</span>
                  <TierBadge tier="Should-Know" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-600">Informational / Background</span>
                  <TierBadge tier="Nice-to-Know" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 3: Evidence Drawer Shell */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                3. Evidence Drawer Shell (Spec Section 3.9)
              </h2>
              <p className="text-xs text-slate-500">
                Primary question: "Why should I trust this specific claim?" Strict FACT vs INFERENCE separation, fail-loud citations.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={handleOpenDrawer}>
              Test Slide-over Drawer
            </Button>
          </div>

          <Card className="bg-gradient-to-r from-white to-slate-50/50">
            <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TierBadge tier="Must-Know" />
                  <span className="text-xs font-semibold text-slate-900">
                    Vercel introduces micro-frontend isolated edge middleware
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Click the button to test slide-over with verified FACT layout, analytical INFERENCE card, and fail-loud citation status.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleOpenDrawer} className="shrink-0">
                Inspect Grounding
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: Dense Table & Base Primitives */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              4. Dense Product Mode Data Table
            </h2>
            <p className="text-xs text-slate-500">
              Tight line heights, tabular figures, no wasted whitespace for fast executive scanning.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-32">Company</TableHead>
                <TableHead>Headline & Observation</TableHead>
                <TableHead className="w-28">Confidence</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Badge variant="blue">News</Badge>
                </TableCell>
                <TableCell className="font-semibold text-slate-900">Vercel</TableCell>
                <TableCell>
                  <div className="font-medium text-slate-900">Edge Middleware Multi-Zone Release</div>
                  <div className="text-[11px] text-slate-500">Independent micro-frontend routing without proxy overhead</div>
                </TableCell>
                <TableCell>
                  <ConfidenceBadge level="High" />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={handleOpenDrawer}>
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Badge variant="secondary">GitHub</Badge>
                </TableCell>
                <TableCell className="font-semibold text-slate-900">Cloudflare</TableCell>
                <TableCell>
                  <div className="font-medium text-slate-900">Workers dynamic asset handler merged into main</div>
                  <div className="text-[11px] text-slate-500">Allows static asset caching directly at L4 edge point</div>
                </TableCell>
                <TableCell>
                  <ConfidenceBadge level="Medium" />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={handleOpenDrawer}>
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* Section 5: Five Global States */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              5. The Five Global States Framework (Spec Section 4)
            </h2>
            <p className="text-xs text-slate-500">
              Standardized across all pages: Loading, Empty, Partial gap disclosure, Explicit Error, and Not-yet-available.
            </p>
          </div>

          <Tabs defaultValue="partial">
            <TabsList className="mb-4">
              <TabsTrigger value="partial">1. Partial (Disclosed Gap)</TabsTrigger>
              <TabsTrigger value="empty">2. Empty State</TabsTrigger>
              <TabsTrigger value="error">3. Error State</TabsTrigger>
              <TabsTrigger value="unbuilt">4. Not Yet Available</TabsTrigger>
              <TabsTrigger value="loading">5. Loading (Skeleton)</TabsTrigger>
            </TabsList>

            <TabsContent value="partial">
              <div className="space-y-3">
                <PartialState
                  sourceName="News RSS Feed"
                  cycleTime="2026-09-10 18:00 UTC"
                  details="HackerNews API rate-limit exceeded during cycle; job completed with 4 remaining verified sources."
                />
                <PartialState
                  message="GitHub Commit Stream partially degraded for Netlify org — 3 repositories pending backfill."
                />
              </div>
            </TabsContent>

            <TabsContent value="empty">
              <EmptyState
                title="Your first monitoring cycle hasn't run yet"
                description="PrismIQ is currently indexing your tracked competitors (Vercel, Netlify, Cloudflare, Stripe). Your initial synthesized brief will generate at 00:00 UTC."
                actionLabel="Inspect Tracked Watchlist"
                onAction={() => alert("Routes to /app/workspace/watchlist")}
              />
            </TabsContent>

            <TabsContent value="error">
              <ErrorState
                title="API Connection Interrupted"
                message="Failed to synchronize latest brief row from Postgres. The upstream connection timed out after 5000ms."
                stalenessLabel="September 10, 2026 12:00 UTC"
                onRetry={() => alert("Triggering re-fetch...")}
              />
            </TabsContent>

            <TabsContent value="unbuilt">
              <NotAvailableState
                featureName="Trend Evolution Timeline"
                reason="Requires accumulating at least 4 consecutive weekly monitoring cycles. This route is reserved to prevent fabricated projections."
                type="history"
              />
            </TabsContent>

            <TabsContent value="loading">
              <LoadingState layout="cards" count={2} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      {/* Render Evidence Drawer */}
      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={activeDrawerData}
      />
    </div>
  );
}
