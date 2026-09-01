// Invoices router — sprint spec §5.1.
//
// Every list query uses keyset pagination on (createdAt, id). Offset pagination
// on a table receiving inserts skips and repeats rows, which on a receivables
// ledger means an operator working a queue silently misses invoices.
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import {
  counterparties,
  invoices,
  paymentAllocations,
  providerTransactions,
} from "@db/schema";
import {
  issueInvoice,
  voidInvoice,
  writeOffInvoice,
  VN_VAT_RATES_BP,
} from "../services/payments/invoicing";
import { minorFromDb } from "@contracts/money";
import { SUPPORTED_CURRENCIES } from "@contracts/money";

const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overpaid",
  "void",
  "written_off",
] as const;

const cursorInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

/** Keyset cursor: the (createdAt, id) of the last row the client saw. */
function encodeCursor(createdAt: Date, id: number): string {
  return `${createdAt.toISOString()}|${id}`;
}
function decodeCursor(cursor: string): { createdAt: Date; id: number } | null {
  const [iso, rawId] = cursor.split("|");
  const createdAt = new Date(iso);
  const id = Number(rawId);
  if (Number.isNaN(createdAt.getTime()) || !Number.isInteger(id)) return null;
  return { createdAt, id };
}

/**
 * A roaster_buyer may read only invoices whose counterparty maps to their own
 * roaster (§5.3). Returning an empty list rather than 403 keeps the existence
 * of other tenants' invoices from leaking, matching assertOwnRoaster's posture.
 */
async function counterpartyIdsFor(roasterId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ id: counterparties.id })
    .from(counterparties)
    .where(eq(counterparties.roasterId, roasterId));
  return rows.map(r => r.id);
}

// Roles come from contracts/rbac.ts so the table cannot drift from the router.

