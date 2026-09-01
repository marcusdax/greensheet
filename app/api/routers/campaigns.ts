import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, staffProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { automationRules, campaigns, dispatches, roasters } from "@db/schema";
import { emitEvent } from "../engine";

export const campaignsRouter = createRouter({
  overview: staffProcedure.query(async () => {
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

  dispatches: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(dispatches).orderBy(desc(dispatches.id)).limit(100);
    const rosterRows = await db.select().from(roasters);
    const rosterMap = new Map(rosterRows.map((r) => [r.id, r.roasterName]));
    return rows.map((d) => ({ ...d, roasterName: rosterMap.get(d.roasterId) ?? "—" }));
  }),

  toggleRule: staffProcedure
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
