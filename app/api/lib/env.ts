import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  // Doc-intake FastAPI service (services/docintake); optional in production.
  docintakeUrl: process.env.DOCINTAKE_URL ?? "http://localhost:8100",

  // ── Payment provider secrets (§12.4) ───────────────────────────────────────
  // These come from the secret manager, never from a committed .env outside
  // local dev. They are deliberately NOT `required()`: a missing key must
  // disable the webhook endpoint (401 on every call), not crash the process on
  // boot and take the rest of the platform with it.
  payosChecksumKey: process.env.PAYOS_CHECKSUM_KEY ?? "",
  payosClientId: process.env.PAYOS_CLIENT_ID ?? "",
  payosApiKey: process.env.PAYOS_API_KEY ?? "",
  payosApiUrl: process.env.PAYOS_API_URL ?? "https://api-merchant.payos.vn/v2",
  cassoWebhookSecret: process.env.CASSO_WEBHOOK_SECRET ?? "",
  cassoApiKey: process.env.CASSO_API_KEY ?? "",
  cassoApiUrl: process.env.CASSO_API_URL ?? "https://oauth.casso.vn/v2",

  // Beneficiary details printed on the invoice and encoded into the VietQR.
  // Without a BIN and account number the QR cannot be built and the payment
  // screen falls back to the manual transfer instructions (§8.3).
  merchantBankBin: process.env.MERCHANT_BANK_BIN ?? "",
  merchantBankName: process.env.MERCHANT_BANK_NAME ?? "",
  merchantAccountNumber: process.env.MERCHANT_ACCOUNT_NUMBER ?? "",
  merchantName: process.env.MERCHANT_NAME ?? "ODASI Technologies",

  /**
   * Our own public origin. Wallets need absolute redirect and callback URLs,
   * and they refuse a localhost callback in production, so this must be set
   * wherever the e-wallet rails are enabled.
   */
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",

  // ── E-wallet credentials (§2.2) ────────────────────────────────────────────
  // Not `required()` for the same reason as the bank rails: a missing key must
  // disable that one wallet, not refuse to boot the platform.
  momoPartnerCode: process.env.MOMO_PARTNER_CODE ?? "",
  momoAccessKey: process.env.MOMO_ACCESS_KEY ?? "",
  momoSecretKey: process.env.MOMO_SECRET_KEY ?? "",
  momoApiUrl: process.env.MOMO_API_URL ?? "https://payment.momo.vn",
  zalopayAppId: process.env.ZALOPAY_APP_ID ?? "",
  zalopayKey1: process.env.ZALOPAY_KEY1 ?? "",
  zalopayKey2: process.env.ZALOPAY_KEY2 ?? "",
  zalopayApiUrl: process.env.ZALOPAY_API_URL ?? "https://openapi.zalopay.vn",

  // ── §3.3 FX and §3.5 e-invoice ─────────────────────────────────────────────
  fxRateApiUrl: process.env.FX_RATE_API_URL ?? "",
  fxRateApiKey: process.env.FX_RATE_API_KEY ?? "",
  einvoiceProvider: process.env.EINVOICE_PROVIDER ?? "mock",
  einvoiceApiUrl: process.env.EINVOICE_API_URL ?? "",
  einvoiceApiKey: process.env.EINVOICE_API_KEY ?? "",
  einvoiceTemplateCode: process.env.EINVOICE_TEMPLATE_CODE ?? "",
  einvoiceSeries: process.env.EINVOICE_SERIES ?? "",
  /** Our own MST, required on every e-invoice we issue. */
  sellerTaxCode: process.env.SELLER_TAX_CODE ?? "",
};
