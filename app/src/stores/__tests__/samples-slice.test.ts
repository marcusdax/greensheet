import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('samples slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('loads sample kits', async () => {
    const samples = useRootStore.getState().samples;
    await samples.loadKits();
    expect(useRootStore.getState().samples.kits.length).toBe(0);
    expect(useRootStore.getState().samples.loading).toBe(false);
  });

  it('creates a sample kit', async () => {
    const samples = useRootStore.getState().samples;
    const created = await samples.createKit({
      roasterId: 'r_001',
      lotIds: ['lot_001'],
      shippingAddress: {
        line1: '1 Main St',
        city: 'Town',
        region: 'OR',
        postalCode: '97201',
        country: 'US',
      },
    });
    expect(created).not.toBeNull();
    expect(useRootStore.getState().samples.kits[0].roasterId).toBe('r_001');
  });

  it('submits feedback for a kit', async () => {
    const samples = useRootStore.getState().samples;
    const kit = await samples.createKit({
      roasterId: 'r_001',
      lotIds: ['lot_001'],
      shippingAddress: {
        line1: '1 Main St',
        city: 'Town',
        region: 'OR',
        postalCode: '97201',
        country: 'US',
      },
    });
    expect(kit).not.toBeNull();
    const updated = await samples.submitFeedback({
      feedbackToken: kit!.feedbackToken!,
      rating: 5,
      notes: 'Excellent',
      lotRatings: [{ lotId: 'lot_001', rating: 5, wouldOrder: true }],
    });
    expect(updated).not.toBeNull();
    expect(useRootStore.getState().samples.kits[0].status).toBe('feedback_received');
    expect(useRootStore.getState().samples.kits[0].feedback?.rating).toBe(5);
  });

  it('returns null when roaster is missing', async () => {
    const samples = useRootStore.getState().samples;
    const kit = await samples.createKit({
      roasterId: 'missing',
      lotIds: ['lot_001'],
      shippingAddress: {
        line1: '1 Main St',
        city: 'Town',
        region: 'OR',
        postalCode: '97201',
        country: 'US',
      },
    });
    expect(kit).toBeNull();
    expect(useRootStore.getState().samples.error?.code).toBe('GS-GEN-1005');
  });
});
