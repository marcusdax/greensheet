// ZaloPay adapter — §2.2.
//
// ZaloPay's callback shape differs from MoMo's in a way that matters: the body
// is `{ data, mac, type }` where `data` is a JSON *string*, and the MAC is
// computed over that exact string. So the MAC must be checked against the raw
// characters received, NOT against a re-serialisation of the parsed object —
// re-serialising reorders keys and changes whitespace, and the MAC then fails
// on legitimate callbacks.
//
// Re-verify against current ZaloPay docs and record a fixture before changing
// this file (R6).
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env";
import {
  parseAmount,
  parseProviderDate,
  str,
  type NormalizedProviderTransaction,
} from "./payos";

export type ZaloPayCallbackBody = {
  /** JSON string. The MAC covers this exact text. */
  data?: string;
  mac?: string;
  type?: number | string;
};

/** Fields inside the decoded `data` string. */
export type ZaloPayCallbackData = {
  app_id?: number | string;
  app_trans_id?: string;
  app_time?: number | string;
  app_user?: string;
  amount?: number | string;
  embed_data?: string;
  item?: string;
  zp_trans_id?: number | string;
  server_time?: number | string;
  channel?: number | string;
  description?: string;
};

/** HMAC-SHA256 over the raw data string, using key2 for callbacks. */
export function signZaloPayData(dataString: string, key2: string): string {
  return createHmac("sha256", key2).update(dataString).digest("hex");
}

/**
 * Constant-time MAC check over the RAW data string as received.
 *
 * Passing a re-serialised object here is the bug this signature is shaped to
 * prevent, so the parameter is the string, not the parsed body.
 */
export function verifyZaloPayMac(
  body: ZaloPayCallbackBody,
  key2: string
): boolean {
  if (!body?.mac || typeof body.data !== "string" || !key2) return false;
  const expected = signZaloPayData(body.data, key2);
  const received = body.mac;
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

export function parseZaloPayData(body: ZaloPayCallbackBody): ZaloPayCallbackData | null {
  if (typeof body.data !== "string") return null;
  try {
    const parsed = JSON.parse(body.data);
    return parsed && typeof parsed === "object" ? (parsed as ZaloPayCallbackData) : null;
  } catch {
    return null;
  }
}

/**
 * ZaloPay's app_trans_id must start with yymmdd and be unique per day, so it
 * cannot simply be our order code. We encode the code after the date part and
 * recover it on the way back.
 */
export function zaloAppTransId(providerOrderCode: number, now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}_AUC${providerOrderCode}`;
}

export function orderCodeFromAppTransId(appTransId: unknown): number | null {
  const match = str(appTransId).match(/^\d{6}_AUC(\d+)$/);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isSafeInteger(code) ? code : null;
}

/**
 * Map a decoded ZaloPay callback onto our transaction shape.
 *
 * zp_trans_id is ZaloPay's identifier and is what (provider, providerTxnId)
 * dedupes on — never app_trans_id, which we mint and a retry reuses.
 */
export function normalizeZaloPay(
  data: ZaloPayCallbackData
): NormalizedProviderTransaction {
  const zpTransId = str(data.zp_trans_id);
  if (!zpTransId) {
    throw new Error(
      "GS-PAY-1020 · ZaloPay callback carries no zp_trans_id to key idempotency on"
    );
  }
  return {
    provider: "zalopay",
    providerTxnId: zpTransId,
    amountMinor: parseAmount(data.amount),
    currency: "VND",
    // `description` is where we place the memo token when creating the order,
    // so the existing matching engine needs no ZaloPay-specific branch.
    description: str(data.description) || str(data.item),
    counterAccountNumber: null,
    counterAccountName: str(data.app_user) || null,
    bankReference: str(data.app_trans_id) || null,
    occurredAt: parseProviderDate(data.server_time || data.app_time),
    providerOrderCode: orderCodeFromAppTransId(data.app_trans_id),
  };
}

export type ZaloPayChargeRequest = {
  appTransId: string;
  amountMinor: bigint;
  /** Carries the memo token. */
  description: string;
  appUser: string;
  callbackUrl: string;
  embedData?: Record<string, unknown>;
};

export type ZaloPayChargeResult =
  | { ok: true; orderUrl: string; zpTransToken: string | null }
  | { ok: false; reason: string };

/**
 * Create a ZaloPay order. The create request is MACed with key1 over a
 * pipe-joined field list — a different key and a different shape from the
 * callback's key2 over the data string.
 */
export async function createZaloPayCharge(
  request: ZaloPayChargeRequest,
  deps: {
    fetchImpl?: typeof fetch;
    appId?: string;
    key1?: string;
    baseUrl?: string;
  } = {}
): Promise<ZaloPayChargeResult> {
  const appId = deps.appId ?? env.zalopayAppId;
  const key1 = deps.key1 ?? env.zalopayKey1;
  if (!appId || !key1) {
    return { ok: false, reason: "ZaloPay credentials are not configured" };
  }
  if (request.amountMinor <= 0n) {
    return { ok: false, reason: "GS-PAY-1025 · charge amount must be > 0" };
  }

  const appTime = Date.now();
  const embedData = JSON.stringify(request.embedData ?? {});
  const item = "[]";
  const amount = request.amountMinor.toString();

  // appid|apptransid|appuser|amount|apptime|embeddata|item
  const canonical = [
    appId,
    request.appTransId,
    request.appUser,
    amount,
    String(appTime),
    embedData,
    item,
  ].join("|");
  const mac = createHmac("sha256", key1).update(canonical).digest("hex");

  const doFetch = deps.fetchImpl ?? fetch;
  const baseUrl = deps.baseUrl ?? env.zalopayApiUrl;

  const form = new URLSearchParams({
    app_id: appId,
    app_trans_id: request.appTransId,
    app_user: request.appUser,
    app_time: String(appTime),
    amount,
    item,
    embed_data: embedData,
    description: request.description,
    callback_url: request.callbackUrl,
    mac,
  });

  let response: Response;
  try {
    response = await doFetch(`${baseUrl}/v2/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch (err) {
    return { ok: false, reason: `ZaloPay API unreachable: ${String(err)}` };
  }
  if (!response.ok) return { ok: false, reason: `ZaloPay API returned ${response.status}` };

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "ZaloPay API returned a body that is not JSON" };
  }

  // ZaloPay signals success with return_code === 1, not 0.
  if (Number(payload.return_code) !== 1) {
    return {
      ok: false,
      reason: `ZaloPay refused the order: ${str(payload.return_code)} ${str(payload.return_message)} ${str(payload.sub_return_message)}`.trim(),
    };
  }
  const orderUrl = str(payload.order_url);
  if (!orderUrl) return { ok: false, reason: "ZaloPay returned no order_url" };

  return { ok: true, orderUrl, zpTransToken: str(payload.zp_trans_token) || null };
}

/** The body ZaloPay expects back from a callback. */
export const ZALOPAY_ACK_SUCCESS = { return_code: 1, return_message: "success" };
export const ZALOPAY_ACK_FAILURE = { return_code: -1, return_message: "mac not equal" };
