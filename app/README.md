# Greensheet Platform — Working Application

A runnable full-stack implementation of the Greensheet expansion-pack specs (`../engineering/*.md`), built with React 19 + TypeScript + Vite + Tailwind + shadcn/ui on the front end, and Hono + tRPC 11 + Drizzle ORM (MySQL) on the back end.

## Feature ↔ Spec Mapping

| Feature (working) | Spec source |
|---|---|
| Catalog: lots, SCA cup-score badges, spot inventory, price changes, retire | `01-domain-model` §4.1, `02-openapi-contract` `/v1/catalog/lots` |
| CRM: roaster accounts, lifecycle stages, LTV/CAC, churn hazard (0.70 threshold), interventions | `01-domain-model` §4.2, `04-database-evolution` |
| Sample kits: state machine (requested→assembling→shipped→delivered→feedback), max 2 active kits, lot snapshots locked at assembly | `01-domain-model` §4.4 |
| Campaigns: COF-001…005 rule engine, arm/disarm, per-send dispatch ledger | `01-domain-model` §4.3, `../marketing/02-cof-campaign-expansion.md` |
| Orders: idempotent `CreateOrder`, atomic reservation, saga compensation on cancel (reservation released), LTV recalculation on delivery, revenue-share accrual on delivery | `01-domain-model` §4.5 |
| Domain event outbox: every mutation emits its canonical event (`sample_kit.delivered`, `feedback.submitted`, `order.created`, …) into a queryable log | `01-domain-model` §6, `03-event-driven-pipeline` |
| Analytics dashboard: KPIs, revenue time series, dispatch-by-channel donut, lot performance, cup-score distribution, exception tiers, campaign funnel, churn watchlist, live event stream | `01-domain-model` §4.6 |
| Warehouse: exception runbooks (seal/weight/moisture classifiers), tiers 1–3 with SLAs (48h/5bd/10bd), hard hold on Tier ≥ 2, four dispositions, daily report | `../engineering/warehouse-runbooks-seal-weight-exceptions.md` |
| QC Lab: retained samples (middle-bag pull, tamper-evident seal, access log, >5-open compromise flag, dual-witness destruction, active-exception block), SCA 10-attribute cupping with tolerance bands, red flags → Tier-3 escalation, 3-cupper panel enforcement | `../engineering/cupping-standards-sop.md`, `retained-sample-procedures.md` |
| Partners: Revenue Share White-Glove agreement — floor payment on Tier-1 verification (never clawed back), revenue share by cup-quality tier (50/35/20/10/0%), $0.30/lb documented costs, True Price Receipts, collector pass-through ≥80%, partner tiers A/B/C floor SLAs | `../engineering/Revenue_Share_White_Glove_Farmer_Collector_Agreement.docx` |
| Comms: email via SMTP when configured (honest "queued" ledger entry otherwise), WhatsApp via wa.me deep links with pre-filled templates, full dispatch ledger | `../marketing/02-cof-campaign-expansion.md` |
| COF-004: pricing-link click (`campaigns.link_clicked`, `clickedPricingPage: true`) → Touch-3 volume-discount email + queued WhatsApp, suppressed when nurture halted | `../marketing/02-cof-campaign-expansion.md` |
| Education: SOP library (warehouse runbooks, cupping standards, retained samples, partnership agreement, marketing playbook) with training acknowledgments | `../engineering/*sop*.md` |
| Growth: "Give a Kit, Get a Bag" referral engine (signed_up → kit_sent → rewarded), POS-01…04 marketing calendar (4-week rollout), pricing-click telemetry | `../marketing/greensheet_social_series.md` |
| Teasers: Flavor Foundry (13 process families / 110 processes × 14 sensory families, HOUSE/SEMI/DE NOVO tiers) + Lotspace coming-soon pages with deduplicated waitlists | `../marketing/flavor-foundry-menu.md` |
| Invoices: single payable aggregate (order or contract), VAT in basis points, gapless per-year numbering, VietQR memo token, void / write-off, per-invoice payment history with reversals | `VietnamPaymentCoffeeManagerSprintv2` §3.7, §5.1 |
| Payments & AR: aging buckets computed in Asia/Ho_Chi_Minh (never stored), AR summary with a suspense line, exception queue for unmatched / ambiguous / unverified / residual money, manual allocation and reversal, on-demand reconciliation | `…Sprintv2` §3.11, §7.4, §8.2, §13.3 |
| VietQR settlement: PayOS (HMAC-signed, credits directly) and Casso (untrusted notification, requires an API re-fetch before it can move money), matching on memo token → order code → flagged single-account heuristic, never on amount alone | `…Sprintv2` §7, ADR-03 |
| Transactional outbox: claim-based dispatch with `FOR UPDATE SKIP LOCKED`, exponential backoff, dead-letter after six attempts; rule evaluation moved out of `emitEvent` behind a cutover flag | `…Sprintv2` §4 |
| Document intake: sha256 dedupe, per-field confidence gating by criticality — a cup score is always human-confirmed regardless of confidence — and `qc.proposeCuppingFromDocument`, which creates a draft and never an approved record | `…Sprintv2` §6, ADR-04 |
| E-wallets: MoMo and ZaloPay charges and signed callbacks, normalised onto the same transaction shape as the bank rails so the matcher and settlement path stay rail-agnostic. MoMo signs a fixed field list including a key it never sends; ZaloPay MACs the raw `data` string as received | `Auctum Ledger Vietnam Payment Integration` §2.2 |
| Multi-currency: append-only rate history with source and observation time, realized gain/loss posted inside the allocation transaction against the contract's locked rate — the rate must be captured then or the difference is unrecoverable later | `…Integration` §3.3 |
| Automated dunning: day 0/3/7/14 ladder held as data, plan/send separated so an operator sees who would be contacted before anyone is, idempotent on `(invoiceId, stepId)`, per-channel conversion reporting | `…Integration` §3.4 |
| Vietnamese e-invoice (TT 78/2021): payload validation (MST format, VND-only, subtotal + VAT = total, defined VAT rates), pluggable authorised-provider adapters, authority invoice number stored separately from ours, issuance one-way by construction | `…Integration` §3.5 |
| Recurring B2B standing orders: weekly/biweekly/monthly cadences with monthly anchors clamped to 28, cycle claimed before the invoice is issued so a re-run cannot double-bill, consent modelled as data (`autoChargeBlockers`) rather than as contract prose | `…Integration` §3.6 |
| Traceability tied to payment: allocation → invoice → contract → lots → partner, reporting `traceable: false` rather than throwing when an invoice is order-backed | `…Integration` §3.8 |
| Runtime feature flags served from the API (`ocrUpload`, `vietqrPayments`, `autoAllocation`, `outboxConsumer`, `eWalletPayments`, `dunning`, `eInvoice`, `standingOrders`, `autoCharge`); `autoAllocation` and `autoCharge` are kill switches that take effect in under a minute with no deploy | `…Sprintv2` ADR-05 |

