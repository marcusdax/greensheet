-- Rollback for 0001_expand_existing.sql — sprint spec §13.5.
--
-- "Every migration ships with a tested down." Two warnings before you run it:
--
--   1. Feature flags are the FIRST line of rollback and this is the last. If the
--      problem is a misbehaving payment flow, turn `vietqrPayments` off and stop
--      — that takes seconds and loses nothing.
--
--   2. Reverting `payload` from json back to text is lossless, but dropping the
--      outbox columns DISCARDS the processed/attempts state. Any event written
--      after the expand and not yet dispatched would be re-dispatched by the old
--      inline path — which is exactly the double-send the outbox exists to
--      prevent. Drain the outbox to zero unprocessed rows first:
--
--        SELECT COUNT(*) FROM domain_events WHERE processed = 0;
--
--      Do not proceed until that count is 0.

-- ─── coffee_lots ────────────────────────────────────────────────────────────
-- Data loss: the additive quality columns are dropped with their contents.
-- Export them first if the lots have been enriched since the expand.
ALTER TABLE `coffee_lots`
  DROP COLUMN `farm`,
  DROP COLUMN `moistureContent`,
  DROP COLUMN `waterActivity`,
  DROP COLUMN `density`,
  DROP COLUMN `defectCount`,
  DROP COLUMN `certifications`,
  DROP COLUMN `harvestYear`,
  DROP COLUMN `arrivalDate`,
  DROP COLUMN `warehouseLocation`,
  DROP COLUMN `deletedAt`;

-- ─── domain_events ──────────────────────────────────────────────────────────
DROP INDEX `events_dispatch_idx` ON `domain_events`;

-- json → text round-trips without loss; MySQL renders valid JSON on the way out.
ALTER TABLE `domain_events` MODIFY COLUMN `payload` text NOT NULL;

ALTER TABLE `domain_events`
  DROP COLUMN `processed`,
  DROP COLUMN `processedAt`,
  DROP COLUMN `attempts`,
  DROP COLUMN `lastError`,
  DROP COLUMN `availableAt`,
  DROP COLUMN `eventVersion`,
  DROP COLUMN `skippedReason`;

-- ─── New tables ─────────────────────────────────────────────────────────────
-- Deliberately NOT dropped. They hold money records: invoices, allocations and
-- the verbatim provider payloads behind them. Rolling back the application does
-- not make a received bank transfer stop having happened, and an auditor will
-- ask for those rows. Drop them by hand, deliberately, if the sprint is truly
-- abandoned:
--
--   DROP TABLE payment_allocations, payment_intents, provider_transactions,
--              idempotency_records, invoices, number_sequences,
--              order_code_sequence, domain_events_dead;
--   DROP TABLE ocr_results, documents, contract_lots, commercial_contracts,
--              inventory_movements, inventory_lots, coffee_products,
--              counterparty_access_logs, counterparties, feature_flags;
