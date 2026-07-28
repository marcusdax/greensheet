# 02 — COF-001 → COF-005 Campaign Expansion (Complete Nurture Engine)

> Implements base doc §I.2 (A/B/n Testing & Attribution, Predictive Lead Scoring, Automated Sample Kit Fulfillment) against the `coffee-marketing-schema.sql` blueprint: `campaigns` → `campaign_tokens` → `marketing_templates` → `automation_rules` → `rule_actions`, compiled at runtime via `view_compiled_campaign_rules`. All copy uses canonical merge tokens from §0.2. Economic guardrails inherited from `01-growth-architecture.md` §6.3 (CAC ceilings, LTV:CAC ≥ 3:1, sample-to-sale ≥ 40%).

---

## 0. Sequence overview & operating rules

### 0.1 The five campaigns as one system

| Campaign | Codename | Funnel role | Primary trigger | Primary conversion | Kill/exit condition |
|---|---|---|---|---|---|
| **COF-001** | *First Crack* | Activate new lead → sample kit request | `lead.qualified` (lead_score ≥ 55) | `sample_kit.requested` | Kit requested, or 3 touches w/o engagement |
| **COF-002** | *The Cupping* | Kit delivered → cupping feedback | `sample_kit.delivered` + 4 days | `feedback.submitted` | Feedback submitted |
| **COF-003** | *The Shortlist* | Feedback → first paid order | `feedback.submitted` | `order.created` (first) | Order created (`EXECUTE_CAMPAIGN_HALT`) |
| **COF-004** | *Second Cup* | Rescue non-responders | `sample_kit.delivered` + 9 days, no feedback | `feedback.submitted` (late) | Feedback or day-21 suppression |
| **COF-005** | *The Regular* | First order → reorder + referral | `order.delivered` + 14 days | 2nd order ≤ 90d; referral invite sent | Reorder logged; referral invite accepted |

Suppression and lifecycle hygiene are enforced by global rules in §7 (never let a nurture email land after a conversion — the most expensive impression in B2B is the one that argues with a customer who already said yes).

### 0.2 Canonical merge tokens (`campaign_tokens` registry)

| Token | Source field | Tooltip (UI copy for template builder) |
|---|---|---|
| `{first_name}` | users.first_name | Contact's first name |
| `{roaster_name}` | accounts.roaster_name | Account / roastery name |
| `{origin}` | coffee_lots.origin | Country of origin |
| `{region}` | coffee_lots origin metadata | Producing region (e.g., Gedeb, Huila) |
| `{process_method}` | coffee_lots.processing_method | washed / natural / honey / anaerobic |
| `{sca_cup_score}` | coffee_lots.cup_score | SCA cup score, one decimal (e.g., 86.5) |
| `{elevation_masl}` | coffee_lots.elevation | Meters above sea level |
| `{varietal}` | coffee_lots.varietal | e.g., Heirloom, Caturra, Pink Bourbon |
| `{flavor_notes}` | coffee_lots.flavor_notes (JSONB) | Top three cupping notes |
| `{lot_size_bags}` | derived: available_quantity_lbs ÷ 152 | Bags remaining |
| `{price_per_lb}` | coffee_lots.price_per_lb_cents ÷ 100 | USD per lb, landed |
| `{kit_tracking_url}` | fulfillment service | Live tracking link |
| `{feedback_url}` | app link w/ UTM | One-tap cupping feedback form |
| `{shortlist_url}` | app link w/ UTM | Personalized lot shortlist |
| `{referral_url}` | referral engine (file 03) | Personal referral link |
| `{importer_name}` | supply-side account | Fulfilling importer/exporter |
| `{rep_first_name}` | assigned CSM/rep | Human sender |
| `{savings_estimate}` | pricing engine | Modeled landed-cost delta |

### 0.3 Experiment & decision framework (applies to every campaign)

Every touchpoint runs as an `ab_tests` row. Standard config unless overridden per campaign:

```json
{
  "name": "COF-00X subject line A/B",
  "hypothesis": "Variant B lifts <primary_metric> by ≥ <MDE> vs control",
  "control_variant": "A",
  "test_variants": ["A", "B"],
  "primary_metric": "see per-campaign §metrics",
  "secondary_metrics": ["unsubscribe_rate", "spam_complaint_rate", "reply_rate"],
  "confidence_threshold": 0.95,
  "minimum_sample_size": 400
}
```

**Bayesian decision rules (identical across campaigns so results are comparable):**

1. **Prior:** conversion ~ Beta(1,1) (uninformative). Update daily from `campaign_engagements` (`email_sent_at`, `opened_at`, `clicked_at`, `converted_at`).
2. **Allocation:** Thompson sampling multi-arm bandit (base doc §I.2) — start 50/50, reweight nightly by posterior; floor any arm at 10% so learning never stops.
3. **Ship rule:** promote variant when `P(variant > control) ≥ 0.95` **and** each arm has ≥ `minimum_sample_size` sends **and** the lift ≥ pre-registered MDE.
4. **Kill rule:** drop a variant when `P(variant > control) ≤ 0.05`, or when a guardrail breaches: unsubscribe > 0.4%, spam complaints > 0.1% of delivered.
5. **No peeking bias correction:** decisions only at scheduled daily posterior updates; no mid-day promotion.
6. **Duration cap:** if no decision by 21 days or 3× minimum sample, keep control (absence of evidence is a result).