## Canonical conventions preserved

- Money is integer cents at rest (`*_cents`), dollars only at the presentation boundary, on the pre-existing catalog/orders surfaces.
- **New money paths use ISO 4217 minor units as `bigint`, always paired with a currency column** (`*Minor` + `currency`). A signed `int` caps at ₫2.15bn, which one container contract exceeds. The exponent is derived from the currency, never assumed: VND → 0, USD → 2. Use `formatMinor`/`parseMinor`/`addMoney` from `contracts/money.ts`; `addMoney` throws on a currency mismatch, and raw `+` on money is a review failure.
- Cup score is a financial input, not a quality note: it sets the Revenue Share tier, so every tier comparison goes through `roundScore()` before comparing.
- Event strings are byte-identical to the marketing schema contract (`sample_kit.delivered`, `feedback.submitted`).
- Automation actions: `SEND_EMAIL`, `SEND_SMS`, `UPDATE_CRM_LIFECYCLE`, `EXECUTE_CAMPAIGN_HALT`.
- Merge tags rendered by the rule engine: `{roaster_name}`, `{origin}`, `{varietal}`, `{process_method}`, `{sca_cup_score}`, `{price_per_lb}`. The dunning ladder uses the same convention (`{counterparty_name}`, `{invoice_number}`, `{outstanding}`, `{due_date}`, `{days_overdue}`, `{memo_token}`) and a test asserts every seeded template only uses tags the renderer supplies.
- Economics: blended CAC $378 (referral CAC $196 via `GIVEKIT-`), churn hazard threshold 0.70.
- Error model: `GS-CAT-1001 InsufficientInventory`, `GS-SMP-1001/1003/1004/1005`, `GS-ORD-1001`, `GS-PAY-*`, `GS-FX-*`, `GS-DUN-*`, `GS-EIN-*`, `GS-SUB-*`.
- **Trust is a property of the rail, not of the payload** (`contracts/providers.ts`). PayOS, MoMo and ZaloPay sign what they send, so a verified callback may credit AR. Casso proves only that the caller knows a shared secret, so it requires an API re-fetch stamping `verifiedAt` before allocation. Adding a rail is a row in `PROVIDER_SPECS`, not a parallel pipeline.

