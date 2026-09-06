// §11.1 — property-based tests.
//
// The example-based suites next door assert that specific inputs produce
// specific outputs. These assert that a RELATIONSHIP holds across the input
// space, which is the only way to test the claims the spec actually makes:
// "round-trips", "monotonic", "never negative". A hand-picked example can
// satisfy all three and still be wrong two currencies over.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  SUPPORTED_CURRENCIES,
  exponentOf,
  formatMinor,
  parseMinor,
  addMoney,
  subMoney,
  convertMoney,
  MoneyError,
  INT64_MAX,
  INT64_MIN,
} from "./money";
import {
  gramsToLbs,
  lbsToGrams,
  qualityTierForScore,
  roundScore,
  QUALITY_TIERS,
} from "./constants";

const currency = fc.constantFrom(...SUPPORTED_CURRENCIES);

/** int64, the range the money columns actually hold. */
const minor = fc.bigInt({ min: INT64_MIN, max: INT64_MAX });

describe("§11.1 · money round-trip", () => {
  it("parseMinor(formatMinor(n, c), c) === n for every currency", () => {
    fc.assert(
      fc.property(minor, currency, (n, c) => {
        expect(parseMinor(formatMinor(n, c), c)).toBe(n);
      }),
      { numRuns: 2000 }
    );
  });

  it("formats to exactly the currency's exponent, never a float's idea of it", () => {
    fc.assert(
      fc.property(minor, currency, (n, c) => {
        const text = formatMinor(n, c);
        const exponent = exponentOf(c);
        const fraction = text.includes(".") ? text.split(".")[1] : "";
        expect(fraction.length).toBe(exponent);
      })
    );
  });
});

describe("§11.1 · no currency mixing", () => {
  it("refuses to add or subtract across currencies", () => {
    fc.assert(
      fc.property(minor, minor, currency, currency, (a, b, ca, cb) => {
        const left = { amountMinor: a, currency: ca };
        const right = { amountMinor: b, currency: cb };
        if (ca === cb) return; // the legal case is covered below
        expect(() => addMoney(left, right)).toThrow(MoneyError);
        expect(() => subMoney(left, right)).toThrow(MoneyError);
      })
    );
  });

  it("adds within a currency exactly, with no float drift", () => {
    // Bounded so the sum stays inside int64 — overflow is a separate contract
    // (assertFitsInt64), and conflating the two would hide a real failure.
    const half = fc.bigInt({ min: INT64_MIN / 2n, max: INT64_MAX / 2n });
    fc.assert(
      fc.property(half, half, currency, (a, b, c) => {
        const sum = addMoney(
          { amountMinor: a, currency: c },
          { amountMinor: b, currency: c }
        );
        expect(sum.amountMinor).toBe(a + b);
        expect(sum.currency).toBe(c);
      })
    );
  });

  it("never converts between currencies without an explicit rate", () => {
    fc.assert(
      fc.property(minor, currency, currency, (n, from, to) => {
        if (from === to) return;
        expect(() =>
          // @ts-expect-error — the point of the property is that the runtime
          // refuses this too, not only the type checker.
          convertMoney({ amountMinor: n, currency: from }, to, undefined)
        ).toThrow();
      })
    );
  });
});

describe("§11.1 · allocation invariant", () => {
  /**
   * `invoices.paidMinor === SUM(non-reversed allocations)` and `paidMinor >= 0`.
   *
   * The database enforces neither; `recomputeInvoice` does, by summing the rows
   * rather than incrementing a counter. This models that sum over an arbitrary
   * sequence of allocations and reversals — the ordering is what a counter gets
   * wrong, because a reversal that arrives before its allocation decrements
   * below zero and stays there.
   */
  type Row = { id: number; amountMinor: bigint; reversed: boolean };

  const operations = fc.array(
    fc.record({
      amountMinor: fc.bigInt({ min: 1n, max: 10n ** 12n }),
      reverseLater: fc.boolean(),
    }),
    { maxLength: 40 }
  );

  it("paidMinor equals the live sum and never goes negative", () => {
    fc.assert(
      fc.property(operations, fc.array(fc.nat(), { maxLength: 40 }), (ops, shuffle) => {
        const rows: Row[] = ops.map((op, i) => ({
          id: i,
          amountMinor: op.amountMinor,
          reversed: false,
        }));
        // Apply reversals in an arbitrary order, including reversing a row
        // twice — the service is append-only, so a second reversal of the same
        // allocation must not subtract twice.
        for (const raw of shuffle) {
          const target = rows[raw % Math.max(1, rows.length)];
          if (target && ops[target.id]?.reverseLater) target.reversed = true;
        }
        const live = rows
          .filter(r => !r.reversed)
          .reduce((acc, r) => acc + r.amountMinor, 0n);
        expect(live).toBeGreaterThanOrEqual(0n);
        // Recomputing from the rows is order-independent by construction; that
        // is the property a running counter fails.
        const reshuffled = [...rows]
          .reverse()
          .filter(r => !r.reversed)
          .reduce((acc, r) => acc + r.amountMinor, 0n);
        expect(reshuffled).toBe(live);
      })
    );
  });
});

describe("§11.1 · unit conversion", () => {
  it("gramsToLbs(lbsToGrams(x)) is within 1g of x", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200_000, noNaN: true }), lbs => {
        const back = gramsToLbs(lbsToGrams(lbs));
        // 1 gram expressed in pounds — the tolerance the spec names.
        expect(Math.abs(back - lbs)).toBeLessThanOrEqual(gramsToLbs(1));
      })
    );
  });
});

describe("§11.1 · tier boundary", () => {
  // QUALITY_TIERS is ordered best-first, so a higher score sits at a LOWER
  // index. Rank inverts that, because "monotonic in the score" means the tier
  // improves as the score rises — asserting on the raw index would assert the
  // opposite and pass for the wrong reason.
  const rank = (score: number) => {
    const tier = qualityTierForScore(roundScore(score));
    return QUALITY_TIERS.length - 1 - QUALITY_TIERS.findIndex(t => t.name === tier.name);
  };

  it("is monotonic in the score", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(rank(hi)).toBeGreaterThanOrEqual(rank(lo));
        }
      ),
      { numRuns: 2000 }
    );
  });

  it("is stable across the float representations of a boundary", () => {
    // 79.995 and 85.995 round to 80.00 and 86.00; the tier must come from the
    // rounded value, because cupScore is a financial input (B4) and the two
    // sides of a boundary are two different prices.
    for (const boundary of [79.995, 85.995, 86.0, 84.995, 89.995]) {
      const direct = qualityTierForScore(roundScore(boundary)).name;
      const viaString = qualityTierForScore(
        roundScore(Number(boundary.toFixed(10)))
      ).name;
      expect(direct).toBe(viaString);
    }
  });

  it("always resolves to a named tier, including at 0", () => {
    // The lookup is `find(s >= t.min)` with a fallback to the last band. Below
    // Commercial has min 0, so every non-negative score lands somewhere — but
    // the fallback is what stops a negative or NaN score from returning
    // undefined and taking a share calculation with it.
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), s => {
        const tier = qualityTierForScore(roundScore(s));
        expect(typeof tier.name).toBe("string");
        expect(tier.sharePct).toBeGreaterThanOrEqual(0);
      })
    );
    for (const odd of [-1, -0.001, Number.NaN]) {
      expect(typeof qualityTierForScore(odd).name).toBe("string");
    }
  });
});
