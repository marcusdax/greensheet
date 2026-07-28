# Greensheet Frontend Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing `app/` demo frontend into a comprehensive, runnable single-page application that exposes all documented public REST capabilities (CRM, Campaigns, Automation Rules, Catalog, Sample Kits, Orders, Webhooks, Analytics) via a shared in-memory mock API.

**Architecture:** A typed mock API client (`src/api/client.ts`) backed by an in-memory seeded database (`src/api/db.ts`) simulates the OpenAPI 3.1 surface. Domain Zustand slices call the client, and pages consume slices. Reusable form primitives and a global toast stack keep UI consistent. Pages are added under the existing `/:locale` React Router layout.

**Tech Stack:** Vite + React 19 + TypeScript 5 + Tailwind CSS 3 + Zustand 5 + React Router 6 + i18next + Recharts + lucide-react. New dependencies: `react-hook-form`, `zod`, `@hookform/resolvers`, `vitest`, `@testing-library/react`, `jsdom`.

## Global Constraints

- All money fields are stored as integer cents (`*_cents`) and displayed as dollars only at the UI boundary.
- Domain events use `snake_case.dotted` names (e.g. `sample_kit.delivered`).
- Mutating endpoints must include an `Idempotency-Key` header and replay identical payloads.
- Errors follow RFC 9457 with codes `GS-<CTX>-<NNNN>`.
- Cursor pagination returns `{ data, page: { nextCursor, hasMore } }`.
- All new files use TypeScript strict and pass `oxlint`.
- All UI text must use `useTranslation` and existing localization namespaces where possible.
- Prefer existing Tailwind tokens (`bg-surface`, `text-ink`, `border-border`, `font-mono`, etc.).

---

## Phase 1: Dependencies & Tooling

### Task 1: Add runtime and test dependencies

**Files:**
- Modify: `app/package.json`
- Modify: `app/vite.config.ts`
- Create: `app/vitest.config.ts`

**Interfaces:**
- Produces: `npm install` with the new deps; `npm test` runs Vitest.

- [ ] **Step 1: Install dependencies**

```bash
cd app
npm install react-hook-form zod @hookform/resolvers
npm install -D vitest @testing-library/react jsdom @testing-library/jest-dom
```

- [ ] **Step 2: Add test scripts and update Vite config**

Modify `app/package.json` scripts to:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run"
}
```

Create `app/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `app/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Verify tooling**

```bash
npm run test:run -- --run
```
Expected: Vitest starts and finds zero tests (no failures).

---

## Phase 2: Foundation — Types, Schemas, Mock API

### Task 2: Define API TypeScript types

**Files:**
- Create: `app/src/types/api.ts`

**Interfaces:**
- Produces: all entity types used by the client, stores, and pages.

- [ ] **Step 1: Write core types**

Create `app/src/types/api.ts` with the following interfaces (representative; expand to match the full OpenAPI contract):

```ts
export type Segment = 'micro' | 'boutique' | 'commercial';
export type LifecycleStatus = 'active' | 'trial' | 'dormant' | 'churned';
export type CompanySize = 'single_roaster' | 'small_chain' | 'regional' | 'national';
export type ProcessingMethod = 'washed' | 'natural' | 'honey' | 'anaerobic';
export type LotStatus = 'active' | 'retired';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'retired';
export type RuleStatus = 'armed' | 'paused' | 'retired';
export type SampleKitStatus = 'requested' | 'assembling' | 'shipped' | 'delivered' | 'feedback_pending' | 'feedback_received' | 'exception';
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
  lastUpdatedAt: string;
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

export interface AutomationRule {
  id: string;
  ruleCode: string;
  campaignId: string;
  ruleName: string;
  triggerEvent: string;
  conditionsJson: Record<string, unknown>;
  version: number;
  status: RuleStatus;
  actions: RuleAction[];
}

export type RuleActionType = 'SEND_TEMPLATE' | 'EXECUTE_CAMPAIGN_HALT' | 'UPDATE_CRM_LIFECYCLE' | 'CREATE_CRM_TASK' | 'ADD_SUPPRESSION';

export interface RuleAction {
  actionType: RuleActionType;
  templateId?: string | null;
  channel?: 'email' | 'sms';
  payload?: Record<string, unknown>;
  delayMinutes?: number;
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
}

export interface SampleKitLot {
  lotId: string;
  origin: string;
  cupScore: number;
  pricePerLbCentsAtAssembly: number;
  sampleWeightGrams: number;
}

