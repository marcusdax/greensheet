-- Down migration for 0002 — Phase C/E.
--
-- READ THIS BEFORE RUNNING IT.
--
-- Feature flags are the first line of rollback; this file is the last. Turning
-- `eWalletPayments`, `dunning`, `eInvoice` and `standingOrders` off stops every
-- new code path within a minute and needs no migration at all. Reach for this
-- only when the tables themselves must go.
--
-- These DROPs destroy records you cannot reconstruct:
--   · fx_adjustments — the realized gain or loss on every cross-currency
--     payment. The rate it was computed against is gone once the row is; the
--     invoice and allocation alone cannot re-derive it.
--   · einvoice_submissions — the authority's invoice numbers. An e-invoice we
--     issued exists at the tax authority whether or not we keep the row, and
--     the row is the only link between their document and ours.
--   · dunning_runs — the record of what was said to which customer and when.
--
-- Export all three before running this, and do not run it in production
-- without a signed-off reason.
--
-- Drop order matters only for readability here (there are no FK constraints in
-- this schema), but it follows the dependency direction anyway.

DROP TABLE IF EXISTS `standing_order_cycles`;
DROP TABLE IF EXISTS `standing_orders`;
DROP TABLE IF EXISTS `dunning_runs`;
DROP TABLE IF EXISTS `dunning_steps`;
DROP TABLE IF EXISTS `einvoice_submissions`;
DROP TABLE IF EXISTS `fx_adjustments`;
DROP TABLE IF EXISTS `fx_rates`;
DROP TABLE IF EXISTS `payment_methods`;

-- The enum narrowing is deliberately NOT scripted. Narrowing it back to
-- ('payos','casso','manual') would silently blank the provider on every MoMo
-- and ZaloPay row — MySQL coerces an out-of-range enum to ''. Leaving the two
-- extra values in place costs nothing and loses no data. If they genuinely must
-- go, first confirm the count is zero:
--
--   SELECT provider, COUNT(*) FROM provider_transactions
--    WHERE provider IN ('momo','zalopay') GROUP BY provider;
--   SELECT provider, COUNT(*) FROM payment_intents
--    WHERE provider IN ('momo','zalopay') GROUP BY provider;
--
-- and only then narrow the columns by hand.
