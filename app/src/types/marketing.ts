import type { CampaignVariant } from './api';

export interface CampaignToken {
  token: string;
  sourceField: string;
  tooltip: string;
}

export interface TemplateMetrics {
  primary?: string;
  baselineRate?: number;
  targetRate?: number;
  mde?: number;
  openRateA?: number;
  openRateB?: number | null;
}

export interface MarketingTemplate {
  id: string;
  campaignId: string;
  touchpoint: number;
  channel: 'email' | 'sms';
  subjectA: string;
  subjectB?: string | null;
  body: string;
  mergeTokens: string[];
  metrics: TemplateMetrics;
  abData?: CampaignVariant[];
}
