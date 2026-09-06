// Disposition and claim persistence — Supplier Agreement §B–§D.
//
// The contract layer does the arithmetic; this puts it on the record. Two
// things it deliberately does NOT allow: recording a disposition without a
// resolved fault attribution, and recording a claim without checking §D.4's
// limitation window. Both are the kind of step that gets skipped under time
// pressure and then decides an arbitration two years later.
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  lotDispositions,
  partnerProtections,
  supplierClaims,
} from "@db/schema";
import { emitEvent } from "../../engine";
import {
  CLAIM_WINDOWS,
  DISPOSITION_SPECS,
  FAULT_SPECS,
  attributeFault,
  calculateClaim,
  calculateDowngrade,
  checkClaimWindow,
  requiresWrittenNotice,
  type ClaimBasis,
  type Disposition,
  type FaultOrigin,
} from "@contracts/dispositions";

/** Business days, skipping weekends — the clause counts business days. */
export function addBusinessDays(from: Date, days: number): string {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

export type RecordDispositionInput = {
  exceptionId?: number | null;
  lotId?: number | null;
  lotCode: string;
  partnerId?: number | null;
  disposition: Disposition;
  claimedFaultOrigin: FaultOrigin;
  proofFiled: boolean;
  proofDescription?: string;
  quantityLbs: number;
  originalPricePerLbCents: number;
  downgradeGradePricePerLbCents?: number | null;
  operationalCostCents?: number;
  childLotCode?: string | null;
  rationale?: string;
  decidedByUserId: number;
};

/**
 * Close an exception with one of §B.1's four dispositions.
 *
 * Fault is resolved through §B.2 rather than taken as given: the investigator
 * says where they think the failure originated, and the clause decides what
 * that means given whether proof was actually filed. The claimed and resolved
 * origins are both stored, because the gap between them is the audit trail.
 */
export async function recordDisposition(input: RecordDispositionInput) {
  const db = getDb();

  const fault = attributeFault({
    claimedOrigin: input.claimedFaultOrigin,
    proofFiled: input.proofFiled,
  });

  const spec = DISPOSITION_SPECS[input.disposition];
  let creditDueCents = 0;
  let supplierBorneCents = 0;
  let adjustedPricePerLbCents: number | null = null;
  let capApplied = false;
  let calculation: Record<string, unknown> = {};

  if (input.disposition === "downgrade") {
    if (!input.downgradeGradePricePerLbCents) {
      throw new Error(
        "GS-PRT-1012 · a downgrade needs the benchmark price for the downgraded grade (§C.1)"
      );
    }
    const result = calculateDowngrade({
      quantityLbs: input.quantityLbs,
      originalPricePerLbCents: input.originalPricePerLbCents,
      downgradeGradePricePerLbCents: input.downgradeGradePricePerLbCents,
      operationalCostCents: input.operationalCostCents ?? 0,
      faultOrigin: fault.origin,
    });
    creditDueCents = result.creditDueCents;
    supplierBorneCents = result.supplierBorneCents;
    adjustedPricePerLbCents = result.adjustedPricePerLbCents;
    capApplied = result.capApplied;
    calculation = { ...result };
  }

  const originalInvoiceCents =
    input.quantityLbs * input.originalPricePerLbCents;
  const noticeRequired = requiresWrittenNotice(
    originalInvoiceCents,
    creditDueCents
  );

  const [inserted] = await db.insert(lotDispositions).values({
    exceptionId: input.exceptionId ?? null,
    lotId: input.lotId ?? null,
    lotCode: input.lotCode,
    partnerId: input.partnerId ?? null,
    disposition: input.disposition,
    claimedFaultOrigin: input.claimedFaultOrigin,
    faultOrigin: fault.origin,
    proofFiled: input.proofFiled,
    proofDescription: input.proofDescription ?? "",
    faultReason: fault.reason,
    quantityLbs: input.quantityLbs,
    originalPricePerLbCents: input.originalPricePerLbCents,
    downgradeGradePricePerLbCents: input.downgradeGradePricePerLbCents ?? null,
    operationalCostCents: input.operationalCostCents ?? 0,
    adjustedPricePerLbCents,
    creditDueCents,
    supplierBorneCents,
    capApplied,
    calculation,
    noticeRequired,
    dueAt: addBusinessDays(new Date(), spec.timelineDays),
    childLotCode: input.childLotCode ?? null,
    rationale: input.rationale ?? null,
    decidedByUserId: input.decidedByUserId,
  });
  const id = Number(inserted.insertId);

  await emitEvent("partners.disposition_recorded", "lot_disposition", id, {
    dispositionId: id,
    lotCode: input.lotCode,
    disposition: input.disposition,
    faultOrigin: fault.origin,
    creditDueCents,
    supplierBorneCents,
    capApplied,
    noticeRequired,
  });

  return {
    id,
    faultOrigin: fault.origin,
    faultReason: fault.reason,
    creditDueCents,
    supplierBorneCents,
    adjustedPricePerLbCents,
    capApplied,
    noticeRequired,
    dueAt: addBusinessDays(new Date(), spec.timelineDays),
    calculation,
  };
}

export type RaiseClaimInput = {
  dispositionId: number;
  partnerId?: number | null;
  lotCode: string;
  basis: ClaimBasis;
  detectedAt: Date;
  purchasePriceCents: number;
  holdingCostPerDayCents: number;
  daysHeld: number;
  analysisCostCents: number;
  disposalCostCents: number;
  faultOrigin: FaultOrigin;
  raisedByUserId: number;
};

export type RaiseClaimResult =
  | {
      ok: true;
      id: number;
      total: ReturnType<typeof calculateClaim>;
      responseDueAt: string;
    }
  | { ok: false; reason: string };

/**
 * Raise a §C.2 claim, if §D.4 still allows it.
 *
 * The window is checked before anything is written. A time-barred claim that
 * exists as a draft is worse than none: it looks actionable on a dashboard and
 * cannot be enforced, and somebody will spend a fortnight on it.
 */
export async function raiseClaim(
  input: RaiseClaimInput
): Promise<RaiseClaimResult> {
  const window = checkClaimWindow({
    basis: input.basis,
    detectedAt: input.detectedAt,
  });
  if (!window.withinWindow) {
    return { ok: false, reason: window.reason };
  }

  const total = calculateClaim({
    purchasePriceCents: input.purchasePriceCents,
    holdingCostPerDayCents: input.holdingCostPerDayCents,
    daysHeld: input.daysHeld,
    analysisCostCents: input.analysisCostCents,
    disposalCostCents: input.disposalCostCents,
    faultOrigin: input.faultOrigin,
  });

  const now = new Date();
  // §C.2 — the supplier's 14-day window runs from the notice.
  const responseDueAt = addBusinessDays(now, CLAIM_WINDOWS.counterclaimDays);

  const db = getDb();
  const [inserted] = await db.insert(supplierClaims).values({
    dispositionId: input.dispositionId,
    partnerId: input.partnerId ?? null,
    lotCode: input.lotCode,
    basis: input.basis,
    detectedAt: input.detectedAt,
    purchasePriceCents: input.purchasePriceCents,
    holdingCostPerDayCents: input.holdingCostPerDayCents,
    daysHeld: input.daysHeld,
    holdingDaysCharged: total.holdingDaysCharged,
    analysisCostCents: input.analysisCostCents,
    disposalCostCents: input.disposalCostCents,
    subtotalCents: total.subtotalCents,
    totalClaimCents: total.totalClaimCents,
    supplierBorneCents: total.supplierBorneCents,
    capApplied: total.capApplied,
    status: "notice_issued",
    noticeIssuedAt: now,
    supplierResponseDueAt: responseDueAt,
    raisedByUserId: input.raisedByUserId,
  });
  const id = Number(inserted.insertId);

  await emitEvent("partners.claim_raised", "supplier_claim", id, {
    claimId: id,
    dispositionId: input.dispositionId,
    lotCode: input.lotCode,
    totalClaimCents: total.totalClaimCents,
    supplierBorneCents: total.supplierBorneCents,
    capApplied: total.capApplied,
  });

  return { ok: true, id, total, responseDueAt };
}

export async function listDispositions(partnerId?: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(lotDispositions)
    .where(partnerId ? eq(lotDispositions.partnerId, partnerId) : sql`1=1`)
    .orderBy(desc(lotDispositions.decidedAt))
    .limit(200);
  return rows.map(r => ({
    ...r,
    dispositionLabel: DISPOSITION_SPECS[r.disposition].label,
    faultLabel: FAULT_SPECS[r.faultOrigin].label,
    faultConsequence: FAULT_SPECS[r.faultOrigin].consequence,
  }));
}

export async function listClaims(partnerId?: number) {
  return getDb()
    .select()
    .from(supplierClaims)
    .where(partnerId ? eq(supplierClaims.partnerId, partnerId) : sql`1=1`)
    .orderBy(desc(supplierClaims.createdAt))
    .limit(200);
}

// ─── §9 partner protections ──────────────────────────────────────────────────

export type RaiseProtectionInput = {
  partnerId: number;
  kind:
    | "score_dispute"
    | "scorecard_request"
    | "passthrough_concern"
    | "sla_breach_release";
  lotCode?: string;
  addendumId?: number | null;
  detail?: string;
  tierAtRaise: string;
};

/**
 * Record a partner exercising a §9 right.
 *
 * `tierAtRaise` is captured here rather than looked up later because §9.3's
 * non-retaliation promise is only checkable against a before-state. Without it,
 * "we did not downgrade them for disputing" is an assertion nobody can test.
 */
export async function raiseProtection(input: RaiseProtectionInput) {
  const [inserted] = await getDb()
    .insert(partnerProtections)
    .values({
      partnerId: input.partnerId,
      kind: input.kind,
      lotCode: input.lotCode ?? "",
      addendumId: input.addendumId ?? null,
      detail: input.detail ?? null,
      tierAtRaise: input.tierAtRaise,
    });
  const id = Number(inserted.insertId);
  await emitEvent("partners.protection_raised", "partner", input.partnerId, {
    protectionId: id,
    partnerId: input.partnerId,
    kind: input.kind,
    tierAtRaise: input.tierAtRaise,
  });
  return { id };
}

export type RetaliationCheck = {
  clear: boolean;
  warnings: string[];
  openProtections: number;
};

/**
 * §9.3 — whether a proposed tier downgrade would look like retaliation.
 *
 * This does not block the downgrade. It surfaces the open disputes so the
 * decision is made knowingly and the reasoning is recorded — which is what a
 * non-retaliation clause actually requires. Silently blocking would be worse:
 * a partner whose quality genuinely collapsed could then freeze their own tier
 * by filing a dispute.
 */
export async function checkRetaliation(
  partnerId: number,
  proposedTier: string
): Promise<RetaliationCheck> {
  const open = await getDb()
    .select()
    .from(partnerProtections)
    .where(
      and(
        eq(partnerProtections.partnerId, partnerId),
        eq(partnerProtections.status, "open")
      )
    );

  const warnings = open.map(
    p =>
      `Open ${p.kind.replace(/_/g, " ")} raised ${p.raisedAt.toISOString().slice(0, 10)} while at ${p.tierAtRaise || "an unrecorded tier"} — §9.3 forbids downgrading to ${proposedTier} because of it. Record why this downgrade is on the merits.`
  );

  return {
    clear: warnings.length === 0,
    warnings,
    openProtections: open.length,
  };
}
