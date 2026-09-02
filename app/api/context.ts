import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import type { UserRole } from "@contracts/constants";
import { users } from "@db/schema";
import { readSessionCookie, verifySession } from "./lib/auth";
import { getDb } from "./queries/connection";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  roasterId: number | null;
};

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user: SessionUser | null;
};

export async function resolveSessionUser(req: Request): Promise<SessionUser | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const userId = verifySession(token);
  if (userId == null) return null;
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  // Deactivation revokes access immediately, even with a valid cookie.
  if (!row || !row.active) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, roasterId: row.roasterId };
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const user = await resolveSessionUser(opts.req);
  return { req: opts.req, resHeaders: opts.resHeaders, user };
}
