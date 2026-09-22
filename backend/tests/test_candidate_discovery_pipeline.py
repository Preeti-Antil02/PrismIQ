import pytest
from unittest.mock import patch, MagicMock
from src import discovery_agent


def test_meesho_discovery_pipeline_counts_and_exclusion():
    """Verify that Meesho returns complete valid competitor candidates without false positive title fragments."""
    # Run discovery on Meesho with live/grounded retrieval
    res = discovery_agent.run_with_meta("Meesho")
    candidates = res.get("candidates", [])
    names = [c["name"] for c in candidates]

    # Must contain real competitors
    assert any("Flipkart" in n for n in names), f"Flipkart not found in {names}"
    assert any("Amazon" in n for n in names), f"Amazon not found in {names}"
    
    # Must NOT contain false positive title fragments
    assert "Commerce for Bharat" not in names
    assert "Financials" not in names
    assert "Meesho" not in names
    assert "Regena Cassandrra" not in names

    # Must return full discovered candidate set (eliminating the old 3-candidate limit)
    assert len(candidates) >= 8, f"Expected >= 8 candidates, got {len(candidates)}: {names}"

    # Verify confidence and rationale fields are populated
    for c in candidates:
        assert c.get("name"), "Candidate missing name"
        assert c.get("confidence") in ("High", "Medium", "Low"), f"Invalid confidence: {c.get('confidence')}"
        assert c.get("source"), f"Candidate {c['name']} missing source"
        assert c.get("rationale"), f"Candidate {c['name']} missing rationale"


def test_flipkart_discovery_pipeline_candidates():
    """Verify Flipkart discovers real e-commerce competitors and excludes itself."""
    res = discovery_agent.run_with_meta("Flipkart")
    candidates = res.get("candidates", [])
    names = [c["name"] for c in candidates]

    assert "Flipkart" not in names
    assert any(n in names for n in ["Amazon", "Snapdeal", "Meesho", "Infibeam"])
    assert len(candidates) >= 4, f"Expected >= 4 candidates, got {len(candidates)}: {names}"


def test_openai_discovery_pipeline_candidates():
    """Verify OpenAI discovers AI competitors and excludes itself."""
    res = discovery_agent.run_with_meta("OpenAI")
    candidates = res.get("candidates", [])
    names = [c["name"] for c in candidates]

    assert "OpenAI" not in names
    assert any(n in names for n in ["Mistral AI", "Anthropic", "Hugging Face", "xAI", "Google DeepMind", "Cohere"])
    assert len(candidates) >= 6, f"Expected >= 6 candidates, got {len(candidates)}: {names}"


def test_empty_state_for_unknown_company():
    """Verify that unknown company returns empty candidates cleanly."""
    with patch("src.discovery_agent.fetch_grounded_context", return_value=[]):
        res = discovery_agent.run_with_meta("NonExistentCorpXYZ999")
        assert res["candidates"] == []
