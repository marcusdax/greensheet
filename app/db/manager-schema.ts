<<<<<<< HEAD
// Coffee Business Manager — bounded context schema
// Cross-references: coffee_products.lotId → coffee_lots.id (source of truth for green identity)
// Money: integer cents at rest (canonical convention from @db/schema)
// Naming: tables snake_case, TS exports camelCase

=======
// Manager context — counterparties, products, inventory, contracts, documents.
// Sprint spec §3. MySQL 8 + Drizzle throughout (ADR-01): serial PKs, bigint
// unsigned FKs, money as bigint minor units always paired with a currency
// column, timestamps stored UTC and converted at the boundary.
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
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

<<<<<<< HEAD
// ─── Catalog: Coffee Products ─────────────────────────────────────────────────
=======
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
    bankAccountName: varchar("bankAccountName", { length: 255 })
      .notNull()
      .default(""),
    // §12.2 — AES-256-GCM, KMS-managed key, per-row IV. Never plaintext: under
    // PDPD (Decree 13/2023) an individual's account number is sensitive data.
    bankAccountNumberEnc: varbinary("bankAccountNumberEnc", { length: 512 }),
    bankAccountLast4: char("bankAccountLast4", { length: 4 }), // display + operator matching
    contactEmail: varchar("contactEmail", { length: 320 })
      .notNull()
      .default(""),
    contactPhone: varchar("contactPhone", { length: 40 }).notNull().default(""),
    kycStatus: mysqlEnum("kycStatus", ["none", "pending", "verified"])
      .notNull()
      .default("none"),
    isIndividual: boolean("isIndividual").notNull().default(true), // drives PDPD handling
    consentedAt: timestamp("consentedAt"), // §12.2 consent capture
    consentVersion: varchar("consentVersion", { length: 20 })
      .notNull()
      .default(""),
    // §13.4 — the auto-allocation pilot allowlist.
    //
    // A timestamp rather than a boolean, because the rollout gate is a
    // DURATION: "graduate to auto-allocation only after 14 consecutive days
    // with zero reconciliation failures and zero manual reversals". A boolean
    // records that someone was admitted; it cannot answer when, so it cannot
    // answer whether the fourteen days have elapsed. NULL means not enrolled,
    // and not enrolled means every match on this counterparty waits for a
    // human — the flag alone is not enough to move their money.
    autoAllocationPilotAt: timestamp("autoAllocationPilotAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  t => [
    index("counterparties_type_idx").on(t.type),
    index("counterparties_name_idx").on(t.name),
    index("counterparties_partner_idx").on(t.partnerId),
    index("counterparties_roaster_idx").on(t.roasterId),
    index("counterparties_pilot_idx").on(t.autoAllocationPilotAt),
  ]
);

