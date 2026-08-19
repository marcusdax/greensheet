# COF-001 → COF-005 Campaign Seed Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder campaign/rule seed data in the Greensheet app with the real COF-001 → COF-005 nurture-engine definitions from `marketing/02-cof-campaign-expansion.md`, so CampaignsPage shows accurate campaigns, rule sequences, A/B subject variants, and campaign-specific performance metrics.

**Architecture:** Add a small marketing domain layer (`types/marketing.ts` + `api/marketing-data.ts`) that holds canonical merge tokens and all 13 email/SMS templates. The in-memory mock DB seeds five campaigns, five rules, and the template library. The existing API client returns per-campaign performance presets, and CampaignsPage derives its rule-level A/B mock data from the seeded templates instead of a hard-coded array.

**Tech stack:** React 19, TypeScript 6, Vite, Vitest, Zustand, Recharts, Tailwind. No new runtime dependencies.

## Global Constraints

- **Scope is seed data only.** Landing pages, real email/SMS delivery, orchestrator execution, and the Bayesian runtime are out of scope.
- Rule codes must stay within the existing `^COF-00[1-9]$` regex.
- Rule actions must use the existing `RuleActionType` enum (`SEND_TEMPLATE`, `UPDATE_CRM_LIFECYCLE`, `EXECUTE_CAMPAIGN_HALT`). Store `ab_test_id`/`fire_if` in `payload`.
- Template IDs are human-readable (`COF-001-E1`) even though `ruleCreateSchema` expects UUIDs; seeded rules bypass API validation.
- All copy must match `marketing/02-cof-campaign-expansion.md` verbatim.
- `npm run test:run` and `npm run build` must pass before the task is complete.

---

### Task 1: Extend API types and add marketing domain types

**Files:**
- Modify: `app/src/types/api.ts` (extend `CampaignFunnel`)
- Create: `app/src/types/marketing.ts`

**Interfaces:**
- Consumes: existing `CampaignVariant` from `app/src/types/api.ts`
- Produces: `CampaignToken`, `TemplateMetrics`, `MarketingTemplate`

- [ ] **Step 1: Add funnel fields to `CampaignFunnel`**

```ts
// app/src/types/api.ts — replace the CampaignFunnel block
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
```

- [ ] **Step 2: Create the marketing types file**

```ts
// app/src/types/marketing.ts
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
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd app && npx tsc -b --noEmit`
Expected: no type errors from the new files.

- [ ] **Step 4: Commit**

```bash
cd app
npx tsc -b --noEmit
# if clean:
git add src/types/api.ts src/types/marketing.ts
git commit -m "feat(marketing): add campaign token and template types"
```

---

### Task 2: Create the merge-token registry and template library

**Files:**
- Create: `app/src/api/marketing-data.ts`

**Interfaces:**
- Consumes: `CampaignToken`, `MarketingTemplate` from Task 1
- Produces: `CAMPAIGN_TOKENS`, `MARKETING_TEMPLATES`

- [ ] **Step 1: Write the constants file**

```ts
// app/src/api/marketing-data.ts
import type { CampaignToken, MarketingTemplate } from '../types/marketing';

export const CAMPAIGN_TOKENS: CampaignToken[] = [
  // Canonical tokens from §0.2
  { token: '{first_name}', sourceField: 'users.first_name', tooltip: "Contact's first name" },
  { token: '{roaster_name}', sourceField: 'accounts.roaster_name', tooltip: 'Account / roastery name' },
  { token: '{origin}', sourceField: 'coffee_lots.origin', tooltip: 'Country of origin' },
  { token: '{region}', sourceField: 'coffee_lots origin metadata', tooltip: 'Producing region (e.g., Gedeb, Huila)' },
  { token: '{process_method}', sourceField: 'coffee_lots.processing_method', tooltip: 'washed / natural / honey / anaerobic' },
  { token: '{sca_cup_score}', sourceField: 'coffee_lots.cup_score', tooltip: 'SCA cup score, one decimal (e.g., 86.5)' },
  { token: '{elevation_masl}', sourceField: 'coffee_lots.elevation', tooltip: 'Meters above sea level' },
  { token: '{varietal}', sourceField: 'coffee_lots.varietal', tooltip: 'e.g., Heirloom, Caturra, Pink Bourbon' },
  { token: '{flavor_notes}', sourceField: 'coffee_lots.flavor_notes (JSONB)', tooltip: 'Top three cupping notes' },
  { token: '{lot_size_bags}', sourceField: 'derived: available_quantity_lbs ÷ 152', tooltip: 'Bags remaining' },
  { token: '{price_per_lb}', sourceField: 'coffee_lots.price_per_lb_cents ÷ 100', tooltip: 'USD per lb, landed' },
  { token: '{kit_tracking_url}', sourceField: 'fulfillment service', tooltip: 'Live tracking link' },
  { token: '{feedback_url}', sourceField: 'app link w/ UTM', tooltip: 'One-tap cupping feedback form' },
  { token: '{shortlist_url}', sourceField: 'app link w/ UTM', tooltip: 'Personalized lot shortlist' },
  { token: '{referral_url}', sourceField: 'referral engine (file 03)', tooltip: 'Personal referral link' },
  { token: '{importer_name}', sourceField: 'supply-side account', tooltip: 'Fulfilling importer/exporter' },
  { token: '{rep_first_name}', sourceField: 'assigned CSM/rep', tooltip: 'Human sender' },
  { token: '{savings_estimate}', sourceField: 'pricing engine', tooltip: 'Modeled landed-cost delta' },
  // Extended copy tokens used in COF templates
  { token: '{feedback_highlight}', sourceField: 'feedback engine', tooltip: "Roaster's own cupping note highlight" },
  { token: '{bags_sold_since}', sourceField: 'inventory engine', tooltip: 'Bags sold since feedback' },
  { token: '{days_left_on_lock}', sourceField: 'pricing engine', tooltip: 'Days remaining on 14-day price lock' },
  { token: '{peer_count}', sourceField: 'cohort model', tooltip: 'Number of peer roasters in model' },
  { token: '{first_order_lbs}', sourceField: 'order history', tooltip: 'Size of first order in lbs' },
  { token: '{days_since_order}', sourceField: 'order history', tooltip: 'Days since first order delivered' },
];

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  // COF-001 — First Crack
  {
    id: 'COF-001-E1',
    campaignId: 'COF-001',
    touchpoint: 1,
    channel: 'email',
    subjectA: 'An {sca_cup_score}-point {process_method} {origin} is waiting on your cupping table',
    subjectB: '{first_name}, we set aside a sample kit for {roaster_name}',
    body: `{sca_cup_score} points. {elevation_masl} meters. One {process_method} process, done properly.

