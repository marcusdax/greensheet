# 01 — Greensheet Growth Architecture (GTM System)

> Workstream: Marketing & Growth. Inputs: base architecture doc §I.2 (Marketing & Growth Architecture) and §II (LTV/CAC & churn math), plus the `coffee-marketing-schema.sql` blueprint (`campaigns`, `campaign_tokens`, `marketing_templates`, `automation_rules`, `rule_actions`).
> Companion files: `02-cof-campaign-expansion.md`, `03-referral-engine-playbook.md`, `04-churn-intervention-playbook.md`, `05-video-content-ecosystem.md`, `06-production-bible.md`.

---

## 1. Strategy on one page

**What Greensheet is:** the marketing/CRM and transaction layer for specialty green coffee — the system of record that connects importers/exporters (supply) with roasters (demand) around verified, lot-level data: SCA cup score, process method, elevation, varietal, traceability, ESG.

**Category we create and win:** *Verified Green Coffee Distribution*. We do not position as "another importer portal" and we do not position as generic CRM. We position as the platform where **every claim on a coffee lot is data, and every relationship is measurable.**

**Growth model:** Two-sided, data-network-effect flywheel:

1. Supply side (importers/exporters) pays for the CRM/marketing suite (COF-001–005 automation, predictive lead scoring, sample-kit fulfillment) because roaster attention is scarce.
2. Demand side (roasters) joins free or near-free because verified lot data + sample logistics remove sourcing risk.
3. Every cupping, feedback submission, order, and reorder enriches the data layer (XGBoost lead scores, Cox churn hazards, price elasticity) → better matches → higher reorder rates → more supply-side willingness to pay.

**Economic spine (from base doc §II, held consistent across all marketing files):**

| Constant | Value | Source |
|---|---|---|
| Discount rate `d` | 10% (8–12% band) | §2.1 |
| Target blended CAC | ≤ $250 modeled; **hard cap $500** | §2.1 example, §11.1 KPI |
| LTV:CAC floor | ≥ 3:1 | §11.1 |
| Sample-to-sale conversion | > 40% (kit delivered **and** feedback submitted → first order) | §11.1 |
| First order rate | > 60% of activated accounts within 30 days | §11.1 |
| 6-month retention | > 75% (≈ ≤ 4.5% monthly churn micro segment) | §11.1 |
| Gross margin | > 40% (distribution P&L); > 75% (platform SaaS revenue) | §11.1 |
| Legacy funnel baseline | Kit Sent 1000 → Opened 450 → Clicked 180 → Ordered 72 (7.2% kit→order) | §11.2 dashboard |
| Churn hazard threshold for high-risk | Cox partial hazard ≥ 0.70 | §2.2 |

---

## 2. Market segmentation

Segments map 1:1 to the `accounts` schema enum (`segment`, `company_size`) so that targeting, lead scoring, and churn models all read the same fields.

### 2.1 Demand side (roasters)

| Segment | Schema mapping | Profile | Green volume | JTBD (job to be done) | Buying trigger | Objection to neutralize |
|---|---|---|---|---|---|---|
| **Micro-roaster** | `segment='micro'`, `company_size='single_roaster'` | 1–5 staff, one roaster (5–15 kg drum), sells bags + 1–3 wholesale accounts | 150–400 lbs/mo | "Help me buy 86+ coffee without betting my cash flow on a full bag I haven't cupped." | Sample kit arrives; a washed Ethiopia or honey process they can't get from the big importers | "You're a middleman tax." → Show landed-cost parity and free tier |
| **Boutique / mid-size** | `segment='boutique'`, `company_size='small_chain'` or `'regional'` | 2–15 staff, 2–5 cafés or a growing wholesale book, dedicated green buyer (often the owner) | 800–2,500 lbs/mo | "Give me consistency across contracts, forecasting, and first look at micro-lots before my competitors." | A lot they cupped sells out elsewhere; a Q-grader on staff validates our scores | "I have relationships already." → We don't replace relationships; we make them measurable |
| **Commercial / enterprise** | `segment='commercial'`, `company_size='national'` | Multi-site, procurement team, contracts + hedging, ESG reporting obligations | 5,000+ lbs/mo | "De-risk supply: verified ESG, logistics reliability, API into my ERP." | Sustainability audit, supplier consolidation, stockout pain | "Migration risk." → Parallel-run, API-first, SLA |

