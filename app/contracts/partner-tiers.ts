// Partner and supplier tiers — Revenue Share Agreement §10.1 and Supplier
// Agreement §E.1.
//
// Two different tier systems that are easy to conflate and must not be. The
// PARTNER tier (§10.1) governs how fast a farmer or collector gets paid. The
// SUPPLIER tier (§E.1) governs how much weight variance we tolerate on their
// containers and how long we have to resolve an exception. A partner can be
// Tier A for payment and Tier C for tolerance; they measure different things
// about different relationships.

// ─── §10.1 partner tier: floor payment speed ─────────────────────────────────

export const PARTNER_TIERS = ["tier_a", "tier_b", "tier_c"] as const;
export type PartnerTier = (typeof PARTNER_TIERS)[number];

export type PartnerTierSpec = {
  label: string;
  basis: string;
  /** Business days to pay the floor (§5.5, §10.1). */
  floorPaymentSlaDays: number;
  /** §10.1 — Company bears 100% for farmers, 50/50 for collectors, at every tier. */
  farmerEvaluationCostBp: number;
  collectorEvaluationCostBp: number;
  preShipmentSampleRequired: boolean;
};

export const PARTNER_TIER_SPECS: Record<PartnerTier, PartnerTierSpec> = {
  tier_a: {
    label: "Established",
    basis:
      "12+ months on platform, 3+ lots delivered, no unresolved Tier 3 exceptions.",
    floorPaymentSlaDays: 3,
    farmerEvaluationCostBp: 0,
    collectorEvaluationCostBp: 5_000,
    preShipmentSampleRequired: false,
  },
  tier_b: {
    label: "Standard",
    basis:
      "Newly onboarded or under 12 months; no more than one Tier 2 exception in trailing 12 months.",
    floorPaymentSlaDays: 5,
    farmerEvaluationCostBp: 0,
    collectorEvaluationCostBp: 5_000,
    preShipmentSampleRequired: false,
  },
  tier_c: {
    label: "Provisional",
    basis:
      "First lot, or more than one Tier 2 exception / any unresolved Tier 3 in trailing 12 months.",
    floorPaymentSlaDays: 7,
    farmerEvaluationCostBp: 0,
    collectorEvaluationCostBp: 5_000,
    preShipmentSampleRequired: true,
  },
};

/**
 * §10.1's classification, from the partner's own history.
 *
 * Note that an unresolved Tier 3 exception drops a partner to Provisional
 * regardless of tenure — the clause makes it disqualifying on its own, not one
 * factor among several.
 */
export function classifyPartner(args: {
  monthsOnPlatform: number;
  lotsDelivered: number;
  tier2ExceptionsTrailing12: number;
  unresolvedTier3Exceptions: number;
}): { tier: PartnerTier; reason: string } {
  if (args.unresolvedTier3Exceptions > 0) {
    return {
      tier: "tier_c",
      reason: `${args.unresolvedTier3Exceptions} unresolved Tier 3 exception${args.unresolvedTier3Exceptions === 1 ? "" : "s"} (§10.1).`,
    };
  }
  if (args.lotsDelivered === 0) {
    return {
      tier: "tier_c",
      reason: "First lot; no delivery history yet (§10.1).",
    };
  }
  if (args.tier2ExceptionsTrailing12 > 1) {
    return {
      tier: "tier_c",
      reason: `${args.tier2ExceptionsTrailing12} Tier 2 exceptions in the trailing 12 months (§10.1).`,
    };
  }
  if (args.monthsOnPlatform >= 12 && args.lotsDelivered >= 3) {
    return {
      tier: "tier_a",
      reason: `${args.monthsOnPlatform} months on platform, ${args.lotsDelivered} lots delivered, no unresolved Tier 3 (§10.1).`,
    };
  }
  return {
    tier: "tier_b",
    reason: `Under 12 months or fewer than 3 lots, with no more than one Tier 2 exception (§10.1).`,
  };
}

// ─── §9.1 the floor-payment SLA release ──────────────────────────────────────

/**
 * §9.1 — "The right to sell future Lots elsewhere, without penalty, if Company
 * misses a Floor Payment SLA by more than five (5) business days without cause."
 */
export const SLA_BREACH_GRACE_DAYS = 5;

export type SlaCheck = {
  breached: boolean;
  daysLate: number;
  slaDays: number;
  /** True once §9.1's release is triggered. */
  releaseTriggered: boolean;
  reason: string;
};

/**
 * Whether a floor payment has breached its SLA, and whether §9.1's release has
 * been triggered.
 *
 * This is a right the partner holds against us, so it is computed from our own
 * timestamps rather than waiting for them to claim it. A protection that only
 * activates when the weaker party knows to ask for it is not much of a
 * protection.
 */
