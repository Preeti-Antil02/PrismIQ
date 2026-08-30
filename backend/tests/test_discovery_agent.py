import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import discovery_agent, storage


def test_discovery_agent_prompts_contain_guardrails():
    sources = [
        {
            "source_type": "discussion_and_tech_media",
            "title": "Vercel vs Netlify",
            "url": "https://example.com/vs",
            "published_at": "2026-08-20",
            "source_age": "recent",
            "text": "Comparison of Jamstack platforms.",
        }
    ]
    system_prompt, user_prompt = discovery_agent._build_prompts("Vercel", sources)

    # Check guardrail 1: generic / unfalsifiable
    assert "generic" in system_prompt.lower()
    assert "unfalsifiable" in system_prompt.lower()

    # Check guardrail 2: grounding / zero hallucination
    assert "hallucination" in system_prompt.lower() or "grounded" in system_prompt.lower()
    assert "retrieved sources" in system_prompt.lower()

    # Check guardrail 3: cherry-picking / distortion
    assert "cherry-picking" in system_prompt.lower() or "cherry picking" in system_prompt.lower() or "distortion" in system_prompt.lower()

    # Check freshness and confidence calibration guidance
    assert "freshness" in system_prompt.lower()
    assert "high" in system_prompt.lower()
    assert "medium" in system_prompt.lower()
    assert "low" in system_prompt.lower()
    assert "dated" in system_prompt.lower()

    # Check self-exclusion rule
    assert "target company itself" in system_prompt.lower()

    # Check user prompt includes company and source title/URL
    assert "Vercel" in user_prompt
    assert "Vercel vs Netlify" in user_prompt
    assert "https://example.com/vs" in user_prompt


def test_confidence_normalization():
    assert discovery_agent._normalize_confidence("high") == "High"
    assert discovery_agent._normalize_confidence("MEDIUM") == "Medium"
    assert discovery_agent._normalize_confidence("Low") == "Low"
    assert discovery_agent._normalize_confidence("very high") == "Low"
    assert discovery_agent._normalize_confidence(None) == "Low"
    assert discovery_agent._normalize_confidence("") == "Low"
    assert discovery_agent._normalize_confidence(123) == "Low"


def test_source_age_normalization():
    assert discovery_agent._normalize_source_age("recent") == "recent"
    assert discovery_agent._normalize_source_age("DATED") == "dated"
    assert discovery_agent._normalize_source_age("undated") == "undated"
    assert discovery_agent._normalize_source_age("invalid") == "undated"
    assert discovery_agent._normalize_source_age(None) == "undated"


def test_parse_iso_or_date():
    dt1 = discovery_agent._parse_iso_or_date("2014-10-08T15:23:01.000Z")
    assert dt1 is not None
    assert dt1.year == 2014 and dt1.month == 10 and dt1.day == 8

    dt2 = discovery_agent._parse_iso_or_date("2026-08-20 12:00:00 +0000")
    assert dt2 is not None
    assert dt2.year == 2026 and dt2.month == 8 and dt2.day == 20

    dt3 = discovery_agent._parse_iso_or_date(1724000000)
    assert dt3 is not None

    # Strict fallback tests: malformed, invalid or empty dates MUST return None
    assert discovery_agent._parse_iso_or_date(None) is None
    assert discovery_agent._parse_iso_or_date("") is None
    assert discovery_agent._parse_iso_or_date("not-a-date") is None
    assert discovery_agent._parse_iso_or_date("invalid-timestamp-2026") is None


def test_compute_source_age_strict_fallbacks():
    ref = datetime(2026, 8, 26, tzinfo=timezone.utc)
    
    # 2014 is dated
    old_dt = datetime(2014, 10, 8, tzinfo=timezone.utc)
    age_flag, date_str = discovery_agent._compute_source_age(old_dt, reference_dt=ref)
    assert age_flag == "dated"
    assert date_str == "2014-10-08"

    # 2026 is recent
    new_dt = datetime(2026, 8, 20, tzinfo=timezone.utc)
    age_flag, date_str = discovery_agent._compute_source_age(new_dt, reference_dt=ref)
    assert age_flag == "recent"
    assert date_str == "2026-08-20"

    # None MUST map strictly to undated (never recent)
    age_flag, date_str = discovery_agent._compute_source_age(None)
    assert age_flag == "undated"
    assert date_str is None


