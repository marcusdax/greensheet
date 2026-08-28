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
