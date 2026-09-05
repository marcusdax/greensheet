# Auctum Ledger — Working Application

A runnable full-stack implementation of the Greensheet expansion-pack specs (`../engineering/*.md`), built with React 19 + TypeScript + Vite + Tailwind + shadcn/ui on the front end, and Hono + tRPC 11 + Drizzle ORM (MySQL) on the back end.

Greensheet is the platform the specs were written against; Auctum Ledger is what
it ships as. The database, event strings and error codes keep the original
names — renaming them would have been a migration, not a rebrand — so both
appear throughout and `GS-` error prefixes are expected.

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
| Education: SOP library plus the cupping curriculum as data — four tiers with distinct authority scopes, the §1.2 four-phase training programme with its own pass thresholds, annual recertification, and a §1.3 variance dashboard. A cup score sets the Revenue Share tier and therefore a farmer's payment, so **the QC screen refuses a session from an uncertified, lapsed or suspended cupper** rather than counting heads | `cuppingstandardssop.md` §1, §4.4, §6 |
| Partners: exception dispositions with the money attached — the four §B.1 outcomes, §B.2 fault attribution that defaults to the supplier when no proof is filed, the §C.1 downgrade formula with its 50% floor and the §C.2 claim with its 110% ceiling, §D.4 limitation windows, and §9's protections running the other way (non-retaliation, and the missed-SLA release that lets a partner sell elsewhere) | `supplieragreementclauses.md` §B–§E, `Revenue_Share…` §9–§10 |
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
| Trust Score: a 0–100 honesty signal on every counterparty, roaster and lot, derived **only** from evidence — accepted OCR documents, settled invoices, cuppings that agreed with the claim. Five weighted components, five policy bands, versioned weights, an append-only evidence trail, and a settlement gate that always says why | `Trust Score & OCR UI Specification` §2, §3, §7 |
| OCR as the evidence engine: an accepted document moves Document Verification; a document nobody accepts moves nothing; re-accepting the same one moves nothing twice (unique index, not a check-then-insert); a lab report cupping >1.5 points below the claim is a negative signal against the lot **and** the supplier who claimed it | `…Specification` §3, §6 |
| Museum Folio scanner UI: token-only Trust badge and panel, mobile camera capture, side-by-side review pane with confidence badges, low-confidence fields focused in sequence, and financial fields that stay unacceptable until a person touches them (ADR-04) | `…Specification` §5 |
| Runtime feature flags served from the API (`ocrUpload`, `vietqrPayments`, `autoAllocation`, `outboxConsumer`, `eWalletPayments`, `dunning`, `eInvoice`, `standingOrders`, `autoCharge`, `trustScore`, `trustGates`); `autoAllocation`, `autoCharge` and `trustGates` are kill switches that take effect in under a minute with no deploy | `…Sprintv2` ADR-05 |

## Canonical conventions preserved