### 2.2 Supply side (importers/exporters) — the paying CRM customer

| Tier | Profile | JTBD | What we sell them |
|---|---|---|---|
| **Exporter / cooperative at origin** | Sells 5–40 containers/yr, weak direct-to-roaster marketing | "Get my lots in front of qualified US/EU roasters without a $200k trade-show budget." | Listing tools, COF campaign suite, sample-kit fulfillment (temporal.io orchestration), UTM attribution |
| **Import house (mid)** | 10–60 active lots, 1–3 sales reps drowning in spreadsheets | "Score my leads so reps call the roasters who will actually convert." | XGBoost predictive lead scoring, churn hazard alerts, A/B/n campaign engine |
| **Enterprise trader** | Multi-origin, multi-warehouse | "Dynamic pricing, elasticity models, and an auditable system of record." | Pricing optimizer (Bayesian structural time series), API federation, ESG/logistics scoring |

### 2.3 Market sizing logic (bottom-up, serviceable)

- **SAM filter:** specialty-graded (80+) green coffee buyers with ≥ 1 employee and online purchasing behavior.
- **Anchor math:** 4,000 US specialty roasters (SCA directory scale) + 1,500 EU/ANZ English-first roasters ≈ 5,500 serviceable demand-side accounts; ~250 serviceable supply-side sellers. First 24 months: 12% demand penetration (≈650 roasters), 20% supply penetration (≈50 sellers). This is the volume assumption behind the CAC math in §6.

---

## 3. Positioning architecture

**For** specialty coffee roasters and the importers/exporters who supply them,
**Greensheet is** the verified green-coffee distribution platform
**that** turns every lot into auditable data — SCA score, process, elevation, traceability — and every buyer relationship into a measurable pipeline.
**Unlike** legacy importer portals and spreadsheet CRMs,
**we** connect sample to contract in one system, so quality claims are verified before money moves and no relationship goes quietly cold.

### Positioning pillars (each maps to a product truth and a proof point)

| Pillar | Product truth | Proof we can publish |
|---|---|---|
| **Verified quality** | `cup_score`, `sensory_profile`, `q_grader_notes` on every lot | Score-to-cupping agreement rate on sample kits |
| **Full traceability** | origin, elevation, varietal, `processing_method`, harvest dates, port, container | Lot-level chain-of-custody timeline |
| **Speed to decision** | sample kit → feedback → order in one workflow (median 9 days) | Time-to-first-order distribution |
| **Relationship telemetry** | `engagements6mo`, `days_since_last_order`, churn hazard alerts | Save rate of churn interventions |
| **Economic clarity** | landed-cost transparency, elasticity-informed pricing | Margin-per-lb benchmarking vs. peer quantiles |

---

## 4. Messaging house

**Roof (one line):** *Buy green coffee you can verify. Sell green coffee you can prove.*

**Support beams by audience:**

**Roaster — Micro**
- H1: "Cup it before you commit a dollar."
- Proof: "Every sample kit ships with the Q-grader's actual scoresheet — not marketing copy."
- Emotional register: craft pride, risk relief, belonging to a quality-obsessed community.

**Roaster — Boutique**
- H1: "First look at the lots your competitors will ask about in six weeks."
- Proof: "86.5-point washed Gedeb, 2,100 masl — 40 bags, and two of your peers already cupped it."
- Emotional register: insider access, professional competence, scarcity handled honestly.

**Roaster — Commercial**
- H1: "Supply-chain certainty, scored."
- Proof: "Every lot carries a logistics score and an ESG score your auditors can export."
- Emotional register: control, auditability, career safety.

