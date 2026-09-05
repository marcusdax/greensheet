// AR aging — sprint spec §3.11 and §14.1.
//
// v1 stored one mutable `outstandingSubunits` per counterparty (G1). That is
// unbuildable: buckets need a per-invoice dueDate, and stored state drifts and
// cannot be recomputed after a reversal. Aging is a QUERY over invoices.
//
// Day boundaries are computed in Asia/Ho_Chi_Minh, not UTC. An invoice due
// 31 Mar is not overdue at 00:30 ICT on 31 Mar, even though that instant is
// 17:30 UTC on 30 Mar. Timestamps are stored UTC and converted here, at the
// boundary — which is exactly where a naive implementation is off by one day
// for seven hours of every day.
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  counterparties,
  invoices,
  providerTransactions,
  paymentAllocations,
} from "@db/schema";
import { minorFromDb } from "@contracts/money";

export const ICT_TIMEZONE = "Asia/Ho_Chi_Minh";
export const AGING_BUCKETS = [
  "current",
  "b30",
  "b60",
  "b90",
  "b90plus",
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Statuses that still owe money. `paid`, `void` and `written_off` do not. */
const OPEN_STATUSES = ["issued", "partially_paid", "overpaid"] as const;

/** Today's date in ICT as YYYY-MM-DD. */
export function ictToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ICT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days between a due date and the reference date, both ICT calendar days. */
export function daysOverdue(dueAt: string, asOf: string = ictToday()): number {
  const due = Date.parse(`${dueAt}T00:00:00Z`);
  const ref = Date.parse(`${asOf}T00:00:00Z`);
  return Math.round((ref - due) / 86_400_000);
}

/** §3.11's bucket boundaries, as a pure function so the fixture test is exact. */
export function bucketFor(
  dueAt: string,
  asOf: string = ictToday()
): AgingBucket {
  const d = daysOverdue(dueAt, asOf);
  if (d <= 0) return "current";
  if (d <= 30) return "b30";
  if (d <= 60) return "b60";
  if (d <= 90) return "b90";
  return "b90plus";
}

export type AgingRow = {
  counterpartyId: number;
  counterpartyName: string;
  currency: string;
  current: bigint;
  b30: bigint;
  b60: bigint;
  b90: bigint;
  b90plus: bigint;
  total: bigint;
};

/**
 * Aging by counterparty and currency. Grouping by currency is not decoration:
 * summing a VND balance with a USD one produces a number that means nothing.
 */
export async function agingReport(
  opts: {
    counterpartyId?: number;
    currency?: string;
    asOf?: string;
  } = {}
): Promise<AgingRow[]> {
  const db = getDb();
  const asOf = opts.asOf ?? ictToday();

  const conditions = [
    inArray(invoices.status, [...OPEN_STATUSES]),
    isNull(invoices.deletedAt),
  ];
  if (opts.counterpartyId)
    conditions.push(eq(invoices.counterpartyId, opts.counterpartyId));
  if (opts.currency) conditions.push(eq(invoices.currency, opts.currency));

  const rows = await db
    .select({
      counterpartyId: invoices.counterpartyId,
      counterpartyName: counterparties.name,
      currency: invoices.currency,
      dueAt: invoices.dueAt,
      totalMinor: invoices.totalMinor,
      paidMinor: invoices.paidMinor,
    })
    .from(invoices)
    .leftJoin(counterparties, eq(counterparties.id, invoices.counterpartyId))
    .where(and(...conditions));

  // Bucketing happens in application code rather than in SQL DATEDIFF because
  // the boundary is an ICT calendar day, and MySQL's CURDATE() is the server's
  // timezone — which is UTC here, and would be wrong for seven hours a day.
  const grouped = new Map<string, AgingRow>();
  for (const row of rows) {
    const key = `${row.counterpartyId}:${row.currency}`;
    const outstanding =
      minorFromDb(row.totalMinor) - minorFromDb(row.paidMinor);
    if (outstanding <= 0n) continue;

    const entry =
      grouped.get(key) ??
      ({
        counterpartyId: row.counterpartyId,
        counterpartyName:
          row.counterpartyName ?? `Counterparty ${row.counterpartyId}`,
        currency: row.currency,
        current: 0n,
        b30: 0n,
        b60: 0n,
        b90: 0n,
        b90plus: 0n,
        total: 0n,
      } satisfies AgingRow);

    const bucket = bucketFor(String(row.dueAt), asOf);
    entry[bucket] += outstanding;
    entry.total += outstanding;
    grouped.set(key, entry);
  }

  return [...grouped.values()].sort((a, b) => (b.total > a.total ? 1 : -1));
}

export type ArSummary = {
  asOf: string;
  currencies: {
    currency: string;
    outstandingMinor: bigint;
    overdueMinor: bigint;
    /** §7.4 — money received that no invoice claims. Never rendered as zero. */
    suspenseMinor: bigint;
    openInvoices: number;
    unmatchedTransactions: number;
  }[];
};

/**
 * The AR summary. Suspense — unmatched and unallocated money — is a first-class
 * line, because §14.6 requires that unmatched money is never invisible.
 */
export async function arSummary(asOf: string = ictToday()): Promise<ArSummary> {
  const db = getDb();

  const openRows = await db
    .select({
      currency: invoices.currency,
      dueAt: invoices.dueAt,
      totalMinor: invoices.totalMinor,
      paidMinor: invoices.paidMinor,
    })
    .from(invoices)
    .where(
      and(
        inArray(invoices.status, [...OPEN_STATUSES]),
        isNull(invoices.deletedAt)
      )
    );

  // Suspense = received money minus what live allocations claim, for every
  // transaction not deliberately ignored.
  const suspenseRows = await db
    .select({
      currency: providerTransactions.currency,
      amountMinor: providerTransactions.amountMinor,
      matchStatus: providerTransactions.matchStatus,
      allocatedMinor: sql<
        string | null
      >`COALESCE((SELECT SUM(a.amountMinor) FROM payment_allocations a WHERE a.providerTransactionId = ${providerTransactions.id} AND a.reversedAt IS NULL), 0)`,
    })
    .from(providerTransactions);

  const byCurrency = new Map<string, ArSummary["currencies"][number]>();
  const bucketOf = (currency: string) => {
    const existing = byCurrency.get(currency);
    if (existing) return existing;
    const fresh = {
      currency,
      outstandingMinor: 0n,
      overdueMinor: 0n,
      suspenseMinor: 0n,
      openInvoices: 0,
      unmatchedTransactions: 0,
    };
    byCurrency.set(currency, fresh);
    return fresh;
  };

  for (const row of openRows) {
    const outstanding =
      minorFromDb(row.totalMinor) - minorFromDb(row.paidMinor);
    if (outstanding <= 0n) continue;
    const entry = bucketOf(row.currency);
    entry.outstandingMinor += outstanding;
    entry.openInvoices += 1;
    if (bucketFor(String(row.dueAt), asOf) !== "current")
      entry.overdueMinor += outstanding;
  }

  for (const row of suspenseRows) {
    if (row.matchStatus === "ignored") continue;
    const residual =
      minorFromDb(row.amountMinor) - minorFromDb(row.allocatedMinor ?? 0);
    if (residual <= 0n) continue;
    const entry = bucketOf(row.currency);
    entry.suspenseMinor += residual;
    if (row.matchStatus === "unmatched" || row.matchStatus === "ambiguous") {
      entry.unmatchedTransactions += 1;
    }
  }

  return { asOf, currencies: [...byCurrency.values()] };
}

/**
 * Nightly reconciliation — §13.3. This is the control that catches the bug the
 * tests missed, so it asserts rather than repairs: any failure pages on-call
 * with the offending ids.
 */
/**
 * Correlated sums for the §13.3 checks — with the outer column written out.
 *
 * These read as one-liners but the table qualification is load-bearing.
 * Interpolating a Drizzle column (`${invoices.id}`) into a raw subquery emits a
 * BARE `` `id` ``, because the outer query has a single table and Drizzle sees
 * no ambiguity to resolve. Inside the subquery there is: `payment_allocations
 * a` has an `id` of its own, so MySQL binds the innermost scope and the
 * predicate silently becomes `a.invoiceId = a.id`. The subquery stops being
 * correlated, every row gets the same total, and the job reports drift on every
 * invoice in the database.
 *
 * It passed for as long as it did because the table was empty: SUM over no rows
 * is 0, 0 == 0, and a reconciliation job that has never seen an allocation
 * cannot tell you it is broken. The first real allocation would have paged
 * on-call for every open invoice at once — and a control that cries wolf on a
 * healthy database gets muted, which is how the drift it exists to catch gets
 * through.
 */
const LIVE_ALLOCATIONS_FOR_INVOICE = sql<string | null>`COALESCE((SELECT SUM(a.amountMinor) FROM payment_allocations a WHERE a.invoiceId = \`invoices\`.\`id\` AND a.reversedAt IS NULL), 0)`;

const LIVE_ALLOCATIONS_FOR_TRANSACTION = sql<string | null>`COALESCE((SELECT SUM(a.amountMinor) FROM payment_allocations a WHERE a.providerTransactionId = \`provider_transactions\`.\`id\` AND a.reversedAt IS NULL), 0)`;

export type ReconciliationFinding = {
  check: string;
  invoiceId?: number;
  providerTransactionId?: number;
  detail: string;
};

export async function reconcile(): Promise<{
  ok: boolean;
  findings: ReconciliationFinding[];
}> {
  const db = getDb();
  const findings: ReconciliationFinding[] = [];

  // 1 · paidMinor == SUM(non-reversed allocations) for every invoice.
  const drift = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      paidMinor: invoices.paidMinor,
      allocated: LIVE_ALLOCATIONS_FOR_INVOICE,
    })
    .from(invoices)
    .where(isNull(invoices.deletedAt));

  for (const row of drift) {
    const paid = minorFromDb(row.paidMinor);
    const allocated = minorFromDb(row.allocated ?? 0);
    if (paid !== allocated) {
      findings.push({
        check: "invoice.paidMinor_matches_allocations",
        invoiceId: row.id,
        detail: `${row.invoiceNumber}: paidMinor=${paid} but live allocations sum to ${allocated}`,
      });
    }
    if (paid < 0n) {
      findings.push({
        check: "invoice.paidMinor_non_negative",
        invoiceId: row.id,
        detail: `${row.invoiceNumber}: paidMinor=${paid}`,
      });
    }
  }

  // 2 · SUM(allocations per transaction) <= transaction.amountMinor.
  const overAllocated = await db
    .select({
      id: providerTransactions.id,
      amountMinor: providerTransactions.amountMinor,
      matchStatus: providerTransactions.matchStatus,
      allocated: LIVE_ALLOCATIONS_FOR_TRANSACTION,
    })
    .from(providerTransactions);

  for (const row of overAllocated) {
    const amount = minorFromDb(row.amountMinor);
    const allocated = minorFromDb(row.allocated ?? 0);
    if (allocated > amount) {
      findings.push({
        check: "transaction.allocations_within_amount",
        providerTransactionId: row.id,
        detail: `allocations sum to ${allocated} but only ${amount} arrived`,
      });
    }
    // 3 · every matched transaction has at least one allocation.
    if (
      (row.matchStatus === "matched" || row.matchStatus === "manual_matched") &&
      allocated === 0n
    ) {
      findings.push({
        check: "matched_transaction_has_allocation",
        providerTransactionId: row.id,
        detail:
          "transaction is marked matched but nothing is allocated against it",
      });
    }
  }

  // 4 · no allocation crosses currencies without an fxRate.
  const crossCurrency = await db
    .select({
      id: paymentAllocations.id,
      allocationCurrency: paymentAllocations.currency,
      invoiceCurrency: invoices.currency,
      fxRate: paymentAllocations.fxRate,
    })
    .from(paymentAllocations)
    .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
    .where(isNull(paymentAllocations.reversedAt));

  for (const row of crossCurrency) {
    if (row.allocationCurrency !== row.invoiceCurrency && !row.fxRate) {
      findings.push({
        check: "allocation.fx_rate_present",
        detail: `allocation ${row.id} moves ${row.allocationCurrency} onto a ${row.invoiceCurrency} invoice with no fxRate`,
      });
    }
  }

  return { ok: findings.length === 0, findings };
}
