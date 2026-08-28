import {
  mysqlTable,
  serial,
  bigint,
  int,
  double,
  varchar,
  text,
  boolean,
  timestamp,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

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
    channel: mysqlEnum("channel", ["email", "sms", "crm", "system"]).notNull(),
    subject: varchar("subject", { length: 255 }).notNull().default(""),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["sent", "halted", "lifecycle_updated", "converted"])
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
    payload: text("payload").notNull(), // JSON
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("events_type_idx").on(t.eventType)],
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
