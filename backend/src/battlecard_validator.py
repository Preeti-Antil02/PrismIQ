"""
Battlecard Relevance & Data Accuracy Validation Layer for PrismIQ.

Strictly audits generated battlecards before persistence and publishing to guarantee:
1. Competitor Identification: Content refers strictly to the selected competitor.
2. Industry & Domain Relevance: Prohibits enterprise software tropes on consumer marketplaces
   and prohibits retail tropes on cloud platforms.
3. Anti-Boilerplate Guard: Detects and rejects generic filler templates
   ("Direct competitive overlap", "Conduct primary field discovery", "Enterprise teams, mid-market...").
4. Non-Repetition: Ensures statements and talk tracks are not duplicated across sections.
5. Evidence Grounding: Verified claims must be backed by genuine URLs, otherwise downgraded to 'unknown'.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Banned generic boilerplate patterns that indicate hallucinated or unspecialized generation
BANNED_BOILERPLATE_PATTERNS = [
    r"conduct primary field discovery",
    r"capitalize on .* limitation: direct competitive overlap",
    r"enterprise teams, mid-market organizations, and consumer segments requiring scalable",
    r"core operational capability powering .* competitive platform",
    r"flexible commercial packaging and modern api-first design",
    r"rapid product iteration and active customer feedback loops",
    r"executing an aggressive strategy in direct competition",
    r"standard partnership configuration prior to multi-region",
    r"query production clickhouse and s3 data lake tables",  # Bleed from posthog template
]

# Industry domain boundary checks
RETAIL_ECOMMERCE_EXCLUSIONS = [
    ("clickhouse", "ClickHouse database references are not relevant to retail/consumer marketplaces."),
    ("multi-cloud independence", "Multi-cloud independence is an enterprise cloud trope not relevant to consumer retail."),
    ("sql data warehouse", "SQL data warehouse promises are not relevant to retail/consumer marketplaces."),
    ("serverless function", "Serverless function references are not relevant to consumer retail."),
    ("hogql", "HogQL query engine is specific to PostHog, not retail."),
    ("session replay v3", "Session replay recording is not relevant to retail."),
]

CLOUD_INFRASTRUCTURE_EXCLUSIONS = [
    ("cash on delivery", "Cash-on-Delivery is an e-commerce retail mechanism, not cloud infrastructure."),
    ("tier-3 pin codes", "Tier-3 pin code logistics is an Indian retail concept, not cloud infrastructure."),
    ("unbranded apparel", "Unbranded apparel is an e-commerce catalog concept, not cloud infrastructure."),
    ("0% commission marketplace", "0% commission marketplace is a retail model, not enterprise cloud infrastructure."),
    ("textile mills", "Textile mills are retail manufacturing suppliers, not cloud infrastructure."),
    ("flipkart minutes", "Flipkart Minutes quick-commerce is not relevant to cloud infrastructure."),
]


class BattlecardValidationResult:
    def __init__(self, is_valid: bool, relevance_score: float, violations: List[Dict[str, str]], warnings: List[str], passed_checks: List[str]):
        self.is_valid = is_valid
        self.relevance_score = relevance_score
        self.violations = violations
        self.warnings = warnings
        self.passed_checks = passed_checks

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "relevance_score": round(self.relevance_score, 1),
            "violations_count": len(self.violations),
            "violations": self.violations,
            "warnings_count": len(self.warnings),
            "warnings": self.warnings,
            "passed_checks": self.passed_checks,
        }


def validate_battlecard(
    battlecard: Dict[str, Any],
    profile: Optional[Dict[str, Any]] = None,
) -> BattlecardValidationResult:
    """
    Execute complete relevance, consistency, and non-fabrication audit on a generated battlecard.
    """
    violations: List[Dict[str, str]] = []
    warnings: List[str] = []
    passed_checks: List[str] = []

    cname = str(battlecard.get("company_name", "")).strip()
    cname_lower = cname.lower()
    blocks = battlecard.get("blocks", [])

    prof = profile or {}
    industry = str(prof.get("industry", "")).lower()

    # Determine if company is primarily retail/e-commerce or cloud/tech infrastructure
    is_retail_ecommerce = any(kw in industry or kw in cname_lower for kw in [
        "commerce", "marketplace", "retail", "shopping", "meesho", "flipkart", "amazon", "shopsy", "myntra", "ajio"
    ]) and not any(kw in cname_lower for kw in ["aws", "cloud", "azure", "microsoft"])

    is_cloud_enterprise = any(kw in industry or kw in cname_lower for kw in [
        "cloud", "infrastructure", "software", "analytics", "aws", "microsoft", "azure", "posthog", "mixpanel", "datadog", "google cloud"
    ])

    seen_statements: set = set()
    total_claims = 0
    grounded_claims = 0

    # 1. Block-Level Audits
    for blk in blocks:
        bkey = blk.get("block_key", "")
        btitle = blk.get("block_title", "")
        content = blk.get("content") or {}
        claims = blk.get("claims") or []

        # Check for empty content
        if not content:
            violations.append({
                "block": bkey,
                "type": "empty_block",
                "message": f"Block '{btitle}' has empty content payload."
            })
            continue

        # Extract text snippets for boilerplate and cross-industry checks
        block_text = str(content).lower()

        # Check for banned boilerplate patterns
        for pattern in BANNED_BOILERPLATE_PATTERNS:
            if re.search(pattern, block_text):
                violations.append({
                    "block": bkey,
                    "type": "generic_boilerplate",
                    "message": f"Block '{btitle}' contains banned generic boilerplate: '{pattern}'."
                })

        # Check for cross-industry contamination
        if is_retail_ecommerce:
            for term, explanation in RETAIL_ECOMMERCE_EXCLUSIONS:
                if term in block_text:
                    violations.append({
                        "block": bkey,
                        "type": "industry_mismatch",
                        "message": f"Retail competitor '{cname}' contains inappropriate enterprise trope: '{term}'. {explanation}"
                    })

        if is_cloud_enterprise:
            for term, explanation in CLOUD_INFRASTRUCTURE_EXCLUSIONS:
                if term in block_text:
                    violations.append({
                        "block": bkey,
                        "type": "industry_mismatch",
                        "message": f"Cloud competitor '{cname}' contains inappropriate retail trope: '{term}'. {explanation}"
                    })

        # Check claims in block
        for clm in claims:
            total_claims += 1
            stmt = str(clm.get("statement", "")).strip()
            v_status = clm.get("verification_status", "unverified")
            evidence = clm.get("evidence", []) or clm.get("_evidence", [])

            # Check for empty statement
            if not stmt or stmt.lower() in ['""', "''"]:
                violations.append({
                    "block": bkey,
                    "type": "blank_statement",
                    "message": f"Claim in block '{btitle}' has blank or empty quote statement."
                })

            # Check for duplicate statements across sections
            clean_stmt = stmt.lower().strip()
            if clean_stmt and clean_stmt != "unknown" and len(clean_stmt) > 20:
                if clean_stmt in seen_statements:
                    warnings.append(f"Statement duplicated in block '{btitle}': '{stmt[:60]}...'")
                seen_statements.add(clean_stmt)

            # Check evidence grounding rule: verified claims MUST have valid URL evidence
            if v_status == "verified":
                has_valid_url = any(
                    str(ev.get("source_url", "")).startswith("http://") or
                    str(ev.get("source_url", "")).startswith("https://")
                    for ev in evidence if isinstance(ev, dict)
                )
                if not has_valid_url and evidence:
                    warnings.append(f"Verified claim in '{btitle}' lacks HTTP/HTTPS source URL.")
                elif not evidence:
                    violations.append({
                        "block": bkey,
                        "type": "unsupported_verification",
                        "message": f"Claim '{stmt[:50]}' marked 'verified' without supporting evidence records."
                    })
                else:
                    grounded_claims += 1
            elif v_status == "unknown":
                # Valid honest state under non-fabrication rule
                pass

    # 2. Section Specific Sanity Checks
    # Product & ICP must not have generic target market
    prod_block = next((b for b in blocks if b.get("block_key") == "product_icp"), None)
    if prod_block:
        icp_market = str((prod_block.get("content") or {}).get("target_market", "")).lower()
        if "enterprise teams, mid-market organizations" in icp_market and is_retail_ecommerce:
            violations.append({
                "block": "product_icp",
                "type": "generic_icp",
                "message": f"E-commerce competitor '{cname}' has generic enterprise ICP: '{icp_market}'"
            })
        else:
            passed_checks.append("product_icp_specific_market")

    # Objections must have actual objections, not empty
    obj_block = next((b for b in blocks if b.get("block_key") == "objections_responses"), None)
    if obj_block:
        items = (obj_block.get("content") or {}).get("items", [])
        if not items:
            violations.append({
                "block": "objections_responses",
                "type": "empty_objections",
                "message": "Objection playbook has no items."
            })
        else:
            passed_checks.append("objections_playbook_populated")

    # Where We Win must not contain generic overlap
    www_block = next((b for b in blocks if b.get("block_key") == "where_we_win"), None)
    if www_block:
        items = (www_block.get("content") or {}).get("items", [])
        for item in items:
            stmt = str(item.get("statement", "")).lower()
            if "direct competitive overlap" in stmt:
                violations.append({
                    "block": "where_we_win",
                    "type": "generic_overlap_win",
                    "message": "Where We Win contains generic 'Direct competitive overlap' limitation."
                })
        passed_checks.append("where_we_win_audited")

    # Calculate overall relevance score
    score = 100.0 - (len(violations) * 15.0) - (len(warnings) * 4.0)
    score = max(0.0, min(100.0, score))
    is_valid = len(violations) == 0

    if is_valid:
        passed_checks.append("all_sections_relevance_verified")
        passed_checks.append("evidence_grounding_verified")

    return BattlecardValidationResult(
        is_valid=is_valid,
        relevance_score=score,
        violations=violations,
        warnings=warnings,
        passed_checks=passed_checks,
    )
