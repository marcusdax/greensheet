// Trust evidence handlers — spec §3 and §6.
//
// These are where Trust stops being a model and starts being fed by things that
// actually happened. Each one converts a domain event into evidence, then
// recomputes; neither step ever runs without the other, and both are idempotent
// because outbox delivery is at-least-once.
//
// The §3 rule that shapes all of them: nothing here reads a self-reported
// field. An OCR document only counts once a human accepted it, a payment only
// counts once it settled, and a cup score only counts against a claim when a
// cupping session actually disagreed with it.
import { and, eq } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  coffeeLots,
  counterparties,
  cuppingSessions,
  documents,
  invoices,
  ocrResults,
} from "@db/schema";
import { registerHandler, type OutboxEvent } from "../outbox/registry";
import {
  DOCUMENT_EVIDENCE_WEIGHT,
  type TrustEntityType,
} from "@contracts/trust";
import { roundScore } from "@contracts/constants";
import { getFlags } from "../flags";
import { recalculate, recordEvidence } from "./index";
import { cupScoreEvidenceWeight } from "./calculator";

/**
 * Which Trust entity a document's own entity reference points at.
 *
 * A document filed against a contract or an invoice is evidence about the
 * counterparty on it, not about the paperwork — so the mapping resolves through
 * to the party whose honesty is actually in question.
 */
async function trustTargetForDocument(doc: {
  entityType: string;
  entityId: number | null;
}): Promise<{ entityType: TrustEntityType; entityId: number } | null> {
  if (!doc.entityId) return null;
  const db = getDb();

  switch (doc.entityType) {
    case "coffee_lot":
      return { entityType: "lot", entityId: doc.entityId };
    case "counterparty":
      return { entityType: "counterparty", entityId: doc.entityId };
    case "invoice": {
      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, doc.entityId),
      });
      return invoice
        ? { entityType: "counterparty", entityId: invoice.counterpartyId }
        : null;
    }
    default:
      // Contracts, cupping sessions and shipments do not resolve to a single
      // party without more context than the document row carries. Returning
      // null is correct: no evidence is better than evidence filed against the
      // wrong counterparty.
      return null;
  }
}

// ─── §3 · accepted OCR documents are the primary evidence engine ─────────────

registerHandler("document.review_recorded", {
  name: "trust:document-evidence",
  async handle(event: OutboxEvent) {
    if (!(await getFlags()).trustScore) return "skip";
    const outcome = String(event.payload.outcome ?? "");
    // §3 — "rejected or low-confidence documents that are never accepted do not
    // move Trust". Uploading a blurry photo is not dishonesty.
    if (outcome !== "accepted" && outcome !== "edited") return "skip";

    const documentId = Number(event.payload.documentId);
    if (!Number.isInteger(documentId)) return "skip";

    const db = getDb();
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });
    if (!doc) return "skip";

    const target = await trustTargetForDocument(doc);
    if (!target) return "skip";

    const weight = DOCUMENT_EVIDENCE_WEIGHT[doc.documentType] ?? 2;
    const recorded = await recordEvidence({
      ...target,
      kind: "document_accepted",
      sourceType: "document",
      sourceId: documentId,
      weight,
      note: `${doc.documentType.replace(/_/g, " ")} accepted`,
    });

    // §6 — re-accepting the same documentId does not double-count. The evidence
    // row already existed, so there is nothing new to recompute either.
    if (!recorded.recorded) return "skip";

    await recalculate(target.entityType, target.entityId, {
      reason: `Accepted ${doc.documentType.replace(/_/g, " ")}`,
      evidenceIds: [recorded.evidenceId],
    });

    // A lab report accepted against a lot is also a quality claim we can now
    // check, which is a different kind of evidence from the document itself.
    if (
      doc.documentType === "sca_lab_report" &&
      doc.entityType === "coffee_lot"
    ) {
      await recordQualityFromLabReport(documentId, doc.entityId!);
    }

    return "handled";
  },
});

