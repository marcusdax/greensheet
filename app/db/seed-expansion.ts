// Greensheet expansion seed — SOP education library, revenue-share partners,
// the POS-01…04 marketing calendar, and the COF-004 pricing-link rule.
// Idempotent: each domain is guarded independently.
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import {
  automationRules,
  campaigns,
  coffeeLots,
  collectorPassThroughs,
  lotAddenda,
  marketingPosts,
  partners,
  sopDocuments,
} from "./schema";
import { HANDLING_COST_PER_LB_CENTS } from "../api/routers/partners";

const SOP_WAREHOUSE = `# Warehouse Runbooks — Seal, Weight & Moisture Exceptions

## Purpose
Standardize how receiving handles seal, weight, and moisture exceptions on
inbound green-coffee lots, from detection through disposition.

## Exception Tiers & SLAs
| Tier | Trigger | SLA |
| --- | --- | --- |
| 1 | Seal serial/photo mismatch; weight variance > ±1.5%; moisture marginally outside 11.0–12.5% | 48 hours |
| 2 | Weight variance > ±2.0% (hard limit); moisture <10% or >13% | 5 business days |
| 3 | Seal broken / tamper evidence; cupping red flag | 10 business days |

Tier ≥ 2 lots start in **hard hold** — unavailable for sale or transfer until
released by disposition.

## Decision Trees
### Seal check (on receipt)
1. Seal intact + serial matches + photo matches → PASS, release to inventory.
2. Serial or photo mismatch, seal physically intact → Tier 1, quarantine,
   notify supplier within 48h.
3. Seal broken, cut, or re-taped → Tier 3, hard hold, photograph everything,
   pull retained reference sample immediately.

### Weight & moisture
1. Variance ≤ ±1.5% and moisture 11.0–12.5% → PASS.
2. Variance > ±1.5% → Tier 1. Variance > ±2.0% → Tier 2 (hard limit — never
   accept without claim).
3. Moisture marginally outside band → Tier 1; <10% or >13% → Tier 2.

## Dispositions
- **release** — lot meets spec; return to active inventory.
- **downgrade** — accept at reduced grade/price; renegotiate with supplier.
- **reject_claim** — file claim against the at-fault party; lot returned or destroyed.
- **reverify_partition** — re-weigh/re-test sub-lots; partition good from bad.

## Fault Parties
supplier · carrier · customs · greensheet · indeterminate.
Root cause and at-fault party are mandatory fields on every Tier 2/3 resolution.
`;

const SOP_CUPPING = `# Cupping Standards — SCA 10-Attribute Scorecard

## Protocol
All lots are cupped on the SCA 10-attribute scorecard:

| # | Attribute | Scale |
| --- | --- | --- |
| 1 | Fragrance / Aroma | 6.00–10.00 |
| 2 | Flavor | 6.00–10.00 |
| 3 | Aftertaste | 6.00–10.00 |
| 4 | Acidity | 6.00–10.00 |
| 5 | Body | 6.00–10.00 |
| 6 | Balance | 6.00–10.00 |
| 7 | Uniformity | 6.00–10.00 |
| 8 | Clean Cup | 6.00–10.00 |
| 9 | Sweetness | 6.00–10.00 |
| 10 | Overall | 0.00–10.00 (cupper's holistic score) |

## Tolerance Bands (delta vs. reference score)
- Tier 1 lot: ±2.0 points
- Tier 2 lot: ±1.5 points
- Tier 3 lot: ±1.0 point

A session outside its band is **outside_tolerance** and triggers re-cup.

## Red Flags — automatic Tier-3 escalation
musty_moldy · sour_vinegary · phenolic_medicinal · visible_mold ·
gray_blue_discoloration · insect_damage_over_2pct · rancid_stale

Any red flag, at any score, escalates the lot to a Tier-3 warehouse exception
and hard hold. No exceptions.

## Panel Requirement
Tier 2 and Tier 3 evaluations require a **panel of 3 cuppers**. Single-cupper
sessions are valid for Tier 1 only. The system rejects panel-required sessions
recorded by a single cupper (GS-QC-1005).
`;

