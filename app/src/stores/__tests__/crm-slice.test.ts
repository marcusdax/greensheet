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
    const roaster = await crm.logIntervention(id, {
      type: 'sales_call',
      date: '2025-07-01',
      outcome: 'pending',
      notes: 'Follow-up call',
    });
    expect(roaster).not.toBeNull();
    expect(useRootStore.getState().crm.roasters[0].interventions.length).toBeGreaterThan(1);
  });

  it('replays idempotent logIntervention calls without duplicating interventions', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    const id = useRootStore.getState().crm.roasters[0].id;
    const initialLength = useRootStore.getState().crm.roasters[0].interventions.length;
    const key = crypto.randomUUID();
    const intervention = {
      type: 'sales_call' as const,
      date: '2025-07-01',
      outcome: 'pending' as const,
      notes: 'Follow-up call',
    };
    const roaster1 = await crm.logIntervention(id, intervention, key);
    expect(roaster1).not.toBeNull();
    const roaster2 = await crm.logIntervention(id, intervention, key);
    expect(roaster2!.id).toBe(roaster1!.id);
    const added1 = roaster1!.interventions.find((i) => i.notes === 'Follow-up call');
    const added2 = roaster2!.interventions.find((i) => i.notes === 'Follow-up call');
    expect(added2!.id).toBe(added1!.id);
    expect(useRootStore.getState().crm.roasters[0].interventions.length).toBe(initialLength + 1);
  });

  it('conflicts on logIntervention with a reused idempotency key but different payload', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    const id = useRootStore.getState().crm.roasters[0].id;
    const key = crypto.randomUUID();
    const first = await crm.logIntervention(id, {
      type: 'sales_call' as const,
      date: '2025-07-01',
      outcome: 'pending' as const,
      notes: 'First call',
    }, key);
    expect(first).not.toBeNull();
    const conflict = await crm.logIntervention(id, {
      type: 'email_campaign' as const,
      date: '2025-07-01',
      outcome: 'pending' as const,
      notes: 'Different intervention',
    }, key);
    expect(conflict).toBeNull();
    expect(useRootStore.getState().crm.error?.code).toBe('GS-GEN-1003');
  });

  it('anonymizes a roaster name and contact', async () => {
    const crm = useRootStore.getState().crm;
    await crm.loadRoasters();
    const id = useRootStore.getState().crm.roasters[0].id;
    await crm.anonymizeRoaster(id);
    expect(useRootStore.getState().crm.roasters[0].roasterName).toBe('[redacted]');
    expect(useRootStore.getState().crm.roasters[0].primaryContact.email).toBe('redacted@example.com');
    expect(useRootStore.getState().crm.roasters[0].primaryContact.fullName).toBe('[redacted]');
  });

  it('records an error when anonymizing a missing roaster', async () => {
    const crm = useRootStore.getState().crm;
    await crm.anonymizeRoaster('missing');
    expect(useRootStore.getState().crm.error?.code).toBe('GS-GEN-1005');
  });

  it('replays idempotent createRoaster calls and conflicts on mismatched payload', async () => {
    const crm = useRootStore.getState().crm;
    const key = crypto.randomUUID();
    const first = await crm.createRoaster(
      {
        roasterName: 'Idempotent Roaster',
        segment: 'micro',
        status: 'trial',
        primaryContact: { fullName: 'A', email: 'a@example.com', marketingOptIn: true },
      },
      key,
    );
    expect(first).not.toBeNull();
    const second = await crm.createRoaster(
      {
        roasterName: 'Idempotent Roaster',
        segment: 'micro',
        status: 'trial',
        primaryContact: { fullName: 'A', email: 'a@example.com', marketingOptIn: true },
      },
      key,
    );
    expect(second!.id).toBe(first!.id);
    expect(useRootStore.getState().crm.roasters.length).toBe(1);

    const conflict = await crm.createRoaster(
      {
        roasterName: 'Different Roaster',
        segment: 'micro',
        status: 'trial',
        primaryContact: { fullName: 'B', email: 'b@example.com', marketingOptIn: true },
      },
      key,
    );
    expect(conflict).toBeNull();
    expect(useRootStore.getState().crm.error?.code).toBe('GS-GEN-1003');
  });

  it('returns null when updating a missing roaster', async () => {
    const crm = useRootStore.getState().crm;
    const updated = await crm.updateRoaster('missing', { roasterName: 'Ghost' });
    expect(updated).toBeNull();
    expect(useRootStore.getState().crm.error?.code).toBe('GS-GEN-1005');
  });
});
