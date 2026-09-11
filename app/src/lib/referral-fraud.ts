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

// --- Helpers ---

/** Return the chronologically earliest delivered order, or undefined. */
function findFirstOrderDelivered(orders: Order[]): Order | undefined {
  const delivered = orders.filter((o) => o.status === 'delivered');
  if (!delivered.length) return undefined;
  return delivered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
}

/** Check whether the referee's *first* delivered order meets the qualification floor. */
export function isFirstOrderDelivered(referral: Referral, orders: Order[]): boolean {
  const first = findFirstOrderDelivered(orders);
  if (!first) return false;
  // The qualifying order must be the referee's first delivered order,
  // and it must be at least $150 (cents).
  return first.finalTotalCents >= 150_00;
}

/** Ensure 30 days have elapsed since the qualifying order was delivered. */
export function hasReturnWindowPassed(qualifyingOrder: Order, now?: Date): boolean {
  const date = now ?? new Date();
  const deliveryDate = new Date(qualifyingOrder.updatedAt ?? qualifyingOrder.createdAt);
  const diffDays = (date.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 30;
}

/** Spend-through cap: credits must not exceed 50% of the order total. */
export function creditCapRespected(order: Order, creditsAppliedCents?: number): boolean {
  if (creditsAppliedCents === undefined) return true; // legacy orders, no cap enforced
  const ratio = creditsAppliedCents / order.finalTotalCents;
  return ratio <= 0.5; // 50% cap
}

// --- identityGraphMatch: unchanged, kept for backward compatibility ---

/** Normalize IPv4 /24 subnet values so two addresses in the same /24 network match. */
function normalizeSubnet(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.replace(/\/24$/, '').trim();
}

export function identityGraphMatch(referral: Referral, referrer: Roaster, referee: Roaster): boolean {
  // Self-referral handled by caller (evaluateReferral); do not count here.
  if (referral.refereeId === referrer.id) return false;

  // Check for identity graph match: same tax_id, billing_address, or /24 ipSubnet
  const checks = [
    referrer.taxId && referee.taxId && referrer.taxId === referee.taxId,
    referrer.billingAddress && referee.billingAddress && referrer.billingAddress === referee.billingAddress,
    referrer.cardFingerprint && referee.cardFingerprint && referrer.cardFingerprint === referee.cardFingerprint,
    referrer.deviceFingerprint && referee.deviceFingerprint && referrer.deviceFingerprint === referee.deviceFingerprint,
    referrer.ipSubnet && referee.ipSubnet && normalizeSubnet(referrer.ipSubnet) === normalizeSubnet(referee.ipSubnet),
  ];
  return checks.some(Boolean);
}

/** Check whether a referral is "claimed" (i.e., has progressed beyond invited). */
export function isClaimed(referral: Referral): boolean {
  return Boolean(referral.refereeId) || referral.status !== 'invited';
}

/** velocityExceeded: now counts *claimed* referrals and uses updatedAt for windowing. */
export function velocityExceeded(
  accountId: string,
  referrals: Referral[],
  windowDays = 30,
  max = 5,
  now?: Date,
): boolean {
  const cutoff = now ?? new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const claimed = referrals.filter(
    (r) =>
      r.referrerId === accountId &&
      isClaimed(r) &&
      new Date(r.updatedAt ?? r.createdAt).getTime() >= cutoff.getTime(),
  );
  return claimed.length > max;
}

/** ringDetected: updatedAt-aware date comparison. */
export function ringDetected(
  referral: Referral,
  allReferrals: Referral[],
  windowDays = 60,
  now?: Date,
): boolean {
  if (!referral.refereeId) return false;
  const cutoff = now ?? new Date();
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

/** isPoBoxAddress: regex-match common PO-box patterns in billing address. */
export function isPoBoxAddress(address: string): boolean {
  const poBoxPattern = /\b(p\.?\s*o\.?\s*box|po box)\b/i;
  return poBoxPattern.test(address);
}

/** resellerScreen: now also flags PO-box-only addresses to manual review. */
export function resellerScreen(referee: Roaster): boolean {
  // Passed businessRegistration and taxId, and not a PO-box-only address
  const hasDocs = Boolean(referee.businessRegistration && referee.taxId);
  const isPOBoxOnly = referee.billingAddress && isPoBoxAddress(referee.billingAddress) && !referee.billingAddress.replace(/\b(p\.?\s*o\.?\s*box|po box)\b/i, '').trim();
  return hasDocs && !isPOBoxOnly;
}

/** evaluateReferral: wired spend-through cap, first-order + 30-day window, and review-status handling. */
export function evaluateReferral(inputs: FraudInputs): ReviewDecision {
  const { referral, referrer, referee, refereeOrders, allReferrals } = inputs;

  if (!referrer || !referee) {
    return { action: 'decline', reason: 'Referrer or referee not found.' };
  }

  if (referral.refereeId === referrer.id) {
    return { action: 'decline', reason: 'Self-referral.' };
  }

  if (!resellerScreen(referee)) {
    return { action: 'review', reason: 'Referee missing business registration or tax ID.' };
  }

  if (identityGraphMatch(referral, referrer, referee)) {
    return { action: 'decline', reason: 'Identity graph match detected.' };
  }

  // --- First-order qualification with 30-day return window ---
  if (!isFirstOrderDelivered(referral, refereeOrders)) {
    return { action: 'decline', reason: 'First paid order floor not met.' };
  }

  // Find the first delivered order to check the 30-day hold.
  const firstDelivered = findFirstOrderDelivered(refereeOrders);
  if (firstDelivered && !hasReturnWindowPassed(firstDelivered, inputs.now)) {
    return { action: 'review', reason: 'Return window not yet closed (30 days from delivery).' };
  }

  // --- Spend-through cap: the fixed $150 referrer credit must not exceed 50% of the order total ---
  const qualifiedOrder = firstDelivered!;
  if (!creditCapRespected(qualifiedOrder, 150_00)) {
    return {
      action: 'decline',
      reason: 'Referrer credit spend-through cap exceeded (50% of order total).',
    };
  }

  // --- Ring detection ---
  if (ringDetected(referral, allReferrals, 60, inputs.now)) {
    return { action: 'review', reason: 'Mutual referral ring detected.' };
  }

  // --- Velocity limits ---
  // >10 claimed referrals/month → pause
  if (velocityExceeded(referrer.id, allReferrals, 30, 10, inputs.now)) {
    return { action: 'pause', reason: 'Velocity limit exceeded; rewards paused pending review.' };
  }

  // >5 claimed referrals/month → review
  if (velocityExceeded(referrer.id, allReferrals, 30, 5, inputs.now)) {
    return { action: 'review', reason: 'Velocity threshold reached for manual review.' };
  }

  return { action: 'qualify' };
}