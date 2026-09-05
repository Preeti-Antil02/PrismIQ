from datetime import datetime, timezone
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

import pytest
from src import report_agent


def test_assign_finding_tier():
    # 1. Must-know: High-stakes security disclosure (score >= 3.0)
    security_finding = {
        "source": "news",
        "company": "Cloudflare Workers",
        "title": "Spectre side-channel vulnerability leaks JWT secrets",
        "url": "https://threatpost.example.com/cloudflare-spectre",
        "published_at": "2026-08-21T12:00:00Z",
        "raw_excerpt": "Security flaw disclosed in Workers isolate runtime.",
        "why_it_matters": "Discloses critical vulnerability in tenant isolation.",
        "confidence": "Medium",
    }
    assert report_agent._assign_finding_tier(security_finding) == "must_know"

    # 2. Must-know: Strategic / monetization shift (score >= 3.0)
    strategic_finding = {
        "source": "news",
        "company": "Vercel",
        "title": "Vercel Announces Kitesurf Agent Browser Engine",
        "url": "https://infoq.example.com/kitesurf",
        "published_at": "2026-08-22T10:00:00Z",
        "raw_excerpt": "Launches agentic browser runtime.",
        "why_it_matters": "Enters agentic browser runtime ecosystem.",
        "confidence": "High",
    }
    assert report_agent._assign_finding_tier(strategic_finding) == "must_know"

    # 3. Should-know: Substantive product release or issue (1.5 <= score < 3.0)
    product_finding = {
        "source": "github",
        "company": "Netlify",
        "title": "GitHub Release in netlify/build: v2.0.0",
        "url": "https://github.com/netlify/build/releases/v2.0.0",
        "published_at": "2026-08-21T14:00:00Z",
        "raw_excerpt": "Added bundler performance optimizations.",
        "why_it_matters": "Improves build performance for developers.",
        "confidence": "Medium",
    }
    assert report_agent._assign_finding_tier(product_finding) == "should_know"

    # 4. Should-know: Real changelog feature announcement (Changelog penalty NOT applied to tiering)
    changelog_finding = {
        "source": "news",
        "company": "Vercel",
        "title": "Always-on tracing for production and preview traffic - Vercel",
        "url": "https://vercel.com/changelog/always-on-tracing-for-production-and-preview-traffic",
        "published_at": "2026-08-21 00:00:00 +0000",
        "raw_excerpt": "Observability sampling for preview environments.",
        "why_it_matters": "Adds built-in observability for preview requests.",
        "confidence": "High",
    }
    assert report_agent._assign_finding_tier(changelog_finding) == "should_know"

    # 5. Nice-to-know: Low-information aggregated WatchEvent
    watch_finding = {
        "source": "github",
        "company": "Cloudflare Pages",
        "title": "10 users started watching cloudflare/cloudflare-os this week",
        "url": "https://github.com/cloudflare/cloudflare-os",
        "published_at": "2026-08-22T19:35:30Z",
        "raw_excerpt": "10 developer(s) starred/watched repository cloudflare/cloudflare-os.",
        "why_it_matters": "Activity reported in repository.",
        "confidence": "Low",
    }
    assert report_agent._assign_finding_tier(watch_finding) == "nice_to_know"

    # 6. Nice-to-know: Low-information aggregated ForkEvent
    fork_finding = {
        "source": "github",
        "company": "Netlify",
        "title": "2 users forked netlify/build this week",
        "url": "https://github.com/netlify/build",
        "published_at": "2026-08-22T20:00:00Z",
        "raw_excerpt": "2 new fork(s) created for repository.",
        "why_it_matters": "Activity reported in repository.",
        "confidence": "Low",
    }
    assert report_agent._assign_finding_tier(fork_finding) == "nice_to_know"


def test_changelog_penalty_applies_to_top3_but_not_tiering():
    """
    Verify the fix for Problem 1:
    A routine changelog finding gets penalized in Top-3 decision ranking
    (apply_changelog_penalty=True), but is NOT penalized for tier assignment
    (apply_changelog_penalty=False), correctly flooring at Should-Know.
    """
    changelog_finding = {
        "source": "news",
        "company": "Vercel",
        "title": "Connect v0 apps to Slack, Google, and 100+ other services - Vercel",
        "url": "https://vercel.com/changelog/connect-v0-apps-to-slack-google-and-100-other-services",
        "published_at": "2026-08-21 00:00:00 +0000",
        "raw_excerpt": "Enables OAuth connections for v0 apps.",
        "why_it_matters": "Expands integration ecosystem for v0 generative apps.",
        "confidence": "High",
    }

    # Top-3 decision score includes penalty: 2.0 (High) - 1.0 (changelog) = 1.0
    top3_score = report_agent._calculate_decision_score(changelog_finding, apply_changelog_penalty=True)
    assert top3_score == 1.0

    # Tier assignment score excludes penalty: 2.0 (High) -> lands in Should-Know
    tier = report_agent._assign_finding_tier(changelog_finding)
    assert tier == "should_know"


