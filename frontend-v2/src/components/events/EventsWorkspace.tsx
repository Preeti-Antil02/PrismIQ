"use client";

import * as React from "react";
import { useEvidenceDrawer } from "@/components/layout/AppShell";
import {
  fetchEvents,
  fetchTrackedCompanies,
  type ConsolidatedEventRecord,
  type TrackedCompany,
} from "@/lib/api";
import { EventsTimelineHeader } from "./EventsTimelineHeader";
import {
  EventsFilterBar,
  type EventCategoryKey,
  type EventSortKey,
} from "./EventsFilterBar";
import { detectEventCategory } from "./EventTimelineCard";
import { EventsTimelineStream } from "./EventsTimelineStream";
import { TierType } from "@/components/primitives/TierBadge";
import { ConfidenceScore } from "@/components/primitives/ConfidenceBadge";
import { normalizeConfidence } from "@/lib/tokens";

export function EventsWorkspace() {
  const { openDrawer } = useEvidenceDrawer();

  // Data states
  const [events, setEvents] = React.useState<ConsolidatedEventRecord[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [trackedCompanies, setTrackedCompanies] = React.useState<TrackedCompany[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedCategory, setSelectedCategory] = React.useState<EventCategoryKey>("ALL");
  const [selectedCompany, setSelectedCompany] = React.useState<string>("ALL");
  const [selectedConfidence, setSelectedConfidence] = React.useState<string>("ALL");
  const [selectedTier, setSelectedTier] = React.useState<string>("ALL");
  const [selectedSort, setSelectedSort] = React.useState<EventSortKey>("newest");

  // Loading & error states
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load tracked companies once on mount
  React.useEffect(() => {
    fetchTrackedCompanies()
      .then((comps) => setTrackedCompanies(comps || []))
      .catch(() => {});
  }, []);

  // Fetch events from API
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvents({
        company: selectedCompany !== "ALL" ? selectedCompany : undefined,
        tier: selectedTier !== "ALL" ? selectedTier : undefined,
        confidence: selectedConfidence !== "ALL" ? selectedConfidence : undefined,
        limit: 100,
      });

      setEvents(res.events || []);
      setTotalCount(res.count || 0);
    } catch (err: any) {
      setError(err.message || "Failed to query consolidated events.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, selectedTier, selectedConfidence]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering & search
  const filteredEvents = React.useMemo(() => {
    let result = [...events];

    // Filter by Event Category
    if (selectedCategory !== "ALL") {
      result = result.filter((e) => {
        const cat = detectEventCategory(
          e.title,
          e.event_summary,
          e.contributing_sources
        );
        return cat.id === selectedCategory;
      });
    }

    // Filter by Instant Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.company_name.toLowerCase().includes(q) ||
          (e.event_summary && e.event_summary.toLowerCase().includes(q)) ||
          (e.why_it_matters && e.why_it_matters.toLowerCase().includes(q)) ||
          (e.contributing_sources &&
            e.contributing_sources.some((s) => s.toLowerCase().includes(q)))
      );
    }

    // Sort order
    result.sort((a, b) => {
      if (selectedSort === "newest") {
        const timeA = new Date(
          a.published_timestamp || a.published_at || a.latest_detected_at || 0
        ).getTime();
        const timeB = new Date(
          b.published_timestamp || b.published_at || b.latest_detected_at || 0
        ).getTime();
        return timeB - timeA;
      }
      if (selectedSort === "oldest") {
        const timeA = new Date(
          a.published_timestamp || a.published_at || a.latest_detected_at || 0
        ).getTime();
        const timeB = new Date(
          b.published_timestamp || b.published_at || b.latest_detected_at || 0
        ).getTime();
        return timeA - timeB;
      }
      if (selectedSort === "corroborated") {
        return (b.corroboration_count || 1) - (a.corroboration_count || 1);
      }
      return 0;
    });

    return result;
  }, [events, selectedCategory, searchQuery, selectedSort]);

  // Active filter count & clear all
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedCategory !== "ALL" ||
    selectedCompany !== "ALL" ||
    selectedConfidence !== "ALL" ||
    selectedTier !== "ALL";

  const activeFilterCount = [
    searchQuery !== "",
    selectedCategory !== "ALL",
    selectedCompany !== "ALL",
    selectedConfidence !== "ALL",
    selectedTier !== "ALL",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("ALL");
    setSelectedCompany("ALL");
    setSelectedConfidence("ALL");
    setSelectedTier("ALL");
  };

  // Inspect Event: opens shared root Evidence Drawer
  const handleInspectEvent = (ev: ConsolidatedEventRecord) => {
    const factConf = normalizeConfidence(ev.fact_confidence) as ConfidenceScore;
    const sourcesList = ev.contributing_sources?.length
      ? ev.contributing_sources
      : ["Primary Event Record"];

    openDrawer({
      id: ev.event_id,
      title: ev.title,
      company: ev.company_name,
      timestamp: ev.published_timestamp || ev.published_at || "Recent cycle",
      tier: (ev.tier as TierType) || "Nice-to-Know",
      confidence: factConf,
      factualConfidence: factConf,
      factualRationale:
        ev.raw_excerpt ||
        ev.event_summary ||
        `Ground truth observation consolidated from ${sourcesList.join(", ")}.`,
      inferenceConfidence:
        (normalizeConfidence(ev.inference_confidence) as ConfidenceScore) ||
        "Medium",
      inferenceRationale:
        ev.why_it_matters &&
        !ev.why_it_matters.toLowerCase().includes("rate limit") &&
        !ev.why_it_matters.toLowerCase().includes("analysis unavailable")
          ? ev.why_it_matters
          : "Preliminary observation synthesized against competitor profile under active monitoring.",
      factSummary: ev.event_summary || ev.title,
      whyItMatters:
        ev.why_it_matters &&
        !ev.why_it_matters.toLowerCase().includes("rate limit") &&
        !ev.why_it_matters.toLowerCase().includes("analysis unavailable")
          ? ev.why_it_matters
          : ev.event_summary ||
            `Real-world consolidated event for ${ev.company_name} clustered across ${sourcesList.join(", ")}.`,
      implication:
        ev.why_it_matters &&
        !ev.why_it_matters.toLowerCase().includes("rate limit") &&
        !ev.why_it_matters.toLowerCase().includes("analysis unavailable")
          ? `May signal shifts in competitive velocity or feature parity for ${ev.company_name}. Continue monitoring related channels.`
          : undefined,
      records: sourcesList.map((src, i) => ({
        id: `rec-${ev.event_id}-${i}`,
        source: src,
        sourceType: src,
        url: ev.url,
        timestamp: ev.published_timestamp || ev.published_at,
        extractedText: ev.raw_excerpt || ev.event_summary || ev.title,
        isPrimary: i === 0,
      })),
      corroboratingSources: sourcesList.length > 1 ? sourcesList.slice(1) : undefined,
    });
  };

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 space-y-5">
      {/* 1. Compact Header */}
      <EventsTimelineHeader
        totalCount={totalCount}
        filteredCount={filteredEvents.length}
        isFiltered={hasActiveFilters}
      />

      {/* 2. Event Filter Bar */}
      <EventsFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedCompany={selectedCompany}
        onCompanyChange={setSelectedCompany}
        trackedCompanies={trackedCompanies}
        selectedConfidence={selectedConfidence}
        onConfidenceChange={setSelectedConfidence}
        selectedTier={selectedTier}
        onTierChange={setSelectedTier}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        onClearAll={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 3. Chronological Event Timeline Stream */}
      <EventsTimelineStream
        events={filteredEvents}
        loading={loading}
        error={error}
        onRetry={loadData}
        onInspect={handleInspectEvent}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
      />
    </div>
  );
}
