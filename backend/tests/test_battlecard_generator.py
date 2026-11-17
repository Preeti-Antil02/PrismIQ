"""
Unit and integration tests for BattlecardGenerator:
- 10-block template structure
- Grounded extraction with Fact -> Impact -> Act
- Strict 'Unknown' handling for unverified or unavailable evidence
- Multi-audience support (sales, product, marketing, executive)
- Evidence linking
"""

import pytest
import uuid
from src.battlecard_generator import BattlecardGenerator, BATTLECARD_BLOCK_DEFINITIONS
from src import battlecard_storage, storage


def test_battlecard_generation_10_blocks_and_claims():
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)

    # Generate battlecard for a canonical competitor with existing profile & changes
    card = generator.generate_battlecard(
        company_name="Vercel",
        audience="sales",
        segment="general",
        force_refresh=True,
    )

    assert card is not None
    assert card["company_name"] == "Vercel"
    assert card["status"] == "draft"
    assert card["audience"] == "sales"
    assert "blocks" in card

    # Verify all 10 canonical blocks exist
    blocks = card["blocks"]
    block_keys = [b["block_key"] for b in blocks]
    assert len(block_keys) == 10
    expected_keys = [
        "snapshot_positioning",
        "product_icp",
        "where_they_win",
        "where_we_win",
        "strengths_weaknesses",
        "objections_responses",
        "discovery_questions",
        "pricing_comparison",
        "proof_points",
        "recent_changes",
    ]
    for key in expected_keys:
        assert key in block_keys, f"Missing block key: {key}"

    # Verify blocks have resolved claims
    for b in blocks:
        assert "claims" in b
        assert len(b["claims"]) >= 1
        for clm in b["claims"]:
            assert "statement" in clm
            assert "fact_impact_act" in clm
            fia = clm["fact_impact_act"]
            assert "fact" in fia
            assert "impact" in fia
            assert "act" in fia
            assert "evidence" in clm


def test_battlecard_unknown_handling_for_empty_competitor():
    """
    Strict Non-Negotiable Rule:
    Never invent our company's strengths, competitor capabilities, pricing or customer wins.
    If information is unavailable, explicitly return Unknown.
    """
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)

    # Generate battlecard for a completely blank unknown competitor with NO prior profile or events
    blank_comp = "CompletelyBlankEntityXYZ"
    card = generator.generate_battlecard(
        company_name=blank_comp,
        audience="sales",
        segment="general",
        force_refresh=True,
    )

    assert card is not None
    blocks_by_key = {b["block_key"]: b for b in card["blocks"]}

    # 1. Snapshot Positioning: statement should be Unknown
    snap_content = blocks_by_key["snapshot_positioning"]["content"]
    assert snap_content["positioning_statement"] == "Unknown"

    # 2. Where Our Company Wins: statement must be Unknown
    www_claims = blocks_by_key["where_we_win"]["claims"]
    assert any(c["statement"] == "Unknown" and c["verification_status"] == "unknown" for c in www_claims)

    # 3. Pricing Comparison: model should be Unknown
    price_content = blocks_by_key["pricing_comparison"]["content"]
    assert price_content["pricing_model"] == "Unknown"

    # 4. Proof points: statement must be Unknown
    proof_claims = blocks_by_key["proof_points"]["claims"]
    assert any(c["statement"] == "Unknown" and c["verification_status"] == "unknown" for c in proof_claims)


def test_multi_audience_battlecard_generation():
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)

    audiences = ["sales", "product", "marketing", "executive"]
    for aud in audiences:
        card = generator.generate_battlecard(
            company_name="Netlify",
            audience=aud,
            segment="enterprise",
            force_refresh=True,
        )
        assert card["audience"] == aud
        assert card["segment"] == "enterprise"
        assert len(card["blocks"]) == 10
        assert f"{aud.capitalize()} Battlecard" in card["title"]


def test_evidence_grounding_and_traceability():
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)

    card = generator.generate_battlecard(
        company_name="Vercel",
        audience="sales",
        segment="general",
        force_refresh=True,
    )

    # Check evidence drawer items across claims
    total_evidence_count = 0
    for b in card["blocks"]:
        for clm in b["claims"]:
            if clm.get("verification_status") == "verified":
                ev_list = clm.get("evidence", [])
                assert len(ev_list) >= 1
                for ev in ev_list:
                    assert "source_url" in ev
                    assert ev["source_url"].startswith("http")
                    assert "relationship" in ev
                    total_evidence_count += 1

    assert total_evidence_count >= 5
