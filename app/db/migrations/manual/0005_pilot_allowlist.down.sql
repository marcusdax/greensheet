-- Down migration for 0005 — §13.4 auto-allocation pilot.
--
-- READ THIS BEFORE RUNNING IT.
--
-- Turning `autoAllocation` off stops every automatic credit within the flag
-- cache TTL and leaves this column and its data intact. That is the rollback.
-- This file is the last resort, and it destroys something small but real: the
-- record of WHEN each counterparty was admitted to the pilot. That date is the
-- start of the 14-day graduation clock in §13.4, so dropping the column resets
-- every pilot to day zero even if the rows are re-enrolled afterwards.
--
-- Nothing else depends on it: no allocation, invoice or transaction row
-- references this column, and the previous application version never read it.

DROP INDEX `counterparties_pilot_idx` ON `counterparties`;

ALTER TABLE `counterparties`
  DROP COLUMN `autoAllocationPilotAt`;