def test_report_agent_tiered_structure_and_url_inclusion():
    findings = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Launches AI Agent Readiness Scoreboard",
            "url": "https://dev.to/vercel/agentic-scoreboard",
            "published_at": "2026-08-20T10:00:00Z",
            "raw_excerpt": "Public benchmark for AI agent readiness.",
            "why_it_matters": "Strategic move to lead the emerging agentic web ecosystem.",
            "confidence": "High",
        },
        {
            "source": "github",
            "company": "Vercel",
            "title": "GitHub Release in vercel/next.js: v15.2.0",
            "url": "https://github.com/vercel/next.js/releases/v15.2.0",
            "published_at": "2026-08-21T14:00:00Z",
            "raw_excerpt": "Added support for React 19 canary.",
            "why_it_matters": "Maintains framework leadership and ecosystem compatibility.",
            "confidence": "Medium",
        },
        {
            "source": "github",
            "company": "Vercel",
            "title": "1 user started watching vercel/nft this week",
            "url": "https://github.com/vercel/nft",
            "published_at": "2026-08-22T08:00:00Z",
            "raw_excerpt": "1 developer(s) starred/watched repository.",
            "why_it_matters": "Activity reported in repository.",
            "confidence": "Low",
        },
    ]

    report = report_agent.run(findings)

    assert isinstance(report, str)
    # 1. Top 3 decisions header exists
    assert "## Top 3 decisions this informs" in report

    # 2. Executive summary theme rollup exists
    assert "## Executive Summary & Theme Synthesis Rollup" in report

    # 3. Theme & side-by-side company header exists
    assert "## Strategic Themes & Cross-Competitor Analysis" in report
    assert "### Theme: Product & Platform Development" in report
    assert "#### Vercel" in report

    # 4. Must-Know, Should-Know, and Other Activity sections exist
    assert "##### Must-Know" in report
    assert "##### Should-Know" in report
    assert "##### Other Activity (1 items)" in report

    # 5. Every single finding URL appears in the report (DoD #2)
    for finding in findings:
        assert finding["url"] in report

    # 6. Must-know and Should-know contain why_it_matters
    assert "Strategic move to lead the emerging agentic web ecosystem." in report
    assert "Maintains framework leadership and ecosystem compatibility." in report


def test_executive_summary_rollup_counts_match():
    """Verify the Executive Summary rollup accurately calculates tier numbers."""
    findings = [
        {
            "source": "news",
            "company": "Cloudflare Workers",
            "title": "Spectre side-channel vulnerability",
            "url": "https://news.example.com/cf-spectre",
            "published_at": "2026-08-21T10:00:00Z",
            "raw_excerpt": "Security vulnerability in isolate runtime.",
            "why_it_matters": "Vulnerability discloses credentials.",
            "confidence": "High",
        },
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel CLI update",
            "url": "https://vercel.com/changelog/cli-update",
            "published_at": "2026-08-21T11:00:00Z",
            "raw_excerpt": "CLI update for domains.",
            "why_it_matters": "Updates CLI domain commands.",
            "confidence": "High",
        },
        {
            "source": "github",
            "company": "Vercel",
            "title": "1 user started watching vercel/nft this week",
            "url": "https://github.com/vercel/nft",
            "published_at": "2026-08-22T08:00:00Z",
            "raw_excerpt": "1 user watched.",
            "why_it_matters": "Activity.",
            "confidence": "Low",
        },
    ]

    report = report_agent.run(findings)

    assert "## Executive Summary & Theme Synthesis Rollup" in report
    assert "3 consolidated events synthesized across 5 strategic themes." in report
    assert "## Per-Competitor Index" in report
    assert "### Vercel" in report
    assert "### Cloudflare Workers" in report


