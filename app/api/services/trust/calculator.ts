// Turning evidence into a score — spec §2.2 and §3.
//
// Everything in this file is pure. The reason is §9's "zero Trust updates
// without an evidence event": if the arithmetic can only be reached by handing
// it a list of evidence rows, there is no path by which a score changes without
// a fact behind it.
//
// The shape of each component's curve matters more than its weight, so each one
// says out loud what it is modelling.
import {
  CUP_SCORE_CONTRADICTION_THRESHOLD,
  DOCUMENT_SATURATION_WEIGHT,
  NEUTRAL_SCORE,
  clampTrust,
  compositeScore,
  neutralComponents,
  roundTrust,
  type TrustComponent,
  type TrustComponents,
} from "@contracts/trust";

export type EvidenceRow = {
  kind: string;
  component: string;
  weight: number;
  occurredAt: Date;
};

/**
 * Diminishing returns on accumulated evidence.
 *
 * Linear growth would let a counterparty reach 100 by uploading enough packing
 * lists, and a hard cap would make the 30th document worth exactly as much as
 * the 3rd. This saturates: the first documents move the score a lot, and the
 * curve flattens without ever quite reaching the ceiling — which is the honest
 * shape, because no finite amount of paperwork makes fraud impossible.
 */
function saturate(points: number, halfway: number): number {
  if (points <= 0) return 0;
  return points / (points + halfway);
}

/**
 * §2.2 Document Verification.
 *
 * Positive points only — §3 is explicit that a document you never accepted does
 * not hurt you. Uploading a blurry photo of a lab report is not dishonesty, it
 * is a bad camera.
 */
export function documentVerificationScore(rows: EvidenceRow[]): number {
  const points = rows
    .filter(r => r.component === "documentVerification")
    .reduce((sum, r) => sum + Math.max(0, r.weight), 0);
  if (points === 0) return NEUTRAL_SCORE;
  // Neutral is the floor here, and the top half of the range is earned.
  return roundTrust(
    NEUTRAL_SCORE +
      (100 - NEUTRAL_SCORE) * saturate(points, DOCUMENT_SATURATION_WEIGHT)
  );
}

/**
 * §2.2 Transaction Integrity.
 *
 * This one is symmetric, unlike documents: a late payment or a reversed
 * allocation is a real negative signal, not merely an absence. A single late
 * invoice against a long clean record barely registers; a record that is mostly
 * late collapses toward zero.
 */
export function transactionIntegrityScore(rows: EvidenceRow[]): number {
  const relevant = rows.filter(r => r.component === "transactionIntegrity");
  if (relevant.length === 0) return NEUTRAL_SCORE;

  const positive = relevant
    .filter(r => r.weight > 0)
    .reduce((s, r) => s + r.weight, 0);
  const negative = relevant
    .filter(r => r.weight < 0)
    .reduce((s, r) => s - r.weight, 0);

  // A weighted ratio, pulled toward neutral while the sample is small: two
  // on-time payments is not yet a track record.
  const total = positive + negative;
  if (total === 0) return NEUTRAL_SCORE;
  const ratio = positive / total;
  const confidence = saturate(total, 10);
  return roundTrust(NEUTRAL_SCORE + (ratio * 100 - NEUTRAL_SCORE) * confidence);
}

/**
 * §2.2 Quality Consistency.
 *
 * Symmetric like transaction integrity, but weighted harder on the negative
 * side: a lot that cups three points below its claim is the single most
 * damaging thing in this model, because it is the claim the whole platform
 * exists to stand behind.
 */
export function qualityConsistencyScore(rows: EvidenceRow[]): number {
  const relevant = rows.filter(r => r.component === "qualityConsistency");
  if (relevant.length === 0) return NEUTRAL_SCORE;

  const confirmed = relevant
    .filter(r => r.weight > 0)
    .reduce((s, r) => s + r.weight, 0);
  const contradicted = relevant
    .filter(r => r.weight < 0)
    .reduce((s, r) => s - r.weight, 0);

  const total = confirmed + contradicted * 2;
  if (total === 0) return NEUTRAL_SCORE;
  const ratio = confirmed / total;
  const confidence = saturate(confirmed + contradicted, 6);
  return roundTrust(NEUTRAL_SCORE + (ratio * 100 - NEUTRAL_SCORE) * confidence);
}

/**
 * §2.2 Identity & Longevity.
 *
 * Age alone is weak evidence — a dormant account is not trustworthy, it is
 * merely old — so this is account age tempered by whether anything was ever
 * actually verified, and by completed business.
 */
export function identityLongevityScore(args: {
  accountAgeDays: number;
  identityVerified: boolean;
  completedLots: number;
}): number {
  const ageComponent = saturate(Math.max(0, args.accountAgeDays), 365);
  const activityComponent = saturate(Math.max(0, args.completedLots), 8);
  const base =
    NEUTRAL_SCORE * (0.5 + 0.5 * ageComponent * 0.5 + 0.25 * activityComponent);
  const verifiedBonus = args.identityVerified ? 35 : 0;
  return roundTrust(clampTrust(base + verifiedBonus + 25 * activityComponent));
}

