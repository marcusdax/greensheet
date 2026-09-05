// §11.3 — provider contract tests.
//
// Pact-style, against recorded fixtures rather than payloads invented to match
// the parser. The spec names the shapes that matter: "Casso `when` as
// date-only, PayOS `description` truncated, amount as string vs number, missing
// `counterAccountNumber`". Each is a real thing a Vietnamese bank feed does,
// and each has a wrong answer that looks plausible — parse the date-only `when`
// as local time and a transfer moves a day; read "1000.5" as a float and money
// rounds.
//
// These tests are deliberately about NORMALISATION only. Whether a normalised
// transaction is then trusted is ADR-03's question, asserted separately.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizePayos,
  parseAmount,
  parseProviderDate,
  signPayosPayload,
  verifyPayosSignature,
  canonicalPayosPayload,
} from "./payos";
import { normalizeCasso, normalizeCassoBatch, verifyCassoToken } from "./casso";

/**
 * Fixtures are read as `unknown` shapes on purpose: the whole point is that
 * these payloads are whatever the provider sent, not whatever our types say
 * they should be. Typing them would assert the contract the test exists to
 * check.
 */
const fixtures = (name: string) =>
  JSON.parse(
    readFileSync(join(__dirname, "fixtures", `${name}.json`), "utf8")
  ) as Record<string, Record<string, Record<string, unknown>>>;

const payos = fixtures("payos");
const casso = fixtures("casso");

describe("§11.3 · PayOS", () => {
  it("reads an integral number amount as minor units, unmultiplied", () => {
    const txn = normalizePayos(payos.exact_number_amount.data);
    // VND has ISO exponent 0. 918000000 is 918,000,000 dong — multiplying by
    // 100 here would be a hundredfold overpayment that reconciles cleanly.
    expect(txn.amountMinor).toBe(918_000_000n);
    expect(txn.currency).toBe("VND");
    expect(txn.provider).toBe("payos");
  });

  it("reads a string amount identically to the number form", () => {
    const txn = normalizePayos(payos.string_amount_iso_timestamp.data);
    expect(txn.amountMinor).toBe(1_296_000_000n);
    expect(typeof payos.string_amount_iso_timestamp.data.amount).toBe("string");
  });

  it("keeps a truncated description intact rather than trying to repair it", () => {
    const txn = normalizePayos(
      payos.truncated_description_no_counter_account.data
    );
    // The bank cut the memo token off mid-word. Normalisation must not guess:
    // matching decides what to do with a partial token, and a parser that
    // "helpfully" completes it would credit the wrong invoice.
    expect(txn.description).toBe(
      "CHUYEN KHOAN QUA MB TU NGUYEN THI BINH NOI DUNG AUCTUM C6"
    );
    expect(txn.description.endsWith("C6")).toBe(true);
  });

  it("tolerates a missing counterAccountNumber", () => {
    const txn = normalizePayos(
      payos.truncated_description_no_counter_account.data
    );
    expect(txn.counterAccountNumber).toBeNull();
    expect(txn.counterAccountName).toBeNull();
    // Still a usable transaction: money arrived and it has an idempotency key.
    expect(txn.providerTxnId).toBe("FT24230987654323");
  });

  it("treats a bare 'YYYY-MM-DD HH:mm:ss' timestamp as UTC, not local", () => {
    const txn = normalizePayos(payos.exact_number_amount.data);
    expect(txn.occurredAt?.toISOString()).toBe("2026-08-17T09:41:12.000Z");
  });

  it("leaves an explicit ISO offset alone", () => {
    const txn = normalizePayos(payos.string_amount_iso_timestamp.data);
    expect(txn.occurredAt?.toISOString()).toBe("2026-08-17T02:41:12.000Z");
  });

  it("refuses a payload with nothing to key idempotency on", () => {
    expect(() => normalizePayos(payos.no_reference_at_all.data)).toThrow(
      /GS-PAY-1020/
    );
  });

  it("verifies a signature over the canonical payload", () => {
    const key = "test-checksum-key";
    const data = payos.exact_number_amount.data;
    const body = { data, signature: signPayosPayload(data, key) };
    expect(verifyPayosSignature(body, key)).toBe(true);
    expect(verifyPayosSignature(body, "wrong-key")).toBe(false);
  });

  it("signs over sorted keys, so field order in transit cannot change the digest", () => {
    const key = "test-checksum-key";
    const data = payos.exact_number_amount.data;
    const reordered = Object.fromEntries(
      Object.entries(data).reverse()
    ) as Record<string, unknown>;
    expect(canonicalPayosPayload(reordered)).toBe(canonicalPayosPayload(data));
    expect(signPayosPayload(reordered, key)).toBe(signPayosPayload(data, key));
  });

  it("rejects a tampered amount even when every other field matches", () => {
    const key = "test-checksum-key";
    const data = { ...payos.exact_number_amount.data };
    const signature = signPayosPayload(data, key);
    const tampered = { data: { ...data, amount: 9_180_000_000 }, signature };
    expect(verifyPayosSignature(tampered, key)).toBe(false);
  });
});