def test_top_3_prioritizes_competitor_vulnerability_over_routine_changelogs():
    """
    Verify Top 3 ranking behavior is preserved after Section 2.7 tiering:
    A competitor security vulnerability must be prioritized into Top 3 decisions.
    """
    findings = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Always-on tracing for production and preview traffic",
            "url": "https://vercel.com/changelog/always-on-tracing",
            "published_at": "2026-08-21 00:00:00 +0000",
            "raw_excerpt": "Observability sampling for preview environments.",
            "why_it_matters": "Adds built-in observability for preview requests.",
            "confidence": "High",
        },
        {
            "source": "news",
            "company": "Vercel",
            "title": "Manage Vercel Toolbar comments from the CLI",
            "url": "https://vercel.com/changelog/manage-vercel-toolbar-comments-from-the-cli",
            "published_at": "2026-08-20 18:03:00 +0000",
            "raw_excerpt": "Manage comments directly from terminal.",
            "why_it_matters": "Enables CLI-based toolbar comment management.",
            "confidence": "High",
        },
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel CLI expands support for DNS and domains",
            "url": "https://vercel.com/changelog/vercel-cli-expands-support-for-dns-domains",
            "published_at": "2026-08-21 00:00:00 +0000",
            "raw_excerpt": "Scriptable DNS commands.",
            "why_it_matters": "Extends CLI infrastructure commands.",
            "confidence": "High",
        },
        {
            "source": "news",
            "company": "Cloudflare Workers",
            "title": "Spectre side-channel vulnerability leaks JWT secrets in Cloudflare Workers",
            "url": "https://threatpost.example.com/cloudflare-workers-spectre-vulnerability",
            "published_at": "2026-08-21 12:00:00 +0000",
            "raw_excerpt": "Security researchers demonstrate cross-isolate memory read exploit in Cloudflare Workers.",
            "why_it_matters": "Critical security vulnerability discloses tenant isolation flaw, creating major competitive risk for Cloudflare and an enterprise migration opportunity for Vercel.",
            "confidence": "Medium",
        },
    ]

    report = report_agent.run(findings)

    # Extract Top 3 section
    top_3_section = report.split("## Findings by Company")[0]

    # The competitor security vulnerability MUST be present in Top 3
    assert "Cloudflare Workers" in top_3_section
    assert "Spectre side-channel vulnerability" in top_3_section


def test_top_3_draws_from_multiple_companies():
    """Test that Top 3 includes diverse companies when multiple qualifying items exist."""
    findings = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Monetizes Deployment Storage with Retention Controls",
            "url": "https://vercel.com/changelog/deployment-storage",
            "published_at": "2026-08-21 14:50:40 +0000",
            "raw_excerpt": "Vercel introduces new pricing charge for rollback storage.",
            "why_it_matters": "Directly impacts customer hosting costs through storage monetization.",
            "confidence": "High",
        },
        {
            "source": "news",
            "company": "Netlify",
            "title": "Netlify CTO Dana Lawson Unveils Proprietary Git Infrastructure",
            "url": "https://www.netlify.com/blog/netlify-source",
            "published_at": "2026-08-17 14:47:27 +0000",
            "raw_excerpt": "Netlify launches built-in version control infrastructure with AI-assisted workflows.",
            "why_it_matters": "Major strategic push to unseat external Git providers and reshape developer CI/CD workflows.",
            "confidence": "High",
        },
        {
            "source": "news",
            "company": "Cloudflare Pages",
            "title": "Cloudflare Kitesurf Agent Browser Engine Announcement",
            "url": "https://www.infoq.com/news/2026/08/cloudflare-kitesurf-browser",
            "published_at": "2026-08-22 15:01:00 +0000",
            "raw_excerpt": "Cloudflare unveils new headless browser runtime for AI agents.",
            "why_it_matters": "Enters AI agent execution runtime market, competing directly with modern cloud runtimes.",
            "confidence": "High",
        },
    ]

    report = report_agent.run(findings)
    top_3_section = report.split("## Findings by Company")[0]

    # All 3 companies must appear in the top 3
    assert "**Vercel**" in top_3_section
    assert "**Netlify**" in top_3_section
    assert "**Cloudflare Pages**" in top_3_section


def test_report_agent_empty_findings():
    report = report_agent.run([])
    assert isinstance(report, str)
    assert "## Top 3 decisions this informs" in report
    assert "## Strategic Themes & Cross-Competitor Analysis" in report