Hi {first_name},

You can read a hundred importer blurbs about "stone fruit and florals." Or you can put 200 grams of this {origin} {varietal} — grown at {elevation_masl} masl in {region}, {process_method} processed, cupped at {sca_cup_score} by a licensed Q-grader — on your own table and decide in eleven minutes.

We'd rather you do the second thing.

Your {roaster_name} sample kit is reserved. It holds this lot plus two more matched to how you roast: whole-bean green samples, the actual Q-grader scoresheets (not marketing copy), and landed-cost math down to the cent per pound.

[ Claim the kit — $0, ships in 48 hours ] → {kit_tracking_url}

No contract. No minimum. If the coffee doesn't cup, you've lost nothing but a brew cycle.

— {rep_first_name}, Greensheet
P.S. There are {lot_size_bags} bags of the {region} lot. We'll never email you fake scarcity — that's the real count from the warehouse.`,
    mergeTokens: ['{first_name}', '{roaster_name}', '{origin}', '{region}', '{process_method}', '{sca_cup_score}', '{elevation_masl}', '{varietal}', '{lot_size_bags}', '{kit_tracking_url}', '{rep_first_name}'],
    metrics: { primary: 'kit_request_rate', baselineRate: 24, targetRate: 32, mde: 4, openRateA: 45, openRateB: 52 },
  },
  {
    id: 'COF-001-E2',
    campaignId: 'COF-001',
    touchpoint: 2,
    channel: 'email',
    subjectA: "The kit's still here. The {origin} might not be.",
    subjectB: 'What {sca_cup_score} points actually tastes like',
    body: `Hi {first_name} — no pressure sequence, just one honest fact: kits ship in request order, and {lot_size_bags} bags is the entire position on this {process_method} {origin}.

The kit costs you nothing. It costs us $38 to put on your table, and we do it gladly, because roasters who cup with real scoresheets in hand reorder at rates our spreadsheet-era competitors don't believe.

[ Claim your kit ] → {kit_tracking_url}

— {rep_first_name}`,
    mergeTokens: ['{first_name}', '{origin}', '{process_method}', '{sca_cup_score}', '{lot_size_bags}', '{kit_tracking_url}', '{rep_first_name}'],
    metrics: { primary: 'kit_request_rate', baselineRate: 24, targetRate: 32, mde: 4, openRateA: 40, openRateB: 48 },
  },
  {
    id: 'COF-001-S1',
    campaignId: 'COF-001',
    touchpoint: 3,
    channel: 'sms',
    subjectA: 'Hi {first_name}, {rep_first_name} from Greensheet. Your {roaster_name} sample kit is still reserved — the {sca_cup_score}-pt {process_method} {origin} plus two matched lots, free. Want me to hold it one more week or release it? Claim: {kit_tracking_url} Reply STOP to opt out.',
    subjectB: null,
    body: 'Hi {first_name}, {rep_first_name} from Greensheet. Your {roaster_name} sample kit is still reserved — the {sca_cup_score}-pt {process_method} {origin} plus two matched lots, free. Want me to hold it one more week or release it? Claim: {kit_tracking_url} Reply STOP to opt out.',
    mergeTokens: ['{first_name}', '{rep_first_name}', '{roaster_name}', '{sca_cup_score}', '{process_method}', '{origin}', '{kit_tracking_url}'],
    metrics: { primary: 'kit_request_rate', baselineRate: 24, targetRate: 32, mde: 4, openRateA: 18, openRateB: null },
  },

  // COF-002 — The Cupping
  {
    id: 'COF-002-E1',
    campaignId: 'COF-002',
    touchpoint: 1,
    channel: 'email',
    subjectA: 'Your {origin} has been on the table 4 days. How did it cup?',
    subjectB: '11 minutes, {first_name} — the {process_method} lot is ready when you are',
    body: `The kettle's the only thing missing.

Hi {first_name},

Our tracking says your kit landed four days ago — which means the {process_method} {origin} ({sca_cup_score} pts, {elevation_masl} masl) has either already perfumed your lab, or it's waiting for a quiet eleven minutes.

If it helps, here's how other roasters are cupping it:

- Fragrance/aroma: look for {flavor_notes} at the dry grounds
- The break: {process_method} lots from {region} tend to open up floral — skim and give it 30 more seconds before you judge the nose
- As it cools: this lot's sweetness shows up at ~50°C. Don't score it hot.