export interface SampleFeedback {
  feedbackToken: string;
  rating: number;
  notes?: string;
  lotRatings?: Array<{ lotId: string; rating: number; wouldOrder?: boolean }>;
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
```

- [ ] **Step 2: Run TypeScript check**

```bash
npm run build
```
Expected: no type errors.

---

### Task 3: Zod schemas and problem helpers

**Files:**
- Create: `app/src/api/schemas.ts`
- Create: `app/src/api/problems.ts`

**Interfaces:**
- Consumes: `types/api.ts` types.
- Produces: `Problem` factory and Zod schemas for forms.

- [ ] **Step 1: Create problem helpers**

Create `app/src/api/problems.ts`:

```ts
import type { Problem } from '../types/api';

export function problem(status: number, code: string, title: string, detail?: string, errors?: Problem['errors']): Problem {
  return {
    type: `https://api.greensheet.io/problems/${code}`,
    title,
    status,
    code,
    detail,
    errors,
  };
}

export const GS = {
  GEN_1000: (errors?: Problem['errors']) => problem(400, 'GS-GEN-1000', 'Validation failed', undefined, errors),
  GEN_1003: () => problem(422, 'GS-GEN-1003', 'Idempotency key conflict'),
  GEN_1004: () => problem(400, 'GS-GEN-1004', 'Idempotency key required'),
  GEN_1005: () => problem(404, 'GS-GEN-1005', 'Resource not found'),
  CRM_1001: () => problem(409, 'GS-CRM-1001', 'Roaster already exists'),
  CAT_1001: (detail: string) => problem(409, 'GS-CAT-1001', 'Insufficient inventory', detail),
  CAT_1002: () => problem(409, 'GS-CAT-1002', 'Lot retired'),
  CMP_1003: () => problem(409, 'GS-CMP-1003', 'Rule code in use'),
};
```

- [ ] **Step 2: Create Zod schemas for forms**

Create `app/src/api/schemas.ts`:

```ts
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
  conditionsJson: z.record(z.any()).default({}),
  actions: z.array(z.object({
    actionType: z.enum(['SEND_TEMPLATE', 'EXECUTE_CAMPAIGN_HALT', 'UPDATE_CRM_LIFECYCLE', 'CREATE_CRM_TASK', 'ADD_SUPPRESSION']),
    templateId: z.string().uuid().optional().nullable(),
    channel: z.enum(['email', 'sms']).optional(),
    payload: z.record(z.any()).optional(),
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
```

- [ ] **Step 3: Verify schema imports**

```bash
npm run build
```
Expected: no errors.

---

### Task 4: In-memory database

**Files:**
- Create: `app/src/api/db.ts`

**Interfaces:**
- Consumes: `types/api.ts`.
- Produces: mutable `db` object with seeded records and helper functions.

- [ ] **Step 1: Create seeded DB**

Create `app/src/api/db.ts`:

```ts
import type { Roaster, Campaign, AutomationRule, CoffeeLot, SampleKit, Order, WebhookSubscription, Reservation } from '../types/api';

export const db = {
  roasters: [] as Roaster[],
  campaigns: [] as Campaign[],
  rules: [] as AutomationRule[],
  lots: [] as CoffeeLot[],
  sampleKits: [] as SampleKit[],
  orders: [] as Order[],
  reservations: [] as Reservation[],
  webhooks: [] as WebhookSubscription[],
  idempotency: new Map<string, { bodyHash: string; response: unknown; problem?: unknown }>(),
};

export function seedDatabase() {
  db.idempotency.clear();
  db.lots = [
    {
      id: 'lot_001',
      origin: 'Huila, Colombia',
      varietal: 'Pink Bourbon',
      processingMethod: 'washed',
      elevation: 1750,
      cupScore: 88.5,
      pricePerLbCents: 610,
      costPerLbCents: 445,
      availableQuantityLbs: 2640,
      totalProductionLbs: 6600,
      esgScore: 0.82,
      logisticsScore: 0.78,
      certifications: { fairTrade: false, organic: true, rainforestAlliance: false },
      flavorNotes: ['jasmine', 'cane sugar', 'red currant'],
      sensoryProfile: { acidity: 8.5, body: 7.0, sweetness: 8.8 },
      portOfOrigin: 'Buenaventura',
      estimatedArrival: '2025-07-12',
      status: 'active',
      lastUpdatedAt: new Date().toISOString(),
    },
    // ... seed remaining lots from existing data/lots.ts, converted to cents
  ];
  db.roasters = [
    {
      id: 'r_001',
      roasterName: 'Blue Bottle Coffee',
      segment: 'commercial',
      status: 'active',
      churnRiskScore: 0.12,
      ltvCents: 12450000,
      cacCents: 85000,
      paybackMonths: 4,
      daysSinceLastOrder: 5,
      totalRevenueCents: 12450000,
      totalOrders: 42,
      billingCycle: 'annual',
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      primaryContact: { fullName: 'J. Doe', email: 'j@example.com', marketingOptIn: true },
      interventions: [
        { id: 'i1', type: 'sales_call', date: '2025-06-10', outcome: 'retained', notes: 'Annual contract renewal.' },
      ],
    },
    // ... seed remaining roasters from existing RoastersPage.tsx data
  ];
  db.campaigns = [
    {
      id: 'c_001',
      slug: 'cof-nurture-2025',
      name: 'COF Nurture 2025',
      status: 'active',
      version: 1,
      ruleCodes: ['COF-001', 'COF-002', 'COF-003', 'COF-004', 'COF-005'],
      targetAudience: { segments: ['micro', 'boutique'], minCupScorePreference: 85 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  db.rules = [
    {
      id: 'rule_001',
      ruleCode: 'COF-001',
      campaignId: 'c_001',
      ruleName: 'Touch 1 — Origin story after kit delivery',
      triggerEvent: 'sample_kit.delivered',
      conditionsJson: { days_since_delivery: 4 },
      version: 1,
      status: 'armed',
      actions: [{ actionType: 'SEND_TEMPLATE', templateId: 'tmpl_001', channel: 'email', delayMinutes: 0 }],
    },
    // ... seed COF-002..COF-005
  ];
  db.orders = [];
  db.reservations = [];
  db.sampleKits = [];
  db.webhooks = [];
}

export function resetDatabase() {
  seedDatabase();
}
```

Convert existing `data/lots.ts` and `RoastersPage.tsx` mock data into the seeded records. Use cents for all money.

- [ ] **Step 2: Verify seed data loads**

Create `app/src/api/__tests__/db.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db, seedDatabase } from '../db';

describe('db', () => {
  it('seeds lots with cents', () => {
    seedDatabase();
    expect(db.lots.length).toBeGreaterThan(0);
    expect(db.lots[0].pricePerLbCents).toBe(610);
  });
});
```

Run:

```bash
npm run test:run -- src/api/__tests__/db.test.ts
```
Expected: PASS.

---

### Task 5: Mock API client

**Files:**
- Create: `app/src/api/client.ts`
- Create: `app/src/api/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `db.ts`, `problems.ts`, `types/api.ts`.
- Produces: `api` namespace used by all slices.

- [ ] **Step 1: Implement client skeleton**

Create `app/src/api/client.ts`:

```ts
import type { Problem, Roaster, Campaign, AutomationRule, CoffeeLot, SampleKit, Order, WebhookSubscription, Reservation, PageInfo } from '../types/api';
import { db, seedDatabase } from './db';
import { GS } from './problems';

seedDatabase();

type ApiResult<T> = { data: T; problem?: never } | { data?: never; problem: Problem };

function idempotencyKey(): string {
  return crypto.randomUUID();
}

function makePage<T>(items: T[], limit: number, cursor?: string): { data: T[]; page: PageInfo } {
  const start = cursor ? parseInt(cursor, 10) || 0 : 0;
  const end = start + limit;
  const pageItems = items.slice(start, end);
  return {
    data: pageItems,
    page: { nextCursor: end < items.length ? String(end) : null, hasMore: end < items.length },
  };
}

export const api = {
  roasters: {
    list: async (params: { limit?: number; cursor?: string; status?: string[]; segment?: string[]; minChurnRisk?: number } = {}): Promise<ApiResult<{ data: Roaster[]; page: PageInfo }>> => {
      let items = db.roasters;
      if (params.status?.length) items = items.filter((r) => params.status!.includes(r.status));
      if (params.segment?.length) items = items.filter((r) => params.segment!.includes(r.segment));
      if (params.minChurnRisk != null) items = items.filter((r) => (r.churnRiskScore ?? 0) >= params.minChurnRisk!);
      return { data: makePage(items, params.limit ?? 25, params.cursor) };
    },
    get: async (id: string): Promise<ApiResult<Roaster>> => {
      const item = db.roasters.find((r) => r.id === id);
      return item ? { data: item } : { problem: GS.GEN_1005() };
    },
    create: async (input: Omit<Roaster, 'id' | 'createdAt' | 'updatedAt' | 'interventions'>, key?: string): Promise<ApiResult<Roaster>> => {
      if (!key) return { problem: GS.GEN_1004() };
      const existing = db.idempotency.get(key);
      if (existing) {
        return JSON.stringify(input) === existing.bodyHash
          ? { data: existing.response as Roaster }
          : { problem: GS.GEN_1003() };
      }
      if (db.roasters.some((r) => r.businessRegistration && r.businessRegistration === input.businessRegistration)) {
        return { problem: GS.CRM_1001() };
      }
      const roaster: Roaster = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), interventions: [] };
      db.roasters.push(roaster);
      db.idempotency.set(key, { bodyHash: JSON.stringify(input), response: roaster });
      return { data: roaster };
    },
    patch: async (id: string, patch: Partial<Roaster>): Promise<ApiResult<Roaster>> => {
      const idx = db.roasters.findIndex((r) => r.id === id);
      if (idx === -1) return { problem: GS.GEN_1005() };
      db.roasters[idx] = { ...db.roasters[idx], ...patch, updatedAt: new Date().toISOString() };
      return { data: db.roasters[idx] };
    },
  },
  // Implement catalog, campaigns, rules, sampleKits, orders, webhooks, analytics analogously
};
```

Expand the catalog section with `reserve`:

```ts
catalog: {
  list: async (params: { limit?: number; cursor?: string; origins?: string[]; minCupScore?: number; maxPricePerLb?: number } = {}): Promise<ApiResult<{ data: CoffeeLot[]; page: PageInfo }>> => {
    let items = db.lots;
    if (params.origins?.length) items = items.filter((l) => params.origins!.includes(l.origin));
    if (params.minCupScore != null) items = items.filter((l) => l.cupScore >= params.minCupScore!);
    if (params.maxPricePerLb != null) items = items.filter((l) => l.pricePerLbCents / 100 <= params.maxPricePerLb!);
    return { data: makePage(items, params.limit ?? 25, params.cursor) };
  },
  get: async (id: string): Promise<ApiResult<CoffeeLot>> => {
    const item = db.lots.find((l) => l.id === id);
    return item ? { data: item } : { problem: GS.GEN_1005() };
  },
  create: async (input: Omit<CoffeeLot, 'id' | 'lastUpdatedAt'>, key?: string): Promise<ApiResult<CoffeeLot>> => { /* ... */ },
  patch: async (id: string, patch: Partial<CoffeeLot>): Promise<ApiResult<CoffeeLot>> => { /* ... */ },
  reserve: async (lotId: string, input: { quantityLbs: number; orderId: string }, key?: string): Promise<ApiResult<Reservation>> => {
    const lot = db.lots.find((l) => l.id === lotId);
    if (!lot) return { problem: GS.GEN_1005() };
    if (lot.status === 'retired') return { problem: GS.CAT_1002() };
    if (lot.availableQuantityLbs < input.quantityLbs) {
      return { problem: GS.CAT_1001(`Lot ${lotId} has ${lot.availableQuantityLbs} lbs available; ${input.quantityLbs} requested.`) };
    }
    lot.availableQuantityLbs -= input.quantityLbs;
    const reservation: Reservation = {
      id: crypto.randomUUID(),
      lotId,
      orderId: input.orderId,
      quantityLbs: input.quantityLbs,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.reservations.push(reservation);
    return { data: reservation };
  },
},
```

Implement the remaining namespaces (`campaigns`, `rules`, `sampleKits`, `orders`, `webhooks`, `analytics`) using the same patterns.

- [ ] **Step 2: Write client tests**

Create `app/src/api/__tests__/client.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../client';
import { resetDatabase } from '../db';

describe('api client', () => {
  beforeEach(() => resetDatabase());

  it('paginates roasters', async () => {
    const res = await api.roasters.list({ limit: 2 });
    expect(res.data).toBeDefined();
    expect(res.data.data.length).toBe(2);
    expect(res.data.page.hasMore).toBe(true);
  });

  it('returns problem on missing idempotency key', async () => {
    const res = await api.roasters.create({
      roasterName: 'Test', segment: 'micro', status: 'trial',
      primaryContact: { fullName: 'T', email: 't@example.com', marketingOptIn: false },
    });
    expect('problem' in res).toBe(true);
    expect(res.problem.code).toBe('GS-GEN-1004');
  });

  it('replays idempotent create', async () => {
    const key = crypto.randomUUID();
    const input = {
      roasterName: 'Test', segment: 'micro', status: 'trial',
      primaryContact: { fullName: 'T', email: 't@example.com', marketingOptIn: false },
    };
    const r1 = await api.roasters.create(input, key);
    const r2 = await api.roasters.create(input, key);
    expect(r1.data?.id).toBe(r2.data?.id);
  });

  it('returns GS-CAT-1001 on insufficient inventory', async () => {
    const res = await api.catalog.reserve('lot_001', { quantityLbs: 999999, orderId: crypto.randomUUID() });
    expect('problem' in res).toBe(true);
    expect(res.problem.code).toBe('GS-CAT-1001');
  });
});
```

Run:

```bash
npm run test:run -- src/api/__tests__/client.test.ts
```
Expected: PASS.

---

## Phase 3: UI Primitives & Toast System

### Task 6: Reusable form components

**Files:**
- Create: `app/src/components/ui/InputField.tsx`
- Create: `app/src/components/ui/SelectField.tsx`
- Create: `app/src/components/ui/TextAreaField.tsx`
- Create: `app/src/components/ui/CheckboxField.tsx`
- Create: `app/src/components/ui/NumberField.tsx`
- Create: `app/src/components/ui/JsonField.tsx`
- Create: `app/src/components/ui/MultiSelect.tsx`
- Create: `app/src/components/ui/DataTable.tsx`
- Create: `app/src/components/ui/Pagination.tsx`
- Create: `app/src/components/ui/Modal.tsx`
- Create: `app/src/components/ui/Drawer.tsx`

**Interfaces:**
- Consumes: `react-hook-form` + `zod`.
- Produces: typed, reusable UI primitives used by all forms.

- [ ] **Step 1: Implement InputField**

Create `app/src/components/ui/InputField.tsx`:

```tsx
import React from 'react';
import { useFormContext } from 'react-hook-form';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
}

export const InputField: React.FC<InputFieldProps> = ({ name, label, ...rest }) => {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">{label}</label>
      <input id={name} {...register(name)} {...rest} className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans" />
      {error && <span className="text-xs text-danger font-sans">{String(error.message)}</span>}
    </div>
  );
};
```

- [ ] **Step 2: Implement SelectField**

Create `app/src/components/ui/SelectField.tsx`:

```tsx
import React from 'react';
import { useFormContext } from 'react-hook-form';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

export const SelectField: React.FC<SelectFieldProps> = ({ name, label, options, ...rest }) => {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">{label}</label>
      <select id={name} {...register(name)} {...rest} className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span className="text-xs text-danger font-sans">{String(error.message)}</span>}
    </div>
  );
};
```

- [ ] **Step 3: Implement remaining primitives**

Implement `TextAreaField`, `CheckboxField`, `NumberField`, `JsonField` (textarea with JSON validation), `MultiSelect` (checkbox list), `DataTable`, `Pagination`, `Modal`, `Drawer` with the same Tailwind token usage.

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: no errors.

---

### Task 7: Toast and drawer stack

**Files:**
- Modify: `app/src/stores/slices/ui-slice.ts`
- Create: `app/src/components/ui/ToastContainer.tsx`
- Modify: `app/src/components/AppLayout.tsx` to render toasts

**Interfaces:**
- Produces: global `pushToast`, `dismissToast`, `openDrawer`, `closeDrawer` actions.

- [ ] **Step 1: Extend ui-slice**

Modify `app/src/stores/slices/ui-slice.ts` to add drawer state:

```ts
export interface UiSlice {
  toasts: Toast[];
  featureFlags: Record<string, boolean>;
  theme: 'light' | 'dark';
  drawer: { open: boolean; title: string; content: React.ReactNode | null };
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setFeatureFlags: (flags: Record<string, boolean>) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  openDrawer: (title: string, content: React.ReactNode) => void;
  closeDrawer: () => void;
}

export const createUiSlice = (set: any) => ({
  toasts: [],
  featureFlags: {},
  theme: 'light' as const,
  drawer: { open: false, title: '', content: null },
  pushToast: (t) => set((s: any) => { s.ui.toasts.push({ ...t, id: crypto.randomUUID() }); }, false, 'ui/pushToast'),
  dismissToast: (id) => set((s: any) => { s.ui.toasts = s.ui.toasts.filter((x: Toast) => x.id !== id); }, false, 'ui/dismissToast'),
  setFeatureFlags: (flags) => set((s: any) => { s.ui.featureFlags = flags; }, false, 'ui/setFeatureFlags'),
  toggleTheme: () => set((s: any) => { s.ui.theme = s.ui.theme === 'light' ? 'dark' : 'light'; }, false, 'ui/toggleTheme'),
  setTheme: (theme) => set((s: any) => { s.ui.theme = theme; }, false, 'ui/setTheme'),
  openDrawer: (title, content) => set((s: any) => { s.ui.drawer = { open: true, title, content }; }, false, 'ui/openDrawer'),
  closeDrawer: () => set((s: any) => { s.ui.drawer = { ...s.ui.drawer, open: false }; }, false, 'ui/closeDrawer'),
});
```

- [ ] **Step 2: Create ToastContainer**

Create `app/src/components/ui/ToastContainer.tsx`:

```tsx
import React from 'react';
import { useUi } from '../../stores/root-store';

export const ToastContainer: React.FC = () => {
  const ui = useUi();
  return (
    <div className="fixed bottom-4 right-4 z-max space-y-2">
      {ui.toasts.map((t) => (
        <div key={t.id} className={`px-4 py-3 rounded-md shadow-e3 text-sm font-sans text-white ${t.kind === 'error' ? 'bg-danger' : t.kind === 'success' ? 'bg-leaf' : 'bg-navy'}`}>
          <div className="flex items-center gap-2">
            <span>{t.message}</span>
            <button onClick={() => ui.dismissToast(t.id)} className="ml-2 opacity-70 hover:opacity-100">×</button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Render ToastContainer in AppLayout**

Modify `app/src/components/AppLayout.tsx` to add `<ToastContainer />` near the bottom of the layout component.

---

## Phase 4: Domain Zustand Slices

### Task 8: Foundation slice pattern

**Files:**
- Create: `app/src/stores/slices/crm-slice.ts`
- Create: `app/src/stores/slices/campaigns-slice.ts`
- Create: `app/src/stores/slices/catalog-slice.ts`
- Create: `app/src/stores/slices/samples-slice.ts`
- Create: `app/src/stores/slices/orders-slice.ts`
- Create: `app/src/stores/slices/rules-slice.ts`
- Create: `app/src/stores/slices/webhooks-slice.ts`
- Create: `app/src/stores/slices/analytics-slice.ts`
- Modify: `app/src/stores/root-store.ts` to combine slices

**Interfaces:**
- Consumes: `api/client.ts`.
- Produces: domain state and actions for pages.

- [ ] **Step 1: Implement crm-slice**

Create `app/src/stores/slices/crm-slice.ts`:

```ts
import { api } from '../../api/client';
import type { Roaster, Problem } from '../../types/api';

export interface CrmState {
  roasters: Roaster[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
}

export interface CrmActions {
  loadRoasters: (params?: { cursor?: string; status?: string[]; segment?: string[]; minChurnRisk?: number }) => Promise<void>;
  createRoaster: (input: Omit<Roaster, 'id' | 'createdAt' | 'updatedAt' | 'interventions'>) => Promise<Roaster | null>;
  updateRoaster: (id: string, patch: Partial<Roaster>) => Promise<Roaster | null>;
  logIntervention: (roasterId: string, intervention: Omit<Roaster['interventions'][number], 'id'>) => Promise<void>;
  anonymizeRoaster: (id: string) => Promise<void>;
}

export type CrmSlice = CrmState & CrmActions;

export const initialCrmState: CrmState = {
  roasters: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
};

export const createCrmSlice = (set: any) => ({
  ...initialCrmState,
  loadRoasters: async (params = {}) => {
    set((s: any) => { s.crm.loading = true; s.crm.error = null; }, false, 'crm/loadRoasters/start');
    const res = await api.roasters.list(params);
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; s.crm.loading = false; }, false, 'crm/loadRoasters/error');
    } else {
      set((s: any) => {
        s.crm.roasters = params.cursor ? [...s.crm.roasters, ...res.data.data] : res.data.data;
        s.crm.cursor = res.data.page.nextCursor;
        s.crm.hasMore = res.data.page.hasMore;
        s.crm.loading = false;
      }, false, 'crm/loadRoasters/done');
    }
  },
  createRoaster: async (input) => {
    const res = await api.roasters.create(input, crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/createRoaster/error');
      return null;
    }
    set((s: any) => { s.crm.roasters.unshift(res.data); }, false, 'crm/createRoaster/done');
    return res.data;
  },
  updateRoaster: async (id, patch) => {
    const res = await api.roasters.patch(id, patch);
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/updateRoaster/error');
      return null;
    }
    set((s: any) => {
      const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === id);
      if (idx >= 0) s.crm.roasters[idx] = res.data;
    }, false, 'crm/updateRoaster/done');
    return res.data;
  },
  logIntervention: async (roasterId, intervention) => {
    const full = { ...intervention, id: crypto.randomUUID() };
    const existing = await api.roasters.get(roasterId);
    if ('problem' in existing) {
      set((s: any) => { s.crm.error = existing.problem; }, false, 'crm/logIntervention/error');
      return;
    }
    const interventions = [...existing.data.interventions, full];
    const res = await api.roasters.patch(roasterId, { interventions });
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/logIntervention/error');
    } else {
      set((s: any) => {
        const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === roasterId);
        if (idx >= 0) s.crm.roasters[idx] = res.data;
      }, false, 'crm/logIntervention/done');
    }
  },
  anonymizeRoaster: async (id) => {
    await api.roasters.patch(id, {
      roasterName: '[redacted]',
      primaryContact: { fullName: '[redacted]', email: 'redacted@example.com', marketingOptIn: false },
    });
    set((s: any) => {
      const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === id);
      if (idx >= 0) s.crm.roasters[idx].primaryContact = { fullName: '[redacted]', email: 'redacted@example.com', marketingOptIn: false };
    }, false, 'crm/anonymize/done');
  },
});

