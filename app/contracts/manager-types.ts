// Coffee Business Manager — Zod DTOs for tRPC router inputs/outputs.
// Mirrors the existing contracts/ pattern; money fields are integer cents.

import { z } from "zod";

// ─── Coffee Products ────────────────────────────────────────────────────────
export const productTypeSchema = z.enum(["lot", "sku"]);
export const roastLevelSchema = z.enum(["light", "medium", "mediumDark", "dark"]);
export const productStatusSchema = z.enum(["active", "discontinued", "outOfStock"]);

export const createProductSchema = z.object({
  type: productTypeSchema.default("sku"),
  lotId: z.number().int().positive().optional(),
  origin: z.string().min(1).max(120).default(""),
  varietal: z.string().min(1).max(120).default(""),
  processMethod: z.string().min(1).max(60).default(""),
  harvestYear: z.number().int().min(1900).max(2100).optional(),
  cupScore: z.number().min(0).max(100).optional(),
  greenUnit: z.enum(["lbs", "bags"]).default("lbs"),
  roastLevel: roastLevelSchema.optional(),
  bagWeightG: z.number().int().positive().optional(),
  sku: z.string().min(1).max(40).optional(),
  conversionFactor: z.number().min(0).max(10).optional(),
  isMaster: z.boolean().default(false),
  status: productStatusSchema.default("active"),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.number().int().positive(),
});

// ─── Warehouses ──────────────────────────────────────────────────────────────
export const createWarehouseSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  location: z.string().max(255).default(""),
  timezone: z.string().max(60).default("Asia/Ho_Chi_Minh"),
});

// ─── Inventory Movements ─────────────────────────────────────────────────────
export const movementTypeSchema = z.enum([
  "inbound",
  "roast",
  "blend",
  "outbound",
  "transfer",
  "adjustment",
  "loss",
]);

export const createMovementSchema = z.object({
  productId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  qtyChange: z.number().int(),
  type: movementTypeSchema,
  refId: z.number().int().positive().optional(),
  actor: z.string().min(1).max(120).default("system"),
  notes: z.string().max(255).default(""),
});

export const inventoryLotStatusSchema = z.enum([
  "received",
  "roasting",
  "roasted",
  "blended",
  "shipped",
  "lost",
]);

export const updateInventoryLotSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive().optional(),
  warehouseId: z.number().int().positive().optional(),
  quantityUnits: z.number().int().min(0).optional(),
  fifoDate: z.date().optional(),
  lotStatus: inventoryLotStatusSchema.optional(),
  poLineId: z.number().int().positive().optional(),
});

// ─── Customers ───────────────────────────────────────────────────────────────
export const customerSegmentSchema = z.enum(["b2b", "b2c"]);
export const pricingTierSchema = z.enum(["standard", "silver", "gold", "platinum"]);
export const customerStatusSchema = z.enum(["active", "inactive", "blocked"]);

export const upsertCustomerSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(255),
  taxId: z.string().max(40).default(""),
  email: z.string().email().default(""),
  phone: z.string().max(40).default(""),
  address: z.string().max(500).default(""),
  pricingTier: pricingTierSchema.default("standard"),
  creditLimitCents: z.number().int().min(0).default(0),
  paymentTermsDays: z.number().int().min(0).default(30),
  segment: customerSegmentSchema.default("b2b"),
  status: customerStatusSchema.default("active"),
});

// ─── Suppliers ───────────────────────────────────────────────────────────────
export const supplierStatusSchema = z.enum(["active", "inactive", "on_hold"]);

export const upsertSupplierSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(255),
  email: z.string().email().default(""),
  phone: z.string().max(40).default(""),
  originRegion: z.string().max(120).default(""),
  certifications: z.string().max(255).default(""),
  taxId: z.string().max(40).default(""),
  status: supplierStatusSchema.default("active"),
});

// ─── Sales Orders ────────────────────────────────────────────────────────────
export const salesOrderStatusSchema = z.enum([
  "draft",
  "authorized",
  "fulfilled",
  "cancelled",
]);
export const salesOrderPaymentStatusSchema = z.enum([
  "unpaid",
  "partial",
  "paid",
  "overdue",
  "refunded",
]);
export const currencySchema = z.enum(["VND", "USD"]);

export const salesOrderLineSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitCents: z.number().int().min(0),
});

export const createSalesOrderSchema = z.object({
  customerId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  currency: currencySchema.default("VND"),
  dueDate: z.date().optional(),
  shippingAddress: z.string().max(500).default(""),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8),
  lines: z.array(salesOrderLineSchema).min(1),
});

export const advanceSalesOrderSchema = z.object({
  orderId: z.number().int().positive(),
  target: salesOrderStatusSchema,
});

export const cancelSalesOrderSchema = z.object({
  orderId: z.number().int().positive(),
  reason: z.string().max(255).default(""),
});

// ─── Purchase Orders ────────────────────────────────────────────────────────
export const purchaseOrderStatusSchema = z.enum([
  "draft",
  "sent",
  "received",
  "quality_hold",
  "cancelled",
]);

export const purchaseOrderLineSchema = z.object({
  lotId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  expectedCupScore: z.number().min(0).max(100).optional(),
  unitCents: z.number().int().min(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive(),
  currency: currencySchema.default("VND"),
  expectedDeliveryDate: z.date().optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(purchaseOrderLineSchema).min(1),
});

// ─── AR Aging ────────────────────────────────────────────────────────────────
export const arAgingStatusSchema = z.enum(["open", "paid", "written_off"]);

export const createArAgingSchema = z.object({
  customerId: z.number().int().positive(),
  invoiceId: z.number().int().positive(),
  dueDate: z.date(),
  outstandingCents: z.number().int().min(0),
});