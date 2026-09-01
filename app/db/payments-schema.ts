// Payments — Vietnam payment methods context
// Provider APIs: VietQR via Casso/PayOS, MoMo, ZaloPay
// Money: integer cents at rest (canonical convention from @db/schema)
// Events: payment.received → triggers AR clearing in sales_orders

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
export const paymentIntents = mysqlTable(
  "payment_intents",
  {
    id: serial("id").primaryKey(),
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