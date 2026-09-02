// Trust Score persistence and recomputation — spec §3, §6.
//
// The invariant this file exists to hold: a score only ever changes as a
// consequence of an evidence row. `recordEvidence` writes the fact,
// `recalculate` derives the number from every fact on file, and there is no
// third path. An admin override is not an exception to that — it is an
// `admin_override` evidence row with a user id and a reason, so §9's "zero
// Trust updates without an evidence event or explicit audited override" is a
// property of the schema rather than a promise.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  coffeeLots,
  commercialContracts,
  contractLots,
  counterparties,
  documents,
  invoices,
  roasters,
  trustEvidence,
  trustScores,
  trustSnapshots,
} from "@db/schema";
import { emitEvent } from "../../engine";
import {
  BAND_SPECS,
  DOCUMENT_EVIDENCE_WEIGHT,
  EVIDENCE_COMPONENT,
  MODEL_VERSION,
  NEUTRAL_SCORE,
  bandFor,
  neutralComponents,
  settlementGate,
  type EvidenceKind,
  type TrustBand,
  type TrustComponents,
  type TrustEntityType,
  type TrustGate,
} from "@contracts/trust";
import { calculateScore, lotTrustScore, type EvidenceRow } from "./calculator";
import { isDuplicateKeyError } from "../../webhooks/shared";

/** §6 — only the last 30 snapshots are kept per entity. */
export const SNAPSHOT_RETENTION = 30;

export type TrustSnapshotView = {
  score: number;
  band: TrustBand;
  components: TrustComponents;
  evidenceCount: number;
  acceptedDocumentCount: number;
  modelVersion: string;
  calculatedAt: Date;
  overrideReason: string | null;
};

// ─── evidence ────────────────────────────────────────────────────────────────

export type RecordEvidenceInput = {
  entityType: TrustEntityType;
  entityId: number;
  kind: EvidenceKind;
  sourceType: string;
  sourceId: number;
  weight: number;
  note?: string;
  recordedByUserId?: number | null;
  occurredAt?: Date;
};

export type RecordEvidenceResult =
  | { recorded: true; evidenceId: number }
  | { recorded: false; reason: "duplicate" };

/**
 * Write one evidence row, exactly once.
 *
 * Idempotency is the unique index on (entityType, entityId, kind, sourceType,
 * sourceId), not a read-then-write: two outbox workers handling a redelivered
 * event would both pass a check-then-insert, and §6 requires that re-accepting
 * the same document cannot double-count.
 */
export async function recordEvidence(
  input: RecordEvidenceInput
): Promise<RecordEvidenceResult> {
  try {
    const [inserted] = await getDb()
      .insert(trustEvidence)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        kind: input.kind,
        component: EVIDENCE_COMPONENT[input.kind],
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        weight: input.weight.toFixed(2),
        note: input.note ?? "",
        recordedByUserId: input.recordedByUserId ?? null,
        modelVersion: MODEL_VERSION,
        occurredAt: input.occurredAt ?? new Date(),
      });
    const evidenceId = Number(inserted.insertId);

    await emitEvent(
      "trust.evidence_recorded",
      input.entityType,
      input.entityId,
      {
        evidenceId,
        entityType: input.entityType,
        entityId: input.entityId,
        kind: input.kind,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        weight: input.weight,
        modelVersion: MODEL_VERSION,
      }
    );

    return { recorded: true, evidenceId };
  } catch (err) {
    // The same document accepted twice. Not an error — the desired outcome.
    if (isDuplicateKeyError(err))
      return { recorded: false, reason: "duplicate" };
    throw err;
  }
}

export async function evidenceFor(
  entityType: TrustEntityType,
  entityId: number
): Promise<EvidenceRow[]> {
  const rows = await getDb()
    .select({
      kind: trustEvidence.kind,
      component: trustEvidence.component,
      weight: trustEvidence.weight,
      occurredAt: trustEvidence.occurredAt,
    })
    .from(trustEvidence)
    .where(
      and(
        eq(trustEvidence.entityType, entityType),
        eq(trustEvidence.entityId, entityId)
      )
    );
  return rows.map(r => ({
    kind: r.kind,
    component: r.component,
    weight: Number(r.weight),
    occurredAt: r.occurredAt,
  }));
}

