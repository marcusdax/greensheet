// §13.4 — the auto-allocation pilot allowlist.
//
// "Slice 2 goes to production with vietqrPayments: true, autoAllocation: false,
// restricted to two pilot counterparties by an allowlist. Graduate to
// auto-allocation only after 14 consecutive days with zero reconciliation
// failures and zero manual reversals."
//
// Two controls, not one. The flag is the master switch; the allowlist decides
// whose money it applies to. Both must say yes before a matched transaction is
// credited without a person looking at it.
//
// The allowlist is fail-closed by construction: enrolment is a NULL column that
// nobody is in until an operator names them. Turning the flag on with an empty
// allowlist therefore moves no money at all — which reads as "nothing happened"
// and is worth knowing about, so every skip carries a reason the queue can show
// instead of silently leaving the transaction to age.
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { counterparties, invoices, paymentAllocations } from "@db/schema";
import { daysOverdue, ictToday } from "./aging";

/** A Date as its ICT calendar day, so day counts match the aging report. */
function ictDayOf(at: Date): string {
  return ictToday(at);
}

/** §13.4's graduation window. */
export const PILOT_GRADUATION_DAYS = 14;

export type PilotGate = {
  allowed: boolean;
  counterpartyId: number | null;
  enrolledAt: Date | null;
  reason: string;
};

/**
 * May a matched transaction on this invoice be allocated automatically?
 *
 * Resolves invoice → counterparty → enrolment. A missing invoice or a missing
 * counterparty is a no, not a crash: an unresolvable payer is precisely the
 * case a human should look at.
 */
export async function pilotGateFor(invoiceId: number): Promise<PilotGate> {
  const [row] = await getDb()
    .select({
      counterpartyId: counterparties.id,
      name: counterparties.name,
      enrolledAt: counterparties.autoAllocationPilotAt,
    })
    .from(invoices)
    .innerJoin(counterparties, eq(counterparties.id, invoices.counterpartyId))
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1);

  if (!row) {
    return {
      allowed: false,
      counterpartyId: null,
      enrolledAt: null,
      reason:
        "§13.4 · invoice or counterparty not found; a match nobody can attribute waits for a person",
    };
  }
  if (row.enrolledAt == null) {
    return {
      allowed: false,
      counterpartyId: Number(row.counterpartyId),
      enrolledAt: null,
      reason: `§13.4 · ${row.name} is not in the auto-allocation pilot; this match needs a human click`,
    };
  }
  return {
    allowed: true,
    counterpartyId: Number(row.counterpartyId),
    enrolledAt: row.enrolledAt,
    reason: `§13.4 · ${row.name} enrolled in the pilot since ${row.enrolledAt
      .toISOString()
      .slice(0, 10)}`,
  };
}

export type PilotMember = {
  counterpartyId: number;
  name: string;
  enrolledAt: Date;
  daysEnrolled: number;
  /** §13.4's second condition: a reversal restarts the clock. */
  reversalsInWindow: number;
  lastReversalAt: Date | null;
  readyToGraduate: boolean;
  blocker: string | null;
};

/**
 * Who is in the pilot, and has any of them earned graduation yet?
 *
 * A manual reversal inside the window is disqualifying, and it does not merely
 * pause the clock — §13.4 says *consecutive* days, so the count restarts from
 * the reversal. Reporting "12 of 14 days" on a counterparty whose allocation
 * was reversed yesterday would be the kind of number that gets a rollout waved
 * through.
 */
export async function pilotRoster(now: Date = new Date()): Promise<PilotMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      counterpartyId: counterparties.id,
      name: counterparties.name,
      enrolledAt: counterparties.autoAllocationPilotAt,
    })
    .from(counterparties)
    .where(
      and(
        isNotNull(counterparties.autoAllocationPilotAt),
        isNull(counterparties.deletedAt)
      )
    );

  const members: PilotMember[] = [];
  for (const row of rows) {
    const enrolledAt = row.enrolledAt as Date;
    const [reversals] = await db
      .select({
        n: sql<number>`count(*)`,
        last: sql<Date | null>`MAX(${paymentAllocations.reversedAt})`,
      })
      .from(paymentAllocations)
      .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
      .where(
        and(
          eq(invoices.counterpartyId, row.counterpartyId),
          isNotNull(paymentAllocations.reversedAt),
          gte(paymentAllocations.reversedAt, enrolledAt)
        )
      );

    const reversalsInWindow = Number(reversals?.n ?? 0);
    const lastReversalAt = reversals?.last ? new Date(reversals.last) : null;
    // The clock runs from enrolment, or from the last reversal if there was one.
    const clockFrom =
      lastReversalAt && lastReversalAt > enrolledAt ? lastReversalAt : enrolledAt;

    // Counted in ICT calendar days, the same unit the aging buckets use — and
    // deliberately NOT as a millisecond subtraction.
    //
    // These columns are TIMESTAMP(0), and MySQL ROUNDS a fractional second
    // rather than truncating it: a Date at .700s is stored half a second in the
    // future. Millisecond arithmetic then makes "enrolled exactly 3 days ago"
    // come out as 2, and a reversal that just happened come out as -1. A gate
    // that reads "14 consecutive days" cannot be off by one on the day it
    // matters, and "days" in this product has always meant ICT calendar days.
    const daysEnrolled = Math.max(
      0,
      daysOverdue(ictDayOf(clockFrom), ictToday(now))
    );

    const blocker =
      daysEnrolled < PILOT_GRADUATION_DAYS
        ? `${PILOT_GRADUATION_DAYS - daysEnrolled} more clean day(s) required`
        : null;

    members.push({
      counterpartyId: Number(row.counterpartyId),
      name: row.name,
      enrolledAt,
      daysEnrolled,
      reversalsInWindow,
      lastReversalAt,
      readyToGraduate: blocker === null,
      blocker,
    });
  }
  return members.sort((a, b) => b.daysEnrolled - a.daysEnrolled);
}

/** Admit a counterparty to the pilot. Re-enrolling restarts the clock. */
export async function enrolInPilot(
  counterpartyId: number,
  at: Date = new Date()
): Promise<void> {
  await getDb()
    .update(counterparties)
    .set({ autoAllocationPilotAt: at })
    .where(eq(counterparties.id, counterpartyId));
}

/**
 * Withdraw a counterparty from the pilot.
 *
 * Takes effect on the next matched transaction. It reverses nothing already
 * allocated — an allocation is undone by writing a reversal, never by removing
 * the permission that produced it.
 */
export async function withdrawFromPilot(counterpartyId: number): Promise<void> {
  await getDb()
    .update(counterparties)
    .set({ autoAllocationPilotAt: null })
    .where(eq(counterparties.id, counterpartyId));
}
