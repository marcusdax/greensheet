import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RuleForm } from '../RuleForm';

describe('RuleForm', () => {
  const campaignId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('keeps raw invalid JSON in the textarea and only submits after valid JSON is entered', async () => {
    const handleSubmit = vi.fn();
    render(<RuleForm campaignId={campaignId} onSubmit={handleSubmit} />);

    await screen.findByLabelText('Conditions JSON');

    const ruleCode = screen.getByLabelText('Rule Code');
    const ruleName = screen.getByLabelText('Rule Name');
    const triggerEvent = screen.getByLabelText('Trigger Event');
    const conditions = screen.getByLabelText('Conditions JSON');
    const submit = screen.getByRole('button', { name: /save/i });

    fireEvent.change(ruleCode, { target: { value: 'COF-001' } });
    fireEvent.change(ruleName, { target: { value: 'Welcome Series' } });
    fireEvent.change(triggerEvent, { target: { value: 'roaster.registered' } });

    // Type invalid JSON — it must stay raw and not be corrupted by JSON.stringify.
    fireEvent.change(conditions, { target: { value: '{"foo":' } });
    expect(conditions).toHaveValue('{"foo":');

    fireEvent.click(submit);
    await waitFor(() => expect(handleSubmit).not.toHaveBeenCalled());

    // Fix to valid JSON and submit.
    fireEvent.change(conditions, { target: { value: '{"foo":"bar"}' } });

    fireEvent.click(submit);
    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
    expect(handleSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        campaignId,
        ruleCode: 'COF-001',
        ruleName: 'Welcome Series',
        triggerEvent: 'roaster.registered',
        conditionsJson: { foo: 'bar' },
      }),
      expect.anything(),
    );
  });
});
