"""
Comprehensive Ground-Truth Seed Intelligence for PrismIQ Batch 2.
Provides rich, evidence-grounded Customer Voice and Next Best Actions.
Guarantees that customer voice complaints connect directly to a competitor,
battlecard positioning, and a recommended action across all personas.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from . import batch2_storage


def seed_batch2_intelligence(tenant_id: str, target_name: Optional[str] = None) -> Dict[str, int]:
    """
    Populates connected Batch 2 intelligence for the specified tenant.
    Idempotent: Only seeds if tenant has 0 actions recorded.
    """
    tid = str(tenant_id).strip()
    batch2_storage._ensure_tenant_cache(tid)

    # If tenant already has actions, don't overwrite
    if len(batch2_storage._IN_MEMORY_ACTIONS.get(tid, {})) > 0:
        return {
            "actions": len(batch2_storage._IN_MEMORY_ACTIONS[tid]),
            "feedback": len(batch2_storage._IN_MEMORY_FEEDBACK.get(tid, [])),
        }

    now_iso = datetime.now(timezone.utc).isoformat()
    t_lower = (target_name or "").lower()

    is_microsoft = "microsoft" in t_lower or tid == "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f"
    is_vercel = "vercel" in t_lower or tid == "c8f13b91-46ef-4682-9975-f85764d8a12e"
    is_meesho = "meesho" in t_lower or tid == "8553449a-c998-4727-be01-9aeb724038cb"

    if is_microsoft:
        target = "Microsoft"
        primary_rival = "AWS"
        secondary_rival = "Google Cloud"
        tertiary_rival = "OpenAI"
        industry = "Enterprise Cloud & AI Infrastructure"
    elif is_vercel:
        target = "Vercel"
        primary_rival = "Cloudflare"
        secondary_rival = "Netlify"
        tertiary_rival = "AWS Amplify"
        industry = "Frontend Cloud & Serverless DX"
    elif is_meesho:
        target = "Meesho"
        primary_rival = "Flipkart"
        secondary_rival = "Amazon India"
        tertiary_rival = "Shopsy"
        industry = "Social Commerce & Marketplace"
    else:
        # Custom or newly onboarded workspaces must never inherit Meesho demo records
        return {"actions": 0, "feedback": 0}

    # =========================================================================
    # 1. Customer Voice Feedback Records (Connected Evidence)
    # =========================================================================
    if is_microsoft:
        feedback_raw = [
            {
                "id": "fb_msft_01",
                "company_name": primary_rival,
                "feedback_channel": "customer_review",
                "category": "pricing_complaint",
                "sentiment": "negative",
                "aspect": "Compute & Egress Pricing",
                "raw_quote": "AWS inter-region data egress fees make multi-region failover cost-prohibitive compared to Azure ExpressRoute peering discounts.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_msft_02",
                "company_name": primary_rival,
                "feedback_channel": "support_ticket",
                "category": "product_complaint",
                "sentiment": "negative",
                "aspect": "AI Governance & Compliance",
                "raw_quote": "AWS Bedrock lacks unified enterprise audit logging across sovereign European regions, forcing compliance teams to pause deployment.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_msft_03",
                "company_name": target,
                "feedback_channel": "customer_interview",
                "category": "positive_feedback",
                "sentiment": "positive",
                "aspect": "Enterprise Integration",
                "raw_quote": "Azure OpenAI native Microsoft 365 Copilot connectors reduced our internal knowledge base integration timeline from 4 months to 2 weeks.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_msft_04",
                "company_name": secondary_rival,
                "feedback_channel": "customer_interview",
                "category": "switching_reason",
                "sentiment": "negative",
                "aspect": "Enterprise Contract Flexibility",
                "raw_quote": "Google Cloud refused to bundle enterprise AI credits into existing workspace commitments, pushing our CIO to negotiate an Azure Enterprise Agreement.",
                "sample_weight": 1.0,
            },
        ]
        themes_raw = [
            {
                "theme_title": "Egress Fees & Multi-Region TCO",
                "company_name": primary_rival,
                "category": "pricing_complaint",
                "occurrence_count": 48,
                "sample_size": 112,
                "sentiment_breakdown": {"positive": 14, "negative": 86, "neutral": 12},
                "representative_quotes": [
                    "AWS data transfer egress bills fluctuate by up to 35% monthly.",
                    "Egress fees are the #1 barrier to cross-cloud deployment.",
                ],
                "is_competitive_opportunity": True,
                "confidence": "High",
            },
            {
                "theme_title": "Enterprise AI Governance & Audit Logging",
                "company_name": primary_rival,
                "category": "product_complaint",
                "occurrence_count": 36,
                "sample_size": 89,
                "sentiment_breakdown": {"positive": 9, "negative": 72, "neutral": 8},
                "representative_quotes": [
                    "AWS Bedrock governance policies are fragmented across separate IAM consoles.",
                ],
                "is_competitive_opportunity": True,
                "confidence": "High",
            },
        ]
    elif is_vercel:
        feedback_raw = [
            {
                "id": "fb_vcl_01",
                "company_name": primary_rival,
                "feedback_channel": "customer_review",
                "category": "product_complaint",
                "sentiment": "negative",
                "aspect": "Developer Experience",
                "raw_quote": "Cloudflare Pages deployment pipelines and custom build-step configurations are unintuitive compared to Vercel's zero-config Next.js preview deployments.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_vcl_02",
                "company_name": primary_rival,
                "feedback_channel": "support_ticket",
                "category": "pricing_complaint",
                "sentiment": "positive",
                "aspect": "Bandwidth Economics",
                "raw_quote": "Zero egress bandwidth cost on Cloudflare Workers makes high-traffic media workloads significantly cheaper than Vercel Pro/Enterprise overage rates.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_vcl_03",
                "company_name": target,
                "feedback_channel": "customer_interview",
                "category": "pricing_complaint",
                "sentiment": "negative",
                "aspect": "Bandwidth & Serverless Overage",
                "raw_quote": "Surprise bandwidth overages on Vercel caused finance to demand an audit of all edge middleware functions.",
                "sample_weight": 1.0,
            },
        ]
        themes_raw = [
            {
                "theme_title": "Serverless Bandwidth & Overage Transparency",
                "company_name": target,
                "category": "pricing_complaint",
                "occurrence_count": 29,
                "sample_size": 75,
                "sentiment_breakdown": {"positive": 10, "negative": 58, "neutral": 7},
                "representative_quotes": [
                    "Bandwidth overage calculations need predictable monthly budget caps.",
                ],
                "is_competitive_opportunity": False,
                "confidence": "High",
            },
        ]
    else:
        # Meesho Default
        feedback_raw = [
            {
                "id": "fb_msh_01",
                "company_name": primary_rival,
                "feedback_channel": "customer_review",
                "category": "product_complaint",
                "sentiment": "negative",
                "aspect": "Logistics & Delivery Transit",
                "raw_quote": "Logistics transit delay on third-party carrier shipments exceeds 6 days during festive peaks, whereas Flipkart Logistics fulfills within 48h.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_msh_02",
                "company_name": target,
                "feedback_channel": "support_ticket",
                "category": "pricing_complaint",
                "sentiment": "negative",
                "aspect": "RTO Penalties & Reverse Logistics",
                "raw_quote": "Zero commission model is great, but return shipping charges (RTO penalties) eat into SMB margins compared to Amazon India's subsidized reverse logistics.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_msh_03",
                "company_name": target,
                "feedback_channel": "customer_interview",
                "category": "positive_feedback",
                "sentiment": "positive",
                "aspect": "Seller Margins & Zero Commission",
                "raw_quote": "Zero commission on unbranded apparel allows tier-2/3 sellers to maintain 30% higher net margins than Flipkart or Amazon.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_msh_04",
                "company_name": secondary_rival,
                "feedback_channel": "customer_review",
                "category": "product_complaint",
                "sentiment": "negative",
                "aspect": "Brand Protection & Counterfeits",
                "raw_quote": "Amazon India FBA protects against counterfeit listings, whereas low-margin regional suppliers copy product images with zero enforcement.",
                "sample_weight": 1.0,
            },
            {
                "id": "fb_msh_05",
                "company_name": primary_rival,
                "feedback_channel": "customer_interview",
                "category": "switching_reason",
                "sentiment": "negative",
                "aspect": "Seller Retention",
                "raw_quote": "Switched 40% of catalog to Flipkart Fulfilled because their 'Assured' trust badge improved checkout conversion by 22%.",
                "sample_weight": 1.0,
            },
        ]
        themes_raw = [
            {
                "theme_title": "Logistics SLA & 48h Transit Guarantee",
                "company_name": primary_rival,
                "category": "product_complaint",
                "occurrence_count": 54,
                "sample_size": 138,
                "sentiment_breakdown": {"positive": 18, "negative": 108, "neutral": 12},
                "representative_quotes": [
                    "Third-party courier transit time is twice as long as Flipkart Assured.",
                    "Festive season delivery bottlenecks cause order cancellations.",
                ],
                "is_competitive_opportunity": True,
                "confidence": "High",
            },
            {
                "theme_title": "RTO Volatility & Reverse Shipping Penalties",
                "company_name": target,
                "category": "pricing_complaint",
                "occurrence_count": 42,
                "sample_size": 96,
                "sentiment_breakdown": {"positive": 8, "negative": 78, "neutral": 10},
                "representative_quotes": [
                    "RTO return courier charges wipe out weekly seller profits on cash-on-delivery orders.",
                ],
                "is_competitive_opportunity": False,
                "confidence": "High",
            },
            {
                "theme_title": "0% Commission Margin Advantage",
                "company_name": target,
                "category": "positive_feedback",
                "occurrence_count": 68,
                "sample_size": 145,
                "sentiment_breakdown": {"positive": 128, "negative": 6, "neutral": 11},
                "representative_quotes": [
                    "Zero marketplace commission is the single biggest competitive moat for regional SMBs.",
                ],
                "is_competitive_opportunity": True,
                "confidence": "High",
            },
        ]

    batch2_storage.save_feedback_records(feedback_raw, tid)
    batch2_storage.save_feedback_themes(themes_raw, tid)

    # =========================================================================
    # 5. Next Best Actions (Connected across Sales, Product, Mktg, Leadership)
    # =========================================================================
    if is_microsoft:
        actions_raw = [
            {
                "team": "Sales",
                "affected_team": "sales",
                "category": "objection_response",
                "title": f"Deploy Sovereign Cloud & EU Data Boundary Battlecard Against {primary_rival}",
                "what_happened": f"Lost 2 enterprise financial deals to {primary_rival} citing compliance latency concerns, while customer voice highlights AWS data egress fee frustration.",
                "why_it_matters": "$640k in active enterprise pipeline currently evaluating AWS Bedrock vs Azure OpenAI.",
                "recommended_action": f"Arm reps with Frankfurt sovereign data residency certificates and head-to-head AWS egress cost calculator.",
                "urgency": "Critical",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "customer_quote", "source": "Customer Review", "quote": "AWS inter-region data egress fees make multi-region failover cost-prohibitive."},
                    {"type": "battlecard", "name": f"{primary_rival} Enterprise Battlecard"},
                ],
            },
            {
                "team": "Product",
                "affected_team": "product",
                "category": "feature_gap",
                "title": "Accelerate Dedicated Kernel-Bypass Direct Connect for Ultra-Low Latency Inference",
                "what_happened": f"Enterprise algorithmic trading prospects cited sub-millisecond direct connection advantage on {primary_rival}.",
                "why_it_matters": "Wall Street and Tier-1 algorithmic funds mandate sub-millisecond deterministic latency.",
                "recommended_action": "Prioritize direct kernel-bypass networking in Azure HPC compute roadmap for Q4.",
                "urgency": "High",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "customer_theme", "factor": "Sub-millisecond Ultra-Low Latency Direct Connect"},
                ],
            },
            {
                "team": "Marketing",
                "affected_team": "marketing",
                "category": "messaging",
                "title": f"Publish 'Zero Egress Penalty' Interactive TCO Comparison vs {primary_rival}",
                "what_happened": f"Customer sentiment shows {primary_rival} egress bills fluctuating up to 35% monthly.",
                "why_it_matters": "Data transfer surprise bills are the #1 complaint driving CIOs to reconsider multi-cloud architectures.",
                "recommended_action": "Launch enterprise calculator comparing Azure ExpressRoute peering discounts vs AWS egress pricing.",
                "urgency": "High",
                "confidence": "Medium",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "theme", "name": "Egress Fees & Multi-Region TCO", "sample_size": 112},
                ],
            },
            {
                "team": "Leadership",
                "affected_team": "leadership",
                "category": "market_risk",
                "title": f"Expand Dedicated Sovereign AI Clusters Across APAC to Preempt {secondary_rival}",
                "what_happened": f"{secondary_rival} announced expanding regional AI data centers across Singapore and Tokyo.",
                "why_it_matters": "APAC financial institutions require local regulatory sovereignty.",
                "recommended_action": "Authorize capital expenditure for 4 additional sovereign DGX H100 pods in Singapore.",
                "urgency": "Critical",
                "confidence": "High",
                "status": "pending",
                "related_competitor": secondary_rival,
                "supporting_evidence": [
                    {"type": "market_signal", "title": "Google Cloud Regional APAC AI Data Center Expansion"},
                ],
            },
            {
                "team": "Sales",
                "affected_team": "sales",
                "category": "enablement",
                "title": "Copilot Studio Multi-Agent Playbook Certification for Field Solutions Architects",
                "what_happened": "Won Retail E-Commerce deal ($210k) after demonstrating Copilot Studio multi-agent orchestration.",
                "why_it_matters": "Win rate jumps from 42% to 78% when live agent orchestrations are demonstrated in discovery calls.",
                "recommended_action": "Mandate 1-hour field enablement lab on Copilot Studio agent templates for all enterprise reps.",
                "urgency": "Medium",
                "confidence": "High",
                "status": "completed",
                "related_competitor": tertiary_rival,
                "supporting_evidence": [
                    {"type": "customer_theme", "name": "Copilot Studio Multi-Agent Orchestration", "sentiment": "positive"},
                ],
            },
        ]
    else:
        # Meesho Default
        actions_raw = [
            {
                "team": "Sales",
                "affected_team": "sales",
                "category": "objection_response",
                "title": f"Deploy 72-Hour Express Logistics Battlecard Against {primary_rival}",
                "what_happened": f"54 customer voice complaints cite delivery transit speed favoring {primary_rival}.",
                "why_it_matters": "High regional distributor churn risk across North and West regional textile clusters.",
                "recommended_action": f"Arm reps with the new 3PL Express SLA comparison sheet and counter-positioning playbook highlighting 0% commission savings offsetting freight costs.",
                "urgency": "Critical",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "customer_theme", "name": "Logistics SLA & 48h Transit Guarantee", "sample_size": 138},
                    {"type": "battlecard", "name": f"{primary_rival} Competitive Battlecard", "section": "Where We Lose"},
                ],
            },
            {
                "team": "Product",
                "affected_team": "product",
                "category": "feature_gap",
                "title": "Automate Non-Delivery Report (NDR) IVR/WhatsApp Calling to Reduce RTO by 14%",
                "what_happened": f"RTO return penalties identified as #1 pricing complaint in seller voice.",
                "why_it_matters": "Reducing RTO return rates by 3% increases seller net profitability by 8%, completely neutralizing competitor fulfillment badges.",
                "recommended_action": "Fast-track sprint for automated WhatsApp address verification and IVR re-confirmation prior to courier dispatch.",
                "urgency": "High",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "complaint", "quote": "Zero commission model is great, but return shipping charges (RTO penalties) eat into SMB margins."},
                ],
            },
            {
                "team": "Marketing",
                "affected_team": "marketing",
                "category": "messaging",
                "title": f"Launch 'True Total Net Realization' Head-to-Head Calculator Against {primary_rival}",
                "what_happened": f"{primary_rival} launched aggressive merchant campaigns claiming superior total landed sales volume.",
                "why_it_matters": "Regional sellers confuse gross sales volume with net bottom-line profit after 18% commission and return deductions.",
                "recommended_action": "Publish interactive calculator showing that a seller making ₹10L gross keeps ₹9.8L on Meesho vs ₹7.9L on Flipkart.",
                "urgency": "High",
                "confidence": "Medium",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "theme", "name": "0% Commission Margin Advantage", "sample_size": 145},
                ],
            },
            {
                "team": "Leadership",
                "affected_team": "leadership",
                "category": "strategic_opportunity",
                "title": "Establish Strategic Regional 3PL Volume Partnership with Shadowfax / Delhivery",
                "what_happened": f"Logistics transit gap identified as recurring seller vulnerability against {primary_rival} and {secondary_rival}.",
                "why_it_matters": "Securing priority surface line-haul transit guarantees 72h fulfillment across 18,000 Tier-2/3 pin codes.",
                "recommended_action": "Authorize executive team to negotiate a master logistics SLA with committed daily parcel minimums in exchange for dedicated express hub routing.",
                "urgency": "Critical",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "analytics", "metric": "Logistics transit SLA raised repeatedly in seller feedback against Flipkart"},
                ],
            },
            {
                "team": "Sales",
                "affected_team": "sales",
                "category": "enablement",
                "title": "Regional Language Supplier Portal Walkthrough Certification",
                "what_happened": "Regional seller feedback highlights Hindi/Gujarati onboarding ease as a key differentiator.",
                "why_it_matters": "Tier-3 manufacturers reject complex English-only ERP integrations.",
                "recommended_action": "Publish vernacular onboarding video guides and certify all North/West field reps.",
                "urgency": "Medium",
                "confidence": "High",
                "status": "completed",
                "related_competitor": tertiary_rival,
                "supporting_evidence": [
                    {"type": "customer_theme", "factor": "Regional Language App Support"},
                ],
            },
        ]

    for act in actions_raw:
        batch2_storage.save_next_best_action(act, tid)

    return {
        "actions": len(actions_raw),
        "feedback": len(feedback_raw),
    }
