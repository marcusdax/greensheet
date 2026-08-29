// Partners context: Revenue Share White-Glove Farmer & Collector Partnership
// Agreement — partners, lot addenda (Exhibit D), Floor Payments, Revenue Share
// (Exhibit B schedule), True Price Receipts, and collector pass-through (Exhibit C).
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  partners,
  lotAddenda,
  partnerPayments,
  collectorPassThroughs,
  orderLineItems,
  coffeeLots,
} from "@db/schema";
import { emitEvent } from "../engine";
import {
  qualityTierForScore,
  PARTNER_TIER_SLA_DAYS,
  COLLECTOR_MIN_PASS_THROUGH_PCT,
} from "@contracts/constants";

// Documented handling/QC/logistics estimate: $0.30/lb (agreement §5.3 worked example)
export const HANDLING_COST_PER_LB_CENTS = 30;

type TruePriceReceipt = {
  lotCode: string;
  netWeightLbs: number;
  cupScore: number | null;
  qualityTier: string;
  floorPricePerLbCents: number;
  floorPaymentCents: number;
  finalSalePriceCents: number | null;
  documentedCostsCents: number;
  netSaleProceedsCents: number | null;
  revenueSharePct: number | null;
  revenueShareCents: number | null;
};

async function receiptFor(addendumId: number) {
  const db = getDb();
  const addendum = await db.query.lotAddenda.findFirst({
    where: eq(lotAddenda.id, addendumId),
  });
  if (!addendum) throw new Error("GS-PRT-1001 AddendumNotFound");
  return addendum;
}

