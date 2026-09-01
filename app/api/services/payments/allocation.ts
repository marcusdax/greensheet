// Allocation service — sprint spec §7.4 and §3.10.
//
// One transfer can settle several invoices; one invoice can take several
// transfers. Allocations are append-only: a mistake is corrected by writing a
// reversal, never by deleting a row, because the audit trail is the product.
//
// Every write in here runs inside one transaction that also (a) recomputes
// invoices.paidMinor from the allocation rows rather than incrementing a
// counter, and (b) appends the domain event. That is what makes the §13.3
// nightly reconciliation an assertion rather than a repair job.
import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import { invoices, paymentAllocations, providerTransactions } from "@db/schema";
import { writeEvent } from "../../engine";
import { minorFromDb, assertFitsInt64 } from "@contracts/money";

export type AllocateInput = {
  providerTransactionId: number;
  invoiceId: number;
  amountMinor: bigint;
  currency: string;
  /** Required when the payment currency differs from the invoice currency. */
  fxRate?: string | null;
  /** null = allocated automatically by the matching consumer. */
  allocatedByUserId: number | null;
  /** Escape hatch for a deliberate credit note; never set by the auto path. */
  allowOverAllocation?: boolean;
};

export type AllocateResult = {
  allocationId: number;
  invoiceId: number;
  paidMinor: bigint;
  totalMinor: bigint;
  status: string;
  /** Money on the transaction that is still unassigned after this allocation. */
  transactionResidualMinor: bigint;
};

function fail(
  code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT",
  message: string
): never {
  throw new TRPCError({ code, message });
}

/**
 * Apply money to an invoice.
 *
 * Guards, all enforced inside the transaction rather than by a database
 * constraint MySQL cannot express:
 *   · amount > 0
 *   · SUM(allocations for this transaction) <= transaction.amountMinor (§3.10)
 *   · currency match, or an explicit fxRate (§11.1 "no currency mixing")
 *   · the invoice is not void, written off or soft-deleted
 */
export async function allocate(input: AllocateInput): Promise<AllocateResult> {
  if (input.amountMinor <= 0n)
    fail("BAD_REQUEST", "GS-PAY-1002 · allocation amount must be > 0");
  assertFitsInt64(input.amountMinor, "allocation amount");

  return getDb().transaction(async tx => {
    const [txn] = await tx
      .select()
      .from(providerTransactions)
      .where(eq(providerTransactions.id, input.providerTransactionId))
      .for("update");
    if (!txn) fail("NOT_FOUND", "GS-PAY-1003 · provider transaction not found");

    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, input.invoiceId), isNull(invoices.deletedAt)))
      .for("update");
    if (!invoice) fail("NOT_FOUND", "GS-PAY-1004 · invoice not found");
    if (invoice.status === "void" || invoice.status === "written_off") {
      fail(
        "CONFLICT",
        `GS-PAY-1005 · invoice ${invoice.invoiceNumber} is ${invoice.status}`
      );
    }

    // ADR-03: a Casso record that has not been re-fetched from the provider API
    // may never move money, however valid its shared secret looked.
    if (txn.provider === "casso" && !txn.verifiedAt) {
      fail(
        "CONFLICT",
        "GS-PAY-1006 · Casso transaction is unverified — re-fetch from the provider API before allocating"
      );
    }

    if (input.currency !== invoice.currency && !input.fxRate) {
      fail(
        "BAD_REQUEST",
        `GS-PAY-1007 · allocating ${input.currency} to a ${invoice.currency} invoice requires an explicit fxRate`
      );
    }

    // §3.10 — the sum of live allocations may never exceed what actually arrived.
    const allocatedSoFar = await sumAllocationsForTransaction(tx, txn.id);
    const txnAmount = minorFromDb(txn.amountMinor);
    if (allocatedSoFar + input.amountMinor > txnAmount) {
      fail(
        "CONFLICT",
        `GS-PAY-1008 · over-allocation: ${allocatedSoFar + input.amountMinor} exceeds the ${txnAmount} received`
      );
    }

    // §7.4 — an invoice never absorbs more than it is owed. Excess money stays
    // on the transaction as a visible residual for allocation elsewhere or
    // refund; it is never quietly parked inside a settled invoice.
    if (!input.allowOverAllocation) {
      const outstanding =
        minorFromDb(invoice.totalMinor) - minorFromDb(invoice.paidMinor);
      if (input.amountMinor > outstanding) {
        fail(
          "CONFLICT",
          `GS-PAY-1018 · allocating ${input.amountMinor} to invoice ${invoice.invoiceNumber} exceeds its ${outstanding} outstanding — split the transfer`
        );
      }
    }

    const [inserted] = await tx.insert(paymentAllocations).values({
      providerTransactionId: txn.id,
      invoiceId: invoice.id,
      amountMinor: input.amountMinor,
      currency: input.currency,
      fxRate: input.fxRate ?? null,
      allocatedByUserId: input.allocatedByUserId,
    });
    const allocationId = Number(inserted.insertId);

    const { paidMinor, status } = await recomputeInvoice(tx, invoice.id);
    const residual = txnAmount - (allocatedSoFar + input.amountMinor);

    await tx
      .update(providerTransactions)
      .set({
        matchedInvoiceId: invoice.id,
        matchStatus:
          input.allocatedByUserId == null ? "matched" : "manual_matched",
        matchMethod: input.allocatedByUserId == null ? undefined : "manual",
      })
      .where(eq(providerTransactions.id, txn.id));

    await writeEvent(tx, "payment.allocated", "invoice", invoice.id, {
      invoiceId: invoice.id,
      allocationId,
      amountMinor: input.amountMinor.toString(),
      currency: input.currency,
      paidMinor: paidMinor.toString(),
      totalMinor: minorFromDb(invoice.totalMinor).toString(),
    });

    if (status === "paid") {
      await writeEvent(tx, "invoice.settled", "invoice", invoice.id, {
        invoiceId: invoice.id,
        counterpartyId: invoice.counterpartyId,
        totalMinor: minorFromDb(invoice.totalMinor).toString(),
        currency: invoice.currency,
        settledAt: new Date().toISOString(),
      });
    }
    return {
      allocationId,
      invoiceId: invoice.id,
      paidMinor,
      totalMinor: minorFromDb(invoice.totalMinor),
      status,
      transactionResidualMinor: residual,
    };
  });
}

