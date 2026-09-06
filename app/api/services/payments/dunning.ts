// Automated dunning — §3.4.
//
// The ladder the plan specifies:
//   Day 0   invoice sent with a payment link
//   Day 3   friendly reminder via Zalo/email with a FRESH QR
//   Day 7   escalation to a phone-call task
//   Day 14  offer an installment plan
//
// Three properties make this safe to run unattended:
//
//   1. Idempotent. `dunning_runs` is unique on (invoiceId, stepId), so the
//      sweep can run twice in a day, or be replayed after a crash, without
//      chasing a customer twice for the same step.
//   2. Aging-aware. It reads the same ICT day boundary the aging buckets use,
//      so a customer is never chased for an invoice that is not yet overdue in
//      their own timezone.
//   3. Self-cancelling. An invoice that gets paid stops receiving steps
//      immediately, because eligibility is recomputed from live outstanding.
//
// "Fresh QR" is load-bearing. Attaching the original QR to a day-3 reminder is
// worse than attaching none: if the customer part-paid, that QR carries the
// original amount and invites a duplicate.
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  counterparties,
  dunningRuns,
  dunningSteps,
  invoices,
} from "@db/schema";
import { writeEvent } from "../../engine";
import { formatMinor, minorFromDb } from "@contracts/money";
import { daysOverdue, ictToday } from "./aging";

export const DEFAULT_POLICY = "default";

/**
 * The default ladder, as data (§3.4). It lives here rather than in the seed
 * script so it can be asserted against `tokensFor` in a test — a template
 * carrying a merge tag nobody populates renders that tag into a customer's
 * inbox, and nothing else would catch it.
 *
 * The escalation is deliberate: two polite reminders, then a human, then an
 * installment offer. Nothing in it threatens anyone — a café fourteen days late
 * on a coffee order is usually having a bad month, not refusing to pay.
 */
export const DEFAULT_LADDER = [
  {
    offsetDays: 0,
    channel: "email" as const,
    action: "send_reminder" as const,
    subjectTemplate: "Invoice {invoice_number} is due today",
    bodyTemplate: [
      "Xin chào {counterparty_name},",
      "",
      "Invoice {invoice_number} for {outstanding} is due today ({due_date}).",
      "You can pay by scanning the QR code below, or by transfer quoting {memo_token}.",
      "",
      "Thank you,",
      "Auctum Ledger",
    ].join("\n"),
    includeFreshQr: true,
  },
  {
    offsetDays: 3,
    channel: "zalo" as const,
    action: "send_reminder" as const,
    subjectTemplate: "Invoice {invoice_number} — {days_overdue} days",
    bodyTemplate: [
      "Xin chào {counterparty_name}, invoice {invoice_number} ({outstanding})",
      "is {days_overdue} days past due. Reference: {memo_token}.",
      "Reply here if anything about it looks wrong.",
    ].join("\n"),
    includeFreshQr: true,
  },
  {
    offsetDays: 7,
    channel: "phone_task" as const,
    action: "create_call_task" as const,
    subjectTemplate: "Call {counterparty_name} — {invoice_number} {days_overdue} days overdue",
    bodyTemplate: [
      "Outstanding: {outstanding} on {invoice_number}, due {due_date}.",
      "",
      "This is a task for a person, not a message to a customer. Ask what",
      "changed before asking when they will pay: a week late on a standing",
      "order usually means a cash-flow problem we can work with.",
    ].join("\n"),
    includeFreshQr: false,
  },
  {
    offsetDays: 14,
    channel: "email" as const,
    action: "offer_installment" as const,
    subjectTemplate: "Invoice {invoice_number} — a payment plan",
    bodyTemplate: [
      "Xin chào {counterparty_name},",
      "",
      "Invoice {invoice_number} is {days_overdue} days past due with",
      "{outstanding} outstanding. If paying it in one go is difficult right",
      "now, reply and we will split it across the next three deliveries.",
      "",
      "Reference: {memo_token}.",
    ].join("\n"),
    includeFreshQr: true,
  },
];


/** Statuses that still owe money and can therefore be chased. */
const CHASEABLE = ["issued", "partially_paid"] as const;

export type DunningCandidate = {
  invoiceId: number;
  invoiceNumber: string;
  counterpartyId: number;
  counterpartyName: string;
  currency: string;
  outstandingMinor: bigint;
  dueAt: string;
  daysOverdue: number;
  memoToken: string;
};

export type PlannedStep = {
  candidate: DunningCandidate;
  stepId: number;
  offsetDays: number;
  channel: string;
  action: string;
  subject: string;
  body: string;
  includeFreshQr: boolean;
};

/**
 * Which steps a given invoice is due for, as a pure function of its age.
 *
 * A step fires once its offset is reached and keeps being "due" afterwards —
 * so an invoice discovered late still receives the ladder in order rather than
 * skipping the steps it slept through. `alreadySent` is what stops repeats.
 */
