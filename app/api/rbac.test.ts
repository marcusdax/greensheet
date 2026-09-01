// §5.3 — "write a single table of procedure → role in contracts/rbac.ts and a
// test that fails if a procedure is added without an entry."
//
// This walks the live tRPC router rather than a hand-maintained list, so adding
// a procedure to the payments or invoices surface and forgetting the RBAC line
// fails here rather than shipping open.
import { describe, it, expect } from "vitest";
import { appRouter } from "./router";
import {
  RBAC_PROCEDURE_PATHS,
  rolesFor,
  noteFor,
  isRbacProcedure,
} from "@contracts/rbac";
import { USER_ROLES } from "@contracts/constants";

/** Routers covered by the sprint's RBAC table. */
const GOVERNED_ROOTS = ["config", "invoices", "payments", "documents"] as const;

function proceduresUnder(root: string): string[] {
  // tRPC 11 flattens nested routers into dotted keys on _def.procedures.
  const procedures = (appRouter._def as { procedures: Record<string, unknown> })
    .procedures;
  return Object.keys(procedures).filter(path => path.split(".")[0] === root);
}

describe("RBAC table completeness (§5.3)", () => {
  it("covers every procedure in the governed routers", () => {
    const missing: string[] = [];
    for (const root of GOVERNED_ROOTS) {
      for (const path of proceduresUnder(root)) {
        if (!isRbacProcedure(path)) missing.push(path);
      }
    }
    expect(
      missing,
      `these procedures have no entry in contracts/rbac.ts — add one before merging:\n  ${missing.join("\n  ")}`
    ).toEqual([]);
  });

  it("has no stale entries for procedures that no longer exist", () => {
    const live = new Set(GOVERNED_ROOTS.flatMap(proceduresUnder));
    const stale = RBAC_PROCEDURE_PATHS.filter(p => !live.has(p));
    expect(stale, `stale RBAC entries: ${stale.join(", ")}`).toEqual([]);
  });

  it("names only real roles", () => {
    for (const path of RBAC_PROCEDURE_PATHS) {
      for (const role of rolesFor(path)) {
        expect(USER_ROLES, `${path} names an unknown role "${role}"`).toContain(
          role
        );
      }
    }
  });

  it("never grants platform_admin explicitly — it passes everything by design", () => {
    for (const path of RBAC_PROCEDURE_PATHS) {
      expect(
        rolesFor(path),
        `${path} lists platform_admin redundantly`
      ).not.toContain("platform_admin");
    }
  });

  it("keeps the money-moving procedures narrow", () => {
    // The lines §5.3 calls out by name. If someone widens one of these, the
    // diff should be a conversation, not a surprise.
    expect(rolesFor("payments.allocations.create")).toEqual(["ops_manager"]);
    expect(rolesFor("payments.allocations.reverse")).toEqual(["ops_manager"]);
    expect(rolesFor("invoices.writeOff")).toEqual([]); // platform_admin only
    expect(rolesFor("config.setFlag")).toEqual([]); // kill switches
  });

  it("lets a roaster_buyer read invoices but never write or allocate", () => {
    const buyerReadable = RBAC_PROCEDURE_PATHS.filter(p =>
      rolesFor(p).includes("roaster_buyer")
    );
    for (const path of buyerReadable) {
      expect(
        path,
        `roaster_buyer must not reach a mutating procedure (${path})`
      ).not.toMatch(
        /\.(issue|void|writeOff|create|cancel|reverse|ignore|recordManual|setFlag|confirmUpload|upload|recordReview)$/
      );
    }
    expect(buyerReadable.length).toBeGreaterThan(0);
  });

  it("documents a reason wherever access is unusually tight or wide", () => {
    for (const path of RBAC_PROCEDURE_PATHS) {
      const roles = rolesFor(path);
      if (roles.length === 0 || roles.length >= 4) {
        expect(
          noteFor(path),
          `${path} needs a note explaining its access level`
        ).toBeTruthy();
      }
    }
  });
});