---

## COF-001 — *First Crack* (Lead → Sample Kit Request)

**Objective:** Convert a scored lead into a physical commitment: requesting the sample kit. The kit is the centerpiece of the entire funnel — everything else is scaffolding.
**Audience segment:** New roaster leads with `lead_score ≥ 55` (XGBoost score from firmographic + behavioral history, §I.2). Copy variants for `segment='micro'` (shown here) and `segment='boutique'` (noted inline). Commercial/enterprise leads route to sales-assisted track, not COF-001.
**Trigger events:** `lead.qualified` (score crosses 55) → touch 1 immediately; no open in 3 days → touch 2; opened but no kit request in 5 days → touch 3 (SMS consultative).
**Economic frame:** Kit landed cost ≈ $38 (green samples, roast/label, mailer, postage). Expected kit-request rate from qualified leads: 32%. CAC math: $38 ÷ (0.45 feedback × 0.40 order) = $211 per first order — inside the $250 CAC target before overhead allocation.

### Email — Touch 1 (`template_id: COF-001-E1`, `touchpoint: 1`, `template_style: option_a_sensory`)

**Subject A (control):** `An {sca_cup_score}-point {process_method} {origin} is waiting on your cupping table`
**Subject B (variant):** `{first_name}, we set aside a sample kit for {roaster_name}`

**Body (HTML → plain-text render):**

> **{sca_cup_score} points. {elevation_masl} meters. One {process_method} process, done properly.**
>
> Hi {first_name},
>
> You can read a hundred importer blurbs about "stone fruit and florals." Or you can put 200 grams of this {origin} {varietal} — grown at {elevation_masl} masl in {region}, {process_method} processed, cupped at {sca_cup_score} by a licensed Q-grader — on your own table and decide in eleven minutes.
>
> We'd rather you do the second thing.
>
> **Your {roaster_name} sample kit is reserved.** It holds this lot plus two more matched to how you roast: whole-bean green samples, the actual Q-grader scoresheets (not marketing copy), and landed-cost math down to the cent per pound.
>
> **[ Claim the kit — $0, ships in 48 hours ]** → {kit_tracking_url}
>
> No contract. No minimum. If the coffee doesn't cup, you've lost nothing but a brew cycle.
>
> — {rep_first_name}, Greensheet
> P.S. There are {lot_size_bags} bags of the {region} lot. We'll never email you fake scarcity — that's the real count from the warehouse.

**Boutique variant note:** swap P.S. for: *"P.S. Two roasteries in your peer quantile cupped this lot last week. Their benchmarking data is in your dashboard if you want the receipts."*

### Email — Touch 2 (`COF-001-E2`, `touchpoint: 2`, fires day 3 if unopened)

**Subject A:** `The kit's still here. The {origin} might not be.`
**Subject B:** `What {sca_cup_score} points actually tastes like`

> Hi {first_name} — no pressure sequence, just one honest fact: kits ship in request order, and {lot_size_bags} bags is the entire position on this {process_method} {origin}.
>
> The kit costs you nothing. It costs us $38 to put on your table, and we do it gladly, because roasters who cup with real scoresheets in hand reorder at rates our spreadsheet-era competitors don't believe.
>
> **[ Claim your kit ]** → {kit_tracking_url}
>
> — {rep_first_name}

### SMS — Touch 3 (`COF-001-S1`, `touchpoint: 3`, `template_style: option_b_consultative`, fires day 5 if opened-but-unconverted)

> Hi {first_name}, {rep_first_name} from Greensheet. Your {roaster_name} sample kit is still reserved — the {sca_cup_score}-pt {process_method} {origin} plus two matched lots, free. Want me to hold it one more week or release it? Claim: {kit_tracking_url} Reply STOP to opt out.

### Landing page (`/kits/claim?utm_campaign=cof-001`)

- **H1:** Cup it before you commit a dollar.
- **Subhead:** Three green samples matched to {roaster_name}'s roast profile, with the Q-grader's real scoresheets and landed-cost math — free, shipped in 48 hours.
- **Proof row:** ☐ {sca_cup_score} SCA score, verified ☐ {elevation_masl} masl, {region}, {origin} ☐ {process_method} process ☐ {lot_size_bags} bags total position ☐ $0 kit, no contract
- **How it works (3 steps):** 1. Claim your kit → 2. Cup against the scoresheet (11 minutes, SCA protocol) → 3. Order only if it cups — first-order pricing locked for 14 days.
- **Form fields:** roastery name, work email, roast volume/mo (dropdown: <300 / 300–1,200 / 1,200+ lbs), shipping address. Micro-copy under button: *"We email like a good green buyer talks: rarely, specifically, and with numbers."*
- **CTA:** `Reserve my free kit`

### Success metrics & decision rules

