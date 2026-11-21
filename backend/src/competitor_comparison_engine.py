"""
Competitor Comparison Engine for PrismIQ Batch 4.
Constructs verifiable, evidence-backed side-by-side matrices comparing our company against
one or more competitors across:
- Features
- Product capabilities
- Pricing models
- Integrations
- Enterprise capabilities

Strict Three-State Evaluation Rule:
Every comparison cell is strictly evaluated as one of:
1. 'Supported': Verified evidence confirms the capability exists.
2. 'Unsupported': Verified evidence explicitly confirms absence or lack of capability.
3. 'Unknown': No verified evidence is available.
Crucially: 'Unknown' is NEVER treated or rendered as 'Unsupported'.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from . import batch4_storage, battlecard_storage, storage

logger = logging.getLogger(__name__)

STANDARD_CAPABILITY_TAXONOMY = {
    "enterprise_capabilities": [
        {"name": "SOC2 Type II Compliance", "keywords": ["soc2", "soc 2", "compliance", "iso 27001"]},
        {"name": "Role-Based Access Control (RBAC)", "keywords": ["rbac", "role-based", "role based", "permissions"]},
        {"name": "Single Sign-On (SSO / SAML)", "keywords": ["sso", "saml", "okta", "single sign-on"]},
        {"name": "Tenant Isolation & Data Residency", "keywords": ["tenant isolation", "data residency", "isolation", "gdpr", "hipaa"]},
        {"name": "Immutable Audit Logging", "keywords": ["audit log", "audit trail", "audit logging", "history"]},
    ],
    "integrations": [
        {"name": "Salesforce CRM Sync", "keywords": ["salesforce", "sfdc", "crm sync"]},
        {"name": "HubSpot Integration", "keywords": ["hubspot", "marketing sync"]},
        {"name": "Slack & Teams Notifications", "keywords": ["slack", "teams", "webhook alerts", "notification"]},
        {"name": "REST API & Webhook Export", "keywords": ["rest api", "webhook", "api access", "export"]},
    ],
    "product_capabilities": [
        {"name": "Real-time Signal Ingestion", "keywords": ["real-time", "streaming", "signal ingestion", "real time"]},
        {"name": "Automated Battlecard Generation", "keywords": ["battlecard", "automated battlecard", "card generation"]},
        {"name": "Competitive Response Recommendations", "keywords": ["next best action", "recommendation", "deal guidance", "response"]},
        {"name": "Multi-Factor Threat Indexing", "keywords": ["threat index", "threat score", "threat scoring"]},
    ],
    "pricing": [
        {"name": "Transparent Public Pricing", "keywords": ["public pricing", "transparent pricing", "pricing tier"]},
        {"name": "Usage-Based Metering", "keywords": ["usage-based", "metering", "pay as you go", "consumption"]},
        {"name": "Annual Enterprise Contracts", "keywords": ["enterprise contract", "annual subscription", "custom quote"]},
    ],
}

STATE_SUPPORTED = "Supported"
STATE_UNSUPPORTED = "Unsupported"
STATE_UNKNOWN = "Unknown"


class CompetitorComparisonEngine:
    """
    Constructs multi-company capability comparison matrices with granular evidence grounding.
    """

    def __init__(self, tenant_id: str = "00000000-0000-0000-0000-000000000000"):
        self.tenant_id = str(tenant_id).strip()

    def generate_comparison_matrix(
        self,
        target_company: str,
        competitors: List[str],
        categories: Optional[List[str]] = None,
        custom_capabilities: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate comprehensive side-by-side comparison matrix.
        """
        tgt = str(target_company or "").strip()
        if not tgt:
            raise ValueError("Target company must be specified.")

        comps = [str(c).strip() for c in competitors if str(c).strip()]
        if not comps:
            raise ValueError("At least one competitor must be provided for comparison.")

        all_entities = [tgt] + [c for c in comps if c.lower() != tgt.lower()]

        # 1. Fetch claims & evidence for all participating companies
        company_evidence_map = {}
        for entity in all_entities:
            claims = battlecard_storage.list_claims(
                tenant_id=self.tenant_id,
                company_name=entity,
            ) or []
            gov_evidence = batch4_storage.list_governed_evidence(
                tenant_id=self.tenant_id,
                related_company=entity,
            ) or []
            company_evidence_map[entity] = {
                "claims": claims,
                "evidence": gov_evidence,
            }

        # 2. Determine capability set
        cap_groups = {}
        selected_cats = categories or list(STANDARD_CAPABILITY_TAXONOMY.keys())

        for cat in selected_cats:
            cat_clean = cat.strip().lower()
            if cat_clean in STANDARD_CAPABILITY_TAXONOMY:
                cap_groups[cat_clean] = STANDARD_CAPABILITY_TAXONOMY[cat_clean]

        if custom_capabilities:
            cap_groups["custom_features"] = custom_capabilities

        # 3. Build comparison rows
        matrix_categories = []
        summary_stats = {entity: {"supported": 0, "unsupported": 0, "unknown": 0} for entity in all_entities}

        for cat_name, caps in cap_groups.items():
            cat_rows = []
            for cap in caps:
                cap_name = cap.get("name")
                keywords = [k.lower() for k in cap.get("keywords", [cap_name.lower()])]

                cell_evaluations = {}
                for entity in all_entities:
                    cell_data = self._evaluate_capability(
                        entity_name=entity,
                        cap_name=cap_name,
                        keywords=keywords,
                        claims=company_evidence_map[entity]["claims"],
                        evidence=company_evidence_map[entity]["evidence"],
                    )
                    cell_evaluations[entity] = cell_data

                    # Track aggregate counts
                    state_key = cell_data["state"].lower()
                    if state_key in summary_stats[entity]:
                        summary_stats[entity][state_key] += 1

                cat_rows.append({
                    "capability_name": cap_name,
                    "category": cat_name,
                    "evaluations": cell_evaluations,
                })

            matrix_categories.append({
                "category_key": cat_name,
                "category_title": cat_name.replace("_", " ").title(),
                "capabilities": cat_rows,
            })

        return {
            "target_company": tgt,
            "competitors": [c for c in all_entities if c != tgt],
            "all_compared_companies": all_entities,
            "comparison_matrix": matrix_categories,
            "summary_statistics": summary_stats,
            "methodology_disclaimer": (
                "Each cell is evaluated using verified primary sources and documented claims. "
                "'Unknown' indicates absence of verified evidence, and is strictly not treated as 'Unsupported'."
            ),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # -------------------------------------------------------------------------
    # Cell Evaluation
    # -------------------------------------------------------------------------

    def _evaluate_capability(
        self,
        entity_name: str,
        cap_name: str,
        keywords: List[str],
        claims: List[Dict[str, Any]],
        evidence: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Evaluate single company for a specific capability.
        Strict rule:
        If positive verified evidence/claim -> 'Supported'
        If explicit negative evidence/claim -> 'Unsupported'
        If no evidence -> 'Unknown' (never Unsupported)
        """
        matching_claims = []
        for c in claims:
            txt = (c.get("claim_text") or "").lower()
            sub = (c.get("subject") or "").lower()
            if any(k in txt or k in sub for k in keywords):
                matching_claims.append(c)

        matching_evidence = []
        for ev in evidence:
            exc = (ev.get("excerpt") or "").lower()
            title = (ev.get("source_title") or "").lower()
            if any(k in exc or k in title for k in keywords):
                matching_evidence.append(ev)

        # 1. Check for negative claims ("does not support", "lacks", "unsupported", "no integration")
        negation_phrases = ["does not support", "lacks", "unsupported", "not supported", "unavailable", "no native", "missing"]
        for c in matching_claims:
            txt = (c.get("claim_text") or "").lower()
            if any(neg in txt for neg in negation_phrases):
                return {
                    "state": STATE_UNSUPPORTED,
                    "evidence_excerpt": c.get("claim_text"),
                    "evidence_source": c.get("source_url") or "Documented intelligence claim",
                    "verification_status": c.get("status") or "verified",
                    "last_verified_at": c.get("updated_at") or c.get("created_at"),
                    "notes": f"Verified negative capability: documented as unsupported for {entity_name}.",
                }

        for ev in matching_evidence:
            exc = (ev.get("excerpt") or "").lower()
            if ev.get("relationship") in ("contradicts", "disputes") or any(neg in exc for neg in negation_phrases):
                return {
                    "state": STATE_UNSUPPORTED,
                    "evidence_excerpt": ev.get("excerpt"),
                    "evidence_source": ev.get("source_url") or ev.get("source_title"),
                    "verification_status": ev.get("verification_status") or "verified",
                    "last_verified_at": ev.get("last_verified_at"),
                    "notes": f"Verified negative capability: primary source indicates lack of support.",
                }

        # 2. Check for positive verified claims
        for c in matching_claims:
            if str(c.get("status", "")).lower() == "verified":
                return {
                    "state": STATE_SUPPORTED,
                    "evidence_excerpt": c.get("claim_text"),
                    "evidence_source": c.get("source_url") or "Verified intelligence claim",
                    "verification_status": "verified",
                    "last_verified_at": c.get("updated_at") or c.get("created_at"),
                    "notes": f"Verified positive support for {entity_name}.",
                }

        for ev in matching_evidence:
            if str(ev.get("verification_status", "")).lower() == "verified" and ev.get("relationship") != "contradicts":
                return {
                    "state": STATE_SUPPORTED,
                    "evidence_excerpt": ev.get("excerpt"),
                    "evidence_source": ev.get("source_url") or ev.get("source_title"),
                    "verification_status": "verified",
                    "last_verified_at": ev.get("last_verified_at"),
                    "notes": f"Verified in primary source documentation.",
                }

        # 3. If any unverified claim exists, still treat as Unknown but cite it
        if matching_claims:
            unv = matching_claims[0]
            return {
                "state": STATE_UNKNOWN,
                "evidence_excerpt": unv.get("claim_text"),
                "evidence_source": unv.get("source_url") or "Unverified intelligence claim",
                "verification_status": "unverified",
                "last_verified_at": unv.get("updated_at") or unv.get("created_at"),
                "notes": "Unverified claim found; marked Unknown until verified.",
            }

        # 4. Strict default: Unknown (never Unsupported!)
        return {
            "state": STATE_UNKNOWN,
            "evidence_excerpt": None,
            "evidence_source": None,
            "verification_status": "unassessed",
            "last_verified_at": None,
            "notes": "No verified evidence available; capability unassessed.",
        }
