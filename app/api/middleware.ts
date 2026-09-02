import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { UserRole } from "@contracts/constants";
import type { SessionUser, TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

// Any authenticated user.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "GS-AUTH-1001 · unauthenticated" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Deny-by-default role scoping (engineering/07 §2). platform_admin always passes.
export function roleProcedure(...roles: UserRole[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== "platform_admin" && !roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "GS-GEN-1002 · missing scope" });
    }
    return next();
  });
}

// Internal staff who run day-to-day operations.
export const staffProcedure = roleProcedure("ops_manager");
// Read-side analytics roles (analytics:read in the RBAC matrix).
export const analystProcedure = roleProcedure("ops_manager", "sales_csm", "analyst");

// BOLA guard: a roaster_buyer touching another tenant's resource gets 404, not
// 403 — existence must not leak across accounts (engineering/07 §2).
export function assertOwnRoaster(user: SessionUser, roasterId: number) {
  if (user.role === "roaster_buyer" && user.roasterId !== roasterId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "GS-GEN-1005 · resource not found" });
  }
}
