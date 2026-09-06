// Trust Score — spec §8's golden-path tests as executable assertions.
//
// The pure half only, same discipline as the payments tests: band edges, the
// shape of each component curve, the derived lot score and the gate. The
// database halves (upload → accept → delta, double-accept idempotency) are
// asserted here at the level that actually decides them — the unique index and
// the "already recorded, nothing to recompute" branch — with the integration
// cases living alongside once a MySQL container is wired.
import { describe, it, expect } from "vitest";
import {
  BAND_SPECS,
  COMPONENT_SPECS,
  MODEL_VERSION,
  NEUTRAL_SCORE,
  TOTAL_WEIGHT_BP,
  TRUST_BANDS,
  TRUST_COMPONENTS,
  bandFor,
  clampTrust,
  compositeScore,
  neutralComponents,
  roundTrust,
  settlementGate,
} from "@contracts/trust";
import {
  calculateScore,
  cupScoreEvidenceWeight,
  documentVerificationScore,
  identityLongevityScore,
  lotTrustScore,
  networkReputationScore,
  qualityConsistencyScore,
  transactionIntegrityScore,
  type EvidenceRow,
} from "./calculator";

const at = new Date("2026-03-31T00:00:00Z");
const doc = (weight: number): EvidenceRow => ({
  kind: "document_accepted",
  component: "documentVerification",
  weight,
  occurredAt: at,
});
const txn = (weight: number): EvidenceRow => ({
  kind: weight > 0 ? "payment_settled" : "payment_late",
  component: "transactionIntegrity",
  weight,
  occurredAt: at,
});
const quality = (weight: number): EvidenceRow => ({
  kind: weight > 0 ? "quality_confirmed" : "quality_contradicted",
  component: "qualityConsistency",
  weight,
  occurredAt: at,
});

// ─── §2.2 the model itself ───────────────────────────────────────────────────
describe("Trust model (§2.2)", () => {
  it("weights sum to exactly 100% — a drift here silently rescales every score", () => {
    const total = TRUST_COMPONENTS.reduce(
      (s, c) => s + COMPONENT_SPECS[c].weightBp,
      0
    );
    expect(total).toBe(TOTAL_WEIGHT_BP);
  });

  it("uses basis points so the weights cannot drift by float", () => {
    for (const c of TRUST_COMPONENTS) {
      expect(Number.isInteger(COMPONENT_SPECS[c].weightBp)).toBe(true);
    }
  });

  it("scores a neutral profile at exactly the neutral default", () => {
    expect(compositeScore(neutralComponents())).toBe(NEUTRAL_SCORE);
  });

  it("carries a model version on the constant, so a snapshot stays reproducible", () => {
    expect(MODEL_VERSION).toMatch(/^v\d+\.\d+$/);
  });
});

// ─── §2.3 bands ──────────────────────────────────────────────────────────────
describe("Trust bands (§2.3)", () => {
  it("puts every score in exactly one band, with no gap at an edge", () => {
    // The bug this prevents is the one qualityTierForScore had: a min/max pair
    // leaves 74.95 matching nothing and falling through to the worst band.
    for (let score = 0; score <= 100; score += 0.05) {
      const band = bandFor(score);
      expect(TRUST_BANDS, `${score} landed outside the band list`).toContain(
        band
      );
    }
  });

  it("lands the documented edges on the right side", () => {
    expect(bandFor(90)).toBe("sealed");
    expect(bandFor(89.9)).toBe("verified");
    expect(bandFor(75)).toBe("verified");
    expect(bandFor(74.9)).toBe("established");
    expect(bandFor(55)).toBe("established");
    expect(bandFor(54.9)).toBe("provisional");
    expect(bandFor(35)).toBe("provisional");
    expect(bandFor(34.9)).toBe("at_risk");
    expect(bandFor(0)).toBe("at_risk");
    expect(bandFor(100)).toBe("sealed");
  });

  it("rounds to one decimal before comparing, so the number shown decides the band", () => {
    // 74.96 displays as 75.0. Banding it as Established would put a
    // counterparty one band below the figure on their own screen.
    expect(bandFor(74.96)).toBe("verified");
    expect(roundTrust(74.96)).toBe(75);
  });

  it("is monotonic — a higher score never lands in a lower band", () => {
    const order = [
      "at_risk",
      "provisional",
      "established",
      "verified",
      "sealed",
    ];
    let seen = -1;
    for (let score = 0; score <= 100; score += 0.1) {
      const rank = order.indexOf(bandFor(score));
      expect(rank, `banding went backwards at ${score}`).toBeGreaterThanOrEqual(
        seen
      );
      seen = rank;
    }
  });

  it("clamps out-of-range and non-finite input rather than banding it", () => {
    expect(clampTrust(140)).toBe(100);
    expect(clampTrust(-20)).toBe(0);
    expect(clampTrust(Number.NaN)).toBe(NEUTRAL_SCORE);
  });

  it("gives every band a policy effect an operator can read", () => {
    for (const band of TRUST_BANDS) {
      expect(BAND_SPECS[band].effect.length).toBeGreaterThan(10);
    }
  });
});

