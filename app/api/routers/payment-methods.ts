// Saved payment methods — §3.6 (the thing a standing order charges against).
//
// The stored token is a provider handle, not a card number, and it is still a
// credential: `tokenEnc` is never selected here. Consent is modelled as data
// rather than prose — consentGivenAt/consentText/consentRevokedAt — because
// "may we charge this customer without them present" is a question the auto
// charge path has to answer programmatically (autoChargeBlockers).
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { counterparties, paymentMethods } from "@db/schema";
import { emitEvent } from "../engine";
import { PAYMENT_PROVIDERS } from "@contracts/providers";
import { autoChargeBlockers } from "../services/payments/standing-orders";

/**
 * Columns safe to return. `tokenEnc` never leaves the database — the auto-charge
 * precondition only needs to know whether a token exists, so that question is
 * answered in SQL and the credential itself is never read into the process.
 */
const publicColumns = {
  id: paymentMethods.id,
  counterpartyId: paymentMethods.counterpartyId,
  provider: paymentMethods.provider,
  label: paymentMethods.label,
  displayLast4: paymentMethods.displayLast4,
  tokenExpiresAt: paymentMethods.tokenExpiresAt,
  consentGivenAt: paymentMethods.consentGivenAt,
  consentText: paymentMethods.consentText,
  consentRevokedAt: paymentMethods.consentRevokedAt,
  status: paymentMethods.status,
  isDefault: paymentMethods.isDefault,
  createdAt: paymentMethods.createdAt,
  hasToken: sql<number>`(${paymentMethods.tokenEnc} is not null)`,
};

export const paymentMethodsRouter = createRouter({
  list: rbacProcedure("payments.methods.list")
    .input(z.object({ counterpartyId: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      const conditions = [isNull(paymentMethods.deletedAt)];
      if (input.counterpartyId) {
        conditions.push(
          eq(paymentMethods.counterpartyId, input.counterpartyId)
        );
      }
      const rows = await getDb()
        .select(publicColumns)
        .from(paymentMethods)
        .where(and(...conditions))
        .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.id))
        .limit(200);
      return rows.map(({ hasToken, ...row }) => ({
        ...row,
        hasToken: Boolean(hasToken),
        // Surfacing the blockers with the row means the UI can grey out
        // "charge automatically" for the same reason the job would refuse.
        autoChargeBlockers: autoChargeBlockers({
          ...row,
          tokenEnc: hasToken ? "stored" : null,
        }),
      }));
    }),

  register: rbacProcedure("payments.methods.register")
    .input(
      z.object({
        counterpartyId: z.number().int().positive(),
        provider: z.enum(PAYMENT_PROVIDERS),
        label: z.string().max(120).default(""),
        displayLast4: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
        /** Provider-issued handle. Never a PAN, never a bank account number. */
        token: z.string().max(400).optional(),
        tokenExpiresAt: z.date().optional(),
        /** What the customer actually agreed to, in their words. */
        consentText: z.string().min(1).max(500),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const counterparty = await db.query.counterparties.findFirst({
        where: eq(counterparties.id, input.counterpartyId),
      });
      if (!counterparty)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-PAY-1003 · counterparty not found",
        });

      if (input.isDefault) {
        await db
          .update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.counterpartyId, input.counterpartyId));
      }

      const [inserted] = await db.insert(paymentMethods).values({
        counterpartyId: input.counterpartyId,
        provider: input.provider,
        label: input.label,
        displayLast4: input.displayLast4 ?? null,
        tokenEnc: input.token ?? null,
        tokenExpiresAt: input.tokenExpiresAt ?? null,
        consentGivenAt: new Date(),
        consentText: input.consentText,
        isDefault: input.isDefault,
        createdByUserId: ctx.user.id,
      });
      const id = Number(inserted.insertId);

      await emitEvent("payment.method_registered", "payment_method", id, {
        paymentMethodId: id,
        counterpartyId: input.counterpartyId,
        provider: input.provider,
        byUserId: ctx.user.id,
      });
      return { id };
    }),

  /**
   * Revocation is a first-class action, not a delete. The row stays so that a
   * charge we already made against it remains explicable, and the standing
   * order that pointed at it fails loudly instead of silently finding nothing.
   */
  revoke: rbacProcedure("payments.methods.revoke")
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().max(255).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(paymentMethods)
        .set({
          status: "revoked",
          consentRevokedAt: new Date(),
          isDefault: false,
          // The token is worthless to us now and a liability to keep.
          tokenEnc: null,
        })
        .where(eq(paymentMethods.id, input.id));
      await emitEvent("payment.method_revoked", "payment_method", input.id, {
        paymentMethodId: input.id,
        reason: input.reason,
        byUserId: ctx.user.id,
      });
      return { id: input.id, status: "revoked" as const };
    }),
});
