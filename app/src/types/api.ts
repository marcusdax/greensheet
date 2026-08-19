export type Segment = 'micro' | 'boutique' | 'commercial';
export type LifecycleStatus = 'active' | 'trial' | 'dormant' | 'churned';
export type CompanySize = 'single_roaster' | 'small_chain' | 'regional' | 'national';
export type ProcessingMethod = 'washed' | 'natural' | 'honey' | 'anaerobic';
export type LotStatus = 'active' | 'retired';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'retired';
export type RuleStatus = 'armed' | 'paused' | 'retired';
export type SampleKitStatus =
  | 'requested'
  | 'assembling'
  | 'shipped'
  | 'delivered'
  | 'feedback_pending'
  | 'feedback_received'
  | 'exception';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type InterventionType = 'email_campaign' | 'sales_call' | 'discount_offer' | 'survey';
export type InterventionOutcome = 'retained' | 'churned' | 'pending';

export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  traceId?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
}

export interface Roaster {
  id: string;
  roasterName: string;
  companySize?: CompanySize;
  segment: Segment;
  status: LifecycleStatus;
  churnRiskScore: number | null;
  ltvCents: number | null;
  cacCents: number | null;
  paybackMonths: number | null;
  daysSinceLastOrder: number | null;
  totalRevenueCents: number | null;
  totalOrders: number | null;
  billingCycle?: 'monthly' | 'quarterly' | 'annual';
  businessRegistration?: string;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  primaryContact: Contact;
  utm?: UtmAttribution;
  referralCode?: string;
  interventions: Intervention[];
}

export interface RoasterCreate {
  roasterName: string;
  companySize?: CompanySize;
  segment?: Segment;
  businessRegistration?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'annual';
  primaryContact: Contact;
  utm?: UtmAttribution;
  referralCode?: string;
}

export interface RoasterPatch {
  roasterName?: string;
  segment?: Segment;
  status?: LifecycleStatus;
  billingCycle?: 'monthly' | 'quarterly' | 'annual';
}

export interface Contact {
  fullName: string;
  email: string;
  phone?: string;
  marketingOptIn: boolean;
  consentLegalBasis?: 'consent' | 'legitimate_interest' | 'contract';
}

export interface UtmAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

export interface Intervention {
  id: string;
  type: InterventionType;
  date: string;
  outcome: InterventionOutcome;
  notes: string;
}

export interface LtvSnapshot {
  roasterId?: string;
  ltvCents?: number;
  netLtvCents?: number;
  cacCents?: number;
  paybackMonths?: number;
  discountRate?: number;
  computedAt?: string;
  modelVersion?: string;
}

export interface ChurnRiskFeature {
  feature?: string;
  contribution?: number;
}

export interface ChurnRisk {
  roasterId?: string;
  riskScore?: number;
  threshold?: number;
  modelVersion?: string;
  topFeatures?: ChurnRiskFeature[];
  scoredAt?: string;
}

export interface Cohort {
  cohort: string;
  roasters?: number;
  revenueCents?: number;
  orders?: number;
  churnRate?: number;
  period?: string;
}

export interface FunnelStage {
  stage: string;
  count?: number;
  conversionRate?: number;
  revenueCents?: number;
}

export interface ViralReferral {
  referrerId?: string;
  referrals?: number;
  conversions?: number;
  revenueCents?: number;
  period?: string;
}

export interface Forecast {
  period: string;
  revenueCents?: number;
  orders?: number;
  modelVersion?: string;
}

export interface WtrPoint {
  week: string;
  wtr: number;
  movingAverage?: number;
}

export interface KitFunnelStage {
  stage: 'sent' | 'delivered' | 'feedback' | 'first_order';
  count: number;
  conversionRate?: number;
}

export interface CacChannelRow {
  channel: string;
  cac: number;
  spend: number;
  newAccounts: number;
}

export interface HazardHeatmapRow {
  segment: Segment;
  tier: 'T1' | 'T2' | 'T3';
  count: number;
  avgHazard: number;
}

export interface KFactorMetric {
  current: number;
  target: number;
  period: string;
}

export interface CampaignLiftRow {
  campaignId: string;
  campaignName: string;
  lift: number;
  probability: number;
  isSignificant: boolean;
}

export interface CoffeeLot {
  id: string;
  origin: string;
  varietal: string | null;
  processingMethod: ProcessingMethod | null;
  elevation: number | null;
  cupScore: number;
  pricePerLbCents: number;
  costPerLbCents: number;
  availableQuantityLbs: number;
  totalProductionLbs: number;
  esgScore: number | null;
  logisticsScore: number | null;
  carbonFootprintKgCo2PerLb?: number | null;
  certifications: {
    fairTrade: boolean;
    organic: boolean;
    rainforestAlliance: boolean;
  };
  flavorNotes: string[];
  sensoryProfile: { acidity: number; body: number; sweetness: number } | null;
  portOfOrigin: string | null;
  estimatedArrival: string | null;
  status: LotStatus;
  metrics?: CoffeeLotMetrics;
  lastUpdatedAt: string;
}

export interface CoffeeLotMetrics {
  costNorm?: number;
  cupNorm?: number;
  esgNorm?: number;
  logisticsNorm?: number;
  weightedScore?: number;
}

