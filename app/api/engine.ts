// Domain event engine: transactional outbox + COF-001…005 rule evaluation.
// Every aggregate mutation emits exactly one primary domain event; policies
// (reactive rules) are evaluated synchronously after the event is logged.
import { eq, desc } from "drizzle-orm";
import { getDb } from "./queries/connection";
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

/** Write to the outbox, then fire reactive policies. */
export async function emitEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string | number,
  payload: Payload,
): Promise<void> {
  const db = getDb();
  await db.insert(domainEvents).values({
    eventType,
    aggregateType,
    aggregateId: String(aggregateId),
    payload: JSON.stringify(payload),
  });
  await evaluateRules(eventType, payload);
}

async function logEvent(eventType: string, aggregateType: string, aggregateId: string | number, payload: Payload) {
  await getDb().insert(domainEvents).values({
    eventType,
    aggregateType,
    aggregateId: String(aggregateId),
    payload: JSON.stringify(payload),
  });
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
  channel: "email" | "sms" | "crm" | "system";
  subject: string;
  body: string;
  status: "sent" | "halted" | "lifecycle_updated" | "converted";
}) {
  await getDb().insert(dispatches).values(input);
}

/** Policy engine: whenever E, then C (policy matrix P-04…P-07). */
async function evaluateRules(eventType: string, payload: Payload): Promise<void> {
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
