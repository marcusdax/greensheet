// The cupping curriculum and a starting cupper roster — SOP §1.
//
// The four training phases come straight from TRAINING_PROGRAMME so the seeded
// modules and the thresholds the code grades against cannot drift apart. The
// cupper profiles are the §1.1 minimum: "Minimum 2 Q-Graders on staff
// (redundancy; one can verify the other's cups)".
//
// Idempotent: it skips whichever half is already present.
import { getDb } from "../api/queries/connection";
import { cupperProfiles, curriculumModules } from "./schema";
import { TRAINING_PROGRAMME } from "../contracts/cupping-authority";

/** A date `years` from today, as the YYYY-MM-DD a MySQL date column takes. */
function yearsOut(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/**
 * Beyond the cupping track, the modules the persona brief asks for: cultivation,
 * processing, financial literacy and regulatory compliance. They carry no
 * machine-checkable threshold yet, so they are content rather than gates —
 * labelled as such rather than pretending to certify anyone.
 */
const WIDER_CURRICULUM = [
  {
    code: "CULT-101",
    track: "cultivation" as const,
    title: "Plant physiology, soil health and shade regimes",
    durationLabel: "4 weeks",
    objective:
      "Root-zone structure, soil chemistry and the shade decisions that set both yield and cup quality. Includes integrated pest management for leaf rust and berry borer.",
    passCriterion: "Written assessment plus a farm-visit report.",
  },
  {
    code: "CULT-201",
    track: "cultivation" as const,
    title: "Climate adaptation and variety selection",
    durationLabel: "2 weeks",
    objective:
      "Reading a climate projection against a specific plot, and what it implies for variety choice — Bourbon, SL28, Geisha — over a ten-year replanting horizon.",
    passCriterion: "A defensible replanting plan for a named plot.",
  },
  {
    code: "PROC-101",
    track: "processing" as const,
    title: "Fermentation microbiology and drying kinetics",
    durationLabel: "3 weeks",
    objective:
      "Washed, natural, honey and anaerobic protocols, and what each does to the cup. Moisture control from wet mill to 11.0–12.5% at rest.",
    passCriterion:
      "Defect identification drill plus a fermentation log review.",
  },
  {
    code: "FIN-101",
    track: "finance" as const,
    title: "Farm budgeting and the revenue share model",
    durationLabel: "2 weeks",
    objective:
      "Reading a True Price Receipt end to end: floor payment, documented costs, net sale proceeds and the quality-tier share. What a cup score is worth in cash.",
    passCriterion: "Reconcile a worked receipt against its source lot.",
  },
  {
    code: "FIN-201",
    track: "finance" as const,
    title: "Futures, differentials and hedging",
    durationLabel: "2 weeks",
    objective:
      "ICE Arabica and London Robusta, basis and differentials, and how a hedge protects a floor price rather than speculating on one.",
    passCriterion: "Hedging simulation against a live differential.",
  },
  {
    code: "COMP-101",
    track: "compliance" as const,
    title: "Export documentation and phytosanitary compliance",
    durationLabel: "2 weeks",
    objective:
      "Certificates of origin, phytosanitary certificates and the customs clearance path. Where a missing document stops a container, and what it costs per day.",
    passCriterion: "Complete a clean document set for a simulated shipment.",
  },
];

async function seed() {
  const db = getDb();

  const existingModules = await db
    .select({ id: curriculumModules.id })
    .from(curriculumModules)
    .limit(1);

  if (existingModules.length > 0) {
    console.log("Curriculum already seeded — skipping.");
  } else {
    // The four SOP §1.2 phases, generated from the contract so the seeded
    // module and the threshold the grader uses can never disagree.
    await db.insert(curriculumModules).values(
      TRAINING_PROGRAMME.map((phase, i) => ({
        code: `CUP-${phase.code}`,
        track: "cupping" as const,
        title: phase.title,
        phaseCode: phase.code,
        sequence: i + 1,
        durationLabel: phase.weeks,
        objective: phase.objective,
        passCriterion: phase.passCriterion,
        // Phases 1–3 build toward Tier 2; Phase 4 is the sign-off that grants it.
        qualifiesForTier: "tier_2" as const,
        active: true,
      }))
    );
    await db.insert(curriculumModules).values(
      WIDER_CURRICULUM.map((m, i) => ({
        ...m,
        phaseCode: "",
        sequence: i + 1,
        qualifiesForTier: null,
        active: true,
      }))
    );
    console.log(
      `Seeded ${TRAINING_PROGRAMME.length + WIDER_CURRICULUM.length} curriculum modules across 5 tracks.`
    );
  }

  const existingCuppers = await db
    .select({ id: cupperProfiles.id })
    .from(cupperProfiles)
    .limit(1);

  if (existingCuppers.length > 0) {
    console.log("Cupper profiles already seeded — skipping.");
  } else {
    await db.insert(cupperProfiles).values([
      {
        fullName: "Nguyễn Thị Mai",
        email: "mai@auctumledger.io",
        tier: "tier_1",
        licenceNumber: "QG-2024-0412",
        licenceExpiresAt: yearsOut(2),
        yearsExperience: 9,
        totalCups: 1_840,
        lastRecertifiedAt: monthsAgo(4),
      },
      {
        // §1.1 requires two Q-Graders so one can verify the other's cups.
        fullName: "Trần Quốc Anh",
        email: "anh@auctumledger.io",
        tier: "tier_1",
        licenceNumber: "QG-2023-1187",
        licenceExpiresAt: yearsOut(1),
        yearsExperience: 6,
        totalCups: 920,
        lastRecertifiedAt: monthsAgo(2),
      },
      {
        // Mid-programme: past the 100 supervised cups, so cleared for
        // independent routine checks but not for Tier 2/3 resolution.
        fullName: "Phạm Hồng Vân",
        email: "van@auctumledger.io",
        tier: "tier_2",
        yearsExperience: 3,
        supervisedCups: 128,
        totalCups: 260,
        lastRecertifiedAt: monthsAgo(7),
      },
      {
        // Still under supervision — the case that proves the gate works.
        fullName: "Lê Minh Đức",
        email: "duc@auctumledger.io",
        tier: "tier_2",
        yearsExperience: 2,
        supervisedCups: 64,
        totalCups: 64,
        lastRecertifiedAt: monthsAgo(1),
      },
      {
        fullName: "Đỗ Thanh Hà",
        email: "ha@auctumledger.io",
        tier: "tier_3",
        yearsExperience: 4,
        totalCups: 45,
      },
    ]);
    console.log(
      "Seeded 5 cupper profiles: 2 Q-Graders (§1.1 redundancy), 2 Tier 2, 1 Tier 3."
    );
  }

  process.exit(0);
}

seed();
