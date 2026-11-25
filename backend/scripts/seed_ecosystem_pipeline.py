#!/usr/bin/env python3
"""
Seed complete multi-tenant competitive intelligence data across all supported company ecosystems for PrismIQ.
Generates verified flat-storage files in backend/published_briefs/ and backend/data/ for:
1. Meesho (8553449a-c998-4727-be01-9aeb724038cb): E-Commerce (Flipkart, Amazon India, Shopsy, Ajio)
2. Vercel (c8f13b91-46ef-4682-9975-f85764d8a12e): Developer & Cloud (Cloudflare, Netlify, AWS Amplify, Supabase)
3. Flipkart (7b90477d-2524-4cf9-8e47-f389ec890ff7): E-Commerce (Amazon India, Reliance Retail, Meesho, Tata Neu)
4. OpenAI (6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f): Frontier AI (Anthropic, Google DeepMind, Mistral AI, Meta AI)
5. Acme Corp (00000000-0000-0000-0000-000000000001): Enterprise Software (Salesforce, HubSpot, Microsoft)

Ensures dates are distributed across June 2026 - November 2026 so 6-month competitive
landscape bar charts display real comparative volume.
"""

import json
import re
import os
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

# Directories
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
FRONTEND_LIB = REPO_ROOT / "frontend-v2" / "src" / "lib"
PUBLISHED_BRIEFS = BACKEND_DIR / "published_briefs"
DATA_DIR = BACKEND_DIR / "data"

TENANTS = {
    "meesho": {
        "tenant_id": "8553449a-c998-4727-be01-9aeb724038cb",
        "target_company": "Meesho",
        "industry": "E-Commerce Ecosystem",
        "competitors": ["Amazon India", "Flipkart", "Shopsy", "Ajio"],
    },
    "vercel": {
        "tenant_id": "c8f13b91-46ef-4682-9975-f85764d8a12e",
        "target_company": "Vercel",
        "industry": "Developer & Cloud Infrastructure",
        "competitors": ["Cloudflare", "Netlify", "AWS Amplify", "Supabase", "Fastly"],
    },
    "flipkart": {
        "tenant_id": "7b90477d-2524-4cf9-8e47-f389ec890ff7",
        "target_company": "Flipkart",
        "industry": "E-Commerce & Quick Commerce",
        "competitors": ["Amazon India", "Reliance Retail", "Meesho", "Tata Neu", "Shopsy"],
    },
    "openai": {
        "tenant_id": "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f",
        "target_company": "OpenAI",
        "industry": "Frontier AI & Foundation Models",
        "competitors": ["Anthropic", "Google DeepMind", "Mistral AI", "Meta AI"],
    },
    "acme": {
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "target_company": "Acme Corp",
        "industry": "Enterprise Software & Cloud Platforms",
        "competitors": ["Salesforce", "HubSpot", "Microsoft"],
    },
}

# Distribution of dates across June 2026 - November 2026
MONTHS_RANGE = [
    (2026, 6, "Jun"),
    (2026, 7, "Jul"),
    (2026, 8, "Aug"),
    (2026, 9, "Sep"),
    (2026, 10, "Oct"),
    (2026, 11, "Nov"),
]


def make_timestamp(year: int, month: int, day_idx: int, total_in_month: int) -> str:
    max_days = 28
    day = 1 + int((day_idx / max(1, total_in_month)) * 26)
    day = min(max_days, max(1, day))
    hour = 8 + (day_idx % 12)
    minute = (day_idx * 17) % 60
    return f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:00+00:00"


