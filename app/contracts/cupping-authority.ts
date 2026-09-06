// Cupper qualification and authority — Cupping Standards SOP §1.
//
// The SOP's §1.1 is a table of who may cup what. Left as prose it is a policy
// nobody enforces; encoded here it becomes a precondition the QC router checks
// before it will record a session. That is the whole point of this file.
//
// The governing rule, from §1.1's own rationale: "Untrained cuppers introduce
// subjective error and inconsistency." A cup score sets the Revenue Share tier,
// which sets a farmer's payment — so who is permitted to produce one is a
// financial control, not an HR nicety.

/** Bumped when a tier's authority, an accuracy band, or a threshold changes. */
export const CUPPING_MODEL_VERSION = "sop-1.0";

export const CUPPER_TIERS = ["tier_0", "tier_3", "tier_2", "tier_1"] as const;
export type CupperTier = (typeof CUPPER_TIERS)[number];

/**
 * What a cupper at this tier is permitted to do.
 *
 * These are separate booleans rather than one ordered "level" because the SOP's
 * authorities are not a straight ladder: a Tier 3 barista may sit on a panel
 * but may never cup alone, while a Tier 2 cupper may cup alone for routine
 * checks yet is barred from arbitration. Collapsing that into a number loses
 * exactly the distinction that matters.
 */
export type CupperAuthority = {
  /** Routine quality checks, unsupervised. */
  independentCupping: boolean;
  /** Tier 1 exception investigation (§6.1). */
  tier1Exceptions: boolean;
  /** Tier 2/3 exception resolution and arbitration (§6.2, §6.3). */
  tier2And3Exceptions: boolean;
  /** May sit on a panel and contribute a score (§4.4). */
  panelParticipation: boolean;
  /** May certify another cupper as ready for independent work (§1.2 Phase 4). */
  mayCertifyOthers: boolean;
};

export type TierSpec = {
  label: string;
  requirement: string;
  authority: CupperAuthority;
  /**
   * Points, ± . §1.1 gives each tier an expected score spread; §1.3 disqualifies
   * a cupper whose observed variance exceeds DISQUALIFYING_VARIANCE regardless
   * of tier, because that signals lost sensory acuity rather than inexperience.
   */
  accuracyBand: number | null;
  /** Supervised cups required before independent work (§1.1, §1.2). */
  supervisedCupsRequired: number;
  minimumYearsExperience: number;
};

export const TIER_SPECS: Record<CupperTier, TierSpec> = {
  tier_1: {
    label: "Q-Grader",
    requirement:
      "Active SCA Q-Grader licence, valid three years. 5+ years specialty coffee, 500+ cups.",
    authority: {
      independentCupping: true,
      tier1Exceptions: true,
      tier2And3Exceptions: true,
      panelParticipation: true,
      mayCertifyOthers: true,
    },
    accuracyBand: 1.5,
    supervisedCupsRequired: 0,
    minimumYearsExperience: 5,
  },
  tier_2: {
    label: "SCA-trained cupper",
    requirement:
      "SCA foundation cupping course, then 100 supervised cups under a Q-Grader. 2+ years in coffee.",
    authority: {
      independentCupping: true,
      tier1Exceptions: true,
      // §1.1 — "cannot cup for Tier 2/3 exception resolution or arbitration
      // disputes (must be verified by Q-Grader)". The money is largest exactly
      // where this is false.
      tier2And3Exceptions: false,
      panelParticipation: true,
      mayCertifyOthers: false,
    },
    accuracyBand: 2.5,
    supervisedCupsRequired: 100,
    minimumYearsExperience: 2,
  },
  tier_3: {
    label: "Coffee professional",
    requirement:
      "2+ years industry experience. In-house sensory programme, no formal cupping cert.",
    authority: {
      independentCupping: false,
      tier1Exceptions: false,
      tier2And3Exceptions: false,
      panelParticipation: true,
      mayCertifyOthers: false,
    },
    // §1.1 — "not scored independently; participates in group notes".
    accuracyBand: null,
    supervisedCupsRequired: 0,
    minimumYearsExperience: 2,
  },
  tier_0: {
    label: "Non-certified",
    requirement: "None. Warehouse staff and new hires.",
    authority: {
      independentCupping: false,
      tier1Exceptions: false,
      tier2And3Exceptions: false,
      panelParticipation: false,
      mayCertifyOthers: false,
    },
    accuracyBand: null,
    supervisedCupsRequired: 0,
    minimumYearsExperience: 0,
  },
};

