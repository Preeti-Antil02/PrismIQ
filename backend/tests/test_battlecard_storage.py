"""
Unit and integration tests for battlecard_storage:
- Claim registry and evidence linking
- Battlecard blocks and drafts
- Immutable publishing and revisions
- Deduplication of drift alerts
- Human review action audit log
- Shared claim propagation to draft battlecards
- Tenant isolation
"""

import pytest
import uuid
from src import battlecard_storage, storage


def test_claim_crud_and_evidence_association():
    tenant_1 = str(uuid.uuid4())
    cid = str(uuid.uuid4())

    # 1. Save claim
    claim_dict = {
        "id": cid,
        "company_name": "TestCompetitor",
        "claim_type": "product_capability",
        "subject": "SQL Engine Latency",
        "statement": "Queries execute under 500ms over columnar tables.",
        "fact_impact_act": {
            "fact": "Queries execute under 500ms over columnar tables.",
            "impact": "Reduces customer warehouse query latency.",
            "act": "Highlight our distributed streaming pipeline.",
        },
        "status": "active",
        "confidence": "High",
        "verification_status": "verified",
    }
    saved = battlecard_storage.save_claim(claim_dict, tenant_1)
    assert saved["id"] == cid
    assert saved["company_name"] == "TestCompetitor"
    assert saved["fact_impact_act"]["fact"] == claim_dict["statement"]

    # 2. Retrieve claim
    retrieved = battlecard_storage.get_claim(cid, tenant_1)
    assert retrieved is not None
    assert retrieved["statement"] == claim_dict["statement"]

    # 3. Save evidence
    ev_dict = {
        "claim_id": cid,
        "source_url": "https://testcompetitor.com/benchmark",
        "source_title": "Benchmark Report",
        "excerpt": "Official audited benchmark showing sub-500ms p95 latency.",
        "relationship": "supports",
        "source_quality": "primary",
    }
    saved_ev = battlecard_storage.save_claim_evidence(ev_dict, tenant_1)
    assert saved_ev["claim_id"] == cid

    # 4. Retrieve evidence
    evidence_list = battlecard_storage.get_claim_evidence(cid, tenant_1)
    assert len(evidence_list) == 1
    assert evidence_list[0]["source_url"] == "https://testcompetitor.com/benchmark"
    assert evidence_list[0]["relationship"] == "supports"


def test_battlecard_draft_editing_and_publishing():
    tenant_id = str(uuid.uuid4())
    bid = str(uuid.uuid4())

    # 1. Create battlecard
    card = {
        "id": bid,
        "company_name": "Vercel",
        "title": "Vercel Sales Battlecard",
        "audience": "sales",
        "segment": "general",
        "status": "draft",
        "current_version": 1,
    }
    saved_card = battlecard_storage.save_battlecard(card, tenant_id)
    assert saved_card["status"] == "draft"

    # 2. Create block
    block = {
        "battlecard_id": bid,
        "block_key": "where_they_win",
        "block_title": "Where They Win",
        "block_order": 3,
        "content": {"items": [{"statement": "Next.js ecosystem dominance"}]},
        "claim_ids": [],
    }
    battlecard_storage.save_battlecard_block(block, tenant_id)

    # 3. Edit block
    updated_block = battlecard_storage.update_battlecard_block(
        battlecard_id=bid,
        block_key="where_they_win",
        updates={"content": {"items": [{"statement": "Next.js ecosystem dominance and global Edge Network"}]}},
        tenant_id=tenant_id,
    )
    assert updated_block is not None
    assert "global Edge Network" in updated_block["content"]["items"][0]["statement"]

    # 4. Publish battlecard
    pub_res = battlecard_storage.publish_battlecard(
        battlecard_id=bid,
        tenant_id=tenant_id,
        published_by="senior_analyst",
        change_summary="Initial verified Q4 publication",
    )
    assert pub_res["battlecard"]["status"] == "published"
    assert pub_res["battlecard"]["published_version"] == 1
    assert pub_res["battlecard"]["current_version"] == 2
    assert pub_res["revision"]["version"] == 1
    assert pub_res["revision"]["published_by"] == "senior_analyst"

    # 5. Check immutable revision history
    revisions = battlecard_storage.get_battlecard_revisions(bid, tenant_id)
    assert len(revisions) == 1
    assert revisions[0]["version"] == 1
    assert revisions[0]["change_summary"] == "Initial verified Q4 publication"


