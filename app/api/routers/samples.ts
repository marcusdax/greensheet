import { z } from "zod";
import { eq, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { coffeeLots, feedback, roasters, sampleKitItems, sampleKits } from "@db/schema";
import { emitEvent } from "../engine";
import { KIT_TRANSITIONS, MAX_ACTIVE_KITS_PER_ROASTER, type KitStatus } from "@contracts/constants";

const ACTIVE_KIT_STATUSES: KitStatus[] = ["requested", "assembling", "shipped", "delivered"];

export const samplesRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const kits = await db.select().from(sampleKits).orderBy(desc(sampleKits.id));
    const items = await db.select().from(sampleKitItems);
    const fb = await db.select().from(feedback);
    const rosterRows = await db.select().from(roasters);
    const rosterMap = new Map(rosterRows.map((r) => [r.id, r.roasterName]));
    return kits.map((k) => ({
      ...k,
      roasterName: rosterMap.get(k.roasterId) ?? "—",
      items: items.filter((i) => i.kitId === k.id),
      feedback: fb.find((f) => f.kitId === k.id) ?? null,
    }));
  }),

  request: publicQuery
    .input(
      z.object({
        roasterId: z.number(),
        lotIds: z.array(z.number()).min(1).max(5),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, input.roasterId) });
      if (!roaster) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CRM-1000 · roaster not found" });

      // Invariant: max 2 active kits per roaster.
      const existing = await db.select().from(sampleKits).where(eq(sampleKits.roasterId, input.roasterId));
      const activeCount = existing.filter((k) => ACTIVE_KIT_STATUSES.includes(k.status)).length;
      if (activeCount >= MAX_ACTIVE_KITS_PER_ROASTER) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `GS-SMP-1001 · roaster already has ${MAX_ACTIVE_KITS_PER_ROASTER} active kits`,
        });
      }

      const lots = await db.select().from(coffeeLots).where(inArray(coffeeLots.id, input.lotIds));
      if (lots.length !== input.lotIds.length || lots.some((l) => l.status !== "active")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-SMP-1002 · all kit lots must be active catalog lots" });
      }

      const [{ id }] = await db.insert(sampleKits).values({ roasterId: input.roasterId }).$returningId();
      // Snapshot lot facts at assembly time — kit quotes never follow live pricing.
      await db.insert(sampleKitItems).values(
        lots.map((l) => ({
          kitId: id,
          lotId: l.id,
          lotName: l.name,
          origin: l.origin,
          processMethod: l.processMethod,
          cupScoreSnapshot: l.cupScore,
          pricePerLbCentsSnapshot: l.pricePerLbCents,
        })),
      );
      await db.update(roasters).set({ lastActivityAt: new Date() }).where(eq(roasters.id, input.roasterId));
      await emitEvent("samples.kit_requested", "sample_kit", id, {
        kitId: id,
        roasterId: input.roasterId,
        lotIds: input.lotIds,
      });
      return { kitId: id };
    }),

  advance: publicQuery
    .input(
      z.object({
        kitId: z.number(),
        target: z.enum(["assembling", "shipped", "delivered", "exception", "requested"] as const),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const kit = await db.query.sampleKits.findFirst({ where: eq(sampleKits.id, input.kitId) });
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "GS-SMP-1000 · kit not found" });
      const allowed = KIT_TRANSITIONS[kit.status];
      if (!allowed.includes(input.target)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `GS-SMP-1003 · illegal transition ${kit.status} → ${input.target}`,
        });
      }

      const patch: Partial<typeof sampleKits.$inferInsert> = { status: input.target };
      if (input.target === "shipped") {
        patch.trackingNumber = `GS-${String(kit.id).padStart(6, "0")}-EXP`;
        patch.shippedAt = new Date();
      }
      if (input.target === "delivered") patch.deliveredAt = new Date();
      await db.update(sampleKits).set(patch).where(eq(sampleKits.id, input.kitId));
      await db.update(roasters).set({ lastActivityAt: new Date() }).where(eq(roasters.id, kit.roasterId));

      if (input.target === "delivered") {
        // ⚠ exact event string — contract with automation_rules.trigger_event
        await emitEvent("sample_kit.delivered", "sample_kit", kit.id, {
          kitId: kit.id,
          roasterId: kit.roasterId,
          deliveredAt: new Date().toISOString(),
        });
      } else {
        const evt =
          input.target === "shipped"
            ? "samples.kit_shipped"
            : input.target === "exception"
              ? "samples.kit_exception"
              : "samples.kit_assembled";
        await emitEvent(evt, "sample_kit", kit.id, { kitId: kit.id, roasterId: kit.roasterId });
      }
      return { ok: true };
    }),

  submitFeedback: publicQuery
    .input(
      z.object({
        kitId: z.number(),
        rating: z.number().int().min(1).max(5),
        notes: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const kit = await db.query.sampleKits.findFirst({ where: eq(sampleKits.id, input.kitId) });
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "GS-SMP-1000 · kit not found" });
      if (kit.status !== "delivered") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-SMP-1004 · feedback requires a delivered kit" });
      }
      const existing = await db.query.feedback.findFirst({ where: eq(feedback.kitId, input.kitId) });
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-SMP-1005 · feedback already submitted for this kit" });
      }
      await db.insert(feedback).values({
        kitId: input.kitId,
        roasterId: kit.roasterId,
        rating: input.rating,
        notes: input.notes,
      });
      await db.update(sampleKits).set({ status: "feedback_received" }).where(eq(sampleKits.id, input.kitId));
      await db.update(roasters).set({ lastActivityAt: new Date() }).where(eq(roasters.id, kit.roasterId));
      // ⚠ exact event string — triggers COF-002 / COF-003 in the policy engine
      await emitEvent("feedback.submitted", "sample_kit", kit.id, {
        kitId: kit.id,
        roasterId: kit.roasterId,
        rating: input.rating,
        notes: input.notes,
      });
      return { ok: true };
    }),
});
