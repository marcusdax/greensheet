// Outbox consumer — sprint spec §4.2.
//
// Single worker process, claim-based dispatch, at-least-once delivery.
//
// The claim query is `FOR UPDATE SKIP LOCKED`, NOT `id > lastSeenId`. MySQL
// allocates AUTO_INCREMENT values at insert but only exposes them at commit, so
// a long transaction can commit an id below one a later short transaction has
// already shown a cursor-based consumer. That consumer skips the row silently
// and the payment it described is never applied (§3.13).
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import { domainEvents, domainEventsDead } from "@db/schema";
import { getFlags } from "../flags";
import {
  handlersFor,
  nextAvailableAt,
  shouldDeadLetter,
  type OutboxEvent,
} from "./registry";
import "./handlers"; // side-effect import: registers every handler

export const POLL_INTERVAL_MS = 500;
export const CLAIM_BATCH_SIZE = 50;

export type BatchOutcome = {
  claimed: number;
  handled: number;
  skipped: number;
  failed: number;
  deadLettered: number;
};

const EMPTY: BatchOutcome = { claimed: 0, handled: 0, skipped: 0, failed: 0, deadLettered: 0 };

/**
 * Claim a batch and dispatch it. Claiming and processing are separate
 * transactions on purpose: holding row locks across handler I/O is how a
 * consumer deadlocks against the webhook writes it is meant to be draining.
 */
export async function processBatch(limit = CLAIM_BATCH_SIZE): Promise<BatchOutcome> {
  const db = getDb();
  const claimedIds = await claim(limit);
  if (claimedIds.length === 0) return { ...EMPTY };

  const outcome: BatchOutcome = { ...EMPTY, claimed: claimedIds.length };

  for (const id of claimedIds) {
    const row = await db.query.domainEvents.findFirst({ where: eq(domainEvents.id, id) });
    if (!row) continue;

    const event: OutboxEvent = {
      id: row.id,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      eventVersion: row.eventVersion,
      attempts: row.attempts,
    };

    const handlers = handlersFor(event.eventType);
    if (handlers.length === 0) {
      // No handler is not a failure — most canonical events are read-model only.
      await markProcessed(id, "no_handler_registered");
      outcome.skipped++;
      continue;
    }

    try {
      let anyHandled = false;
      for (const handler of handlers) {
        const result = await handler.handle(event);
        if (result === "handled") anyHandled = true;
      }
      await markProcessed(id, anyHandled ? null : "all_handlers_skipped");
      if (anyHandled) outcome.handled++;
      else outcome.skipped++;
    } catch (err) {
      const attempts = event.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      if (shouldDeadLetter(attempts)) {
        await deadLetter(event, attempts, message);
        outcome.deadLettered++;
      } else {
        // A handler that throws must NOT mark the event processed.
        await db
          .update(domainEvents)
          .set({
            attempts,
            lastError: message.slice(0, 2000),
            availableAt: nextAvailableAt(attempts),
            processed: false,
          })
          .where(eq(domainEvents.id, id));
        outcome.failed++;
      }
    }
  }

  return outcome;
}

/**
 * Reserve up to `limit` due events. The SELECT ... FOR UPDATE SKIP LOCKED and
 * the UPDATE that stamps them run in one transaction so two workers never claim
 * the same row; the rows stay `processed = 0` until a handler succeeds, and
 * `availableAt` is pushed out to act as the visibility timeout.
 */
async function claim(limit: number): Promise<number[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: domainEvents.id, attempts: domainEvents.attempts })
      .from(domainEvents)
      .where(and(eq(domainEvents.processed, false), lte(domainEvents.availableAt, new Date())))
      .orderBy(asc(domainEvents.id))
      .limit(limit)
      .for("update", { skipLocked: true });

    if (due.length === 0) return [];
    const ids = due.map((r) => r.id);

    // Visibility timeout: if this worker dies mid-batch the rows become
    // claimable again after the backoff rather than being lost (§11.4).
    await tx
      .update(domainEvents)
      .set({ availableAt: new Date(Date.now() + 60_000) })
      .where(sql`${domainEvents.id} IN ${ids}`);

    return ids;
  });
}

async function markProcessed(id: number, skippedReason: string | null): Promise<void> {
  await getDb()
    .update(domainEvents)
    .set({
      processed: true,
      processedAt: new Date(),
      skippedReason,
      lastError: null,
    })
    .where(eq(domainEvents.id, id));
}

async function deadLetter(event: OutboxEvent, attempts: number, error: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(domainEventsDead).values({
      eventId: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      attempts,
      lastError: error.slice(0, 2000),
    });
    // Marked processed so the consumer stops retrying; the dead-letter row is
    // the record, and §13.1 pages on-call for any row in this table.
    await tx
      .update(domainEvents)
      .set({
        processed: true,
        processedAt: new Date(),
        attempts,
        lastError: error.slice(0, 2000),
        skippedReason: "dead_lettered",
      })
      .where(eq(domainEvents.id, event.id));
  });
  console.error(
    JSON.stringify({
      level: "error",
      msg: "outbox.dead_letter",
      eventId: event.id,
      eventType: event.eventType,
      attempts,
      error,
    }),
  );
}

/** Oldest unprocessed event age in seconds — the outbox-lag SLO (§13.1). */
export async function outboxLagSeconds(): Promise<number> {
  const rows = await getDb()
    .select({ createdAt: domainEvents.createdAt })
    .from(domainEvents)
    .where(eq(domainEvents.processed, false))
    .orderBy(asc(domainEvents.id))
    .limit(1);
  if (rows.length === 0) return 0;
  return Math.max(0, Math.round((Date.now() - rows[0].createdAt.getTime()) / 1000));
}

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/** Start the poll loop. Idempotent: calling twice does not start two loops. */
export function startOutboxConsumer(): void {
  if (running) return;
  running = true;

  const tick = async () => {
    try {
      const flags = await getFlags();
      // While the flag is off the legacy inline path in engine.ts is authoritative
      // and the consumer must not double-dispatch (§4.1).
      if (flags.outboxConsumer) {
        let outcome = await processBatch();
        // Drain a backlog rather than waiting a poll interval per batch.
        while (outcome.claimed === CLAIM_BATCH_SIZE) outcome = await processBatch();
      }
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: "outbox.tick_failed", error: String(err) }),
      );
    } finally {
      if (running) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  timer = setTimeout(tick, POLL_INTERVAL_MS);
}

export function stopOutboxConsumer(): void {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}
