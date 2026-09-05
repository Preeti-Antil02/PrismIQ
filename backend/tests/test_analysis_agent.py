import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import analysis_agent


def test_analysis_agent_prompts_contain_guardrails():
    sample_signal = {
        "source": "news",
        "company": "Vercel",
        "title": "Vercel Releases Microfrontends Tooling",
        "url": "https://vercel.com/blog/mfe",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "New microfrontends architecture for large engineering teams.",
    }
    system_prompt, user_prompt = analysis_agent._build_prompts(sample_signal)

    # Check guardrail 1: generic, unfalsifiable statements
    assert "generic" in system_prompt.lower()
    assert "unfalsifiable" in system_prompt.lower()

    # Check guardrail 2: correlation as causation / hedging
    assert "correlation" in system_prompt.lower()
    assert "causation" in system_prompt.lower()
    assert "hedging" in system_prompt.lower()

    # Check guardrail 3: cherry-picking / ambiguity
    assert "cherry-picking" in system_prompt.lower() or "cherry picking" in system_prompt.lower()
    assert "ambiguity" in system_prompt.lower() or "contradiction" in system_prompt.lower()

    # Check fact/inference separation instructions
    assert "fact vs. inference separation" in system_prompt.lower() or "fact vs inference" in system_prompt.lower()
    assert "what the source directly documents" in system_prompt.lower()
    assert "do not blend fact and speculation" in system_prompt.lower()
    assert "purely factual" in system_prompt.lower()

    # Check confidence calibration guidance
    assert "confidence calibration" in system_prompt.lower()
    assert "mostly verifiable, documented fact" in system_prompt.lower()
    assert "speculation lowers the overall confidence" in system_prompt.lower()

    # Check that signal title and excerpt are in user prompt
    assert sample_signal["title"] in user_prompt
    assert sample_signal["raw_excerpt"] in user_prompt


def test_analysis_agent_run_adds_fields_and_valid_confidence():
    sample_signals = [
        {
            "source": "news",
            "company": "Vercel",
            "title": "Vercel Announces AI SDK 3.0",
            "url": "https://vercel.com/blog/ai-sdk",
            "published_at": "2026-08-20T10:00:00Z",
            "raw_excerpt": "AI SDK 3.0 provides streaming UI support across React and Svelte.",
        },
        {
            "source": "github",
            "company": "Netlify",
            "title": "Netlify Core Functions Update",
            "url": "https://github.com/netlify/functions",
            "published_at": "2026-08-21T10:00:00Z",
            "raw_excerpt": "Added background function support.",
        },
    ]

    mock_analysis_1 = {"why_it_matters": "Expands AI developer ecosystem reach.", "confidence": "High"}
    mock_analysis_2 = {"why_it_matters": "Enables long-running compute jobs.", "confidence": "Medium"}

    with patch("src.analysis_agent._call_groq", side_effect=[mock_analysis_1, mock_analysis_2]):
        findings = analysis_agent.run(sample_signals)

        assert len(findings) == 2
        for f in findings:
            assert "why_it_matters" in f
            assert "confidence" in f
            assert f["confidence"] in {"High", "Medium", "Low"}

        assert findings[0]["confidence"] == "High"
        assert findings[0]["why_it_matters"] == "Expands AI developer ecosystem reach."
        assert findings[1]["confidence"] == "Medium"


def test_analysis_agent_confidence_normalization():
    # Test normalization of various model output styles
    assert analysis_agent._normalize_confidence("high") == "High"
    assert analysis_agent._normalize_confidence("MEDIUM") == "Medium"
    assert analysis_agent._normalize_confidence("Low") == "Low"
    assert analysis_agent._normalize_confidence("Very High") == "Low"
    assert analysis_agent._normalize_confidence("Unknown") == "Low"
    assert analysis_agent._normalize_confidence(None) == "Low"


def test_analysis_agent_empty_signals():
    findings = analysis_agent.run([])
    assert findings == []


def test_analysis_agent_dual_confidence_separation():
    sample_signal = {
        "source": "news",
        "company": "Vercel",
        "title": "Vercel Announces AI Gateway",
        "url": "https://vercel.com/blog/ai-gateway",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "AI Gateway introduces unified endpoint.",
    }
    mock_response = {
        "why_it_matters": "Unified endpoint documents enterprise routing. This may suggest future unified metering.",
        "fact_confidence": "High",
        "inference_confidence": "Medium",
        "confidence": "Medium",
    }
    with patch("src.analysis_agent._call_groq", return_value=mock_response):
        findings = analysis_agent.run([sample_signal])
        assert len(findings) == 1
        f = findings[0]
        assert f["fact_confidence"] == "High"
        assert f["inference_confidence"] == "Medium"
        assert f["confidence"] == "Medium"


def test_analysis_agent_routine_job_confidence_calibration():
    job_signal = {
        "source": "jobs",
        "company": "Vercel",
        "title": "Job Posting: Account Executive - Enterprise EMEA",
        "url": "https://vercel.com/careers/ae-emea",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "Hiring standard quota-carrying account executive.",
        "corroboration_count": 1,
    }
    findings = analysis_agent.run([job_signal])
    assert len(findings) == 1
    f = findings[0]
    assert f["fact_confidence"] == "High"  # Sourced job posting is verified fact
    assert f["inference_confidence"] == "Low"  # No speculative strategic inference
    assert f["confidence"] == "Low"  # Low legacy ranking priority
