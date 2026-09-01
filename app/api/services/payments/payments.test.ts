// Sprint spec §11 and §14 — the acceptance criteria as executable assertions.
//
// These are the pure-logic halves of the sprint's test plan: matching policy,
// memo tokens, signature verification, idempotency semantics, aging buckets and
// the VietQR payload. The integration cases (§11.2) and chaos cases (§11.4)
// need a real MySQL container and live alongside these under the same names.
import { describe, it, expect } from "vitest";
import {
  memoTokenFor,
  isValidMemoToken,
  invoiceIdFromMemoToken,
  extractMemoTokens,
  normalizeDescription,
  MEMO_TOKEN_LENGTH,
} from "./memo";
import { decideMatch, outstandingMinor, type MatchCandidates } from "./matching";
import { statusFor } from "./allocation";
import { canonicalJson, fingerprint } from "./idempotency";
import { bucketFor, daysOverdue, ictToday } from "./aging";
import { vatMinorFor, formatInvoiceNumber, assertCurrencyAllowed } from "./invoicing";
import { buildVietQrPayload, crc16, tlv, verifyVietQrPayload } from "./vietqr";
import {
  canonicalPayosPayload,
  signPayosPayload,
  verifyPayosSignature,
  normalizePayos,
  parseAmount,
  parseProviderDate,
} from "./payos";
import { normalizeCassoBatch, verifyCassoToken } from "./casso";
import { gateForField, assertConfidenceCoverage } from "@contracts/ocr-schemas";
import { nextAvailableAt, shouldDeadLetter, RETRY_BACKOFF_SECONDS } from "../outbox/registry";

// ─── §7.1 memo token ─────────────────────────────────────────────────────────
describe("memo token (§7.1)", () => {
  it("is ten uppercase alphanumeric characters with the AUC prefix", () => {
    for (const id of [1, 42, 1000, 999_999, 1_073_741_823]) {
      const token = memoTokenFor(id);
      expect(token).toHaveLength(MEMO_TOKEN_LENGTH);
      expect(token).toMatch(/^AUC[0-9A-HJKMNP-TV-Z]{7}$/);
      expect(isValidMemoToken(token)).toBe(true);
      expect(invoiceIdFromMemoToken(token)).toBe(id);
    }
  });

  it("excludes the four characters a human retyping confuses (I, L, O, U)", () => {
    // The AUC prefix is fixed and carries a U, so it is never mistaken for a
    // payload character; the exclusion applies to the seven variable ones.
    for (let id = 0; id < 5000; id++) {
      expect(memoTokenFor(id).slice(3)).not.toMatch(/[ILOU]/);
    }
  });

  it("rejects a single mistyped character", () => {
    const token = memoTokenFor(12345);
    const corrupted = `${token.slice(0, 5)}${token[5] === "2" ? "3" : "2"}${token.slice(6)}`;
    expect(corrupted).not.toBe(token);
    expect(isValidMemoToken(corrupted)).toBe(false);
    expect(invoiceIdFromMemoToken(corrupted)).toBeNull();
  });

  it("rejects a transposition, which a position-independent checksum would miss", () => {
    // Find a token with two distinct adjacent payload characters to swap.
    for (let id = 1; id < 500; id++) {
      const token = memoTokenFor(id);
      const p = token.slice(3, 9);
      const i = [...p].findIndex((c, idx) => idx > 0 && c !== p[idx - 1]);
      if (i <= 0) continue;
      const swapped = `AUC${p.slice(0, i - 1)}${p[i]}${p[i - 1]}${p.slice(i + 1)}${token[9]}`;
      expect(isValidMemoToken(swapped)).toBe(false);
      return;
    }
    throw new Error("no transposable token found in the sample range");
  });

  it("survives what a Vietnamese bank does to a memo", () => {
    const token = memoTokenFor(7777);
    // Uppercased, diacritics stripped, punctuation inserted, padded with noise.
    const asBankSendsIt = `CHUYEN TIEN ${token.toLowerCase()} - THANH TOAN cà phê`;
    expect(extractMemoTokens(asBankSendsIt)).toEqual([token]);
    expect(normalizeDescription("Cà phê Đắk Lắk")).toBe("CAPHEDAKLAK");
  });

  it("finds every token when a payer pastes two references", () => {
    const a = memoTokenFor(11);
    const b = memoTokenFor(22);
    expect(extractMemoTokens(`${a} and ${b}`).sort()).toEqual([a, b].sort());
  });

  it("refuses an invoice id it cannot encode rather than colliding", () => {
    expect(() => memoTokenFor(1_073_741_824)).toThrow(/exceeds/);
    expect(() => memoTokenFor(-1)).toThrow();
  });
});

