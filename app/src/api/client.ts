import type {
  AutomationRule,
  AutomationRuleCreate,
  AutomationRulePatch,
  CacChannelRow,
  Campaign,
  CampaignCreate,
  CampaignLiftRow,
  CampaignPatch,
  CampaignPerformance,
  CampaignVariant,
  ChurnRisk,
  Cohort,
  CoffeeLot,
  CoffeeLotCreate,
  CoffeeLotPatch,
  Forecast,
  FunnelStage,
  HazardHeatmapRow,
  Intervention,
  KFactorMetric,
  KitFunnelStage,
  LtvSnapshot,
  Order,
  OrderLineItem,
  PagedResponse,
  Problem,
  Reservation,
  Referral,
  ReferralChannel,
  ReferralCode,
  ReferralCodeStatus,
  ReferralStats,
  ReferralStatus,
  RewardLedgerEntry,
  RewardStatus,
  RewardType,
  Roaster,
  RoasterCreate,
  SampleFeedback,
  SampleKit,
  SampleKitCreate,
  SampleKitLot,
  ViralReferral,
  WebhookDelivery,
  WebhookSubscription,
  WebhookSubscriptionCreate,
  WebhookSubscriptionPatch,
  WebhookSubscriptionWithSecret,
  WtrPoint,
} from '../types/api';
import { db, seedDatabase } from './db';
import { GS } from './problems';
import { MARKETING_TEMPLATES } from './marketing-data';

let refCodeCounter = 0;

function nextRefCodeIndex(): number {
  refCodeCounter += 1;
  return refCodeCounter;
}

function generateRefCode(): string {
  const adjectives = ['RIVER', 'BEAN', 'CUP', 'ROAST', 'GREEN', 'FIELD', 'BREW', 'SHEET'];
  const idx = nextRefCodeIndex();
  const word = adjectives[idx % adjectives.length];
  const suffix = String(100 + (idx % 900));
  return `GS-${word}-${suffix}`;
}

