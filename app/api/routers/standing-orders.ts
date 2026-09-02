// Recurring B2B subscriptions — §3.6.
//
// A standing order is a template plus a cursor (nextRunOn), not a queue of
// future invoices. Generation claims a standing_order_cycles row before it
// issues anything, and that row is unique on (standingOrderId, periodStart), so
// running the job twice on the same day cannot bill a café twice.
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { standingOrderCycles, standingOrders } from "@db/schema";
import { minorFromDb, SUPPORTED_CURRENCIES } from "@contracts/money";
import { emitEvent } from "../engine";
import { getFlags } from "../services/flags";
import {
  createStandingOrder,
  generateDueInvoices,
} from "../services/payments/standing-orders";

const asOf = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const standingOrdersRouter = createRouter({
  list: rbacProcedure("standingOrders.list")
    .input(
      z
        .object({
          counterpartyId: z.number().int().positive().optional(),
          status: z.enum(["active", "paused", "ended"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const conditions = [isNull(standingOrders.deletedAt)];
      if (input?.counterpartyId)
        conditions.push(
          eq(standingOrders.counterpartyId, input.counterpartyId)
        );
      if (input?.status)
        conditions.push(eq(standingOrders.status, input.status));
      const rows = await getDb()
        .select()
        .from(standingOrders)
        .where(and(...conditions))
        .orderBy(standingOrders.nextRunOn)
        .limit(200);
      return rows.map(row => ({
        ...row,
        subtotalMinor: minorFromDb(row.subtotalMinor),
        shippingMinor: minorFromDb(row.shippingMinor),
      }));
    }),

  byId: rbacProcedure("standingOrders.byId")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const order = await db.query.standingOrders.findFirst({
        where: eq(standingOrders.id, input.id),
      });
      if (!order)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-SUB-1003 · standing order not found",
        });
      const cycles = await db
        .select()
        .from(standingOrderCycles)
        .where(eq(standingOrderCycles.standingOrderId, input.id))
        .orderBy(desc(standingOrderCycles.periodStart))
        .limit(50);
      return {
        ...order,
        subtotalMinor: minorFromDb(order.subtotalMinor),
        shippingMinor: minorFromDb(order.shippingMinor),
        cycles,
      };
    }),

  create: rbacProcedure("standingOrders.create")
    .input(
      z.object({
        counterpartyId: z.number().int().positive(),
        reference: z.string().min(1).max(40),
        cadence: z.enum(["weekly", "biweekly", "monthly"]),
        /** 1–28 monthly (never 29–31: February would silently skip), 1–7 weekly. */
        anchorDay: z.number().int().min(1).max(28),
        currency: z.enum(SUPPORTED_CURRENCIES),
        subtotalMinor: z.bigint().positive(),
        vatRateBp: z.number().int().min(0).max(10_000).default(0),
        shippingMinor: z.bigint().nonnegative().default(0n),
        paymentTermDays: z.number().int().min(0).max(180).default(14),
        paymentMethodId: z.number().int().positive().nullish(),
        lotId: z.number().int().positive().nullish(),
        notes: z.string().max(500).default(""),
        startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endsOn: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      createStandingOrder({ ...input, createdByUserId: ctx.user.id })
    ),

  setStatus: rbacProcedure("standingOrders.setStatus")
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["active", "paused", "ended"]),
        reason: z.string().max(255).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .update(standingOrders)
        .set({ status: input.status })
        .where(eq(standingOrders.id, input.id));
      await emitEvent(
        "subscription.status_changed",
        "standing_order",
        input.id,
        {
          standingOrderId: input.id,
          status: input.status,
          reason: input.reason,
          byUserId: ctx.user.id,
        }
      );
      return { id: input.id, status: input.status };
    }),

  /**
   * Issue invoices for every cycle due on or before `asOf`. Safe to call twice;
   * the cycle claim absorbs the second run. `dryRun` shows the work without
   * issuing anything.
   */
  generate: rbacProcedure("standingOrders.generate")
    .input(z.object({ asOf, dryRun: z.boolean().default(false) }).optional())
    .mutation(async ({ ctx, input }) => {
      const flags = await getFlags();
      if (!flags.standingOrders && !input?.dryRun) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GS-SUB-1004 · standing orders are disabled",
        });
      }
      return generateDueInvoices({
        asOf: input?.asOf,
        userId: ctx.user.id,
        dryRun: input?.dryRun ?? false,
      });
    }),
});