**Importer/Exporter**
- H1: "Know which roasters will convert before your reps dial."
- Proof: "Lead scores trained on real conversion history; kits that fulfill themselves; campaigns that halt the moment a roaster buys."
- Emotional register: modern competence, relief from spreadsheet chaos.

**Foundation (voice rules, detail in `06-production-bible.md` §7):** specialty-literate always (we say "washed process at 1,900–2,200 masl," never "premium beans"); sensory over superlative; numbers before adjectives; honesty about scarcity (we show bag counts).

---

## 5. Channel mix & budget allocation

Channel roles are assigned by segment and by the funnel stage they can actually move. Budget percentages are of the demand-gen pool; targets reconcile to blended CAC ≤ $250 (cap $500).

| Channel | Role | Primary segment | Share of spend | Efficiency target |
|---|---|---|---|---|
| **Sample-kit program** (COF-001–005 engine, temporal.io fulfillment) | Conversion centerpiece — physical proof | All roaster segments | 30% | Kit→feedback ≥ 45%; feedback→order ≥ 40% |
| **Community & referral** (see `03`) | Lowest-CAC compounding loop | Micro, boutique | 10% | K-factor ≥ 0.6 by month 6; referral CAC ≤ $200 (economic cost, file 03 §3.4) |
| **Content/SEO + video ecosystem** (see `05`) | Category education, evergreen acquisition | Micro, boutique | 20% | ≥ 35% of organic signups touch ≥ 1 video |
| **LinkedIn + trade pubs (paid)** | Supply-side demand gen; enterprise roasters | Importers, commercial | 15% | SQL rate ≥ 25% of MQLs |
| **Trade shows / cupping events** (SCA Expo, Roasters Guild, local throwdowns) | Trust acceleration, kit recruitment in person | Boutique, commercial | 15% | Badge-scan→kit-request ≥ 30% |
| **Lifecycle/email-SMS automation** | Nurture, retention, win-back (COF + churn playbooks) | All | 5% | See file 02 metrics per campaign |
| **Partnerships** (roaster guilds, Q-grader networks, green-buyer courses) | Credibility + list access | All | 5% | Partner-sourced CAC ≤ $150 |

**Channel economics guardrail:** any channel whose 90-day trailing CAC exceeds its segment ceiling (micro $405 / boutique $1,800 / commercial $9,000 — derived from platform LTV ÷ 3, see §6) is paused pending creative or audience revision. No "brand spend" without a measured lift design (geo-holdout or PSA control).

---

## 6. Platform pricing & packaging logic

Pricing is designed around three principles: (1) **charge the side that captures value** (supply pays for demand access; roasters pay only for workflow depth), (2) **price against verified ROI** (lead-scoring lift, kit logistics savings), (3) **keep the demand-side free tier genuinely useful** because roaster density *is* the product supply side pays for.

### 6.1 Roaster-side tiers

| Tier | Price | Includes | Why this price |
|---|---|---|---|
| **Cupper** (free) | $0 | Browse all lots w/ full cup data, 3 lot alerts, 1 sample kit/quarter at cost, community referral eligibility | Free tier is the moat: every active cupper raises supply-side ARPU. Cost per free account ≈ $6/mo infra + kits at cost |
| **Roaster Pro** | $49/mo | Unlimited alerts, contract pricing locks, automated replenishment triggers, peer benchmarking, 4 kits/quarter included | Priced below one hour of a green buyer's time/month; targets micro→boutique graduation |
| **Roaster Business** | $149/mo | Multi-user, multi-location, ESG export reports, API read access, priority kit logistics | Anchored to boutique willingness-to-pay (replaces ~4 hrs/mo of spreadsheet work ≈ $240) |

### 6.2 Supply-side tiers (the revenue engine)

