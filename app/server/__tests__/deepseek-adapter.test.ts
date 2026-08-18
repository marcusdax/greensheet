// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { DeepSeekAdapter } from '../providers/deepseek.js';

const mockStream = async function* () {
  yield { choices: [{ delta: { content: 'Hello' } }] };
  yield { choices: [{ delta: { content: ' world' } }] };
};

describe('DeepSeekAdapter', () => {
  it('streams chunks from the OpenAI-compatible API', async () => {
    const adapter = new DeepSeekAdapter();

    vi.spyOn(adapter as any, 'createClient').mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockStream()),
        },
      },
    });

    const chunks: string[] = [];
    for await (const event of adapter.streamChat([{ role: 'user', content: 'hi' }], 'deepseek-chat', 'key')) {
      if (event.chunk) chunks.push(event.chunk);
      if (event.done) break;
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });
});
