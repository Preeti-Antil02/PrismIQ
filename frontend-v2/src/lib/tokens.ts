/**
 * PrismIQ Design Tokens & Vocabulary Constants
 * 
 * Rules:
 * - Blue: Primary interaction
 * - Cyan: Emerging / Research Radar
 * - Violet: High-level synthesized intelligence / Trends
 * - Confidence: High (Emerald), Med (Amber), Low (Slate)
 * - Tiers: Must-Know (Crimson), Should-Know (Cobalt), Nice-to-Know (Slate)
 * - Classifier: Researching, Adopting, Mentioning, No activity detected
 */

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type TierLevel = 'Must-Know' | 'Should-Know' | 'Nice-to-Know';
export type ClassifierState = 'Researching' | 'Adopting' | 'Mentioning' | 'No activity detected';
export type SignalType = 'News' | 'GitHub' | 'Jobs' | 'Pricing' | 'Research';

export function normalizeConfidence(conf?: string | null): ConfidenceLevel {
  if (!conf) return 'Medium';
  const c = conf.trim().toLowerCase();
  if (c === 'high') return 'High';
  if (c === 'low') return 'Low';
  return 'Medium';
}

export interface ConfidenceNuance {
  level: ConfidenceLevel;
  score?: number;
  isSelfRated?: boolean;
  isCorroborated?: boolean;
  corroborationCount?: number;
  decayApplied?: boolean;
  freshnessNote?: string;
  reason?: string;
}

export const CONFIDENCE_CONFIG = {
  High: {
    label: 'High Confidence',
    shortLabel: 'High',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-200',
    dotClass: 'bg-emerald-600',
  },
  Medium: {
    label: 'Medium Confidence',
    shortLabel: 'Medium',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200',
    dotClass: 'bg-amber-600',
  },
  Low: {
    label: 'Low Confidence',
    shortLabel: 'Low',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    dotClass: 'bg-slate-400',
  },
} as const;

export const TIER_CONFIG = {
  'Must-Know': {
    label: 'Must-Know',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-800',
    borderClass: 'border-rose-200',
    dotClass: 'bg-rose-600',
    description: 'Critical strategic shift requiring immediate executive awareness',
  },
  'Should-Know': {
    label: 'Should-Know',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-200',
    dotClass: 'bg-blue-600',
    description: 'Meaningful competitive development relevant to active planning',
  },
  'Nice-to-Know': {
    label: 'Nice-to-Know',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    dotClass: 'bg-slate-400',
    description: 'Minor or background activity detected across monitored channels',
  },
} as const;

export const CLASSIFIER_CONFIG = {
  Adopting: {
    label: 'Adopting',
    description: 'Demonstrated shipping, production integration, or live capability matching topic keywords',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-200',
    dotClass: 'bg-emerald-600',
    badgeVariant: 'adopting',
  },
  Researching: {
    label: 'Researching',
    description: 'Active engineering investigation, research paper authorship, or prototype development',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-800',
    borderClass: 'border-cyan-200',
    dotClass: 'bg-cyan-600',
    badgeVariant: 'researching',
  },
  Mentioning: {
    label: 'Mentioning',
    description: 'Public discussion, executive commentary, or blog post reference without active shipping evidence',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200',
    dotClass: 'bg-amber-600',
    badgeVariant: 'mentioning',
  },
  'No activity detected': {
    label: 'No activity detected',
    description: 'Audited sweep of all monitored channels (GitHub, jobs, news, pricing, research) with zero matching signals',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-200',
    dotClass: 'bg-slate-400',
    badgeVariant: 'inactive',
  },
} as const;

export function normalizeClassifierState(state?: string | null): ClassifierState {
  if (!state) return 'No activity detected';
  const s = state.trim().toLowerCase();
  if (s === 'adopting') return 'Adopting';
  if (s === 'researching') return 'Researching';
  if (s === 'mentioning') return 'Mentioning';
  return 'No activity detected';
}

export type DirectionalDelta = 'up' | 'flat' | 'down';

export const DIRECTIONAL_CONFIG = {
  up: {
    label: 'Accelerating',
    symbol: '↑',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    iconColor: '#059669',
  },
  flat: {
    label: 'Steady State',
    symbol: '→',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-200',
    iconColor: '#64748b',
  },
  down: {
    label: 'Decelerating',
    symbol: '↓',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    iconColor: '#e11d48',
  },
} as const;

export const SIGNAL_TYPE_CONFIG: Record<SignalType, { bgClass: string; textClass: string; borderClass: string }> = {
  News: { bgClass: 'bg-blue-50', textClass: 'text-blue-700', borderClass: 'border-blue-200' },
  GitHub: { bgClass: 'bg-slate-100', textClass: 'text-slate-800', borderClass: 'border-slate-200' },
  Jobs: { bgClass: 'bg-purple-50', textClass: 'text-purple-700', borderClass: 'border-purple-200' },
  Pricing: { bgClass: 'bg-amber-50', textClass: 'text-amber-800', borderClass: 'border-amber-200' },
  Research: { bgClass: 'bg-cyan-50', textClass: 'text-cyan-700', borderClass: 'border-cyan-200' },
};

