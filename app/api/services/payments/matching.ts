// Matching engine — sprint spec §7.1.
//
// The decision is a pure function of the transaction and the candidate set, so
// it is testable without a database and its behaviour is legible in one place.
// The database lookups that build the candidate set live in resolveMatch().
//
// Matching order, highest confidence first:
//   1. Exact memoToken in the description        → matched
//   2. PayOS orderCode → payment_intents row     → matched
//   3. Exactly one open invoice for a counterparty identified by
//      counterAccountNumber AND an exact amount  → matched, flagged heuristic
//   4. Otherwise                                 → unmatched or ambiguous
//
// NEVER match on amount alone. Two farmers paying the same round number on the
// same day is not a hypothetical.
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { counterparties, invoices, paymentIntents } from "@db/schema";
import { extractMemoTokens } from "./memo";

export type MatchMethod = "memo_token" | "order_code" | "heuristic" | "manual";
export type MatchStatus = "unmatched" | "matched" | "ambiguous";

export type MatchInput = {
  description: string;
  amountMinor: bigint;
  currency: string;
  providerOrderCode?: number | null;
  counterAccountNumber?: string | null;
};

/** Open invoices that could plausibly receive this money. */
export type InvoiceCandidate = {
  id: number;
  memoToken: string;
  counterpartyId: number;
  currency: string;
  totalMinor: bigint;
  paidMinor: bigint;
  status: string;
};

export type MatchCandidates = {
  /** Invoices whose memoToken appears in the description. */
  byMemoToken: InvoiceCandidate[];
  /** Invoice reached via a payment intent carrying the provider's orderCode. */
  byOrderCode: InvoiceCandidate | null;
  /** Open invoices for the counterparty identified by their bank account. */
  byCounterAccount: InvoiceCandidate[];
};

export type MatchDecision = {
  status: MatchStatus;
  method: MatchMethod | null;
  invoiceId: number | null;
  reason: string;
  /** Heuristic matches are correct often enough to propose, never to trust. */
  requiresReview: boolean;
};

const OPEN_STATUSES = ["issued", "partially_paid", "overpaid"] as const;

export function isOpen(invoice: Pick<InvoiceCandidate, "status">): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(invoice.status);
}

export function outstandingMinor(invoice: InvoiceCandidate): bigint {
  const remaining = invoice.totalMinor - invoice.paidMinor;
  return remaining > 0n ? remaining : 0n;
}

/**
 * The whole matching policy, as a pure function. Given the same transaction and
 * candidates it always returns the same decision — which is what makes the
 * ambiguous cases reviewable rather than mysterious.
 */
export function decideMatch(
  input: MatchInput,
  candidates: MatchCandidates
): MatchDecision {
  // ── 1 · memo token ────────────────────────────────────────────────────────
  const tokens = extractMemoTokens(input.description);
  if (candidates.byMemoToken.length === 1 && tokens.length >= 1) {
    const invoice = candidates.byMemoToken[0];
    if (invoice.currency !== input.currency) {
      // A cross-currency transfer is a real allocation, but it needs an fxRate
      // a machine has no business choosing (§7.5).
      return {
        status: "ambiguous",
        method: "memo_token",
        invoiceId: invoice.id,
        reason: `memo token resolves to invoice ${invoice.id} in ${invoice.currency}, payment is ${input.currency} — needs an explicit fx rate`,
        requiresReview: true,
      };
    }
    return {
      status: "matched",
      method: "memo_token",
      invoiceId: invoice.id,
      reason: "exact memo token in description",
      requiresReview: false,
    };
  }
  if (candidates.byMemoToken.length > 1) {
    return {
      status: "ambiguous",
      method: "memo_token",
      invoiceId: null,
      reason: `description carries ${candidates.byMemoToken.length} memo tokens`,
      requiresReview: true,
    };
  }

  // ── 2 · provider order code ───────────────────────────────────────────────
  if (input.providerOrderCode != null && candidates.byOrderCode) {
    const invoice = candidates.byOrderCode;
    if (invoice.currency !== input.currency) {
      return {
        status: "ambiguous",
        method: "order_code",
        invoiceId: invoice.id,
        reason: `order code resolves to invoice ${invoice.id} in ${invoice.currency}, payment is ${input.currency}`,
        requiresReview: true,
      };
    }
    return {
      status: "matched",
      method: "order_code",
      invoiceId: invoice.id,
      reason: `payment intent orderCode ${input.providerOrderCode}`,
      requiresReview: false,
    };
  }

  // ── 3 · heuristic: one open invoice, exact amount, known bank account ──────
  if (input.counterAccountNumber && candidates.byCounterAccount.length > 0) {
    const exact = candidates.byCounterAccount.filter(
      i =>
        i.currency === input.currency &&
        outstandingMinor(i) === input.amountMinor
    );
    if (exact.length === 1) {
      return {
        status: "matched",
        method: "heuristic",
        invoiceId: exact[0].id,
        reason:
          "sole open invoice for this bank account, amount matches exactly",
        // Flagged for review: correct most of the time is not the same as
        // correct, and this path never runs without a human unless
        // autoAllocation is on.
        requiresReview: true,
      };
    }
    if (exact.length > 1) {
      return {
        status: "ambiguous",
        method: "heuristic",
        invoiceId: null,
        reason: `${exact.length} open invoices for this bank account match the amount exactly`,
        requiresReview: true,
      };
    }
  }

  // ── 4 · unmatched ─────────────────────────────────────────────────────────
  return {
    status: "unmatched",
    method: null,
    invoiceId: null,
    reason: tokens.length
      ? "memo token is well-formed but matches no open invoice"
      : "no memo token, no order code, and no unambiguous account match",
    requiresReview: true,
  };
}

