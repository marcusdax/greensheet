// Trust Score — the honesty layer. Spec §2.
//
// One number, 0–100, answering "how much evidence stands behind this claim?"
// It is deliberately NOT a rating: nobody can give themselves one, and no
// self-reported field moves it. Only verifiable actions do — an OCR document a
// human accepted, an invoice settled on time, a cupping that matched what was
// claimed.
//
// Three rules the rest of the system depends on:
//
//   1. A score is always displayed with its band. A bare "68" tells a buyer
//      nothing; "68 · Established" tells them where it sits.
//   2. Every score carries the MODEL_VERSION that produced it. Weights are
//      going to change, and a snapshot taken under v1 must still render as it
//      did then rather than being silently re-interpreted under v2.
//   3. Absence of evidence is not evidence of dishonesty. A brand-new
//      counterparty starts at NEUTRAL_SCORE, not at zero, and uploading a
//      blurry photo that never gets accepted moves nothing at all.

/** Bumped whenever a weight, band edge or component definition changes. */
export const MODEL_VERSION = "v1.0";

/** A counterparty with no history is unknown, not untrustworthy. */
export const NEUTRAL_SCORE = 50;

export const TRUST_ENTITY_TYPES = ["counterparty", "roaster", "lot"] as const;
export type TrustEntityType = (typeof TRUST_ENTITY_TYPES)[number];

// ─── §2.2 components ─────────────────────────────────────────────────────────

export const TRUST_COMPONENTS = [
  "documentVerification",
  "transactionIntegrity",
  "qualityConsistency",
  "identityLongevity",
  "networkReputation",
] as const;
export type TrustComponent = (typeof TRUST_COMPONENTS)[number];

export type ComponentSpec = {
  /** Basis points, so the weights sum exactly and never drift by float. */
  weightBp: number;
  label: string;
  /** Shown in the Trust panel so a low bar is explicable, not mysterious. */
  description: string;
};

export const COMPONENT_SPECS: Record<TrustComponent, ComponentSpec> = {
  documentVerification: {
    weightBp: 3_500,
    label: "Document Verification",
    description:
      "Accepted OCR documents — lab reports, contracts, phytosanitary certificates, warehouse receipts. Weighted by what the document proves.",
  },
  transactionIntegrity: {
    weightBp: 2_500,
    label: "Transaction Integrity",
    description:
      "Settled invoices, on-time payment, clean provider matches, no reversals.",
  },
  qualityConsistency: {
    weightBp: 2_000,
    label: "Quality Consistency",
    description:
      "Cup score as claimed versus as cupped, defect rate from accepted lab reports, disputes.",
  },
  identityLongevity: {
    weightBp: 1_200,
    label: "Identity & Longevity",
    description:
      "Account age, verified registration and tax identity, completed lots.",
  },
  networkReputation: {
    weightBp: 800,
    label: "Network Reputation",
    description:
      "Feedback from other verified counterparties, weighted by their own Trust.",
  },
};

/** The weights must total 100%. A drift here silently rescales every score. */
export const TOTAL_WEIGHT_BP = 10_000;

export type TrustComponents = Record<TrustComponent, number>;

export function neutralComponents(): TrustComponents {
  return Object.fromEntries(
    TRUST_COMPONENTS.map(c => [c, NEUTRAL_SCORE])
  ) as TrustComponents;
}

// ─── §2.3 bands ──────────────────────────────────────────────────────────────

export const TRUST_BANDS = [
  "at_risk",
  "provisional",
  "established",
  "verified",
  "sealed",
] as const;
export type TrustBand = (typeof TRUST_BANDS)[number];

export type BandSpec = {
  /** Inclusive lower bound. Lower-bound-only lookup is monotonic by
   *  construction — a min/max pair leaves gaps at the boundaries, and a score
   *  that matches no band would render as the worst one. */
  min: number;
  label: string;
  /** Museum Folio token names. Never a raw hex — see the token test. */
  className: string;
  /** What the platform actually does differently at this band (§7). */
  effect: string;
  /** True where §7 permits the fast path. */
  fastPathEligible: boolean;
  /** True where a settlement needs extra accepted documents first. */
  requiresExtraDocuments: boolean;
};

export const BAND_SPECS: Record<TrustBand, BandSpec> = {
  sealed: {
    min: 90,
    label: "Sealed",
    className: "bg-brass-300 text-ink-900",
    effect: "Fast-path settlement, fewer document gates, preferred in ranking.",
    fastPathEligible: true,
    requiresExtraDocuments: false,
  },
  verified: {
    min: 75,
    label: "Verified",
    className: "bg-sage-600 text-white",
    effect: "Standard flow. Trust badge shown on lot cards and profiles.",
    fastPathEligible: true,
    requiresExtraDocuments: false,
  },
  established: {
    min: 55,
    label: "Established",
    className: "bg-oxblood-100 text-oxblood-700 border border-oxblood-700/30",
    effect: "Normal review. OCR still required for material claims.",
    fastPathEligible: false,
    requiresExtraDocuments: false,
  },
  provisional: {
    min: 35,
    label: "Provisional",
    className: "bg-neutral-700 text-white",
    effect:
      "Extra document gates. Payment holds possible until more evidence arrives.",
    fastPathEligible: false,
    requiresExtraDocuments: true,
  },
  at_risk: {
    min: 0,
    label: "At Risk",
    className: "bg-danger-tint text-danger",
    effect: "Manual review required. Limited visibility in the public catalog.",
    fastPathEligible: false,
    requiresExtraDocuments: true,
  },
};

