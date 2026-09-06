// Demo seed — the operational surfaces the domain seeds leave empty.
//
// The other six seeds establish reference data: a catalog, counterparties,
// invoices, a curriculum, a dunning ladder. What none of them produce is
// *history* — a settled payment, an exception that was actually closed, a
// claim served on a supplier. Those screens render their empty state, which is
// the correct behaviour and a poor demonstration of a settlement product.
//
// Two rules this seed keeps, because a demo that violates them teaches the
// wrong thing about the system:
//
//   1. Money moves through `allocate()`, never through an INSERT. That service
//      recomputes `invoices.paidMinor` from the allocation rows inside the same
//      transaction, so the §13.3 reconciliation assertion still holds after
//      this seed runs. Hand-written allocation rows would leave drift that
//      pages on-call on the first nightly run.
//   2. Disposition and claim figures come from `calculateDowngrade()` and
//      `calculateClaim()` in contracts/, not from numbers typed here. The caps
//      in §C.1 and §C.2 are part of what is being demonstrated; a seed that
//      hard-codes a plausible-looking total can quietly contradict them.
import { eq, sql } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import {
  coffeeLots,
  invoices,
  lotDispositions,
  partners,
  paymentAllocations,
  providerTransactions,
  supplierClaims,
  waitlistSignups,
  warehouseExceptions,
} from "./schema";
import { allocate } from "../api/services/payments/allocation";
import {
  attributeFault,
  calculateClaim,
  calculateDowngrade,
  requiresWrittenNotice,
} from "../contracts/dispositions";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  const db = getDb();
  console.log("Seeding Auctum Ledger demo history…");

  // ─── Settlement history ───────────────────────────────────────────────────
  // The payments seed leaves three unmatched bank transfers so the exception
  // queue has something in it. Two of them are settled here — one exactly, one
  // short — and the third is deliberately left unmatched, because an AR screen
  // with nothing in the exception queue is not what an operator's Monday looks
  // like.
  const existingAllocations = await db
    .select({ n: sql<number>`count(*)` })
    .from(paymentAllocations);
  if ((existingAllocations[0]?.n ?? 0) > 0) {
    console.log("  Allocations already present — skipping settlement history.");
  } else {
    const txns = await db
      .select()
      .from(providerTransactions)
      .orderBy(providerTransactions.id);
    const open = await db
      .select()
      .from(invoices)
      .where(eq(invoices.status, "issued"))
      .orderBy(invoices.id);

    // Pair each transfer with an invoice in its own currency. Allocating across
    // currencies without an fxRate is exactly what allocate() refuses to do.
    let paired = 0;
    for (const txn of txns.slice(0, 2)) {
      const invoice = open.find(
        i => i.currency === txn.currency && i.id !== undefined
      );
      if (!invoice) continue;
      const total = BigInt(invoice.totalMinor);
      const available = BigInt(txn.amountMinor);
      const amountMinor = available >= total ? total : available;
      if (amountMinor <= 0n) continue;

      await allocate({
        providerTransactionId: Number(txn.id),
        invoiceId: Number(invoice.id),
        amountMinor,
        currency: txn.currency,
        // null marks the auto path; a demo that stamps an operator id on every
        // allocation hides the distinction the audit trail exists to record.
        allocatedByUserId: 1,
      });
      open.splice(open.indexOf(invoice), 1);
      paired++;
    }
    console.log(`  Settled ${paired} invoice(s) from the seeded bank transfers.`);
  }

  // ─── Warehouse exceptions ─────────────────────────────────────────────────
  const exceptionCount = await db
    .select({ n: sql<number>`count(*)` })
    .from(warehouseExceptions);
  const lots = await db.select().from(coffeeLots).orderBy(coffeeLots.id);
  const [firstPartner] = await db.select().from(partners).limit(1);

  if ((exceptionCount[0]?.n ?? 0) > 0) {
    console.log("  Warehouse exceptions already present — skipping.");
  } else if (lots.length >= 3) {
    await db.insert(warehouseExceptions).values([
      {
        lotId: lots[0].id,
        containerNumber: "MSKU 7741208",
        exceptionType: "seal_compromise",
        tier: 3,
        status: "hard_hold",
        description:
          "Bolt seal number on arrival does not match the seal recorded at stuffing. Container held; no bags moved to the racking floor.",
        rootCause: "Seal mismatch on arrival — chain of custody broken in transit.",
        atFaultParty: "carrier",
        financialCents: 0,
        slaDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
      {
        lotId: lots[1].id,
        containerNumber: "TCNU 4419063",
        exceptionType: "weight_moisture_variance",
        tier: 2,
        status: "investigating",
        description:
          "Arrival moisture 13.4% against 11.8% on the pre-shipment sample; net weight 61kg light across 320 bags.",
        rootCause: "Moisture above contract ceiling; weight variance beyond tolerance.",
        atFaultParty: "supplier",
        financialCents: 0,
        slaDueAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
      },
      {
        lotId: lots[2].id,
        containerNumber: "OOLU 8830514",
        exceptionType: "quality_anomaly",
        tier: 2,
        status: "resolved",
        disposition: "downgrade",
        description:
          "Arrival cupping returns 82.25 against 84.50 at pre-shipment. Phenolic notes in two of five cups.",
        rootCause:
          "Fermentation taint present at arrival; supplier filed no evidence of in-transit compromise.",
        atFaultParty: "supplier",
        financialCents: 0,
        resolvedAt: daysAgo(6),
      },
    ]);
    console.log("  Seeded 3 warehouse exceptions (Tier 3 hold, Tier 2 open, Tier 2 closed).");
  }

  // ─── Closed dispositions and one served claim ─────────────────────────────
  const dispositionCount = await db
    .select({ n: sql<number>`count(*)` })
    .from(lotDispositions);
  if ((dispositionCount[0]?.n ?? 0) > 0) {
    console.log("  Dispositions already present — skipping.");
    return;
  }

  const [closedException] = await db
    .select()
    .from(warehouseExceptions)
    .where(eq(warehouseExceptions.status, "resolved"))
    .limit(1);

  // §B.2 — the supplier filed nothing, so the failure is attributed to them.
  const fault = attributeFault({
    claimedOrigin: "logistics",
    proofFiled: false,
  });

  const downgrade = calculateDowngrade({
    quantityLbs: 39_683,
    originalPricePerLbCents: 412,
    downgradeGradePricePerLbCents: 351,
    operationalCostCents: 68_000,
    faultOrigin: fault.origin,
  });
  const noticeRequired = requiresWrittenNotice(
    downgrade.creditDueCents,
    downgrade.originalInvoiceCents
  );

  const [dispositionId] = await db
    .insert(lotDispositions)
    .values({
      exceptionId: closedException?.id ?? null,
      lotId: lots[2]?.id ?? null,
      lotCode: lots[2]?.name ?? "LOT-DEMO-003",
      partnerId: firstPartner?.id ?? null,
      disposition: "downgrade",
      claimedFaultOrigin: "logistics",
      faultOrigin: fault.origin,
      proofFiled: false,
      proofDescription: "",
      faultReason: fault.reason,
      quantityLbs: 39_683,
      originalPricePerLbCents: 412,
      downgradeGradePricePerLbCents: 351,
      operationalCostCents: 68_000,
      adjustedPricePerLbCents: downgrade.adjustedPricePerLbCents,
      creditDueCents: downgrade.creditDueCents,
      supplierBorneCents: downgrade.supplierBorneCents,
      capApplied: downgrade.capApplied,
      calculation: downgrade,
      noticeRequired,
      noticeSentAt: noticeRequired ? daysAgo(5) : null,
      status: "closed",
      childLotCode: `${lots[2]?.name ?? "LOT-DEMO-003"}-B`,
      rationale:
        "Re-cupped by two Q graders at arrival; both returned 82.25. Re-priced against the ICE Robusta differential for the resolved grade.",
      decidedByUserId: 1,
      decidedAt: daysAgo(5),
    })
    .$returningId();

  // §C.2 — a rejected lot, with both caps in play.
  const claim = calculateClaim({
    purchasePriceCents: 4_120_000,
    holdingCostPerDayCents: 9_500,
    daysHeld: 47,
    analysisCostCents: 42_000,
    disposalCostCents: 118_000,
    faultOrigin: "supplier",
  });

  await db.insert(supplierClaims).values({
    dispositionId: Number(dispositionId.id),
    partnerId: firstPartner?.id ?? null,
    lotCode: lots[1]?.name ?? "LOT-DEMO-002",
    basis: "standard",
    detectedAt: daysAgo(12),
    purchasePriceCents: 4_120_000,
    holdingCostPerDayCents: 9_500,
    daysHeld: 47,
    holdingDaysCharged: claim.holdingDaysCharged,
    analysisCostCents: 42_000,
    disposalCostCents: 118_000,
    subtotalCents: claim.subtotalCents,
    totalClaimCents: claim.totalClaimCents,
    supplierBorneCents: claim.supplierBorneCents,
    capApplied: claim.capApplied,
    status: "notice_issued",
    noticeIssuedAt: daysAgo(10),
    supplierResponseDueAt: new Date(Date.now() + 4 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    raisedByUserId: 1,
  });
  console.log(
    `  Seeded 1 closed downgrade (credit ${(downgrade.creditDueCents / 100).toFixed(2)} USD${
      downgrade.capApplied ? ", 50% floor applied" : ""
    }) and 1 served claim (${(claim.totalClaimCents / 100).toFixed(2)} USD${
      claim.capApplied ? ", capped" : ""
    }).`
  );

  // ─── Waitlist ─────────────────────────────────────────────────────────────
  const waitlistCount = await db
    .select({ n: sql<number>`count(*)` })
    .from(waitlistSignups);
  if ((waitlistCount[0]?.n ?? 0) === 0) {
    await db.insert(waitlistSignups).values([
      {
        product: "foundry",
        name: "Marta Illy",
        email: "marta@sextantcoffee.example",
        company: "Sextant Coffee Roasters",
        interest: "Anaerobic Catimor from Cầu Đất — two 60kg trial lots.",
      },
      {
        product: "foundry",
        name: "Daniel Okoro",
        email: "d.okoro@northboundcoffee.example",
        company: "Northbound Coffee",
        interest: "Co-fermentation trials; would fund one processing run.",
      },
      {
        product: "lotspace",
        name: "Priya Raman",
        email: "priya@thirdrailroasting.example",
        company: "Third Rail Roasting",
        interest: "Splitting a full container of Robusta Fine with two peers.",
      },
      {
        product: "lotspace",
        name: "Tobias Berg",
        email: "tobias@almanackcoffee.example",
        company: "Almanack Coffee",
        interest: "Needs 8 bags a quarter — full containers are out of reach alone.",
      },
    ]);
    console.log("  Seeded 4 waitlist signups.");
  }

  console.log("Demo seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
