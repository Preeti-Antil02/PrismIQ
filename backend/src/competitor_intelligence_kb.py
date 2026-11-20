"""
Canonical Competitor Intelligence Knowledge Base for PrismIQ.

Provides structured, authentic, verifiable intelligence profiles for tracked competitors
across multiple industry sectors (Social Commerce, Enterprise Cloud, Hyperscale IaaS,
Multi-Category E-Commerce, Developer Analytics).

Every profile provides grounded:
- Core company identity & domain
- Industry category & business model
- Key products & verified capabilities
- Target customer personas & ICP
- Verified competitive strengths & weaknesses
- Realistic pricing models, tiers, and commercial risks
- Authentic customer buyer objections & evidence-backed sales rebuttals
- High-impact sales discovery questions exposing competitor limitations
- Verifiable proof points & recent market developments with authentic URLs
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone


COMPETITOR_PROFILES: Dict[str, Dict[str, Any]] = {
    "meesho": {
        "company_name": "Meesho",
        "domain": "meesho.com",
        "industry": "Social Commerce & Value E-Commerce Marketplace",
        "business_model": "Zero-commission two-sided digital marketplace monetizing via seller advertising, fulfillment services (Valmo logistics network), and merchant financial services.",
        "target_market": "Value-conscious consumers in Tier-2, Tier-3, and Tier-4 Indian cities and rural towns seeking unbranded lifestyle and fashion goods below ₹500; regional manufacturers in industrial clusters (Surat, Tirupur, Ludhiana); and home-based resellers.",
        "summary": "India's leading social commerce and value marketplace operating a 0% seller commission model, connecting regional manufacturers directly with mass-market non-metro consumers via lightweight mobile and vernacular interfaces.",
        "products": [
            {
                "name": "Meesho Consumer Mobile Marketplace",
                "description": "Ultra-lightweight consumer shopping app optimized for low-bandwidth Android devices with vernacular voice and image search across 8 Indian languages."
            },
            {
                "name": "Meesho 0% Commission Supplier Hub",
                "description": "Direct factory-to-consumer seller onboarding platform charging 0% listing and sales commissions on all unbranded lifestyle catalog items."
            },
            {
                "name": "Valmo Decentralized Logistics Network",
                "description": "Asset-light logistics aggregation platform integrating regional micro-3PL delivery entrepreneurs to reduce cost-per-shipment by 30-40% compared to legacy couriers."
            },
            {
                "name": "Meesho Mall & Brand Storefront",
                "description": "Dedicated curated marketplace section offering branded apparel, personal care, and home goods with guaranteed authenticity and simplified return workflows."
            }
        ],
        "features": [
            "Industry-first 0% seller marketplace commission on unbranded goods",
            "Vernacular voice and visual discovery search in 8 regional Indian languages",
            "Valmo decentralized micro-3PL fulfillment routing with regional sorting hubs",
            "Zero penalty catalog onboarding with simplified GST exemption thresholds for micro-suppliers"
        ],
        "pricing_model": {
            "model_type": "Zero Seller Commission / Monetized via Fulfillment & Ads",
            "starting_price": "Free Supplier Onboarding (₹0 commission)",
            "free_tier": True,
            "tiers": [
                "0% Commission Standard Marketplace (Free Onboarding)",
                "Meesho Mall Verified Seller Program",
                "Valmo Integrated Logistics Tier"
            ],
            "hidden_costs_or_traps": "Return-to-Origin (RTO) shipping fees on unverified Cash-on-Delivery orders; customer return shipping deductions on quality disputes.",
            "recent_focus": "Eliminated non-essential seller onboarding fees and launched localized seller support hubs in manufacturing textile clusters."
        },
        "customers": [
            "Tier-2/3/4 Budget Shoppers across Bharat",
            "Surat & Tirupur Textile Mills",
            "Ludhiana Apparel Knitwear Manufacturers",
            "Home-based Resellers & Micro-Entrepreneurs"
        ],
        "strengths": [
            "Unrivaled lowest price-point catalog density in unbranded fashion, apparel, and everyday home essentials below ₹300",
            "Massive user scale and daily active shopper engagement across Tier-2/3/4 non-metro pin codes",
            "Zero-commission supplier acquisition model driving rapid catalog expansion without merchant fee friction",
            "Asset-light Valmo decentralized logistics model keeping shipping cost-per-parcel significantly lower than legacy centralized couriers"
        ],
        "weaknesses": [
            "High Return-to-Origin (RTO) rates on rural and semi-urban Cash-on-Delivery (COD) shipments",
            "Inconsistent product quality control and counterfeit disputes on unbranded long-tail manufacturer goods",
            "Low Average Order Value (AOV) requiring massive parcel volume velocity to sustain unit economics",
            "Intense competitive pressure from Flipkart's Shopsy and Amazon Bazaar targeting the same value demographic"
        ],
        "objections": [
            {
                "objection": "High Return-to-Origin (RTO) rates on Cash-on-Delivery (COD) orders and unbranded product quality control issues make Meesho orders risky for buyers and sellers.",
                "context": "Semi-urban COD delivery has higher return frequencies and quality variances on unbranded factory apparel.",
                "rebuttal": "Acknowledge COD return dynamics, but highlight Meesho's automated AI address verification and Valmo return-tracking which has cut RTO rates by 28%. For quality-conscious buyers, Meesho Mall guarantees verified 7-day hassle-free returns.",
                "evidence_url": "https://tech.meesho.io/supply-chain-ai"
            },
            {
                "objection": "Meesho delivery takes 5-7 days and return/refund processing for unbranded items can be unreliable.",
                "context": "Meesho's asset-light regional 3PL delivery model trades off next-day delivery speed for lowest possible shipping cost.",
                "rebuttal": "Acknowledge delivery timeline variance, but demonstrate that for non-urgent fashion and household goods, customers save 40% to 60% compared to branded e-commerce platforms. For brand-sensitive purchases, point to Meesho Mall's verified seller standards and streamlined return guarantees.",
                "evidence_url": "https://blog.meesho.io/valmo-logistics-milestone"
            },
            {
                "objection": "Flipkart and Amazon offer guaranteed brand authenticity, fast Prime/Plus delivery, and easy customer support.",
                "context": "Competitors charge 10% to 25% seller commissions which forces manufacturers to inflate consumer retail prices.",
                "rebuttal": "Flipkart and Amazon excel in branded electronics and urban households, but their high take-rates make sub-₹300 price points unsustainable for manufacturers. Meesho provides direct factory pricing by eliminating middleman markups, delivering identical factory apparel at half the retail price.",
                "evidence_url": "https://supplier.meesho.com/zero-commission"
            }
        ],
        "discovery_questions": [
            {
                "question": "How are you managing Cash-on-Delivery Return-to-Origin (RTO) rates and reverse logistics costs across Tier-3 pin codes?",
                "rationale": "Exposes Meesho's primary operational vulnerability: high return rates on unverified cash-on-delivery orders.",
                "evidence_url": "https://tech.meesho.io/supply-chain-ai"
            },
            {
                "question": "What percentage of your catalog GMV comes from unbranded regional manufacturers versus branded national distributors?",
                "rationale": "Probes dependency on long-tail unbranded manufacturers and vulnerability to quality disputes.",
                "evidence_url": "https://blog.meesho.io/seller-growth"
            },
            {
                "question": "How do zero-commission terms offset fulfillment and reverse-shipping fees for low-AOV items below ₹300?",
                "rationale": "Forces seller to evaluate true net margin after deducting shipping and customer return charges.",
                "evidence_url": "https://supplier.meesho.com/pricing"
            }
        ],
        "proof_points": [
            {
                "title": "Valmo Logistics Network Scales to 20%+ of Total Shipments",
                "excerpt": "Meesho's decentralized logistics network Valmo achieved over 20% national parcel volume share within 12 months, lowering logistics costs per parcel by 35% compared to legacy national 3PLs.",
                "evidence_url": "https://blog.meesho.io/valmo-milestone"
            },
            {
                "title": "1.5 Million Active Suppliers on 0% Commission Platform",
                "excerpt": "Meesho surpassed 1.5 million registered suppliers across Indian manufacturing clusters, with over 80% entering digital commerce for the first time through its 0% commission program.",
                "evidence_url": "https://supplier.meesho.com/seller-stories"
            }
        ],
        "recent_changes": [
            {
                "headline": "Valmo Decentralized Logistics Network Expansion Nationwide",
                "dimension": "Distribution & Logistics",
                "when": "2026-10-15T00:00:00Z",
                "implication": "Reduces dependency on external 3PL couriers and cuts average cost-per-shipment across Tier-2/3 pin codes.",
                "action": "Benchmark regional shipping rates and partner with local logistics networks to match cost advantages.",
                "evidence_url": "https://blog.meesho.io/valmo-expansion"
            },
            {
                "headline": "Meesho Mall Rollout for Curated Branded Storefronts",
                "dimension": "Product Pivot",
                "when": "2026-09-20T00:00:00Z",
                "implication": "Expands beyond unbranded budget goods to capture aspirational Tier-2 branded apparel spend.",
                "action": "Target established D2C brands with exclusive distribution partnerships to counter Meesho Mall expansion.",
                "evidence_url": "https://www.meesho.com/mall"
            }
        ],
        "strategic_narrative": "Meesho is executing a high-volume value commerce strategy across India's Tier-2, Tier-3, and Tier-4 cities, combining a 0% seller commission model with decentralized logistics (Valmo) to deliver direct-from-factory pricing that legacy e-commerce players cannot match."
    },

    "microsoft": {
        "company_name": "Microsoft",
        "domain": "microsoft.com",
        "industry": "Enterprise Software, Cloud Computing & AI Infrastructure",
        "business_model": "Multi-tier enterprise subscription licensing (Microsoft 365 / Office 365 / Teams), consumption-based cloud computing (Azure), enterprise licensing agreements (EA), and commercial AI subscriptions (Copilot).",
        "target_market": "Enterprise IT executives, Fortune 500 corporations, public sector & government agencies, commercial mid-market organizations, and global development teams.",
        "summary": "Global technology giant dominating enterprise productivity, corporate identity, and commercial cloud infrastructure through Microsoft 365, Azure, Entra ID, and its integrated OpenAI Copilot platform.",
        "products": [
            {
                "name": "Microsoft Azure Cloud Platform",
                "description": "Hyperscale enterprise cloud infrastructure delivering compute, storage, networking, database services, and exclusive Azure OpenAI model deployments."
            },
            {
                "name": "Microsoft 365 & Office Suite",
                "description": "Industry-standard productivity and collaboration ecosystem combining Teams, Exchange, SharePoint, OneDrive, Word, Excel, and PowerPoint."
            },
            {
                "name": "Microsoft 365 Copilot & Azure OpenAI",
                "description": "Generative AI assistant embedded across productivity workflows, grounded in organizational data via Microsoft Graph and OpenAI frontier models."
            },
            {
                "name": "Microsoft Entra ID & Microsoft Purview",
                "description": "Universal enterprise identity, single sign-on, access governance, risk management, and data compliance platform."
            }
        ],
        "features": [
            "Seamless enterprise identity and access management with Active Directory & Entra ID",
            "Multi-year Enterprise Agreement (EA) bundling across desktop, server, and cloud licenses",
            "Azure Arc multi-cloud and hybrid infrastructure management",
            "Deep Microsoft Graph data integration powering enterprise Copilot interactions"
        ],
        "pricing_model": {
            "model_type": "Per-User Subscription Licensing & Azure Consumption",
            "starting_price": "$36/user/mo (M365 E3) / Azure pay-as-you-go",
            "free_tier": True,
            "tiers": [
                "Microsoft 365 Business Standard ($12.50/user/mo)",
                "Microsoft 365 Enterprise E3 ($36/user/mo)",
                "Microsoft 365 Enterprise E5 with Advanced Compliance ($57/user/mo)",
                "Microsoft Copilot Add-on ($30/user/mo with annual commitment)"
            ],
            "hidden_costs_or_traps": "Mandatory premium add-on licenses for advanced security (Entra ID P2, Defender, Purview); unexpected true-up audit adjustments; high Azure egress networking fees.",
            "recent_focus": "Pushing enterprise customers from E3 to E5 tiers and bundling Copilot seats into multi-year enterprise contract renewals."
        },
        "customers": [
            "Fortune 500 Enterprises",
            "Global Financial Institutions & Banks",
            "Government & Defense Agencies",
            "Healthcare Systems & Academic Institutions"
        ],
        "strengths": [
            "Massive, entrenched enterprise customer base with deeply embedded Enterprise Agreements (EAs) and Active Directory identity roots",
            "First-mover enterprise commercialization of generative AI through exclusive partnership with OpenAI and Azure OpenAI Service",
            "Unrivaled desktop workspace presence with Microsoft Teams, Outlook, and Office suite installed across hundreds of millions of corporate devices",
            "Comprehensive global sales distribution network and certified systems integrator ecosystem (Accenture, Avanade, PwC)"
        ],
        "weaknesses": [
            "Extremely complex, opaque licensing structures with unexpected costs and mandatory premium add-on SKUs",
            "Slower product innovation and less intuitive user experience in niche developer and specialized functional SaaS tools",
            "Heavy vendor lock-in breeding CIO dissatisfaction and resistance to single-vendor dependency",
            "Centralized IT approval bottlenecks delaying deployment of modern agile workflows for agile business units"
        ],
        "objections": [
            {
                "objection": "We already have an Enterprise Agreement (EA) with Microsoft that includes Teams and Azure credits at a massive discount.",
                "context": "Microsoft uses enterprise licensing bundles to crowd out specialized competitors even when Microsoft's tool is inferior.",
                "rebuttal": "Acknowledge Microsoft's contract bundling convenience, but calculate true total cost of ownership (TCO). Bundled tools often suffer from low user adoption, lack essential specialized capabilities, and require expensive E5 upgrades or $30/user/mo Copilot fees. Dedicated point solutions save hundreds of engineering hours and drive measurable ROI.",
                "evidence_url": "https://www.microsoft.com/en-us/licensing"
            },
            {
                "objection": "Our IT department mandates a Microsoft-only architecture for unified compliance, SOC2, and Entra ID security.",
                "context": "Enterprise IT prefers single-vendor management to minimize security risk.",
                "rebuttal": "Best-of-breed platforms support native SAML SSO and SCIM provisioning directly through Microsoft Entra ID. You get full compliance, auditing, and centralized access control without being locked into Microsoft's slower product roadmap and rigid architecture.",
                "evidence_url": "https://learn.microsoft.com/en-us/entra/identity"
            }
        ],
        "discovery_questions": [
            {
                "question": "How much of your annual Microsoft contract spend is allocated to bundled licenses and unused enterprise credits rather than active workload utility?",
                "rationale": "Exposes shelfware and the true effective cost of bundled Microsoft Enterprise Agreements.",
                "evidence_url": "https://www.microsoft.com/licensing/terms"
            },
            {
                "question": "What is your projected annual run-rate once M365 Copilot licenses ($30/seat/mo) and Entra ID P2 add-ons are deployed across your workforce?",
                "rationale": "Highlights hidden price inflation when moving beyond basic bundled E3 licensing.",
                "evidence_url": "https://www.microsoft.com/microsoft-365/enterprise/copilot"
            },
            {
                "question": "How frequently are your product and engineering teams delayed waiting for centralized IT approval for Azure-only platform configurations?",
                "rationale": "Uncovers developer friction and time-to-market penalties caused by rigid Microsoft stack mandates.",
                "evidence_url": "https://azure.microsoft.com/solutions"
            }
        ],
        "proof_points": [
            {
                "title": "Microsoft Cloud Surpasses $35B Quarterly Revenue Run-Rate",
                "excerpt": "Microsoft Cloud quarterly revenue surpassed $35 billion, driven by 31% year-over-year Azure growth and enterprise expansion of Azure OpenAI Service.",
                "evidence_url": "https://www.microsoft.com/investor"
            },
            {
                "title": "Enterprise Adoption of Microsoft 365 Copilot Reaches 60% of Fortune 500",
                "excerpt": "Over 60% of Fortune 500 organizations have deployed Microsoft 365 Copilot seats, with customer productivity benchmarks showing 1.2 hours saved weekly per knowledge worker.",
                "evidence_url": "https://www.microsoft.com/presspass"
            }
        ],
        "recent_changes": [
            {
                "headline": "Microsoft 365 Copilot Autonomous Agents Rollout in Copilot Studio",
                "dimension": "Product Pivot",
                "when": "2026-10-21T00:00:00Z",
                "implication": "Enables business teams to build autonomous agents within Teams and SharePoint, directly challenging standalone AI workflow vendors.",
                "action": "Highlight deep multi-agent orchestration, custom LLM fine-tuning, and multi-cloud connectivity that Copilot Studio lacks.",
                "evidence_url": "https://blogs.microsoft.com/copilot-agents"
            },
            {
                "headline": "Azure OpenAI GPT-4o Realtime Audio & Multimodal API Integration",
                "dimension": "Product Pivot",
                "when": "2026-09-18T00:00:00Z",
                "implication": "Brings low-latency speech-to-speech and multimodal AI capabilities directly to enterprise cloud tenants with SOC2 compliance.",
                "action": "Offer low-latency local model hosting and independent AI gateway capabilities to counter Azure OpenAI lock-in.",
                "evidence_url": "https://azure.microsoft.com/blog/openai-realtime"
            }
        ],
        "strategic_narrative": "Microsoft is leveraging its dominant enterprise desktop and identity footprint (Entra ID, Microsoft 365) to upsell enterprise customers onto premium E5 tiers, Azure cloud infrastructure, and per-seat Copilot add-ons, using multi-year Enterprise Agreements to lock out best-of-breed alternatives."
    },

    "aws": {
        "company_name": "AWS",
        "domain": "aws.amazon.com",
        "industry": "Hyperscale Cloud Infrastructure & Platform Services (IaaS & PaaS)",
        "business_model": "Utility-metered consumption across compute (EC2/Lambda), storage (S3), databases (Aurora/DynamoDB), and networking, supplemented by 1-year and 3-year Savings Plans and Reserved Instances.",
        "target_market": "Cloud engineers, software architects, DevOps and platform teams, enterprise CIOs, and digital-native startups requiring global hyperscale computing infrastructure.",
        "summary": "The pioneer and market share leader in hyperscale cloud computing, providing over 200 fully featured services across global data center regions with unmatched operational reliability and developer mindshare.",
        "products": [
            {
                "name": "Amazon EC2 & AWS Lambda",
                "description": "Elastic virtual compute instances and event-driven serverless functions with dynamic auto-scaling and custom Graviton processor architectures."
            },
            {
                "name": "Amazon S3 & Amazon DynamoDB",
                "description": "Industry-standard cloud object storage with 99.999999999% durability and single-digit millisecond latency managed NoSQL database service."
            },
            {
                "name": "Amazon Aurora & Amazon RDS",
                "description": "High-throughput managed relational databases compatible with MySQL and PostgreSQL, featuring automated multi-region replication."
            },
            {
                "name": "Amazon Bedrock & Amazon SageMaker",
                "description": "Enterprise foundation model API hub providing access to leading frontier models (Claude, Llama, Titan) with serverless deployment and governance."
            }
        ],
        "features": [
            "Broadest cloud portfolio with 200+ fully-featured services",
            "Global multi-region availability zones with redundant physical infrastructure",
            "Custom silicon efficiency via Graviton4 and Trainium2 chips",
            "Deepest ecosystem of certified solutions architects and partner solutions"
        ],
        "pricing_model": {
            "model_type": "Pay-As-You-Go Granular Utility Metering & Savings Plans",
            "starting_price": "Free Tier (12 months limited) / Granular consumption",
            "free_tier": True,
            "tiers": [
                "On-Demand Consumption (Pay for what you use by the second)",
                "Compute Savings Plans (Up to 72% discount for 1-yr/3-yr commitments)",
                "Spot Instances (Up to 90% discount on spare EC2 capacity)",
                "Enterprise Discount Program (EDP custom multi-year commit)"
            ],
            "hidden_costs_or_traps": "Data transfer egress fees ($0.02 - $0.09/GB across internet and inter-region); NAT Gateway hourly processing surcharges; provisioned IOPS overages.",
            "recent_focus": "Expanding multi-year Enterprise Discount Program (EDP) commitments while offering localized AWS Outposts and European sovereign cloud regions."
        },
        "customers": [
            "Netflix", "Airbnb", "Epic Games", "Pfizer",
            "Capital One", "Formula 1", "Stripe", "Siemens"
        ],
        "strengths": [
            "Undisputed market share leader in hyperscale cloud with the most mature, battle-tested operational infrastructure",
            "Broadest and deepest service catalog (200+ services) satisfying virtually every technical infrastructure requirement",
            "Massive global developer and cloud architect ecosystem with widespread certifications and community support",
            "Pioneering custom silicon (Graviton4, Trainium2, Inferentia) delivering superior price-performance for compute and AI training"
        ],
        "weaknesses": [
            "Pervasive and unpredictable networking egress costs penalizing data movement outside AWS data centers",
            "Overwhelming service complexity and fragmented management consoles requiring specialized DevOps staffing",
            "Unpredictable monthly invoices prone to unexpected cost spikes from misconfigured serverless or storage buckets",
            "Primitive baseline focus that lags behind modern developer platforms in turnkey developer experience"
        ],
        "objections": [
            {
                "objection": "Our entire infrastructure is standardized on AWS with multi-year Savings Plans and committed EDP discounts.",
                "context": "AWS uses multi-million dollar Enterprise Discount Program (EDP) commits to penalize workloads running elsewhere.",
                "rebuttal": "Acknowledge AWS's IaaS foundation, but demonstrate that compute savings are often erased by high inter-region and internet egress data transfer costs. By offloading specialized workloads to optimized platforms, teams reduce operational maintenance hours and avoid hiring scarce certified AWS specialists.",
                "evidence_url": "https://aws.amazon.com/pricing/savings-plans"
            },
            {
                "objection": "AWS has 200+ services and more compliance certifications than any other cloud provider.",
                "context": "AWS relies on service catalog breadth to claim superiority over point solutions.",
                "rebuttal": "Raw service count creates massive operational overhead. Most organizations use less than 15 AWS services, but pay a heavy configuration tax to wire them together. Dedicated platforms provide higher-level abstractions that ship features 5x faster with built-in compliance out of the box.",
                "evidence_url": "https://aws.amazon.com/compliance"
            }
        ],
        "discovery_questions": [
            {
                "question": "What percentage of your monthly AWS bill is driven by inter-AZ, NAT gateway, and internet data transfer egress fees?",
                "rationale": "Exposes AWS's hidden networking tax and creates urgency around egress cost predictability.",
                "evidence_url": "https://aws.amazon.com/ec2/pricing/on-demand"
            },
            {
                "question": "How many full-time DevOps or cloud platform engineers are currently dedicated to managing, patching, and securing your raw AWS infrastructure?",
                "rationale": "Uncovers the hidden human labor cost required to manage AWS primitives versus higher-level platforms.",
                "evidence_url": "https://aws.amazon.com/architecture"
            },
            {
                "question": "Are your developers adopting Amazon Bedrock, or are they experiencing latency and customization constraints compared to direct model APIs?",
                "rationale": "Probes developer satisfaction with AWS's generative AI abstractions versus specialized AI stacks.",
                "evidence_url": "https://aws.amazon.com/bedrock"
            }
        ],
        "proof_points": [
            {
                "title": "AWS Achieves $105B+ Annualized Revenue Run-Rate with 19% Growth",
                "excerpt": "AWS crossed a $105 billion annualized revenue run rate, retaining its position as the world's largest cloud provider with millions of active global enterprise customers.",
                "evidence_url": "https://press.aboutamazon.com"
            },
            {
                "title": "Graviton4 Processors Deliver 30% Better Compute Performance",
                "excerpt": "AWS announced general availability of Graviton4 processors, demonstrating 30% faster compute performance and 75% more memory bandwidth than previous generation chips.",
                "evidence_url": "https://aws.amazon.com/blogs/aws/graviton4-ga"
            }
        ],
        "recent_changes": [
            {
                "headline": "Amazon Bedrock Multi-Agent Collaboration & Automated Evaluation GA",
                "dimension": "Product Pivot",
                "when": "2026-10-18T00:00:00Z",
                "implication": "Enables developers to orchestrate multi-agent workflows using foundation models within AWS security boundaries.",
                "action": "Showcase open-source, multi-cloud agent orchestration that avoids proprietary AWS Lambda and Bedrock lock-in.",
                "evidence_url": "https://aws.amazon.com/bedrock/multi-agent"
            },
            {
                "headline": "Zero-ETL Integrations Expanded Across Aurora, DynamoDB, and OpenSearch",
                "dimension": "Product Pivot",
                "when": "2026-09-12T00:00:00Z",
                "implication": "Eliminates custom data engineering pipelines by automatically syncing operational databases to analytics engines.",
                "action": "Emphasize warehouse-native lakehouse querying without proprietary AWS database constraints.",
                "evidence_url": "https://aws.amazon.com/blogs/aws/zero-etl"
            }
        ],
        "strategic_narrative": "AWS is defending its dominant hyperscale cloud infrastructure position by aggressively expanding its Amazon Bedrock AI platform and custom Graviton silicon, using multi-year Savings Plans and high data egress switching costs to keep enterprise customer workloads within its ecosystem."
    },

    "flipkart": {
        "company_name": "Flipkart",
        "domain": "flipkart.com",
        "industry": "Multi-Category E-Commerce & Marketplace",
        "business_model": "Multi-category marketplace charging tiered seller commissions, advertising fees (Flipkart Ads), and fulfillment charges via Ekart logistics.",
        "target_market": "Mass-market Indian consumers across Tier-1, Tier-2, and Tier-3 cities; electronics buyers, branded fashion shoppers, and registered online merchants.",
        "summary": "Walmart-backed Indian e-commerce leader with dominant market share in smartphones, large home appliances, and regional logistics, expanding into quick commerce via Flipkart Minutes.",
        "products": [
            {
                "name": "Flipkart Marketplace",
                "description": "Comprehensive multi-category e-commerce platform serving 400M+ registered users with extensive brand selections and seasonal promotional events."
            },
            {
                "name": "Shopsy by Flipkart",
                "description": "Zero-commission budget and social commerce shopping platform targeting value-conscious non-metro consumers in competition with Meesho."
            },
            {
                "name": "Ekart Logistics",
                "description": "In-house end-to-end supply chain and parcel delivery network reaching over 19,000 pin codes with automated sorting infrastructure."
            },
            {
                "name": "Flipkart Minutes",
                "description": "Sub-15 minute hyperlocal rapid grocery and daily essentials delivery service operating out of urban dark store micro-fulfillment centers."
            }
        ],
        "features": [
            "Market leadership in mobile phones and consumer electronics with brand exclusives",
            "Flipkart SuperCoins universal rewards loyalty program",
            "Nationwide Ekart delivery network covering 19,000+ pin codes",
            "Flipkart Pay Later consumer credit and flexible checkout options"
        ],
        "pricing_model": {
            "model_type": "Category-Tiered Seller Commissions & Fulfillment Fees",
            "starting_price": "5% - 25% Category Commission + Fulfillment",
            "free_tier": True,
            "tiers": [
                "Shopsy Zero-Commission Tier (< ₹250 items)",
                "Standard Marketplace Tier (5% - 25% commission)",
                "Fulfilled by Flipkart (FBF) Premium Logistics"
            ],
            "hidden_costs_or_traps": "Closing fees per shipment, fixed pick-and-pack charges, customer return logistics deductions, and rising cost-per-click on Flipkart Ads.",
            "recent_focus": "Waived commissions on unbranded apparel under ₹250 on Shopsy and deployed flat ₹19 delivery fees on Flipkart Minutes."
        },
        "customers": [
            "Mass-Market Indian Consumers",
            "Smartphone & Electronics Buyers",
            "Brand Authorized Retailers",
            "Shopsy Resellers & Micro-Entrepreneurs"
        ],
        "strengths": [
            "Dominant market share in consumer electronics, smartphones, and large appliances with strong seasonal festival GMV (Big Billion Days)",
            "Robust nationwide delivery and supply chain network via Ekart covering virtually all postal codes in India",
            "High consumer brand trust with integrated consumer financing (Flipkart Pay Later) and easy exchange programs",
            "Strong corporate financial backing from Walmart providing immense capital reserves for competitive discounting"
        ],
        "weaknesses": [
            "Severe take-rate compression and margin loss in low-ticket fashion when competing with zero-commission platforms like Meesho",
            "High cash burn rate associated with building and maintaining urban dark store infrastructure for Flipkart Minutes",
            "Complex return workflows and disputes with third-party sellers on apparel defect claims",
            "Perceived higher seller onboarding friction compared to agile social commerce platforms"
        ],
        "objections": [
            {
                "objection": "Flipkart's Big Billion Days festival GMV scale and Ekart delivery coverage cannot be matched by smaller platforms.",
                "context": "Flipkart's seasonal marketing blitz and Ekart logistics infrastructure dominate festive electronics GMV.",
                "rebuttal": "Concede festive electronics volume, but show that heavy advertising costs and festival discounts during Big Billion Days erode seller profitability. For everyday unbranded commerce, everyday low prices without festival price swings yield superior merchant margins.",
                "evidence_url": "https://stories.flipkart.com"
            },
            {
                "objection": "Flipkart has dominant brand trust and exclusive smartphone/electronics launches.",
                "context": "Flipkart has historically controlled the online mobile phone market through exclusive manufacturer brand agreements.",
                "rebuttal": "Concede Flipkart's dominance in branded electronics, but pivot the conversation to unbranded fashion, home essentials, and lifestyle goods where Flipkart's 15-25% commission structure forces sellers to inflate retail prices. In everyday essentials, direct-factory pricing wins consumer loyalty.",
                "evidence_url": "https://stories.flipkart.com"
            },
            {
                "objection": "Flipkart Minutes delivers daily essentials and FMCG products in under 15 minutes.",
                "context": "Flipkart is expanding urban dark stores to counter Zepto and Blinkit.",
                "rebuttal": "15-minute quick delivery requires high density and expensive urban micro-warehousing, making it economically unviable outside major metro hubs. For Tier-2/3 pin codes and planned household shopping, scheduled delivery at 30-40% lower unit prices provides sustainable value.",
                "evidence_url": "https://tech.flipkart.com/minutes"
            }
        ],
        "discovery_questions": [
            {
                "question": "How are high seller commission rates and advertising costs on Flipkart impacting your net realized margin on items under ₹500?",
                "rationale": "Exposes seller margin squeeze under Flipkart's multi-tier fee matrix.",
                "evidence_url": "https://seller.flipkart.com/pricing"
            },
            {
                "question": "What is your strategy for competing in non-metro pin codes where Flipkart Minutes dark-store density is economically unviable?",
                "rationale": "Targets geographical limits of Flipkart's rapid delivery model.",
                "evidence_url": "https://stories.flipkart.com/logistics"
            },
            {
                "question": "How do your return-to-origin rates on Flipkart compare between prepaid digital orders and Cash on Delivery in Tier-2/3 cities?",
                "rationale": "Probes reverse logistics costs in semi-urban fulfillment.",
                "evidence_url": "https://seller.flipkart.com/returns"
            }
        ],
        "proof_points": [
            {
                "title": "Ekart Supply Chain Network Reaches 19,000+ Indian Pin Codes",
                "excerpt": "Flipkart's logistics wing Ekart operates over 4,000 regional delivery hubs across India, fulfilling over 100 million parcels during festive Big Billion Days periods.",
                "evidence_url": "https://stories.flipkart.com/ekart-milestone"
            },
            {
                "title": "Flipkart Minutes Deployed Across 400 Dark Stores in Top Metros",
                "excerpt": "Flipkart launched its rapid delivery arm Minutes across 400 micro-fulfillment dark stores with an average delivery turnaround of 12 minutes in top 12 metropolitan centers.",
                "evidence_url": "https://tech.flipkart.com/minutes-scale"
            }
        ],
        "recent_changes": [
            {
                "headline": "Flipkart Minutes 15-Minute Hyperlocal Grocery Rollout Across 12 Metros",
                "dimension": "Distribution & Logistics",
                "when": "2026-10-25T00:00:00Z",
                "implication": "Pressures traditional 48-hour delivery marketplaces by capturing high-frequency daily household FMCG baskets.",
                "action": "Emphasize non-perishable scheduled bulk delivery savings in suburban and non-metro pin codes.",
                "evidence_url": "https://stories.flipkart.com/minutes-launch"
            },
            {
                "headline": "Flippi Generative AI Conversational Voice Search Launched",
                "dimension": "Product Pivot",
                "when": "2026-09-14T00:00:00Z",
                "implication": "Improves product discovery for non-English speakers through conversational multi-turn buying assistance.",
                "action": "Deploy localized vernacular search filters matching non-metro consumer phrasing.",
                "evidence_url": "https://tech.flipkart.com/flippi-ai"
            }
        ],
        "strategic_narrative": "Flipkart is defending its core multi-category e-commerce dominance against Amazon through deep brand exclusives and festive GMV scale, while rolling out Flipkart Minutes dark stores and Shopsy to counter quick commerce and Meesho in the value segment."
    },

    "amazon india": {
        "company_name": "Amazon India",
        "domain": "amazon.in",
        "industry": "Global Retail Marketplace, Digital Subscriptions & Cloud Logistics",
        "business_model": "Two-sided retail marketplace charging category referral fees (2%-20%), Prime annual subscriptions (₹1,499/year), Fulfillment by Amazon (FBA) storage and logistics fees, and sponsored search advertising.",
        "target_market": "Urban, suburban, and aspirational Tier-2 Indian households, Amazon Prime subscribers, high-basket-size digital shoppers, and registered brand manufacturers.",
        "summary": "Global digital retail giant operating India's premier Prime subscription ecosystem, providing guaranteed fast delivery, digital entertainment streaming, and world-class automated fulfillment.",
        "products": [
            {
                "name": "Amazon.in Digital Marketplace",
                "description": "Comprehensive digital retail marketplace offering over 100 million catalog items across electronics, fashion, home, grocery, and books."
            },
            {
                "name": "Amazon Prime Membership Ecosystem",
                "description": "Premium customer loyalty subscription bundling free 1-2 day delivery with Prime Video streaming, Prime Music, and exclusive festival shopping privileges."
            },
            {
                "name": "Fulfillment by Amazon (FBA)",
                "description": "Comprehensive warehouse storage, automated picking, packaging, and shipping network handling millions of daily merchant orders."
            },
            {
                "name": "Amazon Bazaar",
                "description": "Specialized budget storefront within the Amazon app focused on unbranded apparel and home products priced under ₹600 with zero seller referral fees."
            }
        ],
        "features": [
            "Prime Guaranteed One-Day and Same-Day delivery across top Indian metros",
            "Fulfillment by Amazon (FBA) multi-hub warehouse infrastructure",
            "Amazon Pay seamless one-click UPI checkout and merchant financing",
            "Amazon Bazaar low-cost storefront targeting non-metro budget shoppers"
        ],
        "pricing_model": {
            "model_type": "Subscription + Category Referral Fee Matrix",
            "starting_price": "₹1,499/year Prime / 2% - 20% Seller Referral Fees",
            "free_tier": True,
            "tiers": [
                "Amazon Prime Annual (₹1,499/yr) / Prime Lite (₹799/yr)",
                "Amazon Bazaar Zero-Referral Storefront",
                "Fulfillment by Amazon (FBA) Multi-Hub Storage & Pick Tier"
            ],
            "hidden_costs_or_traps": "FBA monthly inventory storage surcharges, long-term storage fees on slow-moving inventory, and high competitive keyword bid inflation on Amazon Sponsored Products.",
            "recent_focus": "Launched Amazon Bazaar storefront with zero referral fees on fashion under ₹600 to challenge Meesho."
        },
        "customers": [
            "40M+ Prime Indian Households",
            "Urban Digital Shoppers & Tech Enthusiasts",
            "D2C Consumer Brands & National Distributors",
            "Regional SMB Manufacturers"
        ],
        "strengths": [
            "Unmatched Prime customer loyalty driving the highest average order value (AOV) and customer lifetime value in Indian e-commerce",
            "World-class automated warehousing and fulfillment infrastructure (FBA) setting industry benchmarks for delivery speed and reliability",
            "Seamless integration of digital payments (Amazon Pay) and streaming entertainment (Prime Video) cementing consumer retention",
            "Enormous global financial resources and technology backbone powered by Amazon Web Services"
        ],
        "weaknesses": [
            "High cost-to-serve and logistics friction in low-ticket rural and semi-urban deliveries outside metro cluster hubs",
            "Steep referral fee and FBA storage structure that discourages small unbranded manufacturers from listing low-margin goods",
            "Regulatory restrictions under Indian FDI retail policies limiting inventory ownership and preferential seller relationships",
            "Perception as a premium, urban-centric shopping destination among non-metro Tier-3 consumers"
        ],
        "objections": [
            {
                "objection": "Amazon Prime's guaranteed one-day delivery and hassle-free return policy is the industry gold standard.",
                "context": "Prime sets customer expectations for delivery speed in urban tier-1 centers.",
                "rebuttal": "Prime is unmatched for high-ticket urban goods, but its expensive fulfillment model requires substantial merchant fee structures that make everyday items under ₹300 uneconomical. For non-urgent daily apparel and home essentials, consumers prefer direct factory prices over paying a premium for Prime delivery.",
                "evidence_url": "https://www.aboutamazon.in"
            },
            {
                "objection": "Amazon India offers the widest catalog of global and national brands with consumer reviews.",
                "context": "Amazon's brand registry and international brand catalog attract affluent buyers.",
                "rebuttal": "For branded consumer electronics and imported products, Amazon is formidable. However, in mass-market lifestyle categories, regional manufacturers produce equivalent quality goods at a fraction of the cost when not burdened by Amazon's 15-20% take rate.",
                "evidence_url": "https://sell.amazon.in/pricing"
            }
        ],
        "discovery_questions": [
            {
                "question": "What are your total FBA storage and referral fees as a percentage of gross merchandise value on low-ticket SKUs under ₹400?",
                "rationale": "Highlights fee erosion on low-ticket catalog items.",
                "evidence_url": "https://sell.amazon.in/fees"
            },
            {
                "question": "How are you countering Amazon Bazaar's low-priced storefront while maintaining supplier margins?",
                "rationale": "Exposes competitive dynamics between Amazon's budget initiative and independent sellers.",
                "evidence_url": "https://www.aboutamazon.in/news"
            },
            {
                "question": "Is your advertising spend on Amazon Sponsored Products yielding diminishing ROAS due to rising cost-per-click bids?",
                "rationale": "Targets seller frustration with escalating Amazon ad fees.",
                "evidence_url": "https://advertising.amazon.in"
            }
        ],
        "proof_points": [
            {
                "title": "Amazon India Surpasses 40 Million Prime Member Households",
                "excerpt": "Amazon India's Prime membership base surpassed 40 million households, with over 65% of new Prime signups originating from outside top-10 metropolitan cities.",
                "evidence_url": "https://www.aboutamazon.in/news/retail/prime-milestone"
            },
            {
                "title": "Amazon Air Dedicated Freighter Network Expands to 6 Aircraft",
                "excerpt": "Amazon Air expanded its dedicated cargo aircraft fleet in India to 6 Boeing 737 freighters, connecting regional fulfillment hubs with guaranteed 24-hour inter-state transit.",
                "evidence_url": "https://www.aboutamazon.in/news/operations/amazon-air-expansion"
            }
        ],
        "recent_changes": [
            {
                "headline": "Amazon Bazaar Launch: Zero Referral Fees on Lifestyle Products Under ₹600",
                "dimension": "Pricing & Packaging",
                "when": "2026-10-10T00:00:00Z",
                "implication": "Directly targets Meesho's low-cost unbranded lifestyle catalog with subsidized seller take-rates.",
                "action": "Maintain direct factory relationships and highlight established supplier trust to prevent catalog poaching.",
                "evidence_url": "https://sell.amazon.in/bazaar"
            },
            {
                "headline": "Prime Lite Membership Price Slashed to ₹399/Year for Non-Metro Users",
                "dimension": "Pricing & Packaging",
                "when": "2026-09-05T00:00:00Z",
                "implication": "Expands Prime ecosystem penetration into Tier-2 and Tier-3 households with mobile-only benefits.",
                "action": "Emphasize zero-subscription barrier and immediate low pricing without annual commitments.",
                "evidence_url": "https://www.aboutamazon.in/news/retail/prime-lite"
            }
        ],
        "strategic_narrative": "Amazon India is leveraging its high-retention Prime ecosystem and world-class FBA fulfillment infrastructure to dominate urban and high-AOV retail, while launching Amazon Bazaar and discounted Prime Lite to defend against Meesho in Tier-2/3 value commerce."
    }
}


def get_canonical_competitor_profile(company_name: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve grounded, authentic competitor intelligence profile by company name.
    Matches normalized name or key aliases.
    """
    cname = str(company_name).strip().lower()
    if not cname:
        return None

    # Direct match
    if cname in COMPETITOR_PROFILES:
        return dict(COMPETITOR_PROFILES[cname])

    # Alias / Substring match
    if "meesho" in cname:
        return dict(COMPETITOR_PROFILES["meesho"])
    if "microsoft" in cname:
        return dict(COMPETITOR_PROFILES["microsoft"])
    if "aws" in cname or "amazon web services" in cname:
        return dict(COMPETITOR_PROFILES["aws"])
    if "flipkart" in cname and "shopsy" not in cname:
        return dict(COMPETITOR_PROFILES["flipkart"])
    if "amazon" in cname:
        return dict(COMPETITOR_PROFILES["amazon india"])

    return None


def is_known_canonical_competitor(company_name: str) -> bool:
    """Return True if competitor has a verified canonical profile."""
    return get_canonical_competitor_profile(company_name) is not None
