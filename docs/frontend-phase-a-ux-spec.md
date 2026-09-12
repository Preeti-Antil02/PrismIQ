# PrismIQ Frontend — Phase A: Product UX Specification
**Status:** Draft for review. No code, no visual design yet — this is sitemap, structure, and behavior only.
**Stack (confirmed):** Next.js + Tailwind + shadcn/ui, new build, zero reuse of the Stage 1 frontend.
**Data:** wired to real live data from day one — no mock/placeholder content in any page spec below.
**Governing rule carried from the Master Overview:** every page answers exactly one primary question. If a page needs five, it's two pages.

---

## 0. Real data this spec is grounded in (not invented)

Before laying out pages, here's what's actually live in Postgres today, per the Master Overview build log, so every page below maps to a real table/entity rather than a guess:

| Real entity | Scope | Source |
|---|---|---|
| `tenant_tracked_companies` | Per-tenant | Part 10.6 |
| `raw_signals`, `consolidated_events`, `noise_suppression_decisions`, `event_signals` | Shared/global | Part 9.1, 9.2 |
| `findings` (fact_confidence lives on shared event; inference_confidence + why_it_matters per-tenant) | Split shared/per-tenant | Part 10.6 |
| `briefs` (`data_latest`, `published_latest`, dated historical) | Per-tenant post-restructure | Part 9.1, 10.9 |
| `research_items` | Shared/global | Part 11.1 |
| `tenant_research_topics`, `research_radar_evaluations` | Per-tenant | Part 11.1 |
| Discovery candidates/proposals | Per-tenant, pre-confirmation | Part 7.1, 10.9 |
| `tenant_delivery_configs` (Slack today) | Per-tenant | Part 10.3 |
| Currently tracked companies, live | Vercel, Netlify, Cloudflare Pages/Workers, Stripe | Part 10.9 |
| Signal-type coverage, live | News, GitHub, Jobs, Pricing, Research (arXiv + blog/RSS) | Parts 7, 10.2 |
| Classifier states, live | Researching / Adopting / Mentioning / No activity detected | Part 11.1 |
| Tiering, live | Must-Know / Should-Know / Nice-to-Know | Part 6.7 |
| Confidence, live | Self-rated (High/Med/Low) + corroboration bump + freshness decay | Part 8.1, 10.1 |

**One open dependency I need from you before Phase D:** I don't yet know the exact shape/scope of the existing read API (Part 10.9 confirms API-level auth exists on *a* read API, but not which endpoints). Phase A below defines what each page *needs* to fetch — we'll reconcile that against the real API surface before implementation, and flag any gap as new backend work rather than assume it exists.

**What's explicitly NOT live yet, so these pages are spec'd as disabled/coming-soon states, never faked:**
- Trend Evolution Timeline (blocked on accumulating history — Part 9.9)
- Scenario-based probability trees (same blocker)
- Battle Cards (named, not built — Part 10.8)
- Topic-suggestion generation (deferred by design — Part 11.0)
- Opportunity Discovery (Stage 4, not started)

---

## 1. Full sitemap

### A. Marketing site (public, unauthenticated)

```
/                      Home
/product               Product overview
/how-it-works          Pipeline explained (outcomes, not architecture)
/evidence              Evidence & methodology (the grounding/eval story)
/about                 About / project
/sign-in               Sign in
/sign-up               Create workspace → routes into Onboarding
```

### B. Onboarding (authenticated, first-run only)

```
/onboarding/company        Step 1 — target company
/onboarding/competitors    Step 2 — Discovery Agent review/confirm
/onboarding/topics         Step 3 — Research Radar topics (optional, skippable)
/onboarding/done           Step 4 — summary → Overview
```

### C. Product app (authenticated, tenant-scoped)

```
/app                             Overview  (home)
/app/brief                       Brief  (current + historical list)
/app/brief/[briefId]              — single historical brief
/app/signals                     Signals stream
/app/events                      Events (consolidated)
/app/events/[eventId]              — single event detail
/app/trends                      Trends (Synthesis Agent output)
/app/research-radar              Research Radar overview
/app/research-radar/[topicId]      — single topic detail
/app/competitors                 Competitors list
/app/competitors/[companyId]       — single competitor profile
/app/compare                     Competitor comparison (2–3 selected)
/app/workspace/watchlist         Tracked companies management
/app/workspace/topics            Research topic management
/app/workspace/delivery          Delivery config (Slack, future email)
/app/workspace/settings          Account/tenant settings
```

Battle Cards, Trend Evolution, Scenario trees: **routes reserved, not built.** They render a "Not yet available — needs more history / design pass" state if hit directly, never a fake preview.

---

## 2. Navigation structure