export type ReverseInput = {
  allocationId: number;
  reason: string;
  reversedByUserId: number;
};

/** Reverse an allocation. The row survives; only its effect is undone. */
export async function reverseAllocation(input: ReverseInput) {
  if (!input.reason.trim()) {
    fail("BAD_REQUEST", "GS-PAY-1009 · a reversal requires a reason");
  }

  return getDb().transaction(async tx => {
    const [allocation] = await tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.id, input.allocationId))
      .for("update");
    if (!allocation) fail("NOT_FOUND", "GS-PAY-1003 · allocation not found");
    if (allocation.reversedAt) {
      fail("CONFLICT", "GS-PAY-1005 · allocation is already reversed");
    }

    await tx
      .update(paymentAllocations)
      .set({
        reversedAt: new Date(),
        reversedByUserId: input.reversedByUserId,
        reversalReason: input.reason.slice(0, 255),
      })
      .where(eq(paymentAllocations.id, allocation.id));

    const { paidMinor, status } = await recomputeInvoice(
      tx,
      allocation.invoiceId
    );

    // The money is real and is now unassigned again: the transaction returns to
    // the exception queue rather than disappearing (§7.4).
    await tx
      .update(providerTransactions)
      .set({ matchStatus: "unmatched", matchedInvoiceId: null })
      .where(eq(providerTransactions.id, allocation.providerTransactionId));

    await writeEvent(tx, "payment.reversed", "invoice", allocation.invoiceId, {
      invoiceId: allocation.invoiceId,
      allocationId: allocation.id,
      amountMinor: minorFromDb(allocation.amountMinor).toString(),
      reason: input.reason,
    });

    return {
      allocationId: allocation.id,
      invoiceId: allocation.invoiceId,
      paidMinor,
      status,
    };
  });
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function sumAllocationsForTransaction(
  tx: Tx,
  providerTransactionId: number
): Promise<bigint> {
  const [row] = await tx
    .select({
      total: sql<
        string | null
      >`COALESCE(SUM(${paymentAllocations.amountMinor}), 0)`,
    })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.providerTransactionId, providerTransactionId),
        isNull(paymentAllocations.reversedAt)
      )
    );
  return minorFromDb(row?.total ?? 0);
}

/**
 * paidMinor is DERIVED, always. Recomputing from the allocation rows rather
 * than incrementing a counter is what makes a reversal exact and the nightly
 * reconciliation (§13.3) a tautology instead of a repair.
 */
export async function recomputeInvoice(
  tx: Tx,
  invoiceId: number
): Promise<{ paidMinor: bigint; status: string }> {
  const [sumRow] = await tx
    .select({
      total: sql<
        string | null
      >`COALESCE(SUM(${paymentAllocations.amountMinor}), 0)`,
    })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.invoiceId, invoiceId),
        isNull(paymentAllocations.reversedAt)
      )
    );
  const paidMinor = minorFromDb(sumRow?.total ?? 0);

  const [invoice] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  const total = minorFromDb(invoice.totalMinor);
  const status = statusFor(invoice.status, paidMinor, total);

  await tx
    .update(invoices)
    .set({ paidMinor, status })
    .where(eq(invoices.id, invoiceId));
  return { paidMinor, status };
}

/**
 * §7.4 in one function. Underpayment is `partially_paid` and keeps aging from
 * the ORIGINAL dueAt; overpayment is `paid` with the excess surfaced elsewhere,
 * never silently absorbed.
 */
export function statusFor(
  currentStatus: string,
  paidMinor: bigint,
  totalMinor: bigint
):
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overpaid"
  | "void"
  | "written_off" {
  if (
    currentStatus === "void" ||
    currentStatus === "written_off" ||
    currentStatus === "draft"
  ) {
    return currentStatus;
  }
  if (paidMinor <= 0n) return "issued";
  if (paidMinor < totalMinor) return "partially_paid";
  if (paidMinor === totalMinor) return "paid";
  return "overpaid";
}