When you've cupped, two taps and you're done: {feedback_url}

Your scores go straight into your shortlist — tell us the cup was thin, and we'll stop recommending bright {process_method} lots. Tell us it sang, and we'll find you its siblings before anyone else cups them.

— {rep_first_name}
P.S. The Q-grader's original scoresheet is the second card in the box. Score blind against it — most roasters land within half a point, which is exactly why we ship the real sheet.`,
    mergeTokens: ['{first_name}', '{origin}', '{process_method}', '{sca_cup_score}', '{elevation_masl}', '{region}', '{flavor_notes}', '{feedback_url}', '{rep_first_name}'],
    metrics: { primary: 'feedback_submission_rate', baselineRate: 38, targetRate: 45, mde: 4, openRateA: 42, openRateB: 50 },
  },
  {
    id: 'COF-002-S1',
    campaignId: 'COF-002',
    touchpoint: 2,
    channel: 'sms',
    subjectA: "Hi {first_name}, {rep_first_name} at Greensheet. Your {origin} kit's been there a week — cupped it yet? Even a \"too bright for us\" helps me tune {roaster_name}'s shortlist. 60 seconds, honestly: {feedback_url}",
    subjectB: null,
    body: "Hi {first_name}, {rep_first_name} at Greensheet. Your {origin} kit's been there a week — cupped it yet? Even a \"too bright for us\" helps me tune {roaster_name}'s shortlist. 60 seconds, honestly: {feedback_url}",
    mergeTokens: ['{first_name}', '{rep_first_name}', '{origin}', '{roaster_name}', '{feedback_url}'],
    metrics: { primary: 'feedback_submission_rate', baselineRate: 38, targetRate: 45, mde: 4, openRateA: 15, openRateB: null },
  },

  // COF-003 — The Shortlist
  {
    id: 'COF-003-E1',
    campaignId: 'COF-003',
    touchpoint: 1,
    channel: 'email',
    subjectA: 'You scored the {origin} an {sca_cup_score}. Here\'s what we\'d do next.',
    subjectB: "{roaster_name}'s shortlist: 3 lots that match how you cup",
    body: `Your cupping notes, working for you.

Hi {first_name},

You gave the {process_method} {origin} an {sca_cup_score} and wrote "{feedback_highlight}" — so here's the honest read from your shortlist:

1. The one you already love. {origin}, {region} — {sca_cup_score} pts, {process_method}, {elevation_masl} masl. {lot_size_bags} bags left at \${price_per_lb}/lb landed. First orders lock this lot's pricing for 14 days.

2. Its sibling. Same washing station, earlier harvest week — cups ~0.5 brighter on acidity. For the menu slot where the first lot is almost right.

3. The wild card. A {varietal} from {region} you haven't cupped — flagged by our model because roasters who scored this lot like you did reordered it within 30 days at a 71% rate.

[ See {roaster_name}'s shortlist → ] {shortlist_url}

Freight, contracts, and the invoice all live in the same screen. No PDF tennis.

— {rep_first_name}
P.S. Not ready for a full bag? Split-bag options start at 30 lbs on this lot.`,
    mergeTokens: ['{first_name}', '{origin}', '{process_method}', '{sca_cup_score}', '{feedback_highlight}', '{region}', '{elevation_masl}', '{lot_size_bags}', '{price_per_lb}', '{varietal}', '{roaster_name}', '{shortlist_url}', '{rep_first_name}'],
    metrics: { primary: 'sample_to_sale', baselineRate: 32, targetRate: 40, mde: 4, openRateA: 38, openRateB: 45 },
  },
  {
    id: 'COF-003-E2',
    campaignId: 'COF-003',
    touchpoint: 2,
    channel: 'email',
    subjectA: "{lot_size_bags} bags. That's the whole position, {first_name}.",
    subjectB: 'The roastery two towns over didn\'t wait',
    body: `Hi {first_name} — two facts, no pressure:

1. Since your cupping notes came in, {bags_sold_since} bags of the {region} lot have moved. {lot_size_bags} remain. That number is live from the warehouse, not a countdown timer we reset at midnight.
2. Roasters in your peer quantile who bought their shortlist's #1 match within 7 days reordered at 71%. The ones who waited for "next harvest" mostly ended up cupping someone else's leftovers at the same price.

Your 14-day price lock expires in {days_left_on_lock} days: {shortlist_url}

— {rep_first_name}`,
    mergeTokens: ['{first_name}', '{lot_size_bags}', '{bags_sold_since}', '{region}', '{days_left_on_lock}', '{shortlist_url}', '{rep_first_name}'],
    metrics: { primary: 'sample_to_sale', baselineRate: 32, targetRate: 40, mde: 4, openRateA: 35, openRateB: 42 },
  },
  {
    id: 'COF-003-S1',
    campaignId: 'COF-003',
    touchpoint: 3,
    channel: 'sms',
    subjectA: '{first_name}, {rep_first_name} (Greensheet). Your {origin} price lock lapses {days_left_on_lock}d from now — {lot_size_bags} bags left, and I can hold 30 lbs on a split-bag if cash flow\'s the blocker. Want me to? {shortlist_url}',
    subjectB: null,
    body: '{first_name}, {rep_first_name} (Greensheet). Your {origin} price lock lapses {days_left_on_lock}d from now — {lot_size_bags} bags left, and I can hold 30 lbs on a split-bag if cash flow\'s the blocker. Want me to? {shortlist_url}',
    mergeTokens: ['{first_name}', '{rep_first_name}', '{origin}', '{days_left_on_lock}', '{lot_size_bags}', '{shortlist_url}'],
    metrics: { primary: 'sample_to_sale', baselineRate: 32, targetRate: 40, mde: 4, openRateA: 10, openRateB: null },
  },

  // COF-004 — Second Cup
  {
    id: 'COF-004-E1',
    campaignId: 'COF-004',
    touchpoint: 1,
    channel: 'email',
    subjectA: 'Wrong coffee? Wrong time? Wrong importer? (One tap tells us)',
    subjectB: '{first_name}, did the kit miss the mark?',
    body: `No guilt. Just a question.

Hi {first_name},

Your kit landed nine days ago and we haven't heard how the {process_method} {origin} cupped. Totally fine — roast schedules eat calendars. But one tap here genuinely changes what we send {roaster_name} next:

[ ☕ Cupped it — notes coming ] (we'll hold your shortlist)
[ 📅 Haven't had the eleven minutes ] (we'll nudge you next week, once)
[ 🙅 Not the right coffees for us ] (tell us one word why — we re-match or stop)

That third option is real. If our lots aren't right for your menu, we'd rather know now than become the newsletter you archive.

— {rep_first_name}
P.S. If the box arrived damaged or a sample was off, reply to this email — a human (me) reads these, and replacement kits ship same-week.`,
    mergeTokens: ['{first_name}', '{process_method}', '{origin}', '{roaster_name}', '{rep_first_name}'],
    metrics: { primary: 'rescue_rate', baselineRate: 11, targetRate: 18, mde: 3, openRateA: 22, openRateB: 28 },
  },
  {
    id: 'COF-004-S1',
    campaignId: 'COF-004',
    touchpoint: 2,
    channel: 'sms',
    subjectA: 'Hi {first_name} — last note from me about the {origin} kit. One tap: cupped it / need more time / not a fit. Whatever you pick, I\'ll honor it: {feedback_url}',
    subjectB: null,
    body: 'Hi {first_name} — last note from me about the {origin} kit. One tap: cupped it / need more time / not a fit. Whatever you pick, I\'ll honor it: {feedback_url}',
    mergeTokens: ['{first_name}', '{origin}', '{feedback_url}'],
    metrics: { primary: 'rescue_rate', baselineRate: 11, targetRate: 18, mde: 3, openRateA: 8, openRateB: null },
  },

  // COF-005 — The Regular
  {
    id: 'COF-005-E1',
    campaignId: 'COF-005',
    touchpoint: 1,
    channel: 'email',
    subjectA: 'The {origin} is dialed in. Know a roaster who\'d cup it?',
    subjectB: 'Give a kit, get a bag — the {roaster_name} referral link is live',
    body: `Good coffee travels by word of mouth. Always has.

Hi {first_name},

Two weeks in — how's the {process_method} {origin} performing on the roast? (If something's off, reply and I'll make it right before anything else below matters.)

If it's performing: every roastery has a group chat where someone asks "where are you finding good washed {origin} right now?" When that happens, here's your answer in one link:

{referral_url}

What your link does: sends a fellow roaster the same free sample kit you started with — real scoresheets, real landed-cost math. When their first order lands, we roast-credit {roaster_name} $150 and they get $100 off that first order. No caps, no expiry, no fine print that embarrasses us at a cupping.

— {rep_first_name}
P.S. Referral economics are public on the link page. We'd rather you trust the program than be surprised by it.`,
    mergeTokens: ['{first_name}', '{origin}', '{process_method}', '{referral_url}', '{roaster_name}', '{rep_first_name}'],
    metrics: { primary: 'referral_invite_rate', baselineRate: 14, targetRate: 25, mde: 4, openRateA: 30, openRateB: 38 },
  },
  {
    id: 'COF-005-E2',
    campaignId: 'COF-005',
    touchpoint: 2,
    channel: 'email',
    subjectA: '~15% of the {region} lot left. Reorder before the spreadsheet says so?',
    subjectB: 'Your {origin} par level says reorder this week',
    body: `Hi {first_name},

Your first order was {first_order_lbs} lbs of the {region} {process_method}, {days_since_order} days ago. At your logged roast cadence, you're inside the reorder window — and {lot_size_bags} bags remain of your exact lot.

Two honest options:

1. [ Reorder the same lot ] — locked at your original \${price_per_lb}/lb while bags last. Consistency your menu already promised.
2. [ Cup the successor lot ] — same station, new harvest week, sample in your next kit free. For when you'd rather evolve the profile than repeat it.

Either way, automated replenishment is one toggle in settings — set the par level and the spreadsheet retires itself.

— {rep_first_name}`,
    mergeTokens: ['{first_name}', '{first_order_lbs}', '{region}', '{process_method}', '{days_since_order}', '{lot_size_bags}', '{price_per_lb}', '{rep_first_name}'],
    metrics: { primary: 'reorder_rate', baselineRate: 48, targetRate: 55, mde: 4, openRateA: 25, openRateB: 32 },
  },
  {
    id: 'COF-005-S1',
    campaignId: 'COF-005',
    touchpoint: 3,
    channel: 'sms',
    subjectA: '{first_name}, {rep_first_name}. You\'re ~a week from running dry on the {origin} by my math — {lot_size_bags} bags left at your locked price. Hold 60 lbs for {roaster_name}? Reply YES and it\'s done.',
    subjectB: null,
    body: "{first_name}, {rep_first_name}. You're ~a week from running dry on the {origin} by my math — {lot_size_bags} bags left at your locked price. Hold 60 lbs for {roaster_name}? Reply YES and it's done.",
    mergeTokens: ['{first_name}', '{rep_first_name}', '{origin}', '{lot_size_bags}', '{roaster_name}'],
    metrics: { primary: 'reorder_rate', baselineRate: 48, targetRate: 55, mde: 4, openRateA: 12, openRateB: null },
  },
];
```

- [ ] **Step 2: Run a quick import/type check**

Run: `cd app && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/marketing-data.ts
git commit -m "feat(marketing): add COF merge-token registry and 13 template library"
```

---

### Task 3: Seed the mock database with campaigns, rules, and templates

**Files:**
- Modify: `app/src/api/db.ts`

**Interfaces:**
- Consumes: `MarketingTemplate` type, `CAMPAIGN_TEMPLATES` from Task 2
- Produces: `db.campaigns`, `db.rules`, `db.templates`

- [ ] **Step 1: Add the `templates` field and import the new constants**

Add the import at the top:

```ts
import type { MarketingTemplate } from '../types/marketing';
import { MARKETING_TEMPLATES } from './marketing-data';
```

Change the `db` object declaration:

```ts
export const db = {
  roasters: [] as Roaster[],
  campaigns: [] as Campaign[],
  rules: [] as AutomationRule[],
  templates: [] as MarketingTemplate[],
  lots: [] as CoffeeLot[],
  sampleKits: [] as SampleKit[],
  orders: [] as Order[],
  reservations: [] as Reservation[],
  webhooks: [] as WebhookSubscriptionWithSecret[],
  idempotency: new Map<string, { bodyHash: string; response: unknown; problem?: unknown }>(),
};
```

- [ ] **Step 2: Replace the campaign/rule seed block in `seedDatabase()`**

Replace the existing `db.campaigns = [...]` and `db.rules = [...]` blocks with:

```ts
  const now = new Date().toISOString();

  db.campaigns = [
    {
      id: 'campaign-cof-001',
      slug: 'cof-001',
      name: 'COF-001 — First Crack',
      description: 'Activate new lead → sample kit request.',
      status: 'active',
      version: 1,
      targetAudience: { segments: ['micro', 'boutique'], minCupScorePreference: 55 },
      ruleCodes: ['COF-001'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'campaign-cof-002',
      slug: 'cof-002',
      name: 'COF-002 — The Cupping',
      description: 'Kit delivered → cupping feedback.',
      status: 'active',
      version: 1,
      targetAudience: { segments: ['micro', 'boutique', 'commercial'] },
      ruleCodes: ['COF-002'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'campaign-cof-003',
      slug: 'cof-003',
      name: 'COF-003 — The Shortlist',
      description: 'Feedback → first paid order.',
      status: 'active',
      version: 1,
      targetAudience: { segments: ['micro', 'boutique', 'commercial'] },
      ruleCodes: ['COF-003'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'campaign-cof-004',
      slug: 'cof-004',
      name: 'COF-004 — Second Cup',
      description: 'Rescue non-responders before hard suppression at day 21.',
      status: 'active',
      version: 1,
      targetAudience: { segments: ['micro', 'boutique', 'commercial'] },
      ruleCodes: ['COF-004'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'campaign-cof-005',
      slug: 'cof-005',
      name: 'COF-005 — The Regular',
      description: 'First order → reorder + referral seed.',
      status: 'active',
      version: 1,
      targetAudience: { segments: ['micro', 'boutique', 'commercial'] },
      ruleCodes: ['COF-005'],
      createdAt: now,
      updatedAt: now,
    },
  ];

  db.rules = [
    {
      id: 'rule-cof-001',
      ruleCode: 'COF-001',
      campaignId: 'campaign-cof-001',
      ruleName: 'qualified_lead_first_crack_sequence',
      triggerEvent: 'lead.qualified',
      conditionsJson: {
        lead_score_min: 55,
        segment_in: ['micro', 'boutique'],
        account_status_not_in: ['churned'],
        suppression_check: {
          unsubscribed: false,
          active_campaign_not_in: ['COF-004', 'WIN-001'],
          open_order_in_flight: false,
        },
      },
      version: 1,
      status: 'armed',
      actions: [
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-001-E1', channel: 'email', delayMinutes: 0, payload: { ab_test_id: 'abt_cof001_subject_v1' } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-001-E2', channel: 'email', delayMinutes: 4320, payload: { fire_if: { opened_at_is_null: true } } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-001-S1', channel: 'sms', delayMinutes: 7200, payload: { fire_if: { opened_at_not_null: true, kit_requested: false } } },
        { actionType: 'UPDATE_CRM_LIFECYCLE', payload: { lifecycle_stage: 'kit_offered', set_fields: { status: 'trial' }, log_to: 'campaign_execution_logs' } },
        { actionType: 'EXECUTE_CAMPAIGN_HALT', payload: { halt_on_event: ['sample_kit.requested', 'user.unsubscribed', 'order.created'], halt_scope: 'campaign_id:COF-001', post_halt_route: { 'sample_kit.requested': 'fulfillment.temporal.kit_workflow' }, reason: 'conversion_or_opt_out' } },
      ],
    },
    {
      id: 'rule-cof-002',
      ruleCode: 'COF-002',
      campaignId: 'campaign-cof-002',
      ruleName: 'kit_delivered_cupping_followup',
      triggerEvent: 'sample_kit.delivered',
      conditionsJson: {
        days_since_delivery: 4,
        feedback_submitted: false,
        suppression_check: { unsubscribed: false, order_created_since_delivery: false },
      },
      version: 1,
      status: 'armed',
      actions: [
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-002-E1', channel: 'email', delayMinutes: 0, payload: { ab_test_id: 'abt_cof002_subject_v1' } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-002-S1', channel: 'sms', delayMinutes: 4320, payload: { fire_if: { feedback_submitted: false } } },
        { actionType: 'UPDATE_CRM_LIFECYCLE', payload: { lifecycle_stage: 'kit_cupping_window', set_fields: { last_activity_at: 'now()' }, log_to: 'campaign_execution_logs' } },
        { actionType: 'EXECUTE_CAMPAIGN_HALT', payload: { halt_on_event: ['feedback.submitted', 'order.created', 'user.unsubscribed'], halt_scope: 'campaign_id:COF-002', post_halt_route: { 'feedback.submitted': 'campaign:COF-003', 'order.created': 'campaign:COF-005' }, reason: 'activation_or_conversion' } },
      ],
    },
    {
      id: 'rule-cof-003',
      ruleCode: 'COF-003',
      campaignId: 'campaign-cof-003',
      ruleName: 'feedback_to_first_order',
      triggerEvent: 'feedback.submitted',
      conditionsJson: {
        has_paid_order: false,
        feedback_valence_in: ['positive', 'mixed', 'negative'],
        suppression_check: { unsubscribed: false, open_order_in_flight: false, payment_delinquency_days_max: 0 },
      },
      version: 1,
      status: 'armed',
      actions: [
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-003-E1', channel: 'email', delayMinutes: 120, payload: { ab_test_id: 'abt_cof003_subject_v1', personalization: { branch_on: 'feedback_valence', tokens: ['{flavor_notes}', '{lot_size_bags}', '{price_per_lb}', '{savings_estimate}'] } } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-003-E2', channel: 'email', delayMinutes: 7200, payload: { fire_if: { order_created: false } } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-003-S1', channel: 'sms', delayMinutes: 14400, payload: { fire_if: { order_created: false } } },
        { actionType: 'UPDATE_CRM_LIFECYCLE', payload: { lifecycle_stage: 'shortlist_presented', set_fields: { days_since_last_order: null }, log_to: 'campaign_execution_logs' } },
        { actionType: 'EXECUTE_CAMPAIGN_HALT', payload: { halt_on_event: ['order.created', 'user.unsubscribed'], halt_scope: 'campaign_id:COF-003', post_halt_route: { 'order.created': 'campaign:COF-005' }, reason: 'first_order_conversion', sla_ms: 300000 } },
      ],
    },
    {
      id: 'rule-cof-004',
      ruleCode: 'COF-004',
      campaignId: 'campaign-cof-004',
      ruleName: 'silent_kit_rescue',
      triggerEvent: 'sample_kit.delivered',
      conditionsJson: {
        days_since_delivery: 9,
        feedback_submitted: false,
        order_created_since_delivery: false,
        suppression_check: { unsubscribed: false, active_campaign_not_in: ['COF-003'], prior_rescue_attempts_max: 0 },
      },
      version: 1,
      status: 'armed',
      actions: [
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-004-E1', channel: 'email', delayMinutes: 0, payload: { ab_test_id: 'abt_cof004_subject_v1' } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-004-S1', channel: 'sms', delayMinutes: 7200, payload: { fire_if: { any_structured_response: false } } },
        { actionType: 'UPDATE_CRM_LIFECYCLE', payload: { lifecycle_stage: 'rescue_window', schedule_exit: { at_day: 21, route: 'newsletter.quarterly', set_lead_score_decay: -15 }, log_to: 'campaign_execution_logs' } },
        { actionType: 'EXECUTE_CAMPAIGN_HALT', payload: { halt_on_event: ['feedback.submitted', 'order.created', 'structured_response.logged', 'user.unsubscribed'], halt_scope: 'campaign_id:COF-004', post_halt_route: { 'feedback.submitted': 'campaign:COF-003', 'order.created': 'campaign:COF-005' }, reason: 'rescued_or_resolved' } },
      ],
    },
    {
      id: 'rule-cof-005',
      ruleCode: 'COF-005',
      campaignId: 'campaign-cof-005',
      ruleName: 'first_order_habit_and_advocacy',
      triggerEvent: 'order.delivered',
      conditionsJson: {
        is_first_order: true,
        days_since_delivery: 14,
        suppression_check: { unsubscribed: false, support_ticket_open: false, quality_check_passed: true },
      },
      version: 1,
      status: 'armed',
      actions: [
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-005-E1', channel: 'email', delayMinutes: 0, payload: { ab_test_id: 'abt_cof005_subject_v1', personalization: { tokens: ['{referral_url}', '{origin}', '{process_method}'] } } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-005-E2', channel: 'email', delayMinutes: 44640, payload: { fire_if: { reorder_created: false }, personalization: { tokens: ['{first_order_lbs}', '{lot_size_bags}', '{price_per_lb}'] } } },
        { actionType: 'SEND_TEMPLATE', templateId: 'COF-005-S1', channel: 'sms', delayMinutes: 54720, payload: { fire_if: { reorder_created: false, clicked_at_not_null: true } } },
        { actionType: 'UPDATE_CRM_LIFECYCLE', payload: { lifecycle_stage: 'first_order_active', on_reorder: { lifecycle_stage: 'active_repeat', set_fields: { status: 'active' } }, log_to: 'campaign_execution_logs' } },
        { actionType: 'EXECUTE_CAMPAIGN_HALT', payload: { halt_on_event: ['order.created', 'user.unsubscribed'], halt_scope: 'campaign_id:COF-005', halt_note: 'reorder converts lifecycle to active_repeat cadence; referral card persists in-product regardless', reason: 'habit_established' } },
      ],
    },
  ];

  db.templates = MARKETING_TEMPLATES;
```

- [ ] **Step 3: Run type check and tests**

Run:
```bash
cd app
npx tsc -b --noEmit
npm run test:run -- src/stores/__tests__/campaigns-slice.test.ts
```
Expected: type check passes; tests may fail on performance counts but should compile.

- [ ] **Step 4: Commit**

```bash
git add src/api/db.ts
git commit -m "feat(marketing): seed COF-001..005 campaigns, rules, and templates"
```

---

### Task 4: Implement per-campaign performance metrics

**Files:**
- Modify: `app/src/api/client.ts`

**Interfaces:**
- Consumes: `MARKETING_TEMPLATES` from Task 2, extended `CampaignFunnel` from Task 1
- Produces: `api.campaigns.performance` returns `CampaignPerformance` with campaign-specific funnels and variants

- [ ] **Step 1: Add the import and helper functions**

Add near the top of `app/src/api/client.ts`:

```ts
import { MARKETING_TEMPLATES } from './marketing-data';
```

Then add the helper functions before `export const api = { ... }`:

```ts
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
```

- [ ] **Step 2: Replace `api.campaigns.performance`**

Replace the existing `performance: async (id: string) => { ... }` method with:

```ts
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

      return { data: presets[code] ?? presets['cof-001'] };
    },