| Metric | Definition | Baseline | Target | MDE for A/B |
|---|---|---|---|---|
| Primary: kit request rate | `sample_kit.requested` ÷ delivered emails | 24% | 32% | +4pp |
| Open rate | `opened_at` ÷ delivered | 45% (legacy dashboard) | ≥ 52% | +5pp |
| Click-to-open | `clicked_at` ÷ opened | 40% | ≥ 45% | +4pp |
| LP conversion | claims ÷ LP sessions (UTM `cof-001`) | — | ≥ 38% | +5pp |
| Guardrails | unsub ≤ 0.4%, spam ≤ 0.1%, kit cost/claim ≤ $38 | — | — | kill if breached |

Minimum sample: 400 sends/arm (posterior ≥ 0.95 governs promotion; see §0.3).

### Automation rule JSON

```json
{
  "rule_id": "COF-001-R1",
  "campaign_id": "COF-001",
  "rule_name": "qualified_lead_first_crack_sequence",
  "trigger_event": "lead.qualified",
  "conditions_json": {
    "lead_score_min": 55,
    "segment_in": ["micro", "boutique"],
    "account_status_not_in": ["churned"],
    "suppression_check": {
      "unsubscribed": false,
      "active_campaign_not_in": ["COF-004", "WIN-001"],
      "open_order_in_flight": false
    }
  },
  "rule_actions": [
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-001-E1",
      "channel_type": "email",
      "touchpoint": 1,
      "delay_minutes": 0,
      "ab_test_id": "abt_cof001_subject_v1"
    },
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-001-E2",
      "channel_type": "email",
      "touchpoint": 2,
      "delay_minutes": 4320,
      "fire_if": { "opened_at_is_null": true }
    },
    {
      "action_type": "SEND_SMS",
      "template_id": "COF-001-S1",
      "channel_type": "sms",
      "touchpoint": 3,
      "delay_minutes": 7200,
      "fire_if": { "opened_at_not_null": true, "kit_requested": false }
    },
    {
      "action_type": "UPDATE_CRM_LIFECYCLE",
      "payload": {
        "lifecycle_stage": "kit_offered",
        "set_fields": { "status": "trial" },
        "log_to": "campaign_execution_logs"
      }
    },
    {
      "action_type": "EXECUTE_CAMPAIGN_HALT",
      "payload": {
        "halt_on_event": ["sample_kit.requested", "user.unsubscribed", "order.created"],
        "halt_scope": "campaign_id:COF-001",
        "post_halt_route": { "sample_kit.requested": "fulfillment.temporal.kit_workflow" },
        "reason": "conversion_or_opt_out"
      }
    }
  ]
}
```

---

## COF-002 — *The Cupping* (Kit Delivered → Feedback Submitted)