// ─── §1.3 recertification and disqualification ───────────────────────────────

/** A Q-Grader licence runs three years (§1.1). */
export const QGRADER_LICENCE_YEARS = 3;
/**
 * §1.3 — a Tier 1 loses authority once an expired licence goes unrenewed for
 * six months. The grace period is deliberate: a lapsed renewal is administrative,
 * and treating it as instant disqualification would strand lots mid-investigation.
 */
export const LICENCE_GRACE_DAYS = 183;
/** Recertification is annual for Tier 1 and Tier 2 (§1.3). */
export const RECERTIFICATION_DAYS = 365;
/** Warn before it bites, so a lapse is scheduled rather than discovered. */
export const RECERTIFICATION_WARNING_DAYS = 30;
/** §1.3 — "cup score variance exceeds ±3 points consistently". */
export const DISQUALIFYING_VARIANCE = 3;
/** §1.3 dashboard — flag a rising trend before it reaches the hard limit. */
export const VARIANCE_WATCH_THRESHOLD = 2;
/** The dashboard window (§1.3): "variance across all cups in the past 12 months". */
export const VARIANCE_WINDOW_DAYS = 365;

export const DISQUALIFICATION_REASONS = [
  "licence_expired",
  "variance_exceeded",
  "recertification_missed",
  "cupping_fraud",
] as const;
export type DisqualificationReason = (typeof DISQUALIFICATION_REASONS)[number];

export const DISQUALIFICATION_COPY: Record<DisqualificationReason, string> = {
  licence_expired:
    "Q-Grader licence expired and was not renewed within six months (§1.3).",
  variance_exceeded: `Cup-score variance exceeded ±${DISQUALIFYING_VARIANCE} points consistently — investigate for sensory decline (§1.3).`,
  recertification_missed: "Did not complete annual recertification (§1.3).",
  cupping_fraud:
    "Documented cupping fraud — a score recorded without tasting the coffee (§1.3).",
};

export type CupperProfileInput = {
  tier: CupperTier;
  /** Null for tiers that carry no licence. */
  licenceExpiresAt: Date | null;
  /** Last successful annual recertification; null if never certified. */
  lastRecertifiedAt: Date | null;
  supervisedCups: number;
  /** Set by a QC manager; overrides everything below it. */
  suspended: boolean;
  suspensionReason: string | null;
  /** Rolling 12-month observed variance, or null when there is no history. */
  observedVariance: number | null;
};

export type AuthorityResult = {
  authority: CupperAuthority;
  /** Empty when the cupper is in good standing. */
  blockers: string[];
  /**
   * Blockers that remove EVERY authority, including panel participation.
   * §1.3's disqualification triggers are about integrity and sensory acuity,
   * and a cupper who fails one is not a reliable panellist either.
   */
  disqualifying: string[];
  /**
   * Blockers that remove only INDEPENDENT authority.
   *
   * The supervised-cup requirement is the whole of this category, and keeping
   * it separate is not a nicety: §1.2 says the 100 cups must be performed
   * "under a Tier 1 Q-Grader", which is panel work. Treating an unmet cup count
   * as total disqualification would bar a trainee from the only activity that
   * lets them meet it — a trainee who can never train.
   */
  supervisionPending: string[];
  /** True when nothing bars them from the authorities their tier grants. */
  inGoodStanding: boolean;
  /** Days until recertification lapses; negative once overdue. */
  daysUntilRecertification: number | null;
  /** Days until the licence lapses; negative once expired. */
  daysUntilLicenceExpiry: number | null;
};