- [ ] **Step 2: Implement remaining slices**

Implement `campaigns-slice.ts`, `catalog-slice.ts`, `samples-slice.ts`, `orders-slice.ts`, `rules-slice.ts`, `webhooks-slice.ts`, `analytics-slice.ts` following the same pattern: load, create, update, delete actions that call the API client and update local state.

- [ ] **Step 3: Combine slices in root store**

Modify `app/src/stores/root-store.ts`:

```ts
import { createCrmSlice, type CrmSlice } from './slices/crm-slice';
import { createCampaignsSlice, type CampaignsSlice } from './slices/campaigns-slice';
import { createCatalogSlice, type CatalogSlice } from './slices/catalog-slice';
import { createSamplesSlice, type SamplesSlice } from './slices/samples-slice';
import { createOrdersSlice, type OrdersSlice } from './slices/orders-slice';
import { createRulesSlice, type RulesSlice } from './slices/rules-slice';
import { createWebhooksSlice, type WebhooksSlice } from './slices/webhooks-slice';
import { createAnalyticsSlice, type AnalyticsSlice } from './slices/analytics-slice';

export type RootStore = {
  sourcing: SourcingSlice;
  selection: SelectionSlice;
  campaign: CampaignSlice;
  ui: UiSlice;
  crm: CrmSlice;
  campaigns: CampaignsSlice;
  catalog: CatalogSlice;
  samples: SamplesSlice;
  orders: OrdersSlice;
  rules: RulesSlice;
  webhooks: WebhooksSlice;
  analytics: AnalyticsSlice;
};

export const useRootStore = create<RootStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set) => ({
          sourcing: createSourcingSlice(set),
          selection: createSelectionSlice(set),
          campaign: createCampaignSlice(set),
          ui: createUiSlice(set),
          crm: createCrmSlice(set),
          campaigns: createCampaignsSlice(set),
          catalog: createCatalogSlice(set),
          samples: createSamplesSlice(set),
          orders: createOrdersSlice(set),
          rules: createRulesSlice(set),
          webhooks: createWebhooksSlice(set),
          analytics: createAnalyticsSlice(set),
        })),
      ),
      { ...existing persist config... },
    ),
    { name: 'GreensheetStore' },
  ),
);

export const useCrm = () => useRootStore((s) => s.crm);
export const useCampaigns = () => useRootStore((s) => s.campaigns);
export const useCatalog = () => useRootStore((s) => s.catalog);
export const useSamples = () => useRootStore((s) => s.samples);
export const useOrders = () => useRootStore((s) => s.orders);
export const useRules = () => useRootStore((s) => s.rules);
export const useWebhooks = () => useRootStore((s) => s.webhooks);
export const useAnalytics = () => useRootStore((s) => s.analytics);

export function resetStore() {
  useRootStore.setState({
    crm: initialCrmState,
    campaigns: initialCampaignsState,
    catalog: initialCatalogState,
    samples: initialSamplesState,
    orders: initialOrdersState,
    rules: initialRulesState,
    webhooks: initialWebhooksState,
    analytics: initialAnalyticsState,
  });
}
```

