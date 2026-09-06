import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import {
  curriculumModules,
  sopAcknowledgments,
  sopDocuments,
} from "@db/schema";
import { emitEvent } from "../engine";
import {
  TIER_SPECS,
  TRAINING_PROGRAMME,
  CUPPER_TIERS,
  CUPPING_MODEL_VERSION,
  DISQUALIFYING_VARIANCE,
  RECERTIFICATION_DAYS,
} from "@contracts/cupping-authority";
import {
  cupperById,
  listCuppers,
  performanceDashboard,
  progressFor,
  recordAttempt,
} from "../services/education/cuppers";
import { cupperProfiles, cupperCalibrations } from "@db/schema";
import { and, asc } from "drizzle-orm";

// Education Context — SOP library + training acknowledgments.
// Documents are seeded from the warehouse runbooks, cupping standards,
// retained-sample procedures, and the partnership agreement.
export const educationRouter = createRouter({
  // Library overview: every document with its acknowledgment count.
  library: rbacProcedure("education.library").query(async () => {
    const db = getDb();
    const docs = await db
      .select()
      .from(sopDocuments)
      .orderBy(sopDocuments.code);
    const acks = await db.select().from(sopAcknowledgments);
    return docs.map(d => ({
      ...d,
      acknowledgmentCount: acks.filter(a => a.documentId === d.id).length,
    }));
  }),

  document: rbacProcedure("education.document")
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const doc = await db.query.sopDocuments.findFirst({
        where: eq(sopDocuments.code, input.code),
      });
      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-EDU-1000 · SOP document not found",
        });
      }
      const acknowledgments = await db
        .select()
        .from(sopAcknowledgments)
        .where(eq(sopAcknowledgments.documentId, doc.id))
        .orderBy(desc(sopAcknowledgments.id));
      return { ...doc, acknowledgments };
    }),

  // Training sign-off — a team member attests they read and understood the SOP.
  acknowledge: rbacProcedure("education.acknowledge")
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const doc = await db.query.sopDocuments.findFirst({
        where: eq(sopDocuments.id, input.documentId),
      });
      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-EDU-1000 · SOP document not found",
        });
      }

      // The signer is the authenticated user, never a name they typed.
      //
      // This previously took `personName` from the request body, so any
      // authenticated account could file an acknowledgment under a colleague's
      // name — and a training record that can be forged is not evidence of
      // training. It is the same reasoning that keeps Trust scores derived
      // rather than settable.
      const personName = ctx.user.name;
      const role = ctx.user.role;

      const existing = await db
        .select({ id: sopAcknowledgments.id })
        .from(sopAcknowledgments)
        .where(
          and(
            eq(sopAcknowledgments.documentId, doc.id),
            eq(sopAcknowledgments.personName, personName)
          )
        )
        .limit(1);
      // Re-reading an SOP is good practice; it is not a second sign-off.
      if (existing.length > 0) {
        return { ok: true, id: existing[0].id, alreadyAcknowledged: true };
      }

      const [{ id }] = await db
        .insert(sopAcknowledgments)
        .values({ documentId: doc.id, personName, role })
        .$returningId();
      await emitEvent("education.sop_acknowledged", "sop_document", doc.id, {
        documentId: doc.id,
        code: doc.code,
        personName,
        role,
        byUserId: ctx.user.id,
      });
      return { ok: true, id, alreadyAcknowledged: false };
    }),

  // ── The curriculum itself (SOP §1.2) ──────────────────────────────────────
  // Separate from the SOP library on purpose: a document is something you read,
  // a module is something you are assessed on. Conflating them is why the
  // library could show acknowledgments and still not answer "who can cup?".
  curriculum: rbacProcedure("education.curriculum").query(async () => {
    const modules = await getDb()
      .select()
      .from(curriculumModules)
      .where(eq(curriculumModules.active, true))
      .orderBy(asc(curriculumModules.track), asc(curriculumModules.sequence));
    return {
      modelVersion: CUPPING_MODEL_VERSION,
      phases: TRAINING_PROGRAMME,
      tiers: CUPPER_TIERS.map(key => ({ key, ...TIER_SPECS[key] })),
      modules,
      recertificationDays: RECERTIFICATION_DAYS,
      disqualifyingVariance: DISQUALIFYING_VARIANCE,
    };
  }),

  // ── Cupper qualification (SOP §1.1, §1.3) ─────────────────────────────────
  cuppers: rbacProcedure("education.cuppers").query(async () => listCuppers()),

  cupper: rbacProcedure("education.cupper")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const profile = await cupperById(input.id);
      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-EDU-1011 · cupper profile not found",
        });
      }
      const calibrations = await getDb()
        .select()
        .from(cupperCalibrations)
        .where(eq(cupperCalibrations.profileId, input.id))
        .orderBy(desc(cupperCalibrations.observedAt))
        .limit(50);
      return {
        ...profile,
        progress: await progressFor(input.id),
        calibrations,
      };
    }),

  /** §1.3 — the QC manager's monthly review, worst standing first. */
  performance: rbacProcedure("education.performance").query(async () =>
    performanceDashboard()
  ),

  enrolCupper: rbacProcedure("education.enrolCupper")
    .input(
      z.object({
        fullName: z.string().min(2).max(160),
        email: z.string().email().or(z.literal("")).default(""),
        tier: z.enum(CUPPER_TIERS).default("tier_0"),
        licenceNumber: z.string().max(60).default(""),
        licenceExpiresAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
        yearsExperience: z.number().int().min(0).max(60).default(0),
        userId: z.number().int().positive().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // §1.1 — a Q-Grader is defined by holding a live licence. Enrolling one
      // without a licence number and expiry would create a profile that claims
      // the highest authority on the strength of a dropdown.
      if (
        input.tier === "tier_1" &&
        (!input.licenceNumber || !input.licenceExpiresAt)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "GS-EDU-1012 · a Tier 1 profile needs a Q-Grader licence number and expiry (§1.1)",
        });
      }
      const [{ id }] = await getDb()
        .insert(cupperProfiles)
        .values({
          fullName: input.fullName,
          email: input.email,
          tier: input.tier,
          licenceNumber: input.licenceNumber,
          licenceExpiresAt: input.licenceExpiresAt ?? null,
          yearsExperience: input.yearsExperience,
          userId: input.userId ?? null,
        })
        .$returningId();
      await emitEvent("education.cupper_enrolled", "cupper_profile", id, {
        profileId: id,
        fullName: input.fullName,
        tier: input.tier,
        byUserId: ctx.user.id,
      });
      return { id };
    }),

  recordPhase: rbacProcedure("education.recordPhase")
    .input(
      z.object({
        profileId: z.number().int().positive(),
        phaseCode: z.string().min(3).max(20),
        score: z.number().nullable().default(null),
        assessorProfileId: z.number().int().positive().nullish(),
        notes: z.string().max(1000).default(""),
      })
    )
    .mutation(async ({ ctx, input }) =>
      recordAttempt({ ...input, recordedByUserId: ctx.user.id })
    ),

  /** §1.3 — annual recertification, or probation when performance degrades. */
  recertify: rbacProcedure("education.recertify")
    .input(
      z.object({
        profileId: z.number().int().positive(),
        outcome: z.enum(["recertified", "probation"]),
        reason: z.string().max(255).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const recertified = input.outcome === "recertified";
      if (!recertified && input.reason.trim().length < 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GS-EDU-1013 · probation needs a recorded reason (§1.3)",
        });
      }
      await db
        .update(cupperProfiles)
        .set(
          recertified
            ? {
                lastRecertifiedAt: new Date(),
                suspended: false,
                suspensionReason: null,
              }
            : {
                suspended: true,
                suspensionReason: input.reason,
                suspendedAt: new Date(),
              }
        )
        .where(eq(cupperProfiles.id, input.profileId));
      await emitEvent(
        "education.cupper_recertified",
        "cupper_profile",
        input.profileId,
        {
          profileId: input.profileId,
          outcome: input.outcome,
          reason: input.reason,
          byUserId: ctx.user.id,
        }
      );
      return { profileId: input.profileId, outcome: input.outcome };
    }),
});
