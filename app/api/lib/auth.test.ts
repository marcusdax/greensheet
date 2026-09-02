import { describe, expect, it } from "vitest";
import { hashPassword, signSession, verifyPassword, verifySession } from "./auth";

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("Tr0ub4dor&3", hash)).toBe(false);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$whatever")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a signed session", () => {
    const token = signSession(42);
    expect(verifySession(token)).toBe(42);
  });

  it("rejects a tampered payload", () => {
    const token = signSession(42);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: 1, exp: Date.now() + 1e7 })).toString(
      "base64url",
    );
    expect(verifySession(`${forged}.${sig}`)).toBeNull();
    expect(verifySession(`${payload}.AAAA${sig.slice(4)}`)).toBeNull();
  });

  it("rejects garbage tokens", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession("no-dot-here")).toBeNull();
    expect(verifySession("a.b.c")).toBeNull();
  });
});