/** Build the candidate set from the database, then apply the pure policy. */
export async function resolveMatch(input: MatchInput): Promise<MatchDecision> {
  const db = getDb();
  const tokens = extractMemoTokens(input.description);

  const byMemoToken = tokens.length
    ? await db
        .select(candidateColumns)
        .from(invoices)
        .where(
          and(inArray(invoices.memoToken, tokens), isNull(invoices.deletedAt))
        )
    : [];

  let byOrderCode: InvoiceCandidate | null = null;
  if (input.providerOrderCode != null) {
    const intent = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.providerOrderCode, input.providerOrderCode),
    });
    if (intent) {
      const rows = await db
        .select(candidateColumns)
        .from(invoices)
        .where(
          and(eq(invoices.id, intent.invoiceId), isNull(invoices.deletedAt))
        )
        .limit(1);
      byOrderCode = rows[0] ?? null;
    }
  }

  let byCounterAccount: InvoiceCandidate[] = [];
  if (input.counterAccountNumber) {
    // Only the last four digits are stored in plaintext (§12.2), so operator
    // matching and this heuristic both key on them.
    const last4 = input.counterAccountNumber.trim().slice(-4);
    const parties = await db
      .select({ id: counterparties.id })
      .from(counterparties)
      .where(
        and(
          eq(counterparties.bankAccountLast4, last4),
          isNull(counterparties.deletedAt)
        )
      );
    if (parties.length === 1) {
      byCounterAccount = await db
        .select(candidateColumns)
        .from(invoices)
        .where(
          and(
            eq(invoices.counterpartyId, parties[0].id),
            inArray(invoices.status, [...OPEN_STATUSES]),
            isNull(invoices.deletedAt)
          )
        );
    }
  }

  return decideMatch(input, {
    byMemoToken: byMemoToken.filter(isOpen),
    byOrderCode: byOrderCode && isOpen(byOrderCode) ? byOrderCode : null,
    byCounterAccount,
  });
}

const candidateColumns = {
  id: invoices.id,
  memoToken: invoices.memoToken,
  counterpartyId: invoices.counterpartyId,
  currency: invoices.currency,
  totalMinor: invoices.totalMinor,
  paidMinor: invoices.paidMinor,
  status: invoices.status,
};

/** Open invoices, for the exception-queue "allocate to…" picker. */
export async function openInvoicesForCounterparty(counterpartyId: number) {
  return getDb()
    .select(candidateColumns)
    .from(invoices)
    .where(
      and(
        eq(invoices.counterpartyId, counterpartyId),
        inArray(invoices.status, [...OPEN_STATUSES]),
        isNull(invoices.deletedAt),
        ne(invoices.status, "void")
      )
    );
}
