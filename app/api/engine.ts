// Domain event engine: transactional outbox + COF-001…005 rule evaluation.
//
// Sprint spec §4.1 rewrites this file. emitEvent() used to insert the event and
// then call evaluateRules() in the same function, outside any transaction (B6):
// a payment could be recorded but never applied, or applied twice. It is now a
// real outbox write — it takes the caller's transaction, inserts one row, and
// returns the outbox id. Nothing else.
//
// Rule evaluation moved to api/services/outbox/handlers.ts. Per §4.1's
// migration-safety clause the legacy inline path still runs while the
// `outboxConsumer` flag is off, so the fourteen verified flows in README.md
// keep passing unchanged during the cutover release.
import { eq, desc } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { getFlags } from "./services/flags";
import {
  automationRules,
  campaigns,
  churnInterventions,
  dispatches,
  domainEvents,
  roasters,
  sampleKitItems,
} from "@db/schema";
import { CHURN_HAZARD_THRESHOLD, formatCentsPerLb } from "@contracts/constants";

type Payload = Record<string, unknown>;

/**
 * The caller's transaction. Drizzle's `db` and a `tx` handle are structurally
 * identical for an insert, so a call site that is not yet transactional passes
 * `getDb()` and one that is passes its `tx` — the event then commits or rolls
 * back atomically with the money it describes.
 */
export type EventWriter = Pick<ReturnType<typeof getDb>, "insert">;

/**
 * Append one row to the outbox and return its id. No side effects: dispatch is
 * the consumer's job (§4.2).
 */
export async function writeEvent(
  tx: EventWriter,
  eventType: string,
  aggregateType: string,
  aggregateId: string | number,
  payload: Payload,
  opts: { version?: number } = {},
): Promise<number> {
  const [res] = await tx.insert(domainEvents).values({
    eventType,
    aggregateType,
    aggregateId: String(aggregateId),
    payload,
    eventVersion: opts.version ?? 1,
  });
  return Number(res.insertId);
}

/**
 * Emit a domain event.
 *
 * Transaction-aware overload — `emitEvent(tx, type, …)` — is what new money
 * paths use. The legacy shape `emitEvent(type, aggregateType, id, payload)` is
 * still accepted so the existing nine routers keep working during the §4.1
 * cutover; it writes on the pooled connection and, while `outboxConsumer` is
 * off, fires the reactive policies inline exactly as before.
 */
export async function emitEvent(
  tx: EventWriter,
  eventType: string,
  aggregateType: string,
  aggregateId: string | number,
  payload: Payload,
  opts?: { version?: number },
): Promise<number>;
export async function emitEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string | number,
  payload: Payload,
): Promise<number>;
export async function emitEvent(
  ...args:
    | [EventWriter, string, string, string | number, Payload, { version?: number }?]
    | [string, string, string | number, Payload]
): Promise<number> {
  const transactional = typeof args[0] !== "string";
  let tx: EventWriter;
  let eventType: string;
  let aggregateType: string;
  let aggregateId: string | number;
  let payload: Payload;
  let opts: { version?: number } | undefined;

  if (transactional) {
    [tx, eventType, aggregateType, aggregateId, payload, opts] = args as [
      EventWriter,
      string,
      string,
      string | number,
      Payload,
      { version?: number }?,
    ];
  } else {
    [eventType, aggregateType, aggregateId, payload] = args as [
      string,
      string,
      string | number,
      Payload,
    ];
    tx = getDb();
  }

  const eventId = await writeEvent(tx, eventType, aggregateType, aggregateId, payload, opts ?? {});

  // §4.1 migration safety: run the legacy inline path and the consumer side by
  // side for one release. Inside a caller's transaction we never fire rules —
  // side effects belong to the consumer, after the commit.
  if (!transactional) {
    const flags = await getFlags();
    if (!flags.outboxConsumer) await evaluateRules(eventType, payload);
  }
  return eventId;
}

async function logEvent(eventType: string, aggregateType: string, aggregateId: string | number, payload: Payload) {
  await writeEvent(getDb(), eventType, aggregateType, aggregateId, payload);
}

/** Replace merge tags — byte-identical tag names per the canonical conventions. */
function renderTokens(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
    template,
  );
}

async function ruleIsArmed(ruleCode: string) {
  const db = getDb();
  const rule = await db.query.automationRules.findFirst({
    where: eq(automationRules.ruleCode, ruleCode),
  });
  if (!rule || !rule.active) return null;
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, rule.campaignId),
  });
  if (!campaign || campaign.status !== "active") return null;
  return { rule, campaign };
}

async function recordDispatch(input: {
  ruleCode: string;
  campaignId: number;
  roasterId: number;
  channel: "email" | "sms" | "whatsapp" | "crm" | "system";
  subject: string;
  body: string;
  status: "sent" | "queued" | "halted" | "lifecycle_updated" | "converted";
}) {
  await getDb().insert(dispatches).values(input);
}

