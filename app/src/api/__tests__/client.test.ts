import { describe, it, expect, beforeEach } from 'vitest';
import { api, idempotencyKey } from '../client';
import { resetDatabase } from '../db';

describe('api client', () => {
  beforeEach(() => resetDatabase());

  it('paginates roasters', async () => {
    const res = await api.roasters.list({ limit: 2 });
    expect(res.data).toBeDefined();
    expect(res.data!.data.length).toBe(2);
    expect(res.data!.page.hasMore).toBe(true);
  });

  it('returns problem on missing idempotency key', async () => {
    const res = await api.roasters.create({
      roasterName: 'Test',
      segment: 'micro',
      status: 'trial',
      primaryContact: { fullName: 'T', email: 't@example.com', marketingOptIn: false },
    });
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-GEN-1004');
  });

  it('replays idempotent create', async () => {
    const key = idempotencyKey();
    const input = {
      roasterName: 'Test',
      segment: 'micro',
      status: 'trial',
      primaryContact: { fullName: 'T', email: 't@example.com', marketingOptIn: false },
    } as const;
    const r1 = await api.roasters.create(input, key);
    const r2 = await api.roasters.create(input, key);
    expect(r1.data?.id).toBe(r2.data?.id);
  });

  it('returns idempotency conflict for mismatched payload', async () => {
    const key = idempotencyKey();
    const input1 = {
      roasterName: 'One',
      segment: 'micro',
      status: 'trial',
      primaryContact: { fullName: 'One', email: 'one@example.com', marketingOptIn: false },
    } as const;
    const input2 = {
      roasterName: 'Two',
      segment: 'micro',
      status: 'trial',
      primaryContact: { fullName: 'Two', email: 'two@example.com', marketingOptIn: false },
    } as const;
    const r1 = await api.roasters.create(input1, key);
    expect(r1.data).toBeDefined();
    const r2 = await api.roasters.create(input2, key);
    expect('problem' in r2).toBe(true);
    expect(r2.problem!.code).toBe('GS-GEN-1003');
  });

  it('returns GS-CAT-1001 on insufficient inventory', async () => {
    const res = await api.catalog.reserve('lot_001', {
      quantityLbs: 999999,
      orderId: idempotencyKey(),
    });
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-CAT-1001');
  });

  it('creates an order and decrements inventory', async () => {
    const key = idempotencyKey();
    const lotBefore = (await api.catalog.get('lot_001')).data!;
    const beforeQty = lotBefore.availableQuantityLbs;
    const orderInput = {
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 10, unitPriceCents: 610 }],
    };
    const res = await api.orders.create(orderInput, key);
    expect('data' in res).toBe(true);
    expect(res.data!.finalTotalCents).toBe(6100);

    const fetched = await api.orders.get(res.data!.id);
    expect(fetched.data!.lineItems).toHaveLength(1);

    const lotAfter = (await api.catalog.get('lot_001')).data!;
    expect(lotAfter.availableQuantityLbs).toBe(beforeQty - 10);
  });
});
