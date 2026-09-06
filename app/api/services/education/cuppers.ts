// Cupper authority and performance — Cupping Standards SOP §1.
//
// This is the layer that turns stored qualifications into a yes-or-no answer
// the QC router can act on. The arithmetic lives in contracts/cupping-authority
// so it stays pure and testable; everything here is about assembling the facts
// that function needs.
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  cupperCalibrations,
  cupperProfiles,
  trainingProgress,
} from "@db/schema";
import {
  DISQUALIFYING_VARIANCE,
  TIER_SPECS,
  TRAINING_PROGRAMME,
  VARIANCE_WINDOW_DAYS,
  checkPanel,
  meetsThreshold,
  performanceState,
  phaseByCode,
  resolveAuthority,
  type AuthorityResult,
  type CupperTier,
  type PanelMember,
  type PerformanceState,
} from "@contracts/cupping-authority";
import { emitEvent } from "../../engine";

export type CupperView = {
  id: number;
  fullName: string;
  tier: CupperTier;
  tierLabel: string;
  licenceNumber: string;
  licenceExpiresAt: string | null;
  supervisedCups: number;
  totalCups: number;
  suspended: boolean;
  suspensionReason: string | null;
  observedVariance: number | null;
  performance: PerformanceState;
  authority: AuthorityResult;
};

/**
 * Mean absolute deviation across the rolling window (§1.3: "variance across all
 * cups in the past 12 months").
 *
 * Mean ABSOLUTE deviation, not a signed mean: a cupper who is three points high
 * on one lot and three low on the next averages to zero, and averaging is
 * exactly how you would miss them. The SOP's threshold is "±3 points", which is
 * a statement about spread.
 */
export async function observedVariance(
  profileId: number,
  now = new Date()
): Promise<number | null> {
  const since = new Date(now.getTime() - VARIANCE_WINDOW_DAYS * 86_400_000);
  const [row] = await getDb()
    .select({
      n: sql<number>`count(*)`,
      mad: sql<number>`avg(abs(${cupperCalibrations.deltaPoints}))`,
    })
    .from(cupperCalibrations)
    .where(
      and(
        eq(cupperCalibrations.profileId, profileId),
        gte(cupperCalibrations.observedAt, since)
      )
    );
  // One data point is not a variance. Reporting it as one would disqualify a
  // cupper on a single bad morning.
  if (!row || Number(row.n) < 3) return null;
  return Math.round(Number(row.mad) * 100) / 100;
}

async function toView(
  row: typeof cupperProfiles.$inferSelect,
  now = new Date()
): Promise<CupperView> {
  const variance = await observedVariance(row.id, now);
  const authority = resolveAuthority(
    {
      tier: row.tier,
      licenceExpiresAt: row.licenceExpiresAt
        ? new Date(`${row.licenceExpiresAt}T00:00:00Z`)
        : null,
      lastRecertifiedAt: row.lastRecertifiedAt,
      supervisedCups: row.supervisedCups,
      suspended: row.suspended,
      suspensionReason: row.suspensionReason,
      observedVariance: variance,
    },
    now
  );
  return {
    id: row.id,
    fullName: row.fullName,
    tier: row.tier,
    tierLabel: TIER_SPECS[row.tier].label,
    licenceNumber: row.licenceNumber,
    licenceExpiresAt: row.licenceExpiresAt,
    supervisedCups: row.supervisedCups,
    totalCups: row.totalCups,
    suspended: row.suspended,
    suspensionReason: row.suspensionReason,
    observedVariance: variance,
    performance: performanceState(variance),
    authority,
  };
}

export async function listCuppers(now = new Date()): Promise<CupperView[]> {
  const rows = await getDb()
    .select()
    .from(cupperProfiles)
    .where(isNull(cupperProfiles.deletedAt))
    .orderBy(cupperProfiles.tier, cupperProfiles.fullName);
  return Promise.all(rows.map(r => toView(r, now)));
}

export async function cupperById(
  id: number,
  now = new Date()
): Promise<CupperView | null> {
  const row = await getDb().query.cupperProfiles.findFirst({
    where: eq(cupperProfiles.id, id),
  });
  return row ? toView(row, now) : null;
}

/** Resolve by the name written on a scorecard, which is how QC identifies cuppers. */
export async function cupperByName(
  fullName: string,
  now = new Date()
): Promise<CupperView | null> {
  const row = await getDb().query.cupperProfiles.findFirst({
    where: eq(cupperProfiles.fullName, fullName),
  });
  return row ? toView(row, now) : null;
}

export type SessionAuthorityCheck = {
  ok: boolean;
  problems: string[];
  /** Names with no profile at all — the most common real-world failure. */
  unknown: string[];
  members: { name: string; tier: CupperTier; inGoodStanding: boolean }[];
};

/**
 * Whether these people may record this cupping session.
 *
 * Called by the QC router before a session is written. An unknown name is a
 * problem rather than a pass: the SOP's Tier 0 exists precisely so that "not on
 * the list" has a defined answer, and it is no.
 */
