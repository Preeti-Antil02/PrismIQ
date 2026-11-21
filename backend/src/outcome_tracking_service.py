"""
Outcome Tracking Service for PrismIQ Batch 3.
Connects Next Best Action recommendations to recorded team actions and deal outcomes.
Strictly enforces the boundary between recorded empirical association and proven causation:
never automatically claims PrismIQ recommendations solely caused a deal outcome.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import batch3_storage

logger = logging.getLogger(__name__)

VALID_OUTCOMES = {
    "won",
    "lost",
    "accelerated",
    "objection_neutralized",
    "stage_advanced",
    "stalled",
    "no_decision",
    "churned",
}


class OutcomeTrackingService:
    """
    Manages lightweight outcome records linking actions to deal results.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def record_outcome(
        self,
        recommendation_id: str,
        action_taken: str,
        related_deal: str,
        outcome: str,
        outcome_date: Optional[str] = None,
        notes: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Record verified action execution and deal outcome.
        Enforces non-causation recorded association safeguards.
        """
        rec_id = str(recommendation_id).strip()
        deal_id = str(related_deal).strip()
        action_str = str(action_taken).strip()
        outcome_str = str(outcome).strip().lower()

        if not rec_id:
            raise ValueError("recommendation_id is required")
        if not deal_id:
            raise ValueError("related_deal / deal_id is required")
        if not action_str:
            raise ValueError("action_taken description is required")

        # Verify deal exists and belongs to tenant
        deal = batch3_storage.get_deal(deal_id, self.tenant_id)
        if not deal:
            raise ValueError(f"Deal '{deal_id}' not found in workspace.")

        record_dict = {
            "recommendation_id": rec_id,
            "action_taken": action_str,
            "related_deal": deal_id,
            "deal_id": deal_id,
            "outcome": outcome_str,
            "outcome_date": outcome_date or datetime.now(timezone.utc).isoformat()[:10],
            "notes": str(notes or "").strip(),
            # Strict non-causation guarantee
            "attribution_type": "recorded_association",
            "causation_claimed": False,
            "attribution_disclaimer": "Recorded association between action and deal outcome; does not establish direct causation.",
        }

        saved = batch3_storage.record_recommendation_outcome(record_dict, self.tenant_id)

        # If deal outcome is won/lost and deal is active, also advance deal stage accordingly
        if outcome_str in ("won", "closed_won") and deal.get("stage") != "closed_won":
            batch3_storage.update_deal(deal_id, {"stage": "closed_won", "outcome": "won"}, self.tenant_id)
        elif outcome_str in ("lost", "closed_lost") and deal.get("stage") != "closed_lost":
            batch3_storage.update_deal(deal_id, {"stage": "closed_lost", "outcome": "lost"}, self.tenant_id)

        return saved

    def get_outcome(self, outcome_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve outcome record by ID."""
        return batch3_storage.get_recommendation_outcome(outcome_id, self.tenant_id)

    def list_outcomes(
        self,
        deal_id: Optional[str] = None,
        recommendation_id: Optional[str] = None,
        outcome: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List outcomes filtered by deal, recommendation, or outcome type."""
        return batch3_storage.list_recommendation_outcomes(
            tenant_id=self.tenant_id,
            deal_id=deal_id,
            recommendation_id=recommendation_id,
            outcome=outcome,
            limit=limit,
            offset=offset,
        )

    def get_deal_outcomes(self, deal_id: str) -> List[Dict[str, Any]]:
        """List all outcomes recorded for a specific deal."""
        return self.list_outcomes(deal_id=deal_id)
