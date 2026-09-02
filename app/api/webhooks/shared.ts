// Shared webhook plumbing — structured logging (§13.2) and duplicate detection.
import { createHash, randomUUID } from "node:crypto";
import type { Context } from "hono";
import type { PaymentProvider } from "@contracts/providers";

export type WebhookLogFields = {
  requestId: string;
  provider: PaymentProvider;
  outcome: string;
  latencyMs: number;
  signatureValid?: boolean;
  providerTxnId?: string;
  providerTransactionId?: number;
  amountMinor?: bigint;
  currency?: string;
  /** Hashed before it reaches the log — see below. */
  description?: string;
  matchStatus?: string;
  error?: string;
};

export function requestId(c: Context): string {
  return c.req.header("x-request-id") ?? randomUUID();
}

/**
 * §13.2 — never log the raw memo description at info level: it can carry a
 * counterparty name and an account fragment. The hash is enough to correlate
 * two deliveries of the same transfer across log lines; the full value lives in
 * provider_transactions.rawPayload behind role-gated access.
 */
export function logWebhook(
  fields: Partial<WebhookLogFields> & { requestId: string }
): void {
  const { description, amountMinor, ...rest } = fields;
  const line = {
    level: fields.error ? "error" : "info",
    msg: "webhook",
    ...rest,
    amountMinor: amountMinor === undefined ? undefined : amountMinor.toString(),
    descriptionSha256:
      description === undefined
        ? undefined
        : createHash("sha256").update(description).digest("hex").slice(0, 16),
  };
  console.log(JSON.stringify(line));
}

/**
 * A duplicate delivery hits the (provider, providerTxnId) unique index. mysql2
 * surfaces that as ER_DUP_ENTRY / errno 1062; the string check is a fallback for
 * drivers that wrap the error.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as {
    code?: string;
    errno?: number;
    message?: string;
    cause?: unknown;
  };
  if (e?.code === "ER_DUP_ENTRY" || e?.errno === 1062) return true;
  if (typeof e?.message === "string" && /duplicate entry/i.test(e.message))
    return true;
  if (e?.cause) return isDuplicateKeyError(e.cause);
  return false;
}
