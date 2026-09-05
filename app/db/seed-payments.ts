// Seed for the Vietnam Payment & Coffee Business Manager sprint.
//
// Gives the Invoices and Payments screens something honest to render: Vietnamese
// counterparties linked to their existing partner and roaster records (the G5
// join), invoices spread across the aging buckets, and a handful of bank
// transfers that exercise the interesting paths — an exact match, a partial
// payment, an unreadable memo, and an overpayment.
//
// Idempotent: it skips if counterparties are already present.
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import {
  counterparties,
  featureFlags,
  invoices,
  partners,
  providerTransactions,
  roasters,
} from "./schema";
import { memoTokenFor } from "../api/services/payments/memo";
import { FEATURE_FLAGS, FLAG_KEYS, type FlagKey } from "../contracts/flags";

/** A date `days` before today, as the YYYY-MM-DD a MySQL date column takes. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function seed() {
  const db = getDb();
  console.log("Seeding payments context…");

  // Flag rows are reconciled BEFORE the populated-database guard below.
  //
  // They used to be inserted once, behind that guard, which meant a flag added
  // to the registry after the first seed never got a row on an existing
  // database. `getFlags()` falls back to the registry default there, so the
  // feature stayed off — fail-closed, and therefore silent — while the
  // description column drifted away from the code. Reconciling on every run
  // keeps the registry and the table in step; `enabled` is deliberately never
  // touched, because that column is an operator's decision, not the seed's.
  const flagRows = await db.select().from(featureFlags);
  const known = new Set(flagRows.map(r => r.flagKey));
  const missing = FLAG_KEYS.filter(key => !known.has(key));
  if (missing.length > 0) {
    await db.insert(featureFlags).values(
      missing.map(key => ({
        flagKey: key,
        enabled: false,
        description: FEATURE_FLAGS[key].description,
      }))
    );
    console.log(`  Added ${missing.length} flag row(s): ${missing.join(", ")}.`);
  }
  for (const row of flagRows) {
    const spec = FLAG_KEYS.includes(row.flagKey as FlagKey)
      ? FEATURE_FLAGS[row.flagKey as FlagKey]
      : null;
    if (spec && spec.description !== row.description) {
      await db
        .update(featureFlags)
        .set({ description: spec.description })
        .where(eq(featureFlags.id, row.id));
    }
  }

  const existing = await db.select().from(counterparties).limit(1);
  if (existing.length > 0) {
    console.log("Counterparties already populated — skipping.");
    process.exit(0);
  }

  const [firstPartner] = await db.select().from(partners).limit(1);
  const [firstRoaster] = await db.select().from(roasters).limit(1);

  // ─── Counterparties ───────────────────────────────────────────────────────
  // partnerId / roasterId are what let a payment received resolve back to the
  // farmer whose revenue share it funds (G5).
  await db.insert(counterparties).values([
    {
      name: "Hợp tác xã Cà phê Cầu Đất",
      type: "cooperative",
      partnerId: firstPartner?.id ?? null,
      country: "VN",
      province: "Lâm Đồng",
      taxId: "5800123456",
      bankName: "Vietcombank",
      bankBranch: "Đà Lạt",
      bankAccountName: "HTX CA PHE CAU DAT",
      // The account number itself is encrypted at rest (§12.2); only the last
      // four are plaintext, for display and operator matching.
      bankAccountLast4: "8842",
      contactEmail: "kinhdoanh@caudatcoffee.vn",
      contactPhone: "+84263555010",
      kycStatus: "verified",
      isIndividual: false,
      consentedAt: new Date(),
      consentVersion: "pdpd-1.0",
    },
    {
      name: "Nguyễn Văn Bình",
      type: "farmer",
      partnerId: null,
      country: "VN",
      province: "Đắk Lắk",
      bankName: "Agribank",
      bankBranch: "Buôn Ma Thuột",
      bankAccountName: "NGUYEN VAN BINH",
      bankAccountLast4: "1179",
      contactPhone: "+84905112233",
      kycStatus: "pending",
      // An individual farmer: PDPD sensitive-data handling applies.
      isIndividual: true,
      consentedAt: new Date(),
      consentVersion: "pdpd-1.0",
    },
    {
      name: "Nordhavn Roastery ApS",
      type: "roaster",
      roasterId: firstRoaster?.id ?? null,
      country: "DK",
      province: "Copenhagen",
      bankName: "Danske Bank",
      bankAccountName: "NORDHAVN ROASTERY APS",
      bankAccountLast4: "4410",
      contactEmail: "accounts@nordhavn.example",
      kycStatus: "verified",
      isIndividual: false,
    },
  ]);

  const parties = await db.select().from(counterparties);
  const coop = parties.find(p => p.type === "cooperative")!;
  const roaster = parties.find(p => p.type === "roaster")!;

  // ─── Invoices across the aging buckets ────────────────────────────────────
  // Due 5, 40, 70 and 120 days ago plus one not yet due, so the aging bars on
  // the Payments page show every bucket on first load.
  const specs = [
    {
      counterparty: coop,
      currency: "VND",
      subtotal: 850_000_000n,
      vatBp: 800,
      dueDays: 5,
    },
    {
      counterparty: coop,
      currency: "VND",
      subtotal: 1_200_000_000n,
      vatBp: 800,
      dueDays: 40,
    },
    {
      counterparty: coop,
      currency: "VND",
      subtotal: 430_000_000n,
      vatBp: 500,
      dueDays: 70,
    },
    {
      counterparty: coop,
      currency: "VND",
      subtotal: 96_000_000n,
      vatBp: 800,
      dueDays: 120,
    },
    // Not yet due, and denominated in USD: an export sale to a non-resident is
    // the case the VND-between-residents rule (§3.6) deliberately allows.
    {
      counterparty: roaster,
      currency: "USD",
      subtotal: 4_820_000n,
      vatBp: 0,
      dueDays: -14,
    },
  ];

  let seq = 1;
  const issued: {
    id: number;
    memoToken: string;
    totalMinor: bigint;
    currency: string;
  }[] = [];

  for (const spec of specs) {
    const vat = (spec.subtotal * BigInt(spec.vatBp)) / 10_000n;
    const total = spec.subtotal + vat;
    const year = new Date().getUTCFullYear();

    const [res] = await db.insert(invoices).values({
      invoiceNumber: `INV-${year}-${String(seq).padStart(5, "0")}`,
      payableType: "contract",
      payableId: seq,
      counterpartyId: spec.counterparty.id,
      currency: spec.currency,
      subtotalMinor: spec.subtotal,
      vatRateBp: spec.vatBp,
      vatMinor: vat,
      shippingMinor: 0n,
      totalMinor: total,
      paidMinor: 0n,
      issuedAt: daysAgo(spec.dueDays + 30),
      dueAt: daysAgo(spec.dueDays),
      status: "issued",
      eInvoiceStatus:
        spec.counterparty.country === "VN" ? "pending" : "not_required",
      memoToken: `TMP${String(seq).padStart(7, "0")}`,
      createdByUserId: null,
    });

    const id = Number(res.insertId);
    const memoToken = memoTokenFor(id);
    await db.update(invoices).set({ memoToken }).where(eq(invoices.id, id));
    issued.push({ id, memoToken, totalMinor: total, currency: spec.currency });
    seq++;
  }

  // ─── Bank transfers exercising the §7.4 cases ─────────────────────────────
  // These land unmatched; the matching consumer (or an operator, with
  // autoAllocation off) resolves them. That is the intended first-run
  // experience: the exception queue has real work in it.
  const [first, second] = issued;
  await db.insert(providerTransactions).values([
    {
      // Exact match on the memo token.
      provider: "manual",
      providerTxnId: "SEED-FT26030001",
      rawPayload: { seeded: true },
      signatureValid: true,
      verifiedAt: new Date(),
      amountMinor: first.totalMinor,
      currency: first.currency,
      description: `CK ${first.memoToken} THANH TOAN CA PHE`,
      counterAccountNumber: "0011000258842",
      counterAccountName: "HTX CA PHE CAU DAT",
      occurredAt: new Date(),
      matchStatus: "unmatched",
    },
    {
      // Underpayment: 60% of the invoice. The remainder keeps aging from the
      // original due date, not from today.
      provider: "manual",
      providerTxnId: "SEED-FT26030002",
      rawPayload: { seeded: true },
      signatureValid: true,
      verifiedAt: new Date(),
      amountMinor: (second.totalMinor * 60n) / 100n,
      currency: second.currency,
      description: `TT ${second.memoToken}`,
      counterAccountNumber: "0011000258842",
      counterAccountName: "HTX CA PHE CAU DAT",
      occurredAt: new Date(),
      matchStatus: "unmatched",
    },
    {
      // The one that makes the exception queue worth building: a real transfer
      // with a memo nobody can match.
      provider: "manual",
      providerTxnId: "SEED-FT26030003",
      rawPayload: { seeded: true },
      signatureValid: true,
      verifiedAt: new Date(),
      amountMinor: 75_000_000n,
      currency: "VND",
      description: "CHUYEN TIEN",
      counterAccountNumber: "0021000451179",
      counterAccountName: "NGUYEN VAN BINH",
      occurredAt: new Date(),
      matchStatus: "unmatched",
    },
  ]);

  console.log(
    `Seeded: ${parties.length} counterparties, ${issued.length} invoices across every aging bucket, 3 bank transfers (exact, partial, unmatched), ${FLAG_KEYS.length} feature flags.`
  );
  process.exit(0);
}

seed();