/** Policy engine: whenever E, then C (policy matrix P-04…P-07). */
export async function evaluateRules(eventType: string, payload: Payload): Promise<void> {
  const db = getDb();

  // ── P-04 · COF-001: sample_kit.delivered → Touch-1 email ──────────────────
  if (eventType === "sample_kit.delivered") {
    const armed = await ruleIsArmed("COF-001");
    const roasterId = Number(payload.roasterId);
    const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, roasterId) });
    if (!armed || !roaster || roaster.nurtureHalted) return;

    const items = await db
      .select()
      .from(sampleKitItems)
      .where(eq(sampleKitItems.kitId, Number(payload.kitId)));
    const lead = items[0];
    const tokens = {
      roaster_name: roaster.roasterName,
      origin: lead?.origin ?? "your selected origins",
      varietal: lead?.lotName ?? "",
      process_method: lead?.processMethod ?? "",
      sca_cup_score: lead ? lead.cupScoreSnapshot.toFixed(1) : "",
      price_per_lb: lead ? formatCentsPerLb(lead.pricePerLbCentsSnapshot) : "",
    };
    await logEvent("campaigns.rule_triggered", "rule", "COF-001", { ruleCode: "COF-001", roasterId, kitId: payload.kitId });
    await recordDispatch({
      ruleCode: "COF-001",
      campaignId: armed.campaign.id,
      roasterId,
      channel: "email",
      subject: `Touch-1 · The story behind your ${tokens.origin} samples`,
      body: renderTokens(
        `Hi {roaster_name} — your kit has landed. Inside: {varietal} ({process_method}) from {origin}, cupping at {sca_cup_score} SCA. Full cupping notes and the farm story are enclosed. Spot price: {price_per_lb}. Reply with your roast-date plans and we'll hold allocation.`,
        tokens,
      ),
      status: "sent",
    });
    await logEvent("campaigns.message_sent", "dispatch", `COF-001:${roasterId}`, { ruleCode: "COF-001", roasterId, channel: "email" });
    return;
  }

  // ── P-05 / P-06 · COF-002 & COF-003: feedback.submitted ───────────────────
  if (eventType === "feedback.submitted") {
    const roasterId = Number(payload.roasterId);
    const rating = Number(payload.rating);
    const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, roasterId) });
    if (!roaster) return;

    if (rating >= 4 && !roaster.nurtureHalted) {
      const armed = await ruleIsArmed("COF-002");
      if (armed) {
        const items = await db
          .select()
          .from(sampleKitItems)
          .where(eq(sampleKitItems.kitId, Number(payload.kitId)));
        const lines = items
          .map((i) => `• ${i.lotName} — ${i.origin}, {sca} SCA @ ${formatCentsPerLb(i.pricePerLbCentsSnapshot)}`.replace("{sca}", i.cupScoreSnapshot.toFixed(1)))
          .join("\n");
        await logEvent("campaigns.rule_triggered", "rule", "COF-002", { ruleCode: "COF-002", roasterId, rating });
        await recordDispatch({
          ruleCode: "COF-002",
          campaignId: armed.campaign.id,
          roasterId,
          channel: "email",
          subject: `Touch-2 · Pricing sheet — your rated lots`,
          body: `Great to hear the kit scored ${rating}/5 with your team, ${roaster.roasterName}. Here is the pricing sheet for the lots you cupped:\n${lines}\nVolume tiers unlock at 500 lbs. This pricing holds for 14 days.`,
          status: "sent",
        });
        await logEvent("campaigns.message_sent", "dispatch", `COF-002:${roasterId}`, { ruleCode: "COF-002", roasterId, channel: "email" });
      }
    }

    if (rating <= 2) {
      const armed = await ruleIsArmed("COF-003");
      if (armed) {
        await logEvent("campaigns.rule_triggered", "rule", "COF-003", { ruleCode: "COF-003", roasterId, rating });
        // UPDATE_CRM_LIFECYCLE → needs_attention
        await db
          .update(roasters)
          .set({
            lifecycleStatus: "needs_attention",
            churnRiskScore: Math.max(roaster.churnRiskScore, CHURN_HAZARD_THRESHOLD + 0.02),
            lastActivityAt: new Date(),
          })
          .where(eq(roasters.id, roasterId));
        await logEvent("crm.churn_risk_detected", "roaster", roasterId, {
          roasterId,
          riskScore: Math.max(roaster.churnRiskScore, CHURN_HAZARD_THRESHOLD + 0.02),
          topFeatures: ["negative_feedback"],
        });
        await recordDispatch({
          ruleCode: "COF-003",
          campaignId: armed.campaign.id,
          roasterId,
          channel: "crm",
          subject: "UPDATE_CRM_LIFECYCLE → needs_attention",
          body: `Feedback rating ${rating}/5 from ${roaster.roasterName}. Lifecycle moved to needs_attention; consultative track engaged.`,
          status: "lifecycle_updated",
        });
        // Consultative SMS variant (option_b_consultative)
        await recordDispatch({
          ruleCode: "COF-003",
          campaignId: armed.campaign.id,
          roasterId,
          channel: "sms",
          subject: "Consultative SMS",
          body: `${roaster.contactName}, sorry the kit missed the mark. Our green buyer would like 15 min to hear what didn't work and source to your profile — can we book a call this week?`,
          status: "sent",
        });
        // P-08 · churn risk → start intervention
        await db.insert(churnInterventions).values({
          roasterId,
          interventionType: "sales_call",
          outcome: "pending",
          reason: `Negative sample feedback (rating ${rating}/5)`,
        });
        await logEvent("crm.intervention_started", "roaster", roasterId, { roasterId, interventionType: "sales_call" });
      }
    }
    return;
  }

  // ── COF-004: campaigns.link_clicked (pricing page) → Touch-3 volume CTA ───
  if (eventType === "campaigns.link_clicked" && payload.clickedPricingPage === true) {
    const armed = await ruleIsArmed("COF-004");
    const roasterId = Number(payload.roasterId);
    const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, roasterId) });
    if (!armed || !roaster || roaster.nurtureHalted) return;

    await logEvent("campaigns.rule_triggered", "rule", "COF-004", {
      ruleCode: "COF-004",
      roasterId,
      lotId: payload.lotId,
    });
    await recordDispatch({
      ruleCode: "COF-004",
      campaignId: armed.campaign.id,
      roasterId,
      channel: "email",
      subject: "Touch-3 · Volume tiers unlocked on the lot you priced",
      body: `${roaster.contactName} — we noticed you reviewing pricing. Volume discounts unlock at 500 lbs (5%), 1,000 lbs (8%) and full-pallet (12%). Reply to lock a tier before this allocation moves.`,
      status: "sent",
    });
    await recordDispatch({
      ruleCode: "COF-004",
      campaignId: armed.campaign.id,
      roasterId,
      channel: "whatsapp",
      subject: "Volume CTA (WhatsApp)",
      body: `Hi ${roaster.contactName}, volume tiers just opened on the lot you priced — 5% at 500 lbs, 8% at 1,000 lbs. Want me to hold allocation?`,
      status: "queued",
    });
    await logEvent("campaigns.message_sent", "dispatch", `COF-004:${roasterId}`, {
      ruleCode: "COF-004",
      roasterId,
      channel: "email",
    });
    return;
  }

  // ── P-07 · COF-005: order.created (first order) → halt nurture + conversion ─
  if (eventType === "order.created" && payload.firstOrder === true) {
    const armed = await ruleIsArmed("COF-005");
    const roasterId = Number(payload.roasterId);
    const roaster = await db.query.roasters.findFirst({ where: eq(roasters.id, roasterId) });
    if (!armed || !roaster) return;

    await logEvent("campaigns.rule_triggered", "rule", "COF-005", { ruleCode: "COF-005", roasterId, orderId: payload.orderId });
    await db.update(roasters).set({ nurtureHalted: true }).where(eq(roasters.id, roasterId));
    await recordDispatch({
      ruleCode: "COF-005",
      campaignId: armed.campaign.id,
      roasterId,
      channel: "system",
      subject: "EXECUTE_CAMPAIGN_HALT — nurture sequence",
      body: `First order #${payload.orderNumber} placed by ${roaster.roasterName}. Nurture sequence halted; account enrolled in the onboarding stream.`,
      status: "halted",
    });
    await recordDispatch({
      ruleCode: "COF-005",
      campaignId: armed.campaign.id,
      roasterId,
      channel: "system",
      subject: "Campaign conversion recorded",
      body: `Conversion attributed to the COF nurture sequence. Order #${payload.orderNumber} · total ${(Number(payload.totalCents) / 100).toFixed(2)} USD.`,
      status: "converted",
    });
    await logEvent("campaigns.halted", "campaign", armed.campaign.id, { campaignId: armed.campaign.id, roasterId, reason: "first_order" });
    await logEvent("campaigns.converted", "campaign", armed.campaign.id, {
      campaignId: armed.campaign.id,
      roasterId,
      convertedOrderId: payload.orderId,
    });
    return;
  }
}

/** Recent outbox feed for the dashboard. */
export async function recentEvents(limit = 25) {
  return getDb().select().from(domainEvents).orderBy(desc(domainEvents.id)).limit(limit);
}
