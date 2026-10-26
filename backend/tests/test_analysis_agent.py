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


def test_analysis_agent_batched_execution():
    signals = [
        {
            "event_id": f"evt_{i}",
            "source": "news",
            "company": f"Competitor_{i}",
            "title": f"Major Release {i}",
            "url": f"https://example.com/release-{i}",
            "published_at": "2026-08-20T10:00:00Z",
            "raw_excerpt": f"Release details for product {i}.",
            "fact_confidence": "High",
        }
        for i in range(1, 6)
    ]

    mock_batch_results = {
        f"evt_{i}": {
            "why_it_matters": f"Strategic implication {i}.",
            "fact_confidence": "High",
            "inference_confidence": "Medium",
            "confidence": "High",
        }
        for i in range(1, 6)
    }

    with patch("src.analysis_agent._call_groq_batch", return_value=mock_batch_results) as mock_batch:
        findings = analysis_agent.run(signals)
        assert len(findings) == 5
        assert mock_batch.called
        for i, f in enumerate(findings, 1):
            assert f["why_it_matters"] == f"Strategic implication {i}."
            assert f["fact_confidence"] == "High"
            assert f["inference_confidence"] == "Medium"
            assert f["confidence"] == "High"


def test_groq_models_reverted_to_verified_trio():
    """Verify that GROQ_MODELS contains the three verified models."""
    assert analysis_agent.GROQ_MODELS == [
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-20b",
    ]
    assert analysis_agent.DEFAULT_GROQ_MODEL == "openai/gpt-oss-120b"


def test_groq_model_availability_probe():
    """Verify check_groq_model_availability returns True on 200 and False on 404/error."""
    mock_ok = MagicMock()
    mock_ok.status_code = 200

    mock_fail = MagicMock()
    mock_fail.status_code = 404
    mock_fail.text = "Model not found"

    with patch("requests.post", return_value=mock_ok):
        assert analysis_agent.check_groq_model_availability("openai/gpt-oss-120b", "gsk_test") is True

    with patch("requests.post", return_value=mock_fail):
        assert analysis_agent.check_groq_model_availability("custom/unavailable-model", "gsk_test") is False


def test_groq_model_probe_status_codes():
    """Test individual status code handling: 404/400/403 drop model, 429/5xx retain as available."""
    # 400 Decommissioned/Invalid: drops model (False)
    mock_400 = MagicMock(status_code=400, text="Model is decommissioned")
    with patch("requests.post", return_value=mock_400):
        assert analysis_agent.check_groq_model_availability("old-model", "gsk_test", max_retries=0) is False

    # 403 Permission denied: drops model (False)
    mock_403 = MagicMock(status_code=403, text="Permission denied for model")
    with patch("requests.post", return_value=mock_403):
        assert analysis_agent.check_groq_model_availability("private-model", "gsk_test", max_retries=0) is False

    # 429 Rate limited: retries with backoff and retains as available (True)
    mock_429 = MagicMock(status_code=429, text="Rate limit exceeded")
    with patch("requests.post", return_value=mock_429), patch("time.sleep"):
        assert analysis_agent.check_groq_model_availability("busy-model", "gsk_test", max_retries=1, backoff_factor=0.01) is True

    # 500 / 503 Server error: retries with backoff and retains as available (True)
    mock_503 = MagicMock(status_code=503, text="Service Unavailable")
    with patch("requests.post", return_value=mock_503), patch("time.sleep"):
        assert analysis_agent.check_groq_model_availability("transient-model", "gsk_test", max_retries=1, backoff_factor=0.01) is True


def test_verify_groq_cascade_availability_drops_unavailable_model():
    """Verify that verify_groq_cascade_availability drops unavailable models and retains healthy ones."""
    def fake_probe(model, key, timeout=10.0):
        # qwen/qwen3.8-27b fails with 404, others succeed
        return model != "qwen/qwen3.8-27b"

    with patch("src.analysis_agent.check_groq_model_availability", side_effect=fake_probe):
        active = analysis_agent.verify_groq_cascade_availability("gsk_test")
        assert "openai/gpt-oss-120b" in active
        assert "openai/gpt-oss-20b" in active
        assert "qwen/qwen3.8-27b" not in active
        assert len(active) == 2


def test_verify_groq_cascade_all_fail_aborts_red():
    """Verify that when all cascade models fail the probe, a fatal RuntimeError is raised."""
    with patch("src.analysis_agent.check_groq_model_availability", return_value=False):
        import pytest
        with pytest.raises(RuntimeError, match="All Groq cascade models.*failed availability probe"):
            analysis_agent.verify_groq_cascade_availability("gsk_test")



