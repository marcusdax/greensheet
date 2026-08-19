import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('rules slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('loads rules', async () => {
    const rules = useRootStore.getState().rules;
    await rules.loadRules();
    expect(useRootStore.getState().rules.rules.length).toBeGreaterThan(0);
    expect(useRootStore.getState().rules.loading).toBe(false);
  });

  it('creates a rule', async () => {
    const rules = useRootStore.getState().rules;
    const created = await rules.createRule({
      ruleCode: 'NEW-001',
      campaignId: 'campaign-cof-001',
      ruleName: 'New Rule',
      triggerEvent: 'order.created',
      conditionsJson: { minOrderValue: 10000 },
      actions: [{ actionType: 'SEND_TEMPLATE', templateId: 'tmpl_x', channel: 'email' }],
    });
    expect(created).not.toBeNull();
    expect(useRootStore.getState().rules.rules[0].ruleCode).toBe('NEW-001');
  });

  it('updates a rule', async () => {
    const rules = useRootStore.getState().rules;
    await rules.loadRules();
    const id = useRootStore.getState().rules.rules[0].id;
    const updated = await rules.updateRule(id, { status: 'paused' });
    expect(updated).not.toBeNull();
    expect(useRootStore.getState().rules.rules[0].status).toBe('paused');
  });

  it('deletes a rule', async () => {
    const rules = useRootStore.getState().rules;
    await rules.loadRules();
    const id = useRootStore.getState().rules.rules[0].id;
    const deleted = await rules.deleteRule(id);
    expect(deleted).toBe(true);
    expect(useRootStore.getState().rules.rules.find((r) => r.id === id)).toBeUndefined();
  });

  it('returns false when deleting a missing rule', async () => {
    const rules = useRootStore.getState().rules;
    const deleted = await rules.deleteRule('missing');
    expect(deleted).toBe(false);
    expect(useRootStore.getState().rules.error?.code).toBe('GS-GEN-1005');
  });
});
