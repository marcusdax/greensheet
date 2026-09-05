# Vietnam Payment & Coffee Business Manager — operations runbook

Companion to `VietnamPaymentCoffeeManagerSprintv2`. Everything here is a thing
someone has to *do* — the reasoning lives in the spec and in the code comments.

---

## 1. What was built, by slice

| Slice | Delivers | Flag |
|---|---|---|
| 0 | Money primitives, outbox, runtime flags | `outboxConsumer` |
| 1 | Invoices, allocations, aging, exception queue, manual payment recording | none — always on |
| 2 | PayOS + Casso webhooks, matching engine, auto-allocation | `vietqrPayments`, `autoAllocation` |
| 3 | Document intake, OCR proposal, per-field confidence gating | `ocrUpload` |
| C | MoMo + ZaloPay charges and callbacks | `eWalletPayments` |
| E | Multi-currency FX, dunning ladder, e-invoice, standing orders, provenance | `dunning`, `eInvoice`, `standingOrders`, `autoCharge` |
| Trust | Trust Score honesty layer, OCR evidence pipeline, Museum Folio scanner UI | `trustScore`, `trustGates` |
| Education & Partners | Cupper qualification and curriculum (SOP §1); exception dispositions, claims and §9 protections | `cupperAuthority` |

Slice 1 works with **no provider integration at all**. An operator can read a
bank statement, record each transfer through `payments.transactions.recordManual`,
allocate it, and run Vietnamese receivables correctly inside the product. That is
the fallback whenever a provider is down, and it is also the training path.

---

## 2. Deployment order

### Fresh environment

```bash
npm run db:push            # or apply db/migrations/0000_vietnam_payment_manager.sql
npm run db:seed            # existing catalog / CRM / campaign seed
npm run db:seed:expansion
npm run db:seed:auth
npm run db:seed:payments   # counterparties, invoices across every aging bucket, sample transfers
npm run db:seed:dunning    # the day 0/3/7/14 ladder and two reference FX rates
npm run db:seed:education  # cupping curriculum, wider tracks, and a starting cupper roster
```

### Existing database

The generated `0000_…sql` is a from-scratch baseline; it will not apply to a
database that already has `coffee_lots` and `domain_events`. Use the hand-written
pair instead:

1. Run `db/migrations/manual/0001_expand_existing.sql`.
   **It begins with a `SELECT` that lists any `domain_events.payload` that is not
   valid JSON. If that returns rows, stop.** §3.13 is explicit: do not coerce.
   Fix or quarantine those rows, then re-run.
2. Deploy the application with every payment flag **off**.
3. Run `db/migrations/manual/0002_wallet_fx_dunning_einvoice.sql` for the
   Phase C/E tables. It is expand-only: the two `ALTER`s at the end only *add*
   values to the provider enum, so `payos` and `casso` keep their positions and
   no stored row changes meaning. Then
   `db/migrations/manual/0003_trust_score.sql` and
   `db/migrations/manual/0004_education_partners.sql`, both purely additive.
4. `npm run db:push` to create anything still missing (a no-op for existing
   tables), then `npm run db:seed:dunning`.
5. Turn flags on one at a time — see §4 below.

Rollback: `…/0004_education_partners.down.sql`, then `…/0003_trust_score.down.sql`, then
`…/0002_wallet_fx_dunning_einvoice.down.sql`, then
`…/0001_expand_existing.down.sql`, but read their headers first — 0002 drops
`fx_adjustments`, `einvoice_submissions` and `dunning_runs`, none of which can
be reconstructed. Feature flags are the first line of rollback; migrations are the
last. Drain the outbox to zero unprocessed rows before running the down.

---

## 3. Environment variables

Provided by the secret manager, never from a committed `.env` outside local dev
(§12.4).

