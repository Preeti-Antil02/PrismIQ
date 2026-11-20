import type {
  NextBestAction,
  WinLossAnalytics,
  WinLossDeal,
  DealDossier,
  CustomerFeedbackTheme,
  CustomerFeedbackRecord,
} from "./api";

// ============================================================================
// BASELINE NEXT BEST ACTIONS
// ============================================================================
export const BASELINE_NEXT_BEST_ACTIONS: NextBestAction[] = [
  {
    id: "act_msh_sales_01",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    team: "Sales",
    affected_team: "sales",
    category: "objection_response",
    title: "Deploy 72-Hour Express Logistics Battlecard Against Flipkart",
    what_happened:
      "3 regional distributor deals lost to Flipkart citing delivery transit speed, supported by 54 customer complaints on courier delays.",
    why_it_matters:
      "$345,000 in active pipeline currently at risk across North and West regional textile clusters.",
    recommended_action:
      "Arm reps with the new 3PL Express SLA comparison sheet and counter-positioning playbook highlighting 0% commission savings offsetting freight costs.",
    urgency: "Critical",
    confidence: "High",
    status: "pending",
    review_status: "pending",
    related_competitor: "Flipkart",
    related_deal_id: "deal_jaipur_01",
    supporting_evidence: [
      { type: "lost_deal", name: "Jaipur Handloom Regional Distribution", value: "$85,000" },
      { type: "customer_theme", name: "Logistics SLA & 48h Transit Guarantee", sample_size: 138 },
      { type: "battlecard", name: "Flipkart Competitive Battlecard", section: "Where We Lose" },
    ],
    created_at: "2026-11-18T10:00:00Z",
    updated_at: "2026-11-18T10:00:00Z",
  },
  {
    id: "act_msh_prod_02",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    team: "Product",
    affected_team: "product",
    category: "feature_gap",
    title: "Automate Non-Delivery Report (NDR) IVR/WhatsApp Calling to Reduce RTO by 14%",
    what_happened:
      "RTO return penalties identified as #1 pricing complaint in seller voice, and direct loss factor in the Jaipur Handloom deal.",
    why_it_matters:
      "Reducing RTO return rates by 3% increases seller net profitability by 8%, completely neutralizing competitor fulfillment badges.",
    recommended_action:
      "Fast-track sprint for automated WhatsApp address verification and IVR re-confirmation prior to courier dispatch.",
    urgency: "High",
    confidence: "High",
    status: "pending",
    review_status: "pending",
    related_competitor: "Flipkart",
    related_deal_id: "deal_jaipur_01",
    supporting_evidence: [
      {
        type: "complaint",
        quote: "Zero commission model is great, but return shipping charges (RTO penalties) eat into SMB margins.",
      },
      {
        type: "buyer_objection",
        objection: "RTO penalty charges too volatile without automated NDR management",
      },
    ],
    created_at: "2026-11-18T10:15:00Z",
    updated_at: "2026-11-18T10:15:00Z",
  },
  {
    id: "act_msh_mktg_03",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    team: "Marketing",
    affected_team: "marketing",
    category: "messaging",
    title: "Launch 'True Total Net Realization' Head-to-Head Calculator Against Flipkart",
    what_happened:
      "Flipkart launched aggressive merchant campaigns claiming superior total landed sales volume.",
    why_it_matters:
      "Regional sellers confuse gross sales volume with net bottom-line profit after 18% commission and return deductions.",
    recommended_action:
      "Publish interactive calculator showing that a seller making ₹10L gross keeps ₹9.8L on Meesho vs ₹7.9L on Flipkart.",
    urgency: "High",
    confidence: "Medium",
    status: "pending",
    review_status: "pending",
    related_competitor: "Flipkart",
    supporting_evidence: [
      { type: "theme", name: "0% Commission Margin Advantage", sample_size: 145 },
      { type: "won_deal", name: "Tirupur Garments Export Surplus Network", value: "$135,000" },
    ],
    created_at: "2026-11-18T10:30:00Z",
    updated_at: "2026-11-18T10:30:00Z",
  },
  {
    id: "act_msh_lead_04",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    team: "Leadership",
    affected_team: "leadership",
    category: "strategic_opportunity",
    title: "Establish Strategic Regional 3PL Volume Partnership with Shadowfax / Delhivery",
    what_happened:
      "Logistics transit gap identified as single common denominator across 67% of lost enterprise deals against Flipkart and Amazon India.",
    why_it_matters:
      "Securing priority surface line-haul transit guarantees 72h fulfillment across 18,000 Tier-2/3 pin codes.",
    recommended_action:
      "Authorize executive team to negotiate a master logistics SLA with committed daily parcel minimums in exchange for dedicated express hub routing.",
    urgency: "Critical",
    confidence: "High",
    status: "pending",
    review_status: "pending",
    related_competitor: "Flipkart",
    supporting_evidence: [
      { type: "analytics", metric: "Win rate drops to 38% against Flipkart when logistics SLA is raised by buyer" },
    ],
    created_at: "2026-11-18T10:45:00Z",
    updated_at: "2026-11-18T10:45:00Z",
  },
  {
    id: "act_msh_sales_05",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    team: "Sales",
    affected_team: "sales",
    category: "enablement",
    title: "Regional Language Supplier Portal Walkthrough Certification",
    what_happened:
      "Won Surat Textile Consortium ($120k) and Ludhiana Knitwear ($95k) primarily on Hindi/Gujarati onboarding ease.",
    why_it_matters:
      "Tier-3 manufacturers reject complex English-only ERP integrations.",
    recommended_action:
      "Publish vernacular onboarding video guides and certify all North/West field reps.",
    urgency: "Medium",
    confidence: "High",
    status: "completed",
    review_status: "completed",
    related_competitor: "Shopsy",
    supporting_evidence: [
      { type: "won_deal", name: "Surat Textile Consortium", factor: "Regional Language App Support" },
    ],
    created_at: "2026-11-18T11:00:00Z",
    updated_at: "2026-11-18T11:00:00Z",
  },
];

