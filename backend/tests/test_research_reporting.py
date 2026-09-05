from src import report_agent


def test_research_reporting_active_findings():
    """
    Case 1: When current cycle has active research findings,
    renders the Research Activity section with paper/write-up details.
    """
    findings = [
        {
            "event_id": "evt_res_01",
            "company": "Cloudflare Pages/Workers",
            "title": "How we saved 100 terabytes of memory by optimizing 1.1.1.1's DNS cache",
            "url": "https://blog.cloudflare.com/dns-cache-memory-optimization-1111/",
            "source": "research",
            "source_subtype": "research",
            "published_at": "2026-08-25",
            "why_it_matters": "Cloudflare achieved 56% memory footprint reduction using Rust layout optimizations.",
            "confidence": "High",
            "fact_confidence": "High",
            "inference_confidence": "High",
            "corroboration_count": 1,
            "contributing_sources": ["research"],
            "research_details": {
                "type": "technical_writeup",
                "indicators": ["rust-level", "memory optimization"],
            },
        }
    ]

    report = report_agent.run(findings)
    assert "## Research Activity (Papers & Technical Write-ups)" in report
    assert "How we saved 100 terabytes of memory" in report
    assert "Technical Engineering Deep-Dive" in report
    assert "Cloudflare Pages/Workers" in report


def test_research_reporting_consecutive_zero_suppresses_section():
    """
    Case 2: When current cycle has zero research findings AND prior cycle also had zero,
    the Research Activity section must be completely suppressed.
    """
    findings = [
        {
            "event_id": "evt_routine_01",
            "company": "Vercel",
            "title": "Minor styling update on dashboard",
            "url": "https://vercel.com/changelog/styling",
            "source": "news",
            "published_at": "2026-08-25",
            "why_it_matters": "Routine UI polish.",
            "confidence": "Low",
            "fact_confidence": "Low",
            "inference_confidence": "Low",
            "corroboration_count": 1,
            "contributing_sources": ["news"],
        }
    ]

    # Prior research activity is explicitly None (consecutive zero)
    report = report_agent.run(findings, prior_research_activity=None)
    assert "## Research Activity (Papers & Technical Write-ups)" not in report
    assert "no new research activity" not in report.lower()


def test_research_reporting_transition_note_when_prior_cycle_had_findings():
    """
    Case 3: When current cycle has zero research findings BUT prior cycle had findings,
    shows a brief transition note referencing the last finding and date.
    """
    findings = [
        {
            "event_id": "evt_routine_01",
            "company": "Vercel",
            "title": "Minor styling update on dashboard",
            "url": "https://vercel.com/changelog/styling",
            "source": "news",
            "published_at": "2026-08-25",
            "why_it_matters": "Routine UI polish.",
            "confidence": "Low",
            "fact_confidence": "Low",
            "inference_confidence": "Low",
            "corroboration_count": 1,
            "contributing_sources": ["news"],
        }
    ]

    prior_activity = {
        "title": "Introducing Meerkat: an experiment in global consensus",
        "company": "Cloudflare Pages/Workers",
        "published_at": "2026-08-20",
        "url": "https://blog.cloudflare.com/meerkat-introduction/",
    }

    report = report_agent.run(findings, prior_research_activity=prior_activity)
    assert "## Research Activity (Papers & Technical Write-ups)" in report
    assert "No new research activity detected this cycle" in report
    assert "Introducing Meerkat: an experiment in global consensus" in report
    assert "2026-08-20" in report


def test_research_source_failure_disclosed_in_health_not_conflated():
    """
    Case 4: Source failure is reported in Pipeline Execution & Data Coverage,
    and not silently conflated with zero activity.
    """
    findings = []
    source_health = {
        "research": {
            "source": "research",
            "status": "failed",
            "attempts": 2,
            "error": "HTTPSConnectionPool: Connection timed out",
            "fallback": "continued pipeline without research",
        }
    }

    report = report_agent.run(findings, source_health=source_health, prior_research_activity=None)
    assert "⚠️ **Source Alert**: `research` source unavailable this cycle" in report
    assert "HTTPSConnectionPool: Connection timed out" in report
    # Section itself is suppressed, while the failure is explicitly disclosed
    assert "## Research Activity (Papers & Technical Write-ups)" not in report
