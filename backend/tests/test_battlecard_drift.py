"""
Unit and integration tests for Battlecard Drift Detection:
- Contradiction detection (capability launched, pricing changes)
- New evidence detection (benchmarks, certifications)
- Stale claim detection (>90 days old)
- Duplicate drift prevention
- Pipeline hook integration with storage.save_findings
"""

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from src.battlecard_drift import DriftDetector
from src import battlecard_storage, storage


def test_contradiction_detection_capability_launch():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    comp = "TestVercel"

    # Claim stating competitor lacks native SQL database querying
    claim = {
        "id": cid,
        "company_name": comp,
        "claim_type": "product_capability",
        "subject": "SQL Storage Database Support",
        "statement": "Lacks native SQL database querying and storage engine.",
        "fact_impact_act": {
            "fact": "Requires external Neon or Supabase integration.",
            "impact": "Customer incurs multi-vendor complexity.",
            "act": "Sell unified single-vendor database architecture.",
        },
        "status": "active",
        "verification_status": "verified",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    # New event announcing General Availability of native SQL storage
    event = {
        "event_id": "evt_sql_ga_999",
        "company_name": comp,
        "title": "Native SQL Storage & Database Engine Launches General Availability",
        "event_summary": "TestVercel announced general availability of native SQL database engine querying production tables directly.",
        "url": "https://testvercel.com/blog/sql-database-ga",
    }

    detector = DriftDetector(tenant_id=tenant_id)
    alerts = detector.detect_drift_for_event(event, company_name=comp)

    assert len(alerts) >= 1
    alert = alerts[0]
    assert alert["drift_type"] == "contradicted"
    assert alert["claim_id"] == cid
    assert "suggested_update" in alert
    sugg = alert["suggested_update"]
    assert "statement" in sugg
    assert "fact_impact_act" in sugg
    assert alert["review_status"] == "pending"


def test_pricing_contradiction_detection():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    comp = "TestNetlify"

    # Existing pricing claim
    claim = {
        "id": cid,
        "company_name": comp,
        "claim_type": "pricing_comparison",
        "subject": "TestNetlify Pricing Architecture",
        "statement": "Pricing Model: Strict $19/seat Pro with bandwidth overages.",
        "fact_impact_act": {
            "fact": "Tiered seat license.",
            "impact": "Unpredictable costs at scale.",
            "act": "Offer flat platform pricing.",
        },
        "status": "active",
        "verification_status": "verified",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    # Event announcing pricing restructure / free tier expansion
    event = {
        "event_id": "evt_price_drop_123",
        "company_name": comp,
        "title": "TestNetlify Pricing Update: Free Unlimited Team Members",
        "event_summary": "Major pricing update removing per-seat fees with free tier expansion.",
        "url": "https://testnetlify.com/pricing-revamp",
    }

    detector = DriftDetector(tenant_id=tenant_id)
    alerts = detector.detect_drift_for_event(event, company_name=comp)

    assert len(alerts) >= 1
    alert = alerts[0]
    assert alert["drift_type"] == "contradicted"
    assert "pricing" in alert["suggested_update"]["statement"].lower()


def test_new_evidence_corroboration_detection():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    comp = "TestFastly"

    # Existing strength claim
    claim = {
        "id": cid,
        "company_name": comp,
        "claim_type": "where_they_win",
        "subject": "Sub-millisecond Edge Cold Starts",
        "statement": "Fast edge compute startup latency.",
        "fact_impact_act": {
            "fact": "WebAssembly runtime executes cold starts under 1ms.",
            "impact": "Zero perceived cold start delay for end users.",
            "act": "Compete on developer ecosystem.",
        },
        "status": "active",
        "verification_status": "verified",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    # Fresh event providing empirical benchmark corroborating this claim
    event = {
        "event_id": "evt_bench_456",
        "company_name": comp,
        "title": "Independent Benchmark: Edge Latency Benchmarked Across 50 Locations",
        "event_summary": "Third-party audited benchmark verifies sub-millisecond edge cold start speed across 50 global POPs.",
        "url": "https://testfastly.com/benchmark-2026",
    }

    detector = DriftDetector(tenant_id=tenant_id)
    alerts = detector.detect_drift_for_event(event, company_name=comp)

    assert len(alerts) >= 1
    alert = alerts[0]
    assert alert["drift_type"] == "new_evidence"
    assert "Corroborated by:" in alert["suggested_update"]["statement"]


def test_stale_claim_detection():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    comp = "TestOldCorp"

    # Claim verified 120 days ago (stale threshold is 90 days)
    old_date = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()
    claim = {
        "id": cid,
        "company_name": comp,
        "claim_type": "product_capability",
        "subject": "Legacy REST API",
        "statement": "Relies exclusively on REST endpoints with no GraphQL support.",
        "status": "active",
        "last_verified_at": old_date,
    }
    battlecard_storage.save_claim(claim, tenant_id)

    detector = DriftDetector(tenant_id=tenant_id)
    stale_alerts = detector.detect_stale_claims(company_name=comp, stale_days_threshold=90)

    assert len(stale_alerts) >= 1
    alert = stale_alerts[0]
    assert alert["drift_type"] == "stale"
    assert alert["claim_id"] == cid
    assert "Verification expired" in alert["new_evidence_excerpt"]


def test_drift_alert_idempotent_deduplication():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    comp = "TestDedupCo"

    claim = {
        "id": cid,
        "company_name": comp,
        "claim_type": "product_capability",
        "subject": "Database Support",
        "statement": "Lacks native database integration.",
        "status": "active",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    event = {
        "event_id": "evt_repeated_111",
        "company_name": comp,
        "title": "Native Database Engine Launches GA",
        "event_summary": "Competitor launches native database engine.",
        "url": "https://testdedup.com/launch",
    }

    detector = DriftDetector(tenant_id=tenant_id)
    first_run_alerts = detector.detect_drift_for_event(event, company_name=comp)
    assert len(first_run_alerts) == 1

    # Running detection again on identical event must NOT create a duplicate alert
    second_run_alerts = detector.detect_drift_for_event(event, company_name=comp)
    assert len(second_run_alerts) == 0

    all_alerts = battlecard_storage.get_claim_drift_alerts(tenant_id=tenant_id, company_name=comp)
    assert len(all_alerts) == 1


def test_pipeline_save_findings_triggers_drift_detection():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    comp = "PipelineHookComp"

    # Pre-existing claim
    claim = {
        "id": cid,
        "company_name": comp,
        "claim_type": "product_capability",
        "subject": "SOC2 Certification",
        "statement": "Lacks SOC2 Type II compliance audit certification.",
        "status": "active",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    # Simulate pipeline findings being persisted via storage.save_findings
    finding = {
        "event_id": "evt_soc2_pipeline_777",
        "company_name": comp,
        "company": comp,
        "title": "SOC2 Type II Audit Certification Launches",
        "why_it_matters": "Achieved official SOC2 compliance audit certification.",
        "url": "https://pipelinehook.com/soc2",
    }

    # Save findings
    storage.save_findings([finding], tenant_id=tenant_id)

    # Verify drift alert was generated via hook
    alerts = battlecard_storage.get_claim_drift_alerts(tenant_id=tenant_id, company_name=comp)
    assert len(alerts) >= 1
    assert any(a["claim_id"] == cid for a in alerts)
