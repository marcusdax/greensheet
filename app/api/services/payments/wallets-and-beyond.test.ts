// Phase C/E acceptance criteria as executable assertions — §2.2, §3.3–§3.6, §3.8.
//
// Same discipline as payments.test.ts: only the pure logic lives here, because
// that is where the money bugs are. Signature schemes, sign conventions,
// calendar arithmetic and validation rules can all be wrong in ways a passing
// integration test would never notice.
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  canonicalMomoIpn,
  signMomoIpn,
  verifyMomoIpn,
  normalizeMomo,
  momoOrderId,
  orderCodeFromMomoOrderId,
  isMomoSuccess,
  type MomoIpnBody,
} from "./momo";
import {
  signZaloPayData,
  verifyZaloPayMac,
  parseZaloPayData,
  zaloAppTransId,
  orderCodeFromAppTransId,
  normalizeZaloPay,
} from "./zalopay";
import { convertAtRate, realizedDifferenceMinor } from "./fx";
import { stepsDueFor, renderTemplate, DEFAULT_LADDER } from "./dunning";
import {
  validatePayload,
  TT78_VAT_RATES_BP,
  type EinvoicePayload,
} from "./einvoice";
import { addDays, nextRunDate, autoChargeBlockers } from "./standing-orders";
import {
  PROVIDER_SPECS,
  requiresVerification,
  recurringCapableProviders,
  supportsCurrency,
} from "@contracts/providers";

// ─── §2.2 MoMo ───────────────────────────────────────────────────────────────
describe("MoMo IPN signature (§2.2, ADR-03)", () => {
  const accessKey = "test-access-key";
  const secretKey = "test-secret-key";
  const body: MomoIpnBody = {
    partnerCode: "MOMOTEST",
    orderId: "AUC-4021-1",
    requestId: "AUC-4021-1",
    amount: 5_000_000,
    orderInfo: "INV-2026-0007 AUC0007ZK",
    orderType: "momo_wallet",
    transId: 2606123456,
    resultCode: 0,
    message: "Successful.",
    payType: "qr",
    responseTime: 1774950000000,
    extraData: "",
  };

  it("signs a FIXED field list, not whatever the callback happened to carry", () => {
    // PayOS sorts the keys it received. MoMo's list is fixed by the provider:
    // it includes accessKey (never sent) and excludes signature (always sent),
    // so deriving it from the body — sorted or not — produces a wrong MAC.
    const canonical = canonicalMomoIpn(body, accessKey);
    const keys = canonical.split("&").map(p => p.split("=")[0]);
    expect(keys).toEqual([
      "accessKey",
      "amount",
      "extraData",
      "message",
      "orderId",
      "orderInfo",
      "orderType",
      "partnerCode",
      "payType",
      "requestId",
      "responseTime",
      "resultCode",
      "transId",
    ]);
    // Key order in the received object must not change the signed material.
    const shuffled = Object.fromEntries(
      Object.entries(body).reverse()
    ) as MomoIpnBody;
    expect(canonicalMomoIpn(shuffled, accessKey)).toBe(canonical);
  });

  it("includes accessKey in the signed material even though the callback omits it", () => {
    expect(canonicalMomoIpn(body, accessKey)).toContain(
      `accessKey=${accessKey}`
    );
    expect(Object.keys(body)).not.toContain("accessKey");
  });

  it("accepts a correctly signed callback", () => {
    const signature = signMomoIpn(body, accessKey, secretKey);
    expect(verifyMomoIpn({ ...body, signature }, accessKey, secretKey)).toBe(
      true
    );
  });

  it("rejects a tampered amount — the forgery this check exists to stop", () => {
    const signature = signMomoIpn(body, accessKey, secretKey);
    expect(
      verifyMomoIpn(
        { ...body, amount: 50_000_000, signature },
        accessKey,
        secretKey
      )
    ).toBe(false);
  });

  it("rejects the wrong secret, a missing signature and junk", () => {
    const signature = signMomoIpn(body, accessKey, secretKey);
    expect(verifyMomoIpn({ ...body, signature }, accessKey, "other")).toBe(
      false
    );
    expect(verifyMomoIpn(body, accessKey, secretKey)).toBe(false);
    expect(
      verifyMomoIpn({ ...body, signature: "short" }, accessKey, secretKey)
    ).toBe(false);
  });

  it("dedupes on transId, not orderId — a retried order reuses the orderId", () => {
    const normalized = normalizeMomo(body);
    expect(normalized.providerTxnId).toBe("2606123456");
    expect(normalized.provider).toBe("momo");
  });

  it("does not multiply VND by 100 — its ISO exponent is 0", () => {
    expect(normalizeMomo(body).amountMinor).toBe(5_000_000n);
  });

  it("round-trips the order code through the orderId", () => {
    expect(momoOrderId(4021)).toBe("AUC-4021-1");
    expect(orderCodeFromMomoOrderId(momoOrderId(4021))).toBe(4021);
    expect(orderCodeFromMomoOrderId("someone-elses-order")).toBeNull();
    expect(orderCodeFromMomoOrderId(undefined)).toBeNull();
  });

  it("treats only resultCode 0 as paid", () => {
    expect(isMomoSuccess(body)).toBe(true);
    expect(isMomoSuccess({ ...body, resultCode: 1006 })).toBe(false);
  });
});

