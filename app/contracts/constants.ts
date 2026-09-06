// Shared constants across frontend ↔ backend (canonical conventions from the Greensheet specs).

export const KIT_STATUSES = [
  "requested",
  "assembling",
  "shipped",
  "delivered",
  "exception",
  "feedback_received",
  "feedback_stale",
] as const;
export type KitStatus = (typeof KIT_STATUSES)[number];

// Allowed forward transitions of the SampleKit state machine.
export const KIT_TRANSITIONS: Record<KitStatus, KitStatus[]> = {
  requested: ["assembling", "exception"],
  assembling: ["shipped", "exception"],
  shipped: ["delivered", "exception"],
  delivered: ["feedback_received", "feedback_stale"],
  exception: ["requested"],
  feedback_received: [],
  feedback_stale: [],
};

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const LIFECYCLE_STAGES = [
  "trial",
  "active",
  "dormant",
  "needs_attention",
  "churned",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const CHURN_HAZARD_THRESHOLD = 0.7; // hazard threshold per growth specs
export const BLENDED_CAC_CENTS = 37800; // blended CAC $378 (cap $500)
export const MAX_ACTIVE_KITS_PER_ROASTER = 2;
export const FLAT_SHIPPING_CENTS = 2500;

// Canonical COF rule metadata (mirrors automation_rules seed rows).
export const COF_RULES = [
  {
    ruleCode: "COF-001",
    triggerEvent: "sample_kit.delivered",
    condition: "days_since_delivery = 4",
    action: "SEND_EMAIL",
    description: "Touch-1 — origin story + cupping notes",
  },
  {
    ruleCode: "COF-002",
    triggerEvent: "feedback.submitted",
    condition: "feedback.rating >= 4",
    action: "SEND_EMAIL",
    description: "Touch-2 — pricing sheet with {sca_cup_score} token",
  },
  {
    ruleCode: "COF-003",
    triggerEvent: "feedback.submitted",
    condition: "feedback.rating <= 2",
    action: "UPDATE_CRM_LIFECYCLE",
    description: "Lifecycle → needs_attention + consultative SMS",
  },
  {
    ruleCode: "COF-004",
    triggerEvent: "campaigns.link_clicked",
    condition: "clicked.pricing_page = true",
    action: "SEND_EMAIL",
    description: "Touch-3 — volume discount CTA",
  },
  {
    ruleCode: "COF-005",
    triggerEvent: "order.created",
    condition: "first_order = true",
    action: "EXECUTE_CAMPAIGN_HALT",
    description: "Halt nurture + enroll in onboarding stream",
  },
] as const;

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCentsPerLb(cents: number): string {
  return `${formatCents(cents)}/lb`;
}

// ─── Warehouse exceptions (runbooks: seal / weight / moisture / quality) ─────
export const EXCEPTION_TYPES = [
  "seal_compromise",
  "weight_moisture_variance",
  "quality_anomaly",
  "partial_compromise",
  "equipment_failure",
  "customs_inspection",
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export const EXCEPTION_STATUSES = [
  "open",
  "hard_hold",
  "quarantine",
  "investigating",
  "resolved",
  "closed",
] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const DISPOSITIONS = [
  "release",
  "downgrade",
  "reject_claim",
  "reverify_partition",
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

// Runbook SLAs in hours (Tier 1: 48h, Tier 2: 5 business days, Tier 3: 10 business days)
export const TIER_SLA_HOURS: Record<number, number> = { 1: 48, 2: 120, 3: 240 };

// Receiving tolerances (Runbook 1 & 2)
export const WEIGHT_VARIANCE_TOLERANCE = 0.015; // ±1.5%
export const MOISTURE_MIN = 11.0;
export const MOISTURE_MAX = 12.5;

// ─── Cupping SOP tolerance bands (points vs. reference sample) ───────────────
export const CUPPING_TOLERANCE: Record<number, number> = { 1: 2.0, 2: 1.5, 3: 1.0 };
export const SCA_ATTRIBUTES = [
  "fragrance",
  "flavor",
  "aftertaste",
  "acidity",
  "body",
  "balance",
  "uniformity",
  "cleanliness",
  "sweetness",
  "overall",
] as const;
export type ScaAttribute = (typeof SCA_ATTRIBUTES)[number];

// Automatic Tier-3 red flags during cupping (SOP Section 5.2)
export const CUPPING_RED_FLAGS = [
  "musty_moldy",
  "sour_vinegary",
  "phenolic_medicinal",
  "visible_mold",
  "gray_blue_discoloration",
  "insect_damage_over_2pct",
  "rancid_stale",
] as const;

// ─── Revenue Share White-Glove Agreement (Exhibit B schedule) ────────────────
export const QUALITY_TIERS = [
  { name: "Premium Specialty", min: 86, max: 100, sharePct: 50 },
  { name: "Specialty", min: 80, max: 85.99, sharePct: 35 },
  { name: "Quality Grade", min: 75, max: 79.99, sharePct: 20 },
  { name: "Commercial", min: 70, max: 74.99, sharePct: 10 },
  { name: "Below Commercial", min: 0, max: 69.99, sharePct: 0 },
] as const;

/**
 * Cup score is a financial input: it sets the Revenue Share tier (B4). The
 * column is `double`, which cannot represent 82.75 or 85.995 exactly, so every
 * tier comparison rounds to 2dp first — write it once, use it everywhere.
 */
export const roundScore = (s: number) => Math.round(s * 100) / 100;

/**
 * Tier lookup by lower bound only, so the function is monotonic by construction
 * and has no gap between one tier's `max` and the next tier's `min`. Scoring
 * 85.995 rounds to 86.00 and pays 50%, not the 0% the old range test returned.
 */
export function qualityTierForScore(score: number) {
  const s = roundScore(score);
  return QUALITY_TIERS.find((t) => s >= t.min) ?? QUALITY_TIERS[QUALITY_TIERS.length - 1];
}

// ─── Units — the catalog trades in pounds, the warehouse in grams (§3.4) ─────
// One rounding rule (half-up to the nearest gram), one place, never at a call site.
export const GRAMS_PER_LB = 453.59237;

export function lbsToGrams(lbs: number): number {
  return Math.round(lbs * GRAMS_PER_LB);
}

export function gramsToLbs(grams: number): number {
  return grams / GRAMS_PER_LB;
}

// Floor Payment SLA in business days by partner tier (Section 10.1)
export const PARTNER_TIER_SLA_DAYS: Record<string, number> = {
  tier_a: 3,
  tier_b: 5,
  tier_c: 7,
};
export const COLLECTOR_MIN_PASS_THROUGH_PCT = 80; // Section 5.4 — ≥80% to farmers

// ─── Comms channels ──────────────────────────────────────────────────────────
export const DISPATCH_CHANNELS = ["email", "sms", "whatsapp", "crm", "system"] as const;
export type DispatchChannel = (typeof DISPATCH_CHANNELS)[number];

// ─── Marketing pillars (social series) ───────────────────────────────────────
export const MARKETING_PILLARS = [
  { code: "POS-01", name: "Value Before Tasting", color: "#7B8E7F" },
  { code: "POS-02", name: "Price Is Signal, Not Verdict", color: "#8C2F22" },
  { code: "POS-03", name: "Coffee Is Infrastructure", color: "#5B6A5F" },
  { code: "POS-04", name: "Reinvest, Not Extract", color: "#B0642F" },
] as const;

export const TEASER_PRODUCTS = ["foundry", "lotspace"] as const;
export type TeaserProduct = (typeof TEASER_PRODUCTS)[number];

// ─── Identity & access (engineering/07 RBAC matrix) ──────────────────────────
export const USER_ROLES = [
  "platform_admin",
  "ops_manager",
  "sales_csm",
  "analyst",
  "roaster_buyer",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: "Platform Admin",
  ops_manager: "Ops Manager",
  sales_csm: "Sales / CSM",
  analyst: "Analyst",
  roaster_buyer: "Roaster Buyer",
};

// Money primitives live in their own module for size, but §9 names constants.ts
// as the single import site for money/units/score — re-export so callers have one.
export * from "./money";