export function stepsDueFor(
  daysPastDue: number,
  steps: { id: number; offsetDays: number }[],
  alreadySent: Set<number>
): number[] {
  return steps
    .filter(s => daysPastDue >= s.offsetDays && !alreadySent.has(s.id))
    .sort((a, b) => a.offsetDays - b.offsetDays)
    .map(s => s.id);
}

/** Merge-tag rendering, same convention as the campaign engine. */
export function renderTemplate(
  template: string,
  tokens: Record<string, string>
): string {
  return Object.entries(tokens).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
    template
  );
}

export function tokensFor(candidate: DunningCandidate): Record<string, string> {
  return {
    counterparty_name: candidate.counterpartyName,
    invoice_number: candidate.invoiceNumber,
    // Money is never rendered without its currency, in a dunning email least
    // of all — "you owe 5,000,000" is a different demand in VND and USD.
    outstanding: formatMinor(candidate.outstandingMinor, candidate.currency),
    currency: candidate.currency,
    due_date: candidate.dueAt,
    days_overdue: String(candidate.daysOverdue),
    memo_token: candidate.memoToken,
  };
}

/** Open invoices past due, with everything a template needs. */
export async function dunningCandidates(
  asOf: string = ictToday()
): Promise<DunningCandidate[]> {
  const rows = await getDb()
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      counterpartyId: invoices.counterpartyId,
      counterpartyName: counterparties.name,
      currency: invoices.currency,
      totalMinor: invoices.totalMinor,
      paidMinor: invoices.paidMinor,
      dueAt: invoices.dueAt,
      memoToken: invoices.memoToken,
    })
    .from(invoices)
    .leftJoin(counterparties, eq(counterparties.id, invoices.counterpartyId))
    .where(and(inArray(invoices.status, [...CHASEABLE]), isNull(invoices.deletedAt)));

  return rows
    .map(r => {
      const outstandingMinor = minorFromDb(r.totalMinor) - minorFromDb(r.paidMinor);
      return {
        invoiceId: r.invoiceId,
        invoiceNumber: r.invoiceNumber,
        counterpartyId: r.counterpartyId,
        counterpartyName: r.counterpartyName ?? `Counterparty ${r.counterpartyId}`,
        currency: r.currency,
        outstandingMinor,
        dueAt: String(r.dueAt),
        daysOverdue: daysOverdue(String(r.dueAt), asOf),
        memoToken: r.memoToken,
      };
    })
    // Paid in full between the query and now, or simply not yet due.
    .filter(c => c.outstandingMinor > 0n);
}

/**
 * Plan the sweep without sending anything.
 *
 * Planning and sending are separate so an operator can see exactly who would be
 * contacted before the ladder is switched on — which is the difference between
 * a feature you can trust with your customer relationships and one you cannot.
 */
export async function planDunning(
  opts: { asOf?: string; policyCode?: string } = {}
): Promise<PlannedStep[]> {
  const db = getDb();
  const asOf = opts.asOf ?? ictToday();
  const policyCode = opts.policyCode ?? DEFAULT_POLICY;

  const steps = await db
    .select()
    .from(dunningSteps)
    .where(and(eq(dunningSteps.policyCode, policyCode), eq(dunningSteps.active, true)));
  if (steps.length === 0) return [];

  const candidates = await dunningCandidates(asOf);
  if (candidates.length === 0) return [];

  const sent = await db
    .select({ invoiceId: dunningRuns.invoiceId, stepId: dunningRuns.stepId })
    .from(dunningRuns)
    .where(
      inArray(
        dunningRuns.invoiceId,
        candidates.map(c => c.invoiceId)
      )
    );
  const sentByInvoice = new Map<number, Set<number>>();
  for (const row of sent) {
    const set = sentByInvoice.get(row.invoiceId) ?? new Set<number>();
    set.add(row.stepId);
    sentByInvoice.set(row.invoiceId, set);
  }

  const stepById = new Map(steps.map(s => [s.id, s]));
  const planned: PlannedStep[] = [];

  for (const candidate of candidates) {
    const dueStepIds = stepsDueFor(
      candidate.daysOverdue,
      steps.map(s => ({ id: s.id, offsetDays: s.offsetDays })),
      sentByInvoice.get(candidate.invoiceId) ?? new Set()
    );
    const tokens = tokensFor(candidate);
    for (const stepId of dueStepIds) {
      const step = stepById.get(stepId)!;
      planned.push({
        candidate,
        stepId,
        offsetDays: step.offsetDays,
        channel: step.channel,
        action: step.action,
        subject: renderTemplate(step.subjectTemplate, tokens),
        body: renderTemplate(step.bodyTemplate, tokens),
        includeFreshQr: step.includeFreshQr,
      });
    }
  }
  return planned;
}