// ─── §2.2 ZaloPay ────────────────────────────────────────────────────────────
describe("ZaloPay callback MAC (§2.2, ADR-03)", () => {
  const key2 = "test-key2";
  // Note the key order: zp_trans_id BEFORE app_trans_id. The MAC is over this
  // exact string, so re-serialising the parsed object would break it.
  const dataString = JSON.stringify({
    zp_trans_id: 260612345678,
    app_id: 2553,
    app_trans_id: "260331_AUC4021",
    app_time: 1774950000000,
    app_user: "cp-12",
    amount: 5_000_000,
    embed_data: '{"invoiceId":7}',
    item: "[]",
    server_time: 1774950001000,
    channel: 36,
    description: "INV-2026-0007 AUC0007ZK",
  });

  it("accepts a correctly MACed callback", () => {
    const mac = signZaloPayData(dataString, key2);
    expect(verifyZaloPayMac({ data: dataString, mac }, key2)).toBe(true);
  });

  it("MACs the RAW data string — re-serialising the object breaks it", () => {
    const mac = signZaloPayData(dataString, key2);
    const reserialized = JSON.stringify(
      JSON.parse(dataString),
      Object.keys(JSON.parse(dataString)).sort()
    );
    expect(reserialized).not.toBe(dataString);
    expect(verifyZaloPayMac({ data: reserialized, mac }, key2)).toBe(false);
  });

  it("rejects a tampered amount and the wrong key", () => {
    const mac = signZaloPayData(dataString, key2);
    const tampered = dataString.replace(
      '"amount":5000000',
      '"amount":50000000'
    );
    expect(verifyZaloPayMac({ data: tampered, mac }, key2)).toBe(false);
    expect(
      verifyZaloPayMac(
        { data: dataString, mac: signZaloPayData(dataString, "other") },
        key2
      )
    ).toBe(false);
    expect(verifyZaloPayMac({ data: dataString }, key2)).toBe(false);
  });

  it("uses HMAC-SHA256 with key2, matching the provider's documented scheme", () => {
    expect(signZaloPayData(dataString, key2)).toBe(
      createHmac("sha256", key2).update(dataString).digest("hex")
    );
  });

  it("dedupes on zp_trans_id — app_trans_id is ours and can repeat", () => {
    const data = parseZaloPayData({ data: dataString, mac: "x" });
    expect(data).not.toBeNull();
    const normalized = normalizeZaloPay(data!);
    expect(normalized.providerTxnId).toBe("260612345678");
    expect(normalized.amountMinor).toBe(5_000_000n);
    expect(normalized.provider).toBe("zalopay");
  });

  it("survives a malformed data string rather than throwing on a webhook", () => {
    expect(parseZaloPayData({ data: "not json", mac: "x" })).toBeNull();
    expect(parseZaloPayData({})).toBeNull();
  });

  it("round-trips the order code through app_trans_id", () => {
    const id = zaloAppTransId(4021, new Date("2026-03-31T00:00:00Z"));
    expect(id).toBe("260331_AUC4021");
    expect(orderCodeFromAppTransId(id)).toBe(4021);
    expect(orderCodeFromAppTransId("260331_SOMEONEELSE")).toBeNull();
  });
});

