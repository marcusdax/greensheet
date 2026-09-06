// Trust Score surface — spec §6, §7.
//
// Note what is absent: there is no `setScore`. A score is derived from evidence
// and nothing else, so the only way to move one from here is to record a fact
// (`verifyIdentity`, `recordPeerFeedback`) or to file an audited override,
// which is itself an evidence row carrying the admin's user id and reason (§9).
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { counterparties, trustEvidence } from "@db/schema";
import { emitEvent } from "../engine";
import {
  BAND_SPECS,
  COMPONENT_SPECS,
  MODEL_VERSION,
  TRUST_COMPONENTS,
  TRUST_ENTITY_TYPES,
  bandFor,
} from "@contracts/trust";
import { getFlags } from "../services/flags";
import {
  currentScore,
  historyFor,
  neutralView,
  recalculate,
  recordEvidence,
  scoresForLots,
  settlementGateFor,
} from "../services/trust";

const entityType = z.enum(TRUST_ENTITY_TYPES);
const entityId = z.number().int().positive();

/**
 * Reads stay open when the feature is off — an existing score is still true and
 * still explicable — but nothing may WRITE one. The outbox handlers already
 * refuse on this flag; without the same check here the router would be a way to
 * move a score while the feature that produces evidence is switched off, which
 * is exactly the state §9 says must not exist.
 */
async function assertTrustEnabled(): Promise<void> {
  if (!(await getFlags()).trustScore) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "GS-TRU-1006 · Trust scoring is disabled",
    });
  }
}