/** Bands in descending order, so the first match is the right one. */
const BANDS_DESC: TrustBand[] = [...TRUST_BANDS]
  .slice()
  .sort((a, b) => BAND_SPECS[b].min - BAND_SPECS[a].min);

/**
 * Round to one decimal before comparing, for the same reason `roundScore`
 * exists for cup scores: 74.999999 from a float sum is 75 to anyone reading it,
 * and it must not land a counterparty one band lower than the number they see.
 */
export function roundTrust(score: number): number {
  return Math.round(score * 10) / 10;
}

export function clampTrust(score: number): number {
  if (!Number.isFinite(score)) return NEUTRAL_SCORE;
  return Math.min(100, Math.max(0, score));
}

export function bandFor(score: number): TrustBand {
  const rounded = roundTrust(clampTrust(score));
  return BANDS_DESC.find(b => rounded >= BAND_SPECS[b].min) ?? "at_risk";
}

/** Weighted composite. Each component is itself a 0–100 sub-score. */
export function compositeScore(components: TrustComponents): number {
  const total = TRUST_COMPONENTS.reduce(
    (sum, c) => sum + clampTrust(components[c]) * COMPONENT_SPECS[c].weightBp,
    0
  );
  return roundTrust(total / TOTAL_WEIGHT_BP);
}

// ─── §3 evidence weights ─────────────────────────────────────────────────────

/**
 * What a document is worth as evidence, relative to each other.
 *
 * A signed contract and a third-party lab report are assertions someone else
 * can be held to. A packing list is a note the shipper wrote themselves — it is
 * still evidence, just weaker evidence, and pretending otherwise is how a Trust
 * score becomes a participation trophy.
 */
export const DOCUMENT_EVIDENCE_WEIGHT: Record<string, number> = {
  sca_lab_report: 10,
  sales_contract: 9,
  purchase_contract: 9,
  phytosanitary_certificate: 7,
  bill_of_lading: 6,
  invoice: 4,
  other: 2,
};

/** Evidence saturates: the 20th packing list proves nothing the 5th did not. */
export const DOCUMENT_SATURATION_WEIGHT = 60;

export const EVIDENCE_KINDS = [
  "document_accepted",
  "payment_settled",
  "payment_late",
  "allocation_reversed",
  "quality_confirmed",
  "quality_contradicted",
  "identity_verified",
  "peer_feedback",
  "admin_override",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Which component each kind of evidence moves. */
export const EVIDENCE_COMPONENT: Record<EvidenceKind, TrustComponent> = {
  document_accepted: "documentVerification",
  payment_settled: "transactionIntegrity",
  payment_late: "transactionIntegrity",
  allocation_reversed: "transactionIntegrity",
  quality_confirmed: "qualityConsistency",
  quality_contradicted: "qualityConsistency",
  identity_verified: "identityLongevity",
  peer_feedback: "networkReputation",
  admin_override: "documentVerification",
};

/**
 * A cup-score contradiction big enough to matter.
 *
 * Half a point is cupping noise between two competent panels. Three points is a
 * different coffee, and §3 says that is a negative signal — but it is applied
 * proportionally, because one bad lot should dent a long record, not erase it.
 */
export const CUP_SCORE_CONTRADICTION_THRESHOLD = 1.5;

export function isTrustEntityType(value: string): value is TrustEntityType {
  return (TRUST_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isEvidenceKind(value: string): value is EvidenceKind {
  return (EVIDENCE_KINDS as readonly string[]).includes(value);
}

// ─── §7 policy gates ─────────────────────────────────────────────────────────

export type TrustGate = {
  allowed: boolean;
  /** Never gate silently: the UI shows this string verbatim (§7). */
  reason: string;
  band: TrustBand;
  score: number;
};

/**
 * Whether a settlement of this size may proceed on this Trust score.
 *
 * The explanation is part of the return value, not something the caller
 * composes. §7 is explicit that Trust never silently gates access, and the only
 * way to guarantee that is to make the reason impossible to forget.
 */
export function settlementGate(args: {
  score: number;
  acceptedDocumentCount: number;
  /** Minor units, in the invoice currency — only used against the threshold. */
  amountMinor: bigint;
  largeSettlementMinor: bigint;
}): TrustGate {
  const score = roundTrust(clampTrust(args.score));
  const band = bandFor(score);
  const spec = BAND_SPECS[band];

  if (!spec.requiresExtraDocuments) {
    return {
      allowed: true,
      reason: `Trust ${score} — ${spec.label}: no additional document gate.`,
      band,
      score,
    };
  }

  const isLarge = args.amountMinor >= args.largeSettlementMinor;
  if (!isLarge) {
    return {
      allowed: true,
      reason: `Trust ${score} — ${spec.label}: below the large-settlement threshold, released with normal review.`,
      band,
      score,
    };
  }

  const needed = Math.max(0, 2 - args.acceptedDocumentCount);
  if (needed === 0) {
    return {
      allowed: true,
      reason: `Trust ${score} — ${spec.label}: released on ${args.acceptedDocumentCount} accepted documents.`,
      band,
      score,
    };
  }

  return {
    allowed: false,
    reason: `Trust ${score} — ${spec.label}: ${needed} more verified document${needed === 1 ? "" : "s"} recommended before a settlement this size.`,
    band,
    score,
  };
}