export type DunningOutcome = {
  planned: number;
  recorded: number;
  duplicates: number;
};

/**
 * Execute the sweep.
 *
 * Delivery itself is deliberately not done here: this records the intent and
 * emits an event, and the comms layer owns actually sending. That keeps the
 * ladder honest — a row in `dunning_runs` means "we decided to contact them",
 * and `sentAt` means "it went out", which are different facts.
 */
export async function runDunning(
  opts: { asOf?: string; policyCode?: string; dryRun?: boolean } = {}
): Promise<DunningOutcome> {
  const planned = await planDunning(opts);
  const outcome: DunningOutcome = { planned: planned.length, recorded: 0, duplicates: 0 };
  if (opts.dryRun) return outcome;

  const db = getDb();
  for (const step of planned) {
    try {
      const [res] = await db.insert(dunningRuns).values({
        invoiceId: step.candidate.invoiceId,
        stepId: step.stepId,
        counterpartyId: step.candidate.counterpartyId,
        channel: step.channel as "email" | "zalo" | "sms" | "phone_task" | "in_app",
        status: step.channel === "phone_task" ? "queued" : "sent",
        subject: step.subject.slice(0, 255),
        body: step.body,
        outstandingMinorAtSend: step.candidate.outstandingMinor,
        currency: step.candidate.currency,
        sentAt: step.channel === "phone_task" ? null : new Date(),
      });
      outcome.recorded++;

      await writeEvent(db, "dunning.step_fired", "invoice", step.candidate.invoiceId, {
        invoiceId: step.candidate.invoiceId,
        dunningRunId: Number(res.insertId),
        stepId: step.stepId,
        offsetDays: step.offsetDays,
        channel: step.channel,
        action: step.action,
        counterpartyId: step.candidate.counterpartyId,
        outstandingMinor: step.candidate.outstandingMinor.toString(),
        currency: step.candidate.currency,
        includeFreshQr: step.includeFreshQr,
      });
    } catch (err) {
      // The unique index did its job: this step was already delivered.
      const e = err as { code?: string; errno?: number; message?: string };
      const duplicate =
        e?.code === "ER_DUP_ENTRY" ||
        e?.errno === 1062 ||
        (typeof e?.message === "string" && /duplicate entry/i.test(e.message));
      if (!duplicate) throw err;
      outcome.duplicates++;
    }
  }
  return outcome;
}

/**
 * Which channels actually get people to pay (§3.4).
 *
 * `paidWithin` counts runs where the invoice was settled after the step went
 * out — the only outcome that matters. Opens and clicks are proxies and are
 * reported alongside rather than instead.
 */
export type ChannelEffectiveness = {
  channel: string;
  sent: number;
  opened: number;
  clicked: number;
  paidAfter: number;
  /** paidAfter / sent, rounded to 3dp. Null when nothing has been sent. */
  conversionRate: number | null;
};

export async function channelEffectiveness(): Promise<ChannelEffectiveness[]> {
  const rows = await getDb()
    .select({
      channel: dunningRuns.channel,
      openedAt: dunningRuns.openedAt,
      clickedAt: dunningRuns.clickedAt,
      paidAfterAt: dunningRuns.paidAfterAt,
      status: dunningRuns.status,
    })
    .from(dunningRuns);

  const byChannel = new Map<string, ChannelEffectiveness>();
  for (const row of rows) {
    const entry =
      byChannel.get(row.channel) ??
      { channel: row.channel, sent: 0, opened: 0, clicked: 0, paidAfter: 0, conversionRate: null };
    if (row.status === "sent") entry.sent++;
    if (row.openedAt) entry.opened++;
    if (row.clickedAt) entry.clicked++;
    if (row.paidAfterAt) entry.paidAfter++;
    byChannel.set(row.channel, entry);
  }

  return [...byChannel.values()].map(e => ({
    ...e,
    conversionRate: e.sent === 0 ? null : Math.round((e.paidAfter / e.sent) * 1000) / 1000,
  }));
}

/**
 * Stamp `paidAfterAt` on the steps that preceded a settlement.
 *
 * Called from the outbox when an invoice settles, which is what turns the
 * ladder from a send-and-forget mailer into something whose effectiveness can
 * actually be measured.
 */
export async function markPaidAfter(invoiceId: number, when = new Date()): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: dunningRuns.id })
    .from(dunningRuns)
    .where(and(eq(dunningRuns.invoiceId, invoiceId), isNull(dunningRuns.paidAfterAt)));
  if (rows.length === 0) return 0;

  await db
    .update(dunningRuns)
    .set({ paidAfterAt: when })
    .where(
      and(
        eq(dunningRuns.invoiceId, invoiceId),
        isNull(dunningRuns.paidAfterAt),
        lte(dunningRuns.createdAt, when)
      )
    );
  return rows.length;
}
