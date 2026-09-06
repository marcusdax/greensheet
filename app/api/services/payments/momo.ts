// MoMo e-wallet adapter — §2.2.
//
// MoMo signs with HMAC-SHA256 over a FIXED-ORDER parameter string, not over a
// sorted one like PayOS. The order is part of the contract: sorting these keys
// alphabetically produces a valid-looking signature that MoMo will reject, and
// the failure mode is a payment page that never opens.
//
// Re-verify the parameter list against the current MoMo docs before touching
// this file, and record a fixture — the previous sprint's R6 applies to every
// provider adapter, not just the ones it named.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env";
import {
  parseAmount,
  parseProviderDate,
  str,
  type NormalizedProviderTransaction,
} from "./payos";

/** MoMo returns 0 on success; every other resultCode is a failure. */
export const MOMO_SUCCESS = 0;

export type MomoIpnBody = {
  partnerCode?: string;
  orderId?: string;
  requestId?: string;
  amount?: number | string;
  orderInfo?: string;
  orderType?: string;
  transId?: number | string;
  resultCode?: number | string;
  message?: string;
  payType?: string;
  responseTime?: number | string;
  extraData?: string;
  signature?: string;
};

/**
 * The IPN signature string, in MoMo's documented order.
 *
 * accessKey is included in the signed material but is NOT sent in the callback
 * body — it comes from our own configuration. That is deliberate on MoMo's
 * part: an attacker who sees a callback still cannot reproduce the signature.
 */
export function canonicalMomoIpn(
  body: MomoIpnBody,
  accessKey: string
): string {
  return [
    `accessKey=${accessKey}`,
    `amount=${str(body.amount)}`,
    `extraData=${str(body.extraData)}`,
    `message=${str(body.message)}`,
    `orderId=${str(body.orderId)}`,
    `orderInfo=${str(body.orderInfo)}`,
    `orderType=${str(body.orderType)}`,
    `partnerCode=${str(body.partnerCode)}`,
    `payType=${str(body.payType)}`,
    `requestId=${str(body.requestId)}`,
    `responseTime=${str(body.responseTime)}`,
    `resultCode=${str(body.resultCode)}`,
    `transId=${str(body.transId)}`,
  ].join("&");
}

export function signMomoIpn(
  body: MomoIpnBody,
  accessKey: string,
  secretKey: string
): string {
  return createHmac("sha256", secretKey)
    .update(canonicalMomoIpn(body, accessKey))
    .digest("hex");
}