const SOP_SAMPLES = `# Retained Sample Procedures

## Pull
- Pull from the **middle bag** of the lot (never top or bottom).
- Seal in a tamper-evident bag; label with lot code, date, and puller initials.
- **Dual verification**: a second person confirms weight, seal, and label at pull time.

## Storage & Access
- Stored sealed in the retained-sample cabinet, organized by lot code.
- Every access is logged: who, purpose, witness. Opening a seal increments
  the opened counter — **more than 5 openings = heavily compromised**; the
  sample can no longer serve as arbitration reference.

## Retention
| Exception status | Retention |
| --- | --- |
| No exception | 60 days |
| Tier 1 resolved | 90 days |
| Tier 2 resolved | 180 days |
| Tier 3 resolved | 365 days |

## Destruction
- **Dual-witness destruction** — two named witnesses, both recorded.
- **Never destroy during an active exception** on the source lot (GS-QC-1004).
- Destruction is logged with date, method, and both witnesses.
`;

const SOP_AGREEMENT = `# Revenue Share — White-Glove Farmer/Collector Partnership Agreement

## Structure
Two-part payment per lot addendum (Exhibit D):

### 1. Floor Payment (never clawed back, except confirmed fraud)
Floor Payment = True-Cost Floor Price × verified net weight, accrued on
**Tier-1 verification** at the warehouse. Floor SLA by partner tier:
- Tier A: 3 business days
- Tier B: 5 business days
- Tier C: 7 business days

### 2. Revenue Share (after final sale)
Revenue Share = share% × (Final Sale − Floor Payment − documented costs).
Documented costs are fixed at **$0.30/lb** (handling, logistics, certification).

Share percentage by cup quality tier:
| Cup score | Share |
| --- | --- |
| 86+ | 50% |
| 80–85 | 35% |
| 75–79 | 20% |
| 70–74 | 10% |
| <70 | 0% (floor only) |

## Collector Pass-Through (Exhibit C)
Collectors must pass through **≥80%** of the revenue share attributable to
each identified farmer's percentage of the lot. Pass-throughs are tracked per
addendum with floor-owed and revenue-share-owed amounts.

## True Price Receipt
Every payment (floor and revenue share) produces a machine-readable
True Price Receipt: lot code, net weight, cup score, quality tier, floor
price, floor payment, final sale price, documented costs, net proceeds,
share %, and share amount. Full transparency, no black boxes.
`;

const SOP_MARKETING = `# Marketing Playbook — Social Series & Nurture Calendar

## Content Pillars
| Code | Pillar | Color |
| --- | --- | --- |
| POS-01 | Value Before Tasting | #7B8E7F |
| POS-02 | Price Is Signal | #8C2F22 |
| POS-03 | Coffee Is Infrastructure | #5B6A5F |
| POS-04 | Reinvest Not Extract | brand accent |

## Channels
linkedin · instagram · twitter · tiktok · newsletter

## Cadence
4-week rollout, one pillar per week, 3–5 posts per week across channels.
Week 1 POS-01 → Week 2 POS-02 → Week 3 POS-03 → Week 4 POS-04.

## Nurture Automation (COF-001…005)
- COF-001: sample_kit.delivered + 4 days → Touch-1 origin story email
- COF-002: feedback.submitted rating ≥ 4 → Touch-2 pricing sheet
- COF-003: feedback.submitted rating ≤ 2 → lifecycle needs_attention + SMS
- COF-004: pricing-link click → Touch-3 volume-discount email + WhatsApp
- COF-005: first order.created → halt nurture, enroll in onboarding

## Referral Program — "Give a Kit, Get a Bag"
Refer a roaster → they get a sample kit → on their first kit shipment both
parties receive a free 5lb bag. Tracked per referral code.
`;

