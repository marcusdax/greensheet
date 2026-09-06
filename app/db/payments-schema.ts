<<<<<<< HEAD
// Payments — Vietnam payment methods context
// Provider APIs: VietQR via Casso/PayOS, MoMo, ZaloPay
// Money: integer cents at rest (canonical convention from @db/schema)
// Events: payment.received → triggers AR clearing in sales_orders

=======
// Payments context — invoices, intents, provider transactions, allocations.
// Sprint spec §3.7–§3.10 and §7. The shape of this schema follows from one
// fact: VietQR is a *push* payment. The payer chooses the amount and types the
// memo, so under-, over-, duplicate and unmatched payments are the normal case,
// not the error case.
import { sql } from "drizzle-orm";
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
import {
  mysqlTable,
  serial,
  bigint,
  int,
<<<<<<< HEAD
  double,
  varchar,
  text,
  boolean,
  timestamp,
=======
  varchar,
  char,
  text,
  boolean,
  timestamp,
  date,
  decimal,
  json,
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

<<<<<<< HEAD
// ─── payment_methods ─────────────────────────────────────────────────────────
export const paymentMethods = mysqlTable(
  "payment_methods",
  {
    id: serial("id").primaryKey(),
    // FK to customer, or externalCustomerId for stored card/VN accounts
    customerId: bigint("customerId", { mode: "number", unsigned: true }),
    // walletType: momo | zalopay | vietqr | bank_transfer
    walletType: mysqlEnum("walletType", ["momo", "zalopay", "vietqr", "bank_transfer"]).notNull(),
    // Encrypted provider token/account reference (do NOT store raw credentials)
    details: text("details").notNull(),
    // Merchant config reference
    providerConfigId: varchar("provider_config_id", { length: 80 }),
    // Last used / status
    status: mysqlEnum("status", ["active", "inactive", "error"]).notNull().default("active"),
    lastUsedAt: timestamp("lastUsedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [index("payment_methods_customer_idx").on(t.customerId)],
);

// ─── payment_intents ─────────────────────────────────────────────────────────
// Single payment intent per sales order; idempotent by (orderId, amountCents)
=======
const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });
const minor = (name: string) => bigint(name, { mode: "bigint" });

/**
 * Kept in sync with contracts/providers.ts PAYMENT_PROVIDERS. The e-wallets
 * (§2.2) settle through the same provider_transactions and payment_intents
 * tables as VietQR — a rail is a column value here, not a parallel pipeline.
 */
const PROVIDERS = ["payos", "casso", "momo", "zalopay", "manual"] as const;

// ─── §3.7 invoices — the single payable aggregate (ADR-02, fixes B8/G1/G3) ───
// A payment settles an invoice; an invoice is raised against an order or a
// contract. One FK target, one home for dueAt, VAT and FX.
export const invoices = mysqlTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    invoiceNumber: varchar("invoiceNumber", { length: 40 }).notNull(), // INV-{YYYY}-{seq}
    payableType: mysqlEnum("payableType", ["order", "contract"]).notNull(),
    payableId: fk("payableId").notNull(),
    counterpartyId: fk("counterpartyId").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    subtotalMinor: minor("subtotalMinor").notNull(),
    // Basis points. VN rates are 0 / 5% / 8% / 10% → 0 / 500 / 800 / 1000 (R4).
    vatRateBp: int("vatRateBp").notNull().default(0),
    vatMinor: minor("vatMinor")
      .notNull()
      .default(sql`0`),
    shippingMinor: minor("shippingMinor")
      .notNull()
      .default(sql`0`),
    // Invariant: totalMinor === subtotalMinor + vatMinor + shippingMinor.
    totalMinor: minor("totalMinor").notNull(),
    // Maintained by the allocation service inside its transaction, never
    // written directly. Reconciled nightly against the allocation sum (§13.3).
    paidMinor: minor("paidMinor")
      .notNull()
      .default(sql`0`),
    issuedAt: date("issuedAt", { mode: "string" }).notNull(),
    // This column is what makes aging buckets possible at all (G1).
    dueAt: date("dueAt", { mode: "string" }).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "issued",
      "partially_paid",
      "paid",
      "overpaid",
      "void",
      "written_off",
    ])
      .notNull()
      .default("draft"),
    // R1 — our invoices table is an internal AR record, not a compliant VN
    // e-invoice. This is the placeholder for the authorised-provider handoff.
    eInvoiceStatus: mysqlEnum("eInvoiceStatus", [
      "not_required",
      "pending",
      "issued",
      "failed",
    ])
      .notNull()
      .default("not_required"),
    eInvoiceRef: varchar("eInvoiceRef", { length: 80 }),
    // The bank-transfer reference (§7.1). Short, uppercase, unambiguous.
    memoToken: char("memoToken", { length: 10 }).notNull(),
    notes: varchar("notes", { length: 500 }).notNull().default(""),
    createdByUserId: fk("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  t => [
    // §3.14 — invoice numbers are deliberately NOT reusable after a soft
    // delete: regulators expect a gapless, non-reused sequence.
    uniqueIndex("invoices_number_idx").on(t.invoiceNumber),
    uniqueIndex("invoices_memo_idx").on(t.memoToken),
    index("invoices_counterparty_status_idx").on(t.counterpartyId, t.status),
    index("invoices_due_idx").on(t.dueAt),
    index("invoices_payable_idx").on(t.payableType, t.payableId),
  ]
);

