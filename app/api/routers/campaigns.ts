import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { automationRules, campaigns, coffeeLots, dispatches, orders, roasters } from "@db/schema";
import { emitEvent, recentEvents } from "../engine";

export const campaignsRouter = createRouter({
  overview: publicQuery.query(async () => {
    const db = getDb();
    const campaignRows = await db.select().from(campaigns);
    const rules = await db.select().from(automationRules).orderBy(automationRules.ruleCode);
    const counts = await db
      .select({ ruleCode: dispatches.ruleCode, count: sql<number>`count(*)` })
      .from(dispatches)
      .groupBy(dispatches.ruleCode);
    const countMap = new Map(counts.map((c) => [c.ruleCode, Number(c.count)]));
    return campaignRows.map((c) => ({
      ...c,
      rules: rules
        .filter((r) => r.campaignId === c.id)
        .map((r) => ({ ...r, dispatchCount: countMap.get(r.ruleCode) ?? 0 })),
    }));
  }),

  dispatches: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(dispatches).orderBy(desc(dispatches.id)).limit(100);
    const rosterRows = await db.select().from(roasters);
    const rosterMap = new Map(rosterRows.map((r) => [r.id, r.roasterName]));
    return rows.map((d) => ({ ...d, roasterName: rosterMap.get(d.roasterId) ?? "—" }));
  }),

  toggleRule: publicQuery
    .input(z.object({ ruleCode: z.string(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rule = await db.query.automationRules.findFirst({
        where: eq(automationRules.ruleCode, input.ruleCode),
      });
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CMP-1000 · rule not found" });
      await db
        .update(automationRules)
        .set({ active: input.active })
        .where(eq(automationRules.id, rule.id));
      await emitEvent("campaigns.rule_toggled", "rule", rule.ruleCode, input);
      return { ok: true };
    }),
});

export const analyticsRouter = createRouter({
  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const [lots, roasterRows, orderRows, dispatchRows, eventFeed] = await Promise.all([
      db.select().from(coffeeLots),
      db.select().from(roasters),
      db.select().from(orders),
      db.select().from(dispatches),
      recentEvents(30),
    ]);

    const deliveredRevenueCents = orderRows
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + o.totalCents, 0);
    const pipelineCents = orderRows
      .filter((o) => ["pending", "processing", "shipped"].includes(o.status))
      .reduce((s, o) => s + o.totalCents, 0);

    const lifecycleDist: Record<string, number> = {};
    for (const r of roasterRows) lifecycleDist[r.lifecycleStatus] = (lifecycleDist[r.lifecycleStatus] ?? 0) + 1;

    const sentCount = dispatchRows.filter((d) => d.status === "sent").length;
    const conversions = dispatchRows.filter((d) => d.status === "converted").length;

    return {
      kpis: {
        activeLots: lots.filter((l) => l.status === "active").length,
        totalRoasters: roasterRows.length,
        totalOrders: orderRows.length,
        deliveredRevenueCents,
        pipelineCents,
        messagesSent: sentCount,
        conversions,
        highRisk: roasterRows.filter((r) => r.churnRiskScore >= 0.7 && r.lifecycleStatus !== "churned").length,
      },
      funnel: [
        { stage: "Messages sent", value: sentCount },
        { stage: "Lifecycle updates", value: dispatchRows.filter((d) => d.status === "lifecycle_updated").length },
        { stage: "Nurture halts", value: dispatchRows.filter((d) => d.status === "halted").length },
        { stage: "Conversions", value: conversions },
      ],
      lifecycleDist,
      churnRiskList: roasterRows
        .filter((r) => r.lifecycleStatus !== "churned")
        .sort((a, b) => b.churnRiskScore - a.churnRiskScore)
        .slice(0, 6)
        .map((r) => ({ id: r.id, roasterName: r.roasterName, churnRiskScore: r.churnRiskScore, lifecycleStatus: r.lifecycleStatus })),
      events: eventFeed,
    };
  }),

  events: publicQuery.input(z.object({ limit: z.number().default(50) })).query(async ({ input }) => {
    return recentEvents(input.limit);
  }),
});
