"""
Comprehensive multi-tenant validation test suite for PrismIQ.
Validates live flat-storage resolution, 6-month comparative landscape distribution,
strict competitor exclusion (no Apple Inc./Google LLC for Vercel),
and complete 6-dimension decision intelligence profiles across all 4 tenants.
"""

import pytest
from fastapi.testclient import TestClient
from src.api import app
from src.overview_service import get_overview_intelligence, get_intelligence_detail
import src.storage as storage


@pytest.fixture
def client():
    return TestClient(app)


TENANT_CONFIGS = [
    {
        "name": "Vercel",
        "tenant_id": "c8f13b91-46ef-4682-9975-f85764d8a12e",
        "expected_competitors": ["Cloudflare", "Netlify", "AWS Amplify"],
        "forbidden_competitors": ["Apple Inc.", "Google LLC", "Google Workspace"],
        "min_events": 200,
    },
    {
        "name": "OpenAI",
        "tenant_id": "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f",
        "expected_competitors": ["Anthropic", "Google DeepMind", "Mistral AI"],
        "forbidden_competitors": ["Apple Inc.", "Google LLC"],
        "min_events": 100,
    },
    {
        "name": "Flipkart",
        "tenant_id": "7b90477d-2524-4cf9-8e47-f389ec890ff7",
        "expected_competitors": ["Amazon India", "Meesho", "Reliance Retail"],
        "forbidden_competitors": ["Apple Inc."],
        "min_events": 15,
    },
    {
        "name": "Meesho",
        "tenant_id": "8553449a-c998-4727-be01-9aeb724038cb",
        "expected_competitors": ["Amazon India", "Flipkart", "Shopsy"],
        "forbidden_competitors": ["Apple Inc."],
        "min_events": 50,
    },
]


def test_vercel_overview_full_validation():
    """Verify Vercel has rich events, authentic competitors, and zero Apple/Google LLC pollution."""
    res = get_overview_intelligence("Vercel", time_range="6m", tenant_id="c8f13b91-46ef-4682-9975-f85764d8a12e")
    assert res["target_company"] == "Vercel"
    assert res["metrics"]["verified_events"]["value"] >= 200
    assert res["metrics"]["high_priority_developments"]["value"] > 0
    assert res["metrics"]["pending_actions"]["value"] >= 3
    assert res["metrics"]["tracked_competitors"]["value"] == 5

    landscape = res["competitive_landscape"]
    assert landscape["has_data"] is True
    assert len(landscape["months"]) == 6
    assert len(landscape["chart_data"]) == 6

    comps = landscape["competitors"]
    assert "Vercel" in comps
    assert "Cloudflare" in comps
    assert "Netlify" in comps
    assert "Apple Inc." not in comps
    assert "Google LLC" not in comps
    assert "Google Workspace" not in comps

    # Ensure monthly distribution has positive volume across chart
    total_chart_events = sum(
        sum(v for k, v in row.items() if k != "month")
        for row in landscape["chart_data"]
    )
    assert total_chart_events > 0

    # Emerging strategic patterns
    patterns = res["emerging_strategic_patterns"]
    assert len(patterns) >= 2
    for p in patterns:
        assert p["title"]
        assert len(p["companies"]) >= 1
        assert p["related_events_count"] > 0
        assert p["visual_type"] in ("isometric_cube", "isometric_stack", "trend_blocks")

    # Next best actions
    actions = res["next_best_actions"]
    assert len(actions) >= 3
    for act in actions:
        assert act["department"] in ("Engineering", "Sales", "Leadership", "Product", "Strategy")
        assert act["priority_level"] in ("Critical", "High", "Medium", "Low")
        assert act["due_date"]


def test_openai_overview_full_validation():
    """Verify OpenAI overview contains Anthropic, DeepMind, Mistral and full 6-month chart."""
    res = get_overview_intelligence("OpenAI", time_range="6m", tenant_id="6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f")
    assert res["target_company"] == "OpenAI"
    assert res["metrics"]["verified_events"]["value"] >= 100
    assert res["metrics"]["high_priority_developments"]["value"] > 0
    assert res["metrics"]["pending_actions"]["value"] >= 3

    landscape = res["competitive_landscape"]
    assert landscape["has_data"] is True
    comps = landscape["competitors"]
    assert "OpenAI" in comps
    assert "Anthropic" in comps
    assert "Google DeepMind" in comps
    assert "Apple Inc." not in comps

    assert len(res["emerging_strategic_patterns"]) >= 2
    assert len(res["next_best_actions"]) >= 3


def test_flipkart_overview_full_validation():
    """Verify Flipkart overview contains Amazon India, Meesho, Reliance Retail and full 6-month chart."""
    res = get_overview_intelligence("Flipkart", time_range="6m", tenant_id="7b90477d-2524-4cf9-8e47-f389ec890ff7")
    assert res["target_company"] == "Flipkart"
    assert res["metrics"]["verified_events"]["value"] >= 15
    assert res["metrics"]["high_priority_developments"]["value"] > 0
    assert res["metrics"]["pending_actions"]["value"] >= 3

    landscape = res["competitive_landscape"]
    assert landscape["has_data"] is True
    comps = landscape["competitors"]
    assert "Flipkart" in comps
    assert "Amazon India" in comps
    assert "Meesho" in comps

    assert len(res["emerging_strategic_patterns"]) >= 2
    assert len(res["next_best_actions"]) >= 3


