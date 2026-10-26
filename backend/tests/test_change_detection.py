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
