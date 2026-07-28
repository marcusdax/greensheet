import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('catalog slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('loads lots', async () => {
    const catalog = useRootStore.getState().catalog;
    await catalog.loadLots();
    expect(useRootStore.getState().catalog.lots.length).toBeGreaterThan(0);
    expect(useRootStore.getState().catalog.loading).toBe(false);
  });

  it('creates a lot', async () => {
    const catalog = useRootStore.getState().catalog;
    const created = await catalog.createLot({
      origin: 'Test Origin',
      cupScore: 86,
      pricePerLbCents: 500,
      costPerLbCents: 350,
      availableQuantityLbs: 1000,
      totalProductionLbs: 2000,
    });
    expect(created).not.toBeNull();
    expect(useRootStore.getState().catalog.lots[0].origin).toBe('Test Origin');
  });

  it('updates a lot price', async () => {
    const catalog = useRootStore.getState().catalog;
    await catalog.loadLots();
    const id = useRootStore.getState().catalog.lots[0].id;
    const updated = await catalog.updateLot(id, { pricePerLbCents: 999 });
    expect(updated).not.toBeNull();
    expect(useRootStore.getState().catalog.lots[0].pricePerLbCents).toBe(999);
  });

  it('retires a lot', async () => {
    const catalog = useRootStore.getState().catalog;
    await catalog.loadLots();
    const id = useRootStore.getState().catalog.lots[0].id;
    await catalog.retireLot(id);
    expect(useRootStore.getState().catalog.lots[0].status).toBe('retired');
  });

  it('reserves inventory and updates local lot quantity', async () => {
    const catalog = useRootStore.getState().catalog;
    await catalog.loadLots();
    const lot = useRootStore.getState().catalog.lots[0];
    const beforeQty = lot.availableQuantityLbs;
    const reservation = await catalog.reserveLot(lot.id, { quantityLbs: 10, orderId: 'order_123' });
    expect(reservation).not.toBeNull();
    expect(useRootStore.getState().catalog.lots[0].availableQuantityLbs).toBe(beforeQty - 10);
    expect(useRootStore.getState().catalog.reservations[0].quantityLbs).toBe(10);
  });

  it('does not double-decrement inventory on idempotent reserveLot replay', async () => {
    const catalog = useRootStore.getState().catalog;
    await catalog.loadLots();
    const lot = useRootStore.getState().catalog.lots[0];
    const beforeQty = lot.availableQuantityLbs;
    const key = crypto.randomUUID();
    const reservation1 = await catalog.reserveLot(lot.id, { quantityLbs: 10, orderId: 'order_123' }, key);
    const reservation2 = await catalog.reserveLot(lot.id, { quantityLbs: 10, orderId: 'order_123' }, key);
    expect(reservation1).not.toBeNull();
    expect(reservation2!.id).toBe(reservation1!.id);
    expect(useRootStore.getState().catalog.lots[0].availableQuantityLbs).toBe(beforeQty - 10);
    expect(useRootStore.getState().catalog.reservations.length).toBe(1);
  });

  it('returns null and records error on insufficient inventory', async () => {
    const catalog = useRootStore.getState().catalog;
    await catalog.loadLots();
    const lot = useRootStore.getState().catalog.lots[0];
    const reservation = await catalog.reserveLot(lot.id, { quantityLbs: 999999, orderId: 'order_123' });
    expect(reservation).toBeNull();
    expect(useRootStore.getState().catalog.error?.code).toBe('GS-CAT-1001');
  });

  it('replays idempotent createLot calls and conflicts on mismatched payload', async () => {
    const catalog = useRootStore.getState().catalog;
    const key = crypto.randomUUID();
    const payload = {
      origin: 'Idempotent Origin',
      cupScore: 86,
      pricePerLbCents: 500,
      costPerLbCents: 350,
      availableQuantityLbs: 1000,
      totalProductionLbs: 2000,
    };
    const first = await catalog.createLot(payload, key);
    expect(first).not.toBeNull();
    const second = await catalog.createLot(payload, key);
    expect(second!.id).toBe(first!.id);
    expect(useRootStore.getState().catalog.lots.length).toBe(1);

    const conflict = await catalog.createLot({ ...payload, origin: 'Different Origin' }, key);
    expect(conflict).toBeNull();
    expect(useRootStore.getState().catalog.error?.code).toBe('GS-GEN-1003');
  });
});