def test_drift_deduplication_and_review_workflow():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())

    # 1. Create base claim
    claim = {
        "id": cid,
        "company_name": "Netlify",
        "claim_type": "product_capability",
        "subject": "Database Integration",
        "statement": "Lacks native SQL database querying.",
        "fact_impact_act": {
            "fact": "Netlify requires third-party database connectors.",
            "impact": "Customer must manage separate database infrastructure.",
            "act": "Offer bundled database architecture.",
        },
        "status": "active",
        "verification_status": "verified",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    # 2. Create drift alert
    alert_1 = {
        "claim_id": cid,
        "company_name": "Netlify",
        "drift_type": "contradicted",
        "trigger_event_id": "evt_12345",
        "new_evidence_excerpt": "Netlify launches native DB queries GA.",
        "new_evidence_url": "https://netlify.com/blog/native-db",
        "suggested_update": {
            "statement": "Netlify now provides native database querying capabilities.",
            "fact_impact_act": {
                "fact": "Netlify launched native DB queries GA.",
                "impact": "Directly counters previous limitation.",
                "act": "Emphasize enterprise governance and ACID compliance.",
            },
        },
        "review_status": "pending",
    }
    saved_alert, is_new = battlecard_storage.save_claim_drift_alert(alert_1, tenant_id)
    assert is_new is True
    assert saved_alert["review_status"] == "pending"

    # 3. Test duplicate prevention: same claim and event should NOT create a second alert
    saved_again, is_new_again = battlecard_storage.save_claim_drift_alert(alert_1, tenant_id)
    assert is_new_again is False
    assert saved_again["id"] == saved_alert["id"]

    # 4. Review action: accept update
    review_res = battlecard_storage.record_claim_review_action(
        alert_id=saved_alert["id"],
        tenant_id=tenant_id,
        action="accept",
        reviewer="lead_analyst",
        notes="Verified via release notes",
    )
    assert review_res["alert"]["review_status"] == "accepted"
    assert review_res["review_action"]["action"] == "accept"
    assert review_res["review_action"]["reviewer"] == "lead_analyst"

    # 5. Verify claim was updated with suggested statement and new evidence was linked
    updated_claim = battlecard_storage.get_claim(cid, tenant_id)
    assert "now provides native database querying" in updated_claim["statement"]
    assert updated_claim["verification_status"] == "verified"

    linked_ev = battlecard_storage.get_claim_evidence(cid, tenant_id)
    assert any(e["source_url"] == "https://netlify.com/blog/native-db" for e in linked_ev)


def test_shared_claim_propagation_to_draft_blocks():
    tenant_id = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    bid = str(uuid.uuid4())

    # 1. Create claim
    claim = {
        "id": cid,
        "company_name": "Cloudflare",
        "claim_type": "where_they_win",
        "subject": "Global Edge PoPs",
        "statement": "Over 300 global edge points of presence.",
        "fact_impact_act": {"fact": "300 PoPs", "impact": "Low latency", "act": "Compete on developer tooling"},
        "status": "active",
    }
    battlecard_storage.save_claim(claim, tenant_id)

    # 2. Create battlecard and draft block referencing this claim
    card = {
        "id": bid,
        "company_name": "Cloudflare",
        "audience": "sales",
        "segment": "general",
        "status": "draft",
    }
    battlecard_storage.save_battlecard(card, tenant_id)

    block = {
        "battlecard_id": bid,
        "block_key": "where_they_win",
        "block_title": "Where They Win",
        "block_order": 3,
        "content": {
            "items": [
                {
                    "claim_id": cid,
                    "statement": "Over 300 global edge points of presence.",
                    "fact_impact_act": {"fact": "300 PoPs", "impact": "Low latency", "act": "Compete on developer tooling"},
                }
            ]
        },
        "claim_ids": [cid],
    }
    battlecard_storage.save_battlecard_block(block, tenant_id)

    # 3. Update claim and propagate
    updated_claim = dict(claim)
    updated_claim["statement"] = "Over 330 global edge points of presence across 120 countries."
    updated_claim["fact_impact_act"]["fact"] = "330 PoPs"

    count = battlecard_storage.propagate_claim_update_to_battlecards(cid, updated_claim, tenant_id)
    assert count == 1

    # 4. Verify draft block was updated
    blocks = battlecard_storage.get_battlecard_blocks(bid, tenant_id)
    assert len(blocks) == 1
    assert "330 global edge points" in blocks[0]["content"]["items"][0]["statement"]


def test_tenant_isolation_in_claims_and_battlecards():
    tenant_A = str(uuid.uuid4())
    tenant_B = str(uuid.uuid4())

    cid_A = str(uuid.uuid4())
    bid_A = str(uuid.uuid4())

    # Tenant A creates claim and battlecard
    battlecard_storage.save_claim({
        "id": cid_A,
        "company_name": "CompetitorA",
        "statement": "Confidential claim for Tenant A",
    }, tenant_A)

    battlecard_storage.save_battlecard({
        "id": bid_A,
        "company_name": "CompetitorA",
        "title": "Tenant A Exclusive Battlecard",
    }, tenant_A)

    # Tenant B should NOT be able to see Tenant A's claim or battlecard
    assert battlecard_storage.get_claim(cid_A, tenant_B) is None
    assert battlecard_storage.get_battlecard(battlecard_id=bid_A, tenant_id=tenant_B) is None
    assert len(battlecard_storage.get_claims(tenant_B, company_name="CompetitorA")) == 0