function id(): string {
  return `ref_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

seedDatabase();

export type ApiResult<T> =
  | { data: T; problem?: never }
  | { data?: never; problem: Problem };

export function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makePage<T>(items: T[], limit: number, cursor?: string): PagedResponse<T> {
  const start = cursor ? parseInt(cursor, 10) || 0 : 0;
  const end = start + limit;
  const pageItems = items.slice(start, end);
  return {
    data: pageItems,
    page: { nextCursor: end < items.length ? String(end) : null, hasMore: end < items.length },
  };
}

function withoutSigningSecret(sub: WebhookSubscriptionWithSecret): WebhookSubscription {
  const { signingSecret: _, ...rest } = sub;
  return rest;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function checkIdempotency<T>(
  key: string | undefined,
  input: unknown,
): ApiResult<T> | undefined {
  if (!key) {
    return { problem: GS.GEN_1004() };
  }
  const existing = db.idempotency.get(key);
  if (existing) {
    return JSON.stringify(input) === existing.bodyHash
      ? ({ data: deepClone(existing.response) as T } as ApiResult<T>)
      : { problem: GS.GEN_1003() };
  }
  return undefined;
}

function storeIdempotency<T>(key: string, input: unknown, response: T): void {
  db.idempotency.set(key, { bodyHash: JSON.stringify(input), response: deepClone(response) });
}

function buildVariant(
  name: string,
  sampleSize: number,
  ratePercent: number,
  probabilityBest: number,
  isWinner: boolean,
): CampaignVariant {
  const conversions = Math.round(sampleSize * (ratePercent / 100));
  const rate = conversions / sampleSize;
  return {
    variantName: name,
    sampleSize,
    conversions,
    conversionRate: rate,
    credibleInterval95: {
      lower: Math.max(0, rate - 0.02),
      upper: Math.min(1, rate + 0.02),
    },
    probabilityBest,
    isWinner,
  };
}

function firstTouchVariants(campaignId: string): CampaignVariant[] {
  const touch = MARKETING_TEMPLATES.find(
    (t) => t.campaignId === campaignId && t.touchpoint === 1 && t.channel === 'email',
  );
  if (!touch || !touch.subjectB) {
    if (!touch) return [];
    return [buildVariant('A', 600, touch.metrics.openRateA ?? 0, 1.0, true)];
  }
  const aRate = touch.metrics.openRateA ?? 0;
  const bRate = touch.metrics.openRateB ?? 0;
  const aWins = aRate >= bRate;
  return [
    buildVariant('A', 600, aRate, aWins ? 0.68 : 0.32, aWins),
    buildVariant('B', 600, bRate, aWins ? 0.32 : 0.68, !aWins),
  ];
}

export const api = {
  roasters: {
    list: async (
      params: {
        limit?: number;
        cursor?: string;
        status?: Roaster['status'][];
        segment?: Roaster['segment'][];
        minChurnRisk?: number;
      } = {},
    ): Promise<ApiResult<PagedResponse<Roaster>>> => {
      let items = db.roasters;
      if (params.status?.length) {
        items = items.filter((r) => params.status!.includes(r.status));
      }
      if (params.segment?.length) {
        items = items.filter((r) => params.segment!.includes(r.segment));
      }
      if (params.minChurnRisk != null) {
        items = items.filter((r) => (r.churnRiskScore ?? 0) >= params.minChurnRisk!);
      }
      return { data: makePage(items, params.limit ?? 25, params.cursor) };
    },

    get: async (id: string): Promise<ApiResult<Roaster>> => {
      const item = db.roasters.find((r) => r.id === id);
      return item ? { data: item } : { problem: GS.GEN_1005() };
    },

    create: async (
      input: RoasterCreate & { status?: Roaster['status']; segment?: Roaster['segment'] },
      key?: string,
    ): Promise<ApiResult<Roaster>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<Roaster>(key, body);
      if (conflict) return conflict;

      if (
        body.businessRegistration &&
        db.roasters.some(
          (r) => r.businessRegistration && r.businessRegistration === body.businessRegistration,
        )
      ) {
        return { problem: GS.CRM_1001() };
      }

      const roaster: Roaster = {
        ...body,
        segment: body.segment ?? 'micro',
        status: body.status ?? 'trial',
        churnRiskScore: null,
        ltvCents: null,
        cacCents: null,
        paybackMonths: null,
        daysSinceLastOrder: null,
        totalRevenueCents: null,
        totalOrders: null,
        lastActivityAt: null,
        id: idempotencyKey(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        interventions: [],
      };
      db.roasters.push(roaster);
      storeIdempotency(key!, body, roaster);
      return { data: roaster };
    },

    patch: async (id: string, patch: Partial<Roaster>): Promise<ApiResult<Roaster>> => {
      const idx = db.roasters.findIndex((r) => r.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.roasters[idx] = { ...db.roasters[idx], ...patch, updatedAt: nowIso() };
      return { data: db.roasters[idx] };
    },

    logIntervention: async (
      roasterId: string,
      input: { idempotencyKey: string; intervention: Omit<Intervention, 'id'> },
    ): Promise<ApiResult<Roaster>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<Roaster>(input.idempotencyKey, body);
      if (conflict) return conflict;

      const roasterIdx = db.roasters.findIndex((r) => r.id === roasterId);
      if (roasterIdx === -1) return { problem: GS.GEN_1005() };

      const intervention: Intervention = { ...body.intervention, id: idempotencyKey() };
      db.roasters[roasterIdx] = {
        ...db.roasters[roasterIdx],
        interventions: [...db.roasters[roasterIdx].interventions, intervention],
        updatedAt: nowIso(),
      };
      const updatedRoaster = deepClone(db.roasters[roasterIdx]);
      storeIdempotency(input.idempotencyKey, body, updatedRoaster);
      return { data: updatedRoaster };
    },
  },

  campaigns: {
    list: async (
      params: { limit?: number; cursor?: string; status?: Campaign['status'][] } = {},
    ): Promise<ApiResult<PagedResponse<Campaign>>> => {
      let items = db.campaigns;
      if (params.status?.length) {
        items = items.filter((c) => params.status!.includes(c.status));
      }
      return { data: makePage(items, params.limit ?? 25, params.cursor) };
    },

    get: async (id: string): Promise<ApiResult<Campaign>> => {
      const item = db.campaigns.find((c) => c.id === id);
      return item ? { data: item } : { problem: GS.GEN_1005() };
    },

    create: async (input: CampaignCreate, key?: string): Promise<ApiResult<Campaign>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<Campaign>(key, body);
      if (conflict) return conflict;

      const campaign: Campaign = {
        ...body,
        id: idempotencyKey(),
        status: 'draft',
        version: 1,
        ruleCodes: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.campaigns.push(campaign);
      storeIdempotency(key!, body, campaign);
      return { data: campaign };
    },

    patch: async (id: string, patch: CampaignPatch): Promise<ApiResult<Campaign>> => {
      const idx = db.campaigns.findIndex((c) => c.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      const next = { ...db.campaigns[idx], ...patch, updatedAt: nowIso() };
      if (patch.status && patch.status !== db.campaigns[idx].status) {
        next.version = db.campaigns[idx].version + 1;
      }
      db.campaigns[idx] = next;
      return { data: db.campaigns[idx] };
    },

    halt: async (id: string): Promise<ApiResult<Campaign>> => {
      const idx = db.campaigns.findIndex((c) => c.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.campaigns[idx] = { ...db.campaigns[idx], status: 'paused', updatedAt: nowIso() };
      return { data: db.campaigns[idx] };
    },

    performance: async (id: string): Promise<ApiResult<CampaignPerformance>> => {
      const campaign = db.campaigns.find((c) => c.id === id);
      if (!campaign) return { problem: GS.GEN_1005() };

      const now = nowIso();
      const code = campaign.slug; // cof-001 .. cof-005

      const presets: Record<string, CampaignPerformance> = {
        'cof-001': {
          campaignId: id,
          sent: 1000,
          openRate: 0.52,
          clickRate: 0.234,
          conversionRate: 0.32,
          attributedRevenueCents: 0,
          funnel: { kitSent: 1000, opened: 520, clicked: 234, ordered: 320 },
          variants: firstTouchVariants('COF-001'),
          computedAt: now,
        },
        'cof-002': {
          campaignId: id,
          sent: 320,
          openRate: 0.52,
          clickRate: 0.234,
          conversionRate: 0.45,
          attributedRevenueCents: 0,
          funnel: { kitSent: 320, opened: 166, clicked: 75, ordered: 144, feedbackSubmitted: 144 },
          variants: firstTouchVariants('COF-002'),
          computedAt: now,
        },
        'cof-003': {
          campaignId: id,
          sent: 144,
          openRate: 0.45,
          clickRate: 0.20,
          conversionRate: 0.40,
          attributedRevenueCents: 3_770_000,
          funnel: { feedbackSubmitted: 144, opened: 65, clicked: 29, ordered: 58 },
          variants: firstTouchVariants('COF-003'),
          computedAt: now,
        },
        'cof-004': {
          campaignId: id,
          sent: 176,
          openRate: 0.28,
          clickRate: 0.11,
          conversionRate: 0.18,
          attributedRevenueCents: 0,
          funnel: { kitSent: 176, opened: 49, clicked: 19, ordered: 32, responded: 32 },
          variants: firstTouchVariants('COF-004'),
          computedAt: now,
        },
        'cof-005': {
          campaignId: id,
          sent: 58,
          openRate: 0.38,
          clickRate: 0.14,
          conversionRate: 0.55,
          attributedRevenueCents: 2_080_000,
          funnel: { firstOrders: 58, referralSent: 55, reordered: 32, opened: 22, clicked: 8, ordered: 32 },
          variants: firstTouchVariants('COF-005'),
          computedAt: now,
        },
      };

      const preset = presets[code];
      if (!preset) return { problem: GS.GEN_1005() };
      return { data: preset };
    },
  },

  rules: {
    list: async (
      params: {
        limit?: number;
        cursor?: string;
        campaignId?: string;
        status?: AutomationRule['status'][];
      } = {},
    ): Promise<ApiResult<PagedResponse<AutomationRule>>> => {
      let items = db.rules;
      if (params.campaignId) {
        items = items.filter((r) => r.campaignId === params.campaignId);
      }
      if (params.status?.length) {
        items = items.filter((r) => params.status!.includes(r.status));
      }
      return { data: makePage(items, params.limit ?? 25, params.cursor) };
    },

    get: async (id: string): Promise<ApiResult<AutomationRule>> => {
      const item = db.rules.find((r) => r.id === id);
      return item ? { data: item } : { problem: GS.GEN_1005() };
    },

    create: async (
      input: AutomationRuleCreate,
      key?: string,
    ): Promise<ApiResult<AutomationRule>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<AutomationRule>(key, body);
      if (conflict) return conflict;

      const campaignId = body.campaignId === '' ? null : body.campaignId ?? null;

      if (campaignId) {
        const campaign = db.campaigns.find((c) => c.id === campaignId);
        if (!campaign) return { problem: GS.GEN_1005() };
      }
      if (db.rules.some((r) => r.ruleCode === body.ruleCode)) {
        return { problem: GS.CMP_1003() };
      }

      const rule: AutomationRule = {
        ...body,
        conditionsJson: body.conditionsJson ?? {},
        campaignId,
        id: idempotencyKey(),
        version: 1,
        status: 'armed',
      };
      db.rules.push(rule);
      if (campaignId) {
        const campaign = db.campaigns.find((c) => c.id === campaignId)!;
        campaign.ruleCodes = [...campaign.ruleCodes, rule.ruleCode];
      }
      storeIdempotency(key!, body, rule);
      return { data: rule };
    },

    patch: async (id: string, patch: AutomationRulePatch): Promise<ApiResult<AutomationRule>> => {
      const idx = db.rules.findIndex((r) => r.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      const existing = db.rules[idx];

      const hasPatchField =
        'ruleCode' in patch ||
        'ruleName' in patch ||
        'triggerEvent' in patch ||
        'campaignId' in patch ||
        'conditionsJson' in patch ||
        'status' in patch ||
        'actions' in patch;

      if ('ruleCode' in patch && patch.ruleCode !== existing.ruleCode) {
        if (db.rules.some((r) => r.ruleCode === patch.ruleCode && r.id !== id)) {
          return { problem: GS.CMP_1003() };
        }
      }

      const patchCampaignId = patch.campaignId === '' ? null : patch.campaignId;

      const newRuleCode = patch.ruleCode ?? existing.ruleCode;

      if (patchCampaignId !== undefined && patchCampaignId !== existing.campaignId) {
        let oldCampaign: Campaign | undefined;
        if (existing.campaignId) {
          oldCampaign = db.campaigns.find((c) => c.id === existing.campaignId);
          if (!oldCampaign) return { problem: GS.GEN_1005() };
        }

        let newCampaign: Campaign | undefined;
        if (patchCampaignId) {
          newCampaign = db.campaigns.find((c) => c.id === patchCampaignId);
          if (!newCampaign) return { problem: GS.GEN_1005() };
        }

        if (oldCampaign) {
          oldCampaign.ruleCodes = oldCampaign.ruleCodes.filter((code) => code !== existing.ruleCode);
        }
        if (newCampaign) {
          newCampaign.ruleCodes = [...newCampaign.ruleCodes, newRuleCode];
        }
      } else if ('ruleCode' in patch && patch.ruleCode !== existing.ruleCode && existing.campaignId) {
        const campaign = db.campaigns.find((c) => c.id === existing.campaignId);
        if (!campaign) return { problem: GS.GEN_1005() };
        campaign.ruleCodes = campaign.ruleCodes.map((code) => (code === existing.ruleCode ? newRuleCode : code));
      }

      const next = { ...existing, ...patch };
      if ('campaignId' in patch && patchCampaignId !== undefined) {
        next.campaignId = patchCampaignId;
      }
      if (hasPatchField) {
        next.version = existing.version + 1;
      }
      db.rules[idx] = next;
      return { data: db.rules[idx] };
    },

    delete: async (id: string): Promise<ApiResult<void>> => {
      const idx = db.rules.findIndex((r) => r.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      const rule = db.rules[idx];
      if (rule.campaignId) {
        const campaign = db.campaigns.find((c) => c.id === rule.campaignId);
        if (campaign) {
          campaign.ruleCodes = campaign.ruleCodes.filter((code) => code !== rule.ruleCode);
        }
      }
      db.rules.splice(idx, 1);
      return { data: undefined };
    },
  },

  catalog: {
    list: async (
      params: {
        limit?: number;
        cursor?: string;
        origins?: string[];
        minCupScore?: number;
        maxPricePerLbCents?: number;
      } = {},
    ): Promise<ApiResult<PagedResponse<CoffeeLot>>> => {
      let items = db.lots;
      if (params.origins?.length) {
        items = items.filter((l) => params.origins!.includes(l.origin));
      }
      if (params.minCupScore != null) {
        items = items.filter((l) => l.cupScore >= params.minCupScore!);
      }
      if (params.maxPricePerLbCents != null) {
        items = items.filter((l) => l.pricePerLbCents <= params.maxPricePerLbCents!);
      }
      return { data: makePage(items, params.limit ?? 25, params.cursor) };
    },

    get: async (id: string): Promise<ApiResult<CoffeeLot>> => {
      const item = db.lots.find((l) => l.id === id);
      return item ? { data: item } : { problem: GS.GEN_1005() };
    },

    create: async (input: CoffeeLotCreate, key?: string): Promise<ApiResult<CoffeeLot>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<CoffeeLot>(key, body);
      if (conflict) return conflict;

      const errors: { field: string; code: string; message: string }[] = [];
      if (!Number.isInteger(body.pricePerLbCents) || body.pricePerLbCents <= 0) {
        errors.push({
          field: 'pricePerLbCents',
          code: 'invalid',
          message: 'pricePerLbCents must be a positive integer',
        });
      }
      if (!Number.isInteger(body.costPerLbCents) || body.costPerLbCents <= 0) {
        errors.push({
          field: 'costPerLbCents',
          code: 'invalid',
          message: 'costPerLbCents must be a positive integer',
        });
      }
      if (errors.length) {
        return { problem: GS.GEN_1000(errors) };
      }

      const lot: CoffeeLot = {
        ...body,
        varietal: body.varietal ?? null,
        processingMethod: body.processingMethod ?? null,
        elevation: body.elevation ?? null,
        esgScore: body.esgScore ?? null,
        logisticsScore: null,
        certifications: { fairTrade: false, organic: false, rainforestAlliance: false },
        flavorNotes: body.flavorNotes ?? [],
        sensoryProfile: null,
        portOfOrigin: null,
        estimatedArrival: null,
        status: 'active',
        metrics: undefined,
        id: idempotencyKey(),
        lastUpdatedAt: nowIso(),
      };
      db.lots.push(lot);
      storeIdempotency(key!, body, lot);
      return { data: lot };
    },

    patch: async (id: string, patch: CoffeeLotPatch): Promise<ApiResult<CoffeeLot>> => {
      const idx = db.lots.findIndex((l) => l.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      if (
        patch.pricePerLbCents !== undefined &&
        (!Number.isInteger(patch.pricePerLbCents) || patch.pricePerLbCents <= 0)
      ) {
        return {
          problem: GS.GEN_1000([
            { field: 'pricePerLbCents', code: 'invalid', message: 'pricePerLbCents must be a positive integer' },
          ]),
        };
      }
      db.lots[idx] = { ...db.lots[idx], ...patch, lastUpdatedAt: nowIso() };
      return { data: db.lots[idx] };
    },

    reserve: async (
      lotId: string,
      input: { quantityLbs: number; orderId: string },
      key: string,
    ): Promise<ApiResult<Reservation>> => {
      const body = { lotId, ...input };
      const conflict = checkIdempotency<Reservation>(key, body);
      if (conflict) return conflict;

      if (!Number.isInteger(input.quantityLbs) || input.quantityLbs <= 0) {
        return {
          problem: GS.GEN_1000([
            { field: 'quantityLbs', code: 'invalid', message: 'quantityLbs must be a positive integer' },
          ]),
        };
      }

      const lot = db.lots.find((l) => l.id === lotId);
      if (!lot) return { problem: GS.GEN_1005() };
      if (lot.status === 'retired') return { problem: GS.CAT_1002() };
      if (lot.availableQuantityLbs < input.quantityLbs) {
        return {
          problem: GS.CAT_1001(
            `Lot ${lotId} has ${lot.availableQuantityLbs} lbs available; ${input.quantityLbs} requested.`,
          ),
        };
      }
      lot.availableQuantityLbs -= input.quantityLbs;
      const reservation: Reservation = {
        id: idempotencyKey(),
        lotId,
        orderId: input.orderId,
        quantityLbs: input.quantityLbs,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        createdAt: nowIso(),
      };
      db.reservations.push(reservation);
      storeIdempotency(key, body, reservation);
      return { data: reservation };
    },
  },

  sampleKits: {
    list: async (
      params: {
        limit?: number;
        cursor?: string;
        roasterId?: string;
        status?: SampleKit['status'][];
      } = {},
    ): Promise<ApiResult<PagedResponse<SampleKit>>> => {
      let items = db.sampleKits;
      if (params.roasterId) {
        items = items.filter((k) => k.roasterId === params.roasterId);
      }
      if (params.status?.length) {
        items = items.filter((k) => params.status!.includes(k.status));
      }
      return { data: makePage(items, params.limit ?? 25, params.cursor) };
    },

    get: async (id: string): Promise<ApiResult<SampleKit>> => {
      const item = db.sampleKits.find((k) => k.id === id);
      return item ? { data: item } : { problem: GS.GEN_1005() };
    },

    create: async (input: SampleKitCreate, key?: string): Promise<ApiResult<SampleKit>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<SampleKit>(key, body);
      if (conflict) return conflict;

      const roaster = db.roasters.find((r) => r.id === body.roasterId);
      if (!roaster) return { problem: GS.GEN_1005() };

      const lots: SampleKitLot[] = [];
      for (const lotId of body.lotIds) {
        const lot = db.lots.find((l) => l.id === lotId);
        if (!lot) return { problem: GS.GEN_1005() };
        lots.push({
          lotId,
          origin: lot.origin,
          cupScore: lot.cupScore,
          pricePerLbCentsAtAssembly: lot.pricePerLbCents,
          sampleWeightGrams: 200,
        });
      }

      const kit: SampleKit = {
        id: idempotencyKey(),
        roasterId: body.roasterId,
        status: 'requested',
        lots,
        trackingNumber: null,
        carrier: null,
        requestedAt: nowIso(),
        shippedAt: null,
        deliveredAt: null,
        feedbackToken: idempotencyKey(),
        temporalWorkflowId: null,
      };
      db.sampleKits.push(kit);
      storeIdempotency(key!, body, kit);
      return { data: kit };
    },

    feedback: async (input: SampleFeedback, key?: string): Promise<ApiResult<SampleKit>> => {
      const body = deepClone(input);
      if (key) {
        const conflict = checkIdempotency<SampleKit>(key, body);
        if (conflict) return conflict;
      }

      const kit = db.sampleKits.find((k) => k.feedbackToken === input.feedbackToken);
      if (!kit) return { problem: GS.GEN_1005() };
      kit.status = 'feedback_received';
      kit.feedback = body;
      kit.feedbackSubmittedAt = nowIso();
      if (key) storeIdempotency(key, body, kit);
      return { data: kit };
    },
  },

  orders: {
    list: async (
      params: {
        limit?: number;
        cursor?: string;
        accountId?: string;
        status?: Order['status'][];
      } = {},
    ): Promise<ApiResult<PagedResponse<Order>>> => {
      let items = db.orders;
      if (params.accountId) {
        items = items.filter((o) => o.accountId === params.accountId);
      }
      if (params.status?.length) {
        items = items.filter((o) => params.status!.includes(o.status));
      }
      return { data: makePage(items, params.limit ?? 25, params.cursor) };
    },

    get: async (id: string): Promise<ApiResult<Order>> => {
      const item = db.orders.find((o) => o.id === id);
      return item ? { data: item } : { problem: GS.GEN_1005() };
    },

    create: async (
      input: { accountId: string; lineItems: OrderLineItem[] },
      key?: string,
    ): Promise<ApiResult<Order>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<Order>(key, body);
      if (conflict) return conflict;

      const lineItems = body.lineItems;
      if (!lineItems.length) {
        return {
          problem: GS.GEN_1000([
            { field: 'lineItems', code: 'required', message: 'At least one line item is required' },
          ]),
        };
      }
      const seenLotIds = new Set<string>();
      for (const item of lineItems) {
        if (!Number.isInteger(item.quantityLbs) || item.quantityLbs <= 0) {
          return {
            problem: GS.GEN_1000([
              { field: 'quantityLbs', code: 'invalid', message: 'quantityLbs must be a positive integer' },
            ]),
          };
        }
        if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents <= 0) {
          return {
            problem: GS.GEN_1000([
              { field: 'unitPriceCents', code: 'invalid', message: 'unitPriceCents must be a positive integer' },
            ]),
          };
        }
        if (seenLotIds.has(item.lotId)) {
          return {
            problem: GS.GEN_1000([
              { field: 'lineItems', code: 'duplicate_lot', message: `Duplicate lotId ${item.lotId} in order` },
            ]),
          };
        }
        seenLotIds.add(item.lotId);

        const lot = db.lots.find((l) => l.id === item.lotId);
        if (!lot) return { problem: GS.GEN_1005() };
        if (lot.status === 'retired') return { problem: GS.CAT_1002() };
        if (lot.availableQuantityLbs < item.quantityLbs) {
          return {
            problem: GS.CAT_1001(
              `Lot ${item.lotId} has ${lot.availableQuantityLbs} lbs available; ${item.quantityLbs} requested.`,
            ),
          };
        }
      }

      for (const item of lineItems) {
        const lot = db.lots.find((l) => l.id === item.lotId)!;
        lot.availableQuantityLbs -= item.quantityLbs;
      }

      const finalTotalCents = lineItems.reduce(
        (sum, item) => sum + item.quantityLbs * item.unitPriceCents,
        0,
      );

      const order: Order = {
        id: idempotencyKey(),
        accountId: body.accountId,
        status: 'pending',
        lineItems,
        finalTotalCents,
        invoiceNumber: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.orders.push(order);
      storeIdempotency(key!, body, order);
      return { data: order };
    },

    process: async (id: string): Promise<ApiResult<Order>> => {
      const idx = db.orders.findIndex((o) => o.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.orders[idx] = { ...db.orders[idx], status: 'processing', updatedAt: nowIso() };
      return { data: db.orders[idx] };
    },

    ship: async (id: string): Promise<ApiResult<Order>> => {
      const idx = db.orders.findIndex((o) => o.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.orders[idx] = { ...db.orders[idx], status: 'shipped', updatedAt: nowIso() };
      return { data: db.orders[idx] };
    },

    deliver: async (id: string): Promise<ApiResult<Order>> => {
      const idx = db.orders.findIndex((o) => o.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.orders[idx] = { ...db.orders[idx], status: 'delivered', updatedAt: nowIso() };
      return { data: db.orders[idx] };
    },

    cancel: async (id: string): Promise<ApiResult<Order>> => {
      const idx = db.orders.findIndex((o) => o.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.orders[idx] = { ...db.orders[idx], status: 'cancelled', updatedAt: nowIso() };
      return { data: db.orders[idx] };
    },

    return: async (id: string): Promise<ApiResult<Order>> => {
      const idx = db.orders.findIndex((o) => o.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.orders[idx] = { ...db.orders[idx], status: 'returned', updatedAt: nowIso() };
      return { data: db.orders[idx] };
    },
  },

  webhooks: {
    list: async (
      params: { limit?: number; cursor?: string; status?: WebhookSubscription['status'][] } = {},
    ): Promise<ApiResult<PagedResponse<WebhookSubscription>>> => {
      let items = db.webhooks;
      if (params.status?.length) {
        items = items.filter((w) => params.status!.includes(w.status));
      }
      return { data: makePage(items.map(withoutSigningSecret), params.limit ?? 25, params.cursor) };
    },

    get: async (id: string): Promise<ApiResult<WebhookSubscription>> => {
      const item = db.webhooks.find((w) => w.id === id);
      return item ? { data: withoutSigningSecret(item) } : { problem: GS.GEN_1005() };
    },

    create: async (
      input: WebhookSubscriptionCreate,
      key?: string,
    ): Promise<ApiResult<WebhookSubscriptionWithSecret>> => {
      const body = deepClone(input);
      const conflict = checkIdempotency<WebhookSubscriptionWithSecret>(key, body);
      if (conflict) return conflict;

      const subscription: WebhookSubscriptionWithSecret = {
        ...body,
        id: idempotencyKey(),
        status: 'active',
        createdAt: nowIso(),
        signingSecret: `whsec_${idempotencyKey()}`,
      };
      db.webhooks.push(subscription);
      storeIdempotency(key!, body, subscription);
      return { data: subscription };
    },

    patch: async (id: string, patch: WebhookSubscriptionPatch): Promise<ApiResult<WebhookSubscription>> => {
      const idx = db.webhooks.findIndex((w) => w.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.webhooks[idx] = { ...db.webhooks[idx], ...patch };
      return { data: withoutSigningSecret(db.webhooks[idx]) };
    },

    delete: async (id: string): Promise<ApiResult<void>> => {
      const idx = db.webhooks.findIndex((w) => w.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.webhooks.splice(idx, 1);
      return { data: undefined };
    },

    deliveries: async (id: string): Promise<ApiResult<WebhookDelivery[]>> => {
      const subscription = db.webhooks.find((w) => w.id === id);
      if (!subscription) return { problem: GS.GEN_1005() };
      return {
        data: [
          {
            id: idempotencyKey(),
            eventType: subscription.events[0] ?? 'order.created',
            status: 'delivered',
            attempts: 1,
            lastStatusCode: 200,
            lastAttemptAt: nowIso(),
            nextAttemptAt: null,
            durationMs: 120,
          },
        ],
      };
    },
  },

  analytics: {
    cohorts: async (): Promise<ApiResult<{ cohorts: Cohort[] }>> => {
      return {
        data: {
          cohorts: [
            { cohort: '2025-01', roasters: 120, revenueCents: 1_200_000, orders: 450, churnRate: 0.05, period: '2025-01' },
            { cohort: '2025-02', roasters: 140, revenueCents: 1_450_000, orders: 520, churnRate: 0.04, period: '2025-02' },
          ],
        },
      };
    },
    ltv: async (): Promise<ApiResult<{ snapshots: LtvSnapshot[] }>> => {
      return {
        data: {
          snapshots: [
            { roasterId: 'r_001', ltvCents: 12_450_000, cacCents: 85_000, paybackMonths: 4, computedAt: nowIso(), modelVersion: 'ltv-v1' },
          ],
        },
      };
    },
    churn: async (): Promise<ApiResult<{ risks: ChurnRisk[] }>> => {
      return {
        data: {
          risks: [
            { roasterId: 'r_001', riskScore: 0.12, threshold: 0.3, modelVersion: 'churn-v1', topFeatures: [], scoredAt: nowIso() },
          ],
        },
      };
    },
    funnel: async (): Promise<ApiResult<{ stages: FunnelStage[] }>> => {
      return {
        data: {
          stages: [
            { stage: 'awareness', count: 5000, conversionRate: 0.25 },
            { stage: 'consideration', count: 1250, conversionRate: 0.12 },
            { stage: 'purchase', count: 150, conversionRate: 1.0, revenueCents: 2_000_000 },
          ],
        },
      };
    },
    viral: async (): Promise<ApiResult<{ referrals: ViralReferral[] }>> => {
      return {
        data: {
          referrals: [
            { referrerId: 'r_001', referrals: 12, conversions: 4, revenueCents: 800_000, period: '2025-06' },
          ],
        },
      };
    },
    forecast: async (): Promise<ApiResult<{ forecast: Forecast[] }>> => {
      return {
        data: {
          forecast: [
            { period: '2025-08', revenueCents: 5_000_000, orders: 1200, modelVersion: 'forecast-v1' },
            { period: '2025-09', revenueCents: 5_400_000, orders: 1300, modelVersion: 'forecast-v1' },
          ],
        },
      };
    },
    wtr: async (): Promise<ApiResult<{ points: WtrPoint[] }>> => {
      return {
        data: {
          points: [
            { week: '2025-W18', wtr: 142, movingAverage: 138 },
            { week: '2025-W19', wtr: 148, movingAverage: 142 },
            { week: '2025-W20', wtr: 155, movingAverage: 146 },
            { week: '2025-W21', wtr: 151, movingAverage: 150 },
            { week: '2025-W22', wtr: 162, movingAverage: 154 },
            { week: '2025-W23', wtr: 168, movingAverage: 160 },
            { week: '2025-W24', wtr: 175, movingAverage: 165 },
            { week: '2025-W25', wtr: 171, movingAverage: 169 },
          ],
        },
      };
    },
    kitFunnel: async (): Promise<ApiResult<{ stages: KitFunnelStage[] }>> => {
      return {
        data: {
          stages: [
            { stage: 'sent', count: 1000, conversionRate: 100 },
            { stage: 'delivered', count: 920, conversionRate: 92 },
            { stage: 'feedback', count: 414, conversionRate: 45 },
            { stage: 'first_order', count: 166, conversionRate: 40 },
          ],
        },
      };
    },
    cacByChannel: async (): Promise<ApiResult<{ channels: CacChannelRow[]; ceiling: number }>> => {
      return {
        data: {
          ceiling: 500,
          channels: [
            { channel: 'Sample-kit program', cac: 210, spend: 126_000, newAccounts: 600 },
            { channel: 'Community & referral', cac: 95, spend: 19_000, newAccounts: 200 },
            { channel: 'Content/SEO + video', cac: 175, spend: 52_500, newAccounts: 300 },
            { channel: 'LinkedIn + trade pubs', cac: 380, spend: 57_000, newAccounts: 150 },
            { channel: 'Trade shows / events', cac: 420, spend: 42_000, newAccounts: 100 },
            { channel: 'Lifecycle / email-SMS', cac: 130, spend: 13_000, newAccounts: 100 },
            { channel: 'Partnerships', cac: 150, spend: 22_500, newAccounts: 150 },
          ],
        },
      };
    },
    hazardHeatmap: async (): Promise<ApiResult<{ rows: HazardHeatmapRow[] }>> => {
      return {
        data: {
          rows: [
            { segment: 'micro', tier: 'T1', count: 45, avgHazard: 0.22 },
            { segment: 'micro', tier: 'T2', count: 32, avgHazard: 0.51 },
            { segment: 'micro', tier: 'T3', count: 18, avgHazard: 0.78 },
            { segment: 'boutique', tier: 'T1', count: 28, avgHazard: 0.18 },
            { segment: 'boutique', tier: 'T2', count: 19, avgHazard: 0.47 },
            { segment: 'boutique', tier: 'T3', count: 8, avgHazard: 0.81 },
            { segment: 'commercial', tier: 'T1', count: 14, avgHazard: 0.15 },
            { segment: 'commercial', tier: 'T2', count: 9, avgHazard: 0.44 },
            { segment: 'commercial', tier: 'T3', count: 3, avgHazard: 0.73 },
          ],
        },
      };
    },
    kFactor: async (): Promise<ApiResult<{ metric: KFactorMetric }>> => {
      return {
        data: {
          metric: { current: 0.58, target: 0.6, period: '2025-06' },
        },
      };
    },
    campaignLift: async (): Promise<ApiResult<{ campaigns: CampaignLiftRow[] }>> => {
      return {
        data: {
          campaigns: [
            { campaignId: 'cof-001', campaignName: 'COF-001 Welcome', lift: 0.12, probability: 0.97, isSignificant: true },
            { campaignId: 'cof-002', campaignName: 'COF-002 Feedback', lift: 0.08, probability: 0.91, isSignificant: false },
            { campaignId: 'cof-003', campaignName: 'COF-003 First Order', lift: 0.18, probability: 0.99, isSignificant: true },
            { campaignId: 'cof-004', campaignName: 'COF-004 Reorder', lift: 0.05, probability: 0.88, isSignificant: false },
            { campaignId: 'cof-005', campaignName: 'COF-005 Win-back', lift: 0.22, probability: 0.96, isSignificant: true },
          ],
        },
      };
    },
  },

  referrals: {
    getCodeForAccount: async (accountId: string): Promise<ApiResult<{ code: ReferralCode }>> => {
      const existing = db.referralCodes.find((c) => c.accountId === accountId && c.status === 'active');
      if (existing) return { data: { code: existing } };

      const code: ReferralCode = {
        id: id(),
        accountId,
        code: generateRefCode(),
        status: 'active',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.referralCodes.push(code);
      return { data: { code } };
    },

    createCode: async (
      accountId: string,
      requestedCode?: string,
    ): Promise<ApiResult<{ code: ReferralCode }>> => {
      const active = db.referralCodes.find((c) => c.accountId === accountId && c.status === 'active');
      if (active) return { data: { code: active } };

      let codeText: string;
      if (requestedCode && /^GS-[A-Z]{2,6}-\d{1,4}$/.test(requestedCode)) {
        const taken = db.referralCodes.some(
          (c) => c.code.toLowerCase() === requestedCode.toLowerCase(),
        );
        if (taken) {
          return {
            problem: {
              type: 'about:blank',
              title: 'Code already taken',
              status: 409,
              code: 'GS-REF-1001',
              detail: `The referral code ${requestedCode} is already in use.`,
            },
          };
        }
        codeText = requestedCode;
      } else {
        codeText = generateRefCode();
      }

      const code: ReferralCode = {
        id: id(),
        accountId,
        code: codeText,
        status: 'active',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.referralCodes.push(code);
      return { data: { code } };
    },

    listReferrals: async (accountId: string): Promise<ApiResult<{ referrals: Referral[] }>> => {
      const referrals = db.referrals
        .filter((r) => r.referrerId === accountId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { data: { referrals } };
    },

    listLedger: async (
      accountId: string,
    ): Promise<ApiResult<{ entries: RewardLedgerEntry[] }>> => {
      const entries = db.rewardsLedger
        .filter((e) => e.accountId === accountId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { data: { entries } };
    },

    getStats: async (accountId: string): Promise<ApiResult<{ stats: ReferralStats }>> => {
      const referrals = db.referrals.filter((r) => r.referrerId === accountId);
      const entries = db.rewardsLedger.filter((e) => e.accountId === accountId);

      const statusIndex: Record<ReferralStatus, number> = {
        invited: 0,
        clicked: 1,
        signed_up: 2,
        kit_requested: 3,
        kit_delivered: 4,
        feedback_submitted: 5,
        first_order_delivered: 6,
        qualified: 7,
        clawed_back: 7,
      };

      const clicks = referrals.filter((r) => statusIndex[r.status] >= 1).length;
      const signups = referrals.filter((r) => statusIndex[r.status] >= 2).length;
      const kitRequests = referrals.filter((r) => statusIndex[r.status] >= 3).length;
      const kitDeliveries = referrals.filter((r) => statusIndex[r.status] >= 4).length;
      const feedbackSubmitted = referrals.filter((r) => statusIndex[r.status] >= 5).length;
      const qualifiedReferrals = referrals.filter((r) => r.status === 'qualified').length;
      const clawedBack = referrals.filter((r) => r.status === 'clawed_back').length;

      const pendingRewardsCents = entries
        .filter((e) => e.type === 'referrer_credit' && e.status === 'pending')
        .reduce((sum, e) => sum + e.amountCents, 0);
      const earnedRewardsCents = entries
        .filter((e) => e.type === 'referrer_credit' && e.status === 'posted')
        .reduce((sum, e) => sum + e.amountCents, 0);
      const clawedBackRewardsCents = entries
        .filter((e) => e.type === 'referrer_credit' && e.status === 'clawed_back')
        .reduce((sum, e) => sum + e.amountCents, 0);

      // K-factor = qualified referrals / active roasters, simplified to seeded account count
      const activeAccounts = Math.max(db.roasters.filter((r) => r.status === 'active').length, 1);
      const kFactor = Math.round((qualifiedReferrals / activeAccounts) * 100) / 100;

      const stats: ReferralStats = {
        accountId,
        invitesSent: referrals.length,
        clicks,
        signups,
        kitRequests,
        kitDeliveries,
        feedbackSubmitted,
        qualifiedReferrals,
        pendingRewardsCents,
        earnedRewardsCents,
        clawedBackRewardsCents,
        kFactor,
      };
      return { data: { stats } };
    },

    recordClick: async (
      code: string,
      channel: ReferralChannel = 'invite_link',
    ): Promise<ApiResult<{ referral: Referral }>> => {
      const refCode = db.referralCodes.find(
        (c) => c.code.toLowerCase() === code.toLowerCase() && c.status === 'active',
      );
      if (!refCode) {
        return {
          problem: {
            type: 'about:blank',
            title: 'Referral code not found',
            status: 404,
            code: 'GS-REF-1002',
            detail: `No active referral code found for ${code}.`,
          },
        };
      }

      const existing = db.referrals.find(
        (r) => r.refCode.toLowerCase() === code.toLowerCase() && r.status === 'invited' && !r.refereeId,
      );

      const now = nowIso();
      if (existing) {
        existing.status = 'clicked';
        existing.channel = channel;
        existing.clickedAt = now;
        existing.updatedAt = now;
        return { data: { referral: existing } };
      }

      const referral: Referral = {
        id: id(),
        referrerId: refCode.accountId,
        refCode: refCode.code,
        status: 'clicked',
        channel,
        createdAt: now,
        clickedAt: now,
      };
      db.referrals.push(referral);
      return { data: { referral } };
    },

    qualifyReferral: async (referralId: string): Promise<ApiResult<{ referral: Referral; entries: RewardLedgerEntry[] }>> => {
      const referral = db.referrals.find((r) => r.id === referralId);
      if (!referral) {
        return {
          problem: {
            type: 'about:blank',
            title: 'Referral not found',
            status: 404,
            code: 'GS-REF-1003',
            detail: `No referral found with id ${referralId}.`,
          },
        };
      }

      if (referral.status === 'qualified') {
        const existingEntries = db.rewardsLedger.filter((e) => e.referralId === referralId);
        return { data: { referral, entries: existingEntries } };
      }

      const now = nowIso();
      referral.status = 'qualified';
      referral.qualifiedAt = now;
      referral.firstOrderDeliveredAt = referral.firstOrderDeliveredAt ?? now;

      const referrerCredit: RewardLedgerEntry = {
        id: id(),
        accountId: referral.referrerId,
        referralId: referral.id,
        type: 'referrer_credit',
        amountCents: 150_00,
        status: 'posted',
        description: `Referrer credit for ${referral.refCode} qualified referral`,
        createdAt: now,
        postedAt: now,
      };

      const refereeDiscount: RewardLedgerEntry = {
        id: id(),
        accountId: referral.refereeId ?? referral.referrerId,
        referralId: referral.id,
        type: 'referee_discount',
        amountCents: 100_00,
        status: 'posted',
        description: `Referee discount for ${referral.refCode} qualified referral`,
        createdAt: now,
        postedAt: now,
      };

      db.rewardsLedger.push(referrerCredit, refereeDiscount);
      return { data: { referral, entries: [referrerCredit, refereeDiscount] } };
    },

    clawBack: async (referralId: string): Promise<ApiResult<{ referral: Referral; entries: RewardLedgerEntry[] }>> => {
      const referral = db.referrals.find((r) => r.id === referralId);
      if (!referral) {
        return {
          problem: {
            type: 'about:blank',
            title: 'Referral not found',
            status: 404,
            code: 'GS-REF-1003',
            detail: `No referral found with id ${referralId}.`,
          },
        };
      }

      if (referral.status !== 'qualified') {
        return {
          problem: {
            type: 'about:blank',
            title: 'Referral not qualified',
            status: 400,
            code: 'GS-REF-1004',
            detail: 'Only qualified referrals can be clawed back.',
          },
        };
      }

      const now = nowIso();
      referral.status = 'clawed_back';
      referral.clawedBackAt = now;

      const affected = db.rewardsLedger.filter((e) => e.referralId === referralId && e.status === 'posted');
      for (const entry of affected) {
        entry.status = 'clawed_back';
        entry.clawedBackAt = now;
      }

      return { data: { referral, entries: affected } };
    },
  },
};

export type {
  WtrPoint,
  KitFunnelStage,
  CacChannelRow,
  HazardHeatmapRow,
  KFactorMetric,
  CampaignLiftRow,
  Referral,
  ReferralChannel,
  ReferralCode,
  ReferralCodeStatus,
  ReferralStats,
  RewardLedgerEntry,
} from '../types/api';
