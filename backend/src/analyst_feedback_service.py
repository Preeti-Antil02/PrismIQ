"""
Analyst Feedback Service for PrismIQ Batch 4.
Captures structured human feedback from intelligence analysts across six canonical types:
- correct
- incorrect
- important
- not_useful
- ignore
- change_interpretation

Guarantees:
- Feedback is stored against the exact claim or intelligence record.
- Used for ranking, triage, and consensus assessment workflows.
- Single analyst feedback does NOT unilaterally alter underlying factual claims without governance review.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import batch4_storage, battlecard_storage

logger = logging.getLogger(__name__)

CANONICAL_FEEDBACK_TYPES = {
    "correct",
    "incorrect",
    "important",
    "not_useful",
    "ignore",
    "change_interpretation",
}


class AnalystFeedbackService:
    """
    Captures and aggregates structured analyst feedback.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def submit_feedback(
        self,
        target_entity_type: str,
        target_entity_id: str,
        feedback_type: str,
        analyst_id: str = "analyst",
        notes: Optional[str] = None,
        suggested_interpretation: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Submit analyst feedback on a claim, signal, battlecard, or recommendation.
        """
        fb_clean = str(feedback_type).strip().lower().replace(" ", "_")
        if fb_clean not in CANONICAL_FEEDBACK_TYPES:
            raise ValueError(
                f"Invalid feedback type '{feedback_type}'. Must be one of: {', '.join(sorted(CANONICAL_FEEDBACK_TYPES))}"
            )

        if not str(target_entity_id or "").strip():
            raise ValueError("Target entity ID cannot be empty.")

        payload = {
            "id": str(uuid.uuid4()),
            "target_entity_type": str(target_entity_type).strip().lower(),
            "target_entity_id": str(target_entity_id).strip(),
            "feedback_type": fb_clean,
            "analyst_id": str(analyst_id or "analyst").strip(),
            "notes": str(notes or "").strip(),
            "suggested_interpretation": str(suggested_interpretation or "").strip() or None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        saved = batch4_storage.save_analyst_feedback(payload, self.tenant_id)
        return saved

    def get_feedback_summary(
        self,
        target_entity_type: str,
        target_entity_id: str,
    ) -> Dict[str, Any]:
        """
        Aggregate feedback submissions and calculate analyst consensus without modifying underlying facts.
        """
        feedbacks = batch4_storage.list_analyst_feedback(
            tenant_id=self.tenant_id,
            target_entity_type=target_entity_type,
            target_entity_id=target_entity_id,
            limit=500,
        )

        counts = {ft: 0 for ft in CANONICAL_FEEDBACK_TYPES}
        for fb in feedbacks:
            ft = fb.get("feedback_type")
            if ft in counts:
                counts[ft] += 1

        total = len(feedbacks)
        disputed_count = counts["incorrect"] + counts["change_interpretation"]
        needs_review = disputed_count > 0

        # Consensus determination
        if total == 0:
            consensus = "no_feedback"
        elif counts["correct"] > disputed_count:
            consensus = "analyst_validated"
        elif disputed_count > counts["correct"]:
            consensus = "analyst_disputed"
        else:
            consensus = "mixed_feedback"

        return {
            "target_entity_type": target_entity_type,
            "target_entity_id": target_entity_id,
            "total_feedback_count": total,
            "feedback_type_counts": counts,
            "consensus_status": consensus,
            "requires_governance_review": needs_review,
            "governance_note": (
                "Individual analyst feedback informs review ranking; underlying factual claims "
                "are preserved until multi-stakeholder governance consensus is reached."
            ),
            "recent_feedback_items": feedbacks[:10],
        }

    def list_feedback(
        self,
        target_entity_type: Optional[str] = None,
        target_entity_id: Optional[str] = None,
        feedback_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        return batch4_storage.list_analyst_feedback(
            tenant_id=self.tenant_id,
            target_entity_type=target_entity_type,
            target_entity_id=target_entity_id,
            feedback_type=feedback_type,
            limit=limit,
            offset=offset,
        )