def test_match_source_metadata_unmatched_returns_undated():
    sources = [
        {"title": "Known Source", "url": "https://example.com/known", "source_age": "recent", "published_at": "2026-08-20"}
    ]
    
    # Matching source returns verified metadata
    age, dt_str = discovery_agent._match_source_metadata("https://example.com/known", sources)
    assert age == "recent"
    assert dt_str == "2026-08-20"

    # Unknown source strictly returns undated (never defaults to recent)
    age_unk, dt_unk = discovery_agent._match_source_metadata("Unmatched Random Citation 2026", sources)
    assert age_unk == "undated"
    assert dt_unk is None


def test_dated_source_downgrades_high_confidence_to_medium():
    mock_sources = [
        {
            "source_type": "discussion",
            "title": "WePay Launches WePay Clear, a Stripe Competitor",
            "url": "http://techcrunch.com/2014/10/08/wepay-clear",
            "published_at": "2014-10-08",
            "source_age": "dated",
            "text": "2014 article about WePay.",
        }
    ]

    mock_llm_response = {
        "candidates": [
            {
                "name": "WePay",
                "rationale": "Positioned as a Stripe competitor with fraud protection.",
                "confidence": "High",  # LLM erroneously rated High
                "source": "http://techcrunch.com/2014/10/08/wepay-clear",
                "source_age": "dated",
            }
        ]
    }

    with patch("src.discovery_agent.fetch_grounded_context", return_value=mock_sources), \
         patch("src.discovery_agent._call_groq_discovery", return_value=mock_llm_response):

        candidates = discovery_agent.run("Stripe")
        assert len(candidates) == 1
        wepay = candidates[0]
        assert wepay["name"] == "WePay"
        # Must be downgraded from High to Medium because source is dated (2014)
        assert wepay["confidence"] == "Medium"
        assert wepay["source_age"] == "dated"
        assert wepay["source_date"] == "2014-10-08"
        assert "not independently confirmed recently" in wepay["freshness_note"]


def test_recent_source_retains_high_confidence():
    mock_sources = [
        {
            "source_type": "discussion",
            "title": "Vercel vs Netlify 2026 Comparison",
            "url": "https://example.com/vs-2026",
            "published_at": "2026-08-20",
            "source_age": "recent",
            "text": "Recent 2026 comparison.",
        }
    ]

    mock_llm_response = {
        "candidates": [
            {
                "name": "Netlify",
                "rationale": "Direct Jamstack hosting competitor.",
                "confidence": "High",
                "source": "https://example.com/vs-2026",
                "source_age": "recent",
            }
        ]
    }

    with patch("src.discovery_agent.fetch_grounded_context", return_value=mock_sources), \
         patch("src.discovery_agent._call_groq_discovery", return_value=mock_llm_response):

        candidates = discovery_agent.run("Vercel")
        assert len(candidates) == 1
        netlify = candidates[0]
        assert netlify["name"] == "Netlify"
        assert netlify["confidence"] == "High"
        assert netlify["source_age"] == "recent"


def test_discovery_agent_normalization_schema():
    mock_sources = [
        {
            "source_type": "discussion",
            "title": "Vercel vs Netlify Comparison",
            "url": "https://example.com/vs",
            "published_at": "2026-08-20",
            "source_age": "recent",
            "text": "Netlify provides Jamstack hosting with preview deployments.",
        }
    ]

    mock_llm_response = {
        "candidates": [
            {
                "name": "Netlify",
                "rationale": "Provides Jamstack hosting and preview deployments directly competing with Vercel.",
                "confidence": "High",
                "source": "Vercel vs Netlify Comparison",
                "source_age": "recent",
            },
            {
                "name": "Cloudflare Pages",
                "rationale": "Offers static site hosting and serverless edge functions.",
                "confidence": "medium",
                "source": "https://example.com/cloudflare",
                "source_age": "recent",
            },
        ]
    }

    with patch("src.discovery_agent.fetch_grounded_context", return_value=mock_sources), \
         patch("src.discovery_agent._call_groq_discovery", return_value=mock_llm_response):

        candidates = discovery_agent.run("Vercel")

        assert len(candidates) == 2
        required_keys = {"name", "rationale", "confidence", "source", "source_age", "source_date", "freshness_note"}
        for c in candidates:
            assert required_keys.issubset(c.keys())
            assert isinstance(c["name"], str)
            assert isinstance(c["rationale"], str)
            assert c["confidence"] in {"High", "Medium", "Low"}
            assert c["source_age"] in {"recent", "dated", "undated"}
            assert isinstance(c["source"], str)

        assert candidates[0]["name"] == "Netlify"
        assert candidates[0]["confidence"] == "High"
        assert candidates[1]["name"] == "Cloudflare Pages"
        assert candidates[1]["confidence"] == "Medium"


