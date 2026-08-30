import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import synthesis_agent, report_agent


def test_fixed_theme_classification():
    # 1. Pricing
    pricing_finding = {
        "source": "pricing",
        "title": "Pricing Change: Vercel Pro plan changed from $20 to $25",
        "raw_excerpt": "Updated plan pricing.",
    }
    assert synthesis_agent.classify_event_theme(pricing_finding) == synthesis_agent.THEME_PRICING

    # 2. Talent
    job_finding = {
        "source": "jobs",
        "title": "Job Posting: Senior Director of Engineering, Billing Platform",
        "raw_excerpt": "Engineering leadership role.",
    }
    assert synthesis_agent.classify_event_theme(job_finding) == synthesis_agent.THEME_TALENT

    # 3. Funding / Positioning
    funding_finding = {
        "source": "news",
        "funding_related": True,
        "source_subtype": "funding",
        "title": "Netlify raises $105M Series D",
        "raw_excerpt": "Funding round led by Bessemer.",
    }
    assert synthesis_agent.classify_event_theme(funding_finding) == synthesis_agent.THEME_POSITIONING

    # 4. Security & Reliability
    sec_finding = {
        "source": "news",
        "title": "Cloudflare Workers Spectre Attack Leaks JWT",
        "raw_excerpt": "Researchers leak a JWT from a co-located Worker via Spectre vulnerability.",
    }
    assert synthesis_agent.classify_event_theme(sec_finding) == synthesis_agent.THEME_SECURITY

    # 5. Product & Platform Development
    product_finding = {
        "source": "github",
        "title": "GitHub Release in vercel/next.js: v15.2.0",
        "raw_excerpt": "Fixed hydration and server components.",
    }
    assert synthesis_agent.classify_event_theme(product_finding) == synthesis_agent.THEME_PRODUCT


def test_corroboration_confidence_scoring():
    # Multi-Source Independent (High)
    multi_source = {
        "corroboration_count": 2,
        "contributing_sources": ["news", "github"],
    }
    enriched_ms = synthesis_agent.calculate_corroboration_confidence(multi_source)
    assert enriched_ms["corroboration_level"] == "High"
    assert enriched_ms["corroboration_score"] == 3.0

    # Multi-Signal Single-Source (Medium)
    multi_signal = {
        "corroboration_count": 4,
        "contributing_sources": ["github"],
    }
    enriched_sig = synthesis_agent.calculate_corroboration_confidence(multi_signal)
    assert enriched_sig["corroboration_level"] == "Medium"
    assert enriched_sig["corroboration_score"] == 2.0

    # Single-Signal (Single-Source)
    single_signal = {
        "corroboration_count": 1,
        "contributing_sources": ["jobs"],
    }
    enriched_ss = synthesis_agent.calculate_corroboration_confidence(single_signal)
    assert enriched_ss["corroboration_level"] == "Single-Source"
    assert enriched_ss["corroboration_score"] == 1.0


def test_cross_competitor_pattern_detection_true_positive():
    # Simulated true pattern: Vercel & Cloudflare both shipping AI Agent infrastructure
    competitor_findings = {
        "Vercel": [
            {
                "title": "Vercel Launches is-agentic.com AI Agent Readiness Score",
                "raw_excerpt": "Score how ready a website is for automated AI agents.",
                "why_it_matters": "Expands Vercel into agentic infrastructure.",
            }
        ],
        "Cloudflare Pages/Workers": [
            {
                "title": "Cloudflare Announces Kitesurf, a Browser Engine for Agents",
                "raw_excerpt": "Kitesurf runs browser automation workloads for AI agents.",
                "why_it_matters": "Enables edge execution for AI agents.",
            }
        ],
        "Netlify": [],
    }

    result = synthesis_agent.detect_cross_competitor_pattern(
        synthesis_agent.THEME_PRODUCT, competitor_findings
    )
    assert result["pattern_detected"] is True
    assert "AI Agent infrastructure" in result["pattern_claim"]
    assert "Vercel" in result["supporting_evidence"]
    assert "Cloudflare" in result["supporting_evidence"]


