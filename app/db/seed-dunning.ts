// Installs the default dunning ladder (§3.4) and a reference FX rate (§3.3).
//
// The ladder itself lives in api/services/payments/dunning.ts; once seeded it
// is rows, so changing "day 7 becomes a phone call" is a row edit rather than a
// deploy. Idempotent: it skips whichever half is already present.
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { dunningSteps, fxRates } from "./schema";
import {
  DEFAULT_LADDER,
  DEFAULT_POLICY,
} from "../api/services/payments/dunning";

async function seed() {
  const db = getDb();

  const existingSteps = await db
    .select({ id: dunningSteps.id })
    .from(dunningSteps)
    .where(eq(dunningSteps.policyCode, DEFAULT_POLICY))
    .limit(1);

  if (existingSteps.length > 0) {
    console.log("Dunning ladder already seeded — skipping.");
  } else {
    await db
      .insert(dunningSteps)
      .values(
        DEFAULT_LADDER.map(step => ({
          ...step,
          policyCode: DEFAULT_POLICY,
          active: true,
        }))
      );
    console.log(
      `Seeded ${DEFAULT_LADDER.length} dunning steps (day 0/3/7/14).`
    );
  }

  const existingRate = await db
    .select({ id: fxRates.id })
    .from(fxRates)
    .limit(1);
  if (existingRate.length > 0) {
    console.log("FX rates already present — skipping.");
  } else {
    // A plausible reference point so the FX screens render before a feed is
    // configured. `source` says exactly what it is: nobody should mistake a
    // seeded number for a quoted one.
    await db.insert(fxRates).values([
      {
        baseCurrency: "USD",
        quoteCurrency: "VND",
        rate: "25400.000000",
        source: "seed:reference-only",
        observedAt: new Date(),
      },
      {
        baseCurrency: "EUR",
        quoteCurrency: "VND",
        rate: "27600.000000",
        source: "seed:reference-only",
        observedAt: new Date(),
      },
    ]);
    console.log("Seeded 2 reference FX rates (USD/VND, EUR/VND).");
  }

  process.exit(0);
}

seed();
