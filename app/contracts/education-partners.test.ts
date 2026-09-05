// Cupping SOP §1 and Supplier Agreement §B–§E, as executable assertions.
//
// These are contract terms someone signed, so the tests read like the clauses:
// each one names the section it protects. Where the source document is
// internally inconsistent, both readings are asserted so the difference is
// visible rather than buried in an implementation choice.
import { describe, it, expect } from "vitest";
import {
  DISQUALIFYING_VARIANCE,
  LICENCE_GRACE_DAYS,
  PANEL_SIZE,
  RECERTIFICATION_DAYS,
  TIER_SPECS,
  TRAINING_PROGRAMME,
  checkPanel,
  meetsThreshold,
  performanceState,
  phaseByCode,
  resolveAuthority,
  type CupperProfileInput,
} from "./cupping-authority";
import {
  MAX_CLAIM_BP,
  MAX_DOWNGRADE_REDUCTION_BP,
  MAX_HOLDING_DAYS,
  attributeFault,
  calculateClaim,
  calculateDowngrade,
  checkClaimWindow,
  requiresWrittenNotice,
} from "./dispositions";
import {
  PARTNER_TIER_SPECS,
  SUPPLIER_TIER_SPECS,
  checkFloorSla,
  classifyPartner,
  classifySupplier,
} from "./partner-tiers";