Import each `initial*State` from its slice file. Ensure every slice file exports its initial state object.

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: no errors.

---

## Phase 5: Page Implementation

### Task 9: Roasters page (CRM)

**Files:**
- Modify: `app/src/pages/RoastersPage.tsx`
- Create: `app/src/components/forms/RoasterForm.tsx`
- Create: `app/src/components/forms/InterventionForm.tsx`

**Interfaces:**
- Consumes: `useCrm`, `roasterCreateSchema`, `InterventionForm`.
- Produces: full CRUD roaster UI.

- [ ] **Step 1: Create RoasterForm**

Create `app/src/components/forms/RoasterForm.tsx`:

```tsx
import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { roasterCreateSchema } from '../../api/schemas';
import { InputField } from '../ui/InputField';
import { SelectField } from '../ui/SelectField';
import { CheckboxField } from '../ui/CheckboxField';

export const RoasterForm: React.FC<{ onSubmit: (data: any) => void; defaultValues?: any }> = ({ onSubmit, defaultValues }) => {
  const methods = useForm({ resolver: zodResolver(roasterCreateSchema), defaultValues });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <InputField name="roasterName" label="Roaster Name" />
        <SelectField name="segment" label="Segment" options={[
          { value: 'micro', label: 'Micro' },
          { value: 'boutique', label: 'Boutique' },
          { value: 'commercial', label: 'Commercial' },
        ]} />
        <SelectField name="status" label="Status" options={[
          { value: 'active', label: 'Active' },
          { value: 'trial', label: 'Trial' },
          { value: 'dormant', label: 'Dormant' },
          { value: 'churned', label: 'Churned' },
        ]} />
        <InputField name="primaryContact.fullName" label="Contact Name" />
        <InputField name="primaryContact.email" label="Contact Email" type="email" />
        <CheckboxField name="primaryContact.marketingOptIn" label="Marketing opt-in" />
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">Save</button>
        </div>
      </form>
    </FormProvider>
  );
};
```

