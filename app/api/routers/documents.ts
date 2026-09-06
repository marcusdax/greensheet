// Documents & OCR router — sprint spec §5.1, §6 and ADR-04.
//
// Flow: upload → confirmUpload → virus scan → enqueue → extract → propose draft
// → human review → accept. The pipeline NEVER writes an approved business
// record. In particular there is no qcAudits.* here: quality truth stays in
// cuppingSessions, behind the existing panel rule (B5), and OCR may only
// pre-fill that form.
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { documents, ocrResults } from "@db/schema";
import { emitEvent } from "../engine";
import { getFlags } from "../services/flags";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  PRESIGNED_URL_TTL_SECONDS,
  assertConfidenceCoverage,
  gateForField,
  fieldsRequiringConfirmation,
} from "@contracts/ocr-schemas";
import { isDuplicateKeyError } from "../webhooks/shared";

// Roles come from contracts/rbac.ts so the table cannot drift from the router.

async function requireOcrEnabled() {
  const flags = await getFlags();
  if (!flags.ocrUpload) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "GS-DOC-1001 · document intake is disabled",
    });
  }
}

export const documentsRouter = createRouter({
  /**
   * Reserve a document row and hand back a presigned destination. The client
   * uploads directly, then calls confirmUpload — without that second step you
   * cannot distinguish "user abandoned the upload" from "upload failed" (§5.1).
   */
  upload: rbacProcedure("documents.upload")
    .input(
      z.object({
        entityType: z.enum([
          "coffee_lot",
          "contract",
          "cupping_session",
          "invoice",
          "counterparty",
          "shipment",
        ]),
        entityId: z.number().int().positive().optional(),
        documentType: z.enum([
          "sca_lab_report",
          "sales_contract",
          "purchase_contract",
          "bill_of_lading",
          "phytosanitary_certificate",
          "invoice",
          "other",
        ]),
        fileName: z.string().min(1).max(255),
        contentType: z.enum(ALLOWED_CONTENT_TYPES),
        sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOcrEnabled();
      const db = getDb();
      const storageKey = `documents/${input.entityType}/${Date.now()}-${input.fileName.replace(/[^\w.-]/g, "_")}`;

      const [inserted] = await db.insert(documents).values({
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        documentType: input.documentType,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        storageKey,
        uploadStatus: "pending",
        scanStatus: "pending",
        uploadedByUserId: ctx.user.id,
      });

      return {
        documentId: Number(inserted.insertId),
        // Object storage is not wired in this slice; the key is the contract
        // the storage adapter will sign. §12.3 requires the file is never
        // served from the application origin when it is.
        uploadUrl: `/api/documents/upload/${storageKey}`,
        expiresAt: new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000),
      };
    }),

  confirmUpload: rbacProcedure("documents.confirmUpload")
    .input(
      z.object({
        documentId: z.number().int().positive(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
      })
    )
    .mutation(async ({ input }) => {
      await requireOcrEnabled();
      const db = getDb();

      const document = await db.query.documents.findFirst({
        where: eq(documents.id, input.documentId),
      });
      if (!document)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-DOC-1002 · not found",
        });

      try {
        await db
          .update(documents)
          .set({
            sha256: input.sha256,
            sizeBytes: input.sizeBytes,
            uploadStatus: "uploaded",
          })
          .where(eq(documents.id, input.documentId));
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          // The same lab report uploaded twice must not run OCR twice or create
          // two drafts (§3.12). Point the caller at the original instead.
          const existing = await db.query.documents.findFirst({
            where: eq(documents.sha256, input.sha256),
          });
          return {
            documentId: existing?.id ?? input.documentId,
            duplicate: true as const,
            message:
              "this file has already been uploaded; reusing the existing document",
          };
        }
        throw err;
      }

      await emitEvent("document.uploaded", "document", input.documentId, {
        documentId: input.documentId,
        entityType: document.entityType,
        entityId: document.entityId,
        documentType: document.documentType,
        sha256: input.sha256,
      });

      return { documentId: input.documentId, duplicate: false as const };
    }),

  list: rbacProcedure("documents.list")
    .input(
      z
        .object({
          entityType: z.string().optional(),
          entityId: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const conditions = [isNull(documents.deletedAt)];
      if (input?.entityId)
        conditions.push(eq(documents.entityId, input.entityId));
      return getDb()
        .select()
        .from(documents)
        .where(and(...conditions))
        .orderBy(desc(documents.id))
        .limit(input?.limit ?? 50);
    }),

  byId: rbacProcedure("documents.byId")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const document = await db.query.documents.findFirst({
        where: eq(documents.id, input.id),
      });
      if (!document)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-DOC-1002 · not found",
        });

      const result = await db.query.ocrResults.findFirst({
        where: eq(ocrResults.documentId, document.id),
        orderBy: (t, { desc: d }) => [d(t.id)],
      });

      if (!result?.structuredData) return { document, extraction: null };

      const fields = result.structuredData as Record<string, unknown>;
      const confidences = (result.confidenceScores ?? {}) as Record<
        string,
        number
      >;
      const missing = assertConfidenceCoverage(fields, confidences);

      // The review panel is driven entirely by this per-field gating, so the
      // rule lives in one place and the UI cannot quietly disagree with it.
      const gated = Object.entries(fields).map(([field, value]) => ({
        field,
        value,
        confidence: confidences[field] ?? null,
        gate: gateForField(field, confidences[field]),
      }));

      return {
        document,
        extraction: {
          ocrResultId: result.id,
          status: result.status,
          modelVersion: result.modelVersion,
          schemaVersion: result.schemaVersion,
          reviewedAt: result.reviewedAt,
          reviewOutcome: result.reviewOutcome,
          fields: gated,
          mustConfirm: fieldsRequiringConfirmation(fields),
          missingConfidence: missing,
        },
      };
    }),

  /** Documents whose extraction needs a person — the §6.4 review queue. */
  reviewQueue: rbacProcedure("documents.reviewQueue").query(async () => {
    const rows = await getDb()
      .select({
        documentId: documents.id,
        fileName: documents.fileName,
        documentType: documents.documentType,
        entityType: documents.entityType,
        entityId: documents.entityId,
        scanStatus: documents.scanStatus,
        uploadStatus: documents.uploadStatus,
        ocrResultId: ocrResults.id,
        ocrStatus: ocrResults.status,
        errorMessage: ocrResults.errorMessage,
        modelVersion: ocrResults.modelVersion,
        reviewedAt: ocrResults.reviewedAt,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .leftJoin(ocrResults, eq(ocrResults.documentId, documents.id))
      .where(isNull(documents.deletedAt))
      .orderBy(desc(documents.id))
      .limit(100);

    return rows.filter(r => r.reviewedAt == null);
  }),

  /**
   * Record that a human looked at an extraction. This does NOT create the
   * business record — the operator submits the pre-filled cupping or contract
   * form through its own router, where the existing panel rule (GS-QC-1005) and
   * validation still apply. This row is the evidence that a person was in the
   * loop (§3.12).
   */
  recordReview: rbacProcedure("documents.recordReview")
    .input(
      z.object({
        ocrResultId: z.number().int().positive(),
        outcome: z.enum(["accepted", "edited", "rejected"]),
        /** Fields the reviewer explicitly touched — the ADR-04 gate. */
        confirmedFields: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const result = await db.query.ocrResults.findFirst({
        where: eq(ocrResults.id, input.ocrResultId),
      });
      if (!result)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-DOC-1003 · not found",
        });

      const fields = (result.structuredData ?? {}) as Record<string, unknown>;
      const mustConfirm = fieldsRequiringConfirmation(fields);
      const unconfirmed = mustConfirm.filter(
        f => !input.confirmedFields.includes(f)
      );

      if (input.outcome !== "rejected" && unconfirmed.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `GS-DOC-1004 · financial and quality-critical fields must be explicitly confirmed: ${unconfirmed.join(", ")}`,
        });
      }

      await db
        .update(ocrResults)
        .set({
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
          reviewOutcome: input.outcome,
        })
        .where(eq(ocrResults.id, input.ocrResultId));

      await emitEvent(
        "document.review_recorded",
        "document",
        result.documentId,
        {
          documentId: result.documentId,
          ocrResultId: result.id,
          outcome: input.outcome,
          confirmedFields: input.confirmedFields,
          byUserId: ctx.user.id,
        }
      );

      return { ocrResultId: result.id, outcome: input.outcome };
    }),
});