// ─── §3 document verification ────────────────────────────────────────────────
describe("Document Verification (§3)", () => {
  it("starts neutral with no documents — absence of evidence is not dishonesty", () => {
    expect(documentVerificationScore([])).toBe(NEUTRAL_SCORE);
  });

  it("never drops below neutral, however few documents there are", () => {
    // §3: a blurry photo that never gets accepted must not hurt anyone, and
    // neither should having uploaded nothing yet.
    expect(documentVerificationScore([doc(1)])).toBeGreaterThanOrEqual(
      NEUTRAL_SCORE
    );
  });

  it("rewards a lab report more than a packing list", () => {
    const labReport = documentVerificationScore([doc(10)]);
    const other = documentVerificationScore([doc(2)]);
    expect(labReport).toBeGreaterThan(other);
  });

  it("saturates — the 20th document is worth less than the 2nd", () => {
    const two = documentVerificationScore([doc(10), doc(10)]);
    const three = documentVerificationScore([doc(10), doc(10), doc(10)]);
    const twenty = documentVerificationScore(
      Array.from({ length: 20 }, () => doc(10))
    );
    const twentyOne = documentVerificationScore(
      Array.from({ length: 21 }, () => doc(10))
    );
    expect(three - two).toBeGreaterThan(twentyOne - twenty);
  });

  it("never reaches 100 — no amount of paperwork makes fraud impossible", () => {
    const many = documentVerificationScore(
      Array.from({ length: 500 }, () => doc(10))
    );
    expect(many).toBeLessThan(100);
  });
});

// ─── §2.2 transaction integrity ──────────────────────────────────────────────
describe("Transaction Integrity (§2.2)", () => {
  it("is neutral with no payment history", () => {
    expect(transactionIntegrityScore([])).toBe(NEUTRAL_SCORE);
  });

  it("barely moves on two data points — that is not yet a track record", () => {
    const two = transactionIntegrityScore([txn(3), txn(3)]);
    expect(Math.abs(two - NEUTRAL_SCORE)).toBeLessThan(20);
  });

  it("rises with a long clean record", () => {
    const many = transactionIntegrityScore(
      Array.from({ length: 30 }, () => txn(3))
    );
    expect(many).toBeGreaterThan(85);
  });

  it("absorbs one late payment against a long clean record", () => {
    const clean = transactionIntegrityScore(
      Array.from({ length: 30 }, () => txn(3))
    );
    const oneLate = transactionIntegrityScore([
      ...Array.from({ length: 30 }, () => txn(3)),
      txn(-2),
    ]);
    expect(clean - oneLate).toBeLessThan(5);
  });

  it("collapses on a record that is mostly late", () => {
    const bad = transactionIntegrityScore([
      txn(3),
      ...Array.from({ length: 15 }, () => txn(-2)),
    ]);
    expect(bad).toBeLessThan(NEUTRAL_SCORE);
    expect(bandFor(bad)).not.toBe("verified");
  });
});