// ============================================================================
// BASELINE WIN/LOSS INTELLIGENCE
// ============================================================================
export const BASELINE_WIN_LOSS_DEALS: WinLossDeal[] = [
  {
    id: "deal_surat_01",
    deal_name: "Surat Textile Consortium - 500 Sellers Onboarding",
    outcome: "won",
    deal_value: 120000,
    close_date: "2026-11-10",
    primary_competitor: "Flipkart",
    competitors_involved: ["Flipkart", "Shopsy"],
    buyer_objections: ["Concerns on regional logistics transit times"],
    decision_factors: ["Zero Marketplace Commission & Direct UPI Settlement"],
    notes: "Won against Flipkart. 0% take-rate enabled manufacturers to price 25% cheaper and protect margin.",
    created_at: "2026-11-10T08:00:00Z",
  },
  {
    id: "deal_jaipur_01",
    deal_name: "Jaipur Handloom Regional Distribution Enterprise",
    outcome: "lost",
    deal_value: 85000,
    close_date: "2026-11-12",
    primary_competitor: "Flipkart",
    competitors_involved: ["Flipkart"],
    buyer_objections: [
      "RTO penalty charges too volatile without automated NDR management",
      "Flipkart Assured badge gives 22% higher conversion",
    ],
    decision_factors: ["Flipkart Assured Logistics SLA & Faster 48h Transit"],
    notes: "Lost to Flipkart. Client needed guaranteed 48-hour delivery badge to compete in festive apparel.",
    created_at: "2026-11-12T14:30:00Z",
  },
  {
    id: "deal_delhi_01",
    deal_name: "Delhi NCR Consumer Electronics Wholesale",
    outcome: "lost",
    deal_value: 210000,
    close_date: "2026-11-14",
    primary_competitor: "Amazon India",
    competitors_involved: ["Amazon India", "Flipkart"],
    buyer_objections: [
      "Counterfeit copycats erode wholesale distributor reputation on unverified platforms",
    ],
    decision_factors: ["Amazon FBA Brand Registry & Counterfeit Protection"],
    notes: "Lost to Amazon India due to Brand Registry and FBA automated damage claims.",
    created_at: "2026-11-14T11:15:00Z",
  },
  {
    id: "deal_ludhiana_01",
    deal_name: "Ludhiana Knitwear Apparel Co-op",
    outcome: "won",
    deal_value: 95000,
    close_date: "2026-11-15",
    primary_competitor: "Shopsy",
    competitors_involved: ["Shopsy"],
    buyer_objections: ["Catalog bulk upload tool complexity"],
    decision_factors: ["Superior Tier-3 Social Sharing Engine & Low Seller Churn"],
    notes: "Won against Shopsy. WhatsApp catalog sharing drove 40% organic referral traffic.",
    created_at: "2026-11-15T09:45:00Z",
  },
  {
    id: "deal_blr_01",
    deal_name: "Bengaluru D2C Fashion Collective",
    outcome: "lost",
    deal_value: 140000,
    close_date: "2026-11-16",
    primary_competitor: "Ajio",
    competitors_involved: ["Ajio", "Flipkart"],
    buyer_objections: ["Value marketplace perceived as discount-only apparel"],
    decision_factors: ["Curated Premium Brand Positioning"],
    notes: "Lost to Ajio due to curated fashion editorial placement requirements.",
    created_at: "2026-11-16T16:20:00Z",
  },
  {
    id: "deal_kolkata_01",
    deal_name: "Kolkata Leather Goods Manufacturer Hub",
    outcome: "won",
    deal_value: 160000,
    close_date: "2026-11-17",
    primary_competitor: "Amazon India",
    competitors_involved: ["Amazon India"],
    buyer_objections: ["Amazon global export program incentives"],
    decision_factors: ["Simpler Regional Catalog Onboarding & Dedicated Account Rep"],
    notes: "Won due to zero-barrier supplier portal and same-week seller payouts.",
    created_at: "2026-11-17T12:00:00Z",
  },
  {
    id: "deal_tirupur_01",
    deal_name: "Tirupur Garments Export Surplus Network",
    outcome: "won",
    deal_value: 135000,
    close_date: "2026-11-18",
    primary_competitor: "Flipkart",
    competitors_involved: ["Flipkart"],
    buyer_objections: ["Flipkart SuperCoins loyalty ecosystem lock-in"],
    decision_factors: ["0% Commission Advantage Offset Freight Costs"],
    notes: "Won. Calculated net realization showed $24k annual margin improvement over Flipkart.",
    created_at: "2026-11-18T07:30:00Z",
  },
];