const NO_AUTHORITY: CupperAuthority = {
  independentCupping: false,
  tier1Exceptions: false,
  tier2And3Exceptions: false,
  panelParticipation: false,
  mayCertifyOthers: false,
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * What this cupper may actually do right now.
 *
 * Every blocker is returned rather than the first one found. A QC manager
 * fixing one lapse only to discover a second on the next attempt is how a
 * control gets routed around, and every reason here is independently
 * actionable.
 *
 * Note the asymmetry: a disqualified Tier 1 drops to NO authority, not to Tier
 * 2's. §1.3's triggers are about integrity and sensory acuity, and neither is
 * repaired by demotion — a cupper whose variance has blown out is not a
 * reliable panellist either.
 */
export function resolveAuthority(
  profile: CupperProfileInput,
  now = new Date()
): AuthorityResult {
  const spec = TIER_SPECS[profile.tier];
  const disqualifying: string[] = [];
  const supervisionPending: string[] = [];

  const daysUntilLicenceExpiry = profile.licenceExpiresAt
    ? daysBetween(now, profile.licenceExpiresAt)
    : null;
  const daysUntilRecertification = profile.lastRecertifiedAt
    ? RECERTIFICATION_DAYS - daysBetween(profile.lastRecertifiedAt, now)
    : null;

  if (profile.suspended) {
    disqualifying.push(
      profile.suspensionReason
        ? `Suspended: ${profile.suspensionReason}`
        : "Suspended by the QC manager."
    );
  }

  // §1.1 — a Q-Grader without a live licence is not a Q-Grader.
  if (profile.tier === "tier_1") {
    if (daysUntilLicenceExpiry === null) {
      disqualifying.push("No Q-Grader licence on file (§1.1).");
    } else if (daysUntilLicenceExpiry < -LICENCE_GRACE_DAYS) {
      disqualifying.push(DISQUALIFICATION_COPY.licence_expired);
    }
  }

  // §1.2 — Tier 2 works under supervision until the hundredth cup.
  if (profile.supervisedCups < spec.supervisedCupsRequired) {
    supervisionPending.push(
      `${spec.supervisedCupsRequired - profile.supervisedCups} more supervised cups required before independent work (§1.2).`
    );
  }

  // §1.3 — annual recertification applies to the two scoring tiers only.
  const needsRecert = profile.tier === "tier_1" || profile.tier === "tier_2";
  if (needsRecert) {
    if (daysUntilRecertification === null) {
      disqualifying.push("Never completed the annual recertification (§1.3).");
    } else if (daysUntilRecertification < 0) {
      disqualifying.push(DISQUALIFICATION_COPY.recertification_missed);
    }
  }

  if (
    profile.observedVariance !== null &&
    profile.observedVariance > DISQUALIFYING_VARIANCE
  ) {
    disqualifying.push(DISQUALIFICATION_COPY.variance_exceeded);
  }

  // A disqualified cupper loses everything. A trainee mid-supervision keeps
  // exactly the panel seat that lets them finish supervision.
  const authority: CupperAuthority = disqualifying.length
    ? NO_AUTHORITY
    : supervisionPending.length
      ? { ...spec.authority, independentCupping: false, tier1Exceptions: false }
      : spec.authority;

  const blockers = [...disqualifying, ...supervisionPending];

  return {
    authority,
    blockers,
    disqualifying,
    supervisionPending,
    inGoodStanding: blockers.length === 0,
    daysUntilRecertification,
    daysUntilLicenceExpiry,
  };
}

/** §1.3 dashboard states, in the order a QC manager should worry about them. */
export type PerformanceState = "disqualified" | "watch" | "healthy" | "unrated";

export function performanceState(
  observedVariance: number | null
): PerformanceState {
  if (observedVariance === null) return "unrated";
  if (observedVariance > DISQUALIFYING_VARIANCE) return "disqualified";
  if (observedVariance >= VARIANCE_WATCH_THRESHOLD) return "watch";
  return "healthy";
}

// ─── §4.4 panel composition ──────────────────────────────────────────────────

/** §4.4 — a panel is three cuppers. */
export const PANEL_SIZE = 3;

export type PanelMember = {
  name: string;
  result: AuthorityResult;
  tier: CupperTier;
};

export type PanelCheck = { ok: boolean; problems: string[] };

/**
 * Whether this group may sit as a panel for an exception at this tier.
 *
 * §6.2 requires a Q-Grader on a Tier 2 panel and §6.3 on a Tier 3; a panel of
 * three Tier 3 baristas satisfies the head-count and none of the intent.
 */
export function checkPanel(
  members: PanelMember[],
  exceptionTier: 1 | 2 | 3
): PanelCheck {
  const problems: string[] = [];

  if (exceptionTier > 1 && members.length < PANEL_SIZE) {
    problems.push(
      `A Tier ${exceptionTier} exception needs a ${PANEL_SIZE}-cupper panel; ${members.length} named (§4.4).`
    );
  }

  for (const m of members) {
    if (!m.result.authority.panelParticipation) {
      problems.push(
        `${m.name} (${TIER_SPECS[m.tier].label}) may not sit on a panel: ${m.result.disqualifying[0] ?? "tier carries no panel authority"}`
      );
    }
  }

  if (exceptionTier >= 2) {
    const hasQGrader = members.some(
      m => m.tier === "tier_1" && m.result.authority.tier2And3Exceptions
    );
    if (!hasQGrader) {
      problems.push(
        `A Tier ${exceptionTier} exception must be resolved by a Q-Grader in good standing (§6.${exceptionTier}).`
      );
    }
  }

  return { ok: problems.length === 0, problems };
}

// ─── §1.2 the in-house training programme ────────────────────────────────────

export type TrainingPhase = {
  code: string;
  phase: number;
  title: string;
  weeks: string;
  objective: string;
  /** What is measured, and the number that decides pass or fail. */
  passCriterion: string;
  /** Machine-checkable threshold where the SOP gives one. */
  threshold:
    | { kind: "ratio"; correct: number; outOf: number }
    | { kind: "count"; atLeast: number }
    | { kind: "variance"; withinPoints: number }
    | null;
};

export const TRAINING_PROGRAMME: TrainingPhase[] = [
  {
    code: "PHASE-1",
    phase: 1,
    title: "Sensory acuity testing",
    weeks: "Week 1",
    objective:
      "Verify the cupper's nose and tongue are functional before spending six weeks training them. Twenty reference aroma compounds, then the five basic tastes at varying concentrations.",
    passCriterion: "16 of 20 aroma compounds identified correctly (80%).",
    threshold: { kind: "ratio", correct: 16, outOf: 20 },
  },
  {
    code: "PHASE-2",
    phase: 2,
    title: "SCA flavour wheel training",
    weeks: "Weeks 2–3",
    objective:
      "Build a mental reference database: 50+ descriptors from the World Coffee Research Sensory Lexicon, each anchored to a physical reference standard, so a detected flavour can be named against something real rather than guessed.",
    passCriterion:
      "40+ descriptors placed consistently across multiple tastings.",
    threshold: { kind: "count", atLeast: 40 },
  },
  {
    code: "PHASE-3",
    phase: 3,
    title: "Cupping consistency training",
    weeks: "Weeks 4–6",
    objective:
      "Same coffee cupped three times across different sessions; ten panel cups against Q-Graders; a standardised reference coffee daily for six weeks. Consistency is the skill — a precise cupper who is reliably two points high is more useful than an imprecise one who averages correct.",
    passCriterion:
      "Own scores within ±1.5 points across repeats, and within ±2 points of the panel average.",
    threshold: { kind: "variance", withinPoints: 1.5 },
  },
  {
    code: "PHASE-4",
    phase: 4,
    title: "Certification and sign-off",
    weeks: "Week 7",
    objective:
      "A Q-Grader certifies the cupper for independent work on standard quality checks and Tier 1 exceptions. Recorded with a name, a date and a scope — a certification nobody signed is not a certification.",
    passCriterion: "Written sign-off by a Tier 1 Q-Grader in good standing.",
    threshold: null,
  },
];

/** §1.2 Phase 1 retest window. */
export const PHASE1_RETEST_WEEKS = 2;

export function phaseByCode(code: string): TrainingPhase | undefined {
  return TRAINING_PROGRAMME.find(p => p.code === code);
}

/**
 * Whether a recorded result clears its phase's threshold.
 *
 * Returns null where the SOP sets no machine-checkable number (Phase 4 is a
 * human signature), so a caller can tell "not applicable" from "failed".
 */
export function meetsThreshold(
  phase: TrainingPhase,
  score: number
): boolean | null {
  const t = phase.threshold;
  if (!t) return null;
  if (t.kind === "ratio") return score >= t.correct;
  if (t.kind === "count") return score >= t.atLeast;
  // Variance is the one where lower is better.
  return score <= t.withinPoints;
}

export function isCupperTier(value: string): value is CupperTier {
  return (CUPPER_TIERS as readonly string[]).includes(value);
}
