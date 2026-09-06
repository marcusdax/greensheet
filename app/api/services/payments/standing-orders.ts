// Recurring B2B standing orders — §3.6.
//
// "Many cafés order beans weekly." The design keeps subscriptions out of the
// money path entirely: a standing order is an INTENT, and each cycle produces
// an ordinary invoice through the ordinary issuance path. Nothing in AR, aging,
// matching or reconciliation needs to know subscriptions exist.
//
// That is deliberate. The alternative — a parallel "subscription charge" that
// settles differently — is how a business ends up with two sets of books.
import { and, eq, isNull, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import {
  counterparties,
  paymentMethods,
  standingOrderCycles,
  standingOrders,
} from "@db/schema";
import { writeEvent } from "../../engine";
import { issueInvoice } from "./invoicing";
import { ictToday } from "./aging";

export type Cadence = "weekly" | "biweekly" | "monthly";

/** Add days to a YYYY-MM-DD calendar date without touching local time. */
export function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Next run date after `from`, for a cadence.
 *
 * Monthly clamps to the 28th rather than rolling into the next month: a café
 * billed on the 31st should not skip February, and "the 29th" is a different
 * bug every four years. Clamping is the boring, correct answer.
 */
export function nextRunDate(
  cadence: Cadence,
  from: string,
  anchorDay: number
): string {
  if (cadence === "weekly") return addDays(from, 7);
  if (cadence === "biweekly") return addDays(from, 14);

  const [y, m] = from.split("-").map(Number);
  const day = Math.min(Math.max(anchorDay, 1), 28);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type GenerationOutcome = {
  due: number;
  invoiced: number;
  skipped: number;
  failed: number;
  details: {
    standingOrderId: number;
    reference: string;
    periodStart: string;
    invoiceId?: number;
    reason?: string;
  }[];
};

/**
 * Generate invoices for every standing order due on or before `asOf`.
 *
 * Idempotent on (standingOrderId, periodStart): re-running the generator, or
 * running it twice from two workers, cannot invoice a café twice for the same
 * week. That unique index is the whole safety story, so it is claimed BEFORE
 * the invoice is issued, not after.
 */
export async function generateDueInvoices(
  opts: { asOf?: string; userId?: number; dryRun?: boolean } = {}
): Promise<GenerationOutcome> {
  const db = getDb();
  const asOf = opts.asOf ?? ictToday();
  const outcome: GenerationOutcome = { due: 0, invoiced: 0, skipped: 0, failed: 0, details: [] };

  const due = await db
    .select()
    .from(standingOrders)
    .where(
      and(
        eq(standingOrders.status, "active"),
        lte(standingOrders.nextRunOn, asOf),
        isNull(standingOrders.deletedAt)
      )
    );
  outcome.due = due.length;
  if (opts.dryRun) {
    outcome.details = due.map(o => ({
      standingOrderId: o.id,
      reference: o.reference,
      periodStart: o.nextRunOn,
    }));
    return outcome;
  }

  for (const order of due) {
    const periodStart = order.nextRunOn;

    // Past its end date: close it out rather than invoicing again.
    if (order.endsOn && periodStart > order.endsOn) {
      await db
        .update(standingOrders)
        .set({ status: "ended" })
        .where(eq(standingOrders.id, order.id));
      outcome.skipped++;
      outcome.details.push({
        standingOrderId: order.id,
        reference: order.reference,
        periodStart,
        reason: "past end date",
      });
      continue;
    }

    // Claim the cycle first. If another worker already claimed it, the unique
    // index rejects this insert and we skip without issuing anything.
    let cycleId: number;
    try {
      const [res] = await db.insert(standingOrderCycles).values({
        standingOrderId: order.id,
        periodStart,
        status: "generated",
      });
      cycleId = Number(res.insertId);
    } catch (err) {
      const e = err as { code?: string; errno?: number; message?: string };
      const duplicate =
        e?.code === "ER_DUP_ENTRY" ||
        e?.errno === 1062 ||
        (typeof e?.message === "string" && /duplicate entry/i.test(e.message));
      if (!duplicate) throw err;
      outcome.skipped++;
      outcome.details.push({
        standingOrderId: order.id,
        reference: order.reference,
        periodStart,
        reason: "cycle already generated",
      });
      // Still advance the schedule so a claimed-but-unadvanced order does not
      // wedge the generator on the same date forever.
      await advance(order.id, order.cadence as Cadence, periodStart, order.anchorDay);
      continue;
    }

    try {
      const issuedAt = new Date(`${periodStart}T00:00:00Z`);
      const dueAt = new Date(
        Date.parse(`${periodStart}T00:00:00Z`) + order.paymentTermDays * 86_400_000
      );

      const invoice = await issueInvoice({
        payableType: "contract",
        // A standing order is its own payable: the cycle row is the thing the
        // invoice was raised against.
        payableId: cycleId,
        counterpartyId: order.counterpartyId,
        currency: order.currency,
        subtotalMinor: order.subtotalMinor,
        vatRateBp: order.vatRateBp,
        shippingMinor: order.shippingMinor,
        issuedAt,
        dueAt,
        notes: `Standing order ${order.reference} · period ${periodStart}`,
        createdByUserId: opts.userId ?? order.createdByUserId ?? 0,
      });

      await db
        .update(standingOrderCycles)
        .set({ invoiceId: invoice.id })
        .where(eq(standingOrderCycles.id, cycleId));

      await writeEvent(db, "standing_order.invoiced", "standing_order", order.id, {
        standingOrderId: order.id,
        cycleId,
        periodStart,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        counterpartyId: order.counterpartyId,
        totalMinor: invoice.totalMinor.toString(),
        currency: invoice.currency,
        // The generator never charges. Auto-charge is a separate, flagged step
        // so a token can be revoked without stopping invoicing (§3.6).
        paymentMethodId: order.paymentMethodId,
      });

      outcome.invoiced++;
      outcome.details.push({
        standingOrderId: order.id,
        reference: order.reference,
        periodStart,
        invoiceId: invoice.id,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await db
        .update(standingOrderCycles)
        .set({ status: "skipped", failureReason: reason.slice(0, 255) })
        .where(eq(standingOrderCycles.id, cycleId));
      outcome.failed++;
      outcome.details.push({
        standingOrderId: order.id,
        reference: order.reference,
        periodStart,
        reason,
      });
    }

    await advance(order.id, order.cadence as Cadence, periodStart, order.anchorDay);
  }

  return outcome;
}

async function advance(
  standingOrderId: number,
  cadence: Cadence,
  periodStart: string,
  anchorDay: number
): Promise<void> {
  await getDb()
    .update(standingOrders)
    .set({
      lastRunOn: periodStart,
      nextRunOn: nextRunDate(cadence, periodStart, anchorDay),
    })
    .where(eq(standingOrders.id, standingOrderId));
}

/**
 * Whether a saved method may be charged without the payer present.
 *
 * §3.6 says "with customer consent". That is a precondition to check, not a
 * sentence to put in a contract, so it is enforced here and the reasons are
 * returned rather than collapsed into a boolean.
 */
export function autoChargeBlockers(
  method: {
    status: string;
    consentGivenAt: Date | null;
    consentRevokedAt: Date | null;
    tokenEnc: string | null;
    tokenExpiresAt: Date | null;
  },
  now = new Date()
): string[] {
  const blockers: string[] = [];
  if (method.status !== "active") blockers.push(`payment method is ${method.status}`);
  if (!method.consentGivenAt) blockers.push("no recorded consent to auto-charge");
  if (method.consentRevokedAt) blockers.push("consent was revoked");
  if (!method.tokenEnc) blockers.push("no stored token");
  if (method.tokenExpiresAt && method.tokenExpiresAt <= now) blockers.push("stored token has expired");
  return blockers;
}

/** Create a standing order, validating the cadence anchor. */
export async function createStandingOrder(input: {
  counterpartyId: number;
  reference: string;
  cadence: Cadence;
  anchorDay: number;
  currency: string;
  subtotalMinor: bigint;
  vatRateBp: number;
  shippingMinor: bigint;
  paymentTermDays: number;
  paymentMethodId?: number | null;
  lotId?: number | null;
  notes?: string;
  startsOn: string;
  endsOn?: string | null;
  createdByUserId: number;
}): Promise<{ id: number; reference: string; nextRunOn: string }> {
  const db = getDb();

  const maxAnchor = input.cadence === "monthly" ? 28 : 7;
  if (input.anchorDay < 1 || input.anchorDay > maxAnchor) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `GS-SUB-1001 · anchorDay must be 1–${maxAnchor} for a ${input.cadence} cadence`,
    });
  }
  if (input.endsOn && input.endsOn < input.startsOn) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "GS-SUB-1002 · endsOn cannot precede startsOn",
    });
  }

  const counterparty = await db.query.counterparties.findFirst({
    where: eq(counterparties.id, input.counterpartyId),
  });
  if (!counterparty) {
    throw new TRPCError({ code: "NOT_FOUND", message: "GS-INV-1006 · counterparty not found" });
  }

  if (input.paymentMethodId) {
    const method = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, input.paymentMethodId),
    });
    if (!method) {
      throw new TRPCError({ code: "NOT_FOUND", message: "GS-SUB-1003 · payment method not found" });
    }
    const blockers = autoChargeBlockers(method);
    if (blockers.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `GS-SUB-1004 · this method cannot be auto-charged: ${blockers.join("; ")}`,
      });
    }
  }

  const [res] = await db.insert(standingOrders).values({
    counterpartyId: input.counterpartyId,
    reference: input.reference,
    cadence: input.cadence,
    anchorDay: input.anchorDay,
    currency: input.currency,
    subtotalMinor: input.subtotalMinor,
    vatRateBp: input.vatRateBp,
    shippingMinor: input.shippingMinor,
    paymentTermDays: input.paymentTermDays,
    paymentMethodId: input.paymentMethodId ?? null,
    lotId: input.lotId ?? null,
    notes: input.notes ?? "",
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? null,
    nextRunOn: input.startsOn,
    createdByUserId: input.createdByUserId,
  });
  const id = Number(res.insertId);

  await writeEvent(db, "standing_order.created", "standing_order", id, {
    standingOrderId: id,
    counterpartyId: input.counterpartyId,
    reference: input.reference,
    cadence: input.cadence,
    currency: input.currency,
    subtotalMinor: input.subtotalMinor.toString(),
    startsOn: input.startsOn,
  });

  return { id, reference: input.reference, nextRunOn: input.startsOn };
}
