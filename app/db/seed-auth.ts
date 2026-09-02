// Auth seed — the three working accounts for the RBAC demo. Idempotent by
// email: existing accounts are left untouched, so re-running never rotates a
// password someone already changed.
import { eq } from "drizzle-orm";
import { hashPassword } from "../api/lib/auth";
import { getDb } from "../api/queries/connection";
import { roasters, users } from "./schema";

const ACCOUNTS = [
  {
    email: "admin@auctumledger.io",
    name: "Platform Admin",
    role: "platform_admin" as const,
    password: process.env.SEED_ADMIN_PASSWORD ?? "auctum-dev-admin",
    roasterId: null as number | null,
  },
  {
    email: "ops@auctumledger.io",
    name: "Ops Manager",
    role: "ops_manager" as const,
    password: process.env.SEED_OPS_PASSWORD ?? "auctum-dev-ops",
    roasterId: null as number | null,
  },
  {
    email: "buyer@auctumledger.io",
    name: "Roaster Buyer",
    role: "roaster_buyer" as const,
    password: process.env.SEED_BUYER_PASSWORD ?? "auctum-dev-buyer",
    roasterId: null as number | null, // bound to the first seeded roaster below
  },
];

async function seedAuth() {
  const db = getDb();
  const firstRoaster = await db.select().from(roasters).limit(1);

  for (const account of ACCOUNTS) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, account.email) });
    if (existing) {
      console.log(`SKIP ${account.email} (already exists)`);
      continue;
    }
    const roasterId =
      account.role === "roaster_buyer" ? (firstRoaster[0]?.id ?? null) : account.roasterId;
    await db.insert(users).values({
      email: account.email,
      name: account.name,
      passwordHash: await hashPassword(account.password),
      role: account.role,
      roasterId,
    });
    console.log(
      `OK   ${account.email} · ${account.role}` +
        (roasterId != null ? ` · roaster #${roasterId}` : "") +
        ` · password: ${account.password}`,
    );
  }
  process.exit(0);
}

seedAuth().catch((e) => {
  console.error(e);
  process.exit(1);
});