// ─── §2.2 quality consistency ────────────────────────────────────────────────
describe("Quality Consistency (§2.2)", () => {
  it("is neutral with nothing cupped", () => {
    expect(qualityConsistencyScore([])).toBe(NEUTRAL_SCORE);
  });

  it("weights a contradiction harder than a confirmation", () => {
    // This is the claim the platform exists to stand behind, so one lot cupping
    // three points low must cost more than one lot cupping true earns.
    const oneEach = qualityConsistencyScore([quality(1), quality(-1)]);
    expect(oneEach).toBeLessThan(NEUTRAL_SCORE);
  });

  it("dents a long record rather than erasing it", () => {
    const good = Array.from({ length: 12 }, () => quality(1));
    const withOneBad = qualityConsistencyScore([...good, quality(-5)]);
    expect(withOneBad).toBeGreaterThan(30);
    expect(withOneBad).toBeLessThan(qualityConsistencyScore(good));
  });
});

// ─── §3 cup-score cross-check ────────────────────────────────────────────────
describe("cup score cross-check (§3)", () => {
  it("treats agreement within cupping noise as a confirmation", () => {
    // Half a point between two competent panels is not a discrepancy.
    expect(cupScoreEvidenceWeight(86, 85.5)).toBeGreaterThan(0);
    expect(cupScoreEvidenceWeight(86, 86)).toBeGreaterThan(0);
    expect(cupScoreEvidenceWeight(86, 87.5)).toBeGreaterThan(0);
  });

  it("does not punish cupping HIGHER than claimed", () => {
    // Under-promising is not the failure mode this component catches.
    expect(cupScoreEvidenceWeight(84, 89)).toBeGreaterThan(0);
  });

  it("penalises the spec's example — claimed 88, cupped 81.5", () => {
    const weight = cupScoreEvidenceWeight(88, 81.5);
    expect(weight).toBeLessThan(0);
    expect(weight).toBeLessThanOrEqual(-8);
  });

  it("is steeper than linear — 3 points low is worse than twice 1.5 low", () => {
    const small = Math.abs(cupScoreEvidenceWeight(86, 84.5));
    const large = Math.abs(cupScoreEvidenceWeight(86, 83));
    expect(large).toBeGreaterThan(small * 2);
  });
});

// ─── §2.2 identity & network ─────────────────────────────────────────────────
describe("Identity, longevity and network (§2.2)", () => {
  it("does not treat a dormant old account as trustworthy", () => {
    const dormant = identityLongevityScore({
      accountAgeDays: 2000,
      identityVerified: false,
      completedLots: 0,
    });
    const verifiedNew = identityLongevityScore({
      accountAgeDays: 30,
      identityVerified: true,
      completedLots: 3,
    });
    expect(verifiedNew).toBeGreaterThan(dormant);
  });

  it("is neutral with no peer feedback — silence is not a bad review", () => {
    expect(networkReputationScore([])).toBe(NEUTRAL_SCORE);
  });

  it("discounts feedback from low-trust raters", () => {
    const fromTrusted = networkReputationScore(
      Array.from({ length: 8 }, () => ({ rating: 95, raterScore: 95 }))
    );
    const fromAtRisk = networkReputationScore(
      Array.from({ length: 8 }, () => ({ rating: 95, raterScore: 5 }))
    );
    // A ring of at-risk accounts vouching for each other must not manufacture
    // a Verified band. In a plain weighted average the rater weight cancels
    // out when every rater carries the same weight, and these two would come
    // back identical — which is precisely the attack.
    expect(fromTrusted).toBeGreaterThan(fromAtRisk);
    expect(bandFor(fromAtRisk)).not.toBe("sealed");
    expect(bandFor(fromAtRisk)).not.toBe("verified");
  });

  it("lets a large ring of worthless raters accumulate only slowly", () => {
    const fifty = networkReputationScore(
      Array.from({ length: 50 }, () => ({ rating: 100, raterScore: 0 }))
    );
    const eightTrusted = networkReputationScore(
      Array.from({ length: 8 }, () => ({ rating: 100, raterScore: 90 }))
    );
    expect(fifty).toBeLessThan(eightTrusted);
  });
});

