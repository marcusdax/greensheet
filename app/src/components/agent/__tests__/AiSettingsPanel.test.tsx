import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiSettingsPanel } from '../AiSettingsPanel';
import { useAiStore } from '../../../stores/ai-store';
import { resetAiState } from '../../../stores/slices/__tests__/helpers/reset-ai';
import '../../../i18n';

describe('AiSettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAiState();
  });

  it('updates deepseek api key', () => {
    render(<AiSettingsPanel />);
    const input = screen.getByPlaceholderText(/DeepSeek API key/i);
    fireEvent.change(input, { target: { value: 'sk-test' } });
    expect(useAiStore.getState().providers.deepseek.apiKey).toBe('sk-test');
  });

  it('shows coming soon for claude', () => {
    render(<AiSettingsPanel />);
    fireEvent.click(screen.getByText(/Claude/i));
    expect(screen.getByText(/Claude support is coming soon/i)).toBeInTheDocument();
  });
});
