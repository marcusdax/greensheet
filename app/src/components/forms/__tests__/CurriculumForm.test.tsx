import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CurriculumForm } from '../../forms/CurriculumForm';
import { resetAiState } from '../../../stores/slices/__tests__/helpers/reset-ai';
import '../../../i18n';

describe('CurriculumForm', () => {
  const mockOnSubmit = vi.fn();
  
  beforeEach(() => {
    localStorage.clear();
    resetAiState();
    mockOnSubmit.mockClear();
  });

  it('renders all form fields', () => {
    render(<CurriculumForm onSubmit={mockOnSubmit} />);
    
    expect(screen.getByLabelText(/Topic \/ Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Track/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Region/i)).toBeInTheDocument();
    expect(screen.getByTestId('generate-btn')).toBeInTheDocument();
    expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
  });

  it('validates topic is required', async () => {
    render(<CurriculumForm onSubmit={mockOnSubmit} />);
    
    fireEvent.click(screen.getByTestId('save-btn'));
    
    await waitFor(() => expect(mockOnSubmit).not.toHaveBeenCalled());
    
    // Add topic and try again
    fireEvent.change(screen.getByLabelText(/Topic \/ Description/i), { target: { value: 'Test Topic' } });
    fireEvent.click(screen.getByTestId('save-btn'));
    
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
  });

  it('calls onSubmit with correct data when save is clicked', async () => {
    render(<CurriculumForm onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/Topic \/ Description/i), { target: { value: 'Test Topic' } });
    fireEvent.change(screen.getByLabelText(/Track/i), { target: { value: 'quality' } });
    fireEvent.change(screen.getByLabelText(/Level/i), { target: { value: 'beginner' } });
    fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: 'VN-DKL' } });
    
    fireEvent.click(screen.getByTestId('save-btn'));
    
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));

    const callArgs = mockOnSubmit.mock.calls[0];
    const callData = callArgs[0];
    expect(callData.topic).toBe('Test Topic');
    expect(callData.track).toBe('quality');
    expect(callData.level).toBe('beginner');
    expect(callData.regionCode).toBe('VN-DKL');
  });

  it('shows manual edit section when no generated content', () => {
    render(<CurriculumForm onSubmit={mockOnSubmit} />);
    
    expect(screen.getByTestId('manual-edit-section')).toBeInTheDocument();
    expect(screen.queryByTestId('generated-content')).not.toBeInTheDocument();
  });

  it('uses i18n curriculum authoring keys', () => {
    render(<CurriculumForm onSubmit={mockOnSubmit} />);
    
    // Check that i18n keys are being used in the form
    expect(screen.getByText(/Topic \/ Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Track/i)).toBeInTheDocument();
    expect(screen.getByText(/Level/i)).toBeInTheDocument();
    expect(screen.getByText(/Region/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate with AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Save Module/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
  });
});