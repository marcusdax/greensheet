# Referral Engine — UI, Fraud Controls, and In-Product Card

> Source: `marketing/03-referral-engine-playbook.md`
> Scope: Sub-projects 2 (UI + Zustand slice), 4 (in-product referral card), and 3 (attribution / fraud controls + review queue).
> Execution order: Sub-project 2 → Sub-project 4 → Sub-project 3.

## Goal

Add a complete, localized referral program experience to the Greensheet frontend:
- A logged-in roaster dashboard for managing referral codes, tracking invites, viewing rewards, and sharing the program.
- An in-product share card shown at the delivery-delight moment.
- Mock fraud/attribution controls that gate qualification and a review queue for flagged referrals.

All state changes continue to flow through the mock `api.referrals` namespace and the in-memory `db` tables added in Sub-project 1.

---

## Architecture

```
app/src/
  pages/
    ReferralsPage.tsx          # dashboard: code, stats, invites, ledger
    ReviewQueuePage.tsx        # referrals needing manual review
  components/referrals/
    ReferralCodeCard.tsx       # code display + copy + custom-code input
    ReferralStatsCard.tsx      # KPIs, tier badge, net credits
    ReferralInvitesTable.tsx   # DataTable of Referral rows
    ReferralLedgerTable.tsx    # DataTable of RewardLedgerEntry rows
    ReferralShareCard.tsx      # channel share buttons + URL
    ReferralDeliveryCard.tsx   # Sub-project 4 card
  stores/
    slices/referrals-slice.ts  # state + actions
    selectors/referral-selectors.ts  # derived tier, funnel, net earned
  lib/
    referral-fraud.ts          # pure fraud/attribution helpers
  api/__tests__/
    referrals-fraud.test.ts    # fraud helper tests
```

- The Zustand slice mirrors `api.referrals` and caches `code`, `referrals`, `ledger`, `stats`, and `reviewQueue`.
- Selectors derive the referrer tier, net earned credits, and funnel counts.
- Fraud helpers are pure TypeScript functions; `api.referrals.qualifyReferral` calls them before posting rewards.
- The `ReviewQueuePage` filters `db.referrals` by `reviewStatus === 'pending_review'`.

---

## Global Constraints

- Economic values from the playbook: referrer reward = `$150` credit, referee reward = `$100` off first order ≥ `$150`, referral CAC ≤ `$200`.
- Qualification pays only after the referee's first paid order is delivered and not returned within 30 days.
- Fraud controls must fail silently from the referee's perspective (no accusation emails).
- All new UI text is localized via `i18next`.
- Every new file and modified API endpoint has focused tests.
- Follow existing patterns for pages, slices, selectors, and components.

---

## Data Model Extensions

### `Roaster` type (`app/src/types/api.ts`)

Add identity fields needed for fraud checks:

```ts
export interface Roaster {
  // ... existing fields ...
  taxId?: string;
  businessRegistration?: string;
  billingAddress?: string;
  cardFingerprint?: string;
  deviceFingerprint?: string;
  ipSubnet?: string; // e.g. "192.168.1.0/24"
}
```

### `Referral` type

Add review/attribution tracking:

```ts
export interface Referral {
  // ... existing fields ...
  reviewStatus?: 'pending_review' | 'approved' | 'declined';
  refereeOrderId?: string;
}
```

### Seed data

- Add identity values for seeded roasters `r_001`–`r_005` in `seedDatabase()`.
- Keep values distinct enough to exercise the identity-graph checks.

---

## Sub-project 2: Referral UI + Zustand Slice

### State shape

```ts
export interface ReferralsState {
  code: ReferralCode | null;
  referrals: Referral[];
  ledger: RewardLedgerEntry[];
  stats: ReferralStats | null;
  reviewQueue: Referral[];
  loading: boolean;
  error: Problem | null;
}
```

### Actions

- `loadCode(accountId): Promise<void>` — `api.referrals.getCodeForAccount`
- `loadReferrals(accountId): Promise<void>` — `api.referrals.listReferrals`
- `loadLedger(accountId): Promise<void>` — `api.referrals.listLedger`
- `loadStats(accountId): Promise<void>` — `api.referrals.getStats`
- `loadReviewQueue(): Promise<void>` — filter `db.referrals` for `reviewStatus === 'pending_review'`
- `recordClick(code, channel): Promise<void>` — `api.referrals.recordClick`
- `qualify(referralId): Promise<void>` — `api.referrals.qualifyReferral`
- `clawBack(referralId): Promise<void>` — `api.referrals.clawBack`
- `approveReview(referralId): Promise<void>` — set `reviewStatus = 'approved'`, then qualify
- `declineReview(referralId): Promise<void>` — set `reviewStatus = 'declined'`, no rewards

### Selectors (`src/stores/selectors/referral-selectors.ts`)

- `useReferralCode()`
- `useReferralStats()`
- `useReferralTier()` — maps `stats.qualifiedReferrals` to Cupper / Green Buyer / Compass Circle.
- `useNetEarnedCents()` — `earnedRewardsCents - clawedBackRewardsCents`.
- `useFunnelCounts()` — `{ invitesSent, clicks, signups, kitRequests, kitDeliveries, feedbackSubmitted, qualifiedReferrals }`.

### Components

#### `ReferralCodeCard`
- Display `code.code`.
- Copy-to-clipboard button.
- Input to request a custom code; call `api.referrals.createCode`.
- Show error problem inline.