**Objective:** Get the roaster to actually cup the samples and submit structured feedback (`feedback.submitted`). Feedback is the activation event the whole LTV model leans on: feedback submitters convert at ≥ 40% vs. < 6% for silent kit recipients, and `sample_kit_redemption` is a covariate in the churn model (§2.2).
**Audience segment:** All kit recipients, any roaster segment.
**Trigger events:** `sample_kit.delivered` webhook from the fulfillment orchestrator (temporal.io) → wait 4 days (`days_since_delivery: 4` — matches the blueprint's canonical JSONB query example) → touch 1. No feedback by day 7 → SMS consultative nudge. Feedback submitted any time → halt.
**Economic frame:** Every point of feedback-submission rate is worth ≈ $8.40 of expected contribution per kit (40% order rate × $2,100 yr-1 margin). Moving submission 38% → 45% across 1,000 kits/yr ≈ $59k contribution — the single highest-ROI email in the system.

### Email — Touch 1 (`COF-002-E1`, `touchpoint: 1`, `template_style: option_a_sensory`)

**Subject A (control):** `Your {origin} has been on the table 4 days. How did it cup?`
**Subject B (variant):** `11 minutes, {first_name} — the {process_method} lot is ready when you are`

**Body:**

> **The kettle's the only thing missing.**
>
> Hi {first_name},
>
> Our tracking says your kit landed four days ago — which means the {process_method} {origin} ({sca_cup_score} pts, {elevation_masl} masl) has either already perfumed your lab, or it's waiting for a quiet eleven minutes.
>
> If it helps, here's how other roasters are cupping it:
>
> - **Fragrance/aroma:** look for {flavor_notes} at the dry grounds
> - **The break:** {process_method} lots from {region} tend to open up floral — skim and give it 30 more seconds before you judge the nose
> - **As it cools:** this lot's sweetness shows up at ~50°C. Don't score it hot.
>
> When you've cupped, two taps and you're done: **{feedback_url}**
>
> Your scores go straight into your shortlist — tell us the cup was thin, and we'll stop recommending bright {process_method} lots. Tell us it sang, and we'll find you its siblings before anyone else cups them.
>
> — {rep_first_name}
> P.S. The Q-grader's original scoresheet is the second card in the box. Score blind against it — most roasters land within half a point, which is exactly why we ship the real sheet.

### SMS — Touch 2 (`COF-002-S1`, `touchpoint: 2`, `template_style: option_b_consultative`, day 7 if no feedback)

> Hi {first_name}, {rep_first_name} at Greensheet. Your {origin} kit's been there a week — cupped it yet? Even a "too bright for us" helps me tune {roaster_name}'s shortlist. 60 seconds, honestly: {feedback_url}

### Landing page (`/feedback?kit={kit_id}&utm_campaign=cof-002`)

- **H1:** Score it like a Q-grader. We'll listen like one too.
- **Subhead:** Two taps per lot. Your feedback tunes every recommendation {roaster_name} gets from here on.
- **Form (per lot):** SCA-style sliders — fragrance, acidity, body, sweetness, finish (0–10) + "would you serve this solo? y/n" + free text ("one word for this cup").
- **Side panel:** the Q-grader's reference scores for the same lots (revealed *after* submission, to keep it blind — then celebrated: "You scored within 0.5 of our Q-grader on 2 of 3 lots").
- **CTA:** `Submit my cupping notes`
- **Post-submit state:** instant personalized shortlist → routes into COF-003 within 2 hours.

### Success metrics & decision rules

| Metric | Definition | Baseline | Target | MDE |
|---|---|---|---|---|
| Primary: feedback submission rate | `feedback.submitted` ÷ kits delivered | 38% | ≥ 45% | +4pp |
| Median delivery→feedback | event timestamps | 6.2 days | ≤ 4.5 days | −1 day |
| Blind-score agreement | within ±0.5 of Q-grader | — | ≥ 60% (engagement quality signal) | — |
| Guardrails | SMS opt-out ≤ 2%, email unsub ≤ 0.4% | — | — | kill if breached |

Minimum sample: 400 kits/arm.

### Automation rule JSON

```json
{
  "rule_id": "COF-002-R1",
  "campaign_id": "COF-002",
  "rule_name": "kit_delivered_cupping_followup",
  "trigger_event": "sample_kit.delivered",
  "conditions_json": {
    "days_since_delivery": 4,
    "feedback_submitted": false,
    "suppression_check": {
      "unsubscribed": false,
      "order_created_since_delivery": false
    }
  },
  "rule_actions": [
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-002-E1",
      "channel_type": "email",
      "touchpoint": 1,
      "delay_minutes": 0,
      "ab_test_id": "abt_cof002_subject_v1"
    },
    {
      "action_type": "SEND_SMS",
      "template_id": "COF-002-S1",
      "channel_type": "sms",
      "touchpoint": 2,
      "delay_minutes": 4320,
      "fire_if": { "feedback_submitted": false }
    },
    {
      "action_type": "UPDATE_CRM_LIFECYCLE",
      "payload": {
        "lifecycle_stage": "kit_cupping_window",
        "set_fields": { "last_activity_at": "now()" },
        "log_to": "campaign_execution_logs"
      }
    },
    {
      "action_type": "EXECUTE_CAMPAIGN_HALT",
      "payload": {
        "halt_on_event": ["feedback.submitted", "order.created", "user.unsubscribed"],
        "halt_scope": "campaign_id:COF-002",
        "post_halt_route": { "feedback.submitted": "campaign:COF-003", "order.created": "campaign:COF-005" },
        "reason": "activation_or_conversion"
      }
    }
  ]
}
```

---

## COF-003 — *The Shortlist* (Feedback → First Paid Order)

**Objective:** Convert activation into revenue: first paid order within 14 days of feedback. This is the campaign the CAC model pays off on — and where suppression discipline matters most (halt the instant an order exists; arguing with a converted customer burns brand equity).
**Audience segment:** Accounts with `feedback.submitted` and no paid order. Dynamic content branches on feedback valence: (a) loved ≥ 1 lot → order push; (b) lukewarm → re-matched alternatives.
**Trigger events:** `feedback.submitted` → touch 1 within 2 hours (shortlist is freshest). No order by day 5 → touch 2 (social proof + scarcity, real counts only). No order by day 10 → touch 3 (SMS, consultative close). Any `order.created` → `EXECUTE_CAMPAIGN_HALT` immediately, route to COF-005.
**Economic frame:** Target sample-to-sale ≥ 40% (base KPI). At $2,100 expected year-1 contribution per new ordering roaster and $38 kit cost already sunk, every incremental order here is nearly pure margin recovery — this campaign justifies the entire kit program.

### Email — Touch 1 (`COF-003-E1`, `touchpoint: 1`, fires ≤ 2 h after feedback)

**Subject A (control):** `You scored the {origin} an {sca_cup_score}. Here's what we'd do next.`
**Subject B (variant):** `{roaster_name}'s shortlist: 3 lots that match how you cup`

**Body:**

> **Your cupping notes, working for you.**
>
> Hi {first_name},
>
> You gave the {process_method} {origin} an {sca_cup_score} and wrote *"{feedback_highlight}"* — so here's the honest read from your shortlist:
>
> **1. The one you already love.** {origin}, {region} — {sca_cup_score} pts, {process_method}, {elevation_masl} masl. {lot_size_bags} bags left at ${price_per_lb}/lb landed. First orders lock this lot's pricing for 14 days.
>
> **2. Its sibling.** Same washing station, earlier harvest week — cups ~0.5 brighter on acidity. For the menu slot where the first lot is *almost* right.
>
> **3. The wild card.** A {varietal} from {region} you haven't cupped — flagged by our model because roasters who scored this lot like you did reordered it within 30 days at a 71% rate.
>
> **[ See {roaster_name}'s shortlist → ]** {shortlist_url}
>
> Freight, contracts, and the invoice all live in the same screen. No PDF tennis.
>
> — {rep_first_name}
> P.S. Not ready for a full bag? Split-bag options start at 30 lbs on this lot.

*(Branch B — lukewarm feedback: leads with "Fair enough — that {process_method} profile isn't for everyone," then presents re-matched lots with different process/origin, and offers a free second kit if volume ≥ 300 lbs/mo.)*

### Email — Touch 2 (`COF-003-E2`, `touchpoint: 2`, day 5, no order)

**Subject A:** `{lot_size_bags} bags. That's the whole position, {first_name}.`
**Subject B:** `The roastery two towns over didn't wait`

> Hi {first_name} — two facts, no pressure:
>
> 1. Since your cupping notes came in, **{bags_sold_since} bags** of the {region} lot have moved. {lot_size_bags} remain. That number is live from the warehouse, not a countdown timer we reset at midnight.
> 2. Roasters in your peer quantile who bought their shortlist's #1 match within 7 days reordered at 71%. The ones who waited for "next harvest" mostly ended up cupping someone else's leftovers at the same price.
>
> Your 14-day price lock expires in {days_left_on_lock} days: **{shortlist_url}**
>
> — {rep_first_name}

### SMS — Touch 3 (`COF-003-S1`, `touchpoint: 3`, day 10, no order)

> {first_name}, {rep_first_name} (Greensheet). Your {origin} price lock lapses {days_left_on_lock}d from now — {lot_size_bags} bags left, and I can hold 30 lbs on a split-bag if cash flow's the blocker. Want me to? {shortlist_url}

### Landing page (`/shortlist?utm_campaign=cof-003`)

- **H1:** {roaster_name}'s shortlist — built from your own cupping scores.
- **Subhead:** Matched against {peer_count} roasters who cup like you. Updated live.
- **Lot cards (×3):** cup score dial, process tag, elevation, your score vs. Q-grader reference, landed $/lb, bags remaining (live), `Order` + `Split 30 lbs` buttons.
- **Trust row:** "Every score on this page is from a licensed Q-grader or a roaster who cupped the physical sample. No exceptions."
- **CTA:** `Lock my price & order` (shows days left on lock as honest deadline).

### Success metrics & decision rules

| Metric | Definition | Baseline | Target | MDE |
|---|---|---|---|---|
| Primary: sample-to-sale | first paid `order.created` ÷ feedback submitters | 32% | ≥ 40% | +4pp |
| Median feedback→order | hours | 340 h | ≤ 240 h | −48 h |
| AOV (first order) | `final_total_cents` ÷ 100 | $610 | ≥ $650 | +$30 |
| Halt integrity | emails sent post-order (should be ~0) | — | < 0.5% of orders | guardrail |
| Guardrails | unsub ≤ 0.4%; discount abuse = 0 (no discounts in this campaign) | — | — | kill if breached |

Minimum sample: 350 feedback events/arm (smaller pool; extend duration cap to 28 days).

### Automation rule JSON

```json
{
  "rule_id": "COF-003-R1",
  "campaign_id": "COF-003",
  "rule_name": "feedback_to_first_order",
  "trigger_event": "feedback.submitted",
  "conditions_json": {
    "has_paid_order": false,
    "feedback_valence_in": ["positive", "mixed", "negative"],
    "suppression_check": {
      "unsubscribed": false,
      "open_order_in_flight": false,
      "payment_delinquency_days_max": 0
    }
  },
  "rule_actions": [
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-003-E1",
      "channel_type": "email",
      "touchpoint": 1,
      "delay_minutes": 120,
      "ab_test_id": "abt_cof003_subject_v1",
      "personalization": { "branch_on": "feedback_valence", "tokens": ["{flavor_notes}", "{lot_size_bags}", "{price_per_lb}", "{savings_estimate}"] }
    },
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-003-E2",
      "channel_type": "email",
      "touchpoint": 2,
      "delay_minutes": 7200,
      "fire_if": { "order_created": false }
    },
    {
      "action_type": "SEND_SMS",
      "template_id": "COF-003-S1",
      "channel_type": "sms",
      "touchpoint": 3,
      "delay_minutes": 14400,
      "fire_if": { "order_created": false }
    },
    {
      "action_type": "UPDATE_CRM_LIFECYCLE",
      "payload": {
        "lifecycle_stage": "shortlist_presented",
        "set_fields": { "days_since_last_order": null },
        "log_to": "campaign_execution_logs"
      }
    },
    {
      "action_type": "EXECUTE_CAMPAIGN_HALT",
      "payload": {
        "halt_on_event": ["order.created", "user.unsubscribed"],
        "halt_scope": "campaign_id:COF-003",
        "post_halt_route": { "order.created": "campaign:COF-005" },
        "reason": "first_order_conversion",
        "sla_ms": 300000
      }
    }
  ]
}
```

---

## COF-004 — *Second Cup* (Non-Responder Rescue)

**Objective:** Recover kit recipients who went silent — no feedback by day 9 post-delivery. Goal is *feedback*, not orders: re-engaged responders convert at 18% (vs 40% for primary-path), still well above the 6% silent-recipient base rate. This campaign also generates the cleanest "why silent" data in the system, feeding the lead-scoring model's negative examples.
**Audience segment:** Kit delivered ≥ 9 days, no `feedback.submitted`, no order. Diagnosis branches: (a) never opened COF-002 (deliverability/attention problem → new angle, new sender name); (b) opened but didn't act (motivation problem → lower the ask).
**Trigger events:** `sample_kit.delivered` + 9 days, condition `feedback_submitted: false` → touch 1. Day 14 → touch 2 (SMS). Day 21 → exit survey (single question) then suppress to quarterly newsletter. This campaign never chases past day 21 — a lead we annoy is a lead we lose permanently.
**Economic frame:** Marginal cost ≈ $0.004/email. Expected value per rescued responder: 18% × $2,100 = $378. Even a 2% rescue rate pays 1,900× the send cost. The risk is reputational, not monetary — hence the hard day-21 stop.

### Email — Touch 1 (`COF-004-E1`, `touchpoint: 1`, day 9)

**Subject A (control):** `Wrong coffee? Wrong time? Wrong importer? (One tap tells us)`
**Subject B (variant):** `{first_name}, did the kit miss the mark?`

**Body:**

> **No guilt. Just a question.**
>
> Hi {first_name},
>
> Your kit landed nine days ago and we haven't heard how the {process_method} {origin} cupped. Totally fine — roast schedules eat calendars. But one tap here genuinely changes what we send {roaster_name} next:
>
> **[ ☕ Cupped it — notes coming ]** (we'll hold your shortlist)
> **[ 📅 Haven't had the eleven minutes ]** (we'll nudge you next week, once)
> **[ 🙅 Not the right coffees for us ]** (tell us one word why — we re-match or stop)
>
> That third option is real. If our lots aren't right for your menu, we'd rather know now than become the newsletter you archive.
>
> — {rep_first_name}
> P.S. If the box arrived damaged or a sample was off, reply to this email — a human (me) reads these, and replacement kits ship same-week.

### SMS — Touch 2 (`COF-004-S1`, `touchpoint: 2`, day 14)

> Hi {first_name} — last note from me about the {origin} kit. One tap: cupped it / need more time / not a fit. Whatever you pick, I'll honor it: {feedback_url}

### Landing page (`/second-cup?utm_campaign=cof-004`)

- **H1:** One tap. We'll take it from there.
- **Three large buttons** mirroring the email choices (each logs a structured event to `platform_metrics`: `silent_reason=busy | not_fit | pending_notes`).
- **If "not a fit":** one-word follow-up (too bright / too pricey / wrong origin / went with another importer) → optional re-match consent checkbox.
- **Confirmation copy:** "Done. We've updated {roaster_name}'s profile — no more kit emails unless you ask."

### Success metrics & decision rules

| Metric | Definition | Baseline | Target | MDE |
|---|---|---|---|---|
| Primary: rescue rate | any structured response ÷ delivered | 11% | ≥ 18% | +3pp |
| Late feedback rate | `feedback.submitted` ≤ 21d ÷ delivered | 5% | ≥ 9% | +2pp |
| "Not a fit" reasons captured | structured reason logged ÷ delivered | — | ≥ 6% (data value) | — |
| Guardrails | spam complaints ≤ 0.1%; unsub ≤ 0.6% (higher tolerance here — a clean unsub is a *good* outcome vs. silent resentment) | — | — | kill if breached |

Minimum sample: 400 sends/arm.

### Automation rule JSON

```json
{
  "rule_id": "COF-004-R1",
  "campaign_id": "COF-004",
  "rule_name": "silent_kit_rescue",
  "trigger_event": "sample_kit.delivered",
  "conditions_json": {
    "days_since_delivery": 9,
    "feedback_submitted": false,
    "order_created_since_delivery": false,
    "suppression_check": {
      "unsubscribed": false,
      "active_campaign_not_in": ["COF-003"],
      "prior_rescue_attempts_max": 0
    }
  },
  "rule_actions": [
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-004-E1",
      "channel_type": "email",
      "touchpoint": 1,
      "delay_minutes": 0,
      "ab_test_id": "abt_cof004_subject_v1"
    },
    {
      "action_type": "SEND_SMS",
      "template_id": "COF-004-S1",
      "channel_type": "sms",
      "touchpoint": 2,
      "delay_minutes": 7200,
      "fire_if": { "any_structured_response": false }
    },
    {
      "action_type": "UPDATE_CRM_LIFECYCLE",
      "payload": {
        "lifecycle_stage": "rescue_window",
        "schedule_exit": { "at_day": 21, "route": "newsletter.quarterly", "set_lead_score_decay": -15 },
        "log_to": "campaign_execution_logs"
      }
    },
    {
      "action_type": "EXECUTE_CAMPAIGN_HALT",
      "payload": {
        "halt_on_event": ["feedback.submitted", "order.created", "structured_response.logged", "user.unsubscribed"],
        "halt_scope": "campaign_id:COF-004",
        "post_halt_route": { "feedback.submitted": "campaign:COF-003", "order.created": "campaign:COF-005" },
        "reason": "rescued_or_resolved"
      }
    }
  ]
}
```

---

## COF-005 — *The Regular* (First Order → Reorder + Referral Seed)

**Objective:** Turn a first order into a habit and an advocate. Dual conversion: (1) second order within 90 days (90-day reorder target ≥ 55%), (2) referral invite sent (K-factor input, see `03-referral-engine-playbook.md`). Timing follows consumption math, not calendar habit: a 500-lb first order at micro volumes lasts ~8 weeks, so the reorder ask lands at day 45; the referral ask lands at day 14, when delivery delight peaks.
**Audience segment:** Accounts with first `order.status='delivered'`. Branches by first-order size (split-bag < 60 lbs vs full bag+) and by segment.
**Trigger events:** `order.delivered` + 14 days → referral seed touch (never before delivery — asking for advocacy before the coffee lands is how you get unsubscribes from friends). `order.delivered` + 45 days → reorder touch with consumption-matched lot. Reorder logged → lifecycle to `active` regular cadence (exit campaign).
**Economic frame:** Second-order accounts retain at 85% vs 41% for one-order accounts; the reorder touch is worth ≈ $430 expected contribution per account touched. Referral ask costs nothing and seeds K ≥ 0.6 (file 03).

### Email — Touch 1 (referral seed, `COF-005-E1`, `touchpoint: 1`, day 14)

**Subject A (control):** `The {origin} is dialed in. Know a roaster who'd cup it?`
**Subject B (variant):** `Give a kit, get a bag — the {roaster_name} referral link is live`

**Body:**

> **Good coffee travels by word of mouth. Always has.**
>
> Hi {first_name},
>
> Two weeks in — how's the {process_method} {origin} performing on the roast? (If something's off, reply and I'll make it right before anything else below matters.)
>
> If it's performing: every roastery has a group chat where someone asks *"where are you finding good washed {origin} right now?"* When that happens, here's your answer in one link:
>
> **{referral_url}**
>
> What your link does: sends a fellow roaster the same free sample kit you started with — real scoresheets, real landed-cost math. When their first order lands, **we roast-credit {roaster_name} $150** and they get **$100 off that first order**. No caps, no expiry, no fine print that embarrasses us at a cupping.
>
> — {rep_first_name}
> P.S. Referral economics are public on the link page. We'd rather you trust the program than be surprised by it.

### Email — Touch 2 (reorder, `COF-005-E2`, `touchpoint: 2`, day 45)

**Subject A:** `~15% of the {region} lot left. Reorder before the spreadsheet says so?`
**Subject B:** `Your {origin} par level says reorder this week`

> Hi {first_name},
>
> Your first order was {first_order_lbs} lbs of the {region} {process_method}, {days_since_order} days ago. At your logged roast cadence, you're inside the reorder window — and {lot_size_bags} bags remain of your exact lot.
>
> Two honest options:
>
> 1. **[ Reorder the same lot ]** — locked at your original ${price_per_lb}/lb while bags last. Consistency your menu already promised.
> 2. **[ Cup the successor lot ]** — same station, new harvest week, sample in your next kit free. For when you'd rather evolve the profile than repeat it.
>
> Either way, automated replenishment is one toggle in settings — set the par level and the spreadsheet retires itself.
>
> — {rep_first_name}

### SMS — Touch 3 (`COF-005-S1`, `touchpoint: 3`, day 52 if no reorder)

> {first_name}, {rep_first_name}. You're ~a week from running dry on the {origin} by my math — {lot_size_bags} bags left at your locked price. Hold 60 lbs for {roaster_name}? Reply YES and it's done.

### Landing page (`/reorder?utm_campaign=cof-005`)

- **H1:** Same lot. Same price. One click.
- **Consumption meter:** visual of estimated remaining lbs ("based on your logged roast cadence — edit if we're wrong").
- **Two CTAs:** `Reorder {first_order_lbs} lbs — ${price_per_lb}/lb` | `Cup the successor first`
- **Referral card (persistent, all post-purchase pages):** "Know a roaster? Give a kit, get $150." → {referral_url}

### Success metrics & decision rules

| Metric | Definition | Baseline | Target | MDE |
|---|---|---|---|---|
| Primary: 90-day reorder rate | 2nd `order.created` ≤ 90d ÷ first-order cohort | 48% | ≥ 55% | +4pp |
| Referral invite rate | ≥ 1 invite sent ÷ accounts touched | 14% | ≥ 25% | +4pp |
| Referral CAC | economic reward cost ÷ referral-attributed new accounts (file 03 §3.4) | — | ≤ $200 | guardrail |
| SMS reply rate (reorder hold) | replies YES ÷ SMS delivered | — | ≥ 12% | +3pp |
| Guardrails | unsub ≤ 0.3% (these are customers now); complaint 0 | — | — | kill if breached |

Minimum sample: 300 first-order accounts/arm (cohort is smaller; duration cap 35 days).

### Automation rule JSON

```json
{
  "rule_id": "COF-005-R1",
  "campaign_id": "COF-005",
  "rule_name": "first_order_habit_and_advocacy",
  "trigger_event": "order.delivered",
  "conditions_json": {
    "is_first_order": true,
    "days_since_delivery": 14,
    "suppression_check": {
      "unsubscribed": false,
      "support_ticket_open": false,
      "quality_check_passed": true
    }
  },
  "rule_actions": [
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-005-E1",
      "channel_type": "email",
      "touchpoint": 1,
      "delay_minutes": 0,
      "ab_test_id": "abt_cof005_subject_v1",
      "personalization": { "tokens": ["{referral_url}", "{origin}", "{process_method}"] }
    },
    {
      "action_type": "SEND_EMAIL",
      "template_id": "COF-005-E2",
      "channel_type": "email",
      "touchpoint": 2,
      "delay_minutes": 44640,
      "fire_if": { "reorder_created": false },
      "personalization": { "tokens": ["{first_order_lbs}", "{lot_size_bags}", "{price_per_lb}"] }
    },
    {
      "action_type": "SEND_SMS",
      "template_id": "COF-005-S1",
      "channel_type": "sms",
      "touchpoint": 3,
      "delay_minutes": 54720,
      "fire_if": { "reorder_created": false, "clicked_at_not_null": true }
    },
    {
      "action_type": "UPDATE_CRM_LIFECYCLE",
      "payload": {
        "lifecycle_stage": "first_order_active",
        "on_reorder": { "lifecycle_stage": "active_repeat", "set_fields": { "status": "active" } },
        "log_to": "campaign_execution_logs"
      }
    },
    {
      "action_type": "EXECUTE_CAMPAIGN_HALT",
      "payload": {
        "halt_on_event": ["order.created", "user.unsubscribed"],
        "halt_scope": "campaign_id:COF-005",
        "halt_note": "reorder converts lifecycle to active_repeat cadence; referral card persists in-product regardless",
        "reason": "habit_established"
      }
    }
  ]
}
```

---

## 6. Sequence-level economics (rolled up)

Per 1,000 qualified leads entering COF-001, at target rates:

| Stage | Rate | Count | Cumulative cost | Cumulative expected yr-1 contribution |
|---|---|---|---|---|
| Qualified leads | — | 1,000 | $12k (lead-gen allocation) | — |
| Kit requests (COF-001) | 32% | 320 | + $12.2k kits | — |
| Feedback (COF-002 + late COF-004) | 45% + 9% of remainder | 144 + 16 = 160 | — | — |
| First orders (COF-003) | 40% of feedback | 64 | — | 64 × $2,100 = $134.4k |
| 90-day reorders (COF-005) | 55% of first orders | 35 | — | (drives yr-2 retention base) |

Blended demand CAC = $24.2k ÷ 64 = **$378** — above the $250 modeled target, below the $500 hard cap, with identified levers (kit-request rate → 38% via LP optimization; referral subtraction of $120-CAC accounts) modeled to bring blended CAC to $290 by month 9. **Kill criterion for the whole engine:** two consecutive months with blended CAC > $500 *and* sample-to-sale < 30% → pause kit spend, rebuild targeting from lead-score model v2.

---

## 7. Global suppression, logging & compliance rules (apply to all COF campaigns)

```json
{
  "rule_id": "GLOBAL-SUPPRESS-001",
  "campaign_id": "GLOBAL",
  "rule_name": "global_suppression_and_logging",
  "trigger_event": "*",
  "conditions_json": { "applies_to_all_campaigns": true },
  "rule_actions": [
    { "action_type": "EXECUTE_CAMPAIGN_HALT", "payload": { "halt_on_event": ["user.unsubscribed", "sms.opt_out", "order.created", "support.escalation_opened", "payment.delinquent_30d"], "halt_scope": "all_active_campaigns_for_account", "reason": "global_suppression" } },
    { "action_type": "LOG_EXECUTION", "payload": { "table": "campaign_execution_logs", "fields": ["rule_id", "template_id", "account_id", "variant_name", "sent_at", "halt_reason", "utm_campaign"] } },
    { "action_type": "UPDATE_CRM_LIFECYCLE", "payload": { "on_unsubscribe": { "lifecycle_stage": "suppressed", "newsletter_only": true }, "on_order_created": { "route": "campaign:COF-005" } } }
  ]
}
```

Compliance: CAN-SPAM/GDPR/CASL — physical mailing address in every footer, one-click unsub honored within 0 sends (immediate, not "10 business days"), SMS only to numbers with express written consent logged, double opt-in for EU leads. Frequency cap: ≤ 1 marketing email + 1 SMS per account per 72 h across *all* campaigns combined (enforced at the orchestrator, not per-campaign).

**Template governance:** every copy change ships as a new `marketing_templates` row (never edit in place — `campaign_execution_logs` must be able to attribute every historical send to an immutable template version), and retires via `campaigns` cascade delete per the blueprint's `ON DELETE CASCADE` design.