| Variable | Purpose | Missing behaviour |
|---|---|---|
| `PAYOS_CHECKSUM_KEY` | HMAC key for webhook signature verification | `/webhooks/payos` returns 401 for everything |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY` | PayOS merchant API | intent creation still works; QR is built locally |
| `CASSO_WEBHOOK_SECRET` | The `secure-token` header value | `/webhooks/casso` returns 401 |
| `CASSO_API_KEY` | Re-fetch endpoint (ADR-03) | Casso transactions never verify, so they never allocate |
| `MERCHANT_BANK_BIN` | NAPAS BIN, six digits | no QR is generated; the screen falls back to manual transfer details |
| `MERCHANT_ACCOUNT_NUMBER`, `MERCHANT_BANK_NAME`, `MERCHANT_NAME` | Beneficiary shown on the payment screen | as above |
| `APP_BASE_URL` | Our public origin, for wallet redirect and callback URLs | wallets get a localhost callback and refuse the charge in production |
| `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` | MoMo merchant credentials and IPN signing | `payments.wallets.charge` refuses MoMo; `/webhooks/momo` returns 401 |
| `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2` | key1 signs the create request, key2 verifies the callback | as above for ZaloPay |
| `FX_RATE_API_URL`, `FX_RATE_API_KEY` | Rate feed for §3.3 | `payments.fx.refresh` returns null; operators quote rates by hand |
| `EINVOICE_PROVIDER`, `EINVOICE_API_URL`, `EINVOICE_API_KEY` | Authorised e-invoice provider (`vnpt`/`misa`/`viettel`/`mock`) | falls back to the mock adapter, which issues `MOCK-` numbers that are **not** legal documents |
| `EINVOICE_TEMPLATE_CODE`, `EINVOICE_SERIES`, `SELLER_TAX_CODE` | Registered template, series and our own MST | submission is rejected by `validatePayload` before it leaves the building |

Local-dev flag overrides (ignored in production): `FLAG_VIETQR_PAYMENTS=1`,
`FLAG_AUTO_ALLOCATION=1`, `FLAG_OCR_UPLOAD=1`, `FLAG_OUTBOX_CONSUMER=1`,
`FLAG_E_WALLET_PAYMENTS=1`, `FLAG_DUNNING=1`, `FLAG_E_INVOICE=1`,
`FLAG_STANDING_ORDERS=1`, `FLAG_AUTO_CHARGE=1`, `FLAG_TRUST_SCORE=1`,
`FLAG_TRUST_GATES=1`, `FLAG_CUPPER_AUTHORITY=1`.

---

## 4. Turning it on

### 4.1 The outbox cutover

`emitEvent` writes to the outbox either way. While `outboxConsumer` is **off**,
rule evaluation still runs inline exactly as it did before, so the fourteen
verified flows in `README.md` behave identically. Turning it **on** moves
dispatch to the consumer.

Before flipping it:

- confirm the consumer process is running (it starts with the server in
  production);
- check `SELECT COUNT(*) FROM domain_events WHERE processed = 0` — it should be
  0 or small;
- flip the flag, then watch outbox lag (§5) for ten minutes.

If dispatch misbehaves, flip it back. The inline path resumes immediately and no
event is lost — events written while the consumer was authoritative stay
unprocessed and will dispatch when it is turned on again.

### 4.2 Settlement

Ship Slice 2 with `vietqrPayments: true` and `autoAllocation: false`, restricted
to two pilot counterparties (§13.4). Every matched transfer then waits for a
human click in the exception queue.

**Register the webhook URL with PayOS.** A forgotten registration is silent
non-delivery in production — nothing errors, money simply never arrives in the
product. Point it at `POST https://<host>/webhooks/payos`. The endpoint answers a
registration probe (a body with no `data`) with 200 so the handshake completes.

For Casso, additionally restrict `/webhooks/casso` by source IP where the
provider publishes a range, and rotate `CASSO_WEBHOOK_SECRET` quarterly.

Graduate to `autoAllocation: true` only after **14 consecutive days with zero
reconciliation failures and zero manual reversals**.

### 4.3 E-wallets (`eWalletPayments`)

Register the callback URLs with each provider before flipping the flag —
`POST https://<host>/webhooks/momo` and `POST https://<host>/webhooks/zalopay`.
Both verify a signature over the payload, so they sit on the same footing as
PayOS: a verified callback may credit AR directly (ADR-03).

Two details that break naive integrations and are already handled — leave them
alone unless the provider docs change (R6):

- **MoMo** signs a *fixed* field list that includes `accessKey` (never sent in
  the callback) and excludes `signature`. It is not the sorted-key scheme PayOS
  uses. Dedup is on `transId`, not `orderId`: a retried order reuses `orderId`.
- **ZaloPay** MACs the **raw `data` string as received**. Parsing it and
  re-serialising reorders the keys and produces a wrong MAC. Dedup is on
  `zp_trans_id`.

Both wallets settle in VND only; `payments.wallets.charge` refuses anything else
rather than letting the provider silently reinterpret the amount.

### 4.4 Dunning (`dunning`)

Seed the ladder first: `npm run db:seed:dunning` installs the day 0/3/7/14
policy. Then run **`payments.dunning.plan` and read it** before flipping the
flag — it is a dry run showing exactly who would be contacted and with what.

The sweep is idempotent: `dunning_runs` is unique on `(invoiceId, stepId)`, so
re-running it records duplicates rather than contacting anyone twice. A missed
day catches up rather than skipping — every step *reached* is sent.