/**
 * §3 — "cross-check extracted fields against existing lot data; large
 * discrepancies lower Quality Consistency."
 *
 * The comparison goes through roundScore() for the same reason every other cup
 * score comparison does: the column is a float, and 84.999999 versus 85 is not
 * a contradiction, it is IEEE 754.
 */
async function recordQualityFromLabReport(
  documentId: number,
  lotId: number
): Promise<void> {
  const db = getDb();
  const [ocr] = await db
    .select({ structuredData: ocrResults.structuredData })
    .from(ocrResults)
    .where(eq(ocrResults.documentId, documentId))
    .limit(1);

  const extracted = ocr?.structuredData as
    { cupScore?: { value?: unknown } | number } | undefined;
  const raw =
    typeof extracted?.cupScore === "object" && extracted.cupScore !== null
      ? (extracted.cupScore as { value?: unknown }).value
      : extracted?.cupScore;
  const observed = Number(raw);
  if (!Number.isFinite(observed)) return;

  const lot = await db.query.coffeeLots.findFirst({
    where: eq(coffeeLots.id, lotId),
  });
  if (!lot) return;

  const weight = cupScoreEvidenceWeight(
    roundScore(lot.cupScore),
    roundScore(observed)
  );
  const contradicts = weight < 0;

  const recorded = await recordEvidence({
    entityType: "lot",
    entityId: lotId,
    kind: contradicts ? "quality_contradicted" : "quality_confirmed",
    sourceType: "document",
    sourceId: documentId,
    weight,
    note: contradicts
      ? `Lab report cupped ${roundScore(observed)} against a claimed ${roundScore(lot.cupScore)}`
      : `Lab report confirmed ${roundScore(observed)} against a claimed ${roundScore(lot.cupScore)}`,
  });
  if (!recorded.recorded) return;

  await recalculate("lot", lotId, {
    reason: contradicts ? "Cup score contradicted" : "Cup score confirmed",
    evidenceIds: [recorded.evidenceId],
  });

  // A contradiction is about the party who made the claim, not only the lot.
  const supplier = await supplierForLotViaContract(lotId);
  if (supplier && contradicts) {
    const cpRecorded = await recordEvidence({
      entityType: "counterparty",
      entityId: supplier,
      kind: "quality_contradicted",
      sourceType: "document",
      sourceId: documentId,
      weight,
      note: `Lot ${lot.name} cupped below its claim`,
    });
    if (cpRecorded.recorded) {
      await recalculate("counterparty", supplier, {
        reason: "Quality claim contradicted by an accepted lab report",
        evidenceIds: [cpRecorded.evidenceId],
      });
    }
  }
}

async function supplierForLotViaContract(
  lotId: number
): Promise<number | null> {
  const { commercialContracts, contractLots } = await import("@db/schema");
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
        eq(commercialContracts.direction, "purchase")
      )
    )
    .limit(1);
  return row?.id ?? null;
}

// ─── §2.2 · Transaction Integrity ────────────────────────────────────────────

registerHandler("invoice.settled", {
  name: "trust:payment-evidence",
  async handle(event: OutboxEvent) {
    if (!(await getFlags()).trustScore) return "skip";
    const invoiceId = Number(event.payload.invoiceId);
    if (!Number.isInteger(invoiceId)) return "skip";

    const invoice = await getDb().query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });
    if (!invoice) return "skip";

    // On time or late is the signal, not merely "paid". An invoice settled six
    // weeks late is not the same evidence as one settled on the due date, and
    // collapsing them would make the component meaningless.
    const settledAt = new Date();
    const dueAt = new Date(`${invoice.dueAt}T00:00:00Z`);
    const late = settledAt.getTime() > dueAt.getTime() + 86_400_000;

    const recorded = await recordEvidence({
      entityType: "counterparty",
      entityId: invoice.counterpartyId,
      kind: late ? "payment_late" : "payment_settled",
      sourceType: "invoice",
      sourceId: invoiceId,
      weight: late ? -2 : 3,
      note: late
        ? `${invoice.invoiceNumber} settled after its due date`
        : `${invoice.invoiceNumber} settled on time`,
    });
    if (!recorded.recorded) return "skip";

    await recalculate("counterparty", invoice.counterpartyId, {
      reason: late ? "Invoice settled late" : "Invoice settled on time",
      evidenceIds: [recorded.evidenceId],
    });
    return "handled";
  },
});

