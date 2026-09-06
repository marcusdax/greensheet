// Vietnamese e-invoice — §3.5 (Circular 78/2021/TT-BTC). Closes risk R1.
//
// The authority's invoice number is theirs, not ours: it is stored on the
// submission row, never written back over invoices.invoiceNumber. Issuance is
// one-way — a wrongly issued e-invoice is corrected by issuing an adjustment,
// never by editing the original — so there is no update path here.
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { einvoiceSubmissions } from "@db/schema";
import { getFlags } from "../services/flags";
import {
  buildPayload,
  issueEinvoice,
  pendingEinvoices,
  validatePayload,
} from "../services/payments/einvoice";

export const einvoiceRouter = createRouter({
  /** The submission trail for one invoice, newest first. */
  byInvoice: rbacProcedure("invoices.einvoice.byInvoice")
    .input(z.object({ invoiceId: z.number().int().positive() }))
    .query(async ({ input }) =>
      getDb()
        .select()
        .from(einvoiceSubmissions)
        .where(eq(einvoiceSubmissions.invoiceId, input.invoiceId))
        .orderBy(desc(einvoiceSubmissions.id))
    ),

  /**
   * Show the operator exactly what we would send, and what is wrong with it,
   * without sending anything. TT 78 rejections are slow and opaque; catching a
   * missing MST here saves a day.
   */
  preview: rbacProcedure("invoices.einvoice.preview")
    .input(z.object({ invoiceId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const payload = await buildPayload(input.invoiceId);
      return { payload, problems: validatePayload(payload) };
    }),

  submit: rbacProcedure("invoices.einvoice.submit")
    .input(z.object({ invoiceId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const flags = await getFlags();
      if (!flags.eInvoice) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GS-EIN-1001 · e-invoice submission is disabled",
        });
      }
      return issueEinvoice(input.invoiceId, { byUserId: ctx.user.id });
    }),

  /** Live R1 gap report: issued invoices with no accepted e-invoice behind them. */
  pending: rbacProcedure("invoices.einvoice.pending").query(async () =>
    pendingEinvoices()
  ),
});
