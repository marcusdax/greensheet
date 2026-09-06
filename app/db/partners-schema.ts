// Exception dispositions, supplier claims and partner protections —
// Supplier Agreement §B–§E and Revenue Share Agreement §9–§10.
//
// The warehouse context already records that an exception happened. These
// tables record how it was CLOSED: which of the four dispositions, who was
// found at fault, what money moved, and whether the clause's own deadlines were
// met. Without them a disposition is a conversation; with them it is a record
// that survives arbitration.
import {
  mysqlTable,
  serial,
  bigint,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });

/** Kept in sync with contracts/dispositions.ts. */
const DISPOSITIONS = [
  "release",
  "downgrade",
  "reject_claim",
  "reverify_partition",
] as const;
const FAULT_ORIGINS = [
  "supplier",
  "logistics",
  "greensheet",
  "indeterminate",
] as const;

// ─── lot_dispositions ────────────────────────────────────────────────────────
// How a warehouse exception was closed. One row per disposition; a lot that is
// partitioned and later downgraded carries two, in order.
export const lotDispositions = mysqlTable(
  "lot_dispositions",
  {
    id: serial("id").primaryKey(),
    /** The warehouse exception this closes. */
    exceptionId: fk("exceptionId"),
    lotId: fk("lotId"),
    lotCode: varchar("lotCode", { length: 60 }).notNull().default(""),
    partnerId: fk("partnerId"),
    disposition: mysqlEnum("disposition", DISPOSITIONS).notNull(),
    /** What the investigator proposed before §B.2's burden of proof applied. */
    claimedFaultOrigin: mysqlEnum(
      "claimedFaultOrigin",
      FAULT_ORIGINS
    ).notNull(),
    /** What §B.2 actually resolved to — the two differ when no proof was filed. */
    faultOrigin: mysqlEnum("faultOrigin", FAULT_ORIGINS).notNull(),
    /** §B.2 — a customs report, carrier claim, or environmental data. */
    proofFiled: boolean("proofFiled").notNull().default(false),
    proofDescription: varchar("proofDescription", { length: 500 })
      .notNull()
      .default(""),
    faultReason: varchar("faultReason", { length: 500 }).notNull().default(""),

    // ── Money, integer cents, matching the partners context ──
    quantityLbs: int("quantityLbs").notNull().default(0),
    originalPricePerLbCents: int("originalPricePerLbCents")
      .notNull()
      .default(0),
    downgradeGradePricePerLbCents: int("downgradeGradePricePerLbCents"),
    operationalCostCents: int("operationalCostCents").notNull().default(0),
    adjustedPricePerLbCents: int("adjustedPricePerLbCents"),
    /** Positive: owed back to the supplier. */
    creditDueCents: int("creditDueCents").notNull().default(0),
    /** The share of that credit the at-fault party actually bears (§B.2). */
    supplierBorneCents: int("supplierBorneCents").notNull().default(0),
    /** True when §C.1's 50% floor or §C.2's 110% ceiling changed the figure. */
    capApplied: boolean("capApplied").notNull().default(false),
    calculation: json("calculation").$type<Record<string, unknown>>(),

    /** §C.3 — an adjustment above 5% needs written notice within 48 hours. */
    noticeRequired: boolean("noticeRequired").notNull().default(false),
    noticeSentAt: timestamp("noticeSentAt"),
    /** §C.3 — the supplier's 5-business-day re-evaluation request. */
    secondEvaluationRequestedAt: timestamp("secondEvaluationRequestedAt"),

    /** §B.1's own clock, so a missed SLA is visible rather than inferred. */
    dueAt: date("dueAt", { mode: "string" }),
    status: mysqlEnum("status", ["open", "closed", "superseded"])
      .notNull()
      .default("open"),
    /** §B.1 Disposition 4 — the Child Lot this partition created. */
    childLotCode: varchar("childLotCode", { length: 60 }),
    rationale: text("rationale"),
    decidedByUserId: fk("decidedByUserId"),
    decidedAt: timestamp("decidedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("disposition_lot_idx").on(t.lotCode),
    index("disposition_partner_idx").on(t.partnerId),
    index("disposition_kind_idx").on(t.disposition),
    index("disposition_exception_idx").on(t.exceptionId),
  ]
);

// ─── supplier_claims ─────────────────────────────────────────────────────────
// §C.2 and §D. A claim has its own life after the disposition that raised it:
// the supplier has 14 days to accept or dispute, an independent evaluation runs
// 30, and §D.4 says when the right to claim expires altogether.
export const supplierClaims = mysqlTable(
  "supplier_claims",
  {
    id: serial("id").primaryKey(),
    dispositionId: fk("dispositionId").notNull(),
    partnerId: fk("partnerId"),
    lotCode: varchar("lotCode", { length: 60 }).notNull().default(""),
    /** §D.4 — which limitation window applies. */
    basis: mysqlEnum("basis", ["standard", "latent_defect", "fraud"])
      .notNull()
      .default("standard"),
    detectedAt: timestamp("detectedAt").notNull(),

    purchasePriceCents: int("purchasePriceCents").notNull().default(0),
    holdingCostPerDayCents: int("holdingCostPerDayCents").notNull().default(0),
    daysHeld: int("daysHeld").notNull().default(0),
    /** Capped at 30 days by §C.2; the excess is absorbed by Greensheet. */
    holdingDaysCharged: int("holdingDaysCharged").notNull().default(0),
    analysisCostCents: int("analysisCostCents").notNull().default(0),
    disposalCostCents: int("disposalCostCents").notNull().default(0),
    subtotalCents: int("subtotalCents").notNull().default(0),
    /** After §C.2's 110% ceiling. */
    totalClaimCents: int("totalClaimCents").notNull().default(0),
    supplierBorneCents: int("supplierBorneCents").notNull().default(0),
    capApplied: boolean("capApplied").notNull().default(false),

    status: mysqlEnum("status", [
      "draft",
      "notice_issued",
      "accepted",
      "disputed",
      "independent_evaluation",
      "withdrawn",
      "resolved",
      "time_barred",
    ])
      .notNull()
      .default("draft"),
    /** §C.2 — notice within 2 business days of disposition. */
    noticeIssuedAt: timestamp("noticeIssuedAt"),
    /** §C.2 — the supplier's 14-day response window runs from notice. */
    supplierResponseDueAt: date("supplierResponseDueAt", { mode: "string" }),
    supplierRespondedAt: timestamp("supplierRespondedAt"),
    /** §C.2 — 50/50 split unless the evaluation confirms Greensheet's finding. */
    independentEvaluatorName: varchar("independentEvaluatorName", {
      length: 200,
    }),
    independentEvaluationDueAt: date("independentEvaluationDueAt", {
      mode: "string",
    }),
    independentEvaluationOutcome: mysqlEnum("independentEvaluationOutcome", [
      "confirmed",
      "contradicted",
    ]),
    evaluationCostCents: int("evaluationCostCents").notNull().default(0),
    resolutionNote: text("resolutionNote"),
    resolvedAt: timestamp("resolvedAt"),
    raisedByUserId: fk("raisedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("claim_partner_idx").on(t.partnerId),
    index("claim_status_idx").on(t.status),
    uniqueIndex("claim_disposition_idx").on(t.dispositionId),
  ]
);

// ─── partner_protections ─────────────────────────────────────────────────────
// Revenue Share Agreement §9. These are rights the partner holds against us,
// which is exactly why they belong in the database rather than in a PDF: §9.3's
// non-retaliation promise can only be checked if there is a record of who
// disputed what, and when.
export const partnerProtections = mysqlTable(
  "partner_protections",
  {
    id: serial("id").primaryKey(),
    partnerId: fk("partnerId").notNull(),
    kind: mysqlEnum("kind", [
      // §9.1 — the right to dispute a cup score and request independent evaluation.
      "score_dispute",
      // §9.1 — the right to every scorecard behind a Quality Tier.
      "scorecard_request",
      // §9.2 — a concern about a collector's pass-through to farmers.
      "passthrough_concern",
      // §9.1 — floor payment SLA missed by >5 business days.
      "sla_breach_release",
    ]).notNull(),
    lotCode: varchar("lotCode", { length: 60 }).notNull().default(""),
    addendumId: fk("addendumId"),
    detail: text("detail"),
    status: mysqlEnum("status", ["open", "upheld", "declined", "resolved"])
      .notNull()
      .default("open"),
    /**
     * §9.3 — the tier at the moment the partner raised it. A later downgrade
     * can then be checked against this rather than argued about: non-retaliation
     * is only enforceable if the before-state was written down.
     */
    tierAtRaise: varchar("tierAtRaise", { length: 20 }).notNull().default(""),
    resolutionNote: text("resolutionNote"),
    raisedAt: timestamp("raisedAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("protection_partner_idx").on(t.partnerId, t.raisedAt),
    index("protection_kind_idx").on(t.kind),
  ]
);