export interface CoffeeLotCreate {
  origin: string;
  varietal?: string;
  processingMethod?: ProcessingMethod;
  elevation?: number;
  cupScore: number;
  pricePerLbCents: number;
  costPerLbCents: number;
  availableQuantityLbs: number;
  totalProductionLbs: number;
  esgScore?: number;
  flavorNotes?: string[];
  confirmBelowCost?: boolean;
}

export interface CoffeeLotPatch {
  pricePerLbCents?: number;
  priceChangeReason?: string;
  availableQuantityLbs?: number;
  status?: LotStatus;
  esgScore?: number;
}

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  version: number;
  targetAudience?: {
    segments: Segment[];
    minCupScorePreference?: number;
  };
  ruleCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CampaignCreate {
  slug: string;
  name: string;
  description?: string;
  targetAudience?: {
    segments: Segment[];
    minCupScorePreference?: number;
  };
}

export interface CampaignPatch {
  name?: string;
  description?: string;
  status?: CampaignStatus;
  targetAudience?: {
    segments: Segment[];
    minCupScorePreference?: number;
  };
}

export interface AutomationRule {
  id: string;
  ruleCode: string;
  campaignId: string | null;
  ruleName: string;
  triggerEvent: string;
  conditionsJson: Record<string, unknown>;
  version: number;
  status: RuleStatus;
  actions: RuleAction[];
}

export interface AutomationRuleCreate {
  ruleCode: string;
  campaignId: string | null;
  ruleName: string;
  triggerEvent: string;
  conditionsJson?: Record<string, unknown>;
  actions: RuleAction[];
}

export interface AutomationRulePatch {
  ruleCode?: string;
  ruleName?: string;
  triggerEvent?: string;
  campaignId?: string | null;
  conditionsJson?: Record<string, unknown>;
  status?: RuleStatus;
  actions?: RuleAction[];
}

export type RuleActionType =
  | 'SEND_TEMPLATE'
  | 'EXECUTE_CAMPAIGN_HALT'
  | 'UPDATE_CRM_LIFECYCLE'
  | 'CREATE_CRM_TASK'
  | 'ADD_SUPPRESSION';

export interface RuleAction {
  actionType: RuleActionType;
  templateId?: string | null;
  channel?: 'email' | 'sms';
  payload?: Record<string, unknown>;
  delayMinutes?: number;
}

export interface CampaignPerformance {
  campaignId?: string;
  sent?: number;
  openRate?: number;
  clickRate?: number;
  conversionRate?: number;
  attributedRevenueCents?: number;
  funnel?: CampaignFunnel;
  variants?: CampaignVariant[];
  computedAt?: string;
}

export interface CampaignFunnel {
  kitSent?: number;
  opened?: number;
  clicked?: number;
  ordered?: number;
  // Extended fields for the COF nurture engine
  feedbackSubmitted?: number;
  responded?: number;
  firstOrders?: number;
  referralSent?: number;
  reordered?: number;
}

export interface CampaignVariant {
  variantName?: string;
  sampleSize?: number;
  conversions?: number;
  conversionRate?: number;
  credibleInterval95?: {
    lower?: number;
    upper?: number;
  };
  probabilityBest?: number;
  isWinner?: boolean;
}

export interface SampleKit {
  id: string;
  roasterId: string;
  status: SampleKitStatus;
  lots: SampleKitLot[];
  trackingNumber: string | null;
  carrier: string | null;
  requestedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  feedbackToken?: string;
  feedback?: SampleFeedback;
  feedbackSubmittedAt?: string | null;
  temporalWorkflowId?: string | null;
}

export interface SampleKitLot {
  lotId: string;
  origin: string;
  cupScore: number;
  pricePerLbCentsAtAssembly: number;
  sampleWeightGrams: number;
}

export interface SampleKitCreate {
  roasterId: string;
  lotIds: string[];
  shippingAddress: ShippingAddress;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface SampleFeedback {
  feedbackToken: string;
  rating: number;
  notes?: string;
  lotRatings?: Array<{ lotId: string; rating: number; wouldOrder?: boolean }>;
  submittedFromIp?: string;
}

export interface OrderLineItem {
  lotId: string;
  quantityLbs: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  accountId: string;
  status: OrderStatus;
  lineItems: OrderLineItem[];
  finalTotalCents: number;
  invoiceNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  description?: string;
  events: string[];
  status: 'active' | 'paused' | 'failing';
  createdAt: string;
}

export interface WebhookSubscriptionWithSecret extends WebhookSubscription {
  signingSecret: string;
}

export interface WebhookSubscriptionCreate {
  url: string;
  description?: string;
  events: string[];
}

export interface WebhookSubscriptionPatch {
  url?: string;
  events?: string[];
  status?: 'active' | 'paused';
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  status: 'pending' | 'delivered' | 'failed' | 'exhausted';
  attempts: number;
  lastStatusCode: number | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  durationMs: number | null;
}

export interface Reservation {
  id: string;
  lotId: string;
  orderId: string;
  quantityLbs: number;
  status: 'active' | 'consumed' | 'released' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface CloudEvent<T = unknown> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject: string;
  time: string;
  data: T;
}

export interface PagedResponse<T> {
  data: T[];
  page: PageInfo;
}
