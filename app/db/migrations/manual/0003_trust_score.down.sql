-- Down migration for 0003 — Trust Score.
--
-- READ THIS BEFORE RUNNING IT.
--
-- Feature flags are the first line of rollback. Turning `trustScore` off stops
-- every handler within a minute and leaves the evidence intact; turning
-- `trustGates` off stops the §7 settlement holds. Neither needs a migration.
--
-- This file destroys the audit trail. trust_evidence is append-only precisely
-- so that a score can be defended a year later — "why is this supplier
-- Provisional" is answerable only while those rows exist, and they cannot be
-- reconstructed from the documents and invoices alone because the weights that
-- applied at the time are recorded per row.
--
-- Export trust_evidence before running this, and do not run it in production
-- without a signed-off reason.

DROP TABLE IF EXISTS `trust_score_snapshots`;
DROP TABLE IF EXISTS `trust_scores`;
DROP TABLE IF EXISTS `trust_evidence`;