// ─── §1 provider registry ────────────────────────────────────────────────────
describe("provider trust model (ADR-03)", () => {
  it("requires an API re-fetch only for the shared-secret rail", () => {
    // A signed payload proves the provider composed it. A shared secret only
    // proves whoever called us knows the secret — that is not the same claim.
    expect(requiresVerification("casso")).toBe(true);
    expect(requiresVerification("payos")).toBe(false);
    expect(requiresVerification("momo")).toBe(false);
    expect(requiresVerification("zalopay")).toBe(false);
  });

  it("keeps the e-wallets on the same signed-payload footing as PayOS", () => {
    expect(PROVIDER_SPECS.momo.trustModel).toBe("payload_signature");
    expect(PROVIDER_SPECS.zalopay.trustModel).toBe("payload_signature");
  });

  it("names the rails that can hold a recurring mandate", () => {
    const recurring = recurringCapableProviders();
    expect(recurring).not.toContain("casso");
    expect(recurring.length).toBeGreaterThan(0);
  });

  it("knows the e-wallets settle in VND only", () => {
    expect(supportsCurrency("momo", "VND")).toBe(true);
    expect(supportsCurrency("momo", "USD")).toBe(false);
    expect(supportsCurrency("manual", "USD")).toBe(true);
  });
});

// ─── §3.3 multi-currency ─────────────────────────────────────────────────────
describe("FX conversion and realized difference (§3.3)", () => {
  it("converts across differing ISO exponents without a float", () => {
    // 100.00 USD (exponent 2) at 25,400 → 2,540,000 VND (exponent 0).
    expect(convertAtRate(10_000n, "USD", "VND", "25400.000000")).toBe(
      2_540_000n
    );
    // And back: 2,540,000 VND at 0.000039 is 99.06 USD — 9,906 cents. The
    // exponent change is the whole point; a naive multiply would return 99.
    expect(convertAtRate(2_540_000n, "VND", "USD", "0.000039")).toBe(9_906n);
  });

  it("is a no-op when the currencies match", () => {
    expect(convertAtRate(12_345n, "VND", "VND", "1.000000")).toBe(12_345n);
  });

  it("returns a positive difference when the money moved in our favour", () => {
    // Contract locked at 25,000; we were actually paid at 25,400. Each dollar
    // brought in 400 more đồng than the invoice assumed: a gain.
    const gain = realizedDifferenceMinor({
      paymentAmountMinor: 10_000n,
      paymentCurrency: "USD",
      invoiceCurrency: "VND",
      appliedRate: "25400.000000",
      expectedRate: "25000.000000",
    });
    expect(gain).toBe(40_000n);
  });

  it("returns a negative difference when the rate moved against us", () => {
    const loss = realizedDifferenceMinor({
      paymentAmountMinor: 10_000n,
      paymentCurrency: "USD",
      invoiceCurrency: "VND",
      appliedRate: "24600.000000",
      expectedRate: "25000.000000",
    });
    expect(loss).toBe(-40_000n);
  });

  it("realizes nothing without an expectation to compare against", () => {
    // No locked contract rate means no gain or loss — just a conversion. Booking
    // a difference against a rate we never promised would invent income.
    expect(
      realizedDifferenceMinor({
        paymentAmountMinor: 10_000n,
        paymentCurrency: "USD",
        invoiceCurrency: "VND",
        appliedRate: "25400.000000",
        expectedRate: null,
      })
    ).toBe(0n);
  });

  it("realizes nothing on a same-currency payment", () => {
    expect(
      realizedDifferenceMinor({
        paymentAmountMinor: 5_000_000n,
        paymentCurrency: "VND",
        invoiceCurrency: "VND",
        appliedRate: "1.000000",
        expectedRate: "1.000000",
      })
    ).toBe(0n);
  });
});

