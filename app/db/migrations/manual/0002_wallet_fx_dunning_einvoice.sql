-- Expand migration for an EXISTING database — Phase C/E.
--
-- e-wallets (§2.2), multi-currency (§3.3), dunning (§3.4), e-invoice (§3.5),
-- standing orders (§3.6), provenance (§3.8).
--
-- Same rules as 0001: expand-only. Nothing is dropped, no column changes
-- meaning, and no read path in the previous application version is affected —
-- so this release rolls back by feature flag, not by migration (§13.5).
--
-- The two ALTERs at the end only ADD values to an existing enum. 'payos' and
-- 'casso' keep their ordinal positions, so every stored row still reads back as
-- what it was written as. Widening an enum this way is safe; reordering it is
-- not, which is why the new values are appended rather than sorted in.
--
-- Every table below is inert until its flag is turned on:
--   payment_methods, standing_orders, standing_order_cycles → standingOrders
--   dunning_steps, dunning_runs                             → dunning
--   einvoice_submissions                                    → eInvoice
--   fx_rates, fx_adjustments                                → always readable,
--     but only written when a cross-currency allocation happens
--
-- Run order for an existing database:
--   1. db/migrations/manual/0001_expand_existing.sql (if not already applied)
--   2. this file
--   3. deploy the new application (all Phase C/E flags off)
--   4. npm run db:seed:dunning
--   5. turn flags on one at a time (§13.4, runbook §4.3–4.6)

-- Phase C/E — e-wallets (§2.2), FX (§3.3), dunning (§3.4), e-invoice (§3.5),
-- standing orders (§3.6).
--
-- Expand-only, so the previous application version keeps running against this
-- schema and the release rolls back by feature flag rather than by migration
-- (§13.5). The two ALTERs at the end only ADD values to an existing enum:
-- 'payos' and 'casso' keep their positions, so no stored row changes meaning.
-- Every new table is inert until its flag is turned on.

CREATE TABLE `dunning_runs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`invoiceId` bigint unsigned NOT NULL,
	`stepId` bigint unsigned NOT NULL,
	`counterpartyId` bigint unsigned NOT NULL,
	`channel` enum('email','zalo','sms','phone_task','in_app') NOT NULL,
	`status` enum('sent','queued','failed','skipped') NOT NULL DEFAULT 'queued',
	`subject` varchar(255) NOT NULL DEFAULT '',
	`body` text NOT NULL,
	`outstandingMinorAtSend` bigint NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL,
	`skipReason` varchar(255),
	`openedAt` timestamp,
	`clickedAt` timestamp,
	`paidAfterAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dunning_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `dunning_runs_unique_idx` UNIQUE(`invoiceId`,`stepId`)
);

CREATE TABLE `dunning_steps` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`policyCode` varchar(40) NOT NULL DEFAULT 'default',
	`offsetDays` int NOT NULL,
	`channel` enum('email','zalo','sms','phone_task','in_app') NOT NULL,
	`action` enum('send_invoice','send_reminder','create_call_task','offer_installment','escalate') NOT NULL,
	`subjectTemplate` varchar(255) NOT NULL DEFAULT '',
	`bodyTemplate` text NOT NULL,
	`includeFreshQr` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dunning_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `dunning_step_unique_idx` UNIQUE(`policyCode`,`offsetDays`,`channel`)
);

CREATE TABLE `einvoice_submissions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`invoiceId` bigint unsigned NOT NULL,
	`provider` enum('vnpt','misa','viettel','mock') NOT NULL,
	`status` enum('pending','submitted','issued','failed','cancelled','replaced') NOT NULL DEFAULT 'pending',
	`templateCode` varchar(40) NOT NULL DEFAULT '',
	`invoiceSeries` varchar(40) NOT NULL DEFAULT '',
	`authorityInvoiceNumber` varchar(80),
	`authorityCode` varchar(120),
	`lookupUrl` varchar(500),
	`requestPayload` json,
	`responsePayload` json,
	`errorMessage` text,
	`attempts` int NOT NULL DEFAULT 0,
	`submittedAt` timestamp,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `einvoice_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `einvoice_authority_number_idx` UNIQUE(`provider`,`authorityInvoiceNumber`)
);

