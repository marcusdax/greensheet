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