// ─── §7.1 matching order ─────────────────────────────────────────────────────
const invoiceCandidate = (over: Partial<Parameters<typeof outstandingMinor>[0]> = {}) => ({
  id: 1,
  memoToken: memoTokenFor(1),
  counterpartyId: 10,
  currency: "VND",
  totalMinor: 1_000_000n,
  paidMinor: 0n,
  status: "issued",
  ...over,
});

const noCandidates: MatchCandidates = { byMemoToken: [], byOrderCode: null, byCounterAccount: [] };

describe("matching engine (§7.1)", () => {
  it("matches on an exact memo token first", () => {
    const invoice = invoiceCandidate();
    const decision = decideMatch(
      { description: `PAY ${invoice.memoToken}`, amountMinor: 500_000n, currency: "VND" },
      { ...noCandidates, byMemoToken: [invoice] },
    );
    expect(decision).toMatchObject({ status: "matched", method: "memo_token", invoiceId: 1 });
    expect(decision.requiresReview).toBe(false);
  });

  it("falls back to the provider order code", () => {
    const invoice = invoiceCandidate({ id: 9 });
    const decision = decideMatch(
      { description: "no reference here", amountMinor: 1_000_000n, currency: "VND", providerOrderCode: 4242 },
      { ...noCandidates, byOrderCode: invoice },
    );
    expect(decision).toMatchObject({ status: "matched", method: "order_code", invoiceId: 9 });
  });

  it("NEVER matches on amount alone", () => {
    const invoice = invoiceCandidate();
    const decision = decideMatch(
      // Exact amount, but no memo, no order code and no known bank account.
      { description: "thanh toan", amountMinor: 1_000_000n, currency: "VND" },
      { ...noCandidates, byCounterAccount: [invoice] },
    );
    expect(decision.status).toBe("unmatched");
  });

  it("accepts the account heuristic only when it is unambiguous, and flags it", () => {
    const invoice = invoiceCandidate();
    const decision = decideMatch(
      {
        description: "thanh toan",
        amountMinor: 1_000_000n,
        currency: "VND",
        counterAccountNumber: "1234567890",
      },
      { ...noCandidates, byCounterAccount: [invoice] },
    );
    expect(decision).toMatchObject({ status: "matched", method: "heuristic" });
    // Correct most of the time is not the same as correct.
    expect(decision.requiresReview).toBe(true);
  });

  it("is ambiguous when two farmers pay the same round number the same day", () => {
    const a = invoiceCandidate({ id: 1, memoToken: memoTokenFor(1) });
    const b = invoiceCandidate({ id: 2, memoToken: memoTokenFor(2) });
    const decision = decideMatch(
      {
        description: "thanh toan",
        amountMinor: 1_000_000n,
        currency: "VND",
        counterAccountNumber: "1234567890",
      },
      { ...noCandidates, byCounterAccount: [a, b] },
    );
    expect(decision.status).toBe("ambiguous");
    expect(decision.invoiceId).toBeNull();
  });

  it("refuses to guess an fx rate on a cross-currency transfer", () => {
    const invoice = invoiceCandidate({ currency: "USD" });
    const decision = decideMatch(
      { description: `PAY ${invoice.memoToken}`, amountMinor: 1_000_000n, currency: "VND" },
      { ...noCandidates, byMemoToken: [invoice] },
    );
    expect(decision.status).toBe("ambiguous");
    expect(decision.reason).toMatch(/fx rate/i);
  });

  it("is ambiguous, not arbitrary, when a memo carries two tokens", () => {
    const decision = decideMatch(
      { description: "two refs", amountMinor: 1n, currency: "VND" },
      { ...noCandidates, byMemoToken: [invoiceCandidate({ id: 1 }), invoiceCandidate({ id: 2 })] },
    );
    expect(decision.status).toBe("ambiguous");
  });

  it("computes outstanding without going negative on an overpaid invoice", () => {
    expect(outstandingMinor(invoiceCandidate({ paidMinor: 1_200_000n }))).toBe(0n);
    expect(outstandingMinor(invoiceCandidate({ paidMinor: 400_000n }))).toBe(600_000n);
  });
});

