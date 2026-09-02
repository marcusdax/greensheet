// Outbox handlers — sprint spec §4.1 and §4.2.
//
// Two families live here:
//
//   1. The COF-001…005 campaign rules, moved verbatim out of emitEvent(). They
//      run inline while `outboxConsumer` is off and from here once it is on.
//   2. The payment pipeline: a received transaction is verified (Casso only),
//      matched, and — if and only if autoAllocation is on — allocated.
//
// Every handler is idempotent, because delivery is at-least-once.
import { eq } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { invoices, providerTransactions } from "@db/schema";
import { evaluateRules } from "../../engine";
import { writeEvent } from "../../engine";
import { getFlags } from "../flags";
import { verifyWithCassoApi } from "../payments/casso";
import { resolveMatch } from "../payments/matching";
import { settleTransactionAgainstInvoice } from "../payments/settlement";
import { minorFromDb } from "@contracts/money";
import { markPaidAfter } from "../payments/dunning";
import { issueEinvoice } from "../payments/einvoice";
import { registerHandler, type OutboxEvent } from "./registry";
// Side-effect import: the Trust handlers register themselves, and they must be
// loaded wherever this file is (the consumer imports only this one).
import "../trust/handlers";

// ─── Campaign rules (P-04…P-08) ──────────────────────────────────────────────
// The rule engine matches on the canonical event strings, which must stay
// byte-identical (§4.3).
const CAMPAIGN_EVENTS = [
  "sample_kit.delivered",
  "feedback.submitted",
  "campaigns.link_clicked",
  "order.created",
] as const;

for (const eventType of CAMPAIGN_EVENTS) {
  registerHandler(eventType, {
    name: `campaign-rules:${eventType}`,
    async handle(event) {
      await evaluateRules(event.eventType, event.payload);
      return "handled";
    },
  });
}

// ─── Payment pipeline ────────────────────────────────────────────────────────

registerHandler("payment.transaction_received", {
  name: "payments:verify-and-match",
  async handle(event: OutboxEvent) {
    const db = getDb();
    const id = Number(event.payload.providerTransactionId);
    const txn = await db.query.providerTransactions.findFirst({
      where: eq(providerTransactions.id, id),
    });
    if (!txn) return "skip";

    // Idempotency: a redelivery of an already-resolved transaction is a no-op.
    if (txn.matchStatus !== "unmatched" || txn.matchedInvoiceId) return "skip";

    // ── ADR-03 · Casso is not trusted ────────────────────────────────────────
    // The callback proves only that someone holds the shared secret. Re-fetch
    // from the provider API; a 404 or an amount mismatch leaves paidMinor
    // untouched and raises an exception-queue entry (§14.3).
    if (txn.provider === "casso" && !txn.verifiedAt) {
      const verification = await verifyWithCassoApi(txn.providerTxnId, {
        amountMinor: minorFromDb(txn.amountMinor),
      });
      if (!verification.ok) {
        await db
          .update(providerTransactions)
          .set({
            verificationError: verification.reason.slice(0, 255),
            matchStatus: "unmatched",
          })
          .where(eq(providerTransactions.id, txn.id));
        await writeEvent(
          db,
          "payment.unmatched",
          "provider_transaction",
          txn.id,
          {
            providerTransactionId: txn.id,
            amountMinor: minorFromDb(txn.amountMinor).toString(),
            description: txn.description,
            reason: `casso_verification_failed: ${verification.reason}`,
          }
        );
        // Handled, not failed: the money is real and now sits in the exception
        // queue for a human. Retrying a 404 forever helps nobody.
        return "handled";
      }
      await db
        .update(providerTransactions)
        .set({ verifiedAt: new Date(), verificationError: null })
        .where(eq(providerTransactions.id, txn.id));
    }

    const decision = await resolveMatch({
      description: txn.description,
      amountMinor: minorFromDb(txn.amountMinor),
      currency: txn.currency,
      providerOrderCode:
        event.payload.providerOrderCode == null
          ? null
          : Number(event.payload.providerOrderCode),
      counterAccountNumber: txn.counterAccountNumber,
    });

    await db
      .update(providerTransactions)
      .set({
        matchStatus: decision.status,
        matchMethod: decision.method ?? undefined,
        matchedInvoiceId: decision.invoiceId,
      })
      .where(eq(providerTransactions.id, txn.id));

    if (decision.status !== "matched" || decision.invoiceId == null) {
      await writeEvent(
        db,
        "payment.unmatched",
        "provider_transaction",
        txn.id,
        {
          providerTransactionId: txn.id,
          amountMinor: minorFromDb(txn.amountMinor).toString(),
          description: txn.description,
          reason: decision.reason,
        }
      );
      return "handled";
    }

    await writeEvent(db, "payment.matched", "provider_transaction", txn.id, {
      providerTransactionId: txn.id,
      invoiceId: decision.invoiceId,
      amountMinor: minorFromDb(txn.amountMinor).toString(),
      matchMethod: decision.method,
    });
    return "handled";
  },
});

