// Foreign exchange — §3.3.
//
// The previous sprint captured `payment_allocations.fxRate` and stopped there,
// with a note: "Realized FX difference is computed and posted to a
// fx_adjustments ledger — out of scope for the sprint, but the rate must be
// captured now or the difference is unrecoverable later." The rate was
// captured. This closes the other half.
//
// The difference is real money. An invoice raised at 25,000 ₫/$ and settled at
// 26,000 ₫/$ did not "round" — somebody gained and somebody lost, and on a
// container contract the gap is thousands of dollars.
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { commercialContracts, fxAdjustments, fxRates, invoices } from "@db/schema";
import { env } from "../../lib/env";
import { assertCurrency, convertMoney, minorFromDb, type Currency } from "@contracts/money";

/** A rate is never a bare number: it carries where it came from and when. */
export type QuotedRate = {
  base: Currency;
  quote: Currency;
  /** Decimal string. 1 unit of `base` buys this many units of `quote`. */
  rate: string;
  source: string;
  observedAt: Date;
};

export class FxError extends Error {}

/**
 * Convert using an explicit rate, rounding half-up in the target currency.
 * Delegates to the money module so no float ever touches an amount.
 */
export function convertAtRate(
  amountMinor: bigint,
  from: string,
  to: string,
  rate: string
): bigint {
  const fromCurrency = assertCurrency(from);
  const toCurrency = assertCurrency(to);
  if (fromCurrency === toCurrency) return amountMinor;
  return convertMoney({ amountMinor, currency: fromCurrency }, toCurrency, rate).amountMinor;
}

/**
 * The realized difference on one allocation, expressed in the INVOICE currency.
 *
 * Positive = we received more invoice-currency value than expected (a gain).
 * Negative = a loss. The sign convention matters: an accountant reading this
 * ledger needs to know which way the money went without re-deriving it.
 */
export function realizedDifferenceMinor(args: {
  paymentAmountMinor: bigint;
  paymentCurrency: string;
  invoiceCurrency: string;
  appliedRate: string;
  expectedRate: string | null;
}): bigint {
  if (args.paymentCurrency === args.invoiceCurrency) return 0n;
  if (!args.expectedRate) return 0n;

  const atApplied = convertAtRate(
    args.paymentAmountMinor,
    args.paymentCurrency,
    args.invoiceCurrency,
    args.appliedRate
  );
  const atExpected = convertAtRate(
    args.paymentAmountMinor,
    args.paymentCurrency,
    args.invoiceCurrency,
    args.expectedRate
  );
  return atApplied - atExpected;
}

/**
 * Most recent rate for a pair. Rates are append-only, so "current" is simply
 * the newest observation — which also means a historical conversion can always
 * be re-derived from the row that was current at the time.
 */
export async function latestRate(
  base: string,
  quote: string
): Promise<QuotedRate | null> {
  if (base === quote) {
    return {
      base: assertCurrency(base),
      quote: assertCurrency(quote),
      rate: "1",
      source: "identity",
      observedAt: new Date(),
    };
  }
  const [row] = await getDb()
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.baseCurrency, base), eq(fxRates.quoteCurrency, quote)))
    .orderBy(desc(fxRates.observedAt), desc(fxRates.id))
    .limit(1);
  if (!row) return null;
  return {
    base: assertCurrency(row.baseCurrency),
    quote: assertCurrency(row.quoteCurrency),
    rate: row.rate,
    source: row.source,
    observedAt: row.observedAt,
  };
}

/** Record an observation. Append-only: rates are never updated in place. */
export async function recordRate(quote: QuotedRate): Promise<number> {
  if (!/^\d+(\.\d{1,6})?$/.test(quote.rate)) {
    throw new FxError(`GS-FX-1001 · rate must be a positive decimal string, got "${quote.rate}"`);
  }
  const [res] = await getDb().insert(fxRates).values({
    baseCurrency: quote.base,
    quoteCurrency: quote.quote,
    rate: quote.rate,
    source: quote.source,
    observedAt: quote.observedAt,
  });
  return Number(res.insertId);
}

/**
 * Fetch a live rate from the configured provider and record it.
 *
 * Returns null rather than throwing when no provider is configured: a missing
 * rate feed must not break invoicing, it must make the operator supply a rate
 * by hand.
 */
