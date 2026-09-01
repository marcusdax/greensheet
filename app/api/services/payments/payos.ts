// PayOS adapter — sprint spec §7.2 and ADR-03.
//
// PayOS is the payment RAIL. It signs its webhook body and carries a
// first-class orderCode, so a verified PayOS transaction may credit AR
// directly. Signature scheme, verified against the provider docs at the time of
// writing (re-verify per R6 before touching this file):
//
//   HMAC-SHA256( sorted(data) joined as "k=v&k=v", PAYOS_CHECKSUM_KEY )
//   compared against the top-level `signature` field.
//
// Keys are sorted alphabetically. Nested objects and arrays are serialised as
// JSON; null and undefined become the empty string, which is what the provider
// does and is the detail that silently breaks a naive implementation.
import { createHmac, timingSafeEqual } from "node:crypto";

export type PayosWebhookBody = {
  code?: string;
  desc?: string;
  success?: boolean;
  data?: Record<string, unknown>;
  signature?: string;
};

/** Canonical string PayOS signs: alphabetically sorted `k=v` pairs. */
export function canonicalPayosPayload(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map(key => `${key}=${stringifyValue(data[key])}`)
    .join("&");
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || typeof value === "object")
    return JSON.stringify(value);
  return String(value);
}

export function signPayosPayload(
  data: Record<string, unknown>,
  checksumKey: string
): string {
  return createHmac("sha256", checksumKey)
    .update(canonicalPayosPayload(data))
    .digest("hex");
}

/**
 * Constant-time signature check. A length mismatch short-circuits before
 * timingSafeEqual, which throws on unequal buffers — that check leaks only the
 * length, which is fixed for a hex SHA-256 digest anyway.
 */
export function verifyPayosSignature(
  body: PayosWebhookBody,
  checksumKey: string
): boolean {
  if (!body?.signature || !body?.data || typeof body.data !== "object")
    return false;
  const expected = signPayosPayload(body.data, checksumKey);
  const received = body.signature;
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(received, "utf8")
    );
  } catch {
    return false;
  }
}

export type NormalizedProviderTransaction = {
  provider: "payos" | "casso";
  providerTxnId: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  counterAccountNumber: string | null;
  counterAccountName: string | null;
  bankReference: string | null;
  occurredAt: Date | null;
  providerOrderCode: number | null;
};

/**
 * Map a PayOS `data` object onto our transaction shape.
 *
 * PayOS reports VND, whose ISO exponent is 0 — the amount is already in minor
 * units and must NOT be multiplied by 100. Amounts arrive as a number or a
 * string depending on endpoint (§11.3 requires a fixture for both).
 */
export function normalizePayos(
  data: Record<string, unknown>
): NormalizedProviderTransaction {
  const reference =
    str(data.reference) || str(data.paymentLinkId) || str(data.orderCode);
  if (!reference) {
    throw new Error(
      "GS-PAY-1020 · PayOS payload carries no reference to key idempotency on"
    );
  }
  return {
    provider: "payos",
    providerTxnId: reference,
    amountMinor: parseAmount(data.amount),
    currency: str(data.currency) || "VND",
    description: str(data.description),
    counterAccountNumber: str(data.counterAccountNumber) || null,
    counterAccountName: str(data.counterAccountName) || null,
    bankReference: str(data.reference) || null,
    occurredAt: parseProviderDate(data.transactionDateTime),
    providerOrderCode: data.orderCode == null ? null : Number(data.orderCode),
  };
}

export function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Amounts arrive as a number or a string (§11.3). A float never touches money:
 * an integral number goes straight to BigInt, and a decimal string is refused
 * rather than rounded, because a provider sending "1000.5" VND means we have
 * misunderstood the field, not that we should guess.
 */
export function parseAmount(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(
        `GS-PAY-1021 · non-integral minor amount from provider: ${value}`
      );
    }
    return BigInt(value);
  }
  const s = str(value).trim().replace(/[,\s]/g, "");
  if (!/^-?\d+$/.test(s)) {
    throw new Error(
      `GS-PAY-1021 · cannot read a minor amount from "${str(value)}"`
    );
  }
  return BigInt(s);
}

/**
 * Provider timestamps are inconsistent: full ISO, "YYYY-MM-DD HH:mm:ss", or a
 * bare date. Parse leniently, and never let an unparseable one throw — the
 * transaction is still real money (§11.4 clock-skew case).
 */
export function parseProviderDate(value: unknown): Date | null {
  const s = str(value).trim();
  if (!s) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
    ? s.replace(" ", "T")
    : s;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