// Every decryption of a bank account number writes a row here — mirrors the
// sampleAccessLogs pattern already used for retained samples (§12.2).
export const counterpartyAccessLogs = mysqlTable(
  "counterparty_access_logs",
  {
    id: serial("id").primaryKey(),
    counterpartyId: fk("counterpartyId").notNull(),
    userId: fk("userId").notNull(),
    field: varchar("field", { length: 60 })
      .notNull()
      .default("bankAccountNumber"),
    purpose: varchar("purpose", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("cp_access_counterparty_idx").on(t.counterpartyId)]
);

// ─── §3.3 coffee_products ────────────────────────────────────────────────────
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
export const coffeeProducts = mysqlTable(
  "coffee_products",
  {
    id: serial("id").primaryKey(),
<<<<<<< HEAD
    // Product type: 'lot' = green bean lot (references coffee_lots), 'sku' = roasted SKU
    type: mysqlEnum("type", ["lot", "sku"]).notNull().default("sku"),
    // FK to green coffee source; nullable for SKU created from blended lots
    lotId: bigint("lotId", { mode: "number", unsigned: true }),
    // Origin details (denormalized from lot for SKU traceability)
    origin: varchar("origin", { length: 120 }).notNull().default(""),
    varietal: varchar("varietal", { length: 120 }).notNull().default(""),
    processMethod: varchar("processMethod", { length: 60 }).notNull().default(""),
    harvestYear: int("harvestYear"),
    // Cupping score (nullable for green lots pending cupping, required for roasted)
    cupScore: double("cupScore"),
    // Unit of trade: 'lbs' (green) or 'bags' (roasted)
    greenUnit: mysqlEnum("greenUnit", ["lbs", "bags"]).notNull().default("lbs"),
    // Roast level: light | medium | mediumDark | dark (required for roasted SKUs)
    roastLevel: mysqlEnum("roastLevel", ["light", "medium", "mediumDark", "dark"]),
    // Bag weight in grams (required for roasted SKUs)
    bagWeightG: int("bagWeightG"),
    // SKU code for roasted products
    sku: varchar("sku", { length: 40 }),
    // Conversion factor: green lbs → roasted bags (e.g., 0.75 lbs green per 12oz bag)
    conversionFactor: double("conversionFactor"),
    // Master product flag: true = can be roasted from green lots
    isMaster: boolean("isMaster").notNull().default(false),
    // Status: active | discontinued | outOfStock
    status: mysqlEnum("status", ["active", "discontinued", "outOfStock"]).notNull().default("active"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("products_type_idx").on(t.type),
    index("products_lot_idx").on(t.lotId),
    uniqueIndex("products_sku_idx").on(t.sku),
    index("products_status_idx").on(t.status),
  ],
);

// ─── Warehouse Management ─────────────────────────────────────────────────────
export const warehouses = mysqlTable(
  "warehouses",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }).notNull().default(""),
    timezone: varchar("timezone", { length: 60 }).notNull().default("Asia/Ho_Chi_Minh"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("warehouses_code_idx").on(t.code)],
);

