// PayOS webhook — sprint spec §7.2.
//
// A plain Hono route, NOT a tRPC procedure (B7): tRPC expects its own request
// envelope and consumes the body, so routing a provider here would 400 on every
// real callback.
//
// The endpoint does four things and stops:
//   1. capture the raw body before parsing (audit, and signature input)
//   2. verify the signature; on failure log, 401, and persist nothing
//   3. insert into provider_transactions; a duplicate (provider, providerTxnId)
//      returns 200 with no side effects — that unique index IS the idempotency
//      guarantee (§3.9, §14.2)
//   4. emit payment.transaction_received in the same transaction
//
// Matching does NOT happen here. It runs in the consumer, because a provider
// retries on timeout and a slow synchronous match is how you earn duplicate
// deliveries (§7.2).
import type { Context } from "hono";
import { getDb } from "../queries/connection";
import { providerTransactions } from "@db/schema";
import { writeEvent } from "../engine";
import { env } from "../lib/env";
import { getFlags } from "../services/flags";
import {
  normalizePayos,
  verifyPayosSignature,
  type PayosWebhookBody,
} from "../services/payments/payos";
import {
  isDuplicateKeyError,
  logWebhook,
  requestId,
  type WebhookLogFields,
} from "./shared";

export async function payosWebhook(c: Context) {
  const startedAt = Date.now();
  const rid = requestId(c);
  const raw = await c.req.text();

  const log = (fields: Partial<WebhookLogFields>) =>
    logWebhook({
      requestId: rid,
      provider: "payos",
      latencyMs: Date.now() - startedAt,
      ...fields,
    });

  const flags = await getFlags();
  if (!flags.vietqrPayments) {
    // The kill switch (ADR-05). 503 rather than 200: the provider retries, so
    // no money is lost while settlement is disabled.
    log({ outcome: "disabled" });
    return c.json({ error: "settlement disabled" }, 503);
  }

  if (!env.payosChecksumKey) {
    log({ outcome: "misconfigured" });
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: PayosWebhookBody;
  try {
    body = JSON.parse(raw) as PayosWebhookBody;
  } catch {
    log({ outcome: "malformed_json" });
    return c.json({ error: "bad request" }, 400);
  }

  // PayOS confirms a webhook registration by posting a probe with no data.
  // Answering 200 is what completes the confirm-webhook handshake in the
  // deployment runbook; a forgotten registration is silent non-delivery.
  if (!body.data) {
    log({ outcome: "registration_probe" });
    return c.json({ success: true }, 200);
  }

  if (!verifyPayosSignature(body, env.payosChecksumKey)) {
    // §7.2: on failure, log with request id, return 401, persist nothing.
    log({ outcome: "invalid_signature", signatureValid: false });
    return c.json({ error: "invalid signature" }, 401);
  }

  let normalized;
  try {
    normalized = normalizePayos(body.data);
  } catch (err) {
    log({ outcome: "unreadable_payload", error: String(err) });
    return c.json({ error: "bad request" }, 400);
  }

  try {
    const db = getDb();
    const inserted = await db.transaction(async tx => {
      const [res] = await tx.insert(providerTransactions).values({
        provider: "payos",
        providerTxnId: normalized.providerTxnId,
        rawPayload: body as unknown as Record<string, unknown>,
        // A verified PayOS transaction may credit AR directly (ADR-03).
        signatureValid: true,
        amountMinor: normalized.amountMinor,
        currency: normalized.currency,
        description: normalized.description.slice(0, 255),
        counterAccountNumber: normalized.counterAccountNumber,
        counterAccountName: normalized.counterAccountName,
        bankReference: normalized.bankReference,
        occurredAt: normalized.occurredAt,
        verifiedAt: new Date(), // the signature is the verification for PayOS
        matchStatus: "unmatched",
      });
      const id = Number(res.insertId);

      await writeEvent(
        tx,
        "payment.transaction_received",
        "provider_transaction",
        id,
        {
          providerTransactionId: id,
          provider: "payos",
          providerTxnId: normalized.providerTxnId,
          amountMinor: normalized.amountMinor.toString(),
          currency: normalized.currency,
          description: normalized.description,
          signatureValid: true,
          providerOrderCode: normalized.providerOrderCode,
        }
      );
      return id;
    });

    log({
      outcome: "accepted",
      signatureValid: true,
      providerTxnId: normalized.providerTxnId,
      providerTransactionId: inserted,
      amountMinor: normalized.amountMinor,
      currency: normalized.currency,
      description: normalized.description,
    });
    return c.json({ success: true }, 200);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // The replay case. 200 with no side effects — the provider stops
      // retrying and nothing is credited twice (§14.2).
      log({
        outcome: "duplicate",
        providerTxnId: normalized.providerTxnId,
        signatureValid: true,
      });
      return c.json({ success: true, duplicate: true }, 200);
    }
    log({
      outcome: "error",
      error: String(err),
      providerTxnId: normalized.providerTxnId,
    });
    // 500 so the provider retries: the money is real and we failed to record it.
    return c.json({ error: "internal error" }, 500);
  }
}
