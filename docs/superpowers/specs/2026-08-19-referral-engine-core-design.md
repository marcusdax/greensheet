# Referral Engine — Core Data Model & Mock API (Sub-project 1)

> Source: `marketing/03-referral-engine-playbook.md`
> Scope: types, mock DB tables, and API endpoints that power the referral program UI and future attribution/fraud work.

## Goal

Add a complete, mocked referral data layer to the Greensheet frontend so the app can display referral codes, referral funnels, reward balances, and program stats without requiring a real backend.

## Architecture

- New domain types live in `app/src/types/api.ts` and are re-exported from `app/src/api/client.ts`.
- In-memory mock tables live in `app/src/api/db.ts` and are seeded on startup.
- All state changes are performed through `api.referrals.*` mock endpoints under `app/src/api/client.ts`.
- Endpoints return `ApiResult<T>` following the existing `data | problem` contract.
- No UI, Zustand slice, or page changes in this sub-project; those are Sub-projects 2+.

## Global Constraints

- Match economic values from `03-referral-engine-playbook.md`: referrer reward = $150 credit (≈ $90 COGS), referee reward = free upgraded kit + $100 off, referral CAC ≤ $200, qualification on first paid order delivered and 30-day return window.
- Use exact TypeScript property names and types; downstream Sub-projects 2–4 depend on them.
- Follow the existing `api.analytics` mock pattern: async functions, hardcoded seed data, immutable-style updates on the `db` arrays.
- Every endpoint has a focused test in `app/src/api/__tests__/client.test.ts`.
- Use the same `ApiResult<T>` and `Problem` error contract as the rest of `app/src/api/client.ts`.

## Data Model

### Types

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

### Mock DB Tables

Add to `app/src/api/db.ts`:

```ts
referralCodes: [] as ReferralCode[],
referrals: [] as Referral[],
rewardsLedger: [] as RewardLedgerEntry[],
```

### Seed Data

In `seedDatabase()`:

- For `r_001` (Blue Bottle), create an active code `GS-RVR-001`.
- For `r_002` (Heart), create an active code `GS-RVR-002`.
- Seed at least five `Referral` rows for `r_001` and three for `r_002` spanning statuses:
  - `invited`, `clicked`, `signed_up`, `kit_requested`, `kit_delivered`, `feedback_submitted`, `qualified`.
- Seed matching `RewardLedgerEntry` rows:
  - A pending `$150` referrer credit for each `qualified` referral.
  - A posted `$150` referrer credit for one historical qualified referral.
  - One clawed-back entry to exercise that status.

## API Endpoints

Add an `api.referrals` namespace in `app/src/api/client.ts`:

### `getCodeForAccount`

```ts
getCodeForAccount: (accountId: string) => Promise<ApiResult<{ code: ReferralCode }>>
```

Returns the existing active code for the account. If none exists, lazily generates one using `generateRefCode()`, persists it, and returns it.

### `createCode`

```ts
createCode: (accountId: string, requestedCode?: string) => Promise<ApiResult<{ code: ReferralCode }>>
```

Creates a new referral code. If `requestedCode` is provided, validates it is unique (case-insensitive) and matches `/^GS-[A-Z]{2,6}-\d{1,4}$/` or falls back to generated. Returns a problem if the requested code is already taken.

### `listReferrals`

```ts
listReferrals: (accountId: string) => Promise<ApiResult<{ referrals: Referral[] }>>
```

Returns all `Referral` rows where `referrerId === accountId`, sorted by `createdAt` descending.

### `listLedger`

```ts
listLedger: (accountId: string) => Promise<ApiResult<{ entries: RewardLedgerEntry[] }>>
```

Returns all `RewardLedgerEntry` rows where `accountId === accountId`, sorted by `createdAt` descending.

### `getStats`

```ts
getStats: (accountId: string) => Promise<ApiResult<{ stats: ReferralStats }>>
```

Derives `ReferralStats` from the account's referrals and ledger:

- `invitesSent` = count of `Referral` rows with `referrerId === accountId`.
- `clicks` = count with `status` in clicked-or-later (i.e., `clicked`, `signed_up`, `kit_requested`, `kit_delivered`, `feedback_submitted`, `qualified`, `clawed_back`).
- `signups`, `kitRequests`, `kitDeliveries`, `feedbackSubmitted`, `qualifiedReferrals` = counts at or past the corresponding status.
- `pendingRewardsCents` = sum of ledger `amountCents` where `type === 'referrer_credit'` and `status === 'pending'`.
- `earnedRewardsCents` = sum where `type === 'referrer_credit'` and `status === 'posted'`.
- `clawedBackRewardsCents` = sum where `status === 'clawed_back'`.
- `kFactor` = `qualifiedReferrals / max(activeAccounts, 1)` for the referrer's account (simplified; for seeded data compute from counts so it matches the playbook's 0.43–0.61 band).

### `recordClick`

```ts
recordClick: (code: string, channel?: ReferralChannel) => Promise<ApiResult<{ referral: Referral }>>
```

Creates a new `Referral` row in `clicked` status for the given code's referrer. If a referral with the same code and no `refereeId` already exists in `invited` status, update it to `clicked` instead of creating a new row.

### `qualifyReferral`

```ts
qualifyReferral: (referralId: string) => Promise<ApiResult<{ referral: Referral; entries: RewardLedgerEntry[] }>>
```

Transitions a `Referral` from `first_order_delivered` (or earlier) to `qualified`, sets `qualifiedAt`, and creates two ledger entries:
- `$150` referrer credit with `status: 'posted'` (playbook reward).
- `$100` referee discount with `status: 'posted'`.

If the referral is already `qualified`, return the existing state.

### `clawBack`

```ts
clawBack: (referralId: string) => Promise<ApiResult<{ referral: Referral; entries: RewardLedgerEntry[] }>>
```

Transitions a `qualified` referral to `clawed_back`, sets `clawedBackAt`, and flips associated `posted` ledger entries to `clawed_back`.

## Helper Functions

- `generateRefCode(): string` — produces codes like `GS-XXXX-NN` using a small deterministic counter + random suffix, ensuring no collisions with existing seeded codes.
- `nextRefCodeIndex(): number` — tracks a private counter inside `client.ts` for deterministic generation during the session.

## Tests

Add a new `describe('referrals api', () => { ... })` block in `app/src/api/__tests__/client.test.ts`:

- `getCodeForAccount creates a code lazily`
- `createCode accepts a custom code and rejects duplicates`
- `listReferrals returns referrals for the referrer`
- `listLedger returns ledger entries for the account`
- `getStats derives correct counts and rewards`
- `recordClick creates a clicked referral`
- `qualifyReferral posts rewards and transitions status`
- `clawBack revokes rewards and transitions status`

## Out of Scope

- UI pages or components (Sub-project 2).
- Zustand slice / selector hook (Sub-project 2).
- UTM attribution resolver, identity-graph fraud controls, velocity limits, ring detection (Sub-project 3).
- In-product referral card on delivery confirmation (Sub-project 4).

## Files to Touch

- `app/src/types/api.ts` — add referral types.
- `app/src/api/db.ts` — add tables and seed data.
- `app/src/api/client.ts` — add `api.referrals` namespace and helpers.
- `app/src/api/__tests__/client.test.ts` — add tests.

## Success Criteria

- `npm run test:run src/api/__tests__/client.test.ts` passes.
- `npx tsc --noEmit` is clean.
- `npm run lint` has no new warnings.
- All new endpoints return correct hardcoded values consistent with the playbook economics.