// PayOS orderCode must be a number unique per merchant, so it cannot be a UUID
// and must not come from Date.now() — two intents in the same millisecond
// collide (§3.8). Allocate from this sequence table instead.
export const orderCodeSequence = mysqlTable("order_code_sequence", {
  id: serial("id").primaryKey(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
  purpose: varchar("purpose", { length: 60 })
    .notNull()
    .default("payment_intent"),
});

// Gapless per-scope counters. Invoice numbers must not have gaps or reuse
// (§3.14), which rules out "max(id) + 1" under concurrency — this row is locked
// FOR UPDATE for the length of the issuing transaction instead.
export const numberSequences = mysqlTable("number_sequences", {
  id: serial("id").primaryKey(),
  scope: varchar("scope", { length: 60 }).notNull().unique(), // e.g. "invoice:2026"
  nextValue: bigint("nextValue", { mode: "number", unsigned: true })
    .notNull()
    .default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── §3.8 payment_intents ────────────────────────────────────────────────────
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
export const paymentIntents = mysqlTable(
  "payment_intents",
  {
    id: serial("id").primaryKey(),
<<<<<<< HEAD
    // FK to sales_order
    orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
    // FK to customer
    customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
    // Amount in cents
    amountCents: int("amountCents").notNull(),
    // Currency
    currency: mysqlEnum("currency", ["VND", "USD"]).notNull().default("VND"),
    // Provider: casso | payos | momo | zalopay | bank_transfer
    provider: mysqlEnum("provider", ["casso", "payos", "momo", "zalopay", "bank_transfer"]).notNull(),
    // Provider-specific intent ID
    providerIntentId: varchar("providerIntentId", { length: 80 }),
    // Client secret for frontend confirmation
    clientSecret: varchar("clientSecret", { length: 255 }),
    // QR payload or pay URL (base64-encoded)
    qrPayload: text("qrPayload"),
    // Expiration timestamp
    expiresAt: timestamp("expiresAt"),
    // Idempotency key for callback dedup
    idempotencyKey: varchar("idempotencyKey", { length: 80 }),
    // Status lifecycle
    status: mysqlEnum("status", ["pending", "succeeded", "failed", "canceled", "refunded"]).notNull().default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("payment_intents_order_idx").on(t.orderId),
    index("payment_intents_customer_idx").on(t.customerId),
    index("payment_intents_provider_idx").on(t.provider),
    index("payment_intents_status_idx").on(t.status),
    uniqueIndex("payment_intents_order_amount_unique_idx").on(t.orderId, t.amountCents),
    index("payment_intents_idempotency_idx").on(t.idempotencyKey),
  ],
);

// ─── payment_transactions ─────────────────────────────────────────────────────
// Append-only ledger of callback-initiated transactions; never delete.
// Each row = one provider callback; idempotent by (provider, providerTxnId)
export const paymentTransactions = mysqlTable(
  "payment_transactions",
  {
    id: serial("id").primaryKey(),
    // FK to payment_intent
    intentId: bigint("intentId", { mode: "number", unsigned: true }).notNull(),
    // Provider name
    provider: mysqlEnum("provider", ["casso", "payos", "momo", "zalopay", "bank_transfer"]).notNull(),
    // Provider transaction ID (unique per provider)
    providerTxnId: varchar("providerTxnId", { length: 80 }).notNull(),
    // Amount in cents from callback
    amountCents: int("amountCents").notNull(),
    // Status
    status: mysqlEnum("status", ["initiated", "settled", "failed", "refunded"]).notNull().default("initiated"),
    // Settlement timestamp
    settledAt: timestamp("settledAt"),
    // Raw callback payload (signed JSON)
    rawCallback: text("rawCallback").notNull(),
    // Normalized receipt for AR integration
    normalizedReceipt: text("normalizedReceipt"), // JSON: { orderId, amountCents, providerTxnId }
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("payment_transactions_intent_idx").on(t.intentId),
    index("payment_transactions_provider_idx").on(t.provider),
    index("payment_transactions_txn_idx").on(t.providerTxnId),
    uniqueIndex("payment_transactions_provider_txn_unique_idx").on(t.provider, t.providerTxnId),
  ],
);

// ─── payment_reconciliations ─────────────────────────────────────────────────
// Daily job: reconcile provider settlements against open payment intents
export const paymentReconciliations = mysqlTable(
  "payment_reconciliations",
  {
    id: serial("id").primaryKey(),
    // Provider: casso | payos | momo | zalopay | bank_transfer
    provider: mysqlEnum("provider", ["casso", "payos", "momo", "zalopay", "bank_transfer"]).notNull(),
    // Date of reconciliation job
    date: varchar("date", { length: 20 }).notNull(), // YYYY-MM-DD
    // Total matched cents across all intents
    matchedCents: int("matchedCents").notNull().default(0),
    // Total unmatched cents (orphaned transactions)
    unmatchedCents: int("unmatchedCents").notNull().default(0),
    // Webhook log summary (JSON) for audit
    webhookLog: text("webhookLog"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("payment_reconciliations_provider_idx").on(t.provider)],
);

// ─── Inferred Types ──────────────────────────────────────────────────────────
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type PaymentMethodInsert = typeof paymentMethods.$inferInsert;
export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type PaymentIntentInsert = typeof paymentIntents.$inferInsert;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type PaymentTransactionInsert = typeof paymentTransactions.$inferInsert;
export type PaymentReconciliation = typeof paymentReconciliations.$inferSelect;
export type PaymentReconciliationInsert = typeof paymentReconciliations.$inferInsert;
=======
    invoiceId: fk("invoiceId").notNull(), // replaces v1's polymorphic orderId (B8)
    createdByUserId: fk("createdByUserId").notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 80 }).notNull(),
    requestFingerprint: char("requestFingerprint", { length: 64 }).notNull(),
    provider: mysqlEnum("provider", PROVIDERS).notNull(),
    providerOrderCode: bigint("providerOrderCode", {
      mode: "number",
    }).notNull(),
    amountMinor: minor("amountMinor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "awaiting_payment",
      "paid",
      "underpaid",
      "overpaid",
      "expired",
      "cancelled",
      "failed",
    ])
      .notNull()
      .default("pending"),
    qrCodeData: text("qrCodeData"), // EMVCo payload string
    checkoutUrl: varchar("checkoutUrl", { length: 500 }),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    // Idempotency is scoped per authenticated principal, not global (§3.8).
    uniqueIndex("intents_principal_idem_idx").on(
      t.createdByUserId,
      t.idempotencyKey
    ),
    uniqueIndex("intents_order_code_idx").on(t.providerOrderCode),
    index("intents_invoice_idx").on(t.invoiceId),
    index("intents_status_idx").on(t.status),
  ]
);