def test_cross_competitor_pattern_detection_guardrail_suppression():
    # Case A: Only 1 competitor active in theme
    single_comp_findings = {
        "Cloudflare Pages/Workers": [
            {
                "title": "Job Posting: Senior Director of Engineering, Billing Platform",
                "raw_excerpt": "Director hiring.",
            }
        ],
        "Vercel": [],
        "Netlify": [],
    }
    result_single = synthesis_agent.detect_cross_competitor_pattern(
        synthesis_agent.THEME_TALENT, single_comp_findings
    )
    assert result_single["pattern_detected"] is False
    assert "insufficient cross-competitor data" in result_single["no_pattern_reason"]

    # Case B: Multiple competitors active with non-overlapping, disparate routine releases
    disparate_findings = {
        "Vercel": [
            {"title": "Release in vercel/ms: v2.1.3", "raw_excerpt": "Milliseconds utility bump.", "why_it_matters": ""}
        ],
        "Netlify": [
            {"title": "Release in netlify/zip-it-and-ship-it: v9.41.0", "raw_excerpt": "Zip bundler bump.", "why_it_matters": ""}
        ],
    }
    result_disp = synthesis_agent.detect_cross_competitor_pattern(
        synthesis_agent.THEME_SECURITY, disparate_findings
    )
    assert result_disp["pattern_detected"] is False
    assert "No cross-competitor security pattern detected" in result_disp["no_pattern_reason"]


def test_synthesis_runner_and_report_integration():
    sample_findings = [
        {
            "company": "Vercel",
            "title": "Vercel Launches is-agentic.com",
            "url": "https://is-agentic.com",
            "published_at": "2026-08-22T10:00:00Z",
            "source": "news",
            "corroboration_count": 2,
            "contributing_sources": ["news", "github"],
            "why_it_matters": "Pioneers AI agent site readiness benchmarking.",
            "confidence": "High",
        },
        {
            "company": "Cloudflare Pages/Workers",
            "title": "Cloudflare Announces Kitesurf Browser Engine for Agents",
            "url": "https://cloudflare.com/kitesurf",
            "published_at": "2026-08-22T11:00:00Z",
            "source": "news",
            "corroboration_count": 1,
            "contributing_sources": ["news"],
            "why_it_matters": "Specialized browser engine for AI agent automation.",
            "confidence": "High",
        },
        {
            "company": "Netlify",
            "title": "Job Posting: Software Engineer, Core Build",
            "url": "https://boards.greenhouse.io/netlify/123",
            "published_at": "2026-08-22T12:00:00Z",
            "source": "jobs",
            "corroboration_count": 1,
            "contributing_sources": ["jobs"],
            "why_it_matters": "Routine operational hiring for Software Engineer, Core Build.",
            "confidence": "Low",
        },
    ]

    synthesis_result = synthesis_agent.run(sample_findings)
    assert "themes" in synthesis_result
    assert "competitor_index" in synthesis_result
    assert len(synthesis_result["themes"]) == 5

    # Check that competitor index has all 3 companies
    c_index = synthesis_result["competitor_index"]
    assert "Vercel" in c_index
    assert "Cloudflare Pages/Workers" in c_index
    assert "Netlify" in c_index
    assert c_index["Vercel"]["total_findings"] == 1
    assert synthesis_agent.THEME_PRODUCT in c_index["Vercel"]["active_themes"]
    assert synthesis_agent.THEME_TALENT in c_index["Netlify"]["active_themes"]

    # Generate Markdown Report
    report_md = report_agent.run(synthesis_result)
    assert "# PrismIQ Competitive Intelligence Brief" in report_md
    assert "## Top 3 decisions this informs" in report_md
    assert "## Executive Summary & Theme Synthesis Rollup" in report_md
    assert "### Theme: Product & Platform Development" in report_md
    assert "🔍 **Cross-Competitor Pattern**" in report_md
    assert "## Per-Competitor Index" in report_md
    assert "### Vercel" in report_md
    assert "### Netlify" in report_md
    assert "### Cloudflare Pages/Workers" in report_md
