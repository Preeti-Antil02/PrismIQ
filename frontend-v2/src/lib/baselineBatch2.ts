import type {
  NextBestAction,
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
    supporting_evidence: [
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
      "RTO return penalties identified as #1 pricing complaint in seller voice, impacting SMB retention.",
    why_it_matters:
      "Reducing RTO return rates by 3% increases seller net profitability by 8%, completely neutralizing competitor fulfillment badges.",
    recommended_action:
      "Fast-track sprint for automated WhatsApp address verification and IVR re-confirmation prior to courier dispatch.",
    urgency: "High",
    confidence: "High",
    status: "pending",
    review_status: "pending",
    related_competitor: "Flipkart",
    supporting_evidence: [
      {
        type: "complaint",
        quote: "Zero commission model is great, but return shipping charges (RTO penalties) eat into SMB margins.",
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
    feedback_channel: "customer_interview",
    category: "reason_for_switching",
    sentiment: "negative",
    aspect: "Seller Retention",
    raw_quote:
      "Switched 40% of catalog to Flipkart Fulfilled because their 'Assured' trust badge improved checkout conversion by 22%.",
    created_at: "2026-11-18T10:20:00Z",
  },
];
