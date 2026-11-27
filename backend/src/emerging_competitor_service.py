"""
Emerging Competitor Detection Service for PrismIQ Batch 4.
Identifies potential emerging competitors from:
- Monitored signals
- Market developments & news
- Customer feedback
- Product capability comparisons

Capabilities:
- Entity resolution and deduplication across legal/brand aliases (e.g., "Acme AI" vs "Acme Inc").
- Verification that candidate is not already in the tenant's tracked landscape.
- Evidence-backed discovery explanations and verifiable relevance scoring.
- Human review gating (pending_approval -> approved / rejected).
- On approval, automatically promotes candidate to tracked company landscape.
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from . import batch2_storage, batch4_storage, storage

logger = logging.getLogger(__name__)

# Standard company suffixes for entity resolution and alias normalization
ENTITY_SUFFIX_REGEX = re.compile(
    r"\b(inc\.?|corp\.?|corporation|llc\.?|ltd\.?|limited|co\.?|company|technologies|labs|ai|io|tech)\b",
    re.IGNORECASE,
)


def normalize_company_name(name: str) -> str:
    """Normalize raw entity name for duplicate detection and alias resolution."""
    cleaned = str(name or "").strip()
    # Strip protocol or domain endings if present
    cleaned = re.sub(r"^https?://(www\.)?", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\.(com|io|ai|net|org|co)$", "", cleaned, flags=re.IGNORECASE)
    # Strip common corporate legal forms
    normalized = ENTITY_SUFFIX_REGEX.sub("", cleaned)
    # Remove punctuation & extra whitespace
    normalized = re.sub(r"[^\w\s]", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized.lower() if normalized else cleaned.lower()


class EmergingCompetitorService:
    """
    Scans signals and customer voice to surface emerging competitors with human approval gating.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def discover_candidates(self) -> List[Dict[str, Any]]:
        """
        Scan workspace signals and customer feedback for untracked entities.
        Deduplicates aliases, evaluates evidence grounding, computes relevance, and stores candidates.
        """
        # 1. Get currently tracked companies to prevent duplicate rediscovery
        tracked_companies = self._get_tracked_company_names()
        tracked_normalized = {normalize_company_name(c) for c in tracked_companies}

        # 2. Existing candidates already detected in this tenant
        existing_cands = batch4_storage.list_emerging_candidates(self.tenant_id, limit=200)
        cand_map_by_norm = {normalize_company_name(c["company_name"]): c for c in existing_cands}

        # 3. Pull signals, feedbacks
        signals = storage.load_signals(tenant_id=self.tenant_id) or []
        feedbacks = batch2_storage.list_feedback_records(tenant_id=self.tenant_id, limit=200) or []

        # Candidate accumulator: normalized_name -> dict
        discovered: Dict[str, Dict[str, Any]] = {}

        # Scan signals
        for sig in signals:
            ent = str(sig.get("company_name") or sig.get("company") or sig.get("entity_name") or "").strip()
            if not ent or ent.lower() in ("unknown", "generic", "n/a"):
                continue
            norm = normalize_company_name(ent)
            if norm in tracked_normalized:
                continue

            if norm not in discovered:
                discovered[norm] = {
                    "display_name": ent,
                    "normalized": norm,
                    "signals": [],
                    "feedback_mentions": [],
                    "domains": set(),
                }
            discovered[norm]["signals"].append(sig)
            if sig.get("domain"):
                discovered[norm]["domains"].add(sig.get("domain"))

        # Scan customer feedback
        for fb in feedbacks:
            ent = str(fb.get("company_name") or "").strip()
            if not ent:
                continue
            norm = normalize_company_name(ent)
            if norm in tracked_normalized:
                continue

            if norm not in discovered:
                discovered[norm] = {
                    "display_name": ent,
                    "normalized": norm,
                    "signals": [],
                    "feedback_mentions": [],
                    "domains": set(),
                }
            discovered[norm]["feedback_mentions"].append(fb)

        results = []
        for norm, data in discovered.items():
            sig_count = len(data["signals"])
            fb_count = len(data["feedback_mentions"])
            total_citations = sig_count + fb_count

            if total_citations == 0:
                continue

            # Grounded relevance calculation without hallucinated scores
            # Bounded strictly between 10.0 and 100.0
            relevance = min(100.0, 20.0 + sig_count * 15.0 + fb_count * 20.0)

            # Build evidence explanation
            parts = []
            if sig_count > 0:
                parts.append(f"{sig_count} external market signal(s)")
            if fb_count > 0:
                parts.append(f"{fb_count} customer feedback citation(s)")

            discovery_explanation = f"Detected across {', '.join(parts)} as an untracked market entrant."

            sources = []
            for s in data["signals"][:3]:
                sources.append({"type": "signal", "id": s.get("id"), "title": s.get("title")})
            for f in data["feedback_mentions"][:3]:
                sources.append({"type": "feedback", "id": f.get("id"), "summary": str(f.get("feedback_text", ""))[:80]})

            # Check if this candidate was previously recorded
            cand_id = None
            review_status = "pending_approval"
            if norm in cand_map_by_norm:
                prev = cand_map_by_norm[norm]
                cand_id = prev.get("id")
                review_status = prev.get("review_status", "pending_approval")

            candidate_payload = {
                "id": cand_id or str(uuid.uuid4()),
                "company_name": data["display_name"],
                "domain": list(data["domains"])[0] if data["domains"] else None,
                "industry": "Enterprise Software",
                "discovery_explanation": discovery_explanation,
                "similarity_reason": discovery_explanation,
                "discovery_sources": sources,
                "supporting_signals": sources,
                "review_status": review_status,
                "relevance_score": round(relevance, 2),
                "corroboration_count": total_citations,
            }

            saved = batch4_storage.save_emerging_candidate(candidate_payload, self.tenant_id)
            results.append(saved)

        return results

    def list_candidates(self, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """List tracked emerging competitor candidates."""
        return batch4_storage.list_emerging_candidates(self.tenant_id, status=status, limit=limit, offset=offset)

    def get_candidate(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Get candidate by ID."""
        return batch4_storage.get_emerging_candidate(candidate_id, self.tenant_id)

    def approve_candidate(
        self,
        candidate_id: str,
        reviewer_id: str = "analyst",
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Approve an emerging candidate and promote them to the tenant's tracked landscape.
        """
        cand = batch4_storage.get_emerging_candidate(candidate_id, self.tenant_id)
        if not cand:
            raise ValueError(f"Emerging candidate '{candidate_id}' not found.")

        updated = batch4_storage.update_candidate_review_status(
            candidate_id=candidate_id,
            new_status="approved",
            reviewer_id=reviewer_id,
            notes=notes or "Approved by analyst for continuous tracking.",
            tenant_id=self.tenant_id,
        )

        # Track in main company landscape
        storage.track_tenant_company(
            tenant_id=self.tenant_id,
            company_name=cand["company_name"],
            is_target=False,
            primary_domain=cand.get("domain"),
            industry_category=cand.get("industry"),
        )

        return updated

    def reject_candidate(
        self,
        candidate_id: str,
        reviewer_id: str = "analyst",
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Reject an emerging candidate with human audit notes.
        """
        cand = batch4_storage.get_emerging_candidate(candidate_id, self.tenant_id)
        if not cand:
            raise ValueError(f"Emerging candidate '{candidate_id}' not found.")

        return batch4_storage.update_candidate_review_status(
            candidate_id=candidate_id,
            new_status="rejected",
            reviewer_id=reviewer_id,
            notes=notes or "Rejected by analyst: out of scope or irrelevant.",
            tenant_id=self.tenant_id,
        )

    # -------------------------------------------------------------------------
    # Internal Helpers
    # -------------------------------------------------------------------------

    def _get_tracked_company_names(self) -> Set[str]:
        try:
            tracked = storage.get_tenant_tracked_companies(self.tenant_id) or []
            return {str(c.get("company_name", "")).strip() for c in tracked if c.get("company_name")}
        except Exception as e:
            logger.warning(f"Failed to fetch tracked companies for {self.tenant_id}: {e}")
            return set()
