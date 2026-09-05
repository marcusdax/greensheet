import {
  mysqlTable,
  serial,
  bigint,
  int,
  smallint,
  double,
  decimal,
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

// drizzle.config.ts points at this single file, so the manager and payments
// contexts are re-exported here for drizzle-kit to pick them up (spec §2).
export * from "./manager-schema";
export * from "./payments-schema";
export * from "./wallet-schema";
export * from "./trust-schema";
export * from "./education-schema";
export * from "./partners-schema";

// ─── Catalog Context ─────────────────────────────────────────────────────────
// Money is always integer cents at rest (canonical convention).
export const coffeeLots = mysqlTable(
  "coffee_lots",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    origin: varchar("origin", { length: 120 }).notNull(),
    region: varchar("region", { length: 120 }).notNull(),
    varietal: varchar("varietal", { length: 120 }).notNull(),
    processMethod: varchar("processMethod", { length: 60 }).notNull(),
    elevationMeters: int("elevationMeters").notNull(),
    cupScore: double("cupScore").notNull(), // SCA 0–100
    pricePerLbCents: int("pricePerLbCents").notNull(),
    costPerLbCents: int("costPerLbCents").notNull(),
    availableLbs: int("availableLbs").notNull().default(0),
    totalProductionLbs: int("totalProductionLbs").notNull().default(0),
    flavorNotes: varchar("flavorNotes", { length: 500 }).notNull().default(""),
    status: mysqlEnum("status", ["active", "retired"]).notNull().default("active"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    // ── §3.1 additive columns for this sprint. Do not restructure this table. ──
    // cupScore stays `double` deliberately: retyping it to decimal(5,2) is a
    // separate, carefully-tested migration (R5). Until then every tier
    // comparison goes through roundScore() — see contracts/constants.ts.
    farm: varchar("farm", { length: 255 }), // farm or cooperative; distinct from origin
    moistureContent: decimal("moistureContent", { precision: 5, scale: 2 }), // runbook 11.0–12.5%
    waterActivity: decimal("waterActivity", { precision: 4, scale: 3 }),
    density: decimal("density", { precision: 5, scale: 2 }), // g/mL
    defectCount: int("defectCount"),
    certifications: json("certifications").$type<string[]>().notNull().default([]),
    harvestYear: smallint("harvestYear"),
    arrivalDate: date("arrivalDate", { mode: "string" }),
    warehouseLocation: varchar("warehouseLocation", { length: 120 }),
    deletedAt: timestamp("deletedAt"),
  },
  (t) => [index("lots_status_idx").on(t.status), index("lots_origin_idx").on(t.origin)],
);

// ─── CRM Context ─────────────────────────────────────────────────────────────
export const roasters = mysqlTable(
  "roasters",
  {
    id: serial("id").primaryKey(),
    roasterName: varchar("roasterName", { length: 255 }).notNull(),
    contactName: varchar("contactName", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    companySize: mysqlEnum("companySize", ["micro", "small", "medium", "large"])
      .notNull()
      .default("small"),
    segment: varchar("segment", { length: 60 }).notNull().default("prospect"),
    lifecycleStatus: mysqlEnum("lifecycleStatus", [
      "trial",
      "active",
      "dormant",
      "needs_attention",
      "churned",
    ])
      .notNull()
      .default("trial"),
    churnRiskScore: double("churnRiskScore").notNull().default(0), // 0–1, threshold 0.70
    ltvCents: int("ltvCents").notNull().default(0),
    cacCents: int("cacCents").notNull().default(37800), // blended CAC $378
    referralCode: varchar("referralCode", { length: 40 }),
    whatsappNumber: varchar("whatsappNumber", { length: 40 }), // E.164, e.g. +15551234567
    nurtureHalted: boolean("nurtureHalted").notNull().default(false), // COF-005
    lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("roasters_lifecycle_idx").on(t.lifecycleStatus)],
);

export const churnInterventions = mysqlTable("churn_interventions", {
  id: serial("id").primaryKey(),
  roasterId: bigint("roasterId", { mode: "number", unsigned: true }).notNull(),
  interventionType: mysqlEnum("interventionType", [
    "email_campaign",
    "sales_call",
    "discount_offer",
    "survey",
  ]).notNull(),
  outcome: mysqlEnum("outcome", ["pending", "retained", "churned"])
    .notNull()
    .default("pending"),
  reason: varchar("reason", { length: 255 }).notNull().default(""),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Samples Context ─────────────────────────────────────────────────────────
export const sampleKits = mysqlTable(
  "sample_kits",
  {
    id: serial("id").primaryKey(),
    roasterId: bigint("roasterId", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", [
      "requested",
      "assembling",
      "shipped",
      "delivered",
      "exception",
      "feedback_received",
      "feedback_stale",
    ])
      .notNull()
      .default("requested"),
    trackingNumber: varchar("trackingNumber", { length: 80 }),
    shippedAt: timestamp("shippedAt"),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("kits_roaster_idx").on(t.roasterId), index("kits_status_idx").on(t.status)],
);

// Snapshot of lot facts at assembly time — kit quotes never follow live lot pricing.
export const sampleKitItems = mysqlTable(
  "sample_kit_items",
  {
    id: serial("id").primaryKey(),
    kitId: bigint("kitId", { mode: "number", unsigned: true }).notNull(),
    lotId: bigint("lotId", { mode: "number", unsigned: true }).notNull(),
    lotName: varchar("lotName", { length: 255 }).notNull(),
    origin: varchar("origin", { length: 120 }).notNull(),
    processMethod: varchar("processMethod", { length: 60 }).notNull(),
    cupScoreSnapshot: double("cupScoreSnapshot").notNull(),
    pricePerLbCentsSnapshot: int("pricePerLbCentsSnapshot").notNull(),
  },
  (t) => [index("kit_items_kit_idx").on(t.kitId)],
);

export const feedback = mysqlTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    kitId: bigint("kitId", { mode: "number", unsigned: true }).notNull(),
    roasterId: bigint("roasterId", { mode: "number", unsigned: true }).notNull(),
    rating: int("rating").notNull(), // 1–5
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("feedback_kit_idx").on(t.kitId)],
);

// ─── Campaigns Context ───────────────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 60 }).notNull().unique(), // e.g. cof-nurture-2025
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "active", "halted"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const automationRules = mysqlTable("automation_rules", {
  id: serial("id").primaryKey(),
  campaignId: bigint("campaignId", { mode: "number", unsigned: true }).notNull(),
  ruleCode: varchar("ruleCode", { length: 20 }).notNull().unique(), // COF-001…COF-005
  triggerEvent: varchar("triggerEvent", { length: 80 }).notNull(),
  conditionSummary: varchar("conditionSummary", { length: 255 }).notNull().default(""),
  action: mysqlEnum("action", [
    "SEND_EMAIL",
    "SEND_SMS",
    "UPDATE_CRM_LIFECYCLE",
    "EXECUTE_CAMPAIGN_HALT",
  ]).notNull(),
  description: varchar("description", { length: 500 }).notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Per-send ledger (campaign_execution_logs): one dispatch per (rule, roaster, touchpoint).
export const dispatches = mysqlTable(
  "dispatches",
  {
    id: serial("id").primaryKey(),
    ruleCode: varchar("ruleCode", { length: 20 }).notNull(),
    campaignId: bigint("campaignId", { mode: "number", unsigned: true }).notNull(),
    roasterId: bigint("roasterId", { mode: "number", unsigned: true }).notNull(),
    channel: mysqlEnum("channel", ["email", "sms", "whatsapp", "crm", "system"]).notNull(),
    subject: varchar("subject", { length: 255 }).notNull().default(""),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["sent", "queued", "halted", "lifecycle_updated", "converted"])
      .notNull()
      .default("sent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("dispatches_roaster_idx").on(t.roasterId), index("dispatches_rule_idx").on(t.ruleCode)],
);

// ─── Orders Context ──────────────────────────────────────────────────────────
export const orders = mysqlTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("orderNumber", { length: 40 }).notNull().unique(),
    roasterId: bigint("roasterId", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ])
      .notNull()
      .default("pending"),
    totalCents: int("totalCents").notNull().default(0),
    firstOrder: boolean("firstOrder").notNull().default(false),
    idempotencyKey: varchar("idempotencyKey", { length: 80 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("orders_idem_idx").on(t.idempotencyKey), index("orders_roaster_idx").on(t.roasterId)],
);

export const orderLineItems = mysqlTable(
  "order_line_items",
  {
    id: serial("id").primaryKey(),
    orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
    lotId: bigint("lotId", { mode: "number", unsigned: true }).notNull(),
    lotName: varchar("lotName", { length: 255 }).notNull(),
    quantityLbs: int("quantityLbs").notNull(),
    unitPriceCents: int("unitPriceCents").notNull(),
  },
  (t) => [index("order_lines_order_idx").on(t.orderId)],
);

// ─── Transactional Outbox / Domain Event Log ─────────────────────────────────
export const domainEvents = mysqlTable(
  "domain_events",
  {
    id: serial("id").primaryKey(),
    eventType: varchar("eventType", { length: 80 }).notNull(), // canonical snake_case dotted
    aggregateType: varchar("aggregateType", { length: 40 }).notNull(),
    aggregateId: varchar("aggregateId", { length: 40 }).notNull(),
    // §3.13 — was `text`. The migration backfills and validates that every
    // existing row parses; a row that does not stops the migration rather than
    // being coerced.
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    // ── §3.13 outbox columns (fixes B6) ──────────────────────────────────────
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processedAt"),
    attempts: int("attempts").notNull().default(0),
    lastError: text("lastError"),
    availableAt: timestamp("availableAt").defaultNow().notNull(), // backoff scheduling
    eventVersion: smallint("eventVersion").notNull().default(1), // payload schema version
    skippedReason: varchar("skippedReason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("events_type_idx").on(t.eventType),
    // Claim-based dispatch index. The consumer must NOT use `id > lastSeenId`:
    // MySQL allocates AUTO_INCREMENT at insert but exposes it at commit, so a
    // long transaction can commit an id below one a later short transaction has
    // already shown. A cursor consumer skips it silently (§3.13).
    index("events_dispatch_idx").on(t.processed, t.availableAt, t.id),
  ],
);

// ─── Warehouse & Verification Context (warehouse runbooks) ───────────────────
export const warehouseExceptions = mysqlTable(
  "warehouse_exceptions",
  {
    id: serial("id").primaryKey(),
    lotId: bigint("lotId", { mode: "number", unsigned: true }),
    containerNumber: varchar("containerNumber", { length: 60 }).notNull().default(""),
    exceptionType: mysqlEnum("exceptionType", [
      "seal_compromise",
      "weight_moisture_variance",
      "quality_anomaly",
      "partial_compromise",
      "equipment_failure",
      "customs_inspection",
    ]).notNull(),
    tier: int("tier").notNull(), // 1 | 2 | 3
    status: mysqlEnum("status", [
      "open",
      "hard_hold",
      "quarantine",
      "investigating",
      "resolved",
      "closed",
    ])
      .notNull()
      .default("open"),
    disposition: mysqlEnum("disposition", [
      "release",
      "downgrade",
      "reject_claim",
      "reverify_partition",
    ]),
    description: text("description").notNull(),
    rootCause: varchar("rootCause", { length: 255 }).notNull().default(""),
    atFaultParty: mysqlEnum("atFaultParty", [
      "supplier",
      "carrier",
      "customs",
      "greensheet",
      "indeterminate",
    ]),
    financialCents: int("financialCents").notNull().default(0), // credit/claim value
    slaDueAt: timestamp("slaDueAt"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("exceptions_tier_idx").on(t.tier), index("exceptions_status_idx").on(t.status)],
);

export const exceptionEvents = mysqlTable(
  "exception_events",
  {
    id: serial("id").primaryKey(),
    exceptionId: bigint("exceptionId", { mode: "number", unsigned: true }).notNull(),
    note: varchar("note", { length: 500 }).notNull(),
    actor: varchar("actor", { length: 120 }).notNull().default("system"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("exception_events_idx").on(t.exceptionId)],
);

// ─── Retained Samples & Cupping Context (retained-sample + cupping SOPs) ─────
export const retainedSamples = mysqlTable(
  "retained_samples",
  {
    id: serial("id").primaryKey(),
    lotId: bigint("lotId", { mode: "number", unsigned: true }),
    lotCode: varchar("lotCode", { length: 60 }).notNull(), // e.g. VN-26-001
    containerNumber: varchar("containerNumber", { length: 60 }).notNull().default(""),
    bagPosition: varchar("bagPosition", { length: 40 }).notNull().default("middle"),
    pulledBy: varchar("pulledBy", { length: 120 }).notNull(),
    storageLocation: varchar("storageLocation", { length: 120 }).notNull().default("Cabinet A"),
    status: mysqlEnum("status", ["sealed", "opened", "destroyed", "lost"])
      .notNull()
      .default("sealed"),
    openedCount: int("openedCount").notNull().default(0),
    destructionEligibleAt: timestamp("destructionEligibleAt"),
    destroyedAt: timestamp("destroyedAt"),
    destructionMethod: varchar("destructionMethod", { length: 60 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("samples_lot_idx").on(t.lotId), index("samples_status_idx").on(t.status)],
);

export const sampleAccessLogs = mysqlTable(
  "sample_access_logs",
  {
    id: serial("id").primaryKey(),
    sampleId: bigint("sampleId", { mode: "number", unsigned: true }).notNull(),
    accessedBy: varchar("accessedBy", { length: 120 }).notNull(),
    purpose: varchar("purpose", { length: 255 }).notNull(),
    quantityGrams: double("quantityGrams").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("access_logs_sample_idx").on(t.sampleId)],
);

export const cuppingSessions = mysqlTable(
  "cupping_sessions",
  {
    id: serial("id").primaryKey(),
    sampleId: bigint("sampleId", { mode: "number", unsigned: true }),
    lotCode: varchar("lotCode", { length: 60 }).notNull(),
    isPanel: boolean("isPanel").notNull().default(false),
    cuppers: varchar("cuppers", { length: 255 }).notNull(), // comma-separated names w/ tier
    // SCA 10-attribute scorecard (0.5-point precision), each 6–10 except overall 0–10
    fragrance: double("fragrance").notNull(),
    flavor: double("flavor").notNull(),
    aftertaste: double("aftertaste").notNull(),
    acidity: double("acidity").notNull(),
    body: double("body").notNull(),
    balance: double("balance").notNull(),
    uniformity: double("uniformity").notNull(),
    cleanliness: double("cleanliness").notNull(),
    sweetness: double("sweetness").notNull(),
    overall: double("overall").notNull(),
    totalScore: double("totalScore").notNull(),
    referenceScore: double("referenceScore"), // baseline of retained reference sample
    deltaVsReference: double("deltaVsReference"),
    toleranceBand: double("toleranceBand"), // ±2 Tier1 / ±1.5 Tier2 / ±1 Tier3
    verdict: mysqlEnum("verdict", ["within_tolerance", "outside_tolerance", "red_flag"]),
    redFlags: varchar("redFlags", { length: 255 }).notNull().default(""),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("cupping_lot_idx").on(t.lotCode)],
);

// ─── Partners Context (Revenue Share White-Glove Agreement) ──────────────────
export const partners = mysqlTable(
  "partners",
  {
    id: serial("id").primaryKey(),
    partnerName: varchar("partnerName", { length: 255 }).notNull(),
    partnerType: mysqlEnum("partnerType", ["farmer", "collector"]).notNull(),
    originRegion: varchar("originRegion", { length: 120 }).notNull(),
    partnerTier: mysqlEnum("partnerTier", ["tier_a", "tier_b", "tier_c"])
      .notNull()
      .default("tier_b"),
    agreementStatus: mysqlEnum("agreementStatus", ["draft", "active", "terminated"])
      .notNull()
      .default("active"),
    email: varchar("email", { length: 320 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    effectiveDate: timestamp("effectiveDate").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("partners_type_idx").on(t.partnerType)],
);

// Exhibit D — Lot Addendum: floor price, protocol, delivery window per lot
export const lotAddenda = mysqlTable(
  "lot_addenda",
  {
    id: serial("id").primaryKey(),
    partnerId: bigint("partnerId", { mode: "number", unsigned: true }).notNull(),
    lotId: bigint("lotId", { mode: "number", unsigned: true }), // linked catalog lot (nullable)
    lotCode: varchar("lotCode", { length: 60 }).notNull(),
    processingProtocol: varchar("processingProtocol", { length: 255 }).notNull().default(""),
    floorPricePerLbCents: int("floorPricePerLbCents").notNull(),
    expectedQtyLbs: int("expectedQtyLbs").notNull().default(0),
    deliveryWindow: varchar("deliveryWindow", { length: 120 }).notNull().default(""),
    status: mysqlEnum("status", ["pending", "delivered", "verified", "sold", "settled"])
      .notNull()
      .default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("addenda_partner_idx").on(t.partnerId)],
);

// Floor payments + revenue share payments, each with a True Price Receipt (JSON)
export const partnerPayments = mysqlTable(
  "partner_payments",
  {
    id: serial("id").primaryKey(),
    partnerId: bigint("partnerId", { mode: "number", unsigned: true }).notNull(),
    addendumId: bigint("addendumId", { mode: "number", unsigned: true }).notNull(),
    paymentType: mysqlEnum("paymentType", ["floor", "revenue_share"]).notNull(),
    amountCents: int("amountCents").notNull(),
    status: mysqlEnum("status", ["accrued", "paid", "held"]).notNull().default("accrued"),
    receipt: text("receipt").notNull(), // JSON True Price Receipt
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("payments_partner_idx").on(t.partnerId), index("payments_addendum_idx").on(t.addendumId)],
);

// Exhibit C — Collector pass-through: ≥80% of revenue share to identified farmers
export const collectorPassThroughs = mysqlTable(
  "collector_pass_throughs",
  {
    id: serial("id").primaryKey(),
    partnerId: bigint("partnerId", { mode: "number", unsigned: true }).notNull(), // collector
    addendumId: bigint("addendumId", { mode: "number", unsigned: true }).notNull(),
    farmerName: varchar("farmerName", { length: 255 }).notNull(),
    pctOfLot: double("pctOfLot").notNull(), // 0–100
    floorOwedCents: int("floorOwedCents").notNull().default(0),
    floorPaidAt: timestamp("floorPaidAt"),
    rsOwedCents: int("rsOwedCents").notNull().default(0),
    rsPaidAt: timestamp("rsPaidAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("pass_through_partner_idx").on(t.partnerId)],
);

// ─── Education Context (SOP library + training acknowledgments) ──────────────
export const sopDocuments = mysqlTable(
  "sop_documents",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 40 }).notNull().unique(), // e.g. SOP-WAREHOUSE-RB
    title: varchar("title", { length: 255 }).notNull(),
    category: mysqlEnum("category", ["warehouse", "cupping", "samples", "agreements", "marketing"]).notNull(),
    summary: varchar("summary", { length: 500 }).notNull().default(""),
    content: text("content").notNull(), // markdown body
    version: varchar("version", { length: 20 }).notNull().default("1.0"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("sop_category_idx").on(t.category)],
);

export const sopAcknowledgments = mysqlTable(
  "sop_acknowledgments",
  {
    id: serial("id").primaryKey(),
    documentId: bigint("documentId", { mode: "number", unsigned: true }).notNull(),
    personName: varchar("personName", { length: 120 }).notNull(),
    role: varchar("role", { length: 120 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("sop_ack_doc_idx").on(t.documentId)],
);

// ─── Growth Context (teaser waitlists, referrals, marketing calendar) ────────
export const waitlistSignups = mysqlTable(
  "waitlist_signups",
  {
    id: serial("id").primaryKey(),
    product: mysqlEnum("product", ["foundry", "lotspace"]).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    company: varchar("company", { length: 255 }).notNull().default(""),
    interest: varchar("interest", { length: 500 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("waitlist_unique_idx").on(t.product, t.email)],
);

// "Give a Kit, Get a Bag" referral engine
export const referrals = mysqlTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 40 }).notNull(), // the referral code used
    referrerRoasterId: bigint("referrerRoasterId", { mode: "number", unsigned: true }).notNull(),
    referredRoasterId: bigint("referredRoasterId", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", ["signed_up", "kit_sent", "rewarded"]).notNull().default("signed_up"),
    rewardNote: varchar("rewardNote", { length: 255 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("referrals_referrer_idx").on(t.referrerRoasterId)],
);

// Social series content calendar (POS-01…POS-04 pillars)
export const marketingPosts = mysqlTable(
  "marketing_posts",
  {
    id: serial("id").primaryKey(),
    pillar: varchar("pillar", { length: 10 }).notNull(), // POS-01…POS-04
    channel: mysqlEnum("channel", ["linkedin", "instagram", "twitter", "tiktok", "newsletter"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    week: int("week").notNull(), // 1–4 rollout
    status: mysqlEnum("status", ["draft", "scheduled", "published"]).notNull().default("draft"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("posts_pillar_idx").on(t.pillar)],
);

// COF-004 trigger: pricing-link clicks
export const pricingLinkClicks = mysqlTable(
  "pricing_link_clicks",
  {
    id: serial("id").primaryKey(),
    roasterId: bigint("roasterId", { mode: "number", unsigned: true }).notNull(),
    lotId: bigint("lotId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("clicks_roaster_idx").on(t.roasterId)],
);

// ─── Warehouse intake (doc-intake commit target for CMR shipping documents) ──
export const shipmentIntakes = mysqlTable(
  "shipment_intakes",
  {
    id: serial("id").primaryKey(),
    lotId: bigint("lotId", { mode: "number", unsigned: true }),
    consignor: varchar("consignor", { length: 255 }).notNull().default(""),
    consignee: varchar("consignee", { length: 255 }).notNull().default(""),
    containerNumber: varchar("containerNumber", { length: 60 }).notNull().default(""),
    sealNumber: varchar("sealNumber", { length: 60 }).notNull().default(""),
    grossWeightLbs: int("grossWeightLbs").notNull().default(0),
    shippedAt: timestamp("shippedAt"),
    arrivedAt: timestamp("arrivedAt"),
    source: mysqlEnum("source", ["manual", "docintake"]).notNull().default("manual"),
    extractionJson: text("extractionJson"), // audit copy of the OCR payload
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("intakes_lot_idx").on(t.lotId)],
);

// ─── Identity Context (engineering/07 RBAC — credential auth, role scoping) ──
export const users = mysqlTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(), // scrypt$N$r$p$salt$hash
    role: mysqlEnum("role", [
      "platform_admin",
      "ops_manager",
      "sales_csm",
      "analyst",
      "roaster_buyer",
    ])
      .notNull()
      .default("roaster_buyer"),
    // Tenant binding for roaster_buyer accounts (gs_account_ids analogue).
    roasterId: bigint("roasterId", { mode: "number", unsigned: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("users_roaster_idx").on(t.roasterId)],
);

// Inferred types
export type CoffeeLot = typeof coffeeLots.$inferSelect;
export type Roaster = typeof roasters.$inferSelect;
export type ChurnIntervention = typeof churnInterventions.$inferSelect;
export type SampleKit = typeof sampleKits.$inferSelect;
export type SampleKitItem = typeof sampleKitItems.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type AutomationRule = typeof automationRules.$inferSelect;
export type Dispatch = typeof dispatches.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLineItem = typeof orderLineItems.$inferSelect;
export type DomainEvent = typeof domainEvents.$inferSelect;
export type WarehouseException = typeof warehouseExceptions.$inferSelect;
export type ExceptionEvent = typeof exceptionEvents.$inferSelect;
export type RetainedSample = typeof retainedSamples.$inferSelect;
export type SampleAccessLog = typeof sampleAccessLogs.$inferSelect;
export type CuppingSession = typeof cuppingSessions.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type LotAddendum = typeof lotAddenda.$inferSelect;
export type PartnerPayment = typeof partnerPayments.$inferSelect;
export type CollectorPassThrough = typeof collectorPassThroughs.$inferSelect;
export type SopDocument = typeof sopDocuments.$inferSelect;
export type SopAcknowledgment = typeof sopAcknowledgments.$inferSelect;
export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type MarketingPost = typeof marketingPosts.$inferSelect;
export type PricingLinkClick = typeof pricingLinkClicks.$inferSelect;