#### `ReferralStatsCard`
- Grid of KPIs: invites sent, clicks, signups, qualified, earned credits, pending credits, K-factor.
- Tier badge with name and hardcoded perk description.

#### `ReferralInvitesTable`
- Columns: referee, channel, status badge, createdAt, actions.
- Action buttons for `Qualify` and `Claw back` when applicable.

#### `ReferralLedgerTable`
- Columns: date, type badge, amount, status badge, description.

#### `ReferralShareCard`
- Referral URL with `utm_source=referral&utm_medium={channel}&utm_campaign=ref_core_2025`.
- Buttons for invite link, QR sticker, email share, Instagram DM, event badge.

### Page

`ReferralsPage.tsx` renders the header, code card, stats card, share card, invites table, and ledger table. It loads all data in a `useEffect` on mount.

### Navigation

- Add a `referrals` route inside the `/:locale` layout in `App.tsx`.
- Add a sidebar item under a new `GROWTH` group in `AppLayout.tsx`.

### i18n

- Add `referrals` namespace in `app/src/i18n/index.ts`.
- Add keys to `localization/02-locale-files/en-US.json` and the other three locale files.

---

## Sub-project 4: In-Product Referral Card

### `ReferralDeliveryCard`

- Accepts `accountId: string`.
- Loads the active code and stats from the referrals slice.
- Copy: *“Know a roaster still buying off PDFs? Send them a real kit — scoresheets included. You get $150 of roast credit when their first order lands.”*
- Shows the referral URL and a copy-to-clipboard button.
- Uses existing card styling (`bg-surface`, `border-border`, `shadow-e1`).

### Placement

- In `OrdersPage.tsx`, render `ReferralDeliveryCard` when the selected order has `status === 'delivered'`.

---

## Sub-project 3: Fraud / Attribution + Review Queue

### Pure helpers (`app/src/lib/referral-fraud.ts`)

```ts
export interface FraudInputs {
  referral: Referral;
  referrer: Roaster;
  referee: Roaster | undefined;
  refereeOrders: Order[];
  allReferrals: Referral[];
}

export type ReviewDecision =
  | { action: 'qualify' }
  | { action: 'decline'; reason: string }
  | { action: 'review'; reason: string };

export function evaluateReferral(inputs: FraudInputs): ReviewDecision;

export function identityGraphMatch(referral: Referral, referrer: Roaster, referee: Roaster): boolean;
export function qualificationFloorMet(referral: Referral, orders: Order[]): boolean;
export function velocityExceeded(accountId: string, referrals: Referral[], windowDays: number, max: number): boolean;
export function ringDetected(referral: Referral, allReferrals: Referral[], windowDays: number): boolean;
export function resellerScreen(referee: Roaster): boolean;
```

Fraud rules from the playbook:

1. **Identity graph match** — block if `taxId`, `billingAddress`, `cardFingerprint`, `deviceFingerprint`, or `ipSubnet` match between referrer and referee.
2. **Qualification floor** — first paid order total ≥ `$150`, status `delivered`, and 30-day return window passed.
3. **Velocity limits** — >5 claimed referrals per account per 30 days → `review`; >10 → `decline`.
4. **Ring detection** — mutual referral pairs within 60 days flag; second leg goes to `review` with 50% reward.
5. **Reseller screen** — referee must have `businessRegistration` and `taxId`.
6. **Spend-through cap** — credits cover max 50% of any order (handled at checkout, not in this sub-project).
7. **Silent declines** — `decline` returns a generic reason like `Referral did not qualify`.

### API changes

Rewrite `api.referrals.qualifyReferral` to:

1. Load `referral`, `referrer`, `referee`, and `refereeOrders`.
2. Call `evaluateReferral`.
3. If `decline`: set `reviewStatus = 'declined'`, do not post rewards, return `{ referral, entries: [] }`.
4. If `review`: set `reviewStatus = 'pending_review'`, do not post rewards, return `{ referral, entries: [] }`.
5. If `qualify`: mark `qualified` and post both rewards as before.

### Review queue

`ReviewQueuePage.tsx`:
- Loads `db.referrals` where `reviewStatus === 'pending_review'`.
- Table columns: createdAt, referrer, referee, code, risk reason, actions.
- Actions: `Approve` (calls `approveReview`, which qualifies and posts rewards) and `Decline` (calls `declineReview`, sets status to `declined`).

### Tests

- `app/src/api/__tests__/referrals-fraud.test.ts` covers each fraud rule in isolation.
- Extend `app/src/api/__tests__/client.test.ts` with cases for declined and review-pending qualifications.
- Add slice tests for `loadReviewQueue`, `approveReview`, and `declineReview`.

---

## Out of Scope

- Public `/r/:code` referee landing page.
- Checkout code-entry fallback.
- Real device/card fingerprinting or payment-provider integrations.
- Tier reward model/back-end for non-monetary perks (display only).

---

## Success Criteria

- `ReferralsPage` renders code, stats, invites, and ledger without errors.
- Slice actions load and mutate state correctly.
- `ReferralDeliveryCard` appears on `delivered` orders.
- Fraud helpers correctly decline/review/qualify seeded scenarios.
- `ReviewQueuePage` lists and resolves pending-review referrals.
- `npm run test:run` and `npx tsc --noEmit` remain clean.