export const BASELINE_WIN_LOSS_ANALYTICS: WinLossAnalytics = {
  competitor_name: "All",
  total_deals: 7,
  sample_size: 7,
  has_sufficient_data: true,
  status: "valid_sample",
  confidence: "Medium",
  win_rate_percentage: 57.1,
  win_rate_percent: 57.1,
  won_deals: 4,
  lost_deals: 3,
  outcomes: {
    won: 4,
    lost: 3,
    churned: 0,
    no_decision: 0,
  },
  financials: {
    total_pipeline_value: 945000,
    won_value: 510000,
    lost_value: 435000,
  },
  competitor_breakdown: {
    Flipkart: { total_deals: 3, won: 2, lost: 1, win_rate_percentage: 66.7, status: "valid_sample", sample_size: 3, total_deal_value: 340000 },
    "Amazon India": { total_deals: 2, won: 1, lost: 1, win_rate_percentage: 50.0, status: "insufficient_data", sample_size: 2, total_deal_value: 370000 },
    Shopsy: { total_deals: 1, won: 1, lost: 0, win_rate_percentage: 100.0, status: "insufficient_data", sample_size: 1, total_deal_value: 95000 },
    Ajio: { total_deals: 1, won: 0, lost: 1, win_rate_percentage: 0.0, status: "insufficient_data", sample_size: 1, total_deal_value: 140000 },
  },
  top_loss_factors: [
    { factor: "Flipkart Assured Logistics SLA & Faster 48h Transit", frequency: 2, sample_percentage: 67 },
    { factor: "Amazon FBA Brand Registry & Counterfeit Protection", frequency: 1, sample_percentage: 33 },
    { factor: "Curated Premium Brand Positioning", frequency: 1, sample_percentage: 33 },
  ],
  top_win_factors: [
    { factor: "Zero Marketplace Commission & Direct UPI Settlement", frequency: 3, sample_percentage: 75 },
    { factor: "Superior Tier-3 Social Sharing Engine", frequency: 1, sample_percentage: 25 },
    { factor: "Simpler Regional Catalog Onboarding", frequency: 1, sample_percentage: 25 },
  ],
  emerging_patterns: [
    { pattern: "Festive season courier transit bottlenecks driving 48h SLA objections", recent_loss_count: 2, urgency: "High" },
    { pattern: "RTO return penalty volatility impacting tier-2 apparel margin sustainability", recent_loss_count: 2, urgency: "High" },
  ],
  sample_size_warning: "Sample size (n=7) provides statistically indicative directional trends.",
};