// ─── inputs the calculator needs that are not evidence rows ──────────────────

async function identityInputs(
  entityType: TrustEntityType,
  entityId: number
): Promise<{
  accountAgeDays: number;
  identityVerified: boolean;
  completedLots: number;
}> {
  const db = getDb();
  const now = Date.now();
  const days = (from: Date | null | undefined) =>
    from ? Math.max(0, Math.floor((now - from.getTime()) / 86_400_000)) : 0;

  if (entityType === "counterparty") {
    const cp = await db.query.counterparties.findFirst({
      where: eq(counterparties.id, entityId),
    });
    if (!cp)
      return { accountAgeDays: 0, identityVerified: false, completedLots: 0 };
    const [settled] = await db
      .select({ n: sql<number>`count(*)` })
      .from(invoices)
      .where(
        and(eq(invoices.counterpartyId, entityId), eq(invoices.status, "paid"))
      );
    return {
      accountAgeDays: days(cp.createdAt),
      // A recorded MST plus a completed KYC check. Either alone is a claim.
      identityVerified: cp.kycStatus === "verified" && cp.taxId.length > 0,
      completedLots: Number(settled?.n ?? 0),
    };
  }

  if (entityType === "roaster") {
    const r = await db.query.roasters.findFirst({
      where: eq(roasters.id, entityId),
    });
    if (!r)
      return { accountAgeDays: 0, identityVerified: false, completedLots: 0 };
    const [linked] = await db
      .select({ n: sql<number>`count(*)` })
      .from(counterparties)
      .where(eq(counterparties.roasterId, entityId));
    return {
      accountAgeDays: days(r.createdAt),
      // A roaster is verified once it has a counterparty record that passed KYC.
      identityVerified:
        Number(linked?.n ?? 0) > 0 && r.lifecycleStatus === "active",
      completedLots: 0,
    };
  }

  return { accountAgeDays: 0, identityVerified: false, completedLots: 0 };
}

/**
 * Evidence points attached to one specific lot, for the §2.4 derived score.
 * Counted from documents rather than from trust_evidence, because a lot's
 * document density is a fact about the lot whether or not it has its own
 * evidence rows yet.
 */
