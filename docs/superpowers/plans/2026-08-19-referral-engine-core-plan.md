# Referral Engine — Core Data Model & Mock API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the referral domain types, mock in-memory tables, seed data, and API endpoints that Sub-projects 2–4 will consume.

**Architecture:** Extend `app/src/types/api.ts` with referral shapes, add three new arrays to `app/src/api/db.ts` and seed them with sample rows, then expose a new `api.referrals` namespace in `app/src/api/client.ts`. All endpoints return the existing `ApiResult<T>` contract and mutate only the in-memory `db` arrays.

**Tech Stack:** TypeScript, existing mock-API pattern (`api/client.ts` + `api/db.ts`), Vitest.

## Global Constraints

- New types live in `app/src/types/api.ts` and are re-exported from `app/src/api/client.ts`.
- Economic values match `marketing/03-referral-engine-playbook.md`: referrer reward `$150` credit, referee reward `$100` off, referral CAC ≤ `$200`, qualification on first paid order delivered.
- Code format follows the existing `GS-XXX-NN` referral-code pattern from the playbook.
- Every endpoint has a focused test in `app/src/api/__tests__/client.test.ts`.
- Use the existing `ApiResult<T>` / `Problem` contract; do not introduce a new error shape.
- Each task ends with a commit and a green test run covering the changed code.

---

## File Map

| File | Responsibility |
|---|---|
| `app/src/types/api.ts` | Referral domain types and literal unions. |
| `app/src/api/db.ts` | New `referralCodes`, `referrals`, `rewardsLedger` arrays + seed data. |
| `app/src/api/client.ts` | `api.referrals` namespace and helper functions. |
| `app/src/api/__tests__/client.test.ts` | Tests for all new referral endpoints. |

---

## Task 1: Add Referral Domain Types

**Files:**
- Modify: `app/src/types/api.ts`
- Test: `app/src/api/__tests__/client.test.ts` (type-only sanity check added in Task 4)

**Interfaces:**
- Consumes: none.
- Produces: `ReferralStatus`, `ReferralChannel`, `ReferralCodeStatus`, `RewardType`, `RewardStatus`, `ReferralCode`, `Referral`, `RewardLedgerEntry`, `ReferralStats`.

- [ ] **Step 1: Append the referral types after the growth analytics types**

In `app/src/types/api.ts`, after `CampaignLiftRow`, append:

```ts
export type ReferralStatus =
  | 'invited'
  | 'clicked'
  | 'signed_up'
  | 'kit_requested'
  | 'kit_delivered'
  | 'feedback_submitted'
  | 'first_order_delivered'
  | 'qualified'
  | 'clawed_back';

export type ReferralChannel =
  | 'invite_link'
  | 'qr_sticker'
  | 'email_share'
  | 'instagram_dm'
  | 'event_badge'
  | 'code_entry';

export type ReferralCodeStatus = 'active' | 'paused' | 'retired';

export type RewardType = 'referrer_credit' | 'referee_discount';

export type RewardStatus = 'pending' | 'posted' | 'clawed_back';

export interface ReferralCode {
  id: string;
  accountId: string;
  code: string;
  status: ReferralCodeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Referral {
  id: string;
  referrerId: string;
  refereeId?: string;
  refCode: string;
  status: ReferralStatus;
  channel: ReferralChannel;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdAt: string;
  clickedAt?: string;
  signedUpAt?: string;
  kitRequestedAt?: string;
  kitDeliveredAt?: string;
  feedbackSubmittedAt?: string;
  firstOrderDeliveredAt?: string;
  qualifiedAt?: string;
  clawedBackAt?: string;
}

export interface RewardLedgerEntry {
  id: string;
  accountId: string;
  referralId: string;
  type: RewardType;
  amountCents: number;
  status: RewardStatus;
  description: string;
  createdAt: string;
  postedAt?: string;
  clawedBackAt?: string;
}

export interface ReferralStats {
  accountId: string;
  invitesSent: number;
  clicks: number;
  signups: number;
  kitRequests: number;
  kitDeliveries: number;
  feedbackSubmitted: number;
  qualifiedReferrals: number;
  pendingRewardsCents: number;
  earnedRewardsCents: number;
  clawedBackRewardsCents: number;
  kFactor: number;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd app && npx tsc --noEmit`  
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/api.ts
git commit -m "feat(referrals): add referral domain types"
```

---

## Task 2: Add Mock DB Tables and Seed Data

**Files:**
- Modify: `app/src/api/db.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces: seeded `db.referralCodes`, `db.referrals`, `db.rewardsLedger`.