export async function refreshRate(
  base: string,
  quote: string,
  deps: { fetchImpl?: typeof fetch; apiUrl?: string; apiKey?: string } = {}
): Promise<QuotedRate | null> {
  const apiUrl = deps.apiUrl ?? env.fxRateApiUrl;
  if (!apiUrl) return null;

  const doFetch = deps.fetchImpl ?? fetch;
  let response: Response;
  try {
    const url = `${apiUrl}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`;
    response = await doFetch(url, {
      headers: (deps.apiKey ?? env.fxRateApiKey)
        ? { Authorization: `Bearer ${deps.apiKey ?? env.fxRateApiKey}` }
        : {},
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let payload: { rates?: Record<string, unknown> };
  try {
    payload = (await response.json()) as { rates?: Record<string, unknown> };
  } catch {
    return null;
  }
  const raw = payload?.rates?.[quote];
  if (raw == null) return null;

  // A float from an API becomes a decimal string before it touches money.
  const rate = typeof raw === "number" ? raw.toFixed(6) : String(raw);
  if (!/^\d+(\.\d+)?$/.test(rate)) return null;

  const quoted: QuotedRate = {
    base: assertCurrency(base),
    quote: assertCurrency(quote),
    rate: Number(rate).toFixed(6),
    source: "live",
    observedAt: new Date(),
  };
  await recordRate(quoted);
  return quoted;
}

/**
 * The rate an allocation should use, and the rate it was expected to use.
 *
 * `expected` is the contract's locked rate where the invoice is raised against
 * a contract that locked one — that is the number the deal was priced on, and
 * therefore the only honest baseline for a realized difference. Falling back to
 * the applied rate yields a zero difference, which is correct: with no
 * expectation there is no gain or loss to recognise.
 */
export async function resolveRatesForAllocation(args: {
  invoiceId: number;
  paymentCurrency: string;
  invoiceCurrency: string;
  /** Operator-supplied rate, when the UI collected one. */
  appliedRate?: string | null;
}): Promise<{ appliedRate: string; expectedRate: string | null; source: string } | null> {
  if (args.paymentCurrency === args.invoiceCurrency) {
    return { appliedRate: "1", expectedRate: "1", source: "identity" };
  }

  const db = getDb();
  let applied = args.appliedRate ?? null;
  let source = applied ? "operator" : "";

  if (!applied) {
    const quoted = await latestRate(args.paymentCurrency, args.invoiceCurrency);
    if (!quoted) return null;
    applied = quoted.rate;
    source = quoted.source;
  }

  // Contract-locked rate, when this invoice is raised against a contract.
  let expected: string | null = null;
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, args.invoiceId) });
  if (invoice?.payableType === "contract") {
    const contract = await db.query.commercialContracts.findFirst({
      where: eq(commercialContracts.id, invoice.payableId),
    });
    if (contract?.fxRateLocked) expected = contract.fxRateLocked;
  }

  return { appliedRate: applied, expectedRate: expected, source };
}

/**
 * Post the realized difference for one allocation.
 *
 * Unique on allocationId, so a retried allocation cannot book the same gain
 * twice. A zero difference is still recorded: "we checked and it was nil" is a
 * different statement from "we never looked", and only one of them survives an
 * audit.
 */
export async function postFxAdjustment(args: {
  invoiceId: number;
  allocationId: number;
  invoiceCurrency: string;
  paymentCurrency: string;
  paymentAmountMinor: bigint;
  appliedRate: string;
  expectedRate: string | null;
  rateSource: string;
}): Promise<{ adjustmentId: number; realizedMinor: bigint }> {
  const realizedMinor = realizedDifferenceMinor({
    paymentAmountMinor: args.paymentAmountMinor,
    paymentCurrency: args.paymentCurrency,
    invoiceCurrency: args.invoiceCurrency,
    appliedRate: args.appliedRate,
    expectedRate: args.expectedRate,
  });

  const [res] = await getDb().insert(fxAdjustments).values({
    invoiceId: args.invoiceId,
    allocationId: args.allocationId,
    invoiceCurrency: args.invoiceCurrency,
    paymentCurrency: args.paymentCurrency,
    appliedRate: args.appliedRate,
    expectedRate: args.expectedRate,
    realizedMinor,
    rateSource: args.rateSource,
  });
  return { adjustmentId: Number(res.insertId), realizedMinor };
}

/** Realized FX by currency, for the finance view. */
export async function fxPosition(): Promise<
  { invoiceCurrency: string; realizedMinor: bigint; adjustments: number }[]
> {
  const rows = await getDb()
    .select({
      invoiceCurrency: fxAdjustments.invoiceCurrency,
      realizedMinor: fxAdjustments.realizedMinor,
    })
    .from(fxAdjustments);

  const byCurrency = new Map<string, { realizedMinor: bigint; adjustments: number }>();
  for (const row of rows) {
    const entry = byCurrency.get(row.invoiceCurrency) ?? { realizedMinor: 0n, adjustments: 0 };
    entry.realizedMinor += minorFromDb(row.realizedMinor);
    entry.adjustments += 1;
    byCurrency.set(row.invoiceCurrency, entry);
  }
  return [...byCurrency.entries()].map(([invoiceCurrency, v]) => ({ invoiceCurrency, ...v }));
}