// ============================================================================
// BASELINE DEAL INTELLIGENCE DOSSIERS
// ============================================================================
export const BASELINE_DEAL_DOSSIERS: DealDossier[] = [
  {
    id: "dossier_jaipur_01",
    deal_id: "deal_jaipur_01",
    deal_name: "Jaipur Handloom Regional Distribution Enterprise",
    competitors_involved: ["Flipkart"],
    threat_level: "Critical",
    competitive_threat: "Critical",
    customer_requirements: [
      "Sub-72h regional shipping transit SLA across North India",
      "Automated WhatsApp customer address re-verification",
      "Capped RTO penalty protection for high-value apparel",
    ],
    primary_objections: [
      { objection: "Flipkart Assured badge gives 22% higher conversion on festive catalog", competitor: "Flipkart" },
      { objection: "Delivery transit speed too slow in Tier-1 metros compared to Flipkart 48h SLA", competitor: "Flipkart" },
      { objection: "High RTO return penalty charges on Cash-On-Delivery orders", competitor: "Flipkart" },
    ],
    customer_objections: [
      "Flipkart Assured badge gives 22% higher conversion on festive catalog",
      "Delivery transit speed too slow in Tier-1 metros compared to Flipkart 48h SLA",
      "High RTO return penalty charges on Cash-On-Delivery orders",
    ],
    product_gaps: [
      { gap: "Guaranteed sub-48h metro fulfillment badge", competitor: "Flipkart" },
      { gap: "Automated IVR/WhatsApp NDR confirmation", competitor: "Flipkart" },
    ],
    competitive_advantages: [
      { advantage: "0% marketplace commission vs Flipkart's 18% blended take-rate", competitor: "Flipkart" },
      { advantage: "Direct UPI seller escrow settlement in 48 hours vs 14 days", competitor: "Flipkart" },
      { advantage: "30% higher seller retention across regional handloom clusters", competitor: "Flipkart" },
    ],
    recommended_sales_response: {
      strategy: "Position 0% Commission Margin Delta Against Delivery Speed",
      playbook_scripts: [
        {
          competitor: "Flipkart",
          buyer_objection_scenario: "Flipkart Assured 48h delivery requirement",
          recommended_rebuttal: "Show financial model demonstrating that 18% commission savings easily covers dedicated 3PL regional express delivery.",
          action_guide: "Provide customized landed margin comparison workbook.",
        },
      ],
    },
    historical_proof_points: [
      {
        competitor: "Flipkart",
        historical_deals_count: 3,
        sample_size: 3,
        wins_against: 2,
        won_deals: 2,
        losses_against: 1,
        lost_deals: 1,
        winning_factors: ["Zero Marketplace Commission"],
        loss_factors: ["Flipkart Assured 48h Transit"],
        has_sufficient_data: true,
        data_note: "Directional pattern based on 3 regional distributor evaluations.",
      },
    ],
    recommended_sales_responses: [
      {
        competitor: "Flipkart",
        buyer_objection_scenario: "Flipkart Assured 48h delivery requirement",
        recommended_rebuttal: "Show financial model demonstrating that 18% commission savings easily covers dedicated 3PL regional express delivery.",
        action_guide: "Provide customized landed margin comparison workbook.",
      },
    ],
    relevant_historical_wins_losses: [
      {
        competitor: "Flipkart",
        historical_deals_count: 3,
        sample_size: 3,
        wins_against: 2,
        won_deals: 2,
        losses_against: 1,
        lost_deals: 1,
        winning_factors: ["Zero Marketplace Commission"],
        loss_factors: ["Flipkart Assured 48h Transit"],
        has_sufficient_data: true,
        data_note: "Directional pattern based on 3 regional distributor evaluations.",
      },
    ],
    supporting_claim_ids: [],
    created_at: "2026-11-18T10:00:00Z",
  },
  {
    id: "dossier_surat_01",
    deal_id: "deal_surat_01",
    deal_name: "Surat Textile Consortium - 500 Sellers Onboarding",
    competitors_involved: ["Flipkart", "Shopsy"],
    threat_level: "Low",
    competitive_threat: "Low",
    customer_requirements: [
      "Bulk CSV catalog upload interface",
      "Gujarati and Hindi regional language support",
      "Zero commission guarantee for 24 months",
    ],
    primary_objections: [
      { objection: "Third-party courier tracking updates lack real-time GPS visibility", competitor: "Flipkart" },
    ],
    customer_objections: [
      "Third-party courier tracking updates lack real-time GPS visibility",
    ],
    product_gaps: [{ gap: "Real-time GPS parcel tracking integration", competitor: "Flipkart" }],
    competitive_advantages: [
      { advantage: "Zero commission on unbranded apparel", competitor: "Flipkart" },
      { advantage: "Native Gujarati and Hindi app interfaces for manufacturers", competitor: "Flipkart" },
    ],
    recommended_sales_response: {
      strategy: "Expansion and Retention Program",
      playbook_scripts: [
        {
          competitor: "Flipkart",
          buyer_objection_scenario: "Courier GPS tracking",
          recommended_rebuttal: "Fast-track seasonal catalog updates with dedicated bulk spreadsheet concierge.",
          action_guide: "Assign tier-1 regional technical onboarding lead.",
        },
      ],
    },
    historical_proof_points: [],
    recommended_sales_responses: [
      {
        competitor: "Flipkart",
        buyer_objection_scenario: "Courier GPS tracking",
        recommended_rebuttal: "Fast-track seasonal catalog updates with dedicated bulk spreadsheet concierge.",
        action_guide: "Assign tier-1 regional technical onboarding lead.",
      },
    ],
    relevant_historical_wins_losses: [],
    supporting_claim_ids: [],
    created_at: "2026-11-18T10:00:00Z",
  },
  {
    id: "dossier_delhi_01",
    deal_id: "deal_delhi_01",
    deal_name: "Delhi NCR Consumer Electronics Wholesale",
    competitors_involved: ["Amazon India"],
    threat_level: "High",
    competitive_threat: "High",
    customer_requirements: [
      "Verified brand watermark badge",
      "Automated counterfeit listing takedown guarantee",
    ],
    primary_objections: [
      { objection: "Amazon FBA automated counterfeit image detection protects certified distributors", competitor: "Amazon India" },
    ],
    customer_objections: [
      "Amazon FBA automated counterfeit image detection protects certified distributors",
    ],
    product_gaps: [{ gap: "Automated supplier brand certificate verification workflow", competitor: "Amazon India" }],
    competitive_advantages: [
      { advantage: "Significantly lower fixed closing fees on electronics accessories", competitor: "Amazon India" },
    ],
    recommended_sales_response: {
      strategy: "Counter Amazon Brand Registry Advantage",
      playbook_scripts: [
        {
          competitor: "Amazon India",
          buyer_objection_scenario: "Brand Registry counterfeit copycats",
          recommended_rebuttal: "Deploy verified manufacturer watermark badge on catalog listings.",
          action_guide: "Provide legal takedown SLA under 48 hours for trademark holders.",
        },
      ],
    },
    historical_proof_points: [],
    recommended_sales_responses: [
      {
        competitor: "Amazon India",
        buyer_objection_scenario: "Brand Registry counterfeit copycats",
        recommended_rebuttal: "Deploy verified manufacturer watermark badge on catalog listings.",
        action_guide: "Provide legal takedown SLA under 48 hours for trademark holders.",
      },
    ],
    relevant_historical_wins_losses: [],
    supporting_claim_ids: [],
    created_at: "2026-11-18T10:00:00Z",
  },
  {
    id: "dossier_hf_01",
    deal_id: "deal_hf_01",
    deal_name: "High-Frequency Algorithmic Trading Platform",
    competitors_involved: ["AWS"],
    threat_level: "Critical",
    competitive_threat: "Critical",
    customer_requirements: [
      "Sub-10 microsecond MPI inter-node networking",
      "Deterministic GPU compute allocation during market hours",
      "Zero data egress penalties for multi-region replication",
    ],
    primary_objections: [
      { objection: "Custom FPGA hardware acceleration on AWS Outposts", competitor: "AWS" },
      { objection: "AWS inter-region data egress fee waivers", competitor: "AWS" },
    ],
    customer_objections: [
      "Custom FPGA hardware acceleration on AWS Outposts",
      "AWS inter-region data egress fee waivers",
    ],
    product_gaps: [{ gap: "Bare-metal FPGA instances in US-East", competitor: "AWS" }],
    competitive_advantages: [
      { advantage: "22% lower cost per GPU-hour on nightly quantitative simulation pipelines", competitor: "AWS" },
      { advantage: "Zero data egress penalty when using Azure ExpressRoute direct peering", competitor: "AWS" },
    ],
    recommended_sales_response: {
      strategy: "Pivot from low-latency execution to high-volume offline risk backtesting",
      playbook_scripts: [
        {
          competitor: "AWS",
          buyer_objection_scenario: "Custom FPGA hardware acceleration on AWS Outposts",
          recommended_rebuttal: "Position Azure InfiniBand HPC clusters for nightly quantitative risk simulation where cost per simulation run is 22% lower without upfront hardware lock-in.",
          action_guide: "Deploy Azure HPC benchmark comparison and execute 14-day dedicated low-latency cluster POC.",
        },
      ],
    },
    historical_proof_points: [
      {
        competitor: "AWS",
        historical_deals_count: 2,
        sample_size: 2,
        wins_against: 1,
        won_deals: 1,
        losses_against: 1,
        lost_deals: 1,
        winning_factors: ["Cost efficiency on batch simulation"],
        loss_factors: ["AWS Outposts custom FPGA hardware"],
        has_sufficient_data: true,
        data_note: "Empirical evaluation based on 2 algorithmic trading platform bids.",
        recent_deals: [
          { deal_name: "High-Frequency Algorithmic Trading Platform", outcome: "lost", value: 290000, close_date: "2026-11-14" },
          { deal_name: "Global FinTech Tier-1 Azure Migration", outcome: "won", value: 450000, close_date: "2026-11-10" },
        ],
      },
    ],
    recommended_sales_responses: [
      {
        competitor: "AWS",
        buyer_objection_scenario: "Custom FPGA hardware acceleration on AWS Outposts",
        recommended_rebuttal: "Position Azure InfiniBand HPC clusters for nightly quantitative risk simulation where cost per simulation run is 22% lower without upfront hardware lock-in.",
        action_guide: "Deploy Azure HPC benchmark comparison and execute 14-day dedicated low-latency cluster POC.",
      },
    ],
    relevant_historical_wins_losses: [
      {
        competitor: "AWS",
        historical_deals_count: 2,
        sample_size: 2,
        wins_against: 1,
        won_deals: 1,
        losses_against: 1,
        lost_deals: 1,
        winning_factors: ["Cost efficiency on batch simulation"],
        loss_factors: ["AWS Outposts custom FPGA hardware"],
        has_sufficient_data: true,
        data_note: "Empirical evaluation based on 2 algorithmic trading platform bids.",
      },
    ],
    supporting_claim_ids: [],
    created_at: "2026-11-18T10:00:00Z",
  },
];