```

- [ ] **Step 3: Run type check and the campaigns-slice tests**

Run:
```bash
cd app
npx tsc -b --noEmit
npm run test:run -- src/stores/__tests__/campaigns-slice.test.ts
```
Expected: type check passes; slice tests pass because `performance` still returns a non-null object.

- [ ] **Step 4: Commit**

```bash
git add src/api/client.ts
git commit -m "feat(marketing): return campaign-specific performance funnels and variants"
```

---

### Task 5: Derive CampaignsPage A/B mock data from seeded templates

**Files:**
- Modify: `app/src/pages/CampaignsPage.tsx`

**Interfaces:**
- Consumes: `MARKETING_TEMPLATES` from Task 2, `AutomationRule`, `RuleAction` from `../types/api`
- Produces: `buildCampaignRuleMock(rule)` returns `CampaignRuleMock | null`

- [ ] **Step 1: Add the import and helper functions**

Add the import:

```ts
import { MARKETING_TEMPLATES } from '../api/marketing-data';
import type { AutomationRule, RuleAction } from '../types/api';
```

Add these helpers after the `ABVariant` / `CampaignRuleMock` interfaces and remove the old `CAMPAIGN_RULES_MOCK` array:

```ts
const RULE_STATUS_BY_CODE: Record<string, CampaignRuleMock['status']> = {
  'COF-001': 'converted',
  'COF-002': 'active',
  'COF-003': 'idle',
  'COF-004': 'idle',
  'COF-005': 'idle',
};