// ─── §7.4 under / over / duplicate ───────────────────────────────────────────
describe("invoice status transitions (§7.4)", () => {
  it("underpayment is partially_paid, not paid", () => {
    expect(statusFor("issued", 900n, 1000n)).toBe("partially_paid");
  });

  it("exact payment settles", () => {
    expect(statusFor("issued", 1000n, 1000n)).toBe("paid");
  });

  it("a reversal returns the invoice to issued", () => {
    expect(statusFor("partially_paid", 0n, 1000n)).toBe("issued");
  });

  it("never resurrects a void or written-off invoice", () => {
    expect(statusFor("void", 1000n, 1000n)).toBe("void");
    expect(statusFor("written_off", 500n, 1000n)).toBe("written_off");
  });
});

// ─── §14.1 aging ─────────────────────────────────────────────────────────────
describe("aging buckets (§3.11, §14.1)", () => {
  const asOf = "2026-03-31";

  it("splits the named fixture exactly", () => {
    // Invoices due 5, 40, 70 and 120 days before the reference date.
    expect(bucketFor("2026-03-26", asOf)).toBe("b30"); // 5 days overdue
    expect(bucketFor("2026-02-19", asOf)).toBe("b60"); // 40 days
    expect(bucketFor("2026-01-20", asOf)).toBe("b90"); // 70 days
    expect(bucketFor("2025-12-01", asOf)).toBe("b90plus"); // 120 days
  });

  it("puts an invoice due today in `current`, not in a bucket", () => {
    expect(bucketFor(asOf, asOf)).toBe("current");
    expect(bucketFor("2026-04-15", asOf)).toBe("current"); // not yet due
    expect(daysOverdue(asOf, asOf)).toBe(0);
  });

  it("uses the exact boundaries, inclusive at the top of each bucket", () => {
    expect(bucketFor("2026-03-30", asOf)).toBe("b30"); // 1 day
    expect(bucketFor("2026-03-01", asOf)).toBe("b30"); // 30 days
    expect(bucketFor("2026-02-28", asOf)).toBe("b60"); // 31 days
    expect(bucketFor("2025-12-31", asOf)).toBe("b90"); // 90 days
    expect(bucketFor("2025-12-30", asOf)).toBe("b90plus"); // 91 days
  });

  it("computes the day boundary in ICT, not UTC", () => {
    // 17:30 UTC on 30 Mar is 00:30 ICT on 31 Mar. An invoice due 31 Mar is NOT
    // overdue at that instant, and a UTC implementation would say it is.
    const instant = new Date("2026-03-30T17:30:00Z");
    expect(ictToday(instant)).toBe("2026-03-31");
    expect(bucketFor("2026-03-31", ictToday(instant))).toBe("current");
    // The same instant read as a UTC calendar day is the previous day.
    expect(instant.toISOString().slice(0, 10)).toBe("2026-03-30");
  });
});