const NOW = new Date("2026-06-01T00:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

/** A Q-Grader in good standing, as the baseline every case varies from. */
const goodQGrader: CupperProfileInput = {
  tier: "tier_1",
  licenceExpiresAt: days(400),
  lastRecertifiedAt: days(-30),
  supervisedCups: 0,
  suspended: false,
  suspensionReason: null,
  observedVariance: 1.1,
};

// ─── SOP §1.1 authority ──────────────────────────────────────────────────────
describe("cupper authority (SOP §1.1)", () => {
  it("lets a Q-Grader in good standing do everything", () => {
    const r = resolveAuthority(goodQGrader, NOW);
    expect(r.inGoodStanding).toBe(true);
    expect(r.authority.independentCupping).toBe(true);
    expect(r.authority.tier2And3Exceptions).toBe(true);
    expect(r.authority.mayCertifyOthers).toBe(true);
  });

  it("bars a Tier 2 from Tier 2/3 exception resolution however clean their record", () => {
    // §1.1 — "cannot cup for Tier 2/3 exception resolution or arbitration
    // disputes". This is the boundary the money sits behind.
    const r = resolveAuthority(
      {
        ...goodQGrader,
        tier: "tier_2",
        licenceExpiresAt: null,
        supervisedCups: 500,
      },
      NOW
    );
    expect(r.inGoodStanding).toBe(true);
    expect(r.authority.independentCupping).toBe(true);
    expect(r.authority.tier2And3Exceptions).toBe(false);
  });

  it("holds a Tier 2 to 100 supervised cups before independent work", () => {
    const r = resolveAuthority(
      {
        ...goodQGrader,
        tier: "tier_2",
        licenceExpiresAt: null,
        supervisedCups: 99,
      },
      NOW
    );
    expect(r.inGoodStanding).toBe(false);
    expect(r.blockers.join(" ")).toContain("1 more supervised cups");
    expect(r.authority.independentCupping).toBe(false);
    expect(r.authority.tier1Exceptions).toBe(false);
  });

  it("still lets a trainee mid-supervision sit on a panel", () => {
    // The catch-22 this guards against: §1.2 requires the 100 cups be performed
    // "under a Tier 1 Q-Grader", which IS panel work. Treating an unmet cup
    // count as total disqualification would bar a trainee from the only
    // activity that lets them meet it.
    const r = resolveAuthority(
      {
        ...goodQGrader,
        tier: "tier_2",
        licenceExpiresAt: null,
        supervisedCups: 12,
      },
      NOW
    );
    expect(r.authority.panelParticipation).toBe(true);
    expect(r.authority.independentCupping).toBe(false);
    expect(r.supervisionPending).toHaveLength(1);
    expect(r.disqualifying).toHaveLength(0);
  });

  it("separates supervision-pending from disqualifying, because they differ", () => {
    const trainee = resolveAuthority(
      {
        ...goodQGrader,
        tier: "tier_2",
        licenceExpiresAt: null,
        supervisedCups: 0,
      },
      NOW
    );
    const lapsed = resolveAuthority(
      { ...goodQGrader, observedVariance: 5 },
      NOW
    );
    expect(trainee.disqualifying).toHaveLength(0);
    expect(lapsed.disqualifying.length).toBeGreaterThan(0);
    expect(lapsed.authority.panelParticipation).toBe(false);
  });

  it("lets a Tier 3 sit on a panel but never cup alone", () => {
    const r = resolveAuthority(
      {
        ...goodQGrader,
        tier: "tier_3",
        licenceExpiresAt: null,
        lastRecertifiedAt: null,
        observedVariance: null,
      },
      NOW
    );
    // A Tier 3 needs no recertification, so nothing blocks them.
    expect(r.inGoodStanding).toBe(true);
    expect(r.authority.panelParticipation).toBe(true);
    expect(r.authority.independentCupping).toBe(false);
  });

  it("lets a Tier 0 do nothing at all", () => {
    const r = resolveAuthority(
      {
        ...goodQGrader,
        tier: "tier_0",
        licenceExpiresAt: null,
        lastRecertifiedAt: null,
        observedVariance: null,
      },
      NOW
    );
    expect(Object.values(r.authority).every(v => v === false)).toBe(true);
  });
});

// ─── SOP §1.3 disqualification ───────────────────────────────────────────────
describe("disqualification triggers (SOP §1.3)", () => {
  it("keeps a Q-Grader whose licence lapsed inside the six-month grace", () => {
    // §1.3 disqualifies at six months, not on the expiry date — a lapsed
    // renewal is administrative, and stranding lots mid-investigation is worse.
    const r = resolveAuthority(
      { ...goodQGrader, licenceExpiresAt: days(-LICENCE_GRACE_DAYS + 5) },
      NOW
    );
    expect(r.inGoodStanding).toBe(true);
    expect(r.daysUntilLicenceExpiry).toBeLessThan(0);
  });

  it("disqualifies once the six months pass", () => {
    const r = resolveAuthority(
      { ...goodQGrader, licenceExpiresAt: days(-LICENCE_GRACE_DAYS - 1) },
      NOW
    );
    expect(r.inGoodStanding).toBe(false);
    expect(r.blockers.join(" ")).toContain("not renewed within six months");
  });

  it("disqualifies on a missed annual recertification", () => {
    const r = resolveAuthority(
      { ...goodQGrader, lastRecertifiedAt: days(-RECERTIFICATION_DAYS - 1) },
      NOW
    );
    expect(r.inGoodStanding).toBe(false);
    expect(r.blockers.join(" ")).toContain("annual recertification");
  });

  it("disqualifies above ±3 points of variance", () => {
    const ok = resolveAuthority(
      { ...goodQGrader, observedVariance: DISQUALIFYING_VARIANCE },
      NOW
    );
    const bad = resolveAuthority(
      { ...goodQGrader, observedVariance: DISQUALIFYING_VARIANCE + 0.1 },
      NOW
    );
    expect(ok.inGoodStanding).toBe(true);
    expect(bad.inGoodStanding).toBe(false);
  });

  it("drops a disqualified Q-Grader to NO authority, not down a tier", () => {
    // §1.3's triggers are about integrity and sensory acuity. Neither is
    // repaired by demotion: a cupper whose variance has blown out is not a
    // reliable panellist either.
    const r = resolveAuthority({ ...goodQGrader, observedVariance: 4 }, NOW);
    expect(r.authority.panelParticipation).toBe(false);
    expect(r.authority.independentCupping).toBe(false);
  });

  it("reports every blocker at once rather than the first one found", () => {
    const r = resolveAuthority(
      {
        ...goodQGrader,
        licenceExpiresAt: days(-400),
        lastRecertifiedAt: days(-400),
        observedVariance: 5,
        suspended: true,
        suspensionReason: "probation",
      },
      NOW
    );
    expect(r.blockers.length).toBeGreaterThanOrEqual(4);
  });

  it("classifies performance for the §1.3 dashboard", () => {
    expect(performanceState(null)).toBe("unrated");
    expect(performanceState(1.2)).toBe("healthy");
    expect(performanceState(2.1)).toBe("watch");
    expect(performanceState(3.5)).toBe("disqualified");
  });
});

// ─── SOP §4.4 / §6 panels ────────────────────────────────────────────────────
describe("panel composition (SOP §4.4, §6)", () => {
  const member = (
    tier: CupperProfileInput["tier"],
    name: string,
    variance = 1
  ) => ({
    name,
    tier,
    result: resolveAuthority(
      {
        ...goodQGrader,
        tier,
        licenceExpiresAt: tier === "tier_1" ? days(400) : null,
        lastRecertifiedAt:
          tier === "tier_3" || tier === "tier_0" ? null : days(-30),
        supervisedCups: 500,
        observedVariance: variance,
      },
      NOW
    ),
  });

  it("requires three cuppers for a Tier 2 exception", () => {
    const r = checkPanel([member("tier_1", "Q"), member("tier_2", "B")], 2);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain(`${PANEL_SIZE}-cupper panel`);
  });

  it("refuses a full panel with no Q-Grader on a Tier 2 exception", () => {
    // Three Tier 3 baristas satisfy the head-count and none of the intent.
    const r = checkPanel(
      [member("tier_3", "A"), member("tier_3", "B"), member("tier_3", "C")],
      2
    );
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("must be resolved by a Q-Grader");
  });

  it("accepts a Q-Grader plus two others on a Tier 2 exception", () => {
    const r = checkPanel(
      [member("tier_1", "Q"), member("tier_2", "B"), member("tier_3", "C")],
      2
    );
    expect(r.ok).toBe(true);
  });

  it("refuses a Tier 0 on any panel", () => {
    const r = checkPanel(
      [
        member("tier_1", "Q"),
        member("tier_2", "B"),
        member("tier_0", "New hire"),
      ],
      2
    );
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("New hire");
  });

  it("accepts a trainee on a panel — that is how supervised cups are earned", () => {
    const trainee = {
      name: "Trainee",
      tier: "tier_2" as const,
      result: resolveAuthority(
        {
          ...goodQGrader,
          tier: "tier_2",
          licenceExpiresAt: null,
          supervisedCups: 10,
        },
        NOW
      ),
    };
    const r = checkPanel(
      [member("tier_1", "Q"), member("tier_3", "C"), trainee],
      2
    );
    expect(r.ok).toBe(true);
  });
});

// ─── SOP §1.2 training thresholds ────────────────────────────────────────────
describe("training programme (SOP §1.2)", () => {
  it("has four phases in order", () => {
    expect(TRAINING_PROGRAMME.map(p => p.phase)).toEqual([1, 2, 3, 4]);
  });

  it("grades Phase 1 at 16 of 20", () => {
    const p = phaseByCode("PHASE-1")!;
    expect(meetsThreshold(p, 15)).toBe(false);
    expect(meetsThreshold(p, 16)).toBe(true);
  });

  it("grades Phase 3 as variance, where LOWER passes", () => {
    // The one phase where a bigger number is worse. Comparing it the same way
    // as the others would pass exactly the cuppers it should fail.
    const p = phaseByCode("PHASE-3")!;
    expect(meetsThreshold(p, 1.4)).toBe(true);
    expect(meetsThreshold(p, 2.0)).toBe(false);
  });

  it("returns null for Phase 4, which is a human signature", () => {
    expect(meetsThreshold(phaseByCode("PHASE-4")!, 100)).toBeNull();
  });

  it("gives each tier the accuracy band §1.1 states", () => {
    expect(TIER_SPECS.tier_1.accuracyBand).toBe(1.5);
    expect(TIER_SPECS.tier_2.accuracyBand).toBe(2.5);
    expect(TIER_SPECS.tier_3.accuracyBand).toBeNull();
  });
});

// ─── §B.2 fault attribution ──────────────────────────────────────────────────
describe("fault attribution (§B.2)", () => {
  it("attributes to the supplier when no proof is filed", () => {
    // §B.2 — "In the absence of such proof, the failure is attributed to
    // Supplier." The default is the whole clause.
    const r = attributeFault({ claimedOrigin: "logistics", proofFiled: false });
    expect(r.origin).toBe("supplier");
    expect(r.reason).toContain("No proof filed");
  });

  it("honours a logistics origin once proof is filed", () => {
    const r = attributeFault({ claimedOrigin: "logistics", proofFiled: true });
    expect(r.origin).toBe("logistics");
  });

  it("never demands proof from Greensheet against itself", () => {
    const r = attributeFault({
      claimedOrigin: "greensheet",
      proofFiled: false,
    });
    expect(r.origin).toBe("greensheet");
  });
});

// ─── §C.1 downgrade re-pricing ───────────────────────────────────────────────
describe("downgrade re-pricing (§C.1)", () => {
  const example = {
    quantityLbs: 40_000,
    originalPricePerLbCents: 450,
    downgradeGradePricePerLbCents: 320,
    operationalCostCents: 50_000, // USD $500, per §C.1's own definition
    faultOrigin: "supplier" as const,
  };

  it("reproduces the clause's degradation factor exactly", () => {
    expect(calculateDowngrade(example).degradationFactorBp).toBe(7_111);
  });

  it("treats the operational cost as a TOTAL, as §C.1 defines it", () => {
    // §C.1's worked example prints $3.70/lb, which only follows if the "$500"
    // ops cost is $0.50 PER POUND — $20,000 on this lot, not $500. The
    // definition says "$300–$1,000 depending on lot size", which cannot also be
    // a per-pound rate. See the note on calculateDowngrade: this is a defect in
    // the source contract, and both readings are pinned here so it stays visible.
    const r = calculateDowngrade(example);
    expect(r.adjustedPricePerLbCents).toBe(321);
    expect(r.creditDueCents).toBe(5_160_000); // $51,600

    // What the clause's own arithmetic would give, if ops cost were per-pound.
    const asPerLb = calculateDowngrade({
      ...example,
      operationalCostCents: 50 * example.quantityLbs,
    });
    expect(asPerLb.adjustedPricePerLbCents).toBe(370);
    expect(asPerLb.creditDueCents).toBe(3_200_000); // $32,000, as printed
  });

  it("caps the reduction at 50% of the original price", () => {
    // §C.1 — "prevents predatory re-pricing while ensuring Greensheet's cost is
    // recovered". A downgrade is a discount, not a licence to take a lot at any
    // price the market offers that day.
    const r = calculateDowngrade({
      ...example,
      downgradeGradePricePerLbCents: 50, // a collapse to $0.50/lb
      operationalCostCents: 0,
    });
    expect(r.capApplied).toBe(true);
    expect(r.adjustedPricePerLbCents).toBe(225); // half of 450
    expect(r.explanation).toContain("caps the reduction at 50%");
  });

  it("halves the supplier's share when fault is indeterminate", () => {
    const r = calculateDowngrade({ ...example, faultOrigin: "indeterminate" });
    expect(r.supplierBorneCents).toBe(Math.round(r.creditDueCents / 2));
  });

  it("charges the supplier nothing when the fault was Greensheet's", () => {
    const r = calculateDowngrade({ ...example, faultOrigin: "greensheet" });
    expect(r.creditDueCents).toBeGreaterThan(0);
    expect(r.supplierBorneCents).toBe(0);
  });

  it("refuses a nonsensical original price rather than dividing by zero", () => {
    expect(() =>
      calculateDowngrade({ ...example, originalPricePerLbCents: 0 })
    ).toThrow(/GS-PRT-1010/);
  });

  it("keeps the cap at the documented 50%", () => {
    expect(MAX_DOWNGRADE_REDUCTION_BP).toBe(5_000);
  });
});

// ─── §C.2 reject & claim ─────────────────────────────────────────────────────
describe("reject and claim (§C.2)", () => {
  const base = {
    purchasePriceCents: 10_000_000, // $100,000
    holdingCostPerDayCents: 20_000, // $200/day
    daysHeld: 10,
    analysisCostCents: 100_000,
    disposalCostCents: 50_000,
    faultOrigin: "supplier" as const,
  };

  it("sums purchase, holding, analysis and disposal", () => {
    const r = calculateClaim(base);
    expect(r.subtotalCents).toBe(10_000_000 + 200_000 + 100_000 + 50_000);
    expect(r.capApplied).toBe(false);
  });

  it("caps holding at 30 days and absorbs the rest", () => {
    const r = calculateClaim({ ...base, daysHeld: 90 });
    expect(r.holdingDaysCharged).toBe(MAX_HOLDING_DAYS);
    expect(r.explanation).toContain("absorbed by Greensheet");
  });

  it("caps the total claim at 110% of the purchase price", () => {
    // §C.2 — "prevents claiming holding costs that exceed the lot's value". A
    // claim that grows without bound just by leaving coffee in a warehouse is a
    // claim that rewards delay.
    const r = calculateClaim({
      ...base,
      daysHeld: 30,
      holdingCostPerDayCents: 500_000, // $5,000/day
      analysisCostCents: 2_000_000,
      disposalCostCents: 1_500_000,
    });
    expect(r.capApplied).toBe(true);
    expect(r.totalClaimCents).toBe(
      Math.round((base.purchasePriceCents * MAX_CLAIM_BP) / 10_000)
    );
  });

  it("applies both caps in order, holding first", () => {
    const r = calculateClaim({
      ...base,
      daysHeld: 400,
      holdingCostPerDayCents: 1_000,
    });
    expect(r.holdingDaysCharged).toBe(MAX_HOLDING_DAYS);
    expect(r.totalClaimCents).toBeLessThanOrEqual(
      Math.round((base.purchasePriceCents * MAX_CLAIM_BP) / 10_000)
    );
  });
});

// ─── §C.3 notice, §D.4 limitation ────────────────────────────────────────────
describe("notice and limitation windows (§C.3, §D.4)", () => {
  it("requires written notice above a 5% adjustment", () => {
    expect(requiresWrittenNotice(10_000_000, 400_000)).toBe(false); // 4%
    expect(requiresWrittenNotice(10_000_000, 600_000)).toBe(true); // 6%
  });

  it("closes the standard window at 60 days", () => {
    expect(
      checkClaimWindow({ basis: "standard", detectedAt: days(-59), now: NOW })
        .withinWindow
    ).toBe(true);
    expect(
      checkClaimWindow({ basis: "standard", detectedAt: days(-61), now: NOW })
        .withinWindow
    ).toBe(false);
  });

  it("gives a latent defect 90 days", () => {
    expect(
      checkClaimWindow({
        basis: "latent_defect",
        detectedAt: days(-75),
        now: NOW,
      }).withinWindow
    ).toBe(true);
  });

  it("keeps a fraud claim alive for a year, then forfeits it", () => {
    // §D.4 — no limit on the claim, but notice within a year. Collapsing the
    // two would forfeit at day 366 a claim the clause expressly preserves.
    expect(
      checkClaimWindow({ basis: "fraud", detectedAt: days(-300), now: NOW })
        .withinWindow
    ).toBe(true);
    const barred = checkClaimWindow({
      basis: "fraud",
      detectedAt: days(-400),
      now: NOW,
    });
    expect(barred.withinWindow).toBe(false);
    expect(barred.reason).toContain("forfeited");
  });
});

// ─── §10.1 / §E.1 tiers ──────────────────────────────────────────────────────
describe("partner and supplier tiers (§10.1, §E.1)", () => {
  it("puts an established partner on the 3-day floor SLA", () => {
    const r = classifyPartner({
      monthsOnPlatform: 18,
      lotsDelivered: 5,
      tier2ExceptionsTrailing12: 0,
      unresolvedTier3Exceptions: 0,
    });
    expect(r.tier).toBe("tier_a");
    expect(PARTNER_TIER_SPECS[r.tier].floorPaymentSlaDays).toBe(3);
  });

  it("drops any partner to Provisional on an unresolved Tier 3", () => {
    // Disqualifying on its own, whatever the tenure.
    const r = classifyPartner({
      monthsOnPlatform: 60,
      lotsDelivered: 40,
      tier2ExceptionsTrailing12: 0,
      unresolvedTier3Exceptions: 1,
    });
    expect(r.tier).toBe("tier_c");
    expect(PARTNER_TIER_SPECS.tier_c.preShipmentSampleRequired).toBe(true);
  });

  it("gives the PREFERRED supplier the WIDEST weight tolerance", () => {
    // §E.1 runs opposite to intuition: a long clean record earns the benefit of
    // the doubt on a marginal reading. Implementing it backwards would quietly
    // punish the best suppliers.
    expect(SUPPLIER_TIER_SPECS.supplier_a.weightToleranceBp).toBe(200);
    expect(SUPPLIER_TIER_SPECS.supplier_c.weightToleranceBp).toBe(100);
    expect(SUPPLIER_TIER_SPECS.supplier_a.weightToleranceBp).toBeGreaterThan(
      SUPPLIER_TIER_SPECS.supplier_c.weightToleranceBp
    );
  });

  it("demands pre-shipment inspection only from an emerging supplier", () => {
    const r = classifySupplier({
      annualVolumeLbs: 5_000,
      tier2PlusExceptionsTrailing12: 0,
      holdsCurrentCertification: false,
    });
    expect(r.tier).toBe("supplier_c");
    expect(SUPPLIER_TIER_SPECS[r.tier].preShipmentInspectionRequired).toBe(
      true
    );
  });
});

// ─── §9.1 the anti-squeeze release ───────────────────────────────────────────
describe("floor payment SLA and §9.1 release", () => {
  it("is clean inside the SLA", () => {
    const r = checkFloorSla({
      tier: "tier_a",
      verifiedAt: days(-2),
      paidAt: days(-1),
      now: NOW,
    });
    expect(r.breached).toBe(false);
    expect(r.releaseTriggered).toBe(false);
  });

  it("flags a breach but withholds the release inside the 5-day grace", () => {
    const r = checkFloorSla({
      tier: "tier_a",
      verifiedAt: days(-7),
      paidAt: null,
      now: NOW,
    });
    expect(r.breached).toBe(true);
    expect(r.releaseTriggered).toBe(false);
  });

  it("triggers the release past five days late", () => {
    // §9.1 — the partner may sell future lots elsewhere without penalty. It is
    // computed from our own timestamps rather than waiting to be claimed: a
    // protection that activates only when the weaker party knows to ask is not
    // much of a protection.
    const r = checkFloorSla({
      tier: "tier_a",
      verifiedAt: days(-10),
      paidAt: null,
      now: NOW,
    });
    expect(r.releaseTriggered).toBe(true);
    expect(r.reason).toContain("sell future lots elsewhere");
  });

  it("scales the breach with the tier's own SLA", () => {
    // The same 8-day delay breaches Tier A and not Tier C.
    const a = checkFloorSla({
      tier: "tier_a",
      verifiedAt: days(-8),
      paidAt: null,
      now: NOW,
    });
    const c = checkFloorSla({
      tier: "tier_c",
      verifiedAt: days(-8),
      paidAt: null,
      now: NOW,
    });
    expect(a.daysLate).toBe(5);
    expect(c.daysLate).toBe(1);
  });
});
