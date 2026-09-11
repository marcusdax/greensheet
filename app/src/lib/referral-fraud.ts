import type { Order, Referral, Roaster } from '../types/api';

export interface FraudInputs {
  referral: Referral;
  referrer: Roaster | undefined;
  referee: Roaster | undefined;
  refereeOrders: Order[];
  allReferrals: Referral[];
  now?: Date;
}

export type ReviewDecision =
  | { action: 'qualify' }
  | { action: 'decline'; reason: string }
  | { action: 'review'; reason: string }
  | { action: 'pause'; reason: string };

export function identityGraphMatch(referral: Referral, referrer: Roaster, referee: Roaster): boolean {
  if (referral.refereeId === referrer.id) return true;
  const checks = [
    referrer.taxId && referee.taxId && referrer.taxId === referee.taxId,
    referrer.billingAddress && referee.billingAddress && referrer.billingAddress === referee.billingAddress,
    referrer.cardFingerprint && referee.cardFingerprint && referrer.cardFingerprint === referee.cardFingerprint,
    referrer.deviceFingerprint && referee.deviceFingerprint && referrer.deviceFingerprint === referee.deviceFingerprint,
    referrer.ipSubnet && referee.ipSubnet && referrer.ipSubnet === referee.ipSubnet,
  ];
  return checks.some(Boolean);
}

const REFERRAL_FLOOR_CENTS = 150_00;
const RETURN_WINDOW_DAYS = 30;

export function qualificationFloorMet(
  _referral: Referral,
  orders: Order[],
  now: Date = new Date(),
): boolean {
  const qualifyingOrder = findFirstOrderDelivered(orders);
  if (!qualifyingOrder) return false;

  if (qualifyingOrder.finalTotalCents < REFERRAL_FLOOR_CENTS) return false;

  // Playbook §4: 30-day return window must have passed before credit posts.
  // Use the order's updatedAt (set on delivery) to determine when it was delivered.
  const deliveredAt = new Date(qualifyingOrder.updatedAt);
  const msInDay = 24 * 60 * 60 * 1000;
  const daysSinceDelivery = (now.getTime() - deliveredAt.getTime()) / msInDay;
  return daysSinceDelivery >= RETURN_WINDOW_DAYS;
}

export function findFirstOrderDelivered(orders: Order[]): Order | undefined {
  return orders
    .filter((o) => o.status === 'delivered')
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0];
}

export function isFirstOrderDelivered(
  referral: Referral,
  orders: Order[],
): boolean {
  // Playbook §2.1: qualification event is the referee's *first* paid order
  // delivered (not returned within 30 days). We only need the delivered
  // first order; the 30-day window is enforced separately by
  // qualificationFloorMet so a single source of truth governs "qualified".
  if (!referral.firstOrderDeliveredAt) {
    const first = findFirstOrderDelivered(orders);
    if (!first) return false;
    return true;
  }
  const first = findFirstOrderDelivered(orders);
  return Boolean(first) && first!.id === referral.refereeOrderId;
}

/**
 * Playbook §4 "Spend-through cap": credits cover max 50% of any order —
 * credits can never fund a full "free" order that gets resold.
 *
 * Returns true when the qualifying order respects the cap, i.e. the
 * first delivered order is not (near-)entirely funded by credits. We
 * approximate "credit-funded" via the order's `creditsAppliedCents`
 * field; when the field is absent (legacy orders) we fall back to
 * qualifying on the floor + 30-day window only, preserving existing
 * behavior.
 */
export function creditCapRespected(order: Order | undefined): boolean {
  if (!order) return true;
  const credits = order.creditsAppliedCents ?? 0;
  if (credits === 0) return true;
  if (order.finalTotalCents <= 0) return true;
  return credits / order.finalTotalCents <= 0.5;
}