registerHandler("payment.matched", {
  name: "payments:auto-allocate",
  async handle(event: OutboxEvent) {
    const flags = await getFlags();
    // The kill switch (§8.1). With autoAllocation off, a matched transaction
    // still needs a human click — the safe posture for the first two weeks in
    // production (§13.4).
    if (!flags.autoAllocation) return "skip";

    const providerTransactionId = Number(event.payload.providerTransactionId);
    const invoiceId = Number(event.payload.invoiceId);

    const txn = await getDb().query.providerTransactions.findFirst({
      where: eq(providerTransactions.id, providerTransactionId),
    });
    if (!txn) return "skip";

    // A heuristic match is a proposal, not a credit. It waits for a person
    // regardless of the flag (§7.1 matching order, step 3).
    if (txn.matchMethod === "heuristic") return "skip";

    const outcome = await settleTransactionAgainstInvoice({
      providerTransactionId,
      invoiceId,
      allocatedByUserId: null,
    });
    return outcome.kind === "allocated" ? "handled" : "skip";
  },
});

// ─── §3.4 · dunning effectiveness ────────────────────────────────────────────
// A settlement is the outcome the ladder exists to produce, so it is stamped
// back onto every step that preceded it. Without this, channel effectiveness is
// unmeasurable and §3.4's "adjusts templates accordingly" is aspiration.
registerHandler("invoice.settled", {
  name: "dunning:mark-paid-after",
  async handle(event: OutboxEvent) {
    const invoiceId = Number(event.payload.invoiceId);
    if (!Number.isInteger(invoiceId)) return "skip";
    const stamped = await markPaidAfter(invoiceId);
    // No steps had gone out — the customer simply paid on time, which is the
    // outcome we want and nothing to record.
    return stamped > 0 ? "handled" : "skip";
  },
});

// ─── §3.5 · e-invoice issuance ───────────────────────────────────────────────
// Submitted from the outbox rather than inline at issuance, because the
// authority's provider is a third party that can be slow or down, and an
// invoice must not fail to exist in our own books because VNPT is unreachable.
registerHandler("invoice.issued", {
  name: "einvoice:submit",
  async handle(event: OutboxEvent) {
    const flags = await getFlags();
    if (!flags.eInvoice) return "skip";

    const invoiceId = Number(event.payload.invoiceId);
    if (!Number.isInteger(invoiceId)) return "skip";

    const invoice = await getDb().query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });
    // Only domestic sales need issuing; an export invoice is not_required.
    if (!invoice || invoice.eInvoiceStatus !== "pending") return "skip";

    const outcome = await issueEinvoice(invoiceId);
    // A provider rejection is recorded on the submission row and surfaced in
    // the pending report. Throwing would retry a payload the authority has
    // already refused, which never succeeds and only burns attempts.
    return outcome.ok ? "handled" : "handled";
  },
});
