import { z } from "zod";
import { analystProcedure, createRouter } from "../middleware";
import { getDb } from "../queries/connection";
import {
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
import { recentEvents } from "../engine";
import { CHURN_HAZARD_THRESHOLD } from "@contracts/constants";

// Aggregations run in TS over full table reads, matching house style elsewhere
// in the API. Fine at seed scale; the upgrade path is SQL GROUP BY.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Monday 00:00 UTC of the week containing d — stable cohort bucketing.
function weekStart(d: Date): number {
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay() || 7;
  return utc - (day - 1) * 24 * 60 * 60 * 1000;
}

function isoWeekLabel(weekStartMs: number): string {
  // Thursday of the week determines the ISO year/week.
  const thursday = new Date(weekStartMs + 3 * 24 * 60 * 60 * 1000);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const analyticsRouter = createRouter({
  // ── Temporal demand heatmap — orders by day-of-week × hour ────────────────
  demandHeatmap: analystProcedure.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ createdAt: orders.createdAt, totalCents: orders.totalCents, status: orders.status })
      .from(orders);
    const grid = new Map<string, { dow: number; hour: number; orders: number; revenueCents: number }>();
    for (const o of rows) {
      if (o.status === "cancelled") continue;
      const d = new Date(o.createdAt);
      const dow = d.getDay(); // 0 = Sunday, local server time
      const hour = d.getHours();
      const key = `${dow}:${hour}`;
      const cell = grid.get(key) ?? { dow, hour, orders: 0, revenueCents: 0 };
      cell.orders += 1;
      cell.revenueCents += o.totalCents;
      grid.set(key, cell);
    }
    const cells = [...grid.values()];
    return { cells, maxOrders: cells.reduce((m, c) => Math.max(m, c.orders), 0) };
  }),

  // ── Retention cohorts — cohort = ISO week of a roaster's first order ──────
  retentionCohorts: analystProcedure.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ roasterId: orders.roasterId, createdAt: orders.createdAt, status: orders.status })
      .from(orders);

    const byRoaster = new Map<number, number[]>(); // roasterId → order timestamps
    for (const o of rows) {
      if (o.status === "cancelled") continue;
      const list = byRoaster.get(o.roasterId) ?? [];
      list.push(new Date(o.createdAt).getTime());
      byRoaster.set(o.roasterId, list);
    }

    const MAX_OFFSET = 7;
    type Cohort = { start: number; members: number; active: Map<number, Set<number>> };
    const cohorts = new Map<number, Cohort>();
    const repurchaseGaps: number[] = [];

    for (const [roasterId, stamps] of byRoaster) {
      stamps.sort((a, b) => a - b);
      for (let i = 1; i < stamps.length; i++) {
        repurchaseGaps.push((stamps[i] - stamps[i - 1]) / 86400000);
      }
      const firstWeek = weekStart(new Date(stamps[0]));
      const cohort = cohorts.get(firstWeek) ?? { start: firstWeek, members: 0, active: new Map() };
      cohort.members += 1;
      cohorts.set(firstWeek, cohort);
      for (const ts of stamps) {
        const offset = Math.floor((weekStart(new Date(ts)) - firstWeek) / WEEK_MS);
        if (offset < 0 || offset > MAX_OFFSET) continue;
        const set = cohort.active.get(offset) ?? new Set<number>();
        set.add(roasterId);
        cohort.active.set(offset, set);
      }
    }

    const result = [...cohorts.values()]
      .sort((a, b) => a.start - b.start)
      .map((c) => ({
        cohortWeek: isoWeekLabel(c.start),
        size: c.members,
        cells: Array.from({ length: MAX_OFFSET + 1 }, (_, offset) => {
          const activeCount = c.active.get(offset)?.size ?? 0;
          return { offset, activeCount, pct: c.members > 0 ? activeCount / c.members : 0 };
        }),
      }));

    return { cohorts: result, medianRepurchaseDays: median(repurchaseGaps) };
  }),

  // ── Lot loyalty matrix — volume × reorder rate per lot ────────────────────
  lotLoyalty: analystProcedure.query(async () => {
    const db = getDb();
    const [lines, orderRows] = await Promise.all([
      db.select().from(orderLineItems),
      db.select({ id: orders.id, roasterId: orders.roasterId, status: orders.status }).from(orders),
    ]);
    const orderMap = new Map(orderRows.map((o) => [o.id, o]));

    type LotStats = {
      lotId: number;
      lotName: string;
      totalLbs: number;
      revenueCents: number;
      ordersPerBuyer: Map<number, number>;
    };
    const byLot = new Map<number, LotStats>();
    for (const line of lines) {
      const order = orderMap.get(line.orderId);
      if (!order || order.status === "cancelled") continue;
      const stats =
        byLot.get(line.lotId) ??
        ({ lotId: line.lotId, lotName: line.lotName, totalLbs: 0, revenueCents: 0, ordersPerBuyer: new Map() } as LotStats);
      stats.totalLbs += line.quantityLbs;
      stats.revenueCents += line.quantityLbs * line.unitPriceCents;
      stats.ordersPerBuyer.set(order.roasterId, (stats.ordersPerBuyer.get(order.roasterId) ?? 0) + 1);
      byLot.set(line.lotId, stats);
    }

    return [...byLot.values()].map((s) => {
      const distinctBuyers = s.ordersPerBuyer.size;
      const repeatBuyers = [...s.ordersPerBuyer.values()].filter((n) => n >= 2).length;
      return {
        lotId: s.lotId,
        lotName: s.lotName,
        totalLbs: s.totalLbs,
        revenueCents: s.revenueCents,
        distinctBuyers,
        reorderRate: distinctBuyers > 0 ? repeatBuyers / distinctBuyers : 0,
      };
    });
  }),

  // ── Churn watchlist — 30+ days inactive OR hazard ≥ threshold ─────────────
  churnWatchlist: analystProcedure.query(async () => {
    const db = getDb();
    const [roasterRows, orderRows] = await Promise.all([
      db.select().from(roasters),
      db
        .select({ roasterId: orders.roasterId, createdAt: orders.createdAt, status: orders.status })
        .from(orders),
    ]);
    const lastOrderAt = new Map<number, number>();
    for (const o of orderRows) {
      if (o.status === "cancelled") continue;
      const ts = new Date(o.createdAt).getTime();
      if (ts > (lastOrderAt.get(o.roasterId) ?? 0)) lastOrderAt.set(o.roasterId, ts);
    }

    const now = Date.now();
    const INACTIVE_DAYS = 30;
    return roasterRows
      .filter((r) => r.lifecycleStatus !== "churned")
      .map((r) => {
        const activity = r.lastActivityAt ? new Date(r.lastActivityAt).getTime() : null;
        const daysInactive = activity != null ? Math.floor((now - activity) / 86400000) : null;
        return {
          id: r.id,
          roasterName: r.roasterName,
          lifecycleStatus: r.lifecycleStatus,
          churnRiskScore: r.churnRiskScore,
          ltvCents: r.ltvCents,
          daysInactive,
          lastOrderAt: lastOrderAt.get(r.id) ?? null,
          flagged:
            (daysInactive != null && daysInactive >= INACTIVE_DAYS) ||
            r.churnRiskScore >= CHURN_HAZARD_THRESHOLD,
        };
      })
      .filter((r) => r.flagged)
      .sort((a, b) => b.churnRiskScore - a.churnRiskScore);
  }),

  // ── Existing dashboard + event feed (moved verbatim from campaigns.ts) ────
  dashboard: analystProcedure.query(async () => {
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

  events: analystProcedure.input(z.object({ limit: z.number().default(50) })).query(async ({ input }) => {
    return recentEvents(input.limit);
  }),
});
