// Settlement — sprint spec §7.4, the push-payment cases v1 did not model (G2).
//
// A VietQR transfer is not a card charge. The payer chooses the amount and
// types the memo, so the four interesting cases are all normal traffic:
//
//   Underpayment    allocate what arrived; partially_paid; the remainder keeps
//                   aging from the ORIGINAL dueAt, not from today.
//   Overpayment     allocate up to the outstanding balance; invoice paid; the
//                   excess stays on the transaction as a visible residual for
//                   reallocation or refund, and invoice.overpaid is emitted.
//   Duplicate       a distinct providerTxnId, so both transfers persist. The
//                   second finds nothing outstanding and goes to the exception
//                   queue for refund. That is correct, not a bug — never
//                   deduplicate on amount.
//   Unmatched       money is real but unassigned. It is a suspense balance and
//                   must appear in the AR summary as such, never as zero.
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { invoices, paymentAllocations, providerTransactions } from "@db/schema";
import { writeEvent } from "../../engine";
import { minorFromDb } from "@contracts/money";
import { allocate, type AllocateResult } from "./allocation";

export type SettlementOutcome = {
  kind: "allocated" | "nothing_outstanding" | "blocked";
  allocation?: AllocateResult;
  /** Unassigned money left on the transaction after this settlement. */
  residualMinor: bigint;
  overpaid: boolean;
  reason: string;
};

/**
 * Apply a provider transaction to one invoice, capped at what the invoice
 * still owes. This is the only path the auto-allocation consumer uses.
 */
export async function settleTransactionAgainstInvoice(args: {
  providerTransactionId: number;
  invoiceId: number;
  /** null = automatic. A user id means a human clicked it in the queue. */
  allocatedByUserId: number | null;
  fxRate?: string | null;
}): Promise<SettlementOutcome> {
  const db = getDb();

  const txn = await db.query.providerTransactions.findFirst({
    where: eq(providerTransactions.id, args.providerTransactionId),
  });
  if (!txn) {
    return { kind: "blocked", residualMinor: 0n, overpaid: false, reason: "transaction not found" };
  }

  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, args.invoiceId) });
  if (!invoice) {
    return { kind: "blocked", residualMinor: 0n, overpaid: false, reason: "invoice not found" };
  }

  const unassigned = await unallocatedResidual(txn.id);
  const outstanding = minorFromDb(invoice.totalMinor) - minorFromDb(invoice.paidMinor);

  if (outstanding <= 0n) {
    // The duplicate-transfer case. The money stays unassigned and visible.
    return {
      kind: "nothing_outstanding",
      residualMinor: unassigned,
      overpaid: unassigned > 0n,
      reason: `invoice ${invoice.invoiceNumber} has nothing outstanding — route to refund`,
    };
  }
  if (unassigned <= 0n) {
    return {
      kind: "nothing_outstanding",
      residualMinor: 0n,
      overpaid: false,
      reason: "transaction is fully allocated",
    };
  }

  const amountMinor = unassigned < outstanding ? unassigned : outstanding;
  const overpaid = unassigned > outstanding;

  const allocation = await allocate({
    providerTransactionId: txn.id,
    invoiceId: invoice.id,
    amountMinor,
    currency: txn.currency,
    fxRate: args.fxRate ?? null,
    allocatedByUserId: args.allocatedByUserId,
  });

  if (overpaid) {
    const excess = unassigned - outstanding;
    await writeEvent(db, "invoice.overpaid", "invoice", invoice.id, {
      invoiceId: invoice.id,
      excessMinor: excess.toString(),
      currency: invoice.currency,
    });
  }

  return {
    kind: "allocated",
    allocation,
    residualMinor: allocation.transactionResidualMinor,
    overpaid,
    reason: overpaid
      ? "invoice settled in full; excess left unallocated for refund or reallocation"
      : amountMinor < outstanding
        ? "partial payment allocated; remainder keeps aging from the original due date"
        : "invoice settled in full",
  };
}

/** Sum of live (non-reversed) allocations against a transaction. */
export async function allocatedMinor(providerTransactionId: number): Promise<bigint> {
  const rows = await getDb()
    .select({ amountMinor: paymentAllocations.amountMinor })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.providerTransactionId, providerTransactionId),
        isNull(paymentAllocations.reversedAt),
      ),
    );
  return rows.reduce((sum, r) => sum + minorFromDb(r.amountMinor), 0n);
}

/**
 * Money on a transaction that no live allocation claims — the suspense balance
 * that §7.4 insists must never render as zero.
 */
export async function unallocatedResidual(providerTransactionId: number): Promise<bigint> {
  const txn = await getDb().query.providerTransactions.findFirst({
    where: eq(providerTransactions.id, providerTransactionId),
  });
  if (!txn) return 0n;
  return minorFromDb(txn.amountMinor) - (await allocatedMinor(providerTransactionId));
}
