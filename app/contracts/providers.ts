// Payment provider registry — §2.2 and ADR-03.
//
// Every rail we settle through is described here in one place, because the
// single most important property of a rail is not its API shape but HOW MUCH
// WE TRUST IT. That answer drives whether a callback may move money on its own
// or must be re-fetched first, and it is too important to be rediscovered by
// reading each adapter.
//
// The existing rails were built under this rule already:
//   PayOS  signs its webhook body   → a verified callback may credit AR
//   Casso  proves only shared-secret possession → re-fetch before allocating
//
// The e-wallets slot into the same frame rather than inventing a new one.

export const PAYMENT_PROVIDERS = [
  "payos",
  "casso",
  "momo",
  "zalopay",
  "manual",
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * What a valid callback from this provider actually proves.
 *
 *  `payload_signature` — the body is signed with a shared secret only the
 *      provider and we hold, so a valid signature authenticates the CONTENT.
 *      Such a callback may credit AR directly.
 *
 *  `shared_secret`     — the caller merely proved possession of a static token.
 *      Anyone who obtains it can forge a credit, so the callback is an
 *      untrusted NOTIFICATION: persist it, then re-fetch from the provider API
 *      before any money moves (ADR-03).
 *
 *  `operator`          — a human read a bank statement. The audit trail is the
 *      person, and the record carries their user id.
 */
export type TrustModel = "payload_signature" | "shared_secret" | "operator";

export type ProviderCapabilities = {
  /** Generates a scannable code or deep link the payer acts on. */
  charge: boolean;
  /** Supports programmatic refunds. */
  refund: boolean;
  /** Can charge a stored token without the payer present (§3.6). */
  recurring: boolean;
  /** Exposes a fetch-one-transaction endpoint for verification. */
  lookup: boolean;
};

export type ProviderSpec = {
  provider: PaymentProvider;
  label: string;
  trustModel: TrustModel;
  capabilities: ProviderCapabilities;
  /** ISO 4217 codes this rail can actually settle. */
  currencies: readonly string[];
  /** Webhook path, or null where the rail has no inbound callback. */
  webhookPath: string | null;
  /** Why this rail is trusted the way it is — read during review. */
  trustNote: string;
};

export const PROVIDER_SPECS: Record<PaymentProvider, ProviderSpec> = {
  payos: {
    provider: "payos",
    label: "PayOS (VietQR)",
    trustModel: "payload_signature",
    capabilities: { charge: true, refund: false, recurring: false, lookup: true },
    currencies: ["VND"],
    webhookPath: "/webhooks/payos",
    trustNote:
      "HMAC-SHA256 over the alphabetically sorted data object. A verified callback authenticates the amount, so it may credit AR directly.",
  },
  casso: {
    provider: "casso",
    label: "Casso (bank feed)",
    trustModel: "shared_secret",
    capabilities: { charge: false, refund: false, recurring: false, lookup: true },
    currencies: ["VND"],
    webhookPath: "/webhooks/casso",
    trustNote:
      "Static token in a header, no payload signature and no replay protection. Untrusted notification: allocation is refused until an API re-fetch stamps verifiedAt (ADR-03).",
  },
  momo: {
    provider: "momo",
    label: "MoMo e-wallet",
    trustModel: "payload_signature",
    capabilities: { charge: true, refund: true, recurring: true, lookup: true },
    currencies: ["VND"],
    webhookPath: "/webhooks/momo",
    trustNote:
      "HMAC-SHA256 over a fixed-order parameter string that includes amount, orderId and resultCode. A valid signature authenticates the amount, so a successful IPN may credit AR directly.",
  },
  zalopay: {
    provider: "zalopay",
    label: "ZaloPay e-wallet",
    trustModel: "payload_signature",
    capabilities: { charge: true, refund: true, recurring: true, lookup: true },
    currencies: ["VND"],
    webhookPath: "/webhooks/zalopay",
    trustNote:
      "HMAC-SHA256 MAC over the callback's own `data` string. The signed data carries the amount and zp_trans_id, so a valid MAC may credit AR directly.",
  },
  manual: {
    provider: "manual",
    label: "Manual bank transfer",
    trustModel: "operator",
    capabilities: { charge: false, refund: false, recurring: false, lookup: false },
    currencies: ["VND", "USD", "EUR", "JPY"],
    webhookPath: null,
    trustNote:
      "An operator reading a bank statement. The record carries their user id, and that person is the audit trail.",
  },
};

export function providerSpec(provider: PaymentProvider): ProviderSpec {
  return PROVIDER_SPECS[provider];
}

/**
 * Does a callback from this provider need an API re-fetch before it may move
 * money? This is the one question the allocation service asks (GS-PAY-1006).
 */
export function requiresVerification(provider: PaymentProvider): boolean {
  return PROVIDER_SPECS[provider].trustModel === "shared_secret";
}

/** Rails that can charge a stored token without the payer present (§3.6). */
export function recurringCapableProviders(): PaymentProvider[] {
  return PAYMENT_PROVIDERS.filter(p => PROVIDER_SPECS[p].capabilities.recurring);
}

export function supportsCurrency(
  provider: PaymentProvider,
  currency: string
): boolean {
  return PROVIDER_SPECS[provider].currencies.includes(currency);
}
