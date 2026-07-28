import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('orders slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('loads orders', async () => {
    const orders = useRootStore.getState().orders;
    await orders.loadOrders();
    expect(useRootStore.getState().orders.orders.length).toBe(0);
    expect(useRootStore.getState().orders.loading).toBe(false);
  });

  it('creates an order and decrements lot inventory', async () => {
    const orders = useRootStore.getState().orders;
    const created = await orders.createOrder({
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 10, unitPriceCents: 610 }],
    });
    expect(created).not.toBeNull();
    expect(created!.finalTotalCents).toBe(6100);
    expect(useRootStore.getState().orders.orders[0].finalTotalCents).toBe(6100);
  });

  it('processes, ships, and delivers an order', async () => {
    const orders = useRootStore.getState().orders;
    const created = await orders.createOrder({
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 5, unitPriceCents: 610 }],
    });
    const id = created!.id;
    await orders.processOrder(id);
    expect(useRootStore.getState().orders.orders[0].status).toBe('processing');
    await orders.shipOrder(id);
    expect(useRootStore.getState().orders.orders[0].status).toBe('shipped');
    await orders.deliverOrder(id);
    expect(useRootStore.getState().orders.orders[0].status).toBe('delivered');
  });

  it('cancels and returns an order', async () => {
    const orders = useRootStore.getState().orders;
    const created = await orders.createOrder({
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 2, unitPriceCents: 610 }],
    });
    const id = created!.id;
    await orders.cancelOrder(id);
    expect(useRootStore.getState().orders.orders[0].status).toBe('cancelled');
    await orders.returnOrder(id);
    expect(useRootStore.getState().orders.orders[0].status).toBe('returned');
  });

  it('returns null on insufficient inventory', async () => {
    const orders = useRootStore.getState().orders;
    const created = await orders.createOrder({
      accountId: 'r_001',
      lineItems: [{ lotId: 'lot_001', quantityLbs: 999999, unitPriceCents: 610 }],
    });
    expect(created).toBeNull();
    expect(useRootStore.getState().orders.error?.code).toBe('GS-CAT-1001');
  });
});