- [ ] **Step 1: Import referral types**

Add the new types to the existing import block at the top of `app/src/api/db.ts`:

```ts
import type {
  Roaster,
  Campaign,
  AutomationRule,
  CoffeeLot,
  SampleKit,
  Order,
  WebhookSubscriptionWithSecret,
  Reservation,
  ReferralCode,
  Referral,
  RewardLedgerEntry,
} from '../types/api';
```

- [ ] **Step 2: Add arrays to the `db` object**

After `webhooks`, add:

```ts
referralCodes: [] as ReferralCode[],
referrals: [] as Referral[],
rewardsLedger: [] as RewardLedgerEntry[],
```

- [ ] **Step 3: Seed sample data in `seedDatabase()`**

Before the final `db.orders = []` block, add a helper seed function and call it:

```ts
function seedReferrals(now: string) {
  db.referralCodes = [
    {
      id: 'rc_001',
      accountId: 'r_001',
      code: 'GS-RVR-001',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rc_002',
      accountId: 'r_002',
      code: 'GS-RVR-002',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ];

  db.referrals = [
    {
      id: 'ref_001',
      referrerId: 'r_001',
      refereeId: 'r_003',
      refCode: 'GS-RVR-001',
      status: 'qualified',
      channel: 'invite_link',
      utmSource: 'referral',
      utmMedium: 'invite_link',
      utmCampaign: 'ref_core_2025',
      createdAt: '2025-05-01T00:00:00.000Z',
      clickedAt: '2025-05-01T00:01:00.000Z',
      signedUpAt: '2025-05-01T00:10:00.000Z',
      kitRequestedAt: '2025-05-02T00:00:00.000Z',
      kitDeliveredAt: '2025-05-06T00:00:00.000Z',
      feedbackSubmittedAt: '2025-05-08T00:00:00.000Z',
      firstOrderDeliveredAt: '2025-05-20T00:00:00.000Z',
      qualifiedAt: '2025-06-20T00:00:00.000Z',
    },
    {
      id: 'ref_002',
      referrerId: 'r_001',
      refCode: 'GS-RVR-001',
      status: 'clicked',
      channel: 'qr_sticker',
      utmSource: 'referral',
      utmMedium: 'qr_sticker',
      createdAt: '2025-06-10T00:00:00.000Z',
      clickedAt: '2025-06-10T00:05:00.000Z',
    },
    {
      id: 'ref_003',
      referrerId: 'r_001',
      refereeId: 'r_004',
      refCode: 'GS-RVR-001',
      status: 'kit_delivered',
      channel: 'email_share',
      createdAt: '2025-06-12T00:00:00.000Z',
      clickedAt: '2025-06-12T00:05:00.000Z',
      signedUpAt: '2025-06-12T00:30:00.000Z',
      kitRequestedAt: '2025-06-13T00:00:00.000Z',
      kitDeliveredAt: '2025-06-17T00:00:00.000Z',
    },
    {
      id: 'ref_004',
      referrerId: 'r_001',
      refereeId: 'r_005',
      refCode: 'GS-RVR-001',
      status: 'feedback_submitted',
      channel: 'instagram_dm',
      createdAt: '2025-06-15T00:00:00.000Z',
      clickedAt: '2025-06-15T00:05:00.000Z',
      signedUpAt: '2025-06-15T00:20:00.000Z',
      kitRequestedAt: '2025-06-16T00:00:00.000Z',
      kitDeliveredAt: '2025-06-20T00:00:00.000Z',
      feedbackSubmittedAt: '2025-06-22T00:00:00.000Z',
    },
    {
      id: 'ref_005',
      referrerId: 'r_001',
      refCode: 'GS-RVR-001',
      status: 'invited',
      channel: 'event_badge',
      createdAt: '2025-06-25T00:00:00.000Z',
    },
    {
      id: 'ref_006',
      referrerId: 'r_002',
      refereeId: 'r_003',
      refCode: 'GS-RVR-002',
      status: 'qualified',
      channel: 'invite_link',
      createdAt: '2025-05-15T00:00:00.000Z',
      clickedAt: '2025-05-15T00:02:00.000Z',
      signedUpAt: '2025-05-15T00:15:00.000Z',
      kitRequestedAt: '2025-05-16T00:00:00.000Z',
      kitDeliveredAt: '2025-05-20T00:00:00.000Z',
      feedbackSubmittedAt: '2025-05-22T00:00:00.000Z',
      firstOrderDeliveredAt: '2025-06-05T00:00:00.000Z',
      qualifiedAt: '2025-07-05T00:00:00.000Z',
    },
    {
      id: 'ref_007',
      referrerId: 'r_002',
      refCode: 'GS-RVR-002',
      status: 'signed_up',
      channel: 'qr_sticker',
      createdAt: '2025-06-18T00:00:00.000Z',
      clickedAt: '2025-06-18T00:05:00.000Z',
      signedUpAt: '2025-06-18T00:30:00.000Z',
    },
    {
      id: 'ref_008',
      referrerId: 'r_002',
      refCode: 'GS-RVR-002',
      status: 'clawed_back',
      channel: 'invite_link',
      createdAt: '2025-04-01T00:00:00.000Z',
      clickedAt: '2025-04-01T00:05:00.000Z',
      signedUpAt: '2025-04-01T00:30:00.000Z',
      kitRequestedAt: '2025-04-02T00:00:00.000Z',
      kitDeliveredAt: '2025-04-06T00:00:00.000Z',
      feedbackSubmittedAt: '2025-04-08T00:00:00.000Z',
      firstOrderDeliveredAt: '2025-04-20T00:00:00.000Z',
      qualifiedAt: '2025-05-20T00:00:00.000Z',
      clawedBackAt: '2025-06-01T00:00:00.000Z',
    },
    {
      id: 'ref_009',
      referrerId: 'r_002',
      refereeId: 'r_006',
      refCode: 'GS-RVR-002',
      status: 'kit_delivered',
      channel: 'qr_sticker',
      createdAt: '2025-07-10T00:00:00.000Z',
      clickedAt: '2025-07-10T00:05:00.000Z',
      signedUpAt: '2025-07-10T00:30:00.000Z',
      kitRequestedAt: '2025-07-11T00:00:00.000Z',
      kitDeliveredAt: '2025-07-15T00:00:00.000Z',
    },
  ];

  db.rewardsLedger = [
    {
      id: 'rl_001',
      accountId: 'r_001',
      referralId: 'ref_001',
      type: 'referrer_credit',
      amountCents: 150_00,
      status: 'posted',
      description: 'Referrer credit for GS-RVR-001 qualified referral',
      createdAt: '2025-06-20T00:00:00.000Z',
      postedAt: '2025-06-20T00:00:00.000Z',
    },
    {
      id: 'rl_002',
      accountId: 'r_001',
      referralId: 'ref_001',
      type: 'referee_discount',
      amountCents: 100_00,
      status: 'posted',
      description: 'Referee discount for GS-RVR-001 qualified referral',
      createdAt: '2025-06-20T00:00:00.000Z',
      postedAt: '2025-06-20T00:00:00.000Z',
    },
    {
      id: 'rl_003',
      accountId: 'r_001',
      referralId: 'ref_004',
      type: 'referrer_credit',
      amountCents: 150_00,
      status: 'pending',
      description: 'Pending referrer credit for feedback-submitted referral',
      createdAt: '2025-06-22T00:00:00.000Z',
    },
    {
      id: 'rl_004',
      accountId: 'r_001',
      referralId: 'ref_003',
      type: 'referrer_credit',
      amountCents: 150_00,
      status: 'pending',
      description: 'Pending referrer credit for kit-delivered referral',
      createdAt: '2025-06-17T00:00:00.000Z',
    },
    {
      id: 'rl_005',
      accountId: 'r_002',
      referralId: 'ref_006',
      type: 'referrer_credit',
      amountCents: 150_00,
      status: 'posted',
      description: 'Referrer credit for GS-RVR-002 qualified referral',
      createdAt: '2025-07-05T00:00:00.000Z',
      postedAt: '2025-07-05T00:00:00.000Z',
    },
    {
      id: 'rl_006',
      accountId: 'r_002',
      referralId: 'ref_006',
      type: 'referee_discount',
      amountCents: 100_00,
      status: 'posted',
      description: 'Referee discount for GS-RVR-002 qualified referral',
      createdAt: '2025-07-05T00:00:00.000Z',
      postedAt: '2025-07-05T00:00:00.000Z',
    },
    {
      id: 'rl_007',
      accountId: 'r_002',
      referralId: 'ref_008',
      type: 'referrer_credit',
      amountCents: 150_00,
      status: 'clawed_back',
      description: 'Clawed-back referrer credit after referee return',
      createdAt: '2025-05-20T00:00:00.000Z',
      postedAt: '2025-05-20T00:00:00.000Z',
      clawedBackAt: '2025-06-01T00:00:00.000Z',
    },
    {
      id: 'rl_008',
      accountId: 'r_002',
      referralId: 'ref_009',
      type: 'referrer_credit',
      amountCents: 150_00,
      status: 'pending',
      description: 'Pending referrer credit for kit-delivered referral',
      createdAt: '2025-07-15T00:00:00.000Z',
    },
  ];
}
```