Templates use the `{merge_tag}` convention, and a test asserts that the seeded
ladder only uses tags `tokensFor` actually supplies. A tag nobody populates
renders literally into a customer's inbox; nothing else would catch it.

### 4.5 E-invoice (`eInvoice`)

**The mock adapter is not a legal document.** It issues `MOCK-` numbers so the
flow can be exercised end to end; issuing real e-invoices requires
`EINVOICE_PROVIDER` set to an authorised provider with live credentials.

Issuance is one-way. A wrongly issued e-invoice is corrected by issuing an
adjustment through the provider, never by editing ours — there is no update path
in the router, deliberately. The authority's number lives on the submission row
and never overwrites `invoices.invoiceNumber`.

Once the flag is on, `invoice.issued` events submit automatically through the
outbox handler. A provider rejection is recorded on the submission row and not
retried: it almost always means the payload is wrong, and retrying a wrong
payload just annoys the authority. `invoices.einvoice.pending` is the live gap
report.

### 4.6 Standing orders (`standingOrders`) and auto-charge (`autoCharge`)

`standingOrders` lets the generator issue invoices on a cadence. `autoCharge` is
a separate kill switch for charging a saved token **without the payer present** —
keep it off until the token vault is real. `autoChargeBlockers` enforces the
preconditions (active method, recorded consent, unrevoked, unexpired token) and
returns every reason at once rather than the first.

Monthly anchors are clamped to 28. An anchor of 31 has no February successor and
the subscription would silently stop billing.

### 4.7 Trust Score (`trustScore`, `trustGates`)

Two switches, deliberately. `trustScore` starts recording evidence and shows
badges and panels. `trustGates` is what lets a low score actually **hold an
automatic settlement** (§7). Scoring is safe to observe long before it is safe
to enforce, so turn the first on, watch for a fortnight, and only then consider
the second.

There is **no backfill**, and that is the point. Scores are derived from
evidence, and there is no evidence for anything that happened before the
migration. A counterparty with ten years of clean settlements starts at neutral
(50) and earns upward from the next accepted document. Inventing evidence rows
for past events would defeat the audit trail the whole model rests on — if you
want history to count, record it as `admin_override` rows with a reason, which
is auditable and honestly labelled.

Before turning `trustGates` on, read `payments.dunning`-style: run
`trust.settlementGate` against your largest open invoices and check the answers
are ones you would defend to the counterparty. The gate only ever holds the
**automatic** allocation path — a human clicking allocate in the exception queue
is the review the gate exists to force, so operators are never blocked by it.

What moves a score, and what does not:

- An OCR document moves Document Verification **only once a human accepts it**.
  Uploading a blurry photo that never gets accepted moves nothing — that is a
  bad camera, not dishonesty.
- Re-accepting the same document does nothing the second time. The unique index
  on `trust_evidence (entityType, entityId, kind, sourceType, sourceId)` is the
  guarantee, not a check-then-insert.
- A cupping that contradicts a claimed cup score by more than 1.5 points is a
  negative signal against both the lot and the supplier who made the claim.
  Cupping *higher* than claimed is not penalised.
- Peer feedback is weighted by the rater's own Trust, and the weights are summed
  rather than averaged — so a ring of at-risk accounts rating each other 100
  accumulates influence very slowly instead of instantly.

A weights change is a recomputation, not a migration: bump `MODEL_VERSION` in
`contracts/trust.ts` and run `trust.recalculate` per entity. Old snapshots keep
the version that produced them, so a historical trend line still renders as it
did.

### 4.8 Cupper authority (`cupperAuthority`)

**Seed before you flip this.** `npm run db:seed:education` installs the four SOP
§1.2 phases, the wider curriculum, and a starting roster. Turning the flag on
first would block every cupping session, because §1.1's Tier 0 covers anyone
without a profile and Tier 0 may not cup at all.

The order that works:

1. `npm run db:seed:education`
2. Open **Education → Cupper roster** and check the header strip. §1.1 requires
   **two** Q-Graders in good standing so one can verify the other's cups; below
   two, arbitration cupping has no second opinion and the strip says so.
3. Fix anything red — a lapsed licence, a missed annual recertification — while
   the flag is still off and nothing is being refused.
4. Flip `cupperAuthority`. QC now returns `GS-QC-1006 CupperNotAuthorized` with
   the specific reason rather than accepting three names typed into a box.

What the gate actually enforces, and the distinctions that matter:

- A **Tier 2** may cup alone for routine checks and Tier 1 exceptions, and is
  barred from Tier 2/3 resolution and arbitration. That boundary is where the
  money is largest.
