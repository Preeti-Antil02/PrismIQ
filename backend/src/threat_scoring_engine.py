"""
Competitive Threat Scoring Engine for PrismIQ Batch 4.
Calculates an explainable threat intensity index (0-100) across five key factors:
1. Product activity (0.25)
2. Hiring activity (0.15)
3. Pricing movement (0.25)
4. Market activity (0.15)
5. Customer evidence (0.20)

Key Guarantees:
- Fully explainable factor contributions and configurable weights.
- Never represents score as a probability of competitive success.
- Never treats missing data as confirmed low threat: computes data coverage and normalizes
  across assessed factors so missing data does not artificially depress threat score.
- Saves audit trail and supporting evidence.
"""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from . import batch2_storage, batch4_storage, battlecard_storage, storage

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "product_activity": 0.25,
    "hiring_activity": 0.15,
    "pricing_movement": 0.25,
    "market_activity": 0.15,
    "customer_evidence": 0.20,
}

THREAT_LEVEL_THRESHOLDS = [
    (75.0, "Critical"),
    (50.0, "High"),
    (25.0, "Medium"),
    (0.0, "Low"),
]


class ThreatScoringEngine:
    """
    Explainable competitive threat scoring engine with data coverage safeguards.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def get_default_weights(self) -> Dict[str, float]:
        return dict(DEFAULT_WEIGHTS)

    def calculate_threat_score(
        self,
        competitor_name: str,
        custom_weights: Optional[Dict[str, float]] = None,
        save: bool = True,
    ) -> Dict[str, Any]:
        """
        Calculate threat score for given competitor within tenant context.
        """
        cname = str(competitor_name or "").strip()
        if not cname:
            raise ValueError("Competitor name cannot be empty.")

        weights = self._normalize_weights(custom_weights or DEFAULT_WEIGHTS)

        # 1. Gather all tenant data relevant to this competitor
        signals = self._get_competitor_signals(cname)
        claims = self._get_competitor_claims(cname)
        customer_feedbacks = self._get_competitor_customer_feedback(cname)

        # 2. Evaluate individual factors
        f_product = self._eval_product_activity(signals, claims)
        f_hiring = self._eval_hiring_activity(signals)
        f_pricing = self._eval_pricing_movement(signals, claims)
        f_market = self._eval_market_activity(signals)
        f_customer = self._eval_customer_evidence(customer_feedbacks)

        factor_map = {
            "product_activity": f_product,
            "hiring_activity": f_hiring,
            "pricing_movement": f_pricing,
            "market_activity": f_market,
            "customer_evidence": f_customer,
        }

        # 3. Assess coverage and missing data
        unassessed_factors = []
        assessed_weights = 0.0
        weighted_sum = 0.0
        supporting_evidence = []

        factor_contributions = {}
        for fname, weight in weights.items():
            fact = factor_map.get(fname, {"is_assessed": False, "raw_score": 0.0, "supporting_evidence": []})
            is_assessed = fact.get("is_assessed", False)
            raw_score = float(fact.get("raw_score", 0.0))
            data_points = int(fact.get("data_points_count", 0))

            if not is_assessed:
                unassessed_factors.append(fname)
                factor_contributions[fname] = {
                    "raw_score": None,
                    "weight": weight,
                    "effective_weight": 0.0,
                    "weighted_contribution": 0.0,
                    "is_assessed": False,
                    "data_points_count": 0,
                    "status": "missing_data_unassessed",
                    "explanation": fact.get("explanation", "No monitored signals or evidence available for this dimension."),
                }
            else:
                assessed_weights += weight
                weighted_sum += raw_score * weight
                factor_contributions[fname] = {
                    "raw_score": round(raw_score, 2),
                    "weight": weight,
                    "effective_weight": weight,
                    "weighted_contribution": round(raw_score * weight, 2),
                    "is_assessed": True,
                    "data_points_count": data_points,
                    "status": "assessed",
                    "explanation": fact.get("explanation", ""),
                }
                for ev in fact.get("supporting_evidence", []):
                    supporting_evidence.append(ev)

        data_coverage_score = round(assessed_weights, 4)
        has_missing_data = len(unassessed_factors) > 0

        # Normalization across assessed factors to prevent missing data from acting as false low threat
        if assessed_weights > 0:
            overall_threat_score = round(weighted_sum / assessed_weights, 2)
            # Rebalance effective weights for clarity
            for fname in factor_contributions:
                if factor_contributions[fname]["is_assessed"]:
                    factor_contributions[fname]["effective_weight"] = round(
                        factor_contributions[fname]["weight"] / assessed_weights, 4
                    )
        else:
            # Baseline neutral index if completely unassessed
            overall_threat_score = 50.0

        threat_level = self._classify_threat_level(overall_threat_score, has_missing_data, assessed_weights)

        formula_doc = (
            "Overall Threat Index = Sum(FactorRawScore_i * Weight_i for assessed factors) / Sum(Weight_i for assessed factors). "
            "Unassessed factors with missing data are excluded from the normalization denominator so absence of data "
            "is never conflated with confirmed low competitive threat."
        )

        result = {
            "competitor_name": cname,
            "overall_threat_score": overall_threat_score,
            "threat_level": threat_level,
            "factor_contributions": factor_contributions,
            "configured_weights": weights,
            "data_coverage_score": data_coverage_score,
            "has_missing_data": has_missing_data,
            "unassessed_factors": unassessed_factors,
            "supporting_evidence": supporting_evidence[:50],
            "calculation_formula": formula_doc,
            "score_representation": "threat_intensity_index",
            "is_probability": False,
            "disclaimer": "Threat score is an explainable activity and risk index on a 0-100 scale; it does not represent a probability of competitive success.",
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }

        if save:
            batch4_storage.save_threat_score(result, self.tenant_id)

        return result

    # -------------------------------------------------------------------------
    # Factor Evaluation Logic
    # -------------------------------------------------------------------------

    def _eval_product_activity(self, signals: List[Dict[str, Any]], claims: List[Dict[str, Any]]) -> Dict[str, Any]:
        relevant_sigs = [
            s for s in signals
            if str(s.get("category", "")).lower() in ("product", "feature", "release", "api", "engineering", "github")
            or "product" in str(s.get("signal_type", "")).lower()
            or "github" in str(s.get("source", "")).lower()
            or any(src.lower() in ("github",) for src in (s.get("contributing_sources") or []))
            or any(kw in str(s.get("title", "")).lower() for kw in ("release", "launch", "sdk", "api", "feature", "v1", "v2", "ga"))
        ]
        relevant_claims = [c for c in claims if str(c.get("claim_type", "")).lower() in ("feature", "product", "capability")]
        total_items = len(relevant_sigs) + len(relevant_claims)

        if total_items == 0:
            return {"is_assessed": False, "raw_score": 0.0, "data_points_count": 0, "supporting_evidence": []}

        # Frequency and velocity heuristic: up to 100
        score = min(100.0, total_items * 20.0)
        evidence = [{"type": "signal", "id": s.get("id") or s.get("event_id"), "title": s.get("title")} for s in relevant_sigs[:5]]
        evidence.extend([{"type": "claim", "id": c.get("id"), "title": c.get("claim_text")} for c in relevant_claims[:5]])

        return {
            "is_assessed": True,
            "raw_score": score,
            "data_points_count": total_items,
            "explanation": f"Observed {len(relevant_sigs)} product velocity signals and {len(relevant_claims)} documented capability claims.",
            "supporting_evidence": evidence,
        }

    def _eval_hiring_activity(self, signals: List[Dict[str, Any]]) -> Dict[str, Any]:
        relevant = [
            s for s in signals
            if str(s.get("category", "")).lower() in ("hiring", "jobs", "talent", "headcount", "recruiting", "careers", "expansion")
            or "hiring" in str(s.get("signal_type", "")).lower()
            or any(src in str(s.get("source", "")).lower() for src in ("job", "career", "linkedin", "greenhouse", "lever", "ashby", "workday"))
            or any(src.lower() in ("jobs", "careers") for src in (s.get("contributing_sources") or []))
            or any(kw in str(s.get("title", "")).lower() for kw in ("hiring", "recruit", "engineer", "director", "vp "))
        ]
        if not relevant:
            return {"is_assessed": False, "raw_score": 0.0, "data_points_count": 0, "supporting_evidence": []}

        score = min(100.0, len(relevant) * 25.0)
        evidence = [{"type": "signal", "id": s.get("id") or s.get("event_id"), "title": s.get("title")} for s in relevant[:5]]

        return {
            "is_assessed": True,
            "raw_score": score,
            "data_points_count": len(relevant),
            "explanation": f"Detected {len(relevant)} recruitment and key headcount expansion signals.",
            "supporting_evidence": evidence,
        }

    def _eval_pricing_movement(self, signals: List[Dict[str, Any]], claims: List[Dict[str, Any]]) -> Dict[str, Any]:
        relevant_sigs = [
            s for s in signals
            if str(s.get("category", "")).lower() in ("pricing", "tier", "discount", "packaging")
            or "pricing" in str(s.get("signal_type", "")).lower()
            or "pricing" in str(s.get("source", "")).lower()
            or any(src.lower() in ("pricing",) for src in (s.get("contributing_sources") or []))
            or any(kw in str(s.get("title", "")).lower() for kw in ("pricing", "price", "billing", "discount", "tier", "subscription", "fee"))
        ]
        relevant_claims = [c for c in claims if str(c.get("claim_type", "")).lower() == "pricing"]
        total_items = len(relevant_sigs) + len(relevant_claims)

        if total_items == 0:
            return {"is_assessed": False, "raw_score": 0.0, "data_points_count": 0, "supporting_evidence": []}

        score = min(100.0, 40.0 + total_items * 20.0)
        evidence = [{"type": "signal", "id": s.get("id") or s.get("event_id"), "title": s.get("title")} for s in relevant_sigs[:5]]
        evidence.extend([{"type": "claim", "id": c.get("id"), "title": c.get("claim_text")} for c in relevant_claims[:5]])

        return {
            "is_assessed": True,
            "raw_score": score,
            "data_points_count": total_items,
            "explanation": f"Identified {total_items} aggressive pricing updates, discount models, or tier changes.",
            "supporting_evidence": evidence,
        }

    def _eval_market_activity(self, signals: List[Dict[str, Any]]) -> Dict[str, Any]:
        relevant = [
            s for s in signals
            if str(s.get("category", "")).lower() in ("news", "press", "marketing", "campaign", "funding", "partnership", "event", "pr")
            or "market" in str(s.get("signal_type", "")).lower()
            or any(src in str(s.get("source", "")).lower() for src in ("news", "press", "rss", "hackernews", "reddit", "blog"))
            or any(src.lower() in ("news", "press", "reddit", "hackernews") for src in (s.get("contributing_sources") or []))
        ]
        if not relevant:
            return {"is_assessed": False, "raw_score": 0.0, "data_points_count": 0, "supporting_evidence": []}

        score = min(100.0, len(relevant) * 20.0)
        evidence = [{"type": "signal", "id": s.get("id") or s.get("event_id"), "title": s.get("title")} for s in relevant[:5]]

        return {
            "is_assessed": True,
            "raw_score": score,
            "data_points_count": len(relevant),
            "explanation": f"Captured {len(relevant)} PR, partnership announcements, or high-visibility market events.",
            "supporting_evidence": evidence,
        }

    def _eval_customer_evidence(self, feedbacks: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not feedbacks:
            return {"is_assessed": False, "raw_score": 0.0, "data_points_count": 0, "supporting_evidence": []}

        # Feedback expressing friction or competitor preference increases threat
        negative_or_objection = [
            f for f in feedbacks
            if str(f.get("sentiment", "")).lower() in ("negative", "critical", "mixed")
            or str(f.get("category", "")).lower() in ("objection", "pricing", "missing_feature")
        ]
        ratio = len(negative_or_objection) / len(feedbacks)
        score = min(100.0, ratio * 70.0 + len(feedbacks) * 5.0)

        evidence = [{"type": "customer_feedback", "id": f.get("id"), "summary": f.get("feedback_text", "")[:100]} for f in feedbacks[:5]]

        return {
            "is_assessed": True,
            "raw_score": score,
            "data_points_count": len(feedbacks),
            "explanation": f"Customer evidence includes {len(feedbacks)} direct feedback records ({len(negative_or_objection)} competitive objections/frictions).",
            "supporting_evidence": evidence,
        }

    # -------------------------------------------------------------------------
    # Internal Helpers
    # -------------------------------------------------------------------------

    def _normalize_weights(self, weights: Dict[str, float]) -> Dict[str, float]:
        clean = {}
        for k, def_w in DEFAULT_WEIGHTS.items():
            w = float(weights.get(k, def_w))
            clean[k] = max(0.0, w)

        total = sum(clean.values())
        if total <= 0:
            return dict(DEFAULT_WEIGHTS)
        return {k: round(v / total, 4) for k, v in clean.items()}

    def _classify_threat_level(self, score: float, has_missing_data: bool, assessed_weights: float) -> str:
        if assessed_weights == 0:
            return "Unassessed"
        for thresh, label in THREAT_LEVEL_THRESHOLDS:
            if score >= thresh:
                return label
        return "Low"

    def _get_competitor_signals(self, competitor_name: str) -> List[Dict[str, Any]]:
        try:
            all_signals = storage.load_signals(tenant_id=self.tenant_id) or []
            all_events = storage.load_events(tenant_id=self.tenant_id) or []
            c_low = competitor_name.lower()
            matched: List[Dict[str, Any]] = []
            seen_titles = set()
            for item in list(all_signals) + list(all_events):
                comp = str(item.get("company_name") or item.get("company") or item.get("entity_name") or "").lower()
                title = str(item.get("title") or "")
                content = str(item.get("content") or item.get("event_summary") or item.get("raw_excerpt") or "")
                if comp == c_low or (comp and c_low in comp) or c_low in title.lower() or c_low in content.lower():
                    t_key = title.strip().lower()
                    if t_key and t_key in seen_titles:
                        continue
                    if t_key:
                        seen_titles.add(t_key)
                    matched.append(item)
            return matched
        except Exception as e:
            logger.warning(f"Failed to fetch signals for {competitor_name}: {e}")
            return []

    def _get_competitor_claims(self, competitor_name: str) -> List[Dict[str, Any]]:
        try:
            return battlecard_storage.list_claims(
                tenant_id=self.tenant_id,
                company_name=competitor_name,
                status="verified",
            ) or []
        except Exception as e:
            logger.warning(f"Failed to fetch claims for {competitor_name}: {e}")
            return []

    def _get_competitor_customer_feedback(self, competitor_name: str) -> List[Dict[str, Any]]:
        try:
            return batch2_storage.list_feedback_records(
                tenant_id=self.tenant_id,
                company_name=competitor_name,
            ) or []
        except Exception as e:
            logger.warning(f"Failed to fetch feedback for {competitor_name}: {e}")
            return []
