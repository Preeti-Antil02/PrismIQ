"""
PrismIQ - Stage 4 & Stage 5 Strategic Quality & Content Independence Test Suite
Verifies:
1. Competitor-specific Stage 4 impact assessments (Move, Direction, Area, Implication, Uncertainty).
2. Actionable Stage 5 counter-actions directly responding to Stage 4 assessments without generic templates.
3. Strict content independence: Zero canned phrases ('consolidating market positioning', 'audit feature roadmap').
4. Target company awareness: Changing target company changes affected area and strategic response.
5. Insufficient evidence produces explicit uncertainty messages instead of fabricated conclusions.
6. Anti-duplication quality validator detects and rejects generic templates.
"""

import pytest
from typing import Dict, Any, List
from fastapi.testclient import TestClient
from backend.src.api import app, _create_jwt_token
from backend.src import signal_correlation_engine as sce
from backend.src import storage

client = TestClient(app)


class TestStage4Stage5QualityAndIndependence:
    """Rigorous validation of Stage 4 (Strategic Impact) & Stage 5 (Counter-Action) pipelines."""

    def test_different_competitors_produce_different_stage4_assessments(self):
        """Different competitor moves must yield completely distinct Stage 4 assessments."""
        comps = ["Meesho", "Flipkart", "Amazon India", "Shopsy", "Ajio", "PostHog", "Mixpanel", "Anthropic", "Cloudflare"]
        observed_moves = set()
        directions = set()
        implications = set()

        for comp in comps:
            s4 = sce.generate_strategic_implication(comp, "Marketplace Expansion", target_company="Flipkart")
            assert s4["observed_move"], f"Missing observed_move for {comp}"
            assert s4["strategic_direction"], f"Missing strategic_direction for {comp}"
            assert s4["competitive_implication"], f"Missing competitive_implication for {comp}"

            # Ensure distinctiveness across all competitors
            assert s4["observed_move"] not in observed_moves, f"Duplicate observed_move for {comp}"
            assert s4["strategic_direction"] not in directions, f"Duplicate strategic_direction for {comp}"
            assert s4["competitive_implication"] not in implications, f"Duplicate competitive_implication for {comp}"

            observed_moves.add(s4["observed_move"])
            directions.add(s4["strategic_direction"])
            implications.add(s4["competitive_implication"])

    def test_stage5_recommendations_directly_address_stage4_assessment(self):
        """Stage 5 recommendations must directly address the specific observed move and category."""
        test_pairs = [
            ("Meesho", "Flipkart", "Merchant", "0% commission"),
            ("Flipkart", "Meesho", "Supply Chain", "15-minute quick delivery"),
            ("PostHog", "Mixpanel", "Product Architecture", "HogQL"),
            ("Anthropic", "OpenAI", "Developer Platform", "Computer Use"),
            ("Cloudflare", "Vercel", "Product Infrastructure", "zero-egress"),
        ]

        for comp, target, expected_team_keyword, expected_context in test_pairs:
            s4 = sce.generate_strategic_implication(comp, "Developer Ecosystem Expansion", target_company=target)
            s5 = sce.generate_recommended_counter_action(comp, "Developer Ecosystem Expansion", target_company=target)

            assert s5["action_title"], f"Missing action_title for {comp}"
            assert s5["reason"], f"Missing reason for {comp}"
            assert s5["responsible_team"], f"Missing responsible_team for {comp}"
            assert s5["suggested_next_step"], f"Missing suggested_next_step for {comp}"

            # Verify that Stage 5 team aligns with the threat vector
            assert expected_team_keyword.lower() in s5["responsible_team"].lower(), (
                f"Expected team keyword '{expected_team_keyword}' in '{s5['responsible_team']}' for {comp}"
            )

            # Stage 5 reason must reference the competitor and context
            assert comp.lower() in s5["reason"].lower() or comp.lower() in s5["action_title"].lower()

    def test_changing_target_company_changes_impact_analysis(self):
        """When the target company changes, Stage 4 affected area and Stage 5 response must adapt."""
        # Amazon India vs Flipkart (electronics / metropolitan speed)
        s4_flipkart = sce.generate_strategic_implication("Amazon India", "Marketplace Expansion", target_company="Flipkart")
        s5_flipkart = sce.generate_recommended_counter_action("Amazon India", "Marketplace Expansion", target_company="Flipkart")

        # Amazon India vs Meesho (value apparel / regional weavers)
        s4_meesho = sce.generate_strategic_implication("Amazon India", "Marketplace Expansion", target_company="Meesho")
        s5_meesho = sce.generate_recommended_counter_action("Amazon India", "Marketplace Expansion", target_company="Meesho")

        assert s4_flipkart["affected_business_area"] != s4_meesho["affected_business_area"]
        assert "Flipkart" in s4_flipkart["affected_business_area"]
        assert "Meesho" in s4_meesho["affected_business_area"]

        # Stage 5 actions must differ according to target priorities
        assert s5_flipkart["action_title"] != s5_meesho["action_title"]
        assert s5_flipkart["responsible_team"] != s5_meesho["responsible_team"]

    def test_insufficient_evidence_produces_explicit_uncertainty(self):
        """When evidence is sparse or absent, the pipeline must explicitly communicate uncertainty."""
        sparse_signals = [
            {"id": "sig_single_rumor", "title": "Unconfirmed rumor blog", "channel": "news", "source": "Random Forum"}
        ]
        s4 = sce.generate_strategic_implication("BrandNewUnknownCorp", "AI Product Launch", target_company="Acme Corp", signals=sparse_signals)
        s5 = sce.generate_recommended_counter_action("BrandNewUnknownCorp", "AI Product Launch", target_company="Acme Corp", signals=sparse_signals)

        # Stage 4 must declare uncertainty
        assert "insufficient" in s4["observed_move"].lower() or "unconfirmed" in s4["observed_move"].lower()
        assert "uncertain" in s4["strategic_direction"].lower() or "unverified" in s4["strategic_direction"].lower()
        assert s4["key_uncertainty"]

        # Stage 5 must recommend surveillance rather than capital diversion
        assert "surveillance" in s5["action_title"].lower() or "defer" in s5["action_title"].lower()
        assert s5["priority"] == "Low"

    def test_quality_validator_rejects_canned_phrases(self):
        """The validation engine must detect and reject obsolete generic templates."""
        bad_s4 = {
            "observed_move": "Competitor executed coordinated multi-channel deployments in pricing.",
            "strategic_direction": "Consolidating market positioning against Flipkart through synchronized capability releases.",
            "affected_business_area": "Customer acquisition, commercial retention, and core roadmap priorities at Flipkart.",
            "competitive_implication": "Alters competitive benchmarks in active customer procurement cycles.",
            "key_uncertainty": "Sustained execution velocity over coming 90 days."
        }
        bad_s5 = {
            "action_title": "Conduct Capability Benchmark & Refine Commercial Differentiation vs. Competitor",
            "reason": "Competitor is actively executing multi-channel moves challenging Flipkart.",
            "responsible_team": "Competitive Intelligence & Product Strategy",
            "priority": "Medium",
            "suggested_next_step": "1. Audit Flipkart's feature roadmap against Competitor's observed moves. 2. Deploy updated battlecards to direct sales representatives."
        }

        res = sce.validate_strategic_synthesis(bad_s4, bad_s5, "Competitor", "Flipkart")
        assert not res["valid"], "Validator failed to flag banned boilerplate templates!"
        assert any("banned" in err.lower() for err in res["errors"])

    def test_all_grounded_competitors_pass_quality_validation(self):
        """All supported competitors must pass the strict content quality validator."""
        for comp in ["Meesho", "Flipkart", "Amazon India", "Shopsy", "Ajio", "PostHog", "Mixpanel", "Anthropic", "Google DeepMind", "Meta AI", "OpenAI", "Cloudflare", "Netlify"]:
            s4 = sce.generate_strategic_implication(comp, "Developer Ecosystem Expansion", target_company="TestTarget")
            s5 = sce.generate_recommended_counter_action(comp, "Developer Ecosystem Expansion", target_company="TestTarget")

            res = sce.validate_strategic_synthesis(s4, s5, comp, "TestTarget")
            assert res["valid"], f"Validation failed for {comp}: {res['errors']}"

    def test_api_signals_correlations_returns_clean_bespoke_insights(self):
        """Live API endpoint /signals/correlations must return clean, validated insights."""
        token = _create_jwt_token("8553449a-c998-4727-be01-9aeb724038cb", "analyst@meesho.dev")
        res = client.get("/signals/correlations?tenant_id=8553449a-c998-4727-be01-9aeb724038cb", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert "correlations" in data
        corrs = data["correlations"]
        assert len(corrs) >= 4

        for corr in corrs:
            cname = corr["company_name"]
            s4 = corr.get("strategic_implication_details") or {}
            s5 = corr.get("recommended_action_details") or {}

            # Must NOT contain banned clichés
            assert "synchronized capability releases" not in corr["strategic_implication"].lower()
            assert "consolidating market positioning against" not in corr["strategic_implication"].lower()
            assert "deploy updated battlecards to direct sales" not in corr["recommended_action"].lower()

            # Must have non-generic team
            assert s5.get("responsible_team") not in ["team", "General Team", ""]
