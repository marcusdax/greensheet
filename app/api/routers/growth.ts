import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, staffProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import {
  coffeeLots,
  marketingPosts,
  pricingLinkClicks,
  referrals,
  roasters,
  waitlistSignups,
} from "@db/schema";
import { emitEvent } from "../engine";

// Growth Context — teaser waitlists (Foundry / Lotspace), the "Give a Kit,
// Get a Bag" referral engine, the POS-01…04 marketing calendar, and the
// COF-004 pricing-link click trigger.
export const growthRouter = createRouter({
  // ── Waitlists ────────────────────────────────────────────────────────────
  joinWaitlist: publicQuery
    .input(
      z.object({
        product: z.enum(["foundry", "lotspace"] as const),
        name: z.string().min(2),
        email: z.string().email(),
        company: z.string().default(""),
        interest: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.waitlistSignups.findFirst({
        where: (t, { and, eq: eqOp }) =>
          and(eqOp(t.product, input.product), eqOp(t.email, input.email)),
      });
      if (existing) return { ok: true, alreadyJoined: true, position: existing.id };
      const [{ id }] = await db.insert(waitlistSignups).values(input).$returningId();
      await emitEvent("growth.waitlist_joined", "waitlist", id, input);
      return { ok: true, alreadyJoined: false, position: id };
    }),

  waitlist: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(waitlistSignups).orderBy(desc(waitlistSignups.id));
    return {
      signups: rows,
      counts: {
        foundry: rows.filter((r) => r.product === "foundry").length,
        lotspace: rows.filter((r) => r.product === "lotspace").length,
      },
    };
  }),

  // ── Referrals — "Give a Kit, Get a Bag" ──────────────────────────────────
  createReferral: staffProcedure
    .input(
      z.object({
        referrerRoasterId: z.number(),
        referredRoasterId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.referrerRoasterId === input.referredRoasterId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-GRW-1001 · self-referrals are not allowed" });
      }
      const [referrer, referred] = await Promise.all([
        db.query.roasters.findFirst({ where: eq(roasters.id, input.referrerRoasterId) }),
        db.query.roasters.findFirst({ where: eq(roasters.id, input.referredRoasterId) }),
      ]);
      if (!referrer || !referred) {
        throw new TRPCError({ code: "NOT_FOUND", message: "GS-CRM-1000 · roaster not found" });
      }
      const dup = await db.query.referrals.findFirst({
        where: eq(referrals.referredRoasterId, input.referredRoasterId),
      });
      if (dup) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-GRW-1002 · roaster already referred" });
      }
      const code = `GS-REF-${referrer.roasterName.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase()}-${String(input.referrerRoasterId).padStart(3, "0")}`;
      const [{ id }] = await db
        .insert(referrals)
        .values({ code, ...input, status: "signed_up" })
        .$returningId();
      await emitEvent("growth.referral_created", "referral", id, { referralId: id, code, ...input });
      return { ok: true, id, code };
    }),

  // Advance the referral: signed_up → kit_sent → rewarded (both sides get a bag).
  advanceReferral: staffProcedure
    .input(z.object({ referralId: z.number(), target: z.enum(["kit_sent", "rewarded"] as const) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const ref = await db.query.referrals.findFirst({ where: eq(referrals.id, input.referralId) });
      if (!ref) throw new TRPCError({ code: "NOT_FOUND", message: "GS-GRW-1003 · referral not found" });
      const order: Record<string, number> = { signed_up: 0, kit_sent: 1, rewarded: 2 };
      if (order[input.target] <= order[ref.status]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `GS-GRW-1004 · illegal referral transition ${ref.status} → ${input.target}`,
        });
      }
      const rewardNote =
        input.target === "rewarded"
          ? "Free 5lb bag credited to referrer and referred roaster"
          : ref.rewardNote;
      await db
        .update(referrals)
        .set({ status: input.target, rewardNote })
        .where(eq(referrals.id, ref.id));
      await emitEvent(`growth.referral_${input.target}`, "referral", ref.id, {
        referralId: ref.id,
        code: ref.code,
        referrerRoasterId: ref.referrerRoasterId,
        referredRoasterId: ref.referredRoasterId,
      });
      return { ok: true };
    }),

  referrals: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(referrals).orderBy(desc(referrals.id));
    const rosterRows = await db.select().from(roasters);
    const rosterMap = new Map(rosterRows.map((r) => [r.id, r.roasterName]));
    return rows.map((r) => ({
      ...r,
      referrerName: rosterMap.get(r.referrerRoasterId) ?? "—",
      referredName: rosterMap.get(r.referredRoasterId) ?? "—",
    }));
  }),

  // ── Marketing calendar (POS-01…POS-04 social series) ────────────────────
  marketingCalendar: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(marketingPosts).orderBy(marketingPosts.week, marketingPosts.id);
    return rows;
  }),

  setPostStatus: staffProcedure
    .input(z.object({ postId: z.number(), status: z.enum(["draft", "scheduled", "published"] as const) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const post = await db.query.marketingPosts.findFirst({ where: eq(marketingPosts.id, input.postId) });
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "GS-GRW-1005 · post not found" });
      await db.update(marketingPosts).set({ status: input.status }).where(eq(marketingPosts.id, post.id));
      await emitEvent("growth.post_status_changed", "marketing_post", post.id, {
        postId: post.id,
        pillar: post.pillar,
        channel: post.channel,
        status: input.status,
      });
      return { ok: true };
    }),

  // ── COF-004 trigger ──────────────────────────────────────────────────────
  // The public pricing-link page calls this; the engine reacts with Touch-3.
  trackPricingClick: publicQuery
    .input(z.object({ roasterId: z.number(), lotId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [roaster, lot] = await Promise.all([
        db.query.roasters.findFirst({ where: eq(roasters.id, input.roasterId) }),
        db.query.coffeeLots.findFirst({ where: eq(coffeeLots.id, input.lotId) }),
      ]);
      if (!roaster) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CRM-1000 · roaster not found" });
      if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "GS-CAT-1000 · lot not found" });
      await db.insert(pricingLinkClicks).values(input);
      // Byte-identical event string — COF-004 reacts on clickedPricingPage === true.
      await emitEvent("campaigns.link_clicked", "roaster", input.roasterId, {
        roasterId: input.roasterId,
        lotId: input.lotId,
        lotName: lot.name,
        clickedPricingPage: true,
      });
      return { ok: true };
    }),

  pricingClicks: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(pricingLinkClicks).orderBy(desc(pricingLinkClicks.id)).limit(100);
    const rosterRows = await db.select().from(roasters);
    const lotRows = await db.select().from(coffeeLots);
    const rosterMap = new Map(rosterRows.map((r) => [r.id, r.roasterName]));
    const lotMap = new Map(lotRows.map((l) => [l.id, l.name]));
    return rows.map((c) => ({
      ...c,
      roasterName: rosterMap.get(c.roasterId) ?? "—",
      lotName: lotMap.get(c.lotId) ?? "—",
    }));
  }),
});