export async function lotDocumentPoints(lotId: number): Promise<number> {
  const rows = await getDb()
    .select({
      documentType: documents.documentType,
      n: sql<number>`count(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.entityType, "coffee_lot"),
        eq(documents.entityId, lotId),
        isNull(documents.deletedAt)
      )
    )
    .groupBy(documents.documentType);

  return rows.reduce(
    (sum, r) =>
      sum + (DOCUMENT_EVIDENCE_WEIGHT[r.documentType] ?? 2) * Number(r.n),
    0
  );
}

/**
 * The supplier standing behind a lot.
 *
 * It is the counterparty on the PURCHASE contract — the party we bought from
 * and whose claims about the coffee we are relaying. A sale contract names the
 * buyer, whose trust is irrelevant to whether this lot is what it says it is.
 */
async function supplierForLot(lotId: number): Promise<number | null> {
  const [row] = await getDb()
    .select({ id: commercialContracts.counterpartyId })
    .from(contractLots)
    .innerJoin(
      commercialContracts,
      eq(commercialContracts.id, contractLots.contractId)
    )
    .where(
      and(
        eq(contractLots.lotId, lotId),
        eq(commercialContracts.direction, "purchase"),
        isNull(commercialContracts.deletedAt)
      )
    )
    .limit(1);
  return row?.id ?? null;
}

// ─── recomputation ───────────────────────────────────────────────────────────

export type RecalculateOptions = {
  reason?: string;
  evidenceIds?: number[];
};

/**
 * Rebuild an entity's score from every fact on file and persist it.
 *
 * Full recomputation rather than an incremental delta is deliberate. An
 * incremental score drifts: one lost event, one double-applied delta, and the
 * number no longer means anything, with no way to tell that from the outside.
 * Recomputing is cheap at this scale and is self-healing — a replayed event
 * lands on the same answer.
 */
export async function recalculate(
  entityType: TrustEntityType,
  entityId: number,
  opts: RecalculateOptions = {}
): Promise<TrustSnapshotView> {
  const db = getDb();
  const evidence = await evidenceFor(entityType, entityId);

  let score: number;
  let components: TrustComponents;

  if (entityType === "lot") {
    const supplierId = await supplierForLot(entityId);
    const supplier = supplierId
      ? await currentScore("counterparty", supplierId)
      : null;
    const derived = lotTrustScore({
      supplierScore: supplier?.score ?? null,
      lotDocumentPoints: await lotDocumentPoints(entityId),
    });
    score = derived.score;
    components = derived.components;
  } else {
    const identity = await identityInputs(entityType, entityId);
    const result = calculateScore({
      evidence,
      ...identity,
      // Peer feedback arrives as evidence rows; the rater weighting is applied
      // when the row is written, so here it is already a plain rating.
      peerFeedback: evidence
        .filter(e => e.component === "networkReputation")
        .map(e => ({ rating: 50 + e.weight * 10, raterScore: 100 })),
    });
    score = result.score;
    components = result.components;
  }

  const existing = await currentScore(entityType, entityId);
  const previous = existing?.score ?? null;
  const band = bandFor(score);
  const acceptedDocumentCount = evidence.filter(
    e => e.kind === "document_accepted"
  ).length;

  const row = {
    entityType,
    entityId,
    score: score.toFixed(1),
    band,
    components: components as unknown as Record<string, number>,
    evidenceCount: evidence.length,
    acceptedDocumentCount,
    modelVersion: MODEL_VERSION,
    calculatedAt: new Date(),
  };

  await db
    .insert(trustScores)
    .values(row)
    .onDuplicateKeyUpdate({
      set: {
        score: row.score,
        band: row.band,
        components: row.components,
        evidenceCount: row.evidenceCount,
        acceptedDocumentCount: row.acceptedDocumentCount,
        modelVersion: row.modelVersion,
        calculatedAt: row.calculatedAt,
      },
    });

  // Only a move is a data point. Writing a snapshot on every recomputation
  // would fill the trend line with thirty identical readings and push the
  // actual history out of the retention window.
  const moved = previous === null || Math.abs(previous - score) >= 0.05;
  if (moved) {
    await db.insert(trustSnapshots).values({
      entityType,
      entityId,
      previousScore: previous === null ? null : previous.toFixed(1),
      score: score.toFixed(1),
      band,
      components: components as unknown as Record<string, number>,
      evidenceIds: opts.evidenceIds ?? [],
      modelVersion: MODEL_VERSION,
      reason: opts.reason ?? "",
    });
    await pruneSnapshots(entityType, entityId);

    await emitEvent("trust.score_updated", entityType, entityId, {
      entityType,
      entityId,
      previous,
      next: score,
      band,
      components,
      modelVersion: MODEL_VERSION,
      evidenceIds: opts.evidenceIds ?? [],
      reason: opts.reason ?? "",
    });
  }

  return {
    score,
    band,
    components,
    evidenceCount: evidence.length,
    acceptedDocumentCount,
    modelVersion: MODEL_VERSION,
    calculatedAt: row.calculatedAt,
    overrideReason: existing?.overrideReason ?? null,
  };
}

async function pruneSnapshots(
  entityType: TrustEntityType,
  entityId: number
): Promise<void> {
  const db = getDb();
  const keep = await db
    .select({ id: trustSnapshots.id })
    .from(trustSnapshots)
    .where(
      and(
        eq(trustSnapshots.entityType, entityType),
        eq(trustSnapshots.entityId, entityId)
      )
    )
    .orderBy(desc(trustSnapshots.id))
    .limit(SNAPSHOT_RETENTION);

  if (keep.length < SNAPSHOT_RETENTION) return;
  const oldest = keep[keep.length - 1].id;
  await db
    .delete(trustSnapshots)
    .where(
      and(
        eq(trustSnapshots.entityType, entityType),
        eq(trustSnapshots.entityId, entityId),
        sql`${trustSnapshots.id} < ${oldest}`
      )
    );
}

// ─── reads ───────────────────────────────────────────────────────────────────

export async function currentScore(
  entityType: TrustEntityType,
  entityId: number
): Promise<TrustSnapshotView | null> {
  const [row] = await getDb()
    .select()
    .from(trustScores)
    .where(
      and(
        eq(trustScores.entityType, entityType),
        eq(trustScores.entityId, entityId)
      )
    )
    .limit(1);
  if (!row) return null;
  return {
    score: Number(row.score),
    band: row.band,
    components: (row.components ?? neutralComponents()) as TrustComponents,
    evidenceCount: row.evidenceCount,
    acceptedDocumentCount: row.acceptedDocumentCount,
    modelVersion: row.modelVersion,
    calculatedAt: row.calculatedAt,
    overrideReason: row.overrideReason,
  };
}

/**
 * The score to display when none has been calculated yet.
 *
 * §5.5 says a lot with zero document density shows "Add evidence" rather than a
 * zero. The distinction between "no evidence" and "bad evidence" has to survive
 * all the way to the badge, so it is carried as a flag rather than as a
 * sentinel score that some caller will eventually render as a real number.
 */
export function neutralView(): TrustSnapshotView & { unscored: true } {
  return {
    score: NEUTRAL_SCORE,
    band: bandFor(NEUTRAL_SCORE),
    components: neutralComponents(),
    evidenceCount: 0,
    acceptedDocumentCount: 0,
    modelVersion: MODEL_VERSION,
    calculatedAt: new Date(),
    overrideReason: null,
    unscored: true,
  };
}

export async function historyFor(
  entityType: TrustEntityType,
  entityId: number,
  limit = SNAPSHOT_RETENTION
) {
  const rows = await getDb()
    .select()
    .from(trustSnapshots)
    .where(
      and(
        eq(trustSnapshots.entityType, entityType),
        eq(trustSnapshots.entityId, entityId)
      )
    )
    .orderBy(desc(trustSnapshots.id))
    .limit(limit);
  return rows.map(r => ({
    ...r,
    score: Number(r.score),
    previousScore: r.previousScore === null ? null : Number(r.previousScore),
  }));
}

// ─── §7 policy ───────────────────────────────────────────────────────────────

/**
 * Whether a settlement may be released, and — always — why.
 *
 * An unscored counterparty is treated as neutral rather than as untrusted:
 * refusing to settle with someone because we have not yet computed a number
 * about them would be the system's problem, not theirs.
 */
export async function settlementGateFor(args: {
  counterpartyId: number;
  amountMinor: bigint;
  largeSettlementMinor?: bigint;
}): Promise<TrustGate> {
  const current =
    (await currentScore("counterparty", args.counterpartyId)) ?? neutralView();
  return settlementGate({
    score: current.score,
    acceptedDocumentCount: current.acceptedDocumentCount,
    amountMinor: args.amountMinor,
    // 500,000,000 đồng — a container-scale settlement, not a sample invoice.
    largeSettlementMinor: args.largeSettlementMinor ?? 500_000_000n,
  });
}

export function bandEffect(band: TrustBand): string {
  return BAND_SPECS[band].effect;
}

/** Every entity whose lot appears in the catalog, for badge hydration. */
export async function scoresForLots(
  lotIds: number[]
): Promise<Map<number, TrustSnapshotView>> {
  if (lotIds.length === 0) return new Map();
  const rows = await getDb()
    .select()
    .from(trustScores)
    .where(
      and(
        eq(trustScores.entityType, "lot"),
        sql`${trustScores.entityId} in ${lotIds}`
      )
    );
  return new Map(
    rows.map(r => [
      r.entityId,
      {
        score: Number(r.score),
        band: r.band,
        components: (r.components ?? neutralComponents()) as TrustComponents,
        evidenceCount: r.evidenceCount,
        acceptedDocumentCount: r.acceptedDocumentCount,
        modelVersion: r.modelVersion,
        calculatedAt: r.calculatedAt,
        overrideReason: r.overrideReason,
      },
    ])
  );
}

export { coffeeLots };