export const invoicesRouter = createRouter({
  list: rbacProcedure("invoices.list")
    .input(
      cursorInput.extend({
        status: z.enum(INVOICE_STATUSES).optional(),
        counterpartyId: z.number().int().positive().optional(),
        currency: z.enum(SUPPORTED_CURRENCIES).optional(),
        /** Only invoices that still owe money — the operator's default view. */
        openOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [isNull(invoices.deletedAt)];

      if (ctx.user.role === "roaster_buyer") {
        const ids = ctx.user.roasterId
          ? await counterpartyIdsFor(ctx.user.roasterId)
          : [];
        if (ids.length === 0) return { items: [], nextCursor: null };
        conditions.push(inArray(invoices.counterpartyId, ids));
      } else if (input.counterpartyId) {
        conditions.push(eq(invoices.counterpartyId, input.counterpartyId));
      }

      if (input.status) conditions.push(eq(invoices.status, input.status));
      if (input.currency)
        conditions.push(eq(invoices.currency, input.currency));
      if (input.openOnly) {
        conditions.push(
          inArray(invoices.status, ["issued", "partially_paid", "overpaid"])
        );
      }

      if (input.cursor) {
        const decoded = decodeCursor(input.cursor);
        if (decoded) {
          conditions.push(
            or(
              lt(invoices.createdAt, decoded.createdAt),
              and(
                eq(invoices.createdAt, decoded.createdAt),
                lt(invoices.id, decoded.id)
              )
            )!
          );
        }
      }

      const rows = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          counterpartyId: invoices.counterpartyId,
          counterpartyName: counterparties.name,
          payableType: invoices.payableType,
          payableId: invoices.payableId,
          currency: invoices.currency,
          subtotalMinor: invoices.subtotalMinor,
          vatMinor: invoices.vatMinor,
          shippingMinor: invoices.shippingMinor,
          totalMinor: invoices.totalMinor,
          paidMinor: invoices.paidMinor,
          issuedAt: invoices.issuedAt,
          dueAt: invoices.dueAt,
          status: invoices.status,
          eInvoiceStatus: invoices.eInvoiceStatus,
          memoToken: invoices.memoToken,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .leftJoin(
          counterparties,
          eq(counterparties.id, invoices.counterpartyId)
        )
        .where(and(...conditions))
        .orderBy(desc(invoices.createdAt), desc(invoices.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = (hasMore ? rows.slice(0, input.limit) : rows).map(r => ({
        ...r,
        subtotalMinor: minorFromDb(r.subtotalMinor),
        vatMinor: minorFromDb(r.vatMinor),
        shippingMinor: minorFromDb(r.shippingMinor),
        totalMinor: minorFromDb(r.totalMinor),
        paidMinor: minorFromDb(r.paidMinor),
        outstandingMinor: minorFromDb(r.totalMinor) - minorFromDb(r.paidMinor),
      }));

      const last = items[items.length - 1];
      return {
        items,
        nextCursor:
          hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
      };
    }),

  byId: rbacProcedure("invoices.byId")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
      });
      if (!invoice)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-INV-1007 · not found",
        });

      if (ctx.user.role === "roaster_buyer") {
        const ids = ctx.user.roasterId
          ? await counterpartyIdsFor(ctx.user.roasterId)
          : [];
        if (!ids.includes(invoice.counterpartyId)) {
          // 404, not 403: existence must not leak across tenants.
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "GS-GEN-1005 · resource not found",
          });
        }
      }

      const counterparty = await db.query.counterparties.findFirst({
        where: eq(counterparties.id, invoice.counterpartyId),
      });

      // Full payment history: allocations AND reversals, because "why does this
      // invoice show ₫0 paid when I saw a transfer" is the question this screen
      // exists to answer (§8.2).
      const history = await db
        .select({
          allocationId: paymentAllocations.id,
          amountMinor: paymentAllocations.amountMinor,
          currency: paymentAllocations.currency,
          fxRate: paymentAllocations.fxRate,
          allocatedByUserId: paymentAllocations.allocatedByUserId,
          reversedAt: paymentAllocations.reversedAt,
          reversalReason: paymentAllocations.reversalReason,
          createdAt: paymentAllocations.createdAt,
          provider: providerTransactions.provider,
          providerTxnId: providerTransactions.providerTxnId,
          description: providerTransactions.description,
          occurredAt: providerTransactions.occurredAt,
        })
        .from(paymentAllocations)
        .innerJoin(
          providerTransactions,
          eq(providerTransactions.id, paymentAllocations.providerTransactionId)
        )
        .where(eq(paymentAllocations.invoiceId, invoice.id))
        .orderBy(asc(paymentAllocations.id));

      return {
        ...invoice,
        subtotalMinor: minorFromDb(invoice.subtotalMinor),
        vatMinor: minorFromDb(invoice.vatMinor),
        shippingMinor: minorFromDb(invoice.shippingMinor),
        totalMinor: minorFromDb(invoice.totalMinor),
        paidMinor: minorFromDb(invoice.paidMinor),
        outstandingMinor:
          minorFromDb(invoice.totalMinor) - minorFromDb(invoice.paidMinor),
        counterpartyName:
          counterparty?.name ?? `Counterparty ${invoice.counterpartyId}`,
        counterpartyCountry: counterparty?.country ?? "",
        bankAccountLast4: counterparty?.bankAccountLast4 ?? null,
        allocations: history.map(h => ({
          ...h,
          amountMinor: minorFromDb(h.amountMinor),
        })),
      };
    }),

  issue: rbacProcedure("invoices.issue")
    .input(
      z.object({
        payableType: z.enum(["order", "contract"]),
        payableId: z.number().int().positive(),
        counterpartyId: z.number().int().positive(),
        currency: z.enum(SUPPORTED_CURRENCIES),
        subtotalMinor: z.bigint().nonnegative(),
        // Basis points. R4 owns which rate applies to which sale; the schema
        // only insists it is one of the legal Vietnamese rates.
        vatRateBp: z
          .number()
          .int()
          .refine(v => (VN_VAT_RATES_BP as readonly number[]).includes(v), {
            message: `vatRateBp must be one of ${VN_VAT_RATES_BP.join(", ")}`,
          }),
        shippingMinor: z.bigint().nonnegative().default(0n),
        issuedAt: z.date().default(() => new Date()),
        dueAt: z.date(),
        notes: z.string().max(500).optional(),
        residencyOverrideNote: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // The FX-control override is an ops_manager decision, not a sales one.
      if (input.residencyOverrideNote && ctx.user.role === "sales_csm") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "GS-INV-1009 · a residency override requires ops_manager",
        });
      }
      return issueInvoice({ ...input, createdByUserId: ctx.user.id });
    }),

  void: rbacProcedure("invoices.void")
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().min(3).max(255),
      })
    )
    .mutation(async ({ ctx, input }) =>
      voidInvoice(input.id, input.reason, ctx.user.id)
    ),

  writeOff: rbacProcedure("invoices.writeOff")
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().min(3).max(255),
      })
    )
    .mutation(async ({ ctx, input }) =>
      writeOffInvoice(input.id, input.reason, ctx.user.id)
    ),

  counterparties: rbacProcedure("invoices.counterparties")
    .input(z.object({ search: z.string().max(120).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [isNull(counterparties.deletedAt)];
      if (input?.search) {
        conditions.push(
          sql`${counterparties.name} LIKE ${`%${input.search}%`}`
        );
      }
      return db
        .select({
          id: counterparties.id,
          name: counterparties.name,
          type: counterparties.type,
          country: counterparties.country,
          bankName: counterparties.bankName,
          bankAccountLast4: counterparties.bankAccountLast4,
          isIndividual: counterparties.isIndividual,
          partnerId: counterparties.partnerId,
          roasterId: counterparties.roasterId,
        })
        .from(counterparties)
        .where(and(...conditions))
        .orderBy(asc(counterparties.name))
        .limit(200);
    }),
});
