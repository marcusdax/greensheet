// Warehouse context: exception detection, containment & escalation
// (warehouse runbooks 1–7: seal check, weight/moisture variance, quality
// anomaly, partial compromise, equipment failure, customs, escalation).
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, staffProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import {
  warehouseExceptions,
  exceptionEvents,
  coffeeLots,
} from "@db/schema";
import { emitEvent } from "../engine";
import {
  TIER_SLA_HOURS,
  WEIGHT_VARIANCE_TOLERANCE,
  MOISTURE_MIN,
  MOISTURE_MAX,
  CUPPING_TOLERANCE,
} from "@contracts/constants";

type ExceptionStatus = "open" | "hard_hold" | "quarantine" | "investigating" | "resolved" | "closed";

// ── Decision-tree classifiers (pure functions, mirror the runbook trees) ─────

/** Runbook 1 seal check → tier. */
export function classifySealCheck(input: {
  sealIntact: boolean;
  serialMatches: boolean;
  originPhotosMatch: boolean;
}): { tier: number; label: string } {
  if (!input.sealIntact)
    return { tier: 3, label: "Seal broken / re-stitched / missing — chain compromise, hard hold" };
  if (!input.serialMatches)
    return { tier: 1, label: "Seal serial mismatch — documentation variance" };
  if (!input.originPhotosMatch)
    return { tier: 1, label: "Origin photo mismatch — escalate to supervisor before opening" };
  return { tier: 0, label: "PASS — proceed to weight/moisture" };
}

/** Runbook 2 weight & moisture → tier. */
export function classifyWeightMoisture(input: {
  expectedLbs: number;
  receivedLbs: number;
  moisturePct: number;
}): { tier: number; label: string; variancePct: number } {
  const variancePct =
    input.expectedLbs > 0
      ? Math.abs(input.receivedLbs - input.expectedLbs) / input.expectedLbs
      : 0;
  const moistureOut = input.moisturePct < MOISTURE_MIN || input.moisturePct > MOISTURE_MAX;
  const extremeMoisture = input.moisturePct < 10.0 || input.moisturePct > 13.0;

  if (variancePct > 0.02)
    return { tier: 3, label: `Weight variance ${(variancePct * 100).toFixed(2)}% > ±2.0% — possible substitution or in-transit theft`, variancePct };
  if (variancePct > WEIGHT_VARIANCE_TOLERANCE)
    return { tier: 2, label: `Weight variance ${(variancePct * 100).toFixed(2)}% exceeds ±1.5% — identity risk, investigation required`, variancePct };
  if (extremeMoisture)
    return { tier: 2, label: `Moisture ${input.moisturePct}% extreme — degradation or water intrusion`, variancePct };
  if (moistureOut)
    return { tier: 1, label: `Moisture ${input.moisturePct}% marginal — extended loss, acceptable with documentation`, variancePct };
  return { tier: 0, label: "PASS — weight reconciled, moisture in spec", variancePct };
}

/** Cupping SOP §5.1 — delta vs. reference within tier tolerance band. */
export function classifyCupDelta(tier: 1 | 2 | 3, delta: number): boolean {
  return Math.abs(delta) <= CUPPING_TOLERANCE[tier];
}

const createInput = z.object({
  lotId: z.number().int().positive().optional(),
  containerNumber: z.string().default(""),
  exceptionType: z.enum([
    "seal_compromise",
    "weight_moisture_variance",
    "quality_anomaly",
    "partial_compromise",
    "equipment_failure",
    "customs_inspection",
  ]),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  description: z.string().min(1),
  actor: z.string().default("warehouse"),
});

