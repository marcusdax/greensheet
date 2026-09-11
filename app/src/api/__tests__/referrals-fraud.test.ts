import { describe, it, expect } from 'vitest';
import {
  identityGraphMatch,
  qualificationFloorMet,
  velocityExceeded,
  isClaimed,
  resellerScreen,
  isPoBoxAddress,
  findFirstOrderDelivered,
  isFirstOrderDelivered,
  creditCapRespected,
  evaluateReferral,
} from '../../lib/referral-fraud';
import type { Order, Referral, Roaster } from '../../types/api';

const referrer: Roaster = {
  id: 'r_001',
  roasterName: 'Blue Bottle',
  segment: 'commercial',
  status: 'active',
  churnRiskScore: null,
  ltvCents: null,
  cacCents: null,
  paybackMonths: null,
  daysSinceLastOrder: null,
  totalRevenueCents: null,
  totalOrders: null,
  businessRegistration: 'BR-001',
  taxId: 'TAX-001',
  billingAddress: '123 Roastery Way',
  cardFingerprint: 'fp_card_001',
  deviceFingerprint: 'fp_device_001',
  ipSubnet: '192.168.1.0/24',
  lastActivityAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  primaryContact: { fullName: 'A', email: 'a@example.com', marketingOptIn: true },
  interventions: [],
};

const referee: Roaster = {
  id: 'r_003',
  roasterName: 'Counter Culture',
  segment: 'boutique',
  status: 'active',
  churnRiskScore: null,
  ltvCents: null,
  cacCents: null,
  paybackMonths: null,
  daysSinceLastOrder: null,
  totalRevenueCents: null,
  totalOrders: null,
  businessRegistration: 'BR-003',
  taxId: 'TAX-003',
  billingAddress: '456 Bean Blvd',
  cardFingerprint: 'fp_card_003',
  deviceFingerprint: 'fp_device_003',
  ipSubnet: '10.0.0.0/24',
  lastActivityAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  primaryContact: { fullName: 'B', email: 'b@example.com', marketingOptIn: true },
  interventions: [],
};