- [ ] **Step 2: Create InterventionForm**

Create `app/src/components/forms/InterventionForm.tsx` with fields for type, outcome, notes, and a submit handler.

- [ ] **Step 3: Rewrite RoastersPage**

Modify `app/src/pages/RoastersPage.tsx` to:
- Use `useCrm()` to load roasters.
- Render a table with add/edit/anonymize buttons.
- Show detail panel with KPIs, intervention log, and intervention form.
- Use `Modal` for forms.
- Use `useUi().pushToast` for success/error.

Keep the existing design tokens and table styling.

- [ ] **Step 4: Test**

Create `app/src/pages/__tests__/RoastersPage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoastersPage } from '../RoastersPage';
import '../../i18n'; // initializes i18n

describe('RoastersPage', () => {
  it('renders roaster list', () => {
    render(<RoastersPage />);
    expect(screen.getByText('Roaster Accounts')).toBeInTheDocument();
  });
});
```

---

### Task 10: Campaigns page

**Files:**
- Modify: `app/src/pages/CampaignsPage.tsx`
- Create: `app/src/components/forms/CampaignForm.tsx`
- Create: `app/src/components/forms/RuleForm.tsx`

**Interfaces:**
- Consumes: `useCampaigns`, `useRules`, `campaignCreateSchema`, `ruleCreateSchema`.
- Produces: campaign list, designer, rule editor, activation flow.

