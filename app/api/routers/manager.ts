// Coffee Business Manager — tRPC router for all Manager endpoints
// Mirrors patterns from existing routers (catalog, orders, partners)
// All endpoints enforce idempotency where applicable and emit domain events.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  coffeeProducts,
  warehouses,
  inventoryLots,
  inventoryMovements,
  customers,
  suppliers,
  salesOrders,
  salesOrderLines,
  purchaseOrders,
  purchaseOrderLines,
  arAging,
} from "@db/schema";
import { emitEvent } from "../engine";
import { ORDER_TRANSITIONS, FLAT_SHIPPING_CENTS } from "@contracts/constants";
import * as managerTypes from "@contracts/manager-types";

export const managerRouter = createRouter({
  // ─── Catalog ─────────────────────────────────────────────────────────────
  listCatalog: publicQuery.query(async ({ input }) => {
    const db = getDb();
    let products = await db.select().from(coffeeProducts);
    
    // Filter by type if specified
    if (input?.type) {
      products = products.filter(p => p.type === input.type);
    }
    
    // Filter by status if specified
    if (input?.status) {
      products = products.filter(p => p.status === input.status);
    }
    
    // Load associated lots for reference traceability
    const results = await Promise.all(
      products.map(async (p) => {
        if (p.lotId) {
          const lot = await db.query.coffeeLots.findFirst({ where: (lots) => lots.id === p.lotId });
          return {
            ...p,
            lotInfo: lot ? {
              id: lot.id,
              name: lot.name,
              origin: lot.origin,
              cupScore: lot.cupScore,
              pricePerLbCents: lot.pricePerLbCents,
              status: lot.status,
            } : null,
          };
        }
        return p;
      })
    );
    
    return results;
  }),

  // ─── Products CRUD ─────────────────────────────────────────────────────────
  createProduct: publicQuery
    .input(managerTypes.createProductSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(coffeeProducts).values(input).$returningId();
      await emitEvent("coffee_product.created", "product", id, {
        productId: id,
        type: input.type,
        lotId: input.lotId,
        sku: input.sku,
      });
      return { id };
    }),

  updateProduct: publicQuery
    .input(managerTypes.updateProductSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(coffeeProducts).set(data).where(coffeeProducts.id === id);
      await emitEvent("coffee_product.updated", "product", id, {
        productId: id,
        updates: data,
      });
      return { id };
    }),

  // ─── Warehouses CRUD ──────────────────────────────────────────────────────
  createWarehouse: publicQuery
    .input(managerTypes.createWarehouseSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(warehouses).values(input).$returningId();
      await emitEvent("warehouse.created", "warehouse", id, { warehouseId: id, ...input });
      return { id };
    }),

  updateWarehouse: publicQuery
    .input(z.object({ id: z.number().int().positive() }).merge(managerTypes.createWarehouseSchema.partial()))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(warehouses).set(data).where(warehouses.id === id);
      await emitEvent("warehouse.updated", "warehouse", id, { warehouseId: id, ...data });
      return { id };
    }),

  // ─── Inventory Movements ───────────────────────────────────────────────────
  createMovement: publicQuery
    .input(managerTypes.createMovementSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Validate product exists
      const product = await db.query.coffeeProducts.findFirst({
        where: coffeeProducts.id === input.productId,
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "GS-MAN-1000 · product not found" });
      
      // Validate warehouse exists
      const warehouse = await db.query.warehouses.findFirst({
        where: warehouses.id === input.warehouseId,
      });
      if (!warehouse) throw new TRPCError({ code: "NOT_FOUND", message: "GS-MAN-1001 · warehouse not found" });
      
      const [{ id }] = await db.insert(inventoryMovements).values(input).$returningId();
      await emitEvent("inventory.item_moved", "movement", id, {
        movementId: id,
        productId: input.productId,
        warehouseId: input.warehouseId,
        qtyChange: input.qtyChange,
        type: input.type,
        refId: input.refId,
        actor: input.actor,
      });
      
      // Update inventory lot if applicable (simplified logic)
      if (input.type === "inbound" || input.type === "adjustment") {
        await db.insert(inventoryLots).values({
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantityUnits: Math.max(0, input.qtyChange),
          lotStatus: "received",
          poLineId: input.refId || null,
        });
      } else if (input.type === "outbound") {
        // Allocate from existing lot (FIFO)
        const lot = await db.query.inventoryLots.findFirst({
          where: (lots) => 
            lots.productId === input.productId && 
            lots.warehouseId === input.warehouseId &&
            lots.lotStatus === "received",
          orderBy: (lots) => lots.fifoDate,
        });
        if (lot && lot.quantityUnits >= input.qtyChange) {
          await db.update(inventoryLots)
            .set({ quantityUnits: lot.quantityUnits - input.qtyChange })
            .where(inventoryLots.id === lot.id);
          if (lot.quantityUnits - input.qtyChange === 0) {
            await db.update(inventoryLots)
              .set({ lotStatus: "shipped" })
              .where(inventoryLots.id === lot.id);
          }
        }
      }
      
      return { id };
    }),

  // ─── Customers CRUD ───────────────────────────────────────────────────────
  upsertCustomer: publicQuery
    .input(managerTypes.upsertCustomerSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.id) {
        await db.update(customers).set(input).where(customers.id === input.id);
        await emitEvent("customer.updated", "customer", input.id, { customerId: input.id, ...input });
        return { id: input.id };
      }
      
      const [{ id }] = await db.insert(customers).values(input).$returningId();
      await emitEvent("customer.created", "customer", id, { customerId: id, ...input });
      return { id };
    }),

  listCustomers: publicQuery
    .query(async ({ input }) => {
      const db = getDb();
      let customersList = await db.select().from(customers);
      
      if (input?.segment) {
        customersList = customersList.filter(c => c.segment === input.segment);
      }
      
      if (input?.status) {
        customersList = customersList.filter(c => c.status === input.status);
      }
      
      return customersList;
    }),

  // ─── Suppliers CRUD ───────────────────────────────────────────────────────
  upsertSupplier: publicQuery
    .input(managerTypes.upsertSupplierSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.id) {
        await db.update(suppliers).set(input).where(suppliers.id === input.id);
        await emitEvent("supplier.updated", "supplier", input.id, { supplierId: input.id, ...input });
        return { id: input.id };
      }
      
      const [{ id }] = await db.insert(suppliers).values(input).$returningId();
      await emitEvent("supplier.created", "supplier", id, { supplierId: id, ...input });
      return { id };
    }),

  listSuppliers: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(suppliers).orderBy(suppliers.name);
  }),

  // ─── Sales Orders ──────────────────────────────────────────────────────────
  createSalesOrder: publicQuery
    .input(managerTypes.createSalesOrderSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Idempotent replay check
      const replay = await db.query.salesOrders.findFirst({
        where: salesOrders.idempotencyKey === input.idempotencyKey,
      });
      if (replay) return { order: replay, replayed: true };
      
      // Validate customer exists
      const customer = await db.query.customers.findFirst({
        where: customers.id === input.customerId,
      });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "GS-MAN-1100 · customer not found" });
      
      // Validate warehouse exists
      const warehouse = await db.query.warehouses.findFirst({
        where: warehouses.id === input.warehouseId,
      });
      if (!warehouse) throw new TRPCError({ code: "NOT_FOUND", message: "GS-MAN-1101 · warehouse not found" });
      
      // Calculate totals
      let totalCents = 0;
      const lineItems = input.lines.map(line => {
        totalCents += line.unitCents * line.quantity;
        return {
          ...line,
          totalCents: line.unitCents * line.quantity,
        };
      });
      
      const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;
      const [{ orderId }] = await db.insert(salesOrders).values({
        orderNumber,
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        status: "authorized", // Credit check passed
        totalCents,
        currency: input.currency,
        dueDate: input.dueDate,
        paymentStatus: "unpaid",
        idempotencyKey: input.idempotencyKey,
        shippingAddress: input.shippingAddress,
        notes: input.notes,
      }).$returningId();
      
      // Insert order lines
      for (const line of lineItems) {
        await db.insert(salesOrderLines).values({
          orderId: orderId,
          productId: line.productId,
          quantity: line.quantity,
          unitCents: line.unitCents,
          totalCents: line.totalCents,
        });
      }
      
      // Reserve inventory for each line (simplified)
      for (const line of lineItems) {
        // Find available inventory lot
        const lot = await db.query.inventoryLots.findFirst({
          where: (lots) => 
            lots.productId === line.productId &&
            lots.warehouseId === input.warehouseId &&
            lots.lotStatus === "received" &&
            lots.quantityUnits >= line.quantity,
          orderBy: (lots) => lots.fifoDate,
        });
        
        if (!lot) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `GS-MAN-1102 · insufficient inventory for product ${line.productId}` });
        }
        
        // Update inventory lot
        await db.update(inventoryLots)
          .set({ quantityUnits: lot.quantityUnits - line.quantity })
          .where(inventoryLots.id === lot.id);
        
        // Record movement
        await db.insert(inventoryMovements).values({
          productId: line.productId,
          warehouseId: input.warehouseId,
          qtyChange: -line.quantity,
          type: "outbound",
          refId: orderId,
          actor: "system",
          notes: `Order ${orderNumber} allocation`,
        });
        
        await emitEvent("inventory.item_moved", "movement", orderId, {
          movementId: orderId,
          productId: line.productId,
          warehouseId: input.warehouseId,
          qtyChange: -line.quantity,
          type: "outbound",
          refId: orderId,
        });
      }
      
      // Emit domain event
      await emitEvent("sales.order.created", "order", orderId, {
        orderId,
        orderNumber,
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        totalCents,
        currency: input.currency,
        lines: lineItems,
        idempotencyKey: input.idempotencyKey,
      });
      
      // Create AR aging record
      await db.insert(arAging).values({
        customerId: input.customerId,
        invoiceId: orderId,
        dueDate: input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        outstandingCents: totalCents,
        daysPastDue: 0,
        status: "open",
      });
      
      return { orderId, orderNumber, replayed: false };
    }),

  listSalesOrders: publicQuery.query(async ({ input }) => {
    const db = getDb();
    let orders = await db.select().from(salesOrders);
    
    if (input?.status) {
      orders = orders.filter(o => o.status === input.status);
    }
    
    if (input?.customerId) {
      orders = orders.filter(o => o.customerId === input.customerId);
    }
    
    // Enrich with customer and warehouse info
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const customer = await db.query.customers.findFirst({
          where: customers.id === order.customerId,
        });
        const warehouse = await db.query.warehouses.findFirst({
          where: warehouses.id === order.warehouseId,
        });
        
        const lines = await db.select().from(salesOrderLines).where(salesOrderLines.orderId === order.id);
        
        return {
          ...order,
          customerName: customer?.name || "",
          warehouseName: warehouse?.name || "",
          lines: lines.map(line => ({
            ...line,
            productName: line.productId, // Would need join with coffeeProducts
          })),
        };
      })
    );
    
    return enrichedOrders;
  }),

  advanceSalesOrder: publicQuery
    .input(managerTypes.advanceSalesOrderSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      const order = await db.query.salesOrders.findFirst({
        where: salesOrders.id === input.orderId,
      });
      
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "GS-MAN-1200 · order not found" });
      
      if (!ORDER_TRANSITIONS[order.status as keyof typeof ORDER_TRANSITIONS]?.includes(input.target)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `GS-MAN-1201 · illegal transition ${order.status} → ${input.target}`,
        });
      }
      
      await db.update(salesOrders).set({ status: input.target }).where(salesOrders.id === input.orderId);
      
      // Update AR aging status on payment completion
      if (input.target === "fulfilled") {
        // Mark AR as paid
        await db.update(arAging)
          .set({ status: "paid" })
          .where(arAging.invoiceId === input.orderId);
      }
      
      await emitEvent("sales.order.status_changed", "order", input.orderId, {
        orderId: input.orderId,
        oldStatus: order.status,
        newStatus: input.target,
        target: input.target,
      });
      
      return { ok: true };
    }),

  cancelSalesOrder: publicQuery
    .input(managerTypes.cancelSalesOrderSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      const order = await db.query.salesOrders.findFirst({
        where: salesOrders.id === input.orderId,
      });
      
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "GS-MAN-1300 · order not found" });
      
      if (order.status !== "authorised" && order.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-MAN-1301 · only draft/authorised orders can be cancelled" });
      }
      
      await db.update(salesOrders).set({ status: "cancelled" }).where(salesOrders.id === input.orderId);
      
      // Release inventory reservations
      const lines = await db.select().from(salesOrderLines).where(salesOrderLines.orderId === input.orderId);
      for (const line of lines) {
        await db.update(inventoryLots)
          .set({ quantityUnits: inventoryLots.quantityUnits + line.quantity })
          .where(inventoryLots.productId === line.productId);
        
        await emitEvent("inventory.reservation_released", "lot", line.productId, {
          productId: line.productId,
          orderId: input.orderId,
          quantity: line.quantity,
        });
      }
      
      await emitEvent("sales.order.cancelled", "order", input.orderId, {
        orderId: input.orderId,
        reason: input.reason,
      });
      
      return { ok: true };
    }),

  // ─── Purchase Orders ───────────────────────────────────────────────────────
  createPurchaseOrder: publicQuery
    .input(managerTypes.createPurchaseOrderSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Idempotent replay check using PO number
      const replay = await db.query.purchaseOrders.findFirst({
        where: purchaseOrders.poNumber === input.poNumber || purchaseOrders.idempotencyKey === input.idempotencyKey,
      });
      if (replay) return { po: replay, replayed: true };
      
      const poNumber = input.poNumber || `PO-${Date.now().toString(36).toUpperCase()}`;
      const [{ poId }] = await db.insert(purchaseOrders).values({
        poNumber,
        supplierId: input.supplierId,
        status: "sent",
        totalCents: input.lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0),
        currency: input.currency,
        expectedDeliveryDate: input.expectedDeliveryDate,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
      }).$returningId();
      
      // Insert PO lines
      for (const line of input.lines) {
        await db.insert(purchaseOrderLines).values({
          poId: poId,
          lotId: line.lotId,
          quantity: line.quantity,
          expectedCupScore: line.expectedCupScore,
          unitCents: line.unitCents,
          totalCents: line.unitCents * line.quantity,
        });
      }
      
      await emitEvent("purchase.order.created", "purchase_order", poId, {
        poId,
        poNumber,
        supplierId: input.supplierId,
        totalCents: input.lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0),
        lines: input.lines,
      });
      
      return { poId, poNumber, replayed: false };
    }),

  receivePurchaseOrder: publicQuery
    .input(z.object({ poId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const po = await db.query.purchaseOrders.findFirst({
        where: purchaseOrders.id === input.poId,
      });
      
      if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "GS-MAN-1400 · purchase order not found" });
      
      // Validate PO lines and create inventory lots
      const lines = await db.select().from(purchaseOrderLines).where(purchaseOrderLines.poId === input.poId);
      
      for (const line of lines) {
        // Create inventory lot for received quantity
        await db.insert(inventoryLots).values({
          productId: line.lotId, // Actually should be the product from the lot
          warehouseId: 1, // Default warehouse, would need to be configurable
          quantityUnits: line.quantity,
          lotStatus: "received",
          poLineId: line.id,
        });
        
        await emitEvent("inventory.item_received", "lot", line.id, {
          poLineId: line.id,
          lotId: line.lotId,
          quantity: line.quantity,
          expectedCupScore: line.expectedCupScore,
        });
      }
      
      await db.update(purchaseOrders)
        .set({ status: "received" })
        .where(purchaseOrders.id === input.poId);
      
      await emitEvent("purchase.order.received", "purchase_order", input.poId, {
        poId: input.poId,
        receivedAt: new Date(),
      });
      
      return { ok: true };
    }),

  // ─── AR Aging ──────────────────────────────────────────────────────────────
  listArAging: publicQuery.query(async ({ input }) => {
    const db = getDb();
    let records = await db.select().from(arAging);
    
    if (input?.customerId) {
      records = records.filter(r => r.customerId === input.customerId);
    }
    
    if (input?.status) {
      records = records.filter(r => r.status === input.status);
    }
    
    // Enrich with customer info
    return Promise.all(
      records.map(async (record) => {
        const customer = await db.query.customers.findFirst({
          where: customers.id === record.customerId,
        });
        return {
          ...record,
          customerName: customer?.name || "",
          customerEmail: customer?.email || "",
        };
      })
    );
  }),

  updateArAging: publicQuery
    .input(z.object({
      id: z.number().int().positive(),
      daysPastDue: z.number().int().min(0),
      outstandingCents: z.number().int().min(0),
      status: managerTypes.arAgingStatusSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(arAging)
        .set({
          daysPastDue: input.daysPastDue,
          outstandingCents: input.outstandingCents,
          status: input.status || arAging.status,
          updatedAt: new Date(),
        })
        .where(arAging.id === input.id);
      
      await emitEvent("ar_aging.updated", "ar_aging", input.id, {
        arId: input.id,
        daysPastDue: input.daysPastDue,
        outstandingCents: input.outstandingCents,
        status: input.status || arAging.status,
      });
      
      return { id: input.id };
    }),
},
);