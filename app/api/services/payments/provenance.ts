// Provenance carried on payment — §3.8.
//
// "When a roaster pays for a green lot through the system, the transaction
// automatically carries provenance data."
//
// The chain already exists in the schema; this resolves it in one query so a
// payment can answer, without a human assembling it: whose coffee was this,
// how was it processed, what did it cup at, and what is the farmer's share.
//
// That last part is the point. Traceability that stops at "Đắk Lắk, washed" is
// marketing. Traceability that names the partner whose revenue share this
// payment funds is the brand promise — value co-created, not extracted.
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  coffeeLots,
  commercialContracts,
  contractLots,
  counterparties,
  invoices,
  lotAddenda,
  partners,
  paymentAllocations,
  providerTransactions,
} from "@db/schema";
import { minorFromDb } from "@contracts/money";
import { qualityTierForScore, roundScore } from "@contracts/constants";

export type LotProvenance = {
  lotId: number;
  lotName: string;
  origin: string;
  region: string;
  farm: string | null;
  varietal: string;
  processMethod: string;
  elevationMeters: number;
  /** Rounded to 2dp before use — the tier boundary is money (B4). */
  cupScore: number;
  qualityTier: string;
  revenueSharePct: number;
  certifications: string[];
  harvestYear: number | null;
  moistureContent: string | null;
  /** The Revenue Share partner this lot's proceeds flow to, when linked. */
  partner: { id: number; name: string; type: string; region: string } | null;
};

export type PaymentProvenance = {
  allocationId: number;
  invoiceId: number;
  invoiceNumber: string;
  amountMinor: bigint;
  currency: string;
  paidAt: Date;
  provider: string;
  counterparty: { id: number; name: string; country: string };
  lots: LotProvenance[];
  /** True when the chain resolved all the way to at least one lot. */
  traceable: boolean;
};

/**
 * Resolve payment → invoice → contract → lots → partner.
 *
 * Returns `traceable: false` rather than throwing when the chain breaks: an
 * invoice raised against an order rather than a contract is a legitimate case,
 * and a payment screen must still render.
 */
export async function provenanceForAllocation(
  allocationId: number
): Promise<PaymentProvenance | null> {
  const db = getDb();

  const [row] = await db
    .select({
      allocationId: paymentAllocations.id,
      amountMinor: paymentAllocations.amountMinor,
      currency: paymentAllocations.currency,
      createdAt: paymentAllocations.createdAt,
      provider: providerTransactions.provider,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      payableType: invoices.payableType,
      payableId: invoices.payableId,
      counterpartyId: invoices.counterpartyId,
      counterpartyName: counterparties.name,
      counterpartyCountry: counterparties.country,
    })
    .from(paymentAllocations)
    .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
    .innerJoin(
      providerTransactions,
      eq(providerTransactions.id, paymentAllocations.providerTransactionId)
    )
    .leftJoin(counterparties, eq(counterparties.id, invoices.counterpartyId))
    .where(
      and(
        eq(paymentAllocations.id, allocationId),
        isNull(paymentAllocations.reversedAt)
      )
    );

  if (!row) return null;

  const lots =
    row.payableType === "contract" ? await lotsForContract(row.payableId) : [];

  return {
    allocationId: row.allocationId,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    amountMinor: minorFromDb(row.amountMinor),
    currency: row.currency,
    paidAt: row.createdAt,
    provider: row.provider,
    counterparty: {
      id: row.counterpartyId,
      name: row.counterpartyName ?? `Counterparty ${row.counterpartyId}`,
      country: row.counterpartyCountry ?? "",
    },
    lots,
    traceable: lots.length > 0,
  };
}

/** Every lot on a contract, with its farm story and revenue-share partner. */
export async function lotsForContract(contractId: number): Promise<LotProvenance[]> {
  const db = getDb();

  const rows = await db
    .select({
      lotId: coffeeLots.id,
      lotName: coffeeLots.name,
      origin: coffeeLots.origin,
      region: coffeeLots.region,
      farm: coffeeLots.farm,
      varietal: coffeeLots.varietal,
      processMethod: coffeeLots.processMethod,
      elevationMeters: coffeeLots.elevationMeters,
      cupScore: coffeeLots.cupScore,
      certifications: coffeeLots.certifications,
      harvestYear: coffeeLots.harvestYear,
      moistureContent: coffeeLots.moistureContent,
    })
    .from(contractLots)
    .innerJoin(coffeeLots, eq(coffeeLots.id, contractLots.lotId))
    .where(eq(contractLots.contractId, contractId));

  return Promise.all(
    rows.map(async r => {
      // roundScore before the tier lookup: this number sets a farmer's share,
      // and a double cannot represent 85.995 exactly (B4).
      const cupScore = roundScore(r.cupScore);
      const tier = qualityTierForScore(cupScore);
      return {
        lotId: r.lotId,
        lotName: r.lotName,
        origin: r.origin,
        region: r.region,
        farm: r.farm,
        varietal: r.varietal,
        processMethod: r.processMethod,
        elevationMeters: r.elevationMeters,
        cupScore,
        qualityTier: tier.name,
        revenueSharePct: tier.sharePct,
        certifications: Array.isArray(r.certifications) ? r.certifications : [],
        harvestYear: r.harvestYear,
        moistureContent: r.moistureContent,
        partner: await partnerForLot(r.lotId),
      };
    })
  );
}

/**
 * The Revenue Share partner behind a lot.
 *
 * Two routes exist and both are legitimate: a lot addendum names the partner
 * directly (Exhibit D), and a counterparty may carry a partnerId. The addendum
 * is authoritative because it is the document the floor price is owed under.
 */
async function partnerForLot(
  lotId: number
): Promise<{ id: number; name: string; type: string; region: string } | null> {
  const db = getDb();

  const [addendum] = await db
    .select({ partnerId: lotAddenda.partnerId })
    .from(lotAddenda)
    .where(eq(lotAddenda.lotId, lotId))
    .limit(1);
  if (!addendum) return null;

  const partner = await db.query.partners.findFirst({
    where: eq(partners.id, addendum.partnerId),
  });
  if (!partner) return null;

  return {
    id: partner.id,
    name: partner.partnerName,
    type: partner.partnerType,
    region: partner.originRegion,
  };
}

/**
 * Contract ids a lot appears on — the reverse direction, for the lot detail
 * timeline that proves the traceability invariant to a customer.
 */
export async function contractsForLot(lotId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ contractId: contractLots.contractId })
    .from(contractLots)
    .innerJoin(
      commercialContracts,
      eq(commercialContracts.id, contractLots.contractId)
    )
    .where(and(eq(contractLots.lotId, lotId), isNull(commercialContracts.deletedAt)));
  return rows.map(r => r.contractId);
}