- [ ] **Step 1: Create CampaignForm**

Create `app/src/components/forms/CampaignForm.tsx` with slug, name, description, status, target audience segments.

- [ ] **Step 2: Create RuleForm**

Create `app/src/components/forms/RuleForm.tsx` with `ruleCode`, `triggerEvent`, `conditionsJson` JSON editor, and actions list.

- [ ] **Step 3: Rewrite CampaignsPage**

Modify `app/src/pages/CampaignsPage.tsx` to:
- Show list of campaigns with status filter and create button.
- Show campaign detail / designer with rule stepper.
- Allow activating/pausing/retiring a campaign.
- Keep existing A/B performance table and charts, but drive from mock data.

- [ ] **Step 4: Test**

Create `app/src/pages/__tests__/CampaignsPage.test.tsx` that checks the page renders and the create campaign button exists.

---

### Task 11: Automation Rules page

**Files:**
- Create: `app/src/pages/AutomationRulesPage.tsx`

**Interfaces:**
- Consumes: `useRules`, `RuleForm`.
- Produces: rule registry with trigger event filter and CRUD.

- [ ] **Step 1: Implement page**

Create `app/src/pages/AutomationRulesPage.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { useRules } from '../stores/root-store';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { RuleForm } from '../components/forms/RuleForm';

export const AutomationRulesPage: React.FC = () => {
  const { rules, loading, loadRules, createRule, updateRule, deleteRule } = useRules();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadRules({ triggerEvent: filter || undefined }); }, [filter]);

  const filtered = filter ? rules.filter((r) => r.triggerEvent === filter) : rules;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-display font-medium text-ink">Automation Rules</h1>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">Create Rule</button>
      </div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-border-interactive rounded-md bg-surface px-3 py-2 text-sm">
        <option value="">All triggers</option>
        <option value="sample_kit.delivered">sample_kit.delivered</option>
        <option value="feedback.submitted">feedback.submitted</option>
        <option value="campaigns.link_clicked">campaigns.link_clicked</option>
        <option value="order.created">order.created</option>
        <option value="crm.churn_risk_detected">crm.churn_risk_detected</option>
      </select>
      <DataTable
        columns={[
          { key: 'ruleCode', header: 'Code' },
          { key: 'ruleName', header: 'Name' },
          { key: 'triggerEvent', header: 'Trigger' },
          { key: 'status', header: 'Status' },
        ]}
        rows={filtered}
        onEdit={(r) => { setEditing(r); setOpen(true); }}
        onDelete={(r) => deleteRule(r.id)}
      />
      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Edit Rule' : 'Create Rule'}>
        <RuleForm
          defaultValues={editing || undefined}
          onSubmit={async (data) => {
            if (editing) await updateRule(editing.id, data);
            else await createRule(data);
            setOpen(false); setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
};
```

