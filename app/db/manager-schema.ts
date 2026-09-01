// Coffee Business Manager — bounded context schema
// Cross-references: coffee_products.lotId → coffee_lots.id (source of truth for green identity)
// Money: integer cents at rest (canonical convention from @db/schema)
// Naming: tables snake_case, TS exports camelCase

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

// ─── Catalog: Coffee Products ─────────────────────────────────────────────────
export const coffeeProducts = mysqlTable(
  "coffee_products",
  {
    id: serial("id").primaryKey(),
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
export const inventoryLots = mysqlTable(
  "inventory_lots",
  {
    id: serial("id").primaryKey(),
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
export const inventoryMovements = mysqlTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
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
