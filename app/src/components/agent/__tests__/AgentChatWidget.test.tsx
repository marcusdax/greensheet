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

  it('shows missing-key message when sending without an API key', async () => {
    render(<AgentChatWidget />);
    fireEvent.click(screen.getByLabelText(/Open coffee agent chat/i));
    const textarea = screen.getByPlaceholderText(/Ask the agent/i);
    fireEvent.change(textarea, { target: { value: 'Hello agent' } });
    fireEvent.click(screen.getByLabelText(/Send message/i));
    expect(await screen.findByText(/Please add an API key in the agent settings/i)).toBeInTheDocument();
  });
});
