// Automated dunning — §3.4.
//
// The ladder is data (dunning_steps), not code, so changing "day 7 becomes a
// phone task" is a seed row rather than a deploy. Planning and sending are
// separate procedures on purpose: an operator should be able to see exactly who
// would be contacted before anything leaves the building.
import { z } from "zod";
import { createRouter, rbacProcedure } from "../middleware";
import {
  channelEffectiveness,
  dunningCandidates,
  planDunning,
  runDunning,
  DEFAULT_POLICY,
} from "../services/payments/dunning";
import { getFlags } from "../services/flags";
import { TRPCError } from "@trpc/server";

const asOf = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const dunningRouter = createRouter({
  /** Overdue invoices with their day count, before any ladder is applied. */
  candidates: rbacProcedure("payments.dunning.candidates")
    .input(z.object({ asOf }).optional())
    .query(async ({ input }) => dunningCandidates(input?.asOf)),

  /** Dry-run: what today's sweep would send, and to whom. */
  plan: rbacProcedure("payments.dunning.plan")
    .input(
      z.object({ asOf, policyCode: z.string().max(40).optional() }).optional()
    )
    .query(async ({ input }) =>
      planDunning({
        asOf: input?.asOf,
        policyCode: input?.policyCode ?? DEFAULT_POLICY,
      })
    ),

  /**
   * Run the sweep. Idempotent by construction: dunning_runs is unique on
   * (invoiceId, stepId), so a second run on the same day records duplicates
   * rather than contacting anyone twice.
   */
  run: rbacProcedure("payments.dunning.run")
    .input(
      z
        .object({
          asOf,
          policyCode: z.string().max(40).optional(),
          dryRun: z.boolean().default(false),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const flags = await getFlags();
      if (!flags.dunning && !input?.dryRun) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GS-DUN-1001 · dunning is disabled",
        });
      }
      return runDunning({
        asOf: input?.asOf,
        policyCode: input?.policyCode ?? DEFAULT_POLICY,
        dryRun: input?.dryRun ?? false,
      });
    }),

  /** §3.4 — which channel actually gets an invoice paid. */
  effectiveness: rbacProcedure("payments.dunning.effectiveness").query(
    async () => channelEffectiveness()
  ),
});