def test_freshness_decay_multiplier_math():
    """Verify decay multiplier values at Day 0, 1, 3, 7, 14 with 3.0-day half-life."""
    ref_time = datetime(2026, 9, 4, 12, 0, 0, tzinfo=timezone.utc)
    
    # Day 0 (0 hours old) -> 1.000
    f0 = {"published_at": "2026-09-04T12:00:00Z"}
    assert pytest.approx(report_agent.calculate_freshness_decay_multiplier(f0, reference_time=ref_time), 0.001) == 1.000
    assert report_agent.format_freshness_label(f0, reference_time=ref_time) == "New today"

    # Day 1 (24 hours old) -> ~0.794
    f1 = {"published_at": "2026-09-03T12:00:00Z"}
    assert pytest.approx(report_agent.calculate_freshness_decay_multiplier(f1, reference_time=ref_time), 0.001) == 0.794
    assert report_agent.format_freshness_label(f1, reference_time=ref_time) == "1 day old"

    # Day 3 (72 hours old) -> 0.500 (Half-Life)
    f3 = {"published_at": "2026-09-01T12:00:00Z"}
    assert pytest.approx(report_agent.calculate_freshness_decay_multiplier(f3, reference_time=ref_time), 0.001) == 0.500
    assert report_agent.format_freshness_label(f3, reference_time=ref_time) == "3 days old"

    # Day 7 (168 hours old) -> ~0.198
    f7 = {"published_at": "2026-08-28T12:00:00Z"}
    assert pytest.approx(report_agent.calculate_freshness_decay_multiplier(f7, reference_time=ref_time), abs=1e-3) == 0.198
    assert report_agent.format_freshness_label(f7, reference_time=ref_time) == "7 days old"

    # Day 14 (336 hours old) -> ~0.039
    f14 = {"published_at": "2026-08-21T12:00:00Z"}
    assert pytest.approx(report_agent.calculate_freshness_decay_multiplier(f14, reference_time=ref_time), abs=1e-3) == 0.039
    assert report_agent.format_freshness_label(f14, reference_time=ref_time) == "14 days old"

    # Undated / Historical event (FAIL CLOSED fallback 14 days) -> ~0.039
    f_undated = {"published_at": None, "published_timestamp": None}
    assert pytest.approx(report_agent.calculate_freshness_decay_multiplier(f_undated, reference_time=ref_time), abs=1e-3) == 0.039
    assert report_agent.format_freshness_label(f_undated, reference_time=ref_time) == "Historical / Undated"


def test_part_6_7_vercel_launches_regression_check():
    """
    MANDATORY REGRESSION CHECK:
    Verify that the exact original Vercel changelog product launches from Part 6.7 maintain
    their Should-Know tier assignment under decay-adjusted scoring.
    """
    ref_time = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

    # 1. Original Part 6.7 Finding: Always-on tracing
    tracing_launch = {
        "source": "news",
        "company": "Vercel",
        "title": "Always-on tracing for production and preview traffic - Vercel",
        "url": "https://vercel.com/changelog/always-on-tracing-for-production-and-preview-traffic",
        "published_at": "2026-08-21 00:00:00 +0000",
        "raw_excerpt": "Observability sampling for preview environments.",
        "why_it_matters": "Adds built-in observability for preview requests.",
        "confidence": "High",
    }

    # 2. Original Part 6.7 Finding: Connect v0 apps
    v0_launch = {
        "source": "news",
        "company": "Vercel",
        "title": "Connect v0 apps to Slack, Google, and 100+ other services - Vercel",
        "url": "https://vercel.com/changelog/connect-v0-apps-to-slack-google-and-100-other-services",
        "published_at": "2026-08-21 00:00:00 +0000",
        "raw_excerpt": "Enables OAuth connections for v0 apps.",
        "why_it_matters": "Expands integration ecosystem for v0 generative apps.",
        "confidence": "High",
    }

    # 3. Product Launch: Deploy Eve agents from dashboard
    eve_launch = {
        "source": "news",
        "company": "Vercel",
        "title": "Build and deploy eve agents from the Vercel dashboard - Vercel",
        "url": "https://vercel.com/changelog/build-and-deploy-eve-agents-from-the-vercel-dashboard",
        "published_at": "2026-08-21 00:00:00 +0000",
        "raw_excerpt": "Build and deploy eve agents directly from the dashboard.",
        "why_it_matters": "Extends Vercel native agent hosting capabilities.",
        "confidence": "High",
    }

    # Verify base intrinsic tier without changelog penalty lands in should_know
    assert report_agent._assign_finding_tier(tracing_launch, apply_freshness_decay=False) == "should_know"
    assert report_agent._assign_finding_tier(v0_launch, apply_freshness_decay=False) == "should_know"
    assert report_agent._assign_finding_tier(eve_launch, apply_freshness_decay=False) == "should_know"

    # Verify that even with freshness decay at Day 1 (~24h old in cycle), score (2.0 * 0.794 = 1.59) >= 1.50
    assert report_agent._assign_finding_tier(tracing_launch, apply_freshness_decay=True, reference_time=ref_time) == "should_know"
    assert report_agent._assign_finding_tier(v0_launch, apply_freshness_decay=True, reference_time=ref_time) == "should_know"
    assert report_agent._assign_finding_tier(eve_launch, apply_freshness_decay=True, reference_time=ref_time) == "should_know"

    # Verify changelog penalty still prevents routine changelogs from hijacking Top-3
    top3_tracing = report_agent._calculate_decision_score(tracing_launch, apply_changelog_penalty=True, apply_freshness_decay=False)
    top3_v0 = report_agent._calculate_decision_score(v0_launch, apply_changelog_penalty=True, apply_freshness_decay=False)
    top3_eve = report_agent._calculate_decision_score(eve_launch, apply_changelog_penalty=True, apply_freshness_decay=False)
    assert top3_tracing == 1.0
    assert top3_v0 == 1.0
    assert top3_eve == 1.0
