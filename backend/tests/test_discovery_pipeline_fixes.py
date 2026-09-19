import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from src import api, discovery_agent


@pytest.fixture
def client():
    return TestClient(api.app)


def test_garbage_entities_filtered():
    """Verify that legal artifacts, headlines, and non-company phrases are rejected."""
    garbage_candidates = [
        "Musk Email Archives",
        "Elon Musk Countersuit",
        "California Senate Bill",
        "Fast Tracked",
        "CVE-2026-39039",
        "Options Casino",
        "Income Tax Returns",
        "Podcast Episode",
    ]
    for g in garbage_candidates:
        cleaned = discovery_agent._clean_heuristic_candidate(g, "openai")
        assert cleaned == "", f"Garbage entity '{g}' should have been rejected, got: '{cleaned}'"

    valid_candidates = ["Mistral AI", "Anthropic", "Flipkart", "Cursor"]
    for v in valid_candidates:
        cleaned = discovery_agent._clean_heuristic_candidate(v, "openai")
        assert cleaned != "", f"Valid candidate '{v}' was unexpectedly rejected"


def test_canonical_brand_key_consolidation():
    """Verify that brand variants collapse to the same canonical key."""
    assert discovery_agent._canonical_brand_key("Mistral") == "mistral"
    assert discovery_agent._canonical_brand_key("Mistral AI") == "mistral"
    assert discovery_agent._canonical_brand_key("Amazon India") == "amazon"
    assert discovery_agent._canonical_brand_key("Amazon") == "amazon"
    assert discovery_agent._canonical_brand_key("Anthropic PBC") == "anthropic"


def test_duplicate_brand_deduplication_in_run():
    """Verify that Mistral and Mistral AI collapse into one single candidate across run_with_meta."""
    mock_sources = [
        {
            "source_type": "discussion",
            "title": "Mistral – Everything to know about the OpenAI competitor",
            "url": "https://example.com/mistral-1",
            "text": "Mistral is an OpenAI competitor building frontier language models.",
            "published_at": "2025-05-20",
            "source_age": "recent",
        },
        {
            "source_type": "news",
            "title": "Mistral AI, an OpenAI competitor, rocketed to $2B in <12 months",
            "url": "https://example.com/mistral-2",
            "text": "Mistral AI is an OpenAI competitor founded by former Meta researchers.",
            "published_at": "2024-01-15",
            "source_age": "dated",
        },
    ]

    with patch("src.discovery_agent._call_groq_discovery", side_effect=discovery_agent.LLMUnavailableError("Simulated LLM outage")):
        res = discovery_agent.run_with_meta("openai", sources=mock_sources)
        assert res["extraction_method"] == "heuristic_fallback"
        assert res["degraded"] is True
        names = [c["name"] for c in res["candidates"]]
        mistral_matches = [n for n in names if "mistral" in n.lower()]
        assert len(mistral_matches) == 1, f"Expected 1 deduplicated Mistral candidate, found {mistral_matches}"
        assert mistral_matches[0] == "Mistral AI"


def test_crossed_citation_resolution_for_meesho():
    """Verify that Flipkart and Amazon India are correctly attributed from Wikipedia snippets."""
    mock_sources = [
        {
            "source_type": "encyclopedia",
            "title": "Wikipedia: Flipkart",
            "url": "https://en.wikipedia.org/wiki/Flipkart",
            "text": "Flipkart: industry, in which it competes primarily with Amazon India and domestic rival Meesho.",
            "published_at": None,
            "source_age": "undated",
        },
        {
            "source_type": "encyclopedia",
            "title": "Wikipedia: Shopsy (company)",
            "url": "https://en.wikipedia.org/wiki/Shopsy_(company)",
            "text": "Shopsy: In November 2021, media reported 'Flipkart vs Meesho: A new war in Indian e-commerce'.",
            "published_at": None,
            "source_age": "undated",
        },
    ]

    with patch("src.discovery_agent._call_groq_discovery", side_effect=discovery_agent.LLMUnavailableError("Simulated LLM outage")):
        res = discovery_agent.run_with_meta("meesho", sources=mock_sources)
        candidates_by_name = {c["name"]: c for c in res["candidates"]}

        assert "Flipkart" in candidates_by_name
        # Dedicated source matching: Flipkart must be attributed to Wikipedia: Flipkart, NOT Wikipedia: Shopsy
        assert candidates_by_name["Flipkart"]["source"] == "Wikipedia: Flipkart"

        assert "Amazon India" in candidates_by_name
        # Comparative quotation: Amazon India must have an attributed comparison rationale
        amazon_cand = candidates_by_name["Amazon India"]
        assert "Wikipedia: Flipkart" in amazon_cand["source"] or "Wikipedia: Flipkart" in amazon_cand["rationale"]
        assert "competes primarily with Amazon India" in amazon_cand["rationale"]


def test_llm_success_path():
    """Verify response metadata when LLM inference succeeds."""
    mock_llm_response = {
        "candidates": [
            {
                "name": "Anthropic",
                "rationale": "Direct foundation model competitor providing Claude models.",
                "confidence": "High",
                "source": "https://example.com/source",
                "source_age": "recent",
            }
        ]
    }
    with patch("src.discovery_agent._call_groq_discovery", return_value=mock_llm_response), \
         patch("src.discovery_agent.fetch_grounded_context", return_value=[]):
        res = discovery_agent.run_with_meta("openai")
        assert res["extraction_method"] == "llm"
        assert res["degraded"] is False
        assert res["llm_error"] is None
        assert len(res["candidates"]) == 1
        assert res["candidates"][0]["name"] == "Anthropic"
        assert res["candidates"][0]["extraction_method"] == "llm"


def test_api_discover_endpoint_metadata(client):
    """Verify that the FastAPI discover endpoint returns extraction_method and degraded flags."""
    token = api._create_jwt_token("c8f13b91-46ef-4682-9975-f85764d8a12e", "test@prismiq.ai")
    mock_llm_response = {
        "candidates": [
            {
                "name": "Anthropic",
                "rationale": "Foundation AI model provider.",
                "confidence": "High",
                "source": "https://example.com/anthropic",
                "source_age": "recent",
            }
        ]
    }
    with patch("src.discovery_agent._call_groq_discovery", return_value=mock_llm_response), \
         patch("src.discovery_agent.fetch_grounded_context", return_value=[]):
        resp = client.post(
            "/api/onboarding/discover",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_company": "openai"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["extraction_method"] == "llm"
        assert data["degraded"] is False
        assert data["llm_error"] is None
        assert data["candidates_count"] == 1


def test_api_health_endpoint_details(client, monkeypatch):
    """Verify that health endpoint surfaces groq_key_prefix, groq_key_len, and groq_model."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test1234567890abcdef")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["groq_configured"] is True
    assert data["groq_key_len"] == len("gsk_test1234567890abcdef")
    assert data["groq_key_prefix"] == "gsk_test"
    assert data["groq_has_quotes"] is False
    assert data["groq_model"] == "openai/gpt-oss-120b"
