import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  automationRules,
  campaigns,
  coffeeLots,
  cuppingSessions,
  dispatches,
  feedback,
  orderLineItems,
  orders,
  partnerPayments,
  pricingLinkClicks,
  referrals,
  roasters,
  waitlistSignups,
  warehouseExceptions,
} from "@db/schema";
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
    const [
      lots,
      roasterRows,
      orderRows,
      dispatchRows,
      eventFeed,
      lineRows,
      exceptionRows,
      paymentRows,
      cuppingRows,
      referralRows,
      clickRows,
      waitlistRows,
      feedbackRows,
    ] = await Promise.all([
      db.select().from(coffeeLots),
      db.select().from(roasters),
      db.select().from(orders),
      db.select().from(dispatches),
      recentEvents(30),
      db.select().from(orderLineItems),
      db.select().from(warehouseExceptions),
      db.select().from(partnerPayments),
      db.select().from(cuppingSessions),
      db.select().from(referrals),
      db.select().from(pricingLinkClicks),
      db.select().from(waitlistSignups),
      db.select().from(feedback),
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

    // ── Revenue time series (orders bucketed by day, cumulative delivered) ──
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const revenueByDay = new Map<string, { revenueCents: number; orders: number }>();
    for (const o of orderRows) {
      if (o.status === "cancelled") continue;
      const k = dayKey(new Date(o.createdAt));
      const cur = revenueByDay.get(k) ?? { revenueCents: 0, orders: 0 };
      cur.revenueCents += o.totalCents;
      cur.orders += 1;
      revenueByDay.set(k, cur);
    }
    const revenueSeries = [...revenueByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, ...v }));

    // ── Dispatch volume by channel ──
    const channelDist: Record<string, number> = {};
    for (const d of dispatchRows) channelDist[d.channel] = (channelDist[d.channel] ?? 0) + 1;

    // ── Order status distribution ──
    const orderStatusDist: Record<string, number> = {};
    for (const o of orderRows) orderStatusDist[o.status] = (orderStatusDist[o.status] ?? 0) + 1;

    // ── Warehouse exception stats ──
    const exceptionsByTier: Record<string, number> = { "1": 0, "2": 0, "3": 0 };
    const exceptionsByStatus: Record<string, number> = {};
    for (const e of exceptionRows) {
      exceptionsByTier[String(e.tier)] = (exceptionsByTier[String(e.tier)] ?? 0) + 1;
      exceptionsByStatus[e.status] = (exceptionsByStatus[e.status] ?? 0) + 1;
    }
    const openExceptions = exceptionRows.filter((e) => !["resolved", "closed"].includes(e.status)).length;

    // ── Partner payout totals ──
    const floorAccruedCents = paymentRows
      .filter((p) => p.paymentType === "floor")
      .reduce((s, p) => s + p.amountCents, 0);
    const revenueShareAccruedCents = paymentRows
      .filter((p) => p.paymentType === "revenue_share")
      .reduce((s, p) => s + p.amountCents, 0);
    const paidOutCents = paymentRows
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amountCents, 0);

    // ── Lot performance (lbs sold per lot, top 8) ──
    const lbsByLot = new Map<string, number>();
    for (const l of lineRows) {
      lbsByLot.set(l.lotName, (lbsByLot.get(l.lotName) ?? 0) + l.quantityLbs);
    }
    const lotPerformance = [...lbsByLot.entries()]
      .map(([lotName, lbs]) => ({ lotName, lbs }))
      .sort((a, b) => b.lbs - a.lbs)
      .slice(0, 8);

    // ── Cup score distribution (from cupping sessions + lot reference) ──
    const cupScores = cuppingRows
      .map((c) => c.totalScore)
      .filter((s): s is number => typeof s === "number");
    const scoreBuckets = [
      { band: "<75", count: 0 },
      { band: "75–79", count: 0 },
      { band: "80–84", count: 0 },
      { band: "85+", count: 0 },
    ];
    for (const s of cupScores) {
      if (s < 75) scoreBuckets[0].count++;
      else if (s < 80) scoreBuckets[1].count++;
      else if (s < 85) scoreBuckets[2].count++;
      else scoreBuckets[3].count++;
    }

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
        openExceptions,
        waitlistTotal: waitlistRows.length,
        referralsTotal: referralRows.length,
        pricingClicks: clickRows.length,
        floorAccruedCents,
        revenueShareAccruedCents,
        paidOutCents,
        avgFeedbackScore:
          feedbackRows.length > 0
            ? Math.round((feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackRows.length) * 10) / 10
            : null,
      },
      funnel: [
        { stage: "Messages sent", value: sentCount },
        { stage: "Lifecycle updates", value: dispatchRows.filter((d) => d.status === "lifecycle_updated").length },
        { stage: "Nurture halts", value: dispatchRows.filter((d) => d.status === "halted").length },
        { stage: "Conversions", value: conversions },
      ],
      revenueSeries,
      channelDist,
      orderStatusDist,
      exceptionsByTier,
      exceptionsByStatus,
      lotPerformance,
      scoreBuckets,
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
