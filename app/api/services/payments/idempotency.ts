// Idempotency, properly — sprint spec §7.3.
//
// A bare UNIQUE(idempotencyKey) returns a duplicate-key error on retry rather
// than the original result, and cannot distinguish a legitimate retry from key
// reuse with a different body. The three cases that matter:
//
//   same key, same fingerprint, completed  → return the recorded response (200)
//   same key, same fingerprint, in-flight  → 409 with Retry-After
//   same key, DIFFERENT fingerprint        → 422 GS-PAY-1001 IdempotencyKeyReuse
//
// The last one is the important one. Silently returning the old response for a
// different request is how a ₫50m intent gets confused for a ₫5m one.
import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import { idempotencyRecords } from "@db/schema";
import { isDuplicateKeyError } from "../../webhooks/shared";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const IN_FLIGHT_RETRY_AFTER_SECONDS = 2;

/**
 * SHA-256 over the canonical request body. Keys are sorted recursively so that
 * `{a:1,b:2}` and `{b:2,a:1}` are the same request — otherwise a client that
 * serialises its object differently on retry gets a spurious 422.
 */
export function fingerprint(input: unknown): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return `"${value.toString()}"`;
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export type IdempotencyOutcome<T> =
  | { kind: "replay"; response: T }
  | { kind: "proceed"; recordId: number };

/**
 * Claim an idempotency key. Returns either the recorded response for a genuine
 * retry, or a record id the caller stamps with `complete()` once the work is
 * done.
 */
export async function claimIdempotencyKey<T>(args: {
  principalId: number;
  key: string;
  scope: string;
  request: unknown;
}): Promise<IdempotencyOutcome<T>> {
  const db = getDb();
  const requestFingerprint = fingerprint(args.request);
  const now = new Date();

  // Expired records are reclaimable: a key is unique for 24 hours, not forever.
  await db
    .delete(idempotencyRecords)
    .where(
      and(
        eq(idempotencyRecords.principalId, args.principalId),
        eq(idempotencyRecords.idempotencyKey, args.key),
        eq(idempotencyRecords.scope, args.scope),
        lt(idempotencyRecords.expiresAt, now),
      ),
    );

  try {
    const [inserted] = await db.insert(idempotencyRecords).values({
      principalId: args.principalId,
      idempotencyKey: args.key,
      scope: args.scope,
      requestFingerprint,
      status: "in_flight",
      lockedAt: now,
      expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
    });
    return { kind: "proceed", recordId: Number(inserted.insertId) };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }

  // The key already exists. Which of the three cases is it?
  const existing = await db.query.idempotencyRecords.findFirst({
    where: and(
      eq(idempotencyRecords.principalId, args.principalId),
      eq(idempotencyRecords.idempotencyKey, args.key),
      eq(idempotencyRecords.scope, args.scope),
    ),
  });
  if (!existing) {
    // Lost a race with the expiry delete above; the caller retries cleanly.
    throw new TRPCError({
      code: "CONFLICT",
      message: "GS-PAY-1019 · idempotency record vanished mid-claim, retry",
    });
  }

  if (existing.requestFingerprint !== requestFingerprint) {
    throw new TRPCError({
      code: "UNPROCESSABLE_CONTENT",
      message:
        "GS-PAY-1001 IdempotencyKeyReuse · this key was used for a different request body",
    });
  }

  if (existing.status === "in_flight") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `GS-PAY-1022 · request already in flight, retry after ${IN_FLIGHT_RETRY_AFTER_SECONDS}s`,
    });
  }

  return { kind: "replay", response: (existing.responseSnapshot ?? null) as T };
}

/** Record the response so the next retry replays it instead of re-executing. */
export async function completeIdempotencyKey(
  recordId: number,
  response: unknown,
): Promise<void> {
  await getDb()
    .update(idempotencyRecords)
    .set({
      status: "completed",
      responseSnapshot: JSON.parse(canonicalJson(response)) as Record<string, unknown>,
    })
    .where(eq(idempotencyRecords.id, recordId));
}

/**
 * Release a claim whose work failed, so the caller can retry with the same key.
 * Without this a transient database error would poison the key for 24 hours.
 */
export async function releaseIdempotencyKey(recordId: number): Promise<void> {
  await getDb().delete(idempotencyRecords).where(eq(idempotencyRecords.id, recordId));
}

/** Wrap a unit of work in the full protocol. */
export async function withIdempotency<T>(
  args: { principalId: number; key: string; scope: string; request: unknown },
  work: () => Promise<T>,
): Promise<T> {
  const claim = await claimIdempotencyKey<T>(args);
  if (claim.kind === "replay") return claim.response;

  try {
    const result = await work();
    await completeIdempotencyKey(claim.recordId, result);
    return result;
  } catch (err) {
    await releaseIdempotencyKey(claim.recordId);
    throw err;
  }
}