// ─── §3.7 invoicing ──────────────────────────────────────────────────────────
describe("invoice issuance (§3.7, §3.6)", () => {
  it("computes VAT from basis points, half-up, in minor units", () => {
    expect(vatMinorFor(1_000_000n, 800)).toBe(80_000n); // 8%
    expect(vatMinorFor(1_000_000n, 1000)).toBe(100_000n); // 10%
    expect(vatMinorFor(1_000_000n, 0)).toBe(0n);
    // Half-up, deterministically: 12,345 × 5% = 617.25 → 617.
    expect(vatMinorFor(12_345n, 500)).toBe(617n);
    // 12,350 × 5% = 617.5 → 618, not 617 (which banker's rounding would give).
    expect(vatMinorFor(12_350n, 500)).toBe(618n);
  });

  it("keeps the total invariant on a container-scale VND invoice", () => {
    const subtotal = 3_900_000_000n;
    const vat = vatMinorFor(subtotal, 800);
    const shipping = 25_000_000n;
    expect(subtotal + vat + shipping).toBe(4_237_000_000n);
  });

  it("numbers invoices gaplessly within a year", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("INV-2026-00001");
    expect(formatInvoiceNumber(2026, 42)).toBe("INV-2026-00042");
  });

  it("enforces the Vietnam FX control rule (§3.6)", () => {
    // Two Vietnamese residents must transact in VND.
    expect(() =>
      assertCurrencyAllowed({ counterpartyCountry: "VN", currency: "USD" }),
    ).toThrow(/GS-INV-1001/);
    // A licensed exception passes, and writes an audit event at the call site.
    expect(() =>
      assertCurrencyAllowed({
        counterpartyCountry: "VN",
        currency: "USD",
        residencyOverrideNote: "SBV licence 2026/041 — export settlement",
      }),
    ).not.toThrow();
    // An export contract with a non-resident may be denominated in USD.
    expect(() =>
      assertCurrencyAllowed({ counterpartyCountry: "US", currency: "USD" }),
    ).not.toThrow();
    expect(() =>
      assertCurrencyAllowed({ counterpartyCountry: "VN", currency: "VND" }),
    ).not.toThrow();
  });
});

