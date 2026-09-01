// Casso webhook — sprint spec §7.2, ADR-03.
//
// Casso authenticates with a static shared secret in a header. No payload
// signature, no timestamp, no replay protection. Anyone who obtains the token
// can forge a credit, so this endpoint treats every callback as an UNTRUSTED
// NOTIFICATION:
//
//   · the token is compared in constant time
//   · the transaction is persisted with signatureValid = false
//   · verifiedAt stays null, and the allocation service refuses to move money
//     for an unverified Casso row (GS-PAY-1006)
//   · the consumer re-fetches the transaction from the Casso API; only then is
//     verifiedAt stamped and allocation permitted
//
// Also restrict this route by source IP where the provider publishes a range,
// and rotate CASSO_WEBHOOK_SECRET quarterly (§7.2).
import type { Context } from "hono";
import { getDb } from "../queries/connection";
import { providerTransactions } from "@db/schema";
import { writeEvent } from "../engine";
import { env } from "../lib/env";
import { getFlags } from "../services/flags";
import { normalizeCassoBatch, verifyCassoToken } from "../services/payments/casso";
import { isDuplicateKeyError, logWebhook, requestId } from "./shared";

export async function cassoWebhook(c: Context) {
  const startedAt = Date.now();
  const rid = requestId(c);
  const raw = await c.req.text();

  const log = (fields: Record<string, unknown>) =>
    logWebhook({
      requestId: rid,
      provider: "casso",
      latencyMs: Date.now() - startedAt,
      ...fields,
    });

  const flags = await getFlags();
  if (!flags.vietqrPayments) {
    log({ outcome: "disabled" });
    return c.json({ error: "settlement disabled" }, 503);
  }

  const token = c.req.header("secure-token") ?? c.req.header("Secure-Token") ?? null;
  if (!env.cassoWebhookSecret || !verifyCassoToken(token, env.cassoWebhookSecret)) {
    log({ outcome: "invalid_token", signatureValid: false });
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    log({ outcome: "malformed_json" });
    return c.json({ error: "bad request" }, 400);
  }

  let batch;
  try {
    batch = normalizeCassoBatch(body);
  } catch (err) {
    log({ outcome: "unreadable_payload", error: String(err) });
    return c.json({ error: "bad request" }, 400);
  }

  if (batch.length === 0) {
    log({ outcome: "empty_batch" });
    return c.json({ success: true }, 200);
  }

  let accepted = 0;
  let duplicates = 0;

  // One callback can carry several transactions; each is independently
  // idempotent on its tid, so a partial failure does not reject the others.
  for (const normalized of batch) {
    try {
      const db = getDb();
      const id = await db.transaction(async (tx) => {
        const [res] = await tx.insert(providerTransactions).values({
          provider: "casso",
          providerTxnId: normalized.providerTxnId,
          rawPayload: body as Record<string, unknown>,
          // Never true for Casso: the header proves possession of a shared
          // secret, not authenticity of the payload (ADR-03).
          signatureValid: false,
          amountMinor: normalized.amountMinor,
          currency: normalized.currency,
          description: normalized.description.slice(0, 255),
          counterAccountNumber: normalized.counterAccountNumber,
          counterAccountName: normalized.counterAccountName,
          bankReference: normalized.bankReference,
          occurredAt: normalized.occurredAt,
          verifiedAt: null, // set only by a successful API re-fetch
          matchStatus: "unmatched",
        });
        const insertedId = Number(res.insertId);

        await writeEvent(tx, "payment.transaction_received", "provider_transaction", insertedId, {
          providerTransactionId: insertedId,
          provider: "casso",
          providerTxnId: normalized.providerTxnId,
          amountMinor: normalized.amountMinor.toString(),
          currency: normalized.currency,
          description: normalized.description,
          signatureValid: false,
        });
        return insertedId;
      });

      accepted++;
      log({
        outcome: "accepted",
        signatureValid: false,
        providerTxnId: normalized.providerTxnId,
        providerTransactionId: id,
        amountMinor: normalized.amountMinor,
        currency: normalized.currency,
        description: normalized.description,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        duplicates++;
        log({ outcome: "duplicate", providerTxnId: normalized.providerTxnId });
        continue;
      }
      log({ outcome: "error", error: String(err), providerTxnId: normalized.providerTxnId });
      return c.json({ error: "internal error" }, 500);
    }
  }

  // 200 within the provider's timeout budget; verification and matching happen
  // in the consumer (§7.2).
  return c.json({ success: true, accepted, duplicates }, 200);
}
