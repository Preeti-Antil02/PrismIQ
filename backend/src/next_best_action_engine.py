"""
Next Best Action Engine for PrismIQ Batch 2.
Synthesizes cross-functional, evidence-grounded recommendations for
Sales, Product, Marketing, and Leadership based on Customer Voice,
Win/Loss trends, Sales Conversations, and Battlecard Drift.
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
        deal_id: Optional[str] = None,
        **kwargs,
    ) -> List[Dict[str, Any]]:
        """
        Scan customer voice, win/loss patterns, calls, and drift to produce recommendations
        across Sales, Product, Marketing, Leadership, and Engineering.
        """
        generated: List[Dict[str, Any]] = []
        comp_filter = (competitor_name or "").strip()

        # If deal_id supplied, inspect deal competitors
        if deal_id and not comp_filter:
            try:
                from . import batch3_storage
                deal = batch3_storage.get_deal(deal_id, self.tenant_id)
                if deal and deal.get("associated_competitors"):
                    comp_filter = deal["associated_competitors"][0]
            except Exception:
                pass

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
        # 2. Sales Team Recommendations (Objections & Deal Risks)
        # -------------------------------------------------------------------
        call_items = batch2_storage.list_call_intelligence_items(self.tenant_id, competitor_name=comp_filter or None)
        if not call_items and comp_filter:
            call_items = batch2_storage.list_call_intelligence_items(self.tenant_id)

        objection_items = [i for i in call_items if i.get("item_type") in ("buyer_objection", "pricing_discussion", "deal_risk")]

        for itm in objection_items[:3]:
            comp = comp_filter or itm.get("competitor_name") or "Competitor"
            quote = itm.get("verbatim_quote", "")
            generated.append({
                "team": "Sales",
                "affected_team": "sales",
                "category": "objection_response",
                "title": f"Deploy objection counter against {comp}",
                "what_happened": f"Prospect raised objection in recent sales call: '{quote[:80]}...'",
                "why_it_matters": f"Unaddressed objections against {comp} correlate with increased sales cycle latency.",
                "recommended_action": f"Arm reps with the verified Battlecard Objection Playbook for {comp}.",
                "urgency": "High",
                "confidence": "High",
                "related_competitor": comp,
                "review_status": "pending",
                "supporting_evidence": [{"quote": quote, "source": "Sales Call Transcript", "speaker": itm.get("speaker")}],
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
        # 4. Leadership Team Recommendations (Strategic Risk & Win/Loss)
        # -------------------------------------------------------------------
        deals = batch2_storage.list_win_loss_deals(self.tenant_id, primary_competitor=comp_filter or None, limit=100)
        if not deals and comp_filter:
            deals = batch2_storage.list_win_loss_deals(self.tenant_id, limit=100)

        lost_deals = [d for d in deals if d.get("outcome") == "lost"]
        if len(lost_deals) >= 1:
            comp = comp_filter or lost_deals[0].get("primary_competitor", "Competitor")
            total_lost_val = sum(d.get("deal_value", 0) for d in lost_deals)
            generated.append({
                "team": "Leadership",
                "affected_team": "leadership",
                "category": "market_risk",
                "title": f"Review emerging competitive headwind across {len(lost_deals)} lost deals against {comp}",
                "what_happened": f"Recorded {len(lost_deals)} deal losses representing ${total_lost_val:,.0f} in pipeline value.",
                "why_it_matters": f"Requires executive review of packaging, discounting authority, and core roadmap alignment.",
                "recommended_action": "Conduct monthly win/loss review with Sales and Product leadership to address top loss factors.",
                "urgency": "High",
                "confidence": "High",
                "related_competitor": comp,
                "review_status": "pending",
                "supporting_evidence": [{"deal_count": len(lost_deals), "value": total_lost_val, "source": "Win/Loss Deal History"}],
            })

        # -------------------------------------------------------------------
        # 5. Engineering Team Recommendations (Technical Blockers & Integrations)
        # Relevant when a deal or explicit technical integration blocker is present
        # -------------------------------------------------------------------
        if deal_id or kwargs.get("include_engineering"):
            tech_requirements = [
                i for i in call_items
                if i.get("item_type") in ("customer_requirement", "decision_criteria", "product_gap")
                or any(kw in str(i.get("verbatim_quote", "")).lower() for kw in [
                    "soc2", "sso", "saml", "api", "connector", "webhook", "latency", "compliance", "integration", "servicenow"
                ])
            ]
            if deal_id:
                try:
                    from . import batch3_storage
                    deal_obj = batch3_storage.get_deal(deal_id, self.tenant_id)
                    if deal_obj:
                        for req in (deal_obj.get("customer_requirements") or deal_obj.get("buyer_objections") or []):
                            if any(kw in str(req).lower() for kw in ["soc2", "sso", "saml", "api", "connector", "integration", "compliance"]):
                                tech_requirements.append({
                                    "verbatim_quote": req,
                                    "speaker": "Prospect",
                                    "competitor_name": comp_filter or (deal_obj.get("associated_competitors") or ["Competitor"])[0],
                                })
                except Exception:
                    pass

            for req in tech_requirements[:2]:
                quote = req.get("verbatim_quote", "")
                comp = comp_filter or req.get("competitor_name") or "Competitor"
                clean_q = quote[:60].strip()
                generated.append({
                    "team": "Engineering",
                    "department": "Engineering",
                    "responsible_department": "Engineering",
                    "affected_team": "engineering",
                    "category": "technical_blocker",
                    "title": f"Review technical integration & compliance requirement: '{clean_q}...'",
                    "description": f"Perform engineering review on technical requirement '{quote}' to eliminate deal execution blocker.",
                    "recommended_action": f"Perform engineering review on technical requirement '{quote}' to eliminate deal execution blocker.",
                    "reason": f"Prospect specified '{quote}' as a mandatory decision criterion. Lack of verified support directly increases deal stall risk.",
                    "why_it_matters": f"Prospect specified '{quote}' as a mandatory decision criterion. Lack of verified support directly increases deal stall risk.",
                    "what_happened": f"Customer identified technical specification: '{quote}'.",
                    "priority": "High",
                    "urgency": "High",
                    "confidence": "High",
                    "related_competitor": comp,
                    "related_deal_id": deal_id,
                    "status": "Pending",
                    "review_status": "pending",
                    "supporting_evidence": [{"quote": quote, "source": "Customer Technical Requirement", "speaker": req.get("speaker")}],
                    "evidence_references": [{"quote": quote, "source": "Customer Technical Requirement", "speaker": req.get("speaker")}],
                })

        # Attach deal_id to generated actions if provided
        if deal_id:
            for g in generated:
                if not g.get("related_deal_id"):
                    g["related_deal_id"] = deal_id

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