// ============================================================================
// BASELINE CUSTOMER VOICE (THEMES & FEEDBACK)
// ============================================================================
export const BASELINE_CUSTOMER_THEMES: CustomerFeedbackTheme[] = [
  {
    id: "theme_msh_01",
    theme_title: "Logistics SLA & 48h Transit Guarantee",
    company_name: "Flipkart",
    category: "product_complaint",
    occurrence_count: 54,
    sample_size: 138,
    sentiment_breakdown: { positive: 18, negative: 108, neutral: 12 },
    representative_quotes: [
      { quote: "Logistics transit delay on third-party carrier shipments exceeds 6 days during festive peaks." },
      { quote: "Third-party courier transit time is twice as long as Flipkart Assured." },
    ],
    is_competitive_opportunity: true,
    confidence: "High",
  },
  {
    id: "theme_msh_02",
    theme_title: "0% Commission Margin Advantage",
    company_name: "Meesho",
    category: "love",
    occurrence_count: 68,
    sample_size: 145,
    sentiment_breakdown: { positive: 128, negative: 6, neutral: 11 },
    representative_quotes: [
      { quote: "Zero marketplace commission is the single biggest competitive moat for regional SMBs." },
      { quote: "Zero commission on unbranded apparel allows tier-2/3 sellers to maintain 30% higher net margins." },
    ],
    is_competitive_opportunity: true,
    confidence: "High",
  },
  {
    id: "theme_msh_03",
    theme_title: "RTO Volatility & Reverse Shipping Penalties",
    company_name: "Meesho",
    category: "pricing_complaint",
    occurrence_count: 42,
    sample_size: 96,
    sentiment_breakdown: { positive: 8, negative: 78, neutral: 10 },
    representative_quotes: [
      { quote: "Return shipping charges (RTO penalties) eat into SMB margins compared to Amazon India's subsidized reverse logistics." },
      { quote: "RTO return courier charges wipe out weekly seller profits on cash-on-delivery orders." },
    ],
    is_competitive_opportunity: false,
    confidence: "High",
  },
  {
    id: "theme_msh_04",
    theme_title: "Brand Protection & Counterfeits",
    company_name: "Amazon India",
    category: "product_complaint",
    occurrence_count: 31,
    sample_size: 82,
    sentiment_breakdown: { positive: 12, negative: 64, neutral: 6 },
    representative_quotes: [
      { quote: "Amazon India FBA protects against counterfeit listings, whereas regional suppliers copy product images." },
    ],
    is_competitive_opportunity: true,
    confidence: "High",
  },
];

