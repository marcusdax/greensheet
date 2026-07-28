import { useRootStore } from '../../../root-store';

export const resetUiState = () => {
  const current = useRootStore.getState();
  useRootStore.setState({
    ui: {
      toasts: [],
      featureFlags: {},
      theme: 'light',
      drawer: { open: false, title: '', content: null },
      pushToast: current.ui.pushToast,
      dismissToast: current.ui.dismissToast,
      setFeatureFlags: current.ui.setFeatureFlags,
      toggleTheme: current.ui.toggleTheme,
      setTheme: current.ui.setTheme,
      openDrawer: current.ui.openDrawer,
      closeDrawer: current.ui.closeDrawer,
    },
  });
};