export function checkFloorSla(args: {
  tier: PartnerTier;
  verifiedAt: Date;
  paidAt: Date | null;
  now?: Date;
}): SlaCheck {
  const now = args.now ?? new Date();
  const endpoint = args.paidAt ?? now;
  const slaDays = PARTNER_TIER_SPECS[args.tier].floorPaymentSlaDays;
  const elapsed = Math.floor(
    (endpoint.getTime() - args.verifiedAt.getTime()) / 86_400_000
  );
  const daysLate = Math.max(0, elapsed - slaDays);
  const breached = daysLate > 0;
  const releaseTriggered = daysLate > SLA_BREACH_GRACE_DAYS;

  return {
    breached,
    daysLate,
    slaDays,
    releaseTriggered,
    reason: releaseTriggered
      ? `Floor payment is ${daysLate} days past its ${slaDays}-day SLA. Under §9.1 the partner may sell future lots elsewhere without penalty.`
      : breached
        ? `Floor payment is ${daysLate} days past its ${slaDays}-day SLA, within §9.1's 5-day grace.`
        : args.paidAt
          ? `Paid within the ${slaDays}-day SLA.`
          : `${slaDays - elapsed} days remain in the SLA.`,
  };
}

// ─── §E.1 supplier tier: tolerance and exception SLA ─────────────────────────

export const SUPPLIER_TIERS = [
  "supplier_a",
  "supplier_b",
  "supplier_c",
] as const;
export type SupplierTier = (typeof SUPPLIER_TIERS)[number];

export type SupplierTierSpec = {
  label: string;
  basis: string;
  /** Weight tolerance, basis points. 200 = ±2.0%. */
  weightToleranceBp: number;
  tier1SlaHours: number;
  tier2SlaBusinessDays: number;
  preShipmentInspectionRequired: boolean;
};

export const SUPPLIER_TIER_SPECS: Record<SupplierTier, SupplierTierSpec> = {
  supplier_a: {
    label: "Preferred",
    basis:
      ">100,000 lbs annually, <5 Tier 2+ exceptions in 12 months, current Rainforest Alliance or Organic certification.",
    weightToleranceBp: 200,
    tier1SlaHours: 72,
    tier2SlaBusinessDays: 7,
    preShipmentInspectionRequired: false,
  },
  supplier_b: {
    label: "Standard",
    basis: "20,000–100,000 lbs annually, <10 Tier 2+ exceptions in 12 months.",
    weightToleranceBp: 150,
    tier1SlaHours: 48,
    tier2SlaBusinessDays: 5,
    preShipmentInspectionRequired: false,
  },
  supplier_c: {
    label: "Emerging",
    basis:
      "<20,000 lbs annually, new supplier, or >10 Tier 2+ exceptions in 12 months.",
    weightToleranceBp: 100,
    tier1SlaHours: 48,
    tier2SlaBusinessDays: 5,
    preShipmentInspectionRequired: true,
  },
};

/**
 * §E.1's classification.
 *
 * The tolerance runs the opposite way to intuition: the PREFERRED supplier gets
 * the WIDEST band (±2.0%), not the tightest. That is deliberate — a supplier
 * with a long clean record has earned the benefit of the doubt on a marginal
 * reading, while an emerging one is held to ±1.0% until they have history.
 * Implementing it backwards would quietly punish the best suppliers.
 */
export function classifySupplier(args: {
  annualVolumeLbs: number;
  tier2PlusExceptionsTrailing12: number;
  holdsCurrentCertification: boolean;
}): { tier: SupplierTier; reason: string } {
  if (args.tier2PlusExceptionsTrailing12 > 10) {
    return {
      tier: "supplier_c",
      reason: `${args.tier2PlusExceptionsTrailing12} Tier 2+ exceptions in the trailing 12 months (§E.1).`,
    };
  }
  if (
    args.annualVolumeLbs > 100_000 &&
    args.tier2PlusExceptionsTrailing12 < 5 &&
    args.holdsCurrentCertification
  ) {
    return {
      tier: "supplier_a",
      reason: `${args.annualVolumeLbs.toLocaleString()} lbs annually with current certification and fewer than 5 Tier 2+ exceptions (§E.1).`,
    };
  }
  if (
    args.annualVolumeLbs >= 20_000 &&
    args.tier2PlusExceptionsTrailing12 < 10
  ) {
    return {
      tier: "supplier_b",
      reason: `${args.annualVolumeLbs.toLocaleString()} lbs annually with fewer than 10 Tier 2+ exceptions (§E.1).`,
    };
  }
  return {
    tier: "supplier_c",
    reason: `Under 20,000 lbs annually or new supplier (§E.1).`,
  };
}

/** §E.2 — a downgrade needs 30 days' notice and a chance to remediate. */
export const TIER_DOWNGRADE_NOTICE_DAYS = 30;

export function isPartnerTier(v: string): v is PartnerTier {
  return (PARTNER_TIERS as readonly string[]).includes(v);
}
export function isSupplierTier(v: string): v is SupplierTier {
  return (SUPPLIER_TIERS as readonly string[]).includes(v);
}