/** Constant-time IPN signature check. */
export function verifyMomoIpn(
  body: MomoIpnBody,
  accessKey: string,
  secretKey: string
): boolean {
  if (!body?.signature || !accessKey || !secretKey) return false;
  const expected = signMomoIpn(body, accessKey, secretKey);
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

/** The create-payment request is signed over its own distinct key order. */
export function canonicalMomoCreate(params: {
  accessKey: string;
  amount: string;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
}): string {
  return [
    `accessKey=${params.accessKey}`,
    `amount=${params.amount}`,
    `extraData=${params.extraData}`,
    `ipnUrl=${params.ipnUrl}`,
    `orderId=${params.orderId}`,
    `orderInfo=${params.orderInfo}`,
    `partnerCode=${params.partnerCode}`,
    `redirectUrl=${params.redirectUrl}`,
    `requestId=${params.requestId}`,
    `requestType=${params.requestType}`,
  ].join("&");
}

export type MomoChargeRequest = {
  /** Unique per attempt. We use the payment intent's provider order code. */
  orderId: string;
  requestId: string;
  amountMinor: bigint;
  /** Shown in the MoMo app — this is where the memo token goes. */
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  extraData?: string;
};

export type MomoChargeResult =
  | { ok: true; payUrl: string; deeplink: string | null; qrCodeUrl: string | null }
  | { ok: false; reason: string };

/**
 * Create a MoMo payment and return the payUrl deep-link (§2.2).
 *
 * VND has ISO exponent 0, so amountMinor is already the đồng figure MoMo wants
 * — no multiply, no divide. Getting this wrong by 100x is the classic e-wallet
 * integration bug and it is silent until a customer complains.
 */
export async function createMomoCharge(
  request: MomoChargeRequest,
  deps: {
    fetchImpl?: typeof fetch;
    partnerCode?: string;
    accessKey?: string;
    secretKey?: string;
    baseUrl?: string;
  } = {}
): Promise<MomoChargeResult> {
  const partnerCode = deps.partnerCode ?? env.momoPartnerCode;
  const accessKey = deps.accessKey ?? env.momoAccessKey;
  const secretKey = deps.secretKey ?? env.momoSecretKey;
  if (!partnerCode || !accessKey || !secretKey) {
    return { ok: false, reason: "MoMo credentials are not configured" };
  }
  if (request.amountMinor <= 0n) {
    return { ok: false, reason: "GS-PAY-1025 · charge amount must be > 0" };
  }

  const params = {
    accessKey,
    amount: request.amountMinor.toString(),
    extraData: request.extraData ?? "",
    ipnUrl: request.ipnUrl,
    orderId: request.orderId,
    orderInfo: request.orderInfo,
    partnerCode,
    redirectUrl: request.redirectUrl,
    requestId: request.requestId,
    requestType: "captureWallet",
  };
  const signature = createHmac("sha256", secretKey)
    .update(canonicalMomoCreate(params))
    .digest("hex");

  const doFetch = deps.fetchImpl ?? fetch;
  const baseUrl = deps.baseUrl ?? env.momoApiUrl;

  let response: Response;
  try {
    response = await doFetch(`${baseUrl}/v2/gateway/api/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, lang: "vi", signature }),
    });
  } catch (err) {
    return { ok: false, reason: `MoMo API unreachable: ${String(err)}` };
  }
  if (!response.ok) {
    return { ok: false, reason: `MoMo API returned ${response.status}` };
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "MoMo API returned a body that is not JSON" };
  }

  if (Number(payload.resultCode) !== MOMO_SUCCESS) {
    return {
      ok: false,
      reason: `MoMo refused the charge: ${str(payload.resultCode)} ${str(payload.message)}`,
    };
  }
  const payUrl = str(payload.payUrl);
  if (!payUrl) return { ok: false, reason: "MoMo returned no payUrl" };

  return {
    ok: true,
    payUrl,
    deeplink: str(payload.deeplink) || null,
    qrCodeUrl: str(payload.qrCodeUrl) || null,
  };
}

/**
 * Map a MoMo IPN onto our transaction shape.
 *
 * `transId` is MoMo's own identifier and is what (provider, providerTxnId)
 * dedupes on — never `orderId`, which we chose and which a retry reuses.
 */
export function normalizeMomo(body: MomoIpnBody): NormalizedProviderTransaction {
  const transId = str(body.transId);
  if (!transId) {
    throw new Error("GS-PAY-1020 · MoMo IPN carries no transId to key idempotency on");
  }
  return {
    provider: "momo",
    providerTxnId: transId,
    amountMinor: parseAmount(body.amount),
    currency: "VND",
    // orderInfo is where we put the memo token on the way out, so the existing
    // matching engine finds it here on the way back with no special case.
    description: str(body.orderInfo),
    counterAccountNumber: null,
    counterAccountName: null,
    bankReference: str(body.orderId) || null,
    occurredAt: parseProviderDate(body.responseTime),
    providerOrderCode: orderCodeFromMomoOrderId(body.orderId),
  };
}

/**
 * We mint MoMo orderIds as `AUC-<providerOrderCode>-<attempt>`, so the payment
 * intent is recoverable even when the memo token is lost from orderInfo.
 */
export function momoOrderId(providerOrderCode: number, attempt = 1): string {
  return `AUC-${providerOrderCode}-${attempt}`;
}

export function orderCodeFromMomoOrderId(orderId: unknown): number | null {
  const match = str(orderId).match(/^AUC-(\d+)-\d+$/);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isSafeInteger(code) ? code : null;
}

export function isMomoSuccess(body: MomoIpnBody): boolean {
  return Number(body.resultCode) === MOMO_SUCCESS;
}

export type MomoRefundResult =
  | { ok: true; refundTransId: string }
  | { ok: false; reason: string };

/** Refund a captured MoMo payment (§2.2 "refunds via API"). */
export async function refundMomo(
  args: { orderId: string; requestId: string; amountMinor: bigint; transId: string; description?: string },
  deps: {
    fetchImpl?: typeof fetch;
    partnerCode?: string;
    accessKey?: string;
    secretKey?: string;
    baseUrl?: string;
  } = {}
): Promise<MomoRefundResult> {
  const partnerCode = deps.partnerCode ?? env.momoPartnerCode;
  const accessKey = deps.accessKey ?? env.momoAccessKey;
  const secretKey = deps.secretKey ?? env.momoSecretKey;
  if (!partnerCode || !accessKey || !secretKey) {
    return { ok: false, reason: "MoMo credentials are not configured" };
  }

  const description = args.description ?? "";
  const canonical = [
    `accessKey=${accessKey}`,
    `amount=${args.amountMinor.toString()}`,
    `description=${description}`,
    `orderId=${args.orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${args.requestId}`,
    `transId=${args.transId}`,
  ].join("&");
  const signature = createHmac("sha256", secretKey).update(canonical).digest("hex");

  const doFetch = deps.fetchImpl ?? fetch;
  const baseUrl = deps.baseUrl ?? env.momoApiUrl;
  let response: Response;
  try {
    response = await doFetch(`${baseUrl}/v2/gateway/api/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerCode,
        orderId: args.orderId,
        requestId: args.requestId,
        amount: Number(args.amountMinor),
        transId: args.transId,
        lang: "vi",
        description,
        signature,
      }),
    });
  } catch (err) {
    return { ok: false, reason: `MoMo API unreachable: ${String(err)}` };
  }
  if (!response.ok) return { ok: false, reason: `MoMo API returned ${response.status}` };

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "MoMo API returned a body that is not JSON" };
  }
  if (Number(payload.resultCode) !== MOMO_SUCCESS) {
    return {
      ok: false,
      reason: `MoMo refused the refund: ${str(payload.resultCode)} ${str(payload.message)}`,
    };
  }
  return { ok: true, refundTransId: str(payload.transId) };
}
