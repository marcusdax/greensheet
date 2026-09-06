// QC context: retained reference samples (cold-chain integrity SOP) and
// cupping sessions (SCA 10-attribute scorecard + tolerance bands).
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, staffProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import {
  retainedSamples,
  sampleAccessLogs,
  cuppingSessions,
  warehouseExceptions,
  coffeeLots,
  documents,
  ocrResults,
} from "@db/schema";
import { emitEvent } from "../engine";
import { CUPPING_TOLERANCE, CUPPING_RED_FLAGS, roundScore } from "@contracts/constants";
import { gateForField, fieldsRequiringConfirmation } from "@contracts/ocr-schemas";
import { TRPCError } from "@trpc/server";
import { getFlags } from "../services/flags";
import { checkSessionAuthority } from "../services/education/cuppers";

// Retention windows in days (Retained Sample SOP §4.1)
const RETENTION_DAYS = {
  no_exception: 60,
  tier1_resolved: 90,
  tier2_resolved: 180,
  tier3_resolved: 365,
} as const;

export const qcRouter = createRouter({
  // ── Retained samples ──────────────────────────────────────────────────────
  samples: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(retainedSamples).orderBy(desc(retainedSamples.id)).limit(200);
    return Promise.all(
      rows.map(async (s) => {
        const access = await db
          .select()
          .from(sampleAccessLogs)
          .where(eq(sampleAccessLogs.sampleId, s.id))
          .orderBy(desc(sampleAccessLogs.id))
          .limit(10);
        const linkedExceptions = await db
          .select()
          .from(warehouseExceptions)
          .where(eq(warehouseExceptions.lotId, s.lotId ?? 0));
        const hasActive = linkedExceptions.some((e) => e.status !== "closed" && e.status !== "resolved");
        return { ...s, access, hasActiveException: hasActive };
      }),
    );
  }),

  pullSample: staffProcedure
    .input(
      z.object({
        lotId: z.number().int().positive().optional(),
        lotCode: z.string().min(1),
        containerNumber: z.string().default(""),
        bagPosition: z.string().default("middle"),
        pulledBy: z.string().min(1),
        storageLocation: z.string().default("Cabinet A"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      // Default retention: 60 days post-receipt with no exception (SOP §4.1).
      const destructionEligibleAt = new Date(
        Date.now() + RETENTION_DAYS.no_exception * 24 * 3600 * 1000,
      );
      const [{ id }] = await db
        .insert(retainedSamples)
        .values({ ...input, destructionEligibleAt })
        .$returningId();
      await emitEvent("qc.reference_sample_pulled", "retained_sample", id, {
        sampleId: id,
        lotCode: input.lotCode,
        pulledBy: input.pulledBy,
      });
      return { id, destructionEligibleAt };
    }),

  /** Open a sample for cupping: access log + openedCount + re-seal trail. */
  logAccess: staffProcedure
    .input(
      z.object({
        sampleId: z.number().int().positive(),
        accessedBy: z.string().min(1),
        purpose: z.string().min(1),
        quantityGrams: z.number().min(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const sample = await db.query.retainedSamples.findFirst({
        where: eq(retainedSamples.id, input.sampleId),
      });
      if (!sample) throw new Error("GS-QC-1001 SampleNotFound");
      if (sample.status === "destroyed" || sample.status === "lost")
        throw new Error("GS-QC-1002 SampleUnavailable — destroyed or lost samples cannot be accessed");
      await db.insert(sampleAccessLogs).values({
        sampleId: input.sampleId,
        accessedBy: input.accessedBy,
        purpose: input.purpose,
        quantityGrams: input.quantityGrams,
      });
      await db
        .update(retainedSamples)
        .set({ status: "opened", openedCount: sample.openedCount + 1 })
        .where(eq(retainedSamples.id, input.sampleId));
      // SOP §5.1: >5 openings → heavily compromised, recommend independent evaluation
      const heavilyCompromised = sample.openedCount + 1 > 5;
      if (heavilyCompromised) {
        await emitEvent("qc.sample_integrity_warning", "retained_sample", input.sampleId, {
          sampleId: input.sampleId,
          openedCount: sample.openedCount + 1,
        });
      }
      return { openedCount: sample.openedCount + 1, heavilyCompromised };
    }),

  /** Destruction protocol: dual-witness, only when eligible + no active exception. */
  destroySample: staffProcedure
    .input(
      z.object({
        sampleId: z.number().int().positive(),
        method: z.enum(["shredded", "incinerated", "donated"]),
        witness1: z.string().min(1),
        witness2: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const sample = await db.query.retainedSamples.findFirst({
        where: eq(retainedSamples.id, input.sampleId),
      });
      if (!sample) throw new Error("GS-QC-1001 SampleNotFound");
      if (input.witness1 === input.witness2)
        throw new Error("GS-QC-1003 DualWitnessRequired — destruction needs two distinct witnesses");
      const active = await db
        .select()
        .from(warehouseExceptions)
        .where(eq(warehouseExceptions.lotId, sample.lotId ?? 0));
      if (active.some((e) => e.status !== "closed" && e.status !== "resolved"))
        throw new Error("GS-QC-1004 ActiveException — destruction is on hold while an exception is open");
      await db
        .update(retainedSamples)
        .set({
          status: "destroyed",
          destroyedAt: new Date(),
          destructionMethod: input.method,
        })
        .where(eq(retainedSamples.id, input.sampleId));
      await emitEvent("qc.reference_sample_destroyed", "retained_sample", input.sampleId, {
        sampleId: input.sampleId,
        method: input.method,
        witnesses: [input.witness1, input.witness2],
      });
      return { ok: true };
    }),

  // ── Cupping sessions ──────────────────────────────────────────────────────
  cuppings: staffProcedure.query(async () => {
    return getDb().select().from(cuppingSessions).orderBy(desc(cuppingSessions.id)).limit(100);
  }),

  /**
   * ADR-04 — OCR may PRE-FILL a cupping form; it may not finalise one.
   *
   * This returns a draft for the operator to edit and submit through
   * recordCupping, where the existing panel rule (GS-QC-1005) applies
   * unchanged. It writes no cuppingSessions row, so a lab report extracted at
   * 0.99 confidence still cannot move a farmer between a 35% and a 50%
   * revenue-share tier without a qualified person (§14.8).
   */
  proposeCuppingFromDocument: staffProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const document = await db.query.documents.findFirst({
        where: eq(documents.id, input.documentId),
      });
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "GS-DOC-1002 · document not found" });
      }
      if (document.scanStatus === "infected") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GS-DOC-1005 · document is quarantined",
        });
      }

      const result = await db.query.ocrResults.findFirst({
        where: eq(ocrResults.documentId, document.id),
        orderBy: (t, { desc: d }) => [d(t.id)],
      });
      if (!result || result.status !== "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GS-DOC-1006 · no completed extraction for this document",
        });
      }

      const fields = (result.structuredData ?? {}) as Record<string, unknown>;
      const confidences = (result.confidenceScores ?? {}) as Record<string, number>;
      const num = (key: string) =>
        typeof fields[key] === "number" ? (fields[key] as number) : null;

      // The cup score is carried through roundScore because tier boundaries are
      // compared with >= against a double (B4).
      const cupScore = num("cupScore");

      return {
        draft: {
          sourceDocumentId: document.id,
          ocrResultId: result.id,
          lotCode: typeof fields.lotCode === "string" ? fields.lotCode : "",
          sampleId: typeof fields.sampleId === "string" ? fields.sampleId : null,
          cupScore: cupScore == null ? null : roundScore(cupScore),
          moistureContent: num("moistureContent"),
          defectCount: num("defectCount"),
          sensory: Array.isArray(fields.sensory) ? (fields.sensory as string[]) : [],
          notes: typeof fields.notes === "string" ? fields.notes : "",
        },
        // Per-field gating drives the review panel; the critical fields are
        // pre-filled, highlighted, and must be touched before submit.
        gates: Object.keys(fields).map((field) => ({
          field,
          confidence: confidences[field] ?? null,
          gate: gateForField(field, confidences[field]),
        })),
        mustConfirm: fieldsRequiringConfirmation(fields),
        // Stated so the caller cannot mistake this for an approved record.
        isDraft: true as const,
        approvedRecordCreated: false as const,
      };
    }),

  recordCupping: staffProcedure
    .input(
      z.object({
        sampleId: z.number().int().positive().optional(),
        lotCode: z.string().min(1),
        isPanel: z.boolean().default(false),
        cuppers: z.string().min(1),
        fragrance: z.number().min(6).max(10),
        flavor: z.number().min(6).max(10),
        aftertaste: z.number().min(6).max(10),
        acidity: z.number().min(6).max(10),
        body: z.number().min(6).max(10),
        balance: z.number().min(6).max(10),
        uniformity: z.number().min(6).max(10),
        cleanliness: z.number().min(6).max(10),
        sweetness: z.number().min(6).max(10),
        overall: z.number().min(0).max(10),
        referenceScore: z.number().min(0).max(100).optional(),
        exceptionTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        redFlags: z.array(z.enum(CUPPING_RED_FLAGS)).default([]),
        notes: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const totalScore =
        input.fragrance + input.flavor + input.aftertaste + input.acidity + input.body +
        input.balance + input.uniformity + input.cleanliness + input.sweetness + input.overall;

      const delta =
        input.referenceScore != null ? totalScore - input.referenceScore : null;
      const band = input.exceptionTier ? CUPPING_TOLERANCE[input.exceptionTier] : null;

      let verdict: "within_tolerance" | "outside_tolerance" | "red_flag" | null = null;
      if (input.redFlags.length > 0) verdict = "red_flag";
      else if (delta != null && band != null)
        verdict = Math.abs(delta) <= band ? "within_tolerance" : "outside_tolerance";

      // Panel cupping mandatory for Tier 2/3 exception resolution (SOP §4.4)
      if (input.exceptionTier && input.exceptionTier >= 2 && !input.isPanel)
        throw new Error("GS-QC-1005 PanelRequired — Tier 2/3 exception cupping requires a 3-cupper panel");

      // SOP §1.1 — WHO is cupping, not just how many.
      //
      // The panel rule above counts heads; on its own it accepts three names
      // typed into a box. A cup score sets the Revenue Share tier and therefore
      // a farmer's payment, so §1.1 restricts who may produce one: a Tier 3
      // barista may sit on a panel but never cup alone, a Tier 2 is barred from
      // Tier 2/3 exception resolution, and a Tier 0 may not cup at all.
      //
      // Behind a flag because turning it on before cupper profiles exist would
      // block every session. Off, this behaves exactly as it did before.
      if ((await getFlags()).cupperAuthority) {
        const check = await checkSessionAuthority({
          cupperNames: input.cuppers.split(",").map((c) => c.trim()),
          isPanel: input.isPanel,
          exceptionTier: input.exceptionTier,
        });
        if (!check.ok) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `GS-QC-1006 CupperNotAuthorized — ${check.problems.join(" ")}`,
          });
        }
      }

      const [{ id }] = await db
        .insert(cuppingSessions)
        .values({
          sampleId: input.sampleId ?? null,
          lotCode: input.lotCode,
          isPanel: input.isPanel,
          cuppers: input.cuppers,
          fragrance: input.fragrance,
          flavor: input.flavor,
          aftertaste: input.aftertaste,
          acidity: input.acidity,
          body: input.body,
          balance: input.balance,
          uniformity: input.uniformity,
          cleanliness: input.cleanliness,
          sweetness: input.sweetness,
          overall: input.overall,
          totalScore,
          referenceScore: input.referenceScore ?? null,
          deltaVsReference: delta,
          toleranceBand: band,
          verdict,
          redFlags: input.redFlags.join(","),
          notes: input.notes,
        })
        .$returningId();

      await emitEvent("qc.cupping_recorded", "cupping_session", id, {
        sessionId: id,
        lotCode: input.lotCode,
        totalScore,
        verdict,
      });
      // Red flags escalate automatically to Tier 3 review (SOP §5.2)
      if (verdict === "red_flag") {
        await emitEvent("qc.cupping_red_flag", "cupping_session", id, {
          sessionId: id,
          lotCode: input.lotCode,
          redFlags: input.redFlags,
          escalation: "tier_3_review",
        });
      }
      return { id, totalScore, deltaVsReference: delta, verdict };
    }),

  /** Reference lots for the cupping form (catalog names as lotCode options). */
  referenceOptions: staffProcedure.query(async () => {
    const db = getDb();
    const lots = await db.select().from(coffeeLots);
    return lots.map((l) => ({ lotCode: `LOT-${l.id}`, name: l.name, cupScore: l.cupScore }));
  }),
});
