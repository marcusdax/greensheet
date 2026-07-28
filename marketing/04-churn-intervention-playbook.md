# 04 — Churn Intervention & Retention Playbook

> Implements base doc §I.2 *Churn Intervention Workflows* ("n8n/Airbyte automations that trigger campaigns based on engagement telemetry") on top of §2.2's Cox proportional-hazards model. Every intervention writes to the `churn_interventions` table (`intervention_type`, `risk_score_before`, `outcome`, `assigned_to`) so save rates are auditable and the survival model re-trains on its own treatment effects.
> Economic spine: every save offer obeys the guardrails in §5 — retention spend is an investment with a budget equal to a fraction of defended LTV, never a panic discount.

---

## 1. The retention philosophy

1. **Churn is a lagging metric; hazard is the leading one.** We never wait for `status='churned'`. The Cox model (features: `log_engagements_6mo`, `days_since_last_activity`, `avg_order_frequency_days`, `order_volume_trend`, `support_ticket_count`, `payment_delinquency_days`, `sample_kit_redemption`, segment dummies) emits `accounts.churn_risk_score` nightly; interventions key off the score, not the event.
2. **The cheapest save is the one before the customer notices their own drift.** A T1 nudge costs $0.004; a T3 save costs up to $837. The ladder exists to push interventions as early as the hazard data responsibly allows.
3. **Price is the last tool, not the first.** Most B2B churn in green coffee is caused by *workflow* failure (a lot that didn't fit the menu, a missed delivery, a rep change), not price. Discounts treat the symptom and tax every retained dollar thereafter; our ladder exhausts value-add remedies first.
4. **Some churn is correct.** Accounts with structurally negative margin contribution or persistent delinquency are allowed to leave gracefully — retaining bad-fit revenue raises CAC payback and support load. The model's job is triage, not desperation.

---

## 2. Risk-tier definitions (mapped to churn hazard)

`accounts.churn_risk_score` is the Cox partial hazard normalized to [0,1] (schema CHECK constraint). Tiers are calibrated so that **0.70 remains the "high-risk" line from base doc §2.2** (`get_high_risk_roasters(threshold=0.7)`).

| Tier | Hazard band | Label | Expected 90-day churn | Dominant signals (model covariates) | Owner |
|---|---|---|---|---|---|
| **T0** | < 0.30 | Healthy | < 3% | Regular cadence, feedback loops active, engagements rising | Lifecycle (automated only) |
| **T1** | 0.30 – 0.55 | Watch | 3–8% | `days_since_last_activity` climbing past 1.5× their `avg_order_frequency_days`; engagement decay −30% QoQ | Lifecycle (automated) |
| **T2** | 0.55 – 0.70 | At-Risk | 8–18% | `order_volume_trend` negative 2 consecutive months; kit redemption lapsed; support ticket unresolved > 7 days | CS queue + lifecycle |
| **T3** | ≥ 0.70 | Critical | > 18% | Multiple compounding: delinquency days > 0, volume trend ↓, activity silence ≥ 30 days, competitor signals (public roastery posts tagging other importers) | Named CSM + growth lead |

**Tier-entry hysteresis:** an account must score in-band for 2 consecutive nightly runs before tier assignment (prevents one bad week from paging a CSM), but *exits* downward after 14 clean days. Critical safety override: any open `support.escalation` or `payment.delinquent_30d` event promotes directly to T3 regardless of score.

**Calibration review:** quarterly, re-fit Cox model; re-derive tier cutoffs so that T2+T3 population ≈ top 15% of hazard mass; track tier→actual-churn precision/recall (target: T3 precision ≥ 40%, T2+T3 recall ≥ 70%).

---

## 3. The intervention ladder

Each rung maps to the `churn_interventions.intervention_type` enum and has a strict escalation rule — we never skip rungs silently, and we never repeat a failed rung within 30 days.

### Rung 1 — Automated value email (`intervention_type='email_campaign'`), T1

**Trigger:** tier entry T1. **Timing:** within 24 h. **Goal:** re-activation event (login, lot view, kit request, feedback). No human, no discount, no "we miss you" guilt framing — lead with utility.

**Email `CHN-T1-E1`:**
- Subject A: `New arrivals scored {sca_cup_score}+ in your preferred {process_method} profile`
- Subject B: `{first_name}, 3 lots landed that match {roaster_name}'s buying pattern`
- Body: three live lot cards (real inventory, `available_quantity_lbs` > 10 bags), one-line each — origin, process, score, $/lb — plus one utility line: "Your reorder window for the {origin} lot opens in ~{n} days at your cadence." CTA: `View the three lots`.
- **Exit:** any engagement event demotes hazard; 14 days silent → escalate T2 (if score supports) or return to newsletter cadence.

### Rung 2 — Structured listening (`intervention_type='survey'`), early T2

**Trigger:** tier entry T2. **Timing:** 48 h after rung-1 email if unengaged, else immediately. **Goal:** surface the *cause* before offering the *cure*; survey responses route to the correct remedy branch.

**Email `CHN-T2-S1`:**
- Subject A: `One question, {first_name} — what should we have done better?`
- Subject B: `Was it the coffee, the logistics, or us?`
- Body: radically short. "Your last order was {days_since_last_order} days ago, which isn't like you. One tap tells the truth:" — four buttons: **(1) Menu changed** (new roast profiles needed) → routes to re-match shortlist; **(2) A lot underperformed** → routes to quality review + replacement credit per policy; **(3) Logistics let us down** → routes to ops escalation + freight credit; **(4) Buying elsewhere** → routes to honest exit interview (2 questions) and win-back eligibility in 60 days.
- Every response logs to `platform_metrics` (`metric_name='churn_reason'`) — this is the churn model's most valuable labeled data.

### Rung 3 — Human outreach (`intervention_type='sales_call'`), T2 persistent / T3 immediate

**Trigger:** T2 for 14 days with no survey response, **or** any T3 entry. **Timing:** T3 → CSM call within 48 h (task auto-created, `assigned_to` = named CSM, SLA tracked). **Goal:** diagnose, commit to one concrete remedy, log outcome in `churn_interventions.notes`.

**Call framework (10 minutes, "CLEAR"):**
- **C**ontext: open with their data, not apology — "I see the Huila order in March and then silence; walk me through what changed."
- **L**isten: no pitching for the first 5 minutes; the CSM's job is to find the *one* root cause.
- **E**xplain: only if asked — never defend, never blame logistics or the customer.
- **A**gree: one concrete remedy with a date ("replacement 30-lb split ships Thursday"; "net-45 terms start next invoice"; "your shortlist gets re-matched by a human Q-grader, not the model").
- **R**ecord: outcome + committed remedy in `churn_interventions` same day.

**SMS assist (T3, if call unreachable, `CHN-T3-S1`):**
> {first_name}, {rep_first_name} from Greensheet — not a sales text. I can see ordering stopped {days_since_last_order} days ago, and I'd rather hear it straight: did we drop something? 10 minutes this week and I'll come with a fix, not a pitch. Reply with a day.

### Rung 4 — The save offer (`intervention_type='discount_offer'`), T3 only, post-diagnosis

Offered **only** after rung 3 diagnosis confirms price/terms/value gap as the root cause — never as a substitute for the conversation. Ladder within the rung (escalate only if the previous is declined):

| Level | Offer | When (diagnosis) | Cost basis |
|---|---|---|---|
| 4a | Free freight on next 2 orders + priority kit logistics | Logistics pain, freight-margin sensitivity | ~$120–180, preserves price integrity |
| 4b | Extended terms (net-30 → net-45/60) or split-bag inventory reserve | Cash-flow pain (micro segment, seasonal troughs) | Cost of capital ~0.8%/mo — cheaper than any discount |
| 4c | One-time 5% off next order + human Q-grader re-match session | Genuine price/value gap vs. competitor | Capped by §5 guardrails |
| 4d | 10% off next order + dedicated green-buy planning call | Confirmed competitive switch in progress, account LTV ≥ boutique | Hard cap — §5; requires growth-lead approval |

Never offered: % off *forever*, waived minimums permanently, or any recurring price concession — recurring concessions re-price the account's entire LTV, which is how retention programs quietly destroy the businesses they save.

---

## 4. Win-back campaign (`WIN-001`) — for `dormant` and `churned` accounts

**Audience:** `status='dormant'` (60–180 days no order) → 3-touch win-back; `status='churned'` (180+ days or explicit exit) → single seasonal touch max (harvest cycle), never more. Respect every exit-interview answer: if they left over quality, the win-back must *lead* with what's verifiably different.

### Email — Touch 1 (`WIN-001-E1`, day 0 of dormancy window)

**Subject A (control):** `New harvest landed. The {region} lots you'd have wanted first look at.`
**Subject B (variant):** `{first_name}, what changed since you left (with receipts)`

**Body:**

> **We'd rather show you than miss you.**
>
> Hi {first_name},
>
> Your last order — {last_order_lbs} lbs of the {process_method} {origin} — was {days_since_last_order} days ago. You had your reasons, and we kept the notes.
>
> So instead of a "we miss you" email, three things that are verifiably different now:
>
> 1. **Every lot ships with the Q-grader's actual scoresheet** — blind-cup it against your own scores, like always, but now the reference card is in the box by default.
> 2. **Logistics scores on every lot.** You told us the March shipment ran 9 days late. Every lot now carries a live logistics score and a delivery SLA in writing.
> 3. **The new {origin} harvest is in.** {sca_cup_score} points, {elevation_masl} masl, {process_method} — the profile you used to build your {menu_slot} around. {lot_size_bags} bags, first look before it lists publicly.
>
> One click puts a free kit on your table. No calls, no sequence, no guilt: **{kit_tracking_url}**
>
> — {rep_first_name}
> P.S. If the answer is genuinely "we've moved on," tap here and you'll hear from us once a year at harvest, nothing more. We keep promises like that.

*(Personalize bullet 2 to the logged `churn_reason`: quality → replacement policy + re-match; price → elasticity-informed pricing note; silence/no reason → keep bullet 2 as logistics.)*

### Email — Touch 2 (`WIN-001-E2`, day 10, no response)

**Subject A:** `The {region} lot is down to {lot_size_bags} bags`
**Subject B:** `Closing your file, {first_name} — last note`

> Short version: the kit offer stands for {days_left} more days, then we close the file and move you to the annual harvest letter. The {region} lot is at {lot_size_bags} bags — that's the live count, and when it's gone, it's next harvest. **{kit_tracking_url}** — {rep_first_name}

### SMS — Touch 3 (`WIN-001-S1`, day 17, prior engagers only)

> {first_name}, {rep_first_name} (Greensheet). Final note: your free kit — new {origin} harvest, {sca_cup_score} pts — expires {days_left}d. Want it? {kit_tracking_url} (Reply STOP and the file closes for good.)

### Win-back automation rule JSON

```json
{
  "rule_id": "WIN-001-R1",
  "campaign_id": "WIN-001",
  "rule_name": "dormant_account_winback",
  "trigger_event": "account.became_dormant",
  "conditions_json": {
    "account_status": "dormant",
    "days_since_last_order_min": 60,
    "days_since_last_order_max": 180,
    "churn_reason_not_in": ["closed_business"],
    "suppression_check": {
      "unsubscribed": false,
      "explicit_no_contact": false,
      "active_campaign_not_in": ["COF-004"]
    }
  },
  "rule_actions": [
    { "action_type": "SEND_EMAIL", "template_id": "WIN-001-E1", "channel_type": "email", "touchpoint": 1, "delay_minutes": 0, "ab_test_id": "abt_win001_subject_v1", "personalization": { "branch_on": "churn_reason", "tokens": ["{sca_cup_score}", "{process_method}", "{lot_size_bags}", "{elevation_masl}"] } },
    { "action_type": "SEND_EMAIL", "template_id": "WIN-001-E2", "channel_type": "email", "touchpoint": 2, "delay_minutes": 14400, "fire_if": { "any_engagement": false } },
    { "action_type": "SEND_SMS", "template_id": "WIN-001-S1", "channel_type": "sms", "touchpoint": 3, "delay_minutes": 24480, "fire_if": { "any_engagement": false, "prior_12mo_engagement": true } },
    { "action_type": "UPDATE_CRM_LIFECYCLE", "payload": { "lifecycle_stage": "winback_window", "on_no_response_day_21": { "lifecycle_stage": "harvest_letter_annual", "set_fields": { "status": "churned" } }, "on_kit_requested": { "lifecycle_stage": "reactivated", "set_fields": { "status": "trial" }, "route": "fulfillment.temporal.kit_workflow" }, "log_to": "campaign_execution_logs" } },
    { "action_type": "EXECUTE_CAMPAIGN_HALT", "payload": { "halt_on_event": ["sample_kit.requested", "order.created", "user.unsubscribed", "explicit_no_contact"], "halt_scope": "campaign_id:WIN-001", "reason": "reactivation_or_final_exit" } }
  ]
}
```

### Win-back success metrics

| Metric | Definition | Target | Decision rule |
|---|---|---|---|
| Reactivation rate | `sample_kit.requested` or order ÷ delivered | ≥ 12% (dormant), ≥ 3% (churned annual touch) | Bayesian rules per file 02 §0.3, min 300/arm |
| Reactivated LTV premium | 90-day reorder rate of reactivated vs. new accounts | ≥ 0.9× new-account baseline | If < 0.7×, tighten dormancy window to 60–120 days |
| Cost per reactivation | all win-back costs ÷ reactivated | ≤ $150 (vs. $250+ new CAC — win-back must beat acquisition) | Two months over → reduce to annual touch only |

---

## 5. Save-offer economics (guardrails that protect LTV)

### 5.1 The budget math

For any account, maximum justified retention spend:

```
max_save_spend = min( 0.15 × E[contribution next 90 days],
                      0.20 × remaining_discounted_LTV )
```

- **Micro example:** 250 lbs/mo × $1.40 × 3 mo = $1,050 expected 90-day contribution (before survival weighting); remaining discounted LTV ≈ $1,220 → cap = min($158, $244) = **$158**. Rung 4a (free freight, ~$120) fits; 4c (5% of $610 = $31) fits; anything beyond does not — let them leave gracefully.
- **Boutique example:** 1,200 × $1.55 × 3 = $5,580; remaining LTV ≈ $5,420 → cap = min($837, $1,084) = **$837**. 4d (10% of a $4,000 order = $400 + $150 session cost) fits.
- **Commercial:** cap ≈ min($3,510, $5,414) = **$3,510** — funds serious remedies (dedicated reserve inventory, custom terms) without touching list price.

### 5.2 Hard rules (non-negotiable)

1. **Margin floor:** no offer may push the account's next-order contribution margin below $0.90/lb (blended floor keeping distribution margin > 40% at portfolio level).
2. **One save per 12 months per account.** A second T3 episode within a year triggers *structural* review (fit, terms redesign, or managed sunset), not a second discount — repeat savers become discount-trained, and their LTV model is adjusted down 25% to reflect it.
3. **Approval matrix:** 4a/4b → CSM autonomous; 4c → CS lead; 4d → growth lead sign-off with LTV worksheet attached to `churn_interventions.notes`.
4. **Sunset honesty:** accounts whose max_save_spend < $50 (structurally tiny or margin-negative) receive excellent off-boarding instead of offers — annual harvest letter, data export, genuine good wishes. Off-boarded well, they refer; discounted badly, they don't.

### 5.3 Program-level ROI

Quarterly: `program_ROI = (Σ saved accounts × defended contribution) ÷ (offer costs + CS time + tooling)`. Targets: save rate ≥ 55% of T2 closures, ≥ 35% of T3 (`outcome='retained'` ÷ closed interventions), program ROI ≥ 4×, discount-spend share of total retention budget ≤ 30% (if it's higher, the ladder is collapsing into price — fix rungs 1–3).

---

## 6. Instrumentation & feedback loop

- Nightly: model scores → tier assignment (hysteresis §2) → rung triggers fire via n8n/Airbyte (base doc §I.2) into the same `automation_rules` engine as COF campaigns.
- Every intervention: `churn_interventions` row with `risk_score_before`; 30 days later, outcome closure (`retained` / `churned` / `pending` → forced closure) + `risk_score_after` delta logged to `platform_metrics`.
- Monthly retention council: tier precision/recall, save-rate by rung, offer-spend vs. caps, top-3 `churn_reason` codes routed to product/ops as fix requests. **The best churn intervention is the product fix that deletes the churn reason.**
