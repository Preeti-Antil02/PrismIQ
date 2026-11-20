"""
Customer Voice Intelligence Service for PrismIQ Batch 2.
Ingests, classifies, and clusters customer reviews, support tickets,
interviews, and discussion forum feedback across 8 canonical categories.
Generates evidence-backed sentiment, recurring themes, and competitive gap analyses.
"""

import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from . import batch2_storage
from . import battlecard_storage
from .battlecard_drift import DriftDetector

logger = logging.getLogger(__name__)

# Canonical 8 Customer Voice Categories
CUSTOMER_VOICE_CATEGORIES = [
    "love",
    "dislike",
    "feature_request",
    "product_complaint",
    "pricing_complaint",
    "onboarding_issue",
    "reason_for_switching",
    "reason_for_choosing_competitor",
]

# Aspect Heuristics
ASPECT_PATTERNS = {
    "Customer Support": [r"support", r"ticket", r"agent", r"helpdesk", r"sla", r"respons", r"unhelp", r"service"],
    "Pricing & Billing": [r"pric", r"cost", r"expens", r"bill", r"tier", r"fee", r"subscri", r"contract", r"renew", r"charge", r"rate"],
    "Onboarding & Setup": [r"onboard", r"setup", r"deploy", r"install", r"configur", r"learn", r"document", r"integrat", r"ramp"],
    "Integrations & API": [r"api", r"webhook", r"sso", r"saml", r"oauth", r"slack", r"salesforce", r"hubspot", r"connector"],
    "User Interface & UX": [r"ui", r"ux", r"design", r"navigat", r"confus", r"clunky", r"modern", r"intuitiv", r"dashboard"],
    "Analytics & Reporting": [r"report", r"analytic", r"metric", r"export", r"chart", r"visual", r"audit", r"log"],
    "Product Stability & Bugs": [r"bug", r"crash", r"slow", r"down", r"outage", r"latency", r"drop", r"fail", r"error", r"stuck", r"glitch"],
}


