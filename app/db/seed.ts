// Auctum Ledger seed — realistic specialty green-coffee catalog, CRM accounts,
// the COF nurture campaign and its COF-001…005 automation rules.
// Idempotent: skips seeding when the catalog is already populated.
import { getDb } from "../api/queries/connection";
import {
  automationRules,
  campaigns,
  coffeeLots,
  roasters,
} from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding Auctum Ledger database...");

  const existing = await db.select().from(coffeeLots).limit(1);
  if (existing.length > 0) {
    console.log("Catalog already populated — skipping seed.");
    process.exit(0);
  }

  // ─── Catalog: green-bean lots (prices in cents/lb) ─────────────────────────
  await db.insert(coffeeLots).values([
    {
      name: "Yirgacheffe G1 — Kochere",
      origin: "Ethiopia",
      region: "Gedeo Zone, Yirgacheffe",
      varietal: "Heirloom (Kurume dominant)",
      processMethod: "Washed",
      elevationMeters: 2100,
      cupScore: 88.5,
      pricePerLbCents: 685,
      costPerLbCents: 410,
      availableLbs: 4200,
      totalProductionLbs: 8800,
      flavorNotes: "Jasmine, bergamot, lemon zest, peach, black tea finish",
    },
    {
      name: "Huila Pink Bourbon — La Palma",
      origin: "Colombia",
      region: "Huila, San Agustín",
      varietal: "Pink Bourbon",
      processMethod: "Washed",
      elevationMeters: 1750,
      cupScore: 87.25,
      pricePerLbCents: 595,
      costPerLbCents: 355,
      availableLbs: 6600,
      totalProductionLbs: 12100,
      flavorNotes: "Pink lemonade, panela, red cherry, cocoa nib",
    },
    {
      name: "Nyeri AA — Gichathaini",
      origin: "Kenya",
      region: "Nyeri, Mt. Kenya slopes",
      varietal: "SL28 / SL34",
      processMethod: "Washed (double fermentation)",
      elevationMeters: 1800,
      cupScore: 88.0,
      pricePerLbCents: 740,
      costPerLbCents: 465,
      availableLbs: 2400,
      totalProductionLbs: 5000,
      flavorNotes: "Blackcurrant, grapefruit, brown sugar, tomato leaf",
    },
    {
      name: "Huehuetenango SHB — El Injertal",
      origin: "Guatemala",
      region: "Huehuetenango, La Libertad",
      varietal: "Bourbon / Caturra",
      processMethod: "Washed",
      elevationMeters: 1900,
      cupScore: 85.75,
      pricePerLbCents: 495,
      costPerLbCents: 298,
      availableLbs: 9200,
      totalProductionLbs: 15400,
      flavorNotes: "Milk chocolate, orange, caramel, almond",
    },
    {
      name: "Cerrado Mineiro Natural — Fazenda Ouro",
      origin: "Brazil",
      region: "Cerrado Mineiro, Patrocínio",
      varietal: "Yellow Catuaí",
      processMethod: "Natural",
      elevationMeters: 1100,
      cupScore: 84.0,
      pricePerLbCents: 385,
      costPerLbCents: 225,
      availableLbs: 18000,
      totalProductionLbs: 44000,
      flavorNotes: "Peanut brittle, milk chocolate, dried cherry, low acidity",
    },
    {
      name: "Cajamarca Organic — La Flor",
      origin: "Peru",
      region: "Cajamarca, Jaén",
      varietal: "Typica / Bourbon",
      processMethod: "Washed",
      elevationMeters: 1850,
      cupScore: 86.0,
      pricePerLbCents: 520,
      costPerLbCents: 310,
      availableLbs: 5100,
      totalProductionLbs: 9900,
      flavorNotes: "Green apple, toffee, florals, round body — FTO certified",
    },
    {
      name: "Đắk Lắk Fine Robusta — Ea H'leo",
      origin: "Vietnam",
      region: "Đắk Lắk, Central Highlands",
      varietal: "Robusta (TR4)",
      processMethod: "Natural (raised-bed)",
      elevationMeters: 600,
      cupScore: 82.5,
      pricePerLbCents: 265,
      costPerLbCents: 150,
      availableLbs: 26000,
      totalProductionLbs: 66000,
      flavorNotes: "Dark chocolate, molasses, dried fig, heavy crema",
    },
    {
      name: "Kintamani Anaerobic — Subak Abian",
      origin: "Indonesia",
      region: "Bali, Kintamani Highlands",
      varietal: "Kopyol / S795",
      processMethod: "Anaerobic natural (96h)",
      elevationMeters: 1400,
      cupScore: 86.75,
      pricePerLbCents: 640,
      costPerLbCents: 390,
      availableLbs: 1300,
      totalProductionLbs: 2200,
      flavorNotes: "Rum raisin, pineapple, winey acidity, spice",
    },
  ]);

  // ─── CRM: roaster accounts ──────────────────────────────────────────────────
  await db.insert(roasters).values([
    {
      roasterName: "Blue Lantern Coffee Roasters",
      contactName: "Maya Chen",
      email: "maya@bluelantern.coffee",
      companySize: "small",
      segment: "specialty_micro",
      lifecycleStatus: "trial",
      churnRiskScore: 0.18,
      cacCents: 37800,
    },
    {
      roasterName: "Copper Kettle Roasting Co.",
      contactName: "Jonah Reyes",
      email: "jonah@copperkettle.roast",
      companySize: "medium",
      segment: "regional_wholesale",
      lifecycleStatus: "active",
      churnRiskScore: 0.22,
      ltvCents: 1420000,
      cacCents: 41200,
    },
    {
      roasterName: "Ember & Oak Coffee",
      contactName: "Priya Nair",
      email: "priya@emberandoak.com",
      companySize: "micro",
      segment: "specialty_micro",
      lifecycleStatus: "trial",
      churnRiskScore: 0.31,
      cacCents: 19600, // referral CAC ≤ $200
      referralCode: "GIVEKIT-EMBER",
    },
    {
      roasterName: "Meridian Roast Works",
      contactName: "Tomás Silva",
      email: "tomas@meridianroast.com",
      companySize: "large",
      segment: "national_chain",
      lifecycleStatus: "dormant",
      churnRiskScore: 0.74,
      ltvCents: 3850000,
      cacCents: 46000,
    },
    {
      roasterName: "Saltbox Coffee Lab",
      contactName: "Alyssa Grant",
      email: "alyssa@saltboxlab.coffee",
      companySize: "small",
      segment: "experimental_nano",
      lifecycleStatus: "trial",
      churnRiskScore: 0.12,
      cacCents: 33500,
    },
  ]);

  // ─── Campaigns: COF nurture campaign + COF-001…005 rules ───────────────────
  const [{ id: campaignId }] = await db
    .insert(campaigns)
    .values({ code: "cof-nurture-2025", name: "COF Nurture Sequence 2025", status: "active" })
    .$returningId();

  await db.insert(automationRules).values([
    {
      campaignId,
      ruleCode: "COF-001",
      triggerEvent: "sample_kit.delivered",
      conditionSummary: "days_since_delivery = 4",
      action: "SEND_EMAIL",
      description: "Touch-1 — origin story + cupping notes",
    },
    {
      campaignId,
      ruleCode: "COF-002",
      triggerEvent: "feedback.submitted",
      conditionSummary: "feedback.rating >= 4",
      action: "SEND_EMAIL",
      description: "Touch-2 — pricing sheet with {sca_cup_score} token",
    },
    {
      campaignId,
      ruleCode: "COF-003",
      triggerEvent: "feedback.submitted",
      conditionSummary: "feedback.rating <= 2",
      action: "UPDATE_CRM_LIFECYCLE",
      description: "Lifecycle → needs_attention + consultative SMS",
    },
    {
      campaignId,
      ruleCode: "COF-004",
      triggerEvent: "campaigns.link_clicked",
      conditionSummary: "clicked.pricing_page = true",
      action: "SEND_EMAIL",
      description: "Touch-3 — volume discount CTA",
    },
    {
      campaignId,
      ruleCode: "COF-005",
      triggerEvent: "order.created",
      conditionSummary: "first_order = true",
      action: "EXECUTE_CAMPAIGN_HALT",
      description: "Halt nurture + enroll in onboarding stream",
    },
  ]);

  console.log("Seeded: 8 lots, 5 roasters, campaign cof-nurture-2025 with rules COF-001…005.");
  process.exit(0);
}

seed();
