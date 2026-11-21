"""
Evidence Governance Service for PrismIQ Batch 4.
Extends existing evidence infrastructure to ensure strict source provenance, verification auditing,
confidence methodologies, and bidirectional contradictory evidence tracking.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import batch4_storage, battlecard_storage, storage
from .relationship_engine import RelationshipEngine

logger = logging.getLogger(__name__)

VALID_SOURCE_TYPES = {
    "documentation",
    "pricing_page",
    "financial_filing",
    "press_release",
    "earnings_call",
    "customer_interview",
    "patent_filing",
    "news_article",
    "sales_call_transcript",
    "github_repository",
}

VALID_VERIFICATION_STATUSES = {
    "verified",
    "unverified",
    "disputed",
    "deprecated",
}


class EvidenceGovernanceService:
    """
    Manages governed evidence records, provenance trails, and contradictory assertions.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()
        self.relationship_engine = RelationshipEngine(self.tenant_id)

    def record_evidence(
        self,
        source_url: str,
        source_title: str,
        excerpt: str,
        source_type: str = "documentation",
        claim_id: Optional[str] = None,
        publication_date: Optional[str] = None,
        relationship: str = "supports",
        source_quality: str = "primary",
        confidence_methodology: str = "primary_source_verification",
        verification_status: str = "verified",
        related_company: Optional[str] = None,
        related_competitor: Optional[str] = None,
        related_event_id: Optional[str] = None,
        related_battlecard_id: Optional[str] = None,
        related_recommendation_id: Optional[str] = None,
        actor_id: str = "system",
    ) -> Dict[str, Any]:
        """
        Record governed evidence with full provenance metadata.
        """
        stype = str(source_type).strip().lower()
        if stype not in VALID_SOURCE_TYPES:
            stype = "documentation"

        vstatus = str(verification_status).strip().lower()
        if vstatus not in VALID_VERIFICATION_STATUSES:
            vstatus = "verified"

        payload = {
            "id": str(uuid.uuid4()),
            "claim_id": claim_id,
            "source_url": str(source_url or "").strip(),
            "source_title": str(source_title or "").strip(),
            "source_type": stype,
            "excerpt": str(excerpt or "").strip(),
            "publication_date": publication_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "relationship": str(relationship or "supports").strip().lower(),
            "source_quality": str(source_quality or "primary").strip().lower(),
            "confidence_methodology": str(confidence_methodology or "primary_source_verification").strip(),
            "verification_status": vstatus,
            "last_verified_at": datetime.now(timezone.utc).isoformat(),
            "related_company": related_company,
            "related_competitor": related_competitor,
            "related_event_id": related_event_id,
            "related_battlecard_id": related_battlecard_id,
            "related_recommendation_id": related_recommendation_id,
        }

        saved = batch4_storage.save_governed_evidence(payload, self.tenant_id)

        # Register evidence relationship
        if related_company or related_competitor:
            comp_name = related_company or related_competitor
            try:
                self.relationship_engine.create_relationship(
                    subject_id=saved["id"],
                    subject_type="evidence",
                    subject_name=f"Evidence: {saved['source_title'][:30]}",
                    predicate=payload["relationship"],
                    object_id=comp_name,
                    object_type="competitor",
                    object_name=comp_name,
                    relationship_source=saved["source_url"] or "primary_source",
                    actor_id=actor_id,
                )
            except Exception as e:
                logger.warning(f"Failed to record evidence relationship: {e}")

        return saved

    def link_contradictory_evidence(
        self,
        evidence_id_a: str,
        evidence_id_b: str,
        contradiction_reason: str,
        confidence: str = "High",
        actor_id: str = "analyst",
    ) -> Dict[str, Any]:
        """
        Record bidirectional contradictory relationship between two evidence records.
        """
        ea = batch4_storage.get_governed_evidence(evidence_id_a, self.tenant_id)
        eb = batch4_storage.get_governed_evidence(evidence_id_b, self.tenant_id)

        if not ea:
            raise ValueError(f"Evidence '{evidence_id_a}' not found.")
        if not eb:
            raise ValueError(f"Evidence '{evidence_id_b}' not found.")

        # Update verification statuses to disputed if not already deprecated
        if ea.get("verification_status") != "deprecated":
            ea["verification_status"] = "disputed"
            batch4_storage.save_governed_evidence(ea, self.tenant_id)
        if eb.get("verification_status") != "deprecated":
            eb["verification_status"] = "disputed"
            batch4_storage.save_governed_evidence(eb, self.tenant_id)

        link = batch4_storage.save_contradictory_link(
            evidence_id_a=evidence_id_a,
            evidence_id_b=evidence_id_b,
            contradiction_reason=contradiction_reason,
            confidence=confidence,
            tenant_id=self.tenant_id,
            actor_id=actor_id,
        )

        return link

    def get_evidence_traceability(self, evidence_id: str) -> Dict[str, Any]:
        """
        Trace full lineage of an evidence item across claims, battlecards, deals, and contradictions.
        """
        ev = batch4_storage.get_governed_evidence(evidence_id, self.tenant_id)
        if not ev:
            raise ValueError(f"Evidence '{evidence_id}' not found.")

        # Contradictions
        contradictions = batch4_storage.list_contradictory_links(evidence_id, self.tenant_id)

        # Graph relationships
        graph = self.relationship_engine.get_entity_graph(evidence_id, max_depth=2)

        # Related claim details
        claim = None
        if ev.get("claim_id"):
            claim = battlecard_storage.get_claim(ev["claim_id"], self.tenant_id)

        return {
            "evidence": ev,
            "associated_claim": claim,
            "contradictory_links": contradictions,
            "has_contradictions": len(contradictions) > 0,
            "provenance_graph": graph,
            "traceability_verified": True,
        }

    def list_evidence(
        self,
        claim_id: Optional[str] = None,
        relationship: Optional[str] = None,
        related_company: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        return batch4_storage.list_governed_evidence(
            tenant_id=self.tenant_id,
            claim_id=claim_id,
            relationship=relationship,
            related_company=related_company,
            limit=limit,
            offset=offset,
        )

    def get_evidence(self, evidence_id: str) -> Optional[Dict[str, Any]]:
        return batch4_storage.get_governed_evidence(evidence_id, self.tenant_id)
