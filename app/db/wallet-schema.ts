// E-wallets, FX, dunning, e-invoice and standing orders.
//
// The Vietnam Payment Integration plan, §2.2 and §3.3–§3.6. Same conventions as
// the rest of the payments context: serial PKs, bigint unsigned FKs, money as
// bigint minor units always paired with a currency column, timestamps UTC.
import { sql } from "drizzle-orm";
import {
  mysqlTable,
  serial,
  bigint,
  int,
  smallint,
  varchar,
  char,
  text,
  boolean,
  timestamp,
  date,
  decimal,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });
const minor = (name: string) => bigint(name, { mode: "bigint" });

/** Kept in sync with contracts/providers.ts PAYMENT_PROVIDERS. */
const PROVIDERS = ["payos", "casso", "momo", "zalopay", "manual"] as const;

// ─── §2.2 payment_methods — the rail registry ────────────────────────────────
// One row per way a given counterparty can pay us. For e-wallets this is also
// where a saved token lives, which is what makes §3.6 auto-charge possible.
export const paymentMethods = mysqlTable(
  "payment_methods",
  {
    id: serial("id").primaryKey(),
    counterpartyId: fk("counterpartyId").notNull(),
    provider: mysqlEnum("provider", PROVIDERS).notNull(),
    label: varchar("label", { length: 120 }).notNull().default(""),
    /** Last four of the wallet phone or card, for display. Never the full value. */
    displayLast4: char("displayLast4", { length: 4 }),
    // A recurring token is a standing authority to take money. It is encrypted
    // at rest for the same reason bank account numbers are (§12.2), and it is
    // useless without the consent columns below.
    tokenEnc: varchar("tokenEnc", { length: 512 }),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    // §3.6 — "with customer consent" is a data requirement, not a sentence in a
    // contract. No consent row, no auto-charge.
    consentGivenAt: timestamp("consentGivenAt"),
    consentText: varchar("consentText", { length: 500 }).notNull().default(""),
    consentRevokedAt: timestamp("consentRevokedAt"),
    status: mysqlEnum("status", ["active", "expired", "revoked"])
      .notNull()
      .default("active"),
    isDefault: boolean("isDefault").notNull().default(false),
    createdByUserId: fk("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  t => [
    index("payment_methods_counterparty_idx").on(t.counterpartyId),
    index("payment_methods_provider_idx").on(t.provider),
  ]
);

// ─── §3.3 fx_rates ───────────────────────────────────────────────────────────
// A rate is only meaningful with its source and the instant it was observed.
// Storing a bare number is how you lose the ability to explain a realized
// difference to an auditor a year later.
export const fxRates = mysqlTable(
  "fx_rates",
  {
    id: serial("id").primaryKey(),
    baseCurrency: char("baseCurrency", { length: 3 }).notNull(),
    quoteCurrency: char("quoteCurrency", { length: 3 }).notNull(),
    // Decimal, never float: a rate multiplied by a container-scale amount
    // magnifies a float's error into real money.
    rate: decimal("rate", { precision: 18, scale: 6 }).notNull(),
    source: varchar("source", { length: 60 }).notNull(),
    observedAt: timestamp("observedAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("fx_rates_pair_idx").on(t.baseCurrency, t.quoteCurrency, t.observedAt),
  ]
);

// ─── §3.3 fx_adjustments — the realized difference ───────────────────────────
// An invoice raised in USD and settled in VND almost never nets to zero. The
// difference is a real gain or loss and it belongs in a ledger, not in a
// rounding remainder nobody notices.
export const fxAdjustments = mysqlTable(
  "fx_adjustments",
  {
    id: serial("id").primaryKey(),
    invoiceId: fk("invoiceId").notNull(),
    allocationId: fk("allocationId").notNull(),
    invoiceCurrency: char("invoiceCurrency", { length: 3 }).notNull(),
    paymentCurrency: char("paymentCurrency", { length: 3 }).notNull(),
    /** Rate actually used to convert the payment onto the invoice. */
    appliedRate: decimal("appliedRate", { precision: 18, scale: 6 }).notNull(),
    /** Rate the contract locked, when there was one; else the reference rate. */
    expectedRate: decimal("expectedRate", { precision: 18, scale: 6 }),
    /** Signed, in the INVOICE currency. Positive = gain to us. */
    realizedMinor: minor("realizedMinor").notNull(),
    rateSource: varchar("rateSource", { length: 60 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("fx_adjustments_invoice_idx").on(t.invoiceId),
    uniqueIndex("fx_adjustments_allocation_idx").on(t.allocationId),
  ]
);

// ─── §3.4 dunning ────────────────────────────────────────────────────────────
// The ladder is data, not code, so a business can change "day 7" to "day 5"
// without a deploy — and so the steps a customer actually received can be
// reconstructed after the fact.
export const dunningSteps = mysqlTable(
  "dunning_steps",
  {
    id: serial("id").primaryKey(),
    policyCode: varchar("policyCode", { length: 40 }).notNull().default("default"),
    /** Days after dueAt. 0 = on issue. Negative would be a pre-due nudge. */
    offsetDays: int("offsetDays").notNull(),
    channel: mysqlEnum("channel", ["email", "zalo", "sms", "phone_task", "in_app"]).notNull(),
    action: mysqlEnum("action", [
      "send_invoice",
      "send_reminder",
      "create_call_task",
      "offer_installment",
      "escalate",
    ]).notNull(),
    subjectTemplate: varchar("subjectTemplate", { length: 255 }).notNull().default(""),
    bodyTemplate: text("bodyTemplate").notNull(),
    /** Attach a freshly generated QR — a stale one is worse than none (§3.4). */
    includeFreshQr: boolean("includeFreshQr").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [uniqueIndex("dunning_step_unique_idx").on(t.policyCode, t.offsetDays, t.channel)]
);

// One row per step actually delivered for one invoice. The unique index is what
// makes the nightly sweep idempotent: re-running it cannot double-send.
export const dunningRuns = mysqlTable(
  "dunning_runs",
  {
    id: serial("id").primaryKey(),
    invoiceId: fk("invoiceId").notNull(),
    stepId: fk("stepId").notNull(),
    counterpartyId: fk("counterpartyId").notNull(),
    channel: mysqlEnum("channel", ["email", "zalo", "sms", "phone_task", "in_app"]).notNull(),
    status: mysqlEnum("status", ["sent", "queued", "failed", "skipped"])
      .notNull()
      .default("queued"),
    subject: varchar("subject", { length: 255 }).notNull().default(""),
    body: text("body").notNull(),
    /** Outstanding at send time, so effectiveness can be judged against it. */
    outstandingMinorAtSend: minor("outstandingMinorAtSend").notNull().default(sql`0`),
    currency: char("currency", { length: 3 }).notNull(),
    skipReason: varchar("skipReason", { length: 255 }),
    // ── Response tracking (§3.4 "tracks which channels get the best response")
    // A payment landing after a step is the outcome that matters; opens and
    // clicks are proxies for it.
    openedAt: timestamp("openedAt"),
    clickedAt: timestamp("clickedAt"),
    paidAfterAt: timestamp("paidAfterAt"),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("dunning_runs_unique_idx").on(t.invoiceId, t.stepId),
    index("dunning_runs_invoice_idx").on(t.invoiceId),
    index("dunning_runs_channel_idx").on(t.channel, t.status),
  ]
);

// ─── §3.5 e-invoice (Thông tư 78/2021/TT-BTC) ────────────────────────────────
// Our `invoices` row is an internal AR record. A compliant Vietnamese e-invoice
// is issued through an authorised provider and registered with the tax
// authority; this table is the bridge and the audit trail of that exchange.
export const einvoiceSubmissions = mysqlTable(
  "einvoice_submissions",
  {
    id: serial("id").primaryKey(),
    invoiceId: fk("invoiceId").notNull(),
    provider: mysqlEnum("provider", ["vnpt", "misa", "viettel", "mock"]).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "submitted",
      "issued",
      "failed",
      "cancelled",
      "replaced",
    ])
      .notNull()
      .default("pending"),
    /** Form and serial the authority requires (ký hiệu mẫu số, ký hiệu hóa đơn). */
    templateCode: varchar("templateCode", { length: 40 }).notNull().default(""),
    invoiceSeries: varchar("invoiceSeries", { length: 40 }).notNull().default(""),
    /** Authority-assigned number and lookup code, once issued. */
    authorityInvoiceNumber: varchar("authorityInvoiceNumber", { length: 80 }),
    authorityCode: varchar("authorityCode", { length: 120 }),
    lookupUrl: varchar("lookupUrl", { length: 500 }),
    /** Verbatim request and response, for the audit an inspection will ask for. */
    requestPayload: json("requestPayload").$type<Record<string, unknown>>(),
    responsePayload: json("responsePayload").$type<Record<string, unknown>>(),
    errorMessage: text("errorMessage"),
    attempts: int("attempts").notNull().default(0),
    submittedAt: timestamp("submittedAt"),
    issuedAt: timestamp("issuedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("einvoice_invoice_idx").on(t.invoiceId),
    index("einvoice_status_idx").on(t.status),
    uniqueIndex("einvoice_authority_number_idx").on(t.provider, t.authorityInvoiceNumber),
  ]
);

// ─── §3.6 standing orders ────────────────────────────────────────────────────
// "Many cafés order beans weekly." A standing order is the intent; each cycle
// produces a real invoice through the ordinary issuance path, so nothing about
// AR, aging or reconciliation needs to know subscriptions exist.
export const standingOrders = mysqlTable(
  "standing_orders",
  {
    id: serial("id").primaryKey(),
    counterpartyId: fk("counterpartyId").notNull(),
    reference: varchar("reference", { length: 40 }).notNull(),
    cadence: mysqlEnum("cadence", ["weekly", "biweekly", "monthly"]).notNull(),
    /** 1–7 for weekly/biweekly (Mon=1), 1–28 for monthly. */
    anchorDay: smallint("anchorDay").notNull().default(1),
    currency: char("currency", { length: 3 }).notNull(),
    subtotalMinor: minor("subtotalMinor").notNull(),
    vatRateBp: int("vatRateBp").notNull().default(0),
    shippingMinor: minor("shippingMinor").notNull().default(sql`0`),
    /** Days from issue to due on each generated invoice. */
    paymentTermDays: int("paymentTermDays").notNull().default(14),
    /** Auto-charge rail; null means the customer pays each invoice manually. */
    paymentMethodId: fk("paymentMethodId"),
    lotId: fk("lotId"),
    notes: varchar("notes", { length: 500 }).notNull().default(""),
    status: mysqlEnum("status", ["active", "paused", "ended"]).notNull().default("active"),
    startsOn: date("startsOn", { mode: "string" }).notNull(),
    endsOn: date("endsOn", { mode: "string" }),
    /** Cycle bookkeeping; nextRunOn is what the generator claims on. */
    lastRunOn: date("lastRunOn", { mode: "string" }),
    nextRunOn: date("nextRunOn", { mode: "string" }).notNull(),
    createdByUserId: fk("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  t => [
    uniqueIndex("standing_orders_ref_idx").on(t.reference),
    index("standing_orders_due_idx").on(t.status, t.nextRunOn),
    index("standing_orders_counterparty_idx").on(t.counterpartyId),
  ]
);

// One row per generated cycle. Unique on (standingOrderId, periodStart) so a
// generator re-run for the same period cannot invoice a café twice.
export const standingOrderCycles = mysqlTable(
  "standing_order_cycles",
  {
    id: serial("id").primaryKey(),
    standingOrderId: fk("standingOrderId").notNull(),
    periodStart: date("periodStart", { mode: "string" }).notNull(),
    invoiceId: fk("invoiceId"),
    status: mysqlEnum("status", ["generated", "charged", "charge_failed", "skipped"])
      .notNull()
      .default("generated"),
    failureReason: varchar("failureReason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("standing_cycle_unique_idx").on(t.standingOrderId, t.periodStart),
    index("standing_cycle_invoice_idx").on(t.invoiceId),
  ]
);

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
export type FxAdjustment = typeof fxAdjustments.$inferSelect;
export type DunningStep = typeof dunningSteps.$inferSelect;
export type DunningRun = typeof dunningRuns.$inferSelect;
export type EinvoiceSubmission = typeof einvoiceSubmissions.$inferSelect;
export type StandingOrder = typeof standingOrders.$inferSelect;
export type StandingOrderCycle = typeof standingOrderCycles.$inferSelect;