export const partnersRouter = createRouter({
  overview: publicQuery.query(async () => {
    const db = getDb();
    const allPartners = await db.select().from(partners).orderBy(desc(partners.id));
    return Promise.all(
      allPartners.map(async (p) => {
        const addenda = await db
          .select()
          .from(lotAddenda)
          .where(eq(lotAddenda.partnerId, p.id))
          .orderBy(desc(lotAddenda.id));
        const payments = await db
          .select()
          .from(partnerPayments)
          .where(eq(partnerPayments.partnerId, p.id))
          .orderBy(desc(partnerPayments.id));
        const passThroughs =
          p.partnerType === "collector"
            ? await db
                .select()
                .from(collectorPassThroughs)
                .where(eq(collectorPassThroughs.partnerId, p.id))
                .orderBy(desc(collectorPassThroughs.id))
            : [];
        const floorSlaDays = PARTNER_TIER_SLA_DAYS[p.partnerTier];
        return { ...p, addenda, payments, passThroughs, floorSlaDays };
      }),
    );
  }),

  registerPartner: publicQuery
    .input(
      z.object({
        partnerName: z.string().min(1),
        partnerType: z.enum(["farmer", "collector"]),
        originRegion: z.string().min(1),
        partnerTier: z.enum(["tier_a", "tier_b", "tier_c"]).default("tier_b"),
        email: z.string().default(""),
        phone: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(partners).values(input).$returningId();
      await emitEvent("partners.agreement_signed", "partner", id, {
        partnerId: id,
        partnerType: input.partnerType,
        partnerTier: input.partnerTier,
      });
      return { id };
    }),

  createAddendum: publicQuery
    .input(
      z.object({
        partnerId: z.number().int().positive(),
        lotId: z.number().int().positive().optional(),
        lotCode: z.string().min(1),
        processingProtocol: z.string().default(""),
        floorPricePerLbCents: z.number().int().positive(),
        expectedQtyLbs: z.number().int().positive(),
        deliveryWindow: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(lotAddenda).values(input).$returningId();
      await emitEvent("partners.lot_addendum_created", "lot_addendum", id, {
        addendumId: id,
        partnerId: input.partnerId,
        lotCode: input.lotCode,
        floorPricePerLbCents: input.floorPricePerLbCents,
      });
      return { id };
    }),

  /**
   * Lot passes Tier 1 verification → Floor Payment accrues (Section 5.1).
   * Floor = True-Cost Floor Price × verified net weight; never clawed back
   * except confirmed Tier 3 fraud (Section 5.6).
   */
  verifyAndAccrueFloor: publicQuery
    .input(
      z.object({
        addendumId: z.number().int().positive(),
        verifiedQtyLbs: z.number().int().positive(),
        cupScore: z.number().min(0).max(100),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const addendum = await receiptFor(input.addendumId);
      const existing = await db
        .select()
        .from(partnerPayments)
        .where(eq(partnerPayments.addendumId, input.addendumId));
      if (existing.some((p) => p.paymentType === "floor"))
        throw new Error("GS-PRT-1002 FloorAlreadyAccrued");

      const floorPaymentCents = addendum.floorPricePerLbCents * input.verifiedQtyLbs;
      const tier = qualityTierForScore(input.cupScore);
      const receipt: TruePriceReceipt = {
        lotCode: addendum.lotCode,
        netWeightLbs: input.verifiedQtyLbs,
        cupScore: input.cupScore,
        qualityTier: tier.name,
        floorPricePerLbCents: addendum.floorPricePerLbCents,
        floorPaymentCents,
        finalSalePriceCents: null,
        documentedCostsCents: 0,
        netSaleProceedsCents: null,
        revenueSharePct: null,
        revenueShareCents: null,
      };
      await db.insert(partnerPayments).values({
        partnerId: addendum.partnerId,
        addendumId: input.addendumId,
        paymentType: "floor",
        amountCents: floorPaymentCents,
        status: "accrued",
        receipt: JSON.stringify(receipt),
      });
      await db
        .update(lotAddenda)
        .set({ status: "verified" })
        .where(eq(lotAddenda.id, input.addendumId));
      await emitEvent("partners.floor_payment_accrued", "lot_addendum", input.addendumId, {
        addendumId: input.addendumId,
        partnerId: addendum.partnerId,
        floorPaymentCents,
        qualityTier: tier.name,
      });
      return { floorPaymentCents, qualityTier: tier.name, sharePct: tier.sharePct };
    }),

  /**
   * Revenue share accrual — called automatically when an order containing an
   * addendum-linked lot is delivered (Section 5.2):
   * Net Sale Proceeds = Final Sale − Floor Payment − documented costs;
   * Revenue Share = tier share % of Net Sale Proceeds.
   */
  accrueRevenueShareForOrder: publicQuery
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const results = await accrueRevenueShareForOrder(input.orderId);
      return { accrued: results };
    }),

  markPaymentPaid: publicQuery
    .input(z.object({ paymentId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(partnerPayments)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(partnerPayments.id, input.paymentId));
      return { ok: true };
    }),

  /** Exhibit C — record a collector's pass-through schedule line. */
  addPassThrough: publicQuery
    .input(
      z.object({
        partnerId: z.number().int().positive(),
        addendumId: z.number().int().positive(),
        farmerName: z.string().min(1),
        pctOfLot: z.number().min(0).max(100),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const addendum = await receiptFor(input.addendumId);
      const floorOwedCents = Math.round(
        addendum.floorPricePerLbCents * addendum.expectedQtyLbs * (input.pctOfLot / 100),
      );
      const [{ id }] = await db
        .insert(collectorPassThroughs)
        .values({ ...input, floorOwedCents, rsOwedCents: 0 })
        .$returningId();
      return { id, floorOwedCents };
    }),

  markPassThroughPaid: publicQuery
    .input(
      z.object({
        passThroughId: z.number().int().positive(),
        kind: z.enum(["floor", "revenue_share"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(collectorPassThroughs)
        .set(input.kind === "floor" ? { floorPaidAt: new Date() } : { rsPaidAt: new Date() })
        .where(eq(collectorPassThroughs.id, input.passThroughId));
      return { ok: true };
    }),
});

/**
 * Shared helper (also invoked from orders.advance on delivery):
 * accrues revenue share for every order line whose lot has an unsettled addendum.
 */
export async function accrueRevenueShareForOrder(orderId: number) {
  const db = getDb();
  const lines = await db
    .select()
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, orderId));
  const accrued: Array<{ addendumId: number; revenueShareCents: number; qualityTier: string }> = [];

  for (const line of lines) {
    const addenda = await db
      .select()
      .from(lotAddenda)
      .where(eq(lotAddenda.lotId, line.lotId));
    const addendum = addenda.find((a) => a.status === "verified" || a.status === "sold");
    if (!addendum) continue;

    const existing = await db
      .select()
      .from(partnerPayments)
      .where(eq(partnerPayments.addendumId, addendum.id));
    if (existing.some((p) => p.paymentType === "revenue_share")) continue;

    const lot = await db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, line.lotId) });
    const cupScore = lot?.cupScore ?? 0;
    const tier = qualityTierForScore(cupScore);
    const finalSaleCents = line.unitPriceCents * line.quantityLbs;
    const floorCents = addendum.floorPricePerLbCents * line.quantityLbs;
    const costsCents = HANDLING_COST_PER_LB_CENTS * line.quantityLbs;
    const netProceedsCents = Math.max(0, finalSaleCents - floorCents - costsCents);
    const revenueShareCents = Math.round((netProceedsCents * tier.sharePct) / 100);

    const receipt: TruePriceReceipt = {
      lotCode: addendum.lotCode,
      netWeightLbs: line.quantityLbs,
      cupScore,
      qualityTier: tier.name,
      floorPricePerLbCents: addendum.floorPricePerLbCents,
      floorPaymentCents: floorCents,
      finalSalePriceCents: finalSaleCents,
      documentedCostsCents: costsCents,
      netSaleProceedsCents: netProceedsCents,
      revenueSharePct: tier.sharePct,
      revenueShareCents,
    };
    await db.insert(partnerPayments).values({
      partnerId: addendum.partnerId,
      addendumId: addendum.id,
      paymentType: "revenue_share",
      amountCents: revenueShareCents,
      status: "accrued",
      receipt: JSON.stringify(receipt),
    });
    await db
      .update(lotAddenda)
      .set({ status: "settled" })
      .where(eq(lotAddenda.id, addendum.id));

    // Collector pass-through: split revenue share ≥80% to farmers (Section 5.4)
    const pts = await db
      .select()
      .from(collectorPassThroughs)
      .where(eq(collectorPassThroughs.addendumId, addendum.id));
    for (const pt of pts) {
      const rsOwed = Math.round(revenueShareCents * (pt.pctOfLot / 100));
      await db
        .update(collectorPassThroughs)
        .set({ rsOwedCents: rsOwed })
        .where(eq(collectorPassThroughs.id, pt.id));
    }

    await emitEvent("partners.revenue_share_accrued", "lot_addendum", addendum.id, {
      addendumId: addendum.id,
      partnerId: addendum.partnerId,
      orderId,
      revenueShareCents,
      qualityTier: tier.name,
      sharePct: tier.sharePct,
    });
    accrued.push({ addendumId: addendum.id, revenueShareCents, qualityTier: tier.name });
  }
  return accrued;
}

export { COLLECTOR_MIN_PASS_THROUGH_PCT };
