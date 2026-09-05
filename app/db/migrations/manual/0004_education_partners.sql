-- Expand migration for an EXISTING database — Education & Partners.
--
-- Cupper qualification and the training record (SOP §1), and exception
-- dispositions, supplier claims and §9 partner protections (Supplier Agreement
-- §B–§E, Revenue Share Agreement §9–§10).
--
-- Purely additive: six new tables, no existing column changed. The previous
-- application version runs unchanged against this schema, so the release rolls
-- back by feature flag rather than by migration (§13.5).
--
-- The one behaviour change is gated: `cupperAuthority` makes the QC screen
-- refuse a session from an uncertified, lapsed or suspended cupper. Turning it
-- on BEFORE seeding cupper profiles would block every cupping session, since
-- §1.1 Tier 0 covers anyone without a profile. Seed first, check the roster,
-- then flip it.
--
-- Run order for an existing database:
--   1. manual/0001_expand_existing.sql (if not already applied)
--   2. manual/0002_wallet_fx_dunning_einvoice.sql
--   3. manual/0003_trust_score.sql
--   4. this file
--   5. deploy, then `npm run db:seed:education`
--   6. review Education → Cupper roster, then enable `cupperAuthority`

CREATE TABLE `cupper_calibrations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`profileId` bigint unsigned NOT NULL,
	`kind` enum('panel_comparison','reference_coffee','repeat_session') NOT NULL,
	`cuppingSessionId` bigint unsigned,
	`lotCode` varchar(60) NOT NULL DEFAULT '',
	`cupperScore` double NOT NULL,
	`referenceScore` double NOT NULL,
	`deltaPoints` double NOT NULL,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cupper_calibrations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `cupper_profiles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned,
	`fullName` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL DEFAULT '',
	`tier` enum('tier_0','tier_3','tier_2','tier_1') NOT NULL DEFAULT 'tier_0',
	`licenceNumber` varchar(60) NOT NULL DEFAULT '',
	`licenceExpiresAt` date,
	`supervisedCups` int NOT NULL DEFAULT 0,
	`totalCups` int NOT NULL DEFAULT 0,
	`yearsExperience` int NOT NULL DEFAULT 0,
	`certifiedByProfileId` bigint unsigned,
	`certifiedAt` timestamp,
	`lastRecertifiedAt` timestamp,
	`suspended` boolean NOT NULL DEFAULT false,
	`suspensionReason` varchar(255),
	`suspendedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `cupper_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `cupper_name_idx` UNIQUE(`fullName`)
);

CREATE TABLE `curriculum_modules` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`track` enum('cupping','cultivation','processing','finance','compliance') NOT NULL,
	`title` varchar(255) NOT NULL,
	`phaseCode` varchar(20) NOT NULL DEFAULT '',
	`sequence` int NOT NULL DEFAULT 0,
	`durationLabel` varchar(60) NOT NULL DEFAULT '',
	`objective` text NOT NULL,
	`passCriterion` varchar(255) NOT NULL DEFAULT '',
	`qualifiesForTier` enum('tier_0','tier_3','tier_2','tier_1'),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curriculum_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `curriculum_modules_code_unique` UNIQUE(`code`)
);

CREATE TABLE `training_progress` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`profileId` bigint unsigned NOT NULL,
	`phaseCode` varchar(20) NOT NULL,
	`attempt` int NOT NULL DEFAULT 1,
	`score` double,
	`outcome` enum('passed','failed','in_progress') NOT NULL DEFAULT 'in_progress',
	`assessorProfileId` bigint unsigned,
	`notes` text,
	`recordedByUserId` bigint unsigned,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `training_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_attempt_idx` UNIQUE(`profileId`,`phaseCode`,`attempt`)
);

