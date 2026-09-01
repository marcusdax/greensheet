// Manager context — counterparties, products, inventory, contracts, documents.
// Sprint spec §3. MySQL 8 + Drizzle throughout (ADR-01): serial PKs, bigint
// unsigned FKs, money as bigint minor units always paired with a currency
// column, timestamps stored UTC and converted at the boundary.
import {
  mysqlTable,
  serial,
  bigint,
  int,
  smallint,
  varchar,
  char,
  varbinary,
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

/** FK helper — every foreign key in this codebase is bigint unsigned (B2). */
const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });
/** Money helper — bigint minor units, never int (B3), never float. */
const minor = (name: string) => bigint(name, { mode: "bigint" });

// ─── §3.2 counterparties ─────────────────────────────────────────────────────
// partnerId / roasterId are the fix for G5: without them there is no join from
// a payment received to the farmer whose revenue share it funds, and the lot
// P&L cannot close.
export const counterparties = mysqlTable(
  "counterparties",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", [
      "farmer",
      "cooperative",
      "exporter",
      "importer",
      "roaster",
      "cafe",
      "other",
    ]).notNull(),
    partnerId: fk("partnerId"), // → partners.id (Revenue Share partner record)
    roasterId: fk("roasterId"), // → roasters.id (existing CRM record)
    country: varchar("country", { length: 120 }).notNull().default("VN"),
    province: varchar("province", { length: 120 }).notNull().default(""),
    taxId: varchar("taxId", { length: 40 }).notNull().default(""), // MST, 10 or 13 digits
    bankName: varchar("bankName", { length: 255 }).notNull().default(""),
    bankBranch: varchar("bankBranch", { length: 255 }).notNull().default(""),
    bankAccountName: varchar("bankAccountName", { length: 255 }).notNull().default(""),
    // §12.2 — AES-256-GCM, KMS-managed key, per-row IV. Never plaintext: under
    // PDPD (Decree 13/2023) an individual's account number is sensitive data.
    bankAccountNumberEnc: varbinary("bankAccountNumberEnc", { length: 512 }),
    bankAccountLast4: char("bankAccountLast4", { length: 4 }), // display + operator matching
    contactEmail: varchar("contactEmail", { length: 320 }).notNull().default(""),
    contactPhone: varchar("contactPhone", { length: 40 }).notNull().default(""),
    kycStatus: mysqlEnum("kycStatus", ["none", "pending", "verified"]).notNull().default("none"),
    isIndividual: boolean("isIndividual").notNull().default(true), // drives PDPD handling
    consentedAt: timestamp("consentedAt"), // §12.2 consent capture
    consentVersion: varchar("consentVersion", { length: 20 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  (t) => [
    index("counterparties_type_idx").on(t.type),
    index("counterparties_name_idx").on(t.name),
    index("counterparties_partner_idx").on(t.partnerId),
    index("counterparties_roaster_idx").on(t.roasterId),
  ],
);

// Every decryption of a bank account number writes a row here — mirrors the
// sampleAccessLogs pattern already used for retained samples (§12.2).
export const counterpartyAccessLogs = mysqlTable(
  "counterparty_access_logs",
  {
    id: serial("id").primaryKey(),
    counterpartyId: fk("counterpartyId").notNull(),
    userId: fk("userId").notNull(),
    field: varchar("field", { length: 60 }).notNull().default("bankAccountNumber"),
    purpose: varchar("purpose", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("cp_access_counterparty_idx").on(t.counterpartyId)],
);

// ─── §3.3 coffee_products ────────────────────────────────────────────────────
export const coffeeProducts = mysqlTable(
  "coffee_products",
  {
    id: serial("id").primaryKey(),
    lotId: fk("lotId").notNull(), // → coffee_lots.id, restrict on delete
    sku: varchar("sku", { length: 60 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    roastLevel: mysqlEnum("roastLevel", ["green", "light", "medium", "medium_dark", "dark"])
      .notNull()
      .default("green"),
    packageGrams: int("packageGrams").notNull().default(0),
    retailPriceMinor: minor("retailPriceMinor").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("VND"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  (t) => [uniqueIndex("products_sku_idx").on(t.sku), index("products_lot_idx").on(t.lotId)],
);

// ─── §3.4 inventory_lots ─────────────────────────────────────────────────────
// Grams here, pounds in the catalog. Never convert at a call site — use
// lbsToGrams / gramsToLbs from contracts/constants.ts (§3.4).
export const inventoryLots = mysqlTable(
  "inventory_lots",
  {
    id: serial("id").primaryKey(),
    lotId: fk("lotId").notNull(),
    warehouseLocation: varchar("warehouseLocation", { length: 120 }).notNull().default(""),
    quantityGrams: bigint("quantityGrams", { mode: "bigint" }).notNull(),
    status: mysqlEnum("status", ["in_stock", "allocated", "damaged", "expired"])
      .notNull()
      .default("in_stock"),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  (t) => [index("inv_lots_lot_idx").on(t.lotId), index("inv_lots_status_idx").on(t.status)],
);

// ─── §3.5 inventory_movements ────────────────────────────────────────────────
export const inventoryMovements = mysqlTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    inventoryLotId: fk("inventoryLotId").notNull(),
    movementType: mysqlEnum("movementType", [
      "receipt",
      "allocation",
      "release",
      "shipment",
      "adjustment",
      "write_off",
    ]).notNull(),
    quantityGrams: bigint("quantityGrams", { mode: "bigint" }).notNull(), // signed
    referenceType: mysqlEnum("referenceType", [
      "contract",
      "sales_order",
      "invoice",
      "audit",
      "manual",
    ]).notNull(),
    // DELIBERATELY NOT A FOREIGN KEY. referenceId is polymorphic across four
    // tables; a future migration must not "fix" this into a broken constraint.
    referenceId: fk("referenceId"),
    note: varchar("note", { length: 255 }).notNull().default(""),
    createdByUserId: fk("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("inv_moves_lot_idx").on(t.inventoryLotId),
    index("inv_moves_ref_idx").on(t.referenceType, t.referenceId),
  ],
);

// ─── §3.6 contracts ──────────────────────────────────────────────────────────
export const commercialContracts = mysqlTable(
  "commercial_contracts",
  {
    id: serial("id").primaryKey(),
    contractNumber: varchar("contractNumber", { length: 40 }).notNull(),
    counterpartyId: fk("counterpartyId").notNull(),
    direction: mysqlEnum("direction", ["purchase", "sale"]).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "active",
      "fulfilled",
      "cancelled",
      "disputed",
    ])
      .notNull()
      .default("draft"),
    currency: char("currency", { length: 3 }).notNull(),
    totalMinor: minor("totalMinor").notNull().default(0n),
    quantityGrams: bigint("quantityGrams", { mode: "bigint" }).notNull().default(0n),
    incoterm: varchar("incoterm", { length: 12 }).notNull().default(""),
    // FX is captured at signature or it is unrecoverable later (§7.5).
    fxRateLocked: decimal("fxRateLocked", { precision: 18, scale: 6 }),
    fxRateLockedAt: timestamp("fxRateLockedAt"),
    deliveryWindowStart: date("deliveryWindowStart", { mode: "string" }),
    deliveryWindowEnd: date("deliveryWindowEnd", { mode: "string" }),
    // Licensed exception to the VND-between-residents rule (§3.6); writing this
    // requires ops_manager and emits an audit event.
    residencyOverrideNote: varchar("residencyOverrideNote", { length: 500 }),
    sourceDocumentId: fk("sourceDocumentId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
    // §3.14 — MySQL has no partial indexes. Contract numbers may be reused after
    // a soft delete, so the unique index is (contractNumber, deletedFlag) where
    // deletedFlag is 0 while live and the row id once deleted.
    deletedFlag: bigint("deletedFlag", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
  },
  (t) => [
    uniqueIndex("contracts_number_idx").on(t.contractNumber, t.deletedFlag),
    index("contracts_counterparty_idx").on(t.counterpartyId),
    index("contracts_status_idx").on(t.status),
  ],
);

// One path from a contract to its lots, not two (§3.6 drops the nullable lotId).
export const contractLots = mysqlTable(
  "contract_lots",
  {
    id: serial("id").primaryKey(),
    contractId: fk("contractId").notNull(),
    lotId: fk("lotId").notNull(),
    quantityGrams: bigint("quantityGrams", { mode: "bigint" }).notNull(),
    unitPriceMinor: minor("unitPriceMinor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
  },
  (t) => [uniqueIndex("contract_lots_unique_idx").on(t.contractId, t.lotId)],
);

// ─── §3.12 documents ─────────────────────────────────────────────────────────
export const documents = mysqlTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    // qc_audit is gone (B5): quality truth is cuppingSessions and nothing else.
    entityType: mysqlEnum("entityType", [
      "coffee_lot",
      "contract",
      "cupping_session",
      "invoice",
      "counterparty",
      "shipment",
    ]).notNull(),
    entityId: fk("entityId"),
    documentType: mysqlEnum("documentType", [
      "sca_lab_report",
      "sales_contract",
      "purchase_contract",
      "bill_of_lading",
      "phytosanitary_certificate",
      "invoice",
      "other",
    ]).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    sizeBytes: bigint("sizeBytes", { mode: "number", unsigned: true }).notNull().default(0),
    storageKey: varchar("storageKey", { length: 500 }).notNull(),
    // Unique: the same lab report uploaded twice must not run OCR twice or
    // create two drafts (§3.12).
    sha256: char("sha256", { length: 64 }),
    uploadStatus: mysqlEnum("uploadStatus", ["pending", "uploaded", "abandoned"])
      .notNull()
      .default("pending"),
    scanStatus: mysqlEnum("scanStatus", ["pending", "clean", "infected", "skipped"])
      .notNull()
      .default("pending"),
    uploadedByUserId: fk("uploadedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  (t) => [
    uniqueIndex("documents_sha_idx").on(t.sha256),
    index("documents_entity_idx").on(t.entityType, t.entityId),
    index("documents_scan_idx").on(t.scanStatus),
  ],
);

export const ocrResults = mysqlTable(
  "ocr_results",
  {
    id: serial("id").primaryKey(),
    documentId: fk("documentId").notNull(),
    status: mysqlEnum("status", ["pending", "processing", "completed", "failed"])
      .notNull()
      .default("pending"),
    schemaVersion: smallint("schemaVersion").notNull().default(1),
    // Extracted values only. Confidence lives solely in confidenceScores — in
    // v1 it lived in both places, which drifts (§3.12).
    structuredData: json("structuredData").$type<Record<string, unknown>>(),
    confidenceScores: json("confidenceScores").$type<Record<string, number>>(),
    // You cannot debug an extraction regression without knowing which model ran.
    modelVersion: varchar("modelVersion", { length: 80 }).notNull().default(""),
    errorMessage: text("errorMessage"),
    attempts: int("attempts").notNull().default(0),
    // The human-in-the-loop step must leave evidence (§3.12, ADR-04).
    reviewedByUserId: fk("reviewedByUserId"),
    reviewedAt: timestamp("reviewedAt"),
    reviewOutcome: mysqlEnum("reviewOutcome", ["accepted", "edited", "rejected"]),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("ocr_document_idx").on(t.documentId),
    index("ocr_status_idx").on(t.status),
  ],
);

export type Counterparty = typeof counterparties.$inferSelect;
export type CounterpartyAccessLog = typeof counterpartyAccessLogs.$inferSelect;
export type CoffeeProduct = typeof coffeeProducts.$inferSelect;
export type InventoryLot = typeof inventoryLots.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type CommercialContract = typeof commercialContracts.$inferSelect;
export type ContractLot = typeof contractLots.$inferSelect;
export type ManagedDocument = typeof documents.$inferSelect;
export type OcrResult = typeof ocrResults.$inferSelect;

// ─── ADR-05 runtime feature flags ────────────────────────────────────────────
// Build-time VITE_* variables (G8) cannot kill a misbehaving payment flow
// without a redeploy. These rows can, in under a minute.
export const featureFlags = mysqlTable("feature_flags", {
  id: serial("id").primaryKey(),
  flagKey: varchar("flagKey", { length: 60 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  description: varchar("description", { length: 255 }).notNull().default(""),
  updatedByUserId: fk("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
