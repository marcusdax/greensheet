import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentChatWidget } from '../AgentChatWidget';
import { resetAiState } from '../../../stores/slices/__tests__/helpers/reset-ai';
import '../../../i18n';

describe('AgentChatWidget', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAiState();
  });

  it('renders collapsed button', () => {
    render(<AgentChatWidget />);
    expect(screen.getByLabelText(/Open coffee agent chat/i)).toBeInTheDocument();
  });

  it('opens chat panel when button is clicked', () => {
    render(<AgentChatWidget />);
    fireEvent.click(screen.getByLabelText(/Open coffee agent chat/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/ODASI Coffee Agent/i)).toBeInTheDocument();
  });

  it('toggles settings panel', () => {
    render(<AgentChatWidget />);
    fireEvent.click(screen.getByLabelText(/Open coffee agent chat/i));
    fireEvent.click(screen.getByLabelText(/Agent Settings/i));
    expect(screen.getByText(/Agent Settings/i)).toBeInTheDocument();
  });
});
