export interface TopDecision {
  index: number;
  company: string;
  title: string;
  explanation: string;
  isSecurityRisk: boolean;
}

export interface CompanyRollup {
  company: string;
  mustKnow: number;
  shouldKnow: number;
  niceToKnow: number;
}

export interface RollupStats {
  totalMonitored: number;
  companyCount: number;
  mustKnowTotal: number;
  shouldKnowTotal: number;
  niceToKnowTotal: number;
  keyFocus?: string;
  activityByCompany: CompanyRollup[];
}

export interface Finding {
  title: string;
  url: string;
  source: string;
  confidence: string;
  date: string;
  whyItMatters: string;
  isSecurityRisk: boolean;
}

export interface OtherActivityItem {
  title: string;
  url: string;
  source: string;
  date: string;
}

export interface CompanySection {
  company: string;
  mustKnow: Finding[];
  shouldKnow: Finding[];
  otherActivity: OtherActivityItem[];
}

export interface RadarSource {
  title: string;
  url: string;
  authors?: string[];
}

export interface RadarEvaluation {
  topic: string;
  researchItemCount: number;
  competitorConnectionSummary: string;
  whyItMatters: string;
  sources: RadarSource[];
}

export interface ParsedBrief {
  title: string;
  topDecisions: TopDecision[];
  rollup: RollupStats;
  companies: CompanySection[];
  radarEvaluations?: RadarEvaluation[];
}

export interface BriefSummary {
  id: string;
  date: string;
  filename: string;
  preview?: string;
}

export interface ResearchTopic {
  id: string;
  tenant_id: string;
  topic_label: string;
  keywords: string[];
  source: string;
  is_active: boolean;
  created_at: string;
}

export interface HistoricalRadarRecord {
  id: string;
  topic_label: string;
  cycle_id: string;
  research_item_count: number;
  competitor_connections: Record<string, {
    status: "researching" | "adopting" | "mentioning" | "no activity detected";
    reason: string;
    evidence_signals?: Array<{
      signal_id: string;
      source: string;
      title: string;
      url: string;
      raw_excerpt: string;
      matched_keywords: string[];
    }>;
    queried_sources?: Record<string, boolean>;
  }>;
  why_it_matters: string;
  verified_sources: Array<{
    title: string;
    url: string;
    source?: string;
    authors?: string[];
  }>;
  state_change_detected?: boolean;
  created_at: string;
}
