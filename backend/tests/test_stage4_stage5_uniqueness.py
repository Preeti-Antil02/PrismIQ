"""
PrismIQ - Stage 4 & Stage 5 Uniqueness, Quality & Data Integrity Test Suite
Verifies that Stage 4 (Strategic Impact Insight) and Stage 5 (Recommended Counter-Action)
generate competitor-specific, evidence-grounded intelligence without repetition or boilerplate.
"""

import pytest
from typing import List, Dict, Any
from backend.src import signal_correlation_engine as sce
from backend.src import storage


class TestStage4Stage5Uniqueness:
    """Verifies that Stage 4 and Stage 5 produce distinct, competitor-specific insights."""

    def test_different_competitor_activities_produce_different_stage4_assessments(self):
        """Different competitor moves must yield completely distinct observed moves, directions, and areas."""
        target = "OpenAI"
        anthropic = sce.correlate_signals_for_competitor("Anthropic", target_company=target)[0]
        deepmind = sce.correlate_signals_for_competitor("Google DeepMind", target_company=target)[0]
        meta = sce.correlate_signals_for_competitor("Meta AI", target_company=target)[0]

        a_strat = anthropic["strategic_implication_details"]
        d_strat = deepmind["strategic_implication_details"]
        m_strat = meta["strategic_implication_details"]

        # 1. Observed Moves must be completely distinct
        assert a_strat["observed_move"] != d_strat["observed_move"]
        assert a_strat["observed_move"] != m_strat["observed_move"]
        assert d_strat["observed_move"] != m_strat["observed_move"]

        assert "Computer Use" in a_strat["observed_move"]
        assert "2-million-token" in d_strat["observed_move"]
        assert "405B" in m_strat["observed_move"]

        # 2. Strategic directions must reflect actual distinct vectors
        assert a_strat["strategic_direction"] != d_strat["strategic_direction"]
        assert a_strat["strategic_direction"] != m_strat["strategic_direction"]

        # 3. Affected business areas must be tailored
        assert a_strat["affected_business_area"] != d_strat["affected_business_area"]
        assert a_strat["affected_business_area"] != m_strat["affected_business_area"]

        # 4. Competitive implications must highlight different moats/threats
        assert a_strat["competitive_implication"] != d_strat["competitive_implication"]
        assert a_strat["competitive_implication"] != m_strat["competitive_implication"]

        # 5. Key uncertainties must address different risks
        assert a_strat["key_uncertainty"] != d_strat["key_uncertainty"]
        assert a_strat["key_uncertainty"] != m_strat["key_uncertainty"]

    def test_stage5_recommendations_directly_address_stage4_assessments(self):
        """Stage 5 actions must directly respond to the Stage 4 threat with tailored teams and execution steps."""
        target = "Meesho"
        shopsy = sce.correlate_signals_for_competitor("Shopsy", target_company=target)[0]
        flipkart = sce.correlate_signals_for_competitor("Flipkart", target_company=target)[0]
        amazon = sce.correlate_signals_for_competitor("Amazon India", target_company=target)[0]
        ajio = sce.correlate_signals_for_competitor("Ajio", target_company=target)[0]

        # Shopsy is pricing & reverse logistics -> Seller Growth / Instant Payouts
        s_act = shopsy["recommended_action_details"]
        assert "UPI Payout" in s_act["action_title"] or "Return Protection" in s_act["action_title"]
        assert "Seller Growth" in s_act["responsible_team"] or "Merchant Operations" in s_act["responsible_team"]
        assert s_act["priority"] == "Critical"
        assert "24-hour UPI payouts" in s_act["suggested_next_step"]

        # Flipkart is 15-min quick commerce -> Supply Chain / Batched Delivery
        f_act = flipkart["recommended_action_details"]
        assert "Batched Delivery" in f_act["action_title"] or "Fulfillment Hubs" in f_act["action_title"]
        assert "Supply Chain" in f_act["responsible_team"] or "Logistics" in f_act["responsible_team"]
        assert "dark-store" in f_act["reason"].lower()

        # Amazon is working capital & bazaar zero fee -> Financial Services / Credit Lines
        am_act = amazon["recommended_action_details"]
        assert "Working Capital" in am_act["action_title"] or "Weaver-Direct" in am_act["action_title"]
        assert "Financial Services" in am_act["responsible_team"] or "Seller Partnerships" in am_act["responsible_team"]

        # Ajio is physical stores omnichannel -> Category Management / Mill Direct Price Floor
        aj_act = ajio["recommended_action_details"]
        assert "Price Floor" in aj_act["action_title"] or "Video Commerce" in aj_act["action_title"]
        assert "Category Management" in aj_act["responsible_team"] or "Marketing" in aj_act["responsible_team"]

    def test_changing_target_company_changes_impact_analysis(self):
        """When the target company changes, the affected products and implications must adjust accordingly."""
        # Case 1: Target is Meesho vs Competitor Flipkart
        meesho_target_corr = sce.correlate_signals_for_competitor("Flipkart", target_company="Meesho")[0]
        m_strat = meesho_target_corr["strategic_implication_details"]
        assert "Meesho" in m_strat["affected_business_area"]
        assert "fast-fashion" in m_strat["affected_business_area"].lower() or "urban fringe" in m_strat["affected_business_area"].lower()

        # Case 2: Target is Flipkart vs Competitor Meesho
        flipkart_target_corr = sce.correlate_signals_for_competitor("Meesho", target_company="Flipkart")[0]
        f_strat = flipkart_target_corr["strategic_implication_details"]
        assert "Flipkart" in f_strat["affected_business_area"]
        assert "budget apparel gmv" in f_strat["affected_business_area"].lower() or "take-rates" in f_strat["competitive_implication"].lower()

        # Case 3: Target is Flipkart vs Competitor Amazon India
        amz_vs_flipkart = sce.correlate_signals_for_competitor("Amazon India", target_company="Flipkart")[0]
        amz_fk_strat = amz_vs_flipkart["strategic_implication_details"]
        assert "Flipkart" in amz_fk_strat["affected_business_area"]
        assert "electronics" in amz_fk_strat["affected_business_area"].lower() or "smartphone" in amz_fk_strat["affected_business_area"].lower()

    def test_insufficient_evidence_produces_explicit_uncertainty(self):
        """When signals are insufficient or competitor is unverified, explicit uncertainty must be returned."""
        unknown_comp = "PhantomUnverifiedStartup"
        # 1. No signals at all -> honest empty list
        empty_res = sce.correlate_signals_for_competitor(unknown_comp, raw_signals=[], target_company="OpenAI")
        assert empty_res == []

        # 2. Only 1 isolated signal -> explicit uncertainty statement, NO fabricated strategic conclusions
        single_isolated_signal = [
            {
                "id": "sig_single_rumor",
                "channel": "news",
                "title": "Random Blog mentions PhantomUnverifiedStartup",
                "source": "Unverified Forum",
                "url": "https://unverified-blog.io/post",
                "excerpt": "A vague rumor says this entity is working on something.",
                "detected_at": "2026-10-25T00:00:00Z"
            }
        ]
        strat = sce.generate_strategic_implication(unknown_comp, "AI Product Launch", "OpenAI", signals=single_isolated_signal)
        assert "Insufficient empirical evidence" in strat["observed_move"]
        assert "Unverified hypothesis" in strat["strategic_direction"]
        assert "Preliminary surveillance only" in strat["affected_business_area"]
        assert "cannot be substantiated" in strat["competitive_implication"]

        act = sce.generate_recommended_counter_action(unknown_comp, "AI Product Launch", "OpenAI", signals=single_isolated_signal)
        assert "Maintain Passive Surveillance" in act["action_title"]
        assert act["priority"] == "Low"
        assert "preliminary or uncorroborated" in act["reason"]

    def test_no_generic_boilerplate_templates_in_correlations(self):
        """None of the banned boilerplate phrases may appear in any correlation record."""
        tid = "8553449a-c998-4727-be01-9aeb724038cb"
        correlations = storage.get_signal_correlations(tenant_id=tid)
        assert len(correlations) >= 4

        banned_phrases = [
            "consolidating market positioning against",
            "through synchronized capability releases",
            "audit feature roadmap against",
            "deploy updated battlecards to direct sales",
            "alters competitive benchmarks in active customer procurement",
            "sustained execution velocity and customer adoption rate over the coming 90 days",
        ]

        for c in correlations:
            cname = c["company_name"]
            text = f"{c.get('strategic_implication', '')} {c.get('recommended_action', '')}".lower()
            strat_details = c.get("strategic_implication_details") or {}
            rec_details = c.get("recommended_action_details") or {}
            details_text = f"{str(strat_details)} {str(rec_details)}".lower()

            for phrase in banned_phrases:
                assert phrase not in text, f"Banned phrase '{phrase}' found in {cname} summary text"
                assert phrase not in details_text, f"Banned phrase '{phrase}' found in {cname} details"

    def test_automated_integrity_validation_function(self):
        """The validate_stage4_stage5_integrity function must pass with status PASSED."""
        tid = "8553449a-c998-4727-be01-9aeb724038cb"
        correlations = storage.get_signal_correlations(tenant_id=tid)
        audit = sce.validate_stage4_stage5_integrity(correlations)

        assert audit["status"] == "PASSED", f"Integrity audit failed with violations: {audit.get('violations')}"
        assert audit["violations"] == []
        assert audit["max_pairwise_similarity"] < 0.38
        assert audit["count"] >= 4

    def test_cloud_hosting_competitors_uniqueness(self):
        """Cloud & developer platform competitors (Cloudflare, AWS, Netlify) must be uniquely tailored vs Vercel."""
        cf = sce.correlate_signals_for_competitor("Cloudflare", target_company="Vercel")[0]
        aws = sce.correlate_signals_for_competitor("AWS", target_company="Vercel")[0]
        net = sce.correlate_signals_for_competitor("Netlify", target_company="Vercel")[0]

        # Cloudflare focuses on zero egress fees and edge Workers
        assert "zero-egress" in cf["strategic_implication_details"]["observed_move"].lower()
        assert "egress tiers" in cf["recommended_action_details"]["action_title"].lower()

        # AWS focuses on Amplify Gen 2 and Next.js App Router bundling
        assert "amplify gen 2" in aws["strategic_implication_details"]["observed_move"].lower()
        assert "private peering" in aws["recommended_action_details"]["action_title"].lower()

        # Netlify focuses on composable platform and OpenNext
        assert "opennext" in net["strategic_implication_details"]["observed_move"].lower()
        assert "multi-framework" in net["recommended_action_details"]["action_title"].lower()

        audit = sce.validate_stage4_stage5_integrity([cf, aws, net])
        assert audit["status"] == "PASSED"