| Tier | Price | Includes | Anchored against |
|---|---|---|---|
| **Exporter** | $499/mo | Up to 40 active lots, COF-001–005 campaign suite, sample-kit fulfillment, UTM attribution, basic analytics | One trade-show booth ($8–15k) ≈ 2 years of subscription |
| **Import House** | $1,499/mo | Unlimited lots, XGBoost predictive lead scoring, churn hazard alerts, A/B/n + Thompson sampling engine, `campaign_execution_logs` audit ledger, 3 seats | One rep's fully-loaded week ≈ $1,900; scoring must lift rep conversion ≥ 20% (measured, contractually reviewable at renewal) |
| **Enterprise Trading Co.** | from $4,000/mo | Dynamic pricing optimizer, GraphQL federation access, custom ESG/logistics scoring, SSO/SCIM, dedicated CSM, SLA 99.9% | Replaces custom internal tooling (≥ $150k build) |

**Transaction layer:** 1.0–1.5% payments/escrow fee on GMV (segment-tiered), logistics attach margin on kit and full-bag freight. Take-rate revenue is reported separately from MRR so the LTV model never confuses margin streams.

### 6.3 Unit economics (24-month discounted, d = 10%, platform revenue view)

Assumptions: platform gross margin 75% on subscription + attach; churn per §2 segments; kit costs inside CAC.

| Segment | Platform rev/mo (sub + attach) | Gross margin $/mo | Monthly churn | 24-mo discounted LTV | CAC target | LTV:CAC | Payback |
|---|---|---|---|---|---|---|---|
| Micro roaster | ~$124 | ~$93 | 4.5% | ≈ $1,220 | $250 | ≈ 4.9:1 | ≈ 2.7 mo |
| Boutique roaster | ~$470 | ~$353 | 3.0% | ≈ $5,420 | $600 | ≈ 9.0:1 | ≈ 1.7 mo |
| Commercial roaster | ~$1,980 | ~$1,485 | 1.5% | ≈ $27,070 | $2,500 | ≈ 10.8:1 | ≈ 1.7 mo |
| Supply side (blended) | ~$1,100 | ~$825 | 2.0% | ≈ $12,900 | $3,000 | ≈ 4.3:1 | ≈ 3.6 mo |

Guardrails: CAC ceiling = LTV ÷ 3 per segment (micro $405 / boutique $1,807 / commercial $9,022 / supply $4,300). Blended demand-side CAC must stay < $500 (base KPI). All campaign files (02–04) inherit these ceilings.

### 6.4 Packaging psychology (behavioral design, ethically bounded)

- **Decoy/anchor:** Import House is the anchor that makes Exporter feel prudent; Enterprise exists to be negotiated down from, not to be the mode.
- **Endowment:** Roaster Pro trials start with 4 sample-kit credits already loaded ("your Q4 kits are reserved") — loss aversion does the rest.
- **Price framing for micros:** $49/mo framed as "less than one 12-oz bag's margin per week."
- **No dark patterns:** free tier is functional forever; cancellation is self-serve; scarcity shown only when bag counts are real (they always are — the DB enforces `available_quantity_lbs`).

---

## 7. Metrics dashboard — definitions (north star + input metrics)

All metrics are computed from the schema (`accounts`, `orders`, `campaign_engagements`, `churn_interventions`, `platform_metrics` hypertable) and rendered per base doc §11.2 widget config.

### 7.1 North star

**Weekly Transacting Roasters (WTR)** — count of distinct `accounts.id` with `segment IN ('micro','boutique','commercial')`, `status='active'`, and ≥ 1 order reaching `status='delivered'` in the trailing 7 days.
Why: it compresses acquisition (new roasters), retention (reorders), and supply health (lots available) into one number; it cannot be gamed by sending more email.

- **Guardrail metrics (must not degrade while WTR grows):** gross margin/lb ≥ $1.30 blended; 90-day reorder rate ≥ 55%; refund/return rate < 2%; NPS > 50.

### 7.2 Input metrics tree (each has an owner and a target)

