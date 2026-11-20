"""
Win/Loss Intelligence Service for PrismIQ Batch 2.
Ingests, extracts, and analyzes CRM won/lost deal records, decision factors,
and buyer objections. Strictly reports sample sizes and refuses to fabricate
win rates or statistical trends on insufficient data (N < 3).
"""

import logging
import re
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from . import batch2_storage

logger = logging.getLogger(__name__)

# Canonical Factor Types
WIN_LOSS_FACTOR_TYPES = [
    "winning_factor",
    "loss_factor",
    "pricing_objection",
    "missing_feature",
    "integration_gap",
    "implementation_concern",
    "brand_trust",
]


class WinLossService:
    """
    Analyzes empirical deal outcomes, competitor win/loss shares, and objection trajectories.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    @classmethod
    def extract_factors_from_notes(cls, notes: str, competitor: str) -> List[Dict[str, str]]:
        """
        Extract decision factors from unstructured sales win/loss notes.
        """
        text = notes.strip()
        lower = text.lower()
        factors: List[Dict[str, str]] = []

        # Pricing objections
        if re.search(r"\b(pricing|cost|budget|discount|expensive|renewal|too high|cheaper|tco)\b", lower):
            factors.append({
                "factor_type": "pricing_objection",
                "factor_description": "Pricing, budget constraint or competitor price undercut",
                "competitor_name": competitor,
            })

        # Missing features
        if re.search(r"\b(missing|feature|roadmap|capability|lacked|functionality|gap)\b", lower):
            factors.append({
                "factor_type": "missing_feature",
                "factor_description": "Product capability or feature gap compared to competitor",
                "competitor_name": competitor,
            })

        # Integration gaps
        if re.search(r"\b(integration|connector|api|sso|saml|salesforce|hubspot|slack|scim)\b", lower):
            factors.append({
                "factor_type": "integration_gap",
                "factor_description": "Integration gap or missing standard connector",
                "competitor_name": competitor,
            })

        # Implementation concerns
        if re.search(r"\b(implementation|onboard|deploy|time to value|timeline|migration|complex)\b", lower):
            factors.append({
                "factor_type": "implementation_concern",
                "factor_description": "Implementation complexity or prolonged time to value",
                "competitor_name": competitor,
            })

        # Brand trust / market presence
        if re.search(r"\b(brand|trust|established|incumbent|gartner|leader|safe choice|risk)\b", lower):
            factors.append({
                "factor_type": "brand_trust",
                "factor_description": "Buyer perception of incumbent brand stability or enterprise risk",
                "competitor_name": competitor,
            })

        return factors

    def ingest_deals(
        self,
        deal_rows: List[Dict[str, Any]],
        document_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Ingest and normalize deal records from CRM export rows or manual entry.
        """
        saved_deals = []
        factors_to_save = []

        for row in deal_rows:
            dname = (row.get("deal_name") or row.get("opportunity_name") or row.get("name") or "Unnamed Deal").strip()
            raw_outcome = (row.get("outcome") or row.get("stage") or row.get("status") or "lost").strip().lower()
            
            outcome = "lost"
            if any(w in raw_outcome for w in ("won", "closed won", "win")):
                outcome = "won"
            elif any(w in raw_outcome for w in ("churn", "cancelled")):
                outcome = "churned"
            elif any(w in raw_outcome for w in ("no decision", "stalled", "dropped")):
                outcome = "no_decision"

            val_raw = row.get("deal_value") or row.get("amount") or row.get("value") or 0.0
            try:
                deal_val = float(str(val_raw).replace("$", "").replace(",", "").strip())
            except (ValueError, TypeError):
                deal_val = 0.0

            close_d = str(row.get("close_date") or row.get("date") or datetime.now(timezone.utc).isoformat()[:10]).strip()
            primary_comp = (row.get("primary_competitor") or row.get("competitor") or "None").strip()
            
            raw_comps = row.get("competitors_involved") or []
            if isinstance(raw_comps, str):
                comps_list = [c.strip() for c in re.split(r"[,;|]", raw_comps) if c.strip()]
            else:
                comps_list = list(raw_comps)

            if primary_comp != "None" and primary_comp not in comps_list:
                comps_list.append(primary_comp)

            # Buyer objections
            raw_objs = row.get("buyer_objections") or row.get("loss_reasons") or row.get("loss_reason") or []
            if isinstance(raw_objs, str):
                objs_list = [o.strip() for o in re.split(r"[,;\n|]", raw_objs) if o.strip()]
            else:
                objs_list = list(raw_objs)

            notes = str(row.get("notes") or row.get("description") or "").strip()

            deal_record = {
                "document_id": document_id,
                "deal_name": dname,
                "outcome": outcome,
                "deal_value": deal_val,
                "close_date": close_d,
                "primary_competitor": primary_comp,
                "competitors_involved": comps_list,
                "customer_segment": str(row.get("customer_segment") or row.get("segment") or "general").strip(),
                "industry": str(row.get("industry") or "General").strip(),
                "buyer_objections": objs_list,
                "notes": notes,
            }

            saved = batch2_storage.save_win_loss_deal(deal_record, self.tenant_id)
            saved_deals.append(saved)
            deal_id = saved["id"]

            # Explicit winning / loss factors
            if outcome == "won":
                win_factor = row.get("winning_factor") or row.get("win_reason")
                if win_factor:
                    factors_to_save.append({
                        "deal_id": deal_id,
                        "factor_type": "winning_factor",
                        "factor_description": str(win_factor).strip(),
                        "competitor_name": primary_comp,
                    })
            else:
                loss_factor = row.get("loss_factor") or row.get("loss_reason")
                if loss_factor:
                    factors_to_save.append({
                        "deal_id": deal_id,
                        "factor_type": "loss_factor",
                        "factor_description": str(loss_factor).strip(),
                        "competitor_name": primary_comp,
                    })

            # Additional factors from notes
            extracted = self.extract_factors_from_notes(notes, primary_comp)
            for ef in extracted:
                ef["deal_id"] = deal_id
                factors_to_save.append(ef)

        if factors_to_save:
            batch2_storage.save_win_loss_factors(factors_to_save, self.tenant_id)

        return saved_deals

    def get_analytics(
        self,
        competitor_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compute win/loss analytics. Strictly distinguishes valid sample sizes from
        insufficient data (N < 3). NEVER fabricates percentages or trends.
        """
        all_deals = batch2_storage.list_win_loss_deals(
            tenant_id=self.tenant_id,
            primary_competitor=competitor_name,
            limit=1000,
        )

        total_sample = len(all_deals)

        if total_sample == 0:
            return {
                "competitor_name": competitor_name,
                "total_deals": 0,
                "status": "no_data",
                "message": f"No win/loss deal records found for competitor '{competitor_name or 'All'}' in this workspace.",
                "win_rate_percentage": None,
                "competitor_breakdown": {},
                "top_loss_factors": [],
                "top_win_factors": [],
                "sample_size_warning": "Upload CRM exports or won/lost deals to view win/loss intelligence.",
            }

        # Insufficient sample check threshold
        is_insufficient = total_sample < 3
        confidence = "Low" if is_insufficient else ("Medium" if total_sample < 10 else "High")

        won_deals = [d for d in all_deals if d.get("outcome") == "won"]
        lost_deals = [d for d in all_deals if d.get("outcome") == "lost"]
        churn_deals = [d for d in all_deals if d.get("outcome") == "churned"]
        no_dec_deals = [d for d in all_deals if d.get("outcome") == "no_decision"]

        decided_deals = len(won_deals) + len(lost_deals)
        win_rate = round((len(won_deals) / decided_deals) * 100, 1) if decided_deals > 0 else 0.0

        total_pipeline_value = sum(d.get("deal_value", 0.0) for d in all_deals)
        won_value = sum(d.get("deal_value", 0.0) for d in won_deals)
        lost_value = sum(d.get("deal_value", 0.0) for d in lost_deals)

        # Competitor breakdown
        comp_counts: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0, "won": 0, "lost": 0, "deal_value": 0.0})
        for d in all_deals:
            c = d.get("primary_competitor") or "None"
            comp_counts[c]["total"] += 1
            comp_counts[c]["deal_value"] += d.get("deal_value", 0.0)
            if d.get("outcome") == "won":
                comp_counts[c]["won"] += 1
            elif d.get("outcome") == "lost":
                comp_counts[c]["lost"] += 1

        comp_breakdown = {}
        for c, stats in comp_counts.items():
            c_decided = stats["won"] + stats["lost"]
            c_sample = stats["total"]
            c_wr = round((stats["won"] / c_decided) * 100, 1) if c_decided > 0 else 0.0
            comp_breakdown[c] = {
                "total_deals": c_sample,
                "won": stats["won"],
                "lost": stats["lost"],
                "win_rate_percentage": c_wr if c_sample >= 3 else None,
                "status": "valid_sample" if c_sample >= 3 else "insufficient_data",
                "sample_size": c_sample,
                "total_deal_value": stats["deal_value"],
            }

        # Factors aggregation
        factors = batch2_storage.list_win_loss_factors(self.tenant_id, competitor_name=competitor_name)
        loss_factor_counts = Counter(
            f["factor_description"] for f in factors
            if f.get("factor_type") in ("loss_factor", "pricing_objection", "missing_feature", "integration_gap", "implementation_concern", "brand_trust")
        )
        win_factor_counts = Counter(
            f["factor_description"] for f in factors
            if f.get("factor_type") == "winning_factor"
        )

        top_loss_factors = [
            {"factor": factor, "frequency": count, "sample_percentage": round((count / total_sample) * 100, 1)}
            for factor, count in loss_factor_counts.most_common(5)
        ]
        top_win_factors = [
            {"factor": factor, "frequency": count, "sample_percentage": round((count / total_sample) * 100, 1)}
            for factor, count in win_factor_counts.most_common(5)
        ]

        # Trajectory / Emerging Loss Patterns
        emerging_patterns = []
        if len(lost_deals) >= 3:
            recent_losses = sorted(lost_deals, key=lambda d: d.get("close_date", ""), reverse=True)[:5]
            recent_objs = Counter([obj for d in recent_losses for obj in d.get("buyer_objections", [])])
            for obj, count in recent_objs.most_common(3):
                if count >= 2:
                    emerging_patterns.append({
                        "pattern": f"Frequent objection '{obj}' detected in {count} of the last {len(recent_losses)} lost deals",
                        "recent_loss_count": count,
                        "urgency": "High",
                    })

        return {
            "competitor_name": competitor_name,
            "total_deals": total_sample,
            "sample_size": total_sample,
            "status": "insufficient_data" if is_insufficient else "valid_sample",
            "has_sufficient_data": not is_insufficient,
            "confidence": confidence,
            "sample_size_warning": (
                f"Small sample size (n = {total_sample} deals). Insufficient data: statistical conclusions require at least 3 deals."
                if is_insufficient else None
            ),
            "win_rate_percentage": win_rate if not is_insufficient else None,
            "win_rate_percent": win_rate if not is_insufficient else None,
            "won_deals": len(won_deals),
            "lost_deals": len(lost_deals),
            "outcomes": {
                "won": len(won_deals),
                "lost": len(lost_deals),
                "churned": len(churn_deals),
                "no_decision": len(no_dec_deals),
            },
            "financials": {
                "total_pipeline_value": total_pipeline_value,
                "won_value": won_value,
                "lost_value": lost_value,
            },
            "competitor_breakdown": comp_breakdown,
            "top_loss_factors": top_loss_factors,
            "top_win_factors": top_win_factors,
            "emerging_patterns": emerging_patterns,
        }

