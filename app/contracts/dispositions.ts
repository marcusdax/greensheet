// Exception disposition, fault attribution and re-pricing — Supplier Agreement
// §B and §C.
//
// Every number in this file is a contract term someone signed. The formulas are
// pure and the caps are enforced here rather than at the call site, because a
// cap applied inconsistently is worse than no cap: it makes the contract mean
// different things depending on which screen you settled from.
//
// Money is integer cents throughout, matching the partners context. The lot
// quantities here are pounds and the prices cents-per-pound, so every product
// is rounded explicitly at the point it becomes money — never accumulated as a
// float and rounded at the end.

export const DISPOSITIONS = [
  "release",
  "downgrade",
  "reject_claim",
  "reverify_partition",
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export type DispositionSpec = {
  label: string;
  trigger: string;
  outcome: string;
  /** Business days from sign-off, per §B.1. */
  timelineDays: number;
  supplierObligation: string;
  /** Cost the supplier may be asked to reimburse, in cents. Null where §B.1 sets none. */
  costCapCents: { tier1: number; tier2: number } | { flat: number } | null;
};

export const DISPOSITION_SPECS: Record<Disposition, DispositionSpec> = {
  release: {
    label: "Release (explained)",
    trigger:
      "Variance explained by documented physics — moisture loss, measurement variation, customs inspection — or the documentation discrepancy is corrected.",
    outcome:
      "Lot returns to Verified, or Verified with noted variance for a Tier 1. No price adjustment.",
    timelineDays: 0,
    supplierObligation:
      "Reimburse re-weighing, re-cupping or laboratory fees only where the variance traces to the supplier's scale or documentation.",
    // §B.1 — USD $500 per event for Tier 1, USD $1,500 for Tier 2.
    costCapCents: { tier1: 50_000, tier2: 150_000 },
  },
  downgrade: {
    label: "Downgrade (quality deviation)",
    trigger:
      "Authentic and unblended, but degraded — moisture drift, defect increase, cup-score decline against the retained sample — within a range that still permits sale.",
    outcome:
      "Re-priced per §C.1 and relabelled with full traceability. Greensheet nets the revised invoice against the original purchase price.",
    timelineDays: 5,
    supplierObligation:
      "Accept the revised price unless able to document that the degradation occurred in Greensheet's custody after warehouse receipt.",
    costCapCents: null,
  },
  reject_claim: {
    label: "Reject & claim",
    trigger:
      "Other than represented, adulterated, or degraded past marketability — including cup score below 70, or moisture outside 8–13.5%.",
    outcome:
      "Lot quarantined. Claim for the full purchase price plus holding, analysis and disposal costs, per §C.2.",
    timelineDays: 2,
    supplierObligation:
      "Within 14 days: accept and issue a credit memo, or dispute and request independent evaluation at shared cost.",
    costCapCents: null,
  },
  reverify_partition: {
    label: "Re-verify & partition",
    trigger:
      "Only a subset of bags is compromised — re-stitched or tampered bags, or outlier weight and moisture readings — while the majority is intact.",
    outcome:
      "Affected bags become a Child Lot inheriting the parent's history and re-verified in full. The Parent Lot returns to Verified, its pricing unaffected.",
    timelineDays: 10,
    supplierObligation:
      "Reimburse re-verification where the partition was required by the supplier's handling or documentation.",
    // §B.1 — USD $2,000 per re-verify event.
    costCapCents: { flat: 200_000 },
  },
};

// ─── §B.2 fault attribution ──────────────────────────────────────────────────

export const FAULT_ORIGINS = [
  "supplier",
  "logistics",
  "greensheet",
  "indeterminate",
] as const;
export type FaultOrigin = (typeof FAULT_ORIGINS)[number];

export type FaultSpec = {
  label: string;
  atFault: string;
  consequence: string;
  /** Basis points of the adjustment the supplier bears. 10000 = all of it. */
  supplierShareBp: number;
};

export const FAULT_SPECS: Record<FaultOrigin, FaultSpec> = {
  supplier: {
    label: "Supplier's operation",
    atFault: "Supplier",
    consequence:
      "Bears the re-pricing discount, the full claim, or the re-verification cost.",
    supplierShareBp: 10_000,
  },
  logistics: {
    label: "In transit",
    atFault: "Logistics provider or carrier",
    consequence:
      "Greensheet pursues the carrier's cargo insurance. The supplier is held harmless only on proof of in-transit compromise.",
    supplierShareBp: 0,
  },
  greensheet: {
    label: "Greensheet's operation",
    atFault: "Greensheet",
    consequence:
      "Greensheet absorbs the cost and pursues its own insurance. No re-pricing to the supplier.",
    supplierShareBp: 0,
  },
  indeterminate: {
    label: "Indeterminate",
    atFault: "Shared",
    consequence:
      "Each party bears half of the re-pricing discount or claim value.",
    supplierShareBp: 5_000,
  },
};

/**
 * §B.2 — "In the absence of such proof, the failure is attributed to Supplier."
 *
 * The burden of proof sits with the supplier, so this resolves to `supplier`
 * unless evidence was actually filed. Encoding the default matters: the failure
 * mode otherwise is an investigation that stalls, defaults to nobody, and
 * quietly leaves Greensheet carrying it.
 */
export function attributeFault(args: {
  claimedOrigin: FaultOrigin;
  /** A customs report, carrier claim, or timestamped environmental data (§B.2). */
  proofFiled: boolean;
}): { origin: FaultOrigin; reason: string } {
  if (args.claimedOrigin === "supplier") {
    return {
      origin: "supplier",
      reason: "Attributed to the supplier's operation.",
    };
  }
  if (args.claimedOrigin === "greensheet") {
    // Nobody needs to prove a case against themselves.
    return {
      origin: "greensheet",
      reason: "Attributed to Greensheet's own operation; cost absorbed here.",
    };
  }
  if (!args.proofFiled) {
    return {
      origin: "supplier",
      reason:
        "No proof filed that the failure originated outside the supplier's custody, so §B.2 attributes it to the supplier.",
    };
  }
  return {
    origin: args.claimedOrigin,
    reason: `Proof filed for a ${FAULT_SPECS[args.claimedOrigin].label.toLowerCase()} origin.`,
  };
}

// ─── §C.1 downgrade re-pricing ───────────────────────────────────────────────

/** §C.1 — the reduction may not exceed half the original price. */
export const MAX_DOWNGRADE_REDUCTION_BP = 5_000;

export type DowngradeInput = {
  quantityLbs: number;
  originalPricePerLbCents: number;
  /** Benchmark for the downgraded grade, per §C.1 (ICE Robusta plus differentials). */
  downgradeGradePricePerLbCents: number;
  /** Analysis, hold and relabelling, in cents. §C.1 puts this at $300–$1,000. */
  operationalCostCents: number;
  faultOrigin: FaultOrigin;
};

export type DowngradeResult = {
  degradationFactorBp: number;
  adjustedPricePerLbCents: number;
  originalInvoiceCents: number;
  adjustedInvoiceCents: number;
  /** Positive: owed back to the supplier's account as a credit. */
  creditDueCents: number;
  /** The share of that credit the supplier actually bears, after §B.2. */
  supplierBorneCents: number;
  capApplied: boolean;
  explanation: string;
};

/**
 * §C.1's formula, with its cap.
 *
 *   ADJUSTED = (ORIGINAL × DEGRADATION_FACTOR) + OPS_COST
 *
 * The cap is the part worth reading twice: "the price reduction shall not
 * exceed 50% of the original price... This prevents predatory re-pricing while
 * ensuring Greensheet's cost is recovered." A downgrade is a discount, not a
 * mechanism for taking a lot at any price the market happens to offer that day.
 *
 * Note the operational cost is ADDED, which softens the reduction rather than
 * deepening it — it is Greensheet recovering its own handling, not a penalty.
 * Applying it with the wrong sign would silently invert the clause.
 *
 * ── An unresolved ambiguity in §C.1, flagged rather than hidden ──────────────
 *
 * §C.1 defines the operational cost as a TOTAL: "Analysis fees + Hold/logistics
 * + Downgrade labeling (typically USD $300–$1,000 depending on lot size and
 * analysis scope)". Its own worked example then adds that total straight onto a
 * PER-POUND price:
 *
 *     ADJUSTED_PRICE = ($4.50 × 0.711) + $500 (ops cost) = $3.70/lb
 *
 * $3.20 + $0.50 = $3.70 only if "$500" means "$0.50 per pound". On 40,000 lbs
 * that is $20,000 of operational cost, not $500.
 *
 * This implementation follows the DEFINITION and divides the total across the
 * lot, because a dollar figure with a "$300–$1,000 depending on lot size" range
 * cannot also be a per-pound rate. On the clause's own example that yields
 * $3.21/lb and a credit of $51,600, against the $3.70/lb and $32,000 the
 * example prints — a $19,600 difference on one lot, in Greensheet's favour as
 * written.
 *
 * Both readings are encoded in the tests so the difference is visible. This is
 * a contract defect for counsel to resolve, not a modelling choice: whichever
 * way it is settled, the agreement text should be corrected to match.
 */
export function calculateDowngrade(input: DowngradeInput): DowngradeResult {
  if (input.originalPricePerLbCents <= 0) {
    throw new Error("GS-PRT-1010 · original price must be positive");
  }
  if (input.quantityLbs <= 0) {
    throw new Error("GS-PRT-1011 · quantity must be positive");
  }

  const degradationFactorBp = Math.round(
    (input.downgradeGradePricePerLbCents / input.originalPricePerLbCents) *
      10_000
  );

  const perLbFromFormula =
    Math.round((input.originalPricePerLbCents * degradationFactorBp) / 10_000) +
    Math.round(input.operationalCostCents / input.quantityLbs);

  // The floor the cap sets: no more than half the original price may come off.
  const cappedFloorPerLb = Math.round(
    (input.originalPricePerLbCents * (10_000 - MAX_DOWNGRADE_REDUCTION_BP)) /
      10_000
  );

  const capApplied = perLbFromFormula < cappedFloorPerLb;
  const adjustedPricePerLbCents = capApplied
    ? cappedFloorPerLb
    : perLbFromFormula;

  const originalInvoiceCents =
    input.quantityLbs * input.originalPricePerLbCents;
  const adjustedInvoiceCents = input.quantityLbs * adjustedPricePerLbCents;
  const creditDueCents = Math.max(
    0,
    originalInvoiceCents - adjustedInvoiceCents
  );

  const shareBp = FAULT_SPECS[input.faultOrigin].supplierShareBp;
  const supplierBorneCents = Math.round((creditDueCents * shareBp) / 10_000);

  return {
    degradationFactorBp,
    adjustedPricePerLbCents,
    originalInvoiceCents,
    adjustedInvoiceCents,
    creditDueCents,
    supplierBorneCents,
    capApplied,
    explanation: capApplied
      ? `Formula reached ${(perLbFromFormula / 100).toFixed(2)}/lb; §C.1 caps the reduction at 50%, holding the price at ${(adjustedPricePerLbCents / 100).toFixed(2)}/lb.`
      : `Degradation factor ${(degradationFactorBp / 100).toFixed(1)}% of the original price, plus operational cost.`,
  };
}

// ─── §C.2 reject & claim ─────────────────────────────────────────────────────

/** §C.2 — the total claim may not exceed 110% of the purchase price. */
export const MAX_CLAIM_BP = 11_000;
/** §C.2 — holding costs are capped at 30 days. */
export const MAX_HOLDING_DAYS = 30;

export type ClaimInput = {
  purchasePriceCents: number;
  holdingCostPerDayCents: number;
  daysHeld: number;
  analysisCostCents: number;
  disposalCostCents: number;
  faultOrigin: FaultOrigin;
};

export type ClaimResult = {
  purchasePriceCents: number;
  holdingCostCents: number;
  holdingDaysCharged: number;
  analysisCostCents: number;
  disposalCostCents: number;
  subtotalCents: number;
  totalClaimCents: number;
  supplierBorneCents: number;
  capApplied: boolean;
  explanation: string;
};

/**
 * §C.2's claim, with both of its caps.
 *
 * Two separate limits, and they bite in different places: holding is capped at
 * 30 days first, then the whole claim at 110% of the purchase price. The clause
 * says why — "this prevents claiming holding costs that exceed the lot's value;
 * excess holding is absorbed by Greensheet." A claim that can grow without
 * bound just by leaving coffee in a warehouse is a claim that rewards delay.
 */
export function calculateClaim(input: ClaimInput): ClaimResult {
  const holdingDaysCharged = Math.min(
    Math.max(0, input.daysHeld),
    MAX_HOLDING_DAYS
  );
  const holdingCostCents = holdingDaysCharged * input.holdingCostPerDayCents;

  const subtotalCents =
    input.purchasePriceCents +
    holdingCostCents +
    input.analysisCostCents +
    input.disposalCostCents;

  const ceiling = Math.round(
    (input.purchasePriceCents * MAX_CLAIM_BP) / 10_000
  );
  const capApplied = subtotalCents > ceiling;
  const totalClaimCents = capApplied ? ceiling : subtotalCents;

  const shareBp = FAULT_SPECS[input.faultOrigin].supplierShareBp;
  const supplierBorneCents = Math.round((totalClaimCents * shareBp) / 10_000);

  const notes: string[] = [];
  if (input.daysHeld > MAX_HOLDING_DAYS) {
    notes.push(
      `Holding charged for ${MAX_HOLDING_DAYS} of ${input.daysHeld} days; the remainder is absorbed by Greensheet (§C.2).`
    );
  }
  if (capApplied) {
    notes.push(
      `Claim capped at 110% of the purchase price, reducing it by ${((subtotalCents - totalClaimCents) / 100).toFixed(2)} (§C.2).`
    );
  }

  return {
    purchasePriceCents: input.purchasePriceCents,
    holdingCostCents,
    holdingDaysCharged,
    analysisCostCents: input.analysisCostCents,
    disposalCostCents: input.disposalCostCents,
    subtotalCents,
    totalClaimCents,
    supplierBorneCents,
    capApplied,
    explanation: notes.join(" ") || "Within both caps; claimed in full.",
  };
}

// ─── §C.3 notice thresholds ──────────────────────────────────────────────────

/** §C.3 — an adjustment above 5% needs written notice within 48 hours. */
export const NOTICE_REQUIRED_BP = 500;
export const NOTICE_HOURS = 48;
/** §C.3 — the supplier may request a second evaluation within 5 business days. */
export const SECOND_EVALUATION_DAYS = 5;

export function requiresWrittenNotice(
  originalInvoiceCents: number,
  adjustmentCents: number
): boolean {
  if (originalInvoiceCents <= 0) return false;
  return (
    (Math.abs(adjustmentCents) * 10_000) / originalInvoiceCents >
    NOTICE_REQUIRED_BP
  );
}

// ─── §D.4 statute of limitations ─────────────────────────────────────────────

export const CLAIM_WINDOWS = {
  /** §D.4 — 60 days from detection, during the warehouse holding period. */
  standardDays: 60,
  /** §D.4 — 90 days where the defect is latent, found via a customer complaint. */
  latentDefectDays: 90,
  /** §D.4 — no limit for suspected fraud, but notice within a year or it is forfeited. */
  fraudNoticeDays: 365,
  /** §D.4 — the supplier's own counterclaim window. */
  counterclaimDays: 14,
} as const;

export type ClaimBasis = "standard" | "latent_defect" | "fraud";

export type ClaimWindowCheck = {
  withinWindow: boolean;
  deadlineDays: number;
  daysElapsed: number;
  reason: string;
};

/**
 * §D.4 — whether a claim may still be initiated.
 *
 * Fraud has no limitation period on the claim itself, only on notice, so the
 * two are checked separately. Collapsing them would forfeit a fraud claim at
 * day 366 that the clause expressly preserves.
 */
export function checkClaimWindow(args: {
  basis: ClaimBasis;
  detectedAt: Date;
  now?: Date;
}): ClaimWindowCheck {
  const now = args.now ?? new Date();
  const daysElapsed = Math.floor(
    (now.getTime() - args.detectedAt.getTime()) / 86_400_000
  );

  const deadlineDays =
    args.basis === "latent_defect"
      ? CLAIM_WINDOWS.latentDefectDays
      : args.basis === "fraud"
        ? CLAIM_WINDOWS.fraudNoticeDays
        : CLAIM_WINDOWS.standardDays;

  const withinWindow = daysElapsed <= deadlineDays;

  const reason = withinWindow
    ? `${deadlineDays - daysElapsed} days remain in the ${deadlineDays}-day window (§D.4).`
    : args.basis === "fraud"
      ? `Notice was due within ${CLAIM_WINDOWS.fraudNoticeDays} days of detection; the right to claim is forfeited (§D.4).`
      : `The ${deadlineDays}-day window closed ${daysElapsed - deadlineDays} days ago (§D.4).`;

  return { withinWindow, deadlineDays, daysElapsed, reason };
}

export function isDisposition(value: string): value is Disposition {
  return (DISPOSITIONS as readonly string[]).includes(value);
}

export function isFaultOrigin(value: string): value is FaultOrigin {
  return (FAULT_ORIGINS as readonly string[]).includes(value);
}
