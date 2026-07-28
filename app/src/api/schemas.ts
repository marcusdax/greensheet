import { z } from 'zod';

export const roasterCreateSchema = z.object({
  roasterName: z.string().min(1).max(200),
  companySize: z.enum(['single_roaster', 'small_chain', 'regional', 'national']).optional(),
  segment: z.enum(['micro', 'boutique', 'commercial']),
  status: z.enum(['active', 'trial', 'dormant', 'churned']).default('trial'),
  businessRegistration: z.string().max(50).optional(),
  billingCycle: z.enum(['monthly', 'quarterly', 'annual']).optional(),
  primaryContact: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    marketingOptIn: z.boolean(),
    consentLegalBasis: z.enum(['consent', 'legitimate_interest', 'contract']).default('consent'),
  }),
});

export const campaignCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  targetAudience: z.object({
    segments: z.array(z.enum(['micro', 'boutique', 'commercial'])).default([]),
    minCupScorePreference: z.number().optional(),
  }).optional(),
});

export const ruleCreateSchema = z.object({
  ruleCode: z.string().regex(/^COF-00[1-9]$/),
  campaignId: z.string().uuid(),
  ruleName: z.string().min(1),
  triggerEvent: z.string().min(1),
  conditionsJson: z.record(z.string(), z.any()).default({}),
  actions: z.array(z.object({
    actionType: z.enum(['SEND_TEMPLATE', 'EXECUTE_CAMPAIGN_HALT', 'UPDATE_CRM_LIFECYCLE', 'CREATE_CRM_TASK', 'ADD_SUPPRESSION']),
    templateId: z.string().uuid().or(z.string().length(0)).optional().nullable().transform((v) => v === '' ? null : v),
    channel: z.enum(['email', 'sms']).optional(),
    payload: z.record(z.string(), z.any()).optional(),
    delayMinutes: z.number().int().min(0).default(0),
  })).min(1),
});

export const lotCreateSchema = z.object({
  origin: z.string().min(1).max(100),
  varietal: z.string().max(100).optional().nullable(),
  processingMethod: z.enum(['washed', 'natural', 'honey', 'anaerobic']).optional().nullable(),
  elevation: z.number().int().positive().optional().nullable(),
  cupScore: z.number().min(0).max(100),
  pricePerLbCents: z.number().int().min(1),
  costPerLbCents: z.number().int().min(0),
  availableQuantityLbs: z.number().int().min(0),
  totalProductionLbs: z.number().int().min(0),
  esgScore: z.number().min(0).max(1).optional().nullable(),
  flavorNotes: z.array(z.string()).default([]),
});

export const reserveSchema = z.object({
  quantityLbs: z.number().int().min(1),
  orderId: z.string().uuid(),
});

export const sampleKitCreateSchema = z.object({
  roasterId: z.string().uuid(),
  lotIds: z.array(z.string().uuid()).min(1).max(8),
  shippingAddress: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    region: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().length(2),
  }),
});

export const orderCreateSchema = z.object({
  accountId: z.string().uuid(),
  lineItems: z.array(z.object({
    lotId: z.string().uuid(),
    quantityLbs: z.number().int().min(1),
    unitPriceCents: z.number().int().min(1),
  })).min(1),
});

export const webhookCreateSchema = z.object({
  url: z.string().url().regex(/^https:\/\//),
  description: z.string().optional(),
  events: z.array(z.string()).min(1),
  challenge: z.string().min(1),
});
