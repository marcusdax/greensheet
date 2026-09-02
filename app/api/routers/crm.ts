import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, analystProcedure, staffProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { churnInterventions, orders, roasters } from "@db/schema";
import { emitEvent } from "../engine";
import { LIFECYCLE_STAGES, CHURN_HAZARD_THRESHOLD } from "@contracts/constants";

export const crmRouter = createRouter({
  list: analystProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(roasters).orderBy(desc(roasters.lastActivityAt));
    const interventions = await db.select().from(churnInterventions).orderBy(desc(churnInterventions.id));
    const orderCounts = await db
      .select({ roasterId: orders.roasterId, count: sql<number>`count(*)` })
      .from(orders)
      .groupBy(orders.roasterId);
    const countMap = new Map(orderCounts.map((r) => [r.roasterId, Number(r.count)]));
    return rows.map((r) => ({
      ...r,
      orderCount: countMap.get(r.id) ?? 0,
      interventions: interventions.filter((i) => i.roasterId === r.id),
    }));
  }),

  register: staffProcedure
    .input(
      z.object({
        roasterName: z.string().min(2),
        contactName: z.string().min(2),
        email: z.string().email(),
        companySize: z.enum(["micro", "small", "medium", "large"]).default("small"),
        segment: z.string().default("prospect"),
        referralCode: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(roasters).values(input).$returningId();
      await emitEvent("crm.roaster_registered", "roaster", id, {
        roasterId: id,
        segment: input.segment,
        referralCode: input.referralCode ?? null,
      });
      return db.query.roasters.findFirst({ where: eq(roasters.id, id) });
    }),

  // WhatsApp channel opt-in — E.164 number stored on the roaster record.
  setWhatsapp: staffProcedure
    .input(z.object({ roasterId: z.number(), whatsappNumber: z.string().min(7).max(40) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, input.roasterId) });
      if (!roaster) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CRM-1000 · roaster not found" });
      await db
        .update(roasters)
        .set({ whatsappNumber: input.whatsappNumber, lastActivityAt: new Date() })
        .where(eq(roasters.id, input.roasterId));
      await emitEvent("crm.engagement_recorded", "roaster", input.roasterId, {
        roasterId: input.roasterId,
        engagementType: "whatsapp_opt_in",
      });
      return { ok: true };
    }),

  setLifecycle: staffProcedure
    .input(z.object({ roasterId: z.number(), stage: z.enum(LIFECYCLE_STAGES) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, input.roasterId) });
      if (!roaster) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CRM-1000 · roaster not found" });
      await db
        .update(roasters)
        .set({ lifecycleStatus: input.stage, lastActivityAt: new Date() })
        .where(eq(roasters.id, input.roasterId));
      await emitEvent("crm.engagement_recorded", "roaster", input.roasterId, {
        roasterId: input.roasterId,
        engagementType: "lifecycle_transition",
        to: input.stage,
      });
      return { ok: true };
    }),

  startIntervention: staffProcedure
    .input(
      z.object({
        roasterId: z.number(),
        interventionType: z.enum(["email_campaign", "sales_call", "discount_offer", "survey"]),
        reason: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(churnInterventions).values({ ...input, outcome: "pending" });
      await emitEvent("crm.intervention_started", "roaster", input.roasterId, input);
      return { ok: true };
    }),

  resolveIntervention: staffProcedure
    .input(z.object({ interventionId: z.number(), outcome: z.enum(["retained", "churned"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const intervention = await db.query.churnInterventions.findFirst({
        where: eq(churnInterventions.id, input.interventionId),
      });
      if (!intervention) throw new TRPCError({ code: "NOT_FOUND", message: "intervention not found" });
      await db
        .update(churnInterventions)
        .set({ outcome: input.outcome })
        .where(eq(churnInterventions.id, input.interventionId));
      if (input.outcome === "retained") {
        await db
          .update(roasters)
          .set({ churnRiskScore: 0.25, lifecycleStatus: "active", lastActivityAt: new Date() })
          .where(eq(roasters.id, intervention.roasterId));
        await emitEvent("crm.roaster_retained", "roaster", intervention.roasterId, {
          roasterId: intervention.roasterId,
          interventionId: input.interventionId,
        });
      } else {
        await db
          .update(roasters)
          .set({ lifecycleStatus: "churned", churnRiskScore: 1 })
          .where(eq(roasters.id, intervention.roasterId));
        await emitEvent("crm.roaster_churned", "roaster", intervention.roasterId, {
          roasterId: intervention.roasterId,
          interventionId: input.interventionId,
        });
      }
      return { ok: true };
    }),

  // Heuristic re-score: inactivity-driven hazard, threshold 0.70 (Cox model stand-in).
  rescoreChurn: staffProcedure.mutation(async () => {
    const db = getDb();
    const rows = await db.select().from(roasters);
    const now = Date.now();
    let flagged = 0;
    for (const r of rows) {
      if (r.lifecycleStatus === "churned") continue;
      const idleDays = (now - new Date(r.lastActivityAt).getTime()) / 86_400_000;
      let score = r.churnRiskScore;
      if (r.lifecycleStatus === "needs_attention") score = Math.max(score, 0.72);
      else if (idleDays > 30) score = 0.78;
      else if (idleDays > 14) score = 0.5;
      else score = Math.min(score, 0.3);
      if (score !== r.churnRiskScore) {
        await db.update(roasters).set({ churnRiskScore: score }).where(eq(roasters.id, r.id));
        if (score >= CHURN_HAZARD_THRESHOLD && r.churnRiskScore < CHURN_HAZARD_THRESHOLD) {
          flagged++;
          await emitEvent("crm.churn_risk_detected", "roaster", r.id, {
            roasterId: r.id,
            riskScore: score,
            modelVersion: "heuristic-v1",
            topFeatures: ["days_since_last_activity"],
          });
        }
      }
    }
    return { flagged };
  }),
});
