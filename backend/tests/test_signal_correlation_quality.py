"""
PrismIQ - Point 4 Quality, Data Integrity & Strategic Reasoning Test Suite
Deterministic validation of Signal Correlation Engine & Strategic Implication Pipeline.
"""

import pytest
from typing import List, Dict, Any
from backend.src import signal_correlation_engine as sce
from backend.src import storage


class TestSignalCorrelationDataIntegrity:
    """Verifies strict isolation, lack of AI/synthetic generation, and grounding."""

    def test_competitor_signal_strict_isolation(self):
        """Signals for Anthropic, Google DeepMind, and Meta AI must never share IDs, URLs, or excerpts."""
        anthropic_corr = sce.correlate_signals_for_competitor("Anthropic", target_company="OpenAI")
        deepmind_corr = sce.correlate_signals_for_competitor("Google DeepMind", target_company="OpenAI")
        meta_corr = sce.correlate_signals_for_competitor("Meta AI", target_company="OpenAI")

        assert len(anthropic_corr) == 1
        assert len(deepmind_corr) == 1
        assert len(meta_corr) == 1

        anthropic_sigs = anthropic_corr[0]["signals_cluster"]
        deepmind_sigs = deepmind_corr[0]["signals_cluster"]
        meta_sigs = meta_corr[0]["signals_cluster"]

        anthropic_titles = {s["title"] for s in anthropic_sigs}
        deepmind_titles = {s["title"] for s in deepmind_sigs}
        meta_titles = {s["title"] for s in meta_sigs}

        # Sets of titles must be mutually exclusive (zero cross-contamination)
        assert anthropic_titles.isdisjoint(deepmind_titles), "Anthropic and DeepMind share signal titles!"
        assert anthropic_titles.isdisjoint(meta_titles), "Anthropic and Meta AI share signal titles!"
        assert deepmind_titles.isdisjoint(meta_titles), "DeepMind and Meta AI share signal titles!"

        anthropic_urls = {s["url"] for s in anthropic_sigs}
        deepmind_urls = {s["url"] for s in deepmind_sigs}
        meta_urls = {s["url"] for s in meta_sigs}

        assert anthropic_urls.isdisjoint(deepmind_urls), "Anthropic and DeepMind share source URLs!"
        assert anthropic_urls.isdisjoint(meta_urls), "Anthropic and Meta AI share source URLs!"
        assert deepmind_urls.isdisjoint(meta_urls), "DeepMind and Meta AI share source URLs!"

    def test_distinct_categories_across_ai_competitors(self):
        """Competitors must have independent, accurate categories reflecting actual moves."""
        anthropic_cat = sce.correlate_signals_for_competitor("Anthropic", target_company="OpenAI")[0]["correlation_category"]
        deepmind_cat = sce.correlate_signals_for_competitor("Google DeepMind", target_company="OpenAI")[0]["correlation_category"]
        meta_cat = sce.correlate_signals_for_competitor("Meta AI", target_company="OpenAI")[0]["correlation_category"]

        # Must all be valid canonical categories
        assert anthropic_cat in sce.CORRELATION_CATEGORIES
        assert deepmind_cat in sce.CORRELATION_CATEGORIES
        assert meta_cat in sce.CORRELATION_CATEGORIES

        # None of them should be identical
        categories = {anthropic_cat, deepmind_cat, meta_cat}
        assert len(categories) == 3, f"Expected 3 distinct categories, got: {categories}"

    def test_no_marketplace_logistics_category_for_ai(self):
        """AI competitors must NEVER be assigned 'Marketplace & Logistics Scale' or 'marketplace_expansion'."""
        for comp in ["Anthropic", "Google DeepMind", "Meta AI"]:
            res = sce.correlate_signals_for_competitor(comp, target_company="OpenAI")
            assert len(res) > 0
            cat = res[0]["correlation_category"]
            cat_slug = res[0].get("correlation_category_slug", "")
            assert cat != "Marketplace Expansion"
            assert cat != "Logistics & Operations"
            assert cat_slug != "marketplace_expansion"
            assert cat_slug != "logistics_operations"

    def test_independent_corroboration_and_confidence_scoring(self):
        """Corroboration and Confidence must be independently calculated, not hardcoded 94% or 91%."""
        anthropic = sce.correlate_signals_for_competitor("Anthropic", target_company="OpenAI")[0]
        deepmind = sce.correlate_signals_for_competitor("Google DeepMind", target_company="OpenAI")[0]
        meta = sce.correlate_signals_for_competitor("Meta AI", target_company="OpenAI")[0]

        # Ensure scores are between 0 and 100
        for entity in [anthropic, deepmind, meta]:
            assert 0 <= entity["corroboration_score"] <= 100
            assert 0 <= entity["confidence"] <= 100
            assert "corroboration_breakdown" in entity
            assert "confidence_breakdown" in entity

        # Google DeepMind confidence is ~72.4% (lower due to fewer verified status records in cluster)
        # Anthropic confidence is ~96.0%
        # Meta AI confidence is ~97.6%
        assert deepmind["confidence"] != anthropic["confidence"]
        assert deepmind["corroboration_score"] != anthropic["corroboration_score"]

    def test_authentic_source_urls_for_ai_competitors(self):
        """Every signal in AI competitor clusters must have genuine HTTP/HTTPS URLs with valid domain names."""
        for comp in ["Anthropic", "Google DeepMind", "Meta AI"]:
            corr = sce.correlate_signals_for_competitor(comp, target_company="OpenAI")[0]
            for s in corr["signals_cluster"]:
                url = s.get("url", "")
                assert url.startswith("https://") or url.startswith("http://"), f"Invalid URL in {comp}: {url}"
                assert "example.com" not in url
                assert not url.endswith("/core")
                assert not url.endswith("/pricing") or "anthropic.com/pricing" in url

    def test_structured_recommended_counter_actions(self):
        """Each competitor must receive an actionable, structured counter-action with priority and team."""
        seen_teams = set()
        seen_actions = set()

        for comp in ["Anthropic", "Google DeepMind", "Meta AI"]:
            corr = sce.correlate_signals_for_competitor(comp, target_company="OpenAI")[0]
            rec_details = corr.get("recommended_action_details", {})
            assert rec_details, f"Missing recommended_action_details for {comp}"

            assert rec_details["action_title"], f"Missing action title for {comp}"
            assert rec_details["reason"], f"Missing reason for {comp}"
            assert rec_details["responsible_team"], f"Missing responsible team for {comp}"
            assert rec_details["priority"] in ["Critical", "High", "Medium"], f"Invalid priority for {comp}"
            assert rec_details["suggested_next_step"], f"Missing next step for {comp}"

            seen_teams.add(rec_details["responsible_team"])
            seen_actions.add(rec_details["action_title"])

        # Teams and actions must be bespoke, not duplicated
        assert len(seen_teams) == 3, f"Expected 3 distinct responsible teams, got: {seen_teams}"
        assert len(seen_actions) == 3, f"Expected 3 distinct action titles, got: {seen_actions}"

    def test_deduplication_penalty_on_same_source(self):
        """Signals originating from the same publisher must receive a deduplication penalty."""
        signals_independent = [
            {"id": "s1", "channel": "github", "source": "GitHub Official", "url": "https://github.com/a/b", "detected_at": "2026-10-25T00:00:00Z"},
            {"id": "s2", "channel": "careers", "source": "LinkedIn Talent", "url": "https://linkedin.com/jobs/1", "detected_at": "2026-10-26T00:00:00Z"},
            {"id": "s3", "channel": "news", "source": "Reuters Tech", "url": "https://reuters.com/tech/1", "detected_at": "2026-10-27T00:00:00Z"},
            {"id": "s4", "channel": "pricing", "source": "Competitor Billing Portal", "url": "https://billing.corp.com", "detected_at": "2026-10-28T00:00:00Z"},
        ]
        score_independent = sce.calculate_corroboration_score(signals_independent)

        # Cluster with 4 signals from the SAME publisher
        signals_duplicate = [
            {"id": "s1", "channel": "github", "source": "Internal Blog", "url": "https://blog.corp.com/1", "detected_at": "2026-10-25T00:00:00Z"},
            {"id": "s2", "channel": "careers", "source": "Internal Blog", "url": "https://blog.corp.com/2", "detected_at": "2026-10-26T00:00:00Z"},
            {"id": "s3", "channel": "news", "source": "Internal Blog", "url": "https://blog.corp.com/3", "detected_at": "2026-10-27T00:00:00Z"},
            {"id": "s4", "channel": "pricing", "source": "Internal Blog", "url": "https://blog.corp.com/4", "detected_at": "2026-10-28T00:00:00Z"},
        ]
        score_duplicate = sce.calculate_corroboration_score(signals_duplicate)

        assert score_independent["score"] > score_duplicate["score"]
        assert score_duplicate["breakdown"]["duplication_penalty"] > 0

    def test_empty_competitor_returns_empty_array(self):
        """Unknown competitor with no verified signals must strictly return empty list without fallback fabrication."""
        res = sce.correlate_signals_for_competitor("NonExistentAIFirmXYZ", target_company="OpenAI")
        assert res == [], f"Expected empty list for unknown competitor, got: {res}"

    def test_storage_get_signal_correlations_ai_tenant(self):
        """Verify storage.py retrieves the enriched, isolated clusters for tenant 6a4703ac."""
        tid = "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f"
        corrs = storage.get_signal_correlations(tenant_id=tid)
        assert len(corrs) >= 3

        comp_names = {c["company_name"] for c in corrs}
        assert "Anthropic" in comp_names
        assert "Google DeepMind" in comp_names
        assert "Meta AI" in comp_names

        for c in corrs:
            assert c["correlation_category"] != "marketplace_expansion"
            assert c["correlation_category"] in sce.CORRELATION_CATEGORIES
            assert c["corroboration_score"] is not None
            assert c["confidence"] is not None
            assert c["recommended_action_details"]["action_title"]
            assert c["strategic_implication_details"]["observed_move"]
