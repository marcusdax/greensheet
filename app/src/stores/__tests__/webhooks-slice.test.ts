import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('webhooks slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('loads webhooks', async () => {
    const webhooks = useRootStore.getState().webhooks;
    await webhooks.loadWebhooks();
    expect(useRootStore.getState().webhooks.webhooks.length).toBe(0);
    expect(useRootStore.getState().webhooks.loading).toBe(false);
  });

  it('creates a webhook and stores the secret once', async () => {
    const webhooks = useRootStore.getState().webhooks;
    const created = await webhooks.createWebhook({
      url: 'https://example.com/webhook',
      events: ['order.created'],
    });
    expect(created).not.toBeNull();
    expect(created!.signingSecret).toMatch(/^whsec_/);
    expect(useRootStore.getState().webhooks.webhooks[0].url).toBe('https://example.com/webhook');
    expect(useRootStore.getState().webhooks.webhooks[0]).not.toHaveProperty('signingSecret');
    expect(useRootStore.getState().webhooks.lastCreatedSecret).toBe(created!.signingSecret);
  });

  it('updates a webhook', async () => {
    const webhooks = useRootStore.getState().webhooks;
    const created = await webhooks.createWebhook({
      url: 'https://example.com/webhook',
      events: ['order.created'],
    });
    const updated = await webhooks.updateWebhook(created!.id, { status: 'paused' });
    expect(updated).not.toBeNull();
    expect(useRootStore.getState().webhooks.webhooks[0].status).toBe('paused');
  });

  it('deletes a webhook', async () => {
    const webhooks = useRootStore.getState().webhooks;
    const created = await webhooks.createWebhook({
      url: 'https://example.com/webhook',
      events: ['order.created'],
    });
    const deleted = await webhooks.deleteWebhook(created!.id);
    expect(deleted).toBe(true);
    expect(useRootStore.getState().webhooks.webhooks.length).toBe(0);
  });

  it('loads deliveries', async () => {
    const webhooks = useRootStore.getState().webhooks;
    const created = await webhooks.createWebhook({
      url: 'https://example.com/webhook',
      events: ['order.created'],
    });
    const deliveries = await webhooks.loadDeliveries(created!.id);
    expect(deliveries).not.toBeNull();
    expect(useRootStore.getState().webhooks.deliveries.length).toBeGreaterThan(0);
  });
});
