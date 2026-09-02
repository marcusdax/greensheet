// Multi-currency — §3.3.
//
// An exporter invoices in USD and is paid in USD into a VND book, or invoices
// in USD and is paid in VND. Either way there are two rates: the one the
// contract assumed and the one the money actually moved at. The difference is
// realized FX, and it has to be posted at allocation time or it is
// unrecoverable later — see services/payments/fx.ts.
import { z } from "zod";
import { desc, eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { fxRates } from "@db/schema";
import { SUPPORTED_CURRENCIES } from "@contracts/money";
import {
  convertAtRate,
  fxPosition,
  latestRate,
  recordRate,
  refreshRate,
} from "../services/payments/fx";

const currency = z.enum(SUPPORTED_CURRENCIES);
/** Rates are decimal strings end to end; a float never touches one. */
const rateString = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/);

export const fxRouter = createRouter({
  latest: rbacProcedure("payments.fx.latest")
    .input(z.object({ base: currency, quote: currency }))
    .query(async ({ input }) => latestRate(input.base, input.quote)),

  history: rbacProcedure("payments.fx.history")
    .input(
      z.object({
        base: currency,
        quote: currency,
        limit: z.number().int().min(1).max(200).default(30),
      })
    )
    .query(async ({ input }) =>
      getDb()
        .select()
        .from(fxRates)
        .where(
          and(
            eq(fxRates.baseCurrency, input.base),
            eq(fxRates.quoteCurrency, input.quote)
          )
        )
        .orderBy(desc(fxRates.observedAt))
        .limit(input.limit)
    ),

  /**
   * Pull a fresh quote from the configured feed. Returns null rather than
   * throwing when the feed is down: a stale rate with a visible observedAt is
   * more useful than a 500, and the operator can always quote manually.
   */
  refresh: rbacProcedure("payments.fx.refresh")
    .input(z.object({ base: currency, quote: currency }))
    .mutation(async ({ input }) => refreshRate(input.base, input.quote)),

  /** An operator quote — the fallback when there is no feed, and an audit row. */
  quote: rbacProcedure("payments.fx.quote")
    .input(z.object({ base: currency, quote: currency, rate: rateString }))
    .mutation(async ({ ctx, input }) => {
      if (input.base === input.quote) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GS-FX-1001 · a currency has no rate against itself",
        });
      }
      const id = await recordRate({
        base: input.base,
        quote: input.quote,
        rate: input.rate,
        source: `operator:${ctx.user.id}`,
        observedAt: new Date(),
      });
      return { id, rate: input.rate };
    }),

  convert: rbacProcedure("payments.fx.convert")
    .input(
      z.object({
        amountMinor: z.bigint(),
        from: currency,
        to: currency,
        rate: rateString.optional(),
      })
    )
    .query(async ({ input }) => {
      let rate = input.rate ?? null;
      let source = "input";
      if (!rate) {
        const quoted = await latestRate(input.from, input.to);
        if (!quoted) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `GS-FX-1002 · no rate on file for ${input.from}/${input.to}`,
          });
        }
        rate = quoted.rate;
        source = quoted.source;
      }
      return {
        amountMinor: convertAtRate(
          input.amountMinor,
          input.from,
          input.to,
          rate
        ),
        currency: input.to,
        rate,
        source,
      };
    }),

  /** Realized gain/loss to date, by invoice currency. */
  position: rbacProcedure("payments.fx.position").query(async () =>
    fxPosition()
  ),
});
