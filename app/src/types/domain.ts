import type { CoffeeLot } from '../data/lots';

export type { CoffeeLot };

export type SortOrder = 'weighted' | 'price' | 'cup' | 'esg';
export type GoalKey = 'baseline' | 'costOptimized' | 'qualityFirst' | 'sustainability' | 'supplyChain';

export interface SourcingWeights {
  cost: number;
  cup: number;
  esg: number;
  logistics: number;
}

export interface GoalProfile {
  label: string;
  description: string;
  weights: SourcingWeights;
  icon: string;
}

export const GOAL_PROFILES: Record<GoalKey, GoalProfile> = {
  baseline: {
    label: 'Balanced Sourcing',
    description: 'Standard approach balancing quality, cost, and sustainability',
    weights: { cost: 0.25, cup: 0.35, esg: 0.25, logistics: 0.15 },
    icon: 'Scale'
  },
  costOptimized: {
    label: 'Cost Optimization',
    description: 'Maximum margin expansion through aggressive pricing',
    weights: { cost: 0.6, cup: 0.2, esg: 0.1, logistics: 0.1 },
    icon: 'Coins'
  },
  qualityFirst: {
    label: 'Quality Focus',
    description: 'Prioritize highest cup scores for premium product lines',
    weights: { cost: 0.1, cup: 0.7, esg: 0.1, logistics: 0.1 },
    icon: 'Star'
  },
  sustainability: {
    label: 'ESG Champion',
    description: 'Maximize sustainability and ethical sourcing metrics',
    weights: { cost: 0.2, cup: 0.2, esg: 0.5, logistics: 0.1 },
    icon: 'Sprout'
  },
  supplyChain: {
    label: 'Supply Chain Optimized',
    description: 'Focus on logistics efficiency and predictable delivery',
    weights: { cost: 0.2, cup: 0.1, esg: 0.2, logistics: 0.5 },
    icon: 'Ship'
  },
};
