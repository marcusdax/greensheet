// Procedure → role table — sprint spec §5.3.
//
// One table, one place, and a test that fails if a procedure is added without
// an entry. The point is that "who may move money" is reviewable in a diff
// rather than scattered across twelve router files.
//
// platform_admin passes everything (see roleProcedure in api/middleware.ts), so
// it is implicit and never listed.
import type { UserRole } from "./constants";

export type ProcedureAccess = {
  /** Roles permitted in addition to platform_admin. */
  roles: UserRole[];
  /** Why this line is what it is — read during review, not by the runtime. */
  note?: string;
};

export const PROCEDURE_RBAC = {
  // ── config ────────────────────────────────────────────────────────────────
  "config.flags": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "read-only; the UI needs it before it can render",
  },
  "config.setFlag": {
    roles: [],
    note: "kill switches are platform_admin only",
  },
  "config.flagDetail": {
    roles: [],
    note: "shows who last flipped each switch; platform_admin only",
  },

  // ── invoices ──────────────────────────────────────────────────────────────
  "invoices.list": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "a roaster_buyer sees only invoices whose counterparty maps to their own roaster",
  },
  "invoices.byId": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "wide by design — a buyer must see their own invoice; the resolver 404s across tenants",
  },
  "invoices.issue": { roles: ["ops_manager", "sales_csm"] },
  "invoices.void": { roles: ["ops_manager"] },
  "invoices.writeOff": { roles: [], note: "§5.3 — platform_admin only" },
  "invoices.counterparties": { roles: ["ops_manager", "sales_csm", "analyst"] },

  // ── e-invoice, TT 78/2021 (§3.5) ──────────────────────────────────────────
  "invoices.einvoice.byInvoice": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "a buyer needs the authority lookup URL for their own tax filing",
  },
  "invoices.einvoice.preview": { roles: ["ops_manager", "analyst"] },
  "invoices.einvoice.submit": {
    roles: ["ops_manager"],
    note: "issuance is irreversible — a wrong e-invoice is corrected by an adjustment, never an edit",
  },
  "invoices.einvoice.pending": { roles: ["ops_manager", "analyst"] },

  // ── payments ──────────────────────────────────────────────────────────────
  "payments.intents.byId": {
    roles: ["ops_manager", "sales_csm", "roaster_buyer"],
  },
  "payments.intents.list": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "payments.intents.create": { roles: ["ops_manager", "sales_csm"] },
  "payments.intents.cancel": { roles: ["ops_manager"] },
  "payments.ar.aging": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "payments.ar.summary": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "payments.ar.reconcile": { roles: ["ops_manager", "analyst"] },
  "payments.transactions.list": { roles: ["ops_manager", "analyst"] },
  "payments.transactions.unmatched": { roles: ["ops_manager", "analyst"] },
  "payments.transactions.ignore": { roles: ["ops_manager"] },
  "payments.transactions.recordManual": {
    roles: ["ops_manager"],
    note: "Slice 1 runs receivables by hand: an operator records a bank transfer they can see in the statement",
  },
  "payments.allocations.create": {
    roles: ["ops_manager"],
    note: "§5.3 — ops_manager or platform_admin",
  },
  "payments.allocations.reverse": {
    roles: ["ops_manager"],
    note: "§5.3 — ops_manager or platform_admin",
  },
  "payments.allocations.byInvoice": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "read-only payment history; a buyer needs to see what we recorded against their invoice",
  },
  "payments.openInvoices": {
    roles: ["ops_manager", "analyst"],
    note: "feeds the allocation dialog's invoice picker in the exception queue",
  },

  // ── e-wallets (§2.2) ──────────────────────────────────────────────────────
  "payments.wallets.charge": {
    roles: ["ops_manager", "sales_csm"],
    note: "creates a checkout deep-link; it cannot move money on its own — only a signed callback can",
  },

  // ── saved payment methods (§3.6) ──────────────────────────────────────────
  "payments.methods.list": { roles: ["ops_manager", "sales_csm"] },
  "payments.methods.register": {
    roles: ["ops_manager"],
    note: "storing a token is storing a standing authority to take money",
  },
  "payments.methods.revoke": {
    roles: ["ops_manager", "sales_csm"],
    note: "deliberately wider than register: withdrawing consent must never be the harder path",
  },

  // ── multi-currency (§3.3) ─────────────────────────────────────────────────
  "payments.fx.latest": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "read-only reference rate; the payment screen shows it to a buyer paying in another currency",
  },
  "payments.fx.history": { roles: ["ops_manager", "analyst"] },
  "payments.fx.convert": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "payments.fx.refresh": { roles: ["ops_manager", "analyst"] },
  "payments.fx.quote": {
    roles: ["ops_manager"],
    note: "an operator-set rate decides a realized gain or loss, so it is as sensitive as an allocation",
  },
  "payments.fx.position": { roles: ["ops_manager", "analyst"] },

  // ── dunning (§3.4) ────────────────────────────────────────────────────────
  "payments.dunning.candidates": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "payments.dunning.plan": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "payments.dunning.run": {
    roles: ["ops_manager"],
    note: "this contacts customers; a dry run is open to sales_csm through .plan",
  },
  "payments.dunning.effectiveness": { roles: ["ops_manager", "sales_csm", "analyst"] },

  // ── traceability tied to payment (§3.8) ───────────────────────────────────
  "payments.provenance.byAllocation": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "the point of §3.8 is that a buyer can see what their money bought",
  },
  "payments.provenance.byContract": {
    roles: ["ops_manager", "sales_csm", "analyst", "roaster_buyer"],
    note: "same read as byAllocation, keyed by contract",
  },
  "payments.provenance.contractsForLot": { roles: ["ops_manager", "analyst"] },

  // ── recurring B2B subscriptions (§3.6) ────────────────────────────────────
  "standingOrders.list": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "standingOrders.byId": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "standingOrders.create": { roles: ["ops_manager", "sales_csm"] },
  "standingOrders.setStatus": { roles: ["ops_manager", "sales_csm"] },
  "standingOrders.generate": {
    roles: ["ops_manager"],
    note: "issues real invoices on a cadence; ops_manager or platform_admin only",
  },

  // ── documents / OCR (Slice 3) ─────────────────────────────────────────────
  "documents.upload": { roles: ["ops_manager", "sales_csm"] },
  "documents.confirmUpload": { roles: ["ops_manager", "sales_csm"] },
  "documents.list": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "documents.byId": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "documents.reviewQueue": { roles: ["ops_manager", "sales_csm", "analyst"] },
  "documents.recordReview": { roles: ["ops_manager", "sales_csm"] },
} as const satisfies Record<string, ProcedureAccess>;

export type RbacProcedurePath = keyof typeof PROCEDURE_RBAC;

export const RBAC_PROCEDURE_PATHS = Object.keys(
  PROCEDURE_RBAC
) as RbacProcedurePath[];

export function rolesFor(path: RbacProcedurePath): UserRole[] {
  return [...PROCEDURE_RBAC[path].roles];
}

/** The review note, if the line carries one. */
export function noteFor(path: RbacProcedurePath): string | undefined {
  return (PROCEDURE_RBAC[path] as ProcedureAccess).note;
}

export function isRbacProcedure(path: string): path is RbacProcedurePath {
  return Object.prototype.hasOwnProperty.call(PROCEDURE_RBAC, path);
}