- Money is integer cents at rest (`*_cents`), dollars only at the presentation boundary, on the pre-existing catalog/orders surfaces.
- **New money paths use ISO 4217 minor units as `bigint`, always paired with a currency column** (`*Minor` + `currency`). A signed `int` caps at ₫2.15bn, which one container contract exceeds. The exponent is derived from the currency, never assumed: VND → 0, USD → 2. Use `formatMinor`/`parseMinor`/`addMoney` from `contracts/money.ts`; `addMoney` throws on a currency mismatch, and raw `+` on money is a review failure.
- Cup score is a financial input, not a quality note: it sets the Revenue Share tier, so every tier comparison goes through `roundScore()` before comparing.
- Event strings are byte-identical to the marketing schema contract (`sample_kit.delivered`, `feedback.submitted`).
- Automation actions: `SEND_EMAIL`, `SEND_SMS`, `UPDATE_CRM_LIFECYCLE`, `EXECUTE_CAMPAIGN_HALT`.
- Merge tags rendered by the rule engine: `{roaster_name}`, `{origin}`, `{varietal}`, `{process_method}`, `{sca_cup_score}`, `{price_per_lb}`. The dunning ladder uses the same convention (`{counterparty_name}`, `{invoice_number}`, `{outstanding}`, `{due_date}`, `{days_overdue}`, `{memo_token}`) and a test asserts every seeded template only uses tags the renderer supplies.
- Economics: blended CAC $378 (referral CAC $196 via `GIVEKIT-`), churn hazard threshold 0.70.
- Error model: `GS-CAT-1001 InsufficientInventory`, `GS-SMP-1001/1003/1004/1005`, `GS-ORD-1001`, `GS-PAY-*`, `GS-FX-*`, `GS-DUN-*`, `GS-EIN-*`, `GS-SUB-*`.
- **A cupping authority is a financial control, not training admin.** `contracts/cupping-authority.ts` holds the §1.1 tier matrix, and the authorities are separate booleans rather than one ordered level — a Tier 3 may sit on a panel but never cup alone, while a Tier 2 may cup alone yet is barred from arbitration, and collapsing that into a number loses exactly the distinction that matters. Disqualification drops a cupper to *no* authority rather than down a tier: §1.3's triggers are about integrity and sensory acuity, and neither is repaired by demotion.
- **A Trust score is derived, never set.** There is no `setScore` procedure. The only ways to move one are to record a fact (an accepted document, a settled invoice, a verified identity) or to file an audited `admin_override` evidence row carrying a user id and a mandatory reason. Weights live in `contracts/trust.ts` with a `MODEL_VERSION` stamped onto every snapshot, so changing them is a recomputation rather than a data migration and a historical trend line still renders as it did.
- **Museum Folio tokens are the only colours allowed** on Trust and Scanner surfaces (`ink`, `paper`, `brass`, `sage`, `oxblood`, `neutral`, `danger`, defined in `src/index.css` and registered in `tailwind.config.js`). `src/design-tokens.test.ts` fails the build on a raw hex or a Tailwind arbitrary value in those files, and asserts every token has a dark-mode value — one defined only in `:root` paints transparent in dark mode, which is a badge with no background at all.
- **Trust is a property of the rail, not of the payload** (`contracts/providers.ts`). PayOS, MoMo and ZaloPay sign what they send, so a verified callback may credit AR. Casso proves only that the caller knows a shared secret, so it requires an API re-fetch stamping `verifiedAt` before allocation. Adding a rail is a row in `PROVIDER_SPECS`, not a parallel pipeline.

## Run

```bash
npm install
npm run db:push               # sync schema (requires DATABASE_URL in .env)
npm run db:seed               # 8 lots, 5 roasters, campaign cof-nurture-2025 + COF-001…005
npm run db:seed:expansion     # SOP library, partners + addenda, marketing calendar, COF-004
npm run db:seed:auth          # login accounts, one per role
npm run db:seed:payments      # counterparties, invoices across every aging bucket, sample transfers
npm run db:seed:dunning       # the day 0/3/7/14 ladder and two reference FX rates
npm run db:seed:education     # cupping curriculum and a starting cupper roster
npm run db:seed:demo          # settled payments, warehouse exceptions, a closed
                              # downgrade, a served claim and waitlist signups
npm run dev                   # http://localhost:3000
```

The first six seeds establish reference data. `db:seed:demo` adds the *history*
none of them produce — without it the AR aging, exception-queue, disposition
and claim screens correctly render their empty states, which demonstrates
nothing. It routes money through the allocation service rather than inserting
allocation rows, so `payments.ar.reconcile` still passes afterwards, and it
takes its disposition and claim figures from `contracts/dispositions.ts` rather
than hard-coding plausible totals.

`db:push` is for a fresh database. An **existing** one takes the hand-written
expand migrations in order — `db/migrations/manual/0001_expand_existing.sql`,
`0002_wallet_fx_dunning_einvoice.sql`, `0003_trust_score.sql`,
`0004_education_partners.sql`, `0005_pilot_allowlist.sql` — and the first of
those begins with a `SELECT` that must return zero rows before you continue.
See `docs/payments-runbook.md` §2.

