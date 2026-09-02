// MoMo IPN — §2.2, same posture as the bank rails (§7.2).
//
// MoMo signs the callback body, so a verified IPN authenticates the amount and
// may credit AR directly — the PayOS trust model, not the Casso one. The rest
// of the pipeline is unchanged: persist, emit, return 200 fast, match in the
// consumer.
import type { Context } from "hono";
import { getDb } from "../queries/connection";
import { providerTransactions } from "@db/schema";
import { writeEvent } from "../engine";
import { env } from "../lib/env";
import { getFlags } from "../services/flags";
import {
  isMomoSuccess,
  normalizeMomo,
  verifyMomoIpn,
  type MomoIpnBody,
} from "../services/payments/momo";
import { isDuplicateKeyError, logWebhook, requestId } from "./shared";

export async function momoWebhook(c: Context) {
  const startedAt = Date.now();
  const rid = requestId(c);
  const raw = await c.req.text();

  const log = (fields: Record<string, unknown>) =>
    logWebhook({
      requestId: rid,
      provider: "momo",
      latencyMs: Date.now() - startedAt,
      ...fields,
    });

  const flags = await getFlags();
  if (!flags.eWalletPayments) {
    // Kill switch. 503 rather than 200 so MoMo retries once we re-enable.
    log({ outcome: "disabled" });
    return c.json({ error: "e-wallet settlement disabled" }, 503);
  }

  if (!env.momoAccessKey || !env.momoSecretKey) {
    log({ outcome: "misconfigured" });
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: MomoIpnBody;
  try {
    body = JSON.parse(raw) as MomoIpnBody;
  } catch {
    log({ outcome: "malformed_json" });
    return c.json({ error: "bad request" }, 400);
  }

  if (!verifyMomoIpn(body, env.momoAccessKey, env.momoSecretKey)) {
    log({ outcome: "invalid_signature", signatureValid: false });
    return c.json({ error: "invalid signature" }, 401);
  }

  // A failed payment is a real, signed notification but not money. Record
  // nothing in provider_transactions — that table is money that arrived.
  if (!isMomoSuccess(body)) {
    log({ outcome: "declined", signatureValid: true, resultCode: String(body.resultCode ?? "") });
    return c.body(null, 204);
  }

  let normalized;
  try {
    normalized = normalizeMomo(body);
  } catch (err) {
    log({ outcome: "unreadable_payload", error: String(err) });
    return c.json({ error: "bad request" }, 400);
  }

  try {
    const db = getDb();
    const id = await db.transaction(async tx => {
      const [res] = await tx.insert(providerTransactions).values({
        provider: "momo",
        providerTxnId: normalized.providerTxnId,
        rawPayload: body as unknown as Record<string, unknown>,
        // The signature authenticates the amount, so this is verified money.
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
        provider: "momo",
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
    // MoMo expects 204 on a successfully handled IPN.
    return c.body(null, 204);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      log({ outcome: "duplicate", providerTxnId: normalized.providerTxnId, signatureValid: true });
      return c.body(null, 204);
    }
    log({ outcome: "error", error: String(err), providerTxnId: normalized.providerTxnId });
    return c.json({ error: "internal error" }, 500);
  }
}
