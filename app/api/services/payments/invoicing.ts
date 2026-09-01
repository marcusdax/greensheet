// Invoice issuance — sprint spec §3.7, §3.6 (currency rule) and §7.1.
//
// The invoice is the single payable aggregate (ADR-02): a payment settles an
// invoice, an invoice is raised against an order or a contract. That gives one
// FK target, one home for dueAt (without which aging buckets are unbuildable),
// and a natural place for VAT and FX.
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import { counterparties, invoices, numberSequences } from "@db/schema";
import { writeEvent } from "../../engine";
import { assertCurrency, assertFitsInt64, divRoundHalfUp, minorFromDb } from "@contracts/money";
import { memoTokenFor } from "./memo";

/** VN VAT rates in basis points (R4 owns the rule that picks between them). */
export const VN_VAT_RATES_BP = [0, 500, 800, 1000] as const;

export type IssueInvoiceInput = {
  payableType: "order" | "contract";
  payableId: number;
  counterpartyId: number;
  currency: string;
  subtotalMinor: bigint;
  vatRateBp: number;
  shippingMinor: bigint;
  issuedAt: Date;
  dueAt: Date;
  notes?: string;
  createdByUserId: number;
  /** Licensed FX exception; requires ops_manager and writes an audit event. */
  residencyOverrideNote?: string | null;
};

/** VAT is computed, never supplied — a client-sent total is a client-sent bug. */
export function vatMinorFor(subtotalMinor: bigint, vatRateBp: number): bigint {
  if (!Number.isInteger(vatRateBp) || vatRateBp < 0 || vatRateBp > 10_000) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `GS-INV-1003 · vatRateBp must be 0–10000, got ${vatRateBp}`,
    });
  }
  return divRoundHalfUp(subtotalMinor * BigInt(vatRateBp), 10_000n);
}

/**
 * Vietnam FX control (§3.6). Under the Ordinance on Foreign Exchange a
 * transaction between two Vietnamese residents must be denominated and settled
 * in VND; USD and EUR are for export contracts with non-resident counterparties.
 * Enforced here, in the schema layer, not just in the UI.
 */
export function assertCurrencyAllowed(args: {
  counterpartyCountry: string;
  currency: string;
  residencyOverrideNote?: string | null;
}): void {
  const domestic = args.counterpartyCountry.trim().toUpperCase() === "VN";
  if (domestic && args.currency !== "VND" && !args.residencyOverrideNote?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "GS-INV-1001 · a domestic (VN) counterparty must be invoiced in VND; a licensed exception requires a residency override note",
    });
  }
}

/** Reserve the next number in a scope. Gapless, so the row is locked. */
export async function nextSequenceValue(
  tx: Tx,
  scope: string,
): Promise<number> {
  const [existing] = await tx
    .select()
    .from(numberSequences)
    .where(eq(numberSequences.scope, scope))
    .for("update");

  if (!existing) {
    // Two concurrent issuers can both miss the row; the unique index on scope
    // makes the loser retry against the now-existing row.
    try {
      await tx.insert(numberSequences).values({ scope, nextValue: 2 });
      return 1;
    } catch {
      const [retry] = await tx
        .select()
        .from(numberSequences)
        .where(eq(numberSequences.scope, scope))
        .for("update");
      if (!retry) throw new Error(`GS-INV-1004 · could not reserve sequence ${scope}`);
      await tx
        .update(numberSequences)
        .set({ nextValue: retry.nextValue + 1 })
        .where(eq(numberSequences.id, retry.id));
      return retry.nextValue;
    }
  }

  await tx
    .update(numberSequences)
    .set({ nextValue: existing.nextValue + 1 })
    .where(eq(numberSequences.id, existing.id));
  return existing.nextValue;
}