### Checks

```bash
npm run check                 # tsc -b across app, node and server projects
npm run test                  # vitest — unit, property (§11.1), provider contract (§11.3)
npm run build                 # vite + esbuild
npm run lint                  # eslint
npm run test:integration      # §11.2, needs INTEGRATION_DATABASE_URL (see below)
```

`npm run check` is the real typecheck. `tsc -p tsconfig.json` silently passes
because that file is a solution file with `"files": []`, and `npm run build`
uses esbuild, which strips types without checking them — so neither one will
tell you about a type error.

These now run in CI (`.github/workflows/ci.yml`) on every push and pull
request, alongside a second workflow that scans each diff for provider key
shapes (§12.4). Run them locally anyway: CI tells you after the push.

#### The integration tier

`npm run test:integration` runs `api/integration/**` against a **real MySQL** —
the assertions that a mock cannot make: 20 concurrent duplicate intent creates
producing exactly one row, the same webhook delivered five times crediting
once, a Casso callback whose API re-fetch fails allocating nothing, and
`ar.reconcile` staying clean once allocations actually exist.

It TRUNCATEs tables, so it refuses to run unless `INTEGRATION_DATABASE_URL`
names a throwaway schema — `DATABASE_URL` is deliberately *not* accepted as a
fallback, and the default `npm run test` excludes these files entirely:

```bash
mysql -e "CREATE DATABASE auctum_test"
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/auctum_test npx drizzle-kit push --force
INTEGRATION_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/auctum_test npm run test:integration
```

### Everything new ships off

Twelve runtime flags, all defaulting to false and failing closed
(`contracts/flags.ts`). Nothing below changes behaviour until a `platform_admin`
turns it on, and each one takes effect in under a minute with no deploy:

| Flag | Turns on |
|---|---|
| `ocrUpload` | Document intake and the OCR proposal pipeline |
| `vietqrPayments` | VietQR intents, QR rendering, PayOS/Casso webhooks |
| `autoAllocation` | Allocating a matched transfer without a human click |
| `eWalletPayments` | MoMo and ZaloPay charges and callbacks |
| `dunning` | The overdue ladder actually sending |
| `eInvoice` | Submission to an authorised e-invoice provider |
| `standingOrders` | Recurring invoice generation |
| `autoCharge` | Charging a saved token without the payer present |
| `trustScore` | Recording Trust evidence, badges and panels |
| `trustGates` | Letting a low Trust score hold an automatic settlement |
| `outboxConsumer` | Dispatching events from the consumer instead of inline |

Local-dev overrides (ignored in production) are `FLAG_<SCREAMING_SNAKE>=1`.

### Environment