CREATE TABLE `lot_dispositions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`exceptionId` bigint unsigned,
	`lotId` bigint unsigned,
	`lotCode` varchar(60) NOT NULL DEFAULT '',
	`partnerId` bigint unsigned,
	`disposition` enum('release','downgrade','reject_claim','reverify_partition') NOT NULL,
	`claimedFaultOrigin` enum('supplier','logistics','greensheet','indeterminate') NOT NULL,
	`faultOrigin` enum('supplier','logistics','greensheet','indeterminate') NOT NULL,
	`proofFiled` boolean NOT NULL DEFAULT false,
	`proofDescription` varchar(500) NOT NULL DEFAULT '',
	`faultReason` varchar(500) NOT NULL DEFAULT '',
	`quantityLbs` int NOT NULL DEFAULT 0,
	`originalPricePerLbCents` int NOT NULL DEFAULT 0,
	`downgradeGradePricePerLbCents` int,
	`operationalCostCents` int NOT NULL DEFAULT 0,
	`adjustedPricePerLbCents` int,
	`creditDueCents` int NOT NULL DEFAULT 0,
	`supplierBorneCents` int NOT NULL DEFAULT 0,
	`capApplied` boolean NOT NULL DEFAULT false,
	`calculation` json,
	`noticeRequired` boolean NOT NULL DEFAULT false,
	`noticeSentAt` timestamp,
	`secondEvaluationRequestedAt` timestamp,
	`dueAt` date,
	`status` enum('open','closed','superseded') NOT NULL DEFAULT 'open',
	`childLotCode` varchar(60),
	`rationale` text,
	`decidedByUserId` bigint unsigned,
	`decidedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lot_dispositions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `partner_protections` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`partnerId` bigint unsigned NOT NULL,
	`kind` enum('score_dispute','scorecard_request','passthrough_concern','sla_breach_release') NOT NULL,
	`lotCode` varchar(60) NOT NULL DEFAULT '',
	`addendumId` bigint unsigned,
	`detail` text,
	`status` enum('open','upheld','declined','resolved') NOT NULL DEFAULT 'open',
	`tierAtRaise` varchar(20) NOT NULL DEFAULT '',
	`resolutionNote` text,
	`raisedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_protections_id` PRIMARY KEY(`id`)
);

CREATE TABLE `supplier_claims` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`dispositionId` bigint unsigned NOT NULL,
	`partnerId` bigint unsigned,
	`lotCode` varchar(60) NOT NULL DEFAULT '',
	`basis` enum('standard','latent_defect','fraud') NOT NULL DEFAULT 'standard',
	`detectedAt` timestamp NOT NULL,
	`purchasePriceCents` int NOT NULL DEFAULT 0,
	`holdingCostPerDayCents` int NOT NULL DEFAULT 0,
	`daysHeld` int NOT NULL DEFAULT 0,
	`holdingDaysCharged` int NOT NULL DEFAULT 0,
	`analysisCostCents` int NOT NULL DEFAULT 0,
	`disposalCostCents` int NOT NULL DEFAULT 0,
	`subtotalCents` int NOT NULL DEFAULT 0,
	`totalClaimCents` int NOT NULL DEFAULT 0,
	`supplierBorneCents` int NOT NULL DEFAULT 0,
	`capApplied` boolean NOT NULL DEFAULT false,
	`status` enum('draft','notice_issued','accepted','disputed','independent_evaluation','withdrawn','resolved','time_barred') NOT NULL DEFAULT 'draft',
	`noticeIssuedAt` timestamp,
	`supplierResponseDueAt` date,
	`supplierRespondedAt` timestamp,
	`independentEvaluatorName` varchar(200),
	`independentEvaluationDueAt` date,
	`independentEvaluationOutcome` enum('confirmed','contradicted'),
	`evaluationCostCents` int NOT NULL DEFAULT 0,
	`resolutionNote` text,
	`resolvedAt` timestamp,
	`raisedByUserId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_disposition_idx` UNIQUE(`dispositionId`)
);

CREATE INDEX `calibration_profile_idx` ON `cupper_calibrations` (`profileId`,`observedAt`);
CREATE INDEX `calibration_kind_idx` ON `cupper_calibrations` (`kind`);
CREATE INDEX `cupper_tier_idx` ON `cupper_profiles` (`tier`);
CREATE INDEX `cupper_user_idx` ON `cupper_profiles` (`userId`);
CREATE INDEX `curriculum_track_idx` ON `curriculum_modules` (`track`,`sequence`);
CREATE INDEX `training_profile_idx` ON `training_progress` (`profileId`);
CREATE INDEX `disposition_lot_idx` ON `lot_dispositions` (`lotCode`);
CREATE INDEX `disposition_partner_idx` ON `lot_dispositions` (`partnerId`);
CREATE INDEX `disposition_kind_idx` ON `lot_dispositions` (`disposition`);
CREATE INDEX `disposition_exception_idx` ON `lot_dispositions` (`exceptionId`);
CREATE INDEX `protection_partner_idx` ON `partner_protections` (`partnerId`,`raisedAt`);
CREATE INDEX `protection_kind_idx` ON `partner_protections` (`kind`);
CREATE INDEX `claim_partner_idx` ON `supplier_claims` (`partnerId`);
CREATE INDEX `claim_status_idx` ON `supplier_claims` (`status`);