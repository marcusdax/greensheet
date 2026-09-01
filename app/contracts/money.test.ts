// Sprint spec §11.1 — property-based money, unit and tier-boundary assertions.
// fast-check is not a dependency of this repo, so the "for all" cases are driven
// by a small deterministic generator (seeded LCG) plus every boundary value the
// spec calls out by name. Deterministic beats flaky for a money invariant.
import { describe, it, expect } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  formatMinor,
  parseMinor,
  addMoney,
  subMoney,
  convertMoney,
  divRoundHalfUp,
  money,
  assertFitsInt64,
  minorFromDb,
  exponentOf,
  MoneyError,
  INT64_MAX,
  type Currency,
} from "./money";
import { roundScore, qualityTierForScore, lbsToGrams, gramsToLbs } from "./constants";

/** Deterministic pseudo-random bigints, so a failure reproduces exactly. */
function* sampleAmounts(seed = 42, count = 400): Generator<bigint> {
  let s = BigInt(seed);
  const m = 2n ** 63n - 25n;
  for (let i = 0; i < count; i++) {
    s = (s * 6364136223846793005n + 1442695040888963407n) % m;
    const magnitude = BigInt(i % 19); // sweep 10^0 … 10^18
    const v = (s % 10n ** (magnitude + 1n)) * (i % 3 === 0 ? -1n : 1n);
    yield v;
  }
}

describe("money round-trip (§11.1)", () => {
  it("parseMinor(formatMinor(n, c), c) === n for every currency", () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      for (const n of sampleAmounts()) {
        const rendered = formatMinor(n, currency);
        expect(parseMinor(rendered, currency), `${currency} ${n}`).toBe(n);
      }
    }
  });

  it("round-trips the named boundary values, including the ₫5bn invoice", () => {
    // §14.7 — an invoice of ₫5,000,000,000 must survive the whole path.
    expect(parseMinor(formatMinor(5_000_000_000n, "VND"), "VND")).toBe(5_000_000_000n);
    expect(formatMinor(5_000_000_000n, "VND")).toBe("5,000,000,000₫");
    // The container contract from B3 that overflows a signed int.
    expect(parseMinor(formatMinor(3_900_000_000n, "VND"), "VND")).toBe(3_900_000_000n);
    expect(formatMinor(148_000_00n, "USD")).toBe("$148,000.00");
    expect(parseMinor("$148,000.00", "USD")).toBe(14_800_000n);
    expect(formatMinor(0n, "VND")).toBe("0₫");
    expect(formatMinor(-1n, "USD")).toBe("-$0.01");
  });

  it("never truncates a value that would overflow a signed 32-bit column (B3)", () => {
    const overflowing = 3_900_000_000n; // > 2,147,483,647
    expect(assertFitsInt64(overflowing)).toBe(overflowing);
    expect(() => assertFitsInt64(INT64_MAX + 1n)).toThrow(MoneyError);
  });

  it("reads bigint columns back from any driver representation", () => {
    expect(minorFromDb("5000000000")).toBe(5_000_000_000n);
    expect(minorFromDb(1234)).toBe(1234n);
    expect(minorFromDb(9007199254740993n)).toBe(9007199254740993n);
    expect(minorFromDb(null)).toBe(0n);
    expect(() => minorFromDb(1.5)).toThrow(MoneyError);
  });

  it("derives the exponent from the currency, never from the value", () => {
    expect(exponentOf("VND")).toBe(0);
    expect(exponentOf("USD")).toBe(2);
    // 100 minor units is ₫100 but $1.00 — same number, different money.
    expect(formatMinor(100n, "VND")).toBe("100₫");
    expect(formatMinor(100n, "USD")).toBe("$1.00");
  });
});

describe("no currency mixing (§11.1)", () => {
  it("addMoney throws on mismatched currency", () => {
    const vnd = money(1000n, "VND");
    const usd = money(1000n, "USD");
    expect(() => addMoney(vnd, usd)).toThrow(/GS-PAY-1013/);
    expect(() => subMoney(vnd, usd)).toThrow(/GS-PAY-1013/);
    expect(addMoney(vnd, vnd).amountMinor).toBe(2000n);
  });

  it("rejects an unsupported currency code at the boundary", () => {
    expect(() => money(1n, "XYZ")).toThrow(/GS-PAY-1010/);
  });

  it("converts only with an explicit rate, rounding half-up in the target", () => {
    // $1.00 at 26,000 ₫/$ is ₫26,000 — exponent 2 → exponent 0.
    expect(convertMoney(money(100n, "USD"), "VND", "26000").amountMinor).toBe(26_000n);
    // ₫26,000 back at the same rate is $1.00.
    expect(convertMoney(money(26_000n, "VND"), "USD", "0.0000384615").amountMinor).toBe(100n);
    expect(divRoundHalfUp(5n, 2n)).toBe(3n); // half-up, not half-even
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n); // sign-symmetric
  });
});

describe("unit conversion (§3.4, §11.1)", () => {
  it("gramsToLbs(lbsToGrams(x)) round-trips within 1g", () => {
    for (let lbs = 0; lbs <= 60_000; lbs += 137) {
      const grams = lbsToGrams(lbs);
      const back = gramsToLbs(grams);
      expect(Math.abs(lbsToGrams(back) - grams)).toBeLessThanOrEqual(1);
    }
  });

  it("uses one rounding rule for a full container", () => {
    expect(lbsToGrams(42_328)).toBe(Math.round(42_328 * 453.59237));
  });
});

describe("cup-score tier boundaries (B4, §11.1)", () => {
  it("rounds to 2dp before comparing", () => {
    expect(roundScore(82.754999)).toBe(82.75);
    expect(roundScore(85.995)).toBe(86);
  });

  it("is stable across the float representations the spec names", () => {
    // 85.995 used to fall through every range and pay 0%. It is Premium now.
    expect(qualityTierForScore(85.995).sharePct).toBe(50);
    expect(qualityTierForScore(86.0).sharePct).toBe(50);
    expect(qualityTierForScore(85.99).sharePct).toBe(35);
    expect(qualityTierForScore(79.995).sharePct).toBe(35);
    expect(qualityTierForScore(79.99).sharePct).toBe(20);
    expect(qualityTierForScore(82.75).sharePct).toBe(35); // the brochure's CQI 82.75
    expect(qualityTierForScore(0).sharePct).toBe(0);
  });

  it("is monotonic in score — a higher cup score never pays a lower share", () => {
    let previous = 0;
    for (let s = 0; s <= 100; s += 0.05) {
      const pct = qualityTierForScore(s).sharePct;
      expect(pct).toBeGreaterThanOrEqual(previous);
      previous = pct;
    }
  });

  it("leaves no score without a tier", () => {
    for (let s = 0; s <= 100; s += 0.25) {
      expect(qualityTierForScore(s)).toBeDefined();
    }
  });
});

describe("formatMinor always carries its currency (§8.3)", () => {
  it("renders a code when the symbol is suppressed", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      const out = formatMinor(123456n, c as Currency, { symbol: false });
      expect(out.endsWith(c)).toBe(true);
    }
  });

  it("groups Vietnamese figures with dots when asked", () => {
    expect(formatMinor(5_000_000_000n, "VND", { locale: "vi-VN" })).toBe("5.000.000.000₫");
  });
});