export const warehouseRouter = createRouter({
  list: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(warehouseExceptions)
      .orderBy(desc(warehouseExceptions.id))
      .limit(200);
    const withLots = await Promise.all(
      rows.map(async (r) => {
        const lot = r.lotId
          ? await db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, r.lotId) })
          : null;
        const timeline = await db
          .select()
          .from(exceptionEvents)
          .where(eq(exceptionEvents.exceptionId, r.id))
          .orderBy(desc(exceptionEvents.id))
          .limit(20);
        return { ...r, lotName: lot?.name ?? null, timeline };
      }),
    );
    return withLots;
  }),

  /** Classify a receiving measurement without persisting (wizard preview). */
  classify: staffProcedure
    .input(
      z.object({
        kind: z.enum(["seal", "weight_moisture"]),
        sealIntact: z.boolean().optional(),
        serialMatches: z.boolean().optional(),
        originPhotosMatch: z.boolean().optional(),
        expectedLbs: z.number().optional(),
        receivedLbs: z.number().optional(),
        moisturePct: z.number().optional(),
      }),
    )
    .query(({ input }) => {
      if (input.kind === "seal")
        return classifySealCheck({
          sealIntact: input.sealIntact ?? true,
          serialMatches: input.serialMatches ?? true,
          originPhotosMatch: input.originPhotosMatch ?? true,
        });
      return classifyWeightMoisture({
        expectedLbs: input.expectedLbs ?? 0,
        receivedLbs: input.receivedLbs ?? 0,
        moisturePct: input.moisturePct ?? 11.5,
      });
    }),

  create: staffProcedure.input(createInput).mutation(async ({ input }) => {
    const db = getDb();
    const slaDueAt = new Date(Date.now() + TIER_SLA_HOURS[input.tier] * 3600 * 1000);
    // Tier 3 and most Tier 2 start as hard hold (Runbook: containment first).
    const status: ExceptionStatus = input.tier >= 2 ? "hard_hold" : "open";
    const [{ id }] = await db
      .insert(warehouseExceptions)
      .values({ ...input, status, slaDueAt })
      .$returningId();
    await db.insert(exceptionEvents).values({
      exceptionId: id,
      note: `Tier ${input.tier} ${input.exceptionType} opened — ${input.description}`,
      actor: input.actor,
    });
    await emitEvent("warehouse.exception_opened", "exception", id, {
      exceptionId: id,
      tier: input.tier,
      exceptionType: input.exceptionType,
      lotId: input.lotId ?? null,
    });
    return { id, status, slaDueAt };
  }),

  advance: staffProcedure
    .input(
      z.object({
        exceptionId: z.number().int().positive(),
        status: z.enum(["open", "hard_hold", "quarantine", "investigating", "resolved", "closed"]),
        note: z.string().default(""),
        actor: z.string().default("warehouse"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(warehouseExceptions)
        .set({ status: input.status })
        .where(eq(warehouseExceptions.id, input.exceptionId));
      await db.insert(exceptionEvents).values({
        exceptionId: input.exceptionId,
        note: input.note || `Status → ${input.status}`,
        actor: input.actor,
      });
      return { ok: true };
    }),

  /** Close with one of the four dispositions (supplier agreement Section B.1). */
  resolve: staffProcedure
    .input(
      z.object({
        exceptionId: z.number().int().positive(),
        disposition: z.enum(["release", "downgrade", "reject_claim", "reverify_partition"]),
        rootCause: z.string().default(""),
        atFaultParty: z.enum(["supplier", "carrier", "customs", "greensheet", "indeterminate"]),
        financialCents: z.number().int().min(0).default(0),
        actor: z.string().default("commercial"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const ex = await db.query.warehouseExceptions.findFirst({
        where: eq(warehouseExceptions.id, input.exceptionId),
      });
      if (!ex) throw new Error("GS-WHS-1001 ExceptionNotFound");
      await db
        .update(warehouseExceptions)
        .set({
          status: "closed",
          disposition: input.disposition,
          rootCause: input.rootCause,
          atFaultParty: input.atFaultParty,
          financialCents: input.financialCents,
          resolvedAt: new Date(),
        })
        .where(eq(warehouseExceptions.id, input.exceptionId));
      await db.insert(exceptionEvents).values({
        exceptionId: input.exceptionId,
        note: `Disposition: ${input.disposition} · fault ${input.atFaultParty} · financial ${(input.financialCents / 100).toFixed(2)} USD`,
        actor: input.actor,
      });
      await emitEvent("warehouse.exception_resolved", "exception", input.exceptionId, {
        exceptionId: input.exceptionId,
        disposition: input.disposition,
        tier: ex.tier,
      });
      return { ok: true };
    }),

  /** End-of-day warehouse report data (runbook template). */
  dailyReport: staffProcedure.query(async () => {
    const db = getDb();
    const all = await db.select().from(warehouseExceptions).orderBy(desc(warehouseExceptions.id));
    const today = new Date().toDateString();
    const openedToday = all.filter((e) => new Date(e.createdAt).toDateString() === today);
    const closedToday = all.filter(
      (e) => e.resolvedAt && new Date(e.resolvedAt).toDateString() === today,
    );
    const onHold = all.filter((e) => ["hard_hold", "quarantine"].includes(e.status));
    const overdue = onHold.filter((e) => e.slaDueAt && new Date(e.slaDueAt) < new Date());
    const countByTier = (rows: typeof all) => ({
      tier1: rows.filter((r) => r.tier === 1).length,
      tier2: rows.filter((r) => r.tier === 2).length,
      tier3: rows.filter((r) => r.tier === 3).length,
    });
    return {
      openedToday: countByTier(openedToday),
      closedToday: countByTier(closedToday),
      onHold,
      overdue,
    };
  }),
});
