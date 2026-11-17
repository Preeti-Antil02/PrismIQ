"""
Battlecard Drift Detection Engine for PrismIQ.

Analyzes incoming findings and consolidated events against existing intelligence claims.
Detects:
- Stable (claim remains valid)
- New evidence (fresh proof corroborates claim)
- Contradicted (new evidence directly opposes or invalidates claim)
- Stale (claim verification is dated or superseded by major architectural changes)

Enforces idempotent deduplication to prevent duplicate alerts for identical events.
Never silently overwrites published battlecards.
"""

import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from . import storage
from . import battlecard_storage

logger = logging.getLogger(__name__)

# Heuristic patterns for detecting competitive feature availability and contradictions
CAPABILITY_NEGATIVE_TERMS = {
    "lacks", "missing", "unsupported", "cannot", "does not have",
    "no native", "proprietary lock-in", "unpredictable", "gap",
    "limited", "no support", "without"
}

CAPABILITY_POSITIVE_TERMS = {
    "launches", "launched", "announces", "announced", "general availability",
    "ga", "releases", "released", "now available", "native support",
    "certified", "soc2", "expansion", "unveils"
}


class DriftDetector:
    """
    Evaluates evidence drift against active intelligence claims.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def detect_drift_for_event(
        self,
        event: Dict[str, Any],
        company_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Evaluate a single consolidated event or finding against active competitor claims.
        Returns created drift alert records.
        """
        cname = str(company_name or event.get("company_name", "")).strip()
        if not cname:
            return []

        claims = battlecard_storage.get_claims(
            tenant_id=self.tenant_id,
            company_name=cname,
            status="active"
        )
        if not claims:
            return []

        alerts_created = []
        ev_id = str(event.get("event_id") or event.get("id") or "")
        ev_title = str(event.get("title") or event.get("what_changed") or "")
        ev_summary = str(event.get("event_summary") or event.get("why_it_matters") or event.get("strategic_implication") or "")
        ev_url = str(event.get("url") or event.get("evidence_url") or "")
        ev_text = f"{ev_title} {ev_summary}".lower()

        for claim in claims:
            drift_res = self._evaluate_claim_against_evidence(claim, event, ev_text)
            if drift_res and drift_res.get("drift_type") != "stable":
                alert_dict = {
                    "claim_id": claim["id"],
                    "company_name": cname,
                    "drift_type": drift_res["drift_type"],
                    "trigger_event_id": ev_id or None,
                    "new_evidence_excerpt": ev_summary[:400] or ev_title,
                    "new_evidence_url": ev_url,
                    "suggested_update": drift_res["suggested_update"],
                    "review_status": "pending",
                }
                saved_alert, is_new = battlecard_storage.save_claim_drift_alert(alert_dict, self.tenant_id)
                if is_new:
                    alerts_created.append(saved_alert)

        return alerts_created

    def detect_drift_for_events(
        self,
        events: List[Dict[str, Any]],
        company_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Batch evaluate multiple events against claims.
        """
        all_alerts = []
        for ev in events:
            alerts = self.detect_drift_for_event(ev, company_name=company_name)
            all_alerts.extend(alerts)
        return all_alerts

    def detect_stale_claims(
        self,
        company_name: Optional[str] = None,
        stale_days_threshold: int = 90
    ) -> List[Dict[str, Any]]:
        """
        Check for claims whose last verification timestamp exceeds the stale threshold.
        """
        claims = battlecard_storage.get_claims(
            tenant_id=self.tenant_id,
            company_name=company_name,
            status="active"
        )

        stale_alerts = []
        now = datetime.now(timezone.utc)

        for claim in claims:
            last_v = claim.get("last_verified_at")
            is_stale = False
            days_old = 0
            if last_v:
                try:
                    dt = datetime.fromisoformat(str(last_v).replace("Z", "+00:00"))
                    days_old = (now - dt).days
                    if days_old >= stale_days_threshold:
                        is_stale = True
                except Exception:
                    pass
            else:
                is_stale = True

            if is_stale:
                cid = claim["id"]
                cname = claim["company_name"]
                stmt = claim.get("statement", "")
                suggested = {
                    "statement": stmt,
                    "reason": f"Claim has not been verified for {days_old} days. Re-verify market validity.",
                    "fact_impact_act": claim.get("fact_impact_act") or {},
                }
                dedup_key = battlecard_storage.compute_drift_deduplication_key(cid, "stale", None, None)
                alert_dict = {
                    "claim_id": cid,
                    "company_name": cname,
                    "drift_type": "stale",
                    "trigger_event_id": None,
                    "new_evidence_excerpt": f"Verification expired ({days_old} days old). Threshold: {stale_days_threshold} days.",
                    "new_evidence_url": None,
                    "suggested_update": suggested,
                    "review_status": "pending",
                    "deduplication_key": dedup_key,
                }
                saved_alert, is_new = battlecard_storage.save_claim_drift_alert(alert_dict, self.tenant_id)
                if is_new:
                    stale_alerts.append(saved_alert)

        return stale_alerts

    # -----------------------------------------------------------------------
    # Claim Drift Evaluation Logic
    # -----------------------------------------------------------------------

    def _evaluate_claim_against_evidence(
        self,
        claim: Dict[str, Any],
        event: Dict[str, Any],
        ev_text: str
    ) -> Optional[Dict[str, Any]]:
        """
        Compare claim against event text to classify drift:
        - Contradicted: event announces capability claim said was lacking, or contradicts pricing.
        - New evidence: event adds fresh proof/benchmark supporting claim.
        - Contextualizes: related event adds nuance.
        - Stable: no change.
        """
        claim_stmt = str(claim.get("statement", "")).lower()
        claim_subj = str(claim.get("subject", "")).lower()
        claim_type = str(claim.get("claim_type", ""))
        fia = claim.get("fact_impact_act") or {}
        fact_text = str(fia.get("fact", "")).lower()

        full_claim_text = f"{claim_stmt} {claim_subj} {fact_text}"

        # Extract meaningful subject tokens (excluding common stop words)
        stop_words = {"the", "and", "for", "with", "that", "this", "from", "when", "into", "their", "our", "are", "was", "will"}
        tokens = set(re.findall(r"\b[a-z]{4,}\b", full_claim_text)) - stop_words

        # Check keyword overlap
        matched_tokens = [t for t in tokens if t in ev_text]
        if not matched_tokens and len(tokens) > 2:
            return {"drift_type": "stable"}

        # 1. Contradiction Detection
        # Case A: Claim states competitor lacks something or has a limitation, but event announces GA / launch
        has_negative_claim = any(neg in full_claim_text for neg in CAPABILITY_NEGATIVE_TERMS)
        has_positive_event = any(pos in ev_text for pos in CAPABILITY_POSITIVE_TERMS)

        if has_negative_claim and has_positive_event and len(matched_tokens) >= 1:
            matched_feature = matched_tokens[0]
            ev_title = event.get("title") or event.get("what_changed") or "New Capability"
            suggested_stmt = f"Competitor now offers {matched_feature} capabilities (announced in: '{ev_title}')."
            suggested_fia = {
                "fact": f"General Availability of {matched_feature} announced with official documentation.",
                "impact": f"Eliminates previous limitation where {claim['company_name']} lacked {matched_feature}.",
                "act": f"Pivot sales discovery to enterprise security, sovereign deployment, and high-scale cost efficiency.",
            }
            return {
                "drift_type": "contradicted",
                "relationship": "contradicts",
                "suggested_update": {
                    "statement": suggested_stmt,
                    "reason": f"New event contradicts previous limitation claim '{claim['statement'][:100]}'.",
                    "fact_impact_act": suggested_fia,
                    "confidence": "High",
                }
            }

        # Case B: Pricing contradiction
        if claim_type == "pricing_comparison" and ("free" in ev_text or "price drop" in ev_text or "pricing update" in ev_text):
            ev_title = event.get("title") or event.get("what_changed") or "Pricing Revision"
            suggested_stmt = f"Updated Pricing Structure: {ev_title}"
            suggested_fia = {
                "fact": f"Recent pricing change detected: {event.get('event_summary') or ev_title}",
                "impact": "Alters deal economics and customer entry tier thresholds.",
                "act": "Re-run TCO model highlighting full production infrastructure costs beyond starter tier.",
            }
            return {
                "drift_type": "contradicted",
                "relationship": "contradicts",
                "suggested_update": {
                    "statement": suggested_stmt,
                    "reason": "Competitor introduced new pricing terms altering previous comparison.",
                    "fact_impact_act": suggested_fia,
                    "confidence": "High",
                }
            }

        # 2. New Evidence Detection
        # Corroborating proof, performance benchmarks, customer case studies, or certifications
        proof_indicators = {"benchmark", "soc2", "compliance", "case study", "faster", "latency", "scale", "million", "billion"}
        if any(pi in ev_text for pi in proof_indicators) and len(matched_tokens) >= 1:
            ev_title = event.get("title") or event.get("what_changed") or "Empirical Benchmark"
            suggested_stmt = f"{claim.get('statement')} (Corroborated by: {ev_title})"
            suggested_fia = {
                "fact": f"{claim.get('fact_impact_act', {}).get('fact', claim.get('statement'))} - Corroborated with fresh market evidence.",
                "impact": claim.get('fact_impact_act', {}).get('impact', "Strengthens current positioning."),
                "act": claim.get('fact_impact_act', {}).get('act', "Cite verified metric in enterprise RFP responses."),
            }
            return {
                "drift_type": "new_evidence",
                "relationship": "supports",
                "suggested_update": {
                    "statement": suggested_stmt,
                    "reason": f"Fresh supporting evidence documented in event '{ev_title}'.",
                    "fact_impact_act": suggested_fia,
                    "confidence": "High",
                }
            }

        return {"drift_type": "stable"}
