import type {
  AutomationRule,
  AutomationRuleCreate,
  AutomationRulePatch,
  Campaign,
  CampaignCreate,
  CampaignPatch,
  CampaignPerformance,
  CoffeeLot,
  CoffeeLotCreate,
  CoffeeLotPatch,
  Order,
  OrderLineItem,
  PagedResponse,
  Problem,
  Reservation,
  Roaster,
  RoasterCreate,
  SampleFeedback,
  SampleKit,
  SampleKitCreate,
  SampleKitLot,
  WebhookDelivery,
  WebhookSubscription,
  WebhookSubscriptionCreate,
  WebhookSubscriptionPatch,
  WebhookSubscriptionWithSecret,
} from '../types/api';
import { db, seedDatabase } from './db';
import { GS } from './problems';

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
      return {
        data: {
          campaignId: campaign.id,
          sent: 1200,
          openRate: 0.34,
          clickRate: 0.08,
          conversionRate: 0.04,
          funnel: { kitSent: 1200, opened: 408, clicked: 96, ordered: 48 },
          variants: [
            {
              variantName: 'A',
              sampleSize: 600,
              conversions: 26,
              conversionRate: 0.0433,
              credibleInterval95: { lower: 0.029, upper: 0.061 },
              probabilityBest: 0.62,
              isWinner: true,
            },
            {
              variantName: 'B',
              sampleSize: 600,
              conversions: 22,
              conversionRate: 0.0367,
              credibleInterval95: { lower: 0.024, upper: 0.053 },
              probabilityBest: 0.38,
              isWinner: false,
            },
          ],
          computedAt: nowIso(),
        },
      };
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

      const campaign = db.campaigns.find((c) => c.id === body.campaignId);
      if (!campaign) return { problem: GS.GEN_1005() };
      if (db.rules.some((r) => r.ruleCode === body.ruleCode)) {
        return { problem: GS.CMP_1003() };
      }

      const rule: AutomationRule = {
        ...body,
        conditionsJson: body.conditionsJson ?? {},
        id: idempotencyKey(),
        version: 1,
        status: 'armed',
      };
      db.rules.push(rule);
      campaign.ruleCodes = [...campaign.ruleCodes, rule.ruleCode];
      storeIdempotency(key!, body, rule);
      return { data: rule };
    },

    patch: async (id: string, patch: AutomationRulePatch): Promise<ApiResult<AutomationRule>> => {
      const idx = db.rules.findIndex((r) => r.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      const next = { ...db.rules[idx], ...patch };
      if (patch.conditionsJson || patch.actions || patch.status) {
        next.version = db.rules[idx].version + 1;
      }
      db.rules[idx] = next;
      return { data: db.rules[idx] };
    },

    delete: async (id: string): Promise<ApiResult<void>> => {
      const idx = db.rules.findIndex((r) => r.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      const rule = db.rules[idx];
      const campaign = db.campaigns.find((c) => c.id === rule.campaignId);
      if (campaign) {
        campaign.ruleCodes = campaign.ruleCodes.filter((code) => code !== rule.ruleCode);
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

    feedback: async (input: SampleFeedback): Promise<ApiResult<SampleKit>> => {
      const kit = db.sampleKits.find((k) => k.feedbackToken === input.feedbackToken);
      if (!kit) return { problem: GS.GEN_1005() };
      const body = deepClone(input);
      kit.status = 'feedback_received';
      kit.feedback = body;
      kit.feedbackSubmittedAt = nowIso();
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
    cohorts: async (): Promise<ApiResult<{ cohorts: unknown[] }>> => {
      return { data: { cohorts: [] } };
    },
    ltv: async (): Promise<ApiResult<{ snapshots: unknown[] }>> => {
      return { data: { snapshots: [] } };
    },
    churn: async (): Promise<ApiResult<{ risks: unknown[] }>> => {
      return { data: { risks: [] } };
    },
    funnel: async (): Promise<ApiResult<{ stages: unknown[] }>> => {
      return { data: { stages: [] } };
    },
    viral: async (): Promise<ApiResult<{ referrals: unknown[] }>> => {
      return { data: { referrals: [] } };
    },
    forecast: async (): Promise<ApiResult<{ forecast: unknown[] }>> => {
      return { data: { forecast: [] } };
    },
  },
};