class CustomerVoiceService:
    """
    Orchestrates ingestion, classification, thematic aggregation, and competitive comparison.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    @classmethod
    def classify_statement(cls, text: str) -> Tuple[str, str, str]:
        """
        Classify customer statement into (category, sentiment, aspect).
        """
        raw = text.strip()
        lower = raw.lower()

        # 1. Aspect extraction
        detected_aspect = "General"
        for aspect, patterns in ASPECT_PATTERNS.items():
            if any(re.search(pat, lower) for pat in patterns):
                detected_aspect = aspect
                break

        # 2. Category & Sentiment extraction
        # Reasons for switching / competitor choice
        if re.search(r"\b(switch(ed|ing)? to|left for|chose|choose|migrat(ed|ing)? to|moved to|picked)\b", lower):
            if any(w in lower for w in ["chose", "choose", "picked", "selected"]):
                return "reason_for_choosing_competitor", "positive", detected_aspect
            return "reason_for_switching", "negative", detected_aspect

        # Pricing complaints
        if detected_aspect == "Pricing & Billing" and any(
            w in lower for w in ["hike", "steep", "hidden", "overcharg", "unreasonable", "greedy", "ridiculous", "not worth", "expensive", "costly", "jumped"]
        ):
            return "pricing_complaint", "negative", detected_aspect

        # Onboarding issues
        if detected_aspect == "Onboarding & Setup" and any(
            w in lower for w in ["steep", "difficult", "delay", "weeks", "months", "nightmare", "struggl", "headache", "confusing", "hard to set up"]
        ):
            return "onboarding_issue", "negative", detected_aspect

        # Feature requests
        if any(re.search(pat, lower) for pat in [
            r"\bwish\b", r"\bfeature request\b", r"\bwould love if\b", r"\bplease add\b",
            r"\bmissing\b", r"\bneed support for\b", r"\blacks?\b", r"\bhope they add\b"
        ]):
            return "feature_request", "neutral", detected_aspect

        # Product complaints (bugs, crashes, slowness)
        if detected_aspect == "Product Stability & Bugs" or any(
            w in lower for w in ["fail", "broken", "terrible", "awful", "sucks", "disappoint", "horrible", "unusable", "unreliable"]
        ):
            return "product_complaint", "negative", detected_aspect

        # Love vs Dislike general
        positive_patterns = [r"\blove\b", r"\bgreat\b", r"\bexcellent\b", r"\bbest\b", r"\bfantastic\b", r"\bamazing\b", r"\bsmooth\b", r"\bintuitive\b", r"(?<!un)helpful\b", r"\bsuperb\b"]
        negative_patterns = [r"\bhate\b", r"\bbad\b", r"\bdislike\b", r"\bannoying\b", r"\bpoor\b", r"\bfrustrat", r"\bsubpar\b", r"\bmediocre\b", r"\bunhelpful\b", r"\bunresponsive\b", r"\bslow\b"]

        pos_score = sum(1 for pat in positive_patterns if re.search(pat, lower))
        neg_score = sum(1 for pat in negative_patterns if re.search(pat, lower))

        if pos_score > neg_score:
            return "love", "positive", detected_aspect
        elif neg_score > pos_score:
            return "dislike", "negative", detected_aspect

        # Default fallback
        if detected_aspect == "Pricing & Billing":
            return "pricing_complaint", "negative", detected_aspect
        return "dislike", "negative", detected_aspect

    def ingest_feedback_rows(
        self,
        rows: List[Dict[str, Any]],
        default_company: str,
        document_id: Optional[str] = None,
        feedback_channel: str = "customer_review",
    ) -> List[Dict[str, Any]]:
        """
        Process structured tabular feedback rows (from CSV, G2 exports, survey dumps).
        """
        records_to_save: List[Dict[str, Any]] = []

        for row in rows:
            # Flexible column resolution
            text = (
                row.get("review")
                or row.get("feedback")
                or row.get("quote")
                or row.get("comment")
                or row.get("text")
                or row.get("description")
                or row.get("summary")
                or ""
            ).strip()

            if not text or len(text) < 5:
                continue

            comp = (
                row.get("company_name")
                or row.get("company")
                or row.get("competitor")
                or default_company
            ).strip()

            date_str = (
                row.get("publication_date")
                or row.get("date")
                or row.get("created_at")
                or row.get("timestamp")
                or ""
            ).strip()

            channel = (
                row.get("feedback_channel")
                or row.get("channel")
                or row.get("source")
                or feedback_channel
            ).strip()

            segment = (
                row.get("customer_segment")
                or row.get("segment")
                or row.get("plan")
                or "general"
            ).strip()

            # Override category/sentiment if explicit in row, else classify
            explicit_category = str(row.get("category") or "").strip().lower()
            explicit_sentiment = str(row.get("sentiment") or "").strip().lower()
            explicit_aspect = str(row.get("aspect") or "").strip()

            if explicit_category in CUSTOMER_VOICE_CATEGORIES:
                category = explicit_category
                sentiment = explicit_sentiment if explicit_sentiment in ("positive", "negative", "neutral") else "neutral"
                aspect = explicit_aspect or "General"
            else:
                category, sentiment, aspect = self.classify_statement(text)

            records_to_save.append({
                "document_id": document_id,
                "company_name": comp,
                "feedback_channel": channel,
                "category": category,
                "sentiment": sentiment,
                "raw_quote": text,
                "aspect": aspect,
                "customer_segment": segment,
                "publication_date": date_str,
            })

        if records_to_save:
            saved = batch2_storage.save_feedback_records(records_to_save, self.tenant_id)
            # Recompute themes for affected companies
            companies_affected = set(r["company_name"] for r in saved)
            for c in companies_affected:
                self.aggregate_themes_for_company(c)
            return saved

        return []

    def ingest_unstructured_text(
        self,
        raw_text: str,
        company_name: str,
        document_id: Optional[str] = None,
        feedback_channel: str = "interview",
    ) -> List[Dict[str, Any]]:
        """
        Segment plain text interviews, discussions, or notes into atomic statements.
        """
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        rows = [{"feedback": l, "company_name": company_name} for l in lines if len(l) >= 15]
        return self.ingest_feedback_rows(rows, default_company=company_name, document_id=document_id, feedback_channel=feedback_channel)

    def aggregate_themes_for_company(self, company_name: str) -> List[Dict[str, Any]]:
        """
        Aggregate customer statements into recurring themes with empirical sample sizes.
        """
        cname = company_name.strip()
        records = batch2_storage.list_feedback_records(
            tenant_id=self.tenant_id,
            company_name=cname,
            limit=500,
        )

        if not records:
            return []

        # Group by (category, aspect)
        clusters: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
        for r in records:
            cat = r.get("category", "dislike")
            asp = r.get("aspect", "General")
            key = (cat, asp)
            if key not in clusters:
                clusters[key] = []
            clusters[key].append(r)

        themes_to_save: List[Dict[str, Any]] = []
        for (cat, asp), rec_list in clusters.items():
            count = len(rec_list)
            pos_count = sum(1 for r in rec_list if r.get("sentiment") == "positive")
            neg_count = sum(1 for r in rec_list if r.get("sentiment") == "negative")
            neu_count = count - pos_count - neg_count

            rep_quotes = [
                {"id": r["id"], "quote": r["raw_quote"], "date": r.get("publication_date")}
                for r in rec_list[:3]
            ]

            title = f"{asp} {cat.replace('_', ' ').title()}"
            confidence = "High" if count >= 5 else ("Medium" if count >= 2 else "Low")

            themes_to_save.append({
                "company_name": cname,
                "theme_title": title,
                "aspect": asp,
                "category": cat,
                "occurrence_count": count,
                "sample_size": count,
                "sentiment_breakdown": {
                    "positive": pos_count,
                    "negative": neg_count,
                    "neutral": neu_count,
                },
                "representative_quotes": rep_quotes,
                "is_competitive_opportunity": False,
                "confidence": confidence,
            })

        return batch2_storage.save_feedback_themes(themes_to_save, self.tenant_id)

    def generate_competitive_opportunities(
        self,
        target_company: str,
        competitor_name: str,
    ) -> Dict[str, Any]:
        """
        Compare competitor negative feedback against target company feedback / claims.
        Identifies high-leverage attack opportunities where the competitor is weak
        and we have demonstrated strengths.
        """
        tcomp = target_company.strip()
        rcomp = competitor_name.strip()

        # Get themes for both
        competitor_themes = batch2_storage.list_feedback_themes(self.tenant_id, company_name=rcomp)
        target_themes = batch2_storage.list_feedback_themes(self.tenant_id, company_name=tcomp)

        # Get existing battlecard claims for target company to ground opportunities
        target_claims = battlecard_storage.list_claims(self.tenant_id, company_name=rcomp, status="active")
        our_win_claims = [c for c in target_claims if c.get("claim_type") in ("where_we_win", "strengths_weaknesses")]

        opportunities: List[Dict[str, Any]] = []

        # Find competitor negative themes (complaints, dislikes, switching reasons)
        negative_categories = {
            "dislike", "product_complaint", "pricing_complaint", "onboarding_issue", "reason_for_switching"
        }

        for comp_t in competitor_themes:
            if comp_t.get("category") in negative_categories and comp_t.get("occurrence_count", 0) >= 1:
                aspect = comp_t.get("aspect") or comp_t.get("theme_title", "").replace("Dislike", "").replace("Product Complaint", "").replace("Pricing Complaint", "").strip() or "General"
                
                # Check if target company has positive customer feedback or a verified battlecard claim
                target_counter_evidence = []
                for tt in target_themes:
                    if aspect.lower() in tt.get("theme_title", "").lower() and tt.get("category") == "love":
                        target_counter_evidence.append({
                            "type": "Customer Voice",
                            "theme": tt.get("theme_title"),
                            "sample_size": tt.get("sample_size"),
                        })

                for claim in our_win_claims:
                    if aspect.lower() in (claim.get("statement", "") + claim.get("subject", "")).lower():
                        target_counter_evidence.append({
                            "type": "Battlecard Claim",
                            "claim_id": claim.get("id"),
                            "statement": claim.get("statement"),
                        })

                # Mark as an opportunity
                comp_t["is_competitive_opportunity"] = True
                rep_q = comp_t.get("representative_quotes", [])
                rep_str = ""
                if rep_q:
                    first_q = rep_q[0]
                    if isinstance(first_q, dict):
                        rep_str = first_q.get("quote") or first_q.get("text") or str(first_q)
                    else:
                        rep_str = str(first_q)

                opportunities.append({
                    "aspect": aspect,
                    "competitor": rcomp,
                    "competitor_vulnerability": comp_t.get("theme_title"),
                    "complaint_count": comp_t.get("occurrence_count"),
                    "sample_size": comp_t.get("sample_size"),
                    "representative_complaint": rep_str,
                    "our_counter_strengths": target_counter_evidence,
                    "recommended_action": f"Train sales reps to highlight {aspect} differentiators when competing against {rcomp}."
                })

        return {
            "target_company": tcomp,
            "competitor_name": rcomp,
            "total_competitor_complaints_analyzed": sum(t.get("occurrence_count", 0) for t in competitor_themes if t.get("category") in negative_categories),
            "opportunities_found": len(opportunities),
            "opportunities": opportunities,
        }

