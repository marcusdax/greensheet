// Vietnamese e-invoice — §3.5, Thông tư 78/2021/TT-BTC. Closes R1.
//
// The previous sprint was explicit that this gap existed: "our invoices table
// is an internal AR record, not a compliant e-invoice. eInvoiceStatus is the
// placeholder." This is the bridge to an authorised provider (VNPT, MISA,
// Viettel), and the audit trail of every exchange with them.
//
// Two rules shape the design:
//
//   1. The authority's number is THEIRS, not ours. `invoices.invoiceNumber` is
//      our internal sequence; the số hóa đơn the authority assigns comes back
//      on the response and is stored separately. Conflating them is how you end
//      up unable to answer "which of these is on the tax return".
//
//   2. Issuance is not reversible. Once the authority issues, a mistake is
//      corrected by an adjustment or replacement invoice, never by editing.
//      That is why `replaced` is a status and there is no update path.
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../queries/connection";
import { counterparties, einvoiceSubmissions, invoices } from "@db/schema";
import { writeEvent } from "../../engine";
import { env } from "../../lib/env";
import { minorFromDb } from "@contracts/money";

export const EINVOICE_PROVIDERS = ["vnpt", "misa", "viettel", "mock"] as const;
export type EinvoiceProvider = (typeof EINVOICE_PROVIDERS)[number];

/** VAT rates TT 78 recognises, in basis points, matching invoices.vatRateBp. */
export const TT78_VAT_RATES_BP = [0, 500, 800, 1000] as const;

export type EinvoiceLine = {
  name: string;
  quantity: number;
  unitPriceMinor: bigint;
  amountMinor: bigint;
  vatRateBp: number;
};

/** The payload shape every provider adapter receives. */
export type EinvoicePayload = {
  sellerTaxCode: string;
  buyerName: string;
  buyerTaxCode: string;
  buyerAddress: string;
  templateCode: string;
  invoiceSeries: string;
  currency: string;
  issuedAt: string;
  subtotalMinor: bigint;
  vatRateBp: number;
  vatMinor: bigint;
  totalMinor: bigint;
  lines: EinvoiceLine[];
  /** Our internal number, sent as the seller's reference. */
  sellerInvoiceNumber: string;
};

export type EinvoiceResult =
  | {
      ok: true;
      authorityInvoiceNumber: string;
      authorityCode: string;
      lookupUrl: string | null;
      raw: Record<string, unknown>;
    }
  | { ok: false; reason: string; raw?: Record<string, unknown> };

export type EinvoiceAdapter = {
  provider: EinvoiceProvider;
  submit: (payload: EinvoicePayload) => Promise<EinvoiceResult>;
};

/**
 * Validate before submitting. Providers reject on these too, but their errors
 * are opaque and rate-limited, and a rejected submission still burns a number
 * on some providers.
 */
export function validatePayload(payload: EinvoicePayload): string[] {
  const problems: string[] = [];
  if (!payload.sellerTaxCode) problems.push("seller tax code (MST) is required");
  if (!/^\d{10}(-\d{3})?$/.test(payload.sellerTaxCode || "")) {
    problems.push("seller tax code must be 10 digits, optionally with a 3-digit branch suffix");
  }
  if (!payload.buyerName) problems.push("buyer name is required");
  // A buyer MST is required for a B2B invoice; a retail buyer may omit it, so
  // this validates the format only when one is supplied.
  if (payload.buyerTaxCode && !/^\d{10}(-\d{3})?$/.test(payload.buyerTaxCode)) {
    problems.push("buyer tax code must be 10 digits, optionally with a 3-digit branch suffix");
  }
  if (!payload.templateCode) problems.push("template code (ký hiệu mẫu số) is required");
  if (!payload.invoiceSeries) problems.push("invoice series (ký hiệu hóa đơn) is required");
  if (!(TT78_VAT_RATES_BP as readonly number[]).includes(payload.vatRateBp)) {
    problems.push(`VAT rate ${payload.vatRateBp}bp is not a recognised TT 78 rate`);
  }
  // A VN e-invoice is denominated in VND unless the sale is an export, which
  // the FX-control rule already gates at issuance.
  if (payload.currency !== "VND") {
    problems.push("e-invoices are issued in VND; a foreign-currency sale needs the export flow");
  }
  if (payload.lines.length === 0) problems.push("at least one line is required");
  if (payload.subtotalMinor + payload.vatMinor !== payload.totalMinor) {
    problems.push("subtotal + VAT must equal the total");
  }
  return problems;
}

/**
 * Development adapter. Deterministic, offline, and clearly fake: the authority
 * number is prefixed MOCK so nobody can mistake one of these for a real
 * issuance in a database dump.
 */
