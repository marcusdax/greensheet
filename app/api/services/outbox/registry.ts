// Outbox handler registry — sprint spec §4.2.
//
// evaluateRules() used to live inside emitEvent(), firing side effects outside
// any transaction (B6). Handlers now register here and the consumer dispatches
// them, so a failure retries instead of vanishing.
//
// Contract every handler must honour:
//   · Idempotent, keyed on (eventType, aggregateId) or a handler-specific
//     natural key. Delivery is at-least-once, so a handler WILL see a duplicate.
//   · Return "skip" when the event is irrelevant — the event is then marked
//     processed with a reason, not retried.
//   · Throw to retry. A handler that throws must not mark the event processed.
//   · Never assume arrival order: ordering is per aggregate, not global. A
//     handler that needs ordering checks aggregate state.

export type OutboxEvent = {
  id: number;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  eventVersion: number;
  attempts: number;
};

export type HandlerResult = "handled" | "skip";

export type OutboxHandler = {
  /** Stable name — appears in logs, metrics and the dead-letter row. */
  name: string;
  handle: (event: OutboxEvent) => Promise<HandlerResult>;
};

const registry = new Map<string, OutboxHandler[]>();

export function registerHandler(
  eventType: string,
  handler: OutboxHandler
): void {
  const existing = registry.get(eventType) ?? [];
  if (existing.some(h => h.name === handler.name)) {
    throw new Error(
      `outbox handler "${handler.name}" is already registered for ${eventType}`
    );
  }
  registry.set(eventType, [...existing, handler]);
}

export function handlersFor(eventType: string): OutboxHandler[] {
  return registry.get(eventType) ?? [];
}

export function registeredEventTypes(): string[] {
  return [...registry.keys()].sort();
}

/** Test seam only — production never clears the registry. */
export function resetRegistry(): void {
  registry.clear();
}

/**
 * Retry schedule from §4.2: 1s, 5s, 30s, 2m, 10m, 1h, then dead-letter.
 * Index is the attempt number that just failed (1-based).
 */
export const RETRY_BACKOFF_SECONDS = [1, 5, 30, 120, 600, 3600] as const;
export const MAX_ATTEMPTS = RETRY_BACKOFF_SECONDS.length;

export function nextAvailableAt(attempts: number, from = new Date()): Date {
  const idx = Math.min(Math.max(attempts, 1), MAX_ATTEMPTS) - 1;
  return new Date(from.getTime() + RETRY_BACKOFF_SECONDS[idx] * 1000);
}

export function shouldDeadLetter(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}
