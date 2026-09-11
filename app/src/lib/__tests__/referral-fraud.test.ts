import { evaluateReferral, FraudInputs } from '../referral-fraud';
import type { Referral, Roaster, Order } from '../../types/api';

/* Helper to create a referral */
function makeReferral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: 'ref_test',
    referrerId: 'r_ref',
    refereeId: 'r_referee',
    refCode: 'GS-TEST-001',
    status: 'invited',
    channel: 'invite_link',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/* Helper to create a roaster */
function makeRoaster(id: string, overrides: Partial<Roaster> = {}): Roaster {
  return {
    id,
    roasterName: `Roaster ${id}`,
    segment: 'micro',
    status: 'active',
    businessRegistration: `BR-${id}`,
    taxId: `TAX-${id}`,
    billingAddress: `${id} Street`,
    cardFingerprint: `fp_${id}`,
    deviceFingerprint: `fp_device_${id}`,
    ipSubnet:
      id === 'r_ref'
        ? '192.168.1.0/24'
        : id === 'r_referee'
          ? '192.168.2.0/24'
          : `192.168.${(parseInt(id.replace(/\D/g, '')) || 1) % 255}.0/24`,
    primaryContact: { fullName: 'Test', email: 'test@example.com' },
    ...overrides,
  };
}

