# 03 — Referral Engine Playbook ("Give a Kit, Get a Bag")

> Implements base doc §I.2 *Referral Program Engine* ("viral coefficient tracking with UTM-aware referral attribution"). Integrates with COF-005 (file 02) as the referral seed touchpoint, and with the churn model: referred accounts carry a `sample_kit_redemption`-style trust covariate — referred roasters historically show ~0.7× the churn hazard of cold-acquired ones, which is why this program is allowed to spend real money.
> Economic guardrails inherited from `01-growth-architecture.md`: referral CAC ≤ $200 (economic cost, §3.4), LTV:CAC ≥ 3:1 per segment, no reward that can be gamed into cash.

---

## 1. Why referral works here (behavioral foundation)

Specialty coffee is a **reputation community**, not a market of strangers. Green buying decisions move through roaster group chats, Roasters Guild chapters, Instagram DMs of cupping notes, and "where are you finding washed Ethiopias right now?" threads. Three properties make this channel structurally strong:

1. **The recommendation is the product demo.** A roaster saying "cup this" with a physical sample is higher-bandwidth proof than any ad. The referral reward is a sample kit — the artifact our entire funnel already converts on (40% sample-to-sale).
2. **Referring is status-positive.** Recommending a verified-scoresheet platform signals the referrer cups blind and buys on data. The incentive must never feel like a bounty that cheapens that signal (hence: credits framed as coffee, not cash).
3. **Network density compounds.** Roasters refer peers in their city/segment; those peers share importers, freight lanes, and cupping events — each conversion raises the value of the next.

---

## 2. Incentive design (double-sided, economically rational)

### 2.1 Core offer

| Side | Reward | Form | Why this design |
|---|---|---|---|
| **Referrer** | **$150 roast credit** per qualified referral | Platform credit, auto-applied (max 50% of any single order), never expires, non-transferable, non-redeemable for cash | Credit = retained margin (costs us ~$90 COGS at 40% margin, feels like $150). "Roast credit" framing keeps it sensory and on-brand |
| **Referee** | **Free upgraded sample kit + $100 off first order** | Kit (3 × 200g green + Q-grader scoresheets, $38 cost) + $100 discount on first order ≥ $150 | The discount buys the *first transaction risk*, not loyalty. $100 off a $610 AOV first order = 16% — meaningful, not desperate |
| **Qualification event** | Referee's **first paid order delivered** (not returned within 30 days) | — | Paying on delivered-and-kept revenue aligns reward with real value and guts self-referral economics |

### 2.2 Tiered momentum (keeps top advocates engaged without inflating base cost)

| Tier | Threshold (rolling 12 mo) | Unlock |
|---|---|---|
| **Cupper** | 0–2 qualified referrals | Base offer |
| **Green Buyer** | 3–5 | + Early access to one micro-lot drop per quarter (allocation before public listing) |
| **Compass Circle** | 6+ | + Annual origin-trip raffle seat, co-branded cupping event hosted by Greensheet in their city, permanent "Founding Compass" badge |

Note the tiers escalate *access and status*, not cash. Cash escalation attracts bounty hunters; access escalation attracts evangelists. Cost of Compass Circle perks ≈ $400/yr per member — trivial against 6 × ~$2,100 yr-1 referred contribution.

### 2.3 What we deliberately don't do

- **No cash payouts.** Cash converts a community gesture into an affiliate job, attracts fraud, and creates tax-reporting (1099) overhead per referrer.
- **No recurring % kickbacks.** Rev-share on referee orders forever would silently tax LTV and distort the CAC model; one clean reward at conversion keeps unit economics legible.
- **No reward for signups.** Free-account referrals pay $0 — only delivered first orders qualify. Volume of junk signups is a fraud vector, not a KPI.

---

## 3. Viral coefficient model (the math)

### 3.1 Definitions

- `i` = average invites sent per active roaster account per cycle (cycle = 21 days, the observed median from delivery-delight peak to next community touch)
- `c` = invite → qualified conversion rate (invitee completes first paid delivered order)
- **K = i × c** (viral coefficient)
- Growth multiplier from referrals alone: **M = 1 / (1 − K)** for K < 1 (geometric series of viral generations); at K ≥ 1 the loop is self-sustaining (not expected nor required — base acquisition feeds the loop)

### 3.2 Modeled scenarios (21-day cycle)

| Scenario | i | c | K | Multiplier M | Meaning |
|---|---|---|---|---|---|
| Launch baseline (seeded advocates only) | 2.4 | 18% | 0.43 | 1.75× | Every 100 paid acquisitions yield ~75 more over time |
| Target @ month 6 (COF-005 seed + in-product card) | 3.4 | 18% | 0.61 | 2.56× | Guardrail KPI from file 01: K ≥ 0.6 |
| Stretch @ month 12 (tiers live, event loop) | 4.2 | 24% | 1.01 | ∞ (borderline) | Treated as upside, never as plan |

**Levers ranked by sensitivity** (elasticity of K, from pilot data priors): (1) `c` — referee first-order rate: +1pp ≈ +0.034 K. Biggest lever; improved by kit quality and the $100 discount depth. (2) `i` — invites per account: +0.5 invites ≈ +0.09 K at c=18%; improved by placing the referral card on the *delivery confirmation* page (delight peak) and in COF-005-E1. (3) Cycle time: cutting the invite→order cycle 21d → 14d raises effective monthly K by ~30% without changing i or c (faster compounding).

### 3.3 Funnel instrumentation (per cycle, per cohort)

```
invites_sent  →  invite_clicked  →  account_created  →  kit_requested  →  kit_delivered
     →  feedback.submitted  →  first_order.delivered  (= qualified referral)
```

Track each hop in `campaign_engagements` (UTM fields) + `platform_metrics` (`metric_name='referral_invite'`, dimensions `{referrer_id, channel}`). Dashboard targets per hop: click 45% → signup 60% → kit 70% → feedback 45% → order 40%. Composite c = 45%×60%×70%×45%×40% ≈ **3.4% per raw invite**; with i=3.4 and re-invites across cycles, steady-state c_effective per invited *roaster* (not per invite event) ≈ 18%.

### 3.4 Referral CAC (honest accounting)

Per qualified referral: $150 credit (COGS cost ≈ $90 at 40% margin) + $100 discount (foregone revenue = real $100) + kit $38 (already inside base CAC model, not double-counted) = **$190 economic cost**. Versus segment CAC targets ($250 micro / $600 boutique), referral is the cheapest channel that exists *and* arrives with lower churn hazard. Program-level guardrails:

- Referral-attributed CAC (economic) ≤ **$200**; face-value reward cost ≤ $250.
- Referral share of new accounts capped in reporting at honest value — multi-touch note: referred accounts also see COF emails; we credit referral as *acquisition channel* (first touch) and COF as *nurture*, never both.
- Monthly fraud-adjustment: qualified count is restated net of clawbacks (§4) before CAC is computed.

---

## 4. Fraud prevention (design for the adversary)

The attack surface: self-referrals (second roastery identity), referral rings (A refers B, B refers A), bounty farming (fake roasteries ordering minimum to harvest credits), and credit laundering (referring a "friend" who is really a reseller).

| Control | Mechanism | Field/tech |
|---|---|---|
| **Identity graph match** | Block qualification if referee shares: billing address, `tax_id`, card fingerprint, device fingerprint, or IP /24 with referrer | `accounts.tax_id`, `business_registration`, payment processor fingerprint, device fingerprint at signup |
| **Qualification floor** | First order ≥ $150 *and* delivered *and* 30-day return window passed before credit posts | `orders.final_total_cents`, `actual_delivery`, `status != 'returned'` |
| **Clawback** | Credit revoked if referee refunds/returns within 30 days of delivery; clawed from referrer's next order with clear notification | `orders.status='returned'` event → ledger reversal |
| **Velocity limits** | > 5 claimed referrals/account/month routes to manual review before any credit posts; > 10/month auto-pauses rewards pending review | rate limiter on `referral_invite` events |
| **Ring detection** | Graph analysis: mutual referral pairs within 60 days flagged; second leg of a mutual pair qualifies at 50% and triggers review | referral graph table, nightly job |
| **Reseller screen** | Referee must be a distinct registered business (`business_registration` + `tax_id` validated); PO-box-only addresses flagged | schema fields + address validation API |
| **Spend-through cap** | Credits cover max 50% of any order — credits can never fund a full "free" order that gets resold | checkout rule |
| **Abuse ≠ accusation** | All blocks are silent declines ("referral didn't qualify") with a human review path; we never accuse a roaster of fraud by email | CS macro + review queue |

Expected fraud rate with these controls: < 3% of claimed referrals; budget 5% clawback reserve in program economics.

---

## 5. UTM attribution schema

### 5.1 Referral link anatomy

```
https://greensheet.com/r/{ref_code}?utm_source=referral
  &utm_medium={invite_channel}          # invite_link | qr_sticker | email_share | instagram_dm | event_badge
  &utm_campaign=ref_core_2025
  &utm_content={referrer_account_id}:{invite_channel}
```

`ref_code` is a short, human-readable code (e.g., `GS-RIVER-42`) printed on bag stickers and event badges for offline → online bridging; it resolves server-side to the same attribution record (code wins over UTM if both present — QR stickers get scanned by people who strip query strings).

### 5.2 Persistence & precedence rules

1. **First-touch acquisition channel:** if any referral touch exists before `account.created`, `acquisition_channel = 'referral'` is immutable on the account record. COF campaign UTMs still log per-send in `campaign_engagements` for nurture analytics (no overwrite).
2. **Last-referrer-wins within 90-day window:** a new valid referral touch replaces a prior referrer if the account hasn't converted yet; after first order, the record locks.
3. **Attribution window:** 90 days invite → first order; after that, the referral is credited to "community/organic" (honest accounting, prevents ancient-link credit surprises).
4. **Cross-device:** code entry at checkout ("have a roaster's code?") as fallback — 8–12% of referrals historically arrive code-in-hand.

### 5.3 Reporting views

- `v_referral_funnel` — per §3.3 hops, sliceable by `utm_medium` and referrer segment.
- `v_referral_economics` — rewards posted, clawbacks, economic CAC, referred-account LTV vs. cohort baseline (referred LTV target: ≥ 1.15× cohort average).
- Leaderboard (internal only — never publish a public leaderboard; it incentivizes farming).

---

## 6. Launch sequence

| Phase | Window | Actions | Exit criteria |
|---|---|---|---|
| **0 — Instrumentation** | Weeks −2 to 0 | Attribution tables + code resolver live; clawback ledger; fraud controls 1–4 on; seed dashboards | Test referral end-to-end in staging incl. clawback |
| **1 — Seeded beta** | Weeks 0–3 | Hand-invite 25 accounts: NPS ≥ 9, ≥ 3 orders, mix of micro/boutique. Personal note from founder; physical launch kit: 5 QR bag stickers + a "give this to a roaster friend" card in their next shipment | ≥ 40% of seeds send ≥ 1 invite; zero fraud flags; ≥ 8 qualified referrals |
| **2 — Cohort rollout** | Weeks 4–7 | Open to all accounts with ≥ 1 delivered order (COF-005-E1 now carries the live link); in-product referral card on delivery confirmation + shortlist pages | K ≥ 0.35 on this cohort; referral CAC ≤ $200; invite→click ≥ 40% |
| **3 — GA + community push** | Weeks 8–12 | All accounts incl. free tier; Roasters Guild / throwdown QR activations; tier system live; first micro-lot early-access drop for Green Buyer tier | K ≥ 0.6 trajectory; referral share of new accounts ≥ 12% and rising |
| **4 — Steady state** | Month 4+ | Monthly economics review (rewards vs. fraud vs. LTV premium); quarterly reward-depth test (e.g., $150/$100 vs. $200/$50 — Bayesian, same decision rules as file 02 §0.3); annual Compass Circle event | Referral share ≥ 20% by M9; referred-account 90-day reorder ≥ cohort baseline |

**Kill/pivot criteria:** referral CAC > $250 for two consecutive months, or fraud-adjusted qualification rate < 60% (i.e., farming dominates), or referred-account LTV < cohort baseline (means we're buying deal-seekers, not roasters) → halve reward depth, tighten qualification floor to $300 first order, re-evaluate in one cycle.

---

## 7. Copy assets (program-level, beyond COF-005)

**In-product referral card:** "Know a roaster still buying off PDFs? Send them a real kit — scoresheets included. You get $150 of roast credit when their first order lands. {referral_url}"

**Referee landing page H1:** "{referrer_roastery_name} thinks you should cup this."
**Subhead:** "A free specialty sample kit — three lots, real Q-grader scoresheets, landed-cost math — plus $100 off your first order. Sent by a roaster, not an ad network."

**QR sticker (for bag/box):** "Roasters refer roasters. Scan. Cup. Decide. → GS-{code}"

**Economics disclosure (linked everywhere, per the honesty-in-scarcity brand rule):** full reward amounts, qualification definition, clawback policy, and the sentence: *"We can afford this because referred roasters stay longer. That's the whole trick, and now you know it."*