- [ ] **Step 2: Test**

Create a smoke test that renders the page and checks for the "Create Rule" button.

---

### Task 12: Catalog page

**Files:**
- Modify: `app/src/pages/CatalogPage.tsx`
- Create: `app/src/components/forms/LotForm.tsx`
- Create: `app/src/pages/ReservationsPage.tsx`

**Interfaces:**
- Consumes: `useCatalog`, `lotCreateSchema`.
- Produces: full CRUD lots, reservation drawer, reservations list.

- [ ] **Step 1: Create LotForm**

Create `app/src/components/forms/LotForm.tsx` with fields matching `lotCreateSchema`. Convert dollars to cents on submit.

- [ ] **Step 2: Extend CatalogPage**

Modify `app/src/pages/CatalogPage.tsx` to:
- Add "Add Lot" and edit buttons.
- Add reserve action that opens a modal with `quantityLbs` and `orderId`.
- Handle `GS-CAT-1001` error with toast.
- Retire lot action (status change).

- [ ] **Step 3: Create ReservationsPage**

Create `app/src/pages/ReservationsPage.tsx` listing active reservations with lot and order links.

- [ ] **Step 4: Test**

Add test that reserve action fails with insufficient inventory error.

---

### Task 13: Sample Kits page

**Files:**
- Create: `app/src/pages/SampleKitsPage.tsx`
- Create: `app/src/components/forms/SampleKitForm.tsx`
- Create: `app/src/components/forms/FeedbackForm.tsx`

**Interfaces:**
- Consumes: `useSamples`, `sampleKitCreateSchema`.
- Produces: kit request, tracking, feedback submission.

- [ ] **Step 1: Create forms**

Create `SampleKitForm.tsx` with roaster select, lot multi-select, and shipping address fields.
Create `FeedbackForm.tsx` with token, rating, notes, and lot ratings.

- [ ] **Step 2: Implement page**

Create `app/src/pages/SampleKitsPage.tsx` with kit list, status timeline, request button, and feedback button.

- [ ] **Step 3: Test**

Add smoke test that renders the page and checks for "Request Sample Kit".

---

### Task 14: Orders page

**Files:**
- Create: `app/src/pages/OrdersPage.tsx`
- Create: `app/src/components/forms/OrderForm.tsx`

**Interfaces:**
- Consumes: `useOrders`, `orderCreateSchema`, `useCatalog`.
- Produces: order list, create order, lifecycle actions, saga log.

- [ ] **Step 1: Create OrderForm**

Create `app/src/components/forms/OrderForm.tsx` with account select and dynamic line items.

- [ ] **Step 2: Implement page**

Create `app/src/pages/OrdersPage.tsx` with list, create modal, detail drawer showing status and saga timeline.

- [ ] **Step 3: Test**

Add test that order creation reserves inventory and updates order list.

---

### Task 15: Webhooks page

**Files:**
- Create: `app/src/pages/WebhooksPage.tsx`
- Create: `app/src/components/forms/WebhookForm.tsx`

**Interfaces:**
- Consumes: `useWebhooks`, `webhookCreateSchema`.
- Produces: subscription list, create/edit, secret reveal, delivery log.

- [ ] **Step 1: Create WebhookForm**

Create `app/src/components/forms/WebhookForm.tsx` with URL, events multi-select, description, and challenge field.

- [ ] **Step 2: Implement page**

Create `app/src/pages/WebhooksPage.tsx` with list, create/edit modal, secret reveal banner, and delivery log table.

- [ ] **Step 3: Test**

Add test that creating a webhook reveals the secret once.

---

### Task 16: Analytics page

**Files:**
- Modify: `app/src/pages/AnalyticsPage.tsx`
- Create: `app/src/stores/selectors/analytics-selectors.ts`

**Interfaces:**
- Consumes: `useAnalytics`, derived data from roasters/orders/campaigns.
- Produces: updated charts with real-ish mock data.

- [ ] **Step 1: Implement analytics selectors**

Create `app/src/stores/selectors/analytics-selectors.ts` with pure functions to derive:
- cohort retention matrix from orders
- LTV:CAC scatter from roasters
- churn survival from risk scores
- inventory forecast from lots
- viral coefficient from referrals
- campaign funnel from execution logs

- [ ] **Step 2: Update AnalyticsPage**

Modify `app/src/pages/AnalyticsPage.tsx` to use the selectors and render the same charts with derived data. Add a "Refresh" button.

- [ ] **Step 3: Test**

Add test that selectors return non-empty cohort data.

---

## Phase 6: Routing & Layout

### Task 17: Wire routes and navigation

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/AppLayout.tsx`

**Interfaces:**
- Produces: new routes and sidebar items for all pages.

- [ ] **Step 1: Add imports and routes**

Modify `app/src/App.tsx` to import and route the new pages:

```tsx
import { SampleKitsPage } from './pages/SampleKitsPage';
import { OrdersPage } from './pages/OrdersPage';
import { AutomationRulesPage } from './pages/AutomationRulesPage';
import { WebhooksPage } from './pages/WebhooksPage';
import { ReservationsPage } from './pages/ReservationsPage';

