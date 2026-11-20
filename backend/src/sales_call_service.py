"""
Sales Call Intelligence Service for PrismIQ Batch 2.
Ingests and parses conversation transcripts into structured speaker turns.
Extracts 9 atomic intelligence items, links verbatim quotes to Batch 1 claims,
and generates concise sales conversation reports.
"""

import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from . import batch2_storage
from . import battlecard_storage

logger = logging.getLogger(__name__)

# 9 Canonical Sales Call Intelligence Categories
CALL_ITEM_TYPES = [
    "competitor_mention",
    "buyer_objection",
    "pricing_discussion",
    "feature_comparison",
    "customer_requirement",
    "buying_signal",
    "competitor_advantage",
    "product_gap",
    "deal_risk",
]


class SalesCallService:
    """
    Parses transcripts and extracts grounded competitive conversation signals.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    @classmethod
    def parse_speaker_turns(cls, transcript: str) -> List[Dict[str, str]]:
        """
        Segment conversation into structured turns: speaker, timestamp, text.
        """
        lines = transcript.strip().splitlines()
        turns: List[Dict[str, str]] = []
        current_speaker = "Unknown"
        current_timestamp = "00:00"
        current_buffer = []

        # Regex for speaker and timestamp: e.g. "Prospect (12:34):", "Rep [05:10]:", "John Doe:"
        speaker_pattern = re.compile(
            r"^(?P<speaker>[A-Za-z0-9 _\-\.]+?)(\s*[\(\[](?P<time>\d{1,2}:\d{2}(?::\d{2})?)[\)\]])?\s*:\s*(?P<text>.*)$"
        )

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            match = speaker_pattern.match(line_str)
            if match:
                if current_buffer:
                    turns.append({
                        "speaker": current_speaker,
                        "timestamp": current_timestamp,
                        "text": " ".join(current_buffer).strip(),
                    })
                    current_buffer = []

                current_speaker = match.group("speaker").strip()
                if match.group("time"):
                    current_timestamp = match.group("time").strip()
                current_buffer.append(match.group("text").strip())
            else:
                current_buffer.append(line_str)

        if current_buffer:
            turns.append({
                "speaker": current_speaker,
                "timestamp": current_timestamp,
                "text": " ".join(current_buffer).strip(),
            })

        return turns

    def extract_signals_from_turn(
        self,
        turn_text: str,
        speaker: str,
        timestamp: str,
        known_competitors: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Extract up to 9 intelligence items from a single conversation turn.
        """
        items: List[Dict[str, Any]] = []
        lower = turn_text.lower()

        # Detect competitor mentions
        detected_comp = None
        for comp in known_competitors:
            if comp.lower() in lower:
                detected_comp = comp
                items.append({
                    "item_type": "competitor_mention",
                    "competitor_name": comp,
                    "verbatim_quote": turn_text,
                    "speaker": speaker,
                    "timestamp_offset": timestamp,
                    "analysis": f"Competitor '{comp}' mentioned by {speaker}.",
                })
                break

        # Buying Signals
        if any(re.search(p, lower) for p in [
            r"\bif you can\b", r"\bready to sign\b", r"\bbudget is approved\b",
            r"\bdecision by\b", r"\bnext step is legal\b", r"\bprocurement approved\b"
        ]):
            items.append({
                "item_type": "buying_signal",
                "competitor_name": detected_comp or "General",
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": "Explicit timeline or positive buyer purchase intent signal.",
            })

        # Pricing Discussions
        if any(re.search(p, lower) for p in [
            r"\bpricing\b", r"\bcost\b", r"\bbudget\b", r"\bdiscount\b", r"\bexpensive\b",
            r"\bseat(s)? minimum\b", r"\bquote\b", r"\bper user\b", r"\bcontract\b"
        ]):
            items.append({
                "item_type": "pricing_discussion",
                "competitor_name": detected_comp or "General",
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": "Buyer discussion regarding pricing structure, budget, or quote.",
            })

        # Buyer Objections
        if any(re.search(p, lower) for p in [
            r"\bconcern\b", r"\bworried\b", r"\bhesitant\b", r"\bissue with\b",
            r"\bnot sure\b", r"\bdoesn't work for us\b", r"\brisk\b", r"\bdeal breaker\b"
        ]):
            items.append({
                "item_type": "buyer_objection",
                "competitor_name": detected_comp or "General",
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": "Buyer voiced reservation, objection, or perceived friction.",
            })

        # Feature Comparison
        if any(re.search(p, lower) for p in [
            r"\bhow do you compare\b", r"\bversus\b", r"\bvs\b", r"\bdifference between\b",
            r"\bbetter than\b", r"\bdoes competitor\b"
        ]) and detected_comp:
            items.append({
                "item_type": "feature_comparison",
                "competitor_name": detected_comp,
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": f"Direct feature comparison inquiry regarding {detected_comp}.",
            })

        # Customer Requirements
        if any(re.search(p, lower) for p in [
            r"\bwe require\b", r"\bmust have\b", r"\bneed support for\b",
            r"\bcompliance\b", r"\bsoc2\b", r"\bgdpr\b", r"\bhipaa\b", r"\bsso\b", r"\bmandatory\b"
        ]):
            items.append({
                "item_type": "customer_requirement",
                "competitor_name": detected_comp or "General",
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": "Mandatory technical or compliance requirement specified by customer.",
            })

        # Competitor Advantages & Product Gaps
        if detected_comp and any(w in lower for w in ["they already have", "they do this well", "their strength"]):
            items.append({
                "item_type": "competitor_advantage",
                "competitor_name": detected_comp,
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": f"Buyer noted competitor advantage for {detected_comp}.",
            })

        if any(w in lower for w in ["you don't have", "you lack", "missing in your product"]):
            items.append({
                "item_type": "product_gap",
                "competitor_name": detected_comp or "General",
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": "Product capability gap confirmed during call.",
            })

        # Deal Risks
        if any(re.search(p, lower) for p in [
            r"\bbudget freeze\b", r"\bdelay until next quarter\b", r"\bcfo rejected\b",
            r"\bleaning towards\b", r"\bre-evaluating\b", r"\bpausing the project\b"
        ]):
            items.append({
                "item_type": "deal_risk",
                "competitor_name": detected_comp or "General",
                "verbatim_quote": turn_text,
                "speaker": speaker,
                "timestamp_offset": timestamp,
                "analysis": "Direct risk to deal velocity or outcome.",
            })

        return items

    def ingest_transcript(
        self,
        transcript_text: str,
        call_title: str = "Sales Conversation",
        deal_id: Optional[str] = None,
        call_date: Optional[str] = None,
        document_id: Optional[str] = None,
        participants: Optional[List[Dict[str, str]]] = None,
        known_competitors: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Process transcript, extract intelligence items, link to Batch 1 claims, and save.
        """
        clean_text = transcript_text.strip()
        turns = self.parse_speaker_turns(clean_text)

        # Fallback if unsegmented
        if not turns:
            turns = [{"speaker": "Transcript", "timestamp": "00:00", "text": clean_text}]

        # Resolve competitors to look for
        comps = known_competitors or []
        if not comps:
            # Query existing active claims to identify known competitors
            existing_claims = battlecard_storage.list_claims(self.tenant_id, limit=200)
            comps = list(set(c.get("company_name", "") for c in existing_claims if c.get("company_name")))
            if not comps:
                comps = ["OpenAI", "Anthropic", "Google", "Amazon", "Flipkart", "Shopsy", "Ajio"]

        all_extracted: List[Dict[str, Any]] = []
        competitors_mentioned: List[str] = []

        for turn in turns:
            extracted = self.extract_signals_from_turn(
                turn_text=turn["text"],
                speaker=turn["speaker"],
                timestamp=turn["timestamp"],
                known_competitors=comps,
            )
            for itm in extracted:
                if itm.get("competitor_name") and itm["competitor_name"] not in ("General", "None"):
                    if itm["competitor_name"] not in competitors_mentioned:
                        competitors_mentioned.append(itm["competitor_name"])
                all_extracted.append(itm)

        # 1. Save Call Record
        summary = (
            f"Call with {len(turns)} turns. Detected competitors: "
            f"{', '.join(competitors_mentioned) if competitors_mentioned else 'None'}. "
            f"Extracted {len(all_extracted)} intelligence items."
        )

        call_record = {
            "document_id": document_id,
            "call_title": call_title,
            "deal_id": deal_id,
            "call_date": call_date,
            "participants": participants or [],
            "transcript_text": clean_text,
            "competitors_mentioned": competitors_mentioned,
            "summary": summary,
        }
        saved_call = batch2_storage.save_sales_call(call_record, self.tenant_id)
        call_id = saved_call["id"]

        # 2. Link items to existing Batch 1 claims
        for itm in all_extracted:
            itm["call_id"] = call_id
            comp_name = itm.get("competitor_name")
            if itm.get("item_type") in ("buyer_objection", "pricing_discussion", "competitor_advantage") and comp_name and comp_name not in ("General", "None"):
                # Search existing claims for matching objection / positioning claim
                claims = battlecard_storage.list_claims(self.tenant_id, company_name=comp_name, limit=50)
                for cl in claims:
                    if cl.get("claim_type") in ("objections_responses", "where_they_win", "pricing_comparison"):
                        cl_text = f"{cl.get('subject', '')} {cl.get('statement', '')}".lower()
                        quote_words = [w for w in itm["verbatim_quote"].lower().split() if len(w) > 3 and w not in ("with", "have", "that", "this", "they", "your", "from")]
                        if any(w in cl_text for w in quote_words):
                            itm["linked_claim_id"] = cl["id"]
                            break

        saved_items = batch2_storage.save_call_intelligence_items(all_extracted, self.tenant_id)

        return {
            "call": saved_call,
            "items_count": len(saved_items),
            "competitors_mentioned": competitors_mentioned,
            "items": saved_items,
        }