export async function checkSessionAuthority(args: {
  cupperNames: string[];
  isPanel: boolean;
  exceptionTier?: 1 | 2 | 3;
  now?: Date;
}): Promise<SessionAuthorityCheck> {
  const now = args.now ?? new Date();
  const names = args.cupperNames.map(n => n.trim()).filter(Boolean);
  const problems: string[] = [];
  const unknown: string[] = [];
  const members: PanelMember[] = [];
  const summary: SessionAuthorityCheck["members"] = [];

  for (const name of names) {
    const view = await cupperByName(name, now);
    if (!view) {
      unknown.push(name);
      problems.push(
        `${name} has no cupper profile. §1.1 Tier 0 may not cup for verification purposes.`
      );
      continue;
    }
    members.push({
      name: view.fullName,
      result: view.authority,
      tier: view.tier,
    });
    summary.push({
      name: view.fullName,
      tier: view.tier,
      inGoodStanding: view.authority.inGoodStanding,
    });
  }

  if (args.isPanel || args.exceptionTier) {
    const panel = checkPanel(members, args.exceptionTier ?? 1);
    problems.push(...panel.problems);
  } else {
    // A solo session is an independent cup, whatever it is labelled.
    for (const m of members) {
      if (!m.result.authority.independentCupping) {
        problems.push(
          `${m.name} may not cup independently: ${m.result.blockers[0] ?? `${TIER_SPECS[m.tier].label} carries no independent authority (§1.1)`}`
        );
      }
    }
  }

  return { ok: problems.length === 0, problems, unknown, members: summary };
}

// ─── §1.2 training ───────────────────────────────────────────────────────────

export type PhaseProgress = {
  phaseCode: string;
  title: string;
  weeks: string;
  passCriterion: string;
  attempts: number;
  bestScore: number | null;
  outcome: "passed" | "failed" | "in_progress" | "not_started";
};

export async function progressFor(profileId: number): Promise<PhaseProgress[]> {
  const rows = await getDb()
    .select()
    .from(trainingProgress)
    .where(eq(trainingProgress.profileId, profileId))
    .orderBy(desc(trainingProgress.attempt));

  return TRAINING_PROGRAMME.map(phase => {
    const mine = rows.filter(r => r.phaseCode === phase.code);
    const passed = mine.find(r => r.outcome === "passed");
    const scores = mine
      .map(r => r.score)
      .filter((s): s is number => s !== null);
    return {
      phaseCode: phase.code,
      title: phase.title,
      weeks: phase.weeks,
      passCriterion: phase.passCriterion,
      attempts: mine.length,
      // Phase 3 is scored as variance, where lower is better — taking a max
      // there would report the worst attempt as the best.
      bestScore: scores.length
        ? phase.threshold?.kind === "variance"
          ? Math.min(...scores)
          : Math.max(...scores)
        : null,
      outcome: passed
        ? "passed"
        : mine.length === 0
          ? "not_started"
          : mine.some(r => r.outcome === "in_progress")
            ? "in_progress"
            : "failed",
    };
  });
}

export type RecordAttemptInput = {
  profileId: number;
  phaseCode: string;
  score: number | null;
  assessorProfileId?: number | null;
  notes?: string;
  recordedByUserId: number;
};

/**
 * Record one phase attempt, grading it against the SOP's own threshold.
 *
 * The outcome is derived, never supplied: a caller that could pass its own
 * pass/fail would let a phase be marked passed on a failing score, which is the
 * §1.3 "cupping fraud" trigger wearing a friendlier face.
 */
export async function recordAttempt(input: RecordAttemptInput) {
  const phase = phaseByCode(input.phaseCode);
  if (!phase) throw new Error(`GS-EDU-1010 · unknown phase ${input.phaseCode}`);

  const db = getDb();
  const [prior] = await db
    .select({ n: sql<number>`count(*)` })
    .from(trainingProgress)
    .where(
      and(
        eq(trainingProgress.profileId, input.profileId),
        eq(trainingProgress.phaseCode, input.phaseCode)
      )
    );
  const attempt = Number(prior?.n ?? 0) + 1;

  const graded =
    input.score === null ? null : meetsThreshold(phase, input.score);
  const outcome =
    graded === null
      ? // Phase 4 is a human signature: an assessor makes it a pass.
        input.assessorProfileId
        ? ("passed" as const)
        : ("in_progress" as const)
      : graded
        ? ("passed" as const)
        : ("failed" as const);

  const [inserted] = await db.insert(trainingProgress).values({
    profileId: input.profileId,
    phaseCode: input.phaseCode,
    attempt,
    score: input.score,
    outcome,
    assessorProfileId: input.assessorProfileId ?? null,
    notes: input.notes ?? null,
    recordedByUserId: input.recordedByUserId,
    completedAt: outcome === "in_progress" ? null : new Date(),
  });

  await emitEvent(
    "education.phase_recorded",
    "cupper_profile",
    input.profileId,
    {
      profileId: input.profileId,
      phaseCode: input.phaseCode,
      attempt,
      score: input.score,
      outcome,
    }
  );

  return { id: Number(inserted.insertId), attempt, outcome };
}

/** §1.3 — the QC manager's monthly view, worst first. */
export async function performanceDashboard(now = new Date()) {
  const cuppers = await listCuppers(now);
  const rank: Record<PerformanceState, number> = {
    disqualified: 0,
    watch: 1,
    unrated: 2,
    healthy: 3,
  };
  return cuppers
    .map(c => ({
      id: c.id,
      fullName: c.fullName,
      tier: c.tier,
      tierLabel: c.tierLabel,
      observedVariance: c.observedVariance,
      performance: c.performance,
      accuracyBand: TIER_SPECS[c.tier].accuracyBand,
      /** Over the band their own tier promises, but not yet disqualifying. */
      overBand:
        c.observedVariance !== null &&
        TIER_SPECS[c.tier].accuracyBand !== null &&
        c.observedVariance > (TIER_SPECS[c.tier].accuracyBand as number),
      inGoodStanding: c.authority.inGoodStanding,
      blockers: c.authority.blockers,
      daysUntilRecertification: c.authority.daysUntilRecertification,
      daysUntilLicenceExpiry: c.authority.daysUntilLicenceExpiry,
    }))
    .sort((a, b) => rank[a.performance] - rank[b.performance]);
}

export { DISQUALIFYING_VARIANCE };