// ─── §7.3 idempotency ────────────────────────────────────────────────────────
describe("idempotency fingerprints (§7.3, §14.9)", () => {
  it("is stable across key order — a client may serialise either way", () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("differs when the body differs, which is what makes GS-PAY-1001 possible", () => {
    expect(fingerprint({ invoiceId: 1, amountMinor: "5000000" })).not.toBe(
      fingerprint({ invoiceId: 1, amountMinor: "500000" }),
    );
  });

  it("treats bigint and its decimal string identically", () => {
    expect(canonicalJson({ v: 5_000_000_000n })).toBe('{"v":"5000000000"}');
  });

  it("ignores undefined members so an optional field does not change the key", () => {
    expect(fingerprint({ a: 1, b: undefined })).toBe(fingerprint({ a: 1 }));
  });
});

// ─── §7.2 PayOS ──────────────────────────────────────────────────────────────
describe("PayOS signature (§7.2, ADR-03)", () => {
  const key = "test-checksum-key";
  const data = {
    orderCode: 123,
    amount: 5_000_000,
    description: "AUC00001Z",
    accountNumber: "0123456789",
    reference: "FT2603123456",
    transactionDateTime: "2026-03-31 10:15:00",
    currency: "VND",
  };

  it("signs the alphabetically sorted k=v&k=v canonical form", () => {
    const canonical = canonicalPayosPayload(data);
    const keys = canonical.split("&").map((p) => p.split("=")[0]);
    expect(keys).toEqual([...keys].sort());
    expect(canonical.startsWith("accountNumber=0123456789&amount=5000000")).toBe(true);
  });

  it("accepts a correctly signed body", () => {
    const signature = signPayosPayload(data, key);
    expect(verifyPayosSignature({ data, signature }, key)).toBe(true);
  });

  it("rejects a tampered amount — the forgery this check exists to stop", () => {
    const signature = signPayosPayload(data, key);
    const tampered = { ...data, amount: 50_000_000 };
    expect(verifyPayosSignature({ data: tampered, signature }, key)).toBe(false);
  });

  it("rejects a body signed with the wrong key, a missing signature, and junk", () => {
    expect(verifyPayosSignature({ data, signature: signPayosPayload(data, "other") }, key)).toBe(false);
    expect(verifyPayosSignature({ data }, key)).toBe(false);
    expect(verifyPayosSignature({ data, signature: "short" }, key)).toBe(false);
    expect(verifyPayosSignature({}, key)).toBe(false);
  });

  it("serialises null and nested values the way the provider does", () => {
    expect(canonicalPayosPayload({ a: null, b: undefined, c: [1, 2] })).toBe("a=&b=&c=[1,2]");
  });

  it("reads the awkward payload shapes from §11.3", () => {
    // Amount as a string rather than a number.
    expect(parseAmount("5000000")).toBe(5_000_000n);
    expect(parseAmount(5_000_000)).toBe(5_000_000n);
    expect(parseAmount("5,000,000")).toBe(5_000_000n);
    // A float amount is a misunderstanding, not something to round.
    expect(() => parseAmount(1000.5)).toThrow(/GS-PAY-1021/);
    // Missing counterAccountNumber must not throw.
    const normalized = normalizePayos({ ...data, counterAccountNumber: undefined });
    expect(normalized.counterAccountNumber).toBeNull();
    expect(normalized.amountMinor).toBe(5_000_000n);
    expect(normalized.providerOrderCode).toBe(123);
  });

  it("does not multiply VND by 100 — its ISO exponent is 0", () => {
    expect(normalizePayos({ ...data, amount: 5_000_000 }).amountMinor).toBe(5_000_000n);
  });

  it("refuses a payload with nothing to key idempotency on", () => {
    expect(() => normalizePayos({ amount: 1 })).toThrow(/GS-PAY-1020/);
  });
});

// ─── §7.2 Casso ──────────────────────────────────────────────────────────────
describe("Casso (§7.2, ADR-03)", () => {
  it("compares the shared secret in constant time and rejects a mismatch", () => {
    expect(verifyCassoToken("secret", "secret")).toBe(true);
    expect(verifyCassoToken("secret", "secreu")).toBe(false);
    expect(verifyCassoToken("", "secret")).toBe(false);
    expect(verifyCassoToken(null, "secret")).toBe(false);
    expect(verifyCassoToken("secret", "")).toBe(false);
  });

  it("handles a date-only `when` (ACB) and a full timestamp (VietinBank)", () => {
    const batch = normalizeCassoBatch({
      data: [
        { tid: "acb-1", amount: 1_000_000, description: "AUC00001Z", when: "2026-03-31" },
        { tid: "vtb-1", amount: 2_000_000, description: "x", when: "2026-03-31 09:15:00" },
      ],
    });
    expect(batch).toHaveLength(2);
    expect(batch[0].occurredAt?.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(batch[1].occurredAt?.toISOString()).toContain("09:15:00");
    // Idempotency keys on tid, never on `when`.
    expect(batch.map((b) => b.providerTxnId)).toEqual(["acb-1", "vtb-1"]);
  });

  it("survives an unparseable timestamp rather than dropping real money", () => {
    expect(parseProviderDate("not a date")).toBeNull();
    expect(parseProviderDate("")).toBeNull();
    const [txn] = normalizeCassoBatch({ data: [{ tid: "x", amount: 1, when: "???" }] });
    expect(txn.occurredAt).toBeNull();
    expect(txn.amountMinor).toBe(1n);
  });

  it("accepts a single object as well as an array", () => {
    expect(normalizeCassoBatch({ data: { tid: "solo", amount: 5 } })).toHaveLength(1);
    expect(normalizeCassoBatch({})).toHaveLength(0);
  });
});

// ─── §8.3 VietQR ─────────────────────────────────────────────────────────────
describe("VietQR payload (§8.3)", () => {
  it("builds a CRC-valid EMVCo payload carrying the memo token", () => {
    const token = memoTokenFor(1);
    const payload = buildVietQrPayload({
      bankBin: "970415",
      accountNumber: "113366668888",
      amountMinor: 5_000_000n,
      currency: "VND",
      addInfo: token,
    });
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("970415");
    expect(payload).toContain(token);
    expect(payload).toContain("5303704"); // currency 704 = VND
    expect(payload).toContain("54075000000"); // amount, VND has no decimals
    expect(verifyVietQrPayload(payload)).toBe(true);
  });

  it("detects a tampered payload through the checksum", () => {
    const payload = buildVietQrPayload({
      bankBin: "970415",
      accountNumber: "113366668888",
      amountMinor: 5_000_000n,
    });
    const tampered = payload.replace("5000000", "9000000");
    expect(verifyVietQrPayload(tampered)).toBe(false);
  });

  it("marks a QR without an amount as static so the payer types it", () => {
    const payload = buildVietQrPayload({ bankBin: "970415", accountNumber: "1" });
    expect(payload).toContain("010211"); // point of initiation = static
    expect(verifyVietQrPayload(payload)).toBe(true);
  });

  it("computes the documented CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1"); // the standard's own check value
  });

  it("refuses input EMVCo cannot represent", () => {
    expect(() => tlv("00", "x".repeat(100))).toThrow(/99 characters/);
    expect(() => buildVietQrPayload({ bankBin: "97041", accountNumber: "1" })).toThrow(/six digits/);
    expect(() =>
      buildVietQrPayload({ bankBin: "970415", accountNumber: "1", currency: "GBP" }),
    ).toThrow(/GS-PAY-1023/);
  });

  it("carries a ₫5bn amount without loss (§14.7)", () => {
    const payload = buildVietQrPayload({
      bankBin: "970415",
      accountNumber: "113366668888",
      amountMinor: 5_000_000_000n,
    });
    expect(payload).toContain("5410" + "5000000000");
    expect(verifyVietQrPayload(payload)).toBe(true);
  });
});

