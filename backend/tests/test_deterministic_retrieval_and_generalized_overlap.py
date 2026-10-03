"""
Tests for Deterministic Retrieval and Generalized Orthogonal Industry Filtering.
"""

import pytest
from src import discovery_agent, discovery_cache, search_provider


def test_persistent_cache_roundtrip():
    """Verify that query results and company context persist in SQLite cache."""
    test_comp = "test_acme_obscure"
    test_query = "test_acme_obscure competitors alternatives"
    mock_results = [
        {"title": "Comp 1", "url": "https://comp1.com", "snippet": "Direct competitor", "provider": "test"},
        {"title": "Comp 2", "url": "https://comp2.com", "snippet": "Alternative software", "provider": "test"},
    ]

    # Clear any previous test data
    discovery_cache.clear_cache_for_company(test_comp)

    # Initially cache miss
    cached = discovery_cache.get_cached_query_results(test_comp, test_query)
    assert cached is None

    # Write to cache
    discovery_cache.set_cached_query_results(test_comp, test_query, mock_results, ttl_seconds=3600)

    # Now cache hit
    cached_hit = discovery_cache.get_cached_query_results(test_comp, test_query)
    assert cached_hit is not None
    assert len(cached_hit) == 2
    assert cached_hit[0]["title"] == "Comp 1"
    assert cached_hit[1]["url"] == "https://comp2.com"

    # Clean up
    discovery_cache.clear_cache_for_company(test_comp)


def test_generalized_orthogonal_industry_rejection():
    """
    Verify that unlisted orthogonal industries (logistics, insurance, agriculture)
    are rejected by the generalized capability overlap logic, while true competitors pass.
    """
    eveo_profile = {
        "company_name": "EveoAI",
        "summary": "AI interview coaching, personal fashion styling, AR/VR speaking platform.",
        "segments": [
            {"name": "AI Interview & Communication Coaching", "what_it_does": "mock interviews with micro-expression feedback and speech analysis"},
            {"name": "AI Personal Styling & Fashion", "what_it_does": "outfit recommendation and personal wardrobe styling"},
            {"name": "Enterprise Behavioral Assessment", "what_it_does": "video interview screening and psychometric analysis"},
            {"name": "AR/VR Simulation Training", "what_it_does": "virtual reality executive presentation and public speaking rehearsal"}
        ]
    }

    # Novel orthogonal case 1: Logistics / parcel courier
    delhivery_res = discovery_agent._check_segment_overlap(
        candidate_name="Delhivery",
        category="Logistics & Express Courier",
        rationale="Enterprise freight delivery, logistics tracking and express parcel courier",
        matched_segment=None,
        target_profile=eveo_profile
    )
    assert delhivery_res[0] is False, f"Delhivery should be rejected by generalized overlap, got {delhivery_res}"

    # Novel orthogonal case 2: Insurance marketplace
    policybazaar_res = discovery_agent._check_segment_overlap(
        candidate_name="PolicyBazaar",
        category="Insurance Aggregator & Brokerage",
        rationale="Comparison marketplace for term life, health, auto insurance policies",
        matched_segment=None,
        target_profile=eveo_profile
    )
    assert policybazaar_res[0] is False, f"PolicyBazaar should be rejected by generalized overlap, got {policybazaar_res}"

    # Novel orthogonal case 3: Agriculture / farming machinery
    deere_res = discovery_agent._check_segment_overlap(
        candidate_name="John Deere",
        category="Agriculture & Farm Machinery",
        rationale="Autonomous tractors, harvest equipment and agritech precision farming",
        matched_segment=None,
        target_profile=eveo_profile
    )
    assert deere_res[0] is False, f"John Deere should be rejected by generalized overlap, got {deere_res}"

    # Healthcare case (Practo)
    practo_res = discovery_agent._check_segment_overlap(
        candidate_name="Practo",
        category="Healthcare Booking",
        rationale="Online doctor appointment booking and medical consultation platform",
        matched_segment="AI Interview & Communication Coaching",
        target_profile=eveo_profile
    )
    assert practo_res[0] is False, f"Practo should be rejected, got {practo_res}"

    # Genuine competitor cases (Must pass)
    yoodli_res = discovery_agent._check_segment_overlap(
        candidate_name="Yoodli",
        category="AI Speech & Interview Coach",
        rationale="Real-time speech coaching and mock interview feedback",
        matched_segment="AI Interview & Communication Coaching",
        target_profile=eveo_profile
    )
    assert yoodli_res[0] is True, f"Yoodli should pass, got {yoodli_res}"
    assert yoodli_res[1] == "AI Interview & Communication Coaching"

    stitch_res = discovery_agent._check_segment_overlap(
        candidate_name="Stitch Fix",
        category="Personal Styling Service",
        rationale="Personal wardrobe styling and AI outfit curation",
        matched_segment="AI Personal Styling & Fashion",
        target_profile=eveo_profile
    )
    assert stitch_res[0] is True, f"Stitch Fix should pass, got {stitch_res}"
