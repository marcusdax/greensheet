-- Expand migration for an EXISTING database — Trust Score (§6).
--
-- Purely additive: three new tables and nothing else. No existing column
-- changes type or meaning, so the previous application version runs unchanged
-- against this schema and the release rolls back by feature flag (§13.5).
--
-- All three are inert until the `trustScore` flag is on. Turning it on starts
-- recording evidence; turning `trustGates` on separately is what lets a low
-- score actually hold an automatic settlement (§7). They are two switches on
-- purpose — scoring is safe to observe long before it is safe to enforce.
--
-- Note what is NOT here: no backfill. Scores are derived from evidence, and
-- there is no evidence for anything that happened before this migration. A
-- counterparty with ten years of clean settlements starts at neutral and earns
-- its way up from the next accepted document, which is the honest position —
-- inventing evidence for past events would defeat the point of the audit trail.
--
-- Run order for an existing database:
--   1. manual/0001_expand_existing.sql (if not already applied)
--   2. manual/0002_wallet_fx_dunning_einvoice.sql
--   3. this file
--   4. deploy the new application (trustScore and trustGates both off)
--   5. turn trustScore on, watch evidence accumulate for a fortnight
--   6. only then consider trustGates (runbook §4.7)

CREATE TABLE `trust_evidence` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`entityType` enum('counterparty','roaster','lot') NOT NULL,
	`entityId` bigint unsigned NOT NULL,
	`kind` enum('document_accepted','payment_settled','payment_late','allocation_reversed','quality_confirmed','quality_contradicted','identity_verified','peer_feedback','admin_override') NOT NULL,
	`component` enum('documentVerification','transactionIntegrity','qualityConsistency','identityLongevity','networkReputation') NOT NULL,
	`sourceType` varchar(40) NOT NULL,
	`sourceId` bigint unsigned NOT NULL,
	`weight` decimal(8,2) NOT NULL,
	`note` varchar(255) NOT NULL DEFAULT '',
	`recordedByUserId` bigint unsigned,
	`modelVersion` varchar(20) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `trust_evidence_source_idx` UNIQUE(`entityType`,`entityId`,`kind`,`sourceType`,`sourceId`)
);

CREATE TABLE `trust_scores` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`entityType` enum('counterparty','roaster','lot') NOT NULL,
	`entityId` bigint unsigned NOT NULL,
	`score` decimal(5,1) NOT NULL,
	`band` enum('at_risk','provisional','established','verified','sealed') NOT NULL,
	`components` json,
	`evidenceCount` int NOT NULL DEFAULT 0,
	`acceptedDocumentCount` int NOT NULL DEFAULT 0,
	`modelVersion` varchar(20) NOT NULL,
	`overrideReason` varchar(255),
	`overrideByUserId` bigint unsigned,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `trust_scores_entity_idx` UNIQUE(`entityType`,`entityId`)
);

CREATE TABLE `trust_score_snapshots` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`entityType` enum('counterparty','roaster','lot') NOT NULL,
	`entityId` bigint unsigned NOT NULL,
	`previousScore` decimal(5,1),
	`score` decimal(5,1) NOT NULL,
	`band` enum('at_risk','provisional','established','verified','sealed') NOT NULL,
	`components` json,
	`evidenceIds` json,
	`modelVersion` varchar(20) NOT NULL,
	`reason` varchar(255) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trust_score_snapshots_id` PRIMARY KEY(`id`)
);

CREATE INDEX `trust_evidence_entity_idx` ON `trust_evidence` (`entityType`,`entityId`);
CREATE INDEX `trust_evidence_kind_idx` ON `trust_evidence` (`kind`);
CREATE INDEX `trust_scores_band_idx` ON `trust_scores` (`band`);
CREATE INDEX `trust_scores_rank_idx` ON `trust_scores` (`score`);
CREATE INDEX `trust_snapshots_entity_idx` ON `trust_score_snapshots` (`entityType`,`entityId`,`id`);