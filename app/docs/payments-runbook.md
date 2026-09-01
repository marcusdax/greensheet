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
3. `npm run db:push` to create the new tables (a no-op for existing ones).
4. Turn flags on one at a time — see §4 below.

Rollback: `db/migrations/manual/0001_expand_existing.down.sql`, but read its
header first. Feature flags are the first line of rollback; migrations are the
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

Local-dev flag overrides (ignored in production): `FLAG_VIETQR_PAYMENTS=1`,
`FLAG_AUTO_ALLOCATION=1`, `FLAG_OCR_UPLOAD=1`, `FLAG_OUTBOX_CONSUMER=1`.

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

---

## 5. What to watch

| Signal | Where | Target | Alert |
|---|---|---|---|
| Webhook response p99 | `msg: "webhook"` log lines, `latencyMs` | < 2s | > 2s for 5 min |
| Webhook → allocation p95 | event timestamps | < 30s | > 5 min |
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

- **R1 · e-invoices.** `invoices` is an internal AR record, not a compliant
  Vietnamese e-invoice. Domestic invoices are marked `eInvoiceStatus: pending`
  so the gap is visible. Issuing through an authorised provider is separate work.
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
- **Object storage.** `documents.storageKey` is the contract for a storage
  adapter that is not yet implemented; uploads reserve a row and a key. §12.3
  requires files are never served from the application origin when they are.
