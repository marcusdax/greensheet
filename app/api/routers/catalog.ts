import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { coffeeLots } from "@db/schema";
import { emitEvent } from "../engine";

export const catalogRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(coffeeLots).orderBy(desc(coffeeLots.cupScore));
  }),

  register: publicQuery
    .input(
      z.object({
        name: z.string().min(2),
        origin: z.string().min(2),
        region: z.string().min(2),
        varietal: z.string().min(2),
        processMethod: z.string().min(2),
        elevationMeters: z.number().int().min(0).max(3000),
        cupScore: z.number().min(0).max(100),
        pricePerLbCents: z.number().int().positive(),
        costPerLbCents: z.number().int().positive(),
        availableLbs: z.number().int().min(0),
        totalProductionLbs: z.number().int().min(0),
        flavorNotes: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(coffeeLots).values(input).$returningId();
      const lot = await db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, id) });
      await emitEvent("catalog.lot_registered", "lot", id, {
        lotId: id,
        origin: input.origin,
        cupScore: input.cupScore,
        pricePerLbCents: input.pricePerLbCents,
        availableQuantityLbs: input.availableLbs,
      });
      return lot;
    }),

  adjustPrice: publicQuery
    .input(
      z.object({
        lotId: z.number(),
        newPriceCents: z.number().int().positive(),
        reason: z.string().min(2),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const lot = await db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, input.lotId) });
      if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CAT-1000 · lot not found" });
      await db
        .update(coffeeLots)
        .set({ pricePerLbCents: input.newPriceCents })
        .where(eq(coffeeLots.id, input.lotId));
      await emitEvent("catalog.price_changed", "lot", lot.id, {
        lotId: lot.id,
        oldPricePerLbCents: lot.pricePerLbCents,
        newPricePerLbCents: input.newPriceCents,
        reason: input.reason,
      });
      if (input.newPriceCents < lot.costPerLbCents) {
        await emitEvent("catalog.margin_floor_breached", "lot", lot.id, {
          lotId: lot.id,
          pricePerLbCents: input.newPriceCents,
          costPerLbCents: lot.costPerLbCents,
        });
      }
      return db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, input.lotId) });
    }),

  retire: publicQuery
    .input(z.object({ lotId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const lot = await db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, input.lotId) });
      if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CAT-1000 · lot not found" });
      await db.update(coffeeLots).set({ status: "retired" }).where(eq(coffeeLots.id, input.lotId));
      await emitEvent("catalog.lot_retired", "lot", lot.id, { lotId: lot.id, name: lot.name });
      return { ok: true };
    }),
});