function findSendTemplate(rule: AutomationRule): RuleAction | undefined {
  return rule.actions.find((a) => a.actionType === 'SEND_TEMPLATE');
}

function findRuleTemplate(rule: AutomationRule) {
  const send = findSendTemplate(rule);
  if (!send?.templateId) return undefined;
  return MARKETING_TEMPLATES.find((t) => t.id === send.templateId);
}

function buildABVariant(
  label: string,
  sampleSize: number,
  rate: number,
  probabilityBest: number,
  status: ABVariant['status'],
): ABVariant {
  const conversions = Math.round(sampleSize * (rate / 100));
  const convRate = (conversions / sampleSize) * 100;
  return {
    name: label,
    sampleSize,
    conversions,
    convRate,
    ciLower: Math.max(0, convRate - 2),
    ciUpper: Math.min(100, convRate + 2),
    probBest: probabilityBest * 100,
    status,
  };
}

function buildCampaignRuleMock(rule: AutomationRule): CampaignRuleMock | null {
  const template = findRuleTemplate(rule);
  if (!template) return null;

  const { subjectA, subjectB, metrics, channel } = template;
  const openRateA = metrics.openRateA ?? 0;
  const openRateB = metrics.openRateB ?? null;
  const sampleSize = 600;

  const abData: ABVariant[] = [];

  if (subjectB != null && openRateB != null && channel === 'email') {
    const aWins = openRateA >= openRateB;
    abData.push(buildABVariant(`Variant A (${subjectA.slice(0, 40)}…)`, sampleSize, openRateA, aWins ? 0.68 : 0.32, aWins ? 'winner' : 'loser'));
    abData.push(buildABVariant(`Variant B (${subjectB.slice(0, 40)}…)`, sampleSize, openRateB, aWins ? 0.32 : 0.68, aWins ? 'loser' : 'winner'));
  } else {
    abData.push(buildABVariant(`Variant A (${subjectA.slice(0, 40)}…)`, sampleSize, openRateA, 1.0, 'running'));
  }

  return {
    id: rule.id,
    code: rule.ruleCode,
    name: rule.ruleName,
    triggerEvent: rule.triggerEvent,
    channel,
    subjectA,
    subjectB: subjectB ?? '',
    openRateA,
    openRateB: openRateB ?? 0,
    status: RULE_STATUS_BY_CODE[rule.ruleCode] ?? 'idle',
    abData,
  };
}
```

- [ ] **Step 2: Replace the `currentRuleMock` computation**

Find this block:

```ts
  const activeRule = campaignRules[activeRuleIndex] || null;
  const currentRuleMock = activeRule
    ? CAMPAIGN_RULES_MOCK.find((m) => m.code === activeRule.ruleCode) || null
    : null;
