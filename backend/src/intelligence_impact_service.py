"""
Intelligence Impact Tracking Service for PrismIQ Batch 4.
Traces and aggregates end-to-end lineage:
Intelligence Record -> Deal Recommendation -> Assigned Action -> Action Status -> Related Deal -> Business Outcome

Strict Attribution Rules:
- Distinguishes recorded correlation and user-reported attribution from proven causation.
- Does not manufacture ROI, speculative dollar savings, or unverified win-rate improvements.
- Explicitly documents attribution status as 'recorded_association_not_proven_causation'.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import batch2_storage, batch3_storage, batch4_storage, battlecard_storage

logger = logging.getLogger(__name__)


class IntelligenceImpactService:
    """
    Aggregates intelligence lineage and generates responsible impact reports.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def get_impact_summary(self) -> Dict[str, Any]:
        """
        Produce aggregate impact summary across deals, recommendations, actions, and recorded outcomes.
        """
        deals = batch3_storage.list_deals(self.tenant_id, limit=500) or []
        outcomes = batch3_storage.list_recommendation_outcomes(self.tenant_id, limit=500) or []
        all_actions = batch2_storage.list_next_best_actions(self.tenant_id, limit=1000) or []

        # Department aggregation
        dept_counts = {"sales": 0, "product": 0, "marketing": 0, "leadership": 0, "engineering": 0}
        status_counts = {"pending": 0, "in_progress": 0, "completed": 0, "dismissed": 0}

        for a in all_actions:
            dept = str(a.get("responsible_department") or a.get("affected_team") or "sales").strip().lower()
            if dept in dept_counts:
                dept_counts[dept] += 1
            else:
                dept_counts[dept] = dept_counts.get(dept, 0) + 1

            st = str(a.get("status") or "pending").strip().lower()
            if st in status_counts:
                status_counts[st] += 1
            else:
                status_counts[st] = status_counts.get(st, 0) + 1

        total_actions = len(all_actions)
        completed_actions = status_counts.get("completed", 0)
        completion_rate = round((completed_actions / total_actions * 100.0), 1) if total_actions > 0 else 0.0

        # Outcome aggregation
        outcome_distribution = {"won": 0, "lost": 0, "in_progress": 0, "no_decision": 0, "other": 0}
        for o in outcomes:
            out_val = str(o.get("outcome") or "").strip().lower()
            if out_val in ("won", "win"):
                outcome_distribution["won"] += 1
            elif out_val in ("lost", "loss"):
                outcome_distribution["lost"] += 1
            elif out_val in ("in_progress", "active"):
                outcome_distribution["in_progress"] += 1
            elif out_val in ("no_decision", "abandoned"):
                outcome_distribution["no_decision"] += 1
            else:
                outcome_distribution["other"] += 1

        total_deals = len(deals)

        return {
            "tenant_id": self.tenant_id,
            "total_deals_managed": total_deals,
            "total_actions_generated": total_actions,
            "action_completion_rate_percent": completion_rate,
            "department_breakdown": dept_counts,
            "action_status_breakdown": status_counts,
            "recorded_deal_outcomes": outcome_distribution,
            "attribution_nature": "recorded_association_not_proven_causation",
            "impact_methodology": (
                "PrismIQ tracks operational execution of intelligence actions and correlates them "
                "with user-recorded deal results. Direct causation is not asserted, and financial "
                "returns are not artificially manufactured."
            ),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def trace_lineage_for_deal(self, deal_id: str) -> Dict[str, Any]:
        """
        Trace end-to-end lineage for a single deal from intelligence to recorded outcome.
        """
        deal = batch3_storage.get_deal(deal_id, self.tenant_id)
        if not deal:
            raise ValueError(f"Deal '{deal_id}' not found.")

        transcripts = batch2_storage.list_sales_calls(self.tenant_id, deal_id=deal_id)
        actions = batch2_storage.list_next_best_actions(self.tenant_id, deal_id=deal_id)
        outcomes = [
            o for o in batch3_storage.list_recommendation_outcomes(self.tenant_id)
            if o.get("related_deal") == deal_id or o.get("deal_id") == deal_id
        ]

        return {
            "deal": deal,
            "transcripts_count": len(transcripts),
            "actions": actions,
            "recorded_outcomes": outcomes,
            "attribution_nature": "recorded_association_not_proven_causation",
        }