// ─── §7.3 idempotency_records ────────────────────────────────────────────────
// A bare UNIQUE(idempotencyKey) returns a duplicate-key error on retry instead
// of the original result, and cannot tell a legitimate retry from key reuse
// with a different body. This table can.
export const idempotencyRecords = mysqlTable(
  "idempotency_records",
  {
    id: serial("id").primaryKey(),
    principalId: fk("principalId").notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 80 }).notNull(),
    scope: varchar("scope", { length: 80 }).notNull(), // procedure path
    requestFingerprint: char("requestFingerprint", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["in_flight", "completed"])
      .notNull()
      .default("in_flight"),
    responseSnapshot: json("responseSnapshot").$type<Record<string, unknown>>(),
    lockedAt: timestamp("lockedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(), // 24h
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("idem_principal_key_idx").on(
      t.principalId,
      t.idempotencyKey,
      t.scope
    ),
    index("idem_expiry_idx").on(t.expiresAt),
  ]
);

// ─── §3.9 provider_transactions ──────────────────────────────────────────────
// Every inbound provider event, trusted or not, lands here before anything
// touches money. Fixes B6, G2 and implements ADR-03's trust asymmetry.
export const providerTransactions = mysqlTable(
  "provider_transactions",
  {
    id: serial("id").primaryKey(),
    provider: mysqlEnum("provider", PROVIDERS).notNull(),
    providerTxnId: varchar("providerTxnId", { length: 120 }).notNull(),
    rawPayload: json("rawPayload").$type<Record<string, unknown>>().notNull(), // verbatim body, for audit and replay
    signatureValid: boolean("signatureValid").notNull().default(false),
    amountMinor: minor("amountMinor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    description: varchar("description", { length: 255 }).notNull().default(""), // the bank memo
    counterAccountNumber: varchar("counterAccountNumber", { length: 60 }),
    counterAccountName: varchar("counterAccountName", { length: 255 }),
    bankReference: varchar("bankReference", { length: 120 }),
    // Casso's `when` is date-only on some banks (ACB) and a full timestamp on
    // others (VietinBank). NEVER order or deduplicate on this column.
    occurredAt: timestamp("occurredAt"),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    matchStatus: mysqlEnum("matchStatus", [
      "unmatched",
      "matched",
      "ambiguous",
      "ignored",
      "manual_matched",
    ])
      .notNull()
      .default("unmatched"),
    matchMethod: mysqlEnum("matchMethod", [
      "memo_token",
      "order_code",
      "heuristic",
      "manual",
    ]),
    matchedInvoiceId: fk("matchedInvoiceId"),
    // Set when re-fetched from the provider API. Only a verified Casso record
    // may move money (ADR-03).
    verifiedAt: timestamp("verifiedAt"),
    verificationError: varchar("verificationError", { length: 255 }),
    ignoredReason: varchar("ignoredReason", { length: 255 }),
  },
  t => [
    // THE idempotency guarantee for webhooks: a duplicate delivery hits this
    // index, returns 200, and has no side effects (§3.9, §14.2).
    uniqueIndex("provider_txn_unique_idx").on(t.provider, t.providerTxnId),
    index("provider_txn_match_idx").on(t.matchStatus),
    index("provider_txn_invoice_idx").on(t.matchedInvoiceId),
    index("provider_txn_received_idx").on(t.receivedAt),
  ]
);

// ─── §3.10 payment_allocations ───────────────────────────────────────────────
// The fix for G3: one transfer can settle several invoices; one invoice can
// take several transfers. Allocations are never deleted, only reversed.
export const paymentAllocations = mysqlTable(
  "payment_allocations",
  {
    id: serial("id").primaryKey(),
    providerTransactionId: fk("providerTransactionId").notNull(),
    invoiceId: fk("invoiceId").notNull(),
    amountMinor: minor("amountMinor").notNull(), // > 0, enforced in the service
    currency: char("currency", { length: 3 }).notNull(),
    // Required when payment currency ≠ invoice currency (§7.5). Capture it at
    // allocation time or the realized difference is unrecoverable later.
    fxRate: decimal("fxRate", { precision: 18, scale: 6 }),
    allocatedByUserId: fk("allocatedByUserId"), // null = automatic
    reversedAt: timestamp("reversedAt"),
    reversedByUserId: fk("reversedByUserId"),
    reversalReason: varchar("reversalReason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("allocations_invoice_idx").on(t.invoiceId),
    index("allocations_txn_idx").on(t.providerTransactionId),
    index("allocations_reversed_idx").on(t.reversedAt),
  ]
);

// Dead letter for the outbox consumer (§4.2) — 6 failed attempts and the event
// lands here and pages on-call rather than retrying forever.
export const domainEventsDead = mysqlTable("domain_events_dead", {
  id: serial("id").primaryKey(),
  eventId: fk("eventId").notNull(),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  aggregateType: varchar("aggregateType", { length: 40 }).notNull(),
  aggregateId: varchar("aggregateId", { length: 40 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>(),
  attempts: int("attempts").notNull().default(0),
  lastError: text("lastError"),
  deadLetteredAt: timestamp("deadLetteredAt").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NumberSequence = typeof numberSequences.$inferSelect;
export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;
export type ProviderTransaction = typeof providerTransactions.$inferSelect;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type DomainEventDead = typeof domainEventsDead.$inferSelect;
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
