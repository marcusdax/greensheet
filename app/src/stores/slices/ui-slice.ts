export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  message: string;
}

export interface UiSlice {
  toasts: Toast[];
  featureFlags: Record<string, boolean>;
  theme: 'light' | 'dark';
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setFeatureFlags: (flags: Record<string, boolean>) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const createUiSlice = (set: any) => ({
  toasts: [],
  featureFlags: {},
  theme: 'light' as const,
  pushToast: (t: Omit<Toast, 'id'>) =>
    set((s: any) => { s.ui.toasts.push({ ...t, id: crypto.randomUUID() }); }, false, 'ui/pushToast'),
  dismissToast: (id: string) =>
    set((s: any) => { s.ui.toasts = s.ui.toasts.filter((x: Toast) => x.id !== id); }, false, 'ui/dismissToast'),
  setFeatureFlags: (flags: Record<string, boolean>) =>
    set((s: any) => { s.ui.featureFlags = flags; }, false, 'ui/setFeatureFlags'),
  toggleTheme: () =>
    set((s: any) => {
      const nextTheme = s.ui.theme === 'light' ? 'dark' : 'light';
      s.ui.theme = nextTheme;
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('greensheet:theme', nextTheme);
    }, false, 'ui/toggleTheme'),
  setTheme: (theme: 'light' | 'dark') =>
    set((s: any) => {
      s.ui.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('greensheet:theme', theme);
    }, false, 'ui/setTheme'),
});
