// Cupper qualification, training and calibration — Cupping Standards SOP §1.
//
// The SOP's training programme was previously a document in the SOP library
// that people read and ticked. These tables make it a record: who is certified
// for what, which phase they passed and on what score, and whether their scores
// have drifted since. That record is what the QC router consults before it will
// accept a cupping session.
//
// Same conventions as the rest of the schema: serial PKs, bigint unsigned FKs,
// timestamps UTC.
import {
  mysqlTable,
  serial,
  bigint,
  int,
  varchar,
  text,
  double,
  boolean,
  timestamp,
  date,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });

/** Kept in sync with contracts/cupping-authority.ts. */
const TIERS = ["tier_0", "tier_3", "tier_2", "tier_1"] as const;

// ─── cupper_profiles ─────────────────────────────────────────────────────────
// One row per person who may enter a cupping room. A profile is not an account:
// §1.1 covers contractors and visiting Q-Graders who never log in, so userId is
// nullable and the name is the identity that appears on a scorecard.
export const cupperProfiles = mysqlTable(
  "cupper_profiles",
  {
    id: serial("id").primaryKey(),
    userId: fk("userId"),
    fullName: varchar("fullName", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().default(""),
    tier: mysqlEnum("tier", TIERS).notNull().default("tier_0"),
    /** SCA licence number for a Tier 1; blank otherwise. */
    licenceNumber: varchar("licenceNumber", { length: 60 })
      .notNull()
      .default(""),
    /** §1.1 — three years from issue. Null where the tier carries no licence. */
    licenceExpiresAt: date("licenceExpiresAt", { mode: "string" }),
    /** §1.2 — Tier 2 needs 100 before independent work. */
    supervisedCups: int("supervisedCups").notNull().default(0),
    totalCups: int("totalCups").notNull().default(0),
    yearsExperience: int("yearsExperience").notNull().default(0),
    /** §1.2 Phase 4 — who signed them off, and when. */
    certifiedByProfileId: fk("certifiedByProfileId"),
    certifiedAt: timestamp("certifiedAt"),
    /** §1.3 — annual. Null means never recertified. */
    lastRecertifiedAt: timestamp("lastRecertifiedAt"),
    /**
     * §1.3 probation: "limited cupping authority until retraining is
     * completed". Held as a flag plus a reason rather than a tier change, so a
     * suspension is reversible without rewriting someone's qualification.
     */
    suspended: boolean("suspended").notNull().default(false),
    suspensionReason: varchar("suspensionReason", { length: 255 }),
    suspendedAt: timestamp("suspendedAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  t => [
    index("cupper_tier_idx").on(t.tier),
    index("cupper_user_idx").on(t.userId),
    uniqueIndex("cupper_name_idx").on(t.fullName),
  ]
);

// ─── training_progress ───────────────────────────────────────────────────────
// One row per phase attempt. Attempts are kept rather than overwritten: §1.2
// Phase 1 explicitly allows a retest after two weeks, and a cupper who passed
// on the third attempt is a different training record from one who passed
// first time.
export const trainingProgress = mysqlTable(
  "training_progress",
  {
    id: serial("id").primaryKey(),
    profileId: fk("profileId").notNull(),
    /** PHASE-1 … PHASE-4, from TRAINING_PROGRAMME. */
    phaseCode: varchar("phaseCode", { length: 20 }).notNull(),
    attempt: int("attempt").notNull().default(1),
    /** Aroma compounds correct, descriptors placed, or observed variance. */
    score: double("score"),
    outcome: mysqlEnum("outcome", ["passed", "failed", "in_progress"])
      .notNull()
      .default("in_progress"),
    /** Tier 1 who supervised or signed off. */
    assessorProfileId: fk("assessorProfileId"),
    notes: text("notes"),
    recordedByUserId: fk("recordedByUserId"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("training_attempt_idx").on(t.profileId, t.phaseCode, t.attempt),
    index("training_profile_idx").on(t.profileId),
  ]
);

// ─── cupper_calibrations ─────────────────────────────────────────────────────
// The evidence behind the §1.3 performance dashboard. Each row is one score a
// cupper gave against a known reference — a panel average or a standardised
// reference coffee — so variance is measured rather than asserted.
export const cupperCalibrations = mysqlTable(
  "cupper_calibrations",
  {
    id: serial("id").primaryKey(),
    profileId: fk("profileId").notNull(),
    kind: mysqlEnum("kind", [
      "panel_comparison",
      "reference_coffee",
      "repeat_session",
    ]).notNull(),
    /** Optional link to the session this came from. */
    cuppingSessionId: fk("cuppingSessionId"),
    lotCode: varchar("lotCode", { length: 60 }).notNull().default(""),
    /** What this cupper scored. */
    cupperScore: double("cupperScore").notNull(),
    /** The panel average or the reference baseline it is measured against. */
    referenceScore: double("referenceScore").notNull(),
    /** Signed, so a cupper who runs consistently high is visible as a bias. */
    deltaPoints: double("deltaPoints").notNull(),
    observedAt: timestamp("observedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("calibration_profile_idx").on(t.profileId, t.observedAt),
    index("calibration_kind_idx").on(t.kind),
  ]
);

// ─── curriculum_modules ──────────────────────────────────────────────────────
// The teaching content itself, separate from sop_documents. An SOP is a
// reference you consult; a module is something you work through and are
// assessed on, and conflating them is why the library had acknowledgments but
// no way to tell who could actually do the job.
export const curriculumModules = mysqlTable(
  "curriculum_modules",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 40 }).notNull().unique(),
    track: mysqlEnum("track", [
      "cupping",
      "cultivation",
      "processing",
      "finance",
      "compliance",
    ]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    /** Which SOP phase this module delivers, where it maps to one. */
    phaseCode: varchar("phaseCode", { length: 20 }).notNull().default(""),
    sequence: int("sequence").notNull().default(0),
    durationLabel: varchar("durationLabel", { length: 60 })
      .notNull()
      .default(""),
    objective: text("objective").notNull(),
    passCriterion: varchar("passCriterion", { length: 255 })
      .notNull()
      .default(""),
    /** Tier this module qualifies someone toward, where applicable. */
    qualifiesForTier: mysqlEnum("qualifiesForTier", TIERS),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("curriculum_track_idx").on(t.track, t.sequence)]
);