```
PRISMIQ
────────────────
Overview

INTELLIGENCE
  Brief
  Signals
  Events
  Trends
  Research Radar

COMPETITIVE
  Competitors
  Compare

WORKSPACE
  Watchlist
  Topics
  Delivery
  Settings
```

No backend/architecture terms anywhere in nav or page copy — no "Monitoring Agent," "LangGraph," "Synthesis Agent," etc. Product-facing language only (e.g., "Trends" not "Synthesis Agent output," even though that's literally what populates it).

---

## 3. Page-by-page specification

Each page below: **Primary question → Data source → Core components → States → Permissions → Responsive notes.**

### 3.1 Overview (`/app`)

**Primary question:** What should I know right now?

**Data source:** Latest `data_latest` brief (per-tenant) + rolled-up `findings` tiering + `research_radar_evaluations` state changes + tracked-company list.

**Core components:**
- "What matters now" — Must-Know findings from the latest brief cycle only (not full history), each with why-it-matters, evidence count, confidence.
- "Competitive pulse" — one directional indicator per tracked company, computed from real signal volume/tier mix over the trailing period (not an invented sentiment score).
- "Emerging in the field" — condensed Research Radar summary: topic name, new-development count, competitor-connection count since last view.
- "Recent events" — last N consolidated events, chronological.

**States:**
- *Empty (new tenant, zero data yet):* explicit "Your first monitoring cycle hasn't run yet" message with expected next-run time, not a blank dashboard.
- *Loading:* skeleton cards, no spinner-only screens.
- *Error (brief fetch fails):* explicit error with retry, never silently show stale data without a timestamp/staleness label.

**Permissions:** Tenant-scoped throughout (RLS via JWT context per Part 10.9). No cross-tenant leakage possible even on error.

**Responsive:** Sidebar collapses to bottom nav on mobile; "What matters now" cards stack full-width; "Competitive pulse" becomes a horizontal scroll strip.

---

### 3.2 Brief (`/app/brief`, `/app/brief/[briefId]`)

**Primary question:** What are the most important developments this period, in order?

**Data source:** `briefs` table — `data_latest` for current, dated historical rows for the list/detail view.

**Core components:**
- Top 3 Decisions This Informs (header, always present per Part 2.7's original DoD).
- Executive summary rollup (tier counts, per-company breakdown — Part 6.7's deterministic rollup, not LLM-generated).
- Must-Know / Should-Know / Other Activity, visually distinct weight (not equal-sized cards — directly reflects the tiering logic).
- Historical brief list, dated, selectable.

**States:**
- *Empty:* no briefs yet → same first-cycle message as Overview.
- *Partial (a source failed that cycle):* explicit disclosure banner ("News source unavailable this cycle" — matches Part 9.4's Decision Point 1 behavior) rather than silently thinner content.
- *Loading / Error:* as above.

**Permissions:** Tenant-scoped.

**Responsive:** Tiered sections stack; historical list becomes a dropdown/sheet on mobile instead of a sidebar list.

---

### 3.3 Signals (`/app/signals`)

**Primary question:** What individual signals were detected?

**Data source:** `raw_signals` (shared) filtered/joined to `findings` (per-tenant) for why-it-matters + confidence.

**Core components:**
- Filter bar: Company, Signal type (News/GitHub/Jobs/Pricing/Research), Tier, Freshness, Confidence.
- Signal row: type badge, headline, company, relative time, why-it-matters, confidence badge, corroboration count → links to Evidence drawer (3.9).

**States:**
- *Empty (filtered to zero results):* "No signals match these filters" with a clear-filters action — never hide the filter bar.
- *Noise-suppressed disclosure:* a small, honest counter ("N low-value signals suppressed this period") rather than pretending suppression doesn't happen — matches Part 8.2's transparency stance.

**Permissions:** Tenant-scoped read of the shared `raw_signals` table joined against the tenant's own `findings`.

**Responsive:** Filters collapse into a sheet/drawer on mobile; rows become stacked cards.

---

### 3.4 Events (`/app/events`, `/app/events/[eventId]`)

**Primary question:** What real-world events happened, and what's the evidence behind each one?

**Data source:** `consolidated_events` + `event_signals` (the signal-to-event links) + `findings`.

**Core components:**
- List view: one row per consolidated event, with a signal-count badge (e.g., "3 sources").
- Detail view: **visual consolidation tree** — root event at top, branching to each contributing signal (News / GitHub / blog / etc.), literally showing the event-first-consolidation mechanism (Part 7.2) without naming it.
- Confidence badge (fact_confidence, shared) distinct from why-it-matters (per-tenant inference).

**States:**
- *Single-signal event:* tree renders with one branch — don't force a fake multi-branch look.
- *Empty/Error:* standard.

**Permissions:** Shared event data, tenant-scoped findings overlay.

**Responsive:** Tree view rotates to a vertical stacked list on narrow viewports (branching diagrams don't survive mobile width).

---

### 3.5 Trends (`/app/trends`)

**Primary question:** What patterns are emerging across competitors?

**Data source:** Synthesis Agent output — pattern records with theme, involved companies, related event count, corroboration.

**Core components:**
- Pattern cards grouped by theme (Product & Platform Development, Pricing & Packaging, Talent & Organization, Security & Reliability, Market Positioning & Partnerships) — theme-based, never competitor-by-competitor, per the article-driven rule in Part 3/8.1.
- Per-pattern: involved-company indicator (relative bar/dot density is fine; no invented percentage precision), why-this-matters, linked evidence (events).

**States:**
- *No pattern this cycle:* explicit "No cross-competitor pattern detected this period" — matches Part 8.1's real "4 correct-no-pattern" outcomes; never force a pattern to exist.
- *Trend Evolution section:* **disabled/reserved state only** — "Requires more historical data — check back as monitoring continues" — never a fabricated timeline. This directly enforces Section 8's "don't fake the timeline now" rule.

**Permissions:** Tenant-scoped (per-tenant Synthesis Agent output runs on tenant's own tracked companies).

**Responsive:** Cards stack; theme grouping becomes an accordion.

---

### 3.6 Research Radar (`/app/research-radar`, `/app/research-radar/[topicId]`)

**Primary question:** What's emerging in the field, and are our tracked competitors engaging with it?

**Data source:** `tenant_research_topics` + `research_items` (shared) + `research_radar_evaluations` (per-tenant).

**Core components:**
- Topic cards: name, new-development count, competitor-connection count.
- Per-topic detail: items grouped by the four real classifier states — **Researching / Adopting / Mentioning / No activity detected** — using those exact labels, since they're real classifier outputs, not UI copy invented for this spec.
- Every "No activity detected" item shows which sources were actually checked (audited-absence requirement from Part 11.1) — this is a trust-building detail, not optional.
- Verified-source excerpts visible per item (the project's own grounding fixes in Part 11.2 depend on real quoted excerpts, not just links — surface that in the UI).

**Explicit non-goals enforced in this page:** no free-text query box, no chat interface, no "ask PrismIQ" affordance anywhere on this page or its children — per Part 11.0's explicit rejection of the standalone search-engine fork.

**States:**
- *No `adopting` example for a topic yet:* don't force one — show only the states that have real occurrences (Part 11.4's disclosed limitation — "WASM at the edge" and "Edge database consistency" currently have no real `adopting` example).
- *Empty (no topics configured):* prompt to add a topic, link to `/app/workspace/topics`.

**Permissions:** Topics and evaluations are tenant-scoped; underlying `research_items` are shared/deduplicated.

**Responsive:** State-grouped sections stack; excerpt/evidence expands inline rather than in a modal on mobile.

---

### 3.7 Competitors (`/app/competitors`, `/app/competitors/[companyId]`)

**Primary question:** What is each competitor doing?

**Data source:** Tenant's `tenant_tracked_companies` + rolled-up `findings`/`consolidated_events` per company.

**Core components:**
- List: tracked companies only (from real onboarding/watchlist selection — never the full shared company registry).
- Profile: recent movement grouped by real category (Product, Security, Hiring, Pricing) — using actual signal-type/tier data, not an invented "position summary."
- Signal-activity indicator: relative volume, computed from real counts — **no invented 0–100 "threat score."**

**States:**
- *Company with real but currently zero signals (e.g., Netlify some weeks per Part 7.3a):* show "No new activity this period" plainly — matches the project's own precedent of reporting genuine zeros.

**Permissions:** Tenant-scoped watchlist.

**Responsive:** Profile sections stack; comparison launches from here into `/app/compare`.

---

### 3.8 Compare (`/app/compare`)

**Primary question:** How do 2–3 selected competitors differ on dimensions we actually track?

**Data source:** Same as Competitors, pivoted.

**Core components:** Comparison table using only real tracked dimensions (Product movement, Hiring, Pricing, Security, Research/AI activity) with directional indicators (↑ → ↓) derived from real signal deltas — **not a numeric scorecard**, per Section 7's explicit warning against inventing quantitative UX from qualitative data.

**States:** Requires ≥2 companies selected; empty state prompts selection.

**Permissions:** Tenant-scoped.

**Responsive:** Table becomes a per-company stacked card set below tablet width.

---

### 3.9 Evidence drawer (cross-cutting component, not a standalone page)

**Primary question:** Why should I trust this specific claim?

Appears from any finding/event/research-item across Signals, Events, Brief, Trends, Research Radar. Not a separate route — a slide-over/drawer.

**Core components:**
- FACT section (documented, confident language) vs INFERENCE section (hedged, clearly marked) — directly reflects the Part 6.3 fact/inference separation fix.
- Confidence badge with a plain-language explanation of *why* (self-rated vs. corroboration-boosted vs. freshness-decayed — Part 10.1), not just a color.
- Source list, each a real, clickable, resolvable link — given Part 11.2's fabricated-citation incidents, this drawer should visibly fail loud (not silently drop) if a source link doesn't resolve, rather than ever display an unverified citation as if it were fine.

**States:** A source that fails to resolve is shown as flagged/broken, never hidden.

---

### 3.10 Onboarding (`/onboarding/*`)

**Step 1 — Company:** single input, submits to Discovery Agent.
**Step 2 — Competitors:** ranked candidates with source grounding shown per candidate; multi-select confirm/edit; **zero auto-write** until explicit confirm (Part 2.6/10.9's mandatory human gate — this must never be bypassable in the UI, matching the backend's own "no auto-approval path at any confidence level").
**Step 3 — Topics (optional/skippable):** manual topic entry only — no suggested-topics UI, since topic-suggestion generation is explicitly deferred (Part 11.0).
**Step 4 — Done:** real summary counts (N competitors confirmed, N topics added), link to Overview.

**States:** Step 2 must handle a real disclosed Discovery Agent limitation gracefully — e.g., a company with poor comparison-source coverage (per Part 10.9's PostHog finding) may return fewer/lower-confidence candidates; the UI should show candidate confidence plainly rather than implying uniform certainty.

---

### 3.11 Workspace (`/app/workspace/*`)

**Watchlist:** add/remove tracked companies (re-invokes Discovery Agent for a new company, same confirm gate as onboarding).
**Topics:** add/pause/remove research topics (matches the real pause-not-delete pattern used operationally in Part 10.9 for auditability — pausing a topic should preserve, not delete, its evaluation history).
**Delivery:** Slack webhook config live; email shown as a real disabled "Coming soon" row (Resend tier was verified but not built — Part 10.3), never a fake toggle that does nothing.
**Settings:** account/tenant-level settings only.

**Permissions:** All tenant-scoped, all writes go through the same RLS-enforced JWT-context pattern as reads (Part 10.9).

---

## 4. Global states framework (applies everywhere)

| State | Rule |
|---|---|
| Loading | Skeleton UI matching real layout, never a blank screen or spinner-only |
| Empty (genuinely no data) | Explicit, specific copy — never a generic "nothing here" |
| Partial (a source/step failed this cycle) | Disclosed inline, matching the pipeline's own "disclose the gap" norm (Part 9.4) — never silently thinner |
| Error | Explicit, with retry where retry is meaningful; never fail silently into stale-looking-fresh content |
| Not-yet-available (Trend Evolution, Scenario trees, Battle Cards) | Explicit "needs more data / not built yet" state — never a mock preview implying it works |
| Cross-tenant boundary | A blocked/nonexistent resource returns identically (mirrors the backend's own 404-not-403 design, Part 10.9) — the UI should never differentiate "not yours" from "doesn't exist" |

---

## 5. User journeys (primary flows to validate in Phase C)

1. **New tenant, first login** → Onboarding (company → competitor confirm → topics → done) → Overview showing the "first cycle hasn't run yet" state.
2. **Daily check-in** → Overview → drill into one Must-Know finding → Evidence drawer → back to Overview.
3. **Weekly deep read** → Brief → historical brief comparison → Trends for the same period.
4. **Competitive research** → Competitors → single profile → Compare against 2 others.
5. **Field awareness** → Research Radar → topic detail → filter to "Adopting" state only → Evidence drawer on one item.
6. **Workspace management** → add a new tracked company → Discovery Agent confirm gate → Watchlist updated → next cycle picks it up.

---

## 6. Responsive/permissions summary

- **Desktop-first for the app** (dense, table/timeline-heavy pages), **mobile-adapted, not mobile-shrunk** — bottom/slide nav, vertical priority stacking, drawers instead of side panels.
- **Marketing site is fully responsive from the start** (it's the first-impression surface).
- **Every per-tenant fetch assumes RLS + JWT context** per Part 10.9 — no page design should assume a service-role bypass exists, since that's the exact class of bug the project already closed once (Part 10.4's incident).

---

## Open items before Phase B (visual design system)

1. **API surface reconciliation** — confirm which of the fetches implied above already have a live endpoint vs. need new backend work (flagged in Section 0).
2. **Design references** — deferred per your last answer; will request before Phase B starts.
3. **Confirm scope for v1 build** — do we build all pages in this spec for the first release, or a smaller slice (e.g., Overview + Brief + Signals + Events first, Research Radar/Compare/Workspace second)?