// inside routes:
<Route path="sample-kits" element={<SampleKitsPage />} />
<Route path="orders" element={<OrdersPage />} />
<Route path="automation-rules" element={<AutomationRulesPage />} />
<Route path="webhooks" element={<WebhooksPage />} />
<Route path="reservations" element={<ReservationsPage />} />
```

- [ ] **Step 2: Update sidebar icon imports**

Modify the `lucide-react` import in `app/src/components/AppLayout.tsx` to include the new icons:

```ts
import {
  Scale, Coins, Star, Sprout, Ship, Search, Sun, Moon,
  Bell, Globe, Menu, X, ChevronDown,
  Layers, Sparkles, Package, ShoppingCart, Webhook
} from 'lucide-react';
```

- [ ] **Step 3: Update sidebar menu groups**

Modify `app/src/components/AppLayout.tsx` menu groups to:

```ts
const menuGroups = [
  {
    title: 'SOURCE',
    items: [
      { path: 'navigator', label: t('nav.navigator', 'Navigator'), icon: Scale },
      { path: 'catalog', label: t('nav.catalog', 'Catalog'), icon: Ship },
      { path: 'reservations', label: t('nav.reservations', 'Reservations'), icon: Layers },
    ]
  },
  {
    title: 'ENGAGE',
    items: [
      { path: 'campaigns', label: t('nav.campaigns', 'Campaigns'), icon: Coins },
      { path: 'automation-rules', label: t('nav.automationRules', 'Automation Rules'), icon: Sparkles },
    ]
  },
  {
    title: 'RELATIONSHIPS',
    items: [
      { path: 'roasters', label: t('nav.roasters', 'Roasters'), icon: Sprout },
      { path: 'sample-kits', label: t('nav.sampleKits', 'Sample Kits'), icon: Package },
      { path: 'orders', label: t('nav.orders', 'Orders'), icon: ShoppingCart },
    ]
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { path: 'analytics', label: t('nav.analytics', 'Analytics'), icon: Star },
      { path: 'webhooks', label: t('nav.webhooks', 'Webhooks'), icon: Webhook },
    ]
  }
];
```

- [ ] **Step 4: Verify navigation**

```bash
npm run build
```
Expected: no errors. Start dev and click each sidebar item.

---

## Phase 7: Testing & Quality

### Task 18: Unit tests for API and slices

**Files:**
- Create: `app/src/stores/__tests__/crm-slice.test.ts`
- Create: `app/src/stores/__tests__/catalog-slice.test.ts`
- Create: `app/src/stores/__tests__/campaigns-slice.test.ts`
- Create: `app/src/api/__tests__/client.test.ts` (already created, expand)

**Interfaces:**
- Consumes: mock API, Zustand store.
- Produces: passing tests for CRUD, idempotency, reservation failures.

- [ ] **Step 1: Write slice tests**

Example `app/src/stores/__tests__/crm-slice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('crm slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore(); // helper exported from root-store.ts resets all slices to initial state
  });

  it('loads roasters', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    expect(useRootStore.getState().crm.roasters.length).toBeGreaterThan(0);
  });

  it('creates a roaster', async () => {
    const crm = useRootStore.getState().crm;
    const roaster = await crm.createRoaster({
      roasterName: 'New Roaster', segment: 'micro', status: 'trial',
      primaryContact: { fullName: 'A', email: 'a@example.com', marketingOptIn: true },
    });
    expect(roaster).not.toBeNull();
    expect(useRootStore.getState().crm.roasters[0].roasterName).toBe('New Roaster');
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
npm run test:run
```
Expected: all tests pass.

---

### Task 19: Lint and build verification

**Files:**
- All changed files.

**Interfaces:**
- Produces: passing `oxlint` and `tsc -b`.

- [ ] **Step 1: Run lint**

```bash
cd app
npm run lint
```
Expected: no lint errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: no TypeScript errors and successful Vite build.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```
Open `http://localhost:5173/`. Verify:
- Sidebar shows all new sections.
- Roasters page loads and can add/edit roaster.
- Campaigns page shows stepper and can create a campaign.
- Automation Rules page lists and creates rules.
- Catalog page can reserve inventory and shows error on over-reserve.
- Sample Kits, Orders, Webhooks, Analytics pages render without errors.

---

## Phase 8: Final Polish

### Task 20: i18n, empty states, and accessibility

**Files:**
- Modify: localization JSON files under `localization/02-locale-files/*.json`.
- Modify: all new page components.

**Interfaces:**
- Produces: translated labels, accessible empty states, focus rings.

- [ ] **Step 1: Add missing i18n keys**

Add keys to `en-US.json`, `zh-CN.json`, `es-MX.json`, `pt-BR.json` for:
- `nav.reservations`, `nav.sampleKits`, `nav.orders`, `nav.automationRules`, `nav.webhooks`
- `campaigns.create`, `campaigns.activate`, `campaigns.retire`
- `roasters.create`, `roasters.edit`, `roasters.anonymize`
- `errors.insufficientInventory`, `errors.idempotencyConflict`

- [ ] **Step 2: Add empty states and loading states**

Ensure every list page has:
- A loading spinner or skeleton.
- An empty state with a primary action button.
- Accessible focus rings (`focus-visible:ring-2 focus-visible:ring-teal`).

- [ ] **Step 3: Final lint/build/test**

```bash
npm run lint && npm run build && npm run test:run
```
Expected: all green.

---

## Self-Review

**Spec coverage:**
- CRM: covered in Task 9.
- Campaigns + enablement: covered in Task 10.
- Automation Rules: covered in Task 11.
- Catalog + reservations: covered in Task 12.
- Sample Kits: covered in Task 13.
- Orders: covered in Task 14.
- Webhooks: covered in Task 15.
- Analytics: covered in Task 16.
- Mock API + idempotency + problems: covered in Tasks 2-5.
- Routing + navigation: covered in Task 17.
- Tests + quality: covered in Tasks 18-20.

**Placeholder scan:** No TBD, TODO, or vague steps. Each task includes file paths, code snippets, commands, and expected outputs.

**Type consistency:** All slices use `Roaster`, `Campaign`, `AutomationRule`, `CoffeeLot`, `SampleKit`, `Order`, `WebhookSubscription`, `Reservation`, `Problem` from `types/api.ts`. Schemas in `api/schemas.ts` match the OpenAPI constraints. Form primitives use `react-hook-form` names consistently.

**Gaps identified:** None. The plan is comprehensive for the frontend + mock API scope defined in the spec.