// ─── §3.4 dunning ────────────────────────────────────────────────────────────
describe("dunning ladder (§3.4)", () => {
  const steps = [
    { id: 1, offsetDays: 0 },
    { id: 2, offsetDays: 3 },
    { id: 3, offsetDays: 7 },
    { id: 4, offsetDays: 14 },
  ];

  it("sends every step reached, so a missed sweep still catches up", () => {
    expect(stepsDueFor(8, steps, new Set())).toEqual([1, 2, 3]);
  });

  it("sends nothing before the invoice is due", () => {
    expect(stepsDueFor(-1, steps, new Set())).toEqual([]);
  });

  it("never re-sends a step already recorded — the idempotency guarantee", () => {
    expect(stepsDueFor(8, steps, new Set([1, 2]))).toEqual([3]);
    expect(stepsDueFor(8, steps, new Set([1, 2, 3]))).toEqual([]);
  });

  it("fires the day-0 step exactly on the due date, not the day after", () => {
    expect(stepsDueFor(0, steps, new Set())).toEqual([1]);
  });

  it("uses only merge tags the renderer actually supplies", () => {
    // The failure this guards against is silent: a template written with a tag
    // nobody populates renders that tag literally into a customer's inbox.
    const supplied = new Set([
      "counterparty_name",
      "invoice_number",
      "outstanding",
      "currency",
      "due_date",
      "days_overdue",
      "memo_token",
    ]);
    for (const step of DEFAULT_LADDER) {
      const tags = [
        ...`${step.subjectTemplate} ${step.bodyTemplate}`.matchAll(
          /\{(\w+)\}/g
        ),
      ].map(m => m[1]);
      for (const tag of tags) {
        expect(
          supplied,
          `day ${step.offsetDays} uses an unknown tag {${tag}}`
        ).toContain(tag);
      }
    }
  });

  it("escalates day 0/3/7/14 and asks a human before it asks for money twice", () => {
    expect(DEFAULT_LADDER.map(s => s.offsetDays)).toEqual([0, 3, 7, 14]);
    expect(DEFAULT_LADDER.map(s => s.action)).toEqual([
      "send_reminder",
      "send_reminder",
      "create_call_task",
      "offer_installment",
    ]);
  });

  it("substitutes tokens and leaves unknown ones alone rather than blanking them", () => {
    expect(
      renderTemplate("Hi {counterparty_name}, you owe {outstanding}", {
        counterparty_name: "Cầu Đất",
        outstanding: "5.000.000 ₫",
      })
    ).toBe("Hi Cầu Đất, you owe 5.000.000 ₫");
    // A typo in a template must be visible in the output, not silently empty:
    // an email reading "you owe " is worse than one reading "you owe {amont}".
    expect(renderTemplate("you owe {amont}", { outstanding: "1" })).toBe(
      "you owe {amont}"
    );
  });
});

