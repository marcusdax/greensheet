-- Expand migration for an EXISTING database — §13.4 auto-allocation pilot.
--
-- One nullable column. Purely additive: the previous application version runs
-- unchanged against this schema, so this release rolls back by feature flag
-- rather than by migration (§13.5).
--
-- NULL means "not enrolled", and not enrolled means every matched transaction
-- on that counterparty waits for a human click even with `autoAllocation` on.
-- That is deliberate and fail-closed: after this migration runs, NOBODY is
-- enrolled, so turning the flag on moves no money until an operator names the
-- pilot counterparties. §13.4 asks for exactly two.
--
-- The column is a timestamp rather than a boolean because the graduation gate
-- is a duration — "14 consecutive days with zero reconciliation failures and
-- zero manual reversals" — and a boolean cannot say when the clock started.
--
-- Run order for an existing database:
--   1. manual/0001_expand_existing.sql (if not already applied)
--   2. manual/0002_wallet_fx_dunning_einvoice.sql
--   3. manual/0003_trust_score.sql
--   4. manual/0004_education_partners.sql
--   5. this file

ALTER TABLE `counterparties`
  ADD COLUMN `autoAllocationPilotAt` TIMESTAMP NULL DEFAULT NULL;

CREATE INDEX `counterparties_pilot_idx`
  ON `counterparties` (`autoAllocationPilotAt`);

-- Enrol the pilot counterparties by hand, deliberately, one at a time:
--
--   UPDATE `counterparties` SET `autoAllocationPilotAt` = NOW() WHERE id = ?;
--
-- Un-enrolling is the same statement with NULL, and it takes effect on the
-- next matched transaction — no deploy, no cache to wait out beyond the flag
-- cache TTL. Withdrawing a counterparty from the pilot does not reverse any
-- allocation already made; that is what `payments.reverseAllocation` is for.
