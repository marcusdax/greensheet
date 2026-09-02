// Traceability tied to payment — §3.8.
//
// "This payment bought these lots, from this farm, at this cup score, with this
// revenue share." The chain is invoice → contract → lots → partner, so an
// order-backed invoice legitimately has no lots: the resolver reports
// traceable: false rather than treating a normal case as an error.
import { z } from "zod";
import { createRouter, rbacProcedure } from "../middleware";
import { TRPCError } from "@trpc/server";
import {
  contractsForLot,
  lotsForContract,
  provenanceForAllocation,
} from "../services/payments/provenance";

export const provenanceRouter = createRouter({
  byAllocation: rbacProcedure("payments.provenance.byAllocation")
    .input(z.object({ allocationId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const result = await provenanceForAllocation(input.allocationId);
      if (!result)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-PAY-1003 · allocation not found",
        });
      return result;
    }),

  byContract: rbacProcedure("payments.provenance.byContract")
    .input(z.object({ contractId: z.number().int().positive() }))
    .query(async ({ input }) => lotsForContract(input.contractId)),

  /** The reverse view: which contracts drew on this lot. */
  contractsForLot: rbacProcedure("payments.provenance.contractsForLot")
    .input(z.object({ lotId: z.number().int().positive() }))
    .query(async ({ input }) => contractsForLot(input.lotId)),
});
