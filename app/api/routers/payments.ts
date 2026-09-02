// Payments router — sprint spec §5.2.
//
// Webhooks are NOT here. They are Hono routes mounted before the tRPC
// middleware (api/webhooks/*, B7). This router is the operator surface: intents,
// aging, the exception queue, and manual allocation.
import { z } from "zod";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import {
  counterparties,
  invoices,
  orderCodeSequence,
  paymentAllocations,
  paymentIntents,
  providerTransactions,
} from "@db/schema";
import { writeEvent, emitEvent } from "../engine";
import { minorFromDb, SUPPORTED_CURRENCIES } from "@contracts/money";
import {
  agingReport,
  arSummary,
  ictToday,
  reconcile,
} from "../services/payments/aging";
import { reverseAllocation } from "../services/payments/allocation";
import {
  settleTransactionAgainstInvoice,
  unallocatedResidual,
} from "../services/payments/settlement";
import { fingerprint, withIdempotency } from "../services/payments/idempotency";
import { buildVietQrPayload } from "../services/payments/vietqr";
import { getFlags } from "../services/flags";
import { env } from "../lib/env";
import { walletsRouter } from "./wallets";
import { paymentMethodsRouter } from "./payment-methods";
import { fxRouter } from "./fx";
import { dunningRouter } from "./dunning";
import { provenanceRouter } from "./provenance";

// Roles come from contracts/rbac.ts so the table cannot drift from the router.

const INTENT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * PayOS requires a numeric orderCode unique per merchant. Never Date.now():
 * two concurrent intents in the same millisecond collide (§3.8). This claims
 * one from a dedicated auto-increment table instead.
 */
async function nextOrderCode(): Promise<number> {
  const [res] = await getDb()
    .insert(orderCodeSequence)
    .values({ purpose: "payment_intent" });
  return Number(res.insertId);
}

