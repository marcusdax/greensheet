import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useRootStore } from '../../../stores/root-store';
import { ToastContainer } from '../ToastContainer';

const resetUiState = () => {
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

describe('ToastContainer', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUiState();
  });

  it('renders nothing when there are no toasts', () => {
    render(<ToastContainer />);
    expect(screen.queryByText(/message/i)).not.toBeInTheDocument();
  });

  it('renders success, error, and info toasts', () => {
    render(<ToastContainer />);
    act(() => {
      useRootStore.getState().ui.pushToast({ kind: 'success', message: 'Saved successfully' });
      useRootStore.getState().ui.pushToast({ kind: 'error', message: 'Something failed' });
      useRootStore.getState().ui.pushToast({ kind: 'info', message: 'Heads up' });
    });
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    expect(screen.getByText('Something failed')).toBeInTheDocument();
    expect(screen.getByText('Heads up')).toBeInTheDocument();
  });

  it('dismisses a toast when the close button is clicked', () => {
    render(<ToastContainer />);
    act(() => {
      useRootStore.getState().ui.pushToast({ kind: 'info', message: 'Dismiss me' });
    });
    const toastMessage = screen.getByText('Dismiss me');
    const closeButton = toastMessage.closest('div')?.querySelector('button');
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton!);
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('applies the correct background color per toast kind', () => {
    render(<ToastContainer />);
    act(() => {
      useRootStore.getState().ui.pushToast({ kind: 'success', message: 'OK' });
      useRootStore.getState().ui.pushToast({ kind: 'error', message: 'ERR' });
      useRootStore.getState().ui.pushToast({ kind: 'info', message: 'INFO' });
    });
    const toasts = screen.getAllByText(/OK|ERR|INFO/);
    expect(toasts).toHaveLength(3);
  });
});