export const BASELINE_CUSTOMER_FEEDBACK: CustomerFeedbackRecord[] = [
  {
    id: "fb_msh_01",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    company_name: "Flipkart",
    feedback_channel: "customer_review",
    category: "product_complaint",
    sentiment: "negative",
    aspect: "Logistics & Delivery Transit",
    raw_quote:
      "Logistics transit delay on third-party carrier shipments exceeds 6 days during festive peaks, whereas Flipkart Logistics fulfills within 48h.",
    created_at: "2026-11-17T09:00:00Z",
  },
  {
    id: "fb_msh_02",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    company_name: "Meesho",
    feedback_channel: "support_ticket",
    category: "pricing_complaint",
    sentiment: "negative",
    aspect: "RTO Penalties & Reverse Logistics",
    raw_quote:
      "Zero commission model is great, but return shipping charges (RTO penalties) eat into SMB margins compared to Amazon India's subsidized reverse logistics.",
    created_at: "2026-11-17T11:30:00Z",
  },
  {
    id: "fb_msh_03",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    company_name: "Meesho",
    feedback_channel: "customer_interview",
    category: "love",
    sentiment: "positive",
    aspect: "Seller Margins & Zero Commission",
    raw_quote:
      "Zero commission on unbranded apparel allows tier-2/3 sellers to maintain 30% higher net margins than Flipkart or Amazon.",
    created_at: "2026-11-17T14:15:00Z",
  },
  {
    id: "fb_msh_04",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    company_name: "Amazon India",
    feedback_channel: "customer_review",
    category: "product_complaint",
    sentiment: "negative",
    aspect: "Brand Protection & Counterfeits",
    raw_quote:
      "Amazon India FBA protects against counterfeit listings, whereas low-margin regional suppliers copy product images with zero enforcement.",
    created_at: "2026-11-18T08:00:00Z",
  },
  {
    id: "fb_msh_05",
    tenant_id: "8553449a-c998-4727-be01-9aeb724038cb",
    company_name: "Flipkart",
    feedback_channel: "sales_call_feedback",
    category: "reason_for_switching",
    sentiment: "negative",
    aspect: "Seller Retention",
    raw_quote:
      "Switched 40% of catalog to Flipkart Fulfilled because their 'Assured' trust badge improved checkout conversion by 22%.",
    created_at: "2026-11-18T10:20:00Z",
  },
];