export function formatInvoiceNumber(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(5, "0")}`;
}

export async function issueInvoice(input: IssueInvoiceInput) {
  const currency = assertCurrency(input.currency);
  if (input.subtotalMinor < 0n || input.shippingMinor < 0n) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "GS-INV-1002 · amounts must be >= 0" });
  }
  if (input.dueAt < input.issuedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "GS-INV-1005 · dueAt cannot precede issuedAt",
    });
  }

  const vatMinor = vatMinorFor(input.subtotalMinor, input.vatRateBp);
  const totalMinor = assertFitsInt64(
    input.subtotalMinor + vatMinor + input.shippingMinor,
    "invoice total",
  );

  return getDb().transaction(async (tx) => {
    const counterparty = await tx.query.counterparties.findFirst({
      where: eq(counterparties.id, input.counterpartyId),
    });
    if (!counterparty) {
      throw new TRPCError({ code: "NOT_FOUND", message: "GS-INV-1006 · counterparty not found" });
    }
    assertCurrencyAllowed({
      counterpartyCountry: counterparty.country,
      currency,
      residencyOverrideNote: input.residencyOverrideNote,
    });

    const year = input.issuedAt.getUTCFullYear();
    const seq = await nextSequenceValue(tx, `invoice:${year}`);
    const invoiceNumber = formatInvoiceNumber(year, seq);

    // memoToken derives from the invoice id, which MySQL only assigns on
    // insert — so the row goes in with a unique placeholder and is stamped
    // inside the same transaction. No one ever observes the placeholder.
    const placeholder = `TMP${String(Date.now() % 10 ** 7).padStart(7, "0")}`;

    const [inserted] = await tx.insert(invoices).values({
      invoiceNumber,
      payableType: input.payableType,
      payableId: input.payableId,
      counterpartyId: input.counterpartyId,
      currency,
      subtotalMinor: input.subtotalMinor,
      vatRateBp: input.vatRateBp,
      vatMinor,
      shippingMinor: input.shippingMinor,
      totalMinor,
      paidMinor: 0n,
      issuedAt: toDateString(input.issuedAt),
      dueAt: toDateString(input.dueAt),
      status: "issued",
      // R1 — a compliant VN e-invoice is issued through an authorised provider,
      // not by this table. Domestic sales are flagged pending so the gap is
      // visible rather than assumed away.
      eInvoiceStatus: counterparty.country.toUpperCase() === "VN" ? "pending" : "not_required",
      memoToken: placeholder,
      notes: input.notes ?? "",
      createdByUserId: input.createdByUserId,
    });

    const invoiceId = Number(inserted.insertId);
    const memoToken = memoTokenFor(invoiceId);
    await tx.update(invoices).set({ memoToken }).where(eq(invoices.id, invoiceId));

    await writeEvent(tx, "invoice.issued", "invoice", invoiceId, {
      invoiceId,
      counterpartyId: input.counterpartyId,
      totalMinor: totalMinor.toString(),
      currency,
      dueAt: toDateString(input.dueAt),
      memoToken,
    });

    if (input.residencyOverrideNote?.trim()) {
      await writeEvent(tx, "invoice.residency_override", "invoice", invoiceId, {
        invoiceId,
        currency,
        counterpartyCountry: counterparty.country,
        note: input.residencyOverrideNote,
        byUserId: input.createdByUserId,
      });
    }

    return {
      id: invoiceId,
      invoiceNumber,
      memoToken,
      totalMinor,
      vatMinor,
      currency,
      status: "issued" as const,
    };
  });
}

/** Void an unpaid invoice. A paid one is corrected by reversal, not voiding. */
export async function voidInvoice(invoiceId: number, reason: string, userId: number) {
  return getDb().transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .for("update");
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "GS-INV-1007 · not found" });
    if (minorFromDb(invoice.paidMinor) > 0n) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "GS-INV-1008 · this invoice has payments against it — reverse the allocations before voiding",
      });
    }
    await tx
      .update(invoices)
      .set({ status: "void", notes: `${invoice.notes}\n[void] ${reason}`.trim().slice(0, 500) })
      .where(eq(invoices.id, invoiceId));

    await writeEvent(tx, "invoice.voided", "invoice", invoiceId, {
      invoiceId,
      reason,
      byUserId: userId,
    });
    return { invoiceId, status: "void" as const };
  });
}

/** Write off a genuinely uncollectable balance. platform_admin only (§5.3). */
export async function writeOffInvoice(invoiceId: number, reason: string, userId: number) {
  return getDb().transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .for("update");
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "GS-INV-1007 · not found" });

    const outstanding = minorFromDb(invoice.totalMinor) - minorFromDb(invoice.paidMinor);
    await tx
      .update(invoices)
      .set({
        status: "written_off",
        notes: `${invoice.notes}\n[write-off] ${reason}`.trim().slice(0, 500),
      })
      .where(eq(invoices.id, invoiceId));

    await writeEvent(tx, "invoice.written_off", "invoice", invoiceId, {
      invoiceId,
      writtenOffMinor: outstanding.toString(),
      currency: invoice.currency,
      reason,
      byUserId: userId,
    });
    return { invoiceId, status: "written_off" as const, writtenOffMinor: outstanding };
  });
}

/**
 * MySQL `date` columns take a YYYY-MM-DD string. Timestamps are stored UTC and
 * converted at the boundary; the ICT day boundary matters for aging (§3.11) and
 * is applied in that query, not here.
 */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function invoiceCount(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`COUNT(*)` })
    .from(invoices)
    .where(and(eq(invoices.status, "issued")));
  return Number(row?.n ?? 0);
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
