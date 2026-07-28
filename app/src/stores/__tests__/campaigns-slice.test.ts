import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('campaigns slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('loads campaigns', async () => {
    const campaigns = useRootStore.getState().campaigns;
    await campaigns.loadCampaigns();
    expect(useRootStore.getState().campaigns.campaigns.length).toBeGreaterThan(0);
    expect(useRootStore.getState().campaigns.loading).toBe(false);
  });

  it('creates a campaign', async () => {
    const campaigns = useRootStore.getState().campaigns;
    const created = await campaigns.createCampaign({
      slug: 'new-campaign',
      name: 'New Campaign',
    });
    expect(created).not.toBeNull();
    expect(useRootStore.getState().campaigns.campaigns[0].slug).toBe('new-campaign');
  });

  it('updates a campaign', async () => {
    const campaigns = useRootStore.getState().campaigns;
    await campaigns.loadCampaigns();
    const id = useRootStore.getState().campaigns.campaigns[0].id;
    const updated = await campaigns.updateCampaign(id, { name: 'Updated Campaign' });
    expect(updated).not.toBeNull();
    expect(useRootStore.getState().campaigns.campaigns[0].name).toBe('Updated Campaign');
  });

  it('activates and pauses a campaign', async () => {
    const campaigns = useRootStore.getState().campaigns;
    await campaigns.loadCampaigns();
    const id = useRootStore.getState().campaigns.campaigns[0].id;
    await campaigns.pauseCampaign(id);
    expect(useRootStore.getState().campaigns.campaigns[0].status).toBe('paused');
    await campaigns.activateCampaign(id);
    expect(useRootStore.getState().campaigns.campaigns[0].status).toBe('active');
  });

  it('retires a campaign', async () => {
    const campaigns = useRootStore.getState().campaigns;
    await campaigns.loadCampaigns();
    const id = useRootStore.getState().campaigns.campaigns[0].id;
    await campaigns.retireCampaign(id);
    expect(useRootStore.getState().campaigns.campaigns[0].status).toBe('retired');
  });

  it('loads campaign performance', async () => {
    const campaigns = useRootStore.getState().campaigns;
    await campaigns.loadCampaigns();
    const id = useRootStore.getState().campaigns.campaigns[0].id;
    await campaigns.loadPerformance(id);
    expect(useRootStore.getState().campaigns.performance).not.toBeNull();
    expect(useRootStore.getState().campaigns.performance?.campaignId).toBe(id);
  });
});
