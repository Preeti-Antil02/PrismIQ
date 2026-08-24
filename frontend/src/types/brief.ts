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

export interface ParsedBrief {
  title: string;
  topDecisions: TopDecision[];
  rollup: RollupStats;
  companies: CompanySection[];
}

export interface BriefSummary {
  id: string;
  date: string;
  filename: string;
  preview?: string;
}