- A **trainee** below 100 supervised cups loses independent authority but keeps
  their panel seat — §1.2 requires those cups be performed *under a Q-Grader*,
  which is panel work. Blocking the panel would bar them from the only activity
  that lets them finish training.
- A **disqualified** cupper (licence unrenewed past six months, missed
  recertification, variance over ±3, suspended) loses *everything*, including
  the panel. §1.3's triggers are about integrity and sensory acuity, and a
  cupper whose scores have drifted is not a reliable panellist either.
- A name with **no profile** is refused, not waved through.

Variance is a mean *absolute* deviation over a rolling 12 months, and needs at
least three data points before it reports at all — a cupper three points high on
one lot and three low on the next averages to zero, and one bad morning is not a
trend.

### 4.9 Dispositions and claims (no flag)

Read-only until someone records one, so there is nothing to gate. Two things to
know before the first disposition:

- **§B.2 defaults to the supplier.** An investigator claiming a logistics or
  in-transit origin without filing proof resolves to `supplier`, because the
  clause puts the burden of proof on them. Both the claimed and the resolved
  origin are stored; a report showing the two diverging is a report of cases
  where nobody produced evidence.
- **Both caps bite silently unless you read the explanation.** §C.1 holds a
  downgrade at 50% of the original price and §C.2 holds a claim at 110% of the
  purchase price with holding charged for at most 30 days. `priceDisposition`
  returns the quote and the explanation without recording anything — use it
  before committing to a number the supplier can contest under §C.3.