def test_discovery_agent_filters_target_company_self():
    mock_sources = [{"source_type": "news", "title": "Vercel news", "url": "https://example.com", "text": "Vercel"}]
    mock_llm_response = {
        "candidates": [
            {
                "name": "Vercel",
                "rationale": "The company itself.",
                "confidence": "High",
                "source": "Vercel news",
            },
            {
                "name": "Netlify",
                "rationale": "Jamstack competitor.",
                "confidence": "High",
                "source": "Vercel news",
            },
        ]
    }

    with patch("src.discovery_agent.fetch_grounded_context", return_value=mock_sources), \
         patch("src.discovery_agent._call_groq_discovery", return_value=mock_llm_response):

        candidates = discovery_agent.run("Vercel")
        names = [c["name"] for c in candidates]
        assert "Vercel" not in names
        assert "Netlify" in names
        assert len(candidates) == 1


def test_discovery_agent_empty_sources_no_fabrication():
    with patch("src.discovery_agent.fetch_grounded_context", return_value=[]):
        candidates = discovery_agent.run("UnknownCompany12345")
        assert candidates == []


def test_discovery_agent_empty_company_name():
    candidates = discovery_agent.run("   ")
    assert candidates == []


def test_fetch_hn_context_parsing():
    fake_hn_resp = {
        "hits": [
            {
                "title": "Vercel vs. Cloudflare: two philosophies",
                "url": "https://example.com/cf-vs-vercel",
                "objectID": "12345",
                "created_at": "2026-08-20T10:00:00Z",
            }
        ]
    }
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = fake_hn_resp
        mock_get.return_value = mock_resp

        results = discovery_agent._fetch_hn_context("Vercel")
        assert len(results) >= 1
        assert results[0]["title"] == "Vercel vs. Cloudflare: two philosophies"
        assert results[0]["url"] == "https://example.com/cf-vs-vercel"
        assert results[0]["published_at"] == "2026-08-20"
        assert results[0]["source_age"] == "recent"


def test_fetch_github_context_parsing():
    fake_gh_resp = {
        "items": [
            {
                "name": "dokploy",
                "full_name": "Dokploy/dokploy",
                "description": "Open Source Alternative to Vercel, Netlify and Heroku.",
                "html_url": "https://github.com/Dokploy/dokploy",
                "pushed_at": "2026-08-22T10:00:00Z",
            }
        ]
    }
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = fake_gh_resp
        mock_get.return_value = mock_resp

        results = discovery_agent._fetch_github_context("Vercel")
        assert len(results) >= 1
        assert "Dokploy/dokploy" in results[0]["title"]
        assert results[0]["url"] == "https://github.com/Dokploy/dokploy"
        assert results[0]["published_at"] == "2026-08-22"
        assert results[0]["source_age"] == "recent"


def test_fetch_wikipedia_context_parsing():
    fake_wiki_resp = {
        "query": {
            "search": [
                {
                    "title": "Netlify",
                    "snippet": "Netlify is a cloud computing company that offers hosting and serverless backend services.",
                }
            ]
        }
    }
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = fake_wiki_resp
        mock_get.return_value = mock_resp

        results = discovery_agent._fetch_wikipedia_context("Vercel")
        assert len(results) >= 1
        assert results[0]["title"] == "Wikipedia: Netlify"
        assert "https://en.wikipedia.org/wiki/Netlify" in results[0]["url"]
        assert results[0]["source_age"] == "undated"