export const trustRouter = createRouter({
  /**
   * The score for one entity. Returns a neutral, explicitly `unscored` view
   * rather than 404 when nothing has been calculated: §5.5 needs to tell
   * "no evidence yet" apart from "scored badly", and a missing row is the
   * former.
   */
  byEntity: rbacProcedure("trust.byEntity")
    .input(z.object({ entityType, entityId }))
    .query(async ({ input }) => {
      const current = await currentScore(input.entityType, input.entityId);
      const view = current ?? neutralView();
      return {
        ...view,
        entityType: input.entityType,
        entityId: input.entityId,
        unscored: current === null,
        bandLabel: BAND_SPECS[view.band].label,
        bandEffect: BAND_SPECS[view.band].effect,
      };
    }),

  /** The evidence behind a score — the reason a low bar is explicable. */
  evidence: rbacProcedure("trust.evidence")
    .input(
      z.object({
        entityType,
        entityId,
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) =>
      getDb()
        .select()
        .from(trustEvidence)
        .where(
          and(
            eq(trustEvidence.entityType, input.entityType),
            eq(trustEvidence.entityId, input.entityId)
          )
        )
        .orderBy(desc(trustEvidence.occurredAt), desc(trustEvidence.id))
        .limit(input.limit)
    ),

  /** §6 — the last 30 moves, for the trend line on the Trust panel. */
  history: rbacProcedure("trust.history")
    .input(z.object({ entityType, entityId }))
    .query(async ({ input }) => historyFor(input.entityType, input.entityId)),

  /** The model itself, so the UI never hard-codes a weight or a band edge. */
  model: rbacProcedure("trust.model").query(() => ({
    modelVersion: MODEL_VERSION,
    components: TRUST_COMPONENTS.map(key => ({ key, ...COMPONENT_SPECS[key] })),
    bands: Object.entries(BAND_SPECS).map(([key, spec]) => ({ key, ...spec })),
  })),

  /**
   * Rebuild a score from evidence. Safe to call at any time — recomputation is
   * deterministic — and the way a weights change is rolled out.
   */
  recalculate: rbacProcedure("trust.recalculate")
    .input(z.object({ entityType, entityId }))
    .mutation(async ({ input }) => {
      await assertTrustEnabled();
      return recalculate(input.entityType, input.entityId, {
        reason: "Manual recalculation",
      });
    }),

  /**
   * Mark a counterparty's identity verified. This is the only writer of the
   * Identity & Longevity component, and it exists as a procedure rather than a
   * column edit because it must leave an evidence row behind it.
   */
  verifyIdentity: rbacProcedure("trust.verifyIdentity")
    .input(
      z.object({
        counterpartyId: entityId,
        /** What was actually checked — a registration number, a site visit. */
        note: z.string().min(3).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTrustEnabled();
      const db = getDb();
      const cp = await db.query.counterparties.findFirst({
        where: eq(counterparties.id, input.counterpartyId),
      });
      if (!cp)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-TRU-1001 · counterparty not found",
        });
      if (!cp.taxId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "GS-TRU-1002 · a tax identity (MST) must be on file before it can be verified",
        });
      }

      await db
        .update(counterparties)
        .set({ kycStatus: "verified" })
        .where(eq(counterparties.id, input.counterpartyId));

      // The evidence row is written HERE, not left to the outbox handler.
      // Recalculating without it would move a score with nothing behind it —
      // the one thing §9 forbids — and the handler legitimately skips while the
      // feature is off. The unique index makes the handler's later attempt a
      // safe no-op rather than a double count.
      const recorded = await recordEvidence({
        entityType: "counterparty",
        entityId: input.counterpartyId,
        kind: "identity_verified",
        sourceType: "counterparty",
        sourceId: input.counterpartyId,
        weight: 5,
        note: input.note,
        recordedByUserId: ctx.user.id,
      });

      await emitEvent(
        "counterparty.kyc_verified",
        "counterparty",
        input.counterpartyId,
        {
          counterpartyId: input.counterpartyId,
          note: input.note,
          byUserId: ctx.user.id,
        }
      );

      return recalculate("counterparty", input.counterpartyId, {
        reason: "Identity verified",
        evidenceIds: recorded.recorded ? [recorded.evidenceId] : [],
      });
    }),

  /**
   * §2.2 Network Reputation. The rater's own Trust is applied here, at write
   * time, so a ring of low-trust accounts cannot vouch each other upward.
   */
  recordPeerFeedback: rbacProcedure("trust.recordPeerFeedback")
    .input(
      z.object({
        subjectCounterpartyId: entityId,
        raterCounterpartyId: entityId,
        /** 0–100, the same scale as the score itself. */
        rating: z.number().min(0).max(100),
        note: z.string().max(255).default(""),
      })
    )
    .mutation(async ({ input }) => {
      await assertTrustEnabled();
      if (input.subjectCounterpartyId === input.raterCounterpartyId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GS-TRU-1003 · a counterparty cannot rate itself",
        });
      }
      const rater =
        (await currentScore("counterparty", input.raterCounterpartyId)) ??
        neutralView();

      // Weight the rating by the rater's standing, then store the result as a
      // delta from neutral so the calculator sees one comparable number.
      const influence = Math.max(0.05, rater.score / 100);
      const weight = ((input.rating - 50) / 10) * influence;

      const recorded = await recordEvidence({
        entityType: "counterparty",
        entityId: input.subjectCounterpartyId,
        kind: "peer_feedback",
        sourceType: "counterparty",
        sourceId: input.raterCounterpartyId,
        weight,
        note: input.note || `Peer feedback (rater trust ${rater.score})`,
      });
      if (!recorded.recorded) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "GS-TRU-1004 · this counterparty has already been rated by that peer",
        });
      }

      return recalculate("counterparty", input.subjectCounterpartyId, {
        reason: "Peer feedback recorded",
        evidenceIds: [recorded.evidenceId],
      });
    }),

  /**
   * §9 — "zero Trust updates without an evidence event or explicit admin
   * override (audited)". An override is not a back door around that rule: it is
   * an evidence row with a user id and a mandatory reason, and it shows in the
   * evidence list like everything else.
   */
  override: rbacProcedure("trust.override")
    .input(
      z.object({
        entityType,
        entityId,
        /** Signed evidence points, not a score. The model still does the math. */
        weight: z.number().min(-50).max(50),
        reason: z.string().min(10).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTrustEnabled();
      const recorded = await recordEvidence({
        entityType: input.entityType,
        entityId: input.entityId,
        kind: "admin_override",
        sourceType: "user",
        sourceId: ctx.user.id,
        weight: input.weight,
        note: input.reason,
        recordedByUserId: ctx.user.id,
      });
      if (!recorded.recorded) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "GS-TRU-1005 · this administrator already has an override on record for this entity",
        });
      }
      return recalculate(input.entityType, input.entityId, {
        reason: `Admin override: ${input.reason}`,
        evidenceIds: [recorded.evidenceId],
      });
    }),

  /**
   * §7 — whether a settlement of this size may be released, and why. The reason
   * string is always populated, including when the answer is yes: a gate that
   * only explains itself on refusal teaches operators nothing.
   */
  settlementGate: rbacProcedure("trust.settlementGate")
    .input(
      z.object({
        counterpartyId: entityId,
        amountMinor: z.bigint().nonnegative(),
      })
    )
    .query(async ({ input }) =>
      settlementGateFor({
        counterpartyId: input.counterpartyId,
        amountMinor: input.amountMinor,
      })
    ),

  /**
   * Scores for many lots at once — §5.5 puts a badge on every lot card, and one
   * query per card would make the catalog page fire thirty round trips.
   */
  forLots: rbacProcedure("trust.forLots")
    .input(z.object({ lotIds: z.array(entityId).max(200) }))
    .query(async ({ input }) => {
      const scores = await scoresForLots(input.lotIds);
      return input.lotIds.map(id => {
        const found = scores.get(id);
        return {
          lotId: id,
          // A lot with no calculated score is unscored, not zero. §5.5 shows
          // "Add evidence" for this case rather than a number nobody earned.
          unscored: found === undefined,
          score: found?.score ?? null,
          band: found?.band ?? null,
          acceptedDocumentCount: found?.acceptedDocumentCount ?? 0,
          modelVersion: found?.modelVersion ?? MODEL_VERSION,
        };
      });
    }),

  /** Band for an arbitrary score — used by the badge when hydrating a list. */
  bandFor: rbacProcedure("trust.bandFor")
    .input(z.object({ score: z.number().min(0).max(100) }))
    .query(({ input }) => {
      const band = bandFor(input.score);
      return { band, ...BAND_SPECS[band] };
    }),
});