// ─── §3.5 e-invoice ──────────────────────────────────────────────────────────
describe("e-invoice payload validation (§3.5, TT 78/2021)", () => {
  const valid: EinvoicePayload = {
    sellerTaxCode: "0312345678",
    buyerName: "Công ty TNHH Cà phê Sài Gòn",
    buyerTaxCode: "0301234567",
    buyerAddress: "12 Nguyễn Huệ, Quận 1, TP.HCM",
    templateCode: "1/001",
    invoiceSeries: "C26TAA",
    currency: "VND",
    issuedAt: "2026-03-31",
    sellerInvoiceNumber: "INV-2026-0007",
    subtotalMinor: 100_000_000n,
    vatRateBp: 800,
    vatMinor: 8_000_000n,
    totalMinor: 108_000_000n,
    lines: [
      {
        name: "Arabica Cầu Đất, 60kg",
        quantity: 10,
        unitPriceMinor: 10_000_000n,
        amountMinor: 100_000_000n,
        vatRateBp: 800,
      },
    ],
  };

  it("accepts a well-formed VND invoice", () => {
    expect(validatePayload(valid)).toEqual([]);
  });

  it("refuses a total that does not equal subtotal + VAT", () => {
    // The authority rejects this, slowly and opaquely. Catching it here saves a day.
    expect(validatePayload({ ...valid, totalMinor: 108_000_001n })).not.toEqual(
      []
    );
  });

  it("refuses a malformed tax code", () => {
    expect(validatePayload({ ...valid, sellerTaxCode: "12345" })).not.toEqual(
      []
    );
    expect(
      validatePayload({ ...valid, buyerTaxCode: "not-an-mst" })
    ).not.toEqual([]);
  });

  it("refuses a non-VND invoice — a TT 78 e-invoice is issued in đồng", () => {
    expect(validatePayload({ ...valid, currency: "USD" })).not.toEqual([]);
  });

  it("refuses a VAT rate TT 78 does not define", () => {
    expect(validatePayload({ ...valid, vatRateBp: 700 })).not.toEqual([]);
    for (const rate of TT78_VAT_RATES_BP) {
      const vatMinor = (100_000_000n * BigInt(rate)) / 10_000n;
      expect(
        validatePayload({
          ...valid,
          vatRateBp: rate,
          vatMinor,
          totalMinor: 100_000_000n + vatMinor,
          lines: [{ ...valid.lines[0], vatRateBp: rate }],
        })
      ).toEqual([]);
    }
  });

  it("refuses an invoice with no lines", () => {
    expect(validatePayload({ ...valid, lines: [] })).not.toEqual([]);
  });
});

// ─── §3.6 standing orders ────────────────────────────────────────────────────
describe("standing order cadence (§3.6)", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });

  it("advances weekly and biweekly by a fixed stride", () => {
    expect(nextRunDate("weekly", "2026-03-02", 1)).toBe("2026-03-09");
    expect(nextRunDate("biweekly", "2026-03-02", 1)).toBe("2026-03-16");
  });

  it("clamps a monthly anchor to 28 so February is never skipped", () => {
    // An anchor of 31 would have no January→February successor, and the
    // subscription would silently stop billing. 28 exists in every month.
    expect(nextRunDate("monthly", "2026-01-31", 28)).toBe("2026-02-28");
    expect(nextRunDate("monthly", "2026-01-15", 15)).toBe("2026-02-15");
    expect(nextRunDate("monthly", "2026-12-15", 15)).toBe("2027-01-15");
  });
});

describe("auto-charge preconditions (§3.6)", () => {
  const active = {
    status: "active",
    consentGivenAt: new Date("2026-01-01"),
    consentRevokedAt: null,
    tokenEnc: "tok_abc",
    tokenExpiresAt: new Date("2027-01-01"),
  };

  it("permits a charge only on an active, consented, unexpired token", () => {
    expect(autoChargeBlockers(active, new Date("2026-03-31"))).toEqual([]);
  });

  it("refuses without recorded consent — §3.6's 'with customer consent'", () => {
    expect(
      autoChargeBlockers(
        { ...active, consentGivenAt: null },
        new Date("2026-03-31")
      )
    ).toHaveLength(1);
  });

  it("refuses once consent is withdrawn, even while the token still works", () => {
    expect(
      autoChargeBlockers(
        { ...active, consentRevokedAt: new Date("2026-02-01") },
        new Date("2026-03-31")
      )
    ).toHaveLength(1);
  });

  it("refuses an expired or missing token", () => {
    expect(
      autoChargeBlockers(
        { ...active, tokenExpiresAt: new Date("2026-01-01") },
        new Date("2026-03-31")
      )
    ).toHaveLength(1);
    expect(
      autoChargeBlockers({ ...active, tokenEnc: null }, new Date("2026-03-31"))
    ).toHaveLength(1);
  });

  it("reports every reason at once rather than the first one it finds", () => {
    expect(
      autoChargeBlockers(
        {
          status: "revoked",
          consentGivenAt: null,
          consentRevokedAt: new Date("2026-02-01"),
          tokenEnc: null,
          tokenExpiresAt: null,
        },
        new Date("2026-03-31")
      ).length
    ).toBeGreaterThan(1);
  });
});