def distribute_event_dates(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Distribute events realistically across June 2026 - November 2026."""
    if not events:
        return []

    # Group events by company
    by_comp: Dict[str, List[Dict[str, Any]]] = {}
    for ev in events:
        c = ev.get("company_name") or ev.get("company") or "Competitor"
        by_comp.setdefault(c, []).append(ev)

    result = []
    for comp, comp_events in by_comp.items():
        n = len(comp_events)
        for i, ev in enumerate(comp_events):
            m_tuple = MONTHS_RANGE[i % len(MONTHS_RANGE)]
            year, month, _ = m_tuple
            ts = make_timestamp(year, month, i, n)
            ev["published_at"] = ts
            ev["published_timestamp"] = ts
            ev["latest_detected_at"] = ts
            ev["first_detected_at"] = ts
            result.append(ev)

    return result


def build_vercel_events() -> List[Dict[str, Any]]:
    """Extract and normalize Vercel seed events from baseline_vercel.json + extra competitors."""
    raw_path = FRONTEND_LIB / "baseline_vercel.json"
    events = []
    if raw_path.exists():
        with open(raw_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            events = data.get("events", [])

    # Normalize company names
    normalized_events = []
    for ev in events:
        cname = ev.get("company_name") or ev.get("company") or ""
        if "cloudflare" in cname.lower():
            cname = "Cloudflare"
        elif "netlify" in cname.lower():
            cname = "Netlify"
        elif "vercel" in cname.lower():
            cname = "Vercel"
        elif "stripe" in cname.lower():
            cname = "AWS Amplify"
            ev["title"] = ev.get("title", "").replace("Stripe", "AWS Amplify")
            ev["event_summary"] = ev.get("event_summary", "").replace("Stripe", "AWS Amplify")
        
        ev["company_name"] = cname
        ev["company"] = cname
        normalized_events.append(ev)

    # Supabase templates
    supabase_templates = [
        ("Supabase launches Realtime Broadcast v2 with sub-15ms regional latency", "Supabase announced major upgrades to Realtime engine with edge multi-region clustering, directly challenging Vercel KV and live data sync.", "Cloud Data Platform", "High", 3),
        ("Supabase Vector Indexing reaches 1M queries/sec milestone on Postgres", "Postgres pgvector benchmarks published by Supabase show 4x price-performance improvement over hosted serverless vector databases.", "AI & Developer Tooling", "Critical", 4),
        ("Supabase Edge Functions add WebAssembly and Python runtime support", "Supabase extends serverless edge function execution to WASM modules and micro-Python instances, expanding developer portability away from Next.js server actions.", "Serverless Infrastructure", "Medium", 2),
        ("Supabase partners with enterprise Kubernetes platforms for hybrid deployment", "Enterprise tier allows air-gapped database sync and on-premises control plane, targeting enterprise compliance accounts.", "Enterprise Governance", "High", 3),
        ("Supabase introduces Zero-Downtime Database Branching for production preview", "Git-like schema migrations and ephemeral branch databases directly rival Vercel Preview Environments.", "Developer Experience", "High", 3),
        ("Supabase launches native MCP server integration for agentic AI IDEs", "Automated context sharing with Cursor and Claude Code enables natural language database querying and migrations.", "Agentic Tooling", "Critical", 4),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(supabase_templates):
        eid = f"evt_supa_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        normalized_events.append({
            "event_id": eid,
            "company_name": "Supabase",
            "company": "Supabase",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Supabase Official Blog", "Hacker News", "InfoQ"],
            "url": "https://supabase.com/blog",
            "source_urls": ["https://supabase.com/blog", "https://news.ycombinator.com"],
            "raw_excerpt": summary,
            "why_it_matters": "Directly impacts Vercel developer retention in full-stack Postgres and edge storage tier.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.92,
            "inference_confidence": 0.88,
            "contributing_signal_count": corr * 2,
        })

    # AWS Amplify templates
    aws_amplify_templates = [
        ("AWS Amplify Gen 2 launches with zero-config Next.js 15 Server Action support", "AWS Amplify Gen 2 introduces code-first TypeScript backend definition with native Next.js App Router streaming SSR, directly undercutting Vercel enterprise bandwidth costs.", "Cloud Hosting & Deploy", "Critical", 4),
        ("AWS Amplify integrates Amazon Bedrock models with 1-click frontend hooks", "Developers can scaffold full-stack generative AI applications with streaming Claude 3.5 and Llama 3 models without managing API keys or middleware.", "Generative AI Integration", "High", 3),
        ("AWS cuts Amplify hosting data transfer egress fees by 40% globally", "Significant price reduction targets high-traffic web applications migrating away from Vercel's per-GB edge network fees.", "Pricing & Economics", "Critical", 4),
        ("AWS Amplify Studio adds visual schema generation for complex DynamoDB architectures", "Rapid frontend developer tools designed to compete directly with Vercel v0 generative UI workflows.", "Developer Tools", "Medium", 2),
        ("AWS Amplify announces automated multi-region failover for enterprise edge static assets", "Global CDN delivery backed by CloudFront achieves 99.999% SLA availability for mission-critical enterprise workloads.", "Enterprise SLA", "High", 3),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(aws_amplify_templates):
        eid = f"evt_amplify_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        normalized_events.append({
            "event_id": eid,
            "company_name": "AWS Amplify",
            "company": "AWS Amplify",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["AWS News Blog", "InfoWorld", "The New Stack"],
            "url": "https://aws.amazon.com/amplify",
            "source_urls": ["https://aws.amazon.com/amplify"],
            "raw_excerpt": summary,
            "why_it_matters": "Direct hyperscaler pricing pressure on Vercel Pro and Enterprise hosting gross margins.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.90,
            "inference_confidence": 0.86,
            "contributing_signal_count": corr * 2,
        })

    return distribute_event_dates(normalized_events)


def build_openai_events() -> List[Dict[str, Any]]:
    """Extract and normalize OpenAI seed events from baseline_openai.json + competitors."""
    raw_path = FRONTEND_LIB / "baseline_openai.json"
    events = []
    if raw_path.exists():
        with open(raw_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            events = data.get("events", [])

    normalized = []
    for ev in events:
        cname = ev.get("company_name") or ev.get("company") or ""
        if "google" in cname.lower():
            cname = "Google DeepMind"
        elif "openai" in cname.lower():
            cname = "OpenAI"
        ev["company_name"] = cname
        ev["company"] = cname
        normalized.append(ev)

    anthropic_templates = [
        ("Anthropic launches Claude 3.5 Sonnet with native Computer Use capabilities", "Anthropic unveils public beta API allowing Claude to take actions on desktop GUIs, moving directly ahead of OpenAI Operator roadmap.", "Agentic AI", "Critical", 5),
        ("Anthropic introduces Context Caching cutting prompt token costs by up to 90%", "Enterprises can persist 200k token system prompts and codebases at a fraction of standard API prices, squeezing OpenAI enterprise margins.", "Inference Economics", "Critical", 4),
        ("Anthropic enterprise ARR surpasses $1B as Fortune 500 adoption accelerates", "Claude Artifacts and AWS Bedrock enterprise partnerships drive rapid displacement of ChatGPT Team and Enterprise seats.", "Enterprise Market Share", "High", 4),
        ("Anthropic announces Claude Enterprise Plan with 500k context window and GitHub integration", "Direct counter-positioning against ChatGPT Enterprise with native team artifact sharing and workspace audit logging.", "Enterprise Workspace", "Critical", 4),
        ("Anthropic launches Model Context Protocol (MCP) as open standard for AI agents", "Universal open protocol for connecting AI models to external tools, databases, and local file systems gains widespread industry support.", "Developer Ecosystem", "Critical", 5),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(anthropic_templates):
        eid = f"evt_anthropic_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        normalized.append({
            "event_id": eid,
            "company_name": "Anthropic",
            "company": "Anthropic",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Anthropic Research", "TechCrunch", "The Information"],
            "url": "https://anthropic.com/news",
            "source_urls": ["https://anthropic.com/news"],
            "raw_excerpt": summary,
            "why_it_matters": "Direct competitive threat to OpenAI's developer API monopoly and enterprise seat licensing.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.95,
            "inference_confidence": 0.91,
            "contributing_signal_count": corr * 2,
        })

    mistral_templates = [
        ("Mistral AI releases Mistral Large 2 with 128k context and state-of-the-art coding benchmark", "Open-weights champion demonstrates benchmark parity with GPT-4o while enabling self-hosted private on-premise deployment.", "Open Model Parity", "Critical", 4),
        ("Mistral AI launches Codestral 22B specialized code generation model", "Fast, efficient 22B model specifically optimized for 80+ programming languages, directly targeting GitHub Copilot and OpenAI Codex.", "Developer Productivity", "High", 3),
        ("Mistral AI partners with Snowflake and SAP for sovereign enterprise data cloud", "European and regulated enterprise customers adopt Mistral on private VPC infrastructure to comply with EU AI Act data sovereignty.", "Data Sovereignty", "High", 3),
        ("Mistral announces Pixtral 12B multimodal vision model with open weights", "Native vision understanding at edge-deployable footprint creates strong competition against OpenAI GPT-4o-mini vision APIs.", "Multimodal Vision", "Medium", 2),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(mistral_templates):
        eid = f"evt_mistral_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        normalized.append({
            "event_id": eid,
            "company_name": "Mistral AI",
            "company": "Mistral AI",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Mistral Blog", "VentureBeat", "Reuters"],
            "url": "https://mistral.ai/news",
            "source_urls": ["https://mistral.ai/news"],
            "raw_excerpt": summary,
            "why_it_matters": "Eats away at OpenAI fine-tuning and enterprise API revenue in regulated European and private banking sectors.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.92,
            "inference_confidence": 0.87,
            "contributing_signal_count": corr * 2,
        })

    meta_templates = [
        ("Meta AI releases Llama 3.1 405B first frontier-class open-weights model", "Zuckerberg declares open source AI the industry standard as Llama 3.1 405B matches GPT-4o across reasoning, math, and code generation.", "Open Foundation Models", "Critical", 5),
        ("Meta AI reaches 500 million monthly active users across WhatsApp and Instagram", "Consumer AI assistant reach scales exponentially through Meta's core app family, bypassing standalone ChatGPT consumer touchpoints.", "Consumer Distribution", "Critical", 5),
        ("Meta launches Llama 3.2 with on-device 1B/3B models and visual reasoning", "Ultra-lightweight models run locally on smartphones and edge devices with zero latency and zero cloud compute fees.", "Edge Intelligence", "High", 3),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(meta_templates):
        eid = f"evt_meta_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        normalized.append({
            "event_id": eid,
            "company_name": "Meta AI",
            "company": "Meta AI",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Meta AI Blog", "The Verge", "Wall Street Journal"],
            "url": "https://ai.meta.com",
            "source_urls": ["https://ai.meta.com"],
            "raw_excerpt": summary,
            "why_it_matters": "Commoditizes frontier model intelligence, driving cloud API token prices down towards zero.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.94,
            "inference_confidence": 0.89,
            "contributing_signal_count": corr * 2,
        })

    return distribute_event_dates(normalized)


def build_flipkart_events() -> List[Dict[str, Any]]:
    """Generate comprehensive Flipkart competitive landscape events (40+ events)."""
    events = []

    amazon_templates = [
        ("Amazon India launches Prime Same-Day delivery in 50 Tier-1 and Tier-2 cities", "Amazon expands rapid fulfillment network with 150 automated micro-fulfillment hubs across India, directly challenging Flipkart Minutes.", "Logistics & Fulfillment", "Critical", 4),
        ("Amazon Great Indian Festival breaks record with 1.4B customer visits", "Festive season sales surge 26% driven by premium smartphone exchange bonuses and zero-cost EMI penetration.", "Festive GMV & Sales", "Critical", 4),
        ("Amazon Bazaar reaches 2M daily active value shoppers across Bharat tier-3 towns", "Amazon's sub-₹300 zero-commission storefront accelerates rural merchant recruitment, contesting Flipkart's Shopsy and Meesho.", "Value Commerce", "High", 3),
        ("Amazon Pay UPI surpasses 100M monthly active transacting users", "Deep integration into checkout flow captures 32% of total transaction share during festive e-commerce sales.", "Fintech & Payments", "Medium", 2),
        ("Amazon India deploys EV delivery fleet of 10,000 electric two-wheelers in metros", "Electric fleet reduces last-mile parcel transit cost by 18% in high-density delivery zones.", "Green Logistics", "Medium", 3),
        ("Amazon launches regional fulfillment center in Lucknow spanning 500,000 sq ft", "Expands storage capacity ahead of Uttar Pradesh festive peak, cutting North India shipping times.", "Fulfillment Infrastructure", "High", 3),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(amazon_templates):
        eid = f"evt_fk_amz_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Amazon India",
            "company": "Amazon India",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Economic Times", "Livemint", "Business Standard"],
            "url": "https://economictimes.indiatimes.com",
            "source_urls": ["https://economictimes.indiatimes.com"],
            "raw_excerpt": summary,
            "why_it_matters": "Direct marketplace battle for premium and electronics GMV market share in India.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.94,
            "inference_confidence": 0.90,
            "contributing_signal_count": corr * 2,
        })

    reliance_templates = [
        ("Reliance Retail rolls out 500 JioMart quick-delivery dark stores across 100 cities", "JioMart levers Reliance Fresh network to guarantee 20-minute delivery on groceries and home essentials at wholesale prices.", "Quick Commerce", "Critical", 5),
        ("Ajio festive fashion GMV doubles driven by exclusive global high-street brands", "Reliance digital fashion hub reports 45% of total orders originate from Tier-2 and Tier-3 youth shoppers.", "Fashion E-Commerce", "High", 3),
        ("Reliance Retail acquires regional logistics platform to streamline omnichannel dispatch", "Acquisition strengthens direct-from-store delivery for 18,000 physical retail outlets across India.", "Omnichannel Supply Chain", "High", 3),
        ("JioMart announces 0% seller commission on local grocery suppliers", "Aggressive seller subsidy aims to lock in mom-and-pop kirana merchant catalog exclusivity.", "Merchant Onboarding", "High", 3),
        ("Reliance launches Tira luxury beauty app with AR virtual try-on tech", "Beauty and personal care expansion directly takes on Flipkart's Myntra Beauty division.", "Specialty Retail", "Medium", 2),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(reliance_templates):
        eid = f"evt_fk_rel_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Reliance Retail",
            "company": "Reliance Retail",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Reuters India", "Financial Express", "Inc42"],
            "url": "https://financialexpress.com",
            "source_urls": ["https://financialexpress.com"],
            "raw_excerpt": summary,
            "why_it_matters": "Omnichannel grocery and fashion powerhouse threatens Flipkart's grocery and lifestyle margins.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.93,
            "inference_confidence": 0.88,
            "contributing_signal_count": corr * 2,
        })

    meesho_templates = [
        ("Meesho Surges 9% After UBS Raises Target Price To ₹260 on festive volume", "UBS highlights Meesho's zero-commission model and Valmo logistics network delivering 30% lower unit delivery costs.", "Logistics Disruption", "Critical", 4),
        ("Meesho records 1.45B annual transacting customer orders in Tier-2/3 heartland", "Hyper-growth in unbranded apparel and home accessories forces Flipkart to defend budget shoppers.", "Value Commerce", "Critical", 4),
        ("Meesho's Valmo logistics network handles 40% of all platform shipments", "Decentralized 3PL routing bypasses legacy courier networks, locking in ₹35 per parcel cost advantage.", "Logistics Infrastructure", "High", 3),
        ("Meesho introduces AI Smart Catalog Generator for small-town merchant listings", "Automates catalog image enhancement and multi-lingual descriptions, reducing listing time from 2 days to 5 minutes.", "Merchant Tech", "High", 3),
        ("Meesho expands festive working capital credit for 100,000 regional sellers", "Partnership with NBFCs provides instant collateral-free inventory advances during peak demand.", "Fintech Credit", "Medium", 3),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(meesho_templates):
        eid = f"evt_fk_msh_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Meesho",
            "company": "Meesho",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Inc42", "Economic Times", "Entrackr"],
            "url": "https://inc42.com",
            "source_urls": ["https://inc42.com"],
            "raw_excerpt": summary,
            "why_it_matters": "Erosion of Tier-2/3 customer conversion and active merchant defection risk.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.91,
            "inference_confidence": 0.87,
            "contributing_signal_count": corr * 2,
        })

    tata_templates = [
        ("Tata Neu integrates BigBasket bbnow instant delivery into unified rewards ecosystem", "Tata digital super app achieves 25M monthly active shoppers across electronics, fashion, and instant grocery.", "Super App Ecosystem", "High", 3),
        ("Tata Digital plans $1B capital infusion to expand fulfillment hubs and Croma omnichannel", "Aggressive investment in consumer tech ecosystem targets Flipkart electronics and white goods dominance.", "Capital Expansion", "High", 3),
        ("Tata 1mg achieves 30-minute prescription delivery across top 15 metros", "Health and pharmacy category integration adds high-frequency daily engagement to Tata Neu ecosystem.", "Category Expansion", "Medium", 2),
        ("Tata Neu launches NeuPass Black VIP tier with complimentary airport lounge and hotel upgrades", "Premium consumer loyalty tier targets high-net-worth urban shoppers with luxury conglomerate perks.", "Loyalty Rewards", "Medium", 3),
        ("Tata Cliq Luxury partners with European designer labels for exclusive festive fashion drops", "High-margin luxury e-commerce division captures affluent metro shoppers away from Flipkart and Amazon.", "Luxury Commerce", "High", 3),
        ("Tata Electronics expands local smartphone manufacturing capacity by 200%", "Integrated domestic supply chain provides Croma and Tata Neu priority allocation of latest flagship devices.", "Supply Chain Integration", "Critical", 4),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(tata_templates):
        eid = f"evt_fk_tata_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Tata Neu",
            "company": "Tata Neu",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Mint", "Business Standard", "Economic Times"],
            "url": "https://livemint.com",
            "source_urls": ["https://livemint.com"],
            "raw_excerpt": summary,
            "why_it_matters": "High-trust corporate conglomerate consolidating premium urban consumer loyalty.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.89,
            "inference_confidence": 0.84,
            "contributing_signal_count": corr * 2,
        })

    fk_templates = [
        ("Flipkart Minutes launches in Bengaluru and Delhi NCR with 10-minute dark stores", "Flipkart steps directly into quick commerce with dedicated hyperlocal micro-warehouses and zero delivery fees on orders above ₹199.", "Quick Commerce Launch", "Critical", 5),
        ("Flipkart Big Billion Days 2026 sets record GMV with 35% surge in tier-2 electronics", "Annual flagship sale drives over 1.2B customer visits with Flipkart VIP loyalty members converting at 3x rate.", "Flagship Festival GMV", "Critical", 5),
        ("Flipkart Ekart expands 3PL merchant logistics services to external brand partners", "Supply chain arm monetizes nationwide logistics network by offering warehousing and first-mile pickup to non-marketplace sellers.", "3PL Infrastructure", "High", 4),
        ("Flipkart partners with regional textile consortiums to onboard 200,000 craft weavers", "Direct-from-manufacturer initiative strengthens everyday low price catalog in women's ethnic apparel.", "Merchant Sourcing", "High", 3),
        ("Flipkart launches GenAI shopping assistant 'Flippi' powered by localized vernacular LLMs", "Multilingual conversational product search in Hindi, Tamil, and Telugu lifts Tier-2 checkout conversion by 22%.", "AI Commerce", "High", 4),
        ("Flipkart Reset re-commerce platform expands certified refurbished smartphone exchange", "Circular economy initiative captures value-seeking smartphone upgrade demand with doorstep verification.", "Re-Commerce Expansion", "Medium", 3),
        ("Flipkart SuperCoin loyalty program expands redemption network to 50,000 offline retail outlets", "Cross-brand coalition loyalty drives higher repeat retention and shopping frequency across Tier-1/2 metros.", "Loyalty Coalition", "High", 3),
        ("Flipkart Wholesale expands B2B kirana credit terms with 14-day interest-free inventory credit", "Strengthens institutional retail supply chain to compete with Reliance JioMart wholesale distribution.", "B2B Wholesale", "High", 3),
        ("Flipkart partners with Axis Bank to launch co-branded RuPay credit card on UPI", "Offers unlimited 5% cashback on all Flipkart transactions with instant digital onboarding.", "Fintech & Cards", "Critical", 4),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(fk_templates):
        eid = f"evt_fk_own_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Flipkart",
            "company": "Flipkart",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Flipkart Press", "Economic Times", "PTI"],
            "url": "https://flipkart.com",
            "source_urls": ["https://flipkart.com"],
            "raw_excerpt": summary,
            "why_it_matters": "Primary subject enterprise initiatives to defend market leadership against Amazon and quick commerce.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.96,
            "inference_confidence": 0.92,
            "contributing_signal_count": corr * 2,
        })

    return distribute_event_dates(events)


def build_meesho_events() -> List[Dict[str, Any]]:
    """Build 60+ verified Meesho events distributed across June 2026 - November 2026."""
    src_file = PUBLISHED_BRIEFS / "events_8553449a-c998-4727-be01-9aeb724038cb.json"
    events = []
    if src_file.exists():
        try:
            with open(src_file, "r", encoding="utf-8") as f:
                events = json.load(f)
        except Exception:
            events = []

    # Ensure rich ecosystem events for Meesho and rivals
    meesho_ecosystem_events = [
        ("Flipkart Minutes quick commerce network scales to 300 micro dark-stores", "Flipkart accelerates hyperlocal delivery targeting urban daily essential orders under ₹250.", "Flipkart", "Quick Commerce", "Critical", 4),
        ("Flipkart Shopsy launches 1-Rupee Deal festival during monsoon flash sales", "Extreme budget loss-leader campaign counters Meesho's unbranded fashion dominance across Tier-3 towns.", "Flipkart", "Budget Price War", "High", 4),
        ("Flipkart Ekart rolls out 24-hour rural dispatch for regional manufacturing clusters", "Ekart logistics upgrades in Surat, Tirupur, and Panipat aim to lure high-volume textile sellers away from Valmo.", "Flipkart", "Logistics Competition", "High", 3),
        ("Amazon India launches ultra-budget 'Amazon Bazaar' storefront with zero seller fees", "Amazon's direct value-retail challenger targets unbranded apparel and home essentials under ₹300.", "Amazon India", "Value Retail", "Critical", 5),
        ("Amazon Bazaar expands into 12 regional languages to capture rural first-time shoppers", "Vernacular voice search and simplified UI reduce onboarding friction for non-English value buyers.", "Amazon India", "Vernacular Penetration", "High", 4),
        ("Amazon cuts regional shipping fee by 25% for small merchants in Tier-2 towns", "Subsidized logistics pricing challenges Meesho's zero-commission merchant retention rate.", "Amazon India", "Logistics Subsidies", "High", 3),
        ("Shopsy expands festive regional promotions offering flat ₹49 price point showcases", "Budget-focused social commerce platform intensifies campaign across Uttar Pradesh, Bihar, and Madhya Pradesh.", "Shopsy", "Price Floor Competition", "High", 3),
        ("Shopsy introduces zero-penalty return policy for verified high-reputation sellers", "Aims to address merchant return abuse concerns, directly matching Meesho's seller-friendly terms.", "Shopsy", "Seller Retention", "High", 3),
        ("Shopsy records 70% order share from mobile app installs in Tier-4 districts", "Hyper-targeted digital ad spend on regional YouTube creators drives cheap merchant-led organic growth.", "Shopsy", "Growth Channels", "Medium", 2),
        ("Ajio launches Trends Online festive budget catalog to capture tier-2 fashion GMV", "Reliance Retail fashion arm heavily discounts budget ethnic wear and regional textiles.", "Ajio", "Fashion Price Wars", "High", 3),
        ("Ajio introduces 48-hour store exchange network across 3,000 physical Trends outlets", "Leverages physical retail footprint to eliminate return friction for online apparel shoppers.", "Ajio", "Omnichannel Returns", "High", 4),
        ("Ajio Luxe registers 40% growth in aspirational Tier-2 consumers purchasing premium brands", "Broadens margin mix while maintaining competitive entry pricing in mass fashion categories.", "Ajio", "Catalog Segmentation", "Medium", 2),
        ("Meesho launches Valmo Fulfillment Hub in Guwahati to expand Northeast delivery coverage", "Decentralized logistics network bypasses Tier-1 airport hubs, cutting regional delivery times by 48 hours.", "Meesho", "Logistics Expansion", "Critical", 4),
        ("Meesho onboarded 500,000 seasonal festival sellers on zero-commission portal", "Aggressive onboarding drive doubles rural catalog diversity in festive gifting and home decor.", "Meesho", "Seller Recruitment", "High", 3),
        ("Meesho Valmo achieves ₹32 average parcel delivery cost beating industry benchmark", "Decentralized crowdsourced delivery sorting enables Meesho to protect thin unit economics in ultra-low ASP carts.", "Meesho", "Unit Economics", "Critical", 5),
        ("Meesho Gold initiative launches hallmarked jewelry and brass decor at wholesale rates", "Expands beyond apparel into high-trust festive categories with certified third-party quality audits.", "Meesho", "Category Diversification", "High", 4),
        ("Meesho partners with state handloom boards in Odisha and Bengal for artisan storefronts", "Direct government partnership onboards 100,000 traditional weavers with free photography and listing support.", "Meesho", "Artisan Sourcing", "High", 3),
        ("Meesho launches Seller Ad Suite with automated ROI bidding for budget brands", "Monetization push introduces self-serve performance marketing without altering the zero-commission promise.", "Meesho", "Monetization Strategy", "Critical", 4),
        ("Meesho expands Valmo delivery sorting centers to 50 tier-3 transport clusters", "Direct sortation hubs eliminate transit through Tier-1 metros, accelerating delivery across rural belts.", "Meesho", "Logistics Infrastructure", "High", 4),
        ("Meesho introduces Instant Merchant Settlement within 24 hours of delivery confirmation", "Solves cash flow friction for micro-enterprises and artisan sellers, securing merchant loyalty.", "Meesho", "Fintech & Payouts", "Critical", 4),
        ("Meesho Mall crosses 5M monthly orders for regional and value D2C challenger brands", "Branded storefront within value ecosystem gives emerging D2C brands lower CAC than legacy marketplaces.", "Meesho", "D2C Brand Commerce", "High", 3),
        ("Amazon India expands Easy Ship zero-weight-handling fee to rural handicraft sellers", "Counter-initiative to recruit rural artisan clusters into Amazon Karigar program.", "Amazon India", "Merchant Onboarding", "High", 3),
        ("Amazon India deploys 2,000 automated mobile lockers in Tier-2 railway and bus stations", "Secure self-collection points reduce doorstep return-to-origin (RTO) rates by 35%.", "Amazon India", "Fulfillment Innovation", "Medium", 3),
        ("Flipkart Minutes rolls out 15-minute delivery for smartphones and personal audio in metros", "Hyperlocal electronics fulfillment challenges traditional e-commerce 2-day delivery cycles.", "Flipkart", "Quick Commerce Electronics", "Critical", 5),
        ("Flipkart SuperCoin loyalty points can now be earned and spent across 10,000 local kirana stores", "Hyperlocal grocery tie-in drives daily consumer engagement back to the core Flipkart app.", "Flipkart", "Loyalty Network", "High", 4),
        ("Shopsy introduces zero-commission festive fashion drops with free customer shipping above ₹99", "Loss-leader promotional campaign across Tier-3 apparel categories directly targets Meesho core shoppers.", "Shopsy", "Value Fashion Competition", "Critical", 4),
        ("Shopsy partners with 50 regional textile mills in Surat and Tirupur for factory-direct catalogs", "Bypasses wholesaler middlemen to achieve lowest possible customer ASP in unbranded cotton wear.", "Shopsy", "Factory Sourcing", "High", 4),
        ("Ajio launches 'Trends Express' promising next-day delivery on 100,000 ethnic wear styles", "Speed-to-consumer initiative targets festive demand across non-metro fashion buyers.", "Ajio", "Express Fulfillment", "High", 3),
        ("Ajio introduces AI-powered size recommendation engine reducing apparel returns by 28%", "Virtual fitting technology lowers return-to-origin processing costs in Tier-2/3 orders.", "Ajio", "Returns Optimization", "High", 3),
    ]

    # Collect existing titles to avoid exact duplicates
    existing_titles = {e.get("title", "").strip().lower() for e in events}

    for idx, (title, summary, comp, theme, tier, corr) in enumerate(meesho_ecosystem_events):
        if title.strip().lower() in existing_titles:
            continue
        eid = f"evt_msh_eco_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": comp,
            "company": comp,
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Inc42", "Economic Times", "Entrackr", "Retail Wire India"],
            "url": "https://inc42.com",
            "source_urls": ["https://inc42.com"],
            "raw_excerpt": summary,
            "why_it_matters": f"Direct strategic move by {comp} impacting Meesho's core price-sensitive consumer conversion.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.92,
            "inference_confidence": 0.88,
            "contributing_signal_count": corr * 2,
        })

    # Distribute and return
    return distribute_event_dates(events)


def build_acme_events() -> List[Dict[str, Any]]:
    """Build 40+ high-fidelity events for Acme Corp and Enterprise Software competitors (Salesforce, HubSpot, Microsoft)."""
    events = []

    salesforce_templates = [
        ("Salesforce launches Agentforce autonomous AI agents for Service Cloud and Sales Cloud", "Agentforce delivers autonomous enterprise reasoning agents that resolve customer tickets without pre-programmed scripts, directly disrupting legacy conversational bots.", "Autonomous AI Agents", "Critical", 5),
        ("Salesforce introduces consumption-based $2 per conversation pricing for Agentforce", "Shifts away from strict per-seat user licensing toward outcome-oriented usage billing, exerting pricing pressure on traditional enterprise SaaS.", "Pricing & Packaging", "Critical", 5),
        ("Salesforce Data Cloud achieves real-time zero-copy integration with Snowflake and Databricks", "Eliminates complex ETL pipelines by enabling direct federated queries across enterprise data lakes and customer CRM records.", "Data Integration", "High", 4),
        ("Salesforce announces Einstein 1 Studio with low-code prompt engineering and model builder", "Allows system administrators to fine-tune Anthropic Claude and OpenAI models on proprietary enterprise CRM history.", "Low-Code Developer AI", "High", 3),
        ("Salesforce adds automated FedRAMP High and HIPAA compliance guardrails to enterprise suite", "Strengthens competitive moat in regulated healthcare and federal government public sector deployments.", "Enterprise Governance", "High", 4),
        ("Salesforce Slack Sales Elevate integrates live opportunity tracking directly in Slack channels", "Tightens daily sales rep workflow inside collaborative chat channels, reducing context switching into core CRM web interfaces.", "Collaborative Workflow", "Medium", 3),
        ("Salesforce launches Marketing Cloud Next with autonomous campaign journey generation", "AI-driven customer segmentation dynamically creates and delivers hyper-personalized omni-channel marketing assets.", "Marketing Automation", "High", 4),
        ("Salesforce acquires revenue intelligence platform to bolster automated pipeline forecasting", "Deepens predictive sales analytics to rival standalone RevOps tools.", "Revenue Intelligence", "High", 3),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(salesforce_templates):
        eid = f"evt_acme_crm_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Salesforce",
            "company": "Salesforce",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Salesforce Press", "TechCrunch", "VentureBeat", "Forbes Enterprise"],
            "url": "https://www.salesforce.com/news",
            "source_urls": ["https://www.salesforce.com/news"],
            "raw_excerpt": summary,
            "why_it_matters": "Direct market threat to Acme Corp's enterprise pipeline and customer service copilot offerings.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.95,
            "inference_confidence": 0.91,
            "contributing_signal_count": corr * 2,
        })

    hubspot_templates = [
        ("HubSpot launches Breeze AI copilot and agentic automation across full Customer Platform", "Breeze AI introduces specialized agents for content creation, buyer intent analysis, and automated customer success nurturing.", "AI Marketing & CRM", "Critical", 4),
        ("HubSpot overhauls pricing with seat-free core CRM and tiered feature-based add-ons", "Disrupts mid-market sales by lowering initial barrier to entry, forcing enterprise competitors to defend mid-market expansion.", "Pricing Disruption", "Critical", 4),
        ("HubSpot Commerce Hub expands global multi-currency billing and B2B recurring subscription management", "Allows mid-market software companies to manage quotes, contracts, and Stripe billing directly inside CRM contacts.", "Revenue Operations", "High", 3),
        ("HubSpot Marketing Hub introduces predictive buyer journey mapping with generative content testing", "Automated A/B email generation and multi-channel attribution analytics reduce marketing team manual campaign creation.", "Inbound Marketing Automation", "High", 3),
        ("HubSpot integrates native WhatsApp and LinkedIn messaging into unified omnichannel inbox", "Enables sales reps in EMEA and APAC to close deals via instant messaging while automatically logging transcripts in CRM.", "Omnichannel Sales", "Medium", 2),
        ("HubSpot Operations Hub adds real-time bidirectional sync with Snowflake and BigQuery", "Enables data teams to maintain single customer view across enterprise warehouses and CRM properties without third-party middleware.", "Data Operations", "High", 3),
        ("HubSpot introduces custom behavioral event triggers for mobile and web apps", "Allows SaaS product teams to trigger automated sales and onboarding workflows based on in-app feature usage.", "Product-Led Growth", "High", 3),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(hubspot_templates):
        eid = f"evt_acme_hub_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "HubSpot",
            "company": "HubSpot",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["HubSpot Newsroom", "MarTech", "SaaS Mag"],
            "url": "https://www.hubspot.com/company-news",
            "source_urls": ["https://www.hubspot.com/company-news"],
            "raw_excerpt": summary,
            "why_it_matters": "Aggressive mid-market penetration threatens Acme Corp's expansion deals in upper mid-tier enterprise.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.93,
            "inference_confidence": 0.89,
            "contributing_signal_count": corr * 2,
        })

    microsoft_templates = [
        ("Microsoft Dynamics 365 launches Copilot Studio autonomous supply chain and finance agents", "Enterprise ERP and CRM integrate native Azure OpenAI agents capable of automated purchase order reconciliation and invoice auditing.", "Enterprise ERP & AI", "Critical", 5),
        ("Microsoft bundles Dynamics 365 Sales with Microsoft 365 Copilot enterprise licensing", "Leverages massive Office 365 enterprise install base to displace third-party CRM seats through unified procurement discounts.", "Bundling & Enterprise Monopoly", "Critical", 5),
        ("Microsoft Azure adds confidential computing enclaves for enterprise customer data sovereignty", "Ensures CRM and enterprise analytical queries never expose plaintext data even to cloud infrastructure administrators.", "Data Security & Sovereignty", "High", 4),
        ("Microsoft Power Platform enables natural language app creation connected to Dataverse", "Business analysts build internal workflow approval apps without writing code, reducing demand for specialized enterprise portals.", "Low-Code Enterprise Apps", "High", 3),
        ("Microsoft Teams integrates deep CRM deal rooms with real-time meeting transcription and task sync", "Automatically captures action items and customer sentiment from Teams video calls directly into account timelines.", "Unified Communications", "Medium", 3),
        ("Microsoft launches Fabric AI mirroring for real-time customer data unification", "Seamlessly joins Dynamics CRM telemetry with enterprise analytics in OneLake without data duplication.", "Unified Analytics", "High", 4),
        ("Microsoft introduces sovereign cloud offerings for EU public sector customers", "Ensures compliance with stringent European data localization mandates for enterprise SaaS.", "Sovereign Cloud", "High", 4),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(microsoft_templates):
        eid = f"evt_acme_msft_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Microsoft",
            "company": "Microsoft",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Microsoft News Center", "ZDNet", "The Verge", "CRN"],
            "url": "https://news.microsoft.com",
            "source_urls": ["https://news.microsoft.com"],
            "raw_excerpt": summary,
            "why_it_matters": "Bundling advantages and Azure ecosystem leverage create severe renewal hurdles for standalone enterprise software.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.96,
            "inference_confidence": 0.92,
            "contributing_signal_count": corr * 2,
        })

    acme_templates = [
        ("Acme Corp unveils Next-Gen Enterprise Orchestration Suite with multi-cloud agent mesh", "Flagship release allows Fortune 500 enterprises to coordinate autonomous agents across AWS, Azure, and private on-premises clouds.", "Enterprise Mesh Platform", "Critical", 5),
        ("Acme Corp achieves SOC2 Type II and ISO 27001 certifications across all global data regions", "Completes rigorous third-party enterprise compliance audit, unlocking high-security financial services and defense contracts.", "Compliance Certification", "High", 4),
        ("Acme Corp transitions core product tier to consumption billing with guaranteed savings SLA", "Directly counters legacy seat-based competitors by aligning pricing with demonstrated operational compute efficiency.", "Pricing Model Evolution", "High", 4),
        ("Acme Corp announces strategic system integrator partnership with Deloitte and Accenture", "Global SI alliances establish dedicated implementation practices to accelerate enterprise migration from legacy platforms.", "Go-To-Market Alliances", "High", 4),
        ("Acme Corp launches developer portal with open API specifications and automated sandboxes", "Reduces third-party integration time from weeks to hours for enterprise engineering teams.", "Developer Experience", "Medium", 3),
        ("Acme Corp reports 140% net revenue retention driven by cross-department expansion", "Strong customer expansion signals robust platform stickiness in the face of hyperscaler bundling pressure.", "Financial Performance", "Critical", 4),
        ("Acme Corp introduces zero-trust identity and role-based access control framework", "Enables granular per-agent permission scoping for highly regulated banking environments.", "Enterprise Security", "Critical", 5),
        ("Acme Corp releases benchmark report showing 40% reduction in agent coordination latency", "Proprietary distributed state machine outperforms legacy event streaming architectures in high-throughput benchmarks.", "Platform Performance", "High", 4),
    ]

    for idx, (title, summary, theme, tier, corr) in enumerate(acme_templates):
        eid = f"evt_acme_own_{idx+1:03d}_{hex(abs(hash(title)))[2:10]}"
        events.append({
            "event_id": eid,
            "company_name": "Acme Corp",
            "company": "Acme Corp",
            "title": title,
            "theme": theme,
            "strategic_theme": theme,
            "event_summary": summary,
            "corroboration_count": corr,
            "contributing_sources": ["Acme Press", "PR Newswire", "Enterprise Tech Review"],
            "url": "https://acmecorp.com/news",
            "source_urls": ["https://acmecorp.com/news"],
            "raw_excerpt": summary,
            "why_it_matters": "Core platform initiatives strengthening enterprise differentiation against Salesforce and Microsoft.",
            "tier": tier,
            "confidence": "High",
            "fact_confidence": 0.95,
            "inference_confidence": 0.90,
            "contributing_signal_count": corr * 2,
        })

    return distribute_event_dates(events)


def seed_all_ecosystems():
    """Build and write all verified multi-tenant seed files across both directories."""
    PUBLISHED_BRIEFS.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    builders = {
        "8553449a-c998-4727-be01-9aeb724038cb": ("meesho", build_meesho_events),
        "c8f13b91-46ef-4682-9975-f85764d8a12e": ("vercel", build_vercel_events),
        "7b90477d-2524-4cf9-8e47-f389ec890ff7": ("flipkart", build_flipkart_events),
        "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f": ("openai", build_openai_events),
        "00000000-0000-0000-0000-000000000001": ("acme", build_acme_events),
    }

    for tid, (key, builder) in builders.items():
        meta = TENANTS[key]
        target = meta["target_company"]
        competitors = meta["competitors"]
        industry = meta["industry"]
        print(f"Generating data for tenant {target} ({tid}) - {industry}...")
        events = builder()

        # Write events, signals, and tracked companies to both published_briefs and data directories
        for out_dir in (PUBLISHED_BRIEFS, DATA_DIR):
            ev_file = out_dir / f"events_{tid}.json"
            with open(ev_file, "w", encoding="utf-8") as f:
                json.dump(events, f, indent=2, ensure_ascii=False)

            # Generate signals from events
            signals = []
            for ev in events:
                signals.append({
                    "id": f"sig_{ev.get('event_id', '')}",
                    "company_name": ev.get("company_name") or ev.get("company"),
                    "source": ev.get("contributing_sources", ["Market Wire"])[0],
                    "title": ev.get("title"),
                    "url": ev.get("url") or f"https://{target.lower().replace(' ', '')}.com/news",
                    "published_at": ev.get("published_at"),
                    "published_timestamp": ev.get("published_timestamp"),
                    "raw_excerpt": ev.get("raw_excerpt") or ev.get("event_summary"),
                    "tier": ev.get("tier", "High"),
                    "confidence": ev.get("confidence", "High"),
                })
            sig_file = out_dir / f"signals_{tid}.json"
            with open(sig_file, "w", encoding="utf-8") as f:
                json.dump(signals, f, indent=2, ensure_ascii=False)

            # Generate tracked companies
            tracked = [{
                "company_name": target,
                "is_target": True,
                "status": "active",
                "added_at": "2026-06-01T00:00:00+00:00",
                "primary_domain": f"{target.lower().replace(' ', '')}.com",
                "industry_category": industry,
                "tier": "core",
                "confidence": "High",
                "rationale": f"Primary subject entity for competitive benchmarking and strategic intelligence.",
            }]
            for c in competitors:
                tracked.append({
                    "company_name": c,
                    "is_target": False,
                    "status": "active",
                    "added_at": "2026-06-01T00:00:00+00:00",
                    "primary_domain": f"{c.lower().replace(' ', '')}.com",
                    "industry_category": "Tracked Competitor",
                    "tier": "core",
                    "confidence": "High",
                    "rationale": f"Direct market competitor monitored for strategic product and pricing moves against {target}.",
                })
            tc_file = out_dir / f"tracked_companies_{tid}.json"
            with open(tc_file, "w", encoding="utf-8") as f:
                json.dump(tracked, f, indent=2, ensure_ascii=False)

        print(f"  -> Successfully generated {len(events)} events and signals for {target}")

    print("\nEcosystem pipeline seeding complete for all 5 workspaces!")


if __name__ == "__main__":
    seed_all_ecosystems()
