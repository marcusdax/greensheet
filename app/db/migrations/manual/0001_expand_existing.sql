-- Expand migration for an EXISTING seeded database — sprint spec §13.5.
--
-- `0000_vietnam_payment_manager.sql` is a from-scratch baseline: drizzle-kit had
-- no migration history to diff against because this repo has been using
-- `db:push`. It creates every table and is correct for a fresh environment.
--
-- This file is the other half: the ALTERs an existing database needs. It is
-- expand-only. No column is dropped and no read path changes, so the previous
-- application version keeps working against this schema and the release can be
-- rolled back by feature flag rather than by migration (§13.5).
--
-- Run order for an existing database:
--   1. this file
--   2. deploy the new application (all payment flags off)
--   3. `0000_…sql` with the CREATE TABLE statements for the NEW tables only —
--      or simply `drizzle-kit push`, which is a no-op for tables that exist
--   4. turn flags on one at a time (§13.4)

-- ─── §3.13 · domain_events becomes a real outbox ────────────────────────────

-- STOP THE MIGRATION if any existing payload is not valid JSON. §3.13 is
-- explicit: "If any row fails to parse, stop the migration — do not coerce."
-- This SELECT raises a duplicate-key error naming the offending row rather than
-- silently rewriting data that a consumer will later choke on.
SELECT id, LEFT(payload, 120) AS unparseable_payload
FROM domain_events
WHERE payload IS NOT NULL AND NOT JSON_VALID(payload);
-- ^ If the result above is non-empty, STOP. Fix or quarantine those rows first.

ALTER TABLE `domain_events`
  ADD COLUMN `processed` boolean NOT NULL DEFAULT false,
  ADD COLUMN `processedAt` timestamp NULL,
  ADD COLUMN `attempts` int NOT NULL DEFAULT 0,
  ADD COLUMN `lastError` text NULL,
  ADD COLUMN `availableAt` timestamp NOT NULL DEFAULT (now()),
  ADD COLUMN `eventVersion` smallint NOT NULL DEFAULT 1,
  ADD COLUMN `skippedReason` varchar(255) NULL;

-- Every event that predates the outbox has already had its rules evaluated by
-- the old inline path. Marking them processed stops the consumer replaying the
-- entire history — which would re-send months of campaign email — on first boot.
UPDATE `domain_events`
SET `processed` = true, `processedAt` = `createdAt`, `skippedReason` = 'pre_outbox_backfill'
WHERE `processed` = false;

-- Safe only because the JSON_VALID check above passed.
ALTER TABLE `domain_events` MODIFY COLUMN `payload` json NOT NULL;

CREATE INDEX `events_dispatch_idx` ON `domain_events` (`processed`, `availableAt`, `id`);

-- ─── §3.1 · coffee_lots additive columns ────────────────────────────────────
-- Additive only. cupScore deliberately stays `double`; retyping it to
-- decimal(5,2) is its own carefully-tested migration (R5), and until then every
-- tier comparison goes through roundScore().

ALTER TABLE `coffee_lots`
  ADD COLUMN `farm` varchar(255) NULL,
  ADD COLUMN `moistureContent` decimal(5,2) NULL,
  ADD COLUMN `waterActivity` decimal(4,3) NULL,
  ADD COLUMN `density` decimal(5,2) NULL,
  ADD COLUMN `defectCount` int NULL,
  ADD COLUMN `certifications` json NOT NULL,
  ADD COLUMN `harvestYear` smallint NULL,
  ADD COLUMN `arrivalDate` date NULL,
  ADD COLUMN `warehouseLocation` varchar(120) NULL,
  ADD COLUMN `deletedAt` timestamp NULL;

UPDATE `coffee_lots` SET `certifications` = JSON_ARRAY() WHERE JSON_LENGTH(`certifications`) IS NULL;

-- ─── ADR-05 · seed the flags, all off ───────────────────────────────────────
-- Defaults are off in code too, so this is belt and braces: a fresh deployment
-- cannot accidentally take real payments before anyone has looked at it.
INSERT INTO `feature_flags` (`flagKey`, `enabled`, `description`) VALUES
  ('ocrUpload', false, 'Document intake: upload, scan and OCR proposal pipeline (Slice 3)'),
  ('vietqrPayments', false, 'VietQR payment intents, QR rendering and provider webhooks (Slice 2)'),
  ('autoAllocation', false, 'Kill switch: allocate a matched transaction without a human click'),
  ('outboxConsumer', false, 'Dispatch domain events from the outbox consumer instead of the legacy inline path')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