// ─── Inventory: Physical Lots ─────────────────────────────────────────────────
=======
    lotId: fk("lotId").notNull(), // → coffee_lots.id, restrict on delete
    sku: varchar("sku", { length: 60 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    roastLevel: mysqlEnum("roastLevel", [
      "green",
      "light",
      "medium",
      "medium_dark",
      "dark",
    ])
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
  t => [
    uniqueIndex("products_sku_idx").on(t.sku),
    index("products_lot_idx").on(t.lotId),
  ]
);

// ─── §3.4 inventory_lots ─────────────────────────────────────────────────────
// Grams here, pounds in the catalog. Never convert at a call site — use
// lbsToGrams / gramsToLbs from contracts/constants.ts (§3.4).
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
export const inventoryLots = mysqlTable(
  "inventory_lots",
  {
    id: serial("id").primaryKey(),
<<<<<<< HEAD
    // FK to coffee product
    productId: bigint("productId", { mode: "number", unsigned: true }).notNull(),
    // FK to warehouse
    warehouseId: bigint("warehouseId", { mode: "number", unsigned: true }).notNull(),
    // Current quantity in trade units
    quantityUnits: int("quantityUnits").notNull().default(0),
    // FIFO date for inventory costing
    fifoDate: timestamp("fifoDate").defaultNow().notNull(),
    // Lot status lifecycle
    lotStatus: mysqlEnum("lotStatus", [
      "received",   // inbound QC passed
      "roasting",   // in roaster
      "roasted",    // roast complete, awaiting QC
      "blended",    // blended from multiple lots
      "shipped",    // dispatched to customer
      "lost",       // shrinkage/loss
    ]).notNull().default("received"),
    // Optional: links to purchase order line for traceability
    poLineId: bigint("poLineId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("inv_lots_product_idx").on(t.productId),
    index("inv_lots_warehouse_idx").on(t.warehouseId),
    index("inv_lots_fifo_idx").on(t.fifoDate),
    index("inv_lots_status_idx").on(t.lotStatus),
  ],
);

// ─── Inventory: Movement Ledger ──────────────────────────────────────────────
// Append-only audit log; never delete rows. Powers FIFO, stocktakes, shrinkage.
=======
    lotId: fk("lotId").notNull(),
    warehouseLocation: varchar("warehouseLocation", { length: 120 })
      .notNull()
      .default(""),
    quantityGrams: bigint("quantityGrams", { mode: "bigint" }).notNull(),
    status: mysqlEnum("status", ["in_stock", "allocated", "damaged", "expired"])
      .notNull()
      .default("in_stock"),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  t => [
    index("inv_lots_lot_idx").on(t.lotId),
    index("inv_lots_status_idx").on(t.status),
  ]
);

// ─── §3.5 inventory_movements ────────────────────────────────────────────────
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
export const inventoryMovements = mysqlTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
<<<<<<< HEAD
    // FK to coffee product
    productId: bigint("productId", { mode: "number", unsigned: true }).notNull(),
    // FK to warehouse
    warehouseId: bigint("warehouseId", { mode: "number", unsigned: true }).notNull(),
    // Positive = inbound, negative = outbound
    qtyChange: int("qtyChange").notNull(),
    // Movement type drives business logic
    type: mysqlEnum("type", [
      "inbound",     // PO received, sample kit, return
      "roast",       // green → roasted transformation
      "blend",       // multiple lots combined
      "outbound",    // sales order fulfilled
      "transfer",    // warehouse-to-warehouse
      "adjustment",  // stocktake correction (+/-)
      "loss",        // shrinkage, damage, expiry
    ]).notNull(),
    // Reference to source document (sales_order.id, purchase_order.id, etc.)
    refId: bigint("refId", { mode: "number", unsigned: true }),
    // Human actor: user name or 'system'
    actor: varchar("actor", { length: 120 }).notNull().default("system"),
    // Notes for audit trail
    notes: varchar("notes", { length: 255 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("movements_product_idx").on(t.productId),
    index("movements_warehouse_idx").on(t.warehouseId),
    index("movements_type_idx").on(t.type),
    index("movements_ref_idx").on(t.refId),
    index("movements_date_idx").on(t.createdAt),
  ],
);

// ─── CRM: Customers ───────────────────────────────────────────────────────────
export const customers = mysqlTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    taxId: varchar("taxId", { length: 40 }).notNull().default(""),
    email: varchar("email", { length: 320 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    address: varchar("address", { length: 500 }).notNull().default(""),
    // Pricing tier affects unit pricing
    pricingTier: mysqlEnum("pricingTier", ["standard", "silver", "gold", "platinum"])
      .notNull()
      .default("standard"),
    // Credit limit in cents (0 = no credit)
    creditLimitCents: int("creditLimitCents").notNull().default(0),
    // Payment terms in days
    paymentTermsDays: int("paymentTermsDays").notNull().default(30),
    // Customer segment
    segment: mysqlEnum("segment", ["b2b", "b2c"]).notNull().default("b2b"),
    // Customer status
    status: mysqlEnum("status", ["active", "inactive", "blocked"]).notNull().default("active"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("customers_name_idx").on(t.name),
    index("customers_segment_idx").on(t.segment),
    index("customers_status_idx").on(t.status),
  ],
);

// ─── CRM: Suppliers ───────────────────────────────────────────────────────────
export const suppliers = mysqlTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    // Origin region of primary supply
    originRegion: varchar("originRegion", { length: 120 }).notNull().default(""),
    // Certifications (comma-separated: "FTO,Rainforest,Organic")
    certifications: varchar("certifications", { length: 255 }).notNull().default(""),
    taxId: varchar("taxId", { length: 40 }).notNull().default(""),
    // Supplier status
    status: mysqlEnum("status", ["active", "inactive", "on_hold"]).notNull().default("active"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("suppliers_name_idx").on(t.name),
    index("suppliers_region_idx").on(t.originRegion),
    index("suppliers_status_idx").on(t.status),
  ],
);

// ─── Sales: Orders ───────────────────────────────────────────────────────────
export const salesOrders = mysqlTable(
  "sales_orders",
  {
    id: serial("id").primaryKey(),
    // Human-readable order number
    orderNumber: varchar("orderNumber", { length: 40 }).notNull().unique(),
    // FK to customer
    customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
    // FK to fulfillment warehouse
    warehouseId: bigint("warehouseId", { mode: "number", unsigned: true }).notNull(),
    // Order status lifecycle
    status: mysqlEnum("status", [
      "draft",      // created, not yet authorized
      "authorized", // credit check passed, pending fulfillment
      "fulfilled",  // all lines shipped
      "cancelled",  // cancelled (by customer or system)
    ]).notNull().default("draft"),
    // Total in cents
    totalCents: int("totalCents").notNull().default(0),
    // Currency: VND (domestic) or USD (export)
    currency: mysqlEnum("currency", ["VND", "USD"]).notNull().default("VND"),
    // Payment due date
    dueDate: timestamp("dueDate"),
    // Payment status for AR tracking
    paymentStatus: mysqlEnum("paymentStatus", [
      "unpaid",   // awaiting payment
      "partial",   // partially paid
      "paid",      // fully paid
      "overdue",   // past due date
      "refunded",  // refunded
    ]).notNull().default("unpaid"),
    // Idempotency key for replay safety
    idempotencyKey: varchar("idempotencyKey", { length: 80 }),
    // Shipping address snapshot
    shippingAddress: varchar("shippingAddress", { length: 500 }).notNull().default(""),
    // Notes
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sales_orders_idem_idx").on(t.idempotencyKey),
    index("sales_orders_customer_idx").on(t.customerId),
    index("sales_orders_status_idx").on(t.status),
    index("sales_orders_payment_status_idx").on(t.paymentStatus),
    index("sales_orders_due_date_idx").on(t.dueDate),
  ],
);

// ─── Sales: Order Lines ───────────────────────────────────────────────────────
export const salesOrderLines = mysqlTable(
  "sales_order_lines",
  {
    id: serial("id").primaryKey(),
    // FK to sales order
    orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
    // FK to coffee product
    productId: bigint("productId", { mode: "number", unsigned: true }).notNull(),
    // Quantity ordered
    quantity: int("quantity").notNull(),
    // Unit price in cents at time of order
    unitCents: int("unitCents").notNull(),
    // Line total = quantity × unitCents
    totalCents: int("totalCents").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("sales_lines_order_idx").on(t.orderId),
    index("sales_lines_product_idx").on(t.productId),
  ],
);

// ─── Procurement: Purchase Orders ──────────────────────────────────────────
export const purchaseOrders = mysqlTable(
  "purchase_orders",
  {
    id: serial("id").primaryKey(),
    // Human-readable PO number
    poNumber: varchar("poNumber", { length: 40 }).notNull().unique(),
    // FK to supplier
    supplierId: bigint("supplierId", { mode: "number", unsigned: true }).notNull(),
    // PO status
    status: mysqlEnum("status", [
      "draft",        // created, not yet sent
      "sent",         // sent to supplier
      "received",     // partially or fully received
      "quality_hold", // received but held for QC
      "cancelled",    // cancelled
    ]).notNull().default("draft"),
    // Total in cents
    totalCents: int("totalCents").notNull().default(0),
    // Currency
    currency: mysqlEnum("currency", ["VND", "USD"]).notNull().default("VND"),
    // Expected delivery date
    expectedDeliveryDate: timestamp("expectedDeliveryDate"),
    // Notes
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("purchase_orders_supplier_idx").on(t.supplierId),
    index("purchase_orders_status_idx").on(t.status),
  ],
);

// ─── Procurement: PO Lines ─────────────────────────────────────────────────
export const purchaseOrderLines = mysqlTable(
  "purchase_order_lines",
  {
    id: serial("id").primaryKey(),
    // FK to purchase order
    poId: bigint("poId", { mode: "number", unsigned: true }).notNull(),
    // FK to green coffee lot (source of truth)
    lotId: bigint("lotId", { mode: "number", unsigned: true }).notNull(),
    // Quantity in lbs
    quantity: int("quantity").notNull(),
    // Expected cupping score at delivery
    expectedCupScore: double("expectedCupScore"),
    // Unit price in cents/lb at time of PO
    unitCents: int("unitCents").notNull(),
    // Line total
    totalCents: int("totalCents").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("po_lines_po_idx").on(t.poId),
    index("po_lines_lot_idx").on(t.lotId),
  ],
);

// ─── AR Aging ────────────────────────────────────────────────────────────────
export const arAging = mysqlTable(
  "ar_aging",
  {
    id: serial("id").primaryKey(),
    // FK to customer
    customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
    // FK to sales order (invoice)
    invoiceId: bigint("invoiceId", { mode: "number", unsigned: true }).notNull(),
    // Invoice due date
    dueDate: timestamp("dueDate").notNull(),
    // Outstanding amount in cents
    outstandingCents: int("outstandingCents").notNull(),
    // Days past due (computed daily)
    daysPastDue: int("daysPastDue").notNull().default(0),
    // Status
    status: mysqlEnum("status", ["open", "paid", "written_off"]).notNull().default("open"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("ar_aging_customer_idx").on(t.customerId),
    index("ar_aging_invoice_idx").on(t.invoiceId),
    index("ar_aging_status_idx").on(t.status),
    index("ar_aging_dpd_idx").on(t.daysPastDue),
  ],
);

// ─── Inferred Types ──────────────────────────────────────────────────────────
export type CoffeeProduct = typeof coffeeProducts.$inferSelect;
export type CoffeeProductInsert = typeof coffeeProducts.$inferInsert;
export type Warehouse = typeof warehouses.$inferSelect;
export type WarehouseInsert = typeof warehouses.$inferInsert;
export type InventoryLot = typeof inventoryLots.$inferSelect;
export type InventoryLotInsert = typeof inventoryLots.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InventoryMovementInsert = typeof inventoryMovements.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type SupplierInsert = typeof suppliers.$inferInsert;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type SalesOrderInsert = typeof salesOrders.$inferInsert;
export type SalesOrderLine = typeof salesOrderLines.$inferSelect;
export type SalesOrderLineInsert = typeof salesOrderLines.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type PurchaseOrderLineInsert = typeof purchaseOrderLines.$inferInsert;
export type ArAging = typeof arAging.$inferSelect;
export type ArAgingInsert = typeof arAging.$inferInsert;
=======
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
  t => [
    index("inv_moves_lot_idx").on(t.inventoryLotId),
    index("inv_moves_ref_idx").on(t.referenceType, t.referenceId),
  ]
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
    totalMinor: minor("totalMinor")
      .notNull()
      .default(sql`0`),
    quantityGrams: bigint("quantityGrams", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
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
  t => [
    uniqueIndex("contracts_number_idx").on(t.contractNumber, t.deletedFlag),
    index("contracts_counterparty_idx").on(t.counterpartyId),
    index("contracts_status_idx").on(t.status),
  ]
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
  t => [uniqueIndex("contract_lots_unique_idx").on(t.contractId, t.lotId)]
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
    sizeBytes: bigint("sizeBytes", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    storageKey: varchar("storageKey", { length: 500 }).notNull(),
    // Unique: the same lab report uploaded twice must not run OCR twice or
    // create two drafts (§3.12).
    sha256: char("sha256", { length: 64 }),
    uploadStatus: mysqlEnum("uploadStatus", [
      "pending",
      "uploaded",
      "abandoned",
    ])
      .notNull()
      .default("pending"),
    scanStatus: mysqlEnum("scanStatus", [
      "pending",
      "clean",
      "infected",
      "skipped",
    ])
      .notNull()
      .default("pending"),
    uploadedByUserId: fk("uploadedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  t => [
    uniqueIndex("documents_sha_idx").on(t.sha256),
    index("documents_entity_idx").on(t.entityType, t.entityId),
    index("documents_scan_idx").on(t.scanStatus),
  ]
);

export const ocrResults = mysqlTable(
  "ocr_results",
  {
    id: serial("id").primaryKey(),
    documentId: fk("documentId").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "processing",
      "completed",
      "failed",
    ])
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
    reviewOutcome: mysqlEnum("reviewOutcome", [
      "accepted",
      "edited",
      "rejected",
    ]),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("ocr_document_idx").on(t.documentId),
    index("ocr_status_idx").on(t.status),
  ]
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
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