/**
 * A reversal is the strongest negative signal in this component: it means money
 * we believed had arrived had not, or had been applied to the wrong invoice.
 */
registerHandler("payment.reversed", {
  name: "trust:reversal-evidence",
  async handle(event: OutboxEvent) {
    if (!(await getFlags()).trustScore) return "skip";
    const invoiceId = Number(event.payload.invoiceId);
    const allocationId = Number(event.payload.allocationId);
    if (!Number.isInteger(invoiceId) || !Number.isInteger(allocationId))
      return "skip";

    const invoice = await getDb().query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });
    if (!invoice) return "skip";

    const recorded = await recordEvidence({
      entityType: "counterparty",
      entityId: invoice.counterpartyId,
      kind: "allocation_reversed",
      sourceType: "payment_allocation",
      sourceId: allocationId,
      weight: -4,
      note: `Allocation reversed on ${invoice.invoiceNumber}`,
    });
    if (!recorded.recorded) return "skip";

    await recalculate("counterparty", invoice.counterpartyId, {
      reason: "Payment allocation reversed",
      evidenceIds: [recorded.evidenceId],
    });
    return "handled";
  },
});

// ─── §2.2 · Quality Consistency from the cupping table ───────────────────────

registerHandler("qc.cupping_recorded", {
  name: "trust:cupping-evidence",
  async handle(event: OutboxEvent) {
    if (!(await getFlags()).trustScore) return "skip";
    const sessionId = Number(event.payload.sessionId);
    if (!Number.isInteger(sessionId)) return "skip";

    const db = getDb();
    const session = await db.query.cuppingSessions.findFirst({
      where: eq(cuppingSessions.id, sessionId),
    });
    if (!session) return "skip";

    // The session names a lot by code; without a matching catalog lot there is
    // no claim to check the result against.
    const lot = await db.query.coffeeLots.findFirst({
      where: eq(coffeeLots.name, session.lotCode),
    });
    if (!lot) return "skip";

    const weight = cupScoreEvidenceWeight(
      roundScore(lot.cupScore),
      roundScore(session.totalScore)
    );
    const recorded = await recordEvidence({
      entityType: "lot",
      entityId: lot.id,
      kind: weight < 0 ? "quality_contradicted" : "quality_confirmed",
      sourceType: "cupping_session",
      sourceId: sessionId,
      weight,
      note: `Cupped ${roundScore(session.totalScore)} against a claimed ${roundScore(lot.cupScore)}`,
    });
    if (!recorded.recorded) return "skip";

    await recalculate("lot", lot.id, {
      reason: "Cupping session recorded",
      evidenceIds: [recorded.evidenceId],
    });
    return "handled";
  },
});

// ─── §2.2 · Identity & Longevity ─────────────────────────────────────────────

registerHandler("counterparty.kyc_verified", {
  name: "trust:identity-evidence",
  async handle(event: OutboxEvent) {
    if (!(await getFlags()).trustScore) return "skip";
    const counterpartyId = Number(event.payload.counterpartyId);
    if (!Number.isInteger(counterpartyId)) return "skip";

    const cp = await getDb().query.counterparties.findFirst({
      where: eq(counterparties.id, counterpartyId),
    });
    if (!cp || cp.kycStatus !== "verified") return "skip";

    const recorded = await recordEvidence({
      entityType: "counterparty",
      entityId: counterpartyId,
      kind: "identity_verified",
      sourceType: "counterparty",
      sourceId: counterpartyId,
      weight: 5,
      note: "Business registration and tax identity verified",
    });
    if (!recorded.recorded) return "skip";

    await recalculate("counterparty", counterpartyId, {
      reason: "Identity verified",
      evidenceIds: [recorded.evidenceId],
    });
    return "handled";
  },
});