/**
 * §2.2 Network Reputation.
 *
 * Peer feedback weighted by the rater's own Trust, which is what stops a ring
 * of low-trust accounts from vouching each other up. No feedback means neutral,
 * not zero: silence is not a bad review.
 */
export function networkReputationScore(
  feedback: { rating: number; raterScore: number }[]
): number {
  if (feedback.length === 0) return NEUTRAL_SCORE;
  const weighted = feedback.reduce(
    (acc, f) => {
      // A rater's influence scales with their own standing, and an at-risk
      // account's opinion is worth very little.
      const w = Math.max(0.05, clampTrust(f.raterScore) / 100);
      return {
        sum: acc.sum + clampTrust(f.rating) * w,
        weight: acc.weight + w,
      };
    },
    { sum: 0, weight: 0 }
  );
  if (weighted.weight === 0) return NEUTRAL_SCORE;
  const raw = weighted.sum / weighted.weight;

  // Confidence is driven by the TOTAL rater weight, not by how many people
  // spoke. In a plain weighted average the rater weighting cancels out when
  // everyone carries the same weight — eight at-risk accounts rating each other
  // 95 would land exactly where eight sealed accounts would, which is the ring
  // this component exists to defeat. Summing the weights instead means low-trust
  // raters accumulate influence slowly no matter how many of them there are.
  const confidence = saturate(weighted.weight, 5);
  return roundTrust(NEUTRAL_SCORE + (raw - NEUTRAL_SCORE) * confidence);
}

export type ScoreInputs = {
  evidence: EvidenceRow[];
  accountAgeDays: number;
  identityVerified: boolean;
  completedLots: number;
  peerFeedback: { rating: number; raterScore: number }[];
};

export type ScoreResult = {
  score: number;
  components: TrustComponents;
};

/** The whole of §2.2, as one pure function over evidence. */
export function calculateScore(inputs: ScoreInputs): ScoreResult {
  const components: TrustComponents = {
    ...neutralComponents(),
    documentVerification: documentVerificationScore(inputs.evidence),
    transactionIntegrity: transactionIntegrityScore(inputs.evidence),
    qualityConsistency: qualityConsistencyScore(inputs.evidence),
    identityLongevity: identityLongevityScore({
      accountAgeDays: inputs.accountAgeDays,
      identityVerified: inputs.identityVerified,
      completedLots: inputs.completedLots,
    }),
    networkReputation: networkReputationScore(inputs.peerFeedback),
  };
  return { score: compositeScore(components), components };
}

/**
 * §2.4 — a lot's Trust is derived, never earned independently.
 *
 * A lot has no payment history and no account age of its own; what it has is
 * the supplier standing behind it and the documents attached to it
 * specifically. A supplier with a spotless record who has attached nothing to
 * *this* lot should not have the lot inherit that record untouched — the whole
 * point of §3 is that evidence is per-claim.
 */
export function lotTrustScore(args: {
  supplierScore: number | null;
  lotDocumentPoints: number;
}): { score: number; components: TrustComponents } {
  const supplier = args.supplierScore ?? NEUTRAL_SCORE;
  const density = documentVerificationScore([
    {
      kind: "document_accepted",
      component: "documentVerification",
      weight: args.lotDocumentPoints,
      occurredAt: new Date(),
    },
  ]);

  const components = neutralComponents();
  components.documentVerification = density;
  // The supplier's standing carries the other four: they are facts about the
  // seller, and a lot cannot have its own payment history.
  for (const c of [
    "transactionIntegrity",
    "qualityConsistency",
    "identityLongevity",
    "networkReputation",
  ] as TrustComponent[]) {
    components[c] = clampTrust(supplier);
  }

  return { score: compositeScore(components), components };
}

/**
 * How far a cupping result contradicts what was claimed, as signed evidence
 * weight. Positive confirms, negative contradicts.
 *
 * Below the threshold this returns a small positive: two panels landing within
 * a point of each other is a confirmation, and treating it as neutral would
 * mean honest suppliers never build a quality record at all.
 */
export function cupScoreEvidenceWeight(
  claimed: number,
  observed: number
): number {
  const delta = observed - claimed;
  if (Math.abs(delta) <= CUP_SCORE_CONTRADICTION_THRESHOLD) return 1;
  // Cupping higher than claimed is not dishonesty — under-promising is not the
  // failure mode this component exists to catch.
  if (delta > 0) return 1;
  // Proportional, and deliberately steep: 3 points low is not twice as bad as
  // 1.5 points low, it is a different coffee.
  const overstatement = Math.abs(delta) - CUP_SCORE_CONTRADICTION_THRESHOLD;
  return -Math.min(8, 1 + overstatement * overstatement);
}