describe('referral fraud helpers', () => {
  it('detects identity graph match on shared billing address', () => {
    const sameAddress = { ...referee, billingAddress: referrer.billingAddress };
    expect(identityGraphMatch({} as Referral, referrer, sameAddress)).toBe(true);
  });

  it('declines self-referral', () => {
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_001' } as Referral,
      referrer,
      referee: referrer,
      refereeOrders: [],
      allReferrals: [],
    });
    expect(decision.action).toBe('decline');
  });

  it('declines when qualification floor not met', () => {
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee,
      refereeOrders: [],
      allReferrals: [],
    });
    expect(decision.action).toBe('decline');
  });

  it('qualifies when all checks pass', () => {
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee,
      refereeOrders: [order],
      allReferrals: [],
    });
    expect(decision.action).toBe('qualify');
  });

  it('reviews missing reseller docs', () => {
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee: { ...referee, businessRegistration: undefined },
      refereeOrders: [order],
      allReferrals: [],
    });
    expect(decision.action).toBe('review');
  });

  it('detects PO-box-only addresses', () => {
    expect(isPoBoxAddress('PO Box 123')).toBe(true);
    expect(isPoBoxAddress('P.O. Box 456')).toBe(true);
    expect(isPoBoxAddress('Box 789')).toBe(false);
    expect(isPoBoxAddress('123 Roastery Way')).toBe(false);
    expect(isPoBoxAddress(undefined)).toBe(false);
  });

  it('flags PO-box-only billing address as reseller screen failure', () => {
    expect(resellerScreen({ ...referee, billingAddress: 'PO Box 123' })).toBe(false);
    expect(resellerScreen({ ...referee, billingAddress: 'P.O. Box 456' })).toBe(false);
    expect(resellerScreen(referee)).toBe(true);
  });

  it('reviews referral when referee has PO-box-only address', () => {
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee: { ...referee, billingAddress: 'PO Box 999' },
      refereeOrders: [order],
      allReferrals: [],
    });
    expect(decision.action).toBe('review');
  });

  it('qualification floor fails when order delivered less than 30 days ago', () => {
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(qualificationFloorMet({} as Referral, [order])).toBe(false);
  });

  it('qualification floor passes when order delivered 31+ days ago', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: thirtyOneDaysAgo,
      updatedAt: thirtyOneDaysAgo,
    };
    expect(qualificationFloorMet({} as Referral, [order])).toBe(true);
  });

  it('qualification floor fails for returned orders', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'returned',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: thirtyOneDaysAgo,
      updatedAt: thirtyOneDaysAgo,
    };
    expect(qualificationFloorMet({} as Referral, [order])).toBe(false);
  });

  it('qualification floor fails when no delivered order exists', () => {
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'processing',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    expect(qualificationFloorMet({} as Referral, [order])).toBe(false);
  });

  it('qualification floor fails when first order is below $150', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 149_99,
      createdAt: thirtyOneDaysAgo,
      updatedAt: thirtyOneDaysAgo,
    };
    expect(qualificationFloorMet({} as Referral, [order])).toBe(false);
  });

  it('isFirstOrderDelivered picks the earliest delivered order', () => {
    const first: Order = {
      id: 'o_first',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const second: Order = {
      id: 'o_second',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 300_00,
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
    };
    expect(isFirstOrderDelivered({} as Referral, [second, first])).toBe(true);
    expect(findFirstOrderDelivered([second, first])?.id).toBe('o_first');
  });

  it('creditCapRespected returns false when credits exceed 50% of order total', () => {
    const overCap: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 200_00,
      creditsAppliedCents: 101_00, // 50.5%
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    expect(creditCapRespected(overCap)).toBe(false);
  });

  it('creditCapRespected returns true when credits equal 50% of order total', () => {
    const atCap: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 200_00,
      creditsAppliedCents: 100_00, // exactly 50%
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    expect(creditCapRespected(atCap)).toBe(true);
  });

  it('creditCapRespected returns true when no credits applied', () => {
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    expect(creditCapRespected(order)).toBe(true);
  });

  it('reviews referral when credit spend-through cap is exceeded', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const order: Order = {
      id: 'o_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 200_00,
      creditsAppliedCents: 150_00, // 75% — over the 50% cap
      createdAt: thirtyOneDaysAgo,
      updatedAt: thirtyOneDaysAgo,
    };
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee,
      refereeOrders: [order],
      allReferrals: [],
    });
    expect(decision.action).toBe('review');
  });

  describe('velocity and review queue handling', () => {
    const baseReferral = (id: string, createdAt: string): Referral => ({
      id,
      referrerId: 'r_001',
      refereeId: 'referee_' + id,
      refCode: 'AL-RVR-001',
      status: 'qualified',
      channel: 'invite_link',
      createdAt,
      updatedAt: createdAt,
    });

    const now = new Date('2025-07-20T00:00:00.000Z');

    it('isClaimed returns true for referrals with a refereeId', () => {
      expect(isClaimed({ refereeId: 'r_003' } as Referral)).toBe(true);
      expect(isClaimed({ refereeId: undefined, status: 'invited' } as Referral)).toBe(false);
      expect(isClaimed({ refereeId: undefined, status: 'clicked' } as Referral)).toBe(true);
    });

    it('velocityExceeded counts claimed referrals in the window', () => {
      const recent = baseReferral('r_recent', '2025-07-01T00:00:00.000Z');
      const old = baseReferral('r_old', '2025-01-01T00:00:00.000Z');
      const invited = { ...baseReferral('r_invited', '2025-07-01T00:00:00.000Z'), status: 'invited' as const, refereeId: undefined };
      expect(velocityExceeded('r_001', [recent, old, invited], 30, 0, now)).toBe(true);
    });

    it('velocityExceeded does not count invited-only referrals', () => {
      const invited1 = { ...baseReferral('a', '2025-07-01T00:00:00.000Z'), status: 'invited' as const, refereeId: undefined };
      const invited2 = { ...baseReferral('b', '2025-07-02T00:00:00.000Z'), status: 'invited' as const, refereeId: undefined };
      expect(velocityExceeded('r_001', [invited1, invited2], 30, 1, now)).toBe(false);
    });

    it('velocityExceeded uses updatedAt when present', () => {
      // Created old but updated recently → should be counted as within the window
      const referral = { ...baseReferral('r_updated', '2025-01-01T00:00:00.000Z'), updatedAt: '2025-07-01T00:00:00.000Z' };
      expect(velocityExceeded('r_001', [referral], 30, 0, now)).toBe(true);
    });

    it('evaluateReferral returns review when velocity exceeds 5 but not 10', () => {
      const order: Order = {
        id: 'o_1', accountId: 'r_003', status: 'delivered', lineItems: [],
        finalTotalCents: 250_00, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
      };
      const allReferrals: Referral[] = Array.from({ length: 6 }, (_, i) =>
        baseReferral(`r_${i}`, '2025-07-01T00:00:00.000Z'),
      );
      const decision = evaluateReferral({
        referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
        referrer,
        referee,
        refereeOrders: [order],
        allReferrals,
        now,
      });
      expect(decision.action).toBe('review');
    });

    it('evaluateReferral returns pause when velocity exceeds 10', () => {
      const order: Order = {
        id: 'o_1', accountId: 'r_003', status: 'delivered', lineItems: [],
        finalTotalCents: 250_00, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
      };
      const allReferrals: Referral[] = Array.from({ length: 11 }, (_, i) =>
        baseReferral(`r_${i}`, '2025-07-01T00:00:00.000Z'),
      );
      const decision = evaluateReferral({
        referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
        referrer,
        referee,
        refereeOrders: [order],
        allReferrals,
        now,
      });
      expect(decision.action).toBe('pause');
    });
  });
});