import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('crm slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('loads roasters', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    expect(useRootStore.getState().crm.roasters.length).toBeGreaterThan(0);
    expect(useRootStore.getState().crm.loading).toBe(false);
  });

  it('filters roasters by status', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters({ status: ['active'] });
    expect(useRootStore.getState().crm.roasters.every((r) => r.status === 'active')).toBe(true);
  });

  it('creates a roaster', async () => {
    const crm = useRootStore.getState().crm;
    const roaster = await crm.createRoaster({
      roasterName: 'New Roaster',
      segment: 'micro',
      status: 'trial',
      primaryContact: { fullName: 'A', email: 'a@example.com', marketingOptIn: true },
    });
    expect(roaster).not.toBeNull();
    expect(useRootStore.getState().crm.roasters[0].roasterName).toBe('New Roaster');
  });

  it('updates a roaster', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    const id = useRootStore.getState().crm.roasters[0].id;
    const updated = await crm.updateRoaster(id, { roasterName: 'Renamed Roaster' });
    expect(updated).not.toBeNull();
    expect(useRootStore.getState().crm.roasters[0].roasterName).toBe('Renamed Roaster');
  });

  it('logs an intervention', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    const id = useRootStore.getState().crm.roasters[0].id;
    await crm.logIntervention(id, {
      type: 'sales_call',
      date: '2025-07-01',
      outcome: 'pending',
      notes: 'Follow-up call',
    });
    expect(useRootStore.getState().crm.roasters[0].interventions.length).toBeGreaterThan(1);
  });

  it('anonymizes a roaster contact', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    const id = useRootStore.getState().crm.roasters[0].id;
    await crm.anonymizeRoaster(id);
    expect(useRootStore.getState().crm.roasters[0].primaryContact.email).toBe('redacted@example.com');
  });

  it('returns null when updating a missing roaster', async () => {
    const crm = useRootStore.getState().crm;
    const updated = await crm.updateRoaster('missing', { roasterName: 'Ghost' });
    expect(updated).toBeNull();
    expect(useRootStore.getState().crm.error?.code).toBe('GS-GEN-1005');
  });
});