export function mockAdapter(): EinvoiceAdapter {
  return {
    provider: "mock",
    async submit(payload) {
      const problems = validatePayload(payload);
      if (problems.length > 0) {
        return { ok: false, reason: `payload rejected: ${problems.join("; ")}` };
      }
      const serial = payload.sellerInvoiceNumber.replace(/\D/g, "").slice(-8).padStart(8, "0");
      return {
        ok: true,
        authorityInvoiceNumber: `MOCK-${serial}`,
        authorityCode: `MOCKCODE${serial}`,
        lookupUrl: null,
        raw: { mock: true, submittedAt: new Date().toISOString() },
      };
    },
  };
}

/**
 * Generic HTTP adapter for the authorised providers.
 *
 * VNPT, MISA and Viettel differ in endpoint and envelope but all take a signed
 * invoice document and return an authority number plus a lookup code. Keeping
 * one adapter with a per-provider path means the differences stay visible in
 * one file instead of spreading through the service.
 */
export function httpAdapter(provider: EinvoiceProvider, deps: {
  fetchImpl?: typeof fetch;
  apiUrl?: string;
  apiKey?: string;
} = {}): EinvoiceAdapter {
  return {
    provider,
    async submit(payload) {
      const problems = validatePayload(payload);
      if (problems.length > 0) {
        return { ok: false, reason: `payload rejected: ${problems.join("; ")}` };
      }
      const apiUrl = deps.apiUrl ?? env.einvoiceApiUrl;
      const apiKey = deps.apiKey ?? env.einvoiceApiKey;
      if (!apiUrl || !apiKey) {
        return { ok: false, reason: `${provider} e-invoice credentials are not configured` };
      }

      const doFetch = deps.fetchImpl ?? fetch;
      let response: Response;
      try {
        response = await doFetch(`${apiUrl}/invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          // Amounts cross the wire as decimal strings: a provider's JSON parser
          // must never see a float where money was meant.
          body: JSON.stringify({
            provider,
            sellerTaxCode: payload.sellerTaxCode,
            buyer: {
              name: payload.buyerName,
              taxCode: payload.buyerTaxCode,
              address: payload.buyerAddress,
            },
            templateCode: payload.templateCode,
            invoiceSeries: payload.invoiceSeries,
            currency: payload.currency,
            issuedAt: payload.issuedAt,
            sellerInvoiceNumber: payload.sellerInvoiceNumber,
            subtotal: payload.subtotalMinor.toString(),
            vatRate: payload.vatRateBp / 100,
            vat: payload.vatMinor.toString(),
            total: payload.totalMinor.toString(),
            lines: payload.lines.map(l => ({
              name: l.name,
              quantity: l.quantity,
              unitPrice: l.unitPriceMinor.toString(),
              amount: l.amountMinor.toString(),
              vatRate: l.vatRateBp / 100,
            })),
          }),
        });
      } catch (err) {
        return { ok: false, reason: `${provider} API unreachable: ${String(err)}` };
      }
      if (!response.ok) {
        return { ok: false, reason: `${provider} API returned ${response.status}` };
      }

      let raw: Record<string, unknown>;
      try {
        raw = (await response.json()) as Record<string, unknown>;
      } catch {
        return { ok: false, reason: `${provider} API returned a body that is not JSON` };
      }

      const authorityInvoiceNumber = String(raw.invoiceNumber ?? raw.soHoaDon ?? "");
      const authorityCode = String(raw.lookupCode ?? raw.maCQT ?? "");
      if (!authorityInvoiceNumber || !authorityCode) {
        return {
          ok: false,
          reason: `${provider} response carried no authority number or lookup code`,
          raw,
        };
      }
      return {
        ok: true,
        authorityInvoiceNumber,
        authorityCode,
        lookupUrl: raw.lookupUrl ? String(raw.lookupUrl) : null,
        raw,
      };
    },
  };
}

export function adapterFor(provider?: string): EinvoiceAdapter {
  const chosen = (provider ?? env.einvoiceProvider) as EinvoiceProvider;
  return chosen === "mock" ? mockAdapter() : httpAdapter(chosen);
}

/** Build the authority payload from one of our invoices. */
export async function buildPayload(invoiceId: number): Promise<EinvoicePayload> {
  const db = getDb();
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "GS-INV-1007 · not found" });

  const counterparty = await db.query.counterparties.findFirst({
    where: eq(counterparties.id, invoice.counterpartyId),
  });

  const subtotalMinor = minorFromDb(invoice.subtotalMinor);
  const vatMinor = minorFromDb(invoice.vatMinor);
  const shippingMinor = minorFromDb(invoice.shippingMinor);

  const lines: EinvoiceLine[] = [
    {
      name: `Cà phê nhân — ${invoice.invoiceNumber}`,
      quantity: 1,
      unitPriceMinor: subtotalMinor,
      amountMinor: subtotalMinor,
      vatRateBp: invoice.vatRateBp,
    },
  ];
  // Shipping is a separate line on a VN invoice, not folded into the goods.
  if (shippingMinor > 0n) {
    lines.push({
      name: "Phí vận chuyển",
      quantity: 1,
      unitPriceMinor: shippingMinor,
      amountMinor: shippingMinor,
      vatRateBp: invoice.vatRateBp,
    });
  }

  return {
    sellerTaxCode: env.sellerTaxCode,
    buyerName: counterparty?.name ?? "",
    buyerTaxCode: counterparty?.taxId ?? "",
    buyerAddress: [counterparty?.province, counterparty?.country].filter(Boolean).join(", "),
    templateCode: env.einvoiceTemplateCode,
    invoiceSeries: env.einvoiceSeries,
    currency: invoice.currency,
    issuedAt: String(invoice.issuedAt),
    subtotalMinor: subtotalMinor + shippingMinor,
    vatRateBp: invoice.vatRateBp,
    vatMinor,
    totalMinor: minorFromDb(invoice.totalMinor),
    lines,
    sellerInvoiceNumber: invoice.invoiceNumber,
  };
}

export type IssueOutcome =
  | { ok: true; submissionId: number; authorityInvoiceNumber: string; authorityCode: string }
  | { ok: false; submissionId: number; reason: string };

/**
 * Submit an invoice for issuance.
 *
 * Already-issued invoices short-circuit rather than resubmitting: a duplicate
 * issuance is a tax problem, not a retry.
 */
export async function issueEinvoice(
  invoiceId: number,
  opts: { adapter?: EinvoiceAdapter; byUserId?: number } = {}
): Promise<IssueOutcome> {
  const db = getDb();
  const adapter = opts.adapter ?? adapterFor();

  const existing = await db.query.einvoiceSubmissions.findFirst({
    where: and(
      eq(einvoiceSubmissions.invoiceId, invoiceId),
      eq(einvoiceSubmissions.status, "issued")
    ),
  });
  if (existing) {
    return {
      ok: true,
      submissionId: existing.id,
      authorityInvoiceNumber: existing.authorityInvoiceNumber ?? "",
      authorityCode: existing.authorityCode ?? "",
    };
  }

  const payload = await buildPayload(invoiceId);

  const [inserted] = await db.insert(einvoiceSubmissions).values({
    invoiceId,
    provider: adapter.provider,
    status: "submitted",
    templateCode: payload.templateCode,
    invoiceSeries: payload.invoiceSeries,
    requestPayload: JSON.parse(
      JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
    ) as Record<string, unknown>,
    attempts: 1,
    submittedAt: new Date(),
  });
  const submissionId = Number(inserted.insertId);

  const result = await adapter.submit(payload);

  if (!result.ok) {
    await db
      .update(einvoiceSubmissions)
      .set({
        status: "failed",
        errorMessage: result.reason.slice(0, 2000),
        responsePayload: result.raw ?? null,
      })
      .where(eq(einvoiceSubmissions.id, submissionId));
    await db
      .update(invoices)
      .set({ eInvoiceStatus: "failed" })
      .where(eq(invoices.id, invoiceId));

    await writeEvent(db, "einvoice.failed", "invoice", invoiceId, {
      invoiceId,
      submissionId,
      provider: adapter.provider,
      reason: result.reason,
    });
    return { ok: false, submissionId, reason: result.reason };
  }

  await db
    .update(einvoiceSubmissions)
    .set({
      status: "issued",
      authorityInvoiceNumber: result.authorityInvoiceNumber,
      authorityCode: result.authorityCode,
      lookupUrl: result.lookupUrl,
      responsePayload: result.raw,
      issuedAt: new Date(),
    })
    .where(eq(einvoiceSubmissions.id, submissionId));

  // The invoice's own status column is what the UI and the R1 gap-report read.
  await db
    .update(invoices)
    .set({ eInvoiceStatus: "issued", eInvoiceRef: result.authorityInvoiceNumber })
    .where(eq(invoices.id, invoiceId));

  await writeEvent(db, "einvoice.issued", "invoice", invoiceId, {
    invoiceId,
    submissionId,
    provider: adapter.provider,
    authorityInvoiceNumber: result.authorityInvoiceNumber,
    authorityCode: result.authorityCode,
    byUserId: opts.byUserId ?? null,
  });

  return {
    ok: true,
    submissionId,
    authorityInvoiceNumber: result.authorityInvoiceNumber,
    authorityCode: result.authorityCode,
  };
}

/** Domestic invoices still awaiting issuance — the live R1 gap report. */
export async function pendingEinvoices(): Promise<
  { invoiceId: number; invoiceNumber: string; issuedAt: string; totalMinor: bigint; currency: string }[]
> {
  const rows = await getDb()
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      issuedAt: invoices.issuedAt,
      totalMinor: invoices.totalMinor,
      currency: invoices.currency,
    })
    .from(invoices)
    .where(eq(invoices.eInvoiceStatus, "pending"));
  return rows.map(r => ({
    ...r,
    issuedAt: String(r.issuedAt),
    totalMinor: minorFromDb(r.totalMinor),
  }));
}
