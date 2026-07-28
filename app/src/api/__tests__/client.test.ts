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

  it('returns GS-GEN-1004 when catalog.reserve is called without idempotency key', async () => {
    // @ts-expect-error intentional: verify missing required idempotency key returns GS-GEN-1004
    const res = await api.catalog.reserve('lot_001', {
      quantityLbs: 1,
      orderId: idempotencyKey(),
    });
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-GEN-1004');
  });

  it('returns GS-CAT-1001 on insufficient inventory', async () => {
    const res = await api.catalog.reserve('lot_001', {
      quantityLbs: 999999,
      orderId: idempotencyKey(),
    }, idempotencyKey());
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
    expect(Number.isInteger(res.data!.finalTotalCents)).toBe(true);

    const fetched = await api.orders.get(res.data!.id);
    expect(fetched.data!.lineItems).toHaveLength(1);

    const lotAfter = (await api.catalog.get('lot_001')).data!;
    expect(lotAfter.availableQuantityLbs).toBe(beforeQty - 10);
  });

  it('rejects duplicate lot IDs in orders.create', async () => {
    const key = idempotencyKey();
    const lotBefore = (await api.catalog.get('lot_001')).data!;
    const beforeQty = lotBefore.availableQuantityLbs;
    const orderInput = {
      accountId: 'r_001',
      lineItems: [
        { lotId: 'lot_001', quantityLbs: 5, unitPriceCents: 610 },
        { lotId: 'lot_001', quantityLbs: 5, unitPriceCents: 610 },
      ],
    };
    const res = await api.orders.create(orderInput, key);
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-GEN-1000');

    const lotAfter = (await api.catalog.get('lot_001')).data!;
    expect(lotAfter.availableQuantityLbs).toBe(beforeQty);
  });

  it('rejects orders for retired lots', async () => {
    const key = idempotencyKey();
    await api.catalog.patch('lot_001', { status: 'retired' });
    const res = await api.orders.create({
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 1, unitPriceCents: 610 }],
    }, key);
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-CAT-1002');
  });

  it('rejects non-integer quantityLbs in orders.create', async () => {
    const key = idempotencyKey();
    const res = await api.orders.create({
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 1.5, unitPriceCents: 610 }],
    }, key);
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-GEN-1000');
  });

  it('persists sample kit feedback payload', async () => {
    const key = idempotencyKey();
    const createRes = await api.sampleKits.create({
      roasterId: 'r_001',
      lotIds: ['lot_001'],
      shippingAddress: {
        line1: '1 Main St',
        city: 'Town',
        region: 'OR',
        postalCode: '97201',
        country: 'US',
      },
    }, key);
    const kit = createRes.data!;
    const feedbackInput = {
      feedbackToken: kit.feedbackToken!,
      rating: 4,
      notes: 'Bright acidity, nice body',
      lotRatings: [{ lotId: 'lot_001', rating: 5, wouldOrder: true }],
      submittedFromIp: '127.0.0.1',
    };
    const feedbackRes = await api.sampleKits.feedback(feedbackInput);
    expect('data' in feedbackRes).toBe(true);
    expect(feedbackRes.data!.status).toBe('feedback_received');
    expect(feedbackRes.data!.feedback).toEqual(feedbackInput);
    expect(feedbackRes.data!.feedbackSubmittedAt).toBeDefined();

    const fetched = await api.sampleKits.get(kit.id);
    expect(fetched.data!.feedback).toEqual(feedbackInput);
  });

  it('rejects non-integer unitPriceCents in orders.create', async () => {
    const key = idempotencyKey();
    const lotBefore = (await api.catalog.get('lot_001')).data!;
    const beforeQty = lotBefore.availableQuantityLbs;
    const res = await api.orders.create({
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 1, unitPriceCents: 610.5 }],
    }, key);
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-GEN-1000');

    const lotAfter = (await api.catalog.get('lot_001')).data!;
    expect(lotAfter.availableQuantityLbs).toBe(beforeQty);
  });

  it('rejects non-integer pricePerLbCents and costPerLbCents in catalog.create', async () => {
    const key = idempotencyKey();
    const res = await api.catalog.create({
      origin: 'Test Origin',
      cupScore: 85,
      pricePerLbCents: 100.5,
      costPerLbCents: 80.25,
      availableQuantityLbs: 100,
      totalProductionLbs: 100,
    }, key);
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-GEN-1000');
  });

  it('rejects non-integer pricePerLbCents in catalog.patch', async () => {
    const res = await api.catalog.patch('lot_001', { pricePerLbCents: 610.5 });
    expect('problem' in res).toBe(true);
    expect(res.problem!.code).toBe('GS-GEN-1000');
  });

  it('omits signingSecret from webhooks list, get, and patch but create returns it', async () => {
    const key = idempotencyKey();
    const createRes = await api.webhooks.create({
      url: 'https://example.com/webhook',
      events: ['order.created'],
    }, key);
    expect('data' in createRes).toBe(true);
    expect(createRes.data!.signingSecret).toMatch(/^whsec_/);

    const listRes = await api.webhooks.list();
    expect('data' in listRes).toBe(true);
    expect(listRes.data!.data).toHaveLength(1);
    expect(listRes.data!.data[0]).not.toHaveProperty('signingSecret');

    const getRes = await api.webhooks.get(createRes.data!.id);
    expect('data' in getRes).toBe(true);
    expect(getRes.data!).not.toHaveProperty('signingSecret');

    const patchRes = await api.webhooks.patch(createRes.data!.id, { status: 'paused' });
    expect('data' in patchRes).toBe(true);
    expect(patchRes.data!).not.toHaveProperty('signingSecret');
  });
});
