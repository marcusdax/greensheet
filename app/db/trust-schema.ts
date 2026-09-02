// Trust Score persistence — spec §6.
//
// Three tables, and the split between them is the whole design:
//
//   trust_evidence   append-only facts. Never updated, never deleted. This is
//                    the audit trail that makes a score defensible.
//   trust_scores     the current score per entity. Derived — it can always be
//                    rebuilt from evidence, which is what makes a weight change
//                    a recomputation rather than a data migration.
//   trust_snapshots  the last 30 recomputations, for the trend line. Each one
//                    keeps its own modelVersion so a v1 point still renders as
//                    v1 after the weights move to v2.
//
// Same conventions as the rest of the schema: serial PKs, bigint unsigned FKs,
// timestamps UTC.
import {
  mysqlTable,
  serial,
  bigint,
  int,
  varchar,
  timestamp,
  decimal,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });

/** Kept in sync with contracts/trust.ts. */
const ENTITY_TYPES = ["counterparty", "roaster", "lot"] as const;
const EVIDENCE_KINDS = [
  "document_accepted",
  "payment_settled",
  "payment_late",
  "allocation_reversed",
  "quality_confirmed",
  "quality_contradicted",
  "identity_verified",
  "peer_feedback",
  "admin_override",
] as const;
const COMPONENTS = [
  "documentVerification",
  "transactionIntegrity",
  "qualityConsistency",
  "identityLongevity",
  "networkReputation",
] as const;

// ─── trust_evidence ──────────────────────────────────────────────────────────
// Append-only. §6 requires that re-accepting the same document does not
// double-count, and the unique index below is that guarantee rather than a
// check-then-insert that two concurrent handlers would both pass.
//
// `sourceType` + `sourceId` name the thing that happened (a document, an
// invoice, a cupping session). The same source may legitimately produce two
// different KINDS of evidence — an accepted lab report is both a document and,
// if its cup score contradicts the claim, a quality signal — so the uniqueness
// is on the triple, not on the source alone.
export const trustEvidence = mysqlTable(
  "trust_evidence",
  {
    id: serial("id").primaryKey(),
    entityType: mysqlEnum("entityType", ENTITY_TYPES).notNull(),
    entityId: fk("entityId").notNull(),
    kind: mysqlEnum("kind", EVIDENCE_KINDS).notNull(),
    component: mysqlEnum("component", COMPONENTS).notNull(),
    sourceType: varchar("sourceType", { length: 40 }).notNull(),
    sourceId: fk("sourceId").notNull(),
    /**
     * Signed contribution in evidence points, not score points. The calculator
     * turns points into a 0–100 sub-score; storing the sub-score here would
     * bake today's weights into yesterday's facts.
     */
    weight: decimal("weight", { precision: 8, scale: 2 }).notNull(),
    /** Why this row exists, in words an operator can read in the panel. */
    note: varchar("note", { length: 255 }).notNull().default(""),
    /** Set only for admin_override rows — §9 requires these be auditable. */
    recordedByUserId: fk("recordedByUserId"),
    modelVersion: varchar("modelVersion", { length: 20 }).notNull(),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    // The idempotency guarantee. §6: "re-accepting the same documentId does not
    // double-count evidence."
    uniqueIndex("trust_evidence_source_idx").on(
      t.entityType,
      t.entityId,
      t.kind,
      t.sourceType,
      t.sourceId
    ),
    index("trust_evidence_entity_idx").on(t.entityType, t.entityId),
    index("trust_evidence_kind_idx").on(t.kind),
  ]
);

// ─── trust_scores ────────────────────────────────────────────────────────────
// One row per entity, holding the current score. Derived from trust_evidence
// and safe to rebuild at any time.
export const trustScores = mysqlTable(
  "trust_scores",
  {
    id: serial("id").primaryKey(),
    entityType: mysqlEnum("entityType", ENTITY_TYPES).notNull(),
    entityId: fk("entityId").notNull(),
    /** One decimal, so 74.9 and 75.0 land either side of a band edge exactly. */
    score: decimal("score", { precision: 5, scale: 1 }).notNull(),
    band: mysqlEnum("band", [
      "at_risk",
      "provisional",
      "established",
      "verified",
      "sealed",
    ]).notNull(),
    /** The five sub-scores, so the panel's bars need no recomputation to draw. */
    components: json("components").$type<Record<string, number>>(),
    evidenceCount: int("evidenceCount").notNull().default(0),
    acceptedDocumentCount: int("acceptedDocumentCount").notNull().default(0),
    modelVersion: varchar("modelVersion", { length: 20 }).notNull(),
    /** Set when a platform_admin overrides; §9 wants zero silent overrides. */
    overrideReason: varchar("overrideReason", { length: 255 }),
    overrideByUserId: fk("overrideByUserId"),
    calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    uniqueIndex("trust_scores_entity_idx").on(t.entityType, t.entityId),
    index("trust_scores_band_idx").on(t.band),
    // Ranking reads this: high trust first, then the most recently evidenced.
    index("trust_scores_rank_idx").on(t.score),
  ]
);

// ─── trust_score_snapshots ───────────────────────────────────────────────────
// §6: "store current score + last 30 snapshots for trend lines". A snapshot is
// written only when the score actually moves — a recomputation that changes
// nothing is not a data point, and writing one would flatten every trend line
// into noise.
export const trustSnapshots = mysqlTable(
  "trust_score_snapshots",
  {
    id: serial("id").primaryKey(),
    entityType: mysqlEnum("entityType", ENTITY_TYPES).notNull(),
    entityId: fk("entityId").notNull(),
    previousScore: decimal("previousScore", { precision: 5, scale: 1 }),
    score: decimal("score", { precision: 5, scale: 1 }).notNull(),
    band: mysqlEnum("band", [
      "at_risk",
      "provisional",
      "established",
      "verified",
      "sealed",
    ]).notNull(),
    components: json("components").$type<Record<string, number>>(),
    /** Which evidence rows caused this move, for "why did my score change?". */
    evidenceIds: json("evidenceIds").$type<number[]>(),
    modelVersion: varchar("modelVersion", { length: 20 }).notNull(),
    reason: varchar("reason", { length: 255 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("trust_snapshots_entity_idx").on(t.entityType, t.entityId, t.id)]
);