**One unresolved contract defect, for counsel rather than engineering.** §C.1
defines the operational cost adjustment as a total ("USD $300–$1,000 depending
on lot size") and its own worked example then adds that total to a per-pound
price, printing $3.70/lb where the definition gives $3.21/lb. On the clause's
own 40,000 lb example that is a **$19,600 difference in the credit owed back to
the supplier**, understated as written. The implementation follows the
definition; both readings are pinned in the tests. The agreement text should be
corrected whichever way it is settled.

---

## 5. What to watch

| Signal | Where | Target | Alert |
|---|---|---|---|
| Webhook response p99 | `msg: "webhook"` log lines, `latencyMs` | < 2s | > 2s for 5 min |
| Webhook → allocation p95 | event timestamps | < 30s | > 5 min |
| E-invoice gap | `invoices.einvoice.pending` | 0 issued VND invoices unsubmitted | any row older than 24h |
| Dunning sends per sweep | `dunning_runs` inserted today | matches the plan | a sudden jump means a data change, not a policy change |
| Realized FX | `payments.fx.position` | explainable against locked contract rates | any single adjustment over 1% of the invoice |
| Standing-order failures | `standing_order_cycles.status = 'charge_failed'` | 0 | any row |
| Trust updates without evidence | `trust_score_snapshots` rows with an empty `evidenceIds` | only manual recalculations | any unexplained move (§9) |
| Settlements held by a Trust gate | `blocked` outcomes carrying a "Trust" reason | rare and defensible | a spike means the gate is miscalibrated, not that suppliers got worse |
| Q-Graders in good standing | Education → Cupper roster | ≥ 2 (§1.1 redundancy) | drops to 1 |
| Cuppers on watch or disqualified | `education.performance` | 0 disqualified | any cupper over ±3 variance |
| Dispositions where claimed ≠ resolved fault | `lot_dispositions` | rare | a pattern means proof is not being gathered |
| Claims approaching a §D.4 window | `supplier_claims` | none inside 7 days of the limit | any |
| Floor payments past their tier SLA | `partners.floorSla` | 0 past the 5-day grace | any §9.1 release triggered |
| Lots with no accepted document | `trust_scores` where `entityType='lot'` and `acceptedDocumentCount = 0` | falling | §9's 7-day target |
| Outbox lag | `outboxLagSeconds()` | < 60s | > 5 min |
| Dead-lettered events | `domain_events_dead` | 0 | any — page on-call |
| Unmatched value | AR summary, suspense line | < 2% of daily inbound | > 5% for 24h |
| `paidMinor` drift | `payments.ar.reconcile` | 0 findings | any — page on-call |

Webhook logs never carry the raw memo at info level — it can hold a counterparty
name and an account fragment. The log records `descriptionSha256`; the full value
is in `provider_transactions.rawPayload` behind role-gated access (§13.2).

Reconciliation runs from the Payments page on demand and should be scheduled
nightly. It asserts four things and repairs none of them: `paidMinor` equals the
sum of live allocations, no transfer is over-allocated, every matched transfer
has an allocation, and no allocation crosses currencies without a rate.

---

## 6. Playbooks

### A transfer is sitting in the exception queue

Read the reason badge:

- **Unmatched** — the memo had no usable reference. Find the invoice (the
  counterparty name and the last four of the account are the best clues),
  allocate it. If it is not ours, Ignore with a reason.
- **Ambiguous** — more than one invoice fits. The matcher will not guess; you
  choose.
- **Unverified** — a Casso callback whose API re-fetch has not succeeded. The
  Allocate button is disabled and stays disabled. This is working as designed
  (ADR-03): a forged callback must not be able to mark an invoice paid. Check
  `CASSO_API_KEY` and the provider's status.
- **Matched — needs a click** — auto-allocation is off. Confirm it.
- **Residual** — an overpayment or a duplicate transfer. Reallocate to another
  invoice or route it to refund. Duplicates are *not* a bug: two transfers with
  distinct `tid`s are two real movements of money, and deduplicating on amount
  is how you lose one of them.

### An invoice shows less paid than the customer says they sent

Open the invoice; the payment history lists every allocation **and every
reversal**, with who did it and why. A reversed allocation is greyed, not
hidden.

### A duplicate webhook arrived

Nothing to do. `(provider, providerTxnId)` is unique; the second delivery gets a
200 and has no side effects.

### Reconciliation reports drift

Page on-call. Do not "fix" `paidMinor` by hand — it is derived from the
allocation rows on every write, so drift means either a bug in the allocation
path or a direct database write. Find which, and fix the cause.

---

## 7. Known gaps, deliberately

These are tracked in §15 of the spec and are **not** oversights:

- **R1 · e-invoices — now closed in code, open in configuration.** The
  submission pipeline, TT 78 payload validation and provider adapters exist
  (§3.5). Until `EINVOICE_PROVIDER` names a real authorised provider with live
  credentials, the mock adapter runs and its `MOCK-` numbers are **not** legal
  documents. `eInvoiceStatus: pending` still marks the gap.
- **R2 · data residency.** Whether counterparty KYC and bank data must be stored
  in Vietnam is with counsel. It affects hosting region.
- **R3 · who is the payer.** This build assumes buyers pay us. Payouts to
  farmers stay on the existing `partnerPayments` ledger.
- **R4 · VAT determination.** `vatRateBp` is per-invoice and chosen by the
  issuer. Nothing here decides export vs domestic treatment.
- **R5 · `cupScore` is a `double`.** Exact-comparison-unsafe at tier boundaries,
  so every comparison goes through `roundScore()`. Migrating the column to
  `decimal(5,2)` is scheduled, not done.
- **R6 · provider contracts drift.** Re-read the PayOS and Casso docs and record
  a fresh fixture before touching either adapter. The tests encode the shapes as
  of this sprint, not as of today.
- **Bank account encryption.** `bankAccountNumberEnc` is `varbinary` and the
  access-log table exists, but the KMS-backed AES-256-GCM adapter is not wired.
  Until it is, do not store real account numbers — only `bankAccountLast4`.
- **Token vault.** `payment_methods.tokenEnc` holds a provider token and is
  encrypted at rest by the same KMS adapter as `bankAccountNumberEnc` — which is
  not wired. Until it is, do not store a real recurring token, and keep
  `autoCharge` off. The registry, consent model and blocker checks are ready for
  it.
- **Deferred from the §3 roadmap.** §3.1 (AI financial assistant), §3.2
  (offline-first PWA), §3.7 (marketplace) and §2.4 (COD, which the source
  document itself defers) are **not** built. Neither are parallel sales/purchase
  order entities in the manager context — invoices still hang off contracts and
  existing orders.
- **Trust: no Navigator integration.** §4.2 and §7 ask for a "Needs
  verification" chip in Navigator results and Trust as a ranking signal in the
  Navigator composite. There is no Navigator screen in this codebase, so the
  data is exposed (`trust.forLots` returns score, band and document count per
  lot) and the ranking itself is not built.
- **Trust: the review pane cannot always show the original.** §5.4 wants the
  page image beside the fields. That works during a live capture, when the file
  is in the browser. Reviewing a document uploaded earlier shows an honest
  "original not available" note instead, because object storage is still not
  wired (see below) — there is nothing to fetch.
- **Trust: JetBrains Mono.** §2.1 and §5.1 specify it. This repo loads IBM Plex
  Mono, and the Trust components use the existing `font-mono` token rather than
  pulling a second mono family. Swap the `@font-face` import if the brand
  requires the exact face.
- **Object storage.** `documents.storageKey` is the contract for a storage
  adapter that is not yet implemented; uploads reserve a row and a key. §12.3
  requires files are never served from the application origin when they are.
