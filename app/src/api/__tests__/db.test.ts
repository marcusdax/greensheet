import { describe, it, expect } from 'vitest';
import { db, seedDatabase } from '../db';

describe('db', () => {
  it('seeds lots with cents', () => {
    seedDatabase();
    expect(db.lots.length).toBeGreaterThan(0);
    expect(db.lots[0].pricePerLbCents).toBe(610);
  });

  it('seeds roasters with cents', () => {
    seedDatabase();
    expect(db.roasters.length).toBeGreaterThan(0);
    const blueBottle = db.roasters.find((r) => r.id === 'r_001');
    expect(blueBottle).toBeDefined();
    expect(blueBottle!.ltvCents).toBe(12450000);
    expect(blueBottle!.cacCents).toBe(85000);
  });

  it('seeds the COF-001 campaign and five COF rules', () => {
    seedDatabase();
    const campaign = db.campaigns.find((c) => c.slug === 'cof-001');
    expect(campaign).toBeDefined();
    expect(campaign!.ruleCodes).toHaveLength(1);
    expect(db.rules.length).toBe(5);
    expect(db.rules.every((r) => db.campaigns.some((c) => c.id === r.campaignId))).toBe(true);
  });

  it('initializes empty downstream collections', () => {
    seedDatabase();
    expect(db.orders).toHaveLength(0);
    expect(db.reservations).toHaveLength(0);
    expect(db.sampleKits).toHaveLength(0);
    expect(db.webhooks).toHaveLength(0);
  });

  it('clears idempotency cache on seed', () => {
    db.idempotency.set('key', { bodyHash: 'hash', response: {} });
    seedDatabase();
    expect(db.idempotency.size).toBe(0);
  });
});
