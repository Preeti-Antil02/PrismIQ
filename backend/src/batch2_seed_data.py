"""
Comprehensive Ground-Truth Seed Intelligence for PrismIQ Batch 2.
Provides rich, evidence-grounded Customer Voice, Win/Loss deals,
Sales conversation transcripts, Deal Intelligence dossiers, and Next Best Actions.
Guarantees that a customer complaint connects directly to a competitor,
a lost deal, a battlecard, and a recommended action across all personas.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from . import batch2_storage


def seed_batch2_intelligence(tenant_id: str, target_name: Optional[str] = None) -> Dict[str, int]:
    """
    Populates connected Batch 2 intelligence for the specified tenant.
    Idempotent: Only seeds if tenant has 0 deals recorded.
    """
    tid = str(tenant_id).strip()
    batch2_storage._ensure_tenant_cache(tid)

    # If tenant already has deals or actions, don't overwrite
    if len(batch2_storage._IN_MEMORY_DEALS.get(tid, {})) > 0:
        return {
            "deals": len(batch2_storage._IN_MEMORY_DEALS[tid]),
            "actions": len(batch2_storage._IN_MEMORY_ACTIONS[tid]),
            "feedback": len(batch2_storage._IN_MEMORY_FEEDBACK.get(tid, [])),
        }

    now_iso = datetime.now(timezone.utc).isoformat()
    t_lower = (target_name or "").lower()

    is_microsoft = "microsoft" in t_lower or tid == "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f"
    is_vercel = "vercel" in t_lower or tid == "c8f13b91-46ef-4682-9975-f85764d8a12e"

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
    else:
        target = "Meesho"
        primary_rival = "Flipkart"
        secondary_rival = "Amazon India"
        tertiary_rival = "Shopsy"
        industry = "Social Commerce & Marketplace"

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
                "feedback_channel": "sales_call_feedback",
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
                "feedback_channel": "sales_call_feedback",
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
    # 2. Win/Loss Deals & Decision Factors
    # =========================================================================
    if is_microsoft:
        deals_raw = [
            {
                "deal_name": "Global FinTech Tier-1 Azure OpenAI Migration",
                "outcome": "won",
                "deal_value": 450000.0,
                "primary_competitor": primary_rival,
                "competitors_involved": [primary_rival, secondary_rival],
                "winning_factor": "Integrated Enterprise Security & Purview Governance",
                "loss_factor": None,
                "buyer_objections": ["Initial token rate limits on GPT-4o"],
                "notes": "Won against AWS Bedrock due to superior hybrid Active Directory and Purview compliance integration.",
            },
            {
                "deal_name": "European Healthcare Sovereign Cloud AI Rollout",
                "outcome": "won",
                "deal_value": 380000.0,
                "primary_competitor": secondary_rival,
                "competitors_involved": [secondary_rival],
                "winning_factor": "EU Data Boundary & Sovereign Cloud Commitments",
                "loss_factor": None,
                "buyer_objections": ["Data residency compliance verification"],
                "notes": "Selected over Google Cloud because of certified local healthcare data storage guarantees.",
            },
            {
                "deal_name": "High-Frequency Algorithmic Trading Platform",
                "outcome": "lost",
                "deal_value": 290000.0,
                "primary_competitor": primary_rival,
                "competitors_involved": [primary_rival],
                "winning_factor": None,
                "loss_factor": "Sub-millisecond Ultra-Low Latency Direct Connect",
                "buyer_objections": ["AWS Outposts offers dedicated on-prem hardware with custom FPGA acceleration"],
                "notes": "Lost to AWS due to proprietary FPGA low-latency networking requirements.",
            },
            {
                "deal_name": "Retail E-Commerce Multi-Agent Shopping Assistant",
                "outcome": "won",
                "deal_value": 210000.0,
                "primary_competitor": tertiary_rival,
                "competitors_involved": [tertiary_rival, primary_rival],
                "winning_factor": "Copilot Studio Multi-Agent Orchestration & Enterprise SLAs",
                "loss_factor": None,
                "buyer_objections": ["OpenAI direct pricing appeared 10% cheaper initially"],
                "notes": "Customer chose Azure for enterprise 99.99% uptime guarantee and HIPAA compliance.",
            },
            {
                "deal_name": "Autonomous Drone Fleet Telemetry Analytics",
                "outcome": "lost",
                "deal_value": 320000.0,
                "primary_competitor": secondary_rival,
                "competitors_involved": [secondary_rival, primary_rival],
                "winning_factor": None,
                "loss_factor": "Google BigQuery Geospatial Processing Speed",
                "buyer_objections": ["Azure Synapse pricing structure less flexible for streaming spatial data"],
                "notes": "Client standardized on GCP for BigQuery spatial GIS queries.",
            },
        ]
    elif is_vercel:
        deals_raw = [
            {
                "deal_name": "Global SaaS Marketing Hub & Doc Engine",
                "outcome": "won",
                "deal_value": 115000.0,
                "primary_competitor": secondary_rival,
                "competitors_involved": [secondary_rival],
                "winning_factor": "Zero-Config Next.js Preview Collaboration & ISR",
                "loss_factor": None,
                "buyer_objections": ["Per-seat pricing on enterprise team"],
                "notes": "Won due to Next.js Incremental Static Regeneration and visual comments for marketing team.",
            },
            {
                "deal_name": "Streaming Media Video CDN & Edge Tokenization",
                "outcome": "lost",
                "deal_value": 180000.0,
                "primary_competitor": primary_rival,
                "competitors_involved": [primary_rival],
                "winning_factor": None,
                "loss_factor": "Zero Bandwidth Egress Fees on Workers",
                "buyer_objections": ["Vercel Enterprise bandwidth overage quotes exceeded Cloudflare flat rate by 3x"],
                "notes": "Lost purely on bandwidth transit pricing.",
            },
        ]
    else:
        # Meesho Default
        deals_raw = [
            {
                "deal_name": "Surat Textile Consortium - 500 Sellers Onboarding",
                "outcome": "won",
                "deal_value": 120000.0,
                "primary_competitor": primary_rival,
                "competitors_involved": [primary_rival, tertiary_rival],
                "winning_factor": "Zero Marketplace Commission & Direct UPI Settlement",
                "loss_factor": None,
                "buyer_objections": ["Concerns on regional logistics transit times"],
                "notes": "Won against Flipkart. 0% take-rate enabled manufacturers to price 25% cheaper and protect margin.",
            },
            {
                "deal_name": "Jaipur Handloom Regional Distribution Enterprise",
                "outcome": "lost",
                "deal_value": 85000.0,
                "primary_competitor": primary_rival,
                "competitors_involved": [primary_rival],
                "winning_factor": None,
                "loss_factor": "Flipkart Assured Logistics SLA & Faster 48h Transit",
                "buyer_objections": ["RTO penalty charges too volatile without automated NDR management", "Flipkart Assured badge gives 22% higher conversion"],
                "notes": "Lost to Flipkart. Client needed guaranteed 48-hour delivery badge to compete in festive apparel.",
            },
            {
                "deal_name": "Delhi NCR Consumer Electronics Wholesale",
                "outcome": "lost",
                "deal_value": 210000.0,
                "primary_competitor": secondary_rival,
                "competitors_involved": [secondary_rival, primary_rival],
                "winning_factor": None,
                "loss_factor": "Amazon FBA Brand Registry & Counterfeit Protection",
                "buyer_objections": ["Counterfeit copycats erode wholesale distributor reputation on unverified platforms"],
                "notes": "Lost to Amazon India due to Brand Registry and FBA automated damage claims.",
            },
            {
                "deal_name": "Ludhiana Knitwear Apparel Co-op",
                "outcome": "won",
                "deal_value": 95000.0,
                "primary_competitor": tertiary_rival,
                "competitors_involved": [tertiary_rival],
                "winning_factor": "Superior Tier-3 Social Sharing Engine & Low Seller Churn",
                "loss_factor": None,
                "buyer_objections": ["Catalog bulk upload tool complexity"],
                "notes": "Won against Shopsy. WhatsApp catalog sharing drove 40% organic referral traffic.",
            },
            {
                "deal_name": "Bengaluru D2C Fashion Collective",
                "outcome": "lost",
                "deal_value": 140000.0,
                "primary_competitor": "Ajio",
                "competitors_involved": ["Ajio", primary_rival],
                "winning_factor": None,
                "loss_factor": "Curated Premium Brand Positioning",
                "buyer_objections": ["Value marketplace perceived as discount-only apparel"],
                "notes": "Lost to Ajio due to curated fashion editorial placement requirements.",
            },
            {
                "deal_name": "Kolkata Leather Goods Manufacturer Hub",
                "outcome": "won",
                "deal_value": 160000.0,
                "primary_competitor": secondary_rival,
                "competitors_involved": [secondary_rival],
                "winning_factor": "Simpler Regional Catalog Onboarding & Dedicated Account Rep",
                "loss_factor": None,
                "buyer_objections": ["Amazon global export program incentives"],
                "notes": "Won due to zero-barrier supplier portal and same-week seller payouts.",
            },
            {
                "deal_name": "Tirupur Garments Export Surplus Network",
                "outcome": "won",
                "deal_value": 135000.0,
                "primary_competitor": primary_rival,
                "competitors_involved": [primary_rival],
                "winning_factor": "0% Commission Advantage Offset Freight Costs",
                "loss_factor": None,
                "buyer_objections": ["Flipkart SuperCoins loyalty ecosystem lock-in"],
                "notes": "Won. Calculated net realization showed $24k annual margin improvement over Flipkart.",
            },
        ]

    saved_deals = []
    for d in deals_raw:
        saved_d = batch2_storage.save_win_loss_deal(d, tid)
        saved_deals.append(saved_d)

    # =========================================================================
    # 3. Sales Call Transcripts & Extracted Signals
    # =========================================================================
    if is_microsoft:
        # Call 1: FinTech Deal
        call_msft_01 = {
            "id": f"call_msft_01_{tid[:8]}",
            "deal_id": saved_deals[0]["id"],
            "call_title": "Enterprise Cloud Architecture Review - Multi-Cloud Strategy",
            "participants": ["Sarah Jenkins (VP Infrastructure)", "Alex Miller (Azure Principal Architect)"],
            "competitors_mentioned": [primary_rival, secondary_rival],
            "transcript_text": (
                "Customer: 'We love Azure OpenAI governance, but AWS is pitching Outposts and custom egress waivers. "
                "Can Microsoft guarantee that our European medical records will never touch US endpoints?'\n"
                "Rep: 'Yes, with our EU Data Boundary commitment, all customer data, model weights, and logs reside strictly in Frankfurt and Dublin.'\n"
                "Customer: 'That solves compliance. What about latency against Bedrock?'"
            ),
            "summary": "Customer ready to sign $450k commitment if EU data boundary and sub-50ms token latency are verified.",
        }
        items_msft_01 = [
            {
                "call_id": call_msft_01["id"],
                "item_type": "competitor_mention",
                "extracted_content": "AWS Outposts and custom egress pricing waivers",
                "confidence": 0.94,
                "quote_offset": 50,
                "linked_competitor": primary_rival,
            },
            {
                "call_id": call_msft_01["id"],
                "item_type": "buyer_objection",
                "extracted_content": "Data residency and sovereign compliance for European medical records",
                "confidence": 0.96,
                "quote_offset": 120,
            },
            {
                "call_id": call_msft_01["id"],
                "item_type": "buying_signal",
                "extracted_content": "Customer confirms ready to sign $450k commitment once Frankfurt data boundary is confirmed",
                "confidence": 0.91,
                "quote_offset": 230,
            },
            {
                "call_id": call_msft_01["id"],
                "item_type": "recommended_response",
                "extracted_content": "Provide certified EU Data Boundary audit statement and execute Purview sovereign tenant lockdown",
                "confidence": 0.95,
                "quote_offset": 280,
            },
        ]
        batch2_storage.save_sales_call(call_msft_01, tid)
        batch2_storage.save_call_intelligence_items(items_msft_01, tid)

        # Call 2: High-Frequency Trading Deal
        call_msft_02 = {
            "id": f"call_msft_02_{tid[:8]}",
            "deal_id": saved_deals[2]["id"],
            "call_title": "Trading Infrastructure Evaluation - Ultra Low Latency Execution vs AWS",
            "participants": ["Marcus Vance (Chief Risk Officer)", "Priya Desai (Azure HPC Lead)"],
            "competitors_mentioned": [primary_rival],
            "transcript_text": (
                "Customer: 'AWS Outposts gives us dedicated on-prem microsecond execution for NYSE market open. What is Microsoft\\'s answer for bare-metal determinism?'\n"
                "Rep: 'While Outposts requires $250k initial hardware commitments, our Azure InfiniBand HPC clusters deliver sub-10 microsecond MPI latency without capital lock-in, and our nightly simulation cost is 22% lower.'\n"
                "Customer: 'If you can benchmark our quantitative risk models with that 22% savings, we will allocate the backtesting workload to Azure.'"
            ),
            "summary": "Customer comparing AWS Outposts vs Azure HPC. Willing to commit $290k backtesting pipeline if InfiniBand benchmarks meet 22% cost reduction target.",
        }
        items_msft_02 = [
            {
                "call_id": call_msft_02["id"],
                "item_type": "competitor_mention",
                "extracted_content": "Custom FPGA hardware acceleration on AWS Outposts",
                "confidence": 0.95,
                "quote_offset": 45,
                "linked_competitor": primary_rival,
            },
            {
                "call_id": call_msft_02["id"],
                "item_type": "buyer_objection",
                "extracted_content": "Ultra-low latency determinism and hardware lock-in concerns",
                "confidence": 0.94,
                "quote_offset": 115,
            },
            {
                "call_id": call_msft_02["id"],
                "item_type": "buying_signal",
                "extracted_content": "Willing to allocate $290k backtesting workload to Azure if InfiniBand benchmarks confirm 22% cost savings",
                "confidence": 0.93,
                "quote_offset": 240,
            },
            {
                "call_id": call_msft_02["id"],
                "item_type": "recommended_response",
                "extracted_content": "Deploy Azure InfiniBand benchmark comparison and execute 14-day dedicated low-latency cluster POC",
                "confidence": 0.96,
                "quote_offset": 290,
            },
        ]
        batch2_storage.save_sales_call(call_msft_02, tid)
        batch2_storage.save_call_intelligence_items(items_msft_02, tid)

    else:
        # Call 1: Jaipur Handloom Deal
        call_msh_01 = {
            "id": f"call_msh_01_{tid[:8]}",
            "deal_id": saved_deals[1]["id"],
            "call_title": "Jaipur Handloom Enterprise - Pre-Contract Review",
            "participants": ["Rajesh Sharma (Director of Sales)", "Vikram Mehta (PrismIQ Enterprise Lead)"],
            "competitors_mentioned": [primary_rival, secondary_rival],
            "transcript_text": (
                "Customer: 'We have 12,000 SKUs ready to list. Zero commission sounds great on paper, but Flipkart Assured guarantees "
                "48-hour delivery across North India. Our return rate on non-assured platforms is 18% because buyers cancel when tracking stays stalled.'\n"
                "Rep: 'We recently integrated 3PL Express lines that match 72h SLAs, and because you save 18% in commissions, your net profit easily absorbs returns.'\n"
                "Customer: 'Show me the math. If you can provide automated NDR verification to stop bogus COD orders, we\\'ll split our volume 50-50 with Flipkart.'"
            ),
            "summary": "Customer evaluating $85,000 deal. Delivery transit time and RTO cancel rates are the central blockers favoring Flipkart.",
        }
        items_msh_01 = [
            {
                "call_id": call_msh_01["id"],
                "item_type": "competitor_mention",
                "extracted_content": "Flipkart Assured guarantees 48-hour delivery badge across North India",
                "confidence": 0.96,
                "quote_offset": 85,
                "linked_competitor": primary_rival,
            },
            {
                "call_id": call_msh_01["id"],
                "item_type": "buyer_objection",
                "extracted_content": "Return rate reaches 18% when shipping transit exceeds 4 days on cash-on-delivery orders",
                "confidence": 0.93,
                "quote_offset": 150,
            },
            {
                "call_id": call_msh_01["id"],
                "item_type": "buying_signal",
                "extracted_content": "Willing to commit 50% catalog volume ($42k) if automated NDR address verification is provided",
                "confidence": 0.92,
                "quote_offset": 310,
            },
            {
                "call_id": call_msh_01["id"],
                "item_type": "recommended_response",
                "extracted_content": "Deploy guaranteed 72-hour 3PL Express SLA comparison sheet and demonstrate 0% commission margin protection",
                "confidence": 0.94,
                "quote_offset": 380,
            },
        ]
        batch2_storage.save_sales_call(call_msh_01, tid)
        batch2_storage.save_call_intelligence_items(items_msh_01, tid)

        # Call 2: Surat Textile Consortium
        call_msh_02 = {
            "id": f"call_msh_02_{tid[:8]}",
            "deal_id": saved_deals[0]["id"],
            "call_title": "Surat Textile Consortium - Expansion & Onboarding Call",
            "participants": ["Hitesh Patel (Consortium President)", "Anita Rao (PrismIQ Strategic Partnerships)"],
            "competitors_mentioned": [primary_rival, tertiary_rival],
            "transcript_text": (
                "Customer: 'Our 500 weaver co-ops need bulk catalog upload and Gujarati voice support. Flipkart charges 18% commission which makes small batch handloom unviable.'\n"
                "Rep: 'Meesho guarantees 0% commission permanently for regional apparel co-ops, and our local account manager handles bulk CSV onboarding.'\n"
                "Customer: 'That saves each weaver ₹40,000 monthly. We are proceeding with full onboarding.'"
            ),
            "summary": "Customer onboarded 500 sellers with $120k pipeline citing zero take-rate and vernacular portal.",
        }
        items_msh_02 = [
            {
                "call_id": call_msh_02["id"],
                "item_type": "competitor_mention",
                "extracted_content": "Flipkart charges 18% commission making small batch handloom unviable",
                "confidence": 0.98,
                "quote_offset": 75,
                "linked_competitor": primary_rival,
            },
            {
                "call_id": call_msh_02["id"],
                "item_type": "buying_signal",
                "extracted_content": "0% commission saves each weaver ₹40,000 monthly; proceeding with full onboarding",
                "confidence": 0.99,
                "quote_offset": 220,
            },
            {
                "call_id": call_msh_02["id"],
                "item_type": "recommended_response",
                "extracted_content": "Provide dedicated regional onboarding concierge and lock in 0% commission agreement",
                "confidence": 0.95,
                "quote_offset": 260,
            },
        ]
        batch2_storage.save_sales_call(call_msh_02, tid)
        batch2_storage.save_call_intelligence_items(items_msh_02, tid)

    # =========================================================================
    # 4. Deal Intelligence Dossiers (Deal Room Cockpit)
    # =========================================================================
    if is_microsoft:
        dossiers_raw = [
            {
                "deal_id": saved_deals[0]["id"],
                "deal_name": "Global FinTech Tier-1 Azure OpenAI Migration",
                "competitors_involved": [primary_rival, secondary_rival],
                "threat_level": "High",
                "competitive_threat": "High",
                "customer_requirements": [
                    "Sub-50ms token latency for algorithmic financial analysis",
                    "Certified European Data Boundary compliance with local data residency",
                    "Seamless Microsoft 365 Copilot and Purview security integration",
                ],
                "primary_objections": [
                    {"objection": "AWS Outposts offers localized on-prem hardware for high-frequency trading", "competitor": primary_rival},
                    {"objection": "Data residency compliance verification for European financial data", "competitor": secondary_rival},
                ],
                "customer_objections": [
                    "AWS Outposts offers localized on-prem hardware for high-frequency trading",
                    "Data residency compliance verification for European financial data",
                ],
                "product_gaps": [{"gap": "Sub-millisecond direct connect kernel bypass driver", "competitor": primary_rival}],
                "competitive_advantages": [
                    {"advantage": "Native Purview enterprise security and SOC2 compliance", "competitor": primary_rival},
                    {"advantage": "Certified EU Data Boundary guarantees model data sovereignty", "competitor": secondary_rival},
                    {"advantage": "Direct integration with Microsoft 365 Copilot architecture", "competitor": primary_rival},
                ],
                "recommended_sales_response": {
                    "strategy": "Lead with Enterprise Security & Sovereign Compliance",
                    "playbook_scripts": [
                        {
                            "competitor": primary_rival,
                            "buyer_objection_scenario": "AWS Outposts offers localized on-prem hardware for trading",
                            "recommended_rebuttal": "Emphasize that Azure OpenAI is the only platform with certified EU Data Boundary and Purview data classification built-in, avoiding $250k initial hardware lock-in.",
                            "action_guide": "Deploy certified EU Data Boundary compliance audit statement and offer proof-of-concept credits for Azure ExpressRoute dedicated peering.",
                        },
                        {
                            "competitor": secondary_rival,
                            "buyer_objection_scenario": "Data residency compliance verification for European financial records",
                            "recommended_rebuttal": "Demonstrate that all Azure OpenAI model weights, fine-tuning data, and inference logs reside strictly within Frankfurt and Dublin sovereign data centers.",
                            "action_guide": "Execute sovereign tenant compliance lockdown agreement with customer legal team.",
                        },
                    ],
                },
                "recommended_sales_responses": [
                    {
                        "competitor": primary_rival,
                        "buyer_objection_scenario": "AWS Outposts offers localized on-prem hardware for trading",
                        "recommended_rebuttal": "Emphasize that Azure OpenAI is the only platform with certified EU Data Boundary and Purview data classification built-in, avoiding $250k initial hardware lock-in.",
                        "action_guide": "Deploy certified EU Data Boundary compliance audit statement and offer proof-of-concept credits for Azure ExpressRoute dedicated peering.",
                    },
                ],
                "historical_proof_points": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 2,
                        "sample_size": 2,
                        "wins_against": 1,
                        "won_deals": 1,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Integrated Enterprise Security & Purview Governance"],
                        "loss_factors": ["Ultra-Low Latency Direct Connect"],
                        "has_sufficient_data": True,
                        "data_note": "Directional intelligence based on 2 recorded Tier-1 financial cloud evaluations.",
                        "recent_deals": [
                            {"deal_name": "Global FinTech Tier-1 Azure Migration", "outcome": "won", "value": 450000},
                        ],
                    },
                ],
                "relevant_historical_wins_losses": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 2,
                        "sample_size": 2,
                        "wins_against": 1,
                        "won_deals": 1,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Integrated Enterprise Security & Purview Governance"],
                        "loss_factors": ["Ultra-Low Latency Direct Connect"],
                        "has_sufficient_data": True,
                        "data_note": "Directional intelligence based on 2 recorded Tier-1 financial cloud evaluations.",
                        "recent_deals": [
                            {"deal_name": "Global FinTech Tier-1 Azure Migration", "outcome": "won", "value": 450000},
                        ],
                    },
                ],
                "supporting_claim_ids": [],
                "created_at": "2026-11-18T10:00:00Z",
            },
            {
                "deal_id": saved_deals[2]["id"],
                "deal_name": "High-Frequency Algorithmic Trading Platform",
                "competitors_involved": [primary_rival],
                "threat_level": "Critical",
                "competitive_threat": "Critical",
                "customer_requirements": [
                    "Sub-10 microsecond MPI inter-node networking",
                    "Custom quantitative model backtesting simulation infrastructure",
                    "Deterministic GPU compute allocation during market hours",
                ],
                "primary_objections": [
                    {"objection": "Custom FPGA hardware acceleration on AWS Outposts", "competitor": primary_rival},
                    {"objection": "AWS inter-region data egress fee waivers", "competitor": primary_rival},
                ],
                "customer_objections": [
                    "Custom FPGA hardware acceleration on AWS Outposts",
                    "AWS inter-region data egress fee waivers",
                ],
                "product_gaps": [{"gap": "Bare-metal FPGA instances in US-East", "competitor": primary_rival}],
                "competitive_advantages": [
                    {"advantage": "22% lower cost per GPU-hour on nightly quantitative simulation pipelines", "competitor": primary_rival},
                    {"advantage": "Zero data egress penalty when using Azure ExpressRoute direct peering", "competitor": primary_rival},
                ],
                "recommended_sales_response": {
                    "strategy": "Pivot from low-latency execution to high-volume offline risk backtesting",
                    "playbook_scripts": [
                        {
                            "competitor": primary_rival,
                            "buyer_objection_scenario": "Custom FPGA hardware acceleration on AWS Outposts",
                            "recommended_rebuttal": "Position Azure InfiniBand HPC clusters for nightly quantitative risk simulation where cost per simulation run is 22% lower without upfront hardware lock-in.",
                            "action_guide": "Deploy Azure HPC benchmark comparison and execute 14-day dedicated low-latency cluster POC.",
                        },
                        {
                            "competitor": primary_rival,
                            "buyer_objection_scenario": "AWS inter-region data egress fee waivers",
                            "recommended_rebuttal": "Demonstrate that Azure ExpressRoute direct peering provides predictable flat-rate connectivity with zero per-gigabyte egress surprise bills.",
                            "action_guide": "Provide TCO comparison showing $48k annual data transfer savings.",
                        },
                    ],
                },
                "recommended_sales_responses": [
                    {
                        "competitor": primary_rival,
                        "buyer_objection_scenario": "Custom FPGA hardware acceleration on AWS Outposts",
                        "recommended_rebuttal": "Position Azure InfiniBand HPC clusters for nightly quantitative risk simulation where cost per simulation run is 22% lower without upfront hardware lock-in.",
                        "action_guide": "Deploy Azure HPC benchmark comparison and execute 14-day dedicated low-latency cluster POC.",
                    },
                ],
                "historical_proof_points": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 2,
                        "sample_size": 2,
                        "wins_against": 1,
                        "won_deals": 1,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Cost efficiency on batch simulation"],
                        "loss_factors": ["AWS Outposts custom FPGA hardware"],
                        "has_sufficient_data": True,
                        "data_note": "Empirical evaluation based on 2 algorithmic trading platform bids.",
                        "recent_deals": [
                            {"deal_name": "High-Frequency Algorithmic Trading Platform", "outcome": "lost", "value": 290000},
                            {"deal_name": "Global FinTech Tier-1 Azure Migration", "outcome": "won", "value": 450000},
                        ],
                    },
                ],
                "relevant_historical_wins_losses": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 2,
                        "sample_size": 2,
                        "wins_against": 1,
                        "won_deals": 1,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Cost efficiency on batch simulation"],
                        "loss_factors": ["AWS Outposts custom FPGA hardware"],
                        "has_sufficient_data": True,
                        "data_note": "Empirical evaluation based on 2 algorithmic trading platform bids.",
                        "recent_deals": [
                            {"deal_name": "High-Frequency Algorithmic Trading Platform", "outcome": "lost", "value": 290000},
                            {"deal_name": "Global FinTech Tier-1 Azure Migration", "outcome": "won", "value": 450000},
                        ],
                    },
                ],
                "supporting_claim_ids": [],
                "created_at": "2026-11-18T10:00:00Z",
            },
        ]
    else:
        dossiers_raw = [
            {
                "deal_id": saved_deals[1]["id"],
                "deal_name": "Jaipur Handloom Regional Distribution Enterprise",
                "competitors_involved": [primary_rival],
                "threat_level": "Critical",
                "competitive_threat": "Critical",
                "customer_requirements": [
                    "Sub-72h regional shipping transit SLA across North India",
                    "Automated WhatsApp customer address re-verification",
                    "Capped RTO penalty protection for high-value apparel",
                ],
                "primary_objections": [
                    {"objection": "Flipkart Assured badge gives 22% higher conversion on festive catalog", "competitor": primary_rival},
                    {"objection": "Delivery transit speed too slow in Tier-1 metros compared to Flipkart 48h SLA", "competitor": primary_rival},
                    {"objection": "High RTO return penalty charges on Cash-On-Delivery orders", "competitor": primary_rival},
                ],
                "customer_objections": [
                    "Flipkart Assured badge gives 22% higher conversion on festive catalog",
                    "Delivery transit speed too slow in Tier-1 metros compared to Flipkart 48h SLA",
                    "High RTO return penalty charges on Cash-On-Delivery orders",
                ],
                "product_gaps": [
                    {"gap": "Guaranteed sub-48h metro fulfillment badge", "competitor": primary_rival},
                    {"gap": "Automated IVR/WhatsApp NDR confirmation", "competitor": primary_rival},
                ],
                "competitive_advantages": [
                    {"advantage": "0% marketplace commission vs Flipkart's 18% blended take-rate", "competitor": primary_rival},
                    {"advantage": "Direct UPI seller escrow settlement in 48 hours vs 14 days", "competitor": primary_rival},
                    {"advantage": "30% higher seller retention across regional handloom clusters", "competitor": primary_rival},
                ],
                "recommended_sales_response": {
                    "strategy": "Position 0% Commission Margin Delta Against Delivery Speed",
                    "playbook_scripts": [
                        {
                            "competitor": primary_rival,
                            "buyer_objection_scenario": "Flipkart Assured 48h delivery requirement",
                            "recommended_rebuttal": "Show financial model demonstrating that 18% commission savings easily covers dedicated 3PL regional express delivery with 30% higher net margin.",
                            "action_guide": "Provide customized landed margin comparison workbook and offer pilot cohort RTO cap.",
                        },
                        {
                            "competitor": primary_rival,
                            "buyer_objection_scenario": "High RTO return penalties on non-assured delivery",
                            "recommended_rebuttal": "Introduce our new automated WhatsApp NDR address re-confirmation feature which drops RTO rates by 14%.",
                            "action_guide": "Enroll client into automated NDR beta cohort.",
                        },
                    ],
                },
                "recommended_sales_responses": [
                    {
                        "competitor": primary_rival,
                        "buyer_objection_scenario": "Flipkart Assured 48h delivery requirement",
                        "recommended_rebuttal": "Show financial model demonstrating that 18% commission savings easily covers dedicated 3PL regional express delivery with 30% higher net margin.",
                        "action_guide": "Provide customized landed margin comparison workbook and offer pilot cohort RTO cap.",
                    },
                ],
                "historical_proof_points": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 3,
                        "sample_size": 3,
                        "wins_against": 2,
                        "won_deals": 2,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Zero Marketplace Commission", "Direct UPI Settlement"],
                        "loss_factors": ["Flipkart Assured 48h Transit"],
                        "has_sufficient_data": True,
                        "data_note": "Directional pattern based on 3 regional distributor evaluations.",
                        "recent_deals": [
                            {"deal_name": "Surat Textile Consortium", "outcome": "won", "value": 120000},
                            {"deal_name": "Jaipur Handloom Regional Hub", "outcome": "lost", "value": 85000},
                            {"deal_name": "Tirupur Garments Export Surplus", "outcome": "won", "value": 135000},
                        ],
                    },
                ],
                "relevant_historical_wins_losses": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 3,
                        "sample_size": 3,
                        "wins_against": 2,
                        "won_deals": 2,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Zero Marketplace Commission", "Direct UPI Settlement"],
                        "loss_factors": ["Flipkart Assured 48h Transit"],
                        "has_sufficient_data": True,
                        "data_note": "Directional pattern based on 3 regional distributor evaluations.",
                        "recent_deals": [
                            {"deal_name": "Surat Textile Consortium", "outcome": "won", "value": 120000},
                            {"deal_name": "Jaipur Handloom Regional Hub", "outcome": "lost", "value": 85000},
                            {"deal_name": "Tirupur Garments Export Surplus", "outcome": "won", "value": 135000},
                        ],
                    },
                ],
                "supporting_claim_ids": [],
                "created_at": "2026-11-18T10:00:00Z",
            },
            {
                "deal_id": saved_deals[0]["id"],
                "deal_name": "Surat Textile Consortium - 500 Sellers Onboarding",
                "competitors_involved": [primary_rival, tertiary_rival],
                "threat_level": "Low",
                "competitive_threat": "Low",
                "customer_requirements": [
                    "Bulk CSV catalog upload interface",
                    "Gujarati and Hindi regional language support",
                    "Zero commission guarantee for 24 months",
                ],
                "primary_objections": [
                    {"objection": "Third-party courier tracking updates lack real-time GPS visibility", "competitor": primary_rival},
                ],
                "customer_objections": [
                    "Third-party courier tracking updates lack real-time GPS visibility",
                ],
                "product_gaps": [{"gap": "Real-time GPS parcel tracking integration", "competitor": primary_rival}],
                "competitive_advantages": [
                    {"advantage": "Zero commission on unbranded apparel", "competitor": primary_rival},
                    {"advantage": "Native Gujarati and Hindi app interfaces for manufacturers", "competitor": primary_rival},
                ],
                "recommended_sales_response": {
                    "strategy": "Expansion and Retention Program",
                    "playbook_scripts": [
                        {
                            "competitor": primary_rival,
                            "buyer_objection_scenario": "Third-party courier tracking visibility",
                            "recommended_rebuttal": "Fast-track seasonal catalog updates with dedicated bulk spreadsheet concierge and WhatsApp tracking notifications.",
                            "action_guide": "Assign tier-1 regional technical onboarding lead.",
                        },
                    ],
                },
                "recommended_sales_responses": [
                    {
                        "competitor": primary_rival,
                        "buyer_objection_scenario": "Third-party courier tracking visibility",
                        "recommended_rebuttal": "Fast-track seasonal catalog updates with dedicated bulk spreadsheet concierge and WhatsApp tracking notifications.",
                        "action_guide": "Assign tier-1 regional technical onboarding lead.",
                    },
                ],
                "historical_proof_points": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 3,
                        "sample_size": 3,
                        "wins_against": 2,
                        "won_deals": 2,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Zero Commission Model", "Regional Language App Support"],
                        "loss_factors": [],
                        "has_sufficient_data": True,
                        "data_note": "Surat Consortium onboarded 500 weavers with $120k pipeline.",
                        "recent_deals": [
                            {"deal_name": "Surat Textile Consortium", "outcome": "won", "value": 120000},
                        ],
                    },
                ],
                "relevant_historical_wins_losses": [
                    {
                        "competitor": primary_rival,
                        "historical_deals_count": 3,
                        "sample_size": 3,
                        "wins_against": 2,
                        "won_deals": 2,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Zero Commission Model", "Regional Language App Support"],
                        "loss_factors": [],
                        "has_sufficient_data": True,
                        "data_note": "Surat Consortium onboarded 500 weavers with $120k pipeline.",
                        "recent_deals": [
                            {"deal_name": "Surat Textile Consortium", "outcome": "won", "value": 120000},
                        ],
                    },
                ],
                "supporting_claim_ids": [],
                "created_at": "2026-11-18T10:00:00Z",
            },
            {
                "deal_id": saved_deals[2]["id"],
                "deal_name": "Delhi NCR Consumer Electronics Wholesale",
                "competitors_involved": [secondary_rival],
                "threat_level": "High",
                "competitive_threat": "High",
                "customer_requirements": [
                    "Verified brand watermark badge",
                    "Automated counterfeit listing takedown guarantee",
                ],
                "primary_objections": [
                    {"objection": "Amazon FBA automated counterfeit image detection protects certified distributors", "competitor": secondary_rival},
                ],
                "customer_objections": [
                    "Amazon FBA automated counterfeit image detection protects certified distributors",
                ],
                "product_gaps": [{"gap": "Automated supplier brand certificate verification workflow", "competitor": secondary_rival}],
                "competitive_advantages": [
                    {"advantage": "Significantly lower fixed closing fees on electronics accessories", "competitor": secondary_rival},
                ],
                "recommended_sales_response": {
                    "strategy": "Counter Amazon Brand Registry Advantage",
                    "playbook_scripts": [
                        {
                            "competitor": secondary_rival,
                            "buyer_objection_scenario": "Amazon Brand Registry Counterfeit Protection",
                            "recommended_rebuttal": "Deploy verified manufacturer watermark badge on catalog listings and provide 48h takedown SLA.",
                            "action_guide": "Provide legal takedown SLA under 48 hours for trademark holders.",
                        },
                    ],
                },
                "recommended_sales_responses": [
                    {
                        "competitor": secondary_rival,
                        "buyer_objection_scenario": "Amazon Brand Registry Counterfeit Protection",
                        "recommended_rebuttal": "Deploy verified manufacturer watermark badge on catalog listings and provide 48h takedown SLA.",
                        "action_guide": "Provide legal takedown SLA under 48 hours for trademark holders.",
                    },
                ],
                "historical_proof_points": [
                    {
                        "competitor": secondary_rival,
                        "historical_deals_count": 2,
                        "sample_size": 2,
                        "wins_against": 1,
                        "won_deals": 1,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Simpler Catalog Onboarding"],
                        "loss_factors": ["Amazon FBA Brand Registry"],
                        "has_sufficient_data": True,
                        "data_note": "Evaluated against Amazon India across 2 wholesale distributor bids.",
                        "recent_deals": [
                            {"deal_name": "Delhi NCR Electronics Wholesale", "outcome": "lost", "value": 210000},
                            {"deal_name": "Kolkata Leather Goods Manufacturer Hub", "outcome": "won", "value": 160000},
                        ],
                    },
                ],
                "relevant_historical_wins_losses": [
                    {
                        "competitor": secondary_rival,
                        "historical_deals_count": 2,
                        "sample_size": 2,
                        "wins_against": 1,
                        "won_deals": 1,
                        "losses_against": 1,
                        "lost_deals": 1,
                        "winning_factors": ["Simpler Catalog Onboarding"],
                        "loss_factors": ["Amazon FBA Brand Registry"],
                        "has_sufficient_data": True,
                        "data_note": "Evaluated against Amazon India across 2 wholesale distributor bids.",
                        "recent_deals": [
                            {"deal_name": "Delhi NCR Electronics Wholesale", "outcome": "lost", "value": 210000},
                            {"deal_name": "Kolkata Leather Goods Manufacturer Hub", "outcome": "won", "value": 160000},
                        ],
                    },
                ],
                "supporting_claim_ids": [],
                "created_at": "2026-11-18T10:00:00Z",
            },
        ]

    for dos in dossiers_raw:
        batch2_storage.save_deal_dossier(dos, tid)

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
                "related_deal_id": saved_deals[0]["id"],
                "supporting_evidence": [
                    {"type": "win_loss_deal", "name": "Global FinTech Tier-1 Azure Migration", "id": saved_deals[0]["id"]},
                    {"type": "customer_quote", "source": "Customer Review", "quote": "AWS inter-region data egress fees make multi-region failover cost-prohibitive."},
                    {"type": "battlecard", "name": f"{primary_rival} Enterprise Battlecard"},
                ],
            },
            {
                "team": "Product",
                "affected_team": "product",
                "category": "feature_gap",
                "title": "Accelerate Dedicated Kernel-Bypass Direct Connect for Ultra-Low Latency Inference",
                "what_happened": f"Deal 'High-Frequency Trading Platform' lost to {primary_rival} due to lack of sub-millisecond on-prem direct connection.",
                "why_it_matters": "Wall Street and Tier-1 algorithmic funds mandate sub-millisecond deterministic latency.",
                "recommended_action": "Prioritize direct kernel-bypass networking in Azure HPC compute roadmap for Q4.",
                "urgency": "High",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "related_deal_id": saved_deals[2]["id"],
                "supporting_evidence": [
                    {"type": "win_loss_factor", "factor": "Sub-millisecond Ultra-Low Latency Direct Connect"},
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
                    {"type": "win_loss_deal", "name": "Retail E-Commerce Assistant", "outcome": "won"},
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
                "what_happened": f"3 regional distributor deals lost to {primary_rival} citing delivery transit speed, supported by 54 customer complaints on courier delays.",
                "why_it_matters": "$345,000 in active pipeline currently at risk across North and West regional textile clusters.",
                "recommended_action": f"Arm reps with the new 3PL Express SLA comparison sheet and counter-positioning playbook highlighting 0% commission savings offsetting freight costs.",
                "urgency": "Critical",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "related_deal_id": saved_deals[1]["id"],
                "supporting_evidence": [
                    {"type": "lost_deal", "name": "Jaipur Handloom Regional Distribution", "value": "$85,000"},
                    {"type": "customer_theme", "name": "Logistics SLA & 48h Transit Guarantee", "sample_size": 138},
                    {"type": "battlecard", "name": f"{primary_rival} Competitive Battlecard", "section": "Where We Lose"},
                ],
            },
            {
                "team": "Product",
                "affected_team": "product",
                "category": "feature_gap",
                "title": "Automate Non-Delivery Report (NDR) IVR/WhatsApp Calling to Reduce RTO by 14%",
                "what_happened": f"RTO return penalties identified as #1 pricing complaint in seller voice, and direct loss factor in the Jaipur Handloom deal.",
                "why_it_matters": "Reducing RTO return rates by 3% increases seller net profitability by 8%, completely neutralizing competitor fulfillment badges.",
                "recommended_action": "Fast-track sprint for automated WhatsApp address verification and IVR re-confirmation prior to courier dispatch.",
                "urgency": "High",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "related_deal_id": saved_deals[1]["id"],
                "supporting_evidence": [
                    {"type": "complaint", "quote": "Zero commission model is great, but return shipping charges (RTO penalties) eat into SMB margins."},
                    {"type": "buyer_objection", "objection": "RTO penalty charges too volatile without automated NDR management"},
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
                    {"type": "won_deal", "name": "Tirupur Garments Export Surplus Network", "value": "$135,000"},
                ],
            },
            {
                "team": "Leadership",
                "affected_team": "leadership",
                "category": "strategic_opportunity",
                "title": "Establish Strategic Regional 3PL Volume Partnership with Shadowfax / Delhivery",
                "what_happened": f"Logistics transit gap identified as single common denominator across 67% of lost enterprise deals against {primary_rival} and {secondary_rival}.",
                "why_it_matters": "Securing priority surface line-haul transit guarantees 72h fulfillment across 18,000 Tier-2/3 pin codes.",
                "recommended_action": "Authorize executive team to negotiate a master logistics SLA with committed daily parcel minimums in exchange for dedicated express hub routing.",
                "urgency": "Critical",
                "confidence": "High",
                "status": "pending",
                "related_competitor": primary_rival,
                "supporting_evidence": [
                    {"type": "analytics", "metric": "Win rate drops to 38% against Flipkart when logistics SLA is raised by buyer"},
                ],
            },
            {
                "team": "Sales",
                "affected_team": "sales",
                "category": "enablement",
                "title": "Regional Language Supplier Portal Walkthrough Certification",
                "what_happened": "Won Surat Textile Consortium ($120k) and Ludhiana Knitwear ($95k) primarily on Hindi/Gujarati onboarding ease.",
                "why_it_matters": "Tier-3 manufacturers reject complex English-only ERP integrations.",
                "recommended_action": "Publish vernacular onboarding video guides and certify all North/West field reps.",
                "urgency": "Medium",
                "confidence": "High",
                "status": "completed",
                "related_competitor": tertiary_rival,
                "supporting_evidence": [
                    {"type": "won_deal", "name": "Surat Textile Consortium", "factor": "Regional Language App Support"},
                ],
            },
        ]

    for act in actions_raw:
        batch2_storage.save_next_best_action(act, tid)

    return {
        "deals": len(deals_raw),
        "actions": len(actions_raw),
        "feedback": len(feedback_raw),
    }
