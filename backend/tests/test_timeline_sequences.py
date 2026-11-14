import pytest
import json
from pathlib import Path
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import storage

client = TestClient(app)

@pytest.fixture(autouse=True)
def preserve_timeline_sequences():
    data_dir = storage._get_data_dir()
    seq_file = data_dir / "timeline_sequences.json"
    backup = None
    if seq_file.exists():
        with open(seq_file, "r", encoding="utf-8") as f:
            backup = f.read()
    yield
    if backup is not None:
        with open(seq_file, "w", encoding="utf-8") as f:
            f.write(backup)

def test_timeline_sequences_authenticated():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/timeline/sequences", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "sequences" in data
    assert data["count"] >= 3
    
    # Verify the Netlify Enterprise Expansion sequence is detected
    netlify_seq = next((s for s in data["sequences"] if s["company_name"] == "Netlify"), None)
    assert netlify_seq is not None
    assert netlify_seq["pattern_name"] == "Enterprise Market Expansion"
    assert netlify_seq["confidence"] >= 90.0
    assert netlify_seq["potential_impact"] == "High"
    assert len(netlify_seq["sequence_steps"]) == 6

def test_timeline_sequences_filter_by_company():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/timeline/sequences?company=Netlify", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all(s["company_name"].lower() == "netlify" for s in data["sequences"])
    assert data["count"] >= 1

def test_company_timeline_sequences_direct_endpoint():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/timeline/sequences/Vercel", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Vercel"
    assert len(data["sequences"]) >= 1
    vercel_seq = data["sequences"][0]
    assert vercel_seq["pattern_name"] == "AI-Native Pivot & Agentic Positioning"
    assert len(vercel_seq["sequence_steps"]) >= 5

def test_timeline_sequence_step_schema_and_integrity():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/timeline/sequences?company=Netlify", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    steps = res.json()["sequences"][0]["sequence_steps"]
    
    # Step 1: Hiring
    assert steps[0]["step_number"] == 1
    assert steps[0]["dimension"] == "hiring"
    assert "Enterprise Sales Leadership" in steps[0]["event_title"]
    assert "Strategic Accounts" in steps[0]["evidence_excerpt"]
    
    # Step 2: Compliance / SOC2
    assert steps[1]["step_number"] == 2
    assert steps[1]["dimension"] == "compliance"
    assert "SOC2 Type II" in steps[1]["event_title"]
    
    # Step 3: Pricing
    assert steps[2]["step_number"] == 3
    assert steps[2]["dimension"] == "pricing"
    assert "Enterprise Pricing" in steps[2]["event_title"]
    
    # Step 4: Proof / Case Study
    assert steps[3]["step_number"] == 4
    assert "proof" in steps[3]["dimension"]
    assert "Case Study" in steps[3]["event_title"]
    
    # Step 5: GTM / Hiring
    assert steps[4]["step_number"] == 5
    assert "Account Executives" in steps[4]["event_title"]
    
    # Step 6: Alliance
    assert steps[5]["step_number"] == 6
    assert steps[5]["dimension"] == "partnerships"
    assert "Alliance" in steps[5]["event_title"]

def test_create_timeline_sequence_endpoint():
    token = _create_jwt_token("11111111-2222-3333-4444-555555555555", "enterprise_lead@corp.com")
    payload = {
        "company_name": "Supabase",
        "pattern_name": "Multi-Region Enterprise Consolidation",
        "pattern_type": "strategic_expansion",
        "time_horizon": "4-Month Sequence",
        "confidence": 92.5,
        "potential_impact": "High",
        "strategic_interpretation": "Supabase added HIPAA compliance and dedicated enterprise instance routing across multiple cloud regions.",
        "recommended_action": "Highlight self-hosted open-source compliance posture and zero-vendor-lockin guarantees.",
        "sequence_steps": [
            {
                "step_number": 1,
                "month": "Jan 2026",
                "dimension": "compliance",
                "event_title": "HIPAA BAA Available for Pro & Team Plans",
                "evidence_excerpt": "Signed Business Associate Agreements now available on self-service enterprise plans.",
                "evidence_url": "https://supabase.com/blog/hipaa-compliance",
                "signals_count": 3
            },
            {
                "step_number": 2,
                "month": "Feb 2026",
                "dimension": "pricing",
                "event_title": "Dedicated Enterprise Instances Introduced",
                "evidence_excerpt": "Dedicated compute clusters with custom SLA options for Fortune 500 customers.",
                "evidence_url": "https://supabase.com/pricing",
                "signals_count": 2
            }
        ]
    }
    res = client.post("/timeline/sequences", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["sequence"]["company_name"] == "Supabase"
    assert body["sequence"]["pattern_name"] == "Multi-Region Enterprise Consolidation"

def test_timeline_sequences_security_unauthenticated():
    # Fails closed without Authorization header
    res = client.get("/timeline/sequences")
    assert res.status_code == 401
    assert "Missing Authorization" in res.json().get("detail", "")

    res_co = client.get("/timeline/sequences/Netlify")
    assert res_co.status_code == 401
    assert "Missing Authorization" in res_co.json().get("detail", "")

    res_post = client.post("/timeline/sequences", json={"company_name": "Hacker"})
    assert res_post.status_code == 401
