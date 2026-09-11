import { describe, it, expect, beforeEach } from 'vitest';
import {
  identityGraphMatch,
  velocityExceeded,
  ringDetected,
  resellerScreen,
  evaluateReferral,
} from '../../lib/referral-fraud';
import { api } from '../client';
import { db, resetDatabase } from '../db';
import type { Order, Referral, Roaster } from '../../types/api';

// Shared fixtures for direct evaluateReferral helper tests (IDs do not collide
// with the seeded DB because these objects are passed in directly, not looked up).
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

const qualifyingOrder: Order = {
  id: 'ord_qual',
  accountId: 'r_003',
  status: 'delivered',
  lineItems: [],
  finalTotalCents: 250_00,
  invoiceNumber: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('referral fraud helpers', () => {
  it('declines identity graph match', () => {
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
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee,
      refereeOrders: [qualifyingOrder],
      allReferrals: [],
    });
    expect(decision.action).toBe('qualify');
  });

  it('reviews missing reseller docs', () => {
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee: { ...referee, businessRegistration: undefined },
      refereeOrders: [qualifyingOrder],
      allReferrals: [],
    });
    expect(decision.action).toBe('review');
  });

  it('declines when velocity exceeded', () => {
    const extraRefs: Referral[] = [];
    for (let i = 0; i < 11; i++) {
      extraRefs.push({
        id: `ref_extra_${i}`,
        referrerId: 'r_001',
        refereeId: `referee_extra_${i}`,
        refCode: `GS-EXTRA-${i}`,
        status: 'qualified',
        createdAt: new Date().toISOString(),
      } as Referral);
    }
    const decision = evaluateReferral({
      referral: { referrerId: 'r_001', refereeId: 'r_003' } as Referral,
      referrer,
      referee,
      refereeOrders: [qualifyingOrder],
      allReferrals: [...extraRefs, { referrerId: 'r_001', refereeId: 'r_003' } as Referral],
    });
    expect(decision.action).toBe('decline');
  });
});

// Dedicated roaster fixtures with IDs that do not collide with seeded DB rows.
const gateReferrer: Roaster = {
  id: 'r_gate_ref',
  roasterName: 'Gate Referrer',
  segment: 'commercial',
  status: 'active',
  churnRiskScore: null,
  ltvCents: null,
  cacCents: null,
  paybackMonths: null,
  daysSinceLastOrder: null,
  totalRevenueCents: null,
  totalOrders: null,
  businessRegistration: 'BR-GATE-REF',
  taxId: 'TAX-GATE-REF',
  billingAddress: '100 Referrer St',
  cardFingerprint: 'fp_card_gate_ref',
  deviceFingerprint: 'fp_device_gate_ref',
  ipSubnet: '172.16.1.0/24',
  lastActivityAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  primaryContact: { fullName: 'R', email: 'r@gate.test', marketingOptIn: true },
  interventions: [],
};

const gateReferee: Roaster = {
  id: 'r_gate_referee',
  roasterName: 'Gate Referee',
  segment: 'boutique',
  status: 'active',
  churnRiskScore: null,
  ltvCents: null,
  cacCents: null,
  paybackMonths: null,
  daysSinceLastOrder: null,
  totalRevenueCents: null,
  totalOrders: null,
  businessRegistration: 'BR-GATE-REFEE',
  taxId: 'TAX-GATE-REFEE',
  billingAddress: '200 Referee Ave',
  cardFingerprint: 'fp_card_gate_referee',
  deviceFingerprint: 'fp_device_gate_referee',
  ipSubnet: '172.16.2.0/24',
  lastActivityAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  primaryContact: { fullName: 'S', email: 's@gate.test', marketingOptIn: true },
  interventions: [],
};

