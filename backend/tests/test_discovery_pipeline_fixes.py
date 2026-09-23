import re
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
        assert candidates_by_name["Flipkart"]["confidence"] == "Medium"

        assert "Amazon India" in candidates_by_name
        amazon_cand = candidates_by_name["Amazon India"]
        # Comparative quotation: Amazon India must have an attributed comparison rationale
        assert "Wikipedia: Flipkart" in amazon_cand["source"] or "Wikipedia: Flipkart" in amazon_cand["rationale"]
        # Must capture full sensible clause without trailing dangling conjunctions
        assert "in which it competes primarily with Amazon India and domestic rival Meesho" in amazon_cand["rationale"]
        assert not amazon_cand["rationale"].rstrip(".)\"").endswith(" and")
        # Indirect candidate must be calibrated to Low confidence with secondary source note
        assert amazon_cand["confidence"] == "Low"
        assert "Indirect" in amazon_cand["freshness_note"]


def test_clause_extraction_no_mid_sentence_cutoff():
    """Verify that _extract_containing_clause captures the full semantic clause and strips dangling prepositions."""
    text = (
        "According to a 2023 AllianceBernstein report, Flipkart held a 48% market share in the Indian "
        "e-commerce industry, in which it competes primarily with Amazon India and domestic rival Meesho. "
        "In 2018, Flipkart was described as having a dominant position."
    )
    match = re.search(r"competes\s+primarily\s+with\s+Amazon\s+India", text)
    assert match is not None
    clause = discovery_agent._extract_containing_clause(text, match.start(), match.end())
    assert clause == "in which it competes primarily with Amazon India and domestic rival Meesho"
    assert not clause.endswith(" and")


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
    """Verify that public health endpoint omits key internals by default, and exposes them under ?debug=true."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test1234567890abcdef")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")

    # Public unauthenticated health check: key internals omitted
    resp_pub = client.get("/health")
    assert resp_pub.status_code == 200
    pub_data = resp_pub.json()
    assert pub_data["status"] == "ok"
    assert pub_data["groq_configured"] is True
    assert "groq_key_len" not in pub_data
    assert "groq_key_prefix" not in pub_data
    assert "groq_model" not in pub_data

    # Gated debug health check: key internals included
    resp_debug = client.get("/health?debug=true")
    assert resp_debug.status_code == 200
    debug_data = resp_debug.json()
    assert debug_data["status"] == "ok"
    assert debug_data["groq_configured"] is True
    assert debug_data["groq_key_len"] == len("gsk_test1234567890abcdef")
    assert debug_data["groq_key_prefix"] == "gsk_test"
    assert debug_data["groq_has_quotes"] is False
    assert debug_data["groq_model"] == "openai/gpt-oss-120b"


def test_groq_cascade_on_tpd_rate_limit(monkeypatch):
    """Verify that when the primary model hits 429 TPD limit, Groq cascades to fallback model."""
    call_log = []

    def mock_post(url, headers=None, json=None, timeout=None):
        model = json.get("model")
        call_log.append(model)
        class MockResp:
            def __init__(self, status_code, text, json_data=None):
                self.status_code = status_code
                self.text = text
                self._json = json_data or {}
                self.headers = {}
            def json(self):
                return self._json

        if model == "openai/gpt-oss-120b":
            # Return TPD rate limit error
            return MockResp(
                429,
                '{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` on tokens per day (TPD): Limit 200000, Used 199990, Requested 500."}}'
            )
        elif model == "openai/gpt-oss-20b":
            # Succeed on fallback model
            return MockResp(
                200,
                '{"choices":[{"message":{"content":"{\\"candidates\\":[{\\"name\\":\\"Flipkart\\",\\"rationale\\":\\"E-commerce rival\\",\\"confidence\\":\\"High\\"}]}"}}]}',
                {"choices": [{"message": {"content": '{"candidates":[{"name":"Flipkart","rationale":"E-commerce rival","confidence":"High"}]}'}}]}
            )
        return MockResp(500, "Unexpected model")

    monkeypatch.setattr(discovery_agent.requests, "post", mock_post)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_dummy")

    result = discovery_agent._call_groq_discovery("meesho", [])
    assert "candidates" in result
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["name"] == "Flipkart"
    assert "openai/gpt-oss-120b" in call_log
    assert "openai/gpt-oss-20b" in call_log


def test_onboarding_confirm_with_new_tenant_uuid(client):
    """Verify that confirming onboarding with a brand new tenant UUID does not 500."""
    import uuid

    new_tenant_id = str(uuid.uuid4())
    token = api._create_jwt_token(new_tenant_id, f"{new_tenant_id[:8]}@test.com")

    resp = client.post(
        "/api/onboarding/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "target_company": "meesho",
            "confirmed_competitors": ["Flipkart", "Amazon India"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["target_company"] == "meesho"
    assert len(data["tracked_companies"]) == 3


