import pytest
import json
from pathlib import Path
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import storage

client = TestClient(app)

@pytest.fixture(autouse=True)
def preserve_high_impact_changes():
    data_dir = storage._get_data_dir()
    hic_file = data_dir / "high_impact_changes.json"
    backup = None
    if hic_file.exists():
        with open(hic_file, "r", encoding="utf-8") as f:
            backup = f.read()
    yield
    if backup is not None:
        with open(hic_file, "w", encoding="utf-8") as f:
            f.write(backup)

def test_get_detected_changes_authenticated():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/changes/detection", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "changes" in data
    assert data["count"] >= 5
    assert data["high_impact_count"] >= 4

    # Verify Vercel AI Pivot
    vercel = next((c for c in data["changes"] if c["company_name"] == "Vercel"), None)
    assert vercel is not None
    assert "AI Infrastructure" in vercel["headline"]
    assert vercel["significance_tier"] == "HIGH IMPACT"
    assert vercel["confidence"] >= 90.0
    assert vercel["corroborating_signals_count"] >= 4

def test_get_detected_changes_filter_by_company():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/changes/detection?company=Netlify", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all(c["company_name"].lower() == "netlify" for c in data["changes"])
    assert data["count"] >= 1
    netlify = data["changes"][0]
    assert "Pricing & Compliance" in netlify["headline"]

def test_get_detected_changes_filter_by_impact():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/changes/detection?impact=HIGH%20IMPACT", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all("high" in c["significance_tier"].lower() for c in data["changes"])
    assert data["count"] >= 4

def test_get_company_detected_changes_endpoint():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/changes/detection/Cloudflare%20Pages", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Cloudflare Pages"
    assert len(data["changes"]) >= 1
    cf = data["changes"][0]
    assert "Vectorize" in cf["headline"] or "Egress" in cf["headline"]

def test_change_detection_signals_evidence_integrity():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/changes/detection?company=Vercel", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    change = res.json()["changes"][0]
    signals = change["signals_evidence"]
    assert len(signals) >= 4

    types = [s["signal_type"] for s in signals]
    assert "Product Page" in types
    assert "Official Blog" in types
    assert "Hiring" in types
    assert "GitHub Activity" in types

    for s in signals:
        assert len(s["title"]) > 0
        assert len(s["source"]) > 0
        assert len(s["excerpt"]) > 0

