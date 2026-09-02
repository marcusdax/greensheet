import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { sopAcknowledgments, sopDocuments } from "@db/schema";
import { emitEvent } from "../engine";

// Education Context — SOP library + training acknowledgments.
// Documents are seeded from the warehouse runbooks, cupping standards,
// retained-sample procedures, and the partnership agreement.
export const educationRouter = createRouter({
  // Library overview: every document with its acknowledgment count.
  library: protectedProcedure.query(async () => {
    const db = getDb();
    const docs = await db.select().from(sopDocuments).orderBy(sopDocuments.code);
    const acks = await db.select().from(sopAcknowledgments);
    return docs.map((d) => ({
      ...d,
      acknowledgmentCount: acks.filter((a) => a.documentId === d.id).length,
    }));
  }),

  document: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const doc = await db.query.sopDocuments.findFirst({
        where: eq(sopDocuments.code, input.code),
      });
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "GS-EDU-1000 · SOP document not found" });
      }
      const acknowledgments = await db
        .select()
        .from(sopAcknowledgments)
        .where(eq(sopAcknowledgments.documentId, doc.id))
        .orderBy(desc(sopAcknowledgments.id));
      return { ...doc, acknowledgments };
    }),

  // Training sign-off — a team member attests they read and understood the SOP.
  acknowledge: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        personName: z.string().min(2),
        role: z.string().default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const doc = await db.query.sopDocuments.findFirst({
        where: eq(sopDocuments.id, input.documentId),
      });
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "GS-EDU-1000 · SOP document not found" });
      }
      const [{ id }] = await db.insert(sopAcknowledgments).values(input).$returningId();
      await emitEvent("education.sop_acknowledged", "sop_document", doc.id, {
        documentId: doc.id,
        code: doc.code,
        personName: input.personName,
        role: input.role,
      });
      return { ok: true, id };
    }),
});
