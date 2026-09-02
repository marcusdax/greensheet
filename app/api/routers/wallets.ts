// E-wallet checkout — §2.2 (MoMo, ZaloPay).
//
// This is the operator/payer-facing half of the wallet rails; the money-moving
// half is the callback (api/webhooks/{momo,zalopay}.ts). Creating a charge never
// credits AR: it hands back a deep-link and records the checkout URL on the
// intent. AR moves only when a signed callback arrives and is allocated, which
// keeps the ADR-03 trust posture identical across every rail.
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { invoices, paymentIntents } from "@db/schema";
import { minorFromDb } from "@contracts/money";
import { getFlags } from "../services/flags";
import { env } from "../lib/env";
import { emitEvent } from "../engine";
import { createMomoCharge, momoOrderId } from "../services/payments/momo";
import {
  createZaloPayCharge,
  zaloAppTransId,
} from "../services/payments/zalopay";

/** Absolute URLs the wallet redirects the payer back to, and calls us on. */
function walletUrls(provider: "momo" | "zalopay") {
  const base = env.appBaseUrl.replace(/\/$/, "");
  return {
    redirectUrl: `${base}/payments/return`,
    callbackUrl: `${base}/webhooks/${provider}`,
  };
}

export const walletsRouter = createRouter({
  /**
   * Turn an existing payment intent into a wallet checkout.
   *
   * The intent is the unit of idempotency, not this call: a repeat charge on
   * the same intent reuses the same providerOrderCode, so the callback keys on
   * a value we can already trace back to one invoice.
   */
  charge: rbacProcedure("payments.wallets.charge")
    .input(
      z.object({
        intentId: z.number().int().positive(),
        provider: z.enum(["momo", "zalopay"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const flags = await getFlags();
      if (!flags.eWalletPayments) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GS-PAY-1030 · e-wallet payments are disabled",
        });
      }

      const db = getDb();
      const intent = await db.query.paymentIntents.findFirst({
        where: eq(paymentIntents.id, input.intentId),
      });
      if (!intent)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-PAY-1003 · not found",
        });
      if (intent.status !== "awaiting_payment" && intent.status !== "pending") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `GS-PAY-1031 · intent is ${intent.status}`,
        });
      }
      // Both wallets settle in đồng only. Refusing here is better than letting
      // a USD invoice reach the provider and come back as a VND amount.
      if (intent.currency !== "VND") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GS-PAY-1032 · e-wallets settle in VND only",
        });
      }

      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, intent.invoiceId),
      });
      if (!invoice)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GS-PAY-1003 · invoice not found",
        });

      const amountMinor = minorFromDb(intent.amountMinor);
      const urls = walletUrls(input.provider);
      // The memo token travels in the free-text field so a wallet payment
      // reconciles through exactly the same matcher as a bank transfer.
      const description = `${invoice.invoiceNumber} ${invoice.memoToken}`;

      const result =
        input.provider === "momo"
          ? await createMomoCharge({
              orderId: momoOrderId(intent.providerOrderCode),
              requestId: momoOrderId(intent.providerOrderCode),
              amountMinor,
              orderInfo: description,
              redirectUrl: urls.redirectUrl,
              ipnUrl: urls.callbackUrl,
            })
          : await createZaloPayCharge({
              appTransId: zaloAppTransId(intent.providerOrderCode),
              amountMinor,
              description,
              appUser: `cp-${invoice.counterpartyId}`,
              callbackUrl: urls.callbackUrl,
              embedData: { invoiceId: invoice.id, intentId: intent.id },
            });

      if (!result.ok) {
        // A provider refusal is not our bug to swallow: the operator needs to
        // see it so they can fall back to VietQR or a manual transfer (§2.3).
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `GS-PAY-1033 · ${result.reason}`,
        });
      }

      const checkoutUrl = "payUrl" in result ? result.payUrl : result.orderUrl;

      await db
        .update(paymentIntents)
        .set({
          provider: input.provider,
          checkoutUrl,
          status: "awaiting_payment",
        })
        .where(eq(paymentIntents.id, intent.id));

      await emitEvent("payment.checkout_created", "payment_intent", intent.id, {
        paymentIntentId: intent.id,
        invoiceId: invoice.id,
        provider: input.provider,
        providerOrderCode: intent.providerOrderCode,
        amountMinor: amountMinor.toString(),
        currency: intent.currency,
        byUserId: ctx.user.id,
      });

      return {
        intentId: intent.id,
        provider: input.provider,
        checkoutUrl,
        deeplink: "deeplink" in result ? result.deeplink : null,
        qrCodeUrl: "qrCodeUrl" in result ? result.qrCodeUrl : null,
        amountMinor,
        currency: intent.currency,
        memoToken: invoice.memoToken,
      };
    }),
});