/**
 * Playbook §4 velocity limits:
 *   - > 5 claimed referrals/account/month  → manual review before credit posts
 *   - > 10/month                          → auto-pause rewards pending review
 *
 * "Claimed" = the referee has attached to the referral (signed_up stage and
 * beyond), which is when the referral becomes billable.  Referrals that are
 * mid-funnel but already past the invite stage count toward the cap so the
 * referrer can't bypass the limit by stacking pending claims.
 *
 * The window is measured from when the referral was *claimed*
 * (`updatedAt` when present, else `signedUpAt`, else `createdAt`), not from
 * when it was first invited.
 */
export function isClaimed(referral: Referral): boolean {
  return Boolean(referral.refereeId) || referral.status !== 'invited';
}

export function velocityExceeded(
  accountId: string,
  referrals: Referral[],
  windowDays = 30,
  max = 5,
  now: Date = new Date(),
): boolean {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const claimed = referrals.filter(
    (r) =>
      r.referrerId === accountId &&
      isClaimed(r) &&
      new Date(r.updatedAt ?? r.signedUpAt ?? r.createdAt).getTime() >= cutoff.getTime(),
  );
  return claimed.length > max;
}

export function ringDetected(
  referral: Referral,
  allReferrals: Referral[],
  windowDays = 60,
): boolean {
  if (!referral.refereeId) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const mutual = allReferrals.find(
    (r) =>
      r.referrerId === referral.refereeId &&
      r.refereeId === referral.referrerId &&
      r.status !== 'clawed_back' &&
      new Date(r.updatedAt ?? r.createdAt).getTime() >= cutoff.getTime(),
  );
  return Boolean(mutual);
}

const PO_BOX_PATTERN = /p\.?\s*o\.?\s*box/i;

export function isPoBoxAddress(address: string | undefined): boolean {
  if (!address) return false;
  return PO_BOX_PATTERN.test(address);
}

export function resellerScreen(referee: Roaster): boolean {
  if (!referee.businessRegistration || !referee.taxId) {
    return false;
  }
  if (isPoBoxAddress(referee.billingAddress)) {
    return false;
  }
  return true;
}

export function evaluateReferral(inputs: FraudInputs): ReviewDecision {
  const { referral, referrer, referee, refereeOrders, allReferrals } = inputs;

  if (!referrer || !referee) {
    return { action: 'decline', reason: 'Referrer or referee not found.' };
  }

  if (referral.refereeId === referrer.id) {
    return { action: 'decline', reason: 'Self-referral.' };
  }

  if (identityGraphMatch(referral, referrer, referee)) {
    return { action: 'decline', reason: 'Identity graph match detected.' };
  }

  if (ringDetected(referral, allReferrals)) {
    return { action: 'review', reason: 'Mutual referral ring detected.' };
  }

  if (!resellerScreen(referee)) {
    return { action: 'review', reason: 'Referee missing business registration, tax ID, or PO-box-only address.' };
  }

  // Playbook §4 velocity limits:
  //   > 10 claimed/month → auto-pause rewards pending review
  //   > 5  claimed/month → manual review before any credit posts
  // Order matters: check the higher threshold first (strictly greater),
  // because the >10 case is a stricter pause than the >5 review.
  if (velocityExceeded(referrer.id, allReferrals, 30, 10, inputs.now ?? new Date())) {
    return { action: 'pause', reason: 'Velocity auto-pause threshold exceeded (>10 claimed/month).' };
  }

  if (velocityExceeded(referrer.id, allReferrals, 30, 5, inputs.now ?? new Date())) {
    return { action: 'review', reason: 'Velocity threshold reached for manual review (>5 claimed/month).' };
  }

  if (!qualificationFloorMet(referral, refereeOrders)) {
    return { action: 'decline', reason: 'First paid order floor not met.' };
  }

  // Playbook §4: spend-through cap — credits can never fund more than 50% of
  // the qualifying order. A violation routes to review so a human can confirm
  // the order wasn't resold on credit.
  const firstOrder = findFirstOrderDelivered(refereeOrders);
  if (!creditCapRespected(firstOrder)) {
    return { action: 'review', reason: 'Credit spend-through cap exceeded (50%).' };
  }

  return { action: 'qualify' };
}