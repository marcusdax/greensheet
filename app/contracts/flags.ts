// Runtime feature flags — ADR-05.
//
// v1 used build-time VITE_ENABLE_* variables (G8): you could not kill a
// misbehaving payment flow without a redeploy. These are read from the API,
// cached briefly, and overridable by env var for local development only.
//
// `autoAllocation` is a kill switch, not a convenience. §13.4 ships Slice 2 to
// production with it OFF and a human confirming every match for two weeks.

export const FEATURE_FLAGS = {
  ocrUpload: {
    default: false,
    description:
      "Document intake: upload, scan and OCR proposal pipeline (Slice 3)",
  },
  vietqrPayments: {
    default: false,
    description:
      "VietQR payment intents, QR rendering and provider webhooks (Slice 2)",
  },
  autoAllocation: {
    default: false,
    description:
      "Kill switch: allocate a matched transaction to its invoice without a human click",
  },
  eWalletPayments: {
    default: false,
    description:
      "MoMo and ZaloPay charges and callbacks (§2.2, Phase C)",
  },
  dunning: {
    default: false,
    description:
      "Automated overdue-invoice ladder: reminders, call tasks, installment offers (§3.4)",
  },
  eInvoice: {
    default: false,
    description:
      "Submit issued invoices to an authorised Vietnamese e-invoice provider (§3.5, R1)",
  },
  standingOrders: {
    default: false,
    description:
      "Recurring B2B subscriptions: auto-generate invoices on a cadence (§3.6)",
  },
  autoCharge: {
    default: false,
    description:
      "Kill switch: charge a saved e-wallet token without the payer present (§3.6)",
  },
  outboxConsumer: {
    default: false,
    description:
      "Dispatch domain events from the outbox consumer instead of the legacy inline path (§4.1)",
  },
} as const;

export type FlagKey = keyof typeof FEATURE_FLAGS;
export type Flags = Record<FlagKey, boolean>;

export const FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FlagKey[];

export function defaultFlags(): Flags {
  return Object.fromEntries(
    FLAG_KEYS.map(k => [k, FEATURE_FLAGS[k].default])
  ) as Flags;
}

export function isFlagKey(value: string): value is FlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, value);
}

/** Client cache window (§8.1): a flag change reaches the UI within 30s. */
export const FLAG_CACHE_MS = 30_000;
/** Server cache window — short enough that a kill switch bites in under a minute. */
export const FLAG_SERVER_CACHE_MS = 10_000;