def test_fetch_currents_context_parsing():
    fake_currents_resp = {
        "status": "ok",
        "news": [
            {
                "title": "Cloudflare launches new developer platform features",
                "description": "Cloudflare expands edge compute capabilities.",
                "url": "https://example.com/cf-news",
                "published": "2026-08-20 10:00:00 +0000",
            }
        ]
    }
    with patch.dict("os.environ", {"CURRENTS_API_KEY": "test-key"}), \
         patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = fake_currents_resp
        mock_get.return_value = mock_resp

        results = discovery_agent._fetch_currents_context("Vercel")
        assert len(results) == 1
        assert results[0]["title"] == "Cloudflare launches new developer platform features"
        assert results[0]["url"] == "https://example.com/cf-news"
        assert results[0]["published_at"] == "2026-08-20"
        assert results[0]["source_age"] == "recent"


def test_storage_discovery_proposal_and_confirmed(tmp_path):
    target = "TestCorp"
    candidates = [
        {
            "name": "CompetitorA",
            "rationale": "Direct overlap in cloud hosting.",
            "confidence": "High",
            "source": "Tech comparison article",
            "source_age": "recent",
            "source_date": "2026-08-20",
            "freshness_note": "Recent source (2026-08-20)",
        }
    ]

    proposal_path = tmp_path / "proposal.json"
    confirmed_path = tmp_path / "confirmed.json"

    # 1. Save and load proposal
    storage.save_discovery_proposal(target, candidates, filepath=proposal_path)
    loaded_proposal = storage.load_discovery_proposal(target, filepath=proposal_path)
    assert len(loaded_proposal) == 1
    assert loaded_proposal[0]["name"] == "CompetitorA"
    assert loaded_proposal[0]["confidence"] == "High"

    # 2. Save and load confirmed competitors
    confirmed_list = ["CompetitorA", "CompetitorB"]
    storage.save_confirmed_competitors(target, confirmed_list, filepath=confirmed_path)
    loaded_confirmed = storage.load_confirmed_competitors(target, filepath=confirmed_path)
    assert loaded_confirmed == ["CompetitorA", "CompetitorB"]


def test_interactive_confirm_workflow():
    candidates = [
        {
            "name": "CompetitorA",
            "confidence": "High",
            "rationale": "Rationale A",
            "source": "Source A",
            "source_age": "recent",
            "freshness_note": "Recent source",
        },
        {
            "name": "CompetitorB",
            "confidence": "Medium",
            "rationale": "Rationale B",
            "source": "Source B",
            "source_age": "dated",
            "freshness_note": "Sourced 2014, not independently confirmed recently",
        },
        {
            "name": "CompetitorC",
            "confidence": "Low",
            "rationale": "Rationale C",
            "source": "Source C",
            "source_age": "undated",
            "freshness_note": "Undated source",
        },
    ]

    # Simulate user inputs:
    # 1st candidate: 'y' (accept)
    # 2nd candidate: 'n' (reject)
    # 3rd candidate: 'e' then 'CompetitorC_Edited' (edit)
    user_inputs = ["y", "n", "e", "CompetitorC_Edited"]
    with patch("builtins.input", side_effect=user_inputs), \
         patch("src.storage.save_confirmed_competitors") as mock_save:

        confirmed = discovery_agent.interactive_confirm("TestCompany", candidates)
        assert confirmed == ["CompetitorA", "CompetitorC_Edited"]
        assert mock_save.called
        assert mock_save.call_args[0][0] == "TestCompany"
        assert mock_save.call_args[0][1] == ["CompetitorA", "CompetitorC_Edited"]


def test_interactive_confirm_accept_all():
    candidates = [
        {"name": "Comp1", "confidence": "High", "rationale": "R1", "source": "S1", "source_age": "recent"},
        {"name": "Comp2", "confidence": "Medium", "rationale": "R2", "source": "S2", "source_age": "dated"},
    ]

    # User inputs 'a' on first candidate
    with patch("builtins.input", side_effect=["a"]), \
         patch("src.storage.save_confirmed_competitors"):

        confirmed = discovery_agent.interactive_confirm("TestCompany", candidates)
        assert confirmed == ["Comp1", "Comp2"]
