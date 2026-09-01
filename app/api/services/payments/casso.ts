// Casso adapter — sprint spec §7.2 and ADR-03.
//
// Casso is the BANK FEED, not a payment rail, and its callback authenticates
// with nothing but a static shared secret in a header. There is no payload
// signature, no timestamp, and no replay protection: anyone who obtains the
// token can forge a credit.
//
// So a Casso callback is an untrusted NOTIFICATION. It is persisted with
// signatureValid = false and it may not move money. The consumer re-fetches the
// transaction from the Casso API, and only that re-fetched, verifiedAt-stamped
// record is allowed to allocate.
import { timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env";
import {
  parseAmount,
  parseProviderDate,
  str,
  type NormalizedProviderTransaction,
} from "./payos";

/** Constant-time comparison of the shared secret. */
export function verifyCassoToken(received: string | null, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Casso posts `{ error, data: [ ...transactions ] }`. One callback can carry
 * several transactions, and each is independently idempotent on its `tid`.
 */
export function normalizeCassoBatch(body: unknown): NormalizedProviderTransaction[] {
  const data = (body as { data?: unknown })?.data;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map((row) => normalizeCasso(row as Record<string, unknown>));
}

export function normalizeCasso(row: Record<string, unknown>): NormalizedProviderTransaction {
  const tid = str(row.tid) || str(row.id);
  if (!tid) {
    throw new Error("GS-PAY-1020 · Casso payload carries no tid to key idempotency on");
  }
  return {
    provider: "casso",
    providerTxnId: tid,
    amountMinor: parseAmount(row.amount),
    // Casso reports domestic bank movements, which are VND by construction.
    currency: str(row.currency) || "VND",
    description: str(row.description),
    counterAccountNumber: str(row.subAccId) || str(row.bankSubAccId) || null,
    counterAccountName: str(row.bankName) || null,
    bankReference: str(row.reference) || null,
    // `when` is date-only on some banks (ACB) and a full timestamp on others
    // (VietinBank). Recorded for display; NEVER used to order or deduplicate —
    // that is what (provider, providerTxnId) is for (§3.9).
    occurredAt: parseProviderDate(row.when),
    providerOrderCode: null,
  };
}

export type CassoVerification =
  | { ok: true; amountMinor: bigint; description: string }
  | { ok: false; reason: string };

/**
 * Re-fetch a transaction from the Casso API. This is the control that makes a
 * forged callback harmless (§14.3): if the re-fetch 404s or disagrees with the
 * callback, the transaction is never allocated and an exception-queue entry is
 * raised instead.
 */
export async function verifyWithCassoApi(
  providerTxnId: string,
  expected: { amountMinor: bigint },
  deps: { fetchImpl?: typeof fetch; apiKey?: string; baseUrl?: string } = {},
): Promise<CassoVerification> {
  const apiKey = deps.apiKey ?? env.cassoApiKey;
  if (!apiKey) return { ok: false, reason: "CASSO_API_KEY is not configured" };

  const doFetch = deps.fetchImpl ?? fetch;
  const baseUrl = deps.baseUrl ?? env.cassoApiUrl;

  let response: Response;
  try {
    response = await doFetch(`${baseUrl}/transactions/${encodeURIComponent(providerTxnId)}`, {
      headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    });
  } catch (err) {
    return { ok: false, reason: `Casso API unreachable: ${String(err)}` };
  }

  if (!response.ok) {
    return { ok: false, reason: `Casso API returned ${response.status}` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "Casso API returned a body that is not JSON" };
  }

  const record = (payload as { data?: Record<string, unknown> })?.data;
  if (!record || typeof record !== "object") {
    return { ok: false, reason: "Casso API response carries no transaction" };
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseAmount(record.amount);
  } catch (err) {
    return { ok: false, reason: String(err) };
  }

  // A callback that disagrees with the provider's own record is either a forgery
  // or a bug. Either way it does not touch money.
  if (amountMinor !== expected.amountMinor) {
    return {
      ok: false,
      reason: `amount mismatch: callback said ${expected.amountMinor}, Casso says ${amountMinor}`,
    };
  }

  return { ok: true, amountMinor, description: str(record.description) };
}
