import sys
from pathlib import Path
from unittest.mock import patch

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import main


def test_full_pipeline_e2e_mocked_custom_paths(tmp_path):
    # Fake raw monitoring data
    fake_news = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Launches Enterprise Microfrontends",
            "url": "https://news.example.com/vercel-microfrontends",
            "published_at": "2026-08-21T10:00:00Z",
            "raw_excerpt": "New microfrontends platform simplifies multi-team web app deployments.",
        }
    ]
    fake_github = [
        {
            "source": "github",
            "company": "Netlify",
            "title": "Netlify SDK Release v3.0",
            "url": "https://github.com/netlify/sdk",
            "published_at": "2026-08-22T11:00:00Z",
            "raw_excerpt": "Updated plugin ecosystem support for modern bundlers.",
        }
    ]

    # Fake Groq analysis responses
    mock_analyses = [
        {
            "why_it_matters": "Directly targets large enterprise frontend architectures, strengthening Vercel's moat.",
            "confidence": "High",
        },
        {
            "why_it_matters": "Improves developer extensibility against competing deployment platforms.",
            "confidence": "Medium",
        },
    ]

    report_out = tmp_path / "test_brief.md"
    signals_out = tmp_path / "test_signals.json"

    def _fake_news_fetch(company, *args, **kwargs):
        return fake_news if company == "Vercel" else []

    def _fake_github_fetch(company, *args, **kwargs):
        return fake_github if company == "Netlify" else []

    with patch("src.monitoring_agent._fetch_news_from_currents", side_effect=_fake_news_fetch), \
         patch("src.monitoring_agent._fetch_github_events", side_effect=_fake_github_fetch), \
         patch("src.monitoring_agent._fetch_jobs", return_value=[]), \
         patch("src.pricing_extractor.fetch_pricing_signals", return_value=[]), \
         patch("src.analysis_agent._call_groq", side_effect=mock_analyses):

        brief_markdown = main.run_pipeline(
            output_report_path=report_out,
            signals_storage_path=signals_out,
        )

        # 1. Pipeline produces non-empty markdown output
        assert isinstance(brief_markdown, str)
        assert len(brief_markdown) > 0

        # 2. Output file was written to disk and matches return value
        assert report_out.exists()
        assert report_out.read_text(encoding="utf-8") == brief_markdown

        # 3. Signals file was written to disk
        assert signals_out.exists()

        # 4. Contains Top 3 decisions header
        assert "## Top 3 decisions this informs" in brief_markdown

        # 5. Contains findings with source links and confidence
        assert "https://news.example.com/vercel-microfrontends" in brief_markdown
        assert "https://github.com/netlify/sdk" in brief_markdown
        assert "High confidence" in brief_markdown or "**Confidence**: High" in brief_markdown
        assert "Medium confidence" in brief_markdown or "**Confidence**: Medium" in brief_markdown
        assert "Vercel Launches Enterprise Microfrontends" in brief_markdown


def test_full_pipeline_e2e_default_timestamped_run(tmp_path, monkeypatch):
    """
    Test real pipeline execution with DEFAULT arguments (output_report_path=None, signals_storage_path=None).
    Verifies that main.py creates BOTH:
    - signals_{timestamp}.json AND signals.json
    - brief_{timestamp}.md AND brief.md
    """
    test_data_dir = tmp_path / "data"
    test_data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(test_data_dir))

    fake_news = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Launches AI Readiness Scoreboard",
            "url": "https://is-agentic.com",
            "published_at": "2026-08-22T05:32:38Z",
            "raw_excerpt": "Public scoreboard for AI agent readiness.",
        }
    ]

    mock_analysis = [
        {
            "why_it_matters": "Extends Vercel into AI agent tooling ecosystem.",
            "confidence": "High",
        }
    ]

    def _fake_news_fetch_2(company, *args, **kwargs):
        return fake_news if company == "Vercel" else []

    with patch("src.monitoring_agent._fetch_news_from_currents", side_effect=_fake_news_fetch_2), \
         patch("src.monitoring_agent._fetch_github_events", return_value=[]), \
         patch("src.monitoring_agent._fetch_jobs", return_value=[]), \
         patch("src.pricing_extractor.fetch_pricing_signals", return_value=[]), \
         patch("src.analysis_agent._call_groq", side_effect=mock_analysis):

        # Execute default pipeline run
        brief_markdown = main.run_pipeline()

        assert isinstance(brief_markdown, str)
        assert len(brief_markdown) > 0

        # 1. Verify latest pointers exist
        latest_brief = test_data_dir / "brief.md"
        latest_signals = test_data_dir / "signals.json"
        latest_events = test_data_dir / "events.json"
        assert latest_brief.exists(), "brief.md was not created"
        assert latest_signals.exists(), "signals.json was not created"
        assert latest_events.exists(), "events.json was not created"
        assert latest_brief.read_text(encoding="utf-8") == brief_markdown

        # 2. Verify timestamped files exist
        timestamped_briefs = list(test_data_dir.glob("brief_*.md"))
        timestamped_signals = list(test_data_dir.glob("signals_*.json"))
        timestamped_events = list(test_data_dir.glob("events_*.json"))

        assert len(timestamped_briefs) == 1, f"Expected 1 timestamped brief, found {len(timestamped_briefs)}"
        assert len(timestamped_signals) == 1, f"Expected 1 timestamped signals file, found {len(timestamped_signals)}"
        assert len(timestamped_events) == 1, f"Expected 1 timestamped events file, found {len(timestamped_events)}"

        # 3. Verify timestamped content matches latest pointer content
        assert timestamped_briefs[0].read_text(encoding="utf-8") == brief_markdown
        assert timestamped_signals[0].read_text(encoding="utf-8") == latest_signals.read_text(encoding="utf-8")
        assert timestamped_events[0].read_text(encoding="utf-8") == latest_events.read_text(encoding="utf-8")
