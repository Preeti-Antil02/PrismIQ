import pytest
from unittest.mock import patch, MagicMock
from src import discovery_agent, storage


def test_clean_company_name_strips_legal_suffixes():
    """Verify company name normalization strips corporate and legal designations."""
    assert discovery_agent._clean_company_name("OpenAI Inc.") == "OpenAI"
    assert discovery_agent._clean_company_name("OpenAI, Inc.") == "OpenAI"
    assert discovery_agent._clean_company_name("Anthropic PBC") == "Anthropic PBC"
    assert discovery_agent._clean_company_name("Mistral AI Corp") == "Mistral AI"
    assert discovery_agent._clean_company_name("Flipkart India Pvt Ltd") == "Flipkart India Pvt"
    assert discovery_agent._clean_company_name("Datadog LLC") == "Datadog"


def test_is_self_or_internal_product_filter():
    """Verify target company and its internal products are excluded as competitors."""
    # Exact and casing matches
    assert discovery_agent._is_self_or_internal_product("OpenAI", "openai") is True
    assert discovery_agent._is_self_or_internal_product("openai", "OpenAI") is True
    assert discovery_agent._is_self_or_internal_product("OpenAI Inc", "OpenAI") is True
    assert discovery_agent._is_self_or_internal_product("OpenAI, Inc.", "openai") is True

    # Known internal products of OpenAI
    assert discovery_agent._is_self_or_internal_product("ChatGPT", "OpenAI") is True
    assert discovery_agent._is_self_or_internal_product("GPT-4o", "OpenAI") is True
    assert discovery_agent._is_self_or_internal_product("OpenAI Codex", "OpenAI") is True
    assert discovery_agent._is_self_or_internal_product("Sora", "OpenAI") is True

    # Legitimate external competitors of OpenAI must NOT be excluded
    assert discovery_agent._is_self_or_internal_product("Anthropic", "OpenAI") is False
    assert discovery_agent._is_self_or_internal_product("Mistral AI", "OpenAI") is False
    assert discovery_agent._is_self_or_internal_product("Google", "OpenAI") is False
    assert discovery_agent._is_self_or_internal_product("Cursor", "OpenAI") is False

    # Flipkart and its products vs competitors
    assert discovery_agent._is_self_or_internal_product("Flipkart", "flipkart") is True
    assert discovery_agent._is_self_or_internal_product("Myntra", "Flipkart") is True
    assert discovery_agent._is_self_or_internal_product("Amazon", "Flipkart") is False
    assert discovery_agent._is_self_or_internal_product("Meesho", "Flipkart") is False


def test_candidate_deduplication_and_parent_extraction():
    """Verify that child products resolve to parent companies and deduplicate."""
    mock_llm_response = {
        "candidates": [
            {
                "name": "Anthropic",
                "rationale": "Direct foundation model competitor providing Claude 3.5 Sonnet.",
                "confidence": "High",
                "source": "https://techcrunch.com/anthropic",
            },
            {
                "name": "Claude (Anthropic)",
                "rationale": "Leading AI assistant rivaling ChatGPT.",
                "confidence": "Medium",
                "source": "https://news.ycombinator.com/item?id=123",
            },
            {
                "name": "Mistral AI Inc.",
                "rationale": "Open weight and commercial LLM developer based in France.",
                "confidence": "High",
                "source": "https://mistral.ai",
            },
        ]
    }

    mock_sources = [
        {"url": "https://techcrunch.com/anthropic", "title": "TechCrunch Anthropic", "source_age": "recent", "published_at": "2026-01-01"},
        {"url": "https://news.ycombinator.com/item?id=123", "title": "HN Claude", "source_age": "recent", "published_at": "2026-01-02"},
        {"url": "https://mistral.ai", "title": "Mistral AI", "source_age": "recent", "published_at": "2026-01-03"},
    ]

    with patch.object(discovery_agent, "_call_groq_discovery", return_value=mock_llm_response):
        candidates = discovery_agent.run("openai", sources=mock_sources, tenant_id="c8f13b91-46ef-4682-9975-f85764d8a12e")

    # Anthropic and Claude (Anthropic) must deduplicate into a single candidate
    anthropic_candidates = [c for c in candidates if c["name"].lower() == "anthropic"]
    assert len(anthropic_candidates) == 1, "Expected Anthropic and Claude to merge into a single candidate"
    assert anthropic_candidates[0]["confidence"] == "High"

    # Mistral AI Inc. must be cleaned to Mistral AI
    mistral_candidates = [c for c in candidates if "mistral" in c["name"].lower()]
    assert len(mistral_candidates) == 1
    assert mistral_candidates[0]["name"] == "Mistral AI"


def test_empty_company_returns_empty():
    """Verify empty target company returns empty candidate list without invoking external services."""
    assert discovery_agent.run("") == []
    assert discovery_agent.run("   ") == []


def test_storage_dual_write_handles_invalid_tenant_gracefully():
    """Verify database dual-write does not raise an exception even if tenant_id is not a valid UUID."""
    # Should not raise exception
    p1 = storage.save_discovery_sources("openai", [], tenant_id="non-uuid-tenant-string")
    assert p1.exists()

    p2 = storage.save_discovery_proposal("openai", [], tenant_id="non-uuid-tenant-string")
    assert p2.exists()