export const paymentsRouter = createRouter({
  // Phase C/E surfaces live in their own files so this one stays about the
  // receivables spine. They are nested, not mounted at the root, because
  // "payments.*" is the RBAC prefix reviewers already watch.
  wallets: walletsRouter,
  methods: paymentMethodsRouter,
  fx: fxRouter,
  dunning: dunningRouter,
  provenance: provenanceRouter,

  // ── Queries ───────────────────────────────────────────────────────────────
  intents: createRouter({
    byId: rbacProcedure("payments.intents.byId")
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const intent = await getDb().query.paymentIntents.findFirst({
          where: eq(paymentIntents.id, input.id),
        });
        if (!intent)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "GS-PAY-1003 · not found",
          });
        return { ...intent, amountMinor: minorFromDb(intent.amountMinor) };
      }),

    list: rbacProcedure("payments.intents.list")
      .input(
        z.object({
          invoiceId: z.number().int().positive().optional(),
          status: z
            .enum([
              "pending",
              "awaiting_payment",
              "paid",
              "underpaid",
              "overpaid",
              "expired",
              "cancelled",
              "failed",
            ])
            .optional(),
          limit: z.number().int().min(1).max(100).default(25),
        })
      )
      .query(async ({ input }) => {
        const conditions = [];
        if (input.invoiceId)
          conditions.push(eq(paymentIntents.invoiceId, input.invoiceId));
        if (input.status)
          conditions.push(eq(paymentIntents.status, input.status));
        const rows = await getDb()
          .select()
          .from(paymentIntents)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(paymentIntents.id))
          .limit(input.limit);
        return rows.map(r => ({
          ...r,
          amountMinor: minorFromDb(r.amountMinor),
        }));
      }),

    create: rbacProcedure("payments.intents.create")
      .input(
        z.object({
          invoiceId: z.number().int().positive(),
          idempotencyKey: z.string().min(8).max(80),
          provider: z.enum(["payos", "manual"]).default("payos"),
          /** Defaults to the invoice's outstanding balance. */
          amountMinor: z.bigint().positive().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const flags = await getFlags();
        if (!flags.vietqrPayments && input.provider !== "manual") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "GS-PAY-1026 · VietQR settlement is disabled",
          });
        }

        // §7.3 — same key + same body replays; same key + different body is
        // GS-PAY-1001, never a silent replay of the wrong response.
        return withIdempotency(
          {
            principalId: ctx.user.id,
            key: input.idempotencyKey,
            scope: "payments.intents.create",
            request: {
              invoiceId: input.invoiceId,
              provider: input.provider,
              amountMinor: input.amountMinor?.toString() ?? null,
            },
          },
          async () => {
            const db = getDb();
            const invoice = await db.query.invoices.findFirst({
              where: eq(invoices.id, input.invoiceId),
            });
            if (!invoice) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "GS-INV-1007 · invoice not found",
              });
            }

            const outstanding =
              minorFromDb(invoice.totalMinor) - minorFromDb(invoice.paidMinor);
            const amountMinor = input.amountMinor ?? outstanding;
            if (amountMinor <= 0n) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "GS-PAY-1027 · nothing outstanding on this invoice",
              });
            }

            const counterparty = await db.query.counterparties.findFirst({
              where: eq(counterparties.id, invoice.counterpartyId),
            });

            const providerOrderCode = await nextOrderCode();
            const expiresAt = new Date(Date.now() + INTENT_EXPIRY_MS);

            // The QR is built locally so the payment screen renders even when
            // the provider is unreachable, and so the memo token is guaranteed
            // to be the one we will match on (§7.1).
            let qrCodeData: string | null = null;
            if (
              env.merchantBankBin &&
              env.merchantAccountNumber &&
              invoice.currency === "VND"
            ) {
              qrCodeData = buildVietQrPayload({
                bankBin: env.merchantBankBin,
                accountNumber: env.merchantAccountNumber,
                amountMinor,
                currency: invoice.currency,
                addInfo: invoice.memoToken,
                merchantName: env.merchantName,
              });
            }

            const [inserted] = await db.insert(paymentIntents).values({
              invoiceId: invoice.id,
              createdByUserId: ctx.user.id,
              idempotencyKey: input.idempotencyKey,
              requestFingerprint: fingerprint({
                invoiceId: input.invoiceId,
                provider: input.provider,
                amountMinor: amountMinor.toString(),
              }),
              provider: input.provider,
              providerOrderCode,
              amountMinor,
              currency: invoice.currency,
              status: "awaiting_payment",
              qrCodeData,
              expiresAt,
            });
            const id = Number(inserted.insertId);

            await emitEvent("payment.intent_created", "payment_intent", id, {
              paymentIntentId: id,
              invoiceId: invoice.id,
              providerOrderCode,
              amountMinor: amountMinor.toString(),
              currency: invoice.currency,
            });

            return {
              id,
              invoiceId: invoice.id,
              providerOrderCode,
              amountMinor,
              currency: invoice.currency,
              memoToken: invoice.memoToken,
              qrCodeData,
              expiresAt,
              // The manual fallback from §8.3 — some payers will type it.
              beneficiary: {
                bankName: env.merchantBankName,
                accountNumber: env.merchantAccountNumber,
                accountName: env.merchantName,
                counterpartyName: counterparty?.name ?? "",
              },
            };
          }
        );
      }),

    cancel: rbacProcedure("payments.intents.cancel")
      .input(
        z.object({
          id: z.number().int().positive(),
          reason: z.string().max(255).default(""),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = getDb();
        await db
          .update(paymentIntents)
          .set({ status: "cancelled" })
          .where(eq(paymentIntents.id, input.id));
        await emitEvent(
          "payment.intent_cancelled",
          "payment_intent",
          input.id,
          {
            paymentIntentId: input.id,
            reason: input.reason,
            byUserId: ctx.user.id,
          }
        );
        return { id: input.id, status: "cancelled" as const };
      }),
  }),

  ar: createRouter({
    aging: rbacProcedure("payments.ar.aging")
      .input(
        z
          .object({
            counterpartyId: z.number().int().positive().optional(),
            currency: z.enum(SUPPORTED_CURRENCIES).optional(),
            /** YYYY-MM-DD in ICT. Defaults to today in Asia/Ho_Chi_Minh. */
            asOf: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          })
          .optional()
      )
      .query(async ({ input }) => ({
        asOf: input?.asOf ?? ictToday(),
        rows: await agingReport(input ?? {}),
      })),

    summary: rbacProcedure("payments.ar.summary")
      .input(
        z
          .object({
            asOf: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          })
          .optional()
      )
      .query(async ({ input }) => arSummary(input?.asOf)),

    /** §13.3 — the nightly control, also runnable on demand from the UI. */
    reconcile: rbacProcedure("payments.ar.reconcile").query(async () =>
      reconcile()
    ),
  }),

  transactions: createRouter({
    list: rbacProcedure("payments.transactions.list")
      .input(
        z.object({
          matchStatus: z
            .enum([
              "unmatched",
              "matched",
              "ambiguous",
              "ignored",
              "manual_matched",
            ])
            .optional(),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(25),
        })
      )
      .query(async ({ input }) => {
        const conditions = [];
        if (input.matchStatus) {
          conditions.push(
            eq(providerTransactions.matchStatus, input.matchStatus)
          );
        }
        if (input.cursor) {
          const id = Number(input.cursor);
          if (Number.isInteger(id))
            conditions.push(lt(providerTransactions.id, id));
        }

        const rows = await getDb()
          .select({
            id: providerTransactions.id,
            provider: providerTransactions.provider,
            providerTxnId: providerTransactions.providerTxnId,
            signatureValid: providerTransactions.signatureValid,
            amountMinor: providerTransactions.amountMinor,
            currency: providerTransactions.currency,
            description: providerTransactions.description,
            counterAccountNumber: providerTransactions.counterAccountNumber,
            counterAccountName: providerTransactions.counterAccountName,
            occurredAt: providerTransactions.occurredAt,
            receivedAt: providerTransactions.receivedAt,
            matchStatus: providerTransactions.matchStatus,
            matchMethod: providerTransactions.matchMethod,
            matchedInvoiceId: providerTransactions.matchedInvoiceId,
            verifiedAt: providerTransactions.verifiedAt,
            verificationError: providerTransactions.verificationError,
            allocatedMinor: sql<
              string | null
            >`COALESCE((SELECT SUM(a.amountMinor) FROM payment_allocations a WHERE a.providerTransactionId = ${providerTransactions.id} AND a.reversedAt IS NULL), 0)`,
          })
          .from(providerTransactions)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(providerTransactions.id))
          .limit(input.limit + 1);

        const hasMore = rows.length > input.limit;
        const items = (hasMore ? rows.slice(0, input.limit) : rows).map(r => ({
          ...r,
          amountMinor: minorFromDb(r.amountMinor),
          allocatedMinor: minorFromDb(r.allocatedMinor ?? 0),
          residualMinor:
            minorFromDb(r.amountMinor) - minorFromDb(r.allocatedMinor ?? 0),
        }));
        return {
          items,
          nextCursor: hasMore ? String(items[items.length - 1]?.id) : null,
        };
      }),

    /**
     * The exception queue (§8.2) — the most important screen in the sprint.
     * Unmatched, ambiguous, unverified and residual money in one list, because
     * money that is invisible is money that is lost.
     */
    unmatched: rbacProcedure("payments.transactions.unmatched").query(
      async () => {
        const rows = await getDb()
          .select({
            id: providerTransactions.id,
            provider: providerTransactions.provider,
            providerTxnId: providerTransactions.providerTxnId,
            signatureValid: providerTransactions.signatureValid,
            amountMinor: providerTransactions.amountMinor,
            currency: providerTransactions.currency,
            description: providerTransactions.description,
            counterAccountNumber: providerTransactions.counterAccountNumber,
            counterAccountName: providerTransactions.counterAccountName,
            occurredAt: providerTransactions.occurredAt,
            receivedAt: providerTransactions.receivedAt,
            matchStatus: providerTransactions.matchStatus,
            matchMethod: providerTransactions.matchMethod,
            matchedInvoiceId: providerTransactions.matchedInvoiceId,
            verifiedAt: providerTransactions.verifiedAt,
            verificationError: providerTransactions.verificationError,
            allocatedMinor: sql<
              string | null
            >`COALESCE((SELECT SUM(a.amountMinor) FROM payment_allocations a WHERE a.providerTransactionId = ${providerTransactions.id} AND a.reversedAt IS NULL), 0)`,
          })
          .from(providerTransactions)
          .where(
            inArray(providerTransactions.matchStatus, [
              "unmatched",
              "ambiguous",
              "matched",
            ])
          )
          .orderBy(desc(providerTransactions.id))
          .limit(200);

        return rows
          .map(r => {
            const amountMinor = minorFromDb(r.amountMinor);
            const allocatedMinor = minorFromDb(r.allocatedMinor ?? 0);
            const residualMinor = amountMinor - allocatedMinor;
            const reason =
              r.matchStatus === "ambiguous"
                ? "ambiguous"
                : r.provider === "casso" && !r.verifiedAt
                  ? "awaiting_casso_verification"
                  : r.matchStatus === "unmatched"
                    ? "unmatched"
                    : allocatedMinor === 0n
                      ? "matched_awaiting_allocation"
                      : "residual";
            return { ...r, amountMinor, allocatedMinor, residualMinor, reason };
          })
          .filter(r => r.residualMinor > 0n);
      }
    ),

    ignore: rbacProcedure("payments.transactions.ignore")
      .input(
        z.object({
          id: z.number().int().positive(),
          reason: z.string().min(3).max(255),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = getDb();
        const residual = await unallocatedResidual(input.id);
        await db
          .update(providerTransactions)
          .set({ matchStatus: "ignored", ignoredReason: input.reason })
          .where(eq(providerTransactions.id, input.id));
        await emitEvent(
          "payment.transaction_ignored",
          "provider_transaction",
          input.id,
          {
            providerTransactionId: input.id,
            residualMinor: residual.toString(),
            reason: input.reason,
            byUserId: ctx.user.id,
          }
        );
        return { id: input.id, status: "ignored" as const };
      }),

    /**
     * Slice 1 value: with no provider integration at all, an operator can record
     * a transfer they can see in the bank statement and run Vietnamese
     * receivables by hand, correctly, inside the product.
     */
    recordManual: rbacProcedure("payments.transactions.recordManual")
      .input(
        z.object({
          providerTxnId: z.string().min(3).max(120),
          amountMinor: z.bigint().positive(),
          currency: z.enum(SUPPORTED_CURRENCIES),
          description: z.string().max(255).default(""),
          counterAccountNumber: z.string().max(60).optional(),
          counterAccountName: z.string().max(255).optional(),
          occurredAt: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = getDb();
        return db.transaction(async tx => {
          const [res] = await tx.insert(providerTransactions).values({
            provider: "manual",
            providerTxnId: input.providerTxnId,
            rawPayload: {
              recordedByUserId: ctx.user.id,
              ...input,
              amountMinor: input.amountMinor.toString(),
            },
            // An operator reading a bank statement is the verification.
            signatureValid: true,
            verifiedAt: new Date(),
            amountMinor: input.amountMinor,
            currency: input.currency,
            description: input.description,
            counterAccountNumber: input.counterAccountNumber ?? null,
            counterAccountName: input.counterAccountName ?? null,
            occurredAt: input.occurredAt ?? null,
            matchStatus: "unmatched",
          });
          const id = Number(res.insertId);
          await writeEvent(
            tx,
            "payment.transaction_received",
            "provider_transaction",
            id,
            {
              providerTransactionId: id,
              provider: "manual",
              providerTxnId: input.providerTxnId,
              amountMinor: input.amountMinor.toString(),
              currency: input.currency,
              description: input.description,
              signatureValid: true,
            }
          );
          return { id, providerTxnId: input.providerTxnId };
        });
      }),
  }),

  allocations: createRouter({
    byInvoice: rbacProcedure("payments.allocations.byInvoice")
      .input(z.object({ invoiceId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const rows = await getDb()
          .select()
          .from(paymentAllocations)
          .where(eq(paymentAllocations.invoiceId, input.invoiceId))
          .orderBy(desc(paymentAllocations.id));
        return rows.map(r => ({
          ...r,
          amountMinor: minorFromDb(r.amountMinor),
        }));
      }),

    /** Manual match from the exception queue. ops_manager only (§5.3). */
    create: rbacProcedure("payments.allocations.create")
      .input(
        z.object({
          providerTransactionId: z.number().int().positive(),
          invoiceId: z.number().int().positive(),
          /** Omit to settle as much of the invoice as the transfer allows. */
          amountMinor: z.bigint().positive().optional(),
          fxRate: z
            .string()
            .regex(/^\d+(\.\d{1,6})?$/, "fxRate must be a decimal string")
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.amountMinor === undefined) {
          const outcome = await settleTransactionAgainstInvoice({
            providerTransactionId: input.providerTransactionId,
            invoiceId: input.invoiceId,
            allocatedByUserId: ctx.user.id,
            fxRate: input.fxRate ?? null,
          });
          if (outcome.kind !== "allocated") {
            throw new TRPCError({
              code: "CONFLICT",
              message: `GS-PAY-1028 · ${outcome.reason}`,
            });
          }
          return {
            allocationId: outcome.allocation!.allocationId,
            invoiceId: outcome.allocation!.invoiceId,
            paidMinor: outcome.allocation!.paidMinor,
            status: outcome.allocation!.status,
            residualMinor: outcome.residualMinor,
            overpaid: outcome.overpaid,
          };
        }

        const { allocate } = await import("../services/payments/allocation");
        const result = await allocate({
          providerTransactionId: input.providerTransactionId,
          invoiceId: input.invoiceId,
          amountMinor: input.amountMinor,
          currency:
            (
              await getDb().query.providerTransactions.findFirst({
                where: eq(providerTransactions.id, input.providerTransactionId),
              })
            )?.currency ?? "VND",
          fxRate: input.fxRate ?? null,
          allocatedByUserId: ctx.user.id,
        });
        return {
          allocationId: result.allocationId,
          invoiceId: result.invoiceId,
          paidMinor: result.paidMinor,
          status: result.status,
          residualMinor: result.transactionResidualMinor,
          overpaid: false,
        };
      }),

    reverse: rbacProcedure("payments.allocations.reverse")
      .input(
        z.object({
          allocationId: z.number().int().positive(),
          reason: z.string().min(3).max(255),
        })
      )
      .mutation(async ({ ctx, input }) =>
        reverseAllocation({
          allocationId: input.allocationId,
          reason: input.reason,
          reversedByUserId: ctx.user.id,
        })
      ),
  }),

  /** Open invoices for the allocation dialog's picker. */
  openInvoices: rbacProcedure("payments.openInvoices")
    .input(
      z
        .object({ counterpartyId: z.number().int().positive().optional() })
        .optional()
    )
    .query(async ({ input }) => {
      const conditions = [
        inArray(invoices.status, ["issued", "partially_paid", "overpaid"]),
        isNull(invoices.deletedAt),
      ];
      if (input?.counterpartyId)
        conditions.push(eq(invoices.counterpartyId, input.counterpartyId));

      const rows = await getDb()
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          counterpartyId: invoices.counterpartyId,
          counterpartyName: counterparties.name,
          currency: invoices.currency,
          totalMinor: invoices.totalMinor,
          paidMinor: invoices.paidMinor,
          dueAt: invoices.dueAt,
          memoToken: invoices.memoToken,
        })
        .from(invoices)
        .leftJoin(
          counterparties,
          eq(counterparties.id, invoices.counterpartyId)
        )
        .where(and(...conditions))
        .orderBy(desc(invoices.id))
        .limit(200);

      return rows.map(r => ({
        ...r,
        totalMinor: minorFromDb(r.totalMinor),
        paidMinor: minorFromDb(r.paidMinor),
        outstandingMinor: minorFromDb(r.totalMinor) - minorFromDb(r.paidMinor),
      }));
    }),
});