def test_meesho_overview_full_validation():
    """Verify Meesho overview contains Amazon India, Flipkart, Shopsy and full 6-month chart."""
    res = get_overview_intelligence("Meesho", time_range="6m", tenant_id="8553449a-c998-4727-be01-9aeb724038cb")
    assert res["target_company"] == "Meesho"
    assert res["metrics"]["verified_events"]["value"] >= 50
    assert res["metrics"]["high_priority_developments"]["value"] > 0
    assert res["metrics"]["pending_actions"]["value"] >= 3

    landscape = res["competitive_landscape"]
    assert landscape["has_data"] is True
    comps = landscape["competitors"]
    assert "Meesho" in comps
    assert "Amazon India" in comps
    assert "Flipkart" in comps

    assert len(res["emerging_strategic_patterns"]) >= 2
    assert len(res["next_best_actions"]) >= 3


@pytest.mark.parametrize("tenant", TENANT_CONFIGS)
def test_all_tenants_storage_load_events(tenant):
    """Verify storage.load_events loads real tenant event files with proper fields."""
    events = storage.load_events(tenant_id=tenant["tenant_id"])
    assert len(events) >= tenant["min_events"]
    sample = events[0]
    assert sample.get("event_id") or sample.get("id")
    assert sample.get("title")
    assert sample.get("company_name") or sample.get("company")


@pytest.mark.parametrize("tenant", TENANT_CONFIGS)
def test_all_tenants_storage_tracked_companies(tenant):
    """Verify tracked companies for each tenant match the expected target and competitors."""
    tracked = storage.get_tenant_tracked_companies(tenant["tenant_id"])
    assert len(tracked) >= 4
    cnames = [c["company_name"] for c in tracked]
    assert tenant["name"] in cnames
    for exp in tenant["expected_competitors"]:
        assert exp in cnames
    for forbidden in tenant["forbidden_competitors"]:
        assert forbidden not in cnames


def test_intelligence_detail_6_dimension_contract():
    """Verify intelligence detail contract matches the executive 6-dimension cockpit specification."""
    for detail_id, target in [
        ("cloudflare", "Vercel"),
        ("anthropic", "OpenAI"),
        ("amazon", "Flipkart"),
        ("flipkart", "Meesho"),
    ]:
        res = get_intelligence_detail(detail_id=detail_id, target_company=target)

        # Basic identity
        assert res["target_company"] == target
        assert res["competitor_name"]
        assert res["urgency_badge"] in ("Critical", "Critical Urgency", "High Urgency", "Medium Urgency", "Low Urgency", "High", "Medium", "Low")

        # Dimension 1: What Happened
        wh = res["what_happened"]
        assert wh["headline"]
        assert wh["published_date"]
        assert wh["paragraph"]
        assert len(res["exposed_target_products"]) >= 1

        # Dimension 2: Why It Matters
        wim = res["why_it_matters"]
        assert wim["key_impact"]
        matrix = wim.get("strategic_matrix") or wim.get("strategic_lens")
        assert matrix["affected_products"]
        assert matrix["overlapping_segments"]
        assert matrix["competitor_advantage"]
        assert matrix["business_risk"]
        assert matrix["supporting_evidence"]
        assert matrix["uncertain_assumptions"]

        # Dimension 3: Who Is Affected
        depts = res["who_is_affected"]["departments"]
        assert len(depts) == 4
        dept_names = {d["department"] for d in depts}
        assert {"Engineering", "Sales", "Leadership", "Product"}.issubset(dept_names)

        # Dimension 4: What Should We Do
        actions = res["what_should_we_do"]["actions"]
        assert len(actions) >= 3
        for act in actions:
            assert act["title"]
            assert act["department"]
            assert act["timeframe"]
            assert act.get("next_step")
            assert act["next_step"].startswith("Next:")

        # Dimension 5: Urgency & Time Horizon
        urg = res["urgency_and_time_horizon"]
        assert urg["time_horizon"]
        assert urg["priority_tier"]
        assert urg["cycle_review_due"]

        # Dimension 6: Verification & Confidence
        verif = res["verification_and_confidence"]
        assert verif["confidence_score"] > 0
        assert verif["verified_sources_count"] >= 1


def test_api_overview_cross_tenant_http(client):
    """Verify /api/overview HTTP endpoint returns 200 and populated data for each tenant."""
    for tenant in TENANT_CONFIGS:
        url = f"/api/overview?company={tenant['name']}&range=6m&tenant_id={tenant['tenant_id']}"
        res = client.get(url)
        assert res.status_code == 200, f"Failed for {tenant['name']}: {res.text}"
        data = res.json()
        assert data["target_company"] == tenant["name"]
        assert data["metrics"]["verified_events"]["value"] >= tenant["min_events"]
        assert data["competitive_landscape"]["has_data"] is True
        for forbidden in tenant["forbidden_competitors"]:
            assert forbidden not in data["competitive_landscape"]["competitors"]
