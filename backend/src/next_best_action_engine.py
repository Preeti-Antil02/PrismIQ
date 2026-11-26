"""
Next Best Action Engine for PrismIQ Batch 2.
Synthesizes cross-functional, evidence-grounded recommendations for
Sales, Product, Marketing, Leadership, and Engineering based on Customer Voice,
Verified Claims, and Competitive Drift.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from . import batch2_storage
from . import battlecard_storage

logger = logging.getLogger(__name__)


class NextBestActionEngine:
    """
    Generates, prioritizes, and manages actionable recommendations across personas.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def generate_recommendations(
        self,
        competitor_name: Optional[str] = None,
        target_company: str = "Our Company",
        force_refresh: bool = False,
        **kwargs,
    ) -> List[Dict[str, Any]]:
        """
        Scan customer voice, verified claims, and competitive drift to produce recommendations
        across Sales, Product, Marketing, Leadership, and Engineering.
        """
        generated: List[Dict[str, Any]] = []
        comp_filter = (competitor_name or "").strip()

        # -------------------------------------------------------------------
        # 1. Product Team Recommendations (Feature Gaps & Customer Complaints)
        # -------------------------------------------------------------------
        feedback_records = batch2_storage.list_feedback_records(
            self.tenant_id,
            company_name=comp_filter or None,
            limit=200,
        )
        if not feedback_records and comp_filter:
            feedback_records = batch2_storage.list_feedback_records(self.tenant_id, limit=200)

        if not feedback_records:
            from .storage import is_test_environment
            if not is_test_environment():
                try:
                    from .batch2_seed_data import seed_batch2_intelligence
                    seed_batch2_intelligence(self.tenant_id, target_company)
                    feedback_records = batch2_storage.list_feedback_records(self.tenant_id, limit=200)
                except Exception:
                    pass

        product_complaints = [f for f in feedback_records if f.get("category") in ("feature_request", "product_complaint", "pricing_complaint")]
        aspect_counts = {}
        for pc in product_complaints:
            asp = pc.get("aspect", "General")
            aspect_counts[asp] = aspect_counts.get(asp, 0) + 1

        for aspect, count in aspect_counts.items():
            if count >= 1 and aspect != "General":
                sample_quotes = [pc["raw_quote"] for pc in product_complaints if pc.get("aspect") == aspect][:2]
                urgency = "High" if count >= 3 else "Medium"
                target_comp = comp_filter or product_complaints[0].get("company_name", "")
                generated.append({
                    "team": "Product",
                    "affected_team": "product",
                    "category": "feature_gap",
                    "title": f"Investigate customer friction around {aspect}",
                    "what_happened": f"{count} customer complaint(s)/feature request(s) recorded regarding {aspect}.",
                    "why_it_matters": f"Recurring customer friction directly impacts renewal rates and user satisfaction.",
                    "recommended_action": f"Schedule engineering review to triage {aspect} gaps and assess backlog priority.",
                    "urgency": urgency,
                    "confidence": "High" if count >= 3 else "Medium",
                    "related_competitor": target_comp,
                    "review_status": "pending",
                    "supporting_evidence": [{"quote": q, "source": "Customer Voice"} for q in sample_quotes],
                })

        # -------------------------------------------------------------------
        # 2. Sales Team Recommendations (Switching Signals & Claims Counters)
        # -------------------------------------------------------------------
        switching_or_pricing = [
            f for f in feedback_records
            if f.get("category") in ("reason_for_switching", "reason_for_choosing_competitor", "pricing_complaint", "dislike")
        ]
        for fb in switching_or_pricing[:2]:
            comp = comp_filter or fb.get("company_name") or "Competitor"
            quote = fb.get("raw_quote", "")
            generated.append({
                "team": "Sales",
                "affected_team": "sales",
                "category": "objection_response",
                "title": f"Deploy objection counter against {comp}",
                "what_happened": f"Customer voice captured competitive switching/pricing friction for {comp}: '{quote[:80]}...'",
                "why_it_matters": f"Unaddressed buyer objections against {comp} increase competitive evaluation friction.",
                "recommended_action": f"Arm reps with the verified Battlecard Objection Playbook for {comp}.",
                "urgency": "High",
                "confidence": "High",
                "related_competitor": comp,
                "review_status": "pending",
                "supporting_evidence": [{"quote": quote, "source": "Customer Voice"}],
            })

        if not switching_or_pricing and feedback_records:
            fb0 = feedback_records[0]
            comp = comp_filter or fb0.get("company_name") or "Competitor"
            quote = fb0.get("raw_quote", "")
            generated.append({
                "team": "Sales",
                "affected_team": "sales",
                "category": "objection_response",
                "title": f"Align field sales battlecard messaging against {comp}",
                "what_happened": f"Recorded competitive customer signal involving {comp}.",
                "why_it_matters": f"Ensures sales teams address live {comp} positioning accurately.",
                "recommended_action": f"Review the latest {comp} Battlecard talking points with field reps.",
                "urgency": "Medium",
                "confidence": "Medium",
                "related_competitor": comp,
                "review_status": "pending",
                "supporting_evidence": [{"quote": quote, "source": "Customer Voice"}],
            })

        # -------------------------------------------------------------------
        # 3. Marketing Team Recommendations (Competitive Differentiation)
        # -------------------------------------------------------------------
        themes = batch2_storage.list_feedback_themes(self.tenant_id, company_name=comp_filter or None)
        if not themes and comp_filter:
            themes = batch2_storage.list_feedback_themes(self.tenant_id)

        for th in themes[:2]:
            comp = comp_filter or th.get("company_name", "Competitors")
            title = th.get("theme_title", "Vulnerability")
            generated.append({
                "team": "Marketing",
                "affected_team": "marketing",
                "category": "messaging",
                "title": f"Publish competitive comparison content targeting {comp} {title}",
                "what_happened": f"Empirical customer feedback shows consistent dissatisfaction with {comp} in {title}.",
                "why_it_matters": f"High-intent prospects evaluating {comp} are seeking alternative vendors that excel in this area.",
                "recommended_action": f"Update website comparison page and ad copy highlighting our superior reliability in {title}.",
                "urgency": "Medium",
                "confidence": "Medium",
                "related_competitor": comp,
                "review_status": "pending",
                "supporting_evidence": [{"theme": title, "sample_size": th.get("sample_size", 1), "source": "Customer Voice Opportunity"}],
            })

        # -------------------------------------------------------------------
        # 4. Leadership Team Recommendations (Strategic Competitive Patterns)
        # -------------------------------------------------------------------
        negative_themes = [th for th in themes if th.get("is_competitive_opportunity") or int(th.get("occurrence_count", 0)) >= 2]
        if negative_themes or len(product_complaints) >= 2:
            lead_th = negative_themes[0] if negative_themes else None
            comp = comp_filter or (lead_th.get("company_name") if lead_th else product_complaints[0].get("company_name", "Competitor"))
            sample = lead_th.get("sample_size", len(product_complaints)) if lead_th else len(product_complaints)
            generated.append({
                "team": "Leadership",
                "affected_team": "leadership",
                "category": "market_risk",
                "title": f"Review strategic competitive positioning against {comp}",
                "what_happened": f"Aggregated {sample} customer voice signals indicating recurring market pressure around {comp}.",
                "why_it_matters": f"Requires executive alignment on packaging, differentiation, and roadmap priorities.",
                "recommended_action": f"Conduct monthly strategic review with Sales and Product leadership regarding {comp} market positioning.",
                "urgency": "High",
                "confidence": "High",
                "related_competitor": comp,
                "review_status": "pending",
                "supporting_evidence": [{"sample_size": sample, "source": "Customer Voice Themes"}],
            })

        # -------------------------------------------------------------------
        # 5. Engineering Team Recommendations (Technical Blockers & Integrations)
        # -------------------------------------------------------------------
        if kwargs.get("include_engineering"):
            tech_requirements = [
                f for f in feedback_records
                if any(kw in str(f.get("raw_quote", "")).lower() for kw in [
                    "soc2", "sso", "saml", "api", "connector", "webhook", "latency", "compliance", "integration"
                ])
            ]

            for req in tech_requirements[:2]:
                quote = req.get("raw_quote", "")
                comp = comp_filter or req.get("company_name") or "Competitor"
                clean_q = quote[:60].strip()
                generated.append({
                    "team": "Engineering",
                    "department": "Engineering",
                    "responsible_department": "Engineering",
                    "affected_team": "engineering",
                    "category": "technical_blocker",
                    "title": f"Review technical integration & compliance requirement: '{clean_q}...'",
                    "description": f"Perform engineering review on technical requirement '{quote}' to eliminate adoption blocker.",
                    "recommended_action": f"Perform engineering review on technical requirement '{quote}' to eliminate adoption blocker.",
                    "reason": f"Customer feedback highlighted '{quote}' as a key technical requirement.",
                    "why_it_matters": f"Customer feedback highlighted '{quote}' as a key technical requirement.",
                    "what_happened": f"Customer identified technical specification: '{quote}'.",
                    "priority": "High",
                    "urgency": "High",
                    "confidence": "High",
                    "related_competitor": comp,
                    "status": "Pending",
                    "review_status": "pending",
                    "supporting_evidence": [{"quote": quote, "source": "Customer Voice Technical Requirement"}],
                    "evidence_references": [{"quote": quote, "source": "Customer Voice Technical Requirement"}],
                })

        # Save to database / memory with deduplication
        if generated:
            return batch2_storage.save_next_best_actions_batch(generated, self.tenant_id)
        return []

    generate_actions = generate_recommendations

    def update_action_status(
        self,
        action_id: str,
        new_status: str,
        changed_by: Optional[str] = None,
        user_id: Optional[str] = None,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        owner: Optional[str] = None,
        due_date: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Transition recommendation status: Pending, In Progress, Completed, Dismissed.
        """
        user = changed_by or user_id or "analyst"
        note = reason or notes or ""
        return batch2_storage.update_action_status(
            action_id=action_id,
            new_status=new_status,
            user_id=user,
            notes=note,
            tenant_id=self.tenant_id,
            owner=owner,
            due_date=due_date,
        )

    update_action_review_status = update_action_status