async function seedExpansion() {
  const db = getDb();
  console.log("Seeding Greensheet expansion domains...");

  // ─── SOP education library ───────────────────────────────────────────────
  const existingDocs = await db.select().from(sopDocuments).limit(1);
  if (existingDocs.length === 0) {
    await db.insert(sopDocuments).values([
      { code: "SOP-WAREHOUSE-RB", title: "Warehouse Runbooks — Seal, Weight & Moisture Exceptions", category: "warehouse", summary: "Exception tiers 1–3, SLAs, decision trees, and dispositions for inbound lots.", content: SOP_WAREHOUSE },
      { code: "SOP-CUPPING-SCA", title: "Cupping Standards — SCA 10-Attribute Scorecard", category: "cupping", summary: "Scoring protocol, tolerance bands, red flags, and panel requirements.", content: SOP_CUPPING },
      { code: "SOP-RETAINED-SAMPLES", title: "Retained Sample Procedures", category: "samples", summary: "Middle-bag pulls, tamper-evident seals, access logging, retention, dual-witness destruction.", content: SOP_SAMPLES },
      { code: "SOP-PARTNER-AGREEMENT", title: "Revenue Share — Farmer/Collector Partnership Agreement", category: "agreements", summary: "Floor payment, revenue-share tiers, collector pass-through, True Price Receipts.", content: SOP_AGREEMENT },
      { code: "SOP-MARKETING-PLAYBOOK", title: "Marketing Playbook — Social Series & Nurture Calendar", category: "marketing", summary: "POS-01…04 pillars, channels, cadence, COF-001…005 automation, referral program.", content: SOP_MARKETING },
    ]);
    console.log("  SOP library: 5 documents.");
  } else {
    console.log("  SOP library already populated — skipping.");
  }

  // ─── Partners + lot addenda + collector pass-through ─────────────────────
  const existingPartners = await db.select().from(partners).limit(1);
  if (existingPartners.length === 0) {
    const lots = await db.select().from(coffeeLots);
    const byName = (frag: string) => lots.find((l) => l.name.includes(frag));

    const [{ id: farmerId }] = await db.insert(partners).values({
      partnerName: "La Palma Smallholder Collective",
      partnerType: "farmer",
      originRegion: "Huila, San Agustín, Colombia",
      partnerTier: "tier_a",
      email: "colectivo@lapalma.coop",
    }).$returningId();

    const [{ id: collectorId }] = await db.insert(partners).values({
      partnerName: "Gedeo Highland Collectors",
      partnerType: "collector",
      originRegion: "Gedeo Zone, Yirgacheffe, Ethiopia",
      partnerTier: "tier_b",
      email: "ops@gedeohighland.et",
    }).$returningId();

    const huila = byName("Huila Pink Bourbon");
    const yirg = byName("Yirgacheffe");
    const addendaValues = [];
    if (huila) {
      addendaValues.push({
        partnerId: farmerId,
        lotId: huila.id,
        lotCode: "ADD-HUILA-2025-01",
        processingProtocol: "Washed — 36h fermentation, sun-dried on raised beds",
        floorPricePerLbCents: 420, // $4.20/lb true-cost floor
        expectedQtyLbs: 12000,
        deliveryWindow: "2025-09-01 → 2025-10-15",
        status: "delivered" as const,
      });
    }
    if (yirg) {
      addendaValues.push({
        partnerId: collectorId,
        lotId: yirg.id,
        lotCode: "ADD-YIRG-2025-01",
        processingProtocol: "Washed — Kochere washing station",
        floorPricePerLbCents: 460,
        expectedQtyLbs: 8800,
        deliveryWindow: "2025-10-01 → 2025-11-30",
        status: "pending" as const,
      });
    }
    if (addendaValues.length > 0) {
      await db.insert(lotAddenda).values(addendaValues);
    }

    // Exhibit C — collector pass-through: ≥80% of revenue share to farmers.
    if (yirg) {
      const addendum = await db.query.lotAddenda.findFirst({
        where: eq(lotAddenda.lotCode, "ADD-YIRG-2025-01"),
      });
      if (addendum) {
        const floorOwed = Math.round(460 * 8800 * (85 / 100));
        await db.insert(collectorPassThroughs).values({
          partnerId: collectorId,
          addendumId: addendum.id,
          farmerName: "Kochere Smallholder Group (142 members)",
          pctOfLot: 85,
          floorOwedCents: floorOwed,
          rsOwedCents: 0,
        });
      }
    }
    console.log(`  Partners: 2, addenda: ${addendaValues.length}, pass-through: 1. Handling cost/lb: ${HANDLING_COST_PER_LB_CENTS}¢.`);
  } else {
    console.log("  Partners already populated — skipping.");
  }

  // ─── Marketing calendar (POS-01…04, 4-week rollout) ─────────────────────
  const existingPosts = await db.select().from(marketingPosts).limit(1);
  if (existingPosts.length === 0) {
    await db.insert(marketingPosts).values([
      // Week 1 — POS-01 Value Before Tasting
      { pillar: "POS-01", channel: "linkedin", week: 1, status: "published", title: "The cupping table is the last place value is created", body: "Value is built at origin — varietal selection, picking discipline, drying curves. The cupping table only measures it. Here's how we price the work, not just the score. #ValueBeforeTasting" },
      { pillar: "POS-01", channel: "instagram", week: 1, status: "published", title: "Anatomy of a lot: 14 decisions before export", body: "Carousel: from cherry selection to moisture stabilization — the 14 decisions that determine what's in your hopper before you ever taste it." },
      { pillar: "POS-01", channel: "newsletter", week: 1, status: "scheduled", title: "Why we publish cost structure with every lot", body: "Floor price, documented costs, revenue-share tier — every Greensheet lot ships with a True Price Receipt. This week's deep dive." },
      // Week 2 — POS-02 Price Is Signal
      { pillar: "POS-02", channel: "linkedin", week: 2, status: "draft", title: "Cheap coffee is expensive", body: "A $3.20/lb lot with a 9% defect rate costs more per usable pound than a $5.80 lot at 1.5%. Price is signal — learn to read it. #PriceIsSignal" },
      { pillar: "POS-02", channel: "twitter", week: 2, status: "draft", title: "Thread: what a True Price Receipt actually shows", body: "1/ Every payment we make to a producing partner generates a receipt: floor price, cup score, share %, documented costs. Here's why that changes buying…" },
      { pillar: "POS-02", channel: "instagram", week: 2, status: "draft", title: "Receipt reveal: Huila Pink Bourbon", body: "Side-by-side: commodity invoice vs. True Price Receipt on the same lot. The difference is everything." },
      // Week 3 — POS-03 Coffee Is Infrastructure
      { pillar: "POS-03", channel: "linkedin", week: 3, status: "draft", title: "Coffee is infrastructure — treat your green supply like it", body: "SLAs, exception tiers, retained samples, dispute protocols. We run green coffee like critical infrastructure because your roastery depends on it. #CoffeeIsInfrastructure" },
      { pillar: "POS-03", channel: "tiktok", week: 3, status: "draft", title: "POV: a seal exception hits our warehouse", body: "60-second walkthrough of a Tier-3 seal exception: hard hold, photo protocol, retained sample pull, supplier notification — full runbook." },
      // Week 4 — POS-04 Reinvest Not Extract
      { pillar: "POS-04", channel: "linkedin", week: 4, status: "draft", title: "86 points = 50% revenue share. Here's the math.", body: "Our partners earn up to 50% of net proceeds above floor. Quality pays because we built the payment rails to make it pay. #ReinvestNotExtract" },
      { pillar: "POS-04", channel: "newsletter", week: 4, status: "draft", title: "Collector pass-through: the 80% rule", body: "When we buy through collectors, ≥80% of revenue share flows to identified farmers. How Exhibit C works, with real numbers." },
      { pillar: "POS-04", channel: "instagram", week: 4, status: "draft", title: "Meet the La Palma collective", body: "142 families, one washing station, a Tier-A partnership. This is what reinvestment looks like at origin." },
    ]);
    console.log("  Marketing calendar: 11 posts across 4 weeks.");
  } else {
    console.log("  Marketing calendar already populated — skipping.");
  }

  // ─── Ensure COF-004 rule exists (campaigns may predate it) ───────────────
  const cof4 = await db.query.automationRules.findFirst({
    where: eq(automationRules.ruleCode, "COF-004"),
  });
  if (!cof4) {
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.code, "cof-nurture-2025"),
    });
    if (campaign) {
      await db.insert(automationRules).values({
        campaignId: campaign.id,
        ruleCode: "COF-004",
        triggerEvent: "campaigns.link_clicked",
        conditionSummary: "clicked.pricing_page = true",
        action: "SEND_EMAIL",
        description: "Touch-3 — volume discount CTA",
      });
      console.log("  COF-004 rule created.");
    } else {
      console.log("  WARNING: cof-nurture-2025 campaign missing — COF-004 not created.");
    }
  } else {
    console.log("  COF-004 rule present.");
  }

  console.log("Expansion seed complete.");
  process.exit(0);
}

seedExpansion();
