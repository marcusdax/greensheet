// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system-prompt/index.js';

describe('buildSystemPrompt', () => {
  it('includes Vietnam coffee keywords', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Vietnam');
    expect(prompt).toContain('Robusta');
    expect(prompt).toContain('EUDR');
    expect(prompt).toContain('ODASI');
  });

  it('concatenates all prompt sections', () => {
    const prompt = buildSystemPrompt();
    expect(prompt.length).toBeGreaterThan(2000);
  });
});