describe("§11.3 · Casso", () => {
  it("normalises a batch of two rows independently", () => {
    const rows = normalizeCassoBatch(casso.batch_two_rows);
    expect(rows).toHaveLength(2);
    expect(rows[0].providerTxnId).toBe("FT24230987654321");
    expect(rows[0].amountMinor).toBe(918_000_000n);
    // Second row's amount is a string; same value, same type out.
    expect(rows[1].amountMinor).toBe(75_000_000n);
    expect(rows.every(r => r.provider === "casso")).toBe(true);
  });

  it("accepts `data` as a single object, not only an array", () => {
    const rows = normalizeCassoBatch(casso.single_object_not_array);
    expect(rows).toHaveLength(1);
    expect(rows[0].providerTxnId).toBe("TCB20260817Y02");
  });

  it("parses a date-only `when` as UTC midnight, never local midnight", () => {
    const [row] = normalizeCassoBatch(casso.date_only_when_no_sub_account);
    // ACB sends the date alone. Parsing it in Asia/Ho_Chi_Minh would place the
    // transfer at 17:00 the previous UTC day, which moves it across an aging
    // bucket boundary for every payment received near month-end.
    expect(row.occurredAt?.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  it("tolerates a missing sub-account", () => {
    const [row] = normalizeCassoBatch(casso.date_only_when_no_sub_account);
    expect(row.counterAccountNumber).toBeNull();
    expect(row.counterAccountName).toBe("ACB");
    expect(row.currency).toBe("VND");
  });

  it("refuses a row with no tid", () => {
    expect(() => normalizeCassoBatch(casso.no_tid)).toThrow(/GS-PAY-1020/);
  });

  it("refuses a decimal amount rather than rounding it", () => {
    // "1000.5" VND is not a rounding problem, it is a misread field. Guessing
    // produces an allocation that reconciles and is wrong.
    expect(() => normalizeCassoBatch(casso.decimal_amount)).toThrow(
      /GS-PAY-1021/
    );
  });

  it("falls back to `id` when `tid` is absent but an id is present", () => {
    const row = normalizeCasso({ id: 4471099, amount: 1000, when: "2026-08-17" });
    expect(row.providerTxnId).toBe("4471099");
  });

  it("authenticates the shared secret in constant time, and only exactly", () => {
    expect(verifyCassoToken("s3cret", "s3cret")).toBe(true);
    expect(verifyCassoToken("s3cret ", "s3cret")).toBe(false);
    expect(verifyCassoToken("", "s3cret")).toBe(false);
    expect(verifyCassoToken(null, "s3cret")).toBe(false);
    // An unset expected secret must not authenticate an empty header.
    expect(verifyCassoToken("", "")).toBe(false);
  });
});

describe("§11.3 · shared parsing rules", () => {
  it("reads every integral representation of an amount to the same bigint", () => {
    for (const form of [1000, "1000", " 1000 ", "1,000", 1000n]) {
      expect(parseAmount(form)).toBe(1000n);
    }
  });

  it("refuses every non-integral amount", () => {
    for (const form of [1000.5, "1000.5", "1e3", "abc", "", null, undefined]) {
      expect(() => parseAmount(form)).toThrow(/GS-PAY-1021/);
    }
  });

  it("returns null rather than throwing on an unparseable date", () => {
    // §11.4's clock-skew case: the money is real even when the timestamp is
    // nonsense, so a bad date must never reject a transaction.
    expect(parseProviderDate("not a date")).toBeNull();
    expect(parseProviderDate("")).toBeNull();
    expect(parseProviderDate(null)).toBeNull();
  });

  it("accepts a timestamp an hour in the future without complaint", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(parseProviderDate(future)?.getTime()).toBeGreaterThan(Date.now());
  });
});