CREATE TABLE `fx_adjustments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`invoiceId` bigint unsigned NOT NULL,
	`allocationId` bigint unsigned NOT NULL,
	`invoiceCurrency` char(3) NOT NULL,
	`paymentCurrency` char(3) NOT NULL,
	`appliedRate` decimal(18,6) NOT NULL,
	`expectedRate` decimal(18,6),
	`realizedMinor` bigint NOT NULL,
	`rateSource` varchar(60) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fx_adjustments_id` PRIMARY KEY(`id`),
	CONSTRAINT `fx_adjustments_allocation_idx` UNIQUE(`allocationId`)
);

CREATE TABLE `fx_rates` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`baseCurrency` char(3) NOT NULL,
	`quoteCurrency` char(3) NOT NULL,
	`rate` decimal(18,6) NOT NULL,
	`source` varchar(60) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fx_rates_id` PRIMARY KEY(`id`)
);

CREATE TABLE `payment_methods` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`counterpartyId` bigint unsigned NOT NULL,
	`provider` enum('payos','casso','momo','zalopay','manual') NOT NULL,
	`label` varchar(120) NOT NULL DEFAULT '',
	`displayLast4` char(4),
	`tokenEnc` varchar(512),
	`tokenExpiresAt` timestamp,
	`consentGivenAt` timestamp,
	`consentText` varchar(500) NOT NULL DEFAULT '',
	`consentRevokedAt` timestamp,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdByUserId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);

CREATE TABLE `standing_order_cycles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`standingOrderId` bigint unsigned NOT NULL,
	`periodStart` date NOT NULL,
	`invoiceId` bigint unsigned,
	`status` enum('generated','charged','charge_failed','skipped') NOT NULL DEFAULT 'generated',
	`failureReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `standing_order_cycles_id` PRIMARY KEY(`id`),
	CONSTRAINT `standing_cycle_unique_idx` UNIQUE(`standingOrderId`,`periodStart`)
);

CREATE TABLE `standing_orders` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`counterpartyId` bigint unsigned NOT NULL,
	`reference` varchar(40) NOT NULL,
	`cadence` enum('weekly','biweekly','monthly') NOT NULL,
	`anchorDay` smallint NOT NULL DEFAULT 1,
	`currency` char(3) NOT NULL,
	`subtotalMinor` bigint NOT NULL,
	`vatRateBp` int NOT NULL DEFAULT 0,
	`shippingMinor` bigint NOT NULL DEFAULT 0,
	`paymentTermDays` int NOT NULL DEFAULT 14,
	`paymentMethodId` bigint unsigned,
	`lotId` bigint unsigned,
	`notes` varchar(500) NOT NULL DEFAULT '',
	`status` enum('active','paused','ended') NOT NULL DEFAULT 'active',
	`startsOn` date NOT NULL,
	`endsOn` date,
	`lastRunOn` date,
	`nextRunOn` date NOT NULL,
	`createdByUserId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `standing_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `standing_orders_ref_idx` UNIQUE(`reference`)
);

ALTER TABLE `payment_intents` MODIFY COLUMN `provider` enum('payos','casso','momo','zalopay','manual') NOT NULL;
ALTER TABLE `provider_transactions` MODIFY COLUMN `provider` enum('payos','casso','momo','zalopay','manual') NOT NULL;
CREATE INDEX `dunning_runs_invoice_idx` ON `dunning_runs` (`invoiceId`);
CREATE INDEX `dunning_runs_channel_idx` ON `dunning_runs` (`channel`,`status`);
CREATE INDEX `einvoice_invoice_idx` ON `einvoice_submissions` (`invoiceId`);
CREATE INDEX `einvoice_status_idx` ON `einvoice_submissions` (`status`);
CREATE INDEX `fx_adjustments_invoice_idx` ON `fx_adjustments` (`invoiceId`);
CREATE INDEX `fx_rates_pair_idx` ON `fx_rates` (`baseCurrency`,`quoteCurrency`,`observedAt`);
CREATE INDEX `payment_methods_counterparty_idx` ON `payment_methods` (`counterpartyId`);
CREATE INDEX `payment_methods_provider_idx` ON `payment_methods` (`provider`);
CREATE INDEX `standing_cycle_invoice_idx` ON `standing_order_cycles` (`invoiceId`);
CREATE INDEX `standing_orders_due_idx` ON `standing_orders` (`status`,`nextRunOn`);
CREATE INDEX `standing_orders_counterparty_idx` ON `standing_orders` (`counterpartyId`);