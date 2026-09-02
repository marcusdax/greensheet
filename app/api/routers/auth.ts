import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { USER_ROLES } from "@contracts/constants";
import { users } from "@db/schema";
import { emitEvent } from "../engine";
import {
  buildLogoutCookie,
  buildSessionCookie,
  hashPassword,
  signSession,
  verifyPassword,
} from "../lib/auth";
import { createRouter, protectedProcedure, publicQuery, roleProcedure } from "../middleware";
import { getDb } from "../queries/connection";

// Identity Context — credential login with HMAC cookie sessions. One error
// code (GS-AUTH-1000) covers unknown email and wrong password alike, so the
// endpoint never confirms whether an address is registered.
export const authRouter = createRouter({
  me: publicQuery.query(({ ctx }) => ctx.user),

  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });
      const ok = user && user.active && (await verifyPassword(input.password, user.passwordHash));
      if (!ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "GS-AUTH-1000 · invalid credentials" });
      }
      ctx.resHeaders.append("Set-Cookie", buildSessionCookie(signSession(user.id)));
      await emitEvent("auth.user_logged_in", "user", user.id, {
        userId: user.id,
        role: user.role,
      });
      return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, roasterId: user.roasterId },
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.resHeaders.append("Set-Cookie", buildLogoutCookie());
    await emitEvent("auth.user_logged_out", "user", ctx.user.id, { userId: ctx.user.id });
    return { ok: true };
  }),

  createUser: roleProcedure()
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(2),
        password: z.string().min(8),
        role: z.enum(USER_ROLES),
        roasterId: z.number().nullable().default(null),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const email = input.email.toLowerCase();
      const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GS-AUTH-1002 · email already registered" });
      }
      const [{ id }] = await db
        .insert(users)
        .values({
          email,
          name: input.name,
          passwordHash: await hashPassword(input.password),
          role: input.role,
          roasterId: input.roasterId,
        })
        .$returningId();
      await emitEvent("auth.user_created", "user", id, { userId: id, email, role: input.role });
      return { ok: true, id };
    }),
});