describe('qualifyReferral gates through evaluateReferral', () => {
  beforeEach(() => resetDatabase());

  function makeReferral(overrides: Partial<Referral> = {}): Referral {
    return {
      id: 'ref_gate_001',
      referrerId: gateReferrer.id,
      refereeId: gateReferee.id,
      refCode: 'GS-GATE-001',
      status: 'kit_delivered',
      channel: 'invite_link',
      createdAt: new Date().toISOString(),
      ...overrides,
    } as Referral;
  }

  // Pushes an eligible referrer/referee pair into the DB along with a qualifying
  // order for the referee, then seeds the target referral. Returns the target id.
  function seedEligibleTarget(id = 'ref_gate_001'): string {
    db.roasters.push(gateReferrer, gateReferee);
    db.orders.push({ ...qualifyingOrder, id: `${id}_ord`, accountId: gateReferee.id });
    db.referrals.push(makeReferral({ id }));
    return id;
  }

  it('declines (400) on identity graph match', async () => {
    // Make referee share the referrer's taxId + billing address so identityGraphMatch fires.
    const matchedReferee: Roaster = {
      ...gateReferee,
      taxId: gateReferrer.taxId,
      billingAddress: gateReferrer.billingAddress,
    };
    db.roasters.push(gateReferrer, matchedReferee);
    db.orders.push({ ...qualifyingOrder, accountId: matchedReferee.id });
    db.referrals.push(makeReferral({ id: 'ref_gate_idmatch', refereeId: matchedReferee.id }));

    const res = await api.referrals.qualifyReferral('ref_gate_idmatch');
    expect('problem' in res).toBe(true);
    expect(res.problem!.status).toBe(400);
    expect(res.problem!.code).toBe('GS-REF-1003');
    expect(res.problem!.title).toBe('Referral did not qualify');
    expect(res.problem!.detail).toMatch(/Identity graph match/i);
  });

  it('reviews (422) when referee is missing business registration or tax ID', async () => {
    const incompleteReferee: Roaster = {
      ...gateReferee,
      businessRegistration: undefined,
      taxId: undefined,
    };
    db.roasters.push(gateReferrer, incompleteReferee);
    db.orders.push({ ...qualifyingOrder, accountId: incompleteReferee.id });
    db.referrals.push(makeReferral({ id: 'ref_gate_unregistered', refereeId: incompleteReferee.id }));

    const res = await api.referrals.qualifyReferral('ref_gate_unregistered');
    expect('problem' in res).toBe(true);
    expect(res.problem!.status).toBe(422);
    expect(res.problem!.code).toBe('GS-REF-1003');
    expect(res.problem!.title).toBe('Referral requires manual review');
    expect(res.problem!.detail).toMatch(/business registration or tax ID/i);
  });

  it('declines (400) when referee has no delivered $150+ order', async () => {
    const shortOrder: Order = { ...qualifyingOrder, finalTotalCents: 50_00 };
    db.roasters.push(gateReferrer, gateReferee);
    db.orders.push(shortOrder);
    db.referrals.push(makeReferral({ id: 'ref_gate_nofloor' }));

    const res = await api.referrals.qualifyReferral('ref_gate_nofloor');
    expect('problem' in res).toBe(true);
    expect(res.problem!.status).toBe(400);
    expect(res.problem!.title).toBe('Referral did not qualify');
    expect(res.problem!.detail).toMatch(/First paid order floor/);
  });

  it('reviews (422) on mutual referral ring', async () => {
    // gateReferrer refers gateReferee, and gateReferee (referee) refers gateReferrer (referrer).
    db.roasters.push(gateReferrer, gateReferee);
    db.orders.push({ ...qualifyingOrder, accountId: gateReferee.id });
    db.referrals.push(makeReferral({ id: 'ref_gate_ring_outbound' }));
    db.referrals.push({
      id: 'ref_gate_ring_inbound',
      referrerId: gateReferee.id,
      refereeId: gateReferrer.id,
      refCode: 'GS-GATE-RING',
      status: 'clicked',
      channel: 'invite_link',
      createdAt: new Date().toISOString(),
    } as Referral);

    const res = await api.referrals.qualifyReferral('ref_gate_ring_outbound');
    expect('problem' in res).toBe(true);
    expect(res.problem!.status).toBe(422);
    expect(res.problem!.title).toBe('Referral requires manual review');
    expect(res.problem!.detail).toMatch(/ring/i);
  });

  it('declines (400) when referrer velocity > 10/month', async () => {
    // 11 past qualified referrals in the last 30 days for the referrer plus the target.
    seedEligibleTarget();
    const past: Referral[] = [];
    for (let i = 0; i < 11; i++) {
      past.push({
        id: `ref_vel_high_${i}`,
        referrerId: gateReferrer.id,
        refereeId: `referee_h_${i}`,
        refCode: `GS-VEL-H-${i}`,
        status: 'qualified',
        channel: 'invite_link',
        createdAt: new Date().toISOString(),
      } as Referral);
    }
    db.referrals.push(...past);

    const res = await api.referrals.qualifyReferral('ref_gate_001');
    expect('problem' in res).toBe(true);
    expect(res.problem!.status).toBe(400);
    expect(res.problem!.title).toBe('Referral did not qualify');
    expect(res.problem!.detail).toMatch(/Velocity/i);
  });

  it('reviews (422) when referrer velocity > 5/month but <= 10', async () => {
    // 6 past qualified referrals in the last 30 days (exceeds review threshold of 5).
    seedEligibleTarget();
    const past: Referral[] = [];
    for (let i = 0; i < 6; i++) {
      past.push({
        id: `ref_vel_mid_${i}`,
        referrerId: gateReferrer.id,
        refereeId: `referee_m_${i}`,
        refCode: `GS-VEL-M-${i}`,
        status: 'qualified',
        channel: 'invite_link',
        createdAt: new Date().toISOString(),
      } as Referral);
    }
    db.referrals.push(...past);

    const res = await api.referrals.qualifyReferral('ref_gate_001');
    expect('problem' in res).toBe(true);
    expect(res.problem!.status).toBe(422);
    expect(res.problem!.title).toBe('Referral requires manual review');
    expect(res.problem!.detail).toMatch(/Velocity/i);
  });

  it('posts rewards ($150 credit, $100 discount) on successful qualification', async () => {
    seedEligibleTarget();
    const beforeLedger = db.rewardsLedger.length;

    const res = await api.referrals.qualifyReferral('ref_gate_001');
    expect('data' in res).toBe(true);
    expect(res.data!.referral.status).toBe('qualified');
    expect(res.data!.entries).toHaveLength(2);
    expect(
      res.data!.entries.some(
        (e) => e.type === 'referrer_credit' && e.amountCents === 150_00 && e.status === 'posted',
      ),
    ).toBe(true);
    expect(
      res.data!.entries.some(
        (e) => e.type === 'referee_discount' && e.amountCents === 100_00 && e.status === 'posted',
      ),
    ).toBe(true);
    expect(db.rewardsLedger.length).toBe(beforeLedger + 2);
  });
});