// ─── §6.2 OCR gating ─────────────────────────────────────────────────────────
describe("OCR confidence gating (§6.2, ADR-04)", () => {
  it("always requires human confirmation for a cup score, at any confidence", () => {
    for (const confidence of [0.5, 0.9, 0.99, 1]) {
      expect(gateForField("cupScore", confidence).action).toBe("require_confirmation");
    }
  });

  it("treats every money-bearing and quality field the same way", () => {
    for (const field of ["moistureContent", "defectCount", "unitPrice", "totalAmount", "quantity", "bankAccountNumber"]) {
      expect(gateForField(field, 0.99).action).toBe("require_confirmation");
    }
  });

  it("applies the three-band rule to standard fields", () => {
    expect(gateForField("sampleId", 0.97).action).toBe("accept");
    expect(gateForField("sampleId", 0.9).action).toBe("accept");
    expect(gateForField("sampleId", 0.85).action).toBe("warn");
    expect(gateForField("sampleId", 0.7).action).toBe("warn");
    expect(gateForField("sampleId", 0.69).action).toBe("blank");
    expect(gateForField("sampleId", undefined).action).toBe("blank");
  });

  it("pre-fills advisory fields at any confidence", () => {
    expect(gateForField("sensory", 0.1).action).toBe("accept");
    expect(gateForField("notes", 0.01).prefill).toBe(true);
  });

  it("treats an unknown field as standard rather than advisory", () => {
    expect(gateForField("someNewField", 0.2).action).toBe("blank");
  });

  it("requires a confidence entry for every extracted field (§6.3)", () => {
    expect(assertConfidenceCoverage({ a: 1, b: 2 }, { a: 0.9 })).toEqual(["b"]);
    expect(assertConfidenceCoverage({ a: 1 }, { a: 0.9 })).toEqual([]);
  });
});

// ─── §4.2 outbox retry schedule ──────────────────────────────────────────────
describe("outbox retry (§4.2)", () => {
  it("backs off 1s, 5s, 30s, 2m, 10m, 1h", () => {
    expect([...RETRY_BACKOFF_SECONDS]).toEqual([1, 5, 30, 120, 600, 3600]);
    const base = new Date("2026-03-31T00:00:00Z");
    expect(nextAvailableAt(1, base).toISOString()).toBe("2026-03-31T00:00:01.000Z");
    expect(nextAvailableAt(4, base).toISOString()).toBe("2026-03-31T00:02:00.000Z");
    expect(nextAvailableAt(6, base).toISOString()).toBe("2026-03-31T01:00:00.000Z");
  });

  it("dead-letters after six attempts rather than retrying forever", () => {
    expect(shouldDeadLetter(5)).toBe(false);
    expect(shouldDeadLetter(6)).toBe(true);
    // An attempt count past the schedule clamps instead of indexing off the end.
    expect(nextAvailableAt(99, new Date("2026-03-31T00:00:00Z")).toISOString()).toBe(
      "2026-03-31T01:00:00.000Z",
    );
  });
});
