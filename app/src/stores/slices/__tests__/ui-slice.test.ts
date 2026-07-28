import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRootStore } from '../../root-store';
import { resetUiState } from './helpers/reset-ui';

describe('ui-slice toast actions', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUiState();
  });

  it('pushToast adds a toast with a generated id', () => {
    const { ui } = useRootStore.getState();
    ui.pushToast({ kind: 'success', message: 'Saved' });
    const toasts = useRootStore.getState().ui.toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe('success');
    expect(toasts[0].message).toBe('Saved');
    expect(toasts[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('dismissToast removes a toast by id', () => {
    const { ui } = useRootStore.getState();
    ui.pushToast({ kind: 'info', message: 'One' });
    ui.pushToast({ kind: 'error', message: 'Two' });
    const [first, second] = useRootStore.getState().ui.toasts;
    ui.dismissToast(first.id);
    expect(useRootStore.getState().ui.toasts).toEqual([second]);
  });

  it('crypto.randomUUID is stable for mocked test ids', () => {
    const randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('mocked-uuid' as ReturnType<typeof crypto.randomUUID>);
    const { ui } = useRootStore.getState();
    ui.pushToast({ kind: 'info', message: 'Mocked' });
    expect(useRootStore.getState().ui.toasts[0].id).toBe('mocked-uuid');
    randomUUIDSpy.mockRestore();
  });
});

describe('ui-slice drawer actions', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUiState();
  });

  it('openDrawer sets drawer open with title and content', () => {
    const { ui } = useRootStore.getState();
    ui.openDrawer('Lot Details', 'drawer-content');
    const drawer = useRootStore.getState().ui.drawer;
    expect(drawer.open).toBe(true);
    expect(drawer.title).toBe('Lot Details');
    expect(drawer.content).toBe('drawer-content');
  });

  it('closeDrawer sets drawer open to false while preserving title and content', () => {
    const { ui } = useRootStore.getState();
    ui.openDrawer('Lot Details', 'drawer-content');
    ui.closeDrawer();
    const drawer = useRootStore.getState().ui.drawer;
    expect(drawer.open).toBe(false);
    expect(drawer.title).toBe('Lot Details');
    expect(drawer.content).toBe('drawer-content');
  });
});

describe('ui-slice theme actions', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUiState();
  });

  it('setTheme updates theme and persists data-theme attribute', () => {
    const { ui } = useRootStore.getState();
    ui.setTheme('dark');
    expect(useRootStore.getState().ui.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('greensheet:theme')).toBe('dark');
  });

  it('toggleTheme switches between light and dark', () => {
    const { ui } = useRootStore.getState();
    expect(useRootStore.getState().ui.theme).toBe('light');
    ui.toggleTheme();
    expect(useRootStore.getState().ui.theme).toBe('dark');
    ui.toggleTheme();
    expect(useRootStore.getState().ui.theme).toBe('light');
  });
});

describe('ui-slice feature flags', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUiState();
  });

  it('setFeatureFlags replaces feature flags', () => {
    const { ui } = useRootStore.getState();
    ui.setFeatureFlags({ newCampaigns: true });
    expect(useRootStore.getState().ui.featureFlags).toEqual({ newCampaigns: true });
  });
});