Optional env for live email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_SECURE`, `SMTP_FROM`. Without it, sends are honestly recorded as `queued`
in the dispatch ledger. WhatsApp uses wa.me deep links (no Business API needed).

Payment, e-invoice and FX credentials come from the secret manager and are
deliberately not `required()`: a missing key disables that one rail rather than
refusing to boot the platform. `APP_BASE_URL` must be set wherever the e-wallets
are enabled — MoMo and ZaloPay refuse a localhost callback in production. Full
table in `docs/payments-runbook.md` §3.

**Two things are not ready for real data.** The KMS adapter for
`bankAccountNumberEnc` and `payment_methods.tokenEnc` is not wired, so do not
store a real bank account number or recurring token yet — only
`bankAccountLast4` — and keep `autoCharge` off. And the e-invoice mock adapter
issues `MOCK-` numbers that are **not** legal documents; real issuance needs
`EINVOICE_PROVIDER` pointed at an authorised provider.

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

### E-wallet, FX, dunning, e-invoice and subscription flows

23. A MoMo callback signed over its fixed field list is accepted; the same body with the amount edited is refused. The signed material includes `accessKey`, which the callback never sends, and excludes `signature`, which it always does — deriving the field list from the received body produces a wrong MAC.
24. A ZaloPay callback is MACed over the **raw `data` string as received**; parsing it and re-serialising reorders the keys and fails verification. Both wallets dedupe on the provider's own transaction id (`transId`, `zp_trans_id`), never on the order id we generated, because a retried order reuses ours.
25. A USD payment allocated against a VND invoice posts the realized difference against the contract's locked rate inside the same transaction as the allocation. With no locked rate, nothing is realized — booking against a rate we never promised would invent income.
26. Running the dunning sweep twice on the same day records duplicates rather than contacting anyone twice (`dunning_runs` is unique on `(invoiceId, stepId)`), and a missed day catches up rather than skipping, because every step *reached* is sent.
27. An issued invoice submits to the e-invoice provider from the outbox; a provider rejection is recorded on the submission row and surfaced in `invoices.einvoice.pending` rather than retried, because retrying a payload the authority already refused never succeeds. The authority's invoice number never overwrites ours.
28. Generating standing-order invoices twice cannot bill a café twice: the cycle row is claimed *before* the invoice is issued and is unique on `(standingOrderId, periodStart)`. A monthly anchor of 31 is refused at creation — it has no February successor and the subscription would silently stop billing.

### Trust Score flows

29. Upload → a human accepts the extraction → Document Verification rises and a `trust.evidence_recorded` event fires. Accepting the **same** document again changes nothing: the unique index on `(entityType, entityId, kind, sourceType, sourceId)` absorbs it, and with no new evidence there is nothing to recompute.
30. A document nobody accepts moves nothing at all. A blurry photo is a bad camera, not dishonesty, so there is no negative signal for uploading one.
31. An accepted lab report cupping more than 1.5 points below a lot's claimed score writes a negative `quality_contradicted` row against **both** the lot and the supplier who made the claim. Cupping *higher* than claimed is not penalised.
32. Eight at-risk accounts rating each other 95 do not manufacture a Verified band. Confidence comes from the summed rater weight, not the count — in a plain weighted average the rater weighting cancels out entirely when every rater carries the same weight.
33. Every score lands in exactly one band across the whole 0–100 range, with no gap at an edge, after rounding to one decimal — so a counterparty never sits one band below the figure on their own screen.
34. `settlementGate` returns its reason on every call, including when it allows. It holds the automatic allocation path only: a human clicking allocate in the exception queue is the review the gate exists to force.
### Education & Partners flows

36. A cupper with 64 of the required 100 supervised cups is refused independent cupping — and still accepted onto a panel, because §1.2 requires those cups be performed *under a Q-Grader*, which is panel work. Treating an unmet cup count as total disqualification would bar a trainee from the only activity that lets them finish training.
37. Three Tier 3 baristas satisfy the §4.4 head-count for a Tier 2 exception and are still refused: §6.2 requires a Q-Grader in good standing, and counting heads was never the point.
38. A name with no cupper profile is refused rather than waved through. §1.1's Tier 0 exists so that "not on the list" has a defined answer.
39. Signing off an SOP records the authenticated user, never a typed name, and a second sign-off on the same version is a no-op — re-reading is good practice, not a second attestation.
40. A downgrade priced below half the original price is held at the 50% floor (§C.1); a claim inflated by holding costs is held at 110% of the purchase price with holding charged for at most 30 days (§C.2). Both caps report themselves in the returned explanation.
41. A logistics fault with no proof filed resolves to the supplier — §B.2 puts the burden of proof on them, and the claimed and resolved origins are both stored so the gap is auditable.
42. A fraud claim survives to day 365 and is forfeited at 366, while a standard claim closes at 60 days and a latent defect at 90 (§D.4).
43. A floor payment more than five business days past its tier SLA triggers §9.1's release — computed from our own timestamps rather than waiting for the partner to claim it.
44. `src/design-tokens.test.ts` fails on a raw hex or a Tailwind arbitrary value in any Trust or Scanner component, and on any Museum Folio token missing a dark-mode value.

See `docs/payments-runbook.md` for deployment order, flag rollout, alert thresholds and the operator playbooks.

*An ODASI Technologies product — Navigate Your Reality. Own Your Journey.*