def test_create_detected_change_endpoint():
    token = _create_jwt_token("33333333-4444-5555-6666-777777777777", "strategist@corp.com")
    payload = {
        "company_name": "Datadog",
        "headline": "Datadog Launches LLM Observability & Security Monitoring Suite",
        "significance_tier": "HIGH IMPACT",
        "confidence": 93.0,
        "potential_impact": "High",
        "window_days": 14,
        "strategic_interpretation": "Datadog is consolidating enterprise AI governance budgets by combining model tracing with prompt injection security.",
        "why_it_matters": "Three verified signals appeared within 14 days covering product GA, AWS partnership, and pricing tiers.",
        "recommended_action": "Audit our application telemetry and evaluate whether to offer native LLM tracing hooks.",
        "signals_evidence": [
            {
                "signal_type": "Product Page",
                "title": "LLM Observability GA Released",
                "source": "datadoghq.com/product/llm-observability",
                "url": "https://www.datadoghq.com/product/llm-observability/",
                "excerpt": "End-to-end token latency, prompt drift, and guardrail evaluation for agent loops.",
                "detected_at": "2026-10-15T12:00:00Z"
            },
            {
                "signal_type": "Pricing Page",
                "title": "Per-Million Token Pricing Model Added",
                "source": "datadoghq.com/pricing",
                "url": "https://www.datadoghq.com/pricing/",
                "excerpt": "$0.10 per 10k monitored AI agent interactions.",
                "detected_at": "2026-10-18T14:00:00Z"
            }
        ]
    }
    res = client.post("/changes/detection", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["change"]["company_name"] == "Datadog"
    assert "LLM Observability" in body["change"]["headline"]

def test_change_detection_security_unauthenticated():
    # Fails closed with 401 without Authorization header
    res = client.get("/changes/detection")
    assert res.status_code == 401
    assert "Missing Authorization" in res.json().get("detail", "")

    res_co = client.get("/changes/detection/Vercel")
    assert res_co.status_code == 401
    assert "Missing Authorization" in res_co.json().get("detail", "")

    res_post = client.post("/changes/detection", json={"company_name": "BadActor"})
    assert res_post.status_code == 401

def test_change_detection_multi_channel_corroboration_dynamic_agent():
    tid = "55555555-6666-7777-8888-999999999999"
    token = _create_jwt_token(tid, "pm@meesho.com")

    # Onboard Meesho with Flipkart and Amazon India
    onboard_res = client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "Meesho",
            "confirmed_competitors": ["Flipkart", "Amazon India"]
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert onboard_res.status_code == 200

    # Retrieve high-impact changes for this tenant
    res = client.get("/changes/detection", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "changes" in data
    assert data["count"] >= 5

    # Zero demo data guarantee: no Vercel or Netlify
    cnames = [c["company_name"] for c in data["changes"]]
    assert "Flipkart" in cnames
    assert "Amazon India" in cnames
    assert "Vercel" not in cnames
    assert "Netlify" not in cnames

    # Verify multi-channel corroboration and rich evidence integrity
    for change in data["changes"]:
        assert len(change["headline"]) > 10
        assert change["confidence"] >= 90.0
        assert change["window_days"] == 14
        assert change["significance_tier"] in ["HIGH IMPACT", "CRITICAL INFLECTION"]
        assert len(change["strategic_interpretation"]) > 20
        assert len(change["why_it_matters"]) > 10
        assert len(change["recommended_action"]) > 10

        signals = change["signals_evidence"]
        assert len(signals) >= 3  # Corroborated by 3+ independent channels
        assert change["corroborating_signals_count"] >= 3

        # Channel diversity
        channels = set(s["signal_type"] for s in signals)
        assert len(channels) >= 2  # At least 2 distinct independent channels per change

        for s in signals:
            assert len(s["title"]) > 0
            assert len(s["source"]) > 0
            assert len(s["excerpt"]) > 0
            assert s["url"].startswith("http")
            assert "detected_at" in s

from src import change_detection_engine


def test_change_detection_engine_10_categories_classification():
    categories_to_test = [
        ("Acme introduces enterprise tier pricing with annual billing", "Pricing Changes"),
        ("Beta rolls out Next-Gen AI Vector Search in general availability", "Product Launches"),
        ("Gamma appoints new Chief Information Security Officer (CISO)", "Executive Hiring"),
        ("Delta forms global strategic distribution alliance with Cloud Partner", "Strategic Partnerships"),
        ("Epsilon deprecates legacy v1 REST API and sunsets classic dashboard", "Product Deprecations"),
        ("Zeta launches regional cloud operations expanding into European market", "Market Expansion"),
        ("Eta allocates infrastructure investment to custom silicon GPU clusters", "Technology Investments"),
        ("Theta revamps self-serve onboarding portal for customer journey", "Customer Experience Changes"),
        ("Iota pivots go-to-market towards Global 2000 enterprise accounts", "Enterprise Strategy"),
        ("Kappa closes series C funding and acquires data integration firm", "Funding and Acquisitions"),
    ]
    for headline, expected_cat in categories_to_test:
        detected_cat = change_detection_engine.classify_event_category(headline, headline)
        assert detected_cat == expected_cat, f"Expected {expected_cat} for '{headline}', got {detected_cat}"

        teams = change_detection_engine.CATEGORY_AFFECTED_TEAMS.get(detected_cat, [])
        assert len(teams) >= 2, f"Expected affected business teams for {detected_cat}"


def test_deterministic_impact_scoring_engine_factors():
    # 1. Critical Inflection / High Impact scenario
    res_crit = change_detection_engine.calculate_deterministic_impact_score(
        category="Pricing Changes",
        headline="Enterprise-wide pricing overhaul and minimum contract commitments",
        evidence_sources=[
            {"signal_type": "Pricing Page", "source": "acme.com/pricing", "url": "https://acme.com/pricing"},
            {"signal_type": "Official Blog", "source": "acme.com/blog", "url": "https://acme.com/blog/pricing"},
            {"signal_type": "News Release", "source": "bloomberg.com", "url": "https://bloomberg.com/acme"},
            {"signal_type": "Customer Notice", "source": "acme.com/notice", "url": "https://acme.com/notice"},
        ],
        competitor_name="Acme",
        target_company="TargetCorp",
        has_pattern_corroboration=True,
    )
    assert res_crit["impact_score"] >= 75
    assert res_crit["significance_tier"] in ["CRITICAL INFLECTION", "HIGH IMPACT"]
    factors = res_crit["factors"]
    assert factors["strategic_relevance"] >= 20.0
    assert factors["market_impact"] >= 15.0
    assert factors["corroborating_sources"] >= 8.0

    # 2. Medium Impact scenario
    res_med = change_detection_engine.calculate_deterministic_impact_score(
        category="Customer Experience Changes",
        headline="Minor refresh to self-serve knowledge base portal",
        evidence_sources=[
            {"signal_type": "Support Page", "source": "acme.com/help", "url": "https://acme.com/help"},
        ],
        competitor_name="Acme",
        target_company="TargetCorp",
        has_pattern_corroboration=False,
    )
    assert 35 <= res_med["impact_score"] <= 65
    assert res_med["significance_tier"] in ["MEDIUM IMPACT", "HIGH IMPACT"]

    # 3. Deterministic property: identical input guarantees identical score and tier
    res_dup = change_detection_engine.calculate_deterministic_impact_score(
        category="Customer Experience Changes",
        headline="Minor refresh to self-serve knowledge base portal",
        evidence_sources=[
            {"signal_type": "Support Page", "source": "acme.com/help", "url": "https://acme.com/help"},
        ],
        competitor_name="Acme",
        target_company="TargetCorp",
        has_pattern_corroboration=False,
    )
    assert res_dup["impact_score"] == res_med["impact_score"]
    assert res_dup["significance_tier"] == res_med["significance_tier"]


def test_signal_deduplication_and_source_merging():
    raw_signals = [
        {
            "id": "sig_1",
            "company_name": "Acme",
            "title": "Acme introduces new enterprise pricing tiers",
            "source": "TechCrunch",
            "url": "https://techcrunch.com/acme-pricing",
            "detected_at": "2026-10-10T10:00:00Z"
        },
        {
            "id": "sig_2",
            "company_name": "Acme",
            "title": "Acme introduces new enterprise pricing tiers for organizations",
            "source": "VentureBeat",
            "url": "https://venturebeat.com/acme-pricing",
            "detected_at": "2026-10-11T12:00:00Z"
        },
        {
            "id": "sig_3",
            "company_name": "Acme",
            "title": "Executive hire announced at Acme leadership",
            "source": "LinkedIn",
            "url": "https://linkedin.com/acme-hiring",
            "detected_at": "2026-10-12T09:00:00Z"
        }
    ]

    merged = change_detection_engine.detect_duplicates_and_merge(raw_signals)
    assert len(merged) == 2  # sig_1 and sig_2 merged into 1 canonical event
    pricing_event = next(e for e in merged if "pricing" in e["headline"].lower())
    assert pricing_event["corroborating_signals_count"] == 2
    assert len(pricing_event["signals_evidence"]) == 2


def test_cross_signal_pattern_detection():
    canonical_events = [
        {
            "id": "evt_ai_1",
            "company_name": "CompetitorA",
            "headline": "Competitor hires 10 senior AI research engineers",
            "event_category": "Executive Hiring",
        },
        {
            "id": "evt_ai_2",
            "company_name": "CompetitorA",
            "headline": "Competitor launches new generative AI product feature page",
            "event_category": "Product Launches",
        },
        {
            "id": "evt_ai_3",
            "company_name": "CompetitorA",
            "headline": "Competitor publishes new open-source AI agent repositories",
            "event_category": "Technology Investments",
        },
        {
            "id": "evt_ai_4",
            "company_name": "CompetitorA",
            "headline": "Competitor announces AI developer conference partnership",
            "event_category": "Strategic Partnerships",
        }
    ]

    correlated = change_detection_engine.correlate_signals_and_detect_patterns(canonical_events)
    assert len(correlated) == 4
    for ev in correlated:
        assert "related_event_ids" in ev
        assert len(ev["related_event_ids"]) >= 1
        assert ev["has_pattern_corroboration"] is True


def test_grounded_explanation_and_insufficient_evidence():
    # Grounded evidence scenario
    intel = change_detection_engine.generate_event_specific_intelligence(
        competitor_name="CloudCorp",
        headline="Shifted from flat subscription to consumption-based token billing",
        category="Pricing Changes",
        evidence_sources=[
            {"signal_type": "Pricing Page", "source": "cloudcorp.com/pricing", "excerpt": "$0.05 per active unit per hour"}
        ],
        target_company="PrismTarget"
    )
    assert "Insufficient evidence" not in intel["why_it_matters"]
    assert "Flipkart" not in intel["why_it_matters"]  # Zero contamination
    assert "Flipkart" not in intel["strategic_interpretation"]
    assert len(intel["affected_business_teams"]) > 0

    # Missing evidence fallback scenario
    empty_intel = change_detection_engine.generate_event_specific_intelligence(
        competitor_name="UnknownCorp",
        headline="Unverified rumor without corroboration",
        category="Pricing Changes",
        evidence_sources=[],
        target_company="PrismTarget"
    )
    assert "Insufficient evidence" in empty_intel["why_it_matters"]
    assert "Insufficient evidence" in empty_intel["description"]
    assert empty_intel["verification_status"] == "insufficient_evidence"


def test_point3_demonstration_scenarios_integrity():
    demos = change_detection_engine.get_demo_demonstration_scenarios(target_company="Flipkart")
    assert len(demos) == 5

    # Check distinct categories
    cats = [d["event_category"] for d in demos]
    assert len(set(cats)) == 5
    assert "Pricing Changes" in cats
    assert "Product Launches" in cats
    assert "Executive Hiring" in cats
    assert "Strategic Partnerships" in cats
    assert "Product Deprecations" in cats

    # Check distinct IDs and headlines
    ids = [d["id"] for d in demos]
    assert len(set(ids)) == 5
    headlines = [d["headline"] for d in demos]
    assert len(set(headlines)) == 5

    # Check that all are explicitly labeled demo data
    assert all(d["is_demo_data"] is True for d in demos)
    assert all(d.get("verification_status") in ["corroborated", "demonstration_scenario"] for d in demos)

    # Check that no card shares repeated descriptions or recommendations
    whys = [d["why_it_matters"] for d in demos]
    assert len(set(whys)) == 5
    actions = [d["recommended_action"] for d in demos]
    assert len(set(actions)) == 5

    # Never repeat the generic Flipkart product tiering sentence
    for d in demos:
        assert d["strategic_interpretation"] != "Shifts competitive dynamic against Flipkart's current product tiering."


def test_url_validation_and_primary_source_integrity():
    """Verify Section 14: Evidence Link & Source Document Fix."""
    # 1. Valid URLs pass
    assert change_detection_engine.validate_source_url("https://sell.amazon.in/pricing") == "https://sell.amazon.in/pricing"
    assert change_detection_engine.validate_source_url("https://netflixtechblog.com/announcing-conductor") == "https://netflixtechblog.com/announcing-conductor"
    assert change_detection_engine.validate_source_url("https://blog.cloudflare.com/workers-ai-streaming/") == "https://blog.cloudflare.com/workers-ai-streaming/"
    assert change_detection_engine.validate_source_url("https://aws.amazon.com/blogs/mobile/amplify-gen2/") == "https://aws.amazon.com/blogs/mobile/amplify-gen2/"

    # 2. Invalid, placeholder, or broken URLs are strictly rejected
    assert change_detection_engine.validate_source_url(None) is None
    assert change_detection_engine.validate_source_url("") is None
    assert change_detection_engine.validate_source_url("#") is None
    assert change_detection_engine.validate_source_url("javascript:void(0)") is None
    assert change_detection_engine.validate_source_url("Source document unavailable.") is None
    assert change_detection_engine.validate_source_url("https://amazon_india.com/pricing") is None  # invalid underscore in hostname
    assert change_detection_engine.validate_source_url("https://example.com/updates/1") is None  # placeholder pattern

    # 3. Authentic primary sources for required competitors
    netflix_pricing = change_detection_engine.get_authentic_competitor_url("Netflix", "pricing")
    assert netflix_pricing and "netflix.com" in netflix_pricing and change_detection_engine.validate_source_url(netflix_pricing)

    netflix_launch = change_detection_engine.get_authentic_competitor_url("Netflix", "launch")
    assert netflix_launch and "netflixtechblog.com" in netflix_launch and change_detection_engine.validate_source_url(netflix_launch)

    cf_pricing = change_detection_engine.get_authentic_competitor_url("Cloudflare", "pricing")
    assert cf_pricing and "cloudflare.com" in cf_pricing and change_detection_engine.validate_source_url(cf_pricing)

    cf_launch = change_detection_engine.get_authentic_competitor_url("Cloudflare", "launch")
    assert cf_launch and "cloudflare.com" in cf_launch and change_detection_engine.validate_source_url(cf_launch)

    amplify_pricing = change_detection_engine.get_authentic_competitor_url("AWS Amplify", "pricing")
    assert amplify_pricing and "aws.amazon.com" in amplify_pricing and change_detection_engine.validate_source_url(amplify_pricing)

    amplify_launch = change_detection_engine.get_authentic_competitor_url("AWS Amplify", "launch")
    assert amplify_launch and "aws.amazon.com" in amplify_launch and change_detection_engine.validate_source_url(amplify_launch)

    # 4. Amazon India demonstration scenarios URLs must all be valid and authentic
    demos = change_detection_engine.get_demo_demonstration_scenarios("Amazon India", target_company="Flipkart")
    for card in demos:
        for sig in card["signals_evidence"]:
            url = sig.get("url")
            assert url is not None, f"Signal {sig.get('title')} is missing URL"
            validated = change_detection_engine.validate_source_url(url)
            assert validated is not None, f"Signal URL '{url}' is invalid or contains malformed hostname"
            assert "_" not in validated.split("/")[2], f"Hostname in '{url}' contains illegal underscore"

