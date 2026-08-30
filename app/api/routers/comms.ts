// Comms context: outbound email (SMTP) and WhatsApp dispatch adapters.
// - Email: real SMTP send via nodemailer when SMTP_* env is configured;
//   otherwise the dispatch is recorded as "queued" and reported honestly.
// - WhatsApp: deep-link (wa.me) handoff with a pre-filled business message;
//   every send is logged to the dispatch ledger like any other channel.
import { z } from "zod";
import { desc } from "drizzle-orm";
import { createRouter, staffProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { dispatches, roasters, campaigns } from "@db/schema";
import { eq } from "drizzle-orm";
import { emitEvent } from "../engine";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendSmtpEmail(input: { to: string; subject: string; body: string }) {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });
}

/** wa.me deep link — opens WhatsApp with a pre-filled message. */
export function whatsappLink(e164: string, message: string) {
  const digits = e164.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Message templates — COF nurture touches + warehouse tier notifications
// (runbook 7 supplier/buyer notification formats).
export const MESSAGE_TEMPLATES = [
  {
    code: "COF-T1",
    name: "Touch-1 · Origin story (kit delivered)",
    channel: "email",
    body: "Hi {roaster_name} — your kit has landed. Inside: {varietal} ({process_method}) from {origin}, cupping at {sca_cup_score} SCA. Spot price: {price_per_lb}. Reply with your roast-date plans and we'll hold allocation.",
  },
  {
    code: "COF-T2",
    name: "Touch-2 · Pricing sheet (positive feedback)",
    channel: "email",
    body: "Great to hear the kit scored well with your team, {roaster_name}. Pricing sheet for the lots you cupped is attached. Volume tiers unlock at 500 lbs; pricing holds 14 days.",
  },
  {
    code: "COF-T3",
    name: "Touch-3 · Volume discount CTA (pricing click)",
    channel: "whatsapp",
    body: "Hi {roaster_name}, volume tiers just opened on the lot you priced — 5% at 500 lbs, 8% at 1,000 lbs, 12% full pallet. Want me to hold allocation?",
  },
  {
    code: "COF-SMS",
    name: "Consultative SMS (negative feedback)",
    channel: "sms",
    body: "{roaster_name}, sorry the kit missed the mark. Our green buyer would like 15 min to hear what didn't work and source to your profile — can we book a call this week?",
  },
  {
    code: "WHS-T2",
    name: "Tier 2 supplier notification (exception hold)",
    channel: "email",
    body: "Lot {lot_code} has been placed on exception hold: {finding}. Current status: Hard Hold in quarantine. Please submit counter-documentation within 3 business days. Dispositions: Release with Annotation / Downgrade & Re-price / Reject & Claim / Re-verify & Partition.",
  },
  {
    code: "WHS-T3",
    name: "Tier 3 urgent notification (chain compromise)",
    channel: "email",
    body: "URGENT — Lot {lot_code} shows evidence of chain compromise and is on hard hold. Investigation timeline: 10 business days. Failure to provide supporting documentation within 5 business days results in automatic Reject & Claim.",
  },
  {
    code: "WHS-BUYER",
    name: "Buyer sample hold notice",
    channel: "email",
    body: "Hello {roaster_name} — lot {lot_code} that you sampled is under exception review and cannot be published as verified until resolved (est. {eta}). No action needed; we will follow up when status changes.",
  },
] as const;

export const commsRouter = createRouter({
  /** Honest channel capability report for the UI. */
  channelStatus: staffProcedure.query(() => {
    return {
      email: {
        configured: smtpConfigured(),
        mode: smtpConfigured() ? ("live" as const) : ("queued" as const),
        note: smtpConfigured()
          ? `SMTP live via ${process.env.SMTP_HOST}`
          : "SMTP not configured — sends are recorded as queued in the dispatch ledger",
      },
      whatsapp: {
        configured: true,
        mode: "deeplink" as const,
        note: "WhatsApp Business handoff via wa.me deep links with pre-filled templates",
      },
      sms: { configured: false, mode: "queued" as const, note: "SMS adapter not configured" },
    };
  }),

  templates: staffProcedure.query(() => MESSAGE_TEMPLATES),

  sendEmail: staffProcedure
    .input(
      z.object({
        roasterId: z.number().int().positive(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const roaster = await db.query.roasters.findFirst({
        where: eq(roasters.id, input.roasterId),
      });
      if (!roaster) throw new Error("GS-COM-1001 RoasterNotFound");
      const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.code, "cof-nurture-2025") });

      let status: "sent" | "queued" = "queued";
      let note = "SMTP not configured — recorded as queued";
      if (smtpConfigured()) {
        try {
          await sendSmtpEmail({ to: roaster.email, subject: input.subject, body: input.body });
          status = "sent";
          note = `Delivered via SMTP to ${roaster.email}`;
        } catch (e) {
          note = `SMTP error — queued instead: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      await db.insert(dispatches).values({
        ruleCode: "MANUAL",
        campaignId: campaign?.id ?? 1,
        roasterId: input.roasterId,
        channel: "email",
        subject: input.subject,
        body: input.body,
        status,
      });
      await emitEvent("comms.email_dispatched", "roaster", input.roasterId, {
        roasterId: input.roasterId,
        channel: "email",
        status,
      });
      return { status, note };
    }),

  sendWhatsApp: staffProcedure
    .input(
      z.object({
        roasterId: z.number().int().positive(),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const roaster = await db.query.roasters.findFirst({
        where: eq(roasters.id, input.roasterId),
      });
      if (!roaster) throw new Error("GS-COM-1001 RoasterNotFound");
      if (!roaster.whatsappNumber)
        throw new Error("GS-COM-1002 NoWhatsappNumber — add a WhatsApp number on the roaster's CRM record");
      const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.code, "cof-nurture-2025") });
      const link = whatsappLink(roaster.whatsappNumber, input.body);
      await db.insert(dispatches).values({
        ruleCode: "MANUAL",
        campaignId: campaign?.id ?? 1,
        roasterId: input.roasterId,
        channel: "whatsapp",
        subject: "WhatsApp handoff",
        body: `${input.body}\n\n→ ${link}`,
        status: "queued",
      });
      await emitEvent("comms.whatsapp_dispatched", "roaster", input.roasterId, {
        roasterId: input.roasterId,
        channel: "whatsapp",
        status: "queued",
      });
      return { link, status: "queued" as const };
    }),

  ledger: staffProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(dispatches).orderBy(desc(dispatches.id)).limit(150);
    return Promise.all(
      rows.map(async (d) => {
        const r = await db.query.roasters.findFirst({ where: eq(roasters.id, d.roasterId) });
        return { ...d, roasterName: r?.roasterName ?? "—" };
      }),
    );
  }),
});
