// §11.2 — integration, against a real MySQL rather than a mock.
//
// Every assertion here is about something a mock cannot tell you: whether the
// unique index actually holds under concurrency, whether a webhook delivered
// five times credits once, whether a correlated subquery correlates. The unit
// suite next door proves the logic; this proves the database agrees.
//
// Skipped, loudly, when INTEGRATION_DATABASE_URL is unset — a suite that
// silently passes because it never ran is the failure mode this tier exists to
// prevent.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";

// INTEGRATION_DATABASE_URL only — never DATABASE_URL. A developer with their
// dev database exported must not be able to run a TRUNCATE suite against it by
// typing `npm test`.
const enabled = (process.env.INTEGRATION_DATABASE_URL ?? "") !== "";

const suite = enabled ? describe : describe.skip;

if (!enabled) {
  console.warn(
    "\n§11.2 integration suite SKIPPED: set INTEGRATION_DATABASE_URL to a throwaway MySQL schema to run it.\n"
  );
}

suite("§11.2 · settlement against a real MySQL", () => {
  let db: Awaited<ReturnType<typeof import("../queries/connection")["getDb"]>>;
  let schema: typeof import("@db/schema");
  let app: Hono;
  // The tRPC caller's inferred type is the whole router; naming it here would
  // be a hundred lines of generics for no assertion. Procedures are still
  // type-checked at their definition — this only loosens the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let caller: any;
  let payos: typeof import("../services/payments/payos");
  let reconcile: typeof import("../services/payments/aging")["reconcile"];
  let pilot: typeof import("../services/payments/pilot");

  let counterpartyId: number;
  let userId: number;

  beforeAll(async () => {
    schema = await import("@db/schema");
    const connection = await import("../queries/connection");
    db = connection.getDb();
    payos = await import("../services/payments/payos");
    reconcile = (await import("../services/payments/aging")).reconcile;
    pilot = await import("../services/payments/pilot");

    const { payosWebhook } = await import("../webhooks/payos");
    const { cassoWebhook } = await import("../webhooks/casso");
    app = new Hono();
    app.post("/webhooks/payos", payosWebhook);
    app.post("/webhooks/casso", cassoWebhook);

    const { appRouter } = await import("../router");
    // A caller rather than an HTTP round-trip: the session cookie is not what
    // is under test here, and signing one would only add a way for these tests
    // to fail for a reason unrelated to settlement.
    caller = appRouter.createCaller({
      req: new Request("http://test.invalid/"),
      resHeaders: new Headers(),
      user: {
        id: 1,
        email: "integration@auctumledger.io",
        name: "Integration Runner",
        role: "ops_manager" as const,
        roasterId: null,
      },
    });
  });

  /**
   * Wipe only what these tests write, in FK-safe order.
   *
   * Deliberately NOT a blanket `DROP DATABASE`: the tables are created by
   * `db:push` in CI, and re-pushing between test files would dominate the run.
   */
  beforeEach(async () => {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of [
      "payment_allocations",
      "provider_transactions",
      "payment_intents",
      "idempotency_records",
      "domain_events",
      "domain_events_dead",
      "invoices",
      "counterparties",
      "users",
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

    const [user] = await db
      .insert(schema.users)
      .values({
        email: "integration@auctumledger.io",
        name: "Integration Runner",
        role: "ops_manager",
        passwordHash: "x",
        active: true,
      })
      .$returningId();
    userId = Number(user.id);

    const [cp] = await db
      .insert(schema.counterparties)
      .values({
        name: "Hop tac xa Ca phe Cau Dat",
        type: "cooperative",
        country: "VN",
      })
      .$returningId();
    counterpartyId = Number(cp.id);
  });

  async function makeInvoice(opts: {
    totalMinor: bigint;
    currency?: string;
    memoToken?: string;
  }) {
    const [row] = await db
      .insert(schema.invoices)
      .values({
        invoiceNumber: `INT-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        counterpartyId,
        payableType: "order",
        payableId: 1,
        issuedAt: new Date().toISOString().slice(0, 10),
        dueAt: new Date().toISOString().slice(0, 10),
        subtotalMinor: opts.totalMinor,
        totalMinor: opts.totalMinor,
        paidMinor: 0n,
        currency: opts.currency ?? "VND",
        status: "issued",
        memoToken:
          opts.memoToken ??
          `T${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      })
      .$returningId();
    return Number(row.id);
  }

  function payosBody(data: Record<string, unknown>) {
    const signature = payos.signPayosPayload(
      data,
      process.env.PAYOS_CHECKSUM_KEY as string
    );
    return JSON.stringify({ code: "00", desc: "success", data, signature });
  }

  const post = (path: string, body: string, headers: Record<string, string> = {}) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    });

  // ── Idempotency (§7.3) ────────────────────────────────────────────────────

  it("replays the same intent for the same key and body", async () => {
    const invoiceId = await makeInvoice({ totalMinor: 918_000_000n });
    const input = {
      invoiceId,
      idempotencyKey: "key-replay-0001",
      provider: "manual" as const,
    };
    const first = await caller.payments.intents.create(input);
    const second = await caller.payments.intents.create(input);
    expect(second.id).toBe(first.id);

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.paymentIntents);
    expect(Number(n)).toBe(1);
  });

  it("returns GS-PAY-1001 for the same key with a different body", async () => {
    const a = await makeInvoice({ totalMinor: 918_000_000n });
    const b = await makeInvoice({ totalMinor: 100_000_000n });
    await caller.payments.intents.create({
      invoiceId: a,
      idempotencyKey: "key-conflict-0001",
      provider: "manual",
    });
    await expect(
      caller.payments.intents.create({
        invoiceId: b,
        idempotencyKey: "key-conflict-0001",
        provider: "manual",
      })
    ).rejects.toThrow(/GS-PAY-1001/);
  });

  it("produces exactly one row from 20 concurrent duplicate creates", async () => {
    // The assertion the unique index exists for. A read-then-write guard passes
    // this at concurrency 1 and fails here.
    const invoiceId = await makeInvoice({ totalMinor: 918_000_000n });
    const input = {
      invoiceId,
      idempotencyKey: "key-concurrent-0001",
      provider: "manual" as const,
    };
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => caller.payments.intents.create(input))
    );
    const fulfilled = results.filter(r => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThan(0);

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.paymentIntents);
    expect(Number(n)).toBe(1);
  });

  // ── Webhooks (§7.2, §14.2) ────────────────────────────────────────────────

  it("credits once for a webhook with a valid signature", async () => {
    const invoiceId = await makeInvoice({
      totalMinor: 918_000_000n,
      memoToken: "A7K2M9",
    });
    const res = await post(
      "/webhooks/payos",
      payosBody({
        orderCode: 240817001,
        amount: 918_000_000,
        description: "AUCTUM A7K2M9",
        reference: "FT-INT-0001",
        transactionDateTime: "2026-08-17 09:41:12",
        currency: "VND",
      })
    );
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(schema.providerTransactions)
      .where(eq(schema.providerTransactions.providerTxnId, "FT-INT-0001"));
    expect(rows).toHaveLength(1);
    expect(rows[0].signatureValid).toBe(true);
    expect(invoiceId).toBeGreaterThan(0);
  });

  it("credits once when the same webhook is delivered five times", async () => {
    await makeInvoice({ totalMinor: 918_000_000n, memoToken: "B4N8P1" });
    const body = payosBody({
      orderCode: 240817002,
      amount: 918_000_000,
      description: "AUCTUM B4N8P1",
      reference: "FT-INT-0002",
      transactionDateTime: "2026-08-17 09:41:12",
      currency: "VND",
    });

    for (let i = 0; i < 5; i++) {
      const res = await post("/webhooks/payos", body);
      // Every delivery is acknowledged; only the first has an effect. A
      // non-200 on a retry is how a provider ends up retrying forever.
      expect(res.status).toBe(200);
    }

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.providerTransactions)
      .where(eq(schema.providerTransactions.providerTxnId, "FT-INT-0002"));
    expect(Number(n)).toBe(1);
  });

  it("returns 401 and writes no transaction for an invalid signature", async () => {
    const res = await post(
      "/webhooks/payos",
      JSON.stringify({
        code: "00",
        data: {
          orderCode: 240817003,
          amount: 918_000_000,
          description: "AUCTUM FORGED",
          reference: "FT-INT-FORGED",
          transactionDateTime: "2026-08-17 09:41:12",
        },
        signature: "0".repeat(64),
      })
    );
    expect(res.status).toBe(401);

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.providerTransactions);
    expect(Number(n)).toBe(0);
  });

  // ── ADR-03: Casso is untrusted ────────────────────────────────────────────

  it("persists a valid-token Casso callback but never marks it verified", async () => {
    const res = await post(
      "/webhooks/casso",
      JSON.stringify({
        error: 0,
        data: [
          {
            tid: "CASSO-INT-0001",
            description: "AUCTUM C6R2S8",
            amount: 451_500_000,
            when: "2026-08-17",
            bankName: "ACB",
          },
        ],
      }),
      { "secure-token": process.env.CASSO_WEBHOOK_SECRET as string }
    );
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(schema.providerTransactions)
      .where(eq(schema.providerTransactions.providerTxnId, "CASSO-INT-0001"));
    expect(row).toBeDefined();
    // The header proves possession of a shared secret and nothing about the
    // payload. Until the API re-fetch stamps verifiedAt, this money cannot move.
    expect(row.signatureValid).toBe(false);
    expect(row.verifiedAt).toBeNull();
  });

  it("does not allocate a Casso transaction whose API re-fetch fails", async () => {
    const invoiceId = await makeInvoice({
      totalMinor: 451_500_000n,
      memoToken: "C6R2S8",
    });
    await post(
      "/webhooks/casso",
      JSON.stringify({
        error: 0,
        data: [
          {
            tid: "CASSO-INT-0002",
            description: "AUCTUM C6R2S8",
            amount: 451_500_000,
            when: "2026-08-17",
          },
        ],
      }),
      { "secure-token": process.env.CASSO_WEBHOOK_SECRET as string }
    );

    const { verifyWithCassoApi } = await import("../services/payments/casso");
    const verification = await verifyWithCassoApi(
      "CASSO-INT-0002",
      { amountMinor: 451_500_000n },
      {
        // The API is unreachable. A forged callback looks exactly like this,
        // which is the point: an unverifiable transaction allocates nothing.
        fetchImpl: (async () => {
          throw new Error("connect ECONNREFUSED");
        }) as unknown as typeof fetch,
        apiKey: "integration-casso-api-key",
      }
    );
    expect(verification.ok).toBe(false);

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.invoiceId, invoiceId));
    expect(Number(n)).toBe(0);
  });

  it("rejects a Casso callback with a wrong token", async () => {
    const res = await post(
      "/webhooks/casso",
      JSON.stringify({ error: 0, data: [{ tid: "X", amount: 1, when: "2026-08-17" }] }),
      { "secure-token": "not-the-secret" }
    );
    expect(res.status).toBe(401);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.providerTransactions);
    expect(Number(n)).toBe(0);
  });

  // ── §13.3 reconciliation, with allocations actually present ───────────────

  it("reconciles clean after a real allocation", async () => {
    // This is a regression test with a history. The reconciliation subqueries
    // were uncorrelated — `WHERE a.invoiceId = \`id\`` binds to the SUBQUERY's
    // own id column — so every invoice was compared against the sum of ALL
    // allocations. It passed for months because the table was empty and SUM
    // over no rows is 0. It only fails once money exists, which is exactly
    // when a reconciliation job needs to be right.
    const invoiceId = await makeInvoice({
      totalMinor: 918_000_000n,
      memoToken: "D9Q3R5",
    });
    const otherId = await makeInvoice({
      totalMinor: 100_000_000n,
      memoToken: "E2T7U4",
    });

    const [txn] = await db
      .insert(schema.providerTransactions)
      .values({
        provider: "manual",
        providerTxnId: "MAN-INT-0001",
        rawPayload: {},
        signatureValid: true,
        amountMinor: 918_000_000n,
        currency: "VND",
        description: "AUCTUM D9Q3R5",
        occurredAt: new Date(),
        matchStatus: "unmatched",
      })
      .$returningId();

    const { allocate } = await import("../services/payments/allocation");
    await allocate({
      providerTransactionId: Number(txn.id),
      invoiceId,
      amountMinor: 918_000_000n,
      currency: "VND",
      allocatedByUserId: userId,
    });

    const result = await reconcile();
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);

    // And the untouched invoice is still untouched — the check that the
    // uncorrelated version got wrong.
    const [other] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, otherId));
    expect(BigInt(other.paidMinor)).toBe(0n);
  });

  // ── §13.4 pilot allowlist ─────────────────────────────────────────────────

  it("withholds auto-allocation from a counterparty outside the pilot", async () => {
    const invoiceId = await makeInvoice({ totalMinor: 918_000_000n });
    const gate = await pilot.pilotGateFor(invoiceId);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/§13.4/);
    expect(gate.counterpartyId).toBe(counterpartyId);
  });

  it("admits an enrolled counterparty and reports the graduation clock", async () => {
    const invoiceId = await makeInvoice({ totalMinor: 918_000_000n });
    await pilot.enrolInPilot(counterpartyId, new Date(Date.now() - 3 * 86_400_000));

    const gate = await pilot.pilotGateFor(invoiceId);
    expect(gate.allowed).toBe(true);

    const [member] = await pilot.pilotRoster();
    expect(member.counterpartyId).toBe(counterpartyId);
    expect(member.daysEnrolled).toBe(3);
    expect(member.readyToGraduate).toBe(false);
    expect(member.blocker).toMatch(/11 more clean day/);
  });

  it("restarts the graduation clock on a manual reversal", async () => {
    const invoiceId = await makeInvoice({ totalMinor: 918_000_000n });
    await pilot.enrolInPilot(
      counterpartyId,
      new Date(Date.now() - 20 * 86_400_000)
    );
    // Twenty days in and otherwise ready to graduate…
    expect((await pilot.pilotRoster())[0].readyToGraduate).toBe(true);

    const [txn] = await db
      .insert(schema.providerTransactions)
      .values({
        provider: "manual",
        providerTxnId: "MAN-INT-0002",
        rawPayload: {},
        signatureValid: true,
        amountMinor: 918_000_000n,
        currency: "VND",
        description: "AUCTUM reversal case",
        occurredAt: new Date(),
        matchStatus: "unmatched",
      })
      .$returningId();

    const { allocate, reverseAllocation } = await import(
      "../services/payments/allocation"
    );
    const allocation = await allocate({
      providerTransactionId: Number(txn.id),
      invoiceId,
      amountMinor: 918_000_000n,
      currency: "VND",
      allocatedByUserId: userId,
    });
    await reverseAllocation({
      allocationId: allocation.allocationId,
      reversedByUserId: userId,
      reason: "operator error",
    });

    // …and one reversal puts them back to day zero. §13.4 says CONSECUTIVE
    // clean days; a counter that merely paused would graduate them tomorrow.
    const [member] = await pilot.pilotRoster();
    expect(member.reversalsInWindow).toBe(1);
    expect(member.daysEnrolled).toBe(0);
    expect(member.readyToGraduate).toBe(false);
  });

  it("stops auto-allocation again when a counterparty is withdrawn", async () => {
    const invoiceId = await makeInvoice({ totalMinor: 918_000_000n });
    await pilot.enrolInPilot(counterpartyId);
    expect((await pilot.pilotGateFor(invoiceId)).allowed).toBe(true);
    await pilot.withdrawFromPilot(counterpartyId);
    expect((await pilot.pilotGateFor(invoiceId)).allowed).toBe(false);
  });
});