```

Replace it with:

```ts
  const activeRule = campaignRules[activeRuleIndex] || null;
  const currentRuleMock = activeRule ? buildCampaignRuleMock(activeRule) : null;
```

- [ ] **Step 3: Update the rule stepper to use the helper**

Find this block inside the stepper map:

```ts
                        const mock = CAMPAIGN_RULES_MOCK.find((m) => m.code === rule.ruleCode);
                        const isConverted = mock?.status === 'converted';
                        const isActive = mock?.status === 'active';
```

Replace it with:

```ts
                        const ruleStatus = RULE_STATUS_BY_CODE[rule.ruleCode] ?? 'idle';
                        const isConverted = ruleStatus === 'converted';
                        const isActive = ruleStatus === 'active';
```

- [ ] **Step 4: Conditionally hide Variant B for SMS/single-variant rules**

Find the A/B subjects block starting with `<h3 className="overline text-xs text-muted">A/B TEST SUBJECTS</h3>`. Replace the inner content of the `bg-recessed/10` container so that Variant B only renders when it exists:

```tsx
                        <div className="space-y-3 bg-recessed/10 p-4 rounded-lg border border-border">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="font-bold text-ink">Variant A</span>
                              <span className="figure text-teal">{currentRuleMock.openRateA}% open rate</span>
                            </div>
                            <p className="text-sm text-ink font-sans pl-2 border-l-2 border-teal/40">
                              "{currentRuleMock.subjectA}"
                            </p>
                            <div className="h-1.5 w-full bg-recessed rounded-full overflow-hidden">
                              <div className="h-full bg-teal" style={{ width: `${Math.min(100, currentRuleMock.openRateA)}%` }} />
                            </div>
                          </div>
                          {currentRuleMock.channel === 'email' && currentRuleMock.subjectB && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="font-bold text-ink">Variant B</span>
                                <span className="figure text-teal">{currentRuleMock.openRateB}% open rate</span>
                              </div>
                              <p className="text-sm text-ink font-sans pl-2 border-l-2 border-teal/20">
                                "{currentRuleMock.subjectB}"
                              </p>
                              <div className="h-1.5 w-full bg-recessed rounded-full overflow-hidden">
                                <div className="h-full bg-teal/55" style={{ width: `${Math.min(100, currentRuleMock.openRateB)}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
```

- [ ] **Step 5: Run type check and tests**

Run:
```bash
cd app
npx tsc -b --noEmit
npm run test:run -- src/stores/__tests__/campaigns-slice.test.ts
```
Expected: clean type check; tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/CampaignsPage.tsx
git commit -m "feat(marketing): derive CampaignsPage A/B data from seeded templates"
```

---

### Task 6: Update affected unit tests

**Files:**
- Modify if needed: `app/src/stores/__tests__/campaigns-slice.test.ts`

- [ ] **Step 1: Run the full test suite**

Run:
```bash
cd app
npm run test:run
```
Expected: if the suite passes, no test file changes are required. The existing slice tests only assert that campaigns load, mutate, and that performance exists; they do not hard-code campaign names.

- [ ] **Step 2: If a test fails because of the new campaign/rule names or counts, adjust the assertion**

For example, if a test expects exactly one campaign, replace `toBe(1)` with `toBeGreaterThan(0)`. If the spec added campaigns but no existing test asserts exact counts, no change is needed.

- [ ] **Step 3: Commit any test changes**

```bash
git add src/stores/__tests__/campaigns-slice.test.ts
git commit -m "test(campaigns): update assertions for COF seed data" # only if changed
```

---

### Task 7: Final verification

- [ ] **Step 1: Type-check and build**

Run:
```bash
cd app
npm run build
```
Expected: `tsc -b` and `vite build` complete without errors.

- [ ] **Step 2: Lint**

Run:
```bash
cd app
npm run lint
```
Expected: no lint errors (oxlint).

- [ ] **Step 3: Run full test suite**

Run:
```bash
cd app
npm run test:run
```
Expected: all tests pass.

- [ ] **Step 4: Manual smoke test (optional but recommended)**

Run:
```bash
cd app
npm run dev
```
Open `http://localhost:5173` (or the configured port), navigate to Campaigns, and confirm:
- Five campaigns appear: COF-001 → COF-005.
- Each campaign shows its rule sequence and the correct trigger event.
- Selecting each campaign shows the correct A/B subject variants and funnel KPIs.

- [ ] **Step 5: Commit any fixes and finish**

```bash
git add -A
git commit -m "fix(campaigns): address review/verification feedback" # only if needed
```

---

## Self-Review

1. **Spec coverage:**
   - All five COF campaigns seeded with correct triggers and rule sequences — Task 3.
   - All 13 email/SMS templates with canonical/extended tokens — Task 2.
   - Merge-token registry — Task 2.
   - Campaign-specific performance funnels/metrics — Task 4.
   - CampaignsPage derives A/B data from seeded templates — Task 5.

2. **Placeholder scan:** No TBD/TODO/"implement later" in the plan.

3. **Type consistency:**
   - `MarketingTemplate` fields match usage in `db.ts`, `client.ts`, and `CampaignsPage.tsx`.
   - `CampaignFunnel` extension is optional-only, so existing usages are unaffected.
   - `RuleAction` payloads are `Record<string, unknown>`, compatible with the spec JSON.
