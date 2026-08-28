import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { coffeeLots, orderLineItems, orders, roasters } from "@db/schema";
import { emitEvent } from "../engine";
import { ORDER_TRANSITIONS, FLAT_SHIPPING_CENTS } from "@contracts/constants";

export const ordersRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(orders).orderBy(desc(orders.id));
    const lines = await db.select().from(orderLineItems);
    const rosterRows = await db.select().from(roasters);
    const rosterMap = new Map(rosterRows.map((r) => [r.id, r.roasterName]));
    return rows.map((o) => ({
      ...o,
      roasterName: rosterMap.get(o.roasterId) ?? "—",
      lines: lines.filter((l) => l.orderId === o.id),
    }));
  }),

  // CreateOrder — Idempotency-Key required; duplicate submissions return the
  // original order, never a second charge. Reservation is atomic with creation.
  create: publicQuery
    .input(
      z.object({
        roasterId: z.number(),
        lotId: z.number(),
        quantityLbs: z.number().int().positive(),
        idempotencyKey: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Idempotent replay
      const replay = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, input.idempotencyKey),
      });
      if (replay) return { order: replay, replayed: true };

      const lot = await db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, input.lotId) });
      if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CAT-1000 · lot not found" });
      if (lot.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-CAT-1002 · retired lots reject reservations" });
      }
      if (lot.availableLbs < input.quantityLbs) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-CAT-1001 · InsufficientInventory" });
      }
      const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, input.roasterId) });
      if (!roaster) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CRM-1000 · roaster not found" });

      const prior = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(eq(orders.roasterId, input.roasterId));
      const firstOrder = Number(prior[0]?.count ?? 0) === 0;

      const totalCents = input.quantityLbs * lot.pricePerLbCents + FLAT_SHIPPING_CENTS;
      const orderNumber = `GS-ORD-${Date.now().toString(36).toUpperCase()}`;

      const [{ id: orderId }] = await db
        .insert(orders)
        .values({
          orderNumber,
          roasterId: input.roasterId,
          status: "processing", // payment authorized (simulated) → processing
          totalCents,
          firstOrder,
          idempotencyKey: input.idempotencyKey,
        })
        .$returningId();

      await db.insert(orderLineItems).values({
        orderId,
        lotId: lot.id,
        lotName: lot.name,
        quantityLbs: input.quantityLbs,
        unitPriceCents: lot.pricePerLbCents,
      });
      // P-01 · ReserveInventory (saga step) — atomic decrement
      await db
        .update(coffeeLots)
        .set({ availableLbs: lot.availableLbs - input.quantityLbs })
        .where(eq(coffeeLots.id, lot.id));
      // Buyer becomes active on first purchase
      await db
        .update(roasters)
        .set({ lifecycleStatus: "active", lastActivityAt: new Date() })
        .where(eq(roasters.id, input.roasterId));

      const payload = {
        orderId,
        orderNumber,
        roasterId: input.roasterId,
        firstOrder,
        totalCents,
        lineItems: [{ lotId: lot.id, quantityLbs: input.quantityLbs, unitPriceCents: lot.pricePerLbCents }],
      };
      await emitEvent("order.created", "order", orderId, payload);
      await emitEvent("catalog.inventory_reserved", "lot", lot.id, {
        lotId: lot.id,
        orderId,
        quantityLbs: input.quantityLbs,
      });
      await emitEvent("order.processed", "order", orderId, { ...payload, invoiceNumber: `INV-${orderNumber}` });

      const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
      return { order, replayed: false };
    }),

  advance: publicQuery
    .input(z.object({ orderId: z.number(), target: z.enum(["shipped", "delivered", "cancelled"] as const) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const order = await db.query.orders.findFirst({ where: eq(orders.id, input.orderId) });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "GS-ORD-1000 · order not found" });
      if (!ORDER_TRANSITIONS[order.status].includes(input.target)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `GS-ORD-1001 · illegal transition ${order.status} → ${input.target}`,
        });
      }

      await db.update(orders).set({ status: input.target }).where(eq(orders.id, input.orderId));

      if (input.target === "cancelled") {
        // P-02 · compensation: release reservation back to the lot
        const lines = await db.select().from(orderLineItems).where(eq(orderLineItems.orderId, order.id));
        for (const line of lines) {
          await db
            .update(coffeeLots)
            .set({ availableLbs: sql`${coffeeLots.availableLbs} + ${line.quantityLbs}` })
            .where(eq(coffeeLots.id, line.lotId));
          await emitEvent("catalog.reservation_released", "lot", line.lotId, {
            lotId: line.lotId,
            orderId: order.id,
            quantityLbs: line.quantityLbs,
          });
        }
        await emitEvent("order.cancelled", "order", order.id, { orderId: order.id });
        return { ok: true };
      }

      await emitEvent(`order.${input.target}`, "order", order.id, {
        orderId: order.id,
        roasterId: order.roasterId,
        totalCents: order.totalCents,
      });

      if (input.target === "delivered") {
        // P-09 · order.delivered → recalculate discounted LTV (simple margin model)
        const totals = await db
          .select({ sum: sql<number>`coalesce(sum(${orders.totalCents}),0)` })
          .from(orders)
          .where(eq(orders.roasterId, order.roasterId));
        const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, order.roasterId) });
        if (roaster) {
          const ltvCents = Math.max(0, Number(totals[0]?.sum ?? 0) - roaster.cacCents);
          await db
            .update(roasters)
            .set({ ltvCents, lastActivityAt: new Date() })
            .where(eq(roasters.id, order.roasterId));
          await emitEvent("crm.ltv_recalculated", "roaster", roaster.id, {
            roasterId: roaster.id,
            ltvCents,
          });
        }
      }
      return { ok: true };
    }),
});