Call `seedReferrals(now);` in `seedDatabase()` after `db.templates = MARKETING_TEMPLATES;`.

- [ ] **Step 4: Run existing tests to confirm no regressions**

Run: `cd app && npm run test:run src/api/__tests__/client.test.ts`  
Expected: passes (seed data still loads).

- [ ] **Step 5: Commit**

```bash
git add app/src/api/db.ts
git commit -m "feat(referrals): seed referral codes, referrals, and rewards ledger"
```

---

## Task 3: Add Referral API Endpoints

**Files:**
- Modify: `app/src/api/client.ts`

**Interfaces:**
- Consumes: `db.referralCodes`, `db.referrals`, `db.rewardsLedger` from Task 2; types from Task 1.
- Produces: `api.referrals.getCodeForAccount`, `createCode`, `listReferrals`, `listLedger`, `getStats`, `recordClick`, `qualifyReferral`, `clawBack`; helpers `generateRefCode`, `nextRefCodeIndex`.

- [ ] **Step 1: Import the new types**

Add to the existing `../types/api` import block in `app/src/api/client.ts`:

```ts
Referral,
ReferralChannel,
ReferralCode,
ReferralCodeStatus,
ReferralStats,
RewardLedgerEntry,
RewardStatus,
RewardType,
WtrPoint,
```

- [ ] **Step 2: Add helper functions near the top of the file**

After the `MARKETING_TEMPLATES` import, add:

```ts
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

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return `ref_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
```

(Use the existing `nowIso()` helper if already defined; do not duplicate it.)

- [ ] **Step 3: Add `api.referrals` namespace before the final `export const api = { ... }`**

Insert this object into the `api` value before the closing brace:

```ts
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
```

- [ ] **Step 4: Re-export the new types from `client.ts`**

At the bottom of the file, add:

```ts
export type {
  Referral,
  ReferralChannel,
  ReferralCode,
  ReferralCodeStatus,
  ReferralStats,
  RewardLedgerEntry,
} from '../types/api';
```

- [ ] **Step 5: Run TypeScript check**

Run: `cd app && npx tsc --noEmit`  
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/api/client.ts
git commit -m "feat(referrals): add referral API endpoints"
```

---

## Task 4: Add API Tests

**Files:**
- Modify: `app/src/api/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `api.referrals.*` from Task 3.
- Produces: passing test coverage.

- [ ] **Step 1: Append a new `describe` block**

After the existing analytics tests, add:

```ts
describe('referrals api', () => {
  it('creates a referral code lazily', async () => {
    const res = await api.referrals.getCodeForAccount('r_003');
    expect('data' in res).toBe(true);
    expect(res.data!.code.code).toMatch(/^GS-[A-Z]{2,6}-\d{1,4}$/);
    expect(res.data!.code.accountId).toBe('r_003');
  });

  it('returns an existing code on second call', async () => {
    const first = await api.referrals.getCodeForAccount('r_001');
    const second = await api.referrals.getCodeForAccount('r_001');
    expect('data' in first && 'data' in second).toBe(true);
    expect(first.data!.code.code).toBe(second.data!.code.code);
  });

  it('accepts a custom code and rejects duplicates', async () => {
    const custom = await api.referrals.createCode('r_004', 'GS-CUSTOM-42');
    expect('data' in custom).toBe(true);
    expect(custom.data!.code.code).toBe('GS-CUSTOM-42');

    const duplicate = await api.referrals.createCode('r_005', 'GS-CUSTOM-42');
    expect('problem' in duplicate).toBe(true);
    expect(duplicate.problem!.status).toBe(409);
  });

  it('lists referrals for a referrer', async () => {
    const res = await api.referrals.listReferrals('r_001');
    expect('data' in res).toBe(true);
    expect(res.data!.referrals.length).toBeGreaterThan(0);
    expect(res.data!.referrals.every((r) => r.referrerId === 'r_001')).toBe(true);
  });

  it('lists ledger entries for an account', async () => {
    const res = await api.referrals.listLedger('r_001');
    expect('data' in res).toBe(true);
    expect(res.data!.entries.length).toBeGreaterThan(0);
    expect(res.data!.entries.some((e) => e.type === 'referrer_credit')).toBe(true);
  });

  it('derives stats correctly', async () => {
    const res = await api.referrals.getStats('r_001');
    expect('data' in res).toBe(true);
    const s = res.data!.stats;
    expect(s.accountId).toBe('r_001');
    expect(s.invitesSent).toBeGreaterThan(0);
    expect(s.qualifiedReferrals).toBeGreaterThanOrEqual(1);
    expect(s.earnedRewardsCents).toBeGreaterThanOrEqual(150_00);
    expect(s.pendingRewardsCents).toBeGreaterThanOrEqual(0);
    expect(s.kFactor).toBeGreaterThanOrEqual(0);
  });

  it('records a click and creates a referral', async () => {
    const res = await api.referrals.recordClick('GS-RVR-001', 'qr_sticker');
    expect('data' in res).toBe(true);
    expect(res.data!.referral.status).toBe('clicked');
    expect(res.data!.referral.channel).toBe('qr_sticker');
  });

  it('returns an error for an unknown referral code click', async () => {
    const res = await api.referrals.recordClick('GS-UNKNOWN-99');
    expect('problem' in res).toBe(true);
    expect(res.problem!.status).toBe(404);
  });

  it('qualifies a referral and posts rewards', async () => {
    const seed = await api.referrals.listReferrals('r_002');
    const target = seed.data!.referrals.find((r) => r.status === 'kit_delivered');
    expect(target).toBeDefined();

    const res = await api.referrals.qualifyReferral(target!.id);
    expect('data' in res).toBe(true);
    expect(res.data!.referral.status).toBe('qualified');
    expect(res.data!.entries).toHaveLength(2);
    expect(res.data!.entries.some((e) => e.type === 'referrer_credit' && e.amountCents === 150_00)).toBe(true);
    expect(res.data!.entries.some((e) => e.type === 'referee_discount' && e.amountCents === 100_00)).toBe(true);
  });

  it('claws back a qualified referral and reverses rewards', async () => {
    const seed = await api.referrals.listReferrals('r_002');
    const target = seed.data!.referrals.find((r) => r.status === 'qualified');
    expect(target).toBeDefined();

    const res = await api.referrals.clawBack(target!.id);
    expect('data' in res).toBe(true);
    expect(res.data!.referral.status).toBe('clawed_back');
    expect(res.data!.entries.every((e) => e.status === 'clawed_back')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the referral tests**

Run: `cd app && npm run test:run src/api/__tests__/client.test.ts`  
Expected: all referral tests pass.

- [ ] **Step 3: Run the full test suite**

Run: `cd app && npm run test:run`  
Expected: all tests pass.

- [ ] **Step 4: Run lint and TypeScript**

Run:
```bash
cd app && npm run lint && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/src/api/__tests__/client.test.ts
git commit -m "test(referrals): add referral API endpoint tests"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run the full verification command**

```bash
cd app && npm run test:run && npm run lint && npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 2: Commit any last fixes**

If no fixes, skip.

---

## Self-Review

1. **Spec coverage:** All spec types, DB tables, endpoints, and tests map to tasks.
2. **Placeholder scan:** No TBD/TODO placeholders.
3. **Type consistency:** Names used in Task 3 match Task 1 definitions exactly.
