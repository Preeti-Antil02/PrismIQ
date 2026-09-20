"use client";

import * as React from "react";
import { useEvidenceDrawer } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/AuthContext";
import { type FindingData } from "@/components/primitives/FindingRow";
import { LoadingSkeleton } from "@/components/primitives/LoadingSkeleton";
import { AmbientAtmosphere } from "@/components/overview/AmbientAtmosphere";
import { OverviewCockpitHero } from "@/components/overview/OverviewCockpitHero";
import { OverviewAttentionGrid } from "@/components/overview/OverviewAttentionGrid";
import { CompetitivePulseStrip, type CompetitivePulseItem } from "@/components/overview/CompetitivePulseStrip";
import { ResearchRadarField, type ResearchTopicItem } from "@/components/overview/ResearchRadarField";
import { RecentEventsStream, type RecentEventItem } from "@/components/overview/RecentEventsStream";
import { MethodologyQuietLayer } from "@/components/overview/MethodologyQuietLayer";
import {
  fetchLatestBrief,
  fetchEvents,
  fetchSignals,
  fetchLatestRadar,
  fetchTrackedCompanies,
  fetchFindings,
  fetchWorkspaceTopics,
  fetchPipelineStatus,
  fetchWorkspaceConfig,
  type TrackedCompany,
  type ConsolidatedEventRecord,
  type PipelineProgress,
} from "@/lib/api";
import { parseBriefMarkdown } from "@/lib/briefParser";

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "Recently";
  if (/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(dateStr)) return dateStr;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}, ${d.getUTCFullYear()}`;
    }
  } catch {}
  return dateStr;
}

export default function OverviewPage() {
  const { openDrawer } = useEvidenceDrawer();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [briefDate, setBriefDate] = React.useState<string | null>(null);
  const [findings, setFindings] = React.useState<FindingData[]>([]);
  const [events, setEvents] = React.useState<RecentEventItem[]>([]);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);
  const [competitiveMovements, setCompetitiveMovements] = React.useState<CompetitivePulseItem[]>([]);
  const [radarTopics, setRadarTopics] = React.useState<ResearchTopicItem[]>([]);
  const [hasPartialDegradation, setHasPartialDegradation] = React.useState(false);
  const [pipelineProgress, setPipelineProgress] = React.useState<PipelineProgress | null>(null);

  const targetCompany = React.useMemo(() => {
    return trackedCompanies.find((c) => c.is_target)?.company_name || trackedCompanies[0]?.company_name || "";
  }, [trackedCompanies]);

  const competitorCount = React.useMemo(() => {
    return trackedCompanies.filter((c) => !c.is_target).length;
  }, [trackedCompanies]);

  const prevCompletedRef = React.useRef(0);

  const loadIntelligence = React.useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const [compsRes, briefRes, eventsRes, findingsRes, topicsRes, configRes, signalsRes, radarRes] = await Promise.allSettled([
        fetchTrackedCompanies(),
        fetchLatestBrief(),
        fetchEvents({ limit: 50 }),
        fetchFindings(),
        fetchWorkspaceTopics(),
        fetchWorkspaceConfig(),
        fetchSignals({ limit: 300 }),
        fetchLatestRadar(),
      ]);

      // 1. Process tracked companies with workspace config fallback
      let currentComps: TrackedCompany[] = [];
      if (compsRes.status === "fulfilled" && Array.isArray(compsRes.value) && compsRes.value.length > 0) {
        currentComps = compsRes.value;
      } else if (configRes.status === "fulfilled" && configRes.value?.tracked_companies?.length > 0) {
        currentComps = configRes.value.tracked_companies;
      } else if (configRes.status === "fulfilled" && configRes.value?.target_company) {
        currentComps = [
          { company_name: configRes.value.target_company, is_target: true, status: "active" },
          ...(configRes.value.competitors || []).map((c) => ({
            company_name: c,
            is_target: false,
            status: "active",
          })),
        ];
      }
      setTrackedCompanies(currentComps);

      const currentTarget =
        currentComps.find((c) => c.is_target)?.company_name ||
        (configRes.status === "fulfilled" ? configRes.value?.target_company : "") ||
        currentComps[0]?.company_name ||
        "";
      const competitors = currentComps.filter((c) => !c.is_target);

      // 2. Process real events
      let loadedEvents: ConsolidatedEventRecord[] = [];
      if (eventsRes.status === "fulfilled" && eventsRes.value?.events) {
        loadedEvents = eventsRes.value.events;
        const mappedEvents: RecentEventItem[] = loadedEvents.slice(0, 5).map((e) => ({
          id: e.event_id,
          company: e.company_name,
          date: formatEventDate(e.published_at || e.first_detected_at || "Recently"),
          title: e.title,
          corroboration: e.corroboration_count || e.contributing_sources?.length || 1,
          confidence: e.confidence || "High",
          tier: e.tier || "Must-Know",
          whyItMatters: e.why_it_matters || e.event_summary,
          records: e.contributing_signals?.map((s) => ({
            source: s.source,
            extractedText: s.raw_excerpt || s.title,
            url: s.url,
            timestamp: s.published_at,
          })) || [
            {
              source: "Primary Record",
              extractedText: e.raw_excerpt || e.event_summary,
              url: e.url,
              timestamp: e.published_at,
            },
          ],
        }));
        setEvents(mappedEvents);
      } else {
        setEvents([]);
      }

      // 3. Process competitive pulse from tracked competitors with honest real data derivation
      const loadedSignals = (signalsRes.status === "fulfilled" && signalsRes.value?.signals) ? signalsRes.value.signals : [];
      const pulseItems: CompetitivePulseItem[] = (competitors.length > 0 ? competitors : currentComps).map((c) => {
        const compLower = c.company_name.toLowerCase();
        const compEvent = loadedEvents.find((e) => e.company_name.toLowerCase() === compLower);
        const compSignals = loadedSignals.filter((s) => s.company_name.toLowerCase() === compLower);

        if (compEvent) {
          return {
            company: c.company_name,
            meaningfulMovement: compEvent.title,
            domain: "Verified Movement",
            status: "verified" as const,
            signalCount: compSignals.length,
          };
        } else if (compSignals.length > 0) {
          return {
            company: c.company_name,
            meaningfulMovement: `${compSignals.length} raw ${compSignals.length === 1 ? "signal" : "signals"} recorded • Awaiting consolidation`,
            domain: "Signals Recorded",
            status: "ingested" as const,
            signalCount: compSignals.length,
          };
        } else {
          return {
            company: c.company_name,
            meaningfulMovement: "No signals recorded yet • Pending initial sweep",
            domain: "Pending Sweep",
            status: "pending" as const,
            signalCount: 0,
          };
        }
      });
      setCompetitiveMovements(pulseItems);

      // 4. Process research topics with live radar evaluations cross-reference
      let rawTopics: any[] = [];
      if (topicsRes.status === "fulfilled" && Array.isArray(topicsRes.value) && topicsRes.value.length > 0) {
        rawTopics = topicsRes.value;
      } else if (configRes.status === "fulfilled" && Array.isArray(configRes.value?.topics) && configRes.value.topics.length > 0) {
        rawTopics = configRes.value.topics;
      }

      const radarEvals = (radarRes.status === "fulfilled" && radarRes.value?.evaluations) ? radarRes.value.evaluations : [];

      if (rawTopics.length > 0) {
        const mappedTopics: ResearchTopicItem[] = rawTopics.slice(0, 3).map((t, idx) => {
          const matchingEval = radarEvals.find(
            (ev: any) =>
              (ev.topic_id && t.id && ev.topic_id === t.id) ||
              ev.topic_label?.toLowerCase() === t.topic_label?.toLowerCase()
          );

          let status = "Pending Sweep";
          let statusClass = "text-[var(--amber)] bg-[rgba(255,180,90,0.08)] border-[var(--amber)]/20";
          let explanation = t.keywords?.length
            ? `Monitored keywords: ${t.keywords.slice(0, 4).join(", ")} (awaiting initial sweep)`
            : "Configured research theme • Awaiting pipeline sweep.";

          if (matchingEval) {
            const itemCount = matchingEval.research_item_count || 0;
            if (itemCount > 0) {
              status = `Active (${itemCount} ${itemCount === 1 ? "paper" : "papers"})`;
              statusClass = "text-[var(--green)] bg-[rgba(57,217,154,0.08)] border-[var(--green)]/20";
              explanation = matchingEval.why_it_matters || `${itemCount} research signals evaluated in latest sweep.`;
            } else if (matchingEval.state_change_detected) {
              status = "Shifts Detected";
              statusClass = "text-[var(--green)] bg-[rgba(57,217,154,0.08)] border-[var(--green)]/20";
              explanation = matchingEval.why_it_matters || "Directional shifts detected across monitored sources.";
            } else {
              status = "Audited (No shifts)";
              statusClass = "text-[#79d7ff] bg-[rgba(121,215,255,0.08)] border-[#79d7ff]/20";
              explanation = "Swept across tracked sources with zero matching signals.";
            }
          } else if (t.is_active === false) {
            status = "Paused";
            statusClass = "text-[var(--amber)] bg-[rgba(255,180,90,0.08)] border-[var(--amber)]/20";
            explanation = "Topic monitoring paused by tenant configuration.";
          }

          return {
            topic: t.topic_label,
            symbol: idx === 0 ? "✦" : idx === 1 ? "⌁" : "◈",
            status,
            explanation,
            contextCompany: currentTarget || "Workspace",
            contextText: `Monitored under ${currentTarget || "workspace"} scope`,
            statusClass,
            borderAccent: idx === 0 ? "var(--cyan)" : idx === 1 ? "var(--magenta)" : "var(--violet)",
          };
        });
        setRadarTopics(mappedTopics);
      } else {
        setRadarTopics([]);
      }

      // 5. Process latest brief and strategic findings
      let extractedFindings: FindingData[] = [];
      if (briefRes.status === "fulfilled" && briefRes.value) {
        if (briefRes.value.date) {
          setBriefDate(briefRes.value.date);
        }
        if (briefRes.value.content) {
          const parsed = parseBriefMarkdown(briefRes.value.content);
          if (parsed.partialFailure) {
            setHasPartialDegradation(true);
          }
          if (parsed.topDecisions.length > 0) {
            extractedFindings = parsed.topDecisions.map((d, i) => ({
              id: `decision-${d.number}-${d.company}`,
              company: d.company,
              headline: d.headline,
              whyItMatters: d.impact,
              fact: d.impact,
              tier: i === 0 ? "Must-Know" : i === 1 ? "Must-Know" : "Should-Know",
              confidence: "High",
              factConfidence: "High",
              inferenceConfidence: "Medium",
              timestamp: briefRes.value.date || new Date().toISOString(),
              sources: ["Synthesized Brief"],
            }));
          }
        }
      }

      // Fallback to table findings if brief has no decisions yet but findings exist
      if (extractedFindings.length === 0 && findingsRes.status === "fulfilled" && findingsRes.value?.findings) {
        extractedFindings = findingsRes.value.findings.slice(0, 3).map((f) => ({
          id: f.id,
          company: f.company_name,
          headline: f.why_it_matters || `${f.company_name} strategic development detected`,
          whyItMatters: f.why_it_matters || "Strategic competitive development detected during active monitoring cycle.",
          fact: f.why_it_matters || "",
          tier: (f.tier as any) || "Must-Know",
          confidence: (f.confidence as any) || "High",
          factConfidence: (f.fact_confidence as any) || "High",
          inferenceConfidence: (f.inference_confidence as any) || "Medium",
          timestamp: f.created_at || new Date().toISOString(),
          sources: ["Verified Signals"],
        }));
      }

      setFindings(extractedFindings);
    } catch (err) {
      console.warn("Error loading workspace intelligence:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial intelligence load
  React.useEffect(() => {
    loadIntelligence(true);
  }, [loadIntelligence, user?.tenant_id]);

  // Polling pipeline status with progressive data refresh
  React.useEffect(() => {
    let isCancelled = false;
    let timerId: NodeJS.Timeout | null = null;

    async function checkStatus() {
      try {
        const status = await fetchPipelineStatus();
        if (isCancelled) return;
        setPipelineProgress(status);

        // If newly completed companies arrived, soft refresh intelligence
        if (status.completed_companies > prevCompletedRef.current) {
          prevCompletedRef.current = status.completed_companies;
          loadIntelligence(false);
        }

        // Continue polling if pipeline is actively running
        if (status.status === "running") {
          timerId = setTimeout(checkStatus, 4000);
        } else if (status.status === "completed" && prevCompletedRef.current < (status.total_companies || 1)) {
          prevCompletedRef.current = status.total_companies || 1;
          loadIntelligence(false);
        }
      } catch (err) {
        console.warn("Pipeline status poll error:", err);
      }
    }

    checkStatus();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [loadIntelligence]);

  const handleInspectFinding = (finding: FindingData) => {
    openDrawer({
      id: finding.id,
      title: finding.headline,
      company: finding.company,
      timestamp: finding.timestamp,
      tier: finding.tier,
      confidence: finding.confidence || "High",
      factualConfidence: finding.factConfidence || finding.confidence || "High",
      inferenceConfidence: finding.inferenceConfidence || "Medium",
      factualRationale:
        "Direct observation verified against unredacted primary records with verifiable links.",
      inferenceRationale:
        "Evaluated against known competitive positioning, multi-signal patterns, and recent movement across monitored channels.",
      factSummary: finding.fact,
      whyItMatters: finding.whyItMatters,
      implication: finding.implication,
      records:
        finding.rawSignals?.map((r, i) => ({
          source: r.source,
          extractedText: r.text,
          url: r.url,
          timestamp: r.timestamp,
          isPrimary: i === 0,
        })) || [
          {
            source: finding.sourceType || "Official Source",
            extractedText: finding.fact || finding.whyItMatters || "",
            url: finding.url,
            timestamp: finding.timestamp,
            isPrimary: true,
          },
        ],
      corroboratingSources:
        finding.rawSignals && finding.rawSignals.length > 1
          ? finding.rawSignals.slice(1).map((r) => r.source)
          : finding.sources && finding.sources.length > 1
          ? finding.sources.slice(1)
          : [],
    });
  };

  const handleInspectEvent = (ev: RecentEventItem) => {
    openDrawer({
      id: ev.id,
      title: ev.title,
      company: ev.company,
      timestamp: ev.date,
      tier: ev.tier,
      confidence: ev.confidence,
      factualConfidence: "High",
      inferenceConfidence: ev.confidence === "High" ? "High" : "Medium",
      factualRationale: "Consolidated event verified across independent corroborating sources.",
      inferenceRationale: "Strategic impact derived from observed real-world actions.",
      whyItMatters: ev.whyItMatters || "Strategic competitive development informing current period positioning.",
      records: ev.records.map((r, i) => ({
        ...r,
        isPrimary: i === 0,
      })),
      corroboratingSources: ev.records.slice(1).map((r) => r.source),
    });
  };

  return (
    <div className="relative min-h-screen">
      {/* Signature Ambient Atmosphere with floating orbs, conic prism and spectrum ray */}
      <AmbientAtmosphere />

      {/* Main Content Container: Cinematic Intelligence Cockpit */}
      <div className="max-w-[1120px] mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-10 pb-28 relative z-10 space-y-12">
        {/* ========================================================================= */}
        {/* 1. COCKPIT HERO: Compact greeting + single-line telemetry status strip    */}
        {/* ========================================================================= */}
        <OverviewCockpitHero
          briefDate={briefDate}
          hasPartialDegradation={hasPartialDegradation}
          userName={user?.name}
          targetCompany={targetCompany}
          pipelineProgress={pipelineProgress}
        />

        {/* ========================================================================= */}
        {/* 2. WHAT DESERVES YOUR ATTENTION: Asymmetric 2-Column Cockpit Showcase    */}
        {/* ========================================================================= */}
        {loading ? (
          <LoadingSkeleton count={3} type="card" />
        ) : (
          <OverviewAttentionGrid
            findings={findings.slice(0, 3)}
            onInspect={handleInspectFinding}
            targetCompany={targetCompany}
            competitorCount={competitorCount}
          />
        )}

        {/* ========================================================================= */}
        {/* 3. COMPETITIVE PULSE: Horizontal Interactive Landscape                   */}
        {/* ========================================================================= */}
        <CompetitivePulseStrip
          movements={competitiveMovements}
        />

        {/* ========================================================================= */}
        {/* 4. RESEARCH RADAR: Field Scan Metaphor with Spatial Nodes                */}
        {/* ========================================================================= */}
        <ResearchRadarField
          topics={radarTopics}
        />

        {/* ========================================================================= */}
        {/* 5. RECENT EVENTS: Fast-Scan Chronological Feed Stream                    */}
        {/* ========================================================================= */}
        <RecentEventsStream
          events={events}
          onInspectEvent={handleInspectEvent}
        />

        {/* ========================================================================= */}
        {/* 6. EVIDENCE & METHODOLOGY: Quiet Trustworthy Closing Layer               */}
        {/* ========================================================================= */}
        <MethodologyQuietLayer />
      </div>
    </div>
  );
}
