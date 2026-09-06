// Money — ISO 4217 minor units, sprint spec §2 and Appendix A.
//
// Rules this module exists to enforce:
//   · Every amount is a bigint count of minor units, never a float, never a Number.
//   · Every amount travels with its ISO 4217 currency code. A bare number is not money.
//   · The exponent is looked up from the currency, never inferred from the value —
//     VND has exponent 0 (₫1 is the minor unit), USD has exponent 2.
//   · Two amounts are never added without asserting equal currency (`addMoney`).
//
// The legacy `formatCents` helper in constants.ts assumes USD cents and is
// deprecated for new code; it stays for the existing catalog/orders surfaces.

export const SUPPORTED_CURRENCIES = ["VND", "USD", "EUR", "JPY"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** ISO 4217 exponents. Appendix A: VND → 0, USD → 2. JPY is exponent 0 like VND. */
const CURRENCY_EXPONENT: Record<Currency, number> = {
  VND: 0,
  USD: 2,
  EUR: 2,
  JPY: 0,
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  VND: "₫",
  USD: "$",
  EUR: "€",
  JPY: "¥",
};

export class MoneyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code} · ${message}`);
    this.code = code;
    this.name = "MoneyError";
  }
}

export function isCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function assertCurrency(value: string): Currency {
  if (!isCurrency(value)) {
    throw new MoneyError("GS-PAY-1010", `unsupported currency ${value}`);
  }
  return value;
}

export function exponentOf(currency: Currency): number {
  return CURRENCY_EXPONENT[currency];
}

/** A monetary amount. Minor units as bigint; the currency is not optional. */
export type Money = { amountMinor: bigint; currency: Currency };

export function money(
  amountMinor: bigint | number | string,
  currency: string
): Money {
  const c = assertCurrency(currency);
  return { amountMinor: toBigInt(amountMinor), currency: c };
}

function toBigInt(v: bigint | number | string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "string") return BigInt(v);
  if (!Number.isInteger(v)) {
    throw new MoneyError(
      "GS-PAY-1011",
      `minor units must be integral, got ${v}`
    );
  }
  if (!Number.isSafeInteger(v)) {
    throw new MoneyError(
      "GS-PAY-1011",
      `minor units exceed safe integer range: ${v}`
    );
  }
  return BigInt(v);
}

/**
 * Render an amount for display. Always includes the currency — §8.3 forbids a
 * bare monetary value in the UI. Grouping is applied to the major part only.
 */
export function formatMinor(
  amountMinor: bigint | number | string,
  currency: string,
  opts: { symbol?: boolean; locale?: string } = {}
): string {
  const c = assertCurrency(currency);
  const exp = CURRENCY_EXPONENT[c];
  const value = toBigInt(amountMinor);
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const divisor = 10n ** BigInt(exp);
  const major = abs / divisor;
  const minor = abs % divisor;

  const grouped = groupDigits(major.toString(), opts.locale ?? "en-US");
  const fraction = exp === 0 ? "" : `.${minor.toString().padStart(exp, "0")}`;
  const sign = negative ? "-" : "";

  if (opts.symbol === false) return `${sign}${grouped}${fraction} ${c}`;
  const symbol = CURRENCY_SYMBOL[c];
  // Đồng convention places the symbol after the figure; western currencies before.
  return c === "VND"
    ? `${sign}${grouped}${fraction}${symbol}`
    : `${sign}${symbol}${grouped}${fraction}`;
}

function groupDigits(digits: string, locale: string): string {
  // Vietnamese formatting uses "." as the thousands separator; en-US uses ",".
  const sep = locale.startsWith("vi") ? "." : ",";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Inverse of formatMinor: parse a human-entered or formatted amount back to
 * minor units. Accepts grouped digits, an optional symbol, and an optional
 * trailing/leading currency code. Round-trip stability is asserted in tests.
 */
export function parseMinor(input: string, currency: string): bigint {
  const c = assertCurrency(currency);
  const exp = CURRENCY_EXPONENT[c];

  let s = input.trim();
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1).trim();

  // Strip the currency code and any known symbol.
  s = s.replace(new RegExp(`\\b${c}\\b`, "gi"), "");
  for (const sym of Object.values(CURRENCY_SYMBOL)) s = s.split(sym).join("");
  s = s.trim();

  // Separate the fractional part before removing grouping separators, so that
  // "1.234" is unambiguous: with exponent 0 it is grouped, with exponent 2 the
  // final group of `exp` digits behind a separator is the fraction.
  let intPart = s;
  let fracPart = "";
  if (exp > 0) {
    const m = s.match(new RegExp(`^(.*)[.,](\\d{1,${exp}})$`));
    if (m) {
      intPart = m[1];
      fracPart = m[2];
    }
  }

  // NBSP and narrow NBSP are real thousands separators in the wild.
  intPart = intPart.replace(/[.,\s\u00a0\u202f']/g, "");
  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart) || (fracPart !== "" && !/^\d+$/.test(fracPart))) {
    throw new MoneyError("GS-PAY-1012", `cannot parse "${input}" as ${c}`);
  }

  const scaled =
    BigInt(intPart) * 10n ** BigInt(exp) +
    BigInt(fracPart.padEnd(exp, "0") || "0");
  return negative ? -scaled : scaled;
}

/** Add two amounts. Throws on currency mismatch — §Appendix A forbids raw `+`. */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function sumMoney(items: Money[], currency: Currency): Money {
  return items.reduce(addMoney, { amountMinor: 0n, currency });
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      "GS-PAY-1013",
      `currency mismatch: ${a.currency} vs ${b.currency} — convert with an explicit fxRate`
    );
  }
}

export function cmpMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amountMinor < b.amountMinor
    ? -1
    : a.amountMinor > b.amountMinor
      ? 1
      : 0;
}

export const isZero = (m: Money) => m.amountMinor === 0n;
export const isPositive = (m: Money) => m.amountMinor > 0n;

/**
 * Convert between currencies at an explicit rate, rounding half-up in the
 * target's minor units. `rate` is major-unit-to-major-unit (the shape a bank
 * quotes), expressed as a decimal string so no float ever touches money.
 */
export function convertMoney(
  from: Money,
  toCurrency: Currency,
  rate: string
): Money {
  const { num, den } = decimalToFraction(rate);
  const fromExp = BigInt(CURRENCY_EXPONENT[from.currency]);
  const toExp = BigInt(CURRENCY_EXPONENT[toCurrency]);

  // amountMinor / 10^fromExp * rate * 10^toExp, rounded half-up.
  const numerator = from.amountMinor * num * 10n ** toExp;
  const denominator = den * 10n ** fromExp;
  return {
    amountMinor: divRoundHalfUp(numerator, denominator),
    currency: toCurrency,
  };
}

function decimalToFraction(rate: string): { num: bigint; den: bigint } {
  const s = rate.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new MoneyError(
      "GS-PAY-1014",
      `fx rate must be a decimal string, got "${rate}"`
    );
  }
  const [intPart, fracPart = ""] = s.split(".");
  const num = BigInt(intPart.replace("-", "") + fracPart);
  const den = 10n ** BigInt(fracPart.length);
  return { num: s.startsWith("-") ? -num : num, den };
}

/** Banker-free, deterministic half-up division on bigints (sign-aware). */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n)
    throw new MoneyError("GS-PAY-1015", "division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = n / d;
  const r = n % d;
  const rounded = r * 2n >= d ? q + 1n : q;
  return negative ? -rounded : rounded;
}

/**
 * MySQL bigint columns come back from mysql2 as a JS number when they fit and a
 * string when they do not, depending on driver config. Normalise at the edge.
 */
export function minorFromDb(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return toBigInt(value);
  if (typeof value === "string") return BigInt(value);
  if (value == null) return 0n;
  throw new MoneyError(
    "GS-PAY-1016",
    `cannot read minor units from ${typeof value}`
  );
}

/**
 * Serialise for the wire. superjson carries bigint natively, but provider APIs
 * and JSON columns do not — send a decimal string, never a float.
 */
export const minorToString = (v: bigint): string => v.toString();

/**
 * bigint headroom check (Appendix A). Signed 64-bit; a VND invoice cannot
 * exceed ~9.2 × 10^18 đồng, which is far past any real container contract, but
 * an overflowing value must fail loudly rather than truncate (B3).
 */
export const INT64_MAX = 9223372036854775807n;
export const INT64_MIN = -9223372036854775808n;

export function assertFitsInt64(amountMinor: bigint, label = "amount"): bigint {
  if (amountMinor > INT64_MAX || amountMinor < INT64_MIN) {
    throw new MoneyError(
      "GS-PAY-1017",
      `${label} overflows a 64-bit money column`
    );
  }
  return amountMinor;
}