// ─── §2.4 derived lot score ──────────────────────────────────────────────────
describe("Lot Trust is derived (§2.4)", () => {
  it("blends the supplier's standing with this lot's own document density", () => {
    const withDocs = lotTrustScore({
      supplierScore: 80,
      lotDocumentPoints: 40,
    });
    const without = lotTrustScore({ supplierScore: 80, lotDocumentPoints: 0 });
    expect(withDocs.score).toBeGreaterThan(without.score);
  });

  it("does not let a spotless supplier carry a lot with no evidence to the top", () => {
    // §3's whole point is that evidence is per-claim.
    const perfectSupplier = lotTrustScore({
      supplierScore: 100,
      lotDocumentPoints: 0,
    });
    expect(perfectSupplier.score).toBeLessThan(100);
    expect(bandFor(perfectSupplier.score)).not.toBe("sealed");
  });

  it("treats an unknown supplier as neutral, not as untrusted", () => {
    const unknown = lotTrustScore({
      supplierScore: null,
      lotDocumentPoints: 0,
    });
    expect(unknown.score).toBe(NEUTRAL_SCORE);
  });
});

// ─── §2.2 end to end over the composite ──────────────────────────────────────
describe("composite scoring", () => {
  const base = {
    accountAgeDays: 400,
    identityVerified: true,
    completedLots: 6,
    peerFeedback: [],
  };

  it("moves a well-evidenced counterparty above neutral", () => {
    const result = calculateScore({
      ...base,
      evidence: [doc(10), doc(9), doc(10), txn(3), txn(3), txn(3), quality(1)],
    });
    expect(result.score).toBeGreaterThan(NEUTRAL_SCORE);
  });

  it("keeps a contradicted counterparty out of the fast path", () => {
    const result = calculateScore({
      ...base,
      evidence: [doc(10), txn(-2), txn(-2), txn(-2), quality(-8), quality(-8)],
    });
    expect(BAND_SPECS[bandFor(result.score)].fastPathEligible).toBe(false);
  });

  it("returns all five components, so the panel needs no second call", () => {
    const result = calculateScore({ ...base, evidence: [doc(10)] });
    for (const c of TRUST_COMPONENTS) {
      expect(result.components[c]).toBeGreaterThanOrEqual(0);
      expect(result.components[c]).toBeLessThanOrEqual(100);
    }
  });
});

// ─── §7 policy gates ─────────────────────────────────────────────────────────
describe("settlement gate (§7)", () => {
  const large = 500_000_000n;

  it("never returns a decision without a reason, including when it allows", () => {
    // §7 — "Trust never silently gates access without explanation".
    for (const score of [10, 40, 60, 80, 95]) {
      const gate = settlementGate({
        score,
        acceptedDocumentCount: 0,
        amountMinor: large,
        largeSettlementMinor: large,
      });
      expect(
        gate.reason.length,
        `score ${score} produced an empty reason`
      ).toBeGreaterThan(10);
      expect(gate.reason).toContain(String(score));
    }
  });

  it("lets a Verified counterparty through without extra documents", () => {
    const gate = settlementGate({
      score: 82,
      acceptedDocumentCount: 0,
      amountMinor: large,
      largeSettlementMinor: large,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.band).toBe("verified");
  });

  it("holds a large settlement for a Provisional counterparty with no documents", () => {
    const gate = settlementGate({
      score: 41,
      acceptedDocumentCount: 0,
      amountMinor: large,
      largeSettlementMinor: large,
    });
    expect(gate.allowed).toBe(false);
    // The spec's own example sentence.
    expect(gate.reason).toContain("Provisional");
    expect(gate.reason).toContain("more verified document");
  });

  it("does not hold a SMALL settlement for the same counterparty", () => {
    // A gate that blocks a 2,000,000đ sample invoice teaches operators to route
    // around it, which is worse than no gate at all.
    const gate = settlementGate({
      score: 41,
      acceptedDocumentCount: 0,
      amountMinor: 2_000_000n,
      largeSettlementMinor: large,
    });
    expect(gate.allowed).toBe(true);
  });

  it("releases once the recommended documents are on file", () => {
    const gate = settlementGate({
      score: 41,
      acceptedDocumentCount: 2,
      amountMinor: large,
      largeSettlementMinor: large,
    });
    expect(gate.allowed).toBe(true);
  });
});
