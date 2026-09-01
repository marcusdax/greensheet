// Server-side flag resolution (ADR-05).
//
// Source of truth is the feature_flags table, cached for FLAG_SERVER_CACHE_MS
// so that a hot path (the outbox consumer, the webhook endpoints) does not pay
// a query per event, while a kill switch still bites in under a minute.
//
// Env vars are a LOCAL DEV override only. They win over the database, which is
// exactly wrong for production — so the override is ignored when NODE_ENV is
// production, and the flag table is the only authority there.
import { getDb } from "../queries/connection";
import { featureFlags } from "@db/schema";
import {
  FLAG_KEYS,
  FLAG_SERVER_CACHE_MS,
  defaultFlags,
  type FlagKey,
  type Flags,
} from "@contracts/flags";
import { env } from "../lib/env";

let cache: { value: Flags; expiresAt: number } | null = null;

/** `FLAG_AUTO_ALLOCATION=1` overrides `autoAllocation` outside production. */
function envOverride(key: FlagKey): boolean | null {
  if (env.isProduction) return null;
  const name = `FLAG_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`;
  const raw = process.env[name];
  if (raw == null || raw === "") return null;
  return raw === "1" || raw.toLowerCase() === "true";
}

export async function getFlags(opts: { fresh?: boolean } = {}): Promise<Flags> {
  const now = Date.now();
  if (!opts.fresh && cache && cache.expiresAt > now) return cache.value;

  const flags = defaultFlags();
  try {
    const rows = await getDb().select().from(featureFlags);
    for (const row of rows) {
      if ((FLAG_KEYS as string[]).includes(row.flagKey)) {
        flags[row.flagKey as FlagKey] = row.enabled;
      }
    }
  } catch {
    // A flag lookup must never take the request down. Falling back to the
    // defaults fails closed: every payment flag defaults to off.
  }

  for (const key of FLAG_KEYS) {
    const override = envOverride(key);
    if (override !== null) flags[key] = override;
  }

  cache = { value: flags, expiresAt: now + FLAG_SERVER_CACHE_MS };
  return flags;
}

export async function isEnabled(key: FlagKey): Promise<boolean> {
  return (await getFlags())[key];
}

/** Called by the admin mutation so the change is visible immediately. */
export function invalidateFlagCache(): void {
  cache = null;
}