/* Helper to create an order */
function makeOrder(accountId: string, overrides: Partial<Order> = {}): Order {
  return {
    id: `ord_${accountId}_${Date.now()}`,
    accountId,
    status: 'delivered',
    lineItems: [
      {
        lotId: 'lot_001',
        quantityLbs: 1,
        unitPriceCents: 1000, // $10 per lb
      },
    ],
    finalTotalCents: 1000, // $10
    invoiceNumber: `INV-${accountId}`,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/* Helper to create a referral with claim timestamp */
function makeClaimedReferral(overrides: Partial<Referral> = {}): Referral {
  const baseReferral = makeReferral(overrides);
  // Simulate claim by updating createdAt to 30 days ago
  const claimDate = new Date('2025-01-01T00:00:00.000Z');
  baseReferral.createdAt = claimDate.toISOString();
  return baseReferral;
}

describe('evaluateReferral', () => {
  let referrer: Roaster;
  let referee: Roaster;
  let referral: Referral;
  let refereeOrders: Order[];
  let allReferrals: Referral[];

  beforeEach(() => {
    referrer = makeRoaster('r_ref');
    referee = makeRoaster('r_referee');
    referral = makeReferral();
    refereeOrders = [];
    allReferrals = [];
  });

  const buildInputs = (): FraudInputs => ({
    referral,
    referrer,
    referee,
    refereeOrders,
    allReferrals,
    // Fixed date for deterministic tests
    now: new Date('2025-06-01T00:00:00.000Z'),
  });

  describe('first order qualification', () => {
    test('should qualify if first order is >= $150 and delivered', () => {
      refereeOrders = [makeOrder('r_referee', { finalTotalCents: 150_00 })];
      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('qualify');
    });

    test('should not qualify if first order is < $150', () => {
      refereeOrders = [makeOrder('r_referee', { finalTotalCents: 149_99 })];
      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('First paid order floor not met.');
    });

    test('should not qualify if first order is returned', () => {
      refereeOrders = [
        makeOrder('r_referee', { finalTotalCents: 200_00, status: 'returned' }),
        makeOrder('r_referee', { finalTotalCents: 200_00 }), // second order
      ];
      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('First paid order floor not met.');
    });

    test('should not qualify if a later order is high value but first order is low', () => {
      refereeOrders = [
        makeOrder('r_referee', { finalTotalCents: 100_00 }), // first order: $100
        makeOrder('r_referee', { finalTotalCents: 200_00 }), // second order: $200
      ];
      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('First paid order floor not met.');
    });

    test('should not qualify if referrer credit would exceed 50% of order total', () => {
      // Order total is $200, 50% is $100, but referrer credit is $150 -> should decline
      refereeOrders = [makeOrder('r_referee', { finalTotalCents: 200_00 })];
      const result = evaluateReferral(buildInputs());
      // Currently, the function doesn't check the 50% cap, so we expect it to qualify (but we will change this)
      // We'll update this test after implementing the 50% cap
      // For now, this test is expected to fail until we fix the cap enforcement
      expect(result.action).toBe('review'); // Change from 'qualify' to 'review' to reflect correct behavior
    });
  });

  describe('business registration and tax ID', () => {
    test('should require business registration and tax ID for referee', () => {
      // Referee missing businessRegistration
      const refereeMissingReg = makeRoaster('r_referee', { businessRegistration: undefined });
      const result = evaluateReferral({
        referral,
        referrer,
        referee: refereeMissingReg,
        refereeOrders: [makeOrder('r_referee', { finalTotalCents: 150_00 })],
        allReferrals: [],
      });
      expect(result.action).toBe('review');
      expect(result.reason).toBe('Referee missing business registration or tax ID.');

      // Referee missing taxId
      const refereeMissingTax = makeRoaster('r_referee', { taxId: undefined });
      const result2 = evaluateReferral({
        referral,
        referrer,
        referee: refereeMissingTax,
        refereeOrders: [makeOrder('r_referee', { finalTotalCents: 150_00 })],
        allReferrals: [],
      });
      expect(result2.action).toBe('review');
      expect(result2.reason).toBe('Referee missing business registration or tax ID.');
    });
  });

  describe('self-referral', () => {
    test('should decline self-referral', () => {
      const selfReferral = makeReferral({ refereeId: referrer.id });
      const result = evaluateReferral({
        referral: selfReferral,
        referrer,
        referee: referrer,
        refereeOrders: [makeOrder('r_referee', { finalTotalCents: 150_00 })],
        allReferrals: [],
      });
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('Self-referral.');
    });
  });

  describe('identity graph match', () => {
    test('should decline if taxId matches', () => {
      const refereeWithSameTax = makeRoaster('r_referee', { taxId: referrer.taxId });
      const result = evaluateReferral({
        referral: { referrerId: referrer.id, refereeId: referee.id },
        referrer,
        referee: refereeWithSameTax,
        refereeOrders: [makeOrder('r_referee', { finalTotalCents: 150_00 })],
        allReferrals: [],
      });
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('Identity graph match detected.');
    });

    test('should decline if billingAddress matches', () => {
      const refereeWithSameAddress = makeRoaster('r_referee', { billingAddress: referrer.billingAddress });
      const result = evaluateReferral({
        referral: { referrerId: referrer.id, refereeId: referee.id },
        referrer,
        referee: refereeWithSameAddress,
        refereeOrders: [makeOrder('r_referee', { finalTotalCents: 150_00 })],
        allReferrals: [],
      });
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('Identity graph match detected.');
    });
  });

  describe('velocity limits', () => {
    test('should allow up to 5 referrals in 30 days', () => {
      // Create 5 referrals in the last 30 days
      const baseDate = new Date('2025-05-01T00:00:00.000Z');
      allReferrals = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i); // spread over 5 days
        return makeReferral({
          id: `ref_${i}`,
          referrerId: referrer.id,
          refereeId: `r_referee_${i}`,
          status: 'qualified',
          createdAt: date.toISOString(),
        } as Referral);
      });

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('qualify'); // 5 is the threshold for review, so 5 should still qualify
    });

    test('should trigger review at 6 referrals in 30 days', () => {
      // Create 6 referrals in the last 30 days
      const baseDate = new Date('2025-05-01T00:00:00.000Z');
      allReferrals = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        return makeReferral({
          id: `ref_${i}`,
          referrerId: referrer.id,
          refereeId: `r_referee_${i}`,
          status: 'qualified',
          createdAt: date.toISOString(),
        } as Referral);
      });

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('review');
      expect(result.reason).toBe('Velocity threshold reached for manual review.');
    });

    test('should decline at 11 referrals in 30 days', () => {
      // Create 11 referrals in the last 30 days
      const baseDate = new Date('2025-05-01T00:00:00.000Z');
      allReferrals = Array.from({ length: 11 }, (_, i) => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        return makeReferral({
          id: `ref_${i}`,
          referrerId: referrer.id,
          refereeId: `r_referee_${i}`,
          status: 'qualified',
          createdAt: date.toISOString(),
        } as Referral);
      });

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('Velocity limit exceeded.');
    });
  });

  describe('referral ring detection', () => {
    test('should detect mutual referral within 60 days and trigger review', () => {
      // Create a mutual referral: referee referred referrer 30 days ago (2025-05-02, before now=2025-06-01)
      const mutualReferral = makeReferral({
        id: 'ref_mutual',
        referrerId: referee.id, // referee is now the referrer
        refereeId: referrer.id, // referrer is now the referee
        status: 'qualified',
        channel: 'invite_link',
        createdAt: '2025-05-02T00:00:00.000Z', // 30 days ago
      });
      allReferrals = [mutualReferral];

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('review');
      expect(result.reason).toBe('Mutual referral ring detected.');
    });

    test('should not detect mutual referral outside 60 days', () => {
      const mutualReferral = makeReferral({
        id: 'ref_mutual',
        referrerId: referee.id,
        refereeId: referrer.id,
        status: 'qualified',
        channel: 'invite_link',
        createdAt: '2025-04-01T00:00:00.000Z', // 61 days before now (2025-06-01)
      });
      allReferrals = [mutualReferral];

      const result = evaluateReferral(buildInputs());
      // Assuming other conditions are met, it should qualify
      expect(result.action).toBe('qualify');
    });
  });

  describe('resellerScreen', () => {
    test('should flag PO-box address as review', () => {
      const refereeWithPoBox = makeRoaster('r_referee', {
        billingAddress: 'PO Box 123, Anytown',
      });
      const result = evaluateReferral({
        referral: { referrerId: referrer.id, refereeId: referee.id },
        referrer,
        referee: refereeWithPoBox,
        refereeOrders: [makeOrder('r_referee', { finalTotalCents: 150_00 })],
        allReferrals: [],
      });
      expect(result.action).toBe('review');
      expect(result.reason).toBe('Referee missing business registration or tax ID.');
      // Note: PO-box-only addresses are not distinct registered businesses.
    });
  });

  describe('velocity thresholds with fixed dates', () => {
    test('should allow up to 5 claimed referrals in 30 days', () => {
      const baseDate = new Date('2025-05-01T00:00:00.000Z');
      allReferrals = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        return makeReferral({
          id: `ref_vel_${i}`,
          referrerId: referrer.id,
          refereeId: `r_referee_vel_${i}`,
          status: 'qualified',
          createdAt: date.toISOString(),
        } as Referral);
      });

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('qualify');
    });

    test('should review at 6 claimed referrals in 30 days', () => {
      const baseDate = new Date('2025-05-01T00:00:00.000Z');
      allReferrals = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        return makeReferral({
          id: `ref_vel_${i}`,
          referrerId: referrer.id,
          refereeId: `r_referee_vel_${i}`,
          status: 'qualified',
          createdAt: date.toISOString(),
        } as Referral);
      });

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('review');
      expect(result.reason).toBe('Velocity threshold reached for manual review.');
    });

    test('should decline at 11 claimed referrals in 30 days', () => {
      const baseDate = new Date('2025-05-01T00:00:00.000Z');
      allReferrals = Array.from({ length: 11 }, (_, i) => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        return makeReferral({
          id: `ref_vel_high_${i}`,
          referrerId: referrer.id,
          refereeId: `r_referee_high_${i}`,
          status: 'qualified',
          createdAt: date.toISOString(),
        } as Referral);
      });

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('decline');
      expect(result.reason).toBe('Velocity limit exceeded.');
    });
  });

  describe('review decision persisted in the pending queue', () => {
    test('returns review when 30-day return window has not yet passed', () => {
      // Order delivered recently (2025-05-20), before now (2025-06-01) — only 12 days elapsed
      const recentOrder = makeOrder('r_referee', {
        finalTotalCents: 150_00,
        status: 'delivered',
        updatedAt: '2025-05-20T00:00:00.000Z',
      });
      refereeOrders = [recentOrder];

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('review');
      expect(result.reason).toMatch(/30 days from delivery/);
    });

    test('qualifies when 30-day return window has passed', () => {
      // Order delivered long ago (2025-04-01), well before now (2025-06-01) — 61 days elapsed
      const oldOrder = makeOrder('r_referee', {
        finalTotalCents: 150_00,
        status: 'delivered',
        updatedAt: '2025-04-01T00:00:00.000Z',
      });
      refereeOrders = [oldOrder];

      const result = evaluateReferral(buildInputs());
      expect(result.action).toBe('qualify');
    });
  });
});