| Level | Metric | Definition (field-level) | Target | Owner |
|---|---|---|---|---|
| L1 Acquisition | Kit requests / wk | count of sample-kit orders created | +25% MoM signup proxy | Growth |
| L1 Acquisition | Kit delivery SLA | median days kit created → `sample_kit.delivered` event | ≤ 5 days | Ops |
| L2 Activation | Feedback submission rate | kits with `feedback.submitted` ÷ kits delivered | ≥ 45% | Lifecycle (COF-002) |
| L2 Activation | Sample-to-sale | first paid order ÷ kits with feedback submitted | ≥ 40% | Lifecycle (COF-003) |
| L2 Activation | Time feedback→first order | median hours | ≤ 336 h (14 days) | Lifecycle |
| L3 Revenue | First-order rate (30-day) | activated accounts with order ≤ 30 days ÷ activated | ≥ 60% | Growth |
| L3 Revenue | Blended CAC | all demand-gen spend ÷ new paying accounts | ≤ $250 (cap $500) | Growth lead |
| L3 Revenue | ARPU | platform revenue ÷ active accounts | +15% QoQ | Finance |
| L4 Retention | 90-day reorder rate | accounts with ≥ 2nd order ≤ 90 days ÷ first-order cohort | ≥ 55% | Lifecycle |
| L4 Retention | Monthly churn (logo) | `status → 'churned'` ÷ active start-of-month | < 5% (micro), < 3% blended | Lifecycle (file 04) |
| L4 Retention | Save rate | `outcome='retained'` ÷ closed `churn_interventions` | ≥ 35% T3, ≥ 55% T2 | CS (file 04) |
| L5 Referral | K-factor | invites/user × invite→activation rate | ≥ 0.6 by M6 | Growth (file 03) |
| L5 Referral | Share of signups from referral | referral-attributed signups ÷ total | ≥ 20% by M9 | Growth |

### 7.3 Dashboard widgets (extends §11.2 config)

Add to the existing `dashboardConfig.widgets`: (a) `wtr` timeseries w/ 4-week moving average; (b) `kit_funnel` funnel widget — stages `Kit Sent → Delivered → Feedback → First Order` (extends legacy `Kit Sent/Opened/Clicked/Ordered` view); (c) `cac_by_channel` stacked bar w/ ceiling line at $500; (d) `hazard_heatmap` — accounts by churn tier × segment; (e) `k_factor` gauge; (f) `campaign_lift` — per-campaign Bayesian posterior probability vs. control (from `ab_test_results.confidence`, threshold `confidence_threshold = 0.95`).

### 7.4 Measurement discipline

- **Attribution:** last-non-direct + UTM-aware referral override (schema: `campaign_engagements.utm_*`); referral attribution rules in file 03 §5.
- **Experiment cadence:** every campaign change ships behind an `ab_tests` row with `hypothesis`, `primary_metric`, `minimum_sample_size`; decisions follow the Bayesian rules in file 02 §1.3 — no "looks better" ships.
- **Weekly growth review agenda:** WTR delta → input metric that moved → experiment readouts → CAC-by-channel vs. ceilings → hazard-tier queue size. 30 minutes, no narrative decks, only the dashboard.

---

## 8. Operating cadence & RACI (summary)

| Motion | Cadence | Owner | Consulted |
|---|---|---|---|
| COF sequence optimization (file 02) | Weekly experiment review | Lifecycle marketer | Data, Ops |
| Referral program economics (file 03) | Monthly K-factor & fraud review | Growth lead | Finance, Eng |
| Churn triage (file 04) | Daily hazard queue, weekly save-rate review | CS lead | Data |
| Video/content engine (files 05–06) | Monthly content council, quarterly anchor shoot | Content lead | Brand, Growth |
| Pricing/packaging review | Quarterly, with elasticity model readout | Growth lead | Finance, Sales |

**The one rule above all:** every persuasive act in this system must be traceable to a measurable economic outcome consistent with §II of the base doc. If a campaign can't name its metric, its ceiling, and its kill criterion, it doesn't ship.
