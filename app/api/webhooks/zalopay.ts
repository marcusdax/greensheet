// ZaloPay callback — §2.2.
//
// The MAC covers the RAW `data` string, so it must be verified against the
// characters as received. Parsing first and re-serialising reorders keys and
// breaks the MAC on perfectly legitimate callbacks — a bug that looks like a
// provider outage.
//
// ZaloPay also expects a specific acknowledgement body rather than relying on
// the HTTP status, so both success and failure return 200 with a return_code.
import type { Context } from "hono";
import { getDb } from "../queries/connection";
import { providerTransactions } from "@db/schema";
import { writeEvent } from "../engine";
import { env } from "../lib/env";
import { getFlags } from "../services/flags";
import {
  normalizeZaloPay,
  parseZaloPayData,
  verifyZaloPayMac,
  ZALOPAY_ACK_FAILURE,
  ZALOPAY_ACK_SUCCESS,
  type ZaloPayCallbackBody,
} from "../services/payments/zalopay";
import { isDuplicateKeyError, logWebhook, requestId } from "./shared";

export async function zalopayWebhook(c: Context) {
  const startedAt = Date.now();
  const rid = requestId(c);
  const raw = await c.req.text();

  const log = (fields: Record<string, unknown>) =>
    logWebhook({
      requestId: rid,
      provider: "zalopay",
      latencyMs: Date.now() - startedAt,
      ...fields,
    });

  const flags = await getFlags();
  if (!flags.eWalletPayments) {
    log({ outcome: "disabled" });
    return c.json({ error: "e-wallet settlement disabled" }, 503);
  }
  if (!env.zalopayKey2) {
    log({ outcome: "misconfigured" });
    return c.json(ZALOPAY_ACK_FAILURE, 200);
  }

  let body: ZaloPayCallbackBody;
  try {
    body = JSON.parse(raw) as ZaloPayCallbackBody;
  } catch {
    log({ outcome: "malformed_json" });
    return c.json(ZALOPAY_ACK_FAILURE, 200);
  }

  // Verified against body.data exactly as it arrived.
  if (!verifyZaloPayMac(body, env.zalopayKey2)) {
    log({ outcome: "invalid_mac", signatureValid: false });
    return c.json(ZALOPAY_ACK_FAILURE, 200);
  }

  const data = parseZaloPayData(body);
  if (!data) {
    log({ outcome: "unreadable_payload" });
    return c.json(ZALOPAY_ACK_FAILURE, 200);
  }

  let normalized;
  try {
    normalized = normalizeZaloPay(data);
  } catch (err) {
    log({ outcome: "unreadable_payload", error: String(err) });
    return c.json(ZALOPAY_ACK_FAILURE, 200);
  }

  try {
    const db = getDb();
    const id = await db.transaction(async tx => {
      const [res] = await tx.insert(providerTransactions).values({
        provider: "zalopay",
        providerTxnId: normalized.providerTxnId,
        rawPayload: body as unknown as Record<string, unknown>,
        signatureValid: true,
        verifiedAt: new Date(),
        amountMinor: normalized.amountMinor,
        currency: normalized.currency,
        description: normalized.description.slice(0, 255),
        counterAccountNumber: normalized.counterAccountNumber,
        counterAccountName: normalized.counterAccountName,
        bankReference: normalized.bankReference,
        occurredAt: normalized.occurredAt,
        matchStatus: "unmatched",
      });
      const insertedId = Number(res.insertId);

      await writeEvent(tx, "payment.transaction_received", "provider_transaction", insertedId, {
        providerTransactionId: insertedId,
        provider: "zalopay",
        providerTxnId: normalized.providerTxnId,
        amountMinor: normalized.amountMinor.toString(),
        currency: normalized.currency,
        description: normalized.description,
        signatureValid: true,
        providerOrderCode: normalized.providerOrderCode,
      });
      return insertedId;
    });

    log({
      outcome: "accepted",
      signatureValid: true,
      providerTxnId: normalized.providerTxnId,
      providerTransactionId: id,
      amountMinor: normalized.amountMinor,
      currency: normalized.currency,
      description: normalized.description,
    });
    return c.json(ZALOPAY_ACK_SUCCESS, 200);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Already recorded. Acknowledge success so ZaloPay stops retrying.
      log({ outcome: "duplicate", providerTxnId: normalized.providerTxnId, signatureValid: true });
      return c.json(ZALOPAY_ACK_SUCCESS, 200);
    }
    log({ outcome: "error", error: String(err), providerTxnId: normalized.providerTxnId });
    // return_code 0 asks ZaloPay to retry later.
    return c.json({ return_code: 0, return_message: "retry" }, 200);
  }
}