## Run

```bash
npm install
npm run db:push               # sync schema (requires DATABASE_URL in .env)
npm run db:seed               # 8 lots, 5 roasters, campaign cof-nurture-2025 + COF-001…005
npm run db:seed:expansion     # SOP library, partners + addenda, marketing calendar, COF-004
npm run dev                   # http://localhost:3000
```

Optional env for live email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_SECURE`, `SMTP_FROM`. Without it, sends are honestly recorded as `queued`
in the dispatch ledger. WhatsApp uses wa.me deep links (no Business API needed).

## Verified flows (e2e)

1. Request kit → deliver → **COF-001** Touch-1 email dispatched with rendered tokens.
2. Feedback rating 5 → **COF-002** pricing-sheet email (per-lot snapshot pricing).
3. Feedback rating 2 → **COF-003** lifecycle → `needs_attention`, churn risk ≥ 0.72, consultative SMS, sales-call intervention opened.
4. First order → inventory reserved atomically → **COF-005** nurture halted + conversion recorded.
5. Re-submitting `CreateOrder` with the same idempotency key returns the original order (no double charge).
6. Cancel releases the reservation back to the lot (`catalog.reservation_released`).
7. Delivery recalculates discounted LTV and writes back to the roaster record.
8. Seal-broken receiving check → Tier 3 exception, hard hold, 10bd SLA → resolved Reject & Claim (carrier at fault).
9. Retained sample pull → access log → dual-witness destruction guard (GS-QC-1003) and active-exception block (GS-QC-1004).
10. Red-flag cupping → verdict `red_flag` + automatic Tier-3 escalation event; single-cupper Tier 2 session rejected (GS-QC-1005).
11. Addendum verification → floor payment accrued with True Price Receipt; double accrual rejected (GS-PRT-1002).
12. Order delivered on an addendum-linked lot → revenue share auto-accrued (net = sale − floor − $0.30/lb costs, tier % by cup score).
13. Pricing-link click → **COF-004** Touch-3 email + queued WhatsApp (suppressed for nurture-halted accounts).
14. Waitlist signup deduplication per product+email; referral advanced signed_up → kit_sent → rewarded.

### Payment & receivables flows

15. Issue an invoice → a ten-character memo token is minted from the invoice id with a check character → the token appears on the invoice, in the VietQR `addInfo` field, and on the payment screen with a copy button.
16. A transfer whose memo carries the token is matched exactly; a transfer with two tokens, or with an amount that fits two invoices equally, is `ambiguous` and waits for a person. Nothing is ever matched on amount alone.
17. A transfer of 90% of the total sets `partially_paid` and the remainder keeps aging from the original due date; a transfer of 110% settles the invoice and leaves the excess unallocated and visible in the exception queue.
18. The same PayOS payload delivered ten times produces one `provider_transactions` row: the `(provider, providerTxnId)` unique index is the idempotency guarantee, and a duplicate returns 200 with no side effects.
19. A Casso callback with a valid `secure-token` but a failing API re-fetch leaves `paidMinor` unchanged and raises an exception-queue entry — possession of the shared secret is not authenticity (ADR-03).
20. `intents.create` with the same key and body replays the recorded response; the same key with a different body returns `GS-PAY-1001 IdempotencyKeyReuse` rather than the wrong answer.
21. Reversing an allocation recomputes `paidMinor` from the surviving rows, returns the transfer to the exception queue, and leaves both the allocation and its reason visible in the invoice history.
22. Reconciliation asserts `paidMinor` equals the sum of live allocations for every invoice, and reports rather than repairs.

See `docs/payments-runbook.md` for deployment order, flag rollout, alert thresholds and the operator playbooks.

*An ODASI Technologies product — Navigate Your Reality. Own Your Journey.*
