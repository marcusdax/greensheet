-- Down migration for 0004 — Education & Partners.
--
-- READ THIS BEFORE RUNNING IT.
--
-- Turning `cupperAuthority` off stops the QC gate within a minute and leaves
-- every record intact. That is the rollback; this file is the last resort.
--
-- What these DROPs destroy and nothing can rebuild:
--   · training_progress — who passed which phase, on what score, assessed by
--     whom. §1.2 Phase 4 certification is a person's professional record.
--   · cupper_calibrations — the evidence behind every §1.3 variance figure. A
--     cupper suspended for drift cannot be shown to have drifted without it.
--   · lot_dispositions and supplier_claims — how exceptions were closed, who
--     was found at fault, and what money moved. §D.4 preserves a fraud claim
--     for a year and arbitration can reach back further; these rows are the
--     case file.
--   · partner_protections — §9.3 non-retaliation is only checkable against a
--     record of who disputed what and at which tier. Dropping it destroys the
--     partner's evidence, not ours.
--
-- Export all of it first, and do not run this in production without a
-- signed-off reason.

DROP TABLE IF EXISTS `partner_protections`;
DROP TABLE IF EXISTS `supplier_claims`;
DROP TABLE IF EXISTS `lot_dispositions`;
DROP TABLE IF EXISTS `cupper_calibrations`;
DROP TABLE IF EXISTS `training_progress`;
DROP TABLE IF EXISTS `curriculum_modules`;
DROP TABLE IF EXISTS `cupper_profiles`;